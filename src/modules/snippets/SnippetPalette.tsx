import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useSnippetPalette } from "./lib/useSnippetPalette";
import { SNIPPETS, type Snippet, type SnippetCategory } from "./lib/snippets";
import { substitute } from "./lib/substitute";
import { fuzzyScore } from "@/modules/omnibar/lib/fuzzy";
import { getSettingsSnapshot } from "@/lib/settings";
import { useTabs } from "@/modules/tabs/useTabs";
import { useEngagement } from "@/modules/engagement/useEngagement";
import { native } from "@/lib/native";

/** ------------------------------------------------------------------ */
/*  Helpers                                                              */
/** ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<SnippetCategory, string> = {
  "reverse-shell": "Reverse Shell",
  "web-payload": "Web Payload",
  "linux-enum": "Linux Enum",
  "windows-enum": "Windows Enum",
  "file-transfer": "File Transfer",
  utility: "Utility",
};

const CATEGORY_ORDER: SnippetCategory[] = [
  "reverse-shell",
  "web-payload",
  "linux-enum",
  "windows-enum",
  "file-transfer",
  "utility",
];

interface ScoredSnippet {
  snippet: Snippet;
  score: number;
}

function filterSnippets(query: string): Snippet[] {
  const q = query.trim();
  if (q === "") return SNIPPETS;
  const scored: ScoredSnippet[] = [];
  for (const snippet of SNIPPETS) {
    const text = `${snippet.title} ${snippet.category} ${snippet.body}`;
    const score = fuzzyScore(q, text);
    if (score !== null) scored.push({ snippet, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.snippet);
}

function groupByCategory(snippets: Snippet[]): Map<SnippetCategory, Snippet[]> {
  const map = new Map<SnippetCategory, Snippet[]>();
  for (const s of snippets) {
    const arr = map.get(s.category) ?? [];
    arr.push(s);
    map.set(s.category, arr);
  }
  return map;
}

function flattenOrdered(groups: Map<SnippetCategory, Snippet[]>): Snippet[] {
  const out: Snippet[] = [];
  for (const cat of CATEGORY_ORDER) {
    const arr = groups.get(cat);
    if (arr) out.push(...arr);
  }
  return out;
}

/** ------------------------------------------------------------------ */
/*  Toast                                                                */
/** ------------------------------------------------------------------ */

interface ToastState {
  msg: string;
  key: number;
}

/** ------------------------------------------------------------------ */
/*  Main component                                                       */
/** ------------------------------------------------------------------ */

export function SnippetPalette() {
  const { isOpen, close } = useSnippetPalette();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Subscribed reads — these re-render the palette when the active
  // engagement changes mid-session OR when the active terminal swaps
  // hosts via `ssh kali`, so the chips never lie about where the
  // snippet is about to land.
  const activeTabId = useTabs((s) => s.activeId);
  const cwdHost = useTabs(
    (s) => s.tabs.find((t) => t.id === s.activeId)?.cwdHost ?? "",
  );
  const engagementName = useEngagement((s) => s.active()?.name ?? "");
  const engagementTarget = useEngagement((s) => s.active()?.scope[0] ?? "");
  // `activeTabId` reads are referenced so the linter sees the dependency
  // wiring — the cwdHost selector already depends on it, but reading it
  // here documents the intent.
  void activeTabId;

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  const filtered = filterSnippets(query);
  const groups = groupByCategory(filtered);
  const flat = flattenOrdered(groups);
  const clampedIdx = flat.length === 0 ? 0 : Math.min(activeIdx, flat.length - 1);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const showToast = useCallback((msg: string) => {
    setToast({ msg, key: Date.now() });
    setTimeout(() => setToast(null), 2000);
  }, []);

  const applySnippet = useCallback(
    (snippet: Snippet, autoRun: boolean) => {
      const settings = getSettingsSnapshot();
      // $TARGET resolution order:
      //   1. The active engagement's first in-scope host — what the
      //      operator is currently working against. Switching engagements
      //      flips the default automatically.
      //   2. Settings → snippetTarget — the user's manual override when
      //      no engagement is active or scope is empty.
      // Anything explicit in the snippet body (e.g. `nc 10.0.0.1`)
      // bypasses both since substitute() only touches the literal token.
      const engTarget = useEngagement.getState().active()?.scope[0];
      const body = substitute(snippet.body, {
        lhost: settings.snippetLhost || undefined,
        lport: settings.snippetLport || undefined,
        target: engTarget || settings.snippetTarget || undefined,
        port: settings.snippetPort || undefined,
      });
      // When the user wants to review/edit before firing (the default
      // Enter path), we paste the body and stop. The user hits Enter
      // themselves once the line looks right. autoRun=true (⌘⏎) appends
      // a CR so the shell executes immediately — same byte zsh produces
      // for a real Enter keypress at the prompt.
      const payload = autoRun ? body + "\r" : body;

      close();

      const s = useTabs.getState();
      const tab = s.tabs.find((t) => t.id === s.activeId);
      if (tab && tab.kind === "terminal" && tab.sessionId) {
        void native.pty.write(tab.sessionId, payload);
        return;
      }
      // Fallback: copy to clipboard
      void navigator.clipboard.writeText(body);
      showToast("Copied to clipboard (no active terminal)");
    },
    [close, showToast],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const len = flat.length;
      if (
        e.key === "ArrowDown" ||
        (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n")
      ) {
        e.preventDefault();
        setActiveIdx((i) => (len === 0 ? 0 : (i + 1) % len));
        return;
      }
      if (
        e.key === "ArrowUp" ||
        (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "p")
      ) {
        e.preventDefault();
        setActiveIdx((i) => (len === 0 ? 0 : (i - 1 + len) % len));
        return;
      }
      if (e.key === "Enter") {
        // preventDefault + stopPropagation so the Enter never leaks past
        // the palette. Without these the keypress reaches the xterm
        // helper textarea once focus returns to the terminal, which
        // sends a CR to the PTY and runs whatever we just pasted —
        // exactly the auto-execute bug the user hit.
        e.preventDefault();
        e.stopPropagation();
        const selected = flat[clampedIdx];
        if (selected) {
          // ⌘⏎ (or ⌃⏎ on linux/windows-style ctrl) = send + run.
          // Plain Enter = paste only, user reviews + runs themselves.
          const autoRun = e.metaKey || e.ctrlKey;
          applySnippet(selected, autoRun);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
    },
    [flat, clampedIdx, applySnippet, close],
  );

  if (!isOpen) return null;

  let globalIdx = 0;

  return (
    <div className="vy-snippet-palette-backdrop" onMouseDown={close}>
      <div
        className="vy-snippet-palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="vy-snippet-palette-input-wrap">
          <input
            ref={inputRef}
            className="vy-snippet-palette-input"
            placeholder="Fuzzy-search payloads · ⏎ paste · ⌘⏎ paste + run"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {(cwdHost || engagementName || engagementTarget) && (
          <div className="vy-snippet-palette-chips">
            {cwdHost && (
              <span
                className="vy-snippet-palette-chip vy-snippet-palette-chip-remote"
                title="Snippet will be sent through the active SSH session — make sure the syntax is correct for the remote shell"
              >
                remote: {cwdHost}
              </span>
            )}
            {engagementName && (
              <span
                className="vy-snippet-palette-chip"
                title="Active engagement — used to scope recents and (when set) provides $TARGET"
              >
                engagement: {engagementName}
              </span>
            )}
            {engagementTarget && (
              <span
                className="vy-snippet-palette-chip vy-snippet-palette-chip-target"
                title="$TARGET placeholder will be substituted with this value"
              >
                $TARGET → {engagementTarget}
              </span>
            )}
          </div>
        )}

        <div className="vy-snippet-palette-results">
          {CATEGORY_ORDER.map((cat) => {
            const items = groups.get(cat);
            if (!items || items.length === 0) return null;
            return (
              <div key={cat} className="vy-snippet-palette-group">
                <div className="vy-snippet-palette-group-head">
                  {CATEGORY_LABELS[cat]}
                </div>
                {items.map((snippet) => {
                  const idx = globalIdx++;
                  return (
                    <SnippetRow
                      key={snippet.id}
                      snippet={snippet}
                      isActive={idx === clampedIdx}
                      rowRef={idx === clampedIdx ? activeRowRef : undefined}
                      onSelect={(snippet, autoRun) => applySnippet(snippet, autoRun)}
                      onHover={() => setActiveIdx(idx)}
                    />
                  );
                })}
              </div>
            );
          })}

          {flat.length === 0 && (
            <div className="vy-snippet-palette-empty">No matching snippets</div>
          )}
        </div>

        {toast && (
          <div key={toast.key} className="vy-snippet-palette-toast">
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------ */
/*  SnippetRow sub-component                                             */
/** ------------------------------------------------------------------ */

interface SnippetRowProps {
  snippet: Snippet;
  isActive: boolean;
  rowRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** `autoRun` mirrors the keyboard semantics: plain click = paste only,
   *  ⌘/⌃ + click = paste and execute. */
  onSelect(s: Snippet, autoRun: boolean): void;
  onHover(): void;
}

function SnippetRow({
  snippet,
  isActive,
  rowRef,
  onSelect,
  onHover,
}: SnippetRowProps) {
  const preview = snippet.body.slice(0, 60) + (snippet.body.length > 60 ? "…" : "");
  return (
    <div
      ref={rowRef}
      className={`vy-snippet-palette-row${isActive ? " is-active" : ""}`}
      onMouseDown={(e) => onSelect(snippet, e.metaKey || e.ctrlKey)}
      onMouseEnter={onHover}
    >
      <span
        className={`vy-snippet-palette-cat-pill cat-${snippet.category}`}
      >
        {snippet.category}
      </span>
      <span className="vy-snippet-palette-row-title">{snippet.title}</span>
      <span className="vy-snippet-palette-row-preview">{preview}</span>
    </div>
  );
}
