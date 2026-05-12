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
import { hydrateLocalHost, isLocalHost } from "@/lib/host";

/** Slugify an engagement name into a filesystem-safe segment. */
function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Mirror of useEngagement's isMacLocalPath — paths only macOS uses.
 *  When the typed root is Mac-shaped, the workspace MUST be local even
 *  if the Host field has a value. Kept in sync with the runtime guard
 *  in useEngagement.ts; that one is the source of truth. */
function isMacLocalPath(p: string): boolean {
  return (
    p.startsWith("/Users/") ||
    p.startsWith("/private/") ||
    p.startsWith("/Volumes/") ||
    p.startsWith("/Applications/") ||
    p.startsWith("/Library/")
  );
}

/**
 * Default root-dir suggestion.
 *
 * Preferred form: `<active-terminal-cwd>/<slug>`. When the operator is
 * already sitting at `/home/kali/Documents/pentest` (local or SSH),
 * creating an engagement named "canonical" should land at
 * `/home/kali/Documents/pentest/canonical` — the cwd is the natural
 * parent. We only use the active cwd when the engagement's host matches
 * where the cwd was reported from; mixing a local cwd into a remote
 * engagement (or vice versa) would land the workspace on the wrong
 * filesystem.
 *
 * Fallback: `~/engagements/<slug>`. Used when there's no active cwd or
 * the host doesn't match. Tildes resolve server-side for SSH and
 * locally for Mac, so this stays portable.
 */
function suggestRootDir(name: string, host: string): string {
  const slug = slugify(name);
  if (!slug) return "";
  const ctx = activeTerminalContext();
  const hostMatches = (host.trim() || "") === (ctx.host || "");
  if (ctx.cwd && hostMatches) {
    const parent = ctx.cwd.replace(/\/+$/, "");
    return `${parent}/${slug}`;
  }
  return `~/engagements/${slug}`;
}

interface TerminalContext {
  /** Active terminal's OSC-7-reported cwd, or null. */
  cwd: string | null;
  /** Active terminal's OSC-7-reported hostname authority. Empty for
   *  local shells or remote shells whose integration doesn't include
   *  the hostname (vanilla kali zsh until the user installs ours). */
  host: string;
}

function activeTerminalContext(): TerminalContext {
  const s = useTabs.getState();
  const tab = s.tabs.find((t) => t.id === s.activeId);
  const rawHost = tab?.cwdHost ?? "";
  // The local shell integration emits OSC 7 with the Mac's own
  // hostname. That's not a remote SSH target — it's still us. Treat
  // anything that resolves to the local machine as host=empty so the
  // dialog doesn't try to SFTP back to ourselves on port 22 (which
  // fails with `Connection refused` unless the user has sshd enabled
  // on macOS, which most don't).
  return {
    cwd: tab?.cwd ?? null,
    host: isLocalHost(rawHost) ? "" : rawHost,
  };
}

function activeTerminalHost(): string {
  return activeTerminalContext().host;
}

/* ------------------------------------------------------------------ */
/*  New mode form                                                       */
/* ------------------------------------------------------------------ */

function NewForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("");
  // Pre-fill the host from the active terminal's OSC-7 hostname, but
  // ONLY after local-hostname hydration has resolved (see hostManual
  // effect below). Initial render keeps the field empty so we don't
  // briefly show the Mac's own hostname before isLocalHost() can filter
  // it out — that was the v0.4.3 bug.
  const [host, setHost] = useState("");
  const [hostManual, setHostManual] = useState(false);
  const [rootDir, setRootDir] = useState("");
  // Track whether the user typed the rootDir themselves. While false we
  // keep regenerating it from `name` — auto-fills the field with a
  // sensible default as they type, until they take control.
  const [rootDirManual, setRootDirManual] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pre-fill the Host field from the active terminal — but only once
  // local-hostname hydration has finished. If we read it synchronously
  // on mount, `isLocalHost` can't yet tell that our own hostname is us,
  // so the field would get auto-filled with the Mac's name and the
  // dialog would later try to SFTP-to-localhost. Awaiting first means
  // `activeTerminalHost()` (which calls `activeTerminalContext()`
  // which calls `isLocalHost`) returns "" for the local case.
  useEffect(() => {
    if (hostManual) return;
    let cancelled = false;
    void hydrateLocalHost().then(() => {
      if (cancelled) return;
      const initial = activeTerminalHost();
      // Only set if we haven't been edited mid-await.
      setHost((cur) => (cur === "" ? initial : cur));
    });
    return () => { cancelled = true; };
  }, [hostManual]);

  // Recompute the default whenever the name OR host changes. Host
  // matters because the suggested parent depends on whether the cwd of
  // the active terminal is on the same machine the engagement targets.
  // Effect bails the moment the user takes over the field.
  useEffect(() => {
    if (rootDirManual) return;
    setRootDir(suggestRootDir(name, host));
  }, [name, host, rootDirManual]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
      await useEngagement.getState().create({
        name: name.trim(),
        scope: scopeLines,
        rootDir: rootDir.trim() || "~",
        host: host.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // The remote-path heuristic only fires when host is empty. With a host
  // set, an absolute /home/... path is exactly what we want — mkdir runs
  // over SFTP, not against macOS's autofs /home.
  const looksRemote =
    !host.trim() &&
    (rootDir.startsWith("/home/") ||
      rootDir === "/root" ||
      rootDir.startsWith("/root/") ||
      (rootDir.startsWith("/") &&
        !rootDir.startsWith("/Users/") &&
        !rootDir.startsWith("/tmp") &&
        !rootDir.startsWith("/private/") &&
        !rootDir.startsWith("/opt/")));

  // Path overrides host: a `/Users/…` style path is unambiguously
  // macOS, so we'll force-route to local mkdir regardless of what's in
  // the Host field. Keeps the UI honest with what useEngagement.create
  // will actually do.
  const pathForcesLocal = isMacLocalPath(rootDir);
  const isRemote = Boolean(host.trim()) && !pathForcesLocal;

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
        Host <span className="vy-eng-dialog-label-aside">optional · SSH alias</span>
        <input
          className="vy-eng-dialog-input"
          value={host}
          onChange={(e) => { setHost(e.target.value); setHostManual(true); }}
          placeholder="kali · leave blank for local Mac"
        />
        <span className="vy-eng-dialog-hint">
          {pathForcesLocal && host.trim()
            ? `Path looks like macOS (${rootDir}) — host will be ignored and workspace created locally.`
            : host.trim()
              ? `Workspace will be created on ${host.trim()} via SFTP. Uses your ~/.ssh/config + ssh-agent.`
              : "Empty = local engagement (workspace lives on your Mac)."}
        </span>
      </label>
      <label className="vy-eng-dialog-label">
        Root directory{" "}
        <span className="vy-eng-dialog-label-aside">
          {isRemote ? `path on ${host.trim()}` : "local Mac path"}
        </span>
        <input
          className="vy-eng-dialog-input"
          value={rootDir}
          onChange={(e) => { setRootDir(e.target.value); setRootDirManual(true); }}
          placeholder="~/engagements/acme"
        />
        <span className="vy-eng-dialog-hint">
          {isRemote
            ? `Created on ${host.trim()} via SFTP (recursive). Defaults to your terminal's cwd + slug when host matches; otherwise \`~/engagements/<slug>\`.`
            : "Workspace folder on your Mac. Defaults to your terminal's cwd + slug; you can override."}
        </span>
        {looksRemote && (
          <span className="vy-eng-dialog-warn">
            That looks like a remote path but no Host is set. Either set
            a host (so mkdir runs on the remote) or use a local path.
          </span>
        )}
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
              {eng.host && (
                <span className="vy-eng-dialog-row-host" title={`Workspace on ${eng.host}`}>
                  @{eng.host}
                </span>
              )}
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
  const [host, setHost] = useState(active?.host ?? "");
  const [rootDir, setRootDir] = useState(active?.rootDir ?? "");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (disarmRef.current) clearTimeout(disarmRef.current); }, []);

  if (!active) {
    return <p className="vy-eng-dialog-empty">No active engagement to edit.</p>;
  }

  // Remote-path heuristic only fires when host is empty (matches NewForm).
  const editLooksRemote =
    !host.trim() &&
    (rootDir.startsWith("/home/") ||
      rootDir === "/root" ||
      rootDir.startsWith("/root/") ||
      (rootDir.startsWith("/") &&
        !rootDir.startsWith("/Users/") &&
        !rootDir.startsWith("/tmp") &&
        !rootDir.startsWith("/private/") &&
        !rootDir.startsWith("/opt/")));

  const isRemote = Boolean(host.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active || !name.trim() || busy) return;
    setError(null);
    setBusy(true);
    try {
      const scopeLines = scope.split("\n").map((l) => l.trim()).filter(Boolean);
      await useEngagement.getState().update(active.id, {
        name: name.trim(),
        scope: scopeLines,
        rootDir: rootDir.trim() || "~",
        host: host.trim(),
      });
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
        Host <span className="vy-eng-dialog-label-aside">optional · SSH alias</span>
        <input
          className="vy-eng-dialog-input"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="kali · blank for local Mac"
        />
        <span className="vy-eng-dialog-hint">
          {host.trim()
            ? `Workspace lives on ${host.trim()} (SFTP).`
            : "Empty = local engagement (workspace on your Mac)."}
        </span>
      </label>
      <label className="vy-eng-dialog-label">
        Root directory{" "}
        <span className="vy-eng-dialog-label-aside">
          {isRemote ? `path on ${host.trim()}` : "local Mac path"}
        </span>
        <input className="vy-eng-dialog-input" value={rootDir} onChange={(e) => setRootDir(e.target.value)} />
        <span className="vy-eng-dialog-hint">
          {isRemote
            ? "Created on the remote via SFTP if it doesn't exist."
            : "Workspace folder on your Mac — created on save if missing."}
        </span>
        {editLooksRemote && (
          <span className="vy-eng-dialog-warn">
            That looks like a remote path but no Host is set. Either set
            a host (mkdir runs on the remote) or use a local path.
          </span>
        )}
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
