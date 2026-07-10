# Design system mirror

There's a separate Claude project that mirrors this repo's design language: tokens, typography, brand assets, UI kit. **It is a point-in-time copy**, not a live link.

When a PR changes any of the following, refresh the design system project afterward (or note it in the PR description so it can be refreshed later). The `design-system-drift` GitHub Action watches this same set and leaves a reminder comment on such PRs; see [`.github/workflows/design-system-drift.yml`](../.github/workflows/design-system-drift.yml), which is the authoritative trigger list.

| File / folder | What lives there |
|---|---|
| `apps/web/src/shared/constants/theme.ts` | All design tokens (colors, type scale, spacing, easings) |
| `apps/web/src/docs/Colors.stories.tsx` | Canonical color palette + usage guide |
| `apps/web/src/docs/Typography.stories.tsx` | Type scale + font families + usage guide |
| `apps/web/src/docs/SpacingLayout.stories.tsx` | Spacing scale + layout constants |
| `apps/web/index.html` (font imports) | Google Fonts imports; flag any swap |
| `apps/web/public/brand/` | Logo (static + animated) |
| `apps/web/src/assets/*.svg` | Ink icons + inkable/uninkable glyphs |
| `apps/web/public/art/playstyles/` | Playstyle cover imagery |
| `apps/web/public/art/franchises/` | Franchise cover imagery |
| `.claude/rules/mockups.md` | Mockup design tokens + design-session workflow |
| CLAUDE.md's "UI Theme" and "Design Token Changes" sections | Design language + token-edit playbook |

## How to refresh

1. Open the design system project in Claude.
2. Say: *"refresh against the latest of Doberjohn/inkweave master, focus on `theme.ts`, the storybook docs, and anything in `public/brand` or `public/art` that changed."*
3. Review the diff before approving.
