# Collection viewing and the incremental image pipeline (#553): design

**Status:** agreed 2026-08-10. Supersedes part of #553's original scope (the
`/collection` route) and extends PLAN Phase 2 items 31, 32 and 34. Item 30
(`collections` migration) stays deferred; item 33 (`/collection` page) is
**dropped**; item 35 (`replacements.ts`) remains out of scope.

**Goal:** a user who imports a Dreamborn collection can see **every card they
own, from every set**, inside the existing Browse page — while the synergy
engine, the deck builder and the playstyle pages continue to see only the 1,024
Core cards. One dataset is a viewer; the other is an input. They must not mix.

Folded in by owner decision: an **incremental image pipeline**, because this
feature triples the image count and the current pipeline cannot tell "unchanged"
from "unknown".

**Phase A shipped 2026-08-10 as #554 (`c4f4038`), and it differs from what this
document first specified** — the committed manifest could not work, because AVIF
encoding is not reproducible across machines. Phase A below carries the corrected
design and why the original was wrong. Phases B and C are unbuilt.

## Why now

Two thirds of a real collection is invisible in Inkweave. Measured against the
owner's own export: of 2,476 distinct cards owned, only **831 are Core**. An
import that silently discards 1,645 cards reads as broken rather than scoped.

## What was measured

All figures verified on 2026-08-10 against `.knowledge/folder/allCards.json` (the
LorcanaJSON full export, 3,242 cards) and the shipped
`apps/web/public/data/allCards.json` (1,024 cards). Re-derive before trusting any
of this after a set graduation.

### Integrity: Core is a faithful strict subset

| Check | Result |
|---|---|
| Core ids absent from the full export | 0 of 1,024 |
| Core cards whose key fields differ | 0 (name, version, fullName, cost, color, type, setCode, number, rarity, inkwell, strength, willpower, lore) |
| Core `(setCode, number)` pairs absent | 0 |
| Top-level shape | identical (`metadata`, `sets`, `cards`) |

Core is also a **column** subset: the transformer drops ~30 upstream fields
(`artists`, `flavorText`, `story`, `externalLinks`, `simpleName`, `clarifications`,
`errata`, `promoIds`, …). Conversely Core carries `imageHash`/`imageHashSm`, which
the upstream file has no concept of.

### The Core sets hold more than Core

Sets 9-13 contain **1,284** cards upstream, not 1,024. The 260 extras are
Enchanted (90), Epic (90), Iconic (10) and Special (70), and their collector
numbers **interleave with the base numbering** — 82 of them sit below Core's
highest number, so a numeric range cannot separate them.

**They are alternate printings, not different cards.** 259 of 260 share a
`fullName` with a Core card, and **all 260 carry a `baseId` that resolves into the
Core pool**. Use the pointer, not the name: `10-228 Can't Hold it Back Anymore`
[Enchanted] is the one card whose name does not match, and its `baseId` still
resolves. Across the whole file, 593 names have more than one printing.

### The clean join is an artifact of Core-only

`(setCode, number)` is unique across the 1,024 Core cards. Across all 3,242 it is
**not**: 160 pairs are shared, up to five ways.

```
1-1 → Ariel - On Human Legs [Uncommon]
    | Mickey Mouse - Brave Little Tailor [Special]
    | Dragon Fire [Special]
    | Mickey Mouse - Brave Little Tailor [Special]
    | Ariel - Spectacular Singer [Special]
```

Joining the owner's CSV against the full pool, on **2,665 distinct numeric pairs**:
**2,505 unique, 160 ambiguous, 0 unmatched**. Adding the CSV's `Name` column
resolves **154** of the ambiguous; **6 remain irreducible** — two printings sharing
both a name and a collector number. The export cannot express which one you own.

### Card numbers are not always numeric

Set 3's Dalmatian Puppy ships as five collector variants, `4a` through `4e`.
`parseInt('4a')` returns `4` with no error, silently merging five cards into one —
measured, it undercounted distinct non-Core cards by exactly 4. Card numbers are
therefore **normalized strings** throughout (`001` → `1`, `4a` → `4a`); set numbers
stay parsed, since all 5,329 CSV rows carry numeric set codes.

This is why the two pair counts above differ: **2,669** distinct pairs under
normalized-string keys, **2,665** under the numeric keys the join analysis used.
No Core row is affected — all ten suffixed rows are set 3.

### The export does not cover Core-set extras

Highest collector number per set, CSV versus upstream:

| set | 9 | 10 | 11 | 12 | 13 |
|---|---|---|---|---|---|
| CSV | 204 | 204 | 204 | 204 | 207 |
| full | 242 | 242 | 242 | 242 | 245 |

It *does* reach 223-225 for sets 3, 4, 5, 7 and 8. So Dreamborn exports
older-set Enchanted but not Core-set Enchanted, at least in this file. **Today a
Core Enchanted cannot be marked owned**, whatever we build. The binder shows them
as unowned.

### Payload

| Projection | raw | gzip |
|---|---|---|
| Non-Core gallery only (2,218 cards) | 155 KB | **39 KB** |
| Non-Core + filter fields | 304 KB | **52 KB** |
| Non-Core + `fullText` (search-capable) | 603 KB | **118 KB** |
| *Shipped `allCards.json` today, for scale* | *1,562 KB* | *205 KB* |

Per-set chunks in the search-capable projection are **11-16 KB gzip** each.

### Images

Today: 2,048 files, 27.5 MB, ~14 KB average. Adding 2,218 cards at two sizes is
**~4,400 files and ~60 MB**, taking the deploy artifact to roughly 87 MB.

**Every upstream URL is already content-addressed:**

```
…/images/en/set9/1_93b7a7794fa098c50d7f82e099a8db3928a78f9d.jpg
                   └── 40-hex hash of the image bytes
```

1,024 of 1,024 cards, 1,024 distinct hashes, on both sizes. **A URL that has not
changed is an image that has not changed.** The pipeline does not record this, so
it cannot use it.

The committed hashes are also incomplete: **612 of 1,024** carry `imageHash` —
set 9 205/205, set 10 204/204, set 11 203/204, **set 12 0/204, set 13 0/207**.
Production is unaffected (the build re-injects on every run), but the committed
file is a partial snapshot of whoever last ran the script locally, not a record
of what was built.

## Decisions

Each was an explicit owner ruling during the 2026-08-10 design session.

### A. Collection viewing lives in Browse, not a separate page

A toggle turns collection mode on. #553's `/collection` route is dropped. Rationale:
everything a user wants to do with their collection — filter, search, sort, open a
card — Browse already does. A second page would reimplement it.

### B. Collection mode shows every card from every set

Not only owned cards. Gaps are visible, which makes the mode double as completion
tracking. Owned/unowned is a badge, and "only cards I own" is a filter on top.

### C. Non-Core cards are viewable, never playable

They do not enter the deck builder, the playstyle pages, or any synergy
calculation. This is the invariant the whole architecture exists to protect.

### D. Presentation is a binder, and needs its own design pass

A two-page 4×3 spread with next/previous, rather than an endless grid, to bound
how many images load at once. **The layout is not designed yet** and is out of
scope for this document. Note for that session: 3,242 cards at 24 per spread is
~135 spreads, so per-set binders (Set 1 ≈ 10 spreads) are the likely shape, and
per-set is the one boundary the Core file, the full file and the CSV all already
agree on.

### E. A non-Core card opens the full modal with an honest synergy panel

Not a reduced view, not the existing `SynergiesEmptyState`. "No synergies yet"
claims we might compute some; the truth is the card is outside the format we
analyse. Different claims need different copy.

Because of `baseId`, this splits three ways:

| Card | Panel |
|---|---|
| Core | synergies, as today |
| Core-set alternate printing | **real synergies, fetched for its `baseId`** |
| Sets 1-8, Q1/Q2 | the honest "outside Core" panel |

### F. Images are self-hosted through the existing pipeline

Not proxied. Content-addressing is what makes `Cache-Control: immutable` truthful
at `vercel.json`, and `/card-images/*` already falls through to a Ravensburger
rewrite — so serving a non-content-addressed URL from that path would recreate
issue #323 exactly.

### G. Finish is modelled, not folded

Carried from 2026-08-10 earlier: `{normal, foil}` per card behind a `totalOwned()`
accessor. Collapsing later is possible; un-collapsing is not.

### H. The image pipeline becomes incremental, in the same effort

CDN restore, folded in rather than sequenced separately, by owner decision, on the
grounds that this feature is what makes it urgent. **Shipped as #554** — the
committed manifest this originally specified turned out to be unworkable; see
Phase A.

## Architecture

Three phases. **Phase A is #554** — a build-pipeline change with no user-facing
surface, worth doing at today's 1,024 cards, and it should land before the count
triples. Phases B and C are one plan: the feature.

Folding A into this document was an owner decision (H). Keeping it a separate
*plan* is how the coupling stays documentary rather than tangled in the code.

### Phase A — incremental image pipeline · **SHIPPED as #554 (`c4f4038`)**

> **The design below was wrong and the shipped version differs.** Kept, corrected
> in place, because the reason it was wrong is the most useful thing here.

**What was designed:** a committed manifest at `data/image-manifest.json` recording
`{src, full, sm}` per card — the upstream source hash beside our two AVIF output
hashes — so a build could diff `src` to find the real change set.

**Why it cannot work.** AVIF encoding is **not reproducible across machines**.
Different `sharp`/libvips versions and platforms produce different bytes from the
same JPEG, so the output hash is a property of the builder, not of the input.
Measured 2026-08-10: **0 of 1024** hashes from a local Windows run matched
production's Linux build. A manifest committed from a developer's machine would
describe bytes CI never produces, so every restore would 404 and fall through —
the feature inert, plus ~2,000 futile requests per cold build.

The mistaken step was treating content-addressing as implying reproducibility. It
guarantees *the same bytes get the same name*; it says nothing about *the same
input producing the same bytes*. For a lossy encoder those are very different
claims, and the cross-machine protocol was built on the stronger one.

**What shipped instead: the deployed `allCards.json` is already the manifest.** The
build injects `imageHash`/`imageHashSm` into it and it ships, so the live site
publishes both the hashes it serves and the `images.full` source URLs they came
from. No new committed file, and no cross-machine hash problem, because the hashes
are read from the deployment that actually holds those bytes.

Per-card decision in `download-card-images.mjs`, against `{ORIGIN}/data/allCards.json`:

| State | Action |
|---|---|
| All size variants cached | skip (unchanged behaviour) |
| Cache miss, prod serves the same source art, both hashes published | **restore** — no download, no `sharp` |
| Cache miss, art changed / card new / prod unreachable | download from Ravensburger, convert |

**Restore is verified, not trusted.** The expected hash is known before the
request, so a stale, truncated or substituted response is arithmetically
detectable and discarded. Known limit, accepted and documented in
`scripts/lib/imageRestore.mjs`: this proves the bytes match the hash asked for, not
that the hash belongs to the right card — that binding comes from the deployed
file, so a compromised deployment could swap one card's art for another's.

Origin resolution, first match wins:

```
PROD_IMAGE_ORIGIN                (manual override, local testing)
VERCEL_PROJECT_PRODUCTION_URL    (automatic on Vercel, no setup)
https://inkweave.ink             (scripts/lib/siteOrigin.mjs)
```

**Restore is an optimisation and never a dependency.** Disabled, cache-complete,
origin-unreachable and active are reported as four distinct states, because the
first three all print `0 restored` and mean different things. Every failure path
falls through to the existing download; `SKIP_IMAGE_RESTORE=1` reverts the
behaviour with no code change or deploy.

**A benefit that was not designed for:** restoring prod's bytes makes the emitted
hash equal prod's hash, so an unchanged card deploys under a byte-identical
filename and its `immutable` CDN entry survives the release instead of being
invalidated by a re-encode that changed nothing visible.

**Measured on a cold cache** (all 3,679 cache files wiped): **1024 restored, 0
downloaded, 0 failed, 33.5s**, with all 1024 resulting hashes identical to
production's. A warm build now makes **zero** network requests — the deployed file
is fetched only when something could use it.

`SITE_ORIGIN` was declared three times (`generate-sitemap.mjs`,
`check-rendered-html.mjs`, `ping-indexnow.mjs`) and is now one module,
`scripts/lib/siteOrigin.mjs`. `Seo.tsx` deliberately keeps its own: a root build
script and a bundled React component should not share a module. That leaves two
declarations that must agree with nothing enforcing it — a real, smaller problem,
tracked separately.

### Phase B — the collection dataset · **SHIPPED (`3291abb`, `b834257`)**

> **Two corrections to what follows, both found by building it.**
>
> **1. The projection was incomplete and 4× too small.** Chunks feed the engine's
> `transformCard`, whose `LorcanaJSONCard` interface reads nine fields the list
> below omits — `name`, `version`, `strength`, `willpower`, `lore`, `abilities`,
> `keywordAbilities`, `fullTextSections`, `images`. Cards built from it would
> render nameless and statless. Complete, it measures **445 KB gzip, not 118 KB**.
> The mistake was sizing an invented projection instead of the consumer's contract.
>
> **2. Therefore two tiers, not one.** 445 KB voided Section 2's "load everything
> when the mode turns on", which was argued *because* the payload was smaller than
> the Core file. Shipped: `index.json` at **71 KB** (all 2,218 cards — grid,
> filters, name search) loaded once in collection mode, plus per-set detail chunks
> at **5–42 KB** loaded for the set being viewed. That is the binder's own page
> unit, so the data chunks where the UI already pages.
>
> Also: `foilMask` dropped (read by nothing, 72 KB); `previewCards.json` ids
> excluded alongside `allCards.json`; the images half took the deploy artifact from
> 27.5 MB to **88 MB**, with 2,218 downloaded and **0 failed**.



`scripts/generate-collection-data.mjs` reads the full export, subtracts every id
present in `allCards.json`, and writes the remaining 2,218 as per-set chunks:

```
apps/web/public/data/collection/1.json    244 cards   11 KB gzip
apps/web/public/data/collection/9.json     55 cards    ~4 KB   ← only the extras
apps/web/public/data/collection/Q1.json    31 cards    2 KB
                                           15 files, ~118 KB gzip total
```

**Nothing is duplicated between the two datasets**, so they cannot drift. Set 9
holds 55 because its other 205 already live in `allCards.json`.

Chunk projection: `id`, `fullName`, `setCode`, `number`, `rarity`, `color`, `type`,
`cost`, `inkwell`, `subtypes`, `fullText`, `baseId`, plus injected image hashes.
The ~30 remaining upstream fields are omitted deliberately — they would roughly
double the payload for a gallery that never displays them.

Committed to git, like `allCards.json`, and for the same reason: regenerating
needs a file that is not in the repo.

`download-card-images.mjs` extends to walk the chunks. Phase A is what makes that
affordable.

**Untouched by design** — all nine readers of `allCards.json`
(`precompute-synergies`, `precompute-hosers`, `generate-sitemap`,
`generate-card-slug-map`, `prerender`, `mine-rule-candidates`,
`audit-synergy-data`, `export-banner`, `check-rendered-html`) still see exactly
1,024 Core cards, because the collection data is in files they never open.

### Phase C — runtime

**`CardDataContext` stays Core-only.** A sibling `CollectionCardsContext` holds the
loaded chunks and exposes `getCollectionCardById`. Browse merges locally:

```ts
const cards = collectionMode ? [...coreCards, ...collectionCards] : coreCards;
```

This is the load-bearing decision. Merging into `CardDataContext` would be shorter
and would hand set-1 cards to the deck-builder pool and the playstyle pages, which
read the same context — surfaces where a non-Core card is a correctness bug. The
deck builder is safe because it never asks the collection, not because anyone
remembered a rule.

**All 15 chunks load together when the mode turns on.** At 118 KB gzip — less than
the Core file already fetched on every visit — laziness buys nothing and costs
correctness: filters and search are global, so a partial pool silently omits
results. **Pagination bounds images, not data.** Card data is ~36 bytes per card
gzipped; a card image is ~14 KB. Three orders of magnitude, two different problems.

**Modal resolution** chains `getCardById` then `getCollectionCardById`. Only
Browse-in-collection-mode produces a non-Core id, so no other surface changes.

**The toggle** lives in `BrowseToolbar`, is URL-backed via `useFilterParams`
(`?collection=1`) so it is shareable and survives reload, and appears **only when
`hasCollection` is true**. Without an import there is nothing to distinguish owned
from unowned, so the toolbar offers import instead.

**Filter surface widens in collection mode:** the dialog's `sets` list must include
1-8 and Q1/Q2, and sort likely wants a binder order (set, then collector number).
This touches shared filter code and is called out so it is not discovered late.

## Import flow changes

The parser currently joins against the Core pool only, which is why its key is
sufficient. Against the full pool it becomes composite: `(set, normalized number)`
then `Name`. That resolves 2,659 of 2,669 pairs; **the 6 irreducible cases go to
`unmatched` with their own reason**, never to an arbitrary candidate — picking one
would attribute copies to the wrong printing and show the wrong art with no way to
tell.

**The summary copy inverts.** It currently says the non-Core remainder "is from
sets 1 to 8, which the Core format does not use", which was honest when those cards
disappeared. They are now viewable, so it must say they are in the collection but
unavailable for deck building.

## Error handling

| Failure | Behaviour |
|---|---|
| A chunk fetch fails | Collection mode reports it and stays off. Never half-load: a partial pool omits cards from search, which reads as "I don't own that" rather than "set 4 failed to load". |
| CDN restore fails, 404s, or bytes mismatch | Falls through to Ravensburger. Never fatal. |
| A card image missing entirely | Existing per-set image-coverage guard fails the build. Unchanged. |
| CSV row ambiguous across printings | Own count in the summary, distinct from "could not be read". |
| Non-Core card in the modal | The honest panel. Never `SynergiesEmptyState`. |

## Testing

**Unit.** Parser gains the composite key, the 6-way residue, and `baseId`
resolution. `generate-collection-data.mjs` is tested on the invariant that matters:
**no id appears in both datasets**.

**Pipeline.** The negative path specifically: a CDN response whose bytes do not
hash to the requested value must be rejected and fall through. That property is
what makes network restore safe, and it fails silently if wrong.

**Real-data check, run deliberately, not in CI** (`.knowledge/` is git-ignored).
The `parseInt('4a')` bug on 2026-08-10 was found by two independent measurements
disagreeing; all 13 synthetic tests passed on the broken version. The full CSV
against the full pool deserves the same before shipping.

**E2E.** Toggle on with a stubbed collection → a set-1 card appears; open it → the
outside-Core panel and no synergy fetch; toggle off → Core-only pool restored. Plus
the boundary regression: **the deck-builder pool still shows 1,024 cards while
collection mode is on.** That is the assertion that catches a future refactor
merging into `CardDataContext`.

## Rejected alternatives

**One superset file with a `coreLegal` flag.** Simpler build and a single source of
truth, but the Core boundary becomes a rule every present and future consumer must
remember, failing *silently* when forgotten — a set-1 card entering a synergy
calculation produces a plausible wrong answer. It also ships 173 KB gzip to
visitors who never open collection mode. Rejected on the same grounds that produced
`no-legacy-gold` and `no-adhoc-back-links`: a ruling with no mechanism is a
suggestion.

**Per-set chunks for everything, Core derived from them.** The tidiest end state,
and probably right eventually. Rejected for now because it rewrites the precompute
input path, the loader and the image pipeline simultaneously.

**Proxying non-Core images live.** No build cost and no storage, but `/card-images/*`
carries `immutable` for a year and falls through to a Ravensburger rewrite, so this
recreates #323. Would need a separate path with different cache headers, and JPEGs
are heavier than the AVIFs everything else uses.

**Committing the AVIFs to git.** Fully hermetic — no network, no cache, no rot ever,
and they are append-only, which is the ideal case for binaries in git. Rejected on
~87 MB of clone weight for every contributor, growing ~5 MB per set.

**Moving images to Vercel Blob.** Would also fix the ~87 MB-per-deployment cost.
Deferred, not dismissed: revisit if deploy size becomes the binding constraint.

## Open questions

1. **The binder layout** (decision D) needs its own design session.
2. **Sort order** in collection mode — is binder order (set, then collector number)
   a new option, or the default while the mode is on?
3. ~~Set 13's preview overlay.~~ **Answered 2026-08-10.** `loader.ts:187` admits a
   preview card only when its id is absent from `allCards.json`, then applies the
   Core floor. So a card present in the full export *and* in `previewCards.json`
   but not yet in `allCards.json` would be added to the Core pool at runtime **and**
   written into a collection chunk at build — appearing twice in collection mode.
   **Rule: the chunk generator subtracts ids from BOTH `allCards.json` and
   `previewCards.json`.** Currently moot (`previewCards.json` holds 0 cards
   off-season) and therefore easy to miss; it bites at the next reveal season.

## Impact on #553

Its scope changes. What survives from the three commits already landed:

| Landed | Status |
|---|---|
| `collectionStorage.ts` + 8 tests (`837ba05`) | unchanged |
| `CollectionContext` + 10 tests (`9dc1727`) | unchanged |
| `collectionParser.ts` + 15 tests (`837ba05`) | needs the composite key |
| `ImportCollectionDialog` (uncommitted) | needs the summary copy change |
| `/collection` route | **dropped**, never built |

The issue body's measured-facts block stays accurate; its scope bullets need
rewriting against this document.
