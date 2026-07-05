# Red Panda Rule (playstyle, tribal, minimal)

Turning Red tribe (Set 13). Intentionally thin: one tribal payoff plus members.

## Roles
- `member`: `hasClassification('Red Panda')`.
- `search`: `/reveal a Red Panda character/i`, which matches the search shape, NOT bare
  "Red Panda character", so Sun Yee's Temporary Red Panda Shift reminder is excluded.

## Card examples by role

Real cards the `getRedPandaRoles` detector tags for each role (names from the live database; effects paraphrased):

| Role | Real cards | What they do |
|------|-----------|--------------|
| **member** | Ming Lee - Proud Parent (Amber), Meilin Lee - Superficially Obedient (Amethyst), Sun Yee - Soul of the Red Panda (Ruby) | Carry the Red Panda classification |
| **search** | Meilin Lee - Losing Control (Amber) | Reveal a Red Panda character off the top of your deck |

## Scoring (5-baseline)
| Pair | Score |
|------|-------|
| search + member | 8 |
| member + member | 5 |

## Note
The tribe's other connections (Meilin/Ming named-companions, Red Panda Shift) come from
Rules 1 and 2. This rule only adds the tribal-fetch axis.
