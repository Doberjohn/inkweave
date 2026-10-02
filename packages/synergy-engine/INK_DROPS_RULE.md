# Ink Drops Synergy Rule

Detailed documentation for the Ink Drops rule, a payoff-anchored playstyle for Set 14's (Hyperia City) new mechanic: an ink drop is a counter you bank now and remove later to pay 1 ⬡.

**Source**: `packages/synergy-engine/src/utils/inkDrops.ts` (roles), `packages/synergy-engine/src/engine/inkDropScoring.ts` (scoring), registered in `packages/synergy-engine/src/engine/rules.ts`
**Rule ID**: `ink-drops`
**Category**: `playstyle`
**Playstyle ID**: `ink-drops`

---

## Overview

Ink Drops is a two-sided playstyle. **Makers** get ink drops (on play, on a challenge, at the end of your turn, from a ⟳ ability, from an action). **Payoffs** use them in one of five ways: a bonus when you remove a drop to play the card, a trigger whenever you remove one, a bonus while you hold one, a cost paid with drops, or a gate that lets the card act only on a turn you gained one.

Every drop is 1 banked ink, so a maker is useful with no payoff at all, like ramp. What turns the resource into a strategy is the payoff side, which is why the rule is **payoff-anchored**: two makers never pair with each other (they just add more of the same resource), and each maker lists exactly the payoffs that cash its drops in. Folding the cards into Ramp's density scoring would instead have emitted about 2,200 same-deck pairs at 5, the noise the 5-baseline convention exists to avoid.

Steel carries both sides most deeply (9 makers, 3 payoffs), with Amethyst (6 makers, 2 payoffs) and Sapphire (4 makers, 3 payoffs) behind. Emerald has 10 makers and no payoffs, and Amber's two makers share their drops with every player by design.

### Example

**Maker**: Inkcaster Skates (Amethyst item): "THE LATEST TREND ⟳ — If a character quested this turn, get 1 ink drop."
**Payoff**: Madam Mim - Resourceful Trickster (Amethyst): "BAUBLE GAME Once during your turn, whenever you remove an ink drop, draw a card."

Skates makes a drop every turn, and the first drop you spend each turn draws a card off Mim: a steady card-advantage engine, scored 8.

---

## Role Detection

### Architecture

```typescript
getInkDropRoles(card: LorcanaCard): InkDropRole[]  // subset of ['drop-maker', 'drop-payoff', 'drop-shared']
```

A raw-text pre-filter (`/ink\s+drops?/i`) runs before `normalizeCardText`, since `matches` runs for every card in the pool and almost none mention ink drops. Maker and payoff are independent gates; no card in the live pool holds both, and `ink-drop-coverage.test.ts` fails if one appears, so the scoring table gets reviewed first.

### drop-maker

A card is a maker when `getInkDropGain(card) > 0`, the same helper the Shift rule uses for Baymax - Amped Up's drop-paid Shift:

```regex
INK_DROP_GAIN = /\bgets?\s+(\d+)\s+ink\s+drops?\b/gi
```

It reads the largest single gain on the card, so "If you would get an ink drop" (a replacement, no number) and "remove 2 ink drops" (a cost) are never gains.

### drop-payoff

Any of five shapes:

```regex
SPEND_RIDER    = /\bif you removed (?:an|\d+(?: or more)?) ink drops? to play\b/i
REMOVE_TRIGGER = /\bwhenever you remove (?:an|one or more|\d+) ink drops?\b/i
HOLD           = /\b(?:while|if) you have (?:an|\d+ or more) ink drops?\b|\bfor each ink drop you have\b/i
DROP_SINK      = /\bshift remove \d+ ink drops?\b|\bif you would get an ink drop\b/i
GAIN_GATE      = /\bunless you (?:gained|got) (?:an|\d+(?: or more)?) ink drops? this turn\b/i
```

| Shape | Example card text | Cards |
|-------|-------------------|-------|
| spend rider | "**If you removed an ink drop to play this action**, deal 5 damage instead." | Jousting Match, Intense Research, Wasabi - Future Thinker, Madam Mim - Resourceful Trickster |
| remove trigger | "**whenever you remove an ink drop**, draw a card." | Madam Mim - Resourceful Trickster |
| hold | "**While you have an ink drop**, this character gains Challenger +3." | Sir Kay - Determined to Win, Wasabi - Called into Battle, Madam Mim - Bauble Chaser |
| sink | "**Shift Remove 2 ink drops** …", "**If you would get an ink drop**, … into your inkwell … instead." | Baymax - Amped Up |
| gain gate | "This character can't quest or challenge **unless you got an ink drop this turn**." | Baloo - Delivery Pilot |

`GAIN_GATE` also reads "gained", the wording of the translated scan Baloo's preview carried before his English printing.

### drop-shared (display only)

```regex
SHARED = /\beach player gets?\s+\d+\s+ink\s+drops?\b|\beach get\s+\d+\s+ink\s+drops?\b|\bthey get\s+\d+\s+ink\s+drops?\b/i
```

Flags a maker whose drops also (or only) reach an opponent: Mickey Mouse - Best in Town and Port Authority - Center Hub ("each player gets"), Molly Cunningham, Kit Cloudkicker and Another Tale to Spin ("you and another chosen player each get"), and This Is Business ("They get", when the opponent picks that mode). It powers the Shares Ink Drops tile and never changes a score.

### Scoring helpers (not roles)

| Helper | Pattern | Cards |
|--------|---------|-------|
| `isRepeatingDropMaker` | Judged one ability at a time (`textSections`, where each "•" option of a modal ability is read with the line that offers it): some ability matches `REPEATING_GAIN` (a gain inside "whenever …", "at the end of your turn", or a ⟳ ability) and not `PAID_ACTIVATION_GAIN` (a gain behind an ink-cost activation) | Arthur - Jousting Knight, Arthur - Merlin's Assistant, Fred - Awesome Boss, Go Go Tomago - Extreme Tester, Honey Lemon - Ingenious Researcher, Honey Lemon - Testing the Limits, Inkcaster Skates, Kit Cloudkicker - Sure Shot, Marie - Caught in the Act, Meilin Lee - Ecstatic Fan, Mickey Mouse - Best in Town, Port Authority - Center Hub, Shere Khan - Khan Industries CEO, Sir Pellinore - Tougher Than He Looks |
| `isLateDropMaker` | Judged one ability at a time: every ability that gets drops matches `LATE_GAIN` (a gain at the end of your turn, or when this character is challenged, which happens on the opponent's turn) | Go Go Tomago - Extreme Tester, Mickey Mouse - Best in Town |
| `isOpponentGatedDrop` | `OPPONENT_GATED` ("chosen opponent chooses one", "for each opponent who doesn't", "whenever this character is challenged") | Go Go Tomago - Extreme Tester, Shere Khan - Opportunistic Tycoon, This Is Business |
| burst | `getInkDropGain(card) >= 2` | Baymax - Lab Assistant (2), Higitus Figitus (3), Merlin - Ink Drop Tinkerer (2), Tadashi Hamada - Making Waves (2), This Is Business (2) |

```regex
REPEATING_GAIN       = /(?:\bwhenever\b|\bat the end of your turn\b|⟳)[^()]{0,120}?\bgets?\s+\d+\s+ink\s+drops?\b/i
PAID_ACTIVATION_GAIN = /\d+\s*⬡\s*[—–-][^()]{0,120}?\bgets?\s+\d+\s+ink\s+drops?\b/i
LATE_GAIN            = /(?:\bat the end of your turn\b|\bwhenever this character is challenged\b)[^()]{0,120}?\bgets?\s+\d+\s+ink\s+drops?\b/i
OPPONENT_GATED       = /\bchosen opponent chooses one\b|\bfor each opponent who doesn't\b|\bwhenever this character is challenged\b/i
```

Merlin - Ink Drop Tinkerer counts as a burst although he gets 2 only when Shifted: `getInkDropGain` reads the largest single gain on the card.

### What's Excluded

| Excluded | Why |
|----------|-----|
| The removal reminder "(You may remove an ink drop to pay 1 ⬡.)" | Printed on most makers. `REMOVE_TRIGGER` needs "whenever you remove", and `DROP_SINK` needs "Shift remove" or "if you would get", so the reminder never reads as a payoff. |
| Ink-cost activations as a steady supply | Yama - Notorious Criminal (6 ⬡ to open a one-turn window) and the "⟳, 1 ⬡ — Get 1 ink drop" that Bobby Zimuruski grants: the ink paid in offsets the drop, so both score as one-shot makers. |
| Leaning Tower of Cheese-a | It makes drops only through Bobby Zimuruski's granted ability, and has no drop text of its own. Bobby is the maker. |
| Maker ↔ maker pairs | Payoff-anchored. Real maker-with-maker combos (Merlin - Ink Drop Tinkerer singing Higitus Figitus, Arthur - Merlin's Assistant moving to Port Authority) live in other rules (Singer + Songs, Location Control) or are follow-ups. |

---

## Scoring (payoff-anchored, 5-baseline)

Applies the project-wide **5-baseline convention**. For each maker ↔ payoff pair, the highest applicable row wins.

### Score Table

| Pair Type | Score | Display Tier | Why above 5 |
|-----------|-------|-------------|-------------|
| maker ↔ spend rider | **7** | Strong | The maker banks the drop you remove to play the payoff, switching its bonus on |
| repeating maker ↔ remove trigger | **8** | Strong | Steady drops feed a draw every turn |
| one-shot maker ↔ remove trigger (card with no spend rider; none today) | **6** | Moderate | The banked drop, once spent, fires the trigger once |
| one-shot maker ↔ hold payoff | **6** | Moderate | The banked drop switches the static bonus on |
| repeating maker ↔ hold payoff | **7** | Strong | Fresh drops let you spend one and still hold one |
| one-shot maker ↔ drop sink | **6** | Moderate | The maker's drop becomes a permanent inkwell card |
| burst maker ↔ drop sink | **7** | Strong | One effect supplies both drops Baymax - Amped Up's Shift removes |
| repeating maker ↔ drop sink | **8** | Strong | Every drop the maker makes becomes a permanent inkwell card |
| one-shot maker ↔ gain gate | **6** | Moderate | The maker's drop lets the gate card quest and challenge that turn |
| repeating maker ↔ gain gate | **7** | Strong | A drop every turn keeps the gate card questing and challenging |
| late maker ↔ gain gate | **null** | not emitted | The drop arrives after the gate card's quests and challenges: at the end of your turn (Mickey Mouse - Best in Town) or on the opponent's turn (Go Go Tomago) |
| hold ↔ hold | **6** | Moderate | One held drop switches both bonuses on |
| any other payoff ↔ payoff | **null** | not emitted | Two spend riders consume the same drop, spending breaks a hold, Mim's remove trigger fires on any removal (so a spend rider adds nothing specific to it), Amped Up diverts new drops into the inkwell, and a gain gate needs a fresh drop that no payoff supplies |
| maker ↔ maker | **null** | not emitted | Same-side density (payoff-anchored) |

**Opponent gate**: when the opponent decides whether the maker's drop arrives (`isOpponentGatedDrop`), the pair takes -1, floored at 5 and applied once, and the explanation adds "The opponent decides whether you get the drop." This Is Business is gated and shared, but still takes the -1 only once.

**Shared makers take no penalty**: the opponent's free drop is a cost of that card in every deck, not of the pair, and the Shares Ink Drops tile already tells players.

### Token-swapped explanation

`{M}` (maker) and `{P}` (payoff) map onto the project `{A}`/`{B}` tokens so the maker always reads as the actor:

| Case | Template |
|------|----------|
| spend | `{M} banks the ink drop you remove to play {P}, switching on its bonus.` |
| remove trigger, repeating | `{M} keeps making ink drops, and spending one each turn draws a card off {P}.` |
| remove trigger, one-shot | `{M} banks an ink drop, and spending it fires {P}.` |
| hold, one-shot | `{M} banks an ink drop, and holding it keeps {P}'s bonus on.` |
| hold, repeating | `{M} keeps making ink drops, so you can spend some and still hold one for {P}.` |
| sink, one-shot | `{P} turns the drop {M} makes into a permanent inkwell card.` |
| sink, burst | `{M} gets the 2 drops {P}'s Shift removes in one go.` |
| sink, repeating | `Each drop {M} makes becomes a permanent inkwell card through {P}.` |
| gain gate, one-shot | `{M}'s ink drop lets {P} quest and challenge that turn.` |
| gain gate, repeating | `{M} can get you an ink drop every turn, so {P} can quest and challenge.` |
| hold ↔ hold | `One held ink drop switches on both {A} and {B}.` |

### Live distribution

Measured on `origin/master` 7e2ceffe plus the 2026-09-30 evening reveals (44 drop cards, all Set 14). After the engine's ink-compatibility filter (`canShareDeck`, which admits every pair here), **316 unique pairs**:

| Pair shape | Pairs | Score |
|------------|-------|-------|
| maker ↔ spend rider | 115 | 7 |
| maker ↔ spend rider, gated | 11 | 6 |
| repeating maker ↔ remove trigger | 13 | 8 |
| repeating maker ↔ remove trigger, gated | 1 | 7 |
| one-shot maker ↔ hold | 57 | 6 |
| one-shot maker ↔ hold, gated | 6 | 5 |
| repeating maker ↔ hold | 39 | 7 |
| repeating maker ↔ hold, gated | 3 | 6 |
| one-shot maker ↔ sink | 15 | 6 |
| one-shot maker ↔ sink, gated | 1 | 5 |
| burst maker ↔ sink | 4 | 7 |
| burst maker ↔ sink, gated | 1 | 6 |
| repeating maker ↔ sink | 13 | 8 |
| repeating maker ↔ sink, gated | 1 | 7 |
| one-shot maker ↔ gain gate | 19 | 6 |
| one-shot maker ↔ gain gate, gated | 2 | 5 |
| repeating maker ↔ gain gate | 12 | 7 |
| hold ↔ hold | 3 | 6 |

Totals: **5: 9, 6: 109, 7: 172, 8: 26**. Every drop card gets at least one partner, and for 8 of them (Archimedes - Messenger Owl, Intense Research, Khan Transport Delivery, Molly Cunningham - Remembers to Share, Pushing Boundaries, Sir Kay - Determined to Win, This Is Business, Yama - Notorious Criminal) the Ink Drops group is their only synergy group.

---

## Coverage

- **35 makers** (Emerald 10, Steel 9, Amethyst 6, Ruby 4, Sapphire 4, Amber 2): A Dark Age No More, Another Tale to Spin, Archimedes - Messenger Owl, Arthur - Jousting Knight, Arthur - Merlin's Assistant, Arthur - Novice Blacksmith, Baymax - Lab Assistant, Blinding Chem Ball, Bobby Zimuruski - Soundboard Whiz, Fred - Awesome Boss, Go Go Tomago - Extreme Tester, Higitus Figitus, Honey Lemon - Ingenious Researcher, Honey Lemon - Testing the Limits, Ink Explosion, Inkcaster Skates, Khan Transport Delivery, Kit Cloudkicker - Irrepressible Bear, Kit Cloudkicker - Sure Shot, Marie - Caught in the Act, Meilin Lee - Ecstatic Fan, Merlin - Bauble Expert, Merlin - Ink Drop Tinkerer, Merlin - Profoundly Curious, Mickey Mouse - Best in Town, Molly Cunningham - Remembers to Share, Port Authority - Center Hub, Prototype Chem Ball, Pushing Boundaries, Shere Khan - Khan Industries CEO, Shere Khan - Opportunistic Tycoon, Sir Pellinore - Tougher Than He Looks, Tadashi Hamada - Making Waves, This Is Business, Yama - Notorious Criminal
- **9 payoffs** (Sapphire 3, Steel 3, Amethyst 2, Ruby 1): **spend** Intense Research, Jousting Match, Wasabi - Future Thinker, Madam Mim - Resourceful Trickster (also the only remove trigger); **hold** Sir Kay - Determined to Win, Wasabi - Called into Battle, Madam Mim - Bauble Chaser; **sink** Baymax - Amped Up; **gain gate** Baloo - Delivery Pilot
- **6 shared makers** (Emerald 4, Amber 2): Another Tale to Spin, Kit Cloudkicker - Irrepressible Bear, Mickey Mouse - Best in Town, Molly Cunningham - Remembers to Share, Port Authority - Center Hub, This Is Business

```chart
{
  "type": "doughnut",
  "title": "Role Composition (44 cards)",
  "data": {
    "labels": ["Makers (35)", "Spend payoffs (4)", "Hold payoffs (3)", "Sink (1)", "Gain gate (1)"],
    "values": [35, 4, 3, 1, 1]
  }
}
```

Set 14 is still being revealed; re-derive these lists from the engine (`getInkDropRoles` over allCards + previewCards) rather than editing them by hand.

---

## Rules Uncertainty

No official ink-drop rules text exists yet: Comprehensive Rules v2.2.0 predates the mechanic. The design assumes **drops persist until spent**, which card text supports: Mickey Mouse - Best in Town makes drops at the end of your turn and Go Go Tomago on the opponent's turn, both useless if drops expired. If official rules say drops expire at end of turn, re-score the hold rows and every end-of-turn or opponent-turn maker. Still unconfirmed:

- whether a drop can pay an activated ability's ink cost (Yama's 6 ⬡, Bobby's granted 1 ⬡);
- whether "Get 3 ink drops" counts as three separate "if you would get" events for Baymax - Amped Up's SUPERCHARGE;
- whether removing drops for a non-ink cost (Amped Up's Shift) counts as "removed an ink drop to play" for a spend rider.

None of these changes a score today.

---

## Test Coverage

Unit and rule tests live in `packages/synergy-engine/src/__tests__/inkDrops.test.ts` (kept out of `rules.test.ts`, which already trips CodeScene's module-size finding), and a data guard in `apps/web/src/shared/constants/__tests__/ink-drop-coverage.test.ts`.

| Test | What it verifies |
|------|------------------|
| maker despite the reminder text | Arthur - Jousting Knight and Merlin - Profoundly Curious are makers only |
| payoff shapes | Madam Mim, Sir Kay, Baymax - Amped Up and Baloo - Delivery Pilot are payoffs; Amped Up is not a maker |
| gain-gate wording | Baloo's printed "got" and the translated "gained" both read as a gain gate |
| shared | Mickey Mouse - Best in Town and Molly Cunningham carry `drop-shared` |
| pre-filter | a card with no drop text gets no role |
| steady supply | Inkcaster Skates and Arthur - Jousting Knight repeat; Merlin, Yama and Bobby do not |
| steady supply, per ability | a quest trigger in one ability does not make a one-shot gain in another repeat |
| steady supply, modal option | a "•" option is read with the line that offers it: under a quest trigger it repeats, under a play trigger it does not |
| late maker | Mickey Mouse - Best in Town (end of your turn) and Go Go Tomago (when challenged) are late; Inkcaster Skates and Merlin are not |
| opponent gate | This Is Business is gated; Molly is not |
| catalog tile | a maker surfaces the `ink-drop-gain` (Creates Ink Drops) tile; Amped Up does not |
| rule registration | registered as the `ink-drops` playstyle; `matches` only drop cards; `findSynergies` drops maker ↔ maker |
| maker ↔ maker | null |
| repeating ↔ remove trigger | 8, maker as the actor in both search directions |
| one-shot ↔ spend rider | 7 |
| hold tiers | 6 one-shot, 7 repeating |
| sink tiers | 6 one-shot, 7 burst, 8 repeating |
| gain-gate tiers | 6 one-shot, 7 repeating, maker as the actor in both search directions |
| gain gate with a late maker | Mickey Mouse - Best in Town and Go Go Tomago never pair with Baloo |
| gate applied once | This Is Business ↔ Jousting Match = 6 with the gate suffix |
| no shared penalty | Molly ↔ Jousting Match = 7 |
| payoff ↔ payoff | hold ↔ hold 6; Mim ↔ Jousting Match and Mim ↔ Amped Up null |
| data guard: coverage | every pool card mentioning ink drops has a role; no dual-role card; key cards stay in their designed roles |
| data guard: copy fit | every remove trigger draws a card, every sink is the Shift-plus-conversion shape, every gain gate is the "can't quest or challenge unless you got" (or "gained") shape, and no gain goes only to opponents, so a new wording fails CI until the table gets a row and copy for it |
| data guard: live pairs | on the real pool, every drop card has partners, no two makers pair, and the 8s with Mim and Amped Up are exactly the steady makers the opponent cannot deny that can share a deck with them, including Arthur - Jousting Knight and Kit Cloudkicker - Sure Shot by name |

---

## Design Decisions and Rationale

### Why a standalone playstyle and not part of Ramp?

Drops are temporary ink, not inkwell growth: they never fire inkwell triggers (except through Baymax - Amped Up's conversion), and a Ramp fold would have scored every drop card at 5 against every Ramp card. The designer framed Set 14 around this one mechanic, the payoff side has three distinct shapes plus a conversion card, and players browsing the set want one page that separates the cards that make drops from the cards that use them.

### Why 7 for spend riders and 8 only for steady makers?

A spend rider needs one drop once, and any maker supplies it; the drop switches a bonus on (7). The 8s are the peak chains the anchors reserve that score for: a maker that keeps producing drops feeding a payoff that pays off turn after turn (Mim's draw each turn, a permanent inkwell card per drop through Amped Up). Scoring Madam Mim - Resourceful Trickster and Wasabi - Future Thinker at 8 with every maker, because their riders do nothing without a drop, would have put both at 8 with nearly every maker and erased the ranking.

### Why does a gain gate top out at 7?

Baloo - Delivery Pilot can't quest or challenge unless you got an ink drop this turn, so a maker only lifts his drawback: the drop adds no card or ink of its own, unlike the 8s (Mim's draw each turn, an inkwell card per drop through Amped Up). A maker that gets a drop every turn keeps him active turn after turn (7); a one-shot drop opens him for one turn (6).

### Why do end-of-turn and opponent-turn makers not pair with a gain gate?

The gate reads "this turn" and guards quests and challenges. Mickey Mouse - Best in Town's drop lands at the end of your turn, after both, and Go Go Tomago's lands on the opponent's turn, so neither ever opens it. They still pair with every other payoff, since a banked drop is spent or held on a later turn.

### Why -1 for opponent-gated makers but nothing for shared ones?

A gate changes the pair: the opponent decides whether your payoff switches on at all. Sharing does not: Mim draws the same cards whether or not the opponent also got a drop, so the cost belongs to the card, not the pair.

### Why is `drop-shared` display-only?

It is information players need (the drop also reaches the opponent) without being an interaction between two cards. The Shares Ink Drops tile shows it; scoring ignores it.
