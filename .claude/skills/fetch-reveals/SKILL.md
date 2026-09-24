---
name: fetch-reveals
description: Fetch newly revealed cards for the current reveal season from lorcanaplayer.com, keep only the ones illumineertales.com lists as officially revealed, verify each against a blind read of its official scan, and stage the verified cards into previewCards.json with that scan as their art. Use when the owner says new cards have been revealed, or asks to fetch, sync or update the reveals. Needs the Claude in Chrome extension connected.
allowed-tools: Read, Write, Agent, Bash(node:*), Bash(git:*), Bash(pnpm:*), mcp__claude-in-chrome__list_connected_browsers, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool
---

# Fetch Reveals

Turns "new cards dropped" into staged, verified card data in one run. The owner reads one
report and approves the commit. Design and rationale: issues #571 and #574.

**Two sources, each doing what it is good at.** lorcanaplayer.com has every card's text and
stats, but it also lists leaks: cards that were never officially revealed. illumineertales.com
is the owner's reference for what is official: one slot per collector number, and a clean
scan of every revealed card, but no text. So a card is only written when the official list
shows it; its text and stats come from lorcanaplayer; its scan, read blind and shipped as
art, comes from the official list.

**Why it is a skill and not a script:** lorcanaplayer.com sits behind Cloudflare. `curl`
and automated browsers get 403 on pages and images alike; only the owner's own Chrome gets
through. So the browser half of this runs through the Claude in Chrome tools, and the rest
is `node scripts/reveal-sync/run.mjs`, which does everything deterministic and is tested
(`pnpm test:scripts`). The official list is plain HTTPS: `run.mjs` reads it, and downloads
the scans, in Node.

The season (set, size, ink blocks) is read from `apps/web/src/shared/constants/revealSet.ts`,
so the skill follows a season rotation with no edits.

## Hard rules

- **Never commit or push.** Leave the changes staged in the working tree and hand over to
  the owner, who runs `/commit-and-push`.
- **Never write a card the official list does not show as revealed, and never add one by
  hand to get around the gate.** A leak waits, deferred, and is written the day the official
  list shows it. If the official list cannot be read, the run stops; there is no way round it.
- **Never solve, click or wait out a bot check by interacting with it.** If Cloudflare shows
  an interactive challenge, stop and ask the owner to open the page in Chrome themselves.
- **Never give a reader anything but the image path and its directory.** No site values, no
  card name, no other reader's output. Independence is the point. The job list's `READ` line
  names the card for you; the reader's paths deliberately do not, so keep it that way.
- **Never translate a non-English card, and never take rarity or inkable from a reader.**
  The gates and the adjudicator enforce both; do not work around them.
- **Every reader gets its own directory.** Readers that share one read each other's crops
  and transcribe the wrong card. Each job's directory is an anonymous folder holding only
  that reader's copy of the image; use it as given.

## Step 0: Preflight and branch

1. `mcp__claude-in-chrome__list_connected_browsers` must show a connected browser. If not,
   stop: the owner needs to open Chrome with the extension.
2. The working tree must be clean (`git status --porcelain --untracked-files=no` prints
   nothing). If not, stop and tell the owner; never carry unrelated changes into a data PR.
3. Branch from a fresh `origin/master`:

   ```bash
   git fetch origin master
   git switch -c feature/set<SET>-reveals-<YYYY-MM-DD> origin/master
   ```

   `<SET>` is `REVEAL_SET_CODE` from `revealSet.ts`. If the branch exists, append `-2`.
4. Open the run:

   ```bash
   node scripts/reveal-sync/run.mjs start
   ```

   It prints the run id (`RUN` below) and the exact `discover` call for Step 2. It refuses
   to start on master, on a dirty tree, or off anything but `origin/master`, and records the
   blob of `previewCards.json` so Step 6 can detect `/admin/reveal` publishing mid-run.

   It also reads the official list, keeps it for the whole run (`official.json`), and prints
   how many cards it shows plus a **leak audit**: this set's Inkweave cards that the list does
   not show as revealed, or names differently. Show the owner any audit finding; the run never
   changes those cards. If the official list cannot be read (the site is down, its format
   changed, or it has no section for this set), `start` stops with
   `official list unavailable` and opens no run. Tell the owner and stop; do not carry on
   without it.

## Step 1: Open the site and let the check clear

The Cloudflare clearance expires after a few hours, and a page's own `fetch()` cannot renew
it; only a real navigation can.

1. `tabs_context_mcp` with `createIfEmpty: true`, then `navigate` the tab to
   `https://lorcanaplayer.com/cards/`.
2. With `javascript_tool`, wait and check:

   ```js
   await new Promise((r) => setTimeout(r, 6000));
   const probe = await fetch('/cards/', {credentials: 'same-origin'});
   JSON.stringify({title: document.title.slice(0, 60), status: probe.status})
   ```

   Carry on when `status` is 200 and the title is not "Just a moment...". If it stays on
   the check, **stop** and ask the owner to load the page in Chrome themselves.

## Step 2: Install and discover

1. `node scripts/reveal-sync/run.mjs snippet` and pass its output, verbatim, as
   `javascript_tool`'s `text`. It must return `reveal-sync/2`.
2. Run the `discover` call `start` printed. It downloads the set's index as a file and
   returns `{pages, total}`.
3. `node scripts/reveal-sync/run.mjs candidates RUN` reads that file and prints one
   `fetchCards` call per batch of 15. It warns if the site lists fewer cards than last run
   (a page probably failed to load; discover again). `--only slug-a,slug-b` fetches exactly
   the named cards whatever their state, for example to re-check one card.

Navigating the tab wipes the installed code. After any navigation, reinstall before the next call.

## Step 3: Fetch

1. Run each `fetchCards` call in order. Each returns `{fetched, failed}`. No card image is
   downloaded in the browser any more. A `failed` entry ending `:403` means the clearance
   expired mid-run: redo Step 1, reinstall, and rerun that batch.
2. `node scripts/reveal-sync/run.mjs ingest RUN` parses every page, runs the checks,
   downloads each passing card's official scan, prints the report so far, then one `READ`
   job per card that needs a blind read. It saves after every batch, so rerunning it after a
   timeout picks up where it stopped.

Before any reader runs, each card is checked, in this order:

1. **Against what Inkweave already holds**, by number **and** name: a number already used by
   another card, or a card already present under a different number or in the reserved band,
   is a conflict rather than a skip or a second copy.
2. **Against the official list**, by collector number, or by name when the page shows no
   number (the official number is then adopted). A card the list does not show as revealed
   is deferred as `not-officially-revealed`: a leak, retried every run. A card that is only
   an official promo needs a reserved-band id. An official reveal with a translation link is
   deferred as not English. A card whose name, ink, type or rarity differs between the two
   sites is an `official-mismatch` for the owner (Step 5). A card whose official entry is
   revealed but cannot be read (the site's format drifted) is deferred as
   `official-entry-unreadable`, never treated as a leak; the report's first lines name those
   entries. A different **version** does not
   stop the card: three readers settle it (Step 4). The official rarity counts only when it
   is one of the five; a blank or `PROMO` rarity there is no opinion.
3. **lorcanaplayer's own gates**: other sets, rarities outside the five, a non-English scan
   marker in the page's image filename, incomplete site records (`Keywords: Unknown`, a blank
   version, no classifications), cards with no readable collector number, and inks that
   contradict their collector-number block.
4. **The official scan** is downloaded. If the site has no scan at the URL its own page
   builds, nor under lorcanaplayer's name for the card (a renamed card keeps its old
   filename), the card is deferred as `official-image-missing` and retried next run.

## Step 4: Blind reads

For every `READ <slug> r<N>` job, spawn one `Agent` (`general-purpose`), foreground, with
the prompt below, substituting the job's `image` and `dir`. Run up to 8 at a time.

Then `node scripts/reveal-sync/run.mjs adjudicate RUN`. It decides every card whose results
are all in, and prints any new jobs. A card whose reader disagreed with the site gets two
more readers, as does one whose card text or identity (name, version, number, ink, type)
the reader could not read. A classification line or stat the reader could not read goes
straight to the owner in Step 5 instead: more readers of the same pixels rarely recover it.
A card whose version the two sites give differently always gets three readers; the version
two of them read is written, whichever site it came from, with a note either way. A reader
who reads any language code other than EN in the card's footer (however it is written:
`FR`, `French`, `fr-FR`) defers the card as not English. A code no reader could read is
treated like an unreadable identity field: two more readers, then the owner.
Repeat this step until it prints "No reader jobs outstanding".

A job listed again has no usable `result.json`; the listing says why when there is a file
but it is unusable. Rerun that reader. `adjudicate` never decides a card while any of its
readers' results is missing or unusable.

### Reader prompt

```
Read the Lorcana card image at {IMAGE} using the Read tool, and transcribe exactly what is
printed on it.

WORKING DIRECTORY RULE: every temporary file you create (crops, magnifications,
contrast-enhanced copies) MUST be written inside this directory and nowhere else:
{DIR}
Use simple filenames inside that directory. Never write to its parent.

INTEGRITY CHECK: after writing any crop, confirm the file you read back is the one you just
wrote (check its dimensions match what your command produced). If a file's content does not
match what you asked for, stop and report it.

You have NO other information about this card. Do not infer anything from outside the
image. Do not search the web or the repo. Read no file other than the image and the files
you create yourself.

Produce compact JSON with these keys:
- name, version (the subtitle under the name; null for Action/Item/Song)
- cost (top-left gem number)
- strength (characters only), willpower (characters and locations), lore (count of diamond
  pips right of the text box), moveCost (locations only); null where the card has none
- inkColor: frame colour, one of Amber/Amethyst/Emerald/Ruby/Sapphire/Steel (two if dual-ink)
- type: Character/Action/Item/Location
- classifications: the line under the name bar, as printed
- keywords: array of keyword abilities THIS card HAS, with values (e.g. "Singer 5",
  "Shift 3", "Resist +1"). Exclude keywords it merely grants to other characters. Exclude
  ALL-CAPS named ability titles.
- cardText: array, one printed ability per line, INCLUDING keyword reminder text in
  parentheses. EXCLUDE the italic flavour quote at the bottom. Preserve the hexagon (ink),
  diamond (lore) and exert symbols where they appear, writing them as the unicode characters
  you see. If the card has NO rules text at all, return an empty array.
- collectorNumber: the "N/204" at bottom left, or null if not printed
- language: the two-letter language code printed after the collector number at bottom left
  (for example EN, FR, DE, IT, JA, ZH), or null if you cannot read it
- illustrator: the bottom-left credit
- inkable: true if the cost gem has an ornate decorative frame around it, false if plain
- rarityGuess: describe the symbol at bottom centre in a few words; name the rarity only if
  confident

For any field you cannot read with confidence use null and list the key in an "unreadable"
array. Do NOT guess.

Finally, write exactly that JSON, and nothing else, to {DIR}\result.json with the Write
tool, then return the same JSON as your answer.
```

Two clauses are load-bearing: "Do NOT guess" with the `unreadable` array is what produced
honest nulls on a blurred text box instead of invented abilities, and the flavour-text
exclusion keeps non-functional prose out of the data. The `language` key is the only direct
check that the scan Inkweave ships is English: the official list's translation link is not
always set (a French-first reveal once had none).

## Step 5: Conflicts

Show the owner the report's **NEEDS YOUR CALL** section, verbatim.

In the report, `site` always means lorcanaplayer and `official` the official list, the same
words `resolve` takes.

- A field the site and the readers could not settle (`unsettled`) takes the owner's ruling:
  `node scripts/reveal-sync/run.mjs resolve RUN <slug> <field>=site` to take the site's
  value, `<field>=official` for the official list's (it carries the name, version and
  collector number), or `<field>=<value>` for a value they supply (for `text`, separate
  abilities with `\n`). A ruling that does not parse is refused, never written as a blank.
  The report shows each such field as `site "..."; readers ...` (plus `official "..."` when
  the official list gave a different version), with `unreadable` where a reader could not
  make it out. For classifications only the terms matter, not their order. A language code
  no reader could read shows as `language: site "EN"; readers unreadable, ...`: rule
  `language=site` only after checking the scan yourself; a card that is not in English
  simply waits.
- A card the two sites disagree on (`official-mismatch`) shows each field as
  `site "..."; official "..."`. The owner rules on each with
  `node scripts/reveal-sync/run.mjs resolve RUN <slug> <field>=site|official|<value>`, for
  `name`, `ink`, `type` or `rarity`. Once no field is left in dispute, the card gets its
  official scan and a reader in the same run, and `resolve` prints the new `READ` job: run
  Step 4 for it. The readers still check a ruled name, ink and type against the card.
- A card that is only an official promo (`needs-reserved-band`, detail `official promo ...`)
  has no set number yet. Like every other `needs-reserved-band`, `in-reserved-band`,
  `number-taken`, `name-taken` and `ink-block-mismatch`, it needs a fix in the data by hand.
  It stays in the report and is retried on every run. A card with no collector number is
  added with a reserved-band id (see `docs/PREVIEW_CARD_PARSER.md`), and renumbered once the
  site shows its number.

Anything unresolved is simply not written, and is retried next run.

## Step 6: Write and hand over

```bash
node scripts/reveal-sync/run.mjs write RUN
pnpm precompute-synergies
```

`write` first re-fetches `origin/master` and aborts, writing nothing, if `previewCards.json`
changed there since `start`. Then, in an order that never leaves the card data ahead of its
art: it validates each verified card through the same chain `/admin/reveal` uses
(`validateRevealCardForm`, `buildPreviewCard`, `insertCardIntoPreviewJson`), converts the
accepted cards' scans to the committed AVIFs (never replacing art that already exists),
and only then inserts the cards whose art converted and writes `previewCards.json` once.
A card whose art fails becomes a conflict and is retried next run. Last, it updates
`scripts/reveal-sync/state.json` and prints the final report.

Show the owner the full report, then stop. They review `git status` and run `/commit-and-push`.

Besides the card sections, the report ends with two lists the owner should see:

- **ON INKWEAVE, CHECK AGAINST THE OFFICIAL LIST**: the `start` leak audit. Cards already
  in Inkweave that the official list does not show as revealed, or shows under another name.
  Removing or renaming one is the owner's call; the run never does it.
- **OFFICIAL, NOT ON LORCANAPLAYER YET**: official cards lorcanaplayer has not added, so
  they come in on a later run. Until a run has fetched every page once, a card lorcanaplayer
  names differently (a translated first reveal) can show here too.

`node scripts/reveal-sync/run.mjs report RUN` reprints the report at any point.

## Where things live

| What | Where |
|---|---|
| Deterministic pipeline | `scripts/reveal-sync/*.mjs`, tests alongside |
| Run-to-run memory | `scripts/reveal-sync/state.json` (committed) |
| One run's files | `%TEMP%/inkweave-reveal-sync/<RUN>/`: `run.json`, `official.json` (the official list as `start` read it), `cards/<slug>/` (site record, official scan), `blind/<token>/` (one per reader) (`REVEAL_SYNC_RUNS` overrides) |
| Official list | `https://illumineertales.com/cards.json` (`REVEAL_SYNC_OFFICIAL_ORIGIN` overrides the origin) |
| Browser downloads | `~/Downloads`, moved into the run as they land (`REVEAL_SYNC_DOWNLOADS` overrides) |
