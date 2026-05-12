import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { openUrl } from "@tauri-apps/plugin-opener";
import { openPty, type PtySession } from "./pty-bridge";
import { attachOscHandlers } from "./osc-handlers";
import { registerPathLinks } from "./pathLinks";
import {
  createBlockTracker,
  xtermMarkerSource,
  type BlockTracker,
} from "./blocks";
import { attachBlockGutter, type BlockGutter } from "./blockGutter";
import { useTabs } from "@/modules/tabs/useTabs";
import { getSettingsSnapshot, useSettings } from "@/lib/settings";
import { getTheme, resolveTheme } from "@/modules/theme/themes";

import "@xterm/xterm/css/xterm.css";

const FONT_FAMILY =
  '"MesloLGS Nerd Font Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace';
const FONT_SIZE = 17;

/**
 * Registry mapping a sessionId to its live SearchAddon. Kept so external
 * consumers (the global search bar, future AI hooks) can drive search
 * without prop-drilling through TerminalStack.
 */
const searchRegistry = new Map<string, SearchAddon>();

export function getSearchAddonFor(sessionId: string): SearchAddon | null {
  return searchRegistry.get(sessionId) ?? null;
}

/**
 * Per-session BlockTracker registry. Mirrors `searchRegistry` — App.tsx
 * looks up the active terminal's tracker to drive prompt-prev/next nav.
 */
const blockRegistry = new Map<string, BlockTracker>();

export function getBlockTrackerFor(sessionId: string): BlockTracker | null {
  return blockRegistry.get(sessionId) ?? null;
}

/** Per-session gutter renderer registry — consulted by the theme-swap
 *  effect so block colors update when the user changes themes. */
const gutterRegistry = new Map<string, BlockGutter>();

/**
 * Per-session xterm reference. Used by the prompt-nav handler to
 * `scrollToLine` after looking up the target line via the tracker.
 */
const termRegistry = new Map<string, XTerm>();

export function getTerminalFor(sessionId: string): XTerm | null {
  return termRegistry.get(sessionId) ?? null;
}

export interface UseTerminalSessionOptions {
  sessionId: string;
  container: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  initialCwd?: string;
  onCwd?: (cwd: string, host: string) => void;
  onExit?: (code: number | null) => void;
  onSearchReady?: (addon: SearchAddon) => void;
  /** Fired the first time a `http(s)://localhost…` URL appears in the
   *  PTY output stream, and again only when a different URL appears.
   *  Lets the chrome offer a "Open preview" affordance without burying
   *  the user in re-fires every time the dev-server logs a request. */
  onDetectedLocalUrl?: (url: string) => void;
  /** Optional element where block status marks should render. When
   *  omitted, the tracker still runs (so prompt-nav works) but no
   *  visual gutter is painted. Pass the `<div class="vy-block-gutter">`
   *  rendered alongside the xterm host in Terminal.tsx. */
  gutter?: React.RefObject<HTMLElement | null>;
}

export interface UseTerminalSession {
  write: (data: string) => void;
  focus: () => void;
  fit: () => void;
  getBuffer: (maxLines?: number) => string | null;
  getSelection: () => string | null;
  getSearch: () => SearchAddon | null;
}

/**
 * Manages an xterm + PTY pair for the lifetime of a single mount.
 * Single useEffect with a `disposed` closure flag, batch cleanups,
 * two-stage debounced resize. The ref-based callback pattern means
 * callers can pass new closures every render without retriggering
 * the lifecycle.
 */
export function useTerminalSession({
  sessionId,
  container,
  visible,
  initialCwd,
  onCwd,
  onExit,
  onSearchReady,
  onDetectedLocalUrl,
  gutter,
}: UseTerminalSessionOptions): UseTerminalSession {
  const settings = useSettings();
  const themeSetting = settings.theme;
  const fontSizeSetting = settings.terminalFontSize;

  const onCwdRef = useRef(onCwd);
  const onExitRef = useRef(onExit);
  const onSearchReadyRef = useRef(onSearchReady);
  const onDetectedLocalUrlRef = useRef(onDetectedLocalUrl);
  useEffect(() => {
    onCwdRef.current = onCwd;
    onExitRef.current = onExit;
    onSearchReadyRef.current = onSearchReady;
    onDetectedLocalUrlRef.current = onDetectedLocalUrl;
  }, [onCwd, onExit, onSearchReady, onDetectedLocalUrl]);

  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const ptyRef = useRef<PtySession | null>(null);

  // Live theme swap — when settings.theme changes, push the new xterm
  // palette into the existing terminal instance (no remount needed).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const xt = getTheme(resolveTheme(themeSetting)).xterm;
    term.options.theme = xt;
    // Repaint block marks in the new palette.
    gutterRegistry.get(sessionId)?.setTheme({
      ok: xt.green ?? "#a9b665",
      fail: xt.red ?? "#ea6962",
    });
  }, [themeSetting, sessionId]);

  // Live font-size swap — re-fits xterm to the new cell metrics, then
  // dispatches a SIGWINCH-equivalent so the shell sees the new size.
  // Row height changes here, so we ask the gutter to re-snap its marks
  // against the new metrics. fit() is synchronous but the viewport's
  // clientHeight only catches up after layout; defer to rAF.
  useEffect(() => {
    const term = termRef.current;
    const fit = fitRef.current;
    if (!term || !fit) return;
    term.options.fontSize = fontSizeSetting;
    fit.fit();
    void ptyRef.current?.resize(term.cols, term.rows);
    requestAnimationFrame(() => {
      gutterRegistry.get(sessionId)?.reposition();
    });
  }, [fontSizeSetting, sessionId]);

  // Re-snap gutter marks whenever the terminal becomes visible again
  // (overlay close, tab switch, fresh mount). Row height can shift
  // between mount and first paint, and a stale `top` calc leaves marks
  // floating between blocks until the next scroll or fit.
  useEffect(() => {
    if (!visible) return;
    requestAnimationFrame(() => {
      gutterRegistry.get(sessionId)?.reposition();
    });
  }, [visible, sessionId]);

  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      // Wait for the terminal font so xterm's canvas renderer measures
      // correctly. If absent, xterm falls back per family stack.
      const fontSize = getSettingsSnapshot().terminalFontSize ?? FONT_SIZE;
      try {
        await document.fonts.load(`${fontSize}px "MesloLGS Nerd Font Mono"`);
      } catch {
        /* font not available — fall back to JetBrains/SF Mono */
      }
      if (disposed || !container.current) return;

      const term = new XTerm({
        fontFamily: FONT_FAMILY,
        fontSize,
        lineHeight: 1.05,
        theme: getTheme(resolveTheme(getSettingsSnapshot().theme)).xterm,
        cursorBlink: true,
        cursorStyle: "block",
        // 5k lines × 80 cols × ~16 B per cell ≈ 6 MB per tab.
        scrollback: 5_000,
        allowProposedApi: true,
      });
      termRef.current = term;

      // ⌘C / ⌘V on the active xterm — xterm.js doesn't wire these for us.
      // ⌘C copies the current selection straight to system clipboard
      // (works for both bare-xterm and tmux mouse-selection cases since
      // both surface the selected text via term.getSelection()). ⌘V is
      // a normal paste: read the clipboard and write to the PTY.
      term.attachCustomKeyEventHandler((e) => {
        if (e.type !== "keydown" || !e.metaKey) return true;
        const key = e.key.toLowerCase();
        if (key === "c") {
          const sel = term.getSelection();
          if (sel) {
            void navigator.clipboard.writeText(sel);
            return false;
          }
        } else if (key === "v") {
          void navigator.clipboard.readText().then((text) => {
            if (text) void ptyRef.current?.write(text);
          });
          return false;
        }
        return true;
      });

      // OSC 52 — apps running inside the terminal (notably tmux with
      // `set -g set-clipboard on`) emit `\e]52;c;<base64>\a` to ask the
      // terminal to put their selection on the system clipboard.
      // xterm.js doesn't ship a default handler, so register our own.
      const osc52Dispose = term.parser.registerOscHandler(52, (data) => {
        // Format: "<target>;<base64>" where target is c|p|s|0-7.
        // Decode the base64 body and write to the OS clipboard.
        const semi = data.indexOf(";");
        if (semi < 0) return false;
        const body = data.slice(semi + 1);
        try {
          const text = atob(body);
          void navigator.clipboard.writeText(text);
        } catch {
          /* invalid base64; ignore */
        }
        return true;
      });
      cleanups.push(() => osc52Dispose.dispose());

      const fit = new FitAddon();
      fitRef.current = fit;
      term.loadAddon(fit);

      const search = new SearchAddon();
      term.loadAddon(search);
      searchRef.current = search;
      searchRegistry.set(sessionId, search);
      cleanups.push(() => searchRegistry.delete(sessionId));

      term.loadAddon(
        new WebLinksAddon((_e, uri) => void openUrl(uri).catch(console.error)),
      );

      term.open(container.current);
      fit.fit();

      // Stash the xterm in the per-session registry so external nav (the
      // prompt-prev/next shortcuts in App.tsx) can scroll it without
      // prop-drilling.
      termRegistry.set(sessionId, term);
      cleanups.push(() => termRegistry.delete(sessionId));

      // Block tracker — opens a block on each prompt-A, closes on D.
      // The tracker is purely data; rendering is the gutter's job.
      const tracker = createBlockTracker(xtermMarkerSource(term));
      blockRegistry.set(sessionId, tracker);
      cleanups.push(() => {
        tracker.dispose();
        blockRegistry.delete(sessionId);
      });

      // Wire DOM gutter (a sibling to the xterm host) if the host
      // provided one. The gutter listens to tracker events + scroll +
      // resize and paints absolute-positioned divs by pixel offset, so
      // marks live OUTSIDE the terminal grid and never obscure content.
      const gutterEl = gutter?.current;
      let gutterApi: BlockGutter | null = null;
      if (gutterEl) {
        const xt = getTheme(resolveTheme(getSettingsSnapshot().theme)).xterm;
        gutterApi = attachBlockGutter(term, tracker, gutterEl, {
          ok: xt.green ?? "#a9b665",
          fail: xt.red ?? "#ea6962",
        });
        cleanups.push(() => gutterApi?.dispose());
        gutterRegistry.set(sessionId, gutterApi);
        cleanups.push(() => gutterRegistry.delete(sessionId));
      }

      // Path-link provider — turns `/Users/me/foo.ts:42` printed by
      // tsc/cargo/pytest/etc. into a clickable link that opens the file
      // in valley's editor.
      const pathLinkDispose = registerPathLinks(term);
      cleanups.push(() => pathLinkDispose.dispose());

      // Try WebGL — falls back silently to canvas on Tauri WKWebView if
      // the context isn't available.
      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => webgl.dispose());
        term.loadAddon(webgl);
      } catch (e) {
        console.warn("WebGL renderer unavailable:", e);
      }

      const oscDispose = attachOscHandlers(term, {
        onCwd: (next, host) => {
          onCwdRef.current?.(next, host);
          // Mirror cwd into the owning tab so the file explorer + other
          // chrome can subscribe via useTabs. Sessions are named
          // `pty-<tabId>`; strip the prefix to recover the tab id.
          const tabId = sessionId.startsWith("pty-")
            ? sessionId.slice(4)
            : null;
          if (tabId) useTabs.getState().setCwd(tabId, next, host);
        },
        onPromptStart: () => tracker.onPromptStart(),
        onCommandStart: () => tracker.onCommandStart(),
        onExitCode: (code) => tracker.onCommandExit(code),
      });
      cleanups.push(oscDispose);

      onSearchReadyRef.current?.(search);

      // Per-session UTF-8 decoder so a multi-byte codepoint split across
      // chunks doesn't get spliced between unrelated streams. Used only
      // for URL detection; the terminal itself takes the raw bytes.
      const urlDecoder = new TextDecoder("utf-8", { fatal: false });
      let lastDetectedUrl: string | null = null;

      const pty = await openPty(
        {
          id: sessionId,
          cols: term.cols,
          rows: term.rows,
          cwd: initialCwd,
        },
        {
          onData: (bytes) => {
            term.write(bytes);
            // Cheap byte-level prefilter for ":" "/" "/". Skips the decode
            // + regex on the overwhelming majority of chunks (ordinary
            // command output, log tails). When it triggers, decode just
            // this chunk and look for a localhost URL.
            if (
              onDetectedLocalUrlRef.current &&
              containsSchemeSeparator(bytes)
            ) {
              const text = urlDecoder.decode(bytes, { stream: true });
              const matches = text.match(LOCAL_URL_RE);
              if (matches && matches.length > 0) {
                const url = stripTrailingPunct(matches[matches.length - 1]!);
                if (url && url !== lastDetectedUrl) {
                  lastDetectedUrl = url;
                  onDetectedLocalUrlRef.current(url);
                }
              }
            }
          },
          onExit: (code) => {
            term.write(`\r\n\x1b[2m[process exited: ${code ?? "?"}]\x1b[0m\r\n`);
            term.options.disableStdin = true;
            onExitRef.current?.(code);
          },
        },
      );
      if (disposed) {
        void pty.close();
        return;
      }
      ptyRef.current = pty;

      const dataDisposer = term.onData((data) => void pty.write(data));
      cleanups.push(() => dataDisposer.dispose());

      // Two-stage debounce:
      //  - FIT runs frequently (~one frame) so xterm visually keeps up
      //    with the window during drag. Local, no IPC.
      //  - PTY_RESIZE only fires on the trailing edge of the drag,
      //    because SIGWINCH is what causes shells / fancy prompts to
      //    redraw mid-resize, which the user perceives as blinking.
      const FIT_DEBOUNCE_MS = 8;
      const PTY_RESIZE_DEBOUNCE_MS = 256;
      let lastSentCols = term.cols;
      let lastSentRows = term.rows;
      let lastW = container.current.clientWidth;
      let lastH = container.current.clientHeight;
      let fitTimer: ReturnType<typeof setTimeout> | null = null;
      let ptyTimer: ReturnType<typeof setTimeout> | null = null;

      const el = container.current;
      const flushPtyResize = () => {
        ptyTimer = null;
        if (disposed) return;
        if (term.cols === lastSentCols && term.rows === lastSentRows) return;
        lastSentCols = term.cols;
        lastSentRows = term.rows;
        void pty.resize(term.cols, term.rows);
      };

      const observer = new ResizeObserver(() => {
        if (fitTimer) clearTimeout(fitTimer);
        fitTimer = setTimeout(() => {
          fitTimer = null;
          if (disposed) return;
          const w = el.clientWidth;
          const h = el.clientHeight;
          if (w === lastW && h === lastH) return;
          lastW = w;
          lastH = h;
          fit.fit();
          if (ptyTimer) clearTimeout(ptyTimer);
          ptyTimer = setTimeout(flushPtyResize, PTY_RESIZE_DEBOUNCE_MS);
        }, FIT_DEBOUNCE_MS);
      });
      observer.observe(el);
      cleanups.push(() => {
        observer.disconnect();
        if (fitTimer) clearTimeout(fitTimer);
        if (ptyTimer) clearTimeout(ptyTimer);
      });

      if (visible) term.focus();
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
      void ptyRef.current?.close();
      ptyRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    fitRef.current?.fit();
    termRef.current?.focus();
  }, [visible]);

  const write = useCallback((data: string) => {
    void ptyRef.current?.write(data);
  }, []);

  const focus = useCallback(() => {
    termRef.current?.focus();
  }, []);

  const fit = useCallback(() => {
    fitRef.current?.fit();
  }, []);

  const getBuffer = useCallback((maxLines = 200): string | null => {
    const t = termRef.current;
    if (!t) return null;
    const buf = t.buffer.active;
    const total = buf.length;
    const lines: string[] = [];
    const start = Math.max(0, total - maxLines);
    for (let i = start; i < total; i++) {
      lines.push(buf.getLine(i)?.translateToString(true) ?? "");
    }
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }, []);

  const getSelection = useCallback((): string | null => {
    const sel = termRef.current?.getSelection() ?? "";
    return sel.length > 0 ? sel : null;
  }, []);

  const getSearch = useCallback((): SearchAddon | null => {
    return searchRef.current;
  }, []);

  return { write, focus, fit, getBuffer, getSelection, getSearch };
}

// Dev-server-style URL pattern. Anchors on a word boundary so we don't
// catch substrings of longer paths. Trailing punctuation (`,`, `.`, `)`)
// is stripped by `stripTrailingPunct` since shells often emit it next to
// a printed URL ("listening on http://localhost:3000.").
const LOCAL_URL_RE =
  /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d{1,5})?(?:\/[^\s\x1b]*)?/g;

function stripTrailingPunct(url: string): string {
  return url.replace(/[.,);\]]+$/, "");
}

/** Looks for the literal byte sequence ":" "/" "/" — the cheapest signal
 *  a chunk *might* contain a URL. Lets us avoid per-chunk UTF-8 decode +
 *  regex when running noisy commands that just print plain text. */
function containsSchemeSeparator(bytes: Uint8Array): boolean {
  const n = bytes.length;
  for (let i = 0; i < n - 2; i++) {
    if (bytes[i] === 0x3a && bytes[i + 1] === 0x2f && bytes[i + 2] === 0x2f) {
      return true;
    }
  }
  return false;
}
