# Synergy Mechanics Taxonomy

**Status:** ✅ Implemented (item 3 — auto-generated mechanics tiles).
**Goal:** Replace the hardcoded, per-playstyle "mechanics cards" wiring (`RoleTileRow`) with a single, regex-driven mechanics catalog that every playstyle draws from deterministically in the engine loop. Adding a playstyle should surface its mechanics tiles with **zero per-mechanic boilerplate**; an unseen mechanic should be **one new regex** in the catalog.

**Delivered:** the catalog (`mechanics.ts`) is the single source of truth for every tile's id/label/description. `getRoleChips` (web) builds tiles from each playstyle's structural roles ∪ `getCardMechanics`, canonicalised + deduped, with labels from `mechanicLabel`/`mechanicDescription`. The per-playstyle `*_ROLE_CHIP_LABELS`/`*_DESCRIPTIONS` maps were removed (only `LOCATION_ROLE_*` remain — `ConnectionGroup` uses their location-name-templated descriptions, a different surface). `RoleTileRow` is a horizontal-scroll carousel (~8 tiles visible). Result: the same mechanic reads identically in every playstyle, and every playstyle surfaces all mechanics its cards exhibit. One exception: on a classification tribe's page, `in-play-check` and `trigger` (whose catalog text is worded for Location Control and Floodborns) name the tribe through `tribalMechanicDescription`, e.g. "Get benefits when you have a Madrigal character in play".

---

## 1. Locked decisions (agreed)

1. **Scoring stays on the existing structural roles.** The 5/7/8 matrices (`scoreToyPair`, `scoreDwarfsPair`, …) are untouched. We only change how the **display tiles** are produced.
2. **Display tiles are auto-generated** from the catalog + the rule's structural roles, deterministically per engine loop.
3. This report lives at `packages/synergy-engine/MECHANICS_TAXONOMY.md`.

---

## 2. The problem, precisely

Tiles are *already* regex-derived: `getRoleChips()` → `ROLE_CONFIGS[playstyleId].getRoles(card)` → tally. What's wrong is the **wiring**, not the idea:

- Each playstyle hardcodes **4 artifacts**: a `Role` union type + `getXRoles()` detector (engine) + `XXX_ROLE_CHIP_LABELS`/`DESCRIPTIONS` (engine) + a `ROLE_CONFIGS` entry (web).
- Shared mechanics are handled **inconsistently**. Toy *composes* generic mechanics (`getLoreDenialRoles`, `getDiscardRoles`, `getRampRoles` + its own `draw`); every other playstyle shows only its own roles. So **Dwarfs cards that draw show no Card Draw tile**.
- **No single source of truth** per mechanic → the same mechanic is re-detected and even **relabeled** (`Burn` in Lore Denial vs `Lore Burn` in Toy).
- Several real, recurring mechanics are detected **nowhere** (lore buff, stat buff, keyword grant).

---

## 3. Two-tier model

| Tier | What it is | Detection home | Drives |
|------|-----------|----------------|--------|
| **Structural roles** | A playstyle's *defining* mechanics + membership | The rule (`getToyRoles`, `getDwarfsRoles`, `LOCATION_PATTERNS`, …) | **Scoring** + tiles |
| **Generic mechanics** | Cross-playstyle mechanics that recur on any card | **Central catalog** (this doc) | **Tiles only** |

A mechanic can be a **structural role in its home playstyle** *and* a **generic display mechanic elsewhere** (e.g. `burn`/`steal` are Lore Denial's scoring roles, but a Card-Draw-style tile anywhere a card burns). The catalog owns **detection for display**; the home playstyle keeps its scoring role (optionally backed by the same catalog detector — a Phase-2 de-dup, not required).

**Display tiles for a playstyle = (generic mechanics present on its cards) ∪ (its structural roles present), minus `member`.**

---

## 4. Structural roles inventory (stay in the rules; drive scoring)

| Playstyle | Structural roles | Detector |
|---|---|---|
| Lore Denial | `burn`, `steal` | `LORE_LOSS_PATTERN`, `LORE_STEAL_PATTERNS` |
| Locations | `at-payoff`, `move`, `play-trigger`, `in-play-check`, `search`, `buff`, `boost`, `location-ramp` | `LOCATION_PATTERNS` |
| Discard | `targeted`, `random`, `standard`, `payoff` | `DISCARD_*_PATTERN` |
| Ramp | `inkwell-ramp`, `inkwell-trigger`, `cost-reduction` | `INKWELL_*`, `COST_REDUCTION_GRANT` |
| Sacrifice | `self-banish`, `banish-trigger` | `SACRIFICE_*_PATTERN` |
| Toy | `member`, `search`, `banish-trigger`, `self-discount` | classification + Toy-scoped regex |
| Seven Dwarfs | `member`, `density`, `recruit`, `return` | classification + `DWARFS_*_PATTERN` |
| Ink Drops | `drop-maker` (alias of the generic `ink-drop-gain`), `drop-payoff`, `drop-shared` (display-only) | `getInkDropRoles` in `utils/inkDrops.ts` |

> Note the overlaps: Lore Denial's `burn`/`steal`, Ramp's three roles, and Discard's three disruption roles are **also generic mechanics** (§5). They stay structural for *scoring* in their home; the catalog supplies the *tile* everywhere.

---

## 5. Generic mechanics catalog (the single source of truth)

Each entry becomes one `MECHANICS` registry record: `{ id, label, description, detect }`. Regexes below are the canonical detectors (existing where noted, new where flagged).

| id | label | description | canonical regex / detector | source today |
|----|-------|-------------|----------------------------|--------------|
| `draw` | Card Draw | Draw extra cards | `/(?:you may )?draws? (?:a\|\d+) cards?/i` | `DRAW_PATTERN` (Toy only) |
| `lore-burn` | Lore Burn | Make opponents lose lore | `LORE_LOSS_PATTERN` (non-steal) | `getLoreDenialRoles` |
| `lore-steal` | Lore Steal | Opponent loses lore **and** you gain it | `LORE_STEAL_PATTERNS` | `getLoreDenialRoles` |
| `discard-targeted` | Targeted Discard | Pick the card type the opponent discards | `DISCARD_TARGETED_PATTERN` | `getDiscardRoles` |
| `discard-random` | Random Discard | Opponent discards at random | `DISCARD_RANDOM_PATTERN` | `getDiscardRoles` |
| `discard-forced` | Forced Discard | Opponent chooses and discards | `DISCARD_GENERIC_PATTERNS` | `getDiscardRoles` |
| `inkwell-ramp` | Ink Ramp | Put extra cards into your inkwell | `INKWELL_RAMP_PATTERNS` | `getRampRoles` |
| `inkwell-trigger` | Ink Trigger | Trigger on inkwell events | `INKWELL_TRIGGER_PATTERNS` | `getRampRoles` |
| `cost-reduction` | Cost Reduction | Discount other cards you play | `COST_REDUCTION_GRANT` (not self) | `getRampRoles` |
| `lore-buff` | Lore Boost | Give a character +◊ (lore) for the turn | `/gets?\s*\+\d+\s*◊/i` | **NEW (gap)** |
| `stat-buff` | Stat Boost | Give +¤ / +⛉ (strength / willpower) | `/gets?\s*\+\d+\s*[¤⛉]/i` | **NEW (gap)** |
| `keyword-grant` | Keyword Grant | Grant Rush / Evasive / Resist / … | `/gains?\s+(Rush\|Evasive\|Bodyguard\|Ward\|Resist\|Challenger\|Reckless\|Support\|Singer)\b/i` | **NEW (gap)** |
| `ink-drop-gain` | Creates Ink Drops | Get ink drops you can remove later to pay 1 ⬡ each | `getInkDropGain(card) > 0` | `INK_DROP_GAIN` (Shift rule); Ink Drops `drop-maker` aliases to it (#624) |

---

## 6. Cross-playstyle matrix (data-backed, live DB)

Count = cards **within** each playstyle whose text exhibits the mechanic. Generated by `scratchpad/mech-matrix.mjs` against the current `_playstyles.json` + `allCards.json`.

> Snapshot from #385 (2026-06-23), covering the seven playstyles below. It is not regenerated as playstyles are added, so later ones, Ink Drops included, are absent.

| playstyle | cards | draw | lore-buff | str-buff | will-buff | kw-grant | burn | steal | discard | ramp | trigger | cost-red |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| lore-denial | 24 | 3 | 0 | 2 | 0 | 0 | 14 | 10 | 0 | 0 | 0 | 0 |
| locations | 105 | 14 | 8 | 8 | 5 | 11 | 2 | 1 | 1 | 3 | 1 | 5 |
| discard | 39 | 4 | 2 | 2 | 0 | 0 | 0 | 0 | 37 | 1 | 1 | 0 |
| ramp | 91 | 8 | 3 | 2 | 0 | 9 | 0 | 0 | 2 | 39 | 28 | 24 |
| sacrifice | 47 | 11 | 1 | 3 | 0 | 2 | 0 | 1 | 2 | 5 | 0 | 0 |
| toy | 24 | 4 | 1 | 2 | 1 | 2 | 1 | 1 | 1 | 0 | 0 | 1 |
| dwarfs | 17 | 6 | 2 | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 |

**Reading the matrix:**
- `draw` appears in **all 7** playstyles → strongest case for a shared mechanic. Only Toy surfaces it today.
- `lore-buff` / `stat-buff` / `keyword-grant` recur widely but are surfaced **nowhere** (pure gaps).
- `burn`/`steal`, `discard`, `ramp/trigger/cost-red` are concentrated in their home playstyle (as expected) with real spillover elsewhere — confirming they're both structural *and* generic.

---

## 7. Gaps & examples (new mechanics to add)

Cards exhibiting mechanics the engine cannot currently see, from the Dwarfs set alone:
- **Lore Boost:** Dopey - Drawn to Music, **Sneezy - Startlingly Loud** (your original example, "+1 ◊ this turn").
- **Stat Boost:** Sneezy - Noisy Knight ("Challenger +2").
- **Keyword Grant:** Bashful, Grumpy, Happy, Sneezy (Knight versions grant Evasive / Bodyguard / etc.).

These are exactly the "new-shown mechanic → add a regex" case: each is one catalog row.

---

## 8. Label policy

The registry holds a **canonical label** (`Card Draw`, `Lore Burn`). Toy's existing per-playstyle disambiguation (`Lore Burn` vs Lore Denial's `Burn`) is supported via an **optional per-playstyle label override** map, so we don't regress the intentional "Strategy B" naming. Default = canonical label; override only where context demands it.

---

## 9. Open decisions (resolve before Phase 3)

1. **Tile noise / relevance threshold.** Auto-generating from the full catalog means a Lore Denial page could show `Card Draw`, `Stat Boost`, `Keyword Grant` tiles. Options: (a) show **all** detected mechanics (most honest, noisiest); (b) **frequency threshold** (e.g. ≥2 cards); (c) per-playstyle **primary set**. *Recommendation: (b) a small count threshold, tunable.*
2. **Structural/generic edge cases.** `search` and `banish-trigger` are structural+scoring in Toy/Sacrifice but arguably generic. *Recommendation: keep them structural (they drive scoring); revisit only if a third playstyle needs them.*
3. **Optional scoring de-dup.** Whether home playstyles should reuse the catalog detector instead of their private copy (e.g. Lore Denial scoring calls the catalog's `lore-burn` detect). *Recommendation: defer — nice-to-have, not required for the feature.*

---

## 10. Target architecture

```ts
// engine: one catalog, one record shape
interface Mechanic {
  id: string;
  label: string;
  description: string;
  detect: (card: LorcanaCard) => boolean;   // wraps an existing/new regex
}
const MECHANICS: Mechanic[] = [ /* §5 rows */ ];

// deterministic per-card detection
function getCardMechanics(card: LorcanaCard): string[];

// per-playstyle tiles = catalog hits over the playstyle's cards + structural roles − member
function getPlaystyleMechanics(playstyleId, cards): MechanicTile[];
```

`ROLE_CONFIGS` (web) collapses into a single generic path that calls the engine-exported `getPlaystyleMechanics`. Adding a playstyle requires **no** web wiring.

---

## 11. Migration & validation

1. Build the catalog + `getCardMechanics`/`getPlaystyleMechanics` behind the scenes (no UI change).
2. Snapshot every playstyle's current tiles.
3. Switch `getRoleChips` to the generic path **one playstyle at a time**; diff tiles before/after.
4. Accept the *intended* additions (e.g. Dwarfs gains Card Draw / Lore Boost) and fill the §7 gaps.
5. Delete the now-dead per-playstyle label/description maps + `ROLE_CONFIGS` entries.

---

## 12. Extensibility

- **New mechanic:** add one `MECHANICS` row (regex + label + description). It auto-applies to every playstyle.
- **New playstyle:** define only its *structural* roles (its scoring logic — unavoidable); all generic mechanics auto-attach to its tiles.
- **New playstyle with a novel mechanic:** if recurring → add a catalog row; if truly unique → it's a structural role of that rule.
