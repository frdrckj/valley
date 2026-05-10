import { indentUnit } from "@codemirror/language";
import { search } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * Compartment used to swap the language extension at runtime when a file's
 * extension is detected (without rebuilding the whole editor state).
 */
export const languageCompartment = new Compartment();

/**
 * Shared editor extensions — chrome that's the same regardless of file
 * type. Adapted from terax-ai's buildSharedExtensions, trimmed: no vim
 * compartment, no inline-completion (deferred to AI phase).
 */
export function buildSharedExtensions(): Extension[] {
  return [
    indentUnit.of("  "),
    EditorState.tabSize.of(2),
    search({ top: true }),
    EditorView.theme({
      "&, &.cm-editor, &.cm-editor.cm-focused": {
        backgroundColor: "transparent !important",
        outline: "none",
        padding: "0",
      },
      ".cm-scroller": {
        fontFamily:
          '"MesloLGS Nerd Font Mono", "JetBrains Mono", SFMono-Regular, Menlo, monospace',
        fontSize: "14px",
        lineHeight: "1.55",
      },
      ".cm-gutters": { borderRight: "none" },
      ".cm-lineNumbers .cm-gutterElement": { opacity: "0.55", padding: "0 8px 0 12px" },
      ".cm-foldGutter .cm-gutterElement": { opacity: "0.5" },
      ".cm-content": { padding: "8px 0" },
    }),
  ];
}
