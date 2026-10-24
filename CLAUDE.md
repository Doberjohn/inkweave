# Inkweave

Lorcana synergy finder for Core format with archetype-based synergy detection.

## MVP Status

- **Scope**: Core format only (sets 9+), community voting, deck builder
- **UI**: Dark fantasy theme (deep purple, gold accents)
- **Synergies**: 7 direct rules + 25 playstyles, indexed in the [Synergy Rules registry](#synergy-rules)

See [GitHub Issues](https://github.com/Doberjohn/inkweave/issues) for full backlog.

## Tech Stack

- pnpm workspaces monorepo
- React 19 + TypeScript 6
- Vite bundler
- Radix UI Primitives (headless behavior) + inline CSS with design tokens
- Static JSON card database

## Environment

- **OS**: Windows 11. **Shell**: Windows PowerShell 5.1 (`powershell.exe`). **pwsh 7 is not installed** - never assume it. Git Bash is available for POSIX scripts; each takes its own syntax.
- PowerShell 5.1 has no `&&`/`||` chain operators, no ternary, no null-coalescing. Use `A; if ($?) { B }`.
- Windows long paths are enabled, but git's own delete still fails on pnpm's deep `node_modules`: `git worktree remove` unregisters the worktree, then stops at the first long path and leaves a half-deleted folder. Remove worktrees with `pnpm worktree:remove` (see **Worktree & Agent Workflow**).
- Node 24, pnpm 10 workspaces (10.34.7, pinned in `package.json`). pnpm runs no dependency install scripts: an install that meets a new one fails (`strictDepBuilds`) until `pnpm-workspace.yaml` lists it under `allowBuilds`, `true` to run it or `false` to skip it. `claude` must be on PATH for the scheduled rule-candidate miner.

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
            ├── features/     # cards, synergies, playstyles, voting, reveals
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
- Card ink filters (`matchesInk` in `features/cards/loader.ts`, owner 2026-10-08): one ink selected shows every card carrying it, dual-ink ones included; two or more act as a deck's colors, so a dual-ink card (e.g. "Amethyst-Sapphire") shows only when both its inks are selected. "Dual-ink cards" (one ink or a pair, `offersDualOnly`) narrows that result to its dual-ink cards. A card page's synergy results (`filterSynergyCards`) reuse the same `matchesInk`/`matchesInkwell`

**Card Types**: Character, Action, Item, Location

**Game Mode**: Core only (sets 9+, per `MIN_CORE_SET` in `packages/synergy-engine/src/constants.ts`) - Infinity mode removed for MVP

**Synergy Categories**: direct (pair-specific, e.g. Shift), playstyle (strategy-reinforcing, e.g. Lore Denial)

**Playstyles**: 25 implemented, listed with their `PlaystyleId` and spec doc in the [Synergy Rules registry](#synergy-rules) below. The canonical union is `PlaystyleId` in `packages/synergy-engine/src/types/playstyle.ts`.

**Synergy Score**: 1-10 numeric scale (all integers valid). Display tiers: Perfect (>=9.5), Strong (7-9.4), Moderate (4-6.9), Weak (<4)

## Automation

Claude Code hooks, skills, agents, and path-scoped rules enforce workflow rules automatically. Check these before adding redundant instructions to CLAUDE.md.

### Hooks (`.claude/hooks/`)
| Hook | Event | What it does |
|------|-------|-------------|
| `git-write-protection.sh` | PreToolUse/Bash\|PowerShell\|Monitor | Soft-blocks commit/push (`USER_APPROVED=1` bypass, Bash only: PowerShell and Monitor can't carry it, so there they always block), hard-blocks destructive ops and piped commit/push, plus the worktree remover (`pnpm worktree:remove`, `scripts/remove-worktree.mjs`, dry runs included). Parses the command (`lib/shell-command.mjs`), so git options, cd chains and nested shells don't slip past; case table in `__tests__/hooks.test.mjs` |
| `branch-verification.sh` | PreToolUse/Edit\|Write | Blocks source file edits on master/main |
| `engine-auto-rebuild.sh` | PostToolUse/Edit\|Write | Auto `pnpm build:engine` + `pnpm precompute-synergies` after engine file edits, then `scripts/refresh-rule-coverage.mjs`, which regenerates the coverage blocks in every `*_RULE.md` (#479; writes a doc only when a generated block changed). On `master`, `.github/workflows/refresh-rule-coverage.yml` reruns the refresh after every push that changes card data or engine source, and commits the docs that moved (#781) |
| `preview-images-auto-convert.sh` | PostToolUse/Edit\|Write | Auto `pnpm convert-preview-images` after writes inside `apps/web/public/card-images-raw/` (raw → AVIF pipeline) |
| `preview-data-auto-precompute.sh` | PostToolUse/Edit\|Write | Auto `pnpm precompute-synergies` after `apps/web/public/data/previewCards.json` writes (engine hook already covers engine-src changes) |
| `issue-create-guard.sh` | PreToolUse/Bash\|PowerShell\|Monitor | Redirects direct `gh issue create` to `/draft-issue` skill (`SKILL_APPROVED=1` bypass, Bash only) |
| `agent-tool-substitution-guard.sh` | PostToolUse/Agent | Halts when a subagent reports a missing tool, so the fix lands in that agent's `tools:` frontmatter instead of the main session silently substituting |
| Husky pre-push | git push | Runs `typecheck` (`tsc -b`), `check:stories` (story coverage), `check:design` (design-token value gate, #508), E2E, then the CodeScene gate. E2E starts its own Vite (by default on a free port in 5200-5299), never reuses a running server, and warms it up before the first test (`e2e/global-setup.ts`, #664); local Windows runs use 3 workers (set in `playwright.config.ts`; `PRE_PUSH_E2E_WORKERS` overrides). **On Windows only chromium runs** (webkit + mobile-chrome workers hang past Playwright's stop timeout), after logging free commit memory; set `PRE_PUSH_FULL=1` to force webkit + mobile-chrome. Elsewhere: chromium + webkit + mobile-chrome. Full 5-browser matrix in CI. Worktree commits and pushes enter through the main checkout's `.husky` (`core.hooksPath`); once the main checkout's branch has `.husky/handoff.sh`, it runs the worktree's own `pre-commit`/`pre-push` (skip with `INKWEAVE_HOOK_HANDOFF=1`, written after `USER_APPROVED=1` in a Claude session) |

### Skills (`.claude/skills/`)
| Skill | Arg | What it does |
|-------|-----|-------------|
| `/draft-issue [title hint]` | optional title hint | Extract scope from conversation → clarifying questions if gaps → 8-section rubric draft → score → publish on approval |
| `/implement-issue <num>` | issue number | Session hygiene → fetch issue → create branch → summary |
| `/commit-and-push "msg"` | commit message | PR readiness → review → commit → push → PR → CI |
| `/close-session [summary]` | work summary | Cleanup (servers/worktrees/branches + `node scripts/clean-transient.mjs`, which deletes guarded throwaway files unasked, lists its `ask` rows and skips protected paths) → docs update → MEMORY.md → summary |
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
| `migrations.md` | `supabase/migrations/**` | Supabase MCP migration workflow; every migration that creates or recreates a table or view declares its privileges (#706) |
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

### PR reviews

`.github/workflows/claude-review.yml` (#952) has Claude Code review a pull request when it opens ready for review and when a draft is marked ready, never on a push: the bundled `/code-review` skill, at `high` effort on Opus, posts its findings as inline comments from `github-actions[bot]`, or one comment saying it posted none, and each run's summary page shows its cost. A top-level comment starting `@claude review` on an open PR, from someone with write access, asks for another pass. Drafts and Dependabot's PRs get no automatic review, and forks get none at all. The job's token only reads code and writes PR comments, and the run turns off `.claude/settings.json`'s hooks and `.mcp.json`'s server. Claude's shell commands run in a sandbox that holds neither the API key nor the token, so the review reads the diff with git, never `gh`. It bills the `ANTHROPIC_API_KEY` Actions secret, a Claude Console key in a workspace that caps the monthly spend. A failed review run is advisory: nothing waits on it.

## Synergy Rules

Rules live in `packages/synergy-engine/src/engine/rules.ts` and run at build time only; the web app consumes pre-computed JSON.

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
| Ink Drops | `ink-drops` | [INK_DROPS_RULE.md](packages/synergy-engine/INK_DROPS_RULE.md) |
| Classification Tribes | `monster` `princess` `hero` `super` `royalty` `detective` `gargoyle` `madrigal` `villain` | [TRIBES_RULE.md](packages/synergy-engine/TRIBES_RULE.md) |

Royalty is Queen/King/Prince and deliberately excludes Princess. All nine tribes come from one shared payoff-anchored factory.

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
- **Browse's search over sets 1-8** (#911): while a query is on, Browse's grid also lists the sets 1-8 cards whose full name no Core card has, one per name, loaded on the visit's first search through `features/collection/collectionChunks.ts`, whose loads collection mode shares (sets 1-8 and the promos, then sets 9-14 for the binder alone). They open in the card window with the Outside Core note, have no card page, and never enter `CardDataContext`
- Card data pre-deduplicated in `allCards.json` (same card in multiple sets appears once); loader expects clean data
- Multi-page SPA via react-router (home, browse, card detail, playstyles, deck builder, voting). Routes in `router.tsx`; `AppLayout` mounts the providers plus `<Outlet />`
- **Prerendered pages** (#915): Deploy's crawl (`scripts/prerender.mjs`) captures each route on a desktop and on a 390x844 phone, and marks each capture's `#root` with its route (`data-prerender-route`). The phone capture ships right after `#root` in an inert `<template id="prerender-phone">`, and the images only the desktop capture shows are lazy, each with a desktop-only preload, so a phone's preload scanner never fetches them. `index.html` keeps a marked root hidden (on a phone, not laid out at all) until its inline script, right after the template, approves it on that route, first swapping the phone capture in below 768 px (both screens' media queries live in `scripts/lib/captureMedia.mjs`, which `index.html` repeats), and empties it on any other, since `vercel.json` serves the home page's capture to every route without a page of its own; `main.tsx` removes the mark before React renders. Deploy's checks 9 and 10 (`scripts/check-rendered-html.mjs`) fail a capture without its own mark or phone capture, and Performance Gates' Prerender Handoff job loads a sample crawl in Chromium, served as Vercel serves it (`scripts/serve-dist.mjs`, which also serves a build by hand), and fails a page that paints on another route or in the other screen's layout, or fetches the other capture's images (`scripts/check-prerender-handoff.mjs`). Setting the repository variable `PRERENDER_PHONE` to `0` drops the phone captures and check 10 from the next deploy. `main.tsx` then holds an approved page until the app can render the same page in one commit: until its route's `handle.ready` (`router.tsx`, `shared/lib/routeReadiness.ts`) has its code and data, or has failed to get them, the visitor's first click or key press (a click that follows a link to another page stays the link's), or `HOLD_CAP_MS` from navigation start (`shared/lib/prerenderHold.ts`; `0` turns the hold off). Every prerendered route has one. `/vote`'s waits for the visit's own first pair (`startFirstPair` in `features/voting/hooks/usePairQueue.ts`, imported with the page through `pages/votePageChunk.ts`), and the page's first render starts from it; the crawl draws no pair (`window.__INKWEAVE_PRERENDER__`), so its capture shows the page loading. The data hooks start from what has loaded, and `renderOverPrerenderedPage` (`shared/lib/prerenderedArt.ts`) renders the app inside a view transition it skips once the app's copies of the page's on-screen images decode, since Chromium gives a new `<img>` its image a task late, even one already on screen. The handoff job's checks 8 to 10 hold each page's data back and fail a frame with a loading state, an empty root or a missing image, a missed cap, or a press that waits
- **Release notes** (#765): `/release-notes` shows one JSON file per week, `apps/web/src/features/release-notes/notes/<YYYY-MM-DD>.json`, named for the Monday the week starts (UTC), read at build time with `import.meta.glob`, newest first. The project's Weekly changelog draft routine writes each week's file and publishes it with a PR that adds it. `notes.test.ts` fails on a file that breaks the format (rules in `validateNotes.ts`, matching the routine's own validator). The notes ship inside the page's chunk, which grew about 1.2 kB gzipped a week through Set 14's reveal season, so it has its own size-limit budget ("Release notes page", 30 kB), outside "User-facing JS"
- **Admin tools live in `Doberjohn/inkweave-admin`** (#593), deployed behind Vercel login at inkweave-admin.vercel.app: Card studio (New reveal and Edit card), the tuning editor, analytics and the `/fetch-reveals` skill. They write here only through the GitHub API (Card studio and the tuning editor commit to `master`; `/fetch-reveals` and admin's variant-printings script open PRs from `reveals/…` branches). Admin builds against a pinned submodule of this repo and re-exports what it uses from `src/app-bridge.ts` there: `shared/constants`, `shared/hooks`, `shared/components/{CardTranslationPanel,CtaButton,DialogShell,InkIcon,InkwellIcon,LinkButton}`, `shared/contexts/CardDataContext`, `features/cards/{components/CardTile,loader}`, `features/reveals/{RaritySymbol,rarity}`, `features/collection/{collectionParser,collectionPromos,printingFinishes}`, `features/synergies/{hooks/usePrecomputedSynergies,utils/scoreUtils}`, `src/index.css` and `public/data/previewCards.json`, and from the repo's root `scripts/lib/{promo-printings,fold-variants,finishes}.mjs`, whose promo merge Card studio runs when it adds or edits a promo printing (Doberjohn/inkweave-admin#77). Its ESLint config also loads `eslint-rules/`, and `/fetch-reveals` runs a copy of `scripts/convert-preview-images.mjs`. Renaming or removing any of these breaks admin's next pin bump, whose CI is the contract test. Admin's deploy also builds analytics from this repo's `master` with `scripts/precompute-synergies.mjs` and the engine, and `convert-reveal-images.yml` converts the raw scans Card studio commits
- Core format only (sets 9+)
- **useContainerWidth**: ResizeObserver hook guards against 0-width observations from detached elements (`if (w > 0)`) — required for React Strict Mode double-mount resilience
- **Source-map leak guard** (#358): `scripts/check-sourcemaps.mjs` fails the build if any `.map` in a dir inlines original code via non-empty `sourcesContent`; `SKIP_SOURCEMAP_GUARD=1` bypasses. Wired ONLY into `vercel.json`'s `buildCommand` (the deploy boundary), plus `apps/web/vite.config.ts` sets `workbox.sourcemap:false` so VitePWA stops emitting `sw.js.map`. **Do NOT add the guard to CI or a `postbuild` hook** — CI/local builds run without `SENTRY_AUTH_TOKEN` (the Sentry plugin only uploads+deletes app maps where the token exists, i.e. the Vercel build), so they legitimately produce content-bearing maps that never deploy; gating those paths would false-fail safe artifacts and break forked PRs.
- **Retired hosts** (#634): `www.inkweave.ink` serves Production so `vercel.json`'s host redirect can 308 every path except `/sw.js` to the apex, and `middleware.ts` answers `/sw.js` with a self-unregistering worker that heals www-era service workers. Never put a dashboard-level redirect back on `www` (it blocks `/sw.js` again), and never Instant Rollback to a pre-#634 deployment while `www` serves Production: switch it to Redirect first. `lorcana-synergy-finder.vercel.app` keeps its dashboard redirect on purpose: Standard Deployment Protection puts any `*.vercel.app` Production domain behind a 302 to `vercel.com/sso-api`, `/sw.js` included, so flipping it would wall off visitors and heal nothing. Its code paths stay dormant.
- **Deploy drift alarm** (#569): `build:vercel` first stamps `/version.json` with the build's commit (`scripts/write-version.mjs`, which never fails the build). `.github/workflows/deploy-drift.yml` opens one `deploy-drift` issue, assigned to the owner, when production stops serving master: at once when a **master** Deploy run fails (a PR's `deploy.yml` dry run never triggers it, #694), otherwise at the daily 06:17 UTC check after a 3-hour grace that starts at the oldest undeployed master commit (`[skip ci]` commits don't count). The daily check closes it once production catches up. `/version.json` is served `no-store`; keep it out of every cache.
- **Staging** (#741): `staging.inkweave.ink` serves master built with the Vercel **Preview** environment's values, so a `VITE_*` flag can be tried there before production. `.github/workflows/deploy-staging.yml` ("Deploy Staging", never "Deploy", which the drift alarm watches) runs on every master push: a preview build, SPA-only (`SKIP_PRERENDER=1`), then `scripts/vercel-deploy.mjs staging` aliases the domain to it. The domain sits on Preview branch `staging`, which exists only because Vercel requires one; `vercel.json` never lets Vercel build it, so only that workflow moves the domain. `vercel.json` sends `X-Robots-Tag: noindex` on that host only. It uses the production Supabase project, so its sign-ups and votes are real. Flags are baked in at build time: turn one on by setting its Preview value and re-running the newest Deploy Staging run on master; ship it by setting its Production value and re-running the newest Deploy run on master (a PR's Deploy dry run never promotes). Preview values also reach every PR preview. Staging's build alone sets `INKWEAVE_ICON_SET=staging`, so its tab and installed app show the Emerald and Ruby drop from `public/brand/staging/` instead of the gold one (#905).
- **Supabase**: Community voting backend (project: `ttyidjyaxnycbpxwngqr`, eu-central-1). Client SDK in `apps/web/src/shared/lib/supabase.ts`; migrations in `supabase/migrations/`. The MCP-driven migration workflow (apply, verify, regenerate types, advisors) lives in [`.claude/rules/migrations.md`](.claude/rules/migrations.md), auto-loaded when editing `supabase/migrations/**`. Supabase stops auto-granting new tables on 2026-10-30 (#706), so design every new table or view with its own grants: the rule file has the pattern and the traps.
- **Card images**: production is content-addressed and self-hosted (`{id}.{sha256prefix}.avif`); dev falls back to proxies. All URLs route through `resolveImageUrl` / `smallImageUrl` in `apps/web/src/features/cards/loader.ts`. Pipeline, dev proxy rules, SW caching, and the debugging playbook: [`apps/web/src/features/cards/IMAGES.md`](apps/web/src/features/cards/IMAGES.md).
  - **Never put `immutable` on a URL that is not content-addressed.** Issue #323 was a year-long cache-poisoning bug from exactly that. Content addressing is what makes `max-age=31536000, immutable` truthful.

## UI Theme (MVP)

Dark fantasy theme inspired by Lorcana:
- Background: #0d0d14 (near black)
- Surface: #1a1a2e (dark purple); elevation = LIGHTNESS (surfaceRaised/Floating/Overlay), shadows are secondary cues
- Primary: #ffb900 (THE brand gold — glows/rings via `hexRgba`/`SHADOWS`); #d4af37 (`primary500`) is the legacy accent, grandfathered only
- Text: #e8e8e8 (off-white)
- Glowing borders on hover; token source of truth is `apps/web/src/shared/constants/theme.ts` (2026-07-22 rulings: milestone #4)

## Workflow Preferences

### Git Workflow
- **Git safety enforced by hooks**: the `git-write-protection` hook blocks commit, push, and destructive ops (checkout --, restore, reset --hard, clean -f, worktree remove/prune, and the worktree remover `pnpm worktree:remove`). Commit/push use `USER_APPROVED=1` prefix after explicit user approval. Destructive ops are hard-blocked: the owner runs them. Commit and push go through the Bash tool (in PowerShell or Monitor the hook always blocks them), and piping either one (`| tail`) is always blocked.
- **Branch verification enforced by hook** — `branch-verification` hook blocks source file edits on master/main.
- Feature branches: `feature/<issue-number>-<description>` (e.g., `feature/5-deck-builder-tests`)
- Commit messages: Use semantic commit notation with issue reference (e.g., `test(deck): add tests (#5)`)
- PRs should include `Closes #<issue>` to auto-close issues on merge
- **Issues**: When creating issues, always add appropriate labels. When listing issues, check for unlabeled ones proactively. When adding/removing an issue from MVP, always update BOTH the `mvp` label AND the `MVP v1.0` milestone together.
- **Drafting issues**: The moment scope is agreed for a new GitHub issue, invoke `/draft-issue` — do not draft issue markdown in a message. The skill scores against an 8-section rubric and publishes on approval. Publishing bypass: `SKILL_APPROVED=1 gh issue create ...`.

### Pre-Commit & Pre-Push (automated)
- **Pre-commit hook** runs lint + tests on every `git commit`. Do not skip.
- **Local Windows Vitest runs use 4 workers** (`resolveVitestWorkers` in `apps/web/vite.config.ts`, #720): on a cold disk cache, Vitest's default first wave misses its hardcoded 60 s worker-start limit and those files never run. CI keeps Vitest's default; `VITEST_MAX_WORKERS` overrides the cap.
- **Pre-push hook** (husky) runs E2E chromium on every `git push`. Do not skip.
- Full 5-browser E2E suite runs in CI as safety net: chromium and mobile-chrome on the dev server, firefox, webkit and mobile-safari on a production build (`E2E_SERVER=preview`, #869; reproduce one with `E2E_SERVER=preview pnpm test:e2e --project=<name>` in Bash, or the PowerShell form in `apps/web/e2e/E2E_TESTS.md`). The pre-push hook always runs the dev server.
- Script suites (`pnpm test:scripts`) also run on Windows in CI (`script-tests-windows.yml`) when `scripts/`, `.claude/hooks/`, the root `package.json` or the lockfile change, so the worktree remover's Windows-only tests run.
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
- **E2E always starts its own Vite.** Locally it never reuses a running server (`reuseExistingServer: false`), so a dev server started without a flag can no longer stand in for it. That Vite loads `.env.local` at boot like `pnpm dev` does, except for the eleven values `playwright.config.ts`'s `webServer.env` pins (`VITE_IS_REVEAL_SEASON`, `VITE_SHOW_STRATEGY_TIPS`, `VITE_SHOW_BETA_NOTICE`, `VITE_SHOW_ACCOUNTS`, `VITE_SHOW_COLLECTION`, `VITE_SHOW_FRIENDS`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and a blank `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` and `SENTRY_AUTH_TOKEN`, so a production-build run never reports to the real projects or uploads its source maps): E2E always uses those, whatever `.env.local` says. The two Supabase pins point at an unreachable placeholder project so the auth control renders; `e2e/fixtures/supabaseStub.ts` answers its requests in the browser, because being configured also switches on the voting paths and their REST calls would otherwise fail at DNS and trip the console-error guard. Any other branch flag goes in `.env.local`, which keeps it the same across `pnpm dev`, `pnpm test:e2e`, and husky pre-push.
- Example: on `feature/285-reveals-page`, `VITE_IS_REVEAL_SEASON=true` must be in `.env.local` or the `/reveals` route redirects to `/` and the nav omits the Reveals entry.

### Synergy Rule Documentation
- Engine source conventions (rule pattern, 5-baseline scoring discipline, doc-sync rule, auto-rebuild) live in [`.claude/rules/engine.md`](.claude/rules/engine.md), auto-loaded when editing `packages/synergy-engine/src/**`.
- Per-rule docs live in `packages/synergy-engine/*_RULE.md` and are **auto-discovered** by `scripts/generate-docs.mjs` (`pnpm run docs`) into the docs-hub "Synergy Rules" category. Adding a new `*_RULE.md` wires it in automatically; only add a `RULE_LABEL_OVERRIDES` entry there if the display label differs from the title-cased filename (e.g. "Singer + Songs"), and a `RULE_ORDER` entry to place it in the reading sequence.
### Code Quality
- After writing or modifying significant code (new features, refactors, bug fixes), run the `code-simplifier` agent to polish for clarity and consistency
- Use `/refactor-code` for periodic comprehensive codebase audits
- When reviewing code or doing a re-review, always re-read the current file contents first — never assume you know what's already been changed. Diff against the actual working tree, not your memory of previous edits.
- When editing theme or config files, re-read the full file after edits to ensure no constants or exports were accidentally removed by the edit tool
- **Dead code**: CI's `pnpm knip` fails on unused files, dependencies and binaries. Something that only looks unused (run from a shell script or `vercel.json`, loaded at run time) goes in `knip.jsonc` with the reason.

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
- **Temporary files go in the session's scratchpad directory**, never `/tmp` or the repo: logs, downloads, probe scripts, dumps. The scratchpad is cleaned automatically; anything left in the repo waits for `/close-session`'s `pnpm clean:transient` tiers (#742), or for the owner.
- **Same-session cleanup.** Every worktree created in a session must be removed in that session (or explicitly flagged for next session in MEMORY.md).
- **Removing a worktree is the owner's job.** From the main checkout, `pnpm worktree:remove <name|path>` deletes the folder, its registry entry, and its branch once `origin/master` contains it. It refuses and changes nothing when the worktree has uncommitted work, a HEAD on no `origin/*` ref, ignored files that are neither build output nor copies of the main checkout's, or a process inside it. `--dry-run` shows the plan; `pnpm worktree:remove --leftovers` sweeps half-deleted folders under `.claude/worktrees/` and finishes interrupted removals. Claude sessions are hook-blocked from running it, so hand the owner the command. To discard a dirty worktree on purpose, run `git worktree remove --force <path>`, then `--leftovers` for what it leaves under `.claude/worktrees/`.
- **Never leave orphan branches.** After merging a PR, delete the local branch and worktree immediately.
- **Pre-commit timeout.** Always use `timeout: 600000` for git commit (pre-commit hooks run lint + test + E2E, ~2-3 min).
- **Port conflicts.** E2E needs no free dev port: by default every local run starts its own Vite on a free port it picks in 5200-5299. `E2E_PORT` pins a specific port instead (1024-65535), which must be free, or the run stops at startup with "already used". Before starting a dev server, check your assigned port. Stop only servers whose command line points into your own checkout; a server from another checkout is another session's live work, so ask the owner first.

## Design system mirror

A separate Claude project mirrors this repo's design language (tokens, typography, brand assets, UI kit). It is a **point-in-time copy**, not a live link, so it needs a manual refresh when design files change.

The `design-system-drift` GitHub Action comments on PRs that touch the watched files; its `paths:` filter in [`.github/workflows/design-system-drift.yml`](.github/workflows/design-system-drift.yml) is the authoritative trigger list. Refresh procedure and the file inventory: [`docs/DESIGN_SYSTEM_MIRROR.md`](docs/DESIGN_SYSTEM_MIRROR.md).

