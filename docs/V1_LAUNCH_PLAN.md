# Inkweave v1.0.0 Launch Plan

**Target Date**: May 15, 2026
**Milestone**: [Version 1.0.0](https://github.com/Doberjohn/inkweave/milestone/2)
**Total Issues**: 20

---

## Epics

### Epic: Community Voting (#205) — 5 issues
Allow users to vote on synergy pairs, building a community-driven scoring layer ("Player Rating") alongside the algorithmic "Inkweave Score."

| # | Title | Phase | Depends On |
|---|-------|-------|------------|
| #210 | Supabase Infrastructure Setup | 1 | — |
| #211 | Random Pair Voting Page | 2 | #210 |
| #212 | Synergy Modal Quick Vote | 2 | #210 |
| #213 | In-Depth Voting Flow | 3 | #211 |
| #214 | Player Rating Display | 3 | #211, #212 |

### Epic: Deck Builder (#204) — 4 issues
Full deck building experience with synergy analysis — Inkweave's core differentiator.

| # | Title | Phase | Depends On |
|---|-------|-------|------------|
| #206 | Deck Builder UI + Validation | 2 | — |
| #207 | Deck Local Persistence | 2 | — (parallel with #206) |
| #208 | Dreamborn Import / Text Export | 2 | — (parallel with #206) |
| #209 | Deck Synergy Analysis | 3 | #206, benefits from #215/#42 |

### Engine Rules — 2 issues + audit
New synergy archetypes that enrich the analysis for both card browsing and deck scoring.

| # | Title | Phase | Depends On |
|---|-------|-------|------------|
| #215 | Singers Synergy Rule | 1 | — |
| #42 | Ramp Archetype | 1 | — |
| #218 | Synergy Score Audit | 2 | Best after #215, #42 |

### Independent Issues — 5 issues

| # | Title | Phase | Depends On |
|---|-------|-------|------------|
| #220 | Fix: Hardware back button leaves card preview open | 1 | — |
| #221 | Landing page: use predefined featured cards | 1 | — |
| #216 | Browse Page Performance | 1 | — |
| #217 | Inkable / Uninkable Filter | 1 | — |
| #219 | Legal & Product Pages | 3 | — (hard launch blocker) |

---

## Dependency Graph

```
CHAIN A — Community Voting (CRITICAL PATH)
  #210 Supabase Setup
    ├──→ #211 Random Pair Voting Page
    │       ├──→ #213 In-Depth Voting Flow
    │       └──→ #214 Player Rating Display
    └──→ #212 Quick Vote Modal
            └──→ #214 Player Rating Display

CHAIN B — Deck Builder
  #206 UI + Validation ──┬──→ #209 Synergy Analysis
  #207 Persistence ──────┤    (also benefits from #215, #42)
  #208 Import/Export ────┘

CHAIN C — Engine
  #215 Singers ──┬──→ #218 Score Audit
  #42  Ramp ─────┘

INDEPENDENT (no dependencies)
  #220 Back button bug
  #221 Featured cards
  #216 Browse performance
  #217 Inkable/Uninkable filter
  #219 Legal pages
```

**Critical path**: Chain A (Community Voting) has the longest sequential dependency chain (5 issues) and introduces new infrastructure (Supabase). If Supabase slips, the entire voting track slips.

---

## Execution Plan

### Phase 1 — Foundation (Weeks 1–2)

**Goal**: Unblock the critical path, ship quick wins, land engine rules.

| Priority | Issue | Effort | Notes |
|----------|-------|--------|-------|
| **P0** | #210 Supabase Setup | 2–3 days | Critical path blocker. Schema, RLS, rate limiting, client SDK, CSP update. |
| **P0** | #220 Back button bug | 15 min | Add popstate listener in CardPreviewContext. |
| **P0** | #221 Featured cards | 30 min | Replace random selection with 6 curated card IDs. |
| **P1** | #215 Singers Rule | 1–2 days | Singer keyword + Song subtype detection, cost threshold matching. Rebuild engine + precompute. |
| **P1** | #42 Ramp Archetype | 1–2 days | Ink ramp enablers + high-cost payoffs. Rebuild engine + precompute. |
| **P1** | #216 Browse Performance | 1–2 days | Profile, lazy load images, add skeleton, possibly virtualize. |
| **P1** | #217 Inkable/Uninkable Filter | Half day | Add to filter panel, integrate with filter chips. Supports deck builder. |

### Phase 2 — Core Features (Weeks 3–4)

**Goal**: Build both major features in parallel.

| Priority | Issue | Effort | Notes |
|----------|-------|--------|-------|
| **P0** | #211 Random Pair Voting | 2–3 days | Voting page, two-bucket algorithm, Supabase writes, session dedup. |
| **P0** | #206 Deck Builder UI | 3–4 days | Card add/remove, quantity controls, 4-copy/2-color rules, cost curve. |
| **P1** | #212 Quick Vote Modal | 1 day | Three-button vote in synergy detail modal. Parallel with #211. |
| **P1** | #207 Deck Persistence | 1–2 days | localStorage auto-save, multi-deck support. Parallel with #206. |
| **P1** | #208 Import/Export | 1–2 days | Dreamborn text format parser + clipboard export. Parallel with #206. |
| **P2** | #218 Score Audit | 1–2 days | Audit 2–3 weakest-scored rules. Benefits from #215/#42 being done. |

### Phase 3 — Polish & Launch Prep (Weeks 5–6)

**Goal**: Complete remaining features, finalize legal, prepare for launch.

| Priority | Issue | Effort | Notes |
|----------|-------|--------|-------|
| **P0** | #209 Deck Synergy Analysis | 2–3 days | Weighted sum scoring, cross-reference pre-computed data. Needs #206. |
| **P0** | #213 In-Depth Voting | 1–2 days | 6-dimension voting, extends voting page. Needs #211. |
| **P0** | #214 Player Rating Display | 1–2 days | Aggregated scores from Supabase, 5-vote threshold, dual score display. |
| **P0** | #219 Legal Pages | 1 day | Privacy policy, terms, IP disclaimer, about page. Hard launch blocker. |

### Weeks 7–8 — Buffer

- End-to-end testing of voting + deck builder flows
- Performance verification post-features
- Bug fixes from internal testing
- Final legal review
- Production Supabase environment setup + smoke test

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase setup takes longer than expected | Blocks all 4 voting issues | Start first, keep scope minimal for v1.0 |
| Browse performance fix requires virtualization rewrite | 2+ day effort instead of 1 | Profile first, try lazy loading before virtualization |
| Deck builder scope creep (sorting, filtering within deck) | Delays synergy analysis | Strict scope: add/remove/validate/persist only for v1.0 |
| Rate limiting / anti-abuse complexity | Delays Supabase setup | Simple IP-based rate limiting for v1.0, bounded nudge + trimmed mean (per #9 comment) |
| Legal pages need lawyer review | Blocks launch | Draft early (Phase 1), finalize in Phase 3, allow review time |
| New synergy rules change score distribution | Requires re-audit | Plan #218 after #215/#42, run audit command to verify |

---

## Issues NOT in v1.0.0 (Backlog)

These remain open but are explicitly post-launch:

| # | Title | Notes |
|---|-------|-------|
| #2 | Deck sharing via URL | Post deck builder, v1.1 |
| #6 | Epic: Community Synergies | Partially superseded by #205 |
| #7 | User synergy suggestions | Post-voting, v1.1+ |
| #8 | User-created synergies + sharing | Post-voting, v1.1+ |
| #9 | Vote for synergies + score system | Anti-abuse notes feed into #205 |
| #25 | Performance audit (broad) | #216 covers browse; rest is post-launch |
| #27 | Split CardPreviewContext | Trivial refactor, anytime |
| #30 | Epic: Archetype Synergies | #215/#42 are in v1.0; #41/#43 are post-launch |
| #41 | Bounce Archetype | v1.1 |
| #43 | Damage/Removal Archetype | v1.1 |
| #58 | Epic: Embeddable Widget | Growth lever, post-launch |
| #124 | Custom event tracking | Worth reconsidering for launch |
| #136 | Card potency rating | Depends on community voting data |

---

## Key Decisions (Locked)

1. **Anonymous voting** — no auth required for v1.0
2. **5-vote minimum** before displaying Player Rating
3. **Two-bucket alternation** for pair selection (engagement vs data gaps)
4. **Votes are permanent** — no temporal decay for v1.0
5. **Score divergence** — display both Inkweave Score and Player Rating, no auto-adjustment
6. **Deck builder is client-side only** — no backend needed
7. **Weighted sum formula** for deck synergy scoring: Perfect ×3, Strong ×2, Moderate ×1, Weak ×0.5
8. **60-card soft limit** — allow more, show warning (not a hard rule in Lorcana)
9. **Dreamborn text format** for import, plain text export

---

*Last updated: 2026-03-18*
