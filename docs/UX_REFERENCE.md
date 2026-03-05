# UX Terminology & Principles Reference

A living reference of UX concepts applied throughout Inkweave's design decisions. Each term includes a definition, why
it matters, and how it applies to our specific UI.

---

## Hick's Law

**Definition**: Decision time increases logarithmically with the number of choices presented simultaneously.

**Why it matters**: Every option you add to a screen makes all options slower to choose. The effect isn't linear — going
from 2 to 4 choices is more impactful than going from 20 to 22. This is why minimal interfaces feel fast even when they
offer the same features as cluttered ones.

**In Inkweave**: The home page presents three clear paths (search, browse, playstyles) rather than showing all
playstyles, all featured cards, and all filters at once. The card detail page groups synergies into collapsible
categories rather than listing 50+ cards in a flat list.

**Rule of thumb**: If a screen has more than 5-7 simultaneous choices, consider grouping, progressive disclosure, or
moving options to a secondary screen.

---

## Recognition over Recall

**Definition** (Nielsen's Heuristic #6): Users should be able to recognize options, actions, and objects rather than
having to remember them from a previous screen or experience.

**Why it matters**: Human recognition memory is vastly stronger than recall memory. Showing a search bar is
recognition ("I know what that is"). Expecting a user to remember that they need to type `/search` is recall.
Recognition reduces cognitive load — the mental effort required to use the interface.

**In Inkweave**: The search bar on the home page is instantly recognizable. Filter chips with ink color icons let users
recognize "Amethyst" by its purple icon rather than recalling from a text list. Card images in synergy results let users
recognize cards visually.

**Rule of thumb**: Prefer UI patterns users have encountered thousands of times (search bars, card grids, filter chips,
modals) over novel interactions that require learning.

---

## Information Scent

**Definition**: Visual and textual cues that help users predict whether following a path will lead to what they're
looking for. Borrowed from information foraging theory, which models how humans seek information similarly to how
animals forage for food.

**Why it matters**: Users constantly evaluate "is this link/button going to give me what I want?" Strong scent =
confident clicks. Weak scent = hesitation, wrong turns, abandonment. Labels, icons, preview content, and even visual
design all contribute to scent.

**In Inkweave**: "Search for a card..." has strong scent for users with a specific card in mind. "Browse all cards"
clearly communicates the filtering/exploration experience. A playstyle banner showing "Lore Steal — 24 cards" has
stronger scent than a generic "Playstyle #2" label.

**Rule of thumb**: For every button or link, ask "would a first-time user know what they'll get when they click this?"
If not, improve the label, add a description, or show a preview.

---

## Interaction Cost

**Definition**: The total mental and physical effort required to reach a goal — measured in clicks, page loads, amount
of reading, scrolling, typing, and decisions the user must make.

**Why it matters**: Every step between "user wants something" and "user gets it" has a dropout rate. On mobile, each
navigation step is heavier (slower loads, more disorienting). Minimizing interaction cost for the most common task is
the single highest-impact UX optimization you can make.

**In Inkweave**: Keeping the search bar on the home page means the most common task (find a specific card) costs 1
interaction: type and select from autocomplete. Moving it behind a "Browse" button would add 3-4 steps to the same task.

**Rule of thumb**: Map out the steps for your top 3 user tasks. If any take more than 3 interactions, look for ways to
reduce. The most frequent task should have the lowest cost.

---

## Progressive Disclosure

**Definition**: Show only what's needed at each stage of the user's journey, revealing complexity as they go deeper. The
interface starts simple and unfolds.

**Why it matters**: Prevents information overload by matching the amount of information shown to the user's current
need. A first-time user needs less than a power user — progressive disclosure serves both without overwhelming either.

**In Inkweave**: The home page shows three paths. Card detail shows synergy groups collapsed with card counts.
Clicking "Show all" reveals the full card list with filters. Each level reveals more detail only when the user asks for
it.

**Rule of thumb**: For each screen, ask "what's the minimum the user needs to make their next decision?" Show that, hide
the rest behind expandable sections, "show more" buttons, or secondary routes.

---

## Search vs. Browse Paradigm

**Definition**: Two fundamentally different information-seeking behaviors. Search: "I know what I want, let me type it."
Browse: "I don't know exactly, let me look around and narrow down." Users switch between these modes depending on their
confidence level.

**Why it matters**: Supporting only one mode alienates users in the other mindset. A search-only interface frustrates
explorers. A browse-only interface frustrates users who know exactly what they want. The best interfaces offer both
without making either feel secondary.

**In Inkweave**: The search bar serves the search mindset ("I pulled Elsa, what's good with her?"). The browse page with
filters serves the browse mindset ("What Amethyst characters cost 3 or less?"). These are two different entry points to
the same card database, serving different cognitive states.

**Rule of thumb**: If your content has more than ~50 items, you need both search and browse. Search for users with
specific intent, browse for users exploring or comparing.

---

## Hub-and-Spoke Navigation

**Definition**: A central screen (hub) routes users to specialized sections (spokes). Each spoke focuses on a single
task. Users return to the hub to switch between tasks.

**Why it matters**: Creates a predictable mental model — the user always knows where they are relative to "home." Works
well when spokes are independent tasks. Breaks down when users need to cross between spokes frequently without returning
to the hub.

**In Inkweave**: The home page is the hub. Card detail, browse, and playstyles are spokes. The compact header with logo
provides a consistent "return to hub" affordance. Where spokes connect (e.g., playstyle detail → card detail), we
provide direct navigation so users don't have to go back to home first.

**Rule of thumb**: Every spoke needs a clear, consistent "back to hub" path. When two spokes naturally connect, add a
direct link between them rather than forcing a return to the hub.

---

## Affordance

**Definition**: A property of an object that suggests how it can be used. A door handle affords pulling. A flat plate
affords pushing. In UI, a raised button affords clicking, a text input affords typing.

**Why it matters**: When affordances are clear, users don't need instructions. When they're missing or misleading, users
get confused. A flat text that's actually clickable (missing affordance) or a decorative element that looks like a
button (false affordance) both cause errors.

**In Inkweave**: Card tiles have hover effects and cursor changes — they afford clicking. The search bar has a text
input shape — it affords typing. Synergy group headers have expand/ collapse chevrons — they afford toggling. The gold
CTA buttons have depth and color contrast — they afford tapping.

**Rule of thumb**: Every interactive element should visually communicate its interactivity through at least two cues:
hover state, cursor change, shadow/depth, color contrast, or icon.

---

## Mental Model

**Definition**: The user's internal understanding of how a system works — what they expect to happen when they take an
action. Formed from prior experience with similar products.

**Why it matters**: When the interface matches the user's mental model, everything feels intuitive. When it doesn't,
even simple tasks feel confusing. Users don't adapt their mental models to your product — you must adapt your product to
their expectations.

**In Inkweave**: Users of card game tools expect: "I pick a card, then I see what works with it." The app matches this
exactly — select a card → see synergies. If clicking a synergy result navigated away from the original card (instead of
showing pair details), it would break the mental model of "I'm exploring this card's connections."

**Rule of thumb**: For every interaction, ask "what would the user expect to happen?" If the answer differs from what
actually happens, you have a mental model mismatch that needs fixing — through UI changes, not documentation.

---

## Visual Hierarchy

**Definition**: Using size, color, contrast, spacing, and position to communicate the relative importance of elements on
a screen. The eye is drawn to larger, more contrasting, and higher-positioned elements first.

**Why it matters**: Without clear hierarchy, users don't know where to look. They waste time scanning and often miss the
primary action. With strong hierarchy, the interface guides the eye naturally from most important to least important.

**In Inkweave**: The home page hero text is the largest element (establishes context). The search bar is large and
centered (primary action). The two navigation buttons are smaller and below (secondary actions). Featured cards are
smaller still (tertiary, discovery). Each level uses decreasing size and contrast.

**Rule of thumb**: For every screen, identify the ONE thing users should notice first. Make it the largest, most
contrasting element. Then rank everything else. If two elements are the same size and contrast, you're telling the user
they're equally important — make sure that's intentional.

---

## F-Pattern Scanning

**Definition**: Eye-tracking research shows that users scan web pages in an F-shaped pattern — they read across the top,
then scan down the left side, making shorter horizontal movements as they go lower.

**Why it matters**: Content placed in the F-pattern gets seen. Content outside it gets skipped. This is why navigation
at the top works, why left-aligned content is read more than right-aligned, and why the most important element should be
in the upper-left quadrant.

**In Inkweave**: The hero title is at the top center (caught by the first horizontal scan). The search bar is directly
below (caught by the second scan). Featured cards are below that (caught during the vertical scan). This layout
naturally aligns with how users actually scan.

**Rule of thumb**: Put your most important content in the top third of the page. Left-align primary labels and actions.
Don't bury critical CTAs in the bottom-right corner — that's the deadest zone on the page.

---

## Further Reading

- **Don't Make Me Think** by Steve Krug — The most accessible introduction to web usability
- **The Design of Everyday Things** by Don Norman — Where "affordance" and "mental model" originated
- **100 Things Every Designer Needs to Know About People** by Susan Weinschenk — Quick-reference UX psychology
- **Nielsen Norman Group** (nngroup.com) — Gold standard for UX research articles and heuristics
- **Laws of UX** (lawsofux.com) — Visual reference for UX laws including Hick's Law, Fitts's Law, and more
