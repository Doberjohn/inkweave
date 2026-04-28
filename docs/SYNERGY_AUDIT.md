# Synergy Data Audit

Automated audit of all precomputed synergy JSON files. Last regenerated: **2026-04-29** via `node scripts/audit-synergy-data.mjs` against the post-rebaseline engine (5-baseline scoring convention applied to Lore Denial / Discard / Ramp / Toys).

## Issues Found

- [OK] Rule "Lore Loss" tiered 5/6/7 (burn↔burn / burn↔steal / steal↔steal). Spread: 2.
- [OK] Rule "Discard" 5/8 matrix (parallel-pressure baseline + asymmetric kill combo). Spread: 3.
- [OK] Rule "Ramp" 5/6/7/8/9 with chain ladder for ramp ↔ trigger pairs. Spread: 4.
- [OK] Rule "Toy" 5/7/8 role-driven matrix. Spread: 3.
- [OK] Card 1537 (Baymax - Giant Robot) has 100 Shift Targets — correct, Universal Shift.
- [OK] Coverage at 60.9% (995/1,633 cards) — above 40% threshold.
- [OK] No playstyle exceeds 150 cards or drops below 10.

## Summary

| Metric | Value |
|--------|-------|
| Total cards | 1,633 |
| Cards with synergies | 995 (60.9%) |
| Total matches | 19,020 |
| Rules represented | 15 (Shift, Named, Singer + Songs, Lore Loss, Discard, Ramp, Toy, + 8 Location sub-rules) |
| Playstyles | 5 (Location Control, Ramp, Discard, Lore Denial, Toy) |

```chart
{
  "type": "doughnut",
  "title": "Synergy Coverage (1,633 cards)",
  "data": {
    "labels": ["Cards with synergies (995)", "Cards without synergies (638)"],
    "values": [995, 638]
  }
}
```

## Overall Score Distribution

| Score | Count | % | Tier | Bar |
|-------|-------|---|------|-----|
| 10 | 2 | 0.0% | Perfect | |
| 9 | 1,120 | 5.9% | Snowball chain | █████ |
| 8 | 1,722 | 9.1% | Win-condition | █████████ |
| 7 | 3,622 | 19.0% | Strong / compounding | ███████████████████ |
| 6 | 1,076 | 5.7% | Complementary | █████ |
| 5 | 10,198 | 53.6% | Neutral baseline | ██████████████████████████████████████████████████████ |
| 4 | 18 | 0.1% | Hostile (Named Companions) | |
| 3 | 1,262 | 6.6% | Weak | ███████ |

**53.6% at score 5** confirms the 5-baseline convention is anchoring playstyle pairs as designed. Same-axis density pairs (burn↔burn, enabler↔enabler, ramp↔ramp, member↔member) sit at the floor; specific mechanical interactions earn 6+. The 19% at score 7 captures real compounding (steal↔steal, member↔tribal, etc.). The 9% at score 8 is genuine win-condition combos. The 6% at score 9 is Ramp's snowball chain (deck-ramp + repeating-trigger).

```chart
{
  "type": "bar",
  "title": "Overall Score Distribution (19,020 matches)",
  "data": {
    "labels": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "datasets": [{
      "label": "Matches",
      "data": [0, 0, 1262, 18, 10198, 1076, 3622, 1722, 1120, 2],
      "backgroundColor": ["#f59090", "#f59090", "#f59090", "#60b5f5", "#60b5f5", "#60b5f5", "#6ee7a0", "#6ee7a0", "#6ee7a0", "#fbbf24"]
    }]
  }
}
```

## Per-Rule Summary

| Rule | Category | Matches | Cards | Min | Max | Mean | Median | Spread |
|------|----------|---------|-------|-----|-----|------|--------|--------|
| Ramp | playstyle | 7,514 | 90 | 5 | 9 | 5.97 | 5 | 4 |
| Singer + Songs | direct | 2,050 | 95 | 5 | 8 | 6.09 | 6 | 3 |
| Shift Targets | direct | 1,544 | 734 | 3 | 10 | 5.83 | 5 | 7 |
| Discard | playstyle | 1,352 | 39 | 5 | 8 | 5.32 | 5 | 3 |
| At Location Payoff | playstyle | 1,057 | 62 | 3 | 7 | 6.46 | 7 | 4 |
| Location In-Play Check | playstyle | 868 | 61 | 3 | 5 | 4.74 | 5 | 2 |
| Location Buff | playstyle | 822 | 60 | 3 | 7 | 6.34 | 7 | 4 |
| Location Search | playstyle | 755 | 59 | 3 | 5 | 4.43 | 5 | 2 |
| Location Ramp | playstyle | 610 | 58 | 3 | 7 | 6.08 | 7 | 4 |
| Toy | playstyle | 552 | 24 | 5 | 8 | 6.51 | 7 | 3 |
| Lore Loss | playstyle | 546 | 24 | 5 | 7 | 5.83 | 6 | 2 |
| Move to Location | playstyle | 524 | 58 | 3 | 5 | 4.65 | 5 | 2 |
| Named Companions | direct | 381 | 74 | 4 | 8 | 5.91 | 6 | 4 |
| Location Play Trigger | playstyle | 249 | 56 | 3 | 7 | 6.65 | 7 | 4 |
| Location Boost | playstyle | 196 | 16 | 3 | 5 | 3.57 | 3 | 2 |

```chart
{
  "type": "bar",
  "title": "Matches per Rule",
  "data": {
    "labels": ["Ramp", "Singer", "Shift", "Discard", "Loc Payoff", "Loc In-Play", "Loc Buff", "Loc Search", "Loc Ramp", "Toy", "Lore Loss", "Loc Move", "Named", "Loc Play-Trig", "Loc Boost"],
    "values": [7514, 2050, 1544, 1352, 1057, 868, 822, 755, 610, 552, 546, 524, 381, 249, 196]
  }
}
```

## Per-Rule Details

<details>
<summary>Ramp — 7,514 matches across 90 cards, score range 5–9</summary>

| Score | Count | % |
|-------|-------|---|
| 9 | 938 | 12.5% |
| 8 | 952 | 12.7% |
| 7 | 230 | 3.1% |
| 6 | 198 | 2.6% |
| 5 | 5,196 | 69.2% |

The 27% at 8–9 is the chain ladder: deck-ramp + repeating-trigger combos compound mechanically. The 69% at 5 is parallel-density baseline (ramp↔ramp, trigger↔trigger, ramp↔CR) — real but doesn't compound. The 6 tier is cost-reduction pairs with overlapping target types (genuine stacking discounts). 90 ramp cards × 89 partners = ~8,000 max possible pairs; 7,514 actual indicates broad coverage.

</details>

<details>
<summary>Singer + Songs — 2,050 matches across 95 cards, score range 5–8</summary>

| Score | Count | % |
|-------|-------|---|
| 8 | 268 | 13.1% |
| 7 | 456 | 22.2% |
| 6 | 512 | 25.0% |
| 5 | 814 | 39.7% |

Threshold-utilization tiering: song cost = singer value (8), -1 (7), -2 (6), ≤-3 (5). Even distribution across 4 anchors — the most uniformly-tiered direct rule.

</details>

<details>
<summary>Shift Targets — 1,544 matches across 734 cards, score range 3–10</summary>

| Score | Count | % |
|-------|-------|---|
| 10 | 2 | 0.1% |
| 9 | 182 | 11.8% |
| 8 | 235 | 15.2% |
| 7 | 320 | 20.7% |
| 5 | 402 | 26.0% |
| 3 | 403 | 26.1% |

Best-differentiated rule — 6 distinct score values across a spread of 7. Driven by curve-gap math + inkable bonuses + free-Shift tiering + condition-activation +1 bonus (which pushes a 9 to 10). 734 cards participate (every Shift card and every base it can target).

</details>

<details>
<summary>Discard — 1,352 matches across 39 cards, score range 5–8</summary>

| Score | Count | % |
|-------|-------|---|
| 8 | 142 | 10.5% |
| 5 | 1,210 | 89.5% |

89.5% sit at the new 5 floor (parallel pressure + payoff↔payoff baseline). The 10.5% at 8 is the asymmetric kill combo with the 2 hand-size payoffs (Yzma — Transformed Kitten, Pacha — Trekmate). Bimodal by design — the rebaseline made the deck's structure visible: 90% pressure cards stacking, 10% genuine kill combos.

</details>

<details>
<summary>Toy — 552 matches across 24 cards, score range 5–8</summary>

| Score | Count | % |
|-------|-------|---|
| 8 | 86 | 15.6% |
| 7 | 288 | 52.2% |
| 5 | 178 | 32.2% |

Role-driven matrix: 5 = same-deck baseline (member↔member, member↔generic, generic↔generic), 7 = tribal compounding (member↔tribal, tribal↔tribal), 8 = peak chain (member↔search, search↔banish-trigger). 52% mid-tier reflects the playstyle's tight tribal density — most pairs involve at least one tribal payoff role.

</details>

<details>
<summary>Lore Loss — 546 matches across 24 cards, score range 5–7</summary>

| Score | Count | % |
|-------|-------|---|
| 7 | 90 | 16.5% |
| 6 | 274 | 50.2% |
| 5 | 182 | 33.3% |

Tiered 5/6/7 by burn-vs-steal pair: burn↔burn = 5 (parallel pressure), burn↔steal = 6 (complementary), steal↔steal = 7 (double-swing engine). 50% mid-tier shows the deck's natural burn/steal mix is the most common pair shape. 24 cards (14 burn + 10 steal); the 7-tier slot is rare because pure-steal pairs are scarce.

</details>

<details>
<summary>Named Companions — 381 matches across 74 cards, score range 4–8</summary>

| Score | Count | % |
|-------|-------|---|
| 8 | 39 | 10.2% |
| 7 | 78 | 20.5% |
| 6 | 92 | 24.1% |
| 5 | 154 | 40.4% |
| 4 | 18 | 4.7% |

5 distinct score tiers across all major effect categories: game-winning (8 — search/free play/multi-draw), strong (7 — cost reduction / keyword grants), moderate (6 — stat boosts / Resist / Support), minor (5 — everything else), hostile (4 — banish/exert the named target). Healthy distribution.

</details>

<details>
<summary>Location Control (8 sub-rules merged) — 5,081 matches across ~104 cards</summary>

| Sub-rule | Matches | Score range | Mean |
|----------|---------|-------------|------|
| At Location Payoff | 1,057 | 3–7 | 6.46 |
| Location In-Play Check | 868 | 3–5 | 4.74 |
| Location Buff | 822 | 3–7 | 6.34 |
| Location Search | 755 | 3–5 | 4.43 |
| Location Ramp | 610 | 3–7 | 6.08 |
| Move to Location | 524 | 3–5 | 4.65 |
| Location Play Trigger | 249 | 3–7 | 6.65 |
| Location Boost | 196 | 3–5 | 3.57 |

Combined into a single `location-control` playstyle group in the UI (104 unique cards). Strong-tier sub-rules (Payoff / Buff / Ramp / Play-Trigger) score 7 for direct mechanic matches and 3 for incompatibles; baseline sub-rules (In-Play Check / Search / Move / Boost) score 5 for matches. Boost has the lowest mean (3.57) because it requires location-with-cards-beneath-it semantics that few locations satisfy — most pairs land at 3.

</details>

## Playstyle Balance

| Playstyle | Cards | % of Total |
|-----------|-------|------------|
| Location Control | 104 | 6.4% |
| Ramp | 90 | 5.5% |
| Discard | 39 | 2.4% |
| Lore Denial | 24 | 1.5% |
| Toys | 24 | 1.5% |

All five playstyles above the 10-card minimum; Location Control is the largest at 104 (still well below the 150 cap).

```chart
{
  "type": "bar",
  "title": "Playstyle Archetype Balance",
  "data": {
    "labels": ["Location Control", "Ramp", "Discard", "Lore Denial", "Toys"],
    "datasets": [{
      "label": "Cards",
      "data": [104, 90, 39, 24, 24],
      "backgroundColor": ["#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f59e0b"]
    }]
  }
}
```

## Top 10 Cards by Total Matches

| Card | Matches |
|------|---------|
| Minnie Mouse - Pirate Lookout | 183 |
| The Cold Never Bothered Me | 180 |
| Elsa - Concerned Sister | 166 |
| Basil - Disguised Detective | 129 |
| Rescue Rangers Submarine - Mobile Headquarters | 125 |
| Motunui - Island Paradise | 125 |
| Duckburg - Funso's Funzone | 115 |
| The Islands I Pulled from the Sea | 113 |
| One Jump Ahead | 105 |
| Owl Island - Secluded Entrance | 104 |

Top entries are dominated by Locations, Ramp anchors (One Jump Ahead inkwell ramp), and Sapphire ink-trigger sources (Elsa - Concerned Sister, Basil - Disguised Detective). Ramp's 7,514-match volume drives most of these into the top 10.

```chart
{
  "type": "bar",
  "title": "Top 10 Cards by Total Matches",
  "data": {
    "labels": ["Minnie Mouse", "Cold Never Bothered Me", "Elsa Concerned", "Basil Disguised", "Rescue Rangers Sub", "Motunui", "Duckburg", "Islands Pulled", "One Jump Ahead", "Owl Island"],
    "values": [183, 180, 166, 129, 125, 125, 115, 113, 105, 104]
  }
}
```
