# Classification Tribes (Monsters / Princesses / Heroes / Supers / Royalty / Detectives / Gargoyles / Madrigals)

Eight payoff-anchored tribal playstyles generated from **one shared factory** (`makeTribalRule` over `TRIBAL_SPECS` in `utils/cardHelpers.ts`). Each keys on a character classification and pairs the tribe's members with the cards that reward running them.

| Playstyle id | Member classification(s) | Payoff ref word(s) |
|--------------|--------------------------|--------------------|
| `monster`  | `Monster` | Monster |
| `princess` | `Princess` | Princess |
| `hero`     | `Hero` | Hero |
| `super`    | `Super` | Super |
| `royalty`  | `Queen`, `King`, `Prince` | Queen / King / Prince |
| `detective`  | `Detective` | Detective |
| `gargoyle`  | `Gargoyle` | Gargoyle |
| `madrigal`  | `Madrigal` | Madrigal |

**Royalty deliberately excludes `Princess`** so it complements the Princess rule instead of swallowing it. Cards that read "Princess **or** Queen" bridge the two tribes as expected cross-playstyle composition (they surface in both groups).

## Membership + roles (`getTribalRoles`)

A card can hold several roles at once (Philoctetes is `member` + `buff` + `trigger`).

- **member** — `type === 'Character'` AND the card carries one of the spec's `memberClasses`.
- **buff** — benefits the tribe: a team buff (`your [other] X characters get/gain/can…`, or `… lose` when the tribe sheds a drawback, e.g. Angela - Night Warrior's "lose the Stone by Day ability"), a single-target buff (`chosen X character … gets/gains/can`, or a give-form `+N` stat buff `chosen X character … +\d`), or a tribal ready (`ready your/chosen … X characters`).
- **trigger** — a repeating trigger tied to the tribe: `whenever you play a X`, or `whenever … your X character(s) … quest/challenge`.
- **search** — deck dig: `search your deck for a X character` / `reveal a X character`.
- **in-play-check** — a conditional gated on the tribe: `while/if you have a X in play`, `if a [Y or] X character is in play/chosen`, `if you played/returned a X this turn`, or `if that card is a X character card`. A tribe word inside a name does not count: a `(?<!named (?:[\w'-]+ ){0,2})` guard skips the tribe word when "named" sits up to two words before it. It keeps "while you have an item named Super Suit in play" (Edna Mode - Super Suit Designer) from reading as a Super check, and a future "if you have a character named Mirabel Madrigal in play" from reading as a Madrigal check (Madrigal names end in the tribe word). Widening the guard from one word to two changed no role on any card across all eight tribes.

Payoff detection runs on the card's whitespace-normalized text (card text carries embedded newlines, so the phrase "Princess character" is only found after collapsing `\s+` to a single space).

## Scoring (payoff-anchored, 5-baseline)

The rule is **payoff-anchored** like Floodborn and Items: `scoreTribalPair` returns `null` for member-member pairs, so `tribalFindSynergies` never emits them. A tribe is only interesting through its payoffs. Cards are multi-role, so the **highest applicable bucket wins**:

| Pair | Score | Explanation |
|------|-------|-------------|
| search ↔ member \| payoff | **8** | The search digs the tribe out of your deck, fueling the payoffs |
| trigger ↔ member | **7** | The body fires the repeating payoff trigger each time |
| payoff ↔ payoff | **7** | Two payoffs stack on one tribal board |
| buff ↔ member | **6** | The body is pumped by the (team or single-target) buff |
| in-play-check ↔ member | **6** | The body turns on the "have a X in play" payoff |

Buff scores 6 (a static stat grant) while trigger scores 7 (a repeating engine) — the same principled split Floodborn uses.

## Coverage (live pair counts)

Regenerated when the Madrigal tribe was added, from the live engine over the Core pool (sets 9-13 plus the Set 14 preview). Counts go through `SynergyEngine.findSynergies`, so pairs `canShareDeck` rules out (incompatible dual-ink cards) are excluded, matching the precomputed JSON. The design notes below keep the counts from when the tribes were built.

| Tribe | Members | Payoff cards | Unique pairs | Score dist (6 / 7 / 8) |
|-------|---------|--------------|--------------|------------------------|
| Monsters | 15 | 1 | 15 | 15 / 0 / 0 |
| Princesses | 74 | 10 | 735 | 552 / 28 / 155 |
| Heroes | 338 | 13 | 4,284 | 3,561 / 723 / 0 |
| Supers | 57 | 7 | 374 | 202 / 116 / 56 |
| Royalty | 84 | 3 | 242 | 239 / 3 / 0 |
| Detectives | 39 | 11 | 392 | 275 / 76 / 41 |
| Gargoyles | 16 | 4 | 54 | 36 / 18 / 0 |
| Madrigals | 26 | 3 | 74 | 71 / 3 / 0 |

## Design notes

- **The five were built together on an explicit "all five" decision** after the payoff-pool counts were in hand. Two carry known trade-offs the user accepted:
  - **Monsters** has a single payoff card (`Red Alert`), so its page is a thin 15-pair fan rather than a real archetype.
  - **Heroes** has a real Set-12 payoff pool but ~495 members (being a Hero is near-universal among protagonists), so it contributes ~72% of the new pairs, mostly score-6 density. High volume, low per-pair signal.
  - Princesses, Supers, and Royalty are the coherent, well-shaped archetypes.
  - **Detectives** (Set 10 Zootopia / Great Mouse Detective) is a clean, well-shaped archetype: 39 members, 9 pattern-caught payoffs, all concentrated in Set 10 and Sapphire/Steel-heavy. Every emitted pair scores 6-8 (zero density floor). **Two real payoffs are missed** by the shared patterns and are accepted gaps: `Nick Wilde - Persistent Investigator` (2376) triggers on a Detective *banish*, not quest/challenge/play (cross-covered by Sacrifice's `banish-trigger`); `Fangmeyer - Icy Officer` (2473) is discard-*recursion* ("return a Detective character card from your discard"), which the deck-search pattern does not cover (cross-covered by Self-Discard's `reanimator`). A third — `Flash - Records Specialist` (2203, "give chosen Detective character +2") — was recovered by extending the shared single-target `buff` clause to accept a give-form `+N` stat buff (`chosen X character … +\d`); measured against all six tribes, the broadening tagged **only** Flash (zero collateral).
- **Gargoyles** (Sets 10-11 plus four Amethyst Set 14 preview cards) is a small, coherent clan: 16 members and 4 payoffs, every payoff itself a Gargoyle. No action or item names the tribe yet; the shared patterns never require a payoff to be a character, so one printed later is picked up with no change. 14 of the 16 members carry **Stone by Day** ("if you have 3 or more cards in your hand, this character can't ready"), which is what makes Angela the clan's key card:
  - `Goliath - Guardian of Castle Wyvern` (2308): `trigger` (gain 1 lore whenever one of your Gargoyles challenges).
  - `Demona - Imperious Spellcaster` (14056): single-target `buff` (chosen Gargoyle gains Rush and Evasive).
  - `Angela - Night Warrior` (2650): team `buff` via the `lose` verb, added to the shared team-buff clause for this tribe. Measured against the six existing tribes, `your X characters lose` tags **zero** other cards.
  - `Coldstone - Reincarnated Cyborg` (2240): `in-play-check`, through the shared `if you have N or more … X` clause, although his condition counts Gargoyle cards in your **discard**, not in play. The pairing holds (every Gargoyle feeds the count once it hits the discard), but the shared explanation text still reads "have a Gargoyle in play". Accepted rather than forking the shared template.
  - Out of scope: the hand-size side of Stone by Day (discard outlets and Goliath - Clan Leader's "discard down to 2") is a mechanic axis, not tribal membership, and is left to Self-Discard.
- **Madrigals** (the Encanto family; 17 of 26 members are Set 12, split Amber 10 / Amethyst 10 / Sapphire 6) is a pure drop-in: the shared patterns already catch all three payoffs, so no pattern changed. Every payoff is an `in-play-check` on "another Madrigal" / "a Madrigal character in play":
  - `Pedro Madrigal - Family Patriarch` (2720) and `Alma Madrigal - Leading the Way` (2751): one-shot on-play checks on 2-cost members.
  - `Julieta's Arepas` (2881): the only repeating payoff (heals each turn while you have a Madrigal in play), already a Healing and Items card.
  - Scores are flat (71 at 6, 3 payoff-payoff pairs at 7, nothing at 8) and the payoffs sit one per ink, so a two-ink deck holds at most two. The tribe adds family-gate pairs on top of Healing rather than a new deck: 52 of its 74 pairs were new to the index. `The Madrigal Family - Every Generation`'s "Madrigal Shift" stays with Shift Targets, and "named X Madrigal" Shift references are name reads, not payoffs.
- **Shared role ids, no new tiles.** All five roles (`member` / `buff` / `trigger` / `search` / `in-play-check`) already existed in the mechanics catalog (Location / Floodborn / Hunny), so no new `STRUCTURAL_MECHANICS` labels were needed. `TribalRole` is added to `StructuralRoleId` purely as a compile-time guardrail for any future role.
- **Cross-rule overlap is expected composition.** A Floodborn Prince, a Hero Prince, and a Princess buff can each surface the same card in multiple tribal groups.
