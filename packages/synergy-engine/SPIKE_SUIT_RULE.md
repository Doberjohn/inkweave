# Spike Suit Synergy Rule

Detailed documentation for the Spike Suit rule — a direct synergy built around **Dale - Ready for His Shot**, whose ability lets your characters deal combat damage with their willpower instead of their strength.

**Source**: `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `spike-suit`
**Category**: `direct` (single-anchor, bidirectional)

---

## Overview

**Dale - Ready for His Shot** (Amber, cost 4, 0/4) carries the ability:

> **SPIKE SUIT** — During challenges, your characters deal damage with their ⛉ instead of their ¤.

In Lorcana, a character normally deals combat damage equal to its **strength (¤)**. Spike Suit swaps that to **willpower (⛉)** for your whole team while Dale is in play. So any character whose willpower exceeds its strength suddenly punches *above its weight* in every challenge — and a 0-strength wall, which normally deals no combat damage at all, becomes a full-willpower threat.

The synergy therefore pairs Dale with **characters whose willpower beats their strength**. The bigger the gap (willpower − strength), the more free combat damage the pairing unlocks — so the gap drives the score directly.

This is the engine's **first single-anchor direct rule** (one card defines the entire synergy) and its **first rule keyed on a numeric stat relationship** rather than text, keyword, or name matching.

### Bidirectional Matching

Both directions are matched:
- **Forward**: Selecting Dale (the anchor) finds every qualifying high-willpower character.
- **Reverse**: Selecting a high-willpower character finds Dale.

Both directions produce identical scores for the same pair. The explanation token-swaps so the anchor always reads as the enabler regardless of which card's page you're viewing.

### Example

Selecting **Dale - Ready for His Shot** finds (top of the list):
- **Minnie Mouse - Daring Defender** (0/8) — score 10 (a wall that now hits for 8)
- **Prince Charming - Protector of the Realm** (3/10) — score 10 (+7 combat damage)
- **Mufasa - Ruler of Pride Rock** (4/9) — score 8 (+5 combat damage)
- **Kristoff - Reindeer Keeper** (3/7) — score 7 (+4 combat damage)
- **Aladdin - Intrepid Commander** (1/4) — score 6 (+3 combat damage)

---

## Detection

### Anchor Detection

`isSpikeSuitAnchor(card)` tests the card's normalized text against:

```regex
/deal damage with their .* instead of their/i
```

This matches Dale's Spike Suit wording (the `.*` spans the ⛉/¤ glyphs without depending on their exact codepoints). Detecting on the **ability text rather than a card id** means any future reprint or new card with the same effect joins the rule automatically. Coverage lists the cards it matches.

### Payoff Detection

`isSpikeSuitPayoff(card)` requires:
1. `isCharacter(card)` — only characters deal combat damage
2. `spikeSuitGap(card) >= 3` — willpower exceeds strength by at least the floor

`spikeSuitGap(card)` is `(willpower ?? 0) - (strength ?? 0)` — exactly the bonus combat damage Spike Suit unlocks.

### The gap ≥ 3 Floor

`SPIKE_SUIT_FLOOR = 3`. Below +3 the bonus is marginal (a 2/3 hitting for 3 instead of 2) and the candidate pool balloons. Flooring at +3 keeps every surfaced match a genuine upgrade and avoids polluting hundreds of character pages with a trivial Dale entry in the reverse direction.

<!-- coverage:start floor -->
Counted by `pnpm refresh-rule-coverage` over the 1,228 Core cards in the synergy pool (sets 9-13 plus the Set 14 preview).

**460 characters** have any willpower lead, **204** of them only +1. The +3 floor keeps **125**, and **124** of those can share a deck with an anchor.
<!-- coverage:end -->

### Ink Compatibility

Handled centrally by the engine (`canShareDeck`) before rules run, so the rule itself does no ink filtering. Dale is single-ink Amber, so he pairs with every single-ink card and any dual-ink card containing Amber; the floor counts above show how many gap-≥3 characters that keeps.

---

## Scoring

Score scales **linearly with the gap**, because the gap *is* the bonus damage — keeping the score directly interpretable. Strength-0 walls get **+1** on top: they jump from dealing *zero* in combat to swinging for their full willpower, a qualitative transformation the raw gap alone understates.

```text
score = min(gap + 3 + (strength === 0 ? 1 : 0), 10)
```

The `+3` offset lifts the weakest qualifying pair (gap 3) to **6** — the bottom of the Moderate tier — so the floor and the curve tell the same story: every match is at least a meaningful upgrade.

### Score Table

| Payoff (strength/willpower) | Gap | Wall? | Score | Display Tier |
|---|---|---|---|---|
| 3/6 | 3 | no | **6** | Moderate |
| 0/3 | 3 | yes | **7** | Strong |
| 3/7 | 4 | no | **7** | Strong |
| 0/4 | 4 | yes | **8** | Strong |
| 4/9 | 5 | no | **8** | Strong |
| 0/6 | 6 | yes | **10** | Perfect |
| 3/10 | 7 | no | **10** | Perfect |
| 0/8 | 8 | yes | **10** (capped) | Perfect |

<!-- coverage:start scores -->
```chart
{
  "type": "bar",
  "title": "Score distribution (124 unique pairs)",
  "data": {
    "labels": ["6", "7", "8", "9", "10"],
    "datasets": [
      {
        "label": "Pairs",
        "data": [75, 21, 20, 5, 3],
        "backgroundColor": ["#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#fbbf24"]
      }
    ]
  }
}
```

Tier split: **0 Weak / 75 Moderate / 46 Strong / 3 Perfect**.
<!-- coverage:end -->

Only the biggest gaps and walls reach Perfect; the bulk are solid +3 and +4 bodies in Moderate and Strong.

### Explanation Template

```text
{anchor} lets {payoff} deal damage with its {willpower} willpower instead of its {strength} strength.
```

`{anchor}` / `{payoff}` are `{A}`/`{B}` chip tokens, swapped by direction so Dale always reads as the enabler. The unified template covers walls too — "instead of its 0 strength" reads cleanly for a 0-strength body without special-casing (and dodges the "a 8" / "an 8" article hazard).

---

## Coverage

<!-- coverage:start coverage -->
- **1 anchor**: Dale - Ready for His Shot
- **124 deck-compatible payoffs**; **124 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`)
- **23** of the payoffs are strength-0 walls, the highest-impact pairings

```chart
{
  "type": "bar",
  "title": "Payoff gap distribution (124 cards)",
  "data": {
    "labels": ["+3", "+4", "+5", "+6", "+7"],
    "datasets": [
      {
        "label": "Payoffs",
        "data": [84, 21, 14, 4, 1],
        "backgroundColor": ["#60b5f5", "#60b5f5", "#60b5f5", "#60b5f5", "#60b5f5"]
      }
    ]
  }
}
```

```chart
{
  "type": "doughnut",
  "title": "Payoffs by primary ink (124 cards)",
  "data": {
    "labels": ["Amber (42)", "Sapphire (26)", "Amethyst (18)", "Steel (17)", "Emerald (13)", "Ruby (8)"],
    "values": [42, 26, 18, 17, 13, 8]
  }
}
```
<!-- coverage:end -->

Dale's own synergy page is capped at the engine's `maxResultsPerGroup` (100), sorted by score; the reverse direction adds a single Dale entry to each payoff's page.

Amber leads (Dale's own ink, always available), but high-willpower bodies appear across every ink, so Dale slots into many second-ink pairings.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Spike Suit')`.

| Test | What It Verifies |
|------|-----------------|
| Anchor matches by ability text | `matches()` true for the Spike Suit anchor |
| Payoff matches (gap ≥ 3) | `matches()` true for a 1/4 character |
| Sub-floor rejected | `matches()` false for gap 2, gap 0, and strength > willpower |
| Forward find | Anchor returns qualifying payoffs, excludes sub-floor bodies and itself |
| Reverse find | A payoff returns the anchor |
| Score curve (`it.each`) | gap 3 → 6, gap 4 → 7, gap 5 → 8, wall 0/3 → 7, wall 0/8 → 10 (capped) |
| Token-swap | Forward `{A} lets {B}`, reverse `{B} lets {A}` — anchor stays the enabler |
| Bidirectional flag | All matches have `bidirectional: true` |

---

## Design Decisions and Rationale

### Why a Single-Anchor Direct Rule?

The rule was built around one card with this effect, and the synergy is entirely about *building around it*. Modeling it as a direct rule (not a playstyle) keeps it pair-specific: there's no "Spike Suit density" — you either have Dale or you don't. The reverse direction exists so that browsing a high-willpower wall surfaces Dale as the build-around enabler.

### Why Floor at gap ≥ 3 (Not ≥ 1 or ≥ 2)?

The literal "willpower > strength" reading matches hundreds of characters, many of them a trivial +1 (the *gap ≥ 3 Floor* section counts both). A +1 swing rarely changes a combat outcome and would attach a weak Dale entry to every one of those pages. Flooring at +3 (the point where the extra damage reliably trades up a tier of bodies) keeps the synergy honest in both directions. See the investigation in the rule's commit history.

### Why the Strength-0 Bump?

A 0/X wall is the archetype's dream target: normally a pure quester/blocker that deals no combat damage, it becomes a full-willpower attacker under Spike Suit. That's a category change, not just a bigger number, so it earns +1 over its raw-gap score — pushing the biggest walls into the Perfect tier where they belong.

### Why Cap at 10?

The display scale tops out at 10 (Perfect ≥ 9.5). The biggest walls (0/7 and up) would compute to 11 or more without the cap; clamping keeps them at a clean 10 alongside the other top-tier pairings.
