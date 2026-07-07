# Admin Tuning Editor — engine copy + scores — Design

**Issue**: TBD (to be drafted via `/draft-issue` after spec approval)
**Date**: 2026-07-07
**Status**: Draft (awaiting user review)

## Goal

A third `/admin` subroute (alongside `image` and `analytics`) that is a **control panel for
the engine's editable text and scores**. The whole experience is:

1. Open the page.
2. **Select a rule** — either a playstyle (Ramp, Discard, a tribe…) or a direct synergy (Shift
   Targets, Companions, Singer + Songs…).
3. **See every editable text that rule can show** — its name, its tagline/description, and the
   full list of the explanation lines it can display — each with its score.
4. **Edit any of them individually** — change one line, several, or all.
5. **Publish** — one commit to `master`; after the deploy, **every pair that uses those texts
   shows the new wording and score**.

You never pick a card pair. You edit a rule's texts once, and the change fans out to all of its
pairs automatically. That fan-out is the engine's job, described in **Implementation** at the
end — you never see it.

## What's editable, per rule

Every rule presents a uniform shape:

| Rule kind | Name field | Long field | The list of texts |
|-----------|-----------|-----------|-------------------|
| **Playstyle** (Ramp, Discard, tribes…) | Title (e.g. "Ramp") | Tagline (e.g. "Speed up your ink…") | Each explanation the playstyle's synergies can show, + its score |
| **Direct synergy** (Shift Targets, Companions…) | Label (e.g. "Shift Targets"; note `named-companions` displays as "Companions") | Description | Each explanation the rule can show, + its score |

A rule has **several** texts, not one, because it says something different in each situation it
detects — e.g. Shift shows one line for a free Shift onto a cheap base and a different line for a
wide curve gap. You see the whole list and edit each line independently.

## The editing experience

Selecting **Shift Targets** (a direct synergy) shows its name, description, and its full list of
texts + scores. You edit any field directly:

```
▸ Shift Targets                                        (direct synergy)

  Name          [ Shift Targets                                        ]
  Description   [ Characters with Shift and their valid targets        ]

  Texts this rule can show                                        score
  ─────────────────────────────────────────────────────────────  ─────
  Free Shift onto a cheap base   [ Free Shift. Play <BASE> early… ]  [ 9 ]
  Free Shift, mid-cost base      [ Free Shift saves ink, but <BA… ]  [ 7 ]
  Perfect curve, both inkable    [ Perfect curve. Both cards ink… ]  [ 9 ]
  Wide 3-turn gap                [ Wide 3-turn gap. Playable but… ]  [ 5 ]   ← your example: type 6
  Same cost, no savings          [ Same cost. No ink savings fro… ]  [ 5 ]
  …(the rest of the list)
```

Selecting a **playstyle** like **Ramp** shows the same shape — Title, Tagline, then its list of
texts + scores.

**Tokens like `<BASE>` / `<SHIFT>`** appear literally in some texts. They are placeholders the
app fills with the two card names when it displays the line (e.g. `<BASE>` becomes "Simba - Young
Prince"). You leave them in place and edit the words around them.

**Batching + publish:** edits accumulate in a **pending-changes tray** as you go. A **diff
preview** (old → new) shows before you commit. **Publish** writes one commit; Publish stays
disabled until you've entered a GitHub token and every pending edit is valid (score an integer
1–10, text non-empty).

**Auth** reuses the existing `GithubTokenGate` + `useGithubToken()` (localStorage key
`inkweave.reveal-admin.gh-token`), so a token entered for reveal-admin or image-admin already
works here.

## v1 scope

- **Editable everywhere in v1:** the **name + tagline/description** of every playstyle and
  every direct synergy.
- **Full text-list editing in v1:** **Shift Targets** and **Ramp** — their complete list of
  situational texts + scores. This is the starter set that proves the whole edit → publish →
  redeploy loop end to end.
- **Other rules' text lists:** selecting them in v1 shows their name/tagline as editable, with
  their text list marked "coming in a later phase." Each additional rule is migrated one at a
  time afterward (see Future phases).

## Non-goals (v1)

- **Editing a single pair.** There is no per-pair override; you always edit a rule's shared
  text, and every matching pair inherits it. (A per-pair override layer is a possible future
  feature, deliberately out of scope.)
- **Formula-scored rules** (Spike Suit, both Merida rules). Their scores come from arithmetic,
  not a fixed list, so only their texts + tunable constants could ever be exposed — deferred.
  (Shift is *not* one of these; it is a fixed list and is in v1.)
- **Instant display.** Edits ride a full deploy cycle, same as reveal-admin. Not seconds-live.
- **PR / review gate.** Publishing commits straight to `master` (see Risks). No PR flow in v1.
- **Community votes feeding scores.** The Supabase `pair_scores_view` stays analytics-only.

## Key decisions (locked with the user)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| What you edit | A **rule's shared texts + scores**, never an individual pair | One edit, consistent everywhere; respects the documented 5-baseline scoring discipline |
| How it's stored | The editable texts/scores move out of rule code into **one committed data file** the engine reads | A browser can safely edit + commit *data*; it cannot safely edit live TypeScript source |
| v1 coverage | Names/taglines for all rules + full text lists for **Shift + Ramp** | Proves the loop before expanding rule-by-rule |
| Route name (default, overridable) | `/admin/tuning` | Covers both copy and scores |
| Config file (default, overridable) | Single `tuning.json` | One file the editor round-trips |

---

## Implementation (engine internals — you never see this)

This section is *how* an edited rule text reaches every pair. It exists for the implementer; none
of it surfaces in the editor UI.

### Where the texts live today, and why a build step is involved

The texts + scores are currently **code literals inside the scoring functions** — e.g. Shift's
wide-gap case in [`rules.ts`](../../../packages/synergy-engine/src/engine/rules.ts) literally
returns `{score: 5, reason: "Wide 3-turn gap. Playable but slow to set up."}`. The engine runs
these functions over every card pair **at build time** and bakes the results into
`apps/web/public/data/synergies/{cardId}.json` (git-ignored, regenerated on every deploy). So an
edited text becomes visible after the next build regenerates that data — there is no per-pair
storage to patch.

### One committed config the engine reads

```
packages/synergy-engine/src/data/
  tuning.json   ← source of truth (the editor reads + commits this)
  tuning.ts     ← typed wrapper: import raw from './tuning.json'; export const TUNING = raw as TuningConfig

Build (Vercel deploy or the local auto-rebuild hook):
  tuning.json ──► engine bundle (tsup/esbuild inlines JSON) ──► precompute-synergies.mjs
                                                                 └─► synergies/*.json (regenerated)
```

The config lives in the **engine package** (not `apps/web/public`) because precompute consumes
the built engine directly. Committing to `packages/synergy-engine/src/data/tuning.json` uses the
same GitHub-API path reveal-admin already uses, just a different file.

Internally each rule's text list is keyed by the **situation** the rule detects (the "situation"
is exactly what produced the human-readable row label in the editor, e.g. "Wide 3-turn gap"). The
branching logic that decides which situation a pair is in **stays in code**; only the text +
score for each situation moves into `tuning.json`.

```jsonc
{
  "playstyles": {
    "ramp": { "name": "Ramp", "tagline": "Speed up your ink so you can play powerful cards earlier than your opponent." }
    // …all 21 playstyle ids
  },
  "directRules": {
    "shift-targets":    { "name": "Shift Targets", "description": "Characters with Shift and their valid targets" },
    "named-companions": { "name": "Companions",    "description": "…" }
  },
  "ruleTexts": {
    "shift-targets": {
      "free.cheapBase":      { "score": 9, "text": "Free Shift. Play <BASE> early, then shift <SHIFT> in for 0 ink." },
      "free.midBase":        { "score": 7, "text": "Free Shift saves ink, but <BASE> takes longer to set up." },
      "free.expensiveBase":  { "score": 5, "text": "Free Shift, but <BASE> is expensive and hard to set up first." },
      "curve.bothInkable":   { "score": 9, "text": "Perfect curve. Both cards inkable as fallback." },
      "curve.oneInkable":    { "score": 8, "text": "Perfect curve. One card inkable as fallback." },
      "curve.neitherInkable":{ "score": 7, "text": "On curve, but neither card is inkable. Less flexible off-curve." },
      "curve.gap2":          { "score": 7, "text": "Smooth curve. <BASE> flows into Shift in a couple of turns." },
      "curve.gap0":          { "score": 5, "text": "Same cost. No ink savings from Shifting, but skips the drying phase." },
      "curve.gap3":          { "score": 5, "text": "Wide 3-turn gap. Playable but slow to set up." },
      "curve.poor":          { "score": 3, "text": "The cost gap makes it hard to set up <BASE> in time to Shift." },
      "activationBonus":     { "text": "Same target. Also unlocks the free Shift condition." }
    },
    "ramp": {
      "chain.deckRepeating": { "score": 9, "text": "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect." },
      "chain.deckOnce":      { "score": 8, "text": "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect." },
      "chain.sacRepeating":  { "score": 8, "text": "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect." },
      "chain.sacOnce":       { "score": 7, "text": "{RAMP} adds ink to your inkwell, triggering {TRIGGER}'s inkwell effect." },
      "density":             { "score": 5, "text": "Both accelerate your ink. Gets you ahead faster." }
    }
  }
}
```

A **row that the editor shows = one entry here.** The editor's human-readable row label ("Wide
3-turn gap") is a friendly display name mapped to the entry key (`curve.gap3`); the `text` and
`score` are the editable fields. Some entries carry only a `text` (the activation bonus, whose
number is computed as `base.score + 1`), which the editor renders with the score field disabled.

> **Modeling note vs. today's Ramp code:** Ramp currently stores its explanation *templates*
> separately from its *scores* (`RAMP_EXPLANATIONS` keyed by pair-shape, scores computed by a
> chain classifier), and one shared template (`ramp-trigger`) currently serves four different
> chain scores (deckRepeating 9, deckOnce 8, sacRepeating 8, sacOnce 7). To give the editor one
> clean "row = text + score" shape, the v1 migration **denormalizes** Ramp into per-situation
> `{score, text}` entries like Shift — so those four rows seed with the same text but become
> **independently editable** afterward (which is exactly the "edit each individually" behavior
> you asked for). The snapshot-equivalence test (below) guarantees the seed reproduces today's
> exact output; this is also why the Open Questions offer to swap Ramp for a rule that already
> fits the shape.

### Engine refactor (behavior-identical)

- **tsconfig**: add `"resolveJsonModule": true` to
  [`packages/synergy-engine/tsconfig.json`](../../../packages/synergy-engine/tsconfig.json) (one
  line; tsup already bundles JSON via esbuild).
- **`playstyles.ts`**: build the playstyle array from `TUNING.playstyles`; keep
  `getAllPlaystyles()` / `getPlaystyleById()` signatures unchanged.
- **`rules.ts` (direct-rule labels)**: `synergyRules` entries read `name`/`description` from
  `TUNING.directRules[id]`.
- **`rules.ts` (Shift)**: `freeShiftScore` / `onCurveScore` / `curveAlignmentScore` / the
  activation bonus return `TUNING.ruleTexts['shift-targets'][key]` instead of inline literals —
  the `if` branches (which situation) stay; only the returned value becomes a lookup.
- **`ruleScoring.ts` (Ramp)**: the chain classifier + explanation builder resolve their
  `{score, text}` from `TUNING.ruleTexts.ramp[key]`.

**Safety net:** a snapshot test captures precompute output for a fixture card set *before* the
refactor and asserts it is byte-identical *after* seeding `tuning.json` with today's values — the
proof the extraction (and the Ramp fold) changed nothing.

### Admin route wiring

- Route in [`router.tsx`](../../../apps/web/src/router.tsx) wrapped in `SuspenseWrapper` (no
  `AdminGate` in v1 — matches `/admin/reveal` and `/admin/image`; a `VITE_SHOW_ADMIN_TUNING` gate
  is a cheap optional add).
- Feature dir `apps/web/src/features/tuning-admin/` (page, `useTuningAdmin` hook, `githubClient.ts`
  wrapper, components), exported via `index.ts` like the other admin features.
- **Commit**: reuse `commitFiles` — read `tuning.json` from `master`, apply the batched edits,
  commit one file: `chore(engine): tune scoring copy + scores`.

### Data flow / deploy latency

```
Publish → commit tuning.json to master
        → Vercel build runs `pnpm build` (engine bundles new JSON)
        → precompute-synergies regenerates apps/web/public/data/synergies/*.json
        → new copy + scores live
```

Same commit → redeploy latency as reveal-admin today. Not instant; acceptable per Non-goals.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Publishing commits straight to `master`, bypassing PR + pre-push E2E + engine-validator. | These are *values*, and CLAUDE.md already sanctions "card DATA direct-to-master, rendering CODE via PR". The form (not free-text) constrains what can change. |
| A malformed edit could break the deploy build. | Client-side validation (score integer 1–10, text non-empty, known keys) gates Publish; plus a `tuning.json` validation **test** so CI/pre-push also catch drift. |
| The refactor silently changes scores. | Snapshot-equivalence test (before/after byte-identical precompute) is a hard gate. |
| Doc drift — the CLAUDE.md / `*_RULE.md` score tables become runtime-editable. | Keep the v1 set small; note the drift explicitly; future phase: generate the doc tables *from* `tuning.json`. |
| New JSON-import convention in the engine (none today). | Isolated to one `data/` dir + a one-line tsconfig change; validated by the shape test. |

## Testing

- **Refactor snapshot-equivalence** test (Shift + Ramp precompute output unchanged).
- **`tuning.json` validator** test: shape matches `TuningConfig`; every referenced key exists;
  where present, `score` is an integer 1–10 and `text` is non-empty.
- **Editor unit tests**: validation rejects score 11 / empty text; batch tray accumulates and
  clears; `commitFiles` payload shape is correct (path + base64 of edited JSON).
- No new E2E in v1 (admin routes are discoverability-gated and E2E-light today).

## Future phases (not v1)

1. Migrate each remaining rule's text list into `tuning.json` (Lore Denial, Discard, all tribal
   matrices, …), lighting up its full editor list one rule at a time.
2. Expose formula-rule constants + texts (Spike Suit, Merida ×2) as a distinct section.
3. Generate the CLAUDE.md / `*_RULE.md` score tables from `tuning.json` to end doc drift.
4. Optional `VITE_SHOW_ADMIN_TUNING` gate + a nav entry if the admin area grows a menu.

## Open questions for review

- **Route name** `/admin/tuning` and **single `tuning.json`** are defaults — say if you'd prefer
  `/admin/scoring` or split files.
- **Starter set** is Shift + Ramp. Ramp needs a small internal fold (see the modeling note) to
  fit the uniform row shape; if you'd rather prove the loop with a rule that already fits (a
  tribal matrix), name it and I'll swap.
