import { useEffect, useRef, useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
    await useEngagement.getState().create({ name: name.trim(), scope: scopeLines, rootDir: rootDir.trim() || "~" });
    onClose();
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
      </label>
      <div className="vy-eng-dialog-actions">
        <button type="button" className="vy-eng-dialog-btn vy-eng-dialog-btn--ghost" onClick={onClose}>
          cancel
        </button>
        <button type="submit" className="vy-eng-dialog-btn vy-eng-dialog-btn--primary" disabled={!name.trim()}>
          create
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

  if (engagements.length === 0) {
    return (
      <p className="vy-eng-dialog-empty">No engagements yet — create one first.</p>
    );
  }

  return (
    <ul className="vy-eng-dialog-list">
      {engagements.map((eng) => (
        <li
          key={eng.id}
          className={`vy-eng-dialog-row${eng.id === activeId ? " is-active" : ""}`}
          onClick={async () => {
            await useEngagement.getState().setActive(eng.id);
            onClose();
          }}
        >
          <span className="vy-eng-dialog-row-name">{eng.name}</span>
          <span className="vy-eng-dialog-row-meta">{eng.scope.length} in scope</span>
        </li>
      ))}
    </ul>
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
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (disarmRef.current) clearTimeout(disarmRef.current); }, []);

  if (!active) {
    return <p className="vy-eng-dialog-empty">No active engagement to edit.</p>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !name.trim()) return;
    const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
    await useEngagement.getState().update(active.id, { name: name.trim(), scope: scopeLines, rootDir: rootDir.trim() || "~" });
    onClose();
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
      </label>
      <div className="vy-eng-dialog-actions">
        <button type="button" className="vy-eng-dialog-btn vy-eng-dialog-btn--ghost" onClick={onClose}>
          cancel
        </button>
        <button type="submit" className="vy-eng-dialog-btn vy-eng-dialog-btn--primary" disabled={!name.trim()}>
          save
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
