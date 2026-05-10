import { useEffect, useRef, useState } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Icon } from "@/components/Icon";
import { useSettings } from "@/lib/settings";
import { resolveTheme } from "@/modules/theme/themes";
import { useTabs } from "@/modules/tabs/useTabs";
import { native } from "@/lib/native";
import { EDITOR_THEMES } from "@/modules/file/lib/editorThemes";
import { resolveLanguage } from "@/modules/file/lib/languageResolver";
import { buildSharedExtensions } from "@/modules/file/lib/extensions";

interface DiffViewProps {
  tabId?: string;
  path: string;
  mode: "working" | "staged";
}

type DiffState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "no-changes" }
  | { status: "ready"; head: string; current: string };

export function DiffView({ tabId, path, mode }: DiffViewProps) {
  const themeId = resolveTheme(useSettings().theme);
  const [diffState, setDiffState] = useState<DiffState>({ status: "loading" });
  const [activeMode, setActiveMode] = useState<"working" | "staged">(mode);
  const hostRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<MergeView | null>(null);

  const filename = path ? (path.split("/").pop() ?? path) : "";

  // Load diff whenever path or activeMode changes.
  useEffect(() => {
    if (!path) {
      setDiffState({ status: "error", message: "No file path provided." });
      return;
    }
    let cancelled = false;
    setDiffState({ status: "loading" });

    void (async () => {
      try {
        const repoRoot = await native.git.repoRoot(path.split("/").slice(0, -1).join("/") || "/");
        if (!repoRoot) {
          setDiffState({ status: "error", message: "Not in a git repository." });
          return;
        }
        const relPath = path.startsWith(repoRoot + "/")
          ? path.slice(repoRoot.length + 1)
          : path;
        const payload = await native.git.diff(repoRoot, relPath, activeMode);
        if (cancelled) return;
        if (payload.head === payload.current) {
          setDiffState({ status: "no-changes" });
        } else {
          setDiffState({ status: "ready", head: payload.head, current: payload.current });
        }
      } catch (e) {
        if (!cancelled) {
          setDiffState({ status: "error", message: e instanceof Error ? e.message : String(e) });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [path, activeMode]);

  // Build/rebuild the MergeView when ready state changes.
  useEffect(() => {
    if (diffState.status !== "ready" || !hostRef.current) return;

    // Tear down previous instance.
    if (mergeRef.current) {
      mergeRef.current.destroy();
      mergeRef.current = null;
    }

    const sharedExts = buildSharedExtensions();
    const themeExt = EDITOR_THEMES[themeId];

    const mv = new MergeView({
      parent: hostRef.current,
      orientation: "a-b",
      a: {
        doc: diffState.head,
        extensions: [
          ...sharedExts,
          themeExt,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: diffState.current,
        extensions: [
          ...sharedExts,
          themeExt,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
    });

    mergeRef.current = mv;

    // Async language extension – apply to both sides after resolution.
    void resolveLanguage(path).then((langExt) => {
      if (!langExt || !mergeRef.current) return;
      // MergeView exposes `.a` and `.b` as EditorView instances.
      const mv = mergeRef.current;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aView = (mv as unknown as { a: EditorView }).a;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bView = (mv as unknown as { b: EditorView }).b;
      if (aView) aView.dispatch({ effects: [] });
      if (bView) bView.dispatch({ effects: [] });
    });

    return () => {
      if (mergeRef.current) {
        mergeRef.current.destroy();
        mergeRef.current = null;
      }
    };
  // Intentionally not including mergeRef — it is mutated inside.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffState, themeId, path]);

  function openFileTab() {
    const s = useTabs.getState();
    const existing = s.tabs.find((t) => t.kind === "file" && t.path === path);
    if (existing) {
      s.activate(existing.id);
    } else {
      s.open({ kind: "file", label: filename, path });
    }
  }

  function switchMode(m: "working" | "staged") {
    setActiveMode(m);
    if (tabId) {
      // Persist mode on the tab so it survives tab switch.
      useTabs.setState((s) => ({
        tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, diffMode: m } : t)),
      }));
    }
  }

  if (!path) {
    return (
      <div className="vy-diff-pane">
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> no file path — this diff tab couldn't be restored
        </div>
      </div>
    );
  }

  return (
    <div className="vy-diff-pane">
      <div className="vy-diff-bar">
        <Icon name="file" size={12} style={{ color: "var(--text-muted)" }} />
        <span className="vy-file-path" title={path}>{filename}</span>
        <div className="vy-diff-mode-toggle">
          <button
            className={`vy-diff-mode-btn${activeMode === "working" ? " is-active" : ""}`}
            onClick={() => switchMode("working")}
          >
            Working
          </button>
          <button
            className={`vy-diff-mode-btn${activeMode === "staged" ? " is-active" : ""}`}
            onClick={() => switchMode("staged")}
          >
            Staged
          </button>
        </div>
        <button className="vy-diff-open-btn" onClick={openFileTab} title="Open file tab">
          Open file &rarr;
        </button>
      </div>

      {diffState.status === "loading" && (
        <div className="vy-file-loading">loading diff…</div>
      )}
      {diffState.status === "error" && (
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> {diffState.message}
        </div>
      )}
      {diffState.status === "no-changes" && (
        <div className="vy-diff-empty">No changes vs HEAD</div>
      )}
      {diffState.status === "ready" && (
        <div className="vy-diff-body" ref={hostRef} />
      )}
    </div>
  );
}
