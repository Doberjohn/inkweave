---
paths:
  - "apps/web/src/**/*.tsx"
---

# Back navigation (owner ruling 2026-08-07)

Three patterns, three components, one rule. They are separate because they answer
different questions, and folding them together was considered and rejected.

| Question | Component | Shape |
|---|---|---|
| "How do I leave?" | `BackLink` | `← Back to X`, muted → gold on hover |
| "Where am I?" | `Breadcrumb` | `Playstyles / Lore Denial` |
| "What now?" (dead end) | `CtaButton` | the screen's one remaining action |

`inkweave/no-adhoc-back-links` enforces the first: a `← ` or `Back to …` label in a
file that does not import `BackLink` is an error.

## Why the rule exists

A census on 2026-08-07 found **eleven back affordances in five shapes**, with the
shared `BackLink` used at three of them. `InDepthVotePage` rendered the same
destination as a `BackLink` twice and a `CtaButton` once, in one file.

The component had existed the whole time. Two things beat it:

1. **It was a `<button onClick>` and nothing else.** Most back-navigation goes to a
   real URL, and wants middle-click, open-in-new-tab and crawlability — so
   `DeckViewPage` and `PlaystyleDetailPage` hand-rolled anchors. The component could
   not do their job. It now takes `to` XOR `onClick` and renders a `<Link>` or a
   `<button>` accordingly.
2. **It broke the design system itself.** It used `COLORS.primary500`, the legacy
   gold, and sat in the grandfather ledger twice. A standard that is itself a
   rule-breaker is a poor argument for compliance.

Same lesson as `no-legacy-gold`: a ruling with no mechanism is a suggestion.

## Choosing

- **`BackLink`** wherever the reader arrived from somewhere specific and there is one
  obvious way out. Pass `to` for a real URL; reserve `onClick` for reversing in-page
  state that has no URL of its own (expanded synergy group → all synergies).
- **`Breadcrumb`** only where the page is nested deep enough to be disorienting. It
  names every level, which is its whole value and also its cost — on a shallow page
  it is noise. The app has exactly one.
- **`CtaButton`** on a terminal screen. "Back to Home" after a completed vote is a
  primary action that happens to say *back*; making it a quiet grey link would end
  the screen on nothing.

## Exemptions are the record

The rule's `BACK_LINK_EXEMPT` list is not a list of things nobody got round to. Each
entry was considered and named:

- **Terminal CTAs** — `VotePage`, `InDepthVotePage`, `AuthCallbackPage`.
- **In-overlay state reversal** — `CardOverviewModal`'s `← Back` steps between states
  inside one modal, cased and sized to match that modal's header chrome. Converting it
  would make the header inconsistent with itself to match pages it never sits on.
- **`CompactHeader`** — its `← INKWEAVE` variant is the header's own brand slot.

Add to this list only with a written reason. An exemption with no rationale is
indistinguishable from a violation someone skipped.
