---
name: valley-design
description: Use this skill to generate well-branded interfaces and assets for Valley — a lightweight, AI-aware desktop terminal for macOS — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, Gruvbox palette, Geist Mono type scale, fonts, brand assets, and a React UI kit for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference for Valley

- **Stack:** Tauri 2 (Rust) + React 19 + Tailwind v4. Drop `tokens.json` into `@theme` or use `colors_and_type.css` directly.
- **Palette:** canonical Gruvbox — dark default, Gruvbox Light Hard inversion. Dark accents: red `#fb4934`, green `#b8bb26`, yellow `#fabd2f` (primary), blue `#83a598`, purple `#d3869b` (AI), aqua `#8ec07c`, orange `#fe8019`.
- **Type:** Geist Mono Variable, single typeface, scale 11/12/13/14/16/20/24/32, weights 400/500/600, line-heights 1.0/1.3/1.5.
- **Spacing:** 0/2/4/6/8/12/16/20/24/32/48 px. Radius: none/sm 4/md 6 (default)/lg 8/xl 12.
- **Motion:** instant/fast 120/normal 200/slow 320 ms · ease `cubic-bezier(.2,.8,.2,1)`.
- **Elevation:** borders + 1 floating tier (omnibar / dropdowns / modals). No other shadows.
- **Voice:** lowercase, calm, terminal-fluent. No emoji. Errors say `✗ command not found: gti push  ·  ↩ ask valley?`
- **Iconography:** Lucide-grade, 1.5px stroke, `currentColor`. Set listed in `README.md → ICONOGRAPHY`.

## Files

- `README.md` — full guide (content fundamentals, visual foundations, iconography, manifest)
- `colors_and_type.css` — drop-in CSS custom properties (dark + light)
- `tokens.json` — W3C design tokens
- `assets/` — wordmark, app icon (flat + softly-lit)
- `preview/` — one-card-per-concept specimens (color scales, type, spacing, components)
- `ui_kits/valley-app/` — React UI kit; open `index.html?screen=full&theme=dark`

## Restraint principle

Every pixel must justify itself. Borders over shadows. Negative space over decoration. Monospace grid over visual flourish. The aesthetic is **classic terminal, calm, retro-warm** — not chat bubbles, not Warp-style command blocks, not sterile SaaS dashboards.
