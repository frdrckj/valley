import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import type { ThemeId } from "@/modules/theme/themes";

/**
 * CodeMirror editor themes for valley. A single `buildTheme(palette,
 * isDark)` driver across all four palettes (gruvbox-material-dark,
 * gruvbox-light-hard, tokyo-night-storm, nord). The token-tag → color
 * mapping follows the "Correia Gruvbox Theme" VS Code conventions.
 */

interface Palette {
  bg: string;
  bgSoft: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  fg: string;
  fgMuted: string;
  fgDim: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  aqua: string;
  orange: string;
  gray: string;
  /** Selection / activeLine / matchingBracket / searchMatch tints — RGBA. */
  selectionRgba: string;
  activeLineRgba: string;
  matchBgRgba: string;
  searchMatchRgba: string;
  searchSelectedRgba: string;
}

const GRUVBOX_MATERIAL_DARK: Palette = {
  bg: "#282828",
  bgSoft: "#32302f",
  bg1: "#3c3836",
  bg2: "#504945",
  bg3: "#665c54",
  bg4: "#7c6f64",
  fg: "#d4be98",
  fgMuted: "#ddc7a1",
  fgDim: "#a89984",
  red: "#ea6962",
  green: "#a9b665",
  yellow: "#d8a657",
  blue: "#7daea3",
  purple: "#d3869b",
  aqua: "#89b482",
  orange: "#e78a4e",
  gray: "#928374",
  selectionRgba: "#689d6a40",
  activeLineRgba: "#3c383660",
  matchBgRgba: "#92837480",
  searchMatchRgba: "#fe801930",
  searchSelectedRgba: "#83a59870",
};

const GRUVBOX_LIGHT_HARD: Palette = {
  bg: "#f9f5d7",
  bgSoft: "#f2e5bc",
  bg1: "#ebdbb2",
  bg2: "#d5c4a1",
  bg3: "#bdae93",
  bg4: "#a89984",
  fg: "#3c3836",
  fgMuted: "#504945",
  fgDim: "#7c6f64",
  red: "#9d0006",
  green: "#79740e",
  yellow: "#b57614",
  blue: "#076678",
  purple: "#8f3f71",
  aqua: "#427b58",
  orange: "#af3a03",
  gray: "#928374",
  selectionRgba: "#b8bb2640",
  activeLineRgba: "#ebdbb280",
  matchBgRgba: "#a8998480",
  searchMatchRgba: "#d65d0e30",
  searchSelectedRgba: "#45707a70",
};

const TOKYO_NIGHT_STORM: Palette = {
  bg: "#24283b",
  bgSoft: "#1f2335",
  bg1: "#414868",
  bg2: "#565f89",
  bg3: "#737aa2",
  bg4: "#9aa5ce",
  fg: "#a9b1d6",
  fgMuted: "#c0caf5",
  fgDim: "#9aa5ce",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  purple: "#bb9af7",
  aqua: "#7dcfff",
  orange: "#ff9e64",
  gray: "#565f89",
  selectionRgba: "#7aa2f740",
  activeLineRgba: "#1f233560",
  matchBgRgba: "#565f8980",
  searchMatchRgba: "#e0af6830",
  searchSelectedRgba: "#7aa2f770",
};

const NORD: Palette = {
  bg: "#2e3440",
  bgSoft: "#3b4252",
  bg1: "#434c5e",
  bg2: "#4c566a",
  bg3: "#616e88",
  bg4: "#7a8395",
  fg: "#d8dee9",
  fgMuted: "#e5e9f0",
  fgDim: "#9aa5b8",
  red: "#bf616a",
  green: "#a3be8c",
  yellow: "#ebcb8b",
  blue: "#81a1c1",
  purple: "#b48ead",
  aqua: "#8fbcbb",
  orange: "#d08770",
  gray: "#7a8395",
  selectionRgba: "#88c0d040",
  activeLineRgba: "#3b425260",
  matchBgRgba: "#4c566a80",
  searchMatchRgba: "#ebcb8b30",
  searchSelectedRgba: "#88c0d070",
};

function buildTheme(p: Palette, isDark: boolean): Extension {
  const cmTheme = EditorView.theme(
    {
      "&": { color: p.fg, backgroundColor: p.bg },
      ".cm-content": { caretColor: p.fg },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: p.fg },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
        { backgroundColor: p.selectionRgba },
      ".cm-activeLine": { backgroundColor: p.activeLineRgba },
      ".cm-selectionMatch": { backgroundColor: p.matchBgRgba },
      "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket":
        { backgroundColor: p.matchBgRgba, color: p.yellow },
      ".cm-gutters": {
        backgroundColor: p.bg,
        color: p.bg3,
        border: "none",
      },
      ".cm-activeLineGutter": {
        backgroundColor: p.activeLineRgba,
        color: p.yellow,
      },
      ".cm-foldPlaceholder": {
        backgroundColor: "transparent",
        border: "none",
        color: p.gray,
      },
      ".cm-tooltip": {
        border: `1px solid ${p.bg1}`,
        backgroundColor: p.bgSoft,
        color: p.fg,
      },
      ".cm-tooltip-autocomplete": {
        "& > ul > li[aria-selected]": {
          backgroundColor: p.activeLineRgba,
          color: p.fg,
        },
      },
      ".cm-searchMatch": {
        backgroundColor: p.searchMatchRgba,
        outline: `1px solid ${p.yellow}`,
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: p.searchSelectedRgba,
      },
      ".cm-panels": {
        backgroundColor: p.bgSoft,
        color: p.fg,
        borderColor: p.bg1,
      },
    },
    { dark: isDark },
  );

  // Token mapping is shared across palettes; only the colors differ.
  const highlight = HighlightStyle.define([
    { tag: t.comment, color: p.gray, fontStyle: "italic" },
    { tag: t.lineComment, color: p.gray, fontStyle: "italic" },
    { tag: t.blockComment, color: p.gray, fontStyle: "italic" },
    { tag: t.docComment, color: p.gray, fontStyle: "italic" },

    { tag: t.string, color: p.green },
    { tag: t.special(t.string), color: p.green },
    { tag: t.regexp, color: p.green },
    { tag: t.escape, color: p.green },

    { tag: t.number, color: p.purple },
    { tag: t.bool, color: p.purple },
    { tag: t.atom, color: p.purple },
    { tag: t.null, color: p.purple },
    { tag: t.constant(t.variableName), color: p.purple },
    { tag: t.standard(t.variableName), color: p.purple },
    { tag: t.special(t.variableName), color: p.purple },
    { tag: t.self, color: p.purple },

    { tag: t.keyword, color: p.red },
    { tag: t.definitionKeyword, color: p.red },

    { tag: t.controlKeyword, color: p.aqua },
    { tag: t.moduleKeyword, color: p.aqua },

    { tag: t.modifier, color: p.orange },
    { tag: t.operator, color: p.orange },
    { tag: t.operatorKeyword, color: p.orange },
    { tag: t.tagName, color: p.orange },

    { tag: t.typeName, color: p.blue },
    { tag: t.className, color: p.blue },
    { tag: t.namespace, color: p.blue },
    { tag: t.changed, color: p.blue },
    { tag: t.annotation, color: p.blue },

    { tag: t.function(t.variableName), color: p.green },
    { tag: t.function(t.propertyName), color: p.green },
    { tag: t.labelName, color: p.green },

    { tag: t.variableName, color: p.fgMuted },
    { tag: t.propertyName, color: p.fgMuted },
    { tag: t.punctuation, color: p.fgMuted },
    { tag: t.bracket, color: p.fgMuted },
    { tag: t.separator, color: p.fgMuted },
    { tag: t.angleBracket, color: p.fgMuted },

    { tag: t.attributeName, color: p.yellow },
    { tag: t.attributeValue, color: p.green },

    { tag: t.macroName, color: p.aqua },
    { tag: t.meta, color: p.aqua },
    { tag: t.processingInstruction, color: p.aqua },

    { tag: t.heading1, color: p.red, fontWeight: "bold" },
    { tag: t.heading2, color: p.orange, fontWeight: "bold" },
    { tag: t.heading3, color: p.yellow, fontWeight: "bold" },
    { tag: t.heading4, color: p.green, fontWeight: "bold" },
    { tag: t.heading5, color: p.blue, fontWeight: "bold" },
    { tag: t.heading6, color: p.purple, fontWeight: "bold" },
    { tag: t.heading, color: p.red, fontWeight: "bold" },
    { tag: t.contentSeparator, color: p.bg4 },

    { tag: t.link, color: p.green, textDecoration: "underline" },
    { tag: t.url, color: p.green, textDecoration: "underline" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.quote, color: p.aqua, fontStyle: "italic" },
    { tag: t.list, color: p.fg },

    { tag: t.inserted, color: p.green },
    { tag: t.deleted, color: p.red },
    { tag: t.invalid, color: p.red, textDecoration: "underline wavy" },
  ]);

  return [cmTheme, syntaxHighlighting(highlight)];
}

export const EDITOR_THEMES: Record<ThemeId, Extension> = {
  "gruvbox-material-dark": buildTheme(GRUVBOX_MATERIAL_DARK, true),
  "gruvbox-light-hard": buildTheme(GRUVBOX_LIGHT_HARD, false),
  "tokyo-night-storm": buildTheme(TOKYO_NIGHT_STORM, true),
  nord: buildTheme(NORD, true),
};
