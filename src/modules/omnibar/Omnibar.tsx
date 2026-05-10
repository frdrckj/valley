import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/Icon";
import { useTabs } from "@/modules/tabs/useTabs";
import { useOmnibar } from "./lib/useOmnibar";
import {
  getOpenTabs,
  getRecentItems,
  walkCwd,
  getModifiedFiles,
  getCommands,
  type OmniItem,
  type TabItem,
  type RecentItem,
  type FileItem,
  type ModifiedItem,
  type CommandItem,
} from "./lib/sources";
import { fuzzyScore } from "./lib/fuzzy";

/** ------------------------------------------------------------------ */
/*  Types                                                                */
/** ------------------------------------------------------------------ */

type ScoredItem = { item: OmniItem; score: number };

type GroupedResults = {
  tabs: TabItem[];
  recent: RecentItem[];
  files: FileItem[];
  modified: ModifiedItem[];
  commands: CommandItem[];
};

/** ------------------------------------------------------------------ */
/*  Helper: icon for a result row                                        */
/** ------------------------------------------------------------------ */

function itemIcon(item: OmniItem) {
  if (item.kind === "tab") {
    if (item.tabKind === "terminal") return "terminal";
    if (item.tabKind === "preview") return "search";
    return "file";
  }
  if (item.kind === "command") return "keyboard";
  return "file";
}


/** ------------------------------------------------------------------ */
/*  Flatten grouped into a flat list for keyboard nav                   */
/** ------------------------------------------------------------------ */

function flatten(groups: GroupedResults): OmniItem[] {
  return [
    ...groups.tabs,
    ...groups.recent,
    ...groups.files,
    ...groups.modified,
    ...groups.commands,
  ];
}

/** ------------------------------------------------------------------ */
/*  Main component                                                       */
/** ------------------------------------------------------------------ */

export function Omnibar() {
  const { isOpen, close } = useOmnibar();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [groups, setGroups] = useState<GroupedResults>({
    tabs: [],
    recent: [],
    files: [],
    modified: [],
    commands: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const activeRowRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active terminal's cwd (null when not detected — e.g. brand-new shell
  // that hasn't emitted OSC 7 yet, or no terminal tab focused). When null
  // we skip the cwd walk entirely rather than falling back to root, which
  // would otherwise BFS the user's home dir.
  const activeCwdRef = useRef<string | null>(
    useTabs.getState().tabs.find(
      (t) => t.id === useTabs.getState().activeId && t.kind === "terminal",
    )?.cwd ?? null,
  );

  // Auto-focus on open; reset state on each open.
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActiveIdx(0);
    // Update cwd snapshot on each open BEFORE seeding recents — recents
    // are scoped to that cwd so the user doesn't see paths from a
    // different project they were in earlier.
    const cwd =
      useTabs.getState().tabs.find(
        (t) => t.id === useTabs.getState().activeId && t.kind === "terminal",
      )?.cwd ?? null;
    activeCwdRef.current = cwd;
    setGroups({
      tabs: getOpenTabs(),
      recent: getRecentItems(cwd),
      files: [],
      modified: [],
      commands: getCommands(),
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  // Scroll active row into view.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Cancel in-flight walk on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  // Recompute results whenever query changes.
  const computeResults = useCallback((q: string) => {
    const tabs = getOpenTabs();
    const recent = getRecentItems(activeCwdRef.current);
    const commands = getCommands();

    if (q.trim() === "") {
      setGroups({ tabs, recent, files: [], modified: [], commands });
      setActiveIdx(0);
      return;
    }

    const scoredTabs = filterAndScore(q, tabs, (i) => i.label + " " + (i.path ?? ""));
    const scoredRecent = filterAndScore(q, recent, (i) => i.label + " " + i.path);
    const scoredCmds = filterAndScore(q, commands, (i) => i.label + " " + (i.hint ?? ""));

    setGroups({
      tabs: scoredTabs.map((s) => s.item as TabItem),
      recent: scoredRecent.map((s) => s.item as RecentItem),
      files: [],
      modified: [],
      commands: scoredCmds.map((s) => s.item as CommandItem),
    });
    setActiveIdx(0);

    // Abort any previous walk and start a fresh debounced one.
    abortRef.current?.abort();
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const cwd = activeCwdRef.current;
      // No cwd detected → don't walk. Avoids accidentally BFS'ing all of
      // ~ when the active terminal hasn't reported its cwd yet.
      if (!cwd) return;
      const ac = new AbortController();
      abortRef.current = ac;
      void walkCwd(cwd, ac.signal).then((walked) => {
        if (ac.signal.aborted) return;
        const scored = filterAndScore(q, walked, (i) => i.label + " " + i.path);
        const capped = scored.slice(0, 50).map((s) => s.item as FileItem);
        setGroups((prev) => ({ ...prev, files: capped }));
      });
      // Also load modified files (not abortable, but fast via libgit2).
      void getModifiedFiles(cwd).then((modItems) => {
        if (ac.signal.aborted) return;
        const scored = filterAndScore(q, modItems, (i) => i.label + " " + i.path);
        const capped = scored.slice(0, 50).map((s) => s.item as ModifiedItem);
        setGroups((prev) => ({ ...prev, modified: capped }));
      });
    }, 80);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);
      computeResults(q);
    },
    [computeResults],
  );

  const flat = flatten(groups);
  const clampedIdx = flat.length === 0 ? 0 : Math.min(activeIdx, flat.length - 1);

  const handleSelect = useCallback(
    (item: OmniItem) => {
      const s = useTabs.getState();

      if (item.kind === "command") {
        // Close before running so e.g. "Show Shortcuts" doesn't open a
        // modal on top of the omnibar.
        close();
        void item.run();
        return;
      }

      if (item.kind === "tab") {
        s.activate(item.tabId);
        close();
        return;
      }

      if (item.kind === "modified") {
        // Open a diff tab for the modified file.
        const existing = s.tabs.find((t) => t.kind === "diff" && t.path === item.path);
        if (existing) {
          s.activate(existing.id);
        } else {
          s.open({ kind: "diff", label: item.label, path: item.path });
        }
        close();
        return;
      }

      const path = item.path;
      // Reuse an existing file tab with the same path if one is open.
      const existing = s.tabs.find((t) => t.kind === "file" && t.path === path);
      if (existing) {
        s.activate(existing.id);
      } else {
        s.open({
          kind: "file",
          label: item.label,
          path,
        });
      }
      close();
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const len = flat.length;

      // Down: ArrowDown, Tab, Ctrl+N (mac readline / VSCode).
      if (
        e.key === "ArrowDown" ||
        (e.key === "Tab" && !e.shiftKey) ||
        (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n")
      ) {
        e.preventDefault();
        setActiveIdx((i) => (len === 0 ? 0 : (i + 1) % len));
        return;
      }
      // Up: ArrowUp, Shift+Tab, Ctrl+P (mac readline / VSCode).
      if (
        e.key === "ArrowUp" ||
        (e.key === "Tab" && e.shiftKey) ||
        (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "p")
      ) {
        e.preventDefault();
        setActiveIdx((i) => (len === 0 ? 0 : (i - 1 + len) % len));
        return;
      }
      if (e.key === "Enter") {
        const selected = flat[clampedIdx];
        if (selected) handleSelect(selected);
        return;
      }
      if (e.key === "Escape") {
        close();
        return;
      }
    },
    [flat, clampedIdx, handleSelect, close],
  );

  if (!isOpen) return null;

  let globalIdx = 0;

  return (
    <div className="vy-omnibar-backdrop" onMouseDown={close}>
      <div
        className="vy-omnibar"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="vy-omnibar-input-wrap">
          <Icon name="search" size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="vy-omnibar-input"
            placeholder="Search files, tabs, commands…"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="vy-omnibar-results">
          {groups.tabs.length > 0 && (
            <div className="vy-omnibar-group">
              <div className="vy-omnibar-group-head">Open Tabs</div>
              {groups.tabs.map((item) => {
                const idx = globalIdx++;
                return (
                  <ResultRow
                    key={item.tabId}
                    item={item}
                    isActive={idx === clampedIdx}
                    rowRef={idx === clampedIdx ? activeRowRef : undefined}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(idx)}
                  />
                );
              })}
            </div>
          )}

          {groups.recent.length > 0 && (
            <div className="vy-omnibar-group">
              <div className="vy-omnibar-group-head">Recent Files</div>
              {groups.recent.map((item) => {
                const idx = globalIdx++;
                return (
                  <ResultRow
                    key={item.path}
                    item={item}
                    isActive={idx === clampedIdx}
                    rowRef={idx === clampedIdx ? activeRowRef : undefined}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(idx)}
                  />
                );
              })}
            </div>
          )}

          {groups.files.length > 0 && (
            <div className="vy-omnibar-group">
              <div className="vy-omnibar-group-head">Files in cwd</div>
              {groups.files.map((item) => {
                const idx = globalIdx++;
                return (
                  <ResultRow
                    key={item.path}
                    item={item}
                    isActive={idx === clampedIdx}
                    rowRef={idx === clampedIdx ? activeRowRef : undefined}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(idx)}
                  />
                );
              })}
            </div>
          )}

          {groups.modified.length > 0 && (
            <div className="vy-omnibar-group">
              <div className="vy-omnibar-group-head">Modified Files</div>
              {groups.modified.map((item) => {
                const idx = globalIdx++;
                return (
                  <ResultRow
                    key={item.path}
                    item={item}
                    isActive={idx === clampedIdx}
                    rowRef={idx === clampedIdx ? activeRowRef : undefined}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(idx)}
                  />
                );
              })}
            </div>
          )}

          {groups.commands.length > 0 && (
            <div className="vy-omnibar-group">
              <div className="vy-omnibar-group-head">Commands</div>
              {groups.commands.map((item) => {
                const idx = globalIdx++;
                return (
                  <ResultRow
                    key={item.id}
                    item={item}
                    isActive={idx === clampedIdx}
                    rowRef={idx === clampedIdx ? activeRowRef : undefined}
                    onSelect={handleSelect}
                    onHover={() => setActiveIdx(idx)}
                  />
                );
              })}
            </div>
          )}

          {flat.length === 0 && (
            <div className="vy-omnibar-empty">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ------------------------------------------------------------------ */
/*  ResultRow sub-component                                              */
/** ------------------------------------------------------------------ */

interface ResultRowProps {
  item: OmniItem;
  isActive: boolean;
  rowRef?: React.RefObject<HTMLDivElement | null>;
  onSelect(item: OmniItem): void;
  onHover(): void;
}

function ResultRow({ item, isActive, rowRef, onSelect, onHover }: ResultRowProps) {
  const label = item.label;
  // Right-aligned trailing text: file path for file/tab/recent/modified
  // rows, keyboard hint for command rows.
  const subpath =
    item.kind === "command" ? null : item.kind === "tab" ? item.path : item.path;
  const hint = item.kind === "command" ? item.hint : null;
  const modStatus = item.kind === "modified" ? item.status : null;

  return (
    <div
      ref={rowRef}
      className={`vy-omnibar-row${isActive ? " is-active" : ""}`}
      onMouseDown={() => onSelect(item)}
      onMouseEnter={onHover}
    >
      <Icon name={itemIcon(item)} size={14} style={{ flexShrink: 0 }} />
      <span className="vy-omnibar-row-name">{label}</span>
      {modStatus && (
        <span className={`git-badge ${modStatus === "?" ? "untracked" : modStatus}`} style={{ marginRight: 4 }}>
          {modStatus}
        </span>
      )}
      {subpath && (
        <span className="vy-omnibar-row-path">{subpath}</span>
      )}
      {hint && <span className="vy-omnibar-row-hint">{hint}</span>}
    </div>
  );
}

/** ------------------------------------------------------------------ */
/*  Filter + sort utility                                                */
/** ------------------------------------------------------------------ */

function filterAndScore<T extends OmniItem>(
  query: string,
  items: T[],
  getText: (item: T) => string,
): ScoredItem[] {
  const scored: ScoredItem[] = [];
  for (const item of items) {
    const score = fuzzyScore(query, getText(item));
    if (score !== null) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
