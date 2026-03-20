---
name: inkweave-add-rule
description: Guided workflow for designing and adding a new synergy rule to the engine
argument-hint: <mechanic-name>
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(pnpm:*), Bash(node:*), Bash(git:*), Bash(gh:*)
---

# Add Synergy Rule

A guided, collaborative workflow for adding a new synergy rule to the engine.
This is NOT fully automated — rule design requires discussion and iteration.

## Phase 1: Discovery

If `$ARGUMENTS` is provided, use it as the mechanic name to research.
If not, ask: "What game mechanic or interaction does this rule detect?"
**WAIT** for the user's response before proceeding.

1. **Research the mechanic** in the card data:
   - Search `allCards.json` for cards matching the described concept (text patterns, keywords, abilities)
   - Show 5-10 example cards with key properties (name, ink, cost, text snippet)
   - Highlight edge cases (partial matches, conditional effects, dual-ink)

2. **Ask**: "Do these look right? Any cards that should/shouldn't match?"
   **WAIT** for confirmation.

3. **Check for overlap** with existing rules:
   - Read `packages/synergy-engine/src/engine/rules.ts`
   - Read `packages/synergy-engine/REMOVED_RULES.md` for previously tried/removed rules
   - If overlap: "This overlaps with [rule]. Extend it or create a new one?"

## Phase 2: Design

4. **Propose the rule structure**:
   - Category: `direct` (pair-specific) or `playstyle` (density-based)?
   - If playstyle: new playstyle or fits existing one?
   - Detection: text patterns, keywords, or card properties
   - Scoring: factors influencing 1-10 score
   - Explanation template for UI display

5. **TODO(human): Review and iterate on the scoring design**
   The scoring breakdown determines how useful synergy results are. Consider:
   - What makes one pair stronger than another?
   - Are there natural tiers (game-winning, strong, moderate, minor)?
   - Should density matter (more matching cards = higher scores)?

6. **Show impact estimate**:
   - Count matching cards
   - Estimate new synergy pairs
   - Flag if it significantly increases data size

## Phase 3: Implementation

7. **Only proceed when the user approves the design.**

8. **Implement the rule**:
   - Add rule function in `packages/synergy-engine/src/engine/rules.ts`
   - Register in `DEFAULT_RULES` array
   - If playstyle: update types, registry, and UI config
   - Add helpers to `packages/synergy-engine/src/utils/cardHelpers.ts` if needed

9. **Engine rebuilds automatically** via PostToolUse hook after editing engine files.

10. **Add unit tests** in `packages/synergy-engine/src/__tests__/`:
    - Real card examples from Phase 1
    - Scoring at different tiers
    - Edge cases from discovery
    - Non-matching cards excluded

11. **Run tests**: `pnpm test:engine`

## Phase 4: Validate

12. **Regenerate synergy data**: `pnpm precompute-synergies`

13. **Spot-check output**:
    - Pick 3-5 cards from Phase 1
    - Read their synergy JSON files
    - Verify new rule appears with expected scores

14. **Update documentation**:
    - Update **Synergy Rules** section in `CLAUDE.md`
    - Update `REMOVED_RULES.md` if replacing a removed rule

15. **Report summary**: rule name, category, cards matched, pairs created, test results
