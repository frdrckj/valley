# Valley Design System

> Build the design system for **Valley** — a lightweight, AI-aware desktop terminal for macOS. Vibe: classic terminal, calm, retro-warm. Anti-vibe: chat-bubbles, Warp-style command-blocks, sterile SaaS dashboards.

This system is built to be implemented in code. It is delivered as **tokens** (JSON + CSS), **primitives** (buttons, inputs, splits, tool-call cards), and **screens** (zen, full layout, omnibar, AI panel, settings, etc), all themable across Gruvbox dark/light.

## Sources

No external codebase or Figma was attached. The system was built **from a written spec** describing:
- Stack: Tauri 2 (Rust) + React 19 + Tailwind v4
- Palette: canonical Gruvbox (dark default, Gruvbox Light Hard inversion)
- Typeface: **Geist Mono Variable** (single typeface across terminal, editor, UI labels)
- Iconography: Lucide-grade line icons, 1.5px stroke

If you have the actual Valley codebase or Figma, link it next to me and I'll cross-reference component implementations and replace the inferred specs with reality.

## Index

```
colors_and_type.css        Foundations — all tokens as CSS custom properties (dark + light)
tokens.json                W3C design-tokens spec — drop into Tailwind v4 @theme
assets/                    Wordmark · app icon (flat + lit) · scales
preview/                   Atomic specimens (one card per concept) — populates the Design System tab
ui_kits/valley-app/        Hi-fi React recreation; switchable screens via ?screen=
SKILL.md                   Cross-compatible Agent Skill manifest
```

### preview/ cards (in the Design System tab)

| Group       | Cards |
|-------------|-------|
| Brand       | Wordmark, App Icon (flat + lit + scales) |
| Colors      | Dark scale, Light Hard scale, Accents (dark), Semantic aliases |
| Type        | Type scale, Weights & line-heights |
| Spacing     | Spacing, Radius, Motion, Elevation |
| Components  | Buttons, Inputs, Toggles/Checks/Radios, Select/Menu, Tabs, Tooltip & kbd, Banners, Tool-call cards, Session list, File tree, Modal, Iconography, Title/Status bar, Pane splitter |

### ui_kits/valley-app/ screens (open `index.html`)

`?screen=…` — `zen` · `tabs` · `full` · `omnibar` · `ai` · `ghost` · `error` · `splits` · `settings`
`?theme=dark|light`

---

## CONTENT FUNDAMENTALS

**Voice.** The terminal is the source of truth; valley narrates around it. Copy is **lowercase, monospace, and unhurried** — never marketing-speak, never enthusiastic.

- **Casing:** lowercase always for inline labels (`new tab`, `ask valley?`, `ready`). Sentence case for prose (status banners, settings descriptions). Never Title Case, never UPPERCASE except eyebrow labels (`SETTINGS`, `EXPLORER`, `THEME`) at 10px / +0.06em tracking.
- **Person:** the app is `valley` (lowercase). Address the user with `you`. Never "we", never "Valley AI Assistant".
- **Tone:** quiet, confident, terminal-fluent. *"command not found: gti push"* — *"↩ ask valley?"*.
- **Punctuation:** prefer `·` separators (`~/valley · main · 142 lines`). Glyphs we use: `↩` `⌘` `⇧` `⌥` `›` `▾` `▸` `✓` `✗` `◆`.
- **Numbers:** always concrete. *"4.2s · 14 lines added · 3 removed"*. Avoid percentages and progress bars — show counts.
- **Errors:** state the failed thing, then offer `↩ ask valley?` as the recovery affordance. Never apologize, never use "sorry" or "oops".
- **Emoji:** never. The cursor block, chevron, and unicode glyphs above carry all the personality this system needs.

**Examples**
> ✓ build succeeded · 4.2s
> ✗ command not found: `gti push` &nbsp;·&nbsp; ↩ ask valley?
> valley suggests `git checkout main` — accept?
> 0 errors · UTF-8 · LF · zsh

---

## VISUAL FOUNDATIONS

**Colors.** Canonical Gruvbox medium-contrast (passes WCAG AA on bg/fg pairings):

- **Backgrounds:** `bg/0` (hard, terminal canvas) → `bg/4` (highest scrim). Surfaces stack from `bg/0` (terminal pane) → `bg/1` (chrome) → `bg/2` (elevated panels) → `bg/3` (hover/active surface) → `bg/4` (strong borders).
- **Foregrounds:** `fg/0` (strong text, headlines, cursor highlight) → `fg/1` (default text) → `fg/2` (secondary) → `fg.muted` (eyebrow, helper).
- **Accents (dark):** yellow `#fabd2f` (primary, default focus, cursor), red `#fb4934` (danger, errors), green `#b8bb26` (success), blue `#83a598` (info), purple `#d3869b` (AI/sparkle), aqua `#8ec07c` (paths/git), orange `#fe8019` (warning, destructive run).
- **Accents (light):** the Gruvbox Light faded variants (`#9d0006`, `#79740e`, `#b57614`, `#076678`, `#8f3f71`, `#427b58`, `#af3a03`).
- **Semantic aliases** never reference `bg/3` directly in components — always go via `surface.elevated`, `border.subtle`, `accent.primary`, etc.

**Type.** **Geist Mono Variable**, everywhere. No proportional fallbacks. Scale: 11/12/13/14/16/20/24/32. Default UI is 13px. Weights 400/500/600. Line-heights: **1.0 terminal · 1.3 ui · 1.5 prose**.

**Spacing.** 0/2/4/6/8/12/16/20/24/32/48 — every UI gap snaps to this scale. Monospace cell width is the rhythm; favour 4 / 8 multiples.

**Backgrounds.** Flat. **No gradients** in the UI surface itself — the only gradient permitted is **macOS vibrancy** (an OS-level blur over the wallpaper). No images, no full-bleed photography, no patterns, no textures, no grain.

**Animation.** Single ease: `cubic-bezier(.2, .8, .2, 1)`. Durations: instant 0 / fast 120 / normal 200 / slow 320. No bounces. No staggers. The **only** non-standard motion is the **terminal cursor blink** (1-step square wave, 1.05s period). Hover transitions are 120ms, panel slide-in is 200ms.

**Hover.** A 6% warm wash (`rgba(235,219,178,0.06)` in dark, `rgba(60,56,54,0.05)` in light) — that's it. **No** scale-up, **no** brightness pump, **no** shadow growth. Buttons promote color/border by one tier; ghost buttons surface a hover-tint background.

**Press / active.** One step deeper on the surface stack (e.g. `bg/3` for secondary). No transform: scale.

**Borders.** Borders carry the heavy lifting. `border.subtle` (`bg/3`) is the default rule between regions. `border.strong` (`bg/4`) is used for floating elements and pressed states. Focus rings are 2px `accent.primary` with a 1px offset; never blue.

**Shadows.** **Two tiers only.** `none` (default — borders define everything) and `floating` — used **only** on omnibar, dropdowns, popovers, modals. `0 2px 6px rgba(0,0,0,.30), 0 12px 32px rgba(0,0,0,.45)`. Never inset.

**Transparency / blur.** Reserved for the **omnibar overlay** (55% black scrim + 2px backdrop blur) and the optional **macOS window vibrancy**. Nowhere else in the UI uses translucency.

**Imagery vibe.** There is no imagery. The aesthetic is monochromatic warm gruvbox + 7 accents.

**Corner radii.** `none 0 / sm 4 / md 6 / lg 8 / xl 12`. Default UI radius is **md (6px)**. Buttons, inputs, kbd caps and chips at `sm/md`. Cards and the AI panel at `md/lg`. The omnibar and modals at `lg/xl`. The macOS app icon mask sits at the platform squircle (~228/1024).

**Cards.** A card is `surface.elevated` + 1px `border.subtle` + radius `md`. **No shadow** unless it's floating. Internal padding 12–16. Section eyebrows are 10px/0.06em uppercase muted.

**Layout rules.** Everything snaps to the monospace grid. The title bar is **36px**, tab strip **26px**, status bar **22px** (ultra-thin). Sidebar default 220px, AI panel default 360px (resizable). Panes are 1px borders, never gutters. Focused panes get a **2px `accent.primary` border-left** + full opacity; unfocused panes drop to **0.55 opacity**.

**Restraint principle.** Every pixel must justify itself. Negative space is the design.

---

## ICONOGRAPHY

**System:** Lucide-grade line icons at **1.5px stroke**, `currentColor`, `stroke-linecap: round`, `stroke-linejoin: round`. The set is hand-rolled and inlined as JSX (`ui_kits/valley-app/components.jsx`'s `ICON_PATHS`) so colors derive from token semantics — never hardcoded fills.

**Set (21 icons):** `terminal`, `file`, `folder`, `folder-open`, `chevron-right`, `chevron-down`, `plus`, `x`, `search`, `sparkle` (AI), `play`, `stop`, `copy`, `settings`, `vibrancy-toggle`, `split-vertical`, `split-horizontal`, `refresh`, `send`, `microphone`, `paperclip`. Plus auxiliary: `check`, `warn`, `alert`, `pin`, `resize`.

**Color rules.**
- Default: `var(--text-secondary)`. Hover/active rows promote to `text.primary` or `text.strong`.
- Sparkle/AI icons always `var(--accent-ai)` (purple).
- Run/play default; `stop` is `accent.warning` (orange) when the run is destructive.
- `accent.danger` is reserved for the literal X glyph in error banners and destructive button outlines.

**Emoji:** never used. Unicode glyphs that *are* used: `↩ ⌘ ⇧ ⌥ › ▾ ▸ ✓ ✗ ◆ ●`. These appear in kbd caps, prompts, status badges, and the "↩ ask valley?" affordance.

**Substitution flag.** No proprietary icon set was supplied — Valley does not ship a custom icon font. The set above matches Lucide weight and metaphor; if you'd rather pull Lucide directly from `lucide-react`, the names map 1:1.

---

## FONT SUBSTITUTION FLAG

**Geist Mono Variable** is used as specified — it is loaded from Google Fonts (`https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900&display=swap`). If you want to ship the variable WOFF2 with the app for offline use, drop the file at `fonts/GeistMono[wght].woff2` and replace the `@import` in `colors_and_type.css` with a local `@font-face`. **No substitute font is in use.**

---

## MANIFEST

```
README.md                  ← this file
SKILL.md                   ← Agent-Skills compatible manifest
colors_and_type.css        ← all tokens as CSS custom properties
tokens.json                ← W3C design tokens (drop into Tailwind v4 @theme)
assets/
  wordmark.svg
  icon-1024-flat.svg
  icon-1024-lit.svg
preview/
  _card.css                ← shared card frame
  _components.css          ← UI primitive styles (button, input, kbd, …)
  brand-*.html             ← wordmark, app icon
  colors-*.html            ← dark scale, light scale, accents, semantic
  type-*.html              ← scale, weights & leading
  spacing-scale.html · radius-scale.html · motion.html · elevation.html
  component-*.html         ← buttons, inputs, toggles, select, tabs, tooltip,
                             banners, toolcalls, session-item, tree, modal
  iconography.html
  layout-titlebar-statusbar.html · layout-splitter.html
ui_kits/valley-app/
  index.html               ← React app · ?screen=zen|tabs|full|omnibar|ai|ghost|error|splits|settings
  components.jsx           ← TitleBar, TabStrip, FileTree, StatusBar, Icon, Btn, Kbd, Dot
  screens.jsx              ← Terminal, AiPanel, ToolCallCard, Omnibar, Settings, ErrorBanner
  valley.css               ← scoped layout styles
```
