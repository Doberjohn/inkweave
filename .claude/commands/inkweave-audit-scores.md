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
   - Map each score to its display tier (Perfect ≥9.5, Strong ≥7, Moderate ≥4, Weak <4)
   - Note key observations (bimodal clustering, unused scores, etc.)

3. **Score distribution per rule**
   For each rule name found across all cards:
   - Count total matches
   - Show score histogram (how many matches at each score value)
   - Calculate min, max, mean, median score
   - **FLAG** if all matches have the same score (suggests scoring logic isn't differentiating)
   - **FLAG** if score range is very narrow (spread ≤ 1)

5. **Outlier detection**
   - Cards with the **most synergy groups** (top 5) — might indicate overly broad rules
   - Cards with the **most total matches** (top 5) — same concern
   - Cards with **zero synergies** that have keywords like Shift, Challenger, or Evasive — possible rule gaps

6. **Playstyle balance**
   - Card count per playstyle from `_playstyles.json`
   - **FLAG** if any playstyle has fewer than 10 cards (too niche to be useful)
   - **FLAG** if any playstyle has more than 150 cards (too broad, not distinctive)
   - Show ratio of playstyle cards to total cards in manifest

7. **Coverage summary**
   - Total cards in `allCards.json` vs cards with synergies in manifest
   - Coverage percentage
   - **FLAG** if coverage drops below 40% (many cards have no synergies at all)

8. **Report**
   Display results as a structured summary with clear sections. Use tables where helpful.
   Lead with flags/issues at the top, then detailed breakdowns below.
   Example format:
   ```
   ## Issues Found
   - [WARN] Rule "Lore Loss" has identical score (7) for all 19 matches
   - [OK] No orphan Shift cards detected

   ## Score Distribution
   | Rule | Matches | Min | Max | Mean | Median | Spread |
   |------|---------|-----|-----|------|--------|--------|
   | ...  | ...     | ... | ... | ...  | ...    | ...    |

   ## Top Cards by Synergy Count
   | Card ID | Groups | Total Matches |
   |---------|--------|---------------|
   | ...     | ...    | ...           |

   ## Playstyle Balance
   | Playstyle | Cards | % of Total |
   |-----------|-------|------------|
   | ...       | ...   | ...        |

   ## Coverage
   Total: X/Y cards (Z%)
   ```
9. **Markdown report**
   Overwrite `docs/SYNERGY_AUDIT.md` with the full audit results in markdown format.
   This file is the single source of truth — always overwrite, never create dated copies.
   The docs hub (`/docs/synergy-audit`) imports this file at build time via `?raw`.

10. **HTML report**
   Generate a standalone HTML report to `apps/web/public/data/synergy-audit-report.html`.