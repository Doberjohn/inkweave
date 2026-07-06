# Inkweave

Lorcana synergy finder for Core format with archetype-based synergy detection.

## MVP Status

Currently implementing v1.0.0 with:
- **Scope**: Core format only (sets 5+), community voting, deck builder
- **UI**: Dark fantasy theme (deep purple, gold accents)
- **Synergies**: Shift, Named Companions, Lore Loss, Discard, Singer + Songs, Location Control, Ramp, Toy, Sacrifice, Seven Dwarfs

See [GitHub Issues](https://github.com/Doberjohn/inkweave/issues) for full backlog.

## Tech Stack

- pnpm workspaces monorepo
- React 19 + TypeScript 6 (engine tsconfig carries `ignoreDeprecations: "6.0"` for tsup's dts `baseUrl` injection — remove before TS 7.0; see issue #329)
- Vite bundler
- Radix UI Primitives (headless behavior) + inline CSS with design tokens
- Static JSON card database

## Project Structure

```
inkweave/
├── package.json              # Root workspace config
├── pnpm-workspace.yaml
├── packages/
│   └── synergy-engine/       # Standalone synergy detection package
│       ├── package.json      # inkweave-synergy-engine
│       ├── tsup.config.ts    # Build config
│       └── src/
│           ├── index.ts      # Public API exports
│           ├── types/        # LorcanaCard, Synergy types
│           ├── utils/        # Card helpers (textContains, hasKeyword, etc.)
│           └── engine/       # SynergyEngine class + rules
└── apps/
    └── web/                  # React web application
        ├── package.json      # inkweave-web
        ├── vite.config.ts
        └── src/
            ├── main.tsx      # App bootstrap (mounts the router)
            ├── router.tsx    # Route definitions
            ├── AppLayout.tsx # Two-column layout shell
            ├── features/
            │   ├── cards/    # Card loading, components, hooks
            │   └── synergies/# Synergy display components, hooks
            └── shared/       # Constants, utilities, shared components
```

## Packages

### inkweave-synergy-engine

Standalone npm package for synergy detection. Zero React dependencies.

```typescript
import { SynergyEngine, type LorcanaCard } from "inkweave-synergy-engine";

const engine = new SynergyEngine();
const synergies = engine.findSynergies(card, allCards);
const result = engine.checkSynergy(cardA, cardB);
```

### inkweave-web

React web application that consumes the synergy engine package.

## Domain Knowledge

`.knowledge/` contains local-only (git-ignored) Lorcana reference material: rulebooks, player guides, errata, and meta analysis. Check `.knowledge/INDEX.md` for what's available. When designing synergy rules or making game-mechanic decisions, grep this folder first to verify mechanics against official sources rather than relying on training data.

## Key Concepts

**Ink Colors**: Amber, Amethyst, Emerald, Ruby, Sapphire, Steel
- Dual-ink cards (e.g., "Amethyst-Sapphire") match if either ink is selected; deck compatibility checks both inks

**Card Types**: Character, Action, Item, Location

**Game Mode**: Core only (sets 5+) - Infinity mode removed for MVP

**Synergy Categories**: direct (pair-specific, e.g. Shift), playstyle (strategy-reinforcing, e.g. Lore Denial)

**Playstyles** (implemented):
- Lore Denial (`lore-denial`) - cards that make opponents lose lore
- Location Control (`location-control`) - location-support roles (9 sub-rules)
- Discard (`discard`) - opponent discard enablers + hand-size payoffs
- Self-Discard (`self-discard`) - discard your OWN cards (loot / discard-cost) + reanimator (play from discard) + discard-state payoffs (player-side mirror of Discard)
- Ramp (`ramp`) - inkwell ramp + inkwell triggers + cost reduction grants
- Toys (`toy`) - Toy-classification members + tribal payoffs (search, banish-trigger, self-discount)
- Sacrifice (`sacrifice`) - self-banish cards (banish your own characters) + banish-trigger payoffs
- Seven Dwarfs (`dwarfs`) - Seven Dwarfs-classification members + tribal payoffs (density, recruit, return)
- Floodborns (`floodborn`) - Floodborn-matters payoffs (buff + trigger), payoff-anchored against the whole Floodborn tribe
- Hunny (`hunny`) - Winnie-the-Pooh tribe (density, search, buff)
- Red Panda (`red-panda`) - Turning Red tribe (member + search)
- Items (`items`) - Item Matters (Set 9-13 Inventor/artifacts axis): item members + item engine (search/recursion/cost-reduction) + payoffs that reward playing items; payoff-anchored, Sapphire-heavy
- Healing (`healing`) - Heal Matters: healers (remove damage from your own characters) + heal-payoffs (reward the removal event); payoff-anchored enabler->payoff axis, Amber/Sapphire-heavy, NOT a Madrigal tribe (only 12% of healers are Madrigal)
- Exert (`exert`) - Exert Matters (opponent-facing soft-removal): exert-enablers (exert an opposing character) + exert-payoffs (banish / lock / scale off the exerted body); payoff-anchored, consume-vs-state tier (8 vs 6), mono-Amethyst
- Bounce (`bounce`) - return characters from play to hand: self-bounce/flexible enablers re-fire re-buyable ETB bodies (=8), opponent-bounce/flexible feed the lone return-payoff (Maleficent's Staff, =6); payoff-anchored, Amethyst/Emerald
- Classification Tribes (`monster` / `princess` / `hero` / `super` / `royalty` / `detective`) - one shared payoff-anchored factory; members + tribal payoffs (buff / trigger / search / in-play-check). Royalty = Queen/King/Prince, excludes Princess. Detective = the Set 10 Zootopia/Great Mouse Detective tribe

**Synergy Score**: 1-10 numeric scale (all integers valid). Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4)

## Automation

Claude Code hooks, skills, agents, and path-scoped rules enforce workflow rules automatically. Check these before adding redundant instructions to CLAUDE.md.

### Hooks (`.claude/hooks/`)
| Hook | Event | What it does |
|------|-------|-------------|
| `git-write-protection.sh` | PreToolUse/Bash | Soft-blocks commit/push (`USER_APPROVED=1` bypass), hard-blocks destructive ops |
| `branch-verification.sh` | PreToolUse/Edit\|Write | Blocks source file edits on master/main |
| `engine-auto-rebuild.sh` | PostToolUse/Edit\|Write | Auto `pnpm build:engine` + `pnpm precompute-synergies` after engine file edits |
| `preview-images-auto-convert.sh` | PostToolUse/Edit\|Write | Auto `pnpm convert-preview-images` after writes inside `apps/web/public/card-images-raw/` (raw → AVIF pipeline) |
| `preview-data-auto-precompute.sh` | PostToolUse/Edit\|Write | Auto `pnpm precompute-synergies` after `apps/web/public/data/previewCards.json` writes (engine hook already covers engine-src changes) |
| `issue-create-guard.sh` | PreToolUse/Bash | Redirects direct `gh issue create` to `/draft-issue` skill (`SKILL_APPROVED=1` bypass) |
| Husky pre-push | git push | Runs `check:stories` (story coverage), E2E on chromium + webkit + mobile-chrome, and CodeScene gate before push (full 5-browser matrix in CI) |

### Skills (`.claude/skills/`)
| Skill | Arg | What it does |
|-------|-----|-------------|
| `/draft-issue [title hint]` | optional title hint | Extract scope from conversation → clarifying questions if gaps → 8-section rubric draft → score → publish on approval |
| `/implement-issue <num>` | issue number | Session hygiene → fetch issue → create branch → summary |
| `/commit-and-push "msg"` | commit message | PR readiness → review → commit → push → PR → CI |
| `/close-session [summary]` | work summary | Cleanup (servers/worktrees/branches + transient-file sweep w/ confirmation) → docs update → MEMORY.md → summary |
| `/inkweave-add-rule <name>` | mechanic name | Discovery → design → implement → validate |
| `/mine-rules [dry-run]` | optional dry-run | Run the miner → pick top candidate (dedup vs existing rules + open candidates; previously-removed mechanics are flagged, not skipped) → draft 5-baseline proposal → open one `rule-candidate` issue (`dry-run` drafts without publishing) |
| `/inkweave-explore [focus]` | optional focus area | Read-only, fork-isolated codebase/architecture map (workspace, engine API + rule registry, web data flow, precompute); verbose output stays in the fork |

### Path-scoped rules (`.claude/rules/`)

Convention files that auto-load only when editing files matching their `paths:` glob, keeping zone-specific detail out of always-loaded context (the differentiated split). Each rule's content also has a one-line pointer in the relevant section below.

| Rule | Loads when editing | Covers |
|------|-------------------|--------|
| `tests.md` | `**/*.test.ts(x)` | unit/integration test style |
| `stories.md` | `**/*.stories.tsx` | Storybook conventions (imports, decorators, mock-data shape) |
| `migrations.md` | `supabase/migrations/**` | Supabase MCP migration workflow |
| `engine.md` | `packages/synergy-engine/src/**` | engine rule pattern, 5-baseline scoring, doc-sync, auto-rebuild |

### Agents (`.claude/agents/`)
| Agent | Model | Triggered by | What it does |
|-------|-------|-------------|-------------|
| `session-start` | Haiku | `/implement-issue` Step 0 | Worktrees, branches, stashes, ports, PRs |
| `pr-ready` | Sonnet | `/commit-and-push` Step 0 | Lint, tests, E2E, branch naming, diff size |
| `engine-validator` | Sonnet | `/commit-and-push` when engine files in diff | Build, test, precompute, audit scores |
| `supabase-validator` | Sonnet | `/commit-and-push` when migration files in diff | Integration tests, security advisor, type freshness, schema drift |

### Scheduled jobs

| Job | When | What it does |
|-----|------|-------------|
| **Rule-candidate miner** (`scripts/mine-rules.ps1`) | Weekly, Windows Task Scheduler task `Inkweave Rule Miner` (Mon 11:00) | Runs headless `claude -p "/mine-rules"` with a scoped, read-only-plus-issue-create allowlist. Surfaces the top uncovered mechanic and opens one `rule-candidate` issue. **Read-only + issue-creation only**: never edits engine source, commits, or pushes. Output logged to `reports/mine-rules-last-run.log`. Disable with `schtasks /Delete /TN "Inkweave Rule Miner" /F`; the repo code is inert without the task. Requires Windows PowerShell 5.1 (pwsh 7 not assumed) and `claude` on PATH. |

The miner itself (`scripts/mine-rule-candidates.mjs`, run via `pnpm mine-rules`) uses the live `SynergyEngine` as a coverage oracle: cards it finds zero synergies for are clustered by shared mechanical phrase, near-duplicates collapsed by card-set overlap, and ranked into `reports/rule-candidates.json` (git-ignored). Ranking is **payoff-aware** (#363): each mechanic in the `MECHANICS` table pairs an enabler anchor with a payoff/trigger pattern, and `rankCluster` weights a cluster by its `payoffCount` (the size of its two-sided axis) so good-stuff mechanics with no payoff side sink. See issues #359 and #363.

## Synergy Rules

Built-in rules in the engine package. **Keep this section up to date when modifying rule logic, scoring, or explanations.**

### Scoring convention (5-baseline)

All playstyle rules share the same anchor: **5 = neutral default**. Same-axis density / parallel pressure pairs sit at 5. Anything above 5 must justify itself with a specific mechanical interaction (compounding role match, asymmetric kill combo, snowball chain). Audit rule: if you can't articulate why a pair scores above 5 in one sentence, it should probably be at 5.

Scale anchors:

| Score | Meaning |
|-------|---------|
| 5 | Same-deck density baseline (parallel pressure, no compounding) |
| 6 | Complementary roles on the same axis (e.g., burn ↔ steal) |
| 7 | Mechanical compounding (e.g., steal ↔ steal, member ↔ tribal) |
| 8 | Win-condition combo / peak chain (Discard enabler ↔ payoff, Toy search ↔ banish-trigger) |
| 9 | Snowball chain (Ramp deck-ramp ↔ repeating-trigger) |
| 10 | Engine-bonus / community-tuned |

See `packages/synergy-engine/SCORING_DESIGN.md` for the full design rationale.

### Removed rules

See `packages/synergy-engine/REMOVED_RULES.md` for archived rules (Evasive, Tribal, Challenger, Exert, Draw, Ward).

### Rule 1: Shift Targets (bidirectional)

Shift cards find same-named base characters; base characters find Shift cards. Both directions use the same scoring. Scores 3-10 based on curve gap, inkwell flexibility, free Shift cost tiers, and condition activation.

**Variants** (`getShiftType` in `utils/cardHelpers.ts`): `Shift N` and `Temporary Shift N` target same-named characters (standard); `X Shift N` (e.g. `Puppy Shift`, `Madrigal Shift`, `Temporary Red Panda Shift`) targets characters with classification `X` — the prefix may be multiple words, and a leading `Temporary` modifier is stripped before classifying; `Universal Shift N` targets any character. An `X Shift N` whose reminder reads "items named X" (e.g. `Potato Shift`, Posey - Vampire Potato) is an **item-target** shift (`named-item`) that lands on the **item** named `X`, not a character classification — the reminder text is the signal, and `isValidShiftTarget` gates the target with `isItem` (case-insensitive name) so a same-named character can't match; the rule's `matches` gate admits items so the reverse lookup fires. **Team** cards print a compound name ("Belle & Beast", "Sulley & Boo") and shift onto a character named either half, whatever the keyword's flavor label (`Shift`, `Combo Shift`, `Duo Shift`). The `&` in the name is the team signal — checked before the classification branch so `Combo`/`Duo` aren't misread as classifications; `standard` matching routes through `getShiftBaseNames`, which splits the base name on `&` so each component is a valid target (atomic names with no `&` pass through unchanged).

**Full documentation**: See [`packages/synergy-engine/SHIFT_TARGET_RULE.md`](packages/synergy-engine/SHIFT_TARGET_RULE.md) for detailed score tables, examples, condition matchers, and design rationale.

### Rule 2: Named Companions (direct, forward-only matching)

Cards that reference specific named entities via "named X" patterns (e.g., "characters named Anna", "item named Microbots") find all cards sharing that base name. Only the referencing card triggers matching — targets are found via `findSynergies`.

**Name extraction**: Terminator-based regex captures everything after "named" until hitting a game-mechanic word (in, can, may, etc.). Handles periods ("Mr. Smee"), lowercase articles ("Queen of Hearts"), exclamation marks ("Pull the Lever!"), hyphens ("Fix-It Felix"), possessives ("Maurice's Machine"), and conjunctions ("both Chip and Dale", "Miss Bianca or Bernard"). Shift parentheticals are stripped first (handled by Rule 1).

**Scoring by effect tier** (based on what the card does with the named companion):

| Tier | Score | Triggers |
|------|-------|----------|
| Game-winning | 8 | Free play, draw multiple cards, deck search |
| Strong | 7 | Cost reduction ("cost X less" / "pay X less"), keyword grants (Rush, Evasive, etc.) |
| Moderate | 6 | Stat boosts (+strength/willpower/lore), Resist, Support, can't be challenged |
| Minor | 5 | Everything else |
| Hostile | 4 | Banish/exert the named target (within same clause, 40-char window) |

**Coverage**: ~106 cards with named references, 78 unique referenced names, 100% match rate against card database.

**Full documentation**: See [`packages/synergy-engine/NAMED_COMPANIONS_RULE.md`](packages/synergy-engine/NAMED_COMPANIONS_RULE.md) for extraction details, scoring rationale, and test coverage.

### Rule 3: Lore Loss (playstyle: Lore Denial)

Cards that make opponents lose lore. Two roles: **burn** (opponent loses lore only) and **steal** (opponent loses lore AND you gain lore from the same effect — mutually exclusive with burn).

**Detection**: base pattern `/(?:each |chosen |all )?opponents? loses? (?:\d+ )?lore/i` matches lore loss; three steal-pattern shapes (`loses N lore and you gain N lore`, `loses N lore. Gain N lore`, `gain lore equal to the lore lost`) elevate to `steal`.

**Scoring** (5-baseline convention; matrix reflects mechanical efficiency — every steal point swings the lore race by 2 vs burn's 1):

| Pair | Score | Explanation template |
|------|-------|----------------------|
| burn ↔ burn | **5** | Both make the opponent lose lore — stacking denial pressure |
| burn ↔ steal | **6** | {burn} pushes the opponent down while {steal} pulls you up — pressing both ends of the lore race |
| steal ↔ steal | **7** | Both steal lore — every trigger swings the race in your favor twice |

**Coverage**: 14 burn + 10 steal cards = 276 unique pairs. Distribution: 33% / 51% / 16% across 5 / 6 / 7.

**Full documentation**: See [`packages/synergy-engine/LORE_LOSS_RULE.md`](packages/synergy-engine/LORE_LOSS_RULE.md).

### Rule 4: Discard (playstyle, two roles)

Cards that force opponents to discard from hand (enablers) synergize with each other and with cards that reward hand-size advantage (payoffs). Single rule with role-based scoring.

**Enabler detection** (7 pattern families):
- `(each|chosen) opponent (chooses and discards|reveals their hand and discards|discards)` — forced/targeted/random discard
- `have (each|chosen) opponent choose and discard` — alternate wording
- `(each|challenging) player [may] chooses and discards` — symmetric/challenge-triggered
- `that player discards a card at random` — indirect
- `more than \d+ cards in their hand.*discard` — hand-cap effects
- `most cards in their hands choose and discard` — comparative (targets player with most cards)
- `each player draws \d+ cards.*discards \d+ cards at random` — symmetric chaos

**Payoff detection**: `more cards in your hand than (each) opponent` — rewards hand-size asymmetry

**Excluded**: Self-discard (you discard as cost), mill (deck→discard), catch-up draw (opponent has more cards than you), discard pile recursion (Zombies playstyle)

**Scoring** (5-baseline; same-side density at floor, asymmetric kill combo at peak):

| Pair | Score | Explanation |
|------|-------|-------------|
| Enabler ↔ Enabler | **5** | Parallel pressure on the opponent's hand — doesn't compound, just stacks |
| Enabler ↔ Payoff | **8** | Asymmetric kill combo — enabler creates condition, payoff exploits it |
| Payoff ↔ Payoff | **5** | Same axis (hand-size advantage) without amplifying it |

**Coverage**: 37 enablers + 2 payoffs = 39 cards across 741 pairs. 90% sit at the score-5 floor; 10% are the genuine kill combo (the 2 hand-size payoffs are the deck's win condition).

**Full documentation**: See [`packages/synergy-engine/DISCARD_RULE.md`](packages/synergy-engine/DISCARD_RULE.md).

### Rule 5: Singer + Songs (direct, bidirectional)

Characters with the Singer keyword can exert to sing Song action cards for free, provided the Song's cost is within the Singer's threshold. Both directions matched: Singers find compatible Songs, Songs find Singers that can sing them.

**Detection**: Singers via `hasKeyword(card, 'Singer')`, Songs via `isSong(card)` (Action type + Song subtype/text). Cost gate: `song.cost <= singerValue`.

**Scoring** (based on threshold utilization):

| Scenario | Score | Rationale |
|----------|-------|-----------|
| Song cost = Singer value | 8 | Perfect fit, maximum value extraction |
| Song cost = Singer value - 1 | 7 | Near-perfect, 1 point wasted |
| Song cost = Singer value - 2 | 6 | Good savings, slight waste |
| Song cost ≤ Singer value - 3 | 5 | Functional but inefficient |

**Explanation template**: "{singerName} (Singer {value}) can sing {songName} (cost {songCost}) for free"

**Coverage**: 16 Singers (mostly Amber/Ruby), 72 Songs (all inks), 872 valid pairs.

**Full documentation**: See [`packages/synergy-engine/SINGER_SONGS_RULE.md`](packages/synergy-engine/SINGER_SONGS_RULE.md) for detection details, bidirectional matching, scoring logic, and test coverage.

### Rule 6: Spike Suit (direct, single-anchor, bidirectional)

Built around **Dale - Ready for His Shot** (Amber 0/4), whose SPIKE SUIT ability makes your characters deal combat damage with their willpower instead of their strength. Dale therefore synergizes with characters whose willpower beats their strength — the bigger the gap, the more free combat damage. The engine's first **single-anchor** rule (one card defines the synergy) and first rule keyed on a **numeric stat relationship** rather than text/keyword/name.

**Detection**:
- **anchor** (1 card): text matches `/deal damage with their .* instead of their/i` (matched on ability text, not card id, so reprints join for free).
- **payoff** (204 deck-compatible): `isCharacter` AND `willpower − strength >= 3` (the `SPIKE_SUIT_FLOOR`). The floor drops the 265 trivial +1 bodies that a literal "willpower > strength" reading would surface.

**Scoring** (`min(gap + 3 + wallBonus, 10)`, where `gap = willpower − strength`):

| Payoff | Gap | Score | Notes |
|--------|-----|-------|-------|
| gap-3 body (e.g. 3/6) | 3 | **6** | Floor of Moderate — every match is at least a real +3 swing |
| gap-4 body / gap-3 wall | 4 / 3 | **7** | Strong |
| gap-5 body / gap-4 wall | 5 / 4 | **8** | Strong |
| gap-6 body / gap-5 wall | 6 / 5 | **9** | Strong |
| gap-7+ body / gap-6+ wall | 7+ / 6+ | **10** | Perfect (capped) |

Strength-0 walls get **+1** (`wallBonus`): they go from dealing zero combat damage to swinging for their full willpower — a category change, not just a bigger number. Explanation uses `{A}`/`{B}` token-swap so Dale always reads as the enabler: *"{A} lets {B} deal damage with its 7 willpower instead of its 3 strength."*

**Coverage**: 1 anchor + 204 payoffs (40 of them strength-0 walls). Distribution: 0 Weak / 108 Moderate / 89 Strong / 7 Perfect.

**Full documentation**: See [`packages/synergy-engine/SPIKE_SUIT_RULE.md`](packages/synergy-engine/SPIKE_SUIT_RULE.md).

### Location Control (playstyle, 9 sub-rules)

9 specialized rules detecting location-support roles: at-payoff, play-trigger (fires on playing a location), move-trigger (fires when a character moves onto a location — pairs with the `move` enabler), buff, location-ramp, move, in-play-check, search, boost. All merge into a single `location-control` playstyle group. Factory pattern (`createLocationRule`) generates each rule. Anti-location cards (banish/remove locations) are excluded.

**Full documentation**: See [`packages/synergy-engine/LOCATION_CONTROL_RULE.md`](packages/synergy-engine/LOCATION_CONTROL_RULE.md) for role taxonomy, detection patterns, cross-synergy matrix, and test coverage.

### Ramp (playstyle, 3 roles)

Three-role mana acceleration: **inkwell-ramp** (34 cards, ~80% Sapphire), **inkwell-trigger** (28 cards, even ink spread), **cost-reduction** (18 cards, ~50% Amber).

**Scoring** (5-baseline + chain ladder preserved):

| Pair | Score | Notes |
|------|-------|-------|
| Deck ramp ↔ Repeating trigger | **9** | Snowball — every free ink fires the trigger |
| Deck ramp ↔ Once-turn trigger | **8** | Free ink, capped trigger |
| Self-sac ramp ↔ Repeating trigger | **8** | Card cost + uncapped |
| Self-sac ramp ↔ Once-turn trigger | **7** | Card cost + capped |
| Cost-reduction ↔ Cost-reduction (overlap) | **6** | Real stacking on same card type |
| Ramp ↔ Ramp / Trigger ↔ Trigger / Ramp ↔ CR / Trigger ↔ CR | **5** | Density baseline — parallel acceleration, no per-card combo |
| Cost-reduction ↔ Cost-reduction (no overlap) | **0** | Silently dropped (Pirate-discount + Location-discount won't combo) |

**Live distribution**: 90 cards / 3,507 pairs. 74% at 5, 27% at 8–9 (chain), 3% mid-tier. The chain is the only real mechanical interaction in the playstyle; everything else is parallel-density floor.

**Excluded**: Opponent-ink cards (removal, not ramp), self-discount payoffs, free play effects, generic high-cost cards.

**Full documentation**: See [`packages/synergy-engine/RAMP_RULE.md`](packages/synergy-engine/RAMP_RULE.md).

### Rule 8: Toy (playstyle, role-driven matrix)

Tribal playstyle for Toy-Story decks. **Membership gate**: `Toy` classification OR text matches `/\bToy characters?\b/i` (tight pattern dodges Buzz Lightyear's "WORLD'S GREATEST TOY" ability-name false positive). The unified rule covers Andy's Toys (Woody/Buzz/Jessie value-engine) and Sid's Toys (banish-recursion).

**Roles**:
- **Membership**: `member`
- **Tribal** (specifically reward Toy density): `search` (find Toys), `banish-trigger` (fire on Toy banish — strict-tense regex, both tribal and self targets via `makeBanishTriggerPattern`), `self-discount` (this character costs less; covers `pay N less` and the `play this character for free` limit case)
- **Generic** (composed from other playstyles): `draw`, `cost-reduction`, `burn`, `steal`, `targeted`, `random`, `standard`, `inkwell-ramp`, `inkwell-trigger`

**Scoring** (5/7/8 matrix; 6 deliberately empty, retired generic `payoff` fallback):

| Pair | Score | Captures |
|------|-------|----------|
| search ↔ banish-trigger | **8** | Peak chain: load board, pay off on banish |
| Member ↔ search | **8** | Search converts deck slot to tribal member (game-winning fetch) |
| Tribal ↔ Tribal (other) | **7** | Multiple density rewards compound |
| Member ↔ Tribal | **7** | Member feeds the tribal payoff |
| Member ↔ Member / Member ↔ generic / Generic ↔ generic | **5** | Same-deck density baseline; generic synergies owned by their own rules |

**Coverage**: 24 Toy-affiliated cards (21 members + 5 banish-trigger + 4 self-discount + 4 draw + 2 search + 1 each of cost-reduction/targeted/burn/steal). Pair distribution: 32% / 52% / 16% across 5 / 7 / 8.

**Full documentation**: See [`packages/synergy-engine/TOY_RULE.md`](packages/synergy-engine/TOY_RULE.md).

### Rule 9: Sacrifice (playstyle: "Banish Matters", two roles)

Aristocrats / "Banish Matters" axis. Cards that banish your **own** characters on demand (**self-banish cards**) synergize with cards that trigger **when one of your characters is banished** (**banish-triggers**). The self-banish card cashes in a banish-trigger on your terms instead of waiting for the opponent to trade into it. Same enabler/payoff shape as the Discard rule.

**Detection**:
- **banish-trigger** (40 cards, all 6 inks): `/when(?:ever)?\s+(?:this character|(?:one of\s+)?your(?:\s+other)?(?:\s+\w+)?\s+characters?|a\s+character\s+of\s+yours)\s+(?:is|are|gets?)\s+banished/i` — general (any-cause) banish trigger on your own side or self. The optional `\w+` slot admits tribal triggers (Racer/Illusion/Puppy). **Excludes** `banished in a challenge` recursion (combat-only, a self-banish can't trigger it; belongs to Challenge Matters #371).
- **self-banish** (7 cards, Ruby 5 / Emerald 2): `/banish\s+(?:one of\s+)?(?:your(?:\s+other)?\s+characters?|(?:another\s+)?chosen\s+character\s+of\s+yours)/i` — the `of yours` / `your` gate separates sacrifice from opponent removal (`banish chosen character` alone is removal, excluded).

**Scoring** (5-baseline):

| Pair | Score | Explanation |
|------|-------|-------------|
| self-banish ↔ banish-trigger | **8** | Win-condition combo: self-banish card banishes your own payoff body on demand, guaranteeing the banish-trigger |
| banish-trigger ↔ banish-trigger | **5** | Parallel payoff density, no compounding |
| self-banish ↔ self-banish | **5** | Parallel enablers, still need a payoff body |

Banish-combo explanation uses `{A}`/`{B}` token-swap so the self-banish side always reads as the actor.

**Coverage**: 7 self-banish cards + 40 payoffs = 47 cards, 846 unique pairs after ink-compatibility filtering. Distribution: 28.7% at 8, 71.3% at 5. (Score-8 share runs higher than other playstyles because few enablers pair against many payoffs; the combo is the archetype.) The `banish-trigger` role is a superset of Toy's tribal-gated `banish-trigger`; shared Sid's Toys are expected cross-playstyle composition.

**Full documentation**: See [`packages/synergy-engine/SACRIFICE_RULE.md`](packages/synergy-engine/SACRIFICE_RULE.md).

### Rule 10: Seven Dwarfs (playstyle, role-driven matrix)

Tribal playstyle for Seven Dwarfs / Snow White decks (Set 12 package). **Membership gate**: `Seven Dwarfs` classification OR text matches `/\bSeven Dwarfs\b/i`. The broad pattern is safe — no card *names* an ability "Seven Dwarfs", so there is no caps ability-name false positive (unlike Toy's "WORLD'S GREATEST TOY").

**Roles**:
- **Membership**: `member` (14 cards: 7 Steel "Knight" set-5 + 7 Amethyst set-12)
- **Tribal payoffs** (reward Seven Dwarfs density): `density` (benefit gated on Dwarfs in play), `recruit` (play a Seven Dwarfs for free), `return` (bounce a Seven Dwarfs to hand for value)

**Excluded**: the "OR Princess" satisfier on every payoff (would pull in all 91 Princess cards; Princess density belongs to the separate Princesses playstyle). Snow White - Merry is still in — caught by her own Seven Dwarfs text reference.

**Scoring** (5/7/8 matrix; 6 deliberately empty):

| Pair | Score | Captures |
|------|-------|----------|
| recruit ↔ member / recruit ↔ density | **8** | Free recruit cheats a Dwarf onto the board (check first so recruit+density Right Behind You scores 8 vs a member) |
| density ↔ density | **7** | Density payoffs compound |
| density ↔ member | **7** | Member feeds the density payoff |
| return ↔ member | **7** | Bounce re-buys the member's enter-play ability + draws |
| Member ↔ Member / other | **5** | Same-deck density baseline |

**Coverage**: 14 members + 3 non-member payoffs = 17 cards, 136 unique pairs. Distribution: 50% at 5, 39% at 7, 11% at 8. Role population: 14 member, 4 density (Doc - Taking Notes, Sleepy - Deep Sleeper, Right Behind You, Don't Be Nervous), 1 recruit (Right Behind You), 1 return (Snow White - Merry as the Morning).

**Full documentation**: See [`packages/synergy-engine/DWARFS_RULE.md`](packages/synergy-engine/DWARFS_RULE.md).

### Rule 11: Floodborns (playstyle: Floodborn matters, payoff-anchored)

Set 13 "Vine" archetype, the **Floodborns** playstyle. The new Set 13 cards are branded Vinelings, but the rule is keyed on the **Floodborn** classification: every payoff reads "your Floodborn characters", and Floodborn is a deep, cross-set classification (note: not every Shift card is Floodborn; the Set 13 Team-ups and some Incredibles Shift cards are Storyborn, so membership keys on the classification tag, not the Shift keyword). **Payoff-anchored**: a Floodborn body synergizes with payoffs, but two plain Floodborn do not synergize with each other (`findSynergies` skips member ↔ member, avoiding ~6,400 density pairs that would tag every shifted card).

**Roles**:
- **Membership**: `member` (`isCharacter` + `Floodborn` classification)
- **Payoffs**: `buff` (static "your Floodborn characters get/gain ..."), `trigger` (repeating "whenever ... Floodborn ..." on quest/play/banish). The Vine carries all three.

**Scoring** (5-baseline):

| Pair | Score | Why |
|------|-------|-----|
| member ↔ trigger | **7** | The body fires the repeating payoff trigger |
| payoff ↔ payoff | **7** | Two payoffs stack on the same Floodborn board |
| member ↔ buff | **6** | The body is pumped by the team buff |
| member ↔ member | (not generated) | Payoff-anchored |

**Cross-rule**: Floodborn banish-triggers (Maid Marian, The Vine) are also caught by the Sacrifice `banish-trigger` (expected cross-playstyle composition).

**Full documentation**: See [`packages/synergy-engine/FLOODBORN_RULE.md`](packages/synergy-engine/FLOODBORN_RULE.md).

### Rule 12: Hunny (playstyle, tribal)

Winnie-the-Pooh tribe (Set 13), modeled on Seven Dwarfs. **Membership gate**: `Hunny` classification. **Payoff gate**: `/\bHunny (character|card|classification)/i`, deliberately NOT bare "Hunny" (abilities are named "HUNNY AURA"/"HUNNY ACTIVATION", the same caps trap as Toy's "WORLD'S GREATEST TOY").

**Roles**: `member`, `density` (gated on Hunny in play), `search` (dig a Hunny from deck), `buff` (single-target pump of a chosen Hunny).

**Scoring** (5-baseline):

| Pair | Score |
|------|-------|
| search ↔ member / search ↔ density | **8** |
| density ↔ density / density ↔ member | **7** |
| buff ↔ member | **6** |
| everything else | **5** |

**Coverage**: 9 members + 3 density, 2 search, 3 buff payoffs (several multi-role).

**Full documentation**: See [`packages/synergy-engine/HUNNY_RULE.md`](packages/synergy-engine/HUNNY_RULE.md).

### Rule 13: Red Panda (playstyle, tribal, minimal)

Turning Red tribe (Set 13). Intentionally thin: one tribal payoff plus members. **Membership gate**: `Red Panda` classification. **Payoff**: `search` = `/reveal a Red Panda character/i` (the search shape, NOT bare "Red Panda character", so Sun Yee's Temporary Red Panda Shift reminder does not false-positive).

**Scoring** (5-baseline):

| Pair | Score |
|------|-------|
| search ↔ member | **8** |
| member ↔ member | **5** |

Red Panda's other connections (Meilin/Ming named-companions, Red Panda Shift) come from Rules 1 and 2; this rule only adds the tribal-fetch axis.

**Full documentation**: See [`packages/synergy-engine/RED_PANDA_RULE.md`](packages/synergy-engine/RED_PANDA_RULE.md).

### Rule 14: Self-Discard (playstyle: "Discard Matters" player-side, three roles)

Player-side mirror of the opponent-facing Discard rule (Rule 4): discard your OWN cards, then cash them in. Fills the "recursion role" that `makeSearchPattern` deferred ("from your discard ... Recursion deserves its own role"). Mirrors the Sacrifice structure (enabler feeds payoff).

**Roles** (`getSelfDiscardRoles`):
- **enabler** — a hand-discard OUTLET: loot (`/draw (a|\d+) cards?,? then (choose and )?discard/`), discard-your-hand (`/discard your hand/`), or discard-as-cost (`/discard (a|an|another|\d+) (\w+ ){0,2}?cards?/`, kept tight so it doesn't over-tag narrow conditional costs). Gated with `!/opponent|each player|.../` so it stays disjoint from the Discard rule.
- **reanimator** — play/return a card from your discard (`/(play|return|put)[^.]{0,60} from your discard/`), the deep recursion payoff.
- **state-payoff** — `/discarded a card this turn|no cards in (your )?hand/` (discard-event + Hellbent empty-hand).

**Excludes**: opponent discard (Rule 4's domain), and mill (`into your discard` fills the bin from the deck, not the hand — 3 rotation cards; mill feeds pull-from-discard reanimators but never triggers "when you discard" payoffs).

**Scoring** (5-baseline):

| Pair | Score | Explanation |
|------|-------|-------------|
| enabler ↔ payoff (reanimator or state) | **8** | Win-condition: discard, then replay it from the bin, or flip the discard-state payoff on demand |
| reanimator ↔ reanimator | **6** | Two recursion engines mining one discard pile |
| enabler ↔ enabler / reanimator ↔ state / state ↔ state | **5** | Same-axis density, no compounding |

Combo explanation uses `{A}`/`{B}` token-swap so the enabler always reads as the actor.

**Coverage**: 142 cards (59 enabler + 78 reanimator + 8 state-payoff; roles overlap on multi-role cards like Rapunzel & Flynn Rider). 7,613 unique pairs after the ink filter: 55% at 8, 27% at 6, 18% at 5. The high 8-share is structural, recursion is one of the deepest payoff pools in the game.

**Full documentation**: See [`packages/synergy-engine/SELF_DISCARD_RULE.md`](packages/synergy-engine/SELF_DISCARD_RULE.md).

### Rule 15: Items (playstyle: "Item Matters", payoff-anchored)

Set 9-13 Inventor / artifacts axis: play a lot of items, cash in the payoffs. **Payoff-anchored like Floodborn** (a pair scores only when one side is an item payoff; the 82-item pool never self-pairs, which would emit thousands of density pairs).

**Roles** (`getItemRoles`): `member` (any Item card); `item-engine` (tutor/search items, return items from discard, or discount OTHER items — self-discount on "this item" is gated out, so a self-discounting item stays a plain member); `payoff-trigger` (`/whenever you play an item/i`); `payoff-static` ("for each item", "while/if you have an item in play"). Multi-role allowed (an item that recurs items is member+item-engine). **Excludes** item removal ("banish chosen item", the opposite axis).

**Scoring** (8/7/6, 5-baseline; highest applicable bucket wins):

| Pair | Score |
|------|-------|
| item-engine ↔ payoff (trigger or static) | **8** |
| payoff ↔ payoff | **7** |
| member ↔ payoff-trigger | **7** |
| member ↔ payoff-static | **6** |
| item-engine / member density (neither side a payoff) | (not generated) |

**Coverage**: 3,443 pairs (8: 514 / 7: 850 / 6: 2,079). Sapphire-concentrated (6 of 7 rotation payoffs are Sapphire). The item engine overlaps Ramp (cost-reduction), Self-Discard (recursion), and Sacrifice (Ingenious Device) by design, so engine-only density is dropped here rather than double-scored.

**Full documentation**: See [`packages/synergy-engine/ITEMS_RULE.md`](packages/synergy-engine/ITEMS_RULE.md).

### Rule 16: Classification Tribes (Monsters / Princesses / Heroes / Supers / Royalty / Detectives)

Six payoff-anchored tribal playstyles from **one shared factory** (`makeTribalRule` over `TRIBAL_SPECS`). Each keys on a character classification and pairs members with the payoffs that reward them. `royalty` = Queen/King/Prince and deliberately **excludes** Princess so it complements the `princess` rule. `detective` is the Set 10 (Zootopia / Great Mouse Detective) tribe.

**Roles** (`getTribalRoles`, multi-role): `member` (classification); `buff` (team / single-target buff / tribal ready); `trigger` (`whenever you play a X` or `whenever your X quests/challenges`); `search` (`search/reveal a X character`); `in-play-check` (`while/if you have a X`, event-this-turn, `if a [Y or] X character is …`). All five ids already exist in the mechanics catalog, so no new tiles.

**Scoring** (payoff-anchored, member↔member never emitted; highest bucket wins):

| Pair | Score |
|------|-------|
| search ↔ member \| payoff | **8** |
| trigger ↔ member | **7** |
| payoff ↔ payoff | **7** |
| buff ↔ member | **6** |
| in-play-check ↔ member | **6** |

**Coverage** (members / payoffs / pairs): Monsters 15/1/15, Princesses 102/14/1366, Heroes 495/14/6449, Supers 42/6/241, Royalty 150/7/950, Detectives 39/9/331. Monsters is thin (1 payoff) and Heroes is high-volume/low-signal (495 near-universal members); Princesses/Supers/Royalty/Detectives are the coherent archetypes. Detectives is the Set-10-concentrated 6th tribe (6/7/8 dist 229/61/41, zero density floor); two real payoffs are missed by the shared patterns (Nick Wilde 2376 banish-trigger → cross-covered by Sacrifice, Fangmeyer 2473 discard-recursion → cross-covered by Self-Discard). The shared single-target `buff` clause was extended to accept a give-form `+N` stat buff (`chosen X character … +\d`) to recover Flash 2203; measured zero-collateral across all six tribes.

**Full documentation**: See [`packages/synergy-engine/TRIBES_RULE.md`](packages/synergy-engine/TRIBES_RULE.md).

### Rule 17: Heal Matters (playstyle: Healing, payoff-anchored)

Remove damage from your own characters, then cash in the payoffs that reward healing. **Payoff-anchored like Floodborn/Items** (a pair scores only when one side is a heal payoff; the 58-healer pool never self-pairs). NOT a Madrigal tribe: only 12% of healers are Madrigal and every payoff is generically worded ("remove damage from one of your characters").

**Roles** (`getHealRoles`): `healer` (removes damage: `/remove (up to \d+|all|\d+) damage from/i`) and `heal-payoff` (rewards the removal event: `/whenever you remove damage|when you remove damage|if you removed damage|for each \d+ damage removed|damage removed this way|remove 1 or more damage/i`). A pure-mover guard (`/\bmove ... damage\b/`) drops cards whose only damage interaction is a move; Steel 'no damage/undamaged' statics are excluded naturally. Cards can be both roles (Ohana Means Family - 2495).

**Scoring** (7/8, 5-baseline; token-swap keeps the healer as the actor):

| Pair | Score |
|------|-------|
| healer <-> heal-payoff | **8** |
| heal-payoff <-> heal-payoff | **7** |
| healer <-> healer | (not generated) |

**Coverage**: 58 healers + 14 heal-payoffs (7 pure + 7 dual-role) = 65 cards. 755 ink-compatible pairs (8: 666 / 7: 89); 1,142 healer<->healer pairs dropped. Amber 27 / Sapphire 21-heavy.

**Full documentation**: See [`packages/synergy-engine/HEALING_RULE.md`](packages/synergy-engine/HEALING_RULE.md).

### Rule 18: Exert (playstyle: "Exert Matters", opponent-facing, payoff-anchored)

A clean revival of the archived `exert-synergies` rule (see `REMOVED_RULES.md`), tightly scoped to the **opponent-facing** exert-as-removal axis. Two roles, payoff-anchored (enabler↔enabler never emitted), mono-**Amethyst** in practice.

**Roles** (`getExertRoles`):
- **exert-enabler** — an EFFECT that exerts an OPPOSING character: `/\bexerts?\b\s+…(?:opposing|opponent's)/i` AND an `opposing/opponent's character` reference (the `(?:\w+ ){0,2}` slot admits "opposing ready character").
- **exert-payoff** — consumes/rewards an already-exerted opposing body WITHOUT self-exerting. Two tiers: **consume** (exert-trigger `whenever an opposing character is/becomes exerted`, `banish chosen exerted character`, `chosen exerted character can't ready`) and **state** (`if an opponent has an exerted character`, `for each exerted character opponents have`, `gain lore equal to another chosen exerted character`).

**Excludes**: exert-as-COST (`⟳`/`—` dash-clause — excluded by construction, an enabler needs an exert *effect*), the ~61 `into ... inkwell facedown and exerted` ramp cards, self-exert-state (`while this character is exerted`), and exert-an-ITEM effects.

**Scoring** (payoff-anchored, 5-baseline; `{A}`/`{B}` token-swap keeps the enabler as the actor):

| Pair | Score | Explanation |
|------|-------|-------------|
| enabler ↔ consume payoff | **8** | {enabler} exerts an opposing character, and {payoff} punishes the exerted body |
| enabler ↔ state payoff | **6** | {enabler} keeps an opposing character exerted, switching on {payoff} |
| payoff ↔ payoff | **5** | Both reward opposing characters being exerted. Density baseline |
| enabler ↔ enabler | (not generated) | Payoff-anchored |

**Coverage**: 21 enablers (Amethyst 16, Amethyst-Steel 2, Ruby 3) + 12 payoffs (8 consume + 4 state; Amethyst 10, Amethyst-Ruby 1, Amber 1) = 33 cards, 313 ink-compatible pairs after `canShareDeck` (52% at 8, 27% at 6, 21% at 5).

**Full documentation**: See [`packages/synergy-engine/EXERT_RULE.md`](packages/synergy-engine/EXERT_RULE.md).

### Rule 19: Merida Archer (direct, single-anchor, bidirectional)

Built around **Merida - Formidable Archer** (Steel, id 2906), whose **STEADY AIM** ability deals 2 extra damage whenever one of your actions deals damage to an opposing character. Merida therefore synergizes with **damage-dealing Action cards** — every one hits for +2 while she's in play, and the more it already deals (and the more targets it hits) the bigger the absolute swing. Second single-anchor direct rule (after Spike Suit), keyed on the anchor's ability text so reprints join for free.

**Detection**:
- **anchor** (1 card): text matches `/whenever one of your actions deals? damage to an opposing character/i` (on ability text, not id).
- **payoff** (19 deck-compatible): `isAction` AND `/\bdeals?\s+\d+\s+damage\b/i` AND NOT self-only (`/deals?\s+\d+\s+damage to chosen character of yours/i`, e.g. Break Free 1083) AND NOT a granted-ability action (`/\bgains?\b[^.]{0,40}["“'][^"”']*deals?\s+\d+\s+damage/i`, e.g. Food Fight! 1155 grants a character a damage ability).

**Scoring** (`min(5 + min(actionDamage, 3) + multiTargetBonus, 10)`; floor 6):

| Payoff | Score | Notes |
|--------|-------|-------|
| 1-damage single (e.g. Quick Shot) | **6** | Floor — every match is at least a real +2 upgrade |
| 2-damage single / 1-damage multi | **7** | Strong |
| 3+-damage single / 2-damage multi | **8** | Strong |
| 3+-damage multi (Mob Song, Unfortunate Situation) | **9** | Strong — +2 on every one of several bodies |

`multiTargetBonus` = +1 if `/each|up to \d+ chosen|another chosen/i` (board-wipe / up-to-N / follow-up hit). Explanation uses `{A}`/`{B}` token-swap so Merida always reads as the enabler: *"{A}'s STEADY AIM adds 2 damage to {B}'s 3 damage each time it hits an opposing character."*

**Coverage**: 1 anchor + 19 payoffs (15 Steel, 3 Emerald, 1 Ruby-Steel). Distribution: 1 at 6 / 11 at 7 / 5 at 8 / 2 at 9 — 0 Weak / 1 Moderate / 18 Strong / 0 Perfect. **Unfortunate Situation (1398)** is included despite an opponent-self-damage rules ambiguity (documented in the rule doc); **Light the Fuse (1813)** scores 7 from a scaling single-target that trips the `each` multi-pattern (cosmetic over-count).

**Full documentation**: See [`packages/synergy-engine/MERIDA_ARCHER_RULE.md`](packages/synergy-engine/MERIDA_ARCHER_RULE.md).

### Rule 20: Merida - Wisp Conjurer (direct, single-anchor, bidirectional)

Built around **Merida - Wisp Conjurer** (Amethyst 13050), whose **BECKON** ability draws a card whenever *another* of your characters enters play exerted. Merida therefore synergizes with cards that push your characters into play exerted — the engine's second **single-anchor** direct rule (after Spike Suit), keyed on ability text so a reprint joins for free.

**Detection**:
- **anchor** (1 card): text matches `/whenever another character of yours enters play exerted/i` (matched on ability text, not a card id).
- **enabler tiers** (`getBeckonEnablerTier`, order load-bearing — anchor self-check → opposing exclusion → reanimator → engine → self):
  - `engine` (3): pushes OTHER of your characters into play exerted, board-wide — `/they enter play exerted|the next character you play[^.]{0,80}enters? play exerted/i` (The Horned King 13022, Simba 2209, and the **item** Powhatan's Staff 13036).
  - `reanimator` (2): replays ITSELF exerted from your discard — `/(?:this card is in your discard|from your discard)[^.]{0,140}(?:he|she|it|they|this character) enters? play exerted/i` (Lilo 1201, Stitch 1830).
  - `self` (55): a self-only body that enters exerted once — `/this character (?:may )?enters? play exerted/i`, gated on `isCharacter` (Bodyguard reminder + a few explicit bodies).

**Item exception** (like Shift's `named-item`): Powhatan's Staff is admitted even though `type !== 'Character'` because it pushes a **character** into exerted. Items that enter exerted *themselves* ("this item enters play exerted" — Sapphire Chromicon, MegaBot, Potato, ...) are excluded (character-only trigger). Opposing-side exerts (Jiminy Cricket, Figaro) are excluded via the `/opposing.../` gate. Merida's own FOCUSED ENERGY self-exert does NOT trigger BECKON ("another character"), so she never self-pairs.

**Scoring** (tier-driven, 5-baseline):

| Enabler tier | Score | Why |
|--------------|-------|-----|
| engine | **8** | Board-wide / repeatable push — fires BECKON many times (win-condition engine) |
| reanimator | **7** | Replays itself exerted from the discard, repeatably |
| self | **5** | One-shot self-only body (Bodyguard reminder) — same-deck density baseline |

Explanation token-swaps so Merida always reads as the payoff (`{enabler} <does X>, so {Merida} draws a card each time`).

**Coverage**: 1 anchor + 60 raw enablers (3 engine + 2 reanimator + 55 self-only); 55 deck-compatible with Amethyst Merida. Merida's page distribution: 50 × 5 / 2 × 7 / 3 × 8. The self-only pool is Bodyguard-heavy (Amber 23 / Steel 20).

**Full documentation**: See [`packages/synergy-engine/MERIDA_WISP_RULE.md`](packages/synergy-engine/MERIDA_WISP_RULE.md).

### Rule 21: Bounce (playstyle: "return from play to hand", payoff-anchored)

Two mechanically opposite halves that share the "return to hand" verb and never combo with each other. **Payoff-anchored** (`scoreBouncePair` returns null for enabler↔enabler and payoff↔payoff, dropped by `tribalFindSynergies`).

**Roles** (`getBounceRoles`, multi-role): `self-bounce` (10, return your own body to your hand), `flexible` (18, "return chosen character/item/location to their player's hand" with no side restriction — acts as BOTH a self-bounce enabler and an opponent-bounce), `opponent-bounce` (9, return a body to their player's hand for tempo), `return-payoff` (1, Maleficent's Staff — the only "when returned" payoff), `rebuy-payoff` (35, a "when you play this character" ETB worth re-firing: draw 2+/search/free-play/banish-chosen, Shift bodies excluded). Fast pre-filter is `/return|is returned|when you play this character/i` (a re-buy body need not contain "return"). Disjoint from Self-Discard's "from your discard" and Challenge Matters' "banished in a challenge".

**Scoring** (payoff-anchored, 5-baseline; `{A}`/`{B}` token-swap keeps the bounce side the actor):

| Pair | Score |
|------|-------|
| enabler (self-bounce \| flexible) ↔ rebuy-payoff | **8** |
| opponent-side (opponent-bounce \| flexible) ↔ return-payoff | **6** |
| everything else | (not generated) |

**Coverage**: 72 participating cards, **864 pairs** (840 at 8, 24 at 6). The 8-share is structural (28 enablers × 35 re-buy payoffs, like Sacrifice/Self-Discard). The re-buy pool overlaps Hero/Self-Discard/Items **by design** (a good ETB body is a good ETB body) — accepted cross-playstyle composition, since the engine cannot query another rule's coverage without a two-pass architecture. Closes 13 zero-synergy cards incl. the gallery hero Tigger (2500).

**Full documentation**: See [`packages/synergy-engine/BOUNCE_RULE.md`](packages/synergy-engine/BOUNCE_RULE.md).

## Commands

```bash
# Root commands
pnpm install          # Install all dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm dev              # Start web dev server

# Package-specific
pnpm build:engine     # Build synergy-engine package
pnpm test:engine      # Run engine tests
pnpm build:web        # Build web app
pnpm test:web         # Run web tests
pnpm test:supabase    # Run Supabase integration tests (requires .env.local)
```

## Architecture Notes

- SynergyEngine uses pluggable rules pattern - add rules via `SynergyRule` interface (runs at build time only; web app fetches pre-computed JSON)
- Synergies pre-computed at build time via `scripts/precompute-synergies.mjs`, fetched on demand per card selection
- Card data loaded once on init from `allCards.json`; synergy data lazy-loaded per card from `/data/synergies/{cardId}.json`
- Card data pre-deduplicated in `allCards.json` (same card in multiple sets appears once); loader expects clean data
- Two-column UI: CardList (340px) | SynergyResults (flex) - deck builder removed for MVP
- Floating card preview popover on hover (CardPreviewContext + CardPreviewPopover)
- Core format only (sets 5+)
- **react-grab**: Dev-only inspection tool. The `dev` script runs `pnpm dlx @react-grab/claude-code@latest && vite`. Playwright always uses `npx vite` for its webServer (react-grab is irrelevant during E2E). If a dev server is already running, Playwright reuses it (`reuseExistingServer: true` locally) — which means `playwright.config.ts`'s `webServer.env` only applies when Playwright launches its own Vite. Set branch-specific env vars in `apps/web/.env.local` for determinism; see **Feature Flags & Local Dev**.
- **useContainerWidth**: ResizeObserver hook guards against 0-width observations from detached elements (`if (w > 0)`) — required for React Strict Mode double-mount resilience
- **Source-map leak guard** (#358): `scripts/check-sourcemaps.mjs` fails the build if any `.map` in a dir inlines original code via non-empty `sourcesContent`; `SKIP_SOURCEMAP_GUARD=1` bypasses. Wired ONLY into `vercel.json`'s `buildCommand` (the deploy boundary), plus `apps/web/vite.config.ts` sets `workbox.sourcemap:false` so VitePWA stops emitting `sw.js.map`. **Do NOT add the guard to CI or a `postbuild` hook** — CI/local builds run without `SENTRY_AUTH_TOKEN` (the Sentry plugin only uploads+deletes app maps where the token exists, i.e. the Vercel build), so they legitimately produce content-bearing maps that never deploy; gating those paths would false-fail safe artifacts and break forked PRs.
- **Supabase**: Community voting backend (project: `ttyidjyaxnycbpxwngqr`, eu-central-1). Client SDK in `apps/web/src/shared/lib/supabase.ts`; migrations in `supabase/migrations/`. The MCP-driven migration workflow (apply, verify, regenerate types, advisors) lives in [`.claude/rules/migrations.md`](.claude/rules/migrations.md), auto-loaded when editing `supabase/migrations/**`.
- **Card images** — production is **content-addressed and self-hosted**; dev falls back to proxies. All routed through `resolveImageUrl(raw)` / `smallImageUrl(card)` in `apps/web/src/features/cards/loader.ts`.
  - **Production build** (`VITE_LOCAL_IMAGES=true`, set in `vercel.json`'s build command): `scripts/download-card-images.mjs` runs first — downloads all set 1-11 images from Ravensburger, copies the committed set-12 preview AVIFs (`apps/web/public/card-images-preview/{id}{-sm}.avif`), converts/resizes to two sizes, then **hashes each AVIF (sha256 prefix, 16 hex chars)** and writes `apps/web/public/card-images/{id}.{hash}.avif` + `{id}.{hash}-sm.avif`. It also injects `imageHash` + `imageHashSm` into `allCards.json` and `previewCards.json`. `resolveImageUrl` then builds `/card-images/{id}.{imageHash}.avif`; `smallImageUrl` builds `/card-images/{id}.{imageHashSm}-sm.avif`. These URLs are content-addressed, so `vercel.json`'s `Cache-Control: public, max-age=31536000, immutable` on `/card-images/(.*)` is truthful — bytes change ⇒ URL changes ⇒ every cache layer (browser, Vercel Edge, SW) sees a fresh resource. **Never put `immutable` on a URL that isn't content-addressed** (issue #323 was a year-long cache-poisoning bug from exactly that). The Ravensburger rewrite in `vercel.json` is now a dev-only fallback (dead in prod since every card has a hashed URL).
  - **Dev / CI** (`VITE_LOCAL_IMAGES` unset): `resolveImageUrl` rewrites `api.lorcana.ravensburger.com/images/...` → `/card-images/...` (Vite dev proxy + the Vercel rewrite forward to Ravensburger; proxy key uses the trailing-slash form `'/card-images/'` so it doesn't also grab `/card-images-preview/*`), and `lorcanaplayer.com/...` → `/card-images-preview/{id}.avif` (committed AVIFs; that host is behind Cloudflare Bot Management so server-to-server proxying fails). `smallImageUrl` falls back to the `.avif` → `-sm.avif` string transform.
  - **Service worker** caches `/card-images/.+\.avif$` with workbox `CacheFirst` (30d) — content-addressed URLs make this safe. The SW's `navigateFallbackDenylist` excludes `/card-images/*`, `/card-images-preview/*`, `/data/*` so direct asset-URL navigations hit the file, not the SPA NotFoundPage.
  - When debugging image-loading issues: `curl` 200 + browser "404" almost always means the SW is serving `index.html` for the navigation (check the Network tab's source column for `(ServiceWorker)`), or a stale browser/Edge cache entry on a non-hashed URL. Check `apps/web/public/card-images*` for committed assets before theorizing about CDNs.

## UI Theme (MVP)

Dark fantasy theme inspired by Lorcana:
- Background: #0d0d14 (near black)
- Surface: #1a1a2e (dark purple)
- Primary: #d4af37 (gold accents)
- Text: #e8e8e8 (off-white)
- Glowing borders on hover, purple-tinted shadows

## Workflow Preferences

### Git Workflow
- **Git safety enforced by hooks** — `git-write-protection` hook blocks commit, push, and destructive ops (checkout --, restore, reset --hard, clean -f, worktree remove/prune). Commit/push use `USER_APPROVED=1` prefix after explicit user approval. Destructive ops are hard-blocked — run manually.
- **Branch verification enforced by hook** — `branch-verification` hook blocks source file edits on master/main.
- Feature branches: `feature/<issue-number>-<description>` (e.g., `feature/5-deck-builder-tests`)
- Commit messages: Use semantic commit notation with issue reference (e.g., `test(deck): add tests (#5)`)
- PRs should include `Closes #<issue>` to auto-close issues on merge
- **Issues**: When creating issues, always add appropriate labels. When listing issues, check for unlabeled ones proactively. When adding/removing an issue from MVP, always update BOTH the `mvp` label AND the `MVP v1.0` milestone together.
- **Drafting issues**: The moment scope is agreed for a new GitHub issue, invoke `/draft-issue` — do not draft issue markdown in a message. The skill scores against an 8-section rubric and publishes on approval. Publishing bypass: `SKILL_APPROVED=1 gh issue create ...`.

### Pre-Commit & Pre-Push (automated)
- **Pre-commit hook** runs lint + tests on every `git commit`. Do not skip.
- **Pre-push hook** (husky) runs E2E chromium on every `git push`. Do not skip.
- Full 5-browser E2E suite runs in CI as safety net.
- After pushing, always confirm with clear output (e.g., git log showing commit on origin/master).
- **When pre-push fails on tests unrelated to your change:** (1) confirm it's pre-existing by checking whether the same test was accepted on `origin/HEAD` — if yes, something drifted since then; (2) surface scope options to the user (fix in scope / fix separately / defer / `--no-verify` with explicit approval) before digging into root-cause; (3) do NOT silently investigate the unrelated breakage — that's scope drift. Pause and ask.

### Branch Naming
- `feature/` - New features or enhancements
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `test/` - Test additions/improvements

### Engine Rebuilds (automated)
- **`engine-auto-rebuild` hook** automatically runs `pnpm build:engine` + `pnpm precompute-synergies` after editing any file in `packages/synergy-engine/src/`. No manual rebuild or precompute needed — the web app sees fresh data automatically.
- The `engine-validator` agent also runs build + precompute + audit as part of `/commit-and-push` when engine files are in the diff.
- The Vite dev server auto-detects stale data on startup (via `ensureSynergiesPlugin`).

### Feature Flags & Local Dev
- Before `pnpm dev` on a feature branch, check `apps/web/.env.example` for flags that gate the feature being built. If the branch needs a flag on, add it to `apps/web/.env.local` (git-ignored, per-developer).
- **Do not rely on `playwright.config.ts`'s `webServer.env`.** With `reuseExistingServer: !process.env.CI` (true locally), Playwright grabs any existing Vite on port 5173 without re-injecting env vars — so a dev server started without the flag silently fails feature-gated tests in pre-push. `.env.local` is loaded by Vite at boot regardless of who started it, making flag state deterministic across `pnpm dev`, `pnpm test:e2e`, and husky pre-push.
- Example: on `feature/285-reveals-page`, `VITE_IS_REVEAL_SEASON=true` must be in `.env.local` or the `/reveals` route redirects to `/` and the nav omits the Reveals entry.

### Synergy Rule Documentation
- Engine source conventions (rule pattern, 5-baseline scoring discipline, doc-sync rule, auto-rebuild) live in [`.claude/rules/engine.md`](.claude/rules/engine.md), auto-loaded when editing `packages/synergy-engine/src/**`.
- Per-rule docs live in `packages/synergy-engine/*_RULE.md` and are **auto-discovered** by `scripts/generate-docs.mjs` (`pnpm run docs`) into the docs-hub "Synergy Rules" category. Adding a new `*_RULE.md` wires it in automatically; only add a `RULE_LABEL_OVERRIDES` entry there if the display label differs from the title-cased filename (e.g. "Singer + Songs"), and a `RULE_ORDER` entry to place it in the reading sequence.
### Code Quality
- After writing or modifying significant code (new features, refactors, bug fixes), run the `code-simplifier` agent to polish for clarity and consistency
- Use `/refactor-code` for periodic comprehensive codebase audits
- When reviewing code or doing a re-review, always re-read the current file contents first — never assume you know what's already been changed. Diff against the actual working tree, not your memory of previous edits.
- When editing theme or config files, re-read the full file after edits to ensure no constants or exports were accidentally removed by the edit tool

### Design Token Changes
- **Grep the token value, not just declaration sites.** When swapping a font, color, or spacing value, the declaration lives in `theme.ts` / `index.css` / `index.html` — but inline styles, Storybook stories, and dynamic CSS strings (`cssText`, concatenated styles) bypass the token and must be found by searching the literal value across `apps/web/src/`.
- After the swap, grep **both** the old and new value to confirm zero stragglers. Short-form references (`font-family:Barlow,sans-serif` jammed into one string) won't match a `font-family` search — only the token name itself will.
- Long-term fix: refactor repeated tokens to CSS custom properties (`--font-body`) so one `:root` edit propagates everywhere instead of requiring an N-file hunt per swap.

### Data Integrity
- **Never override tool output with memory.** When presenting data from tool results (gh issue list, git log, API responses, etc.), use the actual tool output verbatim. Do not "correct" or reformat it based on memory or prior context — memory can be stale or wrong.
- **Never take action on assumptions.** If the user states a fact (e.g., "X doesn't have label Y"), do not assume they want it changed. Ask before modifying.

### Communication
- **Never silently skip work.** If you decide not to implement something the user asked for (e.g., because the plan marks it as out of scope, or it belongs to a different issue), explicitly tell the user what you're skipping and why. Do not silently ignore mockup elements, requested features, or differences the user asked you to find.

### Critical Thinking (IMPORTANT)
- **Challenge decisions proactively.** When the user proposes an approach, or when you're about to implement something, pause and consider: is there a simpler way? A hidden downside? An assumption worth questioning?
- **Flag problems you notice.** If you spot issues with current implementations while working (dead code, unnecessary complexity, stale patterns, security concerns), call them out — even if they're outside the current task scope.
- **Challenge your own suggestions too.** Before recommending an approach, consider the tradeoffs and present them honestly. Don't just validate — pressure-test.
- **Tone: collaborative, not adversarial.** Frame challenges as "have you considered..." or "one concern with this is..." — the goal is better outcomes, not debate.

### Visual Self-Verification (CRITICAL)
- **NEVER ask the user to verify pixel alignment or regression catches.** After any UI change, use Chrome DevTools MCP (screenshot tool) to verify the result yourself. Analyze the screenshot for overlapping elements, misalignment, missing content, broken layouts, and sizing issues. If something is wrong, fix it and screenshot again. Repeat until correct. Only then present the result. **This rule is about catching your own mistakes — not about working alone on design.**
- **Self-verification ≠ skipping design check-ins.** Design alignment and regression catching are different problems. After completing each new visual component (hero, tier, modal, nav variant, etc.) during feature work, take a screenshot and show the user before committing and moving on. Wait for their approval or change requests. This is the "Visual Iteration Protocol" — see `.claude/skills/implement-issue/SKILL.md` Step 7 for the full loop. Skipping it is the failure mode that produces a 9-phase PR built on design decisions the user never got to weigh in on.
- **Do the math before positioning.** When using absolute positioning or calc(), calculate the actual pixel values first (card widths, gaps, badge sizes) instead of guessing and iterating. One correct calculation beats five trial-and-error rounds.

### Implementation Approach
- Before editing code or implementing changes, validate assumptions against real data first (e.g., test regex against actual card data, verify existing state)
- Do not jump to implementation until the user confirms the approach

### Storybook
- **Every new visual component needs a `.stories.tsx` file.** The `check:stories` story-coverage gate runs locally as the first pre-push step (~130ms) and fails if a new component is added without stories.
- Story-writing mechanics (imports, decorators, mock-data shape, exclusions) live in [`.claude/rules/stories.md`](.claude/rules/stories.md), auto-loaded when editing `**/*.stories.tsx`.

### Testing Style
- Unit/integration test conventions (focused, minimal, 5-15 per unit, one behavior per test) live in [`.claude/rules/tests.md`](.claude/rules/tests.md), auto-loaded when editing `**/*.test.ts(x)`.
- **E2E test inventory**: `apps/web/e2e/E2E_TESTS.md`, update this file whenever E2E tests are added, removed, or edited.

### Debugging E2E Failures
- **Read the failure screenshot before theorizing.** Playwright writes one per failed test to `apps/web/test-results/{test-name}-chromium/test-failed-1.png`. It shows the rendered DOM at the moment of failure — the fastest way to distinguish "test is stale" / "UI refactored" / "route gate fired" / "feature flag off."
- Common patterns visible in the screenshot:
  - **Unexpected page** (e.g., home rendered when test navigated to `/reveals`) → a route gate redirected; check the corresponding phase/flag hook.
  - **Correct page but expected text missing** → UI may have been refactored (element moved to `<img alt>`, or hidden via `position: absolute; left: -10000` for screen readers — `toBeVisible()` excludes those). Query the `<section>` by role/name instead, or use `.toHaveCount(1)`.
  - **Flash of initial state** → async state (fetch, localStorage) hadn't resolved; check what the page is waiting for before asserting.

### Design Session Workflow (HTML/CSS Mockups)

Inkweave uses iterative HTML/CSS mockups instead of Figma. Mockups live in `apps/web/public/mockups/` — a **git-ignored, local-only** scratch folder for pre-code design work; the files are never committed. They are the working reference for visual design during a design session, before React implementation.

#### Session Structure
1. **Start**: Read ALL mockup files in parallel before making any changes. Never work from memory of a previous session — files may have changed.
2. **Scope**: Define what we're working on (new mockup, audit pass, specific fix). One focus at a time.
3. **Edit → Review → Iterate**: Make changes, user reviews in browser, discuss, refine. Repeat until approved.
4. **End**: Update plan file mockup status table. Document any pending items for next session.

#### Multi-Pass Audit Methodology
When auditing mockups, use systematic cross-page passes — one concern per pass:

| Pass | Focus | Method |
|------|-------|--------|
| **Spacing/Breathing** | Gaps, padding, margins feel too tight | Read all files → compare numeric values across pages → normalize |
| **Consistency** | Same component looks different across pages | Pick a pattern (toolbar, chips, cards) → grep values across all mockups → align |
| **Typography** | Font sizes, weights, colors follow type scale | Check every `font-size` against the scale: 10 → 13 → 16 → 20 + 14px forms |
| **Color/Contrast** | Text colors meet WCAG AA (≥4.5:1 on dark bg) | Check every `color:` value against the 4-color palette |
| **Accessibility** | Headings, landmarks, ARIA, semantics | Verify h1 per page, `<main>`, `<header>`, `<nav>`, aria-labels on inputs |
| **Navigation** | Links go where expected, correct element types | `<a>` for navigation, `<button>` for actions. No misleading affordances |

**Key principle**: Always compare the SAME value across ALL pages. E.g., "toolbar gap" should be identical on browse, playstyle-detail, show-all, card-detail. Read all files, grep the property, normalize.

#### Design Token Reference (locked in)
These values are final and must be used consistently across all mockups:

**Type Scale** (major third ~1.25):
- Display: `20px` (page titles, card names, hero names)
- Section: `16px` (section headings like "Synergies", group titles in show-all)
- Body: `13px` (most UI text, chips, labels, descriptions, breakdown rows)
- Micro: `10px` (badges, count circles, hover cues, metadata)
- Form exception: `14px` (search inputs only)
- Hierarchy via weight/case/color, NOT pixel nudges. No 11px, 12px, 22px.

**Text Color Palette** (4 colors, all WCAG AA):
- `#e8e8e8` — primary text (card names, headings, active UI)
- `#90a1b9` — muted text (labels, counts, secondary info, placeholders in non-input contexts)
- `#d4af37` / `#ffb900` — gold (brand, accents, active states, CTAs)
- `#c8c8d8` — description text (supplementary/educational content, slightly softer than primary)
- `#aaaaaa` — placeholder text inside inputs/empty states only

**Spacing System**:
- Left panel gap: `16px` | Left panel padding: `16px`
- Text box padding: `12px`
- Toolbar gap: `10px` (all pages)
- Group header margin-bottom: `8px`
- Group description margin: `8px 0 16px`
- Synergy group margin-bottom: `20px`
- Card grid gap: `10px` (synergy grids), `12px` (browse/playstyle grids)

**Toolbar Pattern** (shared across browse, playstyle-detail, show-all):
`[Filters btn (count)] | [result count] [active chips ✕] [Clear all] ... [Sort ▼]`
Card-detail uses group chips instead (intentionally different — it's filtering synergy groups, not card attributes).

**Navigation Semantics**:
- Logo "INKWEAVE" → `<a href="home">` (no arrow, just brand text — clicking logo = home is universal)
- Back navigation → `<a>` with explicit text ("← Back to all synergies")
- Breadcrumbs → `<nav>` with linked ancestors
- Filter chips, sort toggles → `<button>`

**Heading Hierarchy**:
- `<h1>` = page identity (card name on detail, page title on catalog, aggregate label in modal)
- `<h2>` = major sections ("Synergies", group titles in show-all)
- `<h3>` = group names within sections

#### Cross-Page Consistency Checklist
Before approving any mockup, verify these match across all pages:
- [ ] Toolbar gap, button sizes, chip padding identical
- [ ] Font sizes follow type scale exactly (no custom sizes)
- [ ] Text colors from the 4-color palette only
- [ ] Close character: `×` (U+00D7) everywhere
- [ ] Logo: just "INKWEAVE" (no arrow), links to home
- [ ] Search input: `aria-label="Search cards"`, `placeholder="Search cards..."`
- [ ] Sort select: `aria-label` matches context ("Sort cards" or "Sort synergies")
- [ ] `<main>` landmark wraps page content
- [ ] `<h1>` exists exactly once per page
- [ ] Dashed tiles: `#151525` bg, `#444466` border, gold text

### Worktree & Agent Workflow
- **Default: sequential, one agent at a time.** Use parallel agents only for read-only research/exploration or trivially independent tasks with clear specs.
- **Prefer feature branches over worktrees.** Only use worktrees when you need to pause mid-task and switch context, or run concurrent dev servers.
- **Max 2 active worktrees.** Port assignments: main=5173, worktree-1=5174, worktree-2=5175.
- **Same-session cleanup.** Every worktree created in a session must be cleaned up in that session (or explicitly flagged for next session in MEMORY.md).
- **Never leave orphan branches.** After merging a PR, delete the local branch and worktree immediately.
- **Pre-commit timeout.** Always use `timeout: 600000` for git commit (pre-commit hooks run lint + test + E2E, ~2-3 min).
- **Port conflicts.** Before starting a dev server or running E2E tests, check ports 5173-5175 and kill stale processes.

## Design system mirror

There's a separate Claude project that mirrors this repo's design language —
tokens, typography, brand assets, UI kit. **It is a point-in-time copy**, not a
live link.

When a PR changes any of the following, refresh the design system project
afterward (or note it in the PR description so I can refresh it later):

| File / folder | What lives there |
|---|---|
| `apps/web/src/shared/constants/theme.ts` | All design tokens (colors, type scale, spacing, easings) |
| `apps/web/src/docs/Colors.stories.tsx` | Canonical color palette + usage guide |
| `apps/web/src/docs/Typography.stories.tsx` | Type scale + font families + usage guide |
| `apps/web/src/docs/SpacingLayout.stories.tsx` | Spacing scale + layout constants |
| `apps/web/index.html` (font imports) | Google Fonts imports — flag any swap |
| `apps/web/public/brand/` | Logo (static + animated) |
| `apps/web/src/assets/*.svg` | Ink icons + inkable/uninkable glyphs |
| `apps/web/public/art/playstyles/` | Playstyle cover imagery |
| `apps/web/public/art/franchises/` | Franchise cover imagery |
| The "Design Session Workflow", "UI Theme", and "Design Token Changes" sections in this file | Design language + token-edit playbook |

### How to refresh

1. Open the design system project in Claude.
2. Say: *"refresh against the latest of Doberjohn/inkweave master — focus on `theme.ts`, the storybook docs, and anything in `public/brand` or `public/art` that changed."*
3. Review the diff before approving.

The `design-system-drift` GitHub Action will leave a comment on PRs that touch
these files reminding you to do this — see `.github/workflows/design-system-drift.yml`.
