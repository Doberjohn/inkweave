/**
 * Equal-height contract for the comparison view's engine + community columns.
 *
 * The two columns must render at exactly the same height regardless of state. We achieve this
 * dynamically: at runtime, `CardOverviewModal` measures both columns via ResizeObserver and
 * applies `minHeight = max(engineHeight, communityHeight)` to whichever is shorter. The constants
 * below document the *expected* per-component / per-state heights that drive each side's total —
 * they're documentation of the contract, not direct inputs to the lock (the lock just measures).
 *
 * Scope: desktop only. Mobile stacks the columns vertically (no equal-height constraint), so the
 * lock and these constants don't apply there.
 *
 * If a component's height drifts (e.g. someone tweaks padding), the lock self-corrects at runtime
 * but the constants below would be out of date. Treat changes here as a checklist for verifying
 * the contract still holds visually.
 */

/** `ColumnHeader` is locked to this minimum height. Both columns. */
export const COLUMN_HEADER_MIN_HEIGHT = 87;

/**
 * `AbilityRow` (the cream Lorcana ability box) — variable per descriptive copy length.
 * Descriptions are capped at 2 lines (yesterday's copy rewrite); 1-line vs 2-line is a real
 * design state, not padded up. The runtime lock handles whichever variant the current pair
 * happens to render.
 */
export const ABILITY_ROW_HEIGHTS = {
  oneLine: 39,
  twoLine: 61,
} as const;

/**
 * `QuickVoteControl` heights by state. The component itself wraps `QuickVotePrompt` which is
 * where the actual rendering branches happen (distribution-or-not × prompt-or-affirmation).
 *
 * State combinations not listed:
 * - `'submitting'` — same dimensions as `'ready'` (buttons are dimmed but layout identical)
 * - `'result'` without distribution — impossible by construction (voting creates a distribution)
 * - `'error'` — `'ready'` shape + error banner. Asymmetry accepted (rate-limit/network errors
 *   are rare and the small height bump is acceptable)
 * - `'hidden'` — component returns null. Not reached in comparison view (engine score always set)
 */
export const QUICK_VOTE_CONTROL_HEIGHTS = {
  /** `<5 votes`, no user vote — prompt + 3 buttons, no distribution bar above. */
  readyNoDistribution: 106,
  /** `≥5 votes`, user hasn't voted — distribution bar + dashed divider + prompt + 3 buttons. */
  readyWithDistribution: 214,
  /** User has voted — distribution bar + `<VoteAffirmation>` (no prompt, no buttons). */
  resultWithDistribution: 172,
} as const;

/**
 * Community column total heights by state. These are the targets the lock pulls the engine
 * column up to (when community is taller). The community column has 3 deterministic states
 * driven by the same vote-state machine as `QuickVoteControl` — see voting feature for details.
 */
export const COMMUNITY_COLUMN_HEIGHTS = {
  /** `<5 votes`, no user vote. */
  fewVotesNoUserVote: 339,
  /** `<5 votes`, user has voted. */
  fewVotesUserVoted: 349,
  /** `≥5 votes`, distribution + 4 metrics fully visible. */
  manyVotes: 429,
} as const;

/**
 * Engine column total heights by (QuickVoteControl state × AbilityRow line count). Six cells.
 * Derived from the per-component constants above + EngineColumn's padding/gap layout.
 *
 * The runtime lock measures these directly via ResizeObserver — these constants are for
 * documentation and future drift-detection tests.
 */
export const ENGINE_COLUMN_HEIGHTS = {
  readyNoDistOneLine: 321,
  readyNoDistTwoLine: 343,
  readyWithDistOneLine: 429,
  readyWithDistTwoLine: 452,
  resultWithDistOneLine: 387,
  resultWithDistTwoLine: 409,
} as const;
