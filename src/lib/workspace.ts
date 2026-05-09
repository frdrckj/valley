export interface LiveContext {
  /** Currently-active terminal cwd, if known. */
  cwd: () => string | null;
  /** Last ~300 lines of the active terminal's buffer. */
  terminalTail: () => string;
  /** Contents of VALLEY.md at the workspace root, or null. */
  valleyMd: () => string | null;
}

let live: LiveContext = {
  cwd: () => null,
  terminalTail: () => "",
  valleyMd: () => null,
};

export function setLive(next: LiveContext) {
  live = next;
}

export function getLive(): LiveContext {
  return live;
}
