---
name: design-system
description: Visual design system — Duolingo-inspired palette, Nunito typography, 3D buttons, cards/inputs, and ruby/furigana styling.
---

# Design System

Formerly `CONTEXT_PROMPT.md` [CP-4]. CSS Modules only — no Tailwind (see [constraints](constraints.md) [PL-8.5]).

- **Color Palette**: Duolingo-inspired. CSS variables in `globals.css`: `--color-green`, `--color-blue`, `--color-orange`, `--color-red`, `--color-yellow`, with `-shadow` variants.
- **Typography**: Nunito (Google Fonts), loaded via `layout.tsx`.
- **Buttons**: `.btn-3d` global class with color modifiers (`.btn-green`, `.btn-blue`, `.btn-red`, `.btn-orange`, `.btn-yellow`, `.btn-gray`, `.btn-purple`). 3D shadow depth effect.
- **Cards**: `.card-friendly` global class.
- **Inputs**: `.input-friendly` global class.
- **Ruby/Furigana**: `ruby { ruby-position: over; }` + `rt { font-size: 0.55em; user-select: none; }` in `globals.css`.

## [CP-5] Scope Boundary
- Only code generation, bug fixing, and feature implementation.
- No architectural decisions without an analysis/proposal audit first (Route D / Route B).
