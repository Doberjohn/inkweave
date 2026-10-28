// Story coverage checker — finds React components without Storybook stories,
// and orphaned stories without components (#512: reverse direction).
// Scans shared/components, features/*/components, feature ROOTS (reveals,
// playstyles, ...), src/pages, and every folder of inkweave-ui (packages/ui/src),
// and fails a story file that none of Storybook's stories globs loads.
//
// Fails CI only when NEW components are added without stories (or a story's
// component vanishes). Pre-existing gaps are tracked in KNOWN_MISSING and
// should be chipped away over time.
//
// Usage: node apps/web/scripts/check-story-coverage.mjs

import {readdirSync, existsSync, readFileSync} from 'fs';
import {join, basename, dirname, posix, relative} from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appDir = join(__dirname, '..');
const repoDir = join(appDir, '..', '..');
const srcDir = join(appDir, 'src');
const uiSrcDir = join(repoDir, 'packages', 'ui', 'src');
const SOURCE_ROOTS = [srcDir, uiSrcDir];
/** Repo-relative, forward slashes: apps/web/src/... or packages/ui/src/... */
const fromRepo = (p) => relative(repoDir, p).replaceAll('\\', '/');

// Components that intentionally don't need stories
const EXCLUDED = new Set([
  'ErrorBoundary.tsx', // error boundaries need runtime errors to demo
  'SearchIcon.tsx', // tiny SVG icon
  'FilterIcon.tsx', // tiny SVG icon
  'CostIcon.tsx', // tiny SVG icon
  'InkIcon.tsx', // tiny SVG icon
  'icons.tsx', // the Friends section's copy and check glyphs (#852), tiny SVG icons
  'PencilIcon.tsx', // tiny SVG icon
  'EtherealBackground.tsx', // decorative static backdrop (blurred glow orbs), not animated
  'RenderProfiler.tsx', // performance utility wrapper, not visual
  'RevealsGate.tsx', // route gate: renders children or a redirect, no visual surface
  'Seo.tsx', // head-only: emits <title>/<meta>/<link> via React 19 native metadata, renders no visible UI
  // Context provider: renders only its children, exactly like the providers in
  // shared/contexts (which this script does not scan). It lives under features/
  // because it reads a repository, and shared/ must not import a feature.
  'ProfileContext.tsx',
  // Same case (#553). CollectionContext reads collectionRepository and owns the
  // imported-collection state; CollectionCardsContext lazily loads the non-Core
  // pool. Both render `children` and nothing else, so a story would show a blank
  // frame and assert nothing. The binder and dialog they feed DO have stories.
  'CollectionContext.tsx',
  'CollectionCardsContext.tsx',
  // A hook (#553 Phase C), not a component: it holds collection mode's state and
  // returns slots for BrowseCollectionPage. Its JSX only composes components that have
  // their own stories (CollectionModeSwitch, CollectionBinderSection,
  // ImportCollectionDialog, SignInDialog), and it needs a session plus both
  // collection providers to run, so a story of it would be a page in disguise.
  'useBrowseCollection.tsx',
  // The layout route that mounts the two collection providers around an
  // <Outlet />: like the providers themselves it renders only its children.
  'CollectionScope.tsx',
  // The account page's collection wiring, split out so a flag-off build never loads
  // the collection's data layer. Like useBrowseCollection, it only feeds hooks into
  // components with their own coverage: the page's CollectionSection (pages are
  // excluded) and ImportCollectionDialog (storied), and needs both providers to run.
  'AccountCollection.tsx',
  // Same case (#852): the page's Friends wiring, a module of its own so a flag-off build
  // never loads the friends code. It only feeds useFriends into FriendsSection, which has
  // its own stories, and needs a session and Supabase to run.
  'AccountFriends.tsx',
  // Wiring (#826): portals the copies stripe (CopiesStripe, storied) into the card window's
  // slot, reading the session, the collection and the window's stores. A story of it would
  // need all three to show only the stripe its own stories already show.
  'WindowCopies.tsx',
  // Same case (#1055): portals the friends count (FriendsHaveButton, storied) into the card
  // window's friends slot and opens Friends who have it (storied), reading the session, the
  // collection, the friends' copies and the window's stores.
  'WindowFriends.tsx',
]);

// Pages are route compositions of already-storied components; stories exist
// only for page-level SKELETONS (layout contracts). Full pages are excluded
// unless someone opts one in by writing a story (the reverse check keeps it).
const PAGE_EXCLUDE_RE = /Page\.tsx$/;

// Pre-existing components without stories (tracked debt — remove as stories are added)
const KNOWN_MISSING = new Set([
  'apps/web/src/features/cards/components/BrowseCardGrid.tsx',
  'apps/web/src/features/cards/components/FeaturedCards.tsx',
  'apps/web/src/features/synergies/components/CardDetailPanel.tsx',
  'apps/web/src/features/synergies/components/ExpandedGroupView.tsx',
  'apps/web/src/features/synergies/components/SynergyResults.tsx',
  'apps/web/src/shared/components/SearchBottomSheet.tsx',
]);

/** True when the file default- or named-exports a component-looking symbol. */
function looksLikeComponent(filePath) {
  const src = readFileSync(filePath, 'utf8');
  // JSX presence is the cheap signal; types/hooks/data modules don't render.
  return /return \(?\s*</.test(src) || /=>\s*\(?\s*</.test(src);
}

function findComponents(dir, {requireJsx = false} = {}) {
  const components = [];
  if (!existsSync(dir)) return components;

  for (const file of readdirSync(dir)) {
    const full = join(dir, file);
    if (
      !file.endsWith('.tsx') ||
      file.endsWith('.stories.tsx') ||
      file.endsWith('.test.tsx') ||
      file.startsWith('__')
    ) {
      continue;
    }
    if (requireJsx && !looksLikeComponent(full)) continue;
    components.push(full);
  }
  return components;
}

function getScanRoster() {
  // [dir, options] pairs. Feature ROOTS + pages need the JSX sniff because they
  // also hold hooks/types/data modules that never render.
  const roster = [[join(srcDir, 'shared', 'components'), {}]];

  const featuresDir = join(srcDir, 'features');
  if (existsSync(featuresDir)) {
    for (const feature of readdirSync(featuresDir)) {
      const featureRoot = join(featuresDir, feature);
      roster.push([featureRoot, {requireJsx: true}]);
      const compDir = join(featureRoot, 'components');
      if (existsSync(compDir)) roster.push([compDir, {}]);
    }
  }
  roster.push([join(srcDir, 'pages'), {requireJsx: true}]);
  return [...roster, ...getPackageRoster()];
}

// The tests' folders and their helpers' (test-utils/, which the app's shared/test-utils mirrors
// and this script never scans either).
const NOT_SCANNED = /^(__|test-utils$)/;

function isScannedFolder(entry) {
  return entry.isDirectory() && !NOT_SCANNED.test(entry.name);
}

/**
 * Every inkweave-ui folder but NOT_SCANNED. components/ and lorcana/ hold only components, so no
 * JSX sniff (like shared/components); the other folders count only the files that render.
 */
function getPackageRoster() {
  return readdirSync(uiSrcDir, {withFileTypes: true})
    .filter(isScannedFolder)
    .map((entry) => {
      const strict = entry.name === 'components' || entry.name === 'lorcana';
      return [join(uiSrcDir, entry.name), strict ? {} : {requireJsx: true}];
    });
}

/** True when a `.stories.tsx` file has no sibling component (concept-file rot, #512). */
function isOrphanedStory(fullPath) {
  if (!fullPath.endsWith('.stories.tsx')) return false;
  // src/docs/ stories are documentation pages, not component mirrors.
  if (fullPath.includes(join('src', 'docs'))) return false;
  return !existsSync(fullPath.replace('.stories.tsx', '.tsx'));
}

/** Every .stories.tsx under the app's and the package's src. */
function findStoryFiles() {
  const stories = [];
  const stack = [...SOURCE_ROOTS];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.endsWith('.stories.tsx')) stories.push(full);
    }
  }
  return stories;
}

/** Storybook's stories globs as repo-relative patterns (Node 24 strips main.ts's types). */
async function storybookGlobs() {
  const mainPath = join(appDir, '.storybook', 'main.ts');
  const {default: config} = await import(pathToFileURL(mainPath).href);
  return config.stories.map((glob) => posix.join(fromRepo(dirname(mainPath)), glob));
}

const missing = [];
const knownStillMissing = [];
const knownNowCovered = [];
const seen = new Set();

for (const [dir, options] of getScanRoster()) {
  for (const compPath of findComponents(dir, options)) {
    const file = basename(compPath);
    if (EXCLUDED.has(file)) continue;
    if (dir.endsWith('pages') && PAGE_EXCLUDE_RE.test(file)) continue;
    if (seen.has(compPath)) continue;
    seen.add(compPath);

    const rel = fromRepo(compPath);
    const storyPath = compPath.replace('.tsx', '.stories.tsx');
    const hasStory = existsSync(storyPath);

    if (KNOWN_MISSING.has(rel)) {
      if (hasStory) {
        knownNowCovered.push(rel);
      } else {
        knownStillMissing.push(rel);
      }
    } else if (!hasStory) {
      missing.push(rel);
    }
  }
}

const stories = findStoryFiles();
const orphanedStories = stories.filter(isOrphanedStory).map(fromRepo);
const globs = await storybookGlobs();
const unloadedStories = stories.map(fromRepo).filter((rel) => !globs.some((glob) => posix.matchesGlob(rel, glob)));

// Report
let hasError = false;

if (missing.length > 0) {
  console.error(`\n❌ ${missing.length} NEW component(s) missing stories:\n`);
  for (const path of missing.sort()) {
    console.error(`  • ${path}`);
  }
  console.error('\nAdd a .stories.tsx file, or add to EXCLUDED/KNOWN_MISSING in this script.\n');
  hasError = true;
}

if (orphanedStories.length > 0) {
  console.error(`\n❌ ${orphanedStories.length} orphaned story file(s) with no sibling component:\n`);
  for (const path of orphanedStories.sort()) {
    console.error(`  • ${path}`);
  }
  console.error('\nDelete the story or restore its component (concept-file rot guard, #512).\n');
  hasError = true;
}

if (unloadedStories.length > 0) {
  console.error(`\n❌ ${unloadedStories.length} story file(s) Storybook never loads:\n`);
  for (const path of unloadedStories.sort()) {
    console.error(`  • ${path}`);
  }
  console.error('\nAdd their folder to stories in apps/web/.storybook/main.ts.\n');
  hasError = true;
}

if (knownNowCovered.length > 0) {
  console.log(
    `\n🎉 ${knownNowCovered.length} component(s) now have stories — remove from KNOWN_MISSING:\n`,
  );
  for (const path of knownNowCovered.sort()) {
    console.log(`  • ${path}`);
  }
}

if (knownStillMissing.length > 0) {
  console.log(`\n📋 ${knownStillMissing.length} known debt (pre-existing, won't fail CI):\n`);
  for (const path of knownStillMissing.sort()) {
    console.log(`  • ${path}`);
  }
}

if (!hasError && knownNowCovered.length === 0 && knownStillMissing.length === 0) {
  console.log('✅ All components have Storybook stories (or are excluded).');
}

if (!hasError) {
  console.log('\n✅ Story coverage check passed.');
} else {
  process.exit(1);
}
