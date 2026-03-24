// Story coverage checker — finds React components without Storybook stories.
// Scans shared/components and features/*/components for .tsx files,
// checks if a corresponding .stories.tsx exists, and reports gaps.
//
// Fails CI only when NEW components are added without stories.
// Pre-existing gaps are tracked in KNOWN_MISSING and should be chipped away over time.
//
// Usage: node apps/web/scripts/check-story-coverage.mjs

import {readdirSync, existsSync} from 'fs';
import {join, basename, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

// Components that intentionally don't need stories
const EXCLUDED = new Set([
  'CardPreviewProvider.tsx', // context provider, not visual
  'CardPreviewPopover.tsx', // rendered by context, not standalone
  'ErrorBoundary.tsx', // error boundaries need runtime errors to demo
  'SearchIcon.tsx', // tiny SVG icon
  'FilterIcon.tsx', // tiny SVG icon
  'CostIcon.tsx', // tiny SVG icon
  'InkIcon.tsx', // tiny SVG icon
  'EtherealBackground.tsx', // canvas animation, no props
  'RenderProfiler.tsx', // performance utility wrapper, not visual
]);

// Pre-existing components without stories (tracked debt — remove as stories are added)
const KNOWN_MISSING = new Set([
  '/src/features/cards/components/BrowseCardGrid.tsx',
  '/src/features/cards/components/CardList.tsx',
  '/src/features/cards/components/FeaturedCards.tsx',
  '/src/features/synergies/components/CardDetailPanel.tsx',
  '/src/features/synergies/components/ExpandedGroupView.tsx',
  '/src/features/synergies/components/MobileCardDetail.tsx',
  '/src/features/synergies/components/SynergyDetailModal.tsx',
  '/src/features/synergies/components/SynergyResults.tsx',
  '/src/shared/components/SearchBottomSheet.tsx',
]);

function findComponents(dir) {
  const components = [];
  if (!existsSync(dir)) return components;

  for (const file of readdirSync(dir)) {
    if (
      file.endsWith('.tsx') &&
      !file.endsWith('.stories.tsx') &&
      !file.endsWith('.test.tsx') &&
      !file.startsWith('__')
    ) {
      components.push(join(dir, file));
    }
  }
  return components;
}

function getComponentDirs() {
  const dirs = [join(srcDir, 'shared', 'components')];

  const featuresDir = join(srcDir, 'features');
  if (existsSync(featuresDir)) {
    for (const feature of readdirSync(featuresDir)) {
      const compDir = join(featuresDir, feature, 'components');
      if (existsSync(compDir)) dirs.push(compDir);
    }
  }
  return dirs;
}

const dirs = getComponentDirs();
const missing = [];
const knownStillMissing = [];
const knownNowCovered = [];

for (const dir of dirs) {
  for (const compPath of findComponents(dir)) {
    const file = basename(compPath);
    if (EXCLUDED.has(file)) continue;

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
