# VALLEY.md

Drop a `VALLEY.md` at the root of any workspace and valley loads it into
the AI's system context. Treat it like `AGENTS.md` / `CLAUDE.md` — the
short briefing the AI reads before answering.

## Project (template)

> **Valley** — a lightweight, AI-aware desktop terminal for macOS.
> Stack: Tauri 2 (Rust) + React 19 + TypeScript + Tailwind v4 +
> xterm.js (WebGL) + Vercel AI SDK v6.

## What I want valley to do here

Replace this section with the rules you want the AI to follow in this
workspace. Examples:

- `pnpm` is the package manager — never use `npm`/`yarn`.
- TypeScript: prefer named exports; avoid `any`.
- Run `pnpm typecheck` before claiming a task is done.

## Notes

- Anything you write here is sent to the model on every turn — keep it
  tight. If the file grows past a screen, summarise.
- Secret paths (`.env*`, `.ssh/`, `credentials*`) are **always** denied
  by valley's tool-security layer regardless of what this file says.
