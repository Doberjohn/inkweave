// Where the design-token rules stop (#508). Every path is repo-relative, so one table covers the
// app (apps/web/) and inkweave-ui (packages/ui/), and each entry names one file, or one folder when
// it ends in "/". A file outside both, such as admin's own (admin lints with these rules), keeps
// its absolute path and matches no path entry. The patterns match by file kind, anywhere.

// The last apps/web or packages/ui in the path, so a checkout under a folder of either name works.
const WORKSPACE_PATH = /^(?:.*\/)?((?:apps\/web|packages\/ui)\/.*)$/;

/** apps/web/... or packages/ui/..., with forward slashes; any other file keeps its absolute path. */
export function relName(context) {
  const name = context.filename.replace(/\\/g, '/');
  return name.match(WORKSPACE_PATH)?.[1] ?? name;
}

/** An entry ending in "/" covers that folder; any other entry names exactly one file. */
export function isUnder(name, entry) {
  return entry.endsWith('/') ? name.startsWith(entry) : name === entry;
}

// Admin's own tests and stories rely on these, so fencing them to this repo would fail its lint at
// the next pin bump.
const TEST_FILE = /\.test\.(ts|tsx)$/;
const STORY_FILE = /\.stories\.tsx$/;

/** True when the file is one of the table's paths, or matches one of its patterns. */
export function isExempt(context, {paths = [], patterns = []}) {
  const name = relName(context);
  return paths.some((entry) => isUnder(name, entry)) || patterns.some((re) => re.test(name));
}

/**
 * Permanently exempt files for the color rules: token declaration sites, the token documentation
 * stories (they must show literals), unit tests (assertion pins), and the SVG icon components
 * (vector art, not themed UI).
 */
export const COLOR_EXEMPT = {
  paths: [
    'packages/ui/src/tokens/',
    'apps/web/src/shared/constants/playstyleUi.ts',
    'apps/web/src/features/cards/components/binderLook.ts',
    'packages/ui/src/docs/',
    'packages/ui/src/components/FilterIcon.tsx',
    'packages/ui/src/components/SearchIcon.tsx',
    'packages/ui/src/lorcana/CostIcon.tsx',
    'packages/ui/src/lorcana/InkIcon.tsx',
    'packages/ui/src/lorcana/InkwellIcon.tsx',
  ],
  patterns: [TEST_FILE],
};

export const TEST_EXEMPT = {patterns: [TEST_FILE]};

/**
 * Stories and the token-showcase docs are fixtures: their padding is scaffolding, not product
 * (owner ruling, 2026-07-31). Mirrors the color rules, which already exempt the docs. theme.ts is
 * not exempt, unlike for the color rules: its raw spacing goes in the ledger like any other
 * file's (owner, 2026-10-22).
 */
export const SPACING_EXEMPT = {paths: ['packages/ui/src/docs/'], patterns: [TEST_FILE, STORY_FILE]};

/**
 * The blessed button menu is closed (#509): the kit's own internals and the domain families below
 * are the only legitimate styled-button authors.
 */
export const ADHOC_BUTTON_EXEMPT = {
  paths: [
    'packages/ui/src/components/', // the kit itself, QuantityStepper's domain stepper family too
    'packages/ui/src/lorcana/CardImageButton.tsx', // a card's enlargeable art
    'packages/ui/src/lorcana/CardTile.tsx', // card-grid tile family
    'packages/ui/src/lorcana/CopiesStripe.tsx', // the collection's copies stepper family
    'packages/ui/src/lorcana/PrintingPeek.tsx', // the printing stack's peek arrows
    'apps/web/src/shared/components/BackLink.tsx', // back-navigation link
    'apps/web/src/shared/components/ConnectionGroup.tsx', // a synergy group's expand toggle
    'apps/web/src/shared/components/ErrorBoundary.tsx', // the error screen's action
    'apps/web/src/shared/components/MobileBottomNav.tsx', // bottom-nav tab family
    'apps/web/src/shared/components/SearchBottomSheet.tsx', // search sheet's clear and recent chips
    'apps/web/src/features/voting/components/OptionPicker.tsx', // vote picker family (CarriesPicker adapts it)
    'apps/web/src/features/voting/components/ScorePicker.tsx', // vote score row
    'apps/web/src/features/voting/components/QuickVoteControl.tsx', // vote control family
    'apps/web/src/features/voting/components/VoteGroupTabs.tsx', // in-depth vote group tab family (#835)
    'apps/web/src/features/synergies/components/RoleTileRow.tsx', // tile-toggle family
    'apps/web/src/features/synergies/components/SynergyMoreTile.tsx', // a synergy group's "+N more" tile
    'apps/web/src/features/synergies/components/ComparisonCardTile.tsx', // phone comparison card tile family (#835)
    'apps/web/src/features/synergies/components/ScoreChevronsTab.tsx', // phone comparison score tab family (#835)
    'apps/web/src/features/reveals/CardSlot.tsx', // reveals tile family
    'apps/web/src/features/reveals/InkTrackerTile.tsx', // reveals ink-selection tile family (#511)
    'apps/web/src/features/reveals/SpotlightHero.tsx', // reveals spotlight tile family (#835)
  ],
  patterns: [TEST_FILE, STORY_FILE],
};

/**
 * The overlay contract's entry points (#510), and FilterDialog, the documented Radix exception
 * (.claude/rules/overlays.md): Radix Dialog supplies the trap, the lock and Escape.
 */
export const ARIA_MODAL_EXEMPT = {
  paths: [
    'packages/ui/src/components/DialogShell.tsx',
    'packages/ui/src/components/BottomSheet.tsx',
    'apps/web/src/shared/components/FilterDialog.tsx',
  ],
  patterns: [TEST_FILE, STORY_FILE],
};
