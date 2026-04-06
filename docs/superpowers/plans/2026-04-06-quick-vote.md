# Quick Vote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-button quick vote control to the synergy detail modal so users can give directional feedback on synergy scores, with an animated distribution bar reveal after voting.

**Architecture:** New `useQuickVote` hook manages the vote state machine (hidden/ready/submitting/result/error). New `QuickVoteControl` component renders the UI and `DistributionBar` sub-component handles the animated bar. A small Supabase migration adds per-bucket accuracy columns to the `pair_scores` view. localStorage tracks which pairs the user has voted on.

**Tech Stack:** React 19, TypeScript, Vitest + RTL, Supabase RPC, CSS transitions, Storybook

**Spec:** `docs/superpowers/specs/2026-04-06-quick-vote-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/20260406000001_accuracy_distribution.sql` | Add accuracy_lower/right/higher columns to pair_scores view |
| Create | `apps/web/src/features/voting/hooks/useQuickVote.ts` | State machine hook: localStorage check, submit, fetch distribution |
| Create | `apps/web/src/features/voting/hooks/__tests__/useQuickVote.test.ts` | Hook unit tests |
| Create | `apps/web/src/features/voting/components/QuickVoteControl.tsx` | Vote UI component (all states, responsive) |
| Create | `apps/web/src/features/voting/components/__tests__/QuickVoteControl.test.tsx` | Component tests |
| Create | `apps/web/src/features/voting/components/DistributionBar.tsx` | Animated three-segment bar |
| Create | `apps/web/src/features/voting/components/__tests__/DistributionBar.test.tsx` | Bar component tests |
| Create | `apps/web/src/features/voting/components/QuickVoteControl.stories.tsx` | Storybook stories for all states |
| Create | `apps/web/src/features/voting/components/DistributionBar.stories.tsx` | Storybook stories for bar |
| Modify | `apps/web/src/shared/lib/supabase.ts` | Add `getAccuracyDistribution()` function |
| Modify | `apps/web/src/shared/lib/database.types.ts` | Regenerate after migration |
| Modify | `apps/web/src/features/voting/hooks/index.ts` | Export useQuickVote |
| Modify | `apps/web/src/features/voting/components/index.ts` | Export QuickVoteControl, DistributionBar |
| Modify | `apps/web/src/features/synergies/components/SynergyDetailModal.tsx` | Integrate QuickVoteControl below tier label |
| Modify | `apps/web/src/features/synergies/components/__tests__/SynergyDetailModal.test.tsx` | Add integration tests |

---

### Task 1: Supabase Migration — accuracy distribution columns

**Files:**
- Create: `supabase/migrations/20260406000001_accuracy_distribution.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Replace pair_scores view to add per-bucket accuracy breakdown
create or replace view pair_scores as
select
  card_a_id,
  card_b_id,
  count(*)         as total_votes,
  count(score)     as score_votes,
  count(accuracy)  as accuracy_votes,

  internal.trimmed_mean(
    array_agg(score::numeric) filter (where score is not null)
  )::numeric(4,2)  as avg_score,

  avg(accuracy)::numeric(3,2)         as accuracy_sentiment,
  count(*) filter (where accuracy = -1) as accuracy_lower,
  count(*) filter (where accuracy = 0)  as accuracy_right,
  count(*) filter (where accuracy = 1)  as accuracy_higher,
  avg(is_real::int)::numeric(3,2)     as pct_real,
  avg(would_play::int)::numeric(3,2)  as pct_would_play,
  count(*) filter (where who_carries = 'a')    as carries_a,
  count(*) filter (where who_carries = 'b')    as carries_b,
  count(*) filter (where who_carries = 'both') as carries_both,
  avg(difficulty)::numeric(3,2)       as avg_difficulty

from votes
group by card_a_id, card_b_id;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `apply_migration` MCP tool with the SQL above. Then verify with `execute_sql`:

```sql
select column_name from information_schema.columns
where table_name = 'pair_scores'
and column_name like 'accuracy_%'
order by column_name;
```

Expected: `accuracy_higher`, `accuracy_lower`, `accuracy_right`, `accuracy_sentiment`, `accuracy_votes`

- [ ] **Step 3: Regenerate TypeScript types**

Use Supabase MCP `generate_typescript_types` tool. Save output to `apps/web/src/shared/lib/database.types.ts`. Verify the `pair_scores` Row type now includes `accuracy_lower: number | null`, `accuracy_right: number | null`, `accuracy_higher: number | null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260406000001_accuracy_distribution.sql apps/web/src/shared/lib/database.types.ts
git commit -m "feat(supabase): add accuracy distribution columns to pair_scores view (#212)"
```

---

### Task 2: Supabase client — getAccuracyDistribution

**Files:**
- Modify: `apps/web/src/shared/lib/supabase.ts`

- [ ] **Step 1: Write the failing test**

Create a test inline in the existing supabase test file or a new one. Since supabase.ts doesn't have tests yet (it's a thin client), we'll test `getAccuracyDistribution` through the `useQuickVote` hook tests in Task 4. For now, add the function.

- [ ] **Step 2: Add AccuracyDistribution type and function**

Add to `apps/web/src/shared/lib/supabase.ts` after the `getPairScore` function:

```typescript
export type AccuracyDistribution = {
  lower: number;
  right: number;
  higher: number;
  total: number;
};

export async function getAccuracyDistribution(
  cardA: string,
  cardB: string,
): Promise<AccuracyDistribution | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [a, b] = [cardA, cardB].sort();

  try {
    const { data, error } = await supabase
      .from('pair_scores')
      .select('accuracy_lower, accuracy_right, accuracy_higher')
      .eq('card_a_id', a)
      .eq('card_b_id', b)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[getAccuracyDistribution] Supabase query failed:', {
        code: error.code,
        message: error.message,
        pair: `${a} / ${b}`,
      });
      return null;
    }

    const lower = data.accuracy_lower ?? 0;
    const right = data.accuracy_right ?? 0;
    const higher = data.accuracy_higher ?? 0;

    return { lower, right, higher, total: lower + right + higher };
  } catch (e) {
    console.error('[getAccuracyDistribution] Network error:', e);
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/shared/lib/supabase.ts
git commit -m "feat(supabase): add getAccuracyDistribution query (#212)"
```

---

### Task 3: DistributionBar component

**Files:**
- Create: `apps/web/src/features/voting/components/DistributionBar.tsx`
- Create: `apps/web/src/features/voting/components/__tests__/DistributionBar.test.tsx`
- Create: `apps/web/src/features/voting/components/DistributionBar.stories.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// DistributionBar.test.tsx
import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {DistributionBar} from '../DistributionBar';

describe('DistributionBar', () => {
  it('renders three segments with percentages', () => {
    render(<DistributionBar lower={3} right={14} higher={3} animate={false} />);

    expect(screen.getByText('15%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    // Two segments show 15%
    expect(screen.getAllByText('15%')).toHaveLength(2);
  });

  it('renders labels below the bar', () => {
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} />);

    expect(screen.getByText('Should be lower')).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('Should be higher')).toBeInTheDocument();
  });

  it('handles all votes in one bucket', () => {
    render(<DistributionBar lower={0} right={10} higher={0} animate={false} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles single vote', () => {
    render(<DistributionBar lower={1} right={0} higher={0} animate={false} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/components/__tests__/DistributionBar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement DistributionBar**

```typescript
// DistributionBar.tsx
import {COLORS, FONT_SIZES} from '../../../shared/constants';

interface DistributionBarProps {
  lower: number;
  right: number;
  higher: number;
  animate: boolean;
}

const SEGMENT_COLORS = {
  lower: {bg: 'rgba(245, 144, 144, 0.25)', text: '#f59090'},
  right: {bg: 'rgba(110, 231, 160, 0.2)', text: '#6ee7a0'},
  higher: {bg: 'rgba(96, 181, 245, 0.2)', text: '#60b5f5'},
} as const;

const LABELS = {
  lower: 'Should be lower',
  right: 'About right',
  higher: 'Should be higher',
} as const;

export function DistributionBar({lower, right, higher, animate}: DistributionBarProps) {
  const total = lower + right + higher;
  if (total === 0) return null;

  const pct = {
    lower: Math.round((lower / total) * 100),
    right: Math.round((right / total) * 100),
    higher: Math.round((higher / total) * 100),
  };

  // Fix rounding to sum to 100
  const diff = 100 - pct.lower - pct.right - pct.higher;
  if (diff !== 0) {
    const largest = Object.entries(pct).sort(([, a], [, b]) => b - a)[0][0] as keyof typeof pct;
    pct[largest] += diff;
  }

  const segments = (['lower', 'right', 'higher'] as const).filter((key) => pct[key] > 0);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          height: 28,
          borderRadius: 6,
          overflow: 'hidden',
          gap: 2,
        }}>
        {segments.map((key, i) => (
          <div
            key={key}
            style={{
              flex: animate ? undefined : pct[key],
              width: animate ? `${pct[key]}%` : undefined,
              background: SEGMENT_COLORS[key].bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${FONT_SIZES.xs}px`,
              color: SEGMENT_COLORS[key].text,
              fontWeight: 600,
              borderRadius:
                i === 0 && segments.length > 1
                  ? '6px 0 0 6px'
                  : i === segments.length - 1 && segments.length > 1
                    ? '0 6px 6px 0'
                    : segments.length === 1
                      ? '6px'
                      : undefined,
              transition: animate ? 'width 500ms ease-out' : undefined,
              transitionDelay: animate ? `${i * 50}ms` : undefined,
            }}>
            {pct[key]}%
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontSize: `${FONT_SIZES.micro}px`,
          color: COLORS.textMuted,
        }}>
        <span>{LABELS.lower}</span>
        <span>{LABELS.right}</span>
        <span>{LABELS.higher}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/components/__tests__/DistributionBar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Write stories**

```typescript
// DistributionBar.stories.tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {DistributionBar} from './DistributionBar';

const meta = {
  title: 'Voting/DistributionBar',
  component: DistributionBar,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 400, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DistributionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  args: {lower: 15, right: 68, higher: 17, animate: false},
};

export const Animated: Story = {
  args: {lower: 15, right: 68, higher: 17, animate: true},
};

export const Unanimous: Story = {
  args: {lower: 0, right: 25, higher: 0, animate: false},
};

export const Controversial: Story = {
  args: {lower: 12, right: 5, higher: 13, animate: false},
};

export const SingleVote: Story = {
  args: {lower: 0, right: 1, higher: 0, animate: false},
};
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/voting/components/DistributionBar.tsx \
  apps/web/src/features/voting/components/__tests__/DistributionBar.test.tsx \
  apps/web/src/features/voting/components/DistributionBar.stories.tsx
git commit -m "feat(voting): add DistributionBar component (#212)"
```

---

### Task 4: useQuickVote hook

**Files:**
- Create: `apps/web/src/features/voting/hooks/useQuickVote.ts`
- Create: `apps/web/src/features/voting/hooks/__tests__/useQuickVote.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// useQuickVote.test.ts
import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useQuickVote} from '../useQuickVote';
import {getSupabase, submitVote, getAccuracyDistribution} from '../../../../shared/lib/supabase';

vi.mock('../../../../shared/lib/supabase', () => ({
  getSupabase: vi.fn(),
  submitVote: vi.fn(),
  getAccuracyDistribution: vi.fn(),
}));

const CARD_A = 'card-aaa';
const CARD_B = 'card-bbb';
// Canonical key: sorted
const STORAGE_KEY = `inkweave:vote:${CARD_A}:${CARD_B}`;

describe('useQuickVote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns hidden state when Supabase is unavailable', () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('hidden');
  });

  it('returns ready state when Supabase is available and no prior vote', () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('ready');
  });

  it('returns result state when pair found in localStorage', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 3, right: 10, higher: 2, total: 15,
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({accuracy: 0, timestamp: Date.now()}));

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
  });

  it('submits vote, stores in localStorage, and fetches distribution', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: null});
    vi.mocked(getAccuracyDistribution).mockResolvedValue({
      lower: 1, right: 5, higher: 0, total: 6,
    });

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));
    expect(result.current.state).toBe('ready');

    await act(async () => {
      await result.current.vote(0);
    });

    expect(submitVote).toHaveBeenCalledWith({
      cardA: CARD_A,
      cardB: CARD_B,
      accuracy: 0,
    });
    expect(result.current.state).toBe('result');
    expect(result.current.userChoice).toBe(0);
    expect(result.current.distribution).toEqual({
      lower: 1, right: 5, higher: 0, total: 6,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('transitions to error state on submission failure', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: 'Network error'});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(1);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('error');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('transitions to rate-limited state', async () => {
    vi.mocked(getSupabase).mockReturnValue({} as ReturnType<typeof getSupabase>);
    vi.mocked(submitVote).mockResolvedValue({error: 'rate_limited'});

    const {result} = renderHook(() => useQuickVote(CARD_A, CARD_B));

    await act(async () => {
      await result.current.vote(-1);
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('rate_limited');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/hooks/__tests__/useQuickVote.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement useQuickVote**

```typescript
// useQuickVote.ts
import {useState, useEffect, useCallback, useMemo} from 'react';
import {
  getSupabase,
  submitVote,
  getAccuracyDistribution,
  type AccuracyDistribution,
} from '../../../shared/lib/supabase';

export type QuickVoteState = 'hidden' | 'ready' | 'submitting' | 'result' | 'error';
export type QuickVoteError = 'error' | 'rate_limited' | null;
type Accuracy = -1 | 0 | 1;

function storageKey(cardA: string, cardB: string): string {
  const [a, b] = [cardA, cardB].sort();
  return `inkweave:vote:${a}:${b}`;
}

function getStoredVote(cardA: string, cardB: string): Accuracy | null {
  try {
    const raw = localStorage.getItem(storageKey(cardA, cardB));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.accuracy ?? null;
  } catch {
    return null;
  }
}

function storeVote(cardA: string, cardB: string, accuracy: Accuracy): void {
  localStorage.setItem(
    storageKey(cardA, cardB),
    JSON.stringify({accuracy, timestamp: Date.now()}),
  );
}

export interface UseQuickVoteReturn {
  state: QuickVoteState;
  vote: (accuracy: Accuracy) => Promise<void>;
  distribution: AccuracyDistribution | null;
  userChoice: Accuracy | null;
  error: QuickVoteError;
}

export function useQuickVote(cardA: string, cardB: string): UseQuickVoteReturn {
  const isAvailable = useMemo(() => getSupabase() !== null, []);
  const storedChoice = useMemo(() => getStoredVote(cardA, cardB), [cardA, cardB]);

  const [state, setState] = useState<QuickVoteState>(() => {
    if (!isAvailable) return 'hidden';
    if (storedChoice !== null) return 'result';
    return 'ready';
  });
  const [userChoice, setUserChoice] = useState<Accuracy | null>(storedChoice);
  const [distribution, setDistribution] = useState<AccuracyDistribution | null>(null);
  const [error, setError] = useState<QuickVoteError>(null);

  // Fetch distribution for returning voters
  useEffect(() => {
    if (state === 'result' && !distribution) {
      getAccuracyDistribution(cardA, cardB).then((dist) => {
        if (dist) setDistribution(dist);
      });
    }
  }, [state, distribution, cardA, cardB]);

  const vote = useCallback(
    async (accuracy: Accuracy) => {
      if (state !== 'ready' && state !== 'error') return;

      setState('submitting');
      setError(null);

      const result = await submitVote({cardA, cardB, accuracy});

      if (result.error === null) {
        storeVote(cardA, cardB, accuracy);
        setUserChoice(accuracy);
        setState('result');
        const dist = await getAccuracyDistribution(cardA, cardB);
        if (dist) setDistribution(dist);
      } else if (result.error === 'rate_limited') {
        setError('rate_limited');
        setState('error');
      } else {
        setError('error');
        setState('error');
      }
    },
    [cardA, cardB, state],
  );

  return {state, vote, distribution, userChoice, error};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/hooks/__tests__/useQuickVote.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Export from hooks index**

Add to `apps/web/src/features/voting/hooks/index.ts`:

```typescript
export {useQuickVote} from './useQuickVote';
export type {UseQuickVoteReturn, QuickVoteState, QuickVoteError} from './useQuickVote';
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/voting/hooks/useQuickVote.ts \
  apps/web/src/features/voting/hooks/__tests__/useQuickVote.test.ts \
  apps/web/src/features/voting/hooks/index.ts
git commit -m "feat(voting): add useQuickVote hook (#212)"
```

---

### Task 5: QuickVoteControl component

**Files:**
- Create: `apps/web/src/features/voting/components/QuickVoteControl.tsx`
- Create: `apps/web/src/features/voting/components/__tests__/QuickVoteControl.test.tsx`
- Create: `apps/web/src/features/voting/components/QuickVoteControl.stories.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// QuickVoteControl.test.tsx
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {QuickVoteControl} from '../QuickVoteControl';
import type {AccuracyDistribution} from '../../../../shared/lib/supabase';

const mockVote = vi.fn();

describe('QuickVoteControl', () => {
  it('renders nothing when state is hidden', () => {
    const {container} = render(
      <QuickVoteControl state="hidden" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders three vote buttons in ready state', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    expect(screen.getByText('Do you agree with this score?')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Should be lower'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'About right'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Should be higher'})).toBeInTheDocument();
  });

  it('calls onVote with -1 when "Should be lower" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Should be lower'}));
    expect(mockVote).toHaveBeenCalledWith(-1);
  });

  it('calls onVote with 0 when "About right" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'About right'}));
    expect(mockVote).toHaveBeenCalledWith(0);
  });

  it('calls onVote with 1 when "Should be higher" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Should be higher'}));
    expect(mockVote).toHaveBeenCalledWith(1);
  });

  it('disables buttons during submitting state', () => {
    render(
      <QuickVoteControl state="submitting" onVote={mockVote} distribution={null} userChoice={0} error={null} />,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('shows distribution bar and confirmation in result state', () => {
    const dist: AccuracyDistribution = {lower: 3, right: 14, higher: 3, total: 20};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} />,
    );
    expect(screen.getByText(/You voted:/)).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('20 votes on this pair')).toBeInTheDocument();
  });

  it('shows first voter badge when total is 1', () => {
    const dist: AccuracyDistribution = {lower: 0, right: 1, higher: 0, total: 1};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} />,
    );
    expect(screen.getByText('First to rate this pair!')).toBeInTheDocument();
  });

  it('shows error message and re-enables buttons on error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="error" />,
    );
    expect(screen.getByText('Something went wrong, try again')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button').filter((b) => !b.textContent?.includes('Rate'));
    buttons.forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('shows rate limit message on rate_limited error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="rate_limited" />,
    );
    expect(screen.getByText("You're voting fast! Try again in a bit.")).toBeInTheDocument();
  });

  it('shows disabled "Rate in detail" teaser', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    const teaser = screen.getByText(/Rate in detail/);
    expect(teaser).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/components/__tests__/QuickVoteControl.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement QuickVoteControl**

This is a TODO(human) step — see the Learn by Doing request below.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web vitest run src/features/voting/components/__tests__/QuickVoteControl.test.tsx`
Expected: PASS (10 tests)

- [ ] **Step 5: Write stories**

```typescript
// QuickVoteControl.stories.tsx
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {QuickVoteControl} from './QuickVoteControl';

const meta = {
  title: 'Voting/QuickVoteControl',
  component: QuickVoteControl,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
  args: {onVote: fn()},
} satisfies Meta<typeof QuickVoteControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {state: 'ready', distribution: null, userChoice: null, error: null},
};

export const Submitting: Story = {
  args: {state: 'submitting', distribution: null, userChoice: 0, error: null},
};

export const Result: Story = {
  args: {
    state: 'result',
    distribution: {lower: 15, right: 68, higher: 17, total: 100},
    userChoice: 0,
    error: null,
  },
};

export const ResultFirstVoter: Story = {
  args: {
    state: 'result',
    distribution: {lower: 0, right: 1, higher: 0, total: 1},
    userChoice: 0,
    error: null,
  },
};

export const Error: Story = {
  args: {state: 'error', distribution: null, userChoice: null, error: 'error'},
};

export const RateLimited: Story = {
  args: {state: 'error', distribution: null, userChoice: null, error: 'rate_limited'},
};

export const Mobile: Story = {
  args: {state: 'ready', distribution: null, userChoice: null, error: null},
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};

export const MobileResult: Story = {
  args: {
    state: 'result',
    distribution: {lower: 8, right: 30, higher: 12, total: 50},
    userChoice: 1,
    error: null,
  },
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};
```

- [ ] **Step 6: Export from components index**

Add to `apps/web/src/features/voting/components/index.ts`:

```typescript
export {QuickVoteControl} from './QuickVoteControl';
export {DistributionBar} from './DistributionBar';
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/voting/components/QuickVoteControl.tsx \
  apps/web/src/features/voting/components/__tests__/QuickVoteControl.test.tsx \
  apps/web/src/features/voting/components/QuickVoteControl.stories.tsx \
  apps/web/src/features/voting/components/index.ts
git commit -m "feat(voting): add QuickVoteControl component (#212)"
```

---

### Task 6: Integrate into SynergyDetailModal

**Files:**
- Modify: `apps/web/src/features/synergies/components/SynergyDetailModal.tsx`
- Modify: `apps/web/src/features/synergies/components/__tests__/SynergyDetailModal.test.tsx`

- [ ] **Step 1: Write failing integration test**

Add to the existing `SynergyDetailModal.test.tsx`:

```typescript
// Add mock at top of file with other mocks
vi.mock('../../../features/voting/hooks/useQuickVote', () => ({
  useQuickVote: vi.fn().mockReturnValue({
    state: 'ready',
    vote: vi.fn(),
    distribution: null,
    userChoice: null,
    error: null,
  }),
}));

// Add test
it('renders quick vote control below tier label', () => {
  render(
    <SynergyDetailModal
      isOpen={true}
      onClose={vi.fn()}
      pair={mockPair}
      onViewSynergies={vi.fn()}
    />,
  );
  expect(screen.getByText('Do you agree with this score?')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `pnpm --filter inkweave-web vitest run src/features/synergies/components/__tests__/SynergyDetailModal.test.tsx`
Expected: FAIL — "Do you agree with this score?" not found

- [ ] **Step 3: Add QuickVoteControl to SynergyDetailModal**

In `SynergyDetailModal.tsx`, add import at top:

```typescript
import {QuickVoteControl} from '../../voting/components';
import {useQuickVote} from '../../voting/hooks';
```

Inside the `SynergyDetailModal` function, after destructuring `pair`, add the hook call:

```typescript
const quickVote = useQuickVote(cardA.id, cardB.id);
```

Then insert `QuickVoteControl` between the tier label `</div>` (line 152) and the connections section (line 154):

```tsx
          {/* Quick vote */}
          <div style={{padding: '0 24px 16px'}}>
            <QuickVoteControl
              state={quickVote.state}
              onVote={quickVote.vote}
              distribution={quickVote.distribution}
              userChoice={quickVote.userChoice}
              error={quickVote.error}
            />
          </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter inkweave-web vitest run src/features/synergies/components/__tests__/SynergyDetailModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass (engine 195 + web 541+ new tests)

- [ ] **Step 6: Visual verification**

Start dev server (`pnpm dev`), navigate to a card with synergies, click a synergy card to open the modal. Verify:
- Vote section appears below "Strong Synergy" label
- Three buttons render correctly
- Clicking a button submits (check Network tab for Supabase RPC call)
- Distribution bar appears after voting
- On mobile viewport, buttons stack vertically

Use Chrome DevTools MCP screenshot to verify.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/synergies/components/SynergyDetailModal.tsx \
  apps/web/src/features/synergies/components/__tests__/SynergyDetailModal.test.tsx
git commit -m "feat(voting): integrate quick vote into synergy detail modal (#212)"
```

---

## Summary

| Task | What | Tests | Commit |
|------|------|-------|--------|
| 1 | Supabase migration: accuracy distribution columns | Verified via SQL query | `feat(supabase): add accuracy distribution columns` |
| 2 | `getAccuracyDistribution()` in supabase.ts | Tested via hook tests | `feat(supabase): add getAccuracyDistribution query` |
| 3 | DistributionBar component + stories | 4 unit tests | `feat(voting): add DistributionBar component` |
| 4 | useQuickVote hook | 6 unit tests | `feat(voting): add useQuickVote hook` |
| 5 | QuickVoteControl component + stories | 10 unit tests | `feat(voting): add QuickVoteControl component` |
| 6 | Integrate into SynergyDetailModal | 1 integration test + visual | `feat(voting): integrate quick vote into synergy detail modal` |
