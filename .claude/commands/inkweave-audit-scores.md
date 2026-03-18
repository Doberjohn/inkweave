---
allowed-tools: Bash(node:*), Bash(pnpm:*), Bash(wc:*), Bash(ls:*), Read, Glob, Grep
description: Audit precomputed synergy data for score distribution anomalies and coverage gaps
---

# Audit Synergy Scores

Analyze all precomputed synergy JSON files and report on data quality,
score distribution, and coverage gaps. Fully automated — no interaction needed.

## Steps

1. **Load all synergy data**
   Read all card JSON files from `apps/web/public/data/synergies/` (exclude `_manifest.json` and `_playstyles.json`). For each file, extract:
   - Card ID
   - Number of groups
   - For each group: rule name, category, playstyleId (if any), and all match scores

   Also read `_playstyles.json` for playstyle card counts and `_manifest.json` for the card list.

2. **Overall score distribution**
   Across ALL matches in the entire card pool:
   - Count how many matches exist at each score value (10 down to 1)
   - Show percentage and a text-based bar chart
   - Map each score to its display tier (Perfect >=9.5, Strong >=7, Moderate >=4, Weak <4)
   - Note key observations (bimodal clustering, unused scores, etc.)

3. **Per-rule summary table**
   For each rule name found across all cards, show ONE summary table with columns:
   - Rule name, Category, Total Matches, Min, Max, Mean, Median, Spread, Flag

4. **Per-rule detail sections (collapsible)**
   For EVERY rule (not just selected ones), generate a collapsible `<details>` block containing:
   - **Score histogram**: count at each score value with tier label and percentage
   - **Group size distribution**: how many cards have groups of size 1-4, 5-9, 10-14, 15+
   - **Flags**: SAME_SCORE, narrow spread, or other anomalies
   - A brief observation sentence

   Use this markdown format for each rule:
   ```
   <details>
   <summary>Rule Name — X matches, score range Y–Z</summary>

   **Score Histogram**
   | Score | Count | Tier | % |
   ...

   **Group Size Distribution**
   | Group Size | Cards | % |
   ...

   Observation text here.

   </details>
   ```

5. **Outlier detection**
   - Cards with the **most total matches** (top 5) — might indicate overly broad rules
   - Cards with **zero synergies** that have keywords like Shift — possible rule gaps

6. **Playstyle balance**
   - Card count per playstyle from `_playstyles.json`
   - **FLAG** if any playstyle has fewer than 10 cards (too niche)
   - **FLAG** if any playstyle has more than 150 cards (too broad)

7. **Coverage summary**
   - Total cards in `allCards.json` vs cards with synergies in manifest
   - Coverage percentage
   - **FLAG** if coverage drops below 40%

8. **Report structure**
   Write the report to `docs/SYNERGY_AUDIT.md` with this structure:

   ```
   # Synergy Data Audit

   ## Issues Found
   - [WARN] / [OK] flags only — quick glance

   ## Summary
   Coverage: X/Y (Z%) | Total matches: N | Rules: N | Playstyles: N

   ## Overall Score Distribution
   Single histogram table with bar chart

   ## Per-Rule Summary
   One compact table covering ALL rules

   ## Per-Rule Details
   <details> blocks for EVERY rule (collapsed by default)

   ## Playstyle Balance
   Table with card counts per playstyle

   ## Top Cards by Matches
   Top 5 cards table
   ```

   Keep the top-level sections scannable. All detailed data goes inside collapsible blocks.

9. **Regenerate HTML**
   After writing the markdown, run `pnpm run docs` to regenerate the HTML report.
