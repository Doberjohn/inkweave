# Deck save, list, publish and share: Implementation Plan (#473)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a deck can be saved to an account, listed, opened, published and shared, using the `decks` table and RLS that are already deployed and currently unused.

**Architecture:** `deckRepository` already has full CRUD and is never called. This plan wires it up. `DeckContext` gains a bound/dirty lifecycle so a draft can become a cloud row and back; `DecksPage` gains two tabs; `DeckViewPage` stops being a placeholder. Cloud is the library, local stays one draft (spec decision A).

**Tech Stack:** React 19, TypeScript 6, react-router, Supabase JS, Vitest + Testing Library, Playwright.

**Spec:** [`2026-08-01-deck-save-share-publish-design.md`](2026-08-01-deck-save-share-publish-design.md). Read it first; it records why A+, removing localStorage, and gating `/decks` were each rejected.

**Branch:** stay on `deck-builder`. Do NOT cut a `feature/` branch: this epic's commits are unmerged to production.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/features/deck/state/deckRepository.ts` | **Modify.** Add `listPublicDecks`. |
| `apps/web/src/features/deck/state/deckStorage.ts` | **Modify.** Add the dirty-flag key and its read/write/clear. |
| `apps/web/src/features/deck/state/DeckContext.tsx` | **Modify.** Add `isDirty`, `markSaved`, `loadDeck`, `startNewDeck`; clear draft on sign-out. |
| `apps/web/src/features/deck/components/NewDeckDialog.tsx` | **Create.** Name + visibility + guest replace warning. |
| `apps/web/src/features/deck/components/SaveDeckDialog.tsx` | **Create.** Name + visibility + save, or sign-in prompt. |
| `apps/web/src/features/deck/components/ShareDeckButton.tsx` | **Create.** Copy link; offer publish when private. |
| `apps/web/src/features/deck/components/DeckSummaryCard.tsx` | **Create.** One row in either deck list. |
| `apps/web/src/pages/DecksPage.tsx` | **Modify.** TabList, both lists, empty states. |
| `apps/web/src/pages/DeckViewPage.tsx` | **Modify.** Replace the placeholder with a real read-only view. |
| `apps/web/src/pages/DeckBuilderPage.tsx` | **Modify.** Reset on `/new`, load by `:id` on `/:id/edit`. |
| `apps/web/e2e/fixtures/session.ts` | **Create.** Session stubbing; none exists in the suite today. |
| `apps/web/e2e/tests/deck-save-share.spec.ts` | **Create.** The issue's acceptance contract. |

Tasks are ordered so each leaves the tree green and commitable. Tasks 1-3 are pure logic and carry the subtlety; 4-8 are UI over them; 9 is the acceptance gate.

---

### Task 1: `listPublicDecks` in the repository

**Files:**
- Modify: `apps/web/src/features/deck/state/deckRepository.ts`
- Test: `apps/web/src/features/deck/state/deckRepository.test.ts`

- [ ] **Step 1: Read the existing conventions**

Open `deckRepository.ts` and read the header comment plus `listDecks`. Every call goes through the `run(async (c) => ...)` shell, returns `RepoResult<T>` (`{data, error}`), and maps rows with `rowToDeck`. Follow that exactly; do not add a new error style.

- [ ] **Step 2: Teach the test harness about `.limit`**

The file uses one shared chainable stand-in, `makeQuery`, whose method list is
`['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order']`. **It has no
`limit`**, so a `.limit()` call would throw inside the mock. Add it:

```ts
  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'limit']) {
```

Awaiting the builder already resolves via the harness's `then`, so no other change
is needed: `listPublicDecks` ends on `.limit()` and is awaited, exactly like
`listDecks` ends on `.order()`.

- [ ] **Step 3: Write the failing test**

Append to `apps/web/src/features/deck/state/deckRepository.test.ts`, using the
file's existing `prime` / `from` / `makeRow` helpers rather than hand-rolled mocks:

```ts
describe('listPublicDecks', () => {
  it('reads is_public rows newest-touched first, capped by limit', async () => {
    const q = prime({data: [makeRow({is_public: true})], error: null});

    const {data, error} = await listPublicDecks(24);

    expect(from).toHaveBeenCalledWith('decks');
    expect(q.select).toHaveBeenCalledWith('*');
    expect(q.eq).toHaveBeenCalledWith('is_public', true);
    expect(q.order).toHaveBeenCalledWith('updated_at', {ascending: false});
    expect(q.limit).toHaveBeenCalledWith(24);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('returns null data when the query errors', async () => {
    prime({data: null, error: {message: 'boom'}});
    const {data, error} = await listPublicDecks();
    expect(data).toBeNull();
    expect(error).toBe('boom');
  });
});
```

Add `listPublicDecks` to the existing import from `./deckRepository` at the top of
the file. `beforeEach` already wires `mockGetSupabase`, so do not re-wire it.

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state/deckRepository.test.ts`
Expected: FAIL, `listPublicDecks is not a function` or an import error.

- [ ] **Step 4: Implement**

Add directly below `listDecks` in `deckRepository.ts`:

```ts
/**
 * Every public deck, newest-touched first. Ordered to match the deployed partial
 * index `decks_public_updated_idx on (updated_at desc) where is_public`, so this
 * is an index-only scan rather than a heap sort.
 *
 * RLS already permits anon reads of is_public rows, so this works signed out and
 * is the community tab's data source. Legality filtering is NOT done here: it
 * needs per-card ink data that lives in allCards.json, not in the row.
 */
export function listPublicDecks(limit = 50): Promise<RepoResult<Deck[]>> {
  return run(async (c) => {
    const {data, error} = await c
      .from('decks')
      .select('*')
      .eq('is_public', true)
      .order('updated_at', {ascending: false})
      .limit(limit);
    return {data: data ? data.map(rowToDeck) : null, error};
  });
}
```

- [ ] **Step 5: Run tests, confirm green**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state/deckRepository.test.ts`
Expected: PASS, existing tests unchanged.

- [ ] **Step 6: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/state/deckRepository.ts apps/web/src/features/deck/state/deckRepository.test.ts
USER_APPROVED=1 git commit -m "feat(deck): listPublicDecks, the community tab's data source (#473)"
```

---

### Task 2: the dirty flag's storage

**Files:**
- Modify: `apps/web/src/features/deck/state/deckStorage.ts`
- Test: `apps/web/src/features/deck/state/deckStorage.test.ts`

The flag lives under its own key, NOT on `Deck`. Putting it on `Deck` would change the persisted shape (forcing a `schemaVersion` bump) and would be written into the `decks.cards` jsonb column, where a client-side edit flag has no business being.

- [ ] **Step 1: Write the failing test**

Append to `deckStorage.test.ts`:

```ts
describe('dirty flag', () => {
  it('round-trips through localStorage', () => {
    expect(readDirty()).toBe(false);
    writeDirty(true);
    expect(readDirty()).toBe(true);
    writeDirty(false);
    expect(readDirty()).toBe(false);
  });

  it('reads false when the key holds junk', () => {
    localStorage.setItem(DIRTY_KEY, 'not-a-bool');
    expect(readDirty()).toBe(false);
  });
});
```

Add `DIRTY_KEY`, `readDirty`, `writeDirty` to the file's import.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state/deckStorage.test.ts`
Expected: FAIL on the missing exports.

- [ ] **Step 3: Implement**

In `deckStorage.ts`, below the existing `DRAFT_KEY`:

```ts
/**
 * Whether the working draft has edits not yet pushed to the cloud. Separate from
 * DRAFT_KEY on purpose: it is client-only state, and folding it into the Deck
 * shape would force a schemaVersion bump and leak an edit flag into decks.cards.
 */
export const DIRTY_KEY = 'inkweave:deck:dirty';

export function readDirty(): boolean {
  return safeRead(DIRTY_KEY) === 'true';
}

export function writeDirty(isDirty: boolean): void {
  safeWrite(DIRTY_KEY, String(isDirty));
}
```

Then extend the existing `clearDraft` to drop it too, so clearing a draft never leaves a stale flag behind:

```ts
export function clearDraft(): void {
  safeRemove(DRAFT_KEY);
  safeRemove(DIRTY_KEY);
}
```

- [ ] **Step 4: Run tests, confirm green**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state/deckStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/state/deckStorage.ts apps/web/src/features/deck/state/deckStorage.test.ts
USER_APPROVED=1 git commit -m "feat(deck): persist the unsaved-changes flag under its own key (#473)"
```

---

### Task 3: the deck lifecycle in `DeckContext`

**Files:**
- Modify: `apps/web/src/features/deck/state/DeckContext.tsx`
- Test: `apps/web/src/features/deck/state/DeckContext.test.tsx`

Read `DeckContext.tsx` fully first. Three constraints there are load-bearing:
`setState`-in-effect is banned under the React Compiler; inks are derived in render, never stored; and the teardown flush must keep working.

- [ ] **Step 1: Write the failing tests**

Append to `DeckContext.test.tsx`. **The helper is `render()`, takes no arguments,
and the card fixtures are `'amber'` and `'steel'`, not card ids like `'1936'`.**
Read the top of that file before writing.

```ts
it('starts clean, goes dirty on an edit, and is clean again after markSaved', () => {
  const {result} = render();
  expect(result.current.isDirty).toBe(false);

  act(() => result.current.addCard('amber'));
  expect(result.current.isDirty).toBe(true);

  act(() => result.current.markSaved({...result.current.deck, ownerId: 'u1'}));
  expect(result.current.isDirty).toBe(false);
  expect(result.current.deck.ownerId).toBe('u1');
});

it('startNewDeck empties the deck, unbinds it, and records the visibility', () => {
  const {result} = render();
  act(() => result.current.addCard('amber'));
  const previousId = result.current.deck.id;

  act(() => result.current.startNewDeck('public'));

  expect(result.current.deck.cards).toHaveLength(0);
  expect(result.current.deck.id).not.toBe(previousId);
  expect(result.current.deck.ownerId).toBeNull();
  expect(result.current.deck.isPublic).toBe(true);
  expect(result.current.isDirty).toBe(false);
});

it('loadDeck replaces the draft and marks it clean', () => {
  const {result} = render();
  act(() => result.current.addCard('amber'));

  const saved = {...result.current.deck, id: 'cloud-1', name: 'Saved', cards: [], ownerId: 'u1'};
  act(() => result.current.loadDeck(saved));

  expect(result.current.deck.id).toBe('cloud-1');
  expect(result.current.deck.name).toBe('Saved');
  expect(result.current.isDirty).toBe(false);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state/DeckContext.test.tsx`
Expected: FAIL, `isDirty`/`markSaved`/`startNewDeck`/`loadDeck` undefined.

- [ ] **Step 3: Extend the context type**

In `DeckContext.tsx`, add to `DeckContextValue`:

```ts
  /** True when the draft has edits not yet pushed to the cloud. */
  isDirty: boolean;
  /** Bind the draft to its saved row and mark it clean. Call after a successful upsert. */
  markSaved: (saved: Deck) => void;
  /** Replace the draft with a fetched deck, bound and clean. */
  loadDeck: (deck: Deck) => void;
  /** Reset to an empty, unbound draft carrying the chosen visibility. */
  startNewDeck: (visibility: 'private' | 'public') => void;
```

- [ ] **Step 4: Implement in `DeckProvider`**

Add the state, seeded from storage, next to the existing `deck` state:

```ts
  const [isDirty, setIsDirty] = useState<boolean>(readDirty);
```

Wrap every existing mutation so an edit marks the draft dirty. Replace the mutation block with:

```ts
  // Every mutation marks the draft dirty. Wrapped once here rather than at each
  // call site so a future mutation cannot silently skip it.
  const edit = (next: (d: Deck) => Deck) => {
    setDeck(next);
    setIsDirty(true);
  };

  const addCard = (cardId: string) => edit((d) => addCardToDeck(d, cardId, getCardById));
  const removeCard = (cardId: string) => edit((d) => removeCardFromDeck(d, cardId, getCardById));
  const setQuantity = (cardId: string, quantity: number) =>
    edit((d) => setCardQuantity(d, cardId, quantity, getCardById));
  const markCore = (cardId: string, isCore: boolean) => edit((d) => markCardCore(d, cardId, isCore));
  const setGameplan = (gameplan: Archetype | undefined) => edit((d) => setDeckGameplan(d, gameplan));
  const renameDeck = (name: string) => edit((d) => renameDeckName(d, name));
  const clearDeck = () => edit((d) => clearDeckCards(d));
  const replaceCards = (cards: DeckCard[]) => edit((d) => replaceDeckCards(d, cards, getCardById));

  const markSaved = (saved: Deck) => {
    setDeck(saved);
    setIsDirty(false);
  };

  const loadDeck = (incoming: Deck) => {
    setDeck(incoming);
    setIsDirty(false);
  };

  const startNewDeck = (visibility: 'private' | 'public') => {
    setDeck(createEmptyDeck(visibility === 'public'));
    setIsDirty(false);
  };
```

Persist the flag alongside the existing debounced draft write, in its own effect:

```ts
  useEffect(() => {
    writeDirty(isDirty);
  }, [isDirty]);
```

Add all four to the `value` object.

- [ ] **Step 5: Give the existing `createEmptyDraft` a visibility parameter**

**Do not create a new helper and do not move anything to `deckStorage`.**
`createEmptyDraft()` already exists at the top of `DeckContext.tsx` and is already
used by `loadOrCreateDraft`. It currently emits no `isPublic` and no `ownerId`.
Add the parameter in place:

```ts
function createEmptyDraft(isPublic = false): Deck {
  const now = Date.now();
  return {
    id: newDeckId(),
    name: 'New Deck',
    cards: [],
    inks: [],
    isPublic,
    ownerId: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
  };
}
```

Keep `newDeckId()` (it has a crypto-availability fallback for exotic environments)
and keep the `'New Deck'` default name; other code and tests may rely on both.
`loadOrCreateDraft()` keeps calling `createEmptyDraft()` with no argument, so its
behaviour is unchanged.

`startNewDeck` then becomes `setDeck(createEmptyDraft(visibility === 'public'))`.

- [ ] **Step 6: Clear the draft on sign-out**

`DeckContext.tsx` already carries this note: *"The rarer reload-then-different-user path is left to #473's saved-deck model, which will clear the draft on sign-out."* Honor it, so one person's deck never greets the next account on a shared browser.

Inside `useFirstSignInMigration`, in the branch that detects a real sign-out:

```ts
    if (!uid) {
      if (claimedUid.current !== null) {
        blockedAfterSignOut.current = true; // a real sign-out
        clearDraft();                        // and their deck does not linger
        claimedUid.current = null;
      }
      return;
    }
```

**Testing this needs a change to the file's mocking setup first.** `useSession` is
currently mocked module-level as permanently signed out, so no test can simulate a
sign-out. Make it controllable, mirroring how `mockCtl.loading` already controls
the card DB in the same file:

```ts
const sessionCtl = vi.hoisted(() => ({userId: null as string | null}));
vi.mock('../../../shared/contexts/SessionContext', () => ({
  useSession: () => ({
    user: sessionCtl.userId ? {id: sessionCtl.userId} : null,
    session: null,
    loading: false,
    enabled: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));
```

Reset it in `beforeEach` alongside the existing resets: `sessionCtl.userId = null;`

Every existing test keeps passing unchanged, because the default is still
signed out. Then:

```ts
it('clears the draft when a signed-in user signs out', () => {
  sessionCtl.userId = 'u1';
  const {result, rerender} = render();
  act(() => result.current.addCard('amber'));

  sessionCtl.userId = null;
  rerender();

  expect(readDraft()).toBeNull();
});
```

Note `enabled: false` in the mock means the migrator's upsert path stays inert, so
this test exercises the sign-out branch without touching Supabase.

- [ ] **Step 6a: Clear the flag when the first-sign-in migration succeeds**

Found during Task 2's review. `useFirstSignInMigration` currently does:

```ts
    void upsertDeck({...snapshot, ownerId: uid}, uid).then(({error}) => {
      if (!error) markDraftMigrated(uid);
    });
```

That upsert **is** a successful push to the cloud, so once edits set the flag, a
freshly migrated draft would still read as unsaved. Clear it on success:

```ts
    void upsertDeck({...snapshot, ownerId: uid}, uid).then(({error}) => {
      if (error) return;
      markDraftMigrated(uid);
      writeDirty(false); // the draft IS in the cloud now; do not keep nagging
    });
```

Write it through `writeDirty` rather than `setIsDirty`, because this runs inside a
hook that has no access to the provider's state setter, and the flag is read from
storage on next mount. Add a test asserting the flag is clear after a successful
migration.

- [ ] **Step 7: Run tests, confirm green**

Run: `pnpm --filter inkweave-web exec vitest run src/features/deck/state`
Expected: PASS, including the existing `deckMigration.test.tsx`.

- [ ] **Step 8: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/state
USER_APPROVED=1 git commit -m "feat(deck): draft lifecycle, dirty tracking, and sign-out clearing (#473)"
```

---

### Task 4: make the builder routes mean what they say

**Files:**
- Modify: `apps/web/src/pages/DeckBuilderPage.tsx`

Today `DeckBuilderPage` has no reset on mount and never reads `:id`, so `/decks/new` and `/decks/:id/edit` are the same page over the same draft: **"+ New deck" creates nothing and a saved deck cannot be opened.** Everything downstream depends on this.

- [ ] **Step 1: Load the routed deck when editing**

Add near the top of the component:

```tsx
  const {id} = useParams();
  const {deck, loadDeck, ...rest} = useDeck();
  const [loadError, setLoadError] = useState<string | null>(null);

  // /decks/:id/edit opens a SAVED deck. Fetch it unless the draft is already that
  // deck, which is the common case right after saving or navigating from the list.
  useEffect(() => {
    if (!id || deck.id === id) return;
    let cancelled = false;
    void getDeck(id).then(({data, error}) => {
      if (cancelled) return;
      if (data) loadDeck(data);
      else setLoadError(error ?? 'not-found');
    });
    return () => {
      cancelled = true;
    };
  }, [id, deck.id, loadDeck]);
```

- [ ] **Step 2: Render the not-found state**

RLS returns no row for both "does not exist" and "private and not yours", and that is deliberate: do not leak which. Render one state for both:

```tsx
  if (loadError) {
    return (
      <>
        <CompactHeader isMobile={isMobile} />
        <main style={NOT_FOUND_MAIN_STYLE}>
          <h1 style={NOT_FOUND_TITLE_STYLE}>Deck not found</h1>
          <p style={NOT_FOUND_TEXT_STYLE}>
            This deck does not exist, or it is private.
          </p>
          <Link to="/decks" style={{...CTA_BASE_STYLE, ...CTA_FILLED_STYLE, display: 'inline-flex'}}>
            Back to decks
          </Link>
        </main>
      </>
    );
  }
```

Define the three style consts at module scope using `FONTS`, `FONT_SIZES`, `COLORS` and `SPACING` tokens; do not inline raw values.

- [ ] **Step 3: Verify by hand**

Run `pnpm dev`, then:
- `/decks/new` shows the current draft (creation is Task 5's dialog; this route no longer needs to reset by itself).
- `/decks/<a-real-id>/edit` loads that deck.
- `/decks/does-not-exist/edit` shows "Deck not found".

- [ ] **Step 4: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/pages/DeckBuilderPage.tsx
USER_APPROVED=1 git commit -m "fix(deck): /decks/:id/edit actually opens that deck (#473)"
```

---

### Task 5: `NewDeckDialog`

**Files:**
- Create: `apps/web/src/features/deck/components/NewDeckDialog.tsx`
- Create: `apps/web/src/features/deck/components/NewDeckDialog.stories.tsx`
- Modify: `apps/web/src/pages/DecksPage.tsx` (wire the button to the dialog)

Use `DialogShell`; the overlay contract is enforced by the `inkweave/no-unshelled-dialogs` lint rule. Read `.claude/rules/overlays.md` before writing it.

- [ ] **Step 1: Build the dialog**

```tsx
interface NewDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (visibility: 'private' | 'public') => void;
  /** Warn before replacing an unsaved guest deck. */
  showReplaceWarning: boolean;
  canPublish: boolean;
  onSignIn: () => void;
}

export function NewDeckDialog({isOpen, onClose, onConfirm, showReplaceWarning, canPublish, onSignIn}: NewDeckDialogProps) {
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="New deck">
      <h2 style={DIALOG_TITLE_STYLE}>New deck</h2>

      {showReplaceWarning && (
        <p style={WARNING_TEXT_STYLE}>
          Starting a new deck replaces your current one, which isn&apos;t saved to an account yet.{' '}
          <button type="button" onClick={onSignIn} style={INLINE_LINK_STYLE}>
            Sign in
          </button>{' '}
          to keep both.
        </p>
      )}

      <fieldset style={FIELDSET_STYLE}>
        <legend style={LEGEND_STYLE}>Visibility</legend>
        <label style={RADIO_ROW_STYLE}>
          <input type="radio" name="visibility" checked={visibility === 'private'} onChange={() => setVisibility('private')} />
          Private. Only you can see it.
        </label>
        <label style={{...RADIO_ROW_STYLE, opacity: canPublish ? 1 : 0.5}}>
          <input
            type="radio"
            name="visibility"
            disabled={!canPublish}
            checked={visibility === 'public'}
            onChange={() => setVisibility('public')}
          />
          Public. {canPublish ? 'Anyone can see it and it appears in community decks.' : 'Sign in to publish.'}
        </label>
      </fieldset>

      <CtaButton variant="filled" onClick={() => onConfirm(visibility)}>
        Start building
      </CtaButton>
    </DialogShell>
  );
}
```

Define every `*_STYLE` const at module scope from design tokens.

- [ ] **Step 2: Add the story**

Four exports, per `.claude/rules/stories.md`: `Default`, `WithReplaceWarning`, `GuestCannotPublish`, `SignedIn`.

- [ ] **Step 3: Wire it into `DecksPage`**

"+ New deck" becomes a button opening this dialog. On confirm: `startNewDeck(visibility)` then `navigate('/decks/new')`.

`showReplaceWarning` is `!user && deck.cards.length > 0`. `canPublish` is `!!user`.

- [ ] **Step 4: Verify**

`pnpm --filter inkweave-web exec vitest run` and `pnpm --filter inkweave-web lint` both clean. Check the dialog by hand signed out (warning appears with a non-empty draft, Public disabled) and signed in (no warning, Public selectable).

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components/NewDeckDialog.tsx apps/web/src/features/deck/components/NewDeckDialog.stories.tsx apps/web/src/pages/DecksPage.tsx
USER_APPROVED=1 git commit -m "feat(deck): NewDeckDialog picks visibility up front (#473)"
```

---

### Task 6: `SaveDeckDialog` and the save action

**Files:**
- Create: `apps/web/src/features/deck/components/SaveDeckDialog.tsx`
- Create: `apps/web/src/features/deck/components/SaveDeckDialog.stories.tsx`
- Modify: `apps/web/src/features/deck/components/DeckActionsBar.tsx`

- [ ] **Step 1: Build the dialog**

Signed out it is the conversion point, so it does not show a form:

```tsx
export function SaveDeckDialog({isOpen, onClose}: {isOpen: boolean; onClose: () => void}) {
  const {deck, markSaved} = useDeck();
  const {user} = useSession();
  const [name, setName] = useState(deck.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <DialogShell isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Save deck">
        <h2 style={DIALOG_TITLE_STYLE}>Save to account</h2>
        <p style={DIALOG_TEXT_STYLE}>
          Your deck is saved on this device. Sign in to keep more than one, reach them from any
          device, and publish them.
        </p>
        <SignInButtons />
      </DialogShell>
    );
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    const {data, error: err} = await upsertDeck({...deck, name, ownerId: user.id}, user.id);
    setSaving(false);
    if (err || !data) {
      setError(err ?? 'Could not save. Your deck is still here.');
      return;
    }
    markSaved(data);
    onClose();
  };

  return (
    <DialogShell isOpen={isOpen} onClose={onClose} size="sm" ariaLabel="Save deck">
      <h2 style={DIALOG_TITLE_STYLE}>Save deck</h2>
      <label style={LABEL_STYLE}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} style={INPUT_STYLE} />
      </label>
      <p style={DIALOG_TEXT_STYLE}>Inks: {deck.inks.join(' / ') || 'none yet'}</p>
      {error && <p style={ERROR_TEXT_STYLE}>{error}</p>}
      <CtaButton variant="filled" onClick={() => void save()} disabled={saving || name.trim() === ''}>
        {saving ? 'Saving…' : 'Save'}
      </CtaButton>
    </DialogShell>
  );
}
```

On failure the draft is untouched and stays dirty. Never discard local work on a failed save.

- [ ] **Step 2: Add the story**

Exports: `SignedOut`, `SignedIn`, `Saving`, `SaveFailed`.

- [ ] **Step 3: Add the toolbar button**

In `DeckActionsBar`, add a `Save to account` button (variant `ghost`) that opens the dialog, showing an unsaved marker when `isDirty`:

```tsx
{isDirty ? 'Save to account •' : 'Save to account'}
```

- [ ] **Step 4: Verify, then commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components
USER_APPROVED=1 git commit -m "feat(deck): SaveDeckDialog, and Save is the guest conversion point (#473)"
```

---

### Task 7: the two lists on `/decks`

**Files:**
- Create: `apps/web/src/features/deck/components/DeckSummaryCard.tsx` + story
- Modify: `apps/web/src/pages/DecksPage.tsx`

- [ ] **Step 1: `DeckSummaryCard`**

Name, ink pips, card count, and a `Link` to `/decks/:id`. Use `SURFACE_CARD`. It is a `Link`, not a button, so middle-click and open-in-new-tab work, matching the "+ New deck" precedent.

- [ ] **Step 2: Add the tabs**

`TabList` with `community` (default) and `mine`. Community is default for everyone, signed in or not: that is the page's ruled identity.

- [ ] **Step 3: Community list**

```tsx
const [publicDecks, setPublicDecks] = useState<Deck[] | null>(null);
const [listError, setListError] = useState(false);

useEffect(() => {
  void listPublicDecks().then(({data, error}) => {
    if (error || !data) return setListError(true);
    setPublicDecks(data.filter((d) => calculateDeckStats(d, getCardById).isLegal));
  });
}, [getCardById]);
```

A failure must render a retryable error, never an empty list: "no decks exist" and "the request failed" must not look the same.

- [ ] **Step 4: My-decks list**

Signed in, `listDecks(user.id)`. Signed out, render the single local draft if it has cards, else the empty state.

- [ ] **Step 5: Empty states**

Three, all using `EMPTY_BOX`:
- Community, nothing published: "No decks have been shared yet." plus a build invitation.
- Mine, signed in, none: "You haven't saved a deck yet."
- Mine, guest, no draft: the same invitation.

- [ ] **Step 6: Verify, then commit**

```bash
USER_APPROVED=1 git add apps/web/src/features/deck/components apps/web/src/pages/DecksPage.tsx
USER_APPROVED=1 git commit -m "feat(decks): community and my-decks tabs with real lists (#473)"
```

---

### Task 8: `DeckViewPage`, sharing and publishing

**Files:**
- Modify: `apps/web/src/pages/DeckViewPage.tsx`
- Create: `apps/web/src/features/deck/components/ShareDeckButton.tsx` + story

- [ ] **Step 1: Fetch and render**

Replace the 31-line placeholder: `getDeck(id)`, then a read-only card list plus `DeckStatsBar`. One "Deck not found. This deck does not exist, or it is private." state covers both cases, deliberately.

- [ ] **Step 2: Owner controls**

When `deck.ownerId === user?.id`, show `Edit` (to `/decks/:id/edit`), `ShareDeckButton`, and a visibility toggle calling `updateDeck({...deck, isPublic: next})`.

The toggle states the consequence in words: "Anyone can see this deck and it appears in community decks."

- [ ] **Step 3: `ShareDeckButton`**

```tsx
const share = async () => {
  if (!deck.isPublic) return setOfferPublish(true);
  await navigator.clipboard.writeText(`${window.location.origin}/decks/${deck.id}`);
  setCopied(true);
};
```

Private decks never publish silently: the button offers it and the owner confirms.

- [ ] **Step 4: Verify, then commit**

```bash
USER_APPROVED=1 git add apps/web/src/pages/DeckViewPage.tsx apps/web/src/features/deck/components
USER_APPROVED=1 git commit -m "feat(deck): deck view, share link, and explicit publish (#473)"
```

---

### Task 9: E2E session stubbing and the acceptance test

**Files:**
- Create: `apps/web/e2e/fixtures/session.ts`
- Create: `apps/web/e2e/tests/deck-save-share.spec.ts`
- Modify: `apps/web/e2e/E2E_TESTS.md`

**No session stubbing exists anywhere in the suite today.** It has to be built here, and it gates every assertion in this task.

- [ ] **Step 1: Build the fixture**

Seed a Supabase session into `localStorage` before the app boots, using `page.addInitScript` so it is present on first paint:

```ts
export async function signInAs(page: Page, userId = 'e2e-user-1') {
  await page.addInitScript((uid) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('sb-')) ?? 'sb-e2e-auth-token';
    localStorage.setItem(key, JSON.stringify({
      access_token: 'e2e', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'e2e',
      user: {id: uid, email: 'e2e@example.com', aud: 'authenticated', role: 'authenticated'},
    }));
  }, userId);
}
```

Also intercept `**/rest/v1/decks*` so the spec never depends on the live backend, matching how `in-depth-vote.spec.ts` stays off the live-backend flake path.

- [ ] **Step 2: Write the acceptance spec**

The contract from the issue body:

```ts
test('build, save, then open the share link anonymously', async ({page, browser}) => {
  await signInAs(page);
  await page.goto('/decks/new');
  await importSixtyCards(page);
  await expect(page.getByTestId('deck-legality-ok')).toBeVisible();

  await page.getByRole('button', {name: /save to account/i}).click();
  await page.getByLabel('Name').fill('E2E Deck');
  await page.getByRole('button', {name: 'Save', exact: true}).click();

  const shareUrl = await publishAndCopyLink(page);

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(shareUrl);
  await expect(anonPage.getByRole('heading', {name: 'E2E Deck'})).toBeVisible();
  await anon.close();
});
```

Reach 60 cards through the existing import dialog rather than 60 clicks: `deckTransfer` already parses `4 Name (9-201)` lines.

- [ ] **Step 3: Run it**

Run: `pnpm --filter inkweave-web exec playwright test e2e/tests/deck-save-share.spec.ts --project=chromium`
Expected: PASS.

**Ensure no dev server is running first.** A `pnpm dev` server on any port starves the workers and produces `page.goto` timeouts unrelated to the test.

- [ ] **Step 4: Update the inventory**

Add the spec to `apps/web/e2e/E2E_TESTS.md`.

- [ ] **Step 5: Commit**

```bash
USER_APPROVED=1 git add apps/web/e2e
USER_APPROVED=1 git commit -m "test(deck): session stubbing and the save-and-share acceptance spec (#473)"
```

---

## Self-review notes

**Spec coverage.** Decisions A (Task 3), A1 (Tasks 3 and 6), P1 (Tasks 5 and 8), L1 (Task 7), guests build (Tasks 5 and 6), `listPublicDecks` (Task 1), all four error states (Tasks 4, 6, 7, 8), all three empty states (Task 7), the E2E contract (Task 9).

**Added beyond the spec:** clearing the draft on sign-out (Task 3, Step 6). `DeckContext.tsx` already promises this in a comment naming #473, so it is an existing commitment rather than new scope. Flagged to the owner.

**Type consistency.** `startNewDeck(visibility: 'private' | 'public')`, `markSaved(saved: Deck)`, `loadDeck(deck: Deck)` and `isDirty: boolean` are used identically in Tasks 3, 5, 6 and 7. `listPublicDecks(limit = 50)` returns `RepoResult<Deck[]>` in Tasks 1 and 7. `createEmptyDeck(isPublic = false)` is defined in Task 3 Step 5 and used only there.

**Deliberately not covered:** favourites, `deck_stats`, copy-a-deck, profiles and trending are #454. An unlisted tier needs a migration. Deck deletion has a repository function but no UI in this plan; add it only if the owner asks.
