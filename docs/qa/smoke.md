# Valley v0.1 — Smoke checklist

Run before tagging a build. All items must pass on a fresh macOS user account.

## Boot + identity
- [ ] `pnpm tauri dev` opens valley < 1 s after build cache is warm
- [ ] Window title is "valley", traffic lights overlay the terminal
- [ ] Bundle id is `app.valley.terminal` (`mdls -name kMDItemCFBundleIdentifier valley.app`)

## Terminal
- [ ] `ls`, `pwd`, `echo $SHELL` work; output renders with Geist Mono + Gruvbox
- [ ] Cmd+T opens a new tab; Cmd+W closes; tabs persist scroll-back
- [ ] OSC 7 cwd updates the title bar cwd indicator after `cd`
- [ ] Failing command (e.g. `gti push`) exits non-zero — exit code captured by OSC 133 D

## Explorer
- [ ] File tree shows the workspace root; folders expand on click
- [ ] Hidden files honored via `.gitignore` (no node_modules listed)

## AI
- [ ] Settings → AI → enter Anthropic key → Cmd+, persists across restart
- [ ] Cmd+I (placeholder) — AI panel toggle planned in Phase 1.1
- [ ] Ask "list files in src/" — agent calls `list_directory`, returns listing
- [ ] Ask "write '/tmp/v.txt' with 'hi'" — pending approval card; Approve writes file
- [ ] Ask "run pnpm typecheck" — pending approval; Approve runs and streams output

## Omnibar
- [ ] Cmd+K opens omnibar; type query, Enter sends; result renders inline
- [ ] Esc dismisses

## Settings
- [ ] Cmd+, opens separate Settings window
- [ ] Theme toggle (dark/light) flips both windows
- [ ] Sidebar position swap moves explorer
- [ ] AI panel position swap moves chat panel

## Security
- [ ] Ask "read .env" — agent refuses ("secret-like path")
- [ ] Ask "read ~/.ssh/id_rsa" — refused

## Persistence
- [ ] Quit valley, reopen — sessions list intact, last active session restored
- [ ] Layout / theme / model persists

## Performance budgets (informational)
- [ ] Cold start ≤ 800 ms
- [ ] Idle RAM ≤ 180 MB (Activity Monitor)
- [ ] Production bundle ≤ 12 MB (`pnpm check:size`)

## Known gaps deferred to Phase 1.1
- Splits inside tabs (Cmd+D / Cmd+Shift+D / Cmd+arrow) — splits.ts pane tree exists but pane management UI not yet wired
- AI panel toggle / explorer toggle keymap — handlers stubbed as no-ops
- Tokyo Night Storm + Nord theme tokens
- Live cwd surfacing via per-pane refs (currently null)
- "↩ ask valley?" error banner on OSC 133 D non-zero exit
