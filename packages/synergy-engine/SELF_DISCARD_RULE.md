# Self-Discard Synergy Rule ("Discard Matters" — player-side)

Detailed documentation for the Self-Discard rule, a playstyle synergy that detects the player-side discard-recursion archetype: discard your own cards, then cash them in.

**Source**: `packages/synergy-engine/src/engine/rules.ts`, `packages/synergy-engine/src/utils/cardHelpers.ts`
**Rule ID**: `self-discard`
**Category**: `playstyle`
**Playstyle ID**: `self-discard`

---

## Overview

Self-Discard is the **player-side mirror** of the opponent-facing Discard rule (Rule 4). Where that rule attacks the *opponent's* hand, this one fills your *own* discard on purpose and turns the pile into a resource. Five roles, in two groups.

Bin-fillers:

- **enabler** — a hand-discard outlet (loot, discard-your-hand, discard-as-cost) that fills your own discard.
- **mill** — fills the bin from the *deck* ("put the top N cards of your deck into your discard").

Payoffs:

- **reanimator** — plays or returns a card *from your discard* (the deep recursion payoff).
- **state-payoff** — rewards the discard *event* ("if you discarded a card this turn") or an empty hand (Hellbent).
- **zone-payoff** — rewards the discard as a countable *zone* ("while you have 10 or more cards in your discard", "a song card in your discard", "if 2 or more cards were put into your discard this turn").

The two filler roles are not interchangeable: a hand discard *is* a discard event, so it switches on every payoff; milling never triggers a "when you discard" payoff, so it feeds only the payoffs that read the pile itself. That distinction is what the score matrix encodes.

Like Sacrifice, it is an asymmetric-role playstyle: the fillers *create* the fuel that the payoffs *exploit*. A deck of all reanimators has an empty bin; a deck of all loot has nothing to bring back. The combo is the rule. This rule fills the "recursion role" that `makeSearchPattern` in `cardHelpers.ts` deliberately deferred ("from your discard ... Recursion deserves its own role; see Phase 3").

### Example

**Enabler (loot)**: Scrooge McDuck - S.H.U.S.H. Agent (Emerald): "When you play this character, draw a card, then choose and discard a card."
**Reanimator**: Mother Gothel - Evil as Ever (Emerald): "When you discard this card, you may play this character from your discard."

Loot Mother Gothel into the discard → she replays herself for free. The loot digs for what you need *and* stocks the bin; the reanimator cashes it. Same-ink Emerald.

---

## Role Detection

### Architecture

```typescript
getSelfDiscardRoles(card: LorcanaCard): SelfDiscardRole[]  // any subset of ['enabler','reanimator','state-payoff']
```

A card can be multi-role: `Rapunzel & Flynn Rider - Unlikely Pair` loots (enabler) *and* replays discarded characters (reanimator). Detection uses a fast pre-filter (`HAS_SELF_DISCARD_KEYWORD = /discard|no cards in/i`) before the patterns.

### enabler (self-discard outlet from hand)

Three sub-patterns, all gated against opponent-facing discard:

```regex
loot: /draw\s+(?:a|an|\d+)\s+cards?,?\s+then\s+(?:choose and\s+)?discard/i
hand: /discard\s+your\s+hand/i
cost: /(?:you may\s+)?discard\s+(?:a|an|another|\d+)\s+(?:\w+\s+){0,2}?cards?\b/i
gate: !(/opponent|each player|challenging player|that player/i)
```

| Shape | Example card text | Card |
|-------|-------------------|------|
| Loot | "draw a card, **then choose and discard a card**." | Kronk - Meat Hut Cook |
| Discard hand | "**Discard your hand.** Draw 2 cards." | You Broke My Smolder |
| Discard as cost | "**discard a card** to ..." | (discount / cost outlets) |

The discard-as-cost pattern is intentionally kept tight (`{0,2}` words between "discard a" and "card"), so it catches generic "discard a card" costs without over-tagging narrow conditional costs. The only rotation card it leaves half-tagged is The Queen - Conceited Ruler (a "discard a Princess or Queen character card" cost); widening it to `{0,4}` would promote exactly one card to `enabler` and bump 49 pairs (measured), so it stays tight.

### reanimator (recursion payoff)

```regex
/(?:play|return|put)\b[^.]{0,60}\bfrom your discard\b/i
```

Matches playing, returning, or putting a card **from your discard**:

| Example card text | Card |
|-------------------|------|
| "you may **play this character from your discard**." | Mother Gothel - Evil as Ever |
| "**return a character card from your discard** to your hand." | The Queen - Conceited Ruler, Taran - Pig Keeper |
| "you may **play that character from your discard**." | Rapunzel & Flynn Rider |

The `[^.]{0,60}` window keeps the verb and "from your discard" inside one clause, so a card can't match by having "play" in one sentence and "from your discard" in an unrelated one.

**Self-contained recursion is stripped first** (`stripSelfContainedRecursion`). Some recursion can only ever return the card itself or a card it just handled, so no hand-discard or mill enabler feeds it. Its sentence is removed before the reanimator test:

| Shape | Example card text | Card |
|-------|-------------------|------|
| The card itself | "**return this card from your discard** to your hand." | HeiHei - Persistent Presence |
| A card played this turn | "return a song card **you played this turn** … from your discard" | Aurora - Delightful Musician |
| A card it just discarded | "If you discarded a location card **this way, you may play it from your discard**" | Tiana - Party Hostess |

Recursion that fires when **you** discard the card stays ("when you discard this card, you may play it from your discard": Mother Gothel - Evil as Ever, Look What You've Done, Rapunzel & Flynn Rider), because a hand discard is exactly what feeds it. Tiana keeps `enabler` (her draw-then-discard is a real outlet) and Torn Scrap keeps `zone-payoff`.

### state-payoff (discard event / empty hand)

```regex
event:      /discarded\s+a\s+card\s+this\s+turn/i
empty hand: /no cards in (?:your )?hand/i
```

The two halves are separate patterns so the feed check (below) can tell an event payoff from an empty-hand one.

| Shape | Example card text | Card |
|-------|-------------------|------|
| Discarded this turn | "**If you discarded a card this turn**, ..." | Maximus - Relentless Stallion, Discarded Armor |
| Hellbent | "**While you have no cards in your hand**, ..." | Megavolt - Electrical Menace, Gizmoduck |

### zone-payoff (the discard as a countable zone)

```regex
in:  /\b(?:a|an|\d+\s+or\s+more|for\s+each)\s+(?:\w+\s+){0,3}?cards?\s+(?:named\s+\w+\s+)?in\s+your\s+discard\b/i
put: /cards?\s+were\s+put\s+into\s+your\s+discard\s+this\s+turn/i
```

The `in your discard` wording keeps this disjoint from the reanimator's `from your discard`: a zone payoff *reads* the pile, a reanimator *empties* it. The `put` pattern covers the trigger family that counts what arrived this turn regardless of how it got there.

| Shape | Example card text | Card |
|-------|-------------------|------|
| Discard count | "While you have **10 or more cards in your discard**, ..." | Pepita - Imelda's Right Hand, Land of the Dead - Marigold Bridge |
| Card-type check | "if there's **a song card in your discard**, ..." | Priya Mangal - Serious Music Lover, Miguel Rivera - Street Musician |
| For-each scaling | "**For each** Alien character **card in your discard**, ..." | Dr. Hamsterviel - Infamous Scientist, Coldstone - Reincarnated Cyborg |
| Put this turn | "If **2 or more cards were put into your discard this turn**, ..." | Helga Sinclair - No Backup Needed, Kida - Discovering the Unknown |

### mill (deck → discard)

```regex
/put\s+the\s+top\s+(?:card|\d+\s+cards)\s+of\s+your\s+deck\s+into\s+your\s+discard/i
```

Deliberately tight: it reads the top-of-deck phrasing only. "Put the rest into your discard" (a look-and-filter effect) and the ambiguous "put it into your discard" stay out, because neither reliably fills the bin.

| Example card text | Card |
|-------------------|------|
| "**put the top 4 cards of your deck into your discard**." | Quackerjack - Loony Toymaker |
| "**put the top card of your deck into your discard**." | Hector Rivera - Street Musician, Jack-Jack Parr - Incredible Potential |

### What's Excluded

| Excluded | Pattern / reason |
|----------|------------------|
| **Opponent discard** | Anything matching `opponent` / `each player` is the Discard rule's domain (attacking *their* hand). The gate keeps the two axes disjoint, exactly the boundary the Discard rule's doc calls out ("self-discard ... belongs to a separate axis"). |
| **Songs as bin-fillers** | A sung song lands in the discard, so in principle every Song feeds a zone payoff. It is not modelled: that would make all 66 Songs bin-fillers and drown the axis in near-baseline pairs, and the Song half of the interaction already has a home in the Singer + Songs rule. |
| **Mill as a hand-discard enabler** | Mill *is* tagged (role `mill`) but is never an `enabler`: it fills the bin from the deck, so it cannot switch on a payoff that needs an actual hand discard. `mill ↔ state-payoff` therefore stays at the 5 baseline, while `enabler ↔ state-payoff` scores 8. |

---

## Card examples by role

Real cards the `getSelfDiscardRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **enabler** | Kronk - Meat Hut Cook (Steel), Search for Clues (Amber), The Horned King - Wicked Ruler (Amethyst) | Discard your own cards from hand: loot, discard-your-hand, or discard-as-cost |
| **reanimator** | The Queen - Conceited Ruler (Amber), Lady Tremaine - Sinister Socialite (Ruby), Pluto - Clever Cluefinder (Sapphire) | Play or return a card *from your discard*: the deep recursion payoff |
| **state-payoff** | Maximus - Relentless Stallion (Steel), Megavolt - Electrical Menace (Steel), Beast's Mirror (Steel) | Rewards the discard event ("discarded a card this turn") or an empty hand (Hellbent) |
| **zone-payoff** | Priya Mangal - Serious Music Lover (Amber), Pain - Running with Scissors (Amethyst), Helga Sinclair - No Backup Needed (Emerald) | Reads the pile itself: a count, a card type sitting there, or what was put there this turn |
| **mill** | Quackerjack - Loony Toymaker (Sapphire), Preston Whitmore - Expedition Financier (Ruby), Remote Inklands - Desert Ruins (Ruby) | Puts cards from the top of your deck into your discard |

---

## Scoring (8/7/6/5 matrix)

Applies the project-wide **5-baseline convention** and mirrors the Sacrifice shape (asymmetric combo at peak, same-axis density at floor), with a `7` for a bin-filler feeding the payoff it fuels and a `6` for the recursion-density case.

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| enabler ↔ payoff (reanimator or state) | **8** | Strong | Win-condition combo: discard a card, then replay it from the bin (reanimator) or flip the "discarded this turn" / empty-hand payoff (state) on demand. Only when the outlet's discard can switch that payoff on (see Feed check) |
| enabler ↔ zone-payoff | **7** | Strong | Mechanical compounding: every hand discard raises the count the payoff reads |
| mill ↔ zone-payoff | **7** | Strong | The deck-side filler stocks the pile the payoff counts, several cards at a time |
| mill ↔ reanimator | **7** | Strong | Mill buries targets the recursion engine then replays |
| reanimator ↔ reanimator | **6** | Moderate | Two recursion engines mining the same discard pile, complementary but not a single combo |
| enabler ↔ enabler / mill ↔ state-payoff / reanimator ↔ state / state ↔ state / an outlet that cannot feed the payoff | **5** | Weak/Moderate | Same-axis density: parallel fillers, two payoffs that don't amplify each other, or an outlet whose discard can't switch the payoff on |

A fill combo sits at 7 rather than 8 because it is compounding, not a closed loop: the filler makes the payoff bigger, but the payoff does not cash the specific card that was filled. That is the difference between "discard Mother Gothel, replay Mother Gothel" (8) and "mill 4, your count-payoff gets bigger" (7).

### Feed check (`selfDiscardOutletFeeds`)

The 8 needs more than an outlet and a payoff in the same deck: the outlet's discard has to be able to switch that payoff on. It is checked per direction, so a card that is both an outlet and a payoff can pair either way. A pair that fails falls through to the lower tiers, usually 5.

**Recursion:** the kinds of card the outlet can discard must meet the kinds the recursion can pull.

| Side | Reads as | Example |
|------|----------|---------|
| Generic outlet | any card | "choose and discard a card" (Kronk - Meat Hut Cook), "Discard your hand" |
| Typed outlet | the kinds it names | "discard a song card" (Max Goof - Karaoke Star), "discard an Alien character card or a location card" (Sprout - Experiment 509) |
| Generic recursion | any card | "a card from your discard" (Jiminy Cricket - Ghost of Christmas Past) |
| Typed recursion | the kinds in its own clause | "return an action card … from your discard" (Buzz Lightyear - Jungle Ranger); "a character card with Singer" is character |
| Self-reference | the card's own kind | "this card", "it", or a card named like itself ("another character card named Alien", Alien - True Believer) |
| Named other card | nothing | "an action card named Three Arrows" (Merida - Formidable Archer): no typed outlet is known to discard it |

A generic side always meets. "Action" admits songs too, since a song is an action (Comprehensive Rules §5.4.4.1), while "song" admits only songs. So Max Goof - Karaoke Star feeds song, action and any-card recursion, and scores 5 with character, item and location recursion.

**State:** any discard is a "discarded a card this turn" event, so every outlet feeds an event payoff. An empty-hand payoff ("while you have no cards in your hand") is not fed by an outlet that discards one card and then draws 2 or more ("discard a song card. If you do, draw 2 cards"): its hand is never empty when it resolves. That refill rule is deliberately narrow (Max Goof - Karaoke Star only); general empty-hand scoring is a separate decision.

### Live distribution

Generated from the live engine over the current Core pool (sets 9-13 plus the Set 14 preview, measured with the #628 fixes): **123 tagged cards** (42 enabler, 48 reanimator, 6 state-payoff, 29 zone-payoff, 8 mill; roles overlap on multi-role cards such as Lyle Tiberius Rourke, who mills *and* reanimates). After the engine's ink-compatibility filter (`canShareDeck`), **7,357 unique pairs**:

| Pair shape | Count | Score | Share |
|------------|-------|-------|-------|
| enabler ↔ payoff (reanimator or state) | 2,144 | 8 | 29.1% |
| enabler ↔ zone-payoff | 1,109 | 7 | 15.1% |
| mill ↔ reanimator | 346 | 7 | 4.7% |
| mill ↔ zone-payoff | 223 | 7 | 3.0% |
| reanimator ↔ reanimator | 951 | 6 | 12.9% |
| other same-axis | 2,584 | 5 | 35.1% |

The score-8 share runs high, like Sacrifice's, and for the same structural reason: recursion is one of the deepest payoff pools in the game (48 reanimators), so a handful of enablers pair against a large payoff side. The combo *is* the archetype.

Note on ordering: the 7 guard runs before the 6, so a card that both mills and reanimates (Lyle Tiberius Rourke) scores 7 against another reanimator rather than 6. That is deliberate: he does not merely share the bin with it, he fills the bin for it.

### Token-swapped explanation

The combo string uses the project `{A}`/`{B}` convention so the **enabler** always reads as the actor, regardless of which card the user selected:

```typescript
const enablerToken = cardEnabler ? '{A}' : '{B}';
const payoffToken = cardEnabler ? '{B}' : '{A}';
// reanimator payoff: `${enablerToken} discards your own cards so ${payoffToken} can replay them from the discard.`
// state payoff:      `${enablerToken}'s self-discard switches on ${payoffToken}'s discard payoff.`
```

The fill combos follow the same convention, with the **filler** as the actor:

- enabler ↔ zone-payoff: `"{A} fills your discard from hand, switching on {B}'s discard-count payoff."`
- mill ↔ zone-payoff: `"{A} mills your deck into the discard, feeding {B}'s discard-count payoff."`
- mill ↔ reanimator: `"{A} mills cards into your discard for {B} to replay."`

Same-axis pairs use distinct sentences:

- enabler ↔ enabler: `"Both fill your own discard: parallel self-discard outlets."`
- reanimator ↔ reanimator: `"Both replay cards from your discard: two recursion engines sharing one bin."`
- other: `"Same discard-matters axis without compounding."`

---

## Coverage

- **42 enablers** (loot / discard-hand / discard-cost), every ink.
- **48 reanimators** ("from your discard", self-contained recursion excluded), the deepest side.
- **29 zone-payoffs** (count / card-type / put-this-turn), added in the Set 14 pass.
- **8 mill cards**, the deck-side filler.
- **6 state-payoffs** (discarded-this-turn + Hellbent), the thinnest side.

```chart
{
  "type": "doughnut",
  "title": "Role Composition (123 cards; multi-role overlap)",
  "data": {
    "labels": ["Reanimator (48)", "Enabler (42)", "Zone-payoff (29)", "Mill (8)", "State-payoff (6)"],
    "values": [48, 42, 29, 8, 6]
  }
}
```

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Self-Discard rule (Discard Matters)')`. The self-contained recursion carve-out and the feed check are tested in `packages/synergy-engine/src/__tests__/selfDiscard.test.ts`, with real card text.

### Role Detection (10 tests)

| Test | What it verifies |
|------|------------------|
| enabler from loot | "draw a card, then choose and discard a card" (Kronk) |
| enabler from discard-your-hand | "Discard your hand" (You Broke My Smolder) |
| reanimator | "play ... from your discard" (Mother Gothel) |
| state-payoff from discarded-this-turn | "discarded a card this turn" (Maximus) |
| state-payoff from Hellbent | "no cards in your hand" (Megavolt) |
| zone-payoff | a count, a card type in the pile, and "put into your discard this turn" all tag `['zone-payoff']` |
| mill | "put the top N cards of your deck into your discard" → `['mill']`, and mill + recursion on one card → `['reanimator','mill']` |
| multi-role | loot + reanimate on one card (Rapunzel & Flynn) → `['enabler','reanimator']` |
| excludes opponent discard | "each opponent ... discards" → no role |
| no roles for unrelated / text-less cards | empty arrays |

### Scoring (5 tests)

| Test | What it verifies |
|------|------------------|
| enabler ↔ reanimator → 8 | win-condition combo, enabler-as-actor explanation |
| enabler ↔ state-payoff → 8 | loot flips the discard-state payoff |
| enabler ↔ enabler → 5 | parallel outlets |
| fill combos → 7 | all three shapes, with the filler as the actor and the token-swap when the payoff is the searcher |
| mill ↔ state-payoff → 5 | milling is not a discard event, so it stays at the baseline |

### Self-contained recursion and feed check (8 tests, `selfDiscard.test.ts`)

| Test | What it verifies |
|------|------------------|
| self-contained recursion | Aurora - Delightful Musician is no reanimator; HeiHei - Persistent Presence has no roles |
| other roles kept | Tiana - Party Hostess stays `['enabler']`; Torn Scrap stays `['zone-payoff']` |
| discard-fed recursion kept | Mother Gothel - Evil as Ever and Look What You've Done keep `reanimator` |
| song-only outlet → 8 | Max Goof - Karaoke Star with song (Max Goof - Rebellious Teen), action (Buzz Lightyear - Jungle Ranger) and any-card (Jiminy Cricket - Ghost of Christmas Past) recursion |
| song-only outlet → 5 | with Circle of Life (from both searchers), Salvage Operation, Look What You've Done and Merida - Formidable Archer |
| state payoffs | Max Goof feeds Maximus (8) but not Megavolt (5); You Broke My Smolder and Kronk still feed Megavolt (8) |
| character-or-location outlet → 8 | Sprout - Experiment 509 with Get to Safety!, Circle of Life, Alien - True Believer and Megavolt |
| character-or-location outlet → 5 | Sprout with Salvage Operation and Max Goof - Rebellious Teen |

---

## Design Decisions and Rationale

### Why a new rule, not a role on Discard?

The Discard rule is opponent-facing (make *them* discard, reward *your* hand-size advantage). Self-Discard is the opposite direction (discard *your own*, empty *your* hand). A card that is a payoff in one is an anti-payoff in the other (Hellbent wants an empty hand; Discard's payoff wants a full one). Folding them together would blur two opposite archetypes, so this is a separate playstyle that mirrors Sacrifice.

### Why mill is a bin-filler, not an enabler

Mill fills the bin from the deck, not the hand. It feeds anything that *reads* or *pulls from* the pile (zone payoffs, reanimators), but it does **not** trigger "when you discard" payoffs (Mother Gothel, Maximus), which need an actual hand discard. So it carries its own role rather than joining `enabler`: it scores 7 against zone payoffs and reanimators, and stays at the 5 baseline against state payoffs.

It was excluded outright until the Set 14 pass, on the grounds that the pool was thin and mill had no payoff to point at. The zone-payoff role is that payoff: once the engine could see "10 or more cards in your discard", a mechanic whose entire job is raising that number could no longer be a non-participant.

### Why reanimator ↔ reanimator sits at 6, not 5

Two recursion engines genuinely complement each other, they mine the same bin and give it two ways to convert to board, which is more than parallel density but less than a single enabler→payoff combo. It is the one same-axis case that earns a bump above the 5 baseline.
