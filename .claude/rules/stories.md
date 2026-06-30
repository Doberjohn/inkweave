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
- Components using `useCardPreview` (or rendering `SearchAutocomplete`) need a `CardPreviewProvider` decorator.
- Mock data uses the real `LorcanaCard` shape: `textSections` is `string[]`, not `{type, text}[]`.
- Excluded components (icons, context providers, ErrorBoundary) are listed in `apps/web/scripts/check-story-coverage.mjs`.
