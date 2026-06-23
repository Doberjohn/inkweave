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
            ├── App.tsx       # Root component (two-column layout)
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
- Location Control (`location-control`) - location-support roles (8 sub-rules)
- Discard (`discard`) - opponent discard enablers + hand-size payoffs
- Ramp (`ramp`) - inkwell ramp + inkwell triggers + cost reduction grants
- Toys (`toy`) - Toy-classification members + tribal payoffs (search, banish-trigger, self-discount)
- Sacrifice (`sacrifice`) - self-banish cards (banish your own characters) + banish-trigger payoffs
- Seven Dwarfs (`dwarfs`) - Seven Dwarfs-classification members + tribal payoffs (density, recruit, return)

**Synergy Score**: 1-10 numeric scale (all integers valid). Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4)

## Automation

Claude Code hooks, skills, and agents enforce workflow rules automatically. Check these before adding redundant instructions to CLAUDE.md.

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

### Location Control (playstyle, 8 sub-rules)

8 specialized rules detecting location-support roles: at-payoff, play-trigger, buff, location-ramp, move, in-play-check, search, boost. All merge into a single `location-control` playstyle group. Factory pattern (`createLocationRule`) generates each rule. Anti-location cards (banish/remove locations) are excluded.

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
- **Supabase**: Community voting backend (project: `ttyidjyaxnycbpxwngqr`, eu-central-1). Use Supabase MCP tools (`apply_migration`, `execute_sql`, `generate_typescript_types`, `get_advisors`, `list_tables`) for all database operations — do not use local Supabase CLI. After schema changes: apply migration via MCP → verify with `list_tables`/`execute_sql` → regenerate types → run `get_advisors` (security). Client SDK in `apps/web/src/shared/lib/supabase.ts`; migrations in `supabase/migrations/`.
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
- When modifying rule logic, scoring, or explanations in the engine, always update the **Synergy Rules** section in this file to match. This includes score tables, condition matchers, explanation templates, and display tier definitions.
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
- **Every new visual component needs a `.stories.tsx` file.** CI runs `check:stories` which fails if a new component is added without stories. The same check runs locally as the first pre-push step (~130ms), so missing stories surface before the Chromatic CI run rejects the push.
- Stories go next to the component: `ComponentName.stories.tsx` alongside `ComponentName.tsx`
- Import Meta/StoryObj from `@storybook/react-vite` (NOT `@storybook/react` — Storybook 10 lint rule catches this)
- Components using React Router need a `MemoryRouter` decorator
- Components using `useCardPreview` (or rendering `SearchAutocomplete`) need a `CardPreviewProvider` decorator
- Mock data: use the actual `LorcanaCard` type shape — `textSections` is `string[]`, not `{type, text}[]`
- Excluded components (icons, context providers, ErrorBoundary) are listed in `apps/web/scripts/check-story-coverage.mjs`
- Chromatic runs on every push; UI snapshots catch visual regressions automatically

### Testing Style
- Write focused, minimal tests - not exhaustive coverage
- One test per distinct behavior, no redundant variations
- Skip trivial edge cases unless they're critical paths
- Prefer readability over coverage percentage
- Aim for 5-15 tests per component/hook, not 30+
- **E2E test inventory**: `apps/web/e2e/E2E_TESTS.md` — update this file whenever E2E tests are added, removed, or edited

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
