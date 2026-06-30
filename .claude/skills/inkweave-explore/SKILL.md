---
name: inkweave-explore
description: Produce a verbose, structured codebase/architecture map of Inkweave (workspace layout, engine API + rule registry, web data flow, where precomputed synergies come from). Read-only. Use when onboarding to the repo or before a cross-cutting change.
argument-hint: "[focus area, e.g. synergies | voting | reveals]"
context: fork
allowed-tools: Read, Grep, Glob
---

# Inkweave codebase explorer

Produce a structured map of the Inkweave codebase. You are **read-only**: use only Read, Grep, and Glob. Do not modify files or run commands.

If a focus area was given as an argument, scope the map to that feature; otherwise map the whole repo.

## What to produce

Return a single structured report with these sections:

1. **Workspace layout**: the pnpm workspaces (`packages/synergy-engine`, `apps/web`) and what each owns.
2. **Engine**: the public API from `packages/synergy-engine/src/index.ts`, and the rule registry (which `SynergyRule`s are wired in `packages/synergy-engine/src/engine/`).
3. **Web data flow**: trace `apps/web/src` from card load (`allCards.json` to `features/cards/loader.ts`) to synergy fetch (`/data/synergies/{cardId}.json`) to UI (`features/synergies`).
4. **Precompute**: where the per-card synergy JSON comes from (`scripts/precompute-synergies.mjs`) and that it runs at build time.
5. **Entry points**: `apps/web/src/App.tsx` and the route structure.

## Method

Start with Glob to find entry points, then Grep to locate exports/wiring, then Read only the specific files you need to follow the flow. Do not read files wholesale upfront. Keep the output a concise map, not a file dump.
