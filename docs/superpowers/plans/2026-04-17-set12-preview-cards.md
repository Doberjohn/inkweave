# Set 12 Preview Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a two-source card data pipeline (`allCards.json` + `previewCards.json`) and a dedicated `/reveals` page for Set 12 preview cards, with per-franchise filtering and synergy-aware linking.

**Architecture:** Single-track data model. Both JSON files live in `apps/web/public/data/` and merge at three points: (1) `fetchCardsFromLocal()` at runtime, (2) `precompute-synergies.mjs` at build time, (3) `download-card-images.mjs` at build time. Deduplication by card id — `allCards.json` wins on conflict for safe graduation. `/reveals` is a dedicated page, not a filtered browse view. Preview cards flow through the standard engine and appear in browse/search as normal; the reveals page adds set-themed branding and franchise filters.

**Tech Stack:** React 19, TypeScript 5, Vite 7, Vitest, Playwright, pnpm workspaces. Cards ship as static JSON + precomputed synergies under `apps/web/public/data/`.

**Spec:** [`docs/superpowers/specs/2026-04-17-set12-preview-cards-design.md`](../specs/2026-04-17-set12-preview-cards-design.md)
**Issue:** [#278](https://github.com/Doberjohn/inkweave/issues/278)

---

## File Map

### Created
| Path | Responsibility |
|------|----------------|
| `apps/web/public/data/previewCards.json` | Preview card data in LorcanaJSON format. Seeded with a real Set 12 card. |
| `apps/web/src/pages/RevealsPage.tsx` | Reveals page component: set header, franchise filters, card grid, empty state. |
| `apps/web/src/pages/RevealsPage.stories.tsx` | Storybook stories (required by `check:stories` CI). |
| `apps/web/src/features/reveals/useManifest.ts` | Hook to fetch `_manifest.json` for synergy-aware linking. |
| `apps/web/src/features/reveals/index.ts` | Public exports of the reveals feature. |
| `apps/web/e2e/tests/reveals.spec.ts` | E2E: `/reveals` loads, filters work, clickable cards navigate. |

### Modified
| Path | Change |
|------|--------|
| `packages/synergy-engine/src/types/card.ts` | Add optional `franchise?: string` to `LorcanaCard`. |
| `packages/synergy-engine/src/utils/cardTransformer.ts` | Add `franchise?: string` to `LorcanaJSONCard`; pass through in `transformCard`. |
| `apps/web/src/features/cards/loader.ts` | `fetchCardsFromLocal()` merges `previewCards.json` with graceful 404. |
| `apps/web/src/features/cards/__tests__/loader.test.ts` | Tests for merge behavior, dedup, missing file handling. |
| `scripts/precompute-synergies.mjs` | Load both JSON files, dedupe by id, transform together. |
| `scripts/download-card-images.mjs` | Iterate cards from both files when building task list. |
| `apps/web/src/router.tsx` | Add `/reveals` route, lazy-loaded. |
| `apps/web/src/shared/components/CompactHeader.tsx` | Add "Reveals" entry to `NAV_ITEMS`. |
| `apps/web/src/shared/components/MobileBottomNav.tsx` | Add third tab for Reveals. |
| `apps/web/e2e/E2E_TESTS.md` | Document the new `reveals.spec.ts` tests. |

---

## Task Sequencing Rationale

Implementation goes **types first, data layer second, UI third**, because types flow through everything below. The `franchise` field must be threaded through the engine before we can seed a card that uses it or render a reveals page that filters on it. Within the data layer, the runtime loader is more critical than the build scripts (broken scripts just mean stale data; a broken loader breaks the app). Within the UI, the manifest hook and the page body are built before nav changes so we can test the page in isolation.

**Order:**
1. Task 1 — Thread `franchise` field through engine types (enables tasks 2 and 7)
2. Task 2 — Seed `previewCards.json` with the first real Set 12 card (enables every subsequent test)
3. Task 3 — Loader merge logic (runtime; affects every page)
4. Task 4 — Precompute script merge (build-time; enables synergies on preview cards)
5. Task 5 — Image download script merge (build-time; enables images on preview cards)
6. Task 6 — Manifest hook (shared utility for reveals page)
7. Task 7 — Reveals page body (empty state, header, grid, franchise filter)
8. Task 8 — Storybook stories for the reveals page
9. Task 9 — Router wiring for `/reveals`
10. Task 10 — Navigation updates (desktop + mobile)
11. Task 11 — E2E test
12. Task 12 — Full build verification + manual smoke test

Tasks 1-5 must run serially (later tasks assume earlier data-layer changes are in). Tasks 6-10 have lighter dependencies but are easier to review sequentially.

---

## Task 1: Thread `franchise` field through engine types

**Why**: Set 12 introduces three Pixar franchises (Toy Story, The Incredibles, Brave). Relying on `classifications` to tell them apart is fragile — "Hero" and "Princess" already exist on many non-Pixar cards (Mickey, Anna, etc.), which would produce false positives. The preview card data includes an explicit `franchise: "Toy Story"` field at the top level; we need to thread it through the engine types so the reveals page can filter on `card.franchise` directly.

The field is optional everywhere — main-pool cards don't have it, preview cards do.

**Files:**
- Modify: `packages/synergy-engine/src/types/card.ts`
- Modify: `packages/synergy-engine/src/utils/cardTransformer.ts`

- [ ] **Step 1: Add `franchise?: string` to `LorcanaCard`**

In `packages/synergy-engine/src/types/card.ts`, at line 32 (after `setNumber?: number;`), add `franchise?: string;`:

```typescript
// Core card interface (based on LorcanaJSON structure)
export interface LorcanaCard {
  id: string;
  name: string;
  version?: string;
  fullName: string;
  cost: number;
  ink: Ink;
  ink2?: Ink;
  inkwell: boolean;
  type: CardType;
  classifications?: string[];
  text?: string;
  textSections?: string[];
  strength?: number;
  willpower?: number;
  lore?: number;
  keywords?: string[];
  isSong?: boolean;
  moveCost?: number;
  imageUrl?: string;
  setCode?: string;
  setNumber?: number;
  /** Franchise/IP label for preview cards (e.g., "Toy Story"). Set only on cards from previewCards.json. */
  franchise?: string;
}
```

- [ ] **Step 2: Add `franchise?: string` to `LorcanaJSONCard`**

In `packages/synergy-engine/src/utils/cardTransformer.ts`, at line 39 (after `rarity?: string;`), add the field:

```typescript
export interface LorcanaJSONCard {
  id: number;
  name: string;
  version?: string;
  fullName: string;
  simpleName: string;
  cost: number;
  color: string;
  inkwell: boolean;
  type: string;
  subtypes?: string[];
  abilities?: Array<{
    fullText: string;
    type: string;
    keyword?: string;
    keywordValue?: string;
    name?: string;
    effect?: string;
  }>;
  fullText?: string;
  fullTextSections?: string[];
  moveCost?: number;
  strength?: number;
  willpower?: number;
  lore?: number;
  keywordAbilities?: string[];
  images?: {
    full?: string;
    thumbnail?: string;
  };
  setCode?: string;
  number?: number;
  rarity?: string;
  /** Franchise/IP label — Set 12+ preview cards only. */
  franchise?: string;
}
```

Note: `simpleName: string` is declared as required in the interface but is not present in any actual card data (verified: 0 of 1429 cards have it). The field is never read by the transformer. Leave the declaration untouched — changing it is outside this task's scope — but do NOT include `simpleName` in any new card data.

- [ ] **Step 3: Pass `franchise` through in `transformCard`**

In `packages/synergy-engine/src/utils/cardTransformer.ts`, in the `transformCard` function (lines 76-128), find the return statement and add `franchise: raw.franchise,` after `setNumber: raw.number,`:

```typescript
  return {
    id: String(raw.id),
    name: raw.name,
    version: raw.version,
    fullName: raw.fullName,
    cost: raw.cost,
    ink: inks.ink,
    ink2: inks.ink2,
    inkwell: raw.inkwell,
    type,
    isSong: isSong || undefined,
    classifications: classifications.length > 0 ? classifications : undefined,
    text: raw.fullText,
    textSections: nonEmptySections(raw.fullTextSections),
    moveCost: raw.moveCost,
    strength: raw.strength,
    willpower: raw.willpower,
    lore: raw.lore,
    keywords: keywords.length > 0 ? keywords : undefined,
    setCode: raw.setCode,
    setNumber: raw.number,
    franchise: raw.franchise,
  };
```

- [ ] **Step 4: Rebuild the engine and run engine tests**

Run: `pnpm build:engine`

Expected: Build succeeds, no TypeScript errors.

Run: `pnpm --filter inkweave-synergy-engine test:run`

Expected: All 195 tests pass. No behavior change — `franchise` is purely additive.

- [ ] **Step 5: Run web unit tests to confirm nothing downstream breaks**

Run: `pnpm --filter inkweave-web test:run`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/synergy-engine/src/types/card.ts packages/synergy-engine/src/utils/cardTransformer.ts
USER_APPROVED=1 git commit -m "feat(engine): add optional franchise field to card types (#278)"
```

---

## Task 2: Seed `previewCards.json` with the first Set 12 card

**Why**: Creates the preview card file with real data — the Woody - Jungle Guide reveal. Everything downstream (loader merge, precompute, reveals page) can now be exercised against a real card instead of a placeholder. The card shape follows the LorcanaJSON format used in `allCards.json`, with the Shift keyword ability in the form the transformer expects (`keyword` + `keywordValue` rather than `name: "Shift 3"`).

**Files:**
- Create: `apps/web/public/data/previewCards.json`

- [ ] **Step 1: Create the preview file with the first revealed card**

Create `apps/web/public/data/previewCards.json` with this exact content:

```json
{
  "metadata": {
    "formatVersion": "2.3.2",
    "generatedOn": "2026-04-17T00:00:00",
    "language": "en"
  },
  "sets": {
    "12": {
      "name": "The Wilds Unknown",
      "number": 12,
      "type": "expansion",
      "releaseDate": "2026-08-01",
      "hasAllCards": false,
      "allowedInFormats": {
        "Core": {"allowed": true, "rotationGroup": 2}
      }
    }
  },
  "cards": [
    {
      "id": 1215204,
      "name": "Woody",
      "version": "Jungle Guide",
      "fullName": "Woody - Jungle Guide",
      "cost": 5,
      "color": "Amber",
      "inkwell": false,
      "type": "Character",
      "subtypes": ["Floodborn", "Hero", "Toy"],
      "fullText": "Shift 3 (You may pay 3 ⬡ to play this on top of one of your characters named Woody.) LET'S GET MOVIN' Whenever this character quests, draw a card. Then, you may play a character with cost 2 or less for free. EVERYONE GATHER 'ROUND Your other Toy characters get +1 ⛉.",
      "fullTextSections": [
        "Shift 3 (You may pay 3 ⬡ to play this on top of one of your characters named Woody.)",
        "LET'S GET MOVIN' Whenever this character quests, draw a card. Then, you may play a character with cost 2 or less for free.",
        "EVERYONE GATHER 'ROUND Your other Toy characters get +1 ⛉."
      ],
      "strength": 1,
      "willpower": 5,
      "lore": 2,
      "abilities": [
        {
          "fullText": "Shift 3 (You may pay 3 ⬡ to play this on top of one of your characters named Woody.)",
          "keyword": "Shift",
          "keywordValue": "3",
          "keywordValueNumber": 3,
          "reminderText": "You may pay 3 ⬡ to play this on top of one of your characters named Woody.",
          "type": "keyword"
        },
        {
          "effect": "Whenever this character quests, draw a card. Then, you may play a character with cost 2 or less for free.",
          "fullText": "LET'S GET MOVIN' Whenever this character quests, draw a card. Then, you may play a character with cost 2 or less for free.",
          "name": "LET'S GET MOVIN'",
          "type": "triggered"
        },
        {
          "effect": "Your other Toy characters get +1 ⛉.",
          "fullText": "EVERYONE GATHER 'ROUND Your other Toy characters get +1 ⛉.",
          "name": "EVERYONE GATHER 'ROUND",
          "type": "static"
        }
      ],
      "setCode": "12",
      "number": 15,
      "rarity": "Legendary",
      "franchise": "Toy Story",
      "images": {
        "thumbnail": "https://lorcanaplayer.com/wp-content/uploads/2026/04/15-204-EN-12-Woody-Jungle-Guide-Lorcana-Player-430x600.jpg.webp",
        "full": "https://lorcanaplayer.com/wp-content/uploads/2026/04/15-204-EN-12-Woody-Jungle-Guide-Lorcana-Player.jpg"
      }
    }
  ]
}
```

- [ ] **Step 2: Verify the file parses**

Run:

```bash
node -e "const d=require('fs').readFileSync('apps/web/public/data/previewCards.json','utf8'); const j=JSON.parse(d); console.log('cards:', j.cards.length); console.log('first card:', j.cards[0].fullName, '/', j.cards[0].franchise);"
```

Expected output:
```
cards: 1
first card: Woody - Jungle Guide / Toy Story
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/data/previewCards.json
USER_APPROVED=1 git commit -m "feat(data): seed previewCards.json with Woody - Jungle Guide (#278)"
```

---

## Task 3: Loader merge logic

**Why**: Every page that reads cards (browse, card detail, synergies, home, and the new reveals page) goes through `fetchCardsFromLocal()`. Making the merge happen at the loader means no consumer needs to know the file split exists.

**Files:**
- Modify: `apps/web/src/features/cards/loader.ts`
- Modify: `apps/web/src/features/cards/__tests__/loader.test.ts`

### Step-by-step

- [ ] **Step 1: Write failing tests for `fetchCardsFromLocal` merge behavior**

Add these tests to `apps/web/src/features/cards/__tests__/loader.test.ts` inside the existing `describe('fetchCardsFromLocal', ...)` block:

```typescript
it('should merge previewCards.json when present', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(makeJsonData({id: 1, name: 'MainCard', fullName: 'Main Card'})),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(makeJsonData({id: 2, name: 'PreviewCard', fullName: 'Preview Card'})),
    });

  const result = await fetchCardsFromLocal();

  expect(mockFetch).toHaveBeenCalledWith('/data/allCards.json');
  expect(mockFetch).toHaveBeenCalledWith('/data/previewCards.json');
  expect(result.cards).toHaveLength(2);
  expect(result.cards.map((c) => c.fullName).sort()).toEqual(['Main Card', 'Preview Card']);
});

it('should gracefully handle missing previewCards.json (404)', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeJsonData({id: 1, name: 'Only', fullName: 'Only Card'})),
    })
    .mockResolvedValueOnce({ok: false, status: 404});

  const result = await fetchCardsFromLocal();

  expect(result.cards).toHaveLength(1);
  expect(result.cards[0].fullName).toBe('Only Card');
});

it('should handle empty previewCards.json cards array', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeJsonData({id: 1, name: 'Main', fullName: 'Main Card'})),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
          sets: {},
          cards: [],
        }),
    });

  const result = await fetchCardsFromLocal();
  expect(result.cards).toHaveLength(1);
});

it('should dedupe by card id (allCards.json wins)', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(makeJsonData({id: 1, name: 'Canonical', fullName: 'Canonical Card'})),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(makeJsonData({id: 1, name: 'Preview', fullName: 'Stale Preview'})),
    });

  const result = await fetchCardsFromLocal();
  expect(result.cards).toHaveLength(1);
  expect(result.cards[0].fullName).toBe('Canonical Card');
});

it('should merge sets from both files', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
          sets: {'11': {name: 'Reign of Jafar', number: 11, type: 'expansion'}},
          cards: [],
        }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          metadata: {formatVersion: '1.0', generatedOn: '2026-04-17', language: 'en'},
          sets: {'12': {name: 'The Wilds Unknown', number: 12, type: 'expansion'}},
          cards: [],
        }),
    });

  const result = await fetchCardsFromLocal();
  expect(result.sets.map((s) => s.code).sort()).toEqual(['11', '12']);
});
```

Also update the first existing test to reflect the new two-fetch behavior. Find the test starting with `it('should fetch and parse cards from local JSON', ...)` and change it to:

```typescript
it('should fetch and parse cards from local JSON (single file, legacy path)', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeJsonData({})),
    })
    .mockResolvedValueOnce({ok: false, status: 404});

  const result = await fetchCardsFromLocal('/data/test.json');
  expect(mockFetch).toHaveBeenCalledWith('/data/test.json');
  expect(result.cards).toHaveLength(1);
  expect(result.sets).toEqual([]);
});
```

Find the existing "should throw error when fetch fails" test and change it so the 404 applies to the primary (allCards) fetch only:

```typescript
it('should throw error when primary fetch fails', async () => {
  mockFetch.mockResolvedValueOnce({ok: false, status: 404});
  await expect(fetchCardsFromLocal('/data/missing.json')).rejects.toThrow(
    'Failed to fetch local cards: 404',
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter inkweave-web test:run -- loader.test`

Expected: Multiple failures. The new merge tests should fail because `fetchCardsFromLocal` doesn't know about `previewCards.json` yet. The old tests should also fail because they expect a single `fetch` call.

- [ ] **Step 3: Implement the merge in loader.ts**

In `apps/web/src/features/cards/loader.ts`, replace the existing `fetchCardsFromLocal` function (lines 122-145) with this implementation:

```typescript
const PREVIEW_PATH = '/data/previewCards.json';

/**
 * Fetch cards from a local file, merged with optional preview cards.
 * Preview cards are loaded from /data/previewCards.json if present (graceful 404).
 * Deduplication: allCards.json wins on id conflict.
 */
export async function fetchCardsFromLocal(
  path: string = '/data/allCards.json',
): Promise<CardDataResult> {
  const primaryResponse = await fetch(path);

  if (!primaryResponse.ok) {
    throw new Error(`Failed to fetch local cards: ${primaryResponse.status}`);
  }

  let primary: LorcanaJSONData;
  try {
    primary = await primaryResponse.json();
  } catch (parseError) {
    throw new Error(
      `Failed to parse card data: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`,
      {cause: parseError},
    );
  }

  const previewResponse = await fetch(PREVIEW_PATH);
  let preview: LorcanaJSONData | null = null;
  if (previewResponse.ok) {
    try {
      preview = await previewResponse.json();
    } catch {
      preview = null;
    }
  }

  const primaryIds = new Set(primary.cards.map((c) => c.id));
  const previewCards = preview?.cards.filter((c) => !primaryIds.has(c.id)) ?? [];
  const mergedCards = [...primary.cards, ...previewCards];

  const mergedSets: Record<string, LorcanaJSONSet> = {
    ...(primary.sets ?? {}),
    ...(preview?.sets ?? {}),
  };

  const merged: LorcanaJSONData = {
    metadata: primary.metadata,
    sets: mergedSets,
    cards: mergedCards,
  };

  return {
    cards: loadCardsFromJSON(merged),
    sets: loadSetsFromJSON(merged),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web test:run -- loader.test`

Expected: All tests pass, including the new merge tests.

- [ ] **Step 5: Run full web test suite to catch regressions**

Run: `pnpm --filter inkweave-web test:run`

Expected: All tests pass. If any other tests mock `fetch` for `fetchCardsFromLocal`, they may need to add a second `.mockResolvedValueOnce({ok: false, status: 404})` call to simulate missing preview data. Fix any regressions inline by adding this extra 404 mock.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/cards/loader.ts apps/web/src/features/cards/__tests__/loader.test.ts
USER_APPROVED=1 git commit -m "feat(loader): merge previewCards.json into card data (#278)"
```

---

## Task 4: Precompute script merge

**Why**: At build time, the engine must see all cards (main + preview) in a single pool so synergies compute correctly across them. Without this, preview cards would have zero synergies.

**Files:**
- Modify: `scripts/precompute-synergies.mjs`

- [ ] **Step 1: Modify the script to load both JSON files**

In `scripts/precompute-synergies.mjs`, replace the `DATA_FILE` constant and the data-loading section (lines 23 and 41-47) with this:

Change line 23 from:
```javascript
const DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
```
to:
```javascript
const MAIN_DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
```

Then change lines 41-47 (the `Load and transform card data` block) from:
```javascript
  // Load and transform card data using the engine's shared transformer
  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const rawCount = rawData.cards.length;
  const cards = transformCards(rawData.cards);
  console.log(`  ${cards.length}/${rawCount} cards loaded`);
  if (cards.length < rawCount) {
    console.warn(`  ⚠ ${rawCount - cards.length} cards skipped (invalid ink/type)`);
  }
```
to:
```javascript
  // Load and transform card data (main + optional preview) using the engine's shared transformer
  const mainData = JSON.parse(fs.readFileSync(MAIN_DATA_FILE, 'utf-8'));
  const mainIds = new Set(mainData.cards.map((c) => c.id));

  let previewCount = 0;
  let mergedRaw = mainData.cards;
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf-8'));
    // Dedup: main wins on id conflict
    const previewFiltered = previewData.cards.filter((c) => !mainIds.has(c.id));
    previewCount = previewFiltered.length;
    mergedRaw = [...mainData.cards, ...previewFiltered];
  }

  const rawCount = mergedRaw.length;
  const cards = transformCards(mergedRaw);
  console.log(
    `  ${cards.length}/${rawCount} cards loaded` +
      (previewCount > 0 ? ` (${previewCount} from previewCards.json)` : ''),
  );
  if (cards.length < rawCount) {
    console.warn(`  ⚠ ${rawCount - cards.length} cards skipped (invalid ink/type)`);
  }
```

- [ ] **Step 2: Run the precompute script to verify the merge works**

Run: `pnpm build:engine && node scripts/precompute-synergies.mjs`

Expected output includes: `1430/1430 cards loaded (1 from previewCards.json)`. A synergy file for Woody (`1215204.json`) should appear in `apps/web/public/data/synergies/` and the card id should be in `_manifest.json`.

- [ ] **Step 3: Verify Woody has computed synergies**

Run:
```bash
node -e "const m=JSON.parse(require('fs').readFileSync('apps/web/public/data/synergies/_manifest.json','utf8')); console.log('Woody in manifest:', m.includes('1215204'));"
```

Expected: `Woody in manifest: true` (Rule 1 Shift Targets should pair Woody with any existing Woody cards in `allCards.json`).

- [ ] **Step 4: Commit**

```bash
git add scripts/precompute-synergies.mjs
USER_APPROVED=1 git commit -m "feat(scripts): merge previewCards.json in precompute-synergies (#278)"
```

---

## Task 5: Image download script merge

**Why**: When a preview card gets added with an image URL, the build pipeline must download and resize it like any other card.

**Files:**
- Modify: `scripts/download-card-images.mjs`

- [ ] **Step 1: Modify the script to read both JSON files**

In `scripts/download-card-images.mjs`, find the section `// Build task list` around lines 110-116:

```javascript
  // Build task list — one image per card (use full-size source for best quality when resizing)
  const tasks = [];
  for (const card of data.cards) {
    const url = card.images?.full ?? card.images?.thumbnail;
    if (url) {
      tasks.push({id: card.id, url});
    }
  }
```

Replace it with:

```javascript
  // Build task list — one image per card (main + optional preview cards)
  const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
  const allCards = [...data.cards];
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf8'));
    const mainIds = new Set(data.cards.map((c) => c.id));
    for (const card of previewData.cards) {
      if (!mainIds.has(card.id)) allCards.push(card);
    }
  }

  const tasks = [];
  for (const card of allCards) {
    const url = card.images?.full ?? card.images?.thumbnail;
    if (url) {
      tasks.push({id: card.id, url});
    }
  }
```

Also update the log line immediately after (currently `${tasks.length} images (${data.cards.length} cards)`) to use `allCards.length`:

Find:
```javascript
  console.log(
    `\n  ${tasks.length} images (${data.cards.length} cards)${FORCE ? ' [force re-download]' : ''}`,
  );
```

Replace with:
```javascript
  console.log(
    `\n  ${tasks.length} images (${allCards.length} cards)${FORCE ? ' [force re-download]' : ''}`,
  );
```

- [ ] **Step 2: Run the image download script to verify no regression**

Run: `node scripts/download-card-images.mjs`

Expected: Card count now shows `(1430 cards)` (1429 existing + 1 Woody). Existing 1429 cards are cached. The Woody card has non-empty image URLs, so the script will attempt to download and resize them — this may succeed or fail depending on network reachability of `lorcanaplayer.com`. If it fails, note the failure but do not block the task; the reveals page tolerates missing images (shows a fallback). Script completes without a non-zero exit code.

- [ ] **Step 3: Commit**

```bash
git add scripts/download-card-images.mjs
USER_APPROVED=1 git commit -m "feat(scripts): merge previewCards.json in download-card-images (#278)"
```

---

## Task 5.5: Preview-AVIF override for cards with unreachable source URLs

**Why**: Some preview card sources (e.g., `lorcanaplayer.com` for Woody) return HTTP 403 to Node fetches (user-agent / hotlinking protection). Rather than fight each CDN, we pre-generate AVIFs locally from a manually downloaded source JPG, commit them to a tracked `card-images-preview/` folder, and teach the download script to use those instead of attempting the URL fetch.

**Files:**
- Modify: `scripts/download-card-images.mjs` (add preview-AVIF override logic)
- Already present in working tree (from a manual conversion pass):
  - `apps/web/public/card-images-preview/1215204.avif` (27 KB, 337×470 Woody)
  - `apps/web/public/card-images-preview/1215204-sm.avif` (12 KB, 191×266 Woody)
  - `.gitignore` — added entry for `apps/web/public/card-images-raw/` (scratch folder)

- [ ] **Step 1: Modify the download script to skip URL fetch when preview AVIFs exist**

In `scripts/download-card-images.mjs`, find the `Build task list` section (after `fs.mkdirSync(OUTPUT_DIR, {recursive: true})` around line 107). Insert a helper to detect pre-generated AVIFs and change the task-list builder to skip them while copying them to the output dir:

```javascript
  // Preview AVIFs for cards whose source URLs are unreachable at build time
  // (e.g., hotlink-protected CDNs returning 403 to Node fetches).
  const PREVIEW_AVIFS_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');
  const hasPreviewAvifs = (id) => {
    if (!fs.existsSync(PREVIEW_AVIFS_DIR)) return false;
    return SIZES.every((s) =>
      fs.existsSync(path.join(PREVIEW_AVIFS_DIR, `${id}${s.suffix}.avif`)),
    );
  };
  let previewCopied = 0;

  // Build task list — main + optional preview cards, skipping cards that already
  // have pre-generated AVIFs in card-images-preview/
  const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');
  const allCards = [...data.cards];
  if (fs.existsSync(PREVIEW_DATA_FILE)) {
    const previewData = JSON.parse(fs.readFileSync(PREVIEW_DATA_FILE, 'utf8'));
    const mainIds = new Set(data.cards.map((c) => c.id));
    for (const card of previewData.cards) {
      if (!mainIds.has(card.id)) allCards.push(card);
    }
  }

  const tasks = [];
  for (const card of allCards) {
    if (hasPreviewAvifs(card.id)) {
      for (const size of SIZES) {
        const file = `${card.id}${size.suffix}.avif`;
        fs.copyFileSync(
          path.join(PREVIEW_AVIFS_DIR, file),
          path.join(OUTPUT_DIR, file),
        );
      }
      previewCopied++;
      continue;
    }
    const url = card.images?.full ?? card.images?.thumbnail;
    if (url) {
      tasks.push({id: card.id, url});
    }
  }
```

Important: this REPLACES the existing block from Task 5 that reads `PREVIEW_DATA_FILE` and builds the task list. Remove the previous version entirely — don't leave two overlapping versions. Verify by running the script and confirming the card counts are consistent.

Then update the summary log immediately after:

```javascript
  console.log(
    `\n  ${tasks.length} images (${allCards.length} cards, ${previewCopied} from preview AVIFs)${FORCE ? ' [force re-download]' : ''}`,
  );
```

- [ ] **Step 2: Run the image download script**

Run: `node scripts/download-card-images.mjs`

Expected:
- Log line: `<N> images (1430 cards, 1 from preview AVIFs)` where N is 1429 (1430 total minus Woody).
- Final summary should NOT show a 403 failure for id 1215204. The two pre-existing unrelated failures (ids `1536`, `2632` with 404 from Ravensburger) may still appear — they're unrelated to this task.

- [ ] **Step 3: Verify Woody's AVIFs landed in output**

Run: `ls apps/web/public/card-images/1215204*`

Expected: two files — `1215204.avif` and `1215204-sm.avif`.

- [ ] **Step 4: Commit script + preview AVIFs + gitignore**

```
git add scripts/download-card-images.mjs apps/web/public/card-images-preview/ .gitignore
```
Then on a separate command:
```
USER_APPROVED=1 git commit -m "feat(images): support preview AVIFs for unreachable source URLs (#278)"
```

Use `git -C "D:/johnn/Projects/inkweave" ...` patterns to avoid `cd &&` chain issues with the git-write-protection hook. Use `timeout: 600000` for git commit (pre-commit runs lint + tests).

---

## Task 5.75: Batch helper + convert 98 Set 12 preview images

**Why**: Manual `sharp` one-offs don't scale past a couple cards. This task introduces a reusable helper (`scripts/convert-preview-images.mjs`) and uses it to process the 98 raw JPGs already sitting in `apps/web/public/card-images-raw/` (gitignored scratch folder). Output is 196 AVIF files (full + small variants × 98 cards) committed to `apps/web/public/card-images-preview/`. The corresponding card JSON arrives later — the AVIFs are orphan-tolerant and will be picked up automatically once those card entries exist in `previewCards.json`.

**Files:**
- Create: `scripts/convert-preview-images.mjs`
- Modify: `package.json` (root) — add `convert-preview-images` npm script
- Staged (by the script execution): 196 AVIF files under `apps/web/public/card-images-preview/`

**Working tree precondition**: 98 raw JPGs exist under `apps/web/public/card-images-raw/`, named by card id (e.g., `1215204.jpg`, `12115204.jpg`, `1210204.jpg`). The folder is gitignored.

- [ ] **Step 1: Write the helper script**

Create `scripts/convert-preview-images.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Convert raw preview card images to AVIF variants.
 *
 * Reads files from apps/web/public/card-images-raw/ named by card id
 * (e.g., 1215204.jpg). For each file, generates two AVIFs into
 * apps/web/public/card-images-preview/:
 *   {id}.avif      — 337x470 (grid / detail)
 *   {id}-sm.avif   — 191x266 (browse grid tiles)
 *
 * Idempotent — skips cards whose AVIFs already exist unless --force.
 *
 * Usage:
 *   pnpm convert-preview-images           # Convert all missing
 *   pnpm convert-preview-images --force   # Re-convert everything
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RAW_DIR = path.join(ROOT, 'apps/web/public/card-images-raw');
const OUT_DIR = path.join(ROOT, 'apps/web/public/card-images-preview');
const FORCE = process.argv.includes('--force');

const SIZES = [
  {suffix: '', width: 337, height: 470},
  {suffix: '-sm', width: 191, height: 266},
];
const QUALITY = 50;
const ACCEPTED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function convert(id, srcPath) {
  for (const s of SIZES) {
    const outPath = path.join(OUT_DIR, `${id}${s.suffix}.avif`);
    await sharp(srcPath)
      .resize(s.width, s.height, {fit: 'cover'})
      .avif({quality: QUALITY})
      .toFile(outPath);
  }
}

function allVariantsExist(id) {
  return SIZES.every((s) => fs.existsSync(path.join(OUT_DIR, `${id}${s.suffix}.avif`)));
}

async function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.log(`  No raw directory at ${RAW_DIR}. Nothing to do.`);
    return;
  }
  fs.mkdirSync(OUT_DIR, {recursive: true});

  const files = fs.readdirSync(RAW_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ACCEPTED_EXT.has(ext);
  });

  if (files.length === 0) {
    console.log(`  No image files in ${RAW_DIR}. Nothing to do.`);
    return;
  }

  console.log(`\n  Converting ${files.length} raw image(s)${FORCE ? ' [force]' : ''}`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const file of files) {
    const stem = path.basename(file, path.extname(file));
    if (!/^\d+$/.test(stem)) {
      console.error(`  x ${file}: filename stem must be numeric card id (got "${stem}")`);
      failed++;
      continue;
    }
    const id = stem;

    if (!FORCE && allVariantsExist(id)) {
      skipped++;
      continue;
    }

    try {
      await convert(id, path.join(RAW_DIR, file));
      converted++;
    } catch (err) {
      console.error(`  x ${file}: ${err.message}`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n  Done in ${elapsed}s: ${converted} converted, ${skipped} skipped (exists), ${failed} failed\n`,
  );

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script alias**

In root `package.json`, in the `scripts` section, add:

```json
"convert-preview-images": "node scripts/convert-preview-images.mjs",
```

Put it near related image/data scripts (e.g., after `download-images` if present, otherwise alphabetically). Do NOT change any other scripts.

- [ ] **Step 3: Run the helper against the 98 raws**

Run: `pnpm convert-preview-images`

Expected output:
```
  Converting 98 raw image(s)

  Done in Ns: 97 converted, 1 skipped (exists), 0 failed
```
(The "1 skipped" is Woody — `1215204.avif` was generated in Task 5.5 and is already present.)

If any `failed` count is non-zero, investigate — the filename pattern `{id}.ext` must be strict. Report back before continuing.

- [ ] **Step 4: Verify output**

Run:
```
ls apps/web/public/card-images-preview/ | wc -l
```

Expected: 196 files (98 cards × 2 variants), or if Woody was pre-existing, 196 (since Task 5.5 wrote 2 for Woody, and this step wrote 194 for the other 97 cards).

Run a spot check on file sizes:
```
du -sh apps/web/public/card-images-preview/
```

Expected: roughly 3.5–4.5 MB total.

- [ ] **Step 5: Commit**

```
git add scripts/convert-preview-images.mjs package.json apps/web/public/card-images-preview/
```
Then on a separate command:
```
USER_APPROVED=1 git -C "D:/johnn/Projects/inkweave" commit -m "feat(images): add batch AVIF helper + 97 Set 12 preview AVIFs (#278)"
```

Use `timeout: 600000` for the commit (pre-commit hook runs lint + full test suite).

Commit message notes "97" rather than "98" because Woody's AVIFs were already committed in Task 5.5 — this commit adds the other 97 plus the helper script.

---

## Task 6: Manifest hook

**Why**: The reveals page needs to know which cards have precomputed synergies to render them as clickable links. `_manifest.json` already exists (written by `precompute-synergies.mjs:132`); we need a React hook to fetch and cache it.

**Files:**
- Create: `apps/web/src/features/reveals/useManifest.ts`
- Create: `apps/web/src/features/reveals/index.ts`
- Create: `apps/web/src/features/reveals/__tests__/useManifest.test.ts`

- [ ] **Step 1: Write failing test for the hook**

Create `apps/web/src/features/reveals/__tests__/useManifest.test.ts`:

```typescript
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, waitFor} from '@testing-library/react';
import {useManifest, _resetManifestCache} from '../useManifest';

describe('useManifest', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    _resetManifestCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch.mockReset();
  });

  it('should fetch manifest and expose hasSynergies predicate', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({'content-type': 'application/json'}),
      json: () => Promise.resolve(['123', '456', '789']),
    });

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(true);
    expect(result.current.hasSynergies('999')).toBe(false);
  });

  it('should return hasSynergies: false for all cards when fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({ok: false, status: 404});

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(false);
    expect(result.current.error).not.toBeNull();
  });

  it('should guard against SPA fallback (HTML content-type)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({'content-type': 'text/html'}),
      json: () => Promise.resolve('<html>...</html>'),
    });

    const {result} = renderHook(() => useManifest());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasSynergies('123')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter inkweave-web test:run -- useManifest`

Expected: `Error: Failed to resolve import "../useManifest"` — file doesn't exist yet.

- [ ] **Step 3: Implement the hook**

Create `apps/web/src/features/reveals/useManifest.ts`:

```typescript
import {useState, useEffect} from 'react';

let manifestCache: Set<string> | null = null;
let manifestPromise: Promise<Set<string>> | null = null;

async function fetchManifest(): Promise<Set<string>> {
  if (manifestCache) return manifestCache;
  if (manifestPromise) return manifestPromise;

  manifestPromise = (async () => {
    const response = await fetch('/data/synergies/_manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error('Manifest data unavailable (received HTML instead of JSON)');
    }
    const ids: string[] = await response.json();
    manifestCache = new Set(ids);
    return manifestCache;
  })();

  return manifestPromise;
}

/** @internal reset for testing */
export function _resetManifestCache(): void {
  manifestCache = null;
  manifestPromise = null;
}

export interface UseManifestReturn {
  hasSynergies: (cardId: string) => boolean;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetches the synergy manifest (list of card IDs with precomputed synergy files).
 * Used by the reveals page to decide if a card tile is clickable.
 */
export function useManifest(): UseManifestReturn {
  const [manifest, setManifest] = useState<Set<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchManifest()
      .then((data) => {
        if (cancelled) return;
        setManifest(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    hasSynergies: (cardId: string) => manifest?.has(cardId) ?? false,
    isLoading,
    error,
  };
}
```

- [ ] **Step 4: Create the feature index**

Create `apps/web/src/features/reveals/index.ts`:

```typescript
export {useManifest} from './useManifest';
export type {UseManifestReturn} from './useManifest';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web test:run -- useManifest`

Expected: All 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/reveals/
USER_APPROVED=1 git commit -m "feat(reveals): add useManifest hook for synergy-aware linking (#278)"
```

---

## Task 7: Reveals page body

**Why**: This is the user-visible deliverable. Set header, three franchise filter chips, card grid filtered by `setCode === '12'`, empty state when no cards revealed, clickable/non-clickable based on manifest.

**Files:**
- Create: `apps/web/src/pages/RevealsPage.tsx`

- [ ] **Step 1: Implement the page component**

Create `apps/web/src/pages/RevealsPage.tsx`:

```typescript
import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {BrowseCardGrid} from '../features/cards';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useManifest} from '../features/reveals';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import type {LorcanaCard} from '../features/cards/types';

const SET_12_CODE = '12';

type Franchise = 'toy-story' | 'incredibles' | 'brave';

const FRANCHISES: {id: Franchise; label: string; match: string}[] = [
  {id: 'toy-story', label: 'Toy Story', match: 'Toy Story'},
  {id: 'incredibles', label: 'The Incredibles', match: 'The Incredibles'},
  {id: 'brave', label: 'Brave', match: 'Brave'},
];

/**
 * Filter cards by franchise using the explicit `franchise` field on preview cards.
 * Only Set 12 preview cards have this field set; main-pool cards return null/undefined
 * and are filtered out when a franchise is active.
 */
function matchesFranchise(card: LorcanaCard, franchise: Franchise | null): boolean {
  if (!franchise) return true;
  const config = FRANCHISES.find((f) => f.id === franchise);
  if (!config) return true;
  return card.franchise === config.match;
}

export function RevealsPage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error} = useCardDataContext();
  const {hasSynergies} = useManifest();
  const [activeFranchise, setActiveFranchise] = useState<Franchise | null>(null);

  const set12Cards = cards.filter((c) => c.setCode === SET_12_CODE);
  const visibleCards = set12Cards.filter((c) => matchesFranchise(c, activeFranchise));

  const toggleFranchise = (franchise: Franchise) => {
    setActiveFranchise((current) => (current === franchise ? null : franchise));
  };

  const selectCard = (card: LorcanaCard) => {
    if (hasSynergies(card.id)) {
      navigate(`/card/${card.id}`);
    }
  };

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.textPrimary,
          padding: 32,
          textAlign: 'center',
        }}>
        <div>
          <h1 style={{fontFamily: FONTS.display, fontSize: 24}}>Failed to load card data</h1>
          <p style={{color: COLORS.textMuted}}>{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader />
      <main
        style={{
          minHeight: '100vh',
          paddingTop: 80,
          color: COLORS.textPrimary,
        }}>
        <section
          aria-labelledby="reveals-heading"
          style={{
            padding: `${SPACING.xl}px ${SPACING.lg}px`,
            textAlign: 'center',
            maxWidth: 1200,
            margin: '0 auto',
          }}>
          <h1
            id="reveals-heading"
            style={{
              fontFamily: FONTS.display,
              fontSize: isMobile ? 32 : 48,
              margin: 0,
              color: COLORS.primary,
              letterSpacing: '0.1em',
            }}>
            THE WILDS UNKNOWN
          </h1>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: FONT_SIZES.base,
              color: COLORS.textMuted,
              marginTop: 8,
            }}>
            Set 12 preview cards — Pixar arrives in Lorcana
          </p>

          <div
            role="group"
            aria-label="Filter by franchise"
            style={{
              display: 'flex',
              gap: SPACING.sm,
              justifyContent: 'center',
              marginTop: SPACING.lg,
              flexWrap: 'wrap',
            }}>
            {FRANCHISES.map((f) => {
              const isActive = activeFranchise === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFranchise(f.id)}
                  aria-pressed={isActive}
                  style={{
                    padding: '10px 20px',
                    fontSize: FONT_SIZES.base,
                    fontFamily: FONTS.body,
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? COLORS.primary : 'transparent',
                    color: isActive ? COLORS.background : COLORS.textPrimary,
                    border: `1px solid ${isActive ? COLORS.primary : COLORS.surfaceBorder}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {set12Cards.length === 0 ? (
          <section
            aria-label="No reveals yet"
            style={{
              textAlign: 'center',
              padding: 64,
              color: COLORS.textMuted,
              fontSize: FONT_SIZES.xl,
              fontFamily: FONTS.body,
            }}>
            No cards revealed yet. Check back soon.
          </section>
        ) : (
          <BrowseCardGrid
            cards={visibleCards}
            isLoading={isLoading}
            onCardSelect={selectCard}
            usePageScroll
          />
        )}
      </main>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Manually verify the component compiles**

Run: `pnpm --filter inkweave-web typecheck`

Expected: No TypeScript errors from the new file. (There may be warnings in other files — those are pre-existing.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/RevealsPage.tsx
USER_APPROVED=1 git commit -m "feat(reveals): add RevealsPage component (#278)"
```

---

## Task 7b: Extract franchise logic + gut RevealsPage to a stub

**Why**: The RevealsPage UI will be redesigned in Pencil before final implementation. To avoid committing disposable UI work, we gut the page body down to a minimal stub (keeping the codebase-consistent scaffolding) and extract the franchise filtering logic into a standalone module so it survives the redesign.

**Files:**
- Create: `apps/web/src/features/reveals/franchise.ts`
- Create: `apps/web/src/features/reveals/__tests__/franchise.test.ts`
- Modify: `apps/web/src/features/reveals/index.ts` (re-export franchise module)
- Modify: `apps/web/src/pages/RevealsPage.tsx` (reduce to ~20-line stub)

- [ ] **Step 1: Create the franchise module**

Create `apps/web/src/features/reveals/franchise.ts`:

```typescript
import type {LorcanaCard} from 'inkweave-synergy-engine';

export type FranchiseId = 'toy-story' | 'incredibles' | 'brave';

export interface FranchiseConfig {
  id: FranchiseId;
  label: string;
  /** Value to match against `card.franchise`. */
  match: string;
}

export const FRANCHISES: readonly FranchiseConfig[] = [
  {id: 'toy-story', label: 'Toy Story', match: 'Toy Story'},
  {id: 'incredibles', label: 'The Incredibles', match: 'The Incredibles'},
  {id: 'brave', label: 'Brave', match: 'Brave'},
];

/**
 * Filter cards by franchise using the explicit `franchise` field on preview cards.
 * Only preview cards have this field set; main-pool cards are filtered out when
 * a franchise filter is active.
 *
 * Pass `null` to disable filtering (returns true for all cards).
 */
export function matchesFranchise(card: LorcanaCard, franchise: FranchiseId | null): boolean {
  if (!franchise) return true;
  const config = FRANCHISES.find((f) => f.id === franchise);
  if (!config) return true;
  return card.franchise === config.match;
}
```

- [ ] **Step 2: Write tests for the franchise module**

Create `apps/web/src/features/reveals/__tests__/franchise.test.ts`:

```typescript
import {describe, it, expect} from 'vitest';
import {matchesFranchise, FRANCHISES} from '../franchise';
import {createCard} from '../../../shared/test-utils';

describe('matchesFranchise', () => {
  it('returns true for any card when franchise is null', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, null)).toBe(true);
  });

  it('returns true when card.franchise matches the config label', () => {
    const card = createCard({id: '1', franchise: 'Toy Story'});
    expect(matchesFranchise(card, 'toy-story')).toBe(true);
  });

  it('returns false when card.franchise differs', () => {
    const card = createCard({id: '1', franchise: 'The Incredibles'});
    expect(matchesFranchise(card, 'toy-story')).toBe(false);
  });

  it('returns false when card has no franchise and a filter is active', () => {
    const card = createCard({id: '1'});
    expect(matchesFranchise(card, 'brave')).toBe(false);
  });
});

describe('FRANCHISES', () => {
  it('exposes three franchises covering Set 12 IPs', () => {
    expect(FRANCHISES.map((f) => f.id).sort()).toEqual(['brave', 'incredibles', 'toy-story']);
  });

  it('maps each id to a human label and a card.franchise match value', () => {
    for (const f of FRANCHISES) {
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.match.length).toBeGreaterThan(0);
    }
  });
});
```

Note: if `createCard` in `shared/test-utils` doesn't support a `franchise` override, you may need to add `franchise: overrides.franchise` to the factory. Check first — most likely it already spreads `...overrides` and this just works without any change.

- [ ] **Step 3: Update the feature index**

In `apps/web/src/features/reveals/index.ts`, append:

```typescript
export {matchesFranchise, FRANCHISES} from './franchise';
export type {FranchiseId, FranchiseConfig} from './franchise';
```

- [ ] **Step 4: Gut RevealsPage.tsx**

Replace the entire contents of `apps/web/src/pages/RevealsPage.tsx` with:

```typescript
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';

/**
 * Set 12 Reveals page. Stub pending Pencil design — see issue #278.
 *
 * When implementing the final UI:
 * - `useCardDataContext()` provides the card pool (already merges previewCards.json)
 * - Filter preview cards with `cards.filter(c => c.setCode === '12')`
 * - Use `useManifest()` + `hasSynergies(card.id)` to decide which tiles are clickable
 * - Use `FRANCHISES` + `matchesFranchise(card, activeFranchise)` for IP filtering
 */
export function RevealsPage() {
  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader />
      <main style={{minHeight: '100vh', paddingTop: 80}} />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm --filter inkweave-web test:run`

Expected: All tests pass. Tests count becomes 594 + 6 new franchise tests = **600 passing** (3 skipped unchanged).

Run: `pnpm --filter inkweave-web typecheck`

Expected: zero errors on the new/modified files.

- [ ] **Step 6: Commit**

```
git -C "D:/johnn/Projects/inkweave" add apps/web/src/features/reveals/ apps/web/src/pages/RevealsPage.tsx
```
Then separately:
```
USER_APPROVED=1 git -C "D:/johnn/Projects/inkweave" commit -m "refactor(reveals): extract franchise logic and stub page for Pencil redesign (#278)"
```

Use `timeout: 600000` for the commit.

---

## Task 8: ~~Storybook stories for RevealsPage~~ (DEFERRED)

**Deferred**: Stories would be written against disposable UI. Will be addressed in the follow-up issue that implements the Pencil design. Storybook `check:stories` CI will pass because `RevealsPage.tsx` is a page component — page components are not in the set-coverage ratchet (verify in `apps/web/scripts/check-story-coverage.mjs` if the build fails).

Skip directly to Task 9.

## Task 8 (original): Storybook stories for RevealsPage

**Why**: The `check:stories` CI guard fails if a new visual component ships without a `.stories.tsx` file. This also gives us an isolated view for reviewing the page in Chromatic.

**Files:**
- Modify: `apps/web/src/shared/contexts/CardDataContext.tsx` (export the context value)
- Create: `apps/web/src/pages/RevealsPage.stories.tsx`

- [ ] **Step 1: Export the `CardDataContext` value so stories can provide mock data**

In `apps/web/src/shared/contexts/CardDataContext.tsx`, change line 10 from:

```typescript
const CardDataContext = createContext<CardDataContextValue | null>(null);
```

to:

```typescript
export const CardDataContext = createContext<CardDataContextValue | null>(null);
```

- [ ] **Step 2: Write the stories file**

Create `apps/web/src/pages/RevealsPage.stories.tsx`:

```typescript
import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {RevealsPage} from './RevealsPage';
import {CardPreviewProvider} from '../features/cards/components/CardPreviewProvider';
import {CardDataContext} from '../shared/contexts/CardDataContext';
import type {LorcanaCard} from '../features/cards/types';

const mockCard = (overrides: Partial<LorcanaCard>): LorcanaCard => ({
  id: '1',
  name: 'Sample',
  fullName: 'Sample Card',
  version: '',
  ink: 'Amber',
  cost: 3,
  inkwell: true,
  type: 'Character',
  text: '',
  textSections: [],
  setCode: '12',
  setNumber: 1,
  classifications: [],
  keywords: [],
  strength: 2,
  willpower: 3,
  lore: 1,
  imageUrl: undefined,
  isSong: false,
  franchise: undefined,
  ...overrides,
});

const meta: Meta<typeof RevealsPage> = {
  title: 'Pages/RevealsPage',
  component: RevealsPage,
  parameters: {layout: 'fullscreen'},
  decorators: [
    (Story, context) => {
      const cards = (context.args as {_cards?: LorcanaCard[]})._cards ?? [];
      return (
        <MemoryRouter initialEntries={['/reveals']}>
          <CardDataContext.Provider
            value={{
              cards,
              isLoading: false,
              error: null,
              retryLoad: () => {},
              totalCards: cards.length,
              uniqueKeywords: [],
              uniqueClassifications: [],
              uniqueSets: ['12'],
              sets: [{code: '12', name: 'The Wilds Unknown', number: 12}],
              getCardById: (id: string) => cards.find((c) => c.id === id),
            }}>
            <CardPreviewProvider>
              <Story />
            </CardPreviewProvider>
          </CardDataContext.Provider>
        </MemoryRouter>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof RevealsPage>;

export const EmptyState: Story = {
  args: {_cards: []} as never,
};

export const WithCards: Story = {
  args: {
    _cards: [
      mockCard({
        id: '1',
        fullName: 'Woody - Jungle Guide',
        classifications: ['Floodborn', 'Hero', 'Toy'],
        franchise: 'Toy Story',
      }),
      mockCard({
        id: '2',
        fullName: 'Merida - Brave Archer',
        ink: 'Emerald',
        classifications: ['Princess'],
        franchise: 'Brave',
      }),
      mockCard({
        id: '3',
        fullName: 'Mr. Incredible',
        ink: 'Ruby',
        classifications: ['Hero'],
        franchise: 'The Incredibles',
      }),
    ],
  } as never,
};
```

- [ ] **Step 3: Verify Storybook story-coverage check passes**

Run: `node apps/web/scripts/check-story-coverage.mjs`

Expected: Exit code 0. No error about `RevealsPage` missing stories.

- [ ] **Step 4: Verify no regressions from the context export**

Run: `pnpm --filter inkweave-web test:run`

Expected: All tests still pass. Exporting the context value is a non-breaking widening of the module's API.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/RevealsPage.stories.tsx apps/web/src/shared/contexts/CardDataContext.tsx
USER_APPROVED=1 git commit -m "feat(reveals): add Storybook stories for RevealsPage (#278)"
```

---

## Task 9: Router wiring

**Why**: Without a route, the page is unreachable. Lazy-load to keep initial bundle size down.

**Files:**
- Modify: `apps/web/src/router.tsx`

- [ ] **Step 1: Add the lazy import and route**

In `apps/web/src/router.tsx`:

1. After the last `lazyWithRetry` line (line 53, `NotFoundPage`), add:

```typescript
const RevealsPage = lazyWithRetry(() => import('./pages/RevealsPage'), 'RevealsPage');
```

2. In the `children` array, before the `*` catch-all route (currently at line 143), add this route block:

```typescript
      {
        path: 'reveals',
        element: (
          <SuspenseWrapper>
            <RevealsPage />
          </SuspenseWrapper>
        ),
      },
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter inkweave-web typecheck`

Expected: No errors.

- [ ] **Step 3: Start dev server and verify the page loads**

Run: `pnpm dev` (in background — use port 5173)

Navigate to: `http://localhost:5173/reveals`

Expected: Empty state message "No cards revealed yet. Check back soon." renders below the Set 12 header and franchise filter buttons.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/router.tsx
USER_APPROVED=1 git commit -m "feat(router): add /reveals route (#278)"
```

---

## Task 10: ~~Navigation updates~~ (DEFERRED — see follow-up note below)

**Deferred**: Navigation changes depend on the Pencil redesign. Adding a third mobile bottom tab is tight layout guesswork that should be a design decision, not an implementation guess. Desktop nav could safely fit another tab, but keeping desktop + mobile in sync is simpler when both land together in the follow-up issue.

For now, `/reveals` is reachable only via direct URL. This is acceptable because the page is currently a stub (Pencil design pending); there's no discoverable UI to link to yet.

Skip directly to Task 12.

## Task 10 (original): Navigation updates

**Why**: Users need to discover the page. Add a "Reveals" entry to both the desktop nav strip and the mobile bottom nav.

**Files:**
- Modify: `apps/web/src/shared/components/CompactHeader.tsx`
- Modify: `apps/web/src/shared/components/MobileBottomNav.tsx`

### Desktop nav

- [ ] **Step 1: Add Reveals to `NAV_ITEMS`**

In `apps/web/src/shared/components/CompactHeader.tsx`, find the `NAV_ITEMS` declaration around line 25:

```typescript
const NAV_ITEMS = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/vote', label: 'Vote'},
] as const;
```

Replace with:

```typescript
const NAV_ITEMS = [
  {path: '/browse', label: 'Browse'},
  {path: '/playstyles', label: 'Playstyles'},
  {path: '/reveals', label: 'Reveals'},
  {path: '/vote', label: 'Vote'},
] as const;
```

### Mobile nav

- [ ] **Step 2: Add a third tab to MobileBottomNav**

In `apps/web/src/shared/components/MobileBottomNav.tsx`, after the existing `isPlaystylesActive` constant (line 18), add:

```typescript
  const isRevealsActive = location.pathname.startsWith('/reveals');
```

Then find the existing Playstyles tab at line 166-207 (the `<a href="/playstyles" ...>` block) and move its `right` position from `76` to `16`, making room for a new tab at `76`:

Change:
```typescript
          right: 76,
```
to:
```typescript
          right: 16,
```

After the Playstyles tab closing `</a>`, add a new Reveals tab block just before the closing `</nav>`:

```typescript
      {/* Reveals tab (right-inner, new) */}
      <a
        href="/reveals"
        onClick={(e) => {
          e.preventDefault();
          navigate('/reveals');
        }}
        aria-current={isRevealsActive ? 'page' : undefined}
        style={{
          position: 'absolute',
          right: 76,
          bottom: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          textDecoration: 'none',
          pointerEvents: 'auto',
        }}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isRevealsActive ? COLORS.primary : COLORS.textMuted}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true">
          <path d="M12 2L14.5 8.5L21 9.3L16.2 14L17.5 20.5L12 17.3L6.5 20.5L7.8 14L3 9.3L9.5 8.5L12 2Z" />
        </svg>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: '10px',
            fontWeight: isRevealsActive ? 600 : 500,
            color: isRevealsActive ? COLORS.primary : COLORS.textMuted,
          }}>
          Reveals
        </span>
      </a>
```

- [ ] **Step 3: Run dev server and verify nav on both breakpoints**

Run: `pnpm dev`

Desktop: navigate to `http://localhost:5173/`, verify the nav strip shows Browse | Playstyles | Reveals | Vote. Click Reveals — page loads.

Mobile: resize the browser to under 768px width. Verify the bottom nav shows Browse (left), search button (center), Reveals (right-inner), Playstyles (right). Click Reveals — page loads.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/shared/components/CompactHeader.tsx apps/web/src/shared/components/MobileBottomNav.tsx
USER_APPROVED=1 git commit -m "feat(nav): add Reveals link to desktop and mobile nav (#278)"
```

---

## Task 11: ~~E2E test~~ (DEFERRED — see follow-up note below)

**Deferred**: Full E2E coverage targets UI that will be replaced after Pencil design. Only keep the minimal "route loads and nav link works" check, which Task 12's smoke test already covers manually. Skip directly to Task 12. The full E2E suite for the reveals page will be written in the follow-up issue.

## Task 11 (original): E2E test

**Why**: Verifies the page loads without errors, franchise filter toggles work, and clickable cards navigate. Catches regressions that unit tests miss.

**Files:**
- Create: `apps/web/e2e/tests/reveals.spec.ts`
- Modify: `apps/web/e2e/E2E_TESTS.md`

- [ ] **Step 1: Write the E2E test**

Create `apps/web/e2e/tests/reveals.spec.ts`:

```typescript
import {test, expect} from '@playwright/test';

test.describe('Reveals page', () => {
  test('loads with empty state when no Set 12 cards exist', async ({page}) => {
    await page.goto('/reveals');

    await expect(page.getByRole('heading', {name: 'THE WILDS UNKNOWN'})).toBeVisible();
    await expect(page.getByText('No cards revealed yet. Check back soon.')).toBeVisible();
  });

  test('shows franchise filter buttons', async ({page}) => {
    await page.goto('/reveals');

    await expect(page.getByRole('button', {name: 'Toy Story'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'The Incredibles'})).toBeVisible();
    await expect(page.getByRole('button', {name: 'Brave'})).toBeVisible();
  });

  test('franchise filter toggles active state', async ({page}) => {
    await page.goto('/reveals');

    const toyStoryBtn = page.getByRole('button', {name: 'Toy Story'});
    await expect(toyStoryBtn).toHaveAttribute('aria-pressed', 'false');

    await toyStoryBtn.click();
    await expect(toyStoryBtn).toHaveAttribute('aria-pressed', 'true');

    await toyStoryBtn.click();
    await expect(toyStoryBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('only one franchise active at a time (mutually exclusive)', async ({page}) => {
    await page.goto('/reveals');

    await page.getByRole('button', {name: 'Toy Story'}).click();
    await expect(page.getByRole('button', {name: 'Toy Story'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', {name: 'Brave'}).click();
    await expect(page.getByRole('button', {name: 'Toy Story'})).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('button', {name: 'Brave'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('nav link to reveals works from homepage', async ({page}) => {
    await page.goto('/');
    await page.getByRole('link', {name: 'Reveals'}).click();
    await expect(page).toHaveURL(/\/reveals$/);
    await expect(page.getByRole('heading', {name: 'THE WILDS UNKNOWN'})).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the E2E test against chromium**

Run: `pnpm --filter inkweave-web test:e2e --project chromium -- reveals.spec`

Expected: All 5 tests pass.

- [ ] **Step 3: Update E2E inventory**

Append to `apps/web/e2e/E2E_TESTS.md` (follow the format of existing entries — if the file has a table, add a row; if it has a list, add a bullet point). The exact existing format must be preserved; add this entry:

`reveals.spec.ts` — 5 tests covering empty state, franchise filter buttons, filter toggle, mutual exclusivity, and nav link from homepage.

Read the current file first to match its exact format, then add the entry.

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/tests/reveals.spec.ts apps/web/e2e/E2E_TESTS.md
USER_APPROVED=1 git commit -m "test(reveals): add E2E tests for /reveals page (#278)"
```

---

## Task 12: Full build verification + smoke test

**Why**: Final check that nothing broke in the full pipeline. Catches integration issues that per-task tests miss (e.g., stale precomputed synergies, image pipeline regressions, lint drift).

**Files:** None created or modified.

- [ ] **Step 1: Run the full build pipeline**

Run:
```bash
pnpm build:engine
node scripts/precompute-synergies.mjs
pnpm --filter inkweave-web build
```

Expected: All three succeed. Precompute output shows `1430/1430 cards loaded (1 from previewCards.json)` (the seeded Woody card counts).

- [ ] **Step 2: Run the full unit test suite**

Run: `pnpm test`

Expected: All tests pass (195 engine + 586+ web).

- [ ] **Step 3: Run the full lint check**

Run: `pnpm lint`

Expected: No new errors (pre-existing warnings in other files are acceptable).

- [ ] **Step 4: Run E2E chromium smoke test**

Run: `pnpm --filter inkweave-web test:e2e --project chromium`

Expected: All E2E tests pass, including the new `reveals.spec.ts`.

- [ ] **Step 5: Manual browser smoke test**

Run: `pnpm dev` (background)

Navigate to `http://localhost:5173/reveals`:
- Verify `Woody - Jungle Guide` appears in the grid
- Verify the card tile IS clickable (synergies should exist via the Shift rule pairing Woody preview with any existing Woody cards in `allCards.json` — Rule 1 Shift Targets)
- Verify clicking "Toy Story" filter: Woody remains visible (franchise match)
- Verify clicking "The Incredibles" filter: grid empties (Woody's franchise is Toy Story, not Incredibles)
- Verify clicking "The Incredibles" again (deactivating): Woody re-appears
- Click Woody → should navigate to `/card/1215204` (using his preview card id)
- Verify the card detail page loads and shows Shift synergies with any existing Woody cards

Also navigate to `/browse`:
- Verify Woody is findable via search for "Woody"
- Verify Woody appears when filtering by set 12

Kill the dev server.

- [ ] **Step 6: Verify clean working tree**

Run: `git status`

Expected: `nothing to commit, working tree clean`.

---

## Final Self-Review Checklist

- [ ] `LorcanaCard.franchise` and `LorcanaJSONCard.franchise` fields added; transformer passes through
- [ ] `previewCards.json` exists with seeded Woody - Jungle Guide card
- [ ] `fetchCardsFromLocal` merges both files, dedupes by id, handles 404
- [ ] Precompute script merges both files before running engine; Woody appears in manifest
- [ ] Image download script iterates both files
- [ ] `useManifest` hook fetches and caches `_manifest.json`
- [ ] `/reveals` route exists, lazy-loaded
- [ ] RevealsPage filters by `card.franchise`, renders empty state + franchise filters + grid
- [ ] Nav entries added to both desktop and mobile
- [ ] Storybook stories exist (EmptyState + WithCards with franchise-tagged mocks)
- [ ] E2E tests cover empty state, filter toggles, nav link
- [ ] Full build succeeds
- [ ] Full test suite passes
- [ ] E2E chromium passes

## Open Implementation Notes

**Franchise logos**: The spec mentions using actual franchise logos as clickable elements. Current implementation uses text buttons. When the Pencil design session produces the visual design with logos, swap the button contents from text labels to `<img>` tags (or inline SVG). The interactive behavior (click to toggle, `aria-pressed`, `onClick`) stays identical.

**Mobile nav crowding**: Adding a third mobile tab at `right: 76` with Playstyles moved to `right: 16` is tight. Pencil design may produce a different nav layout (e.g., hiding Vote on mobile, using icons only, or promoting Reveals into the homepage hero). Adjust the positioning and icon choices when visual design is finalized.

**`simpleName` field**: The `LorcanaJSONCard` interface declares `simpleName: string` as required, but 0 of 1429 existing cards have it. The transformer never reads it. Not a blocker — TypeScript doesn't validate at JSON.parse time — but the interface is stale. Outside the scope of this plan; leave untouched.
