import type { IconName } from "@/components/Icon";

export interface ResolvedIcon {
  name: IconName;
  color?: string;
}

/**
 * Map a folder name to a custom icon + color tint. Falls through to the
 * generic folder icon for anything not listed.
 */
const FOLDER_BY_NAME: Record<string, ResolvedIcon> = {
  src: { name: "folder", color: "var(--accent-info)" },
  "src-tauri": { name: "folder", color: "var(--accent-warning)" },
  dist: { name: "folder", color: "var(--accent-success)" },
  build: { name: "folder", color: "var(--accent-success)" },
  docs: { name: "folder", color: "var(--accent-aqua)" },
  public: { name: "folder", color: "var(--accent-info)" },
  scripts: { name: "folder", color: "var(--accent-primary)" },
  node_modules: { name: "folder", color: "var(--text-muted)" },
  ".git": { name: "git", color: "var(--accent-warning)" },
  ".github": { name: "git", color: "var(--text-muted)" },
  test: { name: "folder", color: "var(--accent-success)" },
  tests: { name: "folder", color: "var(--accent-success)" },
};

/**
 * Match a filename to an icon. Order matters — first match wins. Patterns
 * are tested with `RegExp.test`, plain strings with exact equality (case
 * insensitive on the lookup).
 */
const FILE_RULES: Array<{
  match: RegExp | string;
  icon: ResolvedIcon;
}> = [
  // Exact filenames first
  { match: "package.json", icon: { name: "braces", color: "var(--accent-warning)" } },
  { match: "package-lock.json", icon: { name: "lock", color: "var(--text-muted)" } },
  { match: "pnpm-lock.yaml", icon: { name: "lock", color: "var(--accent-warning)" } },
  { match: "yarn.lock", icon: { name: "lock", color: "var(--accent-info)" } },
  { match: "Cargo.toml", icon: { name: "code", color: "var(--accent-warning)" } },
  { match: "Cargo.lock", icon: { name: "lock", color: "var(--accent-warning)" } },
  { match: "tsconfig.json", icon: { name: "braces", color: "var(--accent-info)" } },
  { match: "tsconfig.node.json", icon: { name: "braces", color: "var(--accent-info)" } },
  { match: "vite.config.ts", icon: { name: "code", color: "var(--accent-purple)" } },
  { match: "vitest.config.ts", icon: { name: "code", color: "var(--accent-success)" } },
  { match: "VALLEY.md", icon: { name: "markdown", color: "var(--accent-primary)" } },
  { match: "README.md", icon: { name: "markdown", color: "var(--accent-info)" } },
  { match: "LICENSE", icon: { name: "file", color: "var(--accent-warning)" } },
  { match: ".gitignore", icon: { name: "git", color: "var(--text-muted)" } },
  { match: ".env", icon: { name: "lock", color: "var(--accent-danger)" } },

  // Extensions
  { match: /\.tsx?$/, icon: { name: "code", color: "var(--accent-info)" } },
  { match: /\.(jsx?|mjs|cjs)$/, icon: { name: "code", color: "var(--accent-warning)" } },
  { match: /\.json$/, icon: { name: "braces", color: "var(--accent-warning)" } },
  { match: /\.(ya?ml)$/, icon: { name: "braces", color: "var(--accent-danger)" } },
  { match: /\.toml$/, icon: { name: "braces", color: "var(--text-muted)" } },
  { match: /\.md$/, icon: { name: "markdown", color: "var(--accent-info)" } },
  { match: /\.html?$/, icon: { name: "code", color: "var(--accent-warning)" } },
  { match: /\.css$/, icon: { name: "code", color: "var(--accent-info)" } },
  { match: /\.scss$/, icon: { name: "code", color: "var(--accent-purple)" } },
  { match: /\.rs$/, icon: { name: "code", color: "var(--accent-warning)" } },
  { match: /\.py$/, icon: { name: "code", color: "var(--accent-info)" } },
  { match: /\.go$/, icon: { name: "code", color: "var(--accent-aqua)" } },
  { match: /\.(sh|bash|zsh|fish)$/, icon: { name: "terminal", color: "var(--accent-success)" } },
  { match: /\.(png|jpe?g|gif|webp|bmp|ico)$/, icon: { name: "image", color: "var(--accent-success)" } },
  { match: /\.svg$/, icon: { name: "image", color: "var(--accent-warning)" } },
  { match: /\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/, icon: { name: "archive", color: "var(--text-muted)" } },
  { match: /\.(woff2?|ttf|otf|eot)$/, icon: { name: "file", color: "var(--accent-purple)" } },
  { match: /\.(mp4|mov|webm|mkv|avi)$/, icon: { name: "image", color: "var(--accent-purple)" } },
  { match: /\.(mp3|wav|flac|ogg|m4a)$/, icon: { name: "image", color: "var(--accent-info)" } },
];

export function resolveIcon(
  name: string,
  isDir: boolean,
  isOpen: boolean,
): ResolvedIcon {
  if (isDir) {
    const folder = FOLDER_BY_NAME[name];
    return {
      name: isOpen ? "folder-open" : (folder?.name ?? "folder"),
      color: folder?.color,
    };
  }
  for (const { match, icon } of FILE_RULES) {
    if (typeof match === "string") {
      if (match === name) return icon;
    } else if (match.test(name)) {
      return icon;
    }
  }
  return { name: "file" };
}
