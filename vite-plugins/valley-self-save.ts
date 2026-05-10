import type { Plugin } from "vite";

/**
 * Suppress Vite HMR when valley itself saves a file. Without this, Cmd+S
 * on a file inside `valley/src/` triggers a chokidar event that Vite
 * reloads the page for — wiping terminal sessions, scroll, and selection.
 *
 * Flow:
 *   1. Before writing, the editor sends `valley:saved` over the HMR socket
 *      with the absolute path it's about to save.
 *   2. The plugin records the path with a short TTL.
 *   3. When chokidar fires for that path, `handleHotUpdate` checks the TTL
 *      and short-circuits the HMR by returning [] — no module update.
 *
 * Localhost WS round-trips beat fs.write + chokidar debounce by ~100x in
 * practice, so the mute always lands first. The TTL is generous enough
 * that even a slow disk doesn't slip a HMR event through.
 */
export function valleySelfSave(): Plugin {
  const muted = new Map<string, number>();
  const TTL_MS = 1500;

  return {
    name: "valley-self-save",
    apply: "serve",
    configureServer(server) {
      server.ws.on("valley:saved", (data: unknown) => {
        if (
          typeof data === "object" &&
          data !== null &&
          "path" in data &&
          typeof (data as { path: unknown }).path === "string"
        ) {
          muted.set((data as { path: string }).path, Date.now() + TTL_MS);
        }
      });
    },
    handleHotUpdate(ctx) {
      const until = muted.get(ctx.file);
      if (until && Date.now() < until) {
        muted.delete(ctx.file);
        return [];
      }
      return ctx.modules;
    },
  };
}
