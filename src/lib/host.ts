/**
 * Local-hostname detection.
 *
 * The OSC 7 sequence carries `file://<host><path>` — when valley's
 * shell integration runs on a remote box (e.g. kali) the `<host>` is
 * the remote's hostname, which is exactly the signal we want. When the
 * same integration runs on the LOCAL Mac, the `<host>` is the Mac's
 * own hostname, which we have to NOT mistake for a remote alias.
 *
 * We cache the local hostname once at app boot via tauri-plugin-os.
 * Consumers ask `isLocalHost(authority)` and we say yes for the empty
 * string, "localhost", 127.x, or anything matching our cached
 * hostname (case-insensitive, .local-suffix tolerant — Bonjour names
 * sometimes show up with the suffix, sometimes without).
 */
import { hostname as platformHostname } from "@tauri-apps/plugin-os";

let localHost = "";
let hydration: Promise<void> | null = null;

function startHydration(): Promise<void> {
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      localHost = (await platformHostname()) ?? "";
    } catch {
      // Best-effort; an empty cache just means we won't dedupe local
      // hostnames — same as v0.4.2 behavior.
    }
  })();
  return hydration;
}

/**
 * Eagerly trigger hydration. Idempotent — multiple callers share one
 * in-flight promise. Returns when the cache is populated (or the
 * platform call gave up). Callers that need to *use* the cached value
 * should await this first.
 */
export function hydrateLocalHost(): Promise<void> {
  return startHydration();
}

/** Cached local hostname (case-preserved). Empty until hydration. */
export function getLocalHost(): string {
  return localHost;
}

// Kick off hydration the moment this module is imported. Most consumers
// arrive milliseconds after this fires, so by the time they ask
// `isLocalHost()` the cache is already warm. A late consumer can still
// await `hydrateLocalHost()` to be sure.
void startHydration();

function normalize(h: string): string {
  return h.toLowerCase().replace(/\.local$/, "");
}

/**
 * True when `host` refers to the local machine. Returns true for
 *   - empty string (no OSC-7 authority emitted)
 *   - "localhost", 127.x, ::1
 *   - the cached local hostname, with or without the .local suffix
 */
export function isLocalHost(host: string): boolean {
  if (!host) return true;
  const h = normalize(host);
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (!localHost) return false;
  return h === normalize(localHost);
}
