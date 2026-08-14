import type {BrowserContext, Route} from '@playwright/test';

/**
 * Session stubbing + an in-memory `decks` table for E2E (#473 task 9).
 *
 * WHY MOCK AT ALL. Signing in for real means an OAuth redirect to Google or
 * Discord, which cannot run in CI. Writing for real means a valid Supabase JWT,
 * which means committing credentials. So the suite stubs both, and is honest
 * about the seam: these specs prove the CLIENT contract (the app calls the right
 * query with the right payload, and renders what comes back). They do NOT prove
 * RLS or that Postgres accepts the write. That half belongs in
 * `scripts/test-supabase-integration.mjs`, which today covers voting only.
 *
 * WHY ONE SHARED STORE. The acceptance flow ends by opening a share link in a
 * fresh anonymous context. Both contexts route through the same `DeckBackend`
 * instance living in the Playwright process, so a deck saved while signed in is
 * genuinely readable by a signed-out visitor. Persistence is real; only the
 * database is not.
 */

/** A stable, valid v4 UUID. The column is uuid, so a "test-user" string would not do. */
export const TEST_USER_ID = '3f7a1c52-9d84-4b1e-8f0a-2c6d5e4b7a90';

/**
 * The public identity the stubbed backend hands out.
 *
 * A handle matching the schema's `^[a-z0-9_]{3,30}$` and a display name derived from
 * it the way `pretty_handle` does, so a spec asserting on the author sees the shape
 * production produces rather than a placeholder that could never exist.
 */
export const TEST_HANDLE = 'emerald_dreamborn_434';
export const TEST_DISPLAY_NAME = 'Emerald Dreamborn 434';

/** Storage key from `shared/lib/supabase.ts`. Not the supabase-js default. */
const AUTH_STORAGE_KEY = 'inkweave:auth';

/** Prefix from `deckStorage.ts`; the full key is `${prefix}:${uid}`. */
const MIGRATED_PREFIX = 'inkweave:deck:migrated';

/**
 * Structurally valid unsigned JWT. Nothing verifies it (our route handlers ignore
 * the Authorization header), but auth-js is happier with a decodable token than
 * with a bare string, and a realistic shape keeps this from lying about the seam.
 */
function fakeJwt(uid: string, expiresAtSeconds: number): string {
  const b64 = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString('base64url');
  return [
    b64({alg: 'HS256', typ: 'JWT'}),
    b64({sub: uid, role: 'authenticated', aud: 'authenticated', exp: expiresAtSeconds}),
    'e2e-not-a-real-signature',
  ].join('.');
}

interface SignInOptions {
  /** Defaults to {@link TEST_USER_ID}. */
  userId?: string;
  /**
   * Suppress `useFirstSignInMigration`, which upserts any non-empty local draft
   * the moment a uid appears. Left ON by default: a spec that seeds a draft and
   * then asserts on the Save button would otherwise be asserting after an
   * automatic save had already happened. Pass false to test the migration itself.
   */
  alreadyMigrated?: boolean;
}

/**
 * Make the app believe this context is signed in, before any page script runs.
 *
 * auth-js persists the whole session at the storage key when no `userStorage` is
 * configured (ours is not), and `__loadSession` only checks
 * `expires_at * 1000 - Date.now() < EXPIRY_MARGIN_MS` (90s). A one-year expiry
 * therefore resolves from storage with no network call and no refresh timer
 * firing during a test.
 *
 * Call BEFORE the first navigation. `addInitScript` re-runs on every navigation,
 * so the session survives reloads and client-side route changes.
 */
export async function signInAs(context: BrowserContext, options: SignInOptions = {}): Promise<void> {
  const userId = options.userId ?? TEST_USER_ID;
  const alreadyMigrated = options.alreadyMigrated ?? true;
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const session = {
    access_token: fakeJwt(userId, expiresAt),
    refresh_token: 'e2e-refresh-token',
    token_type: 'bearer',
    expires_in: 365 * 24 * 60 * 60,
    expires_at: expiresAt,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'e2e@inkweave.test',
      app_metadata: {provider: 'google', providers: ['google']},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };

  await context.addInitScript(
    ([key, value, migratedKey]: [string, string, string | null]) => {
      window.localStorage.setItem(key, value);
      if (migratedKey) window.localStorage.setItem(migratedKey, '1');
    },
    [
      AUTH_STORAGE_KEY,
      JSON.stringify(session),
      alreadyMigrated ? `${MIGRATED_PREFIX}:${userId}` : null,
    ] as [string, string, string | null],
  );

  // Keep every auth call off the network. Nothing in the app needs a real
  // response, but an unmocked one would fail and log, and the console-error
  // guard in fixtures fails the test on any console error.
  await context.route('**/auth/v1/**', (route) => route.fulfill({json: {}}));
}

/** The `decks` row shape, matching the migration and `deckRepository.rowToDeck`. */
export interface DeckRow {
  id: string;
  owner_id: string;
  name: string;
  gameplan: string | null;
  inks: string[];
  cards: {cardId: string; quantity: number; isCore?: boolean}[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * PostgREST filter values arrive as `eq.<value>`. Anything else (in., gt., …) is
 * not used by deckRepository, so it is treated as unmatched rather than guessed.
 */
function eqValue(param: string | null): string | null {
  if (param === null) return null;
  return param.startsWith('eq.') ? param.slice(3) : null;
}

/**
 * An in-memory `decks` table served over route interception.
 *
 * Every response is a JSON ARRAY, deliberately. In postgrest-js 2.108.2
 * `maybeSingle()` does NOT set the `application/vnd.pgrst.object+json` Accept
 * header the way `single()` does: it sets an `isMaybeSingle` flag and unwraps
 * client-side (0 rows -> null, 1 -> the row, >1 -> PGRST116). One array shape
 * therefore serves the list reads, the single reads, and the writes alike.
 */
export class DeckBackend {
  readonly rows = new Map<string, DeckRow>();

  /** Rows currently stored, newest-touched first, as the real queries order them. */
  all(): DeckRow[] {
    return [...this.rows.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  /**
   * Route this context's `decks` traffic into the store, as `viewerId`.
   *
   * Attach to as many contexts as the spec needs: they share `rows` (that is the
   * point) but each carries its own identity, so a signed-in context and an
   * anonymous one see different rows through the same store.
   *
   * `viewerId` null means anonymous, i.e. `auth.uid()` is null.
   */
  async attach(context: BrowserContext, viewerId: string | null = null): Promise<void> {
    await context.route('**/rest/v1/decks*', (route) => this.handle(route, viewerId));

    /*
      Identity, stubbed alongside the decks.

      `ProfileProvider` claims a handle on every sign-in, and the stubbed session
      carries a fake JWT that a real Supabase rejects with "No suitable key or wrong
      key type". That surfaced as a console error the fixture's guard treats as fatal,
      which failed four specs that had nothing to do with identity.

      Anonymous contexts get an empty profile set rather than no route at all: the
      community list asks for author names whether or not anyone is signed in, and an
      unrouted request would reach the network for real.
    */
    await context.route('**/rest/v1/rpc/claim_handle', (route) =>
      route.fulfill({json: viewerId ? [{handle: TEST_HANDLE, display_name: TEST_DISPLAY_NAME}] : []}),
    );
    await context.route('**/rest/v1/profiles*', (route) =>
      route.fulfill({
        json: viewerId ? [{id: viewerId, handle: TEST_HANDLE, display_name: TEST_DISPLAY_NAME}] : [],
      }),
    );

    /*
      Collections, stubbed for the SAME reason and discovered the same way (#555).

      `CollectionProvider` is mounted app-wide, so the moment a uid appears it
      reads the `collections` table — on every page, in every signed-in spec,
      whether or not the spec has anything to do with collections. Unrouted, that
      request reaches a real Supabase, is rejected by the fake JWT with "No
      suitable key or wrong key type", and the fixture's console-error guard
      fails the test. It took out all four deck-save-share specs.

      Empty array = "this user has no collection", which is the right default for
      a spec about decks. A spec that cares uses `CollectionBackend` instead.
    */
    await context.route('**/rest/v1/collections*', (route) => route.fulfill({json: []}));
  }

  private handle(route: Route, viewerId: string | null): Promise<void> {
    const request = route.request();
    const params = new URL(request.url()).searchParams;

    switch (request.method()) {
      case 'GET':
        return route.fulfill({json: this.select(params, viewerId)});
      case 'POST':
      case 'PATCH':
        // Mirrors the owner-scoped INSERT/UPDATE policies: an anonymous caller is
        // rejected rather than quietly writing. Without this the spec could pass
        // while the app wrote decks signed out.
        if (viewerId === null) {
          return route.fulfill({status: 401, json: {message: 'anonymous write rejected'}});
        }
        return route.fulfill({json: this.write(route, params, viewerId)});
      case 'DELETE':
        return route.fulfill({json: this.remove(params)});
      default:
        // Surface an unexpected verb loudly rather than silently returning [].
        return route.fulfill({status: 405, json: {message: `unmocked ${request.method()}`}});
    }
  }

  /**
   * The read side of `decks_select_public_or_own`:
   * `using (is_public or auth.uid() = owner_id)`.
   *
   * Enforced here rather than returning whatever matches the filter, because the
   * acceptance flow turns on it: a private deck must be invisible to an anonymous
   * visitor, so that publishing is what makes the share link work. A permissive
   * mock would let that assertion pass without the app ever publishing anything.
   */
  private visibleTo(row: DeckRow, viewerId: string | null): boolean {
    return row.is_public || row.owner_id === viewerId;
  }

  private select(params: URLSearchParams, viewerId: string | null): DeckRow[] {
    const visible = this.all().filter((row) => this.visibleTo(row, viewerId));

    const id = eqValue(params.get('id'));
    if (id !== null) return visible.filter((row) => row.id === id);

    const owner = eqValue(params.get('owner_id'));
    if (owner !== null) return visible.filter((row) => row.owner_id === owner);

    const isPublic = eqValue(params.get('is_public'));
    if (isPublic !== null) return visible.filter((row) => String(row.is_public) === isPublic);

    return visible;
  }

  /**
   * Insert / upsert (POST) and update (PATCH) collapse into one path: both write
   * the body's columns onto a row keyed by id and return it. That mirrors what
   * the client can observe, which is all these specs assert on.
   */
  private write(route: Route, params: URLSearchParams, viewerId: string): DeckRow[] {
    const body = route.request().postDataJSON() as Partial<DeckRow> | Partial<DeckRow>[];
    const payload = Array.isArray(body) ? body[0] : body;
    const id = payload?.id ?? eqValue(params.get('id'));
    if (!id) return [];

    const now = new Date().toISOString();
    const existing = this.rows.get(id);

    // One precedence rule for every writable column: the body wins, then whatever the
    // row already held, then a default. Written once rather than per column — as a
    // chain of `??` per field it was the same rule restated eight times, and each
    // restatement was a branch nothing tested independently.
    const merged = <K extends keyof DeckRow>(key: K, fallback: DeckRow[K]): DeckRow[K] =>
      payload[key] ?? existing?.[key] ?? fallback;

    const row: DeckRow = {
      id,
      owner_id: merged('owner_id', viewerId),
      name: merged('name', 'Untitled deck'),
      gameplan: merged('gameplan', null),
      inks: merged('inks', []),
      cards: merged('cards', []),
      is_public: merged('is_public', false),
      // created_at is immutable once set, matching the real table — so it reads the
      // EXISTING value first, the one column where the body does not win.
      created_at: existing?.created_at ?? payload.created_at ?? now,
      updated_at: now,
    };
    this.rows.set(id, row);
    return [row];
  }

  private remove(params: URLSearchParams): DeckRow[] {
    const id = eqValue(params.get('id'));
    if (id !== null) this.rows.delete(id);
    return [];
  }
}

/**
 * A Core-legal 60-card decklist: 15 distinct mono-Amber cards at 4 copies each.
 *
 * Generated from the shipped `allCards.json`, restricted to cards whose
 * `fullName` is unique in the pool so the importer's name match is unambiguous.
 * Mono-ink is legal (the rule is a ceiling of two) and keeps the list immune to
 * ink-pairing changes. Regenerate if Core rotates these out.
 */
export const LEGAL_60_DECKLIST = [
  '4 The Queen - Conceited Ruler (9-1)',
  '4 Pongo - Determined Father (9-2)',
  '4 Stitch - Rock Star (9-3)',
  '4 Beast - Gracious Prince (9-4)',
  '4 Minnie Mouse - Sweetheart Princess (9-5)',
  '4 Aurora - Holding Court (9-6)',
  '4 The Queen - Regal Monarch (9-7)',
  '4 Rapunzel - Sunshine (9-8)',
  '4 Stitch - Alien Dancer (9-9)',
  '4 Mulan - Free Spirit (9-10)',
  '4 Daisy Duck - Musketeer Spy (9-11)',
  '4 Tinker Bell - Generous Fairy (9-12)',
  '4 Mickey Mouse - True Friend (9-13)',
  '4 Pluto - Determined Defender (9-14)',
  '4 Ariel - Singing Mermaid (9-15)',
].join('\n');
