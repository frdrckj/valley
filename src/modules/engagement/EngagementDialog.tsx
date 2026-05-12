import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useEngagement } from "./useEngagement";
import { useEngagementDialog } from "./useEngagementDialog";
import { useTabs } from "@/modules/tabs/useTabs";

function defaultCwd(): string {
  const s = useTabs.getState();
  return s.tabs.find((t) => t.id === s.activeId)?.cwd ?? "~";
}

/* ------------------------------------------------------------------ */
/*  New mode form                                                       */
/* ------------------------------------------------------------------ */

function NewForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  const [rootDir, setRootDir] = useState(defaultCwd);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
      await useEngagement.getState().create({ name: name.trim(), scope: scopeLines, rootDir: rootDir.trim() || "~" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="vy-eng-dialog-form" onSubmit={handleSubmit}>
      <label className="vy-eng-dialog-label">
        Name
        <input
          className="vy-eng-dialog-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="acme-corp-pentest"
        />
      </label>
      <label className="vy-eng-dialog-label">
        Scope
        <textarea
          className="vy-eng-dialog-textarea"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder={"acme.corp\n*.acme.corp\n192.168.1.0/24"}
          rows={4}
        />
        <span className="vy-eng-dialog-hint">one host / CIDR per line</span>
      </label>
      <label className="vy-eng-dialog-label">
        Root directory
        <input
          className="vy-eng-dialog-input"
          value={rootDir}
          onChange={(e) => setRootDir(e.target.value)}
          placeholder="~/engagements/acme"
        />
        <span className="vy-eng-dialog-hint">created on save if it doesn't exist</span>
      </label>
      {error && <div className="vy-eng-dialog-error">{error}</div>}
      <div className="vy-eng-dialog-actions">
        <button type="button" className="vy-eng-dialog-btn vy-eng-dialog-btn--ghost" onClick={onClose}>
          cancel
        </button>
        <button type="submit" className="vy-eng-dialog-btn vy-eng-dialog-btn--primary" disabled={!name.trim() || busy}>
          {busy ? "creating…" : "create"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Switch mode list                                                    */
/* ------------------------------------------------------------------ */

function SwitchList({ onClose }: { onClose: () => void }) {
  const engagements = useEngagement((s) => s.engagements);
  const activeId = useEngagement((s) => s.activeId);
  // Highlight cursor for keyboard navigation. Starts on the active
  // engagement when there is one, otherwise the first row.
  const initialIdx = Math.max(
    0,
    engagements.findIndex((e) => e.id === activeId),
  );
  const [cursor, setCursor] = useState<number>(initialIdx);
  // Two-click delete confirmation, scoped by engagement id so arming one
  // row never accidentally arms another. Auto-disarms after 3 s.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (disarmRef.current) clearTimeout(disarmRef.current); }, []);

  // Re-snap the cursor when engagements list changes (e.g. after delete).
  useEffect(() => {
    if (engagements.length === 0) { setCursor(0); return; }
    setCursor((i) => Math.min(i, engagements.length - 1));
  }, [engagements.length]);

  const activate = useCallback(async (id: string) => {
    await useEngagement.getState().setActive(id);
    onClose();
  }, [onClose]);

  const tryDelete = useCallback((id: string) => {
    if (armedDeleteId === id) {
      if (disarmRef.current) clearTimeout(disarmRef.current);
      setArmedDeleteId(null);
      void useEngagement.getState().remove(id);
    } else {
      setArmedDeleteId(id);
      if (disarmRef.current) clearTimeout(disarmRef.current);
      disarmRef.current = setTimeout(() => setArmedDeleteId(null), 3000);
    }
  }, [armedDeleteId]);

  const onKey = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (engagements.length === 0) return;
    if (e.key === "ArrowDown" || (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n")) {
      e.preventDefault();
      setCursor((i) => (i + 1) % engagements.length);
      return;
    }
    if (e.key === "ArrowUp" || (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "p")) {
      e.preventDefault();
      setCursor((i) => (i - 1 + engagements.length) % engagements.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const eng = engagements[cursor];
      if (eng) void activate(eng.id);
      return;
    }
    // Plain Delete/Backspace arms the highlighted row (two-press to commit)
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const eng = engagements[cursor];
      if (eng) tryDelete(eng.id);
      return;
    }
  }, [engagements, cursor, activate, tryDelete]);

  if (engagements.length === 0) {
    return (
      <p className="vy-eng-dialog-empty">No engagements yet — create one first.</p>
    );
  }

  return (
    <div
      className="vy-eng-dialog-switch"
      tabIndex={0}
      autoFocus
      onKeyDown={onKey}
      ref={(el) => { el?.focus(); }}
    >
      <ul className="vy-eng-dialog-list">
        {engagements.map((eng, idx) => {
          const isCursor = idx === cursor;
          const isArmed = armedDeleteId === eng.id;
          return (
            <li
              key={eng.id}
              className={`vy-eng-dialog-row${eng.id === activeId ? " is-active" : ""}${isCursor ? " is-cursor" : ""}`}
              onMouseEnter={() => setCursor(idx)}
              onClick={() => void activate(eng.id)}
            >
              <span className="vy-eng-dialog-row-name">{eng.name}</span>
              <span className="vy-eng-dialog-row-meta">{eng.scope.length} in scope</span>
              <button
                type="button"
                className={`vy-eng-dialog-row-del${isArmed ? " is-armed" : ""}`}
                title={isArmed ? "click again to delete" : "delete engagement"}
                onClick={(ev) => { ev.stopPropagation(); tryDelete(eng.id); }}
              >
                {isArmed ? "confirm" : "×"}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="vy-eng-dialog-hint vy-eng-dialog-switch-hint">
        ↑↓ or ⌃N / ⌃P · Enter to switch · ⌫ / × to delete (two-press)
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit mode form                                                      */
/* ------------------------------------------------------------------ */

function EditForm({ onClose }: { onClose: () => void }) {
  const active = useEngagement((s) => s.active());
  const [name, setName] = useState(active?.name ?? "");
  const [scope, setScope] = useState(active?.scope.join("\n") ?? "");
  const [rootDir, setRootDir] = useState(active?.rootDir ?? "");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (disarmRef.current) clearTimeout(disarmRef.current); }, []);

  if (!active) {
    return <p className="vy-eng-dialog-empty">No active engagement to edit.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
      await useEngagement.getState().update(active.id, { name: name.trim(), scope: scopeLines, rootDir: rootDir.trim() || "~" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteClick() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      disarmRef.current = setTimeout(() => setDeleteArmed(false), 3000);
    } else {
      if (disarmRef.current) clearTimeout(disarmRef.current);
      void useEngagement.getState().remove(active!.id);
      onClose();
    }
  }

  return (
    <form className="vy-eng-dialog-form" onSubmit={handleSubmit}>
      <label className="vy-eng-dialog-label">
        Name
        <input className="vy-eng-dialog-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="vy-eng-dialog-label">
        Scope
        <textarea className="vy-eng-dialog-textarea" value={scope} onChange={(e) => setScope(e.target.value)} rows={4} />
        <span className="vy-eng-dialog-hint">one host / CIDR per line</span>
      </label>
      <label className="vy-eng-dialog-label">
        Root directory
        <input className="vy-eng-dialog-input" value={rootDir} onChange={(e) => setRootDir(e.target.value)} />
        <span className="vy-eng-dialog-hint">created on save if it doesn't exist</span>
      </label>
      {error && <div className="vy-eng-dialog-error">{error}</div>}
      <div className="vy-eng-dialog-actions">
        <button type="button" className="vy-eng-dialog-btn vy-eng-dialog-btn--ghost" onClick={onClose}>
          cancel
        </button>
        <button type="submit" className="vy-eng-dialog-btn vy-eng-dialog-btn--primary" disabled={!name.trim() || busy}>
          {busy ? "saving…" : "save"}
        </button>
      </div>
      <div className="vy-eng-dialog-danger">
        <button
          type="button"
          className={`vy-eng-dialog-btn vy-eng-dialog-btn--danger${deleteArmed ? " is-armed" : ""}`}
          onClick={handleDeleteClick}
        >
          {deleteArmed ? "click again to delete" : "delete this engagement"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Root dialog                                                         */
/* ------------------------------------------------------------------ */

const TITLES: Record<string, string> = {
  new: "New engagement",
  switch: "Switch engagement",
  edit: "Edit engagement",
};

export function EngagementDialog() {
  const { mode, close } = useEngagementDialog();

  useEffect(() => {
    if (mode === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [mode, close]);

  if (mode === "closed") return null;

  return (
    <div className="vy-eng-dialog-backdrop" onMouseDown={close}>
      <div className="vy-eng-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="vy-eng-dialog-head">
          <span>{TITLES[mode]}</span>
        </div>
        {mode === "new" && <NewForm onClose={close} />}
        {mode === "switch" && <SwitchList onClose={close} />}
        {mode === "edit" && <EditForm onClose={close} />}
      </div>
    </div>
  );
}
