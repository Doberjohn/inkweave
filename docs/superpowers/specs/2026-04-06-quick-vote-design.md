# Synergy Modal Quick Vote — Design Spec (#212)

**Issue**: [#212](https://github.com/Doberjohn/inkweave/issues/212)
**Epic**: Community Voting (#205)
**Date**: 2026-04-06

## Overview

Add a lightweight three-button voting control to the `SynergyDetailModal`. Users give directional feedback on the algorithm's synergy score — "Should be lower" / "About right" / "Should be higher". After voting, an animated distribution bar reveals how the community voted, creating a social feedback loop.

**Scope**: Modal UI component, new hook, Supabase migration (distribution columns), localStorage persistence for voted pairs.

**Out of scope**: "Rate in Detail" navigation (disabled teaser only — enabled by #213), user authentication, vote editing UI.

## UI Layout

### Placement

Below the tier label ("Strong Synergy"), above the connections list. Wrapped in a subtle gold-bordered container (`rgba(212, 175, 55, 0.04)` background, `rgba(212, 175, 55, 0.12)` border).

### Desktop

Three buttons in a horizontal row. Full labels:
- "Should be lower" → `accuracy: -1`
- "About right" → `accuracy: 0`
- "Should be higher" → `accuracy: 1`

Question text above: "Do you agree with this score?"

Disabled "Rate in detail →" teaser below the buttons.

### Mobile

Three buttons in a vertical stack. Same labels, same wording. Full-width, `min-height: 44px` touch targets. To be validated during implementation.

## State Machine

```
                    ┌──────────────────┐
                    │     Hidden       │ ← Supabase unavailable
                    └──────────────────┘

 Modal opens ──→ localStorage check
                    │
           ┌───────┴────────┐
           │                │
      not found          found
           │                │
           ▼                ▼
    ┌──────────┐    ┌──────────────┐
    │  Ready   │    │   Result     │ ← fetch fresh distribution
    └────┬─────┘    └──────────────┘
         │ click
         ▼
    ┌──────────┐
    │Submitting│
    └────┬─────┘
         │
    ┌────┴────┐
    │         │
  success   error
    │         │
    ▼         ▼
┌────────┐  ┌──────┐
│ Result │  │Error │ → buttons re-enable → Ready
└────────┘  └──────┘
```

### State details

| State | Trigger | UI |
|-------|---------|-----|
| **Hidden** | `getSupabase() === null` | Vote section not rendered |
| **Ready** | Modal opens, pair not in localStorage | Question + 3 buttons + disabled "Rate in detail" |
| **Submitting** | User clicks a vote button | Selected button: scale(1.05) + glow + checkmark. Others: opacity 0.3, disabled |
| **Result** | Vote succeeds OR pair in localStorage | "Thanks! You voted: {choice}" + distribution bar + vote count + disabled "Rate in detail" |
| **Error** | Submission fails | Inline "Something went wrong, try again" — buttons re-enable |
| **Rate Limited** | 30 votes/hour exceeded | Inline "You're voting fast! Try again in a bit." — buttons stay disabled |

## Post-Vote: Distribution Bar

After voting, the three buttons collapse and are replaced by:

1. **Confirmation**: "Thanks! You voted: {choice}" with gold star `✦`
2. **Distribution bar**: Three colored segments showing community vote percentages
   - Lower: `#f59090` (red, 25% opacity background)
   - About right: `#6ee7a0` (green, 20% opacity background)
   - Higher: `#60b5f5` (blue, 20% opacity background)
3. **Vote count**: "{N} votes on this pair"
4. **Disabled "Rate in detail →"** teaser

### First voter

When total votes = 1 (the user is the first), show:
- Confirmation line (same as above)
- Gold badge: "First to rate this pair!" with `✦` pulse animation
- "Distribution will show after more votes"

No minimum vote threshold for showing the distribution bar — it shows at 2+ votes. At exactly 1 vote (the user is the only voter), show the first voter badge instead. On return visits, fetch fresh distribution: if total is now > 1, show the bar; if still 1, show the badge again.

## Animation

### Button press (Ready → Submitting)

- Selected button: `transform: scale(1.05)`, border shifts to distribution color, `box-shadow` glow, checkmark replaces text
- Other buttons: `opacity: 0.3`, `pointer-events: none`
- Duration: `200ms ease-out`

### Result reveal (Submitting → Result)

- Container height animates smoothly (no layout jump)
- "Thanks! You voted:" fades in: `opacity 0→1, 300ms`
- Distribution bar segments grow from `width: 0` to final percentage: `500ms ease-out`, staggered 50ms per segment
- Vote count fades in after bar completes

### First voter badge

Gold star `✦` single pulse: `scale 1→1.15→1`, plays once.

### Returning pair (localStorage hit)

Skip to Result immediately — no animation. Distribution bar renders at full width. Fresh distribution fetched in background, updates silently if numbers changed.

### No toast

Unlike the random pair voting page, quick vote uses inline feedback only. A toast on top of a modal is noisy.

## Data Layer

### Submission

Use existing `submitVote()` from `shared/lib/supabase.ts` with `QuickVote` type:

```typescript
submitVote({ cardA: pair.cardA.id, cardB: pair.cardB.id, accuracy: -1 | 0 | 1 })
```

No changes needed to the `submit_vote` RPC.

### Supabase migration

Add three columns to the `pair_scores` view for per-bucket accuracy breakdown:

```sql
count(*) filter (where accuracy = -1) as accuracy_lower,
count(*) filter (where accuracy = 0)  as accuracy_right,
count(*) filter (where accuracy = 1)  as accuracy_higher
```

### Distribution read

New function in `supabase.ts`:

```typescript
getAccuracyDistribution(cardA: string, cardB: string): Promise<{
  lower: number;
  right: number;
  higher: number;
  total: number;
} | null>
```

Queries `pair_scores` view for the three counts. Returns null if Supabase unavailable or query fails.

### localStorage

- **Key**: `inkweave:vote:{sortedCardA}:{sortedCardB}` (canonical pair ordering matches Supabase)
- **Value**: `{ accuracy: -1 | 0 | 1, timestamp: number }`
- Checked on modal open to determine initial state
- Written after successful submission
- No expiry (until user auth lands)

## New Files

### `apps/web/src/features/voting/hooks/useQuickVote.ts`

Custom hook encapsulating the full quick vote lifecycle:

- Check localStorage for existing vote on mount
- `vote(accuracy)` — submit, store in localStorage, fetch distribution
- Manage state machine (hidden/ready/submitting/result/error)
- Expose: `state`, `vote`, `distribution`, `userChoice`, `error`

Separate from `useVoteSession` (which is specific to the random pair page).

### `apps/web/src/features/voting/components/QuickVoteControl.tsx`

Presentational component rendering the vote UI based on state. Props:

- `state`: current state from hook
- `onVote(accuracy)`: callback
- `distribution`: vote counts (if available)
- `userChoice`: the user's vote (for result display)
- `error`: error type (for message display)

Handles desktop (horizontal) and mobile (vertical) layouts via `useResponsive()`.

### `apps/web/src/features/voting/components/DistributionBar.tsx`

Reusable animated bar component. Props:

- `lower`, `right`, `higher`: vote counts
- `animate`: boolean (true for fresh votes, false for returning pairs)

### `supabase/migrations/YYYYMMDD_add_accuracy_distribution.sql`

Migration adding accuracy_lower/right/higher to pair_scores view.

## Modified Files

- `SynergyDetailModal.tsx` — import and render `QuickVoteControl` between tier label and connections
- `supabase.ts` — add `getAccuracyDistribution()` function
- `database.types.ts` — regenerate after migration (adds new view columns)
- `features/voting/hooks/index.ts` — export `useQuickVote`
- `features/voting/components/index.ts` — export `QuickVoteControl`, `DistributionBar`

## Testing

### Unit tests (`useQuickVote`)

- Returns hidden state when Supabase unavailable
- Returns result state when pair found in localStorage
- Submits accuracy value and transitions to result on success
- Handles error and rate-limit states correctly
- Fetches distribution after successful vote
- Stores vote in localStorage after success

### Component tests (`QuickVoteControl`)

- Renders three buttons in ready state
- Hides entirely when state is hidden
- Disables buttons during submission
- Shows distribution bar in result state
- Shows first voter badge when total = 1
- Shows error message on failure, re-enables buttons
- Vertical layout on mobile, horizontal on desktop

### Integration (within `SynergyDetailModal`)

- Vote section appears below tier label
- Opening modal for previously-voted pair shows result state

### Storybook

`QuickVoteControl.stories.tsx` with stories for: ready, submitting, result, result-first-voter, error, rate-limited, hidden.

### E2E

Skipped — quick vote hits real Supabase without test environment isolation. Unit/component tests cover the interaction flow. Voting E2E is covered by the random pair page tests.

## Decisions Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Placement | Below tier label | Prominent, gut-reaction before reading details |
| Button labels | "Should be lower/higher" | Unambiguous, references the score directionally |
| Mobile layout | Vertical stack | Better touch targets, validate during implementation |
| Post-vote reveal | Distribution bar | Gamification — community signal drives engagement |
| First voter | Gold badge | Rewards early participation |
| Returning pairs | localStorage → result state | Avoids "didn't I already vote?" confusion |
| Supabase down | Hide section | Per issue spec, no broken UI |
| "Rate in Detail" | Disabled teaser | Placeholder for #213 |
| Vote threshold | None | Show distribution from 1 vote |
| Separate hook | `useQuickVote` | Different lifecycle from `useVoteSession` |
