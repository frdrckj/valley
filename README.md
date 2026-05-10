# valley

A lightweight, AI-aware desktop terminal for macOS — built on Tauri 2 + Rust + React 19 + xterm.js. Gruvbox by default, ~5.7 MB binary, runs on Apple Silicon.

```
~/works/valley  main !2 ?1                                   ⌚ 18:24
❯ pnpm test
 Test Files  8 passed (8)      ⎢ green block-rail
      Tests  55 passed (55)    ⎢
~/works/valley  main !2 ?1                                   ⌚ 18:24
❯
```

## Why

Built around the things a daily-driver terminal should make trivial:

- **Block-status rails** — every command run gets a green / red side bar; ⌘⇧↑/↓ jumps between prompts.
- **⌘⇧C copies the last command's output** — straight to clipboard, ready to paste into a chat, issue, or PR. Hover any rail in the gutter to see exit code + duration.
- **Live cwd everywhere** — sidebar follows your `cd`, status bar shows the git branch, file explorer scopes to the active terminal's directory. Works inside tmux via OSC passthrough.
- **Cmd+P omnibar** — fuzzy switcher across open tabs, recent files, files in the active cwd, modified files in the repo, plus a 15-action command palette.
- **Embedded editor** — CodeMirror 6 with gruvbox / tokyo-night / nord themes mirroring the terminal palette. ⌘S writes through a Vite plugin that mutes HMR for self-saves. Right-click → "Open in $EDITOR" hands off to nvim / VS Code / whatever you set.
- **Diff / git pane** — libgit2-backed; status badges in the explorer, side-by-side merge view per file via `@codemirror/merge`.
- **AI built in** — chat panel (⌘I) backed by Anthropic / OpenAI via the Vercel AI SDK. ⌘L attaches the active terminal's selection (or last command's output) to the composer. Tools: `read_file`, `list_directory`, `write_file`, `run_command` — read auto-runs, write + shell are gated behind approval prompts.
- **Clickable file paths** — `tsc` / `cargo` / `pytest` errors print paths; click them to open in valley's editor.
- **Dev-server URL banner** — `npm run dev` prints `http://localhost:3000`, valley offers a one-click "Open preview" tab.

## Install

Apple Silicon Mac, macOS 11+.

1. Download the latest `Valley_x.y.z_aarch64.dmg` from [Releases](https://github.com/frdrckj/valley/releases).
2. Open the DMG, drag `Valley.app` into `Applications`.
3. **Strip the Gatekeeper quarantine flag** (the build is unsigned; you only need to do this once):
   ```bash
   xattr -d com.apple.quarantine /Applications/Valley.app
   ```
4. Launch Valley.

To use AI: ⌘, → **AI · valley** → paste your Anthropic or OpenAI key. Stored in macOS Keychain, never written to disk.

For tmux users, add to `~/.tmux.conf` so cwd / branch / block-rails track inside tmux:
```
set -g allow-passthrough on
```

## Keyboard

| Action | Shortcut |
|---|---|
| Open omnibar | ⌘P |
| New terminal tab | ⌘T |
| Close tab (prompts on unsaved file) | ⌘W |
| Next / previous tab | ⌘⇧] / ⌘⇧[ |
| Jump to tab 1–9 | ⌘1 … ⌘9 |
| Split right / below | ⌘D / ⌘⇧D |
| Focus pane | ⌘⌥← ↑ → ↓ |
| Toggle file explorer | ⌘B |
| Find in terminal | ⌘F |
| Previous / next prompt | ⌘⇧↑ / ⌘⇧↓ |
| Copy current block | ⌘⇧C |
| AI panel | ⌘I |
| Attach selection to AI | ⌘L |
| Settings | ⌘, |
| Shortcuts dialog | ⌘K |

Inside the omnibar: ↑ / ↓ or Tab / Shift+Tab or Ctrl+N / Ctrl+P to navigate, Enter to open, Esc to close.

## Build from source

```bash
pnpm install
pnpm tauri dev          # dev with HMR
pnpm tauri build        # production .app + .dmg → src-tauri/target/release/bundle/
```

Always pnpm — never npm.

## Stack

Tauri 2 (Rust) · React 19 · TypeScript · xterm.js 6 · CodeMirror 6 · Vercel AI SDK 6 · libgit2 (vendored) · zustand · Vite 7

## License

All rights reserved.
