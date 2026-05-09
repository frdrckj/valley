import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { SearchAddon } from "@xterm/addon-search";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { WebglAddon } from "@xterm/addon-webgl";
import { openPty, type PtyBridge } from "./pty-bridge";
import { attachOscHandlers } from "./osc-handlers";

import "@xterm/xterm/css/xterm.css";

export interface UseTerminalSession {
  attach: (host: HTMLDivElement) => void;
  fit: () => void;
  cwd: string | null;
  getTail: () => string;
}

export function useTerminalSession(opts: {
  sessionId: string;
  cwd?: string;
}): UseTerminalSession {
  const [cwd, setCwd] = useState<string | null>(opts.cwd ?? null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const bridgeRef = useRef<PtyBridge | null>(null);
  const oscDisposerRef = useRef<(() => void) | null>(null);
  const tailRef = useRef<string[]>([]);

  function attach(host: HTMLDivElement) {
    // Sync guard. React 19 StrictMode mounts → unmounts → mounts again in dev;
    // the cleanup nulls refs so this guard only fires on the same-host re-call,
    // never on the strict-mode second mount. Caller (Terminal.tsx) is
    // responsible for awaiting font load before calling this.
    if (termRef.current) return;
    while (host.firstChild) host.removeChild(host.firstChild);

    const term = new XTerm({
      // MesloLGS Nerd Font Mono is the font p10k recommends users install,
      // and the only one in this stack with Powerline / Nerd Font icons.
      // Geist Mono Variable (bundled via @fontsource) is the design-system
      // font — it lacks Nerd Font glyphs but has the right aesthetic, so
      // we fall back to it when the user's system doesn't have MesloLGS.
      fontFamily:
        '"MesloLGS Nerd Font Mono", "Geist Mono Variable", "JetBrains Mono", SFMono-Regular, Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.1,
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
      theme: gruvboxDarkXTerm,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new SearchAddon());
    term.loadAddon(new WebLinksAddon());
    try {
      term.loadAddon(new WebglAddon());
    } catch {
      /* WebGL unavailable on the GPU — fall back to canvas (xterm default). */
    }

    term.open(host);
    fit.fit();

    oscDisposerRef.current = attachOscHandlers(term, {
      onCwd: setCwd,
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

  useEffect(() => {
    return () => {
      oscDisposerRef.current?.();
      oscDisposerRef.current = null;
      void bridgeRef.current?.dispose();
      bridgeRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  return { attach, fit, cwd, getTail };
}

const gruvboxDarkXTerm = {
  background: "#1d2021",
  foreground: "#ebdbb2",
  cursor: "#fabd2f",
  cursorAccent: "#1d2021",
  selectionBackground: "rgba(235,219,178,0.18)",
  black: "#282828",
  red: "#fb4934",
  green: "#b8bb26",
  yellow: "#fabd2f",
  blue: "#83a598",
  magenta: "#d3869b",
  cyan: "#8ec07c",
  white: "#ebdbb2",
  brightBlack: "#928374",
  brightRed: "#fb4934",
  brightGreen: "#b8bb26",
  brightYellow: "#fabd2f",
  brightBlue: "#83a598",
  brightMagenta: "#d3869b",
  brightCyan: "#8ec07c",
  brightWhite: "#fbf1c7",
};
