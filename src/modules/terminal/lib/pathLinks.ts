import type { IDisposable, Terminal as XTerm } from "@xterm/xterm";
import { useTabs } from "@/modules/tabs/useTabs";

/**
 * Register a link provider that turns absolute file paths printed in the
 * terminal into clickable links — `cargo`, `tsc`, `pytest`, etc. emit
 * paths like `/Users/me/foo.ts:42:8` in their error output, and clicking
 * one should open the file in valley's editor instead of forcing the
 * user to copy-paste.
 *
 * False-positives (a non-file path that looks like one) just open an
 * empty file viewer with a friendly error — no real cost. The regex
 * deliberately requires a leading `/` and at least one path segment so
 * it doesn't match arbitrary text containing slashes.
 */

// Anchored on `/`; allows path components, optional `:line` and `:line:col`
// suffix; lookbehind ensures we don't catch the trailing `/` of a URL like
// `http://example.com/` (already handled by WebLinksAddon).
const PATH_RE =
  /(?<![A-Za-z0-9])\/(?:[A-Za-z0-9_.\-+]+\/)+[A-Za-z0-9_.\-+]+(?::\d+){0,2}/g;

export function registerPathLinks(term: XTerm): IDisposable {
  return term.registerLinkProvider({
    provideLinks(bufferLineNumber, callback) {
      const buf = term.buffer.active;
      const line = buf.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }
      const text = line.translateToString(true);
      const links: Array<{
        range: { start: { x: number; y: number }; end: { x: number; y: number } };
        text: string;
        activate: (event: MouseEvent, text: string) => void;
      }> = [];
      PATH_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = PATH_RE.exec(text)) !== null) {
        const matched = m[0];
        const start = m.index + 1; // xterm columns are 1-based
        links.push({
          text: matched,
          range: {
            start: { x: start, y: bufferLineNumber },
            end: { x: start + matched.length - 1, y: bufferLineNumber },
          },
          activate: (_e, raw) => {
            // Strip the :line[:col] suffix — we don't yet jump-to-line
            // in the editor; the file just opens at the top.
            const cleanPath = raw.replace(/(:\d+)+$/, "");
            const s = useTabs.getState();
            const existing = s.tabs.find(
              (t) => t.kind === "file" && t.path === cleanPath,
            );
            if (existing) {
              s.activate(existing.id);
            } else {
              const label = cleanPath.split("/").pop() ?? cleanPath;
              s.open({ kind: "file", label, path: cleanPath });
            }
          },
        });
      }
      callback(links.length > 0 ? links : undefined);
    },
  });
}
