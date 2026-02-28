# UX Audit — February 2026

Current state assessment of Inkweave's user experience across all pages. Scored per area with specific findings, UX
principles violated/applied, and recommended fixes.

**Overall Score: 6/10**

---

## Home Page — 7.5/10

### What works

- **Visual hierarchy is strong.** Hero title → subtitle → search bar → featured cards. The user's eye flows naturally
  from context to action. *(Visual Hierarchy)*
- **Search bar with autocomplete is excellent.** Typing "Elsa" and seeing results instantly is low interaction cost —
  the user goes from intent to result in one step. *(Interaction Cost)*
- **Dark fantasy theme is cohesive.** It feels like a Lorcana product, not a generic tool. Atmospheric and on-brand.
- **"See all cards →" link is clear.** Good progressive disclosure — obvious next step without cluttering the primary
  view. *(Progressive Disclosure)*

### Issues found

**1. The "Search" button next to the search bar is confusing**
The search bar already has autocomplete — typing and selecting IS the search action. The adjacent "Search" button
implies a different action (navigating to browse with a query). Two behaviors on the same row creates affordance
confusion — the user doesn't know which path they're choosing.

- *Principle violated*: **Affordance** — the button's purpose is ambiguous alongside the autocomplete input
- *Recommendation*: Either remove the button (autocomplete is sufficient) or visually distinguish it as "Browse results"
  to signal a different destination

**2. Featured cards lack context**
"FEATURED CARDS" tells the user these cards are featured but not why they should care. Are they popular? New? Strong
synergy starters? The label has weak information scent.

- *Principle violated*: **Information Scent** — no cue about what value these cards offer
- *Recommendation*: Add a subtitle ("Popular picks" or "Great synergy starters") to give the user a reason to engage

**3. No secondary navigation paths**
The home page funnels entirely through search or featured card clicks. There's no "Browse all cards" or "Explore
playstyles" path for users in a browse mindset.

- *Principle violated*: **Search vs. Browse Paradigm** — only the search mindset is served
- *Recommendation*: Add two secondary buttons below the search bar: "Browse all cards" and "Explore playstyles"

---

## Card Detail + Synergy Results — 6/10

### What works

- **Two-column layout maintains context.** Selected card stays visible on the left while synergy results scroll on the
  right. The user never loses track of what they're exploring.
- **Synergy breakdown sidebar** (bottom-left) with group counts and strength badges is a nice at-a-glance summary of all
  synergy groups. *(Progressive Disclosure)*
- **Collapsible synergy groups** let users focus on one strategy at a time. *(Progressive Disclosure)*

### Issues found

**4. Synergy card tiles are unreadable at thumbnail size**
Each tile shows the full card image with game text, cost badge, strength/willpower stats, and a strength label. At
thumbnail size, card text is completely illegible. The user gets visual noise without usable information.

- *Principle violated*: **Signal-to-Noise Ratio** — showing everything but communicating nothing
- *What the user actually needs*: Card art (recognition), card name (identification), synergy strength (relevance). Game
  text, stats, and set info are irrelevant at this zoom level.
- *Recommendation*: Restyle synergy cards (#44) — crop to card illustration, show name and prominent strength badge,
  drop illegible text. This is the single highest-impact UX fix.

**5. No indication of what clicking a synergy card does**
20 Location Control cards are displayed but there's no visual cue that they're clickable, and no hint about what happens
on click. The user doesn't know if they'll see a detail modal, navigate away, or something else.

- *Principle violated*: **Affordance** — missing click affordance on interactive elements
- *Recommendation*: Add hover state with tooltip or visual cue ("View synergy details"). Connects to #115 (Detailed
  Synergy View).

**6. Strength badges have inverted visual hierarchy**
"Strong" (green), "Moderate" (yellow), "Weak" (red) badges at the bottom of each card are the most important information
in synergy results — how good is this pairing? But they're the smallest, lowest-contrast element on the tile.

- *Principle violated*: **Visual Hierarchy** — the most important data has the least visual weight
- *Recommendation*: Make strength the most prominent element on the synergy tile — larger badge, higher position,
  stronger contrast. The score should be the first thing the eye catches, not the last.

**7. No way to understand WHY cards synergize**
The synergy group has a description ("Cards that synergize through location-based gameplay...") but individual cards
don't explain their specific role. Why is Agrabah in Location Control? What does it contribute to the strategy?

- *Principle violated*: **Information Scent** — clicking deeper should reveal more detail, not the same level of detail
- *Recommendation*: Add per-card synergy reason tags or a brief explanation. Connects to #115.

---

## Browse Page — 5/10

### What works

- **Grid layout is clean** and shows cards efficiently at a glanceable size.
- **"1432 CARDS - SHOWING FIRST 200"** is honest and sets expectations. The user knows they're seeing a subset.

### Issues found

**8. No visible sorting controls**
1432 cards in no discernible order. There's no sort option (by name, cost, color, type). Without structure, browsing is
aimless — the user has to rely entirely on search or filters.

- *Principle violated*: **Search vs. Browse Paradigm** — browse requires structure (grouping, sorting) to be useful.
  Without it, the page is a wall of cards.
- *Recommendation*: Add sort controls (name, cost, ink color). Consider default sort by ink color → cost for a natural
  browsing order.

**9. Filter state is invisible**
The orange "Filters" button looks identical whether 0 or 5 filters are active. The user can't tell if they're seeing all
cards or a filtered subset without opening the filter panel.

- *Principle violated*: **Visibility of System Status** (Nielsen's Heuristic #1) — the system should always keep users
  informed about what's going on
- *Recommendation*: Show active filters as chips/tags below the search bar, or add a badge count to the Filters
  button ("Filters (3)").

---

## Navigation — 5.5/10

### Issues found

**10. Logo-only back navigation**
The "← INKWEAVE" text in the compact header is the only way to return to the home page from card detail or browse. It's
branded text that some users won't recognize as navigation.

- *Principle violated*: **Affordance** — the back action is disguised as branding
- *Recommendation*: Add an explicit back arrow/button, or make the logo click behavior more obvious with an underline on
  hover.

**11. No breadcrumb or location awareness**
On the card detail page, there's no indication of where the user is in the app hierarchy. "Home → Elsa - Ice Artisan →
Synergies" would orient the user and provide navigation shortcuts.

- *Principle violated*: **Recognition over Recall** — the user must remember how they got here rather than seeing it
  displayed
- *Recommendation*: Consider breadcrumbs or at minimum a clear page title that establishes context.

---

## Visual Design — 8/10

### What works

- **Cohesive dark fantasy theme** — deep purple backgrounds, gold accents, atmospheric gradient. Feels premium and
  on-brand for Lorcana.
- **Ink color system** — Amber, Amethyst, Emerald, Ruby, Sapphire, Steel each have distinct, recognizable accent colors.
- **Typography hierarchy** — Serif hero titles vs. sans-serif UI text creates clear distinction between branding and
  functional elements.
- **Strength colors** — Green (strong), yellow (moderate), red (weak) use universal color associations.

### Issues found

- Card images at small sizes lose their visual distinctiveness — the dark theme can make similar-toned cards blend
  together.
- The ethereal glow orb background is subtle enough to not distract, which is good. But it could be used more
  intentionally to create visual zones on longer pages.

---

## Summary: Top 3 Highest-Impact Fixes

1. **Restyle synergy cards (#44)** — Crop to card illustration, show name + prominent strength badge, drop illegible
   game text. Transforms synergy results from noisy to scannable. Affects every card detail view.

2. **Add sort/filter visibility to browse (#114)** — Sort controls + active filter chips. Makes the browse page
   functional for exploration instead of just a card wall.

3. **Add "Browse all cards" + "Explore playstyles" below search bar on home** — Completes the information architecture
   with three clear paths matching three user mindsets.

---

## New UX Concepts Referenced

*(See UX_REFERENCE.md for full definitions of previously documented concepts)*

### Signal-to-Noise Ratio

The proportion of useful information vs. irrelevant visual elements. High noise (illegible text, redundant stats) drowns
out the signal (card identity, synergy strength). Every element should either inform a decision or be removed.

### Visibility of System Status

Nielsen's Heuristic #1. The system should always keep users informed about what's going on through appropriate feedback
within reasonable time. Active filters, loading states, and current sort order should all be visible without requiring
user action to discover them.
