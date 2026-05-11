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
import { findActive } from "@/modules/terminal/lib/splits";
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
    (snippet: Snippet) => {
      const settings = getSettingsSnapshot();
      const body = substitute(snippet.body, {
        lhost: settings.snippetLhost || undefined,
        lport: settings.snippetLport || undefined,
        target: settings.snippetTarget || undefined,
        port: settings.snippetPort || undefined,
      });

      close();

      const s = useTabs.getState();
      const tab = s.tabs.find((t) => t.id === s.activeId);
      if (tab && tab.kind === "terminal" && tab.panes) {
        const active = findActive(tab.panes);
        if (active) {
          void native.pty.write(active.sessionId, body);
          return;
        }
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
        const selected = flat[clampedIdx];
        if (selected) applySnippet(selected);
        return;
      }
      if (e.key === "Escape") {
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
            placeholder="Fuzzy-search payloads · ⌘⇧K to toggle"
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
                      onSelect={applySnippet}
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
  onSelect(s: Snippet): void;
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
      onMouseDown={() => onSelect(snippet)}
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
