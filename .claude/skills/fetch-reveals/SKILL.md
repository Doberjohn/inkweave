---
name: fetch-reveals
description: Fetch newly revealed cards for the current reveal season from lorcanaplayer.com, verify each one against a blind read of its own card image, and stage the verified cards into previewCards.json with their art. Use when the owner says new cards have been revealed, or asks to fetch, sync or update the reveals. Needs the Claude in Chrome extension connected.
allowed-tools: Read, Write, Agent, Bash(node:*), Bash(git:*), Bash(pnpm:*), mcp__claude-in-chrome__list_connected_browsers, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool
---

# Fetch Reveals

Turns "new cards dropped" into staged, verified card data in one run. The owner reads one
report and approves the commit. Design and rationale: issue #571.

**Why it is a skill and not a script:** lorcanaplayer.com sits behind Cloudflare. `curl`
and automated browsers get 403 on pages and images alike; only the owner's own Chrome gets
through. So the browser half of this runs through the Claude in Chrome tools, and the rest
is `node scripts/reveal-sync/run.mjs`, which does everything deterministic and is tested
(`pnpm test:scripts`).

The season (set, size, ink blocks) is read from `apps/web/src/shared/constants/revealSet.ts`,
so the skill follows a season rotation with no edits.

## Hard rules

- **Never commit or push.** Leave the changes staged in the working tree and hand over to
  the owner, who runs `/commit-and-push`.
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
   `javascript_tool`'s `text`. It must return `reveal-sync/1`.
2. Run the `discover` call `start` printed. It downloads the set's index as a file and
   returns `{pages, total}`.
3. `node scripts/reveal-sync/run.mjs candidates RUN` reads that file and prints one
   `fetchCards` call per batch of 15. It warns if the site lists fewer cards than last run
   (a page probably failed to load; discover again). `--only slug-a,slug-b` fetches exactly
   the named cards whatever their state, for example to re-check one card.

Navigating the tab wipes the installed code. After any navigation, reinstall before the next call.

## Step 3: Fetch

1. Run each `fetchCards` call in order. Each returns `{fetched, images, failed}`.
   A `failed` entry ending `:403` or `:image-403` means the clearance expired mid-run: redo
   Step 1, reinstall, and rerun that batch.
2. `node scripts/reveal-sync/run.mjs ingest RUN` parses every page, runs the checks, prints
   the report so far, then one `READ` job per card that needs a blind read. It saves after
   every batch, so rerunning it after a timeout picks up where it stopped.

Before any reader runs, each card is checked against what Inkweave already holds, by
number **and** name: a number already used by another card, or a card already present
under a different number or in the reserved band, is a conflict rather than a skip or a
second copy. Then the gates stop: other sets, rarities outside the five, non-English scans,
incomplete site records (`Keywords: Unknown`, a blank version, no classifications), cards
with no readable collector number, and inks that contradict their collector-number block.

## Step 4: Blind reads

For every `READ <slug> r<N>` job, spawn one `Agent` (`general-purpose`), foreground, with
the prompt below, substituting the job's `image` and `dir`. Run up to 8 at a time.

Then `node scripts/reveal-sync/run.mjs adjudicate RUN`. It decides every card whose results
are all in, and prints any new jobs. A card whose reader disagreed with the site gets two
more readers, as does one whose card text or identity (name, version, number, ink, type)
the reader could not read. A classification line or stat the reader could not read goes
straight to the owner in Step 5 instead: more readers of the same pixels rarely recover it.
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
exclusion keeps non-functional prose out of the data.

## Step 5: Conflicts

Show the owner the report's **NEEDS YOUR CALL** section, verbatim.

- A field the site and the readers could not settle (`unsettled`) takes the owner's ruling:
  `node scripts/reveal-sync/run.mjs resolve RUN <slug> <field>=site` to take the site's
  value, or `<field>=<value>` for a value they supply (for `text`, separate abilities with
  `\n`). A ruling that does not parse is refused, never written as a blank. The report
  shows each such field as `site "..."; readers ...`, with `unreadable` where a reader could
  not make it out. For classifications only the terms matter, not their order.
- Everything else in that section (`needs-reserved-band`, `in-reserved-band`,
  `number-taken`, `name-taken`, `ink-block-mismatch`) needs a fix in the data by hand. It
  stays in the report and is retried on every run. A card with no collector number is added
  with a reserved-band id (see `docs/PREVIEW_CARD_PARSER.md`), and renumbered once the site
  shows its number.

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

`node scripts/reveal-sync/run.mjs report RUN` reprints the report at any point.

## Where things live

| What | Where |
|---|---|
| Deterministic pipeline | `scripts/reveal-sync/*.mjs`, tests alongside |
| Run-to-run memory | `scripts/reveal-sync/state.json` (committed) |
| One run's files | `%TEMP%/inkweave-reveal-sync/<RUN>/`: `run.json`, `cards/<slug>/` (site record, scan), `blind/<token>/` (one per reader) (`REVEAL_SYNC_RUNS` overrides) |
| Browser downloads | `~/Downloads`, moved into the run as they land (`REVEAL_SYNC_DOWNLOADS` overrides) |
