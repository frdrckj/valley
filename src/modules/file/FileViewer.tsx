import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { keymap } from "@codemirror/view";
import { Icon } from "@/components/Icon";
import { useSettings } from "@/lib/settings";
import { resolveTheme } from "@/modules/theme/themes";
import { useTabs } from "@/modules/tabs/useTabs";
import { useOmnibar } from "@/modules/omnibar/lib/useOmnibar";
import { useDocument } from "./lib/useDocument";
import { resolveLanguage } from "./lib/languageResolver";
import { buildSharedExtensions, languageCompartment } from "./lib/extensions";
import { EDITOR_THEMES } from "./lib/editorThemes";

interface FileViewerProps {
  tabId?: string;
  path: string;
  /** True when the owning tab is the active tab. Drives auto-focus of
   *  the editor on tab switch so the user can type immediately. */
  active?: boolean;
}

/**
 * Editable file pane. CodeMirror 6 + lazy per-language grammar +
 * gruvbox/tokyo-night/nord themes that mirror valley's terminal palette.
 *
 * Pattern adapted from terax-ai's EditorPane: the language extension lives
 * in a Compartment so we can swap it after the dynamic import resolves
 * without rebuilding the whole state (which would wipe the user's caret).
 *
 * Save is Cmd+S. Dirty state shows as a `•` next to the filename.
 */
export function FileViewer({ tabId, path, active = true }: FileViewerProps) {
  const themeId = resolveTheme(useSettings().theme);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  // Mirror dirty state into the owning tab so the title bar can render
  // the `•` marker. Cleared when the tab unmounts.
  const onDirtyChange = useCallback(
    (d: boolean) => {
      if (tabId) useTabs.getState().setDirty(tabId, d);
    },
    [tabId],
  );
  useEffect(() => {
    return () => {
      if (tabId) useTabs.getState().setDirty(tabId, false);
    };
  }, [tabId]);
  const { doc, dirty, onChange, save } = useDocument({ path, onDirtyChange });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const filename = path ? (path.split("/").pop() ?? path) : "";

  // Stabilize `save` via ref so the extensions array keeps identity —
  // a new identity makes @uiw/react-codemirror reconfigure the whole
  // state, wiping the language compartment we're about to set.
  const saveRef = useRef(save);
  saveRef.current = save;

  const extensions = useMemo(
    () => [
      ...buildSharedExtensions(),
      languageCompartment.of([]),
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            void (async () => {
              setSaveError(null);
              setSaving(true);
              try {
                await saveRef.current();
              } catch (e) {
                setSaveError(e instanceof Error ? e.message : String(e));
              } finally {
                setSaving(false);
              }
            })();
            return true;
          },
        },
      ]),
    ],
    [],
  );

  // Resolve language async after the doc loads, then dispatch into the
  // compartment. The language pack imports are dynamic so each file type
  // only enters the bundle on first use.
  useEffect(() => {
    if (doc.status !== "ready") return;
    let cancelled = false;
    void resolveLanguage(path).then((ext) => {
      if (cancelled) return;
      const view = cmRef.current?.view;
      if (!view) return;
      view.dispatch({
        effects: languageCompartment.reconfigure(ext ?? []),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [path, doc.status]);

  // Auto-focus the editor when this tab becomes active or when its doc
  // finishes loading while already active. Without this, switching to a
  // file tab leaves keyboard focus on whatever stole it last (the tab
  // bar button, the previous terminal, etc.).
  useEffect(() => {
    if (!active || doc.status !== "ready") return;
    // Defer one frame so the tab's container has actually become
    // visible (the inactive class is removed in the same render).
    const id = requestAnimationFrame(() => {
      cmRef.current?.view?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [active, doc.status]);

  // Reclaim focus when the omnibar closes (Esc / Cmd+P). Mirrors the
  // pattern in Terminal.tsx so file tabs behave the same way.
  const omnibarOpen = useOmnibar((s) => s.isOpen);
  const prevOmnibarRef = useRef(omnibarOpen);
  useEffect(() => {
    const wasOpen = prevOmnibarRef.current;
    prevOmnibarRef.current = omnibarOpen;
    if (wasOpen && !omnibarOpen && active && doc.status === "ready") {
      cmRef.current?.view?.focus();
    }
  }, [omnibarOpen, active, doc.status]);

  if (!path) {
    return (
      <div className="vy-file-viewer">
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> no file path — this tab couldn't be
          restored
        </div>
      </div>
    );
  }

  return (
    <div className="vy-file-viewer">
      <div className="vy-file-bar">
        <Icon name="file" size={12} style={{ color: "var(--text-muted)" }} />
        <span className="vy-file-path" title={path}>
          {filename}
          {dirty ? " •" : ""}
        </span>
        <span className="vy-file-size">
          {doc.status === "ready"
            ? `${formatBytes(doc.size)} · ${countLines(doc.content)} lines${saving ? " · saving…" : ""}`
            : doc.status === "loading"
              ? "loading…"
              : ""}
        </span>
      </div>
      {saveError && (
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> {saveError}
        </div>
      )}
      {doc.status === "loading" && (
        <div className="vy-file-loading">loading…</div>
      )}
      {doc.status === "error" && (
        <div className="vy-file-error">
          <Icon name="alert" size={12} /> {doc.message}
        </div>
      )}
      {doc.status === "binary" && (
        <div className="vy-file-empty">
          <div className="vy-file-empty-title">Binary file</div>
          <div className="vy-file-empty-sub">
            {formatBytes(doc.size)} · preview not supported
          </div>
        </div>
      )}
      {doc.status === "toolarge" && (
        <div className="vy-file-empty">
          <div className="vy-file-empty-title">File too large</div>
          <div className="vy-file-empty-sub">
            {formatBytes(doc.size)} exceeds the {formatBytes(doc.limit)} limit
          </div>
        </div>
      )}
      {doc.status === "ready" && (
        <div className="vy-file-body">
          <CodeMirror
            ref={cmRef}
            value={doc.content}
            onChange={onChange}
            theme={EDITOR_THEMES[themeId]}
            extensions={extensions}
            height="100%"
            className="vy-cm"
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
              bracketMatching: true,
              closeBrackets: true,
              highlightActiveLine: true,
              highlightSelectionMatches: true,
              searchKeymap: true,
            }}
          />
        </div>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function countLines(s: string): number {
  if (!s) return 0;
  let n = 1;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++;
  return n;
}
