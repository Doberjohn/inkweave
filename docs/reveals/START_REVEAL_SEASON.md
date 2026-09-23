# Start a Reveal Season

The counterpart to the graduation runbook in [`CARD_DATA_PIPELINE.md`](../CARD_DATA_PIPELINE.md). Graduation ends a season; this starts the next one. Written during the Set 14 (Hyperia City) switch, issue #564. The Set 12 to 13 precedent is commit `dc787cf4` (PR #388).

**When:** the next set's cards are being revealed publicly, and the previous set has graduated into `allCards.json`.

**Outcome:** `/reveals` is live in production for the new set, `/admin/reveal` can publish cards, and the nav pill, mobile tab and home promo are visible.

## Why the flag alone does nothing

`useRevealPhase` opens the season only when BOTH hold:

1. `VITE_IS_REVEAL_SEASON === 'true'` (inlined by Vite at build time), and
2. `previewCards.json` has `sets[REVEAL_SET_CODE]` with a `releaseDate` in the future.

After a graduation the data still names the OLD set, whose release date has passed, so the phase is `released` and every reveal surface stays hidden whatever the flag says. Starting a season means moving the constant, the data and the content together.

## The switch

### 1. The one constant

`apps/web/src/shared/constants/revealSet.ts` is the only file that names the reveal set.

| Constant | Change |
|---|---|
| `REVEAL_SET_CODE` | The new set code, e.g. `'15'` |
| `REVEAL_SET_LOGO` | Path of the new logo under `public/art/sets/` |
| `PER_INK` | Cards per ink. Fixed denominators, never derived from live data |

`REVEAL_SET_NUMBER`, `REVEAL_ID_BASE`, `SET_TOTAL`, `INK_BASE` and `inkBlock()` are all derived. Do not hand-type them.

`REVEAL_SET_CODE` is declared `satisfies SetCode`, so it will not compile until `theme.ts` knows the set. Add the new code to the `SetCode` union, `SET_ABBREVIATIONS` and `SET_NAMES` in `apps/web/src/shared/constants/theme.ts`. All page copy ("Set 15 reveals", the hero alt text, the returning-franchises label) reads from these, so there are no copy strings to hunt down.

### 2. The data block

In `apps/web/public/data/previewCards.json`, replace the graduated set's entry:

```json
"sets": {
  "15": {
    "name": "<display name, identical to SET_NAMES>",
    "number": 15,
    "type": "expansion",
    "prereleaseDate": "YYYY-MM-DD",
    "releaseDate": "YYYY-MM-DD",
    "hasAllCards": false,
    "allowedInFormats": {"Core": {"allowed": true, "rotationGroup": 4}}
  }
}
```

Dates are local midnight. Drop the old set's entry: nothing reads it once the constant moves (`allCards.json` carries it), and the reveals E2E picks the entry with the latest `releaseDate`. The file is LF: edit it with a normal editor, never splice it with `node`/`sed` on Windows (CRLF rewrite).

### 3. Per-season content

| File | What changes |
|---|---|
| `features/reveals/franchise.ts` | `FranchiseId` union + `FRANCHISES` (label, `match`, tint `ink`, blurb) for the debut franchises |
| `features/reveal-admin/constants.ts` | `FEATURED_FRANCHISE_HINT`, the form's hint text |
| `features/reveals/CardMosaic.tsx` | `ROWS` / `ROWS_MOBILE`: each ink's rows must sum to `PER_INK[ink]` (a test enforces it) |
| `features/reveals/setSpotlights.ts` | `SET_SPOTLIGHTS` (new mechanics, tribes) and `FRANCHISE_ART` (hero + support card ids) |
| `public/art/sets/`, `public/art/franchises/<id>.webp` | The set logo and one logo per debut franchise |

`SET_SPOTLIGHTS` can start empty. The What's New band drops empty groups and, with a single group, drops its tab bar. `FRANCHISE_ART` is optional per franchise: without an entry the franchise card shows its logo (`/art/franchises/<id>.webp`) instead of card art. Fill both in as cards are revealed, using preview ids (`REVEAL_ID_BASE + number`) of cards that already have committed AVIFs. `reveal-set-integrity.test.ts` fails if a spotlight points at an unrevealed id.

A franchise's `ink` is its one accent colour: its What's New card (NEW pill, CTA, wash, glow) and its cards modal (border, glow, eyebrow).

Set 13 had a "Team Characters" showcase (a `'team'` spotlight plus an `onSelectTeam` chain through `WhatsNewSection` and `RevealsPage`). It was removed for Set 14, which has no Team cards. If a later set brings them back, restore it from git history (`git log -S onSelectTeam`).

### 4. Things that should NOT need editing

If one of these needs a per-season edit, something regressed:

- **Unit tests** read `REVEAL_SET_CODE`, `REVEAL_ID_BASE`, `SET_TOTAL`, `inkBlock()` and `FRANCHISES[0]`.
- **`e2e/tests/reveals-page.spec.ts`** reads the set name and number from `previewCards.json` and the franchise label from the tile's own `aria-label`.
- **`features/cards/loader.ts`**: the dev image fallback keys on "no remote thumbnail", not on a set code.
- **The reveals stories** (`CardMosaic`, `InkBoard`, `CardSlot`, `FranchiseCardsModal`, `SpotlightHero`, `RevealHero`) use season-independent sample art and read `INK_BASE` / `PER_INK` / `FRANCHISES`. Preview AVIFs are deleted at graduation, so a story pointed at them rots. (Two playstyle stories, `PlaystyleFanTile` and `PlaystyleSection`, still point at `/card-images-preview/` and are already rotted; tracked separately.)
- **The Set filter.** The loader only lists a preview set once a card belongs to it, so declaring `sets[code]` ahead of the first card does not put an empty set in front of users.

## Adding cards

### Ids and filenames

- Numbered card: `id = REVEAL_ID_BASE + collector number` (Set 14 #50 is `14050`).
- Card revealed WITHOUT a collector number (common early on; 10 of 89 at Set 13's start): an id in the reserved `+900..+999` band and no `number` field, per [`PREVIEW_CARD_PARSER.md`](../PREVIEW_CARD_PARSER.md). Renumber it once the collector number is known. These can only be added by PR: the `/admin/reveal` form requires a number.
- Raw scans go in `apps/web/public/card-images-raw/` and the filename stem MUST be the numeric card id (`14050.jpg`). One bad filename fails the whole convert run.

### Ink blocks

A set is numbered ink by ink in `ALL_INKS` order, so the collector number implies the ink. `inkBlock(ink)` gives each range. **A dual-ink card sits in the block of its FIRST ink.** `/admin/reveal` rejects an ink that does not own the number, because both wrong-ink publishes in Set 13 were the form's default ink (`Amber`) left unchanged. Numbers above `SET_TOTAL` (promos, enchanteds) are not checked. If the set turns out to split unevenly (Set 13 ran 37 down to 32), fix `PER_INK` and the matching `ROWS`.

### Record conventions

`fullText` carries everything the engine reads. `abilities` needs only keyword entries for keywords the card HAS (Singer N, Shift N, Resist +N, Bodyguard, Evasive, ...); named abilities and keywords the card grants to others live in `fullText` only. No flavor text. Data fields are English even when the scan is not. `franchise` is the card's real franchise name; only a value matching a `FRANCHISES.match` groups it, everything else lands in "Returning". Keep the `&` in team names.

### First batch, by PR

Add the records to `previewCards.json`, drop the scans into `card-images-raw/`, then from the repo root:

```bash
pnpm convert-preview-images
pnpm build:engine
pnpm precompute-synergies
```

Commit `previewCards.json` plus the generated `apps/web/public/card-images-preview/{id}.avif` and `{id}-sm.avif`. Raws stay git-ignored.

**Check before committing:** tracked AVIF count must be twice the card count.

```bash
git ls-files apps/web/public/card-images-preview | wc -l
```

Production serves a preview image only when BOTH variants are committed, and it resolves them through a different path (`/card-images/{id}.{hash}.avif`) than dev (`/card-images-preview/{id}.avif`). A missing AVIF is blank in production and invisible locally.

### Every card after that: `/admin/reveal`

1. Read the scan with the `scan-reveal-card` skill (user-level, `~/.claude/skills/scan-reveal-card/`; update its set number, id base and featured franchises each season).
2. Publish from `/admin/reveal` **on the production origin**. The GitHub PAT lives in that origin's `localStorage`, so a local dev server on another port does not have it.
3. One atomic commit lands on `master`: the record in `previewCards.json` plus the raw scan. `insertCardIntoPreviewJson` throws before committing if the result would not parse or the card did not land in `cards`.
4. `.github/workflows/convert-reveal-images.yml` converts the raw, commits the AVIFs with `[skip ci]` and prunes the raw.
5. The card commit triggers `deploy.yml`. **Allow 15 to 20 minutes** (the prerender crawl). The concurrency group keeps at most one deploy running and one pending, so rapid publishes collapse.

**Merge the season switch before publishing anything.** `/admin/reveal` commits to a hardcoded `master`, and the convert workflow only fires there.

## Production

1. **Before pushing the branch,** set `VITE_IS_REVEAL_SEASON=true` in Vercel for **Production and Preview**. It is safe early: until the switch is merged the phase is `released` and nothing shows.
2. The flag is read from Vercel by `vercel pull` inside `.github/workflows/deploy.yml`. It is NOT a GitHub Actions variable.
3. Confirm the repo variable `DEPLOY_VIA_CI` is `true` (`gh variable list`). If it is unset, pushes to `master` deploy nothing, and Vercel's own git deploys for `master` are disabled in `vercel.json`.
4. `master` has no branch protection, so the PR's checks are advisory. Verify by hand: the five `e2e-tests (browser)` jobs and the size-limit check (`RevealsPage-*.js` shares a 60 kB budget with four admin chunks).
5. On the PR's Vercel preview, confirm `/reveals` renders and a card image loads from `/card-images/{id}.{hash}.avif`. That is the first exercise of the real production image path.
6. Merge. After the deploy, check the Reveals pill on `/browse` (proves the flag was inlined), then `/reveals`.

**If the flag was set after a deploy:** an env change deploys nothing, and `deploy.yml` has no `workflow_dispatch`. Re-run the latest `Deploy` run from the Actions UI, or push an empty commit whose message does not contain `[skip ci]`.

**To hide the season fast:** set the flag to `false` and re-run `Deploy`. No code change needed. Preview cards stay in the card pool.

## Gotchas

- **Two writers to `master`.** During a reveal window `/admin/reveal` pushes every few minutes. A code push that runs the multi-minute pre-push hook will lose the race and be rejected as non-fast-forward after the hook already passed. `git fetch`, `git merge origin/master`, retry. Reveal commits touch only data and images, so the merge is conflict-free.
- **The phase flip shows the home promo to every E2E spec.** `playwright.config.ts` forces the flag on, so once the dates are in the future `RevealsPromoCard` renders on `/` in all projects (a fixed bottom bar on mobile). Run the whole chromium suite, not just the reveals spec.
- **Working in a git worktree.** The three pnpm Claude hooks `cd "$CLAUDE_PROJECT_DIR"`, and the Browser-pane launcher reads `.claude/launch.json` from the same place: the directory the session was LAUNCHED in, not the worktree it later entered. From such a session, run `pnpm build:engine`, `precompute-synergies` and `convert-preview-images` by hand in the worktree, and serve it on its own port (5174) rather than through the launcher.
- **Stale `.env.local`.** `VITE_IS_REVEAL_SEASON=true` there adds about 19 kB to local bundle-size checks. A fresh worktree has no `.env.local` at all: copy it from the main checkout.
- **`/reveals` is not indexed.** It is absent from the prerender and sitemap route lists, so the SPA rewrite serves it the homepage's prerendered HTML and canonical. Harmless to the homepage; tracked as a separate issue.

## Checklist

- [ ] `revealSet.ts`: `REVEAL_SET_CODE`, `REVEAL_SET_LOGO`, `PER_INK`
- [ ] `theme.ts`: `SetCode`, `SET_ABBREVIATIONS`, `SET_NAMES`
- [ ] `previewCards.json`: new `sets[code]` with future dates, old entry dropped
- [ ] `franchise.ts` + `FEATURED_FRANCHISE_HINT`
- [ ] `CardMosaic.tsx` rows sum to `PER_INK`
- [ ] `setSpotlights.ts` cleared of last season's content
- [ ] Set logo + franchise logos added
- [ ] `scan-reveal-card` skill and `PREVIEW_CARD_PARSER.md` `SET_NAME_TO_CODE` updated
- [ ] `pnpm lint`, `pnpm test`, `tsc -b`, `check:stories`, `check:design`, full chromium E2E
- [ ] Visual check-in with the owner: hero, boards (desktop + mobile), What's New band, home promo
- [ ] Vercel flag on Production AND Preview; `DEPLOY_VIA_CI` is `true`
- [ ] PR preview shows a hashed card image; PR merged; production verified
- [ ] Only now: first `/admin/reveal` publish

When the set releases, graduate it with the runbook in [`CARD_DATA_PIPELINE.md`](../CARD_DATA_PIPELINE.md) and set the flag back to `false`.
