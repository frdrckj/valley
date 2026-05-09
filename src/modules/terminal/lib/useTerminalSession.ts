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

  function attach(host: HTMLDivElement) {
    if (termRef.current) return;
    const term = new XTerm({
      fontFamily: 'Geist Mono Variable, Geist Mono, ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.0,
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
    }).then((b) => {
      bridgeRef.current = b;
    });

    termRef.current = term;
    fitRef.current = fit;
  }

  function fit() {
    fitRef.current?.fit();
  }

  useEffect(() => {
    return () => {
      oscDisposerRef.current?.();
      void bridgeRef.current?.dispose();
      termRef.current?.dispose();
    };
  }, []);

  return { attach, fit, cwd };
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
