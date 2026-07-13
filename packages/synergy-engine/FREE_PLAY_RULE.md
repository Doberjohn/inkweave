# Free Play Synergy Rule

Detailed documentation for the Free Play rule, a direct synergy built around anchors that **play a cost-1 character for free** (Pocahontas - Guiding the Tribe's STAY CLOSE).

**Source**: `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `free-play`
**Category**: `direct` (anchor-by-text, bidirectional)

---

## Overview

**Pocahontas - Guiding the Tribe** (Amber, cost 2, Storyborn/Hero/Princess) carries:

> **STAY CLOSE** When you play this character, you may play a character with cost 1 for free.

A free cost-1 body is a real tempo swing (a card played and a body deployed for zero ink), and it is a genuine two-for-one when that body also carries a "when you play this character" effect, since playing it for free still triggers the effect. The rule therefore pairs the anchor with **every cost-1 character**, scoring the on-play bodies above the vanilla ones.

Detection keys on the **ability text**, not a card id, so any card with the same wording joins the rule automatically. In the current Core pool that is **two** cards:

| Anchor | Ink | Ability | Trigger |
|--------|-----|---------|---------|
| Pocahontas - Guiding the Tribe | Amber | STAY CLOSE | when she enters play |
| Pocahontas & Meeko - Adventurous Friends | Amber-Amethyst | WELCOME RETURN | whenever she quests (after returning a cost-1) |

The dual-legend was caught for free by the text detection, which is why the explanation is phrased "plays {payoff} for free" with no timing claim: it stays accurate whether the anchor plays the body on entry or on quest.

### Bidirectional Matching

- **Forward**: selecting an anchor finds every deck-compatible cost-1 character.
- **Reverse**: selecting a cost-1 character finds the anchors that play it for free.

Both directions produce identical scores for the same pair; the explanation token-swaps so the anchor always reads as the enabler regardless of which card's page is viewed.

---

## Detection

### Anchor Detection

`isFreePlayAnchor(card)` tests the normalized text against:

```regex
/play a character with cost 1 for free/i
```

Matching on wording rather than a card id means reprints or new "cost 1 for free" cards join the rule with no code change. Against the current Core pool it matches Pocahontas - Guiding the Tribe and Pocahontas & Meeko.

### Payoff Detection

`isFreePlayPayoff(card)` requires `isCharacter(card) && card.cost === 1`. Only characters qualify (the ability plays a character), and only cost-1 (the ability's exact threshold). There is **no quality floor**: unlike Spike Suit's 637-candidate pool, the 77 cost-1 characters are a manageable set and every one is a legitimate free-play target.

### On-Play Detection

`hasOnPlayEffect(card)` tests the normalized text against `/when you play this character/i`. This is the only signal that varies across the otherwise-uniform payoff pool, so it is what the score tracks. Normalizing newlines to spaces before the test is what catches bodies whose "when you play this / character" wording wraps a line.

### Ink Compatibility

Handled centrally by the engine (`canShareDeck`) before rules run, so the rule does no ink filtering. Mono-Amber Pocahontas pairs with every mono-ink cost-1 and any dual-ink cost-1 containing Amber (all 77 qualify). Dual-ink Pocahontas & Meeko (Amber-Amethyst) pairs only with cost-1s that fit an Amber-Amethyst deck (27).

---

## Scoring

Two flat tiers. The free-play value is essentially constant (one ink saved) for every target, so the score tracks the one thing that varies: whether the free body also does something on entry.

```text
score = hasOnPlayEffect(payoff) ? 8 : 6
```

| Payoff | Score | Display Tier | Rationale |
|--------|-------|--------------|-----------|
| cost-1 body, no on-play effect | **6** | Moderate | A free body and a card played: real tempo, modest ceiling. |
| cost-1 body with a "when you play" effect | **8** | Strong | The free play also fires the effect: a two-for-one. |

Grading the on-play bodies further (8 vs 9) was rejected: the effects are not uniformly free (Finnick still charges 2 ink for his bounce; Bobby's loot is unconditional), so distinguishing "impactful" from "minor" would need a subjective regex, exactly the fuzz the flat tier avoids.

### Explanation Template

```text
{anchor} plays {payoff} for free.
{anchor} plays {payoff} for free, triggering its on-play effect.   (on-play payoffs)
```

`{anchor}` / `{payoff}` are `{A}`/`{B}` chip tokens, swapped by direction so the anchor always reads as the enabler.

---

## Coverage

Based on the current Core format card pool:

- **2 anchors** (Pocahontas - Guiding the Tribe, Pocahontas & Meeko - Adventurous Friends)
- **77 deck-compatible payoffs** for Pocahontas: tier split **67 Moderate / 10 Strong**, across all six inks (Emerald 18, Amethyst 14, Amber 13, Sapphire 12, Ruby 11, Steel 9)
- **27 deck-compatible payoffs** for Pocahontas & Meeko: tier split **24 Moderate / 3 Strong** (Amethyst 14, Amber 13)
- **104 free-play pairs** total (bidirectional)

The 10 cost-1 characters that reach the Strong tier (an on-play effect the free play triggers) are: Bobby Zimuruski, Carl Fredricksen - Loving Husband, Copper - Hound Pup, Finnick - Tiny Terror, Flit - Reflective Hummingbird, Gantu, Jasmine - Heir of Agrabah, Julieta Madrigal, Mike Wazowski, and Webby Vanderquack.

Coverage numbers are derived from the live engine (`pnpm precompute-synergies`), not hand-typed, so they refresh with each Core rotation.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Free Play')`.

| Test | What It Verifies |
|------|-----------------|
| Anchor matches by ability text | `matches()` true for the STAY CLOSE wording |
| Payoff matches | `matches()` true for a cost-1 character |
| Non-matches | `matches()` false for a cost-2 character and a cost-1 item |
| Forward find | Anchor returns cost-1 payoffs, excludes pricier bodies and itself |
| Reverse find | A cost-1 character returns the anchor |
| Score tiers | Plain body → 6, on-play body → 8 |
| Token-swap + on-play text | Forward `{A} plays {B}`, reverse `{B} plays {A}`, on-play note present |
| Bidirectional flag | All matches have `bidirectional: true` |

---

## Design Decisions and Rationale

### Why a Direct Rule, Not a Playstyle?

The synergy is entirely about *building around the anchor*: there is no "free-play density." Modeling it as a direct rule keeps it pair-specific, with the reverse direction so a cost-1 character surfaces the anchor that cheats it out.

### Why Detect by Text, Not Card Id?

Id-locking to Pocahontas would have missed Pocahontas & Meeko, whose WELCOME RETURN carries the same "cost 1 for free" clause. Text detection adopts it (and any future reprint) automatically, at the cost of one deliberately timing-neutral explanation.

### Why No Quality Floor?

Spike Suit floors at gap 3 because its literal reading yields 637 matches. The free-play payoff pool is 77 cost-1 characters, all genuine free-play targets, so a floor would only hide legitimate tempo plays.

### Why Reject a Generalized "Free Play" Rule?

The wider "play a character for free" family is heterogeneous (Duke Weaselton cost ≤ 2, Mystical Inkcaster cost ≤ 5, Mickey Trumpeter *any* cost). A generalized rule would pair Mickey with all ~850 characters, a meaningless pool explosion. The hard `cost === 1` filter is what keeps this rule honest.
