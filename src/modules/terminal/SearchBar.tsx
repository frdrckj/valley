import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Kbd } from "@/components/Kbd";
import { findActive } from "./lib/splits";
import { getSearchAddonFor } from "./lib/useTerminalSession";
import { useTabs } from "@/modules/tabs/useTabs";

interface SearchBarProps {
  onClose: () => void;
}

/**
 * Inline find-in-terminal bar. Drives the active pane's xterm SearchAddon.
 * Mounts above the terminal pane when ⌘F is pressed; Esc closes.
 */
export function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Resolve the active terminal's SearchAddon via the registry.
  function activeAddon() {
    const s = useTabs.getState();
    const tab = s.tabs.find((t) => t.id === s.activeId);
    if (!tab || tab.kind !== "terminal") return null;
    const active = findActive(tab.panes);
    if (!active) return null;
    return getSearchAddonFor(active.sessionId);
  }

  function find(forward: boolean) {
    if (!query) return;
    const addon = activeAddon();
    if (!addon) return;
    const opts = { caseSensitive: matchCase };
    if (forward) addon.findNext(query, opts);
    else addon.findPrevious(query, opts);
  }

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (!query) {
      activeAddon()?.clearDecorations();
      return;
    }
    activeAddon()?.findNext(query, { caseSensitive: matchCase });
  }, [query, matchCase]);

  return (
    <div
      className="vy-search-bar"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          activeAddon()?.clearDecorations();
          onClose();
        } else if (e.key === "Enter") {
          e.preventDefault();
          find(!e.shiftKey);
        }
      }}
    >
      <Icon name="search" size={12} style={{ color: "var(--text-muted)" }} />
      <input
        ref={inputRef}
        className="vy-search-input"
        placeholder="find in terminal"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
      />
      <button
        className={`vy-search-flag${matchCase ? " is-on" : ""}`}
        type="button"
        title="Match case"
        onClick={() => setMatchCase((v) => !v)}
      >
        Aa
      </button>
      <button
        className="vy-search-nav"
        type="button"
        title="Previous (⇧↩)"
        onClick={() => find(false)}
      >
        <Icon name="chev-d" size={12} style={{ transform: "rotate(180deg)" }} />
      </button>
      <button
        className="vy-search-nav"
        type="button"
        title="Next (↩)"
        onClick={() => find(true)}
      >
        <Icon name="chev-d" size={12} />
      </button>
      <span className="vy-search-hint">
        <Kbd>esc</Kbd>
      </span>
      <button
        className="vy-search-close"
        type="button"
        title="Close"
        onClick={() => {
          activeAddon()?.clearDecorations();
          onClose();
        }}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}
