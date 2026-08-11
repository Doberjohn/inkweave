## Building with Inkweave

Inkweave is a **dark-fantasy Lorcana** design system. Everything below is verified against
the shipped bundle — if something here doesn't resolve, prefer the real files over this note.

### Setup

Components are on `window.Inkweave` (loaded from the root `_ds_bundle.js`). Load
`styles.css` — it is the entire style closure (fonts + all component CSS).

**The ground is near-black.** `styles.css` sets `body { background: #0d0d14; color: #e8e8e8 }`.
Every component is designed for that surface; on a light background they are unreadable.
Never place these components on white.

**Wrap navigation-aware components in a router.** `react-router` v7 ships on the same
global, so use `window.Inkweave.MemoryRouter` — importing your own copy creates a second
module instance whose context the components cannot see, and they throw
"useLocation() may be used only in the context of a `<Router>`". Components needing it
include `Header`, `Footer`, `Breadcrumb`, `BackLink`, `MobileBottomNav`, `CompactHeader`,
`SynergyGroup`, `DeckSummaryCard`, and every `*Page`.

**Wrap auth-aware components in `SessionProvider`** (also on the global) — `AuthButton`,
`SignInDialog`, and the `*Page` components. It no-ops safely without Supabase env.
`CardDataProvider` and `CardModalProvider` are on the global too, for card-browsing surfaces.

```jsx
const {MemoryRouter, SessionProvider, Header} = window.Inkweave;
<MemoryRouter><SessionProvider><Header /></SessionProvider></MemoryRouter>
```

### Styling idiom: inline styles with token VALUES — there are no utility classes

Inkweave styles via React `style={{…}}` objects plus Radix primitives for behavior. There
is no class vocabulary to learn and **no `bg-*`/`text-*` utilities** — do not invent any.
The library's own token constants are compiled into the bundle but are **not exported**, so
for your own layout glue use these literal values:

**Surfaces (elevation is LIGHTNESS, not shadow — on near-black, drop-shadows barely read):**
`background #0d0d14` · `surface #1a1a2e` · `surfaceRaised #1e1e35` · `surfaceFloating #222240`
· `surfaceOverlay #252545` · `surfaceHover #252540` · `surfaceBorder #333355`

**Brand + text:** `primary #ffb900` (THE gold) · `primaryHover #ffc933` · `primaryMuted #d49a00`
· `text #e8e8e8` · `textMuted #90a1b9` · `textDim #666680`

**Semantic:** `error #ef4444` · `success #4ade80` · scrim `rgba(4,4,10,0.72)` ·
scrimHeavy `rgba(0,0,0,0.85)`. **Never use `backdrop-filter`** on scrims — solid colors only.

**The six inks** (`{bg, text, border}`): Amber `#3d2c0f/#f7c164/#e69200` · Amethyst
`#2f1c31/#ca8bd0/#933b9b` · Emerald `#133a1d/#6bf08e/#0c9d32` · Ruby `#371518/#e7747e/#c31d2b`
· Sapphire `#0f323d/#64d3f7/#0096c7` · Steel `#22272b/#a5afb6/#7d8c96`

**Spacing (px):** xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32
**Radius (px):** xs 2 · sm 4 · md 6 · lg 8 · card 12 · xl 14 · sheet 24 · **pill 999**
**Font sizes (px):** xs 10 · sm 11 · md 12 · base 13 · lg 14 · xl 16 · xxl 20 · xxxl 22 ·
displaySm 28 · displayMd 38 · displayLg 52

**Type:** body is `'Plus Jakarta Sans', -apple-system, sans-serif`; the hero serif is
`var(--font-hero, 'Marcellus', Georgia, serif)`. The page sets `font-synthesis: none` and
only real faces ship — **body 400/500/600/700 and serif 400 only**. Any other weight
silently renders as the nearest loaded face, so never ask for 800 or a bold serif.

### Where the truth lives

- `styles.css` and its imports (`fonts/fonts.css`, `_ds_bundle.css`) — the real, complete CSS.
- `components/<group>/<Name>/<Name>.d.ts` — the actual props contract, with doc comments.
- `components/<group>/<Name>/<Name>.prompt.md` — real usage examples taken from the
  library's own stories. **Read this before composing a component you haven't used**; it is
  the most reliable guide to intended props.
- `guidelines/docs/UX_REFERENCE.md` and `UX_AUDIT.md` — product UX conventions.

### An idiomatic snippet

```jsx
const {ScoreRing, Chip, EmptyState} = window.Inkweave;

<div style={{
  background: '#1a1a2e', border: '1px solid #333355', borderRadius: 12,
  padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
  fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif", color: '#e8e8e8',
}}>
  <span style={{fontSize: 16, fontWeight: 600}}>Deck health</span>
  <ScoreRing score={88} color="#4ade80" size={64} label="Excellent" />
  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
    <Chip variant="toggle" label="Amber" />
    <Chip variant="toggle" label="Steel" style={{opacity: 0.6}} />
  </div>
</div>
```

Library components for the parts; inline styles with the values above for your own layout.
