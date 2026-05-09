# valley

A lightweight, AI-aware desktop terminal for macOS. Classic terminal feel,
Gruvbox-default, single typeface (Geist Mono Variable).

This repo is currently the **design-system-implementation pass** for valley
v0.1. The Tauri 2 + Rust PTY backend lands in the next pass — see
[`docs/superpowers/specs/`](./docs/superpowers/specs).

## Run

```bash
pnpm install
pnpm dev          # vite dev server on http://localhost:5173
pnpm typecheck    # tsc -b --noEmit
pnpm build        # vite build
```

Append `?screen=…` to switch the demo screen:

`zen` · `tabs` · `full` · `omnibar` · `ai` · `ghost` · `error` · `splits` · `settings`

`?theme=dark|light` swaps the theme.

## Layout

```
src/
  components/     primitives — Icon · Btn · Kbd · Dot
  modules/
    header/       title bar
    tabs/         slim tab strip
    explorer/     file tree
    statusbar/    bottom status bar
    terminal/     terminal pane mock + error banner + splits
    ai/           AI panel · tool-call card · ⌘K omnibar
    settings/     settings window content
  styles/         tokens · reset · components · app · index (Tailwind v4 entry)
  lib/            small pure helpers (URL state, etc.)
  App.tsx         screen switcher coordinator
  main.tsx        React root

public/           identity assets (wordmark · app icons)
docs/
  design/         claude.ai/design handoff bundle (authoritative visual ref)
  superpowers/
    specs/        design docs (start with valley v0.1 MVP)
```

## License

All rights reserved (private). License decision deferred to Phase 3.
