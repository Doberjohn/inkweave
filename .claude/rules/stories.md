---
description: Storybook story-writing conventions for Inkweave components.
paths:
  - "**/*.stories.tsx"
---

# Storybook story conventions

When editing a `*.stories.tsx` file:

- Import `Meta` / `StoryObj` from `@storybook/react-vite` (NOT `@storybook/react`: the Storybook 10 lint rule flags it).
- Stories live next to the component: `ComponentName.stories.tsx` beside `ComponentName.tsx`.
- Components using React Router need a `MemoryRouter` decorator.
- Mock data uses the real `LorcanaCard` shape: `textSections` is `string[]`, not `{type, text}[]`. Use Core-era `setCode`s (`'9'`+) and self-hosted `/card-images/...` paths so stories never render error fallbacks (#512).
- **Backgrounds/viewport are SB10 globals, not per-story params** (#512): the dark canvas comes from `preview.tsx`'s `backgrounds.options` + `initialGlobals` — never add `backgrounds: {default: ...}` (dead since SB8). Mobile stories use `globals: {viewport: {value: 'mobile1'}}`, not `parameters.viewport.defaultViewport` (equally dead).
- Excluded components (icons, route gates, ErrorBoundary) are listed in `apps/web/scripts/check-story-coverage.mjs`. The gate scans shared/components, feature dirs + roots, and pages, in BOTH directions — an orphaned `.stories.tsx` with no sibling component also fails.
