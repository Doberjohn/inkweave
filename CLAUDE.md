# Inkweave

Lorcana synergy finder for Core format with archetype-based synergy detection.

## Active Epic: Deck Builder & Engine Score (milestone #3)

The flagship multi-session initiative. **Read these before starting any deck-builder work:**
- **Plan (source of truth)**: [`docs/deck-builder/PLAN.md`](docs/deck-builder/PLAN.md) — full design + rationale (8 phases, E0–E7).
- **Progress**: milestone #3 → `gh issue list --milestone "Deck Builder & Engine Score" --state all`. Epics #450–#457; Phase-0/1 tasks #458–#473.
- **Session Handoff Log**: pinned issue **#474** — the running ledger. **Append an entry every session** (shipped / decisions / gotchas / in-progress / next); read the latest entry at session start.
- **Working location**: the MAIN checkout (`D:\johnn\Projects\inkweave`) on branch `deck-builder` — the integration branch off `master`. Phase 0 + the done Phase-1 tasks landed here via PR #480 and stay **unmerged to `master`/production** until the epic is ready to ship (then one `deck-builder` → `master` PR releases it). The old `claude/inkweave-deck-builder-af3e5b` branch is retained as merged history: do not work on it. Never work from a `.claude/worktrees/` folder: this epic's commits are unmerged to production, and `.claude/settings.json` wires the hooks to the main checkout by absolute path, so a worktree silently runs without `branch-verification` or `engine-auto-rebuild`.

**Golden rules for this epic:**
1. Deck-level synergy uses the **precomputed pairs JSON** (`pairs[id].aggregateScore`), NOT the live engine — lazy-import the engine only for hypothetical/preview cards.
2. The advisor is **pool-driven + archetype-parameterized** — detect roles from card text/keywords, **never hardcode card names** (Core rotates).
3. The Deck Quality Score is a **transparent weighted formula + case library**, never ML.
4. Meta/matchups are **deferred** until the user's Set-13 data exists (Phase 6).

**Session ritual (a process to run every session, not a hope):**

_Start:_
1. **Audit the previous session's close-out first.** Is `git status` clean and on `deck-builder`? Does the latest #474 comment exist and end with a `Next:` line? Do the issues touched last time have a note? If anything is missing, surface it to the user before starting new work.
2. Read `docs/deck-builder/PLAN.md` and the latest #474 entry (its `Next:` line names your task).
3. `gh issue list --milestone "Deck Builder & Engine Score" --state open`, then pick the next unblocked task. Any task that applies a live-DB Supabase migration or configures OAuth apps needs the user's authorization, so skip it when running headless (next up: the Phase-2 `collections` migration under #452, Phase-3 `analysis_cases` under #453; the #463 auth + #464 migrations that first surfaced this rule are already done).
4. `/implement-issue <num>`.

_End or any pause (the close-out contract, in order, all of it):_
1. **Adversarial review before committing.** Self-review the diff, or spawn a code-reviewer agent, for correctness, lifecycle/async edge cases, and convention. Fix what it finds. A green suite is necessary, not sufficient (that is how the #465 unmount-flush + async-ink bugs slipped past a passing session).
2. **Commit** (WIP if incomplete). The pre-commit gate (lint + tests) must pass; never `--no-verify`. Nothing important stays only in the working tree.
3. **Append a #474 entry**: shipped (with SHAs) / decisions + why / gotchas / in-progress / **`Next:`**. Always end with an explicit `Next:` line, even on a demo or review entry, so the next session finds the thread immediately.
4. **Comment implementation notes** on each touched issue (decisions, deviations, carry-forward gotchas).
5. **Write a memory file** for any durable gotcha that generalizes beyond this task.
6. **Update `docs/deck-builder/PLAN.md`** if the design or scope changed.
7. **Verify clean**: `git status` clean, scratch files removed, then `/close-session`.

**Epic-issue convention:** the milestone's task issues (#458 onward) are compact pointers; their authoritative spec is `docs/deck-builder/PLAN.md` plus the reference files each one names, not a standalone ops-runbook. Override `/implement-issue`'s defaults deliberately (and say so, do not expand the issue): stay on the `deck-builder` integration branch (do NOT cut a `feature/<n>-*` branch, since the work depends on this branch's commits that are unmerged to production), and treat its issue-quality rubric as not applicable (it scores production runbooks, not feature-code pointers).

**Retire this whole section when milestone #3 closes.** It is the only always-loaded epic context in this file, and it should leave with the epic rather than becoming another stale block. It earns its place here only because the session ritual has no `paths:` trigger to hang a `.claude/rules/` file on: start-of-session process cannot be lazily loaded.

## MVP Status

- **Scope**: Core format only (sets 9+), community voting, deck builder
- **UI**: Dark fantasy theme (deep purple, gold accents)
- **Synergies**: 6 direct rules + 21 playstyles, indexed in the [Synergy Rules registry](#synergy-rules)

See [GitHub Issues](https://github.com/Doberjohn/inkweave/issues) for full backlog.

## Tech Stack

- pnpm workspaces monorepo
- React 19 + TypeScript 6 (engine tsconfig carries `ignoreDeprecations: "6.0"` for tsup's dts `baseUrl` injection — remove before TS 7.0; see issue #329)
- Vite bundler
- Radix UI Primitives (headless behavior) + inline CSS with design tokens
- Static JSON card database

## Environment

- **OS**: Windows 11. **Shell**: Windows PowerShell 5.1 (`powershell.exe`). **pwsh 7 is not installed** - never assume it. Git Bash is available for POSIX scripts; each takes its own syntax.
- PowerShell 5.1 has no `&&`/`||` chain operators, no ternary, no null-coalescing. Use `A; if ($?) { B }`.
- Long paths are not enabled (`core.longpaths` unset), so deep `node_modules` trees under `.claude/worktrees/` can exceed `MAX_PATH` and resist deletion.
- Node 24, pnpm workspaces. `claude` must be on PATH for the scheduled rule-candidate miner.

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
            ├── AppLayout.tsx # Provider + <Outlet /> shell
            ├── pages/        # Route page components
            ├── features/     # cards, synergies, playstyles, voting, reveals, admin panes
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

**Game Mode**: Core only (sets 9+, per `MIN_CORE_SET` in `packages/synergy-engine/src/constants.ts`) - Infinity mode removed for MVP

**Synergy Categories**: direct (pair-specific, e.g. Shift), playstyle (strategy-reinforcing, e.g. Lore Denial)

**Playstyles**: 21 implemented, listed with their `PlaystyleId` and spec doc in the [Synergy Rules registry](#synergy-rules) below. The canonical union is `PlaystyleId` in `packages/synergy-engine/src/types/playstyle.ts`.

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
| `agent-tool-substitution-guard.sh` | PostToolUse/Agent | Halts when a subagent reports a missing tool, so the fix lands in that agent's `tools:` frontmatter instead of the main session silently substituting |
| Husky pre-push | git push | Runs `typecheck` (`tsc -b`), `check:stories` (story coverage), `check:design` (design-token value gate, #508), E2E, then the CodeScene gate. **On Windows only chromium runs** (webkit + mobile-chrome workers hang past Playwright's stop timeout); set `PRE_PUSH_FULL=1` to force them. Elsewhere: chromium + webkit + mobile-chrome. Full 5-browser matrix in CI |

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
| `/design <what>` | what to design | Design or update UI layouts, screens, and components with Pencil (`.pen` files) |
| `/supabase-postgres-best-practices` | — | Vendored Supabase reference: Postgres query, schema, and index best practices |

### Path-scoped rules (`.claude/rules/`)

Convention files that auto-load only when editing files matching their `paths:` glob, keeping zone-specific detail out of always-loaded context (the differentiated split). Each rule's content also has a one-line pointer in the relevant section below.

| Rule | Loads when editing | Covers |
|------|-------------------|--------|
| `tests.md` | `**/*.test.ts(x)` | unit/integration test style |
| `stories.md` | `**/*.stories.tsx` | Storybook conventions (imports, decorators, mock-data shape) |
| `migrations.md` | `supabase/migrations/**` | Supabase MCP migration workflow |
| `engine.md` | `packages/synergy-engine/src/**` | engine rule pattern, 5-baseline scoring anchors, doc-sync, auto-rebuild |
| `design-tokens.md` | `apps/web/src/**/*.ts(x)` | design-token lint rules (#508): the `inkweave/*` ESLint rules + value-grep gate, the shrink-only grandfather ledgers, and what to do when a rule fires |
| `overlays.md` | `apps/web/src/**/*.tsx` | overlay contract (#510): DialogShell/BottomSheet + hook trio, backdrop-always-closes, scrim tokens, the FilterDialog Radix exception, E2E backdrop/unmount invariants |
| `mockups.md` | `apps/web/public/mockups/**` | design-session workflow, mockup token set, audit passes |

### Agents (`.claude/agents/`)
| Agent | Model | Triggered by | What it does |
|-------|-------|-------------|-------------|
| `session-start` | Haiku | `/implement-issue` Step 0 | Worktrees, branches, stashes, ports, PRs |
| `pr-ready` | Sonnet | `/commit-and-push` Step 0 | Lint, tests, E2E, branch naming, diff size |
| `engine-validator` | Sonnet | `/commit-and-push` when engine files in diff | Build, test, precompute, audit scores |
| `supabase-validator` | Sonnet | `/commit-and-push` when migration files in diff | Integration tests, security advisor, type freshness, schema drift |
| `codescene-validator` | Sonnet | Before push, or on demand | Analyzes the branch change set against a base ref: quality-gate status, per-file cyclomatic-complexity regressions, priority-sorted debt |

### Scheduled jobs

| Job | When | What it does |
|-----|------|-------------|
| **Rule-candidate miner** (`scripts/mine-rules.ps1`) | Weekly, Windows Task Scheduler task `Inkweave Rule Miner` (Mon 11:00) | Runs headless `claude -p "/mine-rules"` with a scoped, read-only-plus-issue-create allowlist. Surfaces the top uncovered mechanic and opens one `rule-candidate` issue. **Read-only + issue-creation only**: never edits engine source, commits, or pushes. Output logged to `reports/mine-rules-last-run.log`. Disable with `schtasks /Delete /TN "Inkweave Rule Miner" /F`; the repo code is inert without the task. Requires Windows PowerShell 5.1 (pwsh 7 not assumed) and `claude` on PATH. |

The miner itself (`scripts/mine-rule-candidates.mjs`, run via `pnpm mine-rules`) uses the live `SynergyEngine` as a coverage oracle: cards it finds zero synergies for are clustered by shared mechanical phrase, near-duplicates collapsed by card-set overlap, and ranked into `reports/rule-candidates.json` (git-ignored). Ranking is **payoff-aware** (#363): each mechanic in the `MECHANICS` table pairs an enabler anchor with a payoff/trigger pattern, and `rankCluster` weights a cluster by its `payoffCount` (the size of its two-sided axis) so good-stuff mechanics with no payoff side sink. See issues #359 and #363.

## Synergy Rules

Rules live in `packages/synergy-engine/src/engine/rules/` and run at build time only; the web app consumes pre-computed JSON.

**Each rule's authoritative spec is its own `*_RULE.md`** in `packages/synergy-engine/` (detection patterns, score matrices, coverage, rationale). `scripts/generate-docs.mjs` auto-discovers them. **Do not restate rule detail here** — this file is always-loaded context. The registry below is the index; add a row when you add a rule.

**Scoring**: integers 1-10, anchored at **5 = neutral same-deck density**. Anything above 5 must justify itself with a specific mechanical interaction, statable in one sentence. Full anchor table: [`.claude/rules/engine.md`](.claude/rules/engine.md) (auto-loads when editing engine source). Design rationale: [`SCORING_DESIGN.md`](packages/synergy-engine/SCORING_DESIGN.md).

**Removed rules**: [`REMOVED_RULES.md`](packages/synergy-engine/REMOVED_RULES.md) (Evasive, Tribal, Challenger, Draw, Ward). Exert was archived and later revived as the `exert` playstyle.

### Registry

**Direct rules** — pair-specific, no playstyle group:

| Rule | Shape | Doc |
|------|-------|-----|
| Shift Targets | bidirectional | [SHIFT_TARGET_RULE.md](packages/synergy-engine/SHIFT_TARGET_RULE.md) |
| Named Companions | forward-only | [NAMED_COMPANIONS_RULE.md](packages/synergy-engine/NAMED_COMPANIONS_RULE.md) |
| Singer + Songs | bidirectional | [SINGER_SONGS_RULE.md](packages/synergy-engine/SINGER_SONGS_RULE.md) |
| Spike Suit | single-anchor (Dale) | [SPIKE_SUIT_RULE.md](packages/synergy-engine/SPIKE_SUIT_RULE.md) |
| Merida Archer | single-anchor | [MERIDA_ARCHER_RULE.md](packages/synergy-engine/MERIDA_ARCHER_RULE.md) |
| Merida Wisp Conjurer | single-anchor | [MERIDA_WISP_RULE.md](packages/synergy-engine/MERIDA_WISP_RULE.md) |
| Free Play | anchor-by-text (Pocahontas) | [FREE_PLAY_RULE.md](packages/synergy-engine/FREE_PLAY_RULE.md) |

**Playstyle rules** — strategy-reinforcing. The `id` is the `PlaystyleId` the web UI keys its exhaustive `Record`s on (see `.claude/rules/engine.md` before adding one):

| Playstyle | `id` | Doc |
|-----------|------|-----|
| Lore Denial | `lore-denial` | [LORE_LOSS_RULE.md](packages/synergy-engine/LORE_LOSS_RULE.md) |
| Location Control | `location-control` | [LOCATION_CONTROL_RULE.md](packages/synergy-engine/LOCATION_CONTROL_RULE.md) |
| Discard | `discard` | [DISCARD_RULE.md](packages/synergy-engine/DISCARD_RULE.md) |
| Self-Discard | `self-discard` | [SELF_DISCARD_RULE.md](packages/synergy-engine/SELF_DISCARD_RULE.md) |
| Ramp | `ramp` | [RAMP_RULE.md](packages/synergy-engine/RAMP_RULE.md) |
| Toys | `toy` | [TOY_RULE.md](packages/synergy-engine/TOY_RULE.md) |
| Sacrifice | `sacrifice` | [SACRIFICE_RULE.md](packages/synergy-engine/SACRIFICE_RULE.md) |
| Seven Dwarfs | `dwarfs` | [DWARFS_RULE.md](packages/synergy-engine/DWARFS_RULE.md) |
| Floodborns | `floodborn` | [FLOODBORN_RULE.md](packages/synergy-engine/FLOODBORN_RULE.md) |
| Hunny | `hunny` | [HUNNY_RULE.md](packages/synergy-engine/HUNNY_RULE.md) |
| Red Panda | `red-panda` | [RED_PANDA_RULE.md](packages/synergy-engine/RED_PANDA_RULE.md) |
| Items | `items` | [ITEMS_RULE.md](packages/synergy-engine/ITEMS_RULE.md) |
| Healing | `healing` | [HEALING_RULE.md](packages/synergy-engine/HEALING_RULE.md) |
| Exert | `exert` | [EXERT_RULE.md](packages/synergy-engine/EXERT_RULE.md) |
| Bounce | `bounce` | [BOUNCE_RULE.md](packages/synergy-engine/BOUNCE_RULE.md) |
| Classification Tribes | `monster` `princess` `hero` `super` `royalty` `detective` | [TRIBES_RULE.md](packages/synergy-engine/TRIBES_RULE.md) |

Royalty is Queen/King/Prince and deliberately excludes Princess. All six tribes come from one shared payoff-anchored factory.

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
- Multi-page SPA via react-router (home, browse, card detail, playstyles, deck builder, voting, admin). Routes in `router.tsx`; `AppLayout` mounts the providers plus `<Outlet />`
- Core format only (sets 9+)
- **react-grab**: Dev-only inspection tool. The `dev` script runs `pnpm dlx @react-grab/claude-code@latest && vite`. Playwright's webServer runs `npx vite`, which is still DEV mode, so `index.html`'s `import.meta.env.DEV` gate loads react-grab during E2E as well; its `ws://localhost:4722` connection error must stay allowlisted in the E2E console-error guard (#405). If a dev server is already running, Playwright reuses it (`reuseExistingServer: true` locally) — which means `playwright.config.ts`'s `webServer.env` only applies when Playwright launches its own Vite. Set branch-specific env vars in `apps/web/.env.local` for determinism; see **Feature Flags & Local Dev**.
- **useContainerWidth**: ResizeObserver hook guards against 0-width observations from detached elements (`if (w > 0)`) — required for React Strict Mode double-mount resilience
- **Source-map leak guard** (#358): `scripts/check-sourcemaps.mjs` fails the build if any `.map` in a dir inlines original code via non-empty `sourcesContent`; `SKIP_SOURCEMAP_GUARD=1` bypasses. Wired ONLY into `vercel.json`'s `buildCommand` (the deploy boundary), plus `apps/web/vite.config.ts` sets `workbox.sourcemap:false` so VitePWA stops emitting `sw.js.map`. **Do NOT add the guard to CI or a `postbuild` hook** — CI/local builds run without `SENTRY_AUTH_TOKEN` (the Sentry plugin only uploads+deletes app maps where the token exists, i.e. the Vercel build), so they legitimately produce content-bearing maps that never deploy; gating those paths would false-fail safe artifacts and break forked PRs.
- **Supabase**: Community voting backend (project: `ttyidjyaxnycbpxwngqr`, eu-central-1). Client SDK in `apps/web/src/shared/lib/supabase.ts`; migrations in `supabase/migrations/`. The MCP-driven migration workflow (apply, verify, regenerate types, advisors) lives in [`.claude/rules/migrations.md`](.claude/rules/migrations.md), auto-loaded when editing `supabase/migrations/**`.
- **Card images**: production is content-addressed and self-hosted (`{id}.{sha256prefix}.avif`); dev falls back to proxies. All URLs route through `resolveImageUrl` / `smallImageUrl` in `apps/web/src/features/cards/loader.ts`. Pipeline, dev proxy rules, SW caching, and the debugging playbook: [`apps/web/src/features/cards/IMAGES.md`](apps/web/src/features/cards/IMAGES.md).
  - **Never put `immutable` on a URL that is not content-addressed.** Issue #323 was a year-long cache-poisoning bug from exactly that. Content addressing is what makes `max-age=31536000, immutable` truthful.

## UI Theme (MVP)

Dark fantasy theme inspired by Lorcana:
- Background: #0d0d14 (near black)
- Surface: #1a1a2e (dark purple); elevation = LIGHTNESS (surfaceRaised/Floating/Overlay), shadows are secondary cues
- Primary: #ffb900 (THE brand gold — glows/rings via `hexRgba`/`SHADOWS`); #d4af37 (`primary500`/`600`, the same hex) is the legacy accent, grandfathered only and now enforced by `inkweave/no-legacy-gold`
- Text: #e8e8e8 (off-white)
- Glowing borders on hover; token source of truth is `apps/web/src/shared/constants/theme.ts` (2026-07-22 rulings: milestone #4)

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
- **Read the failure screenshot before theorizing.** Playwright writes one per failed test to `apps/web/test-results/{test-name}-chromium/test-failed-1.png`. Full triage playbook: [`apps/web/e2e/E2E_TESTS.md`](apps/web/e2e/E2E_TESTS.md).

### Design Session Workflow (HTML/CSS Mockups)
- Inkweave uses iterative HTML/CSS mockups (`apps/web/public/mockups/`, git-ignored scratch) instead of Figma. Session structure, audit passes, and the locked mockup token set live in [`.claude/rules/mockups.md`](.claude/rules/mockups.md), auto-loaded when editing that folder.
- The shipped app tokens are `apps/web/src/shared/constants/theme.ts`, not the mockup tokens.

### Agent Autonomy Boundaries

The boundary is drawn on what a loop may **do**, not on whether a human is watching. Unattended runs are fine; unattended **writes** are not.

- **Read-only fan-out is unrestricted.** Parallel subagents, Workflow orchestration, and headless analysis runs may go unsupervised. The weekly `claude -p "/mine-rules"` miner is the pattern to copy: a scoped allowlist that reads, reports, and opens an issue, but never edits source, commits, or pushes.
- **Writes to the working tree stay in the main session.** Never delegate file edits to anything that writes outside Claude's Edit/Write tools (an external CLI, a `--sandbox workspace-write` run). The hooks fire on the tool call, not on the filesystem, so such writes bypass `branch-verification.sh`, `engine-auto-rebuild.sh`, and `git-write-protection.sh` completely. The failure is silent: source edits on the wrong branch, and stale precomputed synergy JSON that no rebuild ever corrects.
- **A human sets the stop condition; the agent never sets its own.** A run may loop until a stated, verifiable condition holds. It may not decide for itself what "done" means. `/draft-issue` writes the Acceptance Criteria, and those are the contract.
- **A green suite never ends a task.** It is necessary, not sufficient. Every commit passes an adversarial review of the diff first (close-out contract, step 1). That is exactly how #465's unmount-flush and async-ink bugs slipped past a passing session.
- **Visual work always meets a human eye.** No component ships on a screenshot the agent took and approved alone. Self-verification catches the agent's own mistakes (`require-visual-self-verification`); it does not replace the design check-in (Visual Iteration Protocol). The two solve different problems.
- **No self-driving loops over this repo.** `/goal`-style persistent loops, terminal-pane agent delegation, and cross-model coding agents that edit files are out of scope. Not as a matter of taste: they each move the writes outside the guardrails above. Revisit only if the guardrails move inside the loop.

### Worktree & Agent Workflow
- **Default: sequential, one agent at a time.** Use parallel agents only for read-only research/exploration or trivially independent tasks with clear specs.
- **Prefer feature branches over worktrees.** Only use worktrees when you need to pause mid-task and switch context, or run concurrent dev servers.
- **Max 2 active worktrees.** Port assignments: main=5173, worktree-1=5174, worktree-2=5175.
- **Same-session cleanup.** Every worktree created in a session must be cleaned up in that session (or explicitly flagged for next session in MEMORY.md).
- **Never leave orphan branches.** After merging a PR, delete the local branch and worktree immediately.
- **Pre-commit timeout.** Always use `timeout: 600000` for git commit (pre-commit hooks run lint + test + E2E, ~2-3 min).
- **Port conflicts.** Before starting a dev server or running E2E tests, check ports 5173-5175 and kill stale processes.

## Design system mirror

A separate Claude project mirrors this repo's design language (tokens, typography, brand assets, UI kit). It is a **point-in-time copy**, not a live link, so it needs a manual refresh when design files change.

The `design-system-drift` GitHub Action comments on PRs that touch the watched files; its `paths:` filter in [`.github/workflows/design-system-drift.yml`](.github/workflows/design-system-drift.yml) is the authoritative trigger list. Refresh procedure and the file inventory: [`docs/DESIGN_SYSTEM_MIRROR.md`](docs/DESIGN_SYSTEM_MIRROR.md).

