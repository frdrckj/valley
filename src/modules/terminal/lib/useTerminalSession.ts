import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { openPty, type PtyBridge } from "./pty-bridge";
import { attachOscHandlers } from "./osc-handlers";
import { useTabs } from "@/modules/tabs/useTabs";
import { getSettingsSnapshot, useSettings } from "@/lib/settings";
import { getTheme, resolveTheme } from "@/modules/theme/themes";

import "@xterm/xterm/css/xterm.css";

/**
 * Registry mapping a terminal sessionId to its live SearchAddon. Each
 * `useTerminalSession` registers on attach and clears on cleanup so
 * external consumers (the global search bar, future AI-selection hooks)
 * can drive search without prop-drilling through TerminalStack.
 */
const searchRegistry = new Map<string, SearchAddon>();

export function getSearchAddonFor(sessionId: string): SearchAddon | null {
  return searchRegistry.get(sessionId) ?? null;
}

export interface UseTerminalSession {
  attach: (host: HTMLDivElement) => void;
  fit: () => void;
  cwd: string | null;
  getTail: () => string;
  /** Returns the SearchAddon for this terminal so a search bar can drive it. */
  getSearch: () => SearchAddon | null;
}

export function useTerminalSession(opts: {
  sessionId: string;
  cwd?: string;
}): UseTerminalSession {
  const [cwd, setCwd] = useState<string | null>(opts.cwd ?? null);
  const themeSetting = useSettings().theme;
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const bridgeRef = useRef<PtyBridge | null>(null);
  const oscDisposerRef = useRef<(() => void) | null>(null);
  const tailRef = useRef<string[]>([]);
  const searchRef = useRef<SearchAddon | null>(null);

  // Live theme swap — when settings.theme changes, push the new xterm
  // palette into the existing terminal instance (no remount needed).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = getTheme(resolveTheme(themeSetting)).xterm;
  }, [themeSetting]);

  function attach(host: HTMLDivElement) {
    // Sync guard. React 19 StrictMode mounts → unmounts → mounts again in dev;
    // the cleanup nulls refs so this guard only fires on the same-host re-call,
    // never on the strict-mode second mount. Caller (Terminal.tsx) is
    // responsible for awaiting font load before calling this.
    if (termRef.current) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    const term = new XTerm({
      // Exact match to terax-ai. Geist Mono is intentionally NOT in this
      // stack: browsers fall back per-glyph, and dropping a bundled font
      // *before* MesloLGS made the regular ASCII characters render in
      // Geist Mono while only the Nerd Font icons came from MesloLGS.
      // Keeping the terminal pure to MesloLGS → JetBrains → SF Mono
      // matches what terax-ai users see.
      fontFamily:
        '"MesloLGS Nerd Font Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace',
      fontSize: 17,
      lineHeight: 1.05,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      theme: getTheme(resolveTheme(getSettingsSnapshot().theme)).xterm,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    const search = new SearchAddon();
    term.loadAddon(search);
    searchRef.current = search;
    searchRegistry.set(opts.sessionId, search);
    term.loadAddon(new WebLinksAddon());
    // We use xterm's default canvas renderer — WebglAddon was triggering
    // tearing/glitch artifacts on the Tauri WKWebView. Canvas is slower
    // but rock-solid; we'll revisit WebGL if it becomes a perf problem.

    term.open(host);
    fit.fit();

    oscDisposerRef.current = attachOscHandlers(term, {
      onCwd: (next) => {
        setCwd(next);
        // Mirror cwd into the owning tab so the file explorer + other
        // chrome can subscribe via the useTabs store. Sessions are named
        // `pty-<tabId>`; strip the prefix to recover the tab id.
        const tabId = opts.sessionId.startsWith("pty-")
          ? opts.sessionId.slice(4)
          : null;
        if (tabId) useTabs.getState().setCwd(tabId, next);
      },
    });

    void openPty({
      id: opts.sessionId,
      cwd: opts.cwd,
      term,
      onOutput: (raw) => {
        const text = new TextDecoder().decode(raw);
        const lines = text.split(/\r?\n/);
        for (const ln of lines) tailRef.current.push(ln);
        while (tailRef.current.length > 300) tailRef.current.shift();
      },
    }).then((b) => {
      bridgeRef.current = b;
    });

    termRef.current = term;
    fitRef.current = fit;
  }

  function fit() {
    fitRef.current?.fit();
  }

  function getTail(): string {
    return tailRef.current.join("\n");
  }

  function getSearch(): SearchAddon | null {
    return searchRef.current;
  }

  useEffect(() => {
    return () => {
      oscDisposerRef.current?.();
      oscDisposerRef.current = null;
      void bridgeRef.current?.dispose();
      bridgeRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      searchRef.current = null;
      searchRegistry.delete(opts.sessionId);
    };
  }, [opts.sessionId]);

  return { attach, fit, cwd, getTail, getSearch };
}

// Theme palettes live in @/modules/theme/themes — applied at construction
// via getSettingsSnapshot() and re-applied reactively in Terminal.tsx.
