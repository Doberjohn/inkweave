---
name: mine-rules
description: Mine the card database for the top uncovered mechanic and open one rule-candidate issue. Runs the deterministic miner, dedups against existing rules and open candidates (flagging previously-removed mechanics rather than skipping them), drafts a proposal, and publishes.
argument-hint: "[dry-run]"
allowed-tools: Read, Write, Grep, Glob, Bash(pnpm:*), Bash(node:*), Bash(gh:*)
---

# Mine Rule Candidates

Autonomous backlog feeder for the synergy engine. Each run surfaces the single
highest-value uncovered mechanic and opens one `rule-candidate` GitHub issue with a
drafted proposal. Designed to run unattended (weekly, headless) AND on demand.

If `$ARGUMENTS` contains `dry-run`, perform every step EXCEPT creating the issue:
print the drafted proposal to stdout instead. Use this to smoke-test the pipeline.

This skill is READ-ONLY plus issue-creation. It must never edit engine source, commit,
or push. The only write to the repo is the throwaway issue-body tempfile, deleted at the
end.

## Step 1: Run the miner

```bash
pnpm mine-rules
```

This builds the engine and writes ranked `reports/rule-candidates.json` (array of
`{ phrase, cardCount, inkSpread, sampleCards: [{id, name}], score }`, score DESC).

Read the report. If it is empty, log "No candidate clusters found" and STOP.

## Step 2: Gather dedup context

Fetch what has already been proposed, shipped, or rejected, so the same mechanic is
never raised twice:

```bash
gh issue list --label rule-candidate --state all --json number,title,state --limit 100
```

Also read, to understand coverage and history:
- `packages/synergy-engine/REMOVED_RULES.md` — mechanics previously removed and why; used to FLAG (not skip) a removed mechanic if it resurfaces, so the proposal carries that history (see Steps 3 and 5)
- `packages/synergy-engine/src/engine/rules.ts` — the `synergyRules` registry (what already exists)
- The **Synergy Rules** section of `CLAUDE.md` — human-readable summary of current rules

## Step 3: Select the top candidate

Walk `rule-candidates.json` from the top (highest score) and pick the FIRST candidate
worth proposing:
- NOT already covered by an existing rule in `rules.ts` / CLAUDE.md
- NOT already represented by an open `rule-candidate` issue (compare mechanic, not exact phrase wording)
- Passes the Step 4 coherence check (a real two-sided interaction, not a coincidental shared phrase)

**Previously-removed mechanics ARE eligible — do NOT skip them.** The card pool grows
over time, so a mechanic removed when it was small may now be the largest gap (e.g. card
draw is currently the single biggest uncovered cluster). If the chosen candidate's
mechanic appears in `REMOVED_RULES.md`, keep it, and capture the stated removal reason to
surface in the proposal (Step 5) — the reviewer should weigh re-introduction against why
it was dropped, not be blind to either side.

If every candidate is already covered or open, log "No novel candidate this run" and STOP
without creating an issue. (Expected idempotent outcome on a re-run with no new cards.)

## Step 4: Research the chosen candidate

The report's `sampleCards` already gives `{id, name}` for each match. To read full
text, look those ids up in `apps/web/public/data/allCards.json` — note raw card `id`
is numeric there, so coerce (`String(card.id)`) when matching against the report's
string ids. Read each card's `fullText`, `cost`, `color`, and `type`, and confirm the
cluster really is one coherent mechanic (the phrase is a heuristic; verify the cards
actually share an interaction).

## Step 5: Draft the proposal

Draft a proposal that mirrors how rules are documented in `CLAUDE.md` and follows the
5-baseline convention in `packages/synergy-engine/SCORING_DESIGN.md`. Include:

- **Mechanic** — one-sentence description of the interaction
- **Previously removed (only if in `REMOVED_RULES.md`)** — state this prominently near the top, quote the removal reason, and note what has changed since (e.g. card count now vs. then) so the reviewer can weigh re-introduction against the original reason for dropping it
- **Category** — `direct` (pair-specific) or `playstyle` (density-based); if playstyle, new or fits an existing one?
- **Roles** — the role taxonomy (e.g., enabler / payoff), if applicable
- **Score matrix** — pair scores anchored at 5 (same-axis density baseline); every score above 5 justified in one sentence per the audit rule
- **Explanation template(s)** — the UI string(s) the rule would emit
- **Overlap check** — how this differs from the nearest existing rule
- **Evidence** — from the miner: phrase, card count, ink spread, and the sampled cards (name + relevant text snippet)
- **Next step** — note that implementation runs through `/implement-issue` then `/inkweave-add-rule`

## Step 6: Publish (or print, if dry-run)

If `dry-run`: print the full drafted body and STOP. Do not create an issue.

Otherwise write the body to a tempfile and create exactly one issue. The
`SKILL_APPROVED=1` prefix is required to pass the `issue-create-guard` hook and MUST be
the literal start of the command:

```bash
SKILL_APPROVED=1 gh issue create \
  --title "<mechanic> rule candidate (<N> cards, <M> inks)" \  # append " [previously removed]" if applicable
  --label rule-candidate --label engine \
  --body-file <tempfile>
```

Then delete the tempfile and report the created issue URL.

## Step 7: Report

Print a one-line summary: chosen mechanic, card count, ink spread, and the issue URL
(or "[dry-run] not published" / "no novel candidate").
