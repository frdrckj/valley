/**
 * Authoritative theme definitions. Each theme carries a CSS-variable map
 * for the chrome AND an xterm color map for the terminal canvas, so a
 * single `applyTheme()` call keeps both surfaces in sync.
 */

import type { ITheme } from "@xterm/xterm";

export type ThemeId = "gruvbox-material-dark" | "gruvbox-light-hard" | "tokyo-night-storm" | "nord";

export interface Theme {
  id: ThemeId;
  label: string;
  /** xterm color map. */
  xterm: ITheme;
  /** CSS custom-property overrides applied to `:root` for the chrome. */
  chrome: Record<string, string>;
}

// Gruvbox Material Medium Dark — mirrors the user's alacritty config and
// is the canonical valley default.
const GRUVBOX_MATERIAL_DARK: Theme = {
  id: "gruvbox-material-dark",
  label: "Gruvbox Material",
  xterm: {
    background: "#282828",
    foreground: "#d4be98",
    cursor: "#d8a657",
    cursorAccent: "#282828",
    selectionBackground: "rgba(212,190,152,0.18)",
    black: "#3c3836",
    red: "#ea6962",
    green: "#a9b665",
    yellow: "#d8a657",
    blue: "#7daea3",
    magenta: "#d3869b",
    cyan: "#89b482",
    white: "#d4be98",
    brightBlack: "#3c3836",
    brightRed: "#ea6962",
    brightGreen: "#a9b665",
    brightYellow: "#d8a657",
    brightBlue: "#7daea3",
    brightMagenta: "#d3869b",
    brightCyan: "#89b482",
    brightWhite: "#d4be98",
  },
  chrome: {
    "--gb-dark-bg-0": "#282828",
    "--gb-dark-bg-1": "#282828",
    "--gb-dark-bg-2": "#32302f",
    "--gb-dark-bg-3": "#3c3836",
    "--gb-dark-bg-4": "#504945",
    "--gb-dark-fg-0": "#ddc7a1",
    "--gb-dark-fg-1": "#d4be98",
    "--gb-dark-fg-2": "#c5b48a",
    "--gb-dark-fg-mu": "#928374",
    "--gb-dark-yellow": "#d8a657",
    "--gb-dark-red": "#ea6962",
    "--gb-dark-green": "#a9b665",
    "--gb-dark-blue": "#7daea3",
    "--gb-dark-purple": "#d3869b",
    "--gb-dark-aqua": "#89b482",
    "--gb-dark-orange": "#e78a4e",
  },
};

// Gruvbox Light Hard — the spec-required light variant.
const GRUVBOX_LIGHT_HARD: Theme = {
  id: "gruvbox-light-hard",
  label: "Gruvbox Light Hard",
  xterm: {
    background: "#f9f5d7",
    foreground: "#3c3836",
    cursor: "#b57614",
    cursorAccent: "#f9f5d7",
    selectionBackground: "rgba(60,56,54,0.16)",
    black: "#3c3836",
    red: "#9d0006",
    green: "#79740e",
    yellow: "#b57614",
    blue: "#076678",
    magenta: "#8f3f71",
    cyan: "#427b58",
    white: "#7c6f64",
    brightBlack: "#928374",
    brightRed: "#9d0006",
    brightGreen: "#79740e",
    brightYellow: "#b57614",
    brightBlue: "#076678",
    brightMagenta: "#8f3f71",
    brightCyan: "#427b58",
    brightWhite: "#3c3836",
  },
  chrome: {
    "--gb-light-bg-0": "#f9f5d7",
    "--gb-light-bg-1": "#f9f5d7",
    "--gb-light-bg-2": "#ebdbb2",
    "--gb-light-bg-3": "#d5c4a1",
    "--gb-light-bg-4": "#bdae93",
    "--gb-light-fg-0": "#1d2021",
    "--gb-light-fg-1": "#3c3836",
    "--gb-light-fg-2": "#504945",
    "--gb-light-fg-mu": "#7c6f64",
    "--gb-light-yellow": "#b57614",
    "--gb-light-red": "#9d0006",
    "--gb-light-green": "#79740e",
    "--gb-light-blue": "#076678",
    "--gb-light-purple": "#8f3f71",
    "--gb-light-aqua": "#427b58",
    "--gb-light-orange": "#af3a03",
  },
};

// Tokyo Night Storm — the third theme spec'd in §3.
const TOKYO_NIGHT_STORM: Theme = {
  id: "tokyo-night-storm",
  label: "Tokyo Night Storm",
  xterm: {
    background: "#24283b",
    foreground: "#a9b1d6",
    cursor: "#c0caf5",
    cursorAccent: "#24283b",
    selectionBackground: "rgba(169,177,214,0.18)",
    black: "#1d202f",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  },
  chrome: {
    "--gb-dark-bg-0": "#24283b",
    "--gb-dark-bg-1": "#24283b",
    "--gb-dark-bg-2": "#1f2335",
    "--gb-dark-bg-3": "#414868",
    "--gb-dark-bg-4": "#565f89",
    "--gb-dark-fg-0": "#c0caf5",
    "--gb-dark-fg-1": "#a9b1d6",
    "--gb-dark-fg-2": "#9aa5ce",
    "--gb-dark-fg-mu": "#565f89",
    "--gb-dark-yellow": "#e0af68",
    "--gb-dark-red": "#f7768e",
    "--gb-dark-green": "#9ece6a",
    "--gb-dark-blue": "#7aa2f7",
    "--gb-dark-purple": "#bb9af7",
    "--gb-dark-aqua": "#7dcfff",
    "--gb-dark-orange": "#ff9e64",
  },
};

// Nord — the fourth theme.
const NORD: Theme = {
  id: "nord",
  label: "Nord",
  xterm: {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#88c0d0",
    cursorAccent: "#2e3440",
    selectionBackground: "rgba(216,222,233,0.18)",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#8fbcbb",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#88c0d0",
    brightWhite: "#eceff4",
  },
  chrome: {
    "--gb-dark-bg-0": "#2e3440",
    "--gb-dark-bg-1": "#2e3440",
    "--gb-dark-bg-2": "#3b4252",
    "--gb-dark-bg-3": "#434c5e",
    "--gb-dark-bg-4": "#4c566a",
    "--gb-dark-fg-0": "#eceff4",
    "--gb-dark-fg-1": "#d8dee9",
    "--gb-dark-fg-2": "#c0c6d0",
    "--gb-dark-fg-mu": "#7a8395",
    "--gb-dark-yellow": "#ebcb8b",
    "--gb-dark-red": "#bf616a",
    "--gb-dark-green": "#a3be8c",
    "--gb-dark-blue": "#81a1c1",
    "--gb-dark-purple": "#b48ead",
    "--gb-dark-aqua": "#8fbcbb",
    "--gb-dark-orange": "#d08770",
  },
};

export const THEMES: Theme[] = [
  GRUVBOX_MATERIAL_DARK,
  GRUVBOX_LIGHT_HARD,
  TOKYO_NIGHT_STORM,
  NORD,
];

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? GRUVBOX_MATERIAL_DARK;
}

/**
 * Resolve the user's theme setting to a concrete ThemeId. `auto` follows
 * the OS dark-mode preference (gruvbox-light-hard if the OS is light,
 * gruvbox-material-dark otherwise). Any concrete id passes through.
 */
export function resolveTheme(setting: "auto" | ThemeId): ThemeId {
  if (setting !== "auto") return setting;
  if (typeof window !== "undefined" && window.matchMedia) {
    const isLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    return isLight ? "gruvbox-light-hard" : "gruvbox-material-dark";
  }
  return "gruvbox-material-dark";
}

/** Apply a theme's chrome custom properties to `document.documentElement`. */
export function applyChromeTheme(theme: Theme) {
  const el = document.documentElement;
  for (const [k, v] of Object.entries(theme.chrome)) {
    el.style.setProperty(k, v);
  }
  // Set data-theme so the existing dark/light semantic-token blocks still
  // work (light themes use `[data-theme="light"]`, others use the default).
  el.dataset.theme = theme.id === "gruvbox-light-hard" ? "light" : "dark";
}
