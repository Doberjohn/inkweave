# Design system mirror

There's a separate Claude project that mirrors this repo's design language: tokens, typography, brand assets, UI kit. **It is a point-in-time copy**, not a live link.

When a PR changes any of the following, refresh the design system project afterward (or note it in the PR description so it can be refreshed later). The `design-system-drift` GitHub Action watches this same set and leaves a reminder comment on such PRs; see [`.github/workflows/design-system-drift.yml`](../.github/workflows/design-system-drift.yml), which is the authoritative trigger list.

| File / folder | What lives there |
|---|---|
| `packages/ui/src/tokens/` | All design tokens: `theme.ts` (colors, type scale, spacing, easings) and `lorcana.ts` (ink colors, ink order, cost buttons) |
| `packages/ui/src/docs/Colors.stories.tsx` | Canonical color palette + usage guide |
| `packages/ui/src/docs/Typography.stories.tsx` | Type scale + font families + usage guide |
| `packages/ui/src/docs/SpacingLayout.stories.tsx` | Spacing scale + layout constants |
| `apps/web/index.html` (font imports) | Google Fonts imports; flag any swap |
| `apps/web/public/brand/` | Logo (static + animated) |
| `apps/web/src/assets/*.svg` | The sign-in logos (Discord, Google) |
| `packages/ui/src/assets/*.svg` | Ink icons, inkable/uninkable glyphs and rarity symbols |
| `apps/web/public/art/playstyles/` | Playstyle cover imagery |
| `apps/web/public/art/franchises/` | Franchise cover imagery |
| `.claude/rules/mockups.md` | Mockup design tokens + design-session workflow |
| CLAUDE.md's "UI Theme" and "Design Token Changes" sections | Design language + token-edit playbook |

## How to refresh

1. Open the design system project in Claude.
2. Say: *"refresh against the latest of Doberjohn/inkweave master, focus on the tokens (`packages/ui/src/tokens/`), the storybook docs (`packages/ui/src/docs/`), the ink icons and glyphs, and anything in `public/brand` or `public/art` that changed."* Once inkweave-ui holds the icons, point the prompt at `packages/ui/src/assets/` for them. The drift workflow's comment lists the exact files a PR touched.
3. Review the diff before approving.
