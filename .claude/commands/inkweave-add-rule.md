---
description: Guided workflow for designing and adding a new synergy rule
---

# Add Synergy Rule

A guided, collaborative workflow for adding a new synergy rule to the engine.
This is NOT fully automated — rule design requires discussion and iteration.

## Phase 1: Discovery

1. **ASK the user**: "What game mechanic or interaction does this rule detect?"
   - WAIT for their response before proceeding.

2. **Research the mechanic** in the card data:
   - Search `allCards.json` for cards matching the described concept (text patterns, keywords, abilities)
   - Show 5-10 example cards that would be relevant, with their key properties (name, ink, cost, text snippet)
   - Highlight any edge cases found (e.g., cards that partially match, conditional effects, dual-ink complications)

3. **ASK the user**: "Do these look right? Any cards that should/shouldn't match?"
   - WAIT for confirmation or adjustments.

4. **Check for overlap** with existing rules:
   - Read `packages/synergy-engine/src/engine/rules.ts` to review current rules
   - Read `packages/synergy-engine/REMOVED_RULES.md` to check if this was previously tried and removed
   - If overlap exists, flag it: "This overlaps with [rule]. Should we extend it or create a separate rule?"

## Phase 2: Design

5. **Propose the rule structure**:
   - Category: `direct` (pair-specific) or `playstyle` (density-based)?
   - If playstyle: does it need a new playstyle, or does it fit an existing one?
   - Detection: what text patterns, keywords, or card properties identify matching cards?
   - Scoring: what factors should influence the 1-10 score?
   - Explanation template: what should users see when this synergy is displayed?

6. **ASK the user** to review and iterate on the design:
   - "Here's my proposed scoring breakdown. What would you change?"
   - WAIT for feedback. Iterate until the user approves.

7. **Show impact estimate**:
   - Count how many cards would match the rule
   - Estimate how many new synergy pairs it would create
   - Flag if this would significantly increase total synergy data size

## Phase 3: Implementation

8. **Only proceed when the user says the design is approved.**

9. **Implement the rule**:
   - Add the rule function in `packages/synergy-engine/src/engine/rules.ts`
   - Register it in the `DEFAULT_RULES` array
   - If playstyle: update types, playstyle registry, and UI config as needed
   - Add any new helper functions to `packages/synergy-engine/src/utils/cardHelpers.ts`

10. **Immediately rebuild the engine** (per CLAUDE.md workflow):
    ```
    pnpm build:engine
    ```

11. **Add unit tests** in `packages/synergy-engine/src/__tests__/`:
    - Test matching logic with real card examples from Phase 1
    - Test scoring at different tiers
    - Test edge cases identified during discovery
    - Test that non-matching cards are excluded

12. **Run tests**:
    ```
    pnpm test:engine
    ```

## Phase 4: Validate

13. **Regenerate synergy data**:
    ```
    pnpm precompute-synergies
    ```

14. **Spot-check output**:
    - Pick 3-5 cards discussed in Phase 1
    - Read their synergy JSON files and verify the new rule appears with expected scores
    - Flag any unexpected results

15. **Update documentation**:
    - Update the **Synergy Rules** section in `CLAUDE.md` with the new rule's description, scoring, and examples
    - Update `REMOVED_RULES.md` if this replaces or supersedes a previously removed rule

16. **Report summary**:
    - New rule name and category
    - Cards matched / synergy pairs created
    - Test results
    - Any open questions or follow-up items
