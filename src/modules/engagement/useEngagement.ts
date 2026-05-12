import { create } from "zustand";
import { Store } from "@tauri-apps/plugin-store";
import { native } from "@/lib/native";
import { isLocalHost } from "@/lib/host";

/**
 * A path that is unambiguously macOS. `/Users/<user>/…` and a few other
 * Apple-specific roots only exist on a Mac — no Linux distro uses them
 * for home dirs, no Windows path looks like this. When the engagement
 * root matches this shape, the workspace must be local regardless of
 * what the user typed in the Host field. This is the safety net for the
 * case where local-hostname hydration hasn't completed yet OR
 * gethostname() returned something we can't compare against.
 */
function isMacLocalPath(p: string): boolean {
  return (
    p.startsWith("/Users/") ||
    p.startsWith("/private/") ||
    p.startsWith("/Volumes/") ||
    p.startsWith("/Applications/") ||
    p.startsWith("/Library/")
  );
}

export interface Engagement {
  id: string;
  name: string;
  scope: string[];
  rootDir: string;
  /** Optional SSH host (e.g. "kali") when the engagement's workspace
   *  lives on a remote machine. Empty / undefined = local Mac path.
   *  Set when the operator works primarily through SSH and wants the
   *  workspace folder on the remote, not a local mirror. */
  host?: string;
  notes: string;
  createdMs: number;
  updatedMs: number;
}

interface EngagementState {
  engagements: Engagement[];
  activeId: string | null;
  active: () => Engagement | null;
  create(input: Pick<Engagement, "name" | "scope" | "rootDir"> & { host?: string }): Promise<Engagement>;
  update(id: string, patch: Partial<Engagement>): Promise<void>;
  setActive(id: string | null): Promise<void>;
  remove(id: string): Promise<void>;
}

const FILE = "valley-engagements.json";
const KEY = "engagements";
const ACTIVE_KEY = "activeId";

let storePromise: Promise<Store> | null = null;
function getStore(): Promise<Store> {
  if (!storePromise) storePromise = Store.load(FILE);
  return storePromise;
}

async function persistNow(): Promise<void> {
  const { engagements, activeId } = useEngagement.getState();
  try {
    const store = await getStore();
    await store.set(KEY, engagements);
    await store.set(ACTIVE_KEY, activeId);
    await store.save();
  } catch {
    /* best-effort */
  }
}

let _idCounter = 0;
function genId(): string {
  return `eng-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

export const useEngagement = create<EngagementState>((set, get) => ({
  engagements: [],
  activeId: null,

  active() {
    const { engagements, activeId } = get();
    return engagements.find((e) => e.id === activeId) ?? null;
  },

  async create(input) {
    const now = Date.now();
    // Normalize host. A path that's obviously macOS-shaped (`/Users/…`,
    // `/private/var/…`, or `/Volumes/…`) ALWAYS wins — those locations
    // only exist on a Mac so the engagement must be local, even if the
    // user typed a non-local-looking host. Otherwise we filter hosts
    // that resolve to ourselves (local hostname, localhost, 127.x, ::1)
    // so we never try to SFTP-to-localhost on port 22 (which fails
    // when macOS sshd isn't enabled — the default).
    const rawHost = input.host?.trim();
    const pathIsMac = isMacLocalPath(input.rootDir);
    const host =
      pathIsMac || !rawHost || isLocalHost(rawHost) ? undefined : rawHost;
    const eng: Engagement = {
      id: genId(),
      name: input.name,
      scope: input.scope,
      rootDir: input.rootDir,
      host,
      notes: "",
      createdMs: now,
      updatedMs: now,
    };
    // Materialize the root directory so recents/explorer have somewhere
    // real to land. Route depends on `host`:
    //   - host set → SFTP mkdir over the cached SSH connection (so the
    //     workspace lands on the remote box the operator is actually
    //     working from).
    //   - host empty → local macOS mkdir (Valley keeps notes on the Mac).
    // Tilde is expanded on the appropriate side. Failures bubble up so
    // the dialog can surface a path error instead of leaving a record
    // pointing at a directory that doesn't exist.
    const path = input.rootDir.trim();
    if (path) {
      if (host) {
        await native.ssh.createDir(host, path);
      } else {
        await native.fs.createDir(path);
      }
    }
    set((s) => ({
      engagements: [eng, ...s.engagements],
      activeId: eng.id,
    }));
    await persistNow();
    return eng;
  },

  async update(id, patch) {
    // When rootDir changes (or host swap moves the workspace to a
    // different machine), mkdir it on the side that will own it. We
    // consult the *patched* host to know where the new path should
    // live — falling back to the current record's host if the patch
    // doesn't touch it.
    if (typeof patch.rootDir === "string" && patch.rootDir.trim()) {
      const current = get().engagements.find((e) => e.id === id);
      const rawHost = (patch.host ?? current?.host ?? "").trim();
      const path = patch.rootDir.trim();
      const host =
        isMacLocalPath(path) || !rawHost || isLocalHost(rawHost)
          ? undefined
          : rawHost;
      if (host) {
        await native.ssh.createDir(host, path);
      } else {
        await native.fs.createDir(path);
      }
    }
    set((s) => ({
      engagements: s.engagements.map((e) =>
        e.id === id
          ? {
              ...e,
              ...patch,
              // Empty / local-resolving host should clear it, not stick.
              host:
                patch.host !== undefined
                  ? (() => {
                      const t = patch.host.trim();
                      return t && !isLocalHost(t) ? t : undefined;
                    })()
                  : e.host,
              updatedMs: Date.now(),
            }
          : e,
      ),
    }));
    await persistNow();
  },

  async setActive(id) {
    set({ activeId: id });
    await persistNow();
  },

  async remove(id) {
    set((s) => ({
      engagements: s.engagements.filter((e) => e.id !== id),
      activeId: s.activeId === id ? null : s.activeId,
    }));
    await persistNow();
  },
}));

export async function hydrateEngagements(): Promise<void> {
  try {
    const store = await getStore();
    const engagements = (await store.get<Engagement[]>(KEY)) ?? [];
    const activeId = (await store.get<string | null>(ACTIVE_KEY)) ?? null;
    useEngagement.setState({
      engagements,
      activeId:
        activeId && engagements.some((e) => e.id === activeId) ? activeId : null,
    });
  } catch {
    /* best-effort; leave defaults */
  }
}
