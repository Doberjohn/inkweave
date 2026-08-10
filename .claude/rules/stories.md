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
- Excluded components (icons, route gates, ErrorBoundary) are listed in `apps/web/scripts/check-story-coverage.mjs`. The gate scans shared/components, feature dirs + roots, and pages, in BOTH directions — an orphaned `.stories.tsx` with no sibling component also fails. Note the list is about FILE LOCATION as much as component nature: `DeckContext.tsx` needs no entry only because `features/deck/state/` is not a scanned root, while `ProfileContext.tsx` and `CollectionContext.tsx` sit at feature roots and do.

## Overlay stories: use `screen`, never `within(canvasElement)`

`DialogShell` and `BottomSheet` **portal to `document.body`**, so the overlay is
outside the story canvas. A `play` function scoped to `canvasElement` finds
nothing and throws `TestingLibraryElementError: Unable to find a label…`.

**This fails SILENTLY in the canvas.** The story still renders its initial state
and looks correct — the error only appears in the Interactions panel and the
browser console. A play-driven story can therefore show you the wrong state with
complete confidence, so verify the DOM rather than trusting the screenshot.

```tsx
import {fn, screen, userEvent} from 'storybook/test';
play: async () => {
  await userEvent.upload(screen.getByLabelText('Collection CSV file'), csvFile());
},
```

Two related traps found the same day (#553):

- **`display: none` inputs cannot be driven** by `userEvent` and are dropped from
  the accessibility tree. Use the visually-hidden clip instead — see
  `ImportCollectionDialog.tsx`'s `VISUALLY_HIDDEN`.
- **Play functions do not run in the bare `iframe.html?id=…` URL**, only in the
  full Storybook UI. Loading the iframe directly to check a play-driven state
  shows the pre-play render and looks like the play function is broken.
