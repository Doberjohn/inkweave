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
- **state-payoff** — rewards the discard *event* ("if you discarded a card this turn"), an empty hand (Hellbent), or a small one (the Gargoyles' STONE BY DAY, whose characters can't ready while you hold 3 or more cards).
- **zone-payoff** — rewards the discard as a countable *zone* ("while you have 10 or more cards in your discard", "a song card in your discard", "if 2 or more cards were put into your discard this turn").

The two filler roles are not interchangeable: a hand discard *is* a discard event, so it can switch on the payoffs that wait for one; milling never triggers a "when you discard" payoff, so it feeds only the payoffs that read the pile itself. That distinction is what the score matrix encodes, together with a second one: whether the discard *switches a payoff on* (the discard event, an empty hand, recursion that fires when you discard), *switches a drawback off* (a hand of 2 or fewer lets a STONE BY DAY character ready), or only *stocks the pile* a payoff reads, which banished characters and played actions stock too.

Like Sacrifice, it is an asymmetric-role playstyle: the fillers *create* the fuel that the payoffs *exploit*. A deck of all reanimators has an empty bin; a deck of all loot has nothing to bring back. The combo is the rule. This rule fills the "recursion role" that `makeSearchPattern` in `cardHelpers.ts` deliberately deferred ("from your discard ... Recursion deserves its own role; see Phase 3").

### Example

**Enabler (loot)**: Scrooge McDuck - S.H.U.S.H. Agent (Emerald): "When you play this character, draw a card, then choose and discard a card."
**Reanimator**: Mother Gothel - Evil as Ever (Emerald): "When you discard this card, you may play this character from your discard."

Loot Mother Gothel into the discard → she replays herself from it (you still pay her cost). The loot digs for what you need *and* stocks the bin; the reanimator cashes it. Same-ink Emerald.

---

## Role Detection

### Architecture

```typescript
getSelfDiscardRoles(card: LorcanaCard): SelfDiscardRole[]  // any subset of the five roles
```

A card can be multi-role: `Rapunzel & Flynn Rider - Unlikely Pair` loots (enabler) *and* replays discarded characters (reanimator). Detection uses a fast pre-filter (`HAS_SELF_DISCARD_KEYWORD = /discard|no cards in|cards in your hand/i`) before the patterns. The last branch is for STONE BY DAY, whose text never says "discard".

### enabler (self-discard outlet from hand)

Three sub-patterns, all gated against opponent-facing discard:

```regex
loot: /draw\s+(?:a|an|\d+)\s+cards?,?\s+then\s+(?:choose and\s+)?discard/i
hand: /discard\s+your\s+hand/i
cost: /(?:you may\s+)?discard\s+(?:a|an|another|\d+)\s+(?:\w+\s+){0,2}?cards?\b/i
gate: !(/opponent|each player|challenging player|that player|most cards in their hands?/i)
```

| Shape | Example card text | Card |
|-------|-------------------|------|
| Loot | "draw a card, **then choose and discard a card**." | Kronk - Meat Hut Cook |
| Discard hand | "**Discard your hand.** Draw 2 cards." | You Broke My Smolder |
| Discard as cost | "**discard a card** to ..." | (discount / cost outlets) |

The discard-as-cost pattern is intentionally kept tight (`{0,2}` words between "discard a" and "card"), so it catches generic "discard a card" costs without over-tagging narrow conditional costs. The only rotation card it left half-tagged when this was measured is The Queen - Conceited Ruler (a "discard a Princess or Queen character card" cost); widening it to `{0,4}` would then have promoted exactly one card to `enabler` and bumped 49 pairs, so it stays tight.

### reanimator (recursion payoff)

```regex
/(?:play|return|put)\b[^.]{0,60}\bfrom your discard\b/i
```

Matches playing, returning, or putting a card **from your discard**:

| Example card text | Card |
|-------------------|------|
| "you may **play this character from your discard**." | Mother Gothel - Evil as Ever |
| "**return a character card from your discard** to your hand." | The Queen - Conceited Ruler, Bruno's Return |
| "you may **play that character from your discard**." | Rapunzel & Flynn Rider |

The `[^.]{0,60}` window keeps the verb and "from your discard" inside one clause, so a card can't match by having "play" in one sentence and "from your discard" in an unrelated one.

**Self-contained recursion is stripped first** (`stripSelfContainedRecursion`). Some recursion can only ever return the card itself or a card it just handled, so no hand-discard outlet feeds it (a mill only by luck). Its sentence is removed before the reanimator test. The verb has to take "this/that X from your discard" directly, so an enter-play trigger such as "When you play this character, return a card from your discard" stays recursion:

| Shape | Example card text | Card |
|-------|-------------------|------|
| The card itself | "**return this card from your discard** to your hand." | HeiHei - Persistent Presence |
| A card played this turn | "return a song card **you played this turn** … from your discard" | Aurora - Delightful Musician |
| A card it just discarded | "If you discarded a location card **this way, you may play it from your discard**" | Tiana - Party Hostess |

Recursion that fires when **you** discard the card stays ("when you discard this card, you may play it from your discard": Mother Gothel - Evil as Ever, Look What You've Done, Rapunzel & Flynn Rider), because a hand discard is exactly what feeds it. Tiana keeps `enabler` (her draw-then-discard is a real outlet) and Torn Scrap keeps `zone-payoff`.

**Recursion of one named card is stripped too** (`stripUnfedRecursion`): "return an action card **named Three Arrows** from your discard" (Merida - Formidable Archer), "an action card named Fire the Cannons!" (Captain Hook - Captain of the Jolly Roger), "a character card named Hen Wen" (Taran - Pig Keeper) and "another character card named Alien" (Alien - True Believer, the only card named Alien). Only that one card switches the recursion on. An outlet or a mill feeds it only when it happens to put that card into your discard, a narrow case the Self-Discard roles don't model, so pairing it with every outlet would overstate it. Named Companions pairs Merida, Captain Hook and Taran with the card each names; Alien names only another copy of itself, so no rule pairs it for this ability. Neither side of "named" may cross another play/return/put, so a named card elsewhere in the sentence ("if you have an item named Rivera Family Photo in play, you may play this item from your discard") doesn't strip the recursion next to it.

**So is a sweep the card must make**: "put 3 cards from your discard on the bottom of your deck in any order or banish her" (Mamá Imelda - No-Nonsense Ancestor) and "put all Toy character cards from your discard on the bottom of your deck" (Bouncing Ducky - Sid's Toy, who keeps `zone-payoff` for his discount). No card comes back to hand or play. An optional sweep ("You may put a Toy character card from your discard on the bottom of your deck to play this character for free", Hand-in-the-Box - Sid's Toy) is a cost the card pays for something else, and stays a reanimator.

### state-payoff (discard event / empty hand / small hand)

```regex
event:      /discarded\s+a\s+card\s+this\s+turn/i
empty hand: /no cards in (?:your )?hand/i
small hand: /if you have 3 or more cards in your hand, this character can't ready/i
```

The three shapes are separate patterns so the feed check (below) can tell them apart. The small-hand pattern reads the condition, not the ability's name, and the text is normalized first, so a typographic apostrophe ("can’t") matches too.

| Shape | Example card text | Card |
|-------|-------------------|------|
| Discarded this turn | "**If you discarded a card this turn**, ..." | Maximus - Relentless Stallion, Discarded Armor |
| Hellbent | "**While you have no cards in your hand**, ..." | Megavolt - Electrical Menace, Gizmoduck |
| Small hand (STONE BY DAY) | "**If you have 3 or more cards in your hand, this character can't ready.**" | Bronx - Ferocious Beast, Goliath - Clan Leader |

STONE BY DAY is a drawback a small hand switches off: a Gargoyle that quested or challenged stays exerted unless you hold 2 or fewer cards. The Ready step comes before the Draw step (Comprehensive Rules 3.2.1 to 3.2.3), so the hand that counts is the one you end your previous turn with. Every one of the 14 cards that carry it is a Gargoyle; three of them also carry an outlet (Hudson - Determined Reader, Goliath - Transformed Warrior, Demona - Imperious Spellcaster).

### zone-payoff (the discard as a countable zone)

```regex
in:  /\b(?:a|an|\d+\s+or\s+more|for\s+each)\s+(?:\w+\s+){0,3}?cards?\s+in\s+your\s+discard\b/i
put: /cards?\s+were\s+put\s+into\s+your\s+discard\s+this\s+turn/i
```

The `in your discard` wording keeps this disjoint from the reanimator's `from your discard`: a zone payoff *reads* the pile, a reanimator *empties* it. The `put` pattern covers the trigger family that counts what arrived this turn regardless of how it got there. A check for one named card is no pile check ("if you have a character card named Panic in your discard", Pain - Running with Scissors): only that card switches it on, and Named Companions pairs the two.

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
| **Opponent discard** | Anything matching `opponent` / `each player` is the Discard rule's domain (attacking *their* hand). The gate keeps the two axes disjoint, exactly the boundary the Discard rule's doc calls out ("self-discard ... belongs to a separate axis"). Search for Clues ("the player or players with the most cards in their hands choose and discard 2 cards") is gated out too: it lands on you only while your hand is the biggest, and the Discard rule reads it as comparative targeting. One narrow exception: Goliath - Clan Leader's end-of-turn trim stays out of `enabler` but feeds the small-hand payoff (see Feed check). |
| **Big-hand payoffs** | Jafar - Keeper of Secrets ("+1 ¤ for each card in your hand") and Tinker Bell - Snowflake Collector ("While you have 4 or more cards in your hand") want the opposite of a small hand, so the small-hand pattern names STONE BY DAY's own condition rather than any hand-size count. Neither is a Discard payoff either: that one compares your hand with an opponent's. |
| **Songs as bin-fillers** | A sung song lands in the discard, so in principle every Song feeds a zone payoff. It is not modelled: that would make every Song a bin-filler and drown the axis in near-baseline pairs, and the Song half of the interaction already has a home in the Singer + Songs rule. |
| **Mill as a hand-discard enabler** | Mill *is* tagged (role `mill`) but is never an `enabler`: it fills the bin from the deck, so it cannot switch on a payoff that needs an actual hand discard, nor shrink your hand for a small-hand one. `mill ↔ state-payoff` therefore stays at the 5 baseline, while an outlet scores 8 with a discard-event payoff. |

---

## Card examples by role

Real cards the `getSelfDiscardRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **enabler** | Kronk - Meat Hut Cook (Steel), Tod - Clever Fox (Emerald), The Horned King - Wicked Ruler (Amethyst) | Discard your own cards from hand: loot, discard-your-hand, or discard-as-cost |
| **reanimator** | The Queen - Conceited Ruler (Amber), Lady Tremaine - Sinister Socialite (Ruby), Pluto - Clever Cluefinder (Sapphire) | Play or return a card *from your discard*: the deep recursion payoff |
| **state-payoff** | Maximus - Relentless Stallion (Steel), Megavolt - Electrical Menace (Steel), Bronx - Ferocious Beast (Ruby) | Rewards the discard event ("discarded a card this turn") or an empty hand (Hellbent), or needs a small one to ready (STONE BY DAY) |
| **zone-payoff** | Priya Mangal - Serious Music Lover (Amber), Dante - Strange and Endearing (Amethyst), Helga Sinclair - No Backup Needed (Emerald) | Reads the pile itself: a count, a card type sitting there, or what was put there this turn |
| **mill** | Quackerjack - Loony Toymaker (Sapphire), Preston Whitmore - Expedition Financier (Ruby), Remote Inklands - Desert Ruins (Ruby) | Puts cards from the top of your deck into your discard |

---

## Scoring (8/7/6/5 matrix)

Applies the project-wide **5-baseline convention** and mirrors the Sacrifice shape (asymmetric combo at peak, same-axis density at floor), with a `7` for a filler that stocks the pile a payoff reads and a `6` for complementary pairs (a hand discard nudging a pile count, two recursion engines).

### Score Table

| Pair Type | Score | Display Tier | Explanation |
|-----------|-------|-------------|-------------|
| enabler ↔ a payoff its discard switches on | **8** | Strong | Win-condition combo: the discard flips a "discarded this turn" / empty-hand payoff (state) on demand, or fires recursion that replays the discarded card ("when you discard this card, you may play this character from your discard"). Only when the outlet's discard can reach that payoff (see Feed check) |
| enabler ↔ any other reanimator | **7** | Strong | Mechanical compounding: the outlet stocks the bin the recursion replays from, and picks what lands there |
| enabler ↔ small-hand payoff | **7** | Strong | Mechanical compounding: an outlet that shrinks your hand switches the STONE BY DAY drawback off, so the character readies. Only an outlet that shrinks the hand, or Goliath - Clan Leader's end-of-turn trim (see Feed check) |
| mill ↔ zone-payoff | **7** | Strong | The deck-side filler stocks the pile the payoff counts, several cards at a time and without spending the hand |
| mill ↔ reanimator | **7** | Strong | Mill buries targets the recursion engine then replays. Not recursion that fires only on your discard (see Feed check) |
| enabler ↔ zone-payoff | **6** | Moderate | Complementary: each hand discard adds one card to the count the payoff reads, a nudge rather than a compounding. Only when the outlet can discard a card the payoff counts, and in time (see Feed check) |
| reanimator ↔ reanimator | **6** | Moderate | Two recursion engines mining the same discard pile, complementary but not a single combo |
| enabler ↔ enabler / mill ↔ state-payoff / reanimator ↔ state / state ↔ state / an outlet that cannot feed the payoff | **5** | Weak/Moderate | Same-axis density: parallel fillers, two payoffs that don't amplify each other, or an outlet whose discard can't reach the payoff (a loot or a refill next to a small-hand or empty-hand payoff, an outlet that draws after its discard next to an empty-hand payoff, an end-of-turn outlet next to a check made earlier in the turn) |

Only an 8 is a closed loop: the discard itself is what the payoff waits for. That is the difference between "discard Mother Gothel, replay Mother Gothel" (8) and "discard a card, and a recursion engine has one more target" (7). Most recursion pulls whatever sits in the pile, and play stocks the pile on its own: every banished character and every action or song you play ends up there. An outlet adds choice and speed to that engine, not the engine itself.

### Feed check (`selfDiscardOutletFeed`)

The enabler ↔ payoff combo needs more than an outlet and a payoff in the same deck: the outlet's discard has to reach that payoff. `selfDiscardOutletFeed` answers per direction with `trigger` (the discard switches the payoff on: 8), `stock` (it only stocks the bin a recursion payoff replays from: 7), `unlock` (it keeps your hand small enough for a STONE BY DAY character to ready: 7) or nothing. When both directions feed, the stronger one sets the score and the explanation's actor, so a card that is both an outlet and a payoff can pair either way; on a tie the searcher holds the outlet. A pair that fails falls through to the lower tiers, usually 5.

**Recursion:** the kinds of card the outlet can discard must meet the kinds the recursion can pull.

| Side | Reads as | Example |
|------|----------|---------|
| Generic outlet | any card | "choose and discard a card" (Kronk - Meat Hut Cook), "Discard your hand" |
| Typed outlet | the kinds it names, a classification included | "discard a song card" (Max Goof - Karaoke Star), "discard an Alien character card or a location card" (Sprout - Experiment 509: Alien characters and locations) |
| Generic recursion | any card | "a card from your discard" (Jiminy Cricket - Ghost of Christmas Past) |
| Typed recursion | the kinds in its own clause | "return an action card … from your discard" (Buzz Lightyear - Jungle Ranger); "a character card with Singer" is character; "a Detective character card" (Fangmeyer - Icy Officer) is Detective characters |
| Self-reference | the card itself | "this character", "this card", "it": a song, the card's type, or for a character each of its classifications |

A generic side always meets. "Action" admits songs too, since a song is an action (Comprehensive Rules §5.4.4.1), while "song" admits only songs. So Max Goof - Karaoke Star feeds song, action and any-card recursion (7 each, since none of it fires on the discard), and scores 5 with character, item and location recursion. A classification narrows the character kind, and two named classifications meet only when they are the same: Sprout - Experiment 509 feeds Rapunzel & Flynn Rider - Unlikely Pair, who replays whatever character you discard (8), but neither Mother Gothel - Evil as Ever, who isn't an Alien, nor Detective recursion (Fangmeyer - Icy Officer).

**Pile counts:** the enabler ↔ zone-payoff 6 needs the same meeting (`selfDiscardOutletFeedsPile`): the outlet has to be able to discard a card the payoff counts. A generic outlet adds to every count, and "10 or more cards in your discard" or "cards were put into your discard this turn" counts any card, while Sprout adds to "for each Alien character card in your discard" (Dr. Hamsterviel - Infamous Scientist) but not to a Gargoyle, item, action or song count, and Max Goof - Karaoke Star's songs add to song and action counts only.

**Trigger or stock:** recursion that fires on your discard is a trigger and scores 8: Mother Gothel - Evil as Ever and Look What You've Done ("during your turn, when you discard this card, you may play it from your discard") and Rapunzel & Flynn Rider - Unlikely Pair ("whenever you discard a character card, you may play that character from your discard"). The check reads the recursion sentence itself (`hasDiscardFedRecursion`), so an unrelated "when you discard" elsewhere on a card doesn't count. Every other recursion only has its bin stocked by the outlet and scores 7.

**State:** a trigger for the discard event and the empty hand. Any discard is a "discarded a card this turn" event, so every outlet feeds an event payoff, unless it discards too late (see Timing). An empty-hand payoff (Megavolt - Electrical Menace: "While you have no cards in your hand, this character gains Resist +2") is fed only by an outlet that takes cards from your hand and puts none back (see Small hand and empty hand). A loot hands back what it takes, and discarding your hand before drawing 2 or returning a card leaves you 1 or 2, so those score 5 with it.

**Timing:** an outlet that discards only as your turn ends (Meeko - Skittish Scrounger: "At the end of your turn, if this character is exerted, choose and discard a card or banish him"; Scar - Finally King) lands after every check made while you quest, challenge or play. It feeds neither "If you discarded a card this turn" (Maximus - Relentless Stallion, Discarded Armor) nor a "cards were put into your discard this turn" check made earlier (Helga Sinclair - No Backup Needed's discount, Kida - Discovering the Unknown's quest trigger, Escape Plan), and scores 5 with them (`discardLandsInTime`, read one ability at a time). It still feeds the checks made as the turn ends (Milo Thatch - Getting His Hands Dirty, Lyle Tiberius Rourke - Adventurer for Hire, Kashekim - Wise King), pile counts, recursion and STONE BY DAY, so `selfDiscardOutletFeedsPile` gates the enabler ↔ zone-payoff row the same way.

**Mill:** a milled card is put into your discard, not discarded, so a mill never switches on recursion that fires only on your discard. `selfDiscardMillFeedsRecursion` keeps Mother Gothel - Evil as Ever and Look What You've Done out of the mill ↔ reanimator 7: they score 5 with a plain mill, and 6 with Lyle Tiberius Rourke - Crystallized Commander, who reanimates too. Rapunzel & Flynn Rider - Unlikely Pair reads the same way, though no mill shares a deck with both of her inks today.

**Small hand and empty hand:** STONE BY DAY reads how many cards you hold and an empty-hand payoff whether you hold any, not whether you discarded, so an outlet that draws first or refills afterwards hands back what it took. A small hand takes an unlock (7) from an outlet that leaves the hand smaller. An empty hand takes a trigger (8) only from one that also puts no card back after its discard, in the same sentence or the next (`drawsAfterDiscard`, read one ability at a time): each discard it makes is a card closer to an empty hand.

| Outlet | Small hand? | Empty hand? | Example |
|--------|-------------|-------------|---------|
| Discard, nothing drawn | yes | yes | "choose and discard a card" (Gantu - Hamsterviel's Accomplice), "choose and discard a card or banish him" (Meeko - Skittish Scrounger) |
| Discard your hand, then draw 2 or return a card | yes: 1 or 2 cards is a small hand | no: the hand is never empty | "Discard your hand. Draw 2 cards." (You Broke My Smolder), "discard your hand and draw 2 cards" (Syndrome's Remote), "discard your hand. If you do, return a card from your discard to your hand" (Hercules - Young Rescuer) |
| Loot (draw or return to hand first) | no | no | "draw a card, then choose and discard a card" (Kronk - Meat Hut Cook, Hudson - Determined Reader) |
| Refill (discard 1, draw 2 or more) | no | no | "choose and discard a song card. If you do, draw 2 cards" (Max Goof - Karaoke Star) |

Coverage counts the outlets that shrink the hand. Goliath - Clan Leader has no outlet of his own (his DUSK TO DAWN makes *each player* discard, which the enabler gate keeps out), but at the end of your turn it trims your hand to 2, exactly what STONE BY DAY asks for. `selfDiscardHandTrimFeed` reads that trim as an unlock for a small-hand payoff and nothing else: it resolves after the turn's actions, and it draws a hand of 0 or 1 back up to 2, so it never feeds a "discarded this turn" or empty-hand payoff, and it is no outlet for recursion or a pile count. He scores 7 with every other STONE BY DAY card, and, being one himself, 7 with every outlet that shrinks the hand.

### Live distribution

<!-- coverage:start distribution -->
Counted by `pnpm refresh-rule-coverage` over the Core cards in the synergy pool (sets 9-14).

**131 tagged cards** (43 enabler, 44 reanimator, 20 state-payoff, 28 zone-payoff, 8 mill; roles overlap on multi-role cards). **8,360 unique pairs** after the engine's ink-compatibility filter (`canShareDeck`):

| Pair shape | Pairs | Score | Share |
|----------|-----|-----|-----|
| enabler ↔ a payoff its discard switches on | 249 | 8 | 3.0% |
| enabler ↔ any other reanimator | 1,661 | 7 | 19.9% |
| enabler ↔ small-hand payoff | 229 | 7 | 2.7% |
| mill ↔ reanimator | 308 | 7 | 3.7% |
| mill ↔ zone-payoff | 219 | 7 | 2.6% |
| enabler ↔ zone-payoff | 1,098 | 6 | 13.1% |
| reanimator ↔ reanimator | 785 | 6 | 9.4% |
| enabler ↔ enabler | 694 | 5 | 8.3% |
| other same-axis | 3,117 | 5 | 37.3% |
<!-- coverage:end -->

Roles overlap on multi-role cards such as Lyle Tiberius Rourke, who mills *and* reanimates, or Hudson - Determined Reader, who loots and carries STONE BY DAY. When both cards of a pair score it the same, the pair is read from its lower-id card as the searcher.

The score-8 share is small on purpose. Recursion is one of the deepest payoff pools in the game, but only a few reanimators fire on the discard, and only the discard-event and empty-hand state payoffs need one (Coverage names both), the empty-hand ones an outlet that puts no card back; every other reanimator pairs with the outlets at 7. The STONE BY DAY cards need a small hand instead, which only the outlets that shrink the hand and Goliath - Clan Leader's trim provide, so they sit at 5 with every loot, refill, mill and other payoff in their inks; the Stone by Day pass raised the 5 share for that reason. A pair can score 7 from both sides for different reasons, and then its row depends on the searcher: Hercules - Young Rescuer's discard-your-hand unlocks Hudson - Determined Reader, Goliath - Transformed Warrior and Demona - Imperious Spellcaster, whose outlets in turn stock his recursion.

Note on ordering: the 7 guard runs before the 6, so a card that both mills and reanimates (Lyle Tiberius Rourke) scores 7 against another reanimator rather than 6. That is deliberate: he does not merely share the bin with it, he fills the bin for it. For the same reason the fill rows run best score first: an outlet that also counts the pile (Max Goof - Karaoke Star) against a mill that counts it too (Though I Have to Say Goodbye) reads as the mill at 7, not as the outlet at 6.

### Token-swapped explanation

The combo string uses the project `{A}`/`{B}` convention so the **enabler** always reads as the actor, regardless of which card the user selected. When both cards have an outlet, the actor is the one whose discard reaches the other's payoff (a plain loot card feeding Rapunzel & Flynn Rider - Unlikely Pair reads as the actor from either side):

```typescript
const tokens = combo.enablerIsCard
  ? {enabler: '{A}', payoff: '{B}'}
  : {enabler: '{B}', payoff: '{A}'};
// small-hand payoff: `${enabler}'s self-discard keeps your hand at 2 or fewer, so ${payoff} can ready.`
// reanimator payoff: `${enabler} discards your own cards so ${payoff} can replay them from the discard.`
// state payoff:      `${enabler}'s self-discard switches on ${payoff}'s discard payoff.`
```

The 7 and 8 recursion combos share one string; the score tells them apart. Goliath - Clan Leader's trim reads as the actor too, with the small-hand string. The fill combos follow the same convention, with the **filler** as the actor:

- mill ↔ zone-payoff (7): `"{A} mills your deck into the discard, feeding {B}'s discard-count payoff."`
- mill ↔ reanimator (7): `"{A} mills cards into your discard for {B} to replay."`
- enabler ↔ zone-payoff (6): `"{A} fills your discard from hand, switching on {B}'s discard-count payoff."`

Same-axis pairs name both cards:

- enabler ↔ enabler (5): `"{A} and {B} both fill your discard from your hand."`
- reanimator ↔ reanimator (6): `"{A} and {B} both take cards from your discard."` It says "take", not "replay": some reanimators put a discard card on the bottom of your deck or into your inkwell instead.
- other (5): `"{A} and {B} both go in a Self-Discard deck."`

---

## Coverage

<!-- coverage:start coverage -->
| Role | Cards | Cards per ink |
|----|-----|-------------|
| enabler (loot / discard-hand / discard-cost) | 43 | Steel 23, Emerald 14, Amethyst 5, Ruby 2 |
| reanimator ("from your discard", minus self-contained, named-card and forced deck-bottom clauses) | 44 | Amber 18, Sapphire 9, Emerald 7, Ruby 6, Steel 5, Amethyst 1 |
| state-payoff (discarded this turn / Hellbent / STONE BY DAY) | 20 | Steel 10, Amethyst 6, Ruby 4 |
| zone-payoff (count / card-type / put-this-turn) | 28 | Ruby 11, Emerald 6, Amethyst 5, Sapphire 3, Amber 2, Steel 1 |
| mill (deck-side filler) | 8 | Ruby 7, Sapphire 1 |

| Read from the pairs | Cards |
|-------------------|-----|
| Reanimators that fire on the discard (8 with an outlet) | 3 (Look What You've Done, Mother Gothel - Evil as Ever, Rapunzel & Flynn Rider - Unlikely Pair) |
| State payoffs an outlet's discard switches on (8) | 6 (Angel - Experiment 624, Beast's Mirror, Discarded Armor, Gizmoduck - Duckburg Defender, Maximus - Relentless Stallion, Megavolt - Electrical Menace) |
| STONE BY DAY payoffs an outlet unlocks (7) | 14 |
| Outlets that shrink the hand enough to unlock one (7) | 16 |

```chart
{
  "type": "doughnut",
  "title": "Role composition (131 cards; multi-role overlap)",
  "data": {
    "labels": ["Enabler (43)", "Reanimator (44)", "State-payoff (20)", "Zone-payoff (28)", "Mill (8)"],
    "values": [43, 44, 20, 28, 8]
  }
}
```
<!-- coverage:end -->

Reanimators are the deepest side and mill, the deck-side filler, the thinnest. The zone-payoff and mill roles joined in the Set 14 pass; the STONE BY DAY payoffs are the Amethyst, Ruby and Steel Gargoyles.

---

## Test Coverage

Tests live in `packages/synergy-engine/src/__tests__/rules.test.ts` under `describe('Self-Discard rule (Discard Matters)')`. The self-contained recursion, named-card, deck-bottom sweep and biggest-hand carve-outs and the feed check are tested in `packages/synergy-engine/src/__tests__/selfDiscard.test.ts`, and STONE BY DAY in `packages/synergy-engine/src/__tests__/stoneByDay.test.ts`, both with real card text.

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
| enabler ↔ discard-fed recursion → 8 | win-condition combo (loot into Mother Gothel), enabler-as-actor explanation |
| enabler ↔ state-payoff → 8 | loot flips the discard-state payoff |
| enabler ↔ enabler → 5 | parallel outlets |
| fill combos → 7 / 6 | mill ↔ zone-payoff and mill ↔ reanimator 7, loot ↔ zone-payoff 6, with the filler as the actor and the token-swap when the payoff is the searcher |
| mill ↔ state-payoff → 5 | milling is not a discard event, so it stays at the baseline |

### Self-contained recursion, named cards, deck-bottom sweeps, the biggest hand and feed check (23 tests, `selfDiscard.test.ts`)

| Test | What it verifies |
|------|------------------|
| self-contained recursion | Aurora - Delightful Musician is no reanimator; HeiHei - Persistent Presence ("this card"), Belle - Snowfield Strategist ("that card") and Sulley & Boo ("those characters") have no roles |
| other roles kept | Tiana - Party Hostess stays `['enabler']`; Torn Scrap stays `['zone-payoff']` |
| discard-fed recursion kept | Mother Gothel - Evil as Ever and Look What You've Done keep `reanimator` |
| enter-play recursion kept | "When you play this character, return a card from your discard" stays a reanimator |
| trigger or stock | Kronk with Mother Gothel - Evil as Ever (from both searchers), Look What You've Done and Rapunzel & Flynn Rider - Unlikely Pair → 8; with Salvage Operation (from both searchers) → 7 |
| the outlet that feeds is the actor | Rapunzel & Flynn Rider as the searcher with Kronk reads Kronk (`{B}`) as the actor |
| song-only outlet → 7 | Max Goof - Karaoke Star with song (Max Goof - Rebellious Teen), action (Buzz Lightyear - Jungle Ranger) and any-card (Jiminy Cricket - Ghost of Christmas Past) recursion |
| song-only outlet → 5 | with Circle of Life (from both searchers), Salvage Operation and Look What You've Done |
| discard-event payoff | Max Goof and You Broke My Smolder feed Maximus (8) |
| empty-hand payoff | Sprout - Experiment 509 feeds Megavolt (8, from both searchers); Kronk, Max Goof, You Broke My Smolder, Hercules - Young Rescuer and Syndrome's Remote put cards back in your hand and score 5 with him |
| a mill and discard-fed recursion | Héctor Rivera - Street Musician with Salvage Operation → 7, with Mother Gothel - Evil as Ever and Look What You've Done → 5 |
| end-of-turn outlet | Meeko - Skittish Scrounger with Maximus - Relentless Stallion and Helga Sinclair - No Backup Needed → 5, with Milo Thatch - Getting His Hands Dirty → 6; Kronk with Maximus → 8 and with Helga → 6 |
| an outlet for one classification | Sprout - Experiment 509 with Rapunzel & Flynn Rider - Unlikely Pair → 8; with Mother Gothel - Evil as Ever (no Alien) and Fangmeyer - Icy Officer (Detective recursion) → 5 |
| a typed outlet and a pile count | Sprout with Dr. Hamsterviel - Infamous Scientist (Alien count) → 6, with Coldstone - Reincarnated Cyborg (Gargoyle count) → 5; Max Goof - Karaoke Star with Priya Mangal - Serious Music Lover (song) → 6, with Dr. Hamsterviel → 5; Kronk with Coldstone → 6 |
| character-or-location outlet → 7 | Sprout - Experiment 509 with Get to Safety! and Circle of Life |
| character-or-location outlet → 5 | Sprout with Salvage Operation and Max Goof - Rebellious Teen |
| named-card recursion | Captain Hook - Captain of the Jolly Roger, Merida - Formidable Archer and Alien - True Believer have no roles |
| named-card pile check | Pain - Running with Scissors has no roles |
| a named card in another sentence | Get to Safety! stays `['reanimator']` |
| a sweep the card must make | Mamá Imelda - No-Nonsense Ancestor has no roles; Bouncing Ducky - Sid's Toy keeps only `['zone-payoff']` |
| an optional sweep | Hand-in-the-Box - Sid's Toy stays `['reanimator']` |
| a discard aimed at the biggest hand | Search for Clues has no roles, and the Discard rule keeps it `['standard']` |

### STONE BY DAY (9 tests, `stoneByDay.test.ts`)

| Test | What it verifies |
|------|------------------|
| small-hand payoff role | Bronx - Ferocious Beast reads `['state-payoff']`; Hudson - Determined Reader keeps his outlet, `['enabler', 'state-payoff']` |
| the trim is no outlet | Goliath - Clan Leader reads `['state-payoff']` only |
| big-hand payoffs stay out | Tinker Bell - Snowflake Collector and Jafar - Keeper of Secrets have no roles |
| no leak into Discard | Bronx has no Discard role; Goliath - Clan Leader keeps only the `standard` role his trim gives him there |
| an outlet that shrinks the hand → 7 | Gantu - Hamsterviel's Accomplice with Bronx from both searchers (the outlet as the actor), Meeko - Skittish Scrounger and You Broke My Smolder with Bronx, Gantu with Hudson |
| a loot or a refill → 5 | Kronk - Meat Hut Cook, Max Goof - Karaoke Star and Hudson with Bronx |
| the trim → 7 | Goliath - Clan Leader with Bronx, and with Hudson as the searcher, Goliath reading as the actor both times |
| the trim feeds nothing else → 5 | Goliath - Clan Leader with Megavolt - Electrical Menace and Maximus - Relentless Stallion |
| small-hand payoff with another payoff → 5 | Bronx with Demona - Betrayer of the Clan, Megavolt and Maximus |

---

## Design Decisions and Rationale

### Why a new rule, not a role on Discard?

The Discard rule is opponent-facing (make *them* discard, reward *your* hand-size advantage). Self-Discard is the opposite direction (discard *your own*, empty *your* hand). A card that is a payoff in one is an anti-payoff in the other (Hellbent wants an empty hand; Discard's payoff wants a full one). Folding them together would blur two opposite archetypes, so this is a separate playstyle that mirrors Sacrifice.

### Why mill is a bin-filler, not an enabler

Mill fills the bin from the deck, not the hand. It feeds anything that *reads* or *pulls from* the pile (zone payoffs, reanimators), but it does **not** trigger "when you discard" payoffs (Mother Gothel, Maximus), which need an actual hand discard. So it carries its own role rather than joining `enabler`: it scores 7 against zone payoffs and reanimators, and stays at the 5 baseline against state payoffs and against recursion that only fires on your discard (Mother Gothel's own). Against a zone payoff it outscores a hand discard (7 to 6), because it adds several cards at a time without spending the hand.

It was excluded outright until the Set 14 pass, on the grounds that the pool was thin and mill had no payoff to point at. The zone-payoff role is that payoff: once the engine could see "10 or more cards in your discard", a mechanic whose entire job is raising that number could no longer be a non-participant.

### Why an outlet scores 8 only with a payoff its discard switches on

Every enabler ↔ reanimator pair used to score 8 and every enabler ↔ zone-payoff pair 7. Community votes rated both groups well below those scores, further below than voters sit from the engine overall, while the few votes on the pairs that keep 8 sat in line with the rest of the engine. The mechanics agree. An 8 is a closed loop: Maximus - Relentless Stallion needs a discard this turn, and Mother Gothel - Evil as Ever replays herself because she was discarded, so the outlet is what switches them on. Generic recursion ("return a character card from your discard to your hand") runs on a pile that banished characters and played actions fill anyway; the outlet adds choice and speed, which is compounding (7). A count payoff ("10 or more cards in your discard") gains one card per hand discard, a nudge rather than a compounding (6), while a mill adds several cards at a time and keeps its 7.

### Why reanimator ↔ reanimator sits at 6, not 5

Two recursion engines genuinely complement each other, they mine the same bin and give it two ways to convert to board, which is more than parallel density but less than a single enabler→payoff combo. It is the one same-axis case that earns a bump above the 5 baseline.

### Why STONE BY DAY is a Self-Discard payoff

STONE BY DAY wants a small hand, a milder form of what Hellbent wants, and your own outlets are what give you one. Discard is the wrong home: its hand-size payoff compares your hand with an opponent's, and a Gargoyle doesn't care what the opponent holds. So it is a third state-payoff shape rather than a new playstyle, and the Gargoyle tribe keeps what the clan does for itself (TRIBES_RULE.md leaves the hand-size side here).

### Why a small hand scores 7, not 8

An 8 is a closed loop: the discard is what the payoff waits for. STONE BY DAY is a drawback the card puts on itself, and the outlet lifts it rather than adding anything, only on turns after the character exerted and only while you keep holding 2 or fewer. That is compounding, the same tier as an outlet stocking a recursion bin.

### Why a loot or a refill doesn't feed STONE BY DAY

STONE BY DAY counts the cards you hold, not the cards you discarded. A loot draws before it discards and a refill draws 2 after discarding 1, so the hand ends as big or bigger, and scoring one 7 with a Gargoyle would claim help it never gives. "Discard your hand. Draw 2 cards." still feeds: 2 cards is a small hand.

### Why an outlet that puts cards back doesn't feed an empty hand

An empty-hand payoff asks for the strictest hand of all: none. A loot never shrinks the hand, and an outlet that discards your hand and then draws 2 or returns a card leaves 1 or 2, a small hand but never an empty one. Scoring those 8 with Megavolt - Electrical Menace would claim a combo the outlet can't finish. An outlet that only discards keeps every card it takes out of your hand, so it is the one that empties it, and it keeps the 8.

### Why Goliath - Clan Leader feeds the small-hand payoff alone

DUSK TO DAWN trims *each player's* hand to 2 as their own turn ends, so the enabler gate keeps it out: it caps the opponent's hand too, which is Discard's ground (Discard tags him `standard`). For STONE BY DAY, though, it is the condition itself, since every one of your turns ends with a hand of 2. So `selfDiscardHandTrimFeed` reads the trim against a small-hand payoff and nothing else. It can't feed a discard-event or empty-hand payoff (it resolves as the turn ends and draws a short hand back up to 2), and scoring it with recursion or a pile count would make a symmetric hand-control card a Self-Discard outlet, which is a separate decision.
