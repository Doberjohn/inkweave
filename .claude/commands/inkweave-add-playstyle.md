---
description: Guided workflow for designing and adding a new playstyle archetype
---

# Add Playstyle Archetype

A guided, collaborative workflow for adding a new playstyle to Inkweave.
Playstyles are broader than individual rules — they define a gameplay strategy
and group multiple synergy rules under one identity.

## Phase 1: Discovery

1. **ASK the user**: "Which playstyle are you adding? What's the core gameplay strategy?"
   - Check `COMING_SOON_PLAYSTYLES` in `apps/web/src/shared/constants/playstyleUi.ts` — it may already be planned there with a name, description, and accent color.
   - WAIT for their response.

2. **Research the strategy** in the card data:
   - Search `allCards.json` for cards that fit the described strategy
   - Group findings by role (e.g., "enablers", "payoffs", "support")
   - Show 10-15 example cards organized by role, with key properties
   - Note how many total cards would belong to this playstyle

3. **Check for overlap**:
   - Read existing playstyles in `packages/synergy-engine/src/engine/playstyles.ts`
   - Read existing rules in `packages/synergy-engine/src/engine/rules.ts`
   - Flag any cards that already belong to another playstyle
   - ASK: "These cards overlap with [playstyle]. Is that intentional?"

4. **ASK the user** to confirm the card pool and role breakdown:
   - "Here are the cards I found, grouped by role. Does this look right?"
   - WAIT for confirmation or adjustments.

## Phase 2: Design

5. **Propose the playstyle definition**:
   - `id`: kebab-case slug (e.g., `'discard'`, `'bounce'`)
   - `name`: Display name for the UI (e.g., `'Discard Control'`)
   - `description`: 1-2 sentence strategy summary
   - Accent color and cover art path

6. **Propose the rules** this playstyle needs:
   - What distinct synergy rules will detect cards in this playstyle?
   - Each rule needs: detection pattern, scoring criteria, explanation template
   - Consider: do cards within this playstyle synergize with each other (cross-synergy)?
   - Show the proposed rule breakdown with estimated card counts per rule

7. **ASK the user** to review the full design:
   - "Here's the complete playstyle spec. What would you change?"
   - WAIT for feedback. Iterate until approved.

## Phase 3: Implementation

8. **Only proceed when the user says the design is approved.**

9. **Update the engine types** — add the new ID to the `PlaystyleId` union:
   - File: `packages/synergy-engine/src/types/playstyle.ts`
   - Add to: `export type PlaystyleId = '...' | '<new-id>';`

10. **Register the playstyle** in the engine:
    - File: `packages/synergy-engine/src/engine/playstyles.ts`
    - Add entry to the `playstyles` array with id, name, description

11. **Add the synergy rules**:
    - File: `packages/synergy-engine/src/engine/rules.ts`
    - Add rule functions with `category: 'playstyle'` and `playstyleId: '<new-id>'`
    - Add helper functions to `packages/synergy-engine/src/utils/cardHelpers.ts` if needed
    - Register rules in `DEFAULT_RULES`

12. **Immediately rebuild the engine**:
    ```
    pnpm build:engine
    ```

13. **Add the UI configuration**:
    - File: `apps/web/src/shared/constants/playstyleUi.ts`
    - Add entry to `PLAYSTYLE_UI` record with accent color and cover art path
    - If this was in `COMING_SOON_PLAYSTYLES`, remove it from there

14. **Add unit tests** in `packages/synergy-engine/src/__tests__/`:
    - Test each rule's matching logic with real card examples
    - Test scoring at different tiers
    - Test `getPlaystyleCards()` returns expected cards for the new playstyle

15. **Run tests**:
    ```
    pnpm test:engine
    ```

## Phase 4: Validate

16. **Regenerate synergy data**:
    ```
    pnpm precompute-synergies
    ```

17. **Validate the output**:
    - Read `_playstyles.json` and verify the new playstyle has the expected card count
    - Spot-check 3-5 specific cards and verify their synergy JSON includes the new rules
    - Compare total synergy counts before vs after

18. **Update documentation**:
    - Update the **Synergy Rules** section in `CLAUDE.md`
    - Update the **Archetypes** list in `CLAUDE.md` if this is an MVP archetype
    - Update `PlaystyleId` comment in CLAUDE.md if documented there

19. **Report summary**:
    - New playstyle: name, id, accent color
    - Rules added (count and names)
    - Cards matched (total and per-rule)
    - Test results
    - Files modified (checklist)
    - Cover art status (exists / needs creation)
