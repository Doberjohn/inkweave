// Story coverage checker — finds React components without Storybook stories,
// and orphaned stories without components (#512: reverse direction).
// Scans shared/components, features/*/components, feature ROOTS (reveals,
// playstyles, ...), and src/pages.
//
// Fails CI only when NEW components are added without stories (or a story's
// component vanishes). Pre-existing gaps are tracked in KNOWN_MISSING and
// should be chipped away over time.
//
// Usage: node apps/web/scripts/check-story-coverage.mjs

import {readdirSync, existsSync, readFileSync} from 'fs';
import {join, basename, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

// Components that intentionally don't need stories
const EXCLUDED = new Set([
  'ErrorBoundary.tsx', // error boundaries need runtime errors to demo
  'SearchIcon.tsx', // tiny SVG icon
  'FilterIcon.tsx', // tiny SVG icon
  'CostIcon.tsx', // tiny SVG icon
  'InkIcon.tsx', // tiny SVG icon
  'EtherealBackground.tsx', // decorative static backdrop (blurred glow orbs), not animated
  'RenderProfiler.tsx', // performance utility wrapper, not visual
  'RevealsGate.tsx', // route gate: renders children or a redirect, no visual surface
  'Seo.tsx', // head-only: emits <title>/<meta>/<link> via React 19 native metadata, renders no visible UI
]);

// Pages are route compositions of already-storied components; stories exist
// only for page-level SKELETONS (layout contracts). Full pages are excluded
// unless someone opts one in by writing a story (the reverse check keeps it).
const PAGE_EXCLUDE_RE = /Page\.tsx$/;

// Pre-existing components without stories (tracked debt — remove as stories are added)
const KNOWN_MISSING = new Set([
  '/src/features/cards/components/BrowseCardGrid.tsx',
  '/src/features/cards/components/FeaturedCards.tsx',
  '/src/features/synergies/components/CardDetailPanel.tsx',
  '/src/features/synergies/components/ExpandedGroupView.tsx',
  '/src/features/synergies/components/SynergyResults.tsx',
  '/src/shared/components/SearchBottomSheet.tsx',
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
  return roster;
}

/** True when a `.stories.tsx` file has no sibling component (concept-file rot, #512). */
function isOrphanedStory(fullPath) {
  if (!fullPath.endsWith('.stories.tsx')) return false;
  // src/docs/ stories are documentation pages, not component mirrors.
  if (fullPath.includes(join('src', 'docs'))) return false;
  return !existsSync(fullPath.replace('.stories.tsx', '.tsx'));
}

function findOrphanedStories() {
  const orphans = [];
  const stack = [srcDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (isOrphanedStory(full)) orphans.push(full.replace(join(srcDir, '..'), '').replaceAll('\\', '/'));
    }
  }
  return orphans;
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

    const relative = compPath.replace(join(srcDir, '..'), '').replaceAll('\\', '/');
    const storyPath = compPath.replace('.tsx', '.stories.tsx');
    const hasStory = existsSync(storyPath);

    if (KNOWN_MISSING.has(relative)) {
      if (hasStory) {
        knownNowCovered.push(relative);
      } else {
        knownStillMissing.push(relative);
      }
    } else if (!hasStory) {
      missing.push(relative);
    }
  }
}

const orphanedStories = findOrphanedStories();

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
