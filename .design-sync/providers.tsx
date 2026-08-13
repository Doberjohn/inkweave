// Context providers, re-exported onto window.Inkweave.
//
// WHY: previews compile the story module whole, so a story's own
// `<SessionProvider>` / `<MemoryRouter>` decorator DOES come along — but the
// component it wraps has been redirected to the shipped bundle
// (story-imports.mjs rule 2). If the provider is bundled a SECOND time from
// source, the story mounts provider-instance-B while the component reads
// context-instance-A, which is null — so the component throws its own
// "must be used within a Provider" error even though the story clearly wraps it.
//
// That was 19 of the 20 render errors on the first clean build. Putting the
// providers on the global (here) plus cfg.storyImports.shim (which forces
// story imports of these modules to resolve to the global) collapses both
// sides onto ONE module instance. react-router-dom is handled the same way,
// via cfg.extraEntries.
//
// Anything a story imports as a PROVIDER — rather than as the component under
// test — belongs here.
import * as React from 'react';

/**
 * The preview mount wrapper (wired via cfg.provider).
 *
 * WHY: the card scaffold hard-codes `body{…;background:#fff}` in an inline
 * <style> AFTER the stylesheet links, so it wins over the bundle's own
 * `body{background:#0d0d14}` and every preview renders on WHITE. On a
 * dark-fantasy design system that inverts the entire palette — gold-on-near-black
 * becomes gold-on-white — and it would reach every design the agent builds.
 * The scaffold is app-contract surface (never fork emit.mjs), so the fix is a
 * provider that re-establishes the dark surface INSIDE the mount.
 *
 * This mirrors the decorator in apps/web/.storybook/preview.tsx, which wraps
 * every story in exactly this background — so previews match the reference by
 * construction. It deliberately does NOT use that decorator's `minHeight:100vh`:
 * storybook renders fullscreen, but here the mount sits in a grid cell, and a
 * viewport-tall wrapper would stretch every cell in the product card.
 */
export function InkweaveDesignRoot({children}: {children?: React.ReactNode}) {
  return (
    <div
      className="inkweave-ds-root"
      style={{
        background: '#0d0d14',
        color: '#e8e8e8',
        boxSizing: 'border-box',
        // Containing block for `position: fixed` DESCENDANTS, so in-tree fixed
        // content lands on this dark surface rather than the scaffold's white
        // body. Same technique the scaffold uses on .ds-cell / .ds-single.
        // It does NOT reach portalled overlays (DialogShell et al. portal to
        // document.body, outside this tree) — their scrims still composite over
        // the white body and read grey. Measured, not assumed: adding this did
        // not change FilterDialog's backdrop. See NOTES.md "portalled scrims".
        transform: 'translateZ(0)',
      }}
    >
      {children}
    </div>
  );
}
// Height and padding are NOT set inline: they must differ between a grid cell
// and a full-bleed single card, which needs a descendant selector. The rules
// live in .design-sync/gen-css.mjs — see NOTES.md "in-tree fixed overlays".

export {SessionProvider} from '../apps/web/src/shared/contexts/SessionContext';
export {CardDataProvider} from '../apps/web/src/shared/contexts/CardDataContext';
export {CardModalProvider} from '../apps/web/src/shared/contexts/CardModalContext';
