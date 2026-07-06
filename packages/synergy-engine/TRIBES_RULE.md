# Classification Tribes (Monsters / Princesses / Heroes / Supers / Royalty / Detectives)

Six payoff-anchored tribal playstyles generated from **one shared factory** (`makeTribalRule` over `TRIBAL_SPECS` in `utils/cardHelpers.ts`). Each keys on a character classification and pairs the tribe's members with the cards that reward running them.

| Playstyle id | Member classification(s) | Payoff ref word(s) |
|--------------|--------------------------|--------------------|
| `monster`  | `Monster` | Monster |
| `princess` | `Princess` | Princess |
| `hero`     | `Hero` | Hero |
| `super`    | `Super` | Super |
| `royalty`  | `Queen`, `King`, `Prince` | Queen / King / Prince |
| `detective`  | `Detective` | Detective |

**Royalty deliberately excludes `Princess`** so it complements the Princess rule instead of swallowing it. Cards that read "Princess **or** Queen" bridge the two tribes as expected cross-playstyle composition (they surface in both groups).

## Membership + roles (`getTribalRoles`)

A card can hold several roles at once (Philoctetes is `member` + `buff` + `trigger`).

- **member** — `type === 'Character'` AND the card carries one of the spec's `memberClasses`.
- **buff** — benefits the tribe: a team buff (`your [other] X characters get/gain/can…`), a single-target buff (`chosen X character … gets/gains/can`, or a give-form `+N` stat buff `chosen X character … +\d`), or a tribal ready (`ready your/chosen … X characters`).
- **trigger** — a repeating trigger tied to the tribe: `whenever you play a X`, or `whenever … your X character(s) … quest/challenge`.
- **search** — deck dig: `search your deck for a X character` / `reveal a X character`.
- **in-play-check** — a conditional gated on the tribe: `while/if you have a X in play`, `if a [Y or] X character is in play/chosen`, `if you played/returned a X this turn`, or `if that card is a X character card`.

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

| Tribe | Members | Payoff cards | Unique pairs | Score dist (6 / 7 / 8) |
|-------|---------|--------------|--------------|------------------------|
| Monsters | 15 | 1 | 15 | 15 / 0 / 0 |
| Princesses | 102 | 14 | 1,366 | 912 / 145 / 309 |
| Heroes | 495 | 14 | 6,449 | 5,451 / 998 / 0 |
| Supers | 42 | 6 | 241 | 188 / 53 / 0 |
| Royalty | 150 | 7 | 950 | 929 / 21 / 0 |
| Detectives | 39 | 9 | 331 | 229 / 61 / 41 |

## Design notes

- **The five were built together on an explicit "all five" decision** after the payoff-pool counts were in hand. Two carry known trade-offs the user accepted:
  - **Monsters** has a single payoff card (`Red Alert`), so its page is a thin 15-pair fan rather than a real archetype.
  - **Heroes** has a real Set-12 payoff pool but ~495 members (being a Hero is near-universal among protagonists), so it contributes ~72% of the new pairs, mostly score-6 density. High volume, low per-pair signal.
  - Princesses, Supers, and Royalty are the coherent, well-shaped archetypes.
  - **Detectives** (Set 10 Zootopia / Great Mouse Detective) is a clean, well-shaped archetype: 39 members, 9 pattern-caught payoffs, all concentrated in Set 10 and Sapphire/Steel-heavy. Every emitted pair scores 6-8 (zero density floor). **Two real payoffs are missed** by the shared patterns and are accepted gaps: `Nick Wilde - Persistent Investigator` (2376) triggers on a Detective *banish*, not quest/challenge/play (cross-covered by Sacrifice's `banish-trigger`); `Fangmeyer - Icy Officer` (2473) is discard-*recursion* ("return a Detective character card from your discard"), which the deck-search pattern does not cover (cross-covered by Self-Discard's `reanimator`). A third — `Flash - Records Specialist` (2203, "give chosen Detective character +2") — was recovered by extending the shared single-target `buff` clause to accept a give-form `+N` stat buff (`chosen X character … +\d`); measured against all six tribes, the broadening tagged **only** Flash (zero collateral).
- **Shared role ids, no new tiles.** All five roles (`member` / `buff` / `trigger` / `search` / `in-play-check`) already existed in the mechanics catalog (Location / Floodborn / Hunny), so no new `STRUCTURAL_MECHANICS` labels were needed. `TribalRole` is added to `StructuralRoleId` purely as a compile-time guardrail for any future role.
- **Cross-rule overlap is expected composition.** A Floodborn Prince, a Hero Prince, and a Princess buff can each surface the same card in multiple tribal groups.
