# Merida Archer Synergy Rule

Detailed documentation for the Merida Archer rule — a direct synergy built around **Merida - Formidable Archer**, whose STEADY AIM ability adds damage whenever one of your actions deals damage to an opposing character.

**Source**: `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `merida-archer`
**Category**: `direct` (single-anchor, bidirectional)

---

## Overview

**Merida - Formidable Archer** (Steel, id 2906) carries the ability:

> **STEADY AIM** — Whenever one of your actions deals damage to an opposing character, deal 2 damage to that character.

Every damage-dealing action in your deck therefore hits for **+2** while Merida is in play — a 3-damage Smash becomes a 5-damage removal, a board-wipe adds 2 to every body it touches. The synergy pairs Merida with **Action cards that deal fixed damage**, and the more the action already deals (and the more targets it hits), the bigger the absolute swing STEADY AIM unlocks.

This is a **single-anchor direct rule** (one card defines the entire synergy), modeled on the Spike Suit rule. Like Spike Suit, the anchor is detected on **ability text, not a card id**, so any future reprint with the same STEADY AIM wording joins the rule automatically.

### Bidirectional Matching

- **Forward**: Selecting Merida finds every qualifying damage-dealing Action.
- **Reverse**: Selecting a damage Action finds Merida.

Both directions produce identical scores. The explanation token-swaps so Merida always reads as the enabler regardless of which card's page you are viewing.

### Example

Selecting **Merida - Formidable Archer** finds (top of the list):
- **Unfortunate Situation** (4 damage, multi) — score 9
- **The Mob Song** (3 damage, up to 3 targets) — score 9
- **Smash** (3 damage) — score 8
- **He Hurled His Thunderbolt** (4 damage) — score 8
- **Three Arrows** (2 + follow-up 1) — score 8

---

## Detection

### Anchor Detection

`isSteadyAimAnchor(card)` tests the card's normalized text against:

```regex
/whenever one of your actions deals? damage to an opposing character/i
```

`deals?` covers the singular "deals" printed on Merida and a possible "deal" reprint. Against the current pool the pattern matches exactly one card (Merida, id 2906).

### Payoff Detection

`isMeridaDamageAction(card)` requires:
1. `isAction(card)` — only Actions trigger STEADY AIM (its reminder keys on "one of your **actions**")
2. text matches `/\bdeals?\s+\d+\s+damage\b/i` — the action deals a fixed amount of damage
3. NOT self-only — `/deals?\s+\d+\s+damage to chosen character of yours/i` (Break Free targets YOUR OWN character, never an opposing one)
4. NOT a granted ability — `/\bgains?\b[^.]{0,40}["“'][^"”']*deals?\s+\d+\s+damage/i` (Food Fight! grants a character a damage ability; the damage is dealt by the character, not the action)

### Exclusions (validated)

| Card | id | Why excluded |
|---|---|---|
| **Break Free** | 1083 | Self-only: "deal 1 damage to chosen character **of yours**" — never hits an opposing character, so STEADY AIM can't fire. |
| **Food Fight!** | 1155 | Granted ability: "Your characters gain “...Deal 1 damage...”" — the damage comes from the granted CHARACTER ability, not the action. |

The granted-ability char classes include both curly (“”) and straight (") quotes because the live card data prints curly quotes; both are kept so a straight-quote reprint also matches.

### Ink Compatibility

Handled centrally by the engine (`canShareDeck`) before rules run. Merida is single-ink Steel, so she pairs with every single-ink card and any dual-ink card containing Steel. All 19 raw payoffs are Steel-deck-compatible (15 Steel, 3 Emerald reachable via a Steel-Emerald build, 1 Ruby-Steel).

---

## Scoring

STEADY AIM adds a flat **+2** per hit, so a bigger base action is a bigger absolute upgrade, and every extra target it hits is another trigger. The score:

```text
score = min(5 + min(actionDamage, 3) + (multiTarget ? 1 : 0), 10)
```

- **actionDamage** capped at 3 so a lone 4-damage nuke doesn't dwarf a flexible repeatable 3.
- **multiTarget** = `/each|up to \d+ chosen|another chosen/i` — board-wipes, up-to-N, and follow-up hits.
- **Floor is 6**: even a 1-damage single-target action becomes a real +2 upgrade under STEADY AIM.

### Score Table

| Payoff | Damage | Multi? | Score | Tier |
|---|---|---|---|---|
| Quick Shot (1867) | 1 | no | **6** | Moderate |
| Fire the Cannons! (2136) | 2 | no | **7** | Strong |
| Windstorm (13203) | 1 | yes | **7** | Strong |
| Smash (2134) | 3 | no | **8** | Strong |
| Twin Fire (1396) | 2 | yes | **8** | Strong |
| He Hurled His Thunderbolt (2386) | 4 (capped 3) | no | **8** | Strong |
| The Mob Song (2138) | 3 | yes | **9** | Strong |
| Unfortunate Situation (1398) | 4 (capped 3) | yes | **9** | Strong |

### Explanation Template

```text
{anchor}'s STEADY AIM adds 2 damage to {payoff}'s {N} damage each time it hits an opposing character.
```

`{anchor}`/`{payoff}` are `{A}`/`{B}` chip tokens, swapped by direction so Merida always reads as the enabler.

---

## Coverage

Based on the current Core + preview card pool:
- **1 anchor** (Merida - Formidable Archer)
- **19 deck-compatible payoffs** (damage-dealing Actions that share a Steel deck)

Payoff ids: 1152, 13101, 13102, 13200, 13203, 1394, 1396, 1398, 1635, 1813, 1867, 2034, 2134, 2136, 2138, 2285, 2386, 2660, 2912.

```chart
{
  "type": "bar",
  "title": "Merida Archer — Score Distribution (19 payoffs)",
  "data": {
    "labels": ["Score 6 — Moderate", "Score 7 — Strong", "Score 8 — Strong", "Score 9 — Strong"],
    "datasets": [{
      "label": "Payoffs",
      "data": [1, 11, 5, 2],
      "backgroundColor": ["#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0"]
    }]
  }
}
```

Tier split: **0 Weak / 1 Moderate / 18 Strong / 0 Perfect**. The floor of 6 means every match is at least a genuine +2 upgrade; nothing reaches Perfect (a flat +2 is strong, not game-ending on its own).

---

## Caveats and Edge Cases

### Unfortunate Situation (1398) — INCLUDED (with a known ambiguity)

"Each opponent chooses one of their characters and deals 4 damage to them." Here the damage is dealt by the **opponent** to the opponent's **own** character. A rules-lawyer reading of STEADY AIM ("whenever one of **your** actions deals damage") could argue Merida does not add +2, since the opponent is technically the one dealing it. Ravensburger has not published an errata resolving this.

We **include** it: the opposing character still takes damage as the direct result of resolving your action, which is how most players read it; the detection is purely mechanical, and a text-only carve-out for this one card would be fragile. If a future ruling excludes delegated damage, add `|Each opponent chooses` to the self-only exclusion.

### Light the Fuse (1813) — scaling single-target flagged as multi

"Deal 1 damage to chosen character **for each** exerted character you have in play" matches the `each` multi-pattern, so it scores 7 instead of 6. It is a scaling single-target, not a true multi-hit, so the +1 bonus slightly over-counts — one card, both Strong-tier, cosmetic. Left as-spec'd.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Merida Archer')`.

| Test | What It Verifies |
|------|-----------------|
| Anchor matches by ability text | `matches()` true for the STEADY AIM anchor |
| Damage action matches | `matches()` true for Smash |
| Exclusions | `matches()` false for Break Free (self-only) and Food Fight! (granted) |
| Forward find | Anchor returns damage actions, excludes non-payoffs and itself |
| Reverse find | A damage action returns the anchor |
| Score curve (`it.each`) | 1-dmg single → 6, Smash (3) → 8, Mob Song (3 multi) → 9, 1-dmg multi → 7, 4-dmg caps at 8 |
| Token-swap | Forward `{A}'s STEADY AIM`, reverse `{B}'s STEADY AIM` — Merida stays the enabler |
| Bidirectional flag | All matches `bidirectional: true` |
