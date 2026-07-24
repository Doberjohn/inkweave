# Analysis-tab redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the deck-builder Analysis tab as one coherent story — verdict → add these → health at a glance → details on demand — so a builder understands their deck without hitting jargon.

**Architecture:** Presentation-only. `DeckAnalysis` already carries `quality`, `health`, `synergy`, and `suggestions` (the last shipped in #471 Part A). We add four presentational components + one pure copy helper, recompose `DeckAdvisorPanel` around them, thread `onIncrement` into the Analysis tab, and delete the confusing `SynergySurface`. No engine/scoring change.

**Tech Stack:** React 19 + TS, inline styles off `shared/constants` design tokens, kit components (`CtaButton`), vitest + Testing Library, Storybook. React Compiler (no `useMemo`/`useCallback`).

**Spec:** [`2026-07-24-advisor-tab-redesign-design.md`](2026-07-24-advisor-tab-redesign-design.md)

---

## Reconciliation with existing code (read before starting)

- **Reuse `scoreTier`** (`src/features/deck/components/scoreTier.ts`): `scoreTier(score) → {label, color}` with `Excellent ≥80 / Strong ≥60 / Fair ≥40 / Needs work`. Do **not** create a new tier table — the spec's proposed 5-tier list is superseded by this existing 4-tier one for consistency (`ScoreGauge`/`HealthVariants` already use it).
- **Reuse `dimensionColor`** (`src/features/deck/components/dimensionColor.ts`): `dimensionColor(status) → color` (good→success, warn→amber, bad→error) for the health-glance dots.
- **No "disable at 4":** `rankSuggestions` already drops candidates at the 4-copy cap, so a suggestion is always addable; the Add button is always enabled and the list refreshes on the next (debounced) analysis pass.
- **Keep the Part-B plumbing:** `getCardById` was threaded `DeckBuilderPage → DeckPanel → AnalysisTab` in #471 Part B — that stays. This plan additionally threads `onIncrement` the same way. Only `SynergySurface` is removed.

## File structure

### Create
| File | Responsibility |
|------|----------------|
| `src/features/deck/components/describeReason.ts` | pure: raw suggestion reason → friendly one-liner |
| `src/features/deck/components/describeReason.test.ts` | unit tests for the mapping |
| `src/features/deck/components/SuggestionList.tsx` | Zone 2: `Suggestion[]` → add-rows (`SuggestionRow` internal) |
| `src/features/deck/components/SuggestionList.stories.tsx` | stories |
| `src/features/deck/components/SuggestionList.test.tsx` | tests |
| `src/features/deck/components/HealthGlance.tsx` | Zone 3: dimension dots + biggest-issue callout |
| `src/features/deck/components/HealthGlance.stories.tsx` | stories |
| `src/features/deck/components/HealthGlance.test.tsx` | tests |
| `src/features/deck/components/VerdictLine.tsx` | Zone 1: archetype + gameplan + tier·score |
| `src/features/deck/components/VerdictLine.stories.tsx` | stories |
| `src/features/deck/components/VerdictLine.test.tsx` | tests |

### Modify
| File | Change |
|------|--------|
| `src/features/deck/components/DeckAdvisorPanel.tsx` | recompose into the four zones + Details disclosure |
| `src/features/deck/components/DeckAdvisorPanel.test.tsx` | update for the new structure + `onIncrement` prop |
| `src/features/deck/components/DeckAdvisorPanel.stories.tsx` | add `onIncrement` arg |
| `src/features/deck/components/DeckPanel.tsx` | thread `onIncrement` into `AnalysisTab` → `DeckAdvisorPanel`; remove `SynergySurface` render + import |
| `src/pages/DeckBuilderPage.tsx` | (already passes `onIncrement` to `DeckPanel`; no change needed) |

### Delete
- `src/features/deck/components/SynergySurface.tsx`
- `src/features/deck/components/SynergySurface.stories.tsx`
- `src/features/deck/components/SynergySurface.test.tsx`

---

### Task 1: `describeReason` (pure copy helper)

**Files:**
- Create: `src/features/deck/components/describeReason.ts`
- Test: `src/features/deck/components/describeReason.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {describe, expect, it} from 'vitest';
import {describeReason} from './describeReason';

describe('describeReason', () => {
  it('rewords the fixed reasons for humans', () => {
    expect(describeReason('Fills removal gap')).toBe("Adds removal you're short on");
    expect(describeReason('Fills card-draw gap')).toBe("Adds card draw you're short on");
    expect(describeReason('BECKON enabler for Merida')).toBe('Feeds your Merida engine');
    expect(describeReason('Shift target for a card in the deck')).toBe('A Shift target for your deck');
    expect(describeReason('On-curve Song for a Singer')).toBe('A song your singers can play free');
  });

  it('extracts the number from the dynamic reasons', () => {
    expect(describeReason('Fills curve hole at cost 3')).toBe('Fills a gap at 3 cost');
    expect(describeReason('Synergizes with 6 deck cards')).toBe('Works with 6 of your cards');
    expect(describeReason('Synergizes with 1 deck card')).toBe('Works with 1 of your cards');
  });

  it('passes an unknown reason through unchanged', () => {
    expect(describeReason('Something new')).toBe('Something new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/features/deck/components/describeReason.test.ts`
Expected: FAIL — `describeReason` not defined.

- [ ] **Step 3: Write the implementation**

```ts
// Turns a raw rankSuggestions reason string into a friendly one-liner for the
// SuggestionList. The engine emits terse/jargon reasons; this is the view-layer
// rewording. Unknown reasons pass through unchanged (forward-compatible).

const FIXED: Record<string, string> = {
  'Fills removal gap': "Adds removal you're short on",
  'Fills card-draw gap': "Adds card draw you're short on",
  'BECKON enabler for Merida': 'Feeds your Merida engine',
  'Shift target for a card in the deck': 'A Shift target for your deck',
  'On-curve Song for a Singer': 'A song your singers can play free',
};

export function describeReason(reason: string): string {
  const fixed = FIXED[reason];
  if (fixed) return fixed;

  const curve = reason.match(/^Fills curve hole at cost (\d+)$/);
  if (curve) return `Fills a gap at ${curve[1]} cost`;

  const synergy = reason.match(/^Synergizes with (\d+) deck cards?$/);
  if (synergy) return `Works with ${synergy[1]} of your cards`;

  return reason;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/features/deck/components/describeReason.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/describeReason.ts apps/web/src/features/deck/components/describeReason.test.ts
USER_APPROVED=1 git commit -m "feat(deck): describeReason copy helper for suggestions (#471)"
```

---

### Task 2: `SuggestionList` (Zone 2 — the hero)

**Files:**
- Create: `src/features/deck/components/SuggestionList.tsx`, `.test.tsx`, `.stories.tsx`

**Component contract:**
```ts
interface SuggestionListProps {
  suggestions: Suggestion[];                 // analysis.suggestions (already ranked/capped)
  getCardById: (id: string) => LorcanaCard | undefined;
  onAdd: (cardId: string) => void;           // wraps deck onIncrement
  limit?: number;                            // default 4 (spec Zone 2)
}
```

- [ ] **Step 1: Write the failing test** — `SuggestionList.test.tsx`

```tsx
import {describe, expect, it, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import type {Suggestion} from '../types';
import {createCard} from '../../../shared/test-utils';
import {SuggestionList} from './SuggestionList';

const cards = [createCard({id: 'a', fullName: 'Grab Your Sword'}), createCard({id: 'b', fullName: 'Fire the Cannons'})];
const getCardById = (id: string) => cards.find((c) => c.id === id);
const sug = (cardId: string, reasons: string[]): Suggestion => ({
  cardId, synergyScore: 5, gapScore: 0, totalScore: 5, synergizesWith: [], reasons,
});

describe('SuggestionList', () => {
  it('renders a row per suggestion with a friendly reason and an Add button', () => {
    render(
      <SuggestionList
        suggestions={[sug('a', ['Synergizes with 6 deck cards']), sug('b', ['Fills removal gap'])]}
        getCardById={getCardById}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText('Grab Your Sword')).toBeInTheDocument();
    expect(screen.getByText('Works with 6 of your cards')).toBeInTheDocument();
    expect(screen.getByText("Adds removal you're short on")).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: /add/i})).toHaveLength(2);
  });

  it('caps the list at `limit`', () => {
    const many = ['a', 'b', 'a', 'b'].map((id) => sug(id, ['Fills removal gap']));
    render(<SuggestionList suggestions={many} getCardById={getCardById} onAdd={vi.fn()} limit={2} />);
    expect(screen.getAllByRole('button', {name: /add/i})).toHaveLength(2);
  });

  it('calls onAdd with the cardId when Add is clicked', () => {
    const onAdd = vi.fn();
    render(<SuggestionList suggestions={[sug('a', ['Fills removal gap'])]} getCardById={getCardById} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', {name: /add grab your sword/i}));
    expect(onAdd).toHaveBeenCalledWith('a');
  });

  it('shows an invitation when there are no suggestions', () => {
    render(<SuggestionList suggestions={[]} getCardById={getCardById} onAdd={vi.fn()} />);
    expect(screen.getByText(/add a few more cards/i)).toBeInTheDocument();
  });

  it('skips suggestions whose card no longer resolves', () => {
    render(<SuggestionList suggestions={[sug('gone', ['Fills removal gap'])]} getCardById={getCardById} onAdd={vi.fn()} />);
    expect(screen.queryByRole('button', {name: /add/i})).not.toBeInTheDocument();
    expect(screen.getByText(/add a few more cards/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/web && npx vitest run src/features/deck/components/SuggestionList.test.tsx` → FAIL (not defined).

- [ ] **Step 3: Implement `SuggestionList.tsx`**

```tsx
import {CAP_LABEL, COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, SURFACE_CARD} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components';
import {smallImageUrl} from '../../cards/loader';
import type {LorcanaCard, Suggestion} from '../types';
import {describeReason} from './describeReason';

interface SuggestionListProps {
  suggestions: Suggestion[];
  getCardById: (id: string) => LorcanaCard | undefined;
  onAdd: (cardId: string) => void;
  limit?: number;
}

interface ResolvedSuggestion {
  card: LorcanaCard;
  reason: string;
}

/** One add-row: thumbnail, name, plain reason, Add button. */
function SuggestionRow({card, reason, onAdd}: {card: LorcanaCard; reason: string; onAdd: () => void}) {
  const name = card.fullName || card.name || 'Unknown card';
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
      <div style={{width: 46, height: 21, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${COLORS.surfaceBorder}`}}>
        <img src={smallImageUrl(card)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '58% 4%'}} />
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{color: COLORS.text, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {name}
        </div>
        <div style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {reason}
        </div>
      </div>
      <CtaButton onClick={onAdd} aria-label={`Add ${name}`} style={{minHeight: 34, padding: `0 ${SPACING.md}px`, flexShrink: 0, fontSize: FONT_SIZES.md}}>
        Add
      </CtaButton>
    </div>
  );
}

/**
 * Zone 2 of the Analysis tab (#471): the ranked "add these cards" list — the tab's
 * primary, most-actionable content. Each row carries a plain-English reason
 * (describeReason) and an Add button. Resolves each suggestion's card via
 * getCardById; unresolved ids are dropped. Shows an invitation when empty.
 */
export function SuggestionList({suggestions, getCardById, onAdd, limit = 4}: SuggestionListProps) {
  const resolved: ResolvedSuggestion[] = suggestions
    .slice(0, limit)
    .map((s) => ({card: getCardById(s.cardId), reason: describeReason(s.reasons[0] ?? 'Strengthens your deck')}))
    .filter((r): r is ResolvedSuggestion => r.card != null);

  return (
    <div style={{...SURFACE_CARD, display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
      <div style={CAP_LABEL}>Add these to improve your deck</div>
      {resolved.length === 0 ? (
        <div style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
          Add a few more cards and suggestions will appear here.
        </div>
      ) : (
        resolved.map((r) => <SuggestionRow key={r.card.id} card={r.card} reason={r.reason} onAdd={() => onAdd(r.card.id)} />)
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/features/deck/components/SuggestionList.test.tsx` → PASS (5).

- [ ] **Step 5: Write `SuggestionList.stories.tsx`**

```tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {createCard} from '../../../shared/test-utils';
import {COLORS} from '../../../shared/constants';
import type {Suggestion} from '../types';
import {SuggestionList} from './SuggestionList';

const cards = [
  createCard({id: 'a', fullName: 'Grab Your Sword'}),
  createCard({id: 'b', fullName: 'Fire the Cannons'}),
  createCard({id: 'c', fullName: 'Mickey Mouse - Brave Little Tailor'}),
];
const getCardById = (id: string) => cards.find((c) => c.id === id);
const sug = (cardId: string, reasons: string[]): Suggestion => ({cardId, synergyScore: 5, gapScore: 0, totalScore: 5, synergizesWith: [], reasons});

const meta: Meta<typeof SuggestionList> = {
  title: 'Deck/SuggestionList',
  component: SuggestionList,
  decorators: [(Story) => <div style={{background: COLORS.background, width: 360, padding: 8}}><Story /></div>],
  tags: ['autodocs'],
  args: {getCardById, onAdd: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Ranked: Story = {
  args: {suggestions: [sug('b', ['Fills removal gap']), sug('a', ['Synergizes with 6 deck cards']), sug('c', ['On-curve Song for a Singer'])]},
};
export const Empty: Story = {args: {suggestions: []}};
```

- [ ] **Step 6: Verify lint + CodeScene + stories**

Run: `cd apps/web && npx eslint src/features/deck/components/SuggestionList.tsx && node scripts/check-story-coverage.mjs`
Expected: 0 errors; story coverage passes. Then check complexity with the CodeScene `code_health_review` MCP tool on `SuggestionList.tsx` — expect score ≥ 9 (extract more if a function exceeds CC 10).

- [ ] **Step 7: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/SuggestionList.*
USER_APPROVED=1 git commit -m "feat(deck): SuggestionList add-these zone (#471)"
```

---

### Task 3: `HealthGlance` (Zone 3)

**Files:** Create `HealthGlance.tsx`, `.test.tsx`, `.stories.tsx`

**Contract:**
```ts
interface HealthGlanceProps {
  analyzers: HealthAnalyzer[];        // health.analyzers (dots)
  vulnerabilities: Vulnerability[];   // health.vulnerabilities (issue callout fallback)
}
```

- [ ] **Step 1: Write the failing test** — `HealthGlance.test.tsx`

```tsx
import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import type {HealthAnalyzer} from '../types';
import {HealthGlance} from './HealthGlance';

const an = (id: string, label: string, status: HealthAnalyzer['status'], message: string): HealthAnalyzer => ({
  id, label, status, message, score: status === 'bad' ? 20 : 80,
});

describe('HealthGlance', () => {
  it('renders a labeled dot per analyzer', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok'), an('removal', 'Removal', 'bad', 'Only 4 removal cards')]} vulnerabilities={[]} />);
    expect(screen.getByText('Curve')).toBeInTheDocument();
    expect(screen.getByText('Removal')).toBeInTheDocument();
  });

  it('calls out the worst analyzer message', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok'), an('removal', 'Removal', 'bad', 'Only 4 removal cards')]} vulnerabilities={[]} />);
    expect(screen.getByText('Only 4 removal cards')).toBeInTheDocument();
  });

  it('shows no callout when every dimension is healthy', () => {
    render(<HealthGlance analyzers={[an('curve', 'Curve', 'good', 'ok')]} vulnerabilities={[]} />);
    expect(screen.queryByText('ok')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL.** `cd apps/web && npx vitest run src/features/deck/components/HealthGlance.test.tsx`

- [ ] **Step 3: Implement `HealthGlance.tsx`**

```tsx
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import type {HealthAnalyzer, Vulnerability} from '../types';
import {dimensionColor} from './dimensionColor';

interface HealthGlanceProps {
  analyzers: HealthAnalyzer[];
  vulnerabilities: Vulnerability[];
}

/** Order: worst status first, so the biggest problem is the callout. */
const STATUS_RANK: Record<HealthAnalyzer['status'], number> = {bad: 0, warn: 1, good: 2};

/** The single most important thing wrong, or null when the deck is clean. */
function worstMessage(analyzers: HealthAnalyzer[]): string | null {
  const problems = analyzers.filter((a) => a.status !== 'good').sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);
  return problems[0]?.message ?? null;
}

/**
 * Zone 3 of the Analysis tab (#471): a compact, jargon-free health read — one
 * colored dot per dimension (reusing dimensionColor), plus a single "biggest issue"
 * callout drawn from the worst-status analyzer. The full per-dimension breakdown
 * lives behind the Details disclosure.
 */
export function HealthGlance({analyzers, vulnerabilities}: HealthGlanceProps) {
  const callout = worstMessage(analyzers) ?? vulnerabilities[0]?.description ?? null;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      <div style={{display: 'flex', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.xs}}>
        {analyzers.map((a) => (
          <span key={a.id} style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textMuted}}>
            <span aria-hidden style={{width: 8, height: 8, borderRadius: '50%', background: dimensionColor(a.status), flexShrink: 0}} />
            {a.label}
          </span>
        ))}
      </div>
      {callout && (
        <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.text}}>
          <span style={{color: COLORS.error}}>▲</span> {callout}
        </div>
      )}
    </div>
  );
}
```

Note: confirm the `Vulnerability` type's field is `description`; if it differs (e.g. `message`), use that. Check `src/features/deck/types.ts`.

- [ ] **Step 4: Run → PASS.** Then write `HealthGlance.stories.tsx` (Healthy / OneProblem variants), lint, story-coverage, CodeScene review (expect ≥9).

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/HealthGlance.*
USER_APPROVED=1 git commit -m "feat(deck): HealthGlance compact health strip (#471)"
```

---

### Task 4: `VerdictLine` (Zone 1)

**Files:** Create `VerdictLine.tsx`, `.test.tsx`, `.stories.tsx`

**Contract:** reuses `ArchetypeBadge` (archetype + gameplan provenance) + the gameplan `SortSelect` + `scoreTier`.
```ts
interface VerdictLineProps {
  archetype: Archetype;
  archetypeConfidence: number;
  score: number;                                  // quality.score → scoreTier
  gameplan: Archetype | undefined;
  onGameplanChange: (g: Archetype | undefined) => void;
}
```

- [ ] **Step 1: Failing test** — assert the tier label + score render, and the archetype shows.

```tsx
import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {VerdictLine} from './VerdictLine';

describe('VerdictLine', () => {
  it('shows the tier word and score for the deck', () => {
    render(<VerdictLine archetype="aggro" archetypeConfidence={0.9} score={78} gameplan={undefined} onGameplanChange={vi.fn()} />);
    expect(screen.getByText('Strong')).toBeInTheDocument();   // scoreTier(78).label
    expect(screen.getByText('78')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `VerdictLine.tsx`** — a header row: `<ArchetypeBadge>` + gameplan `<SortSelect>` on the left (lift the `GAMEPLAN_OPTIONS`/`AUTO` currently inside `DeckAdvisorPanel.tsx` into a shared spot or re-declare minimally), and a tier·score chip on the right using `scoreTier(score)` for the label + color. Keep the existing header styling from `DeckAdvisorPanel`'s current top row (surface card, space-between) so it looks intentional. Full code lands during implementation following the `DeckAdvisorPanel` header block already in the repo.

- [ ] **Step 4: Run → PASS.** Story (Strong / NeedsWork / declared-gameplan), lint, story-coverage, CodeScene ≥9.

- [ ] **Step 5: Commit** `feat(deck): VerdictLine archetype + tier verdict (#471)`

---

### Task 5: Recompose `DeckAdvisorPanel` + wire `onIncrement` — **IN-APP DESIGN CHECKPOINT**

**Files:**
- Modify: `DeckAdvisorPanel.tsx`, `.test.tsx`, `.stories.tsx`
- Modify: `DeckPanel.tsx` (thread `onIncrement` into `AnalysisTab` → `DeckAdvisorPanel`)

- [ ] **Step 1:** Add `onIncrement: (cardId: string) => void` to `DeckAdvisorPanelProps`, and to `AnalysisTab`'s props; pass `onIncrement={onIncrement}` from `DeckPanel`'s `<AnalysisTab>` call (DeckPanel already receives `onIncrement`).

- [ ] **Step 2:** Rewrite `AdvisorContent` as the four zones (keep the `mathOpen` state + `ScoreMathModal`):

```tsx
return (
  <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
    <VerdictLine
      archetype={analysis.health.archetype}
      archetypeConfidence={analysis.health.archetypeConfidence}
      score={analysis.quality.score}
      gameplan={gameplan}
      onGameplanChange={onGameplanChange}
    />
    <SuggestionList suggestions={analysis.suggestions} getCardById={getCardById} onAdd={onIncrement} />
    <HealthGlance analyzers={analysis.health.analyzers} vulnerabilities={analysis.health.vulnerabilities} />
    <details>
      <summary style={{cursor: 'pointer', color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, padding: `${SPACING.xs}px 0`}}>
        Details — score math, health breakdown, cuts
      </summary>
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.sm}}>
        <ScoreGauge quality={analysis.quality} onShowMath={() => setMathOpen(true)} />
        <HealthGrid analyzers={analysis.health.analyzers} breakdown={analysis.quality.breakdown} />
        <VulnerabilityBox vulnerabilities={analysis.health.vulnerabilities} />
        {/* "Consider cutting" = synergy.weakLinks resolved via getCardById; small labeled list. */}
      </div>
    </details>
    {mathOpen && <ScoreMathModal score={analysis.quality.score} configVersion={analysis.quality.configVersion} analyzers={analysis.health.analyzers} breakdown={analysis.quality.breakdown} onClose={() => setMathOpen(false)} />}
  </div>
);
```

`DeckAdvisorPanel` now needs `getCardById` + `onIncrement` props (thread from `AnalysisTab`). The empty/loading branch is unchanged.

- [ ] **Step 3:** Update `DeckAdvisorPanel.test.tsx` (+ `.stories.tsx`) — the mocks already have `suggestions: []`; add `getCardById` + `onIncrement` args; assert the four zones render and Details is collapsed by default (`<details>` without `open`).

- [ ] **Step 4:** Verify: `pnpm --filter inkweave-web typecheck`, `npx eslint src`, run the deck test files, `node scripts/check-story-coverage.mjs`, and CodeScene `code_health_review` on `DeckAdvisorPanel.tsx` + `DeckPanel.tsx` (both must stay ≥ threshold — extract if a function tops CC 10).

- [ ] **Step 5: 🔴 DESIGN CHECKPOINT (do not skip):** Start the dev server, seed a populated deck (localStorage `inkweave:deck:draft`, then navigate `/decks/new`), open the Analysis tab, and verify the four zones in the **real dark+gold theme**. Because live screenshots can't composite here, capture the rendered structure + computed token values via the browser tools, **and present it to the user for approval.** Do NOT commit or proceed to Task 6 until the user confirms they like it in-app. Iterate on spacing/copy/emphasis here.

- [ ] **Step 6: Commit** (after user approval)

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/DeckAdvisorPanel.* apps/web/src/features/deck/components/DeckPanel.tsx
USER_APPROVED=1 git commit -m "feat(deck): recompose Analysis tab into verdict/add/health/details (#471)"
```

---

### Task 6: Remove `SynergySurface`

**Files:** Delete `SynergySurface.tsx/.stories.tsx/.test.tsx`; the `DeckPanel` import + render were already removed in Task 5's edit (confirm none remain).

- [ ] **Step 1:** `rm` the three files; `grep -rn SynergySurface apps/web/src` → expect none.
- [ ] **Step 2:** `pnpm --filter inkweave-web typecheck` + `npx eslint src` + `node scripts/check-story-coverage.mjs` → all green (no orphaned story).
- [ ] **Step 3: Commit** `refactor(deck): remove interim SynergySurface, superseded by the redesign (#471)`

---

### Task 7: Full verification + close-out

- [ ] **Step 1:** Full suite: `cd apps/web && CI=1 npx vitest run` → all pass.
- [ ] **Step 2:** `pnpm --filter inkweave-web typecheck`, `node scripts/check-design-tokens.mjs`, `node scripts/check-story-coverage.mjs` → all green.
- [ ] **Step 3:** CodeScene `analyze_change_set` against `origin/master` → `quality_gates: passed`.
- [ ] **Step 4:** Update spec status to "implemented"; note in `PLAN.md` that the type-split (item 19) was dropped by owner ruling and the synergy UI is now the redesigned tab. Append a #474 handoff entry; per-issue note on #471.
- [ ] **Step 5:** Push (free port 5173 first; pre-push runs typecheck → stories → design → E2E → CodeScene). Announce before stopping the dev server.

---

## Self-review

- **Spec coverage:** Zone 1 → Task 4 (VerdictLine, reusing `scoreTier`). Zone 2 → Tasks 1-2 (describeReason + SuggestionList). Zone 3 → Task 3 (HealthGlance). Zone 4 → Task 5 (Details disclosure wrapping the existing ScoreGauge/HealthGrid/VulnerabilityBox + a weak-links "cuts" list). SynergySurface removal → Task 6. Copy mapping → Task 1. All spec sections map to a task.
- **Placeholder scan:** Tasks 1-3 and 5 carry complete code; Task 4's `VerdictLine` body and Task 5's "consider cutting" list reference the existing repo header block / `synergy.weakLinks` + `getCardById` rather than restating boilerplate — during execution, write them out fully (no "TBD" ships).
- **Type consistency:** `getCardById: (id: string) => LorcanaCard | undefined`, `onAdd`/`onIncrement: (cardId: string) => void`, `Suggestion` (from `../types`), `scoreTier(score) → {label, color}`, `dimensionColor(status) → string` — consistent across tasks.
- **Open decisions carried from the spec:** suggestion `limit` default 4 (prop, trivially tunable at the checkpoint); "consider cutting" included in Details (drop in Task 5 if the checkpoint says it's noisy); tiers reuse the existing `scoreTier` (spec's 5-tier table dropped).
