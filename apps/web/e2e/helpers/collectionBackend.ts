import type {BrowserContext, Route} from '@playwright/test';

/**
 * A stand-in `collections` table for E2E (#555).
 *
 * Modelled on `DeckBackend`, with one structural difference that drives
 * everything: `collections` is ONE ROW PER USER, keyed by `owner_id`, so the
 * store is a map from uid to row and a write is always an upsert. There is no
 * id to generate and no list to filter.
 *
 * WHAT THIS DOES NOT PROVE, stated up front so nobody reads more into a green
 * run than it earns: the RLS policies are not exercised here — Playwright routes
 * intercept before the network, so `owner_id` scoping is enforced by this file's
 * own bookkeeping, not by Postgres. RLS was proven separately with a
 * JWT-simulated probe against the live database (see #555). What these specs DO
 * prove is the half that probe cannot: that the app reads, writes and reconciles
 * the row at the right moments.
 */

/** The client's localStorage key, so a spec can seed or read the local half. */
export const COLLECTION_KEY = 'inkweave:collection';

/** Matches `collectionStorage`'s per-uid marker. */
export const COLLECTION_MIGRATED_PREFIX = 'inkweave:collection:migrated';

export interface CollectionRow {
  owner_id: string;
  entries: Record<string, {normal: number; foil: number}>;
  imported_at: string;
  schema_version: number;
}

export class CollectionBackend {
  /** uid -> row. A map, not a list: the primary key IS the owner. */
  private rows = new Map<string, CollectionRow>();

  /** Seed a row as if the user had imported on another device. */
  seed(ownerId: string, entries: CollectionRow['entries'], importedAt = Date.now()): void {
    this.rows.set(ownerId, {
      owner_id: ownerId,
      entries,
      imported_at: new Date(importedAt).toISOString(),
      schema_version: 1,
    });
  }

  get(ownerId: string): CollectionRow | undefined {
    return this.rows.get(ownerId);
  }

  get writeCount(): number {
    return this.writes;
  }
  private writes = 0;

  /**
   * Route this context's `collections` traffic into the store, as `viewerId`.
   *
   * Share one instance across contexts to model two devices on one account —
   * that is the point, and it is what makes "import here, see it there"
   * assertable at all.
   */
  async attach(context: BrowserContext, viewerId: string | null = null): Promise<void> {
    await context.route('**/rest/v1/collections*', (route) => this.handle(route, viewerId));

    // Identity, stubbed for the same reason DeckBackend does it: ProfileProvider
    // claims a handle on every sign-in, and the fake JWT would draw a real
    // rejection, which the fixture's console-error guard treats as fatal.
    await context.route('**/rest/v1/rpc/claim_handle', (route) =>
      route.fulfill({json: viewerId ? [{handle: 'e2e_user', display_name: 'E2E User'}] : []}),
    );
    await context.route('**/rest/v1/profiles*', (route) =>
      route.fulfill({
        json: viewerId ? [{id: viewerId, handle: 'e2e_user', display_name: 'E2E User'}] : [],
      }),
    );
  }

  /** Verb dispatch only. Each branch's own conditionals live with the branch. */
  private handle(route: Route, viewerId: string | null): Promise<void> {
    const method = route.request().method();
    if (method === 'GET') return route.fulfill({json: this.read(viewerId)});
    if (method === 'POST' || method === 'PATCH') return this.write(route, viewerId);
    if (method === 'DELETE') return this.remove(route, viewerId);
    // Surface an unexpected verb loudly rather than silently returning [].
    return route.fulfill({status: 405, json: {message: `unmocked ${method}`}});
  }

  /**
   * `maybeSingle` accepts an array and takes the first element, so an empty
   * array is the honest encoding of "this user has no row".
   */
  private read(viewerId: string | null): CollectionRow[] {
    const row = viewerId ? this.rows.get(viewerId) : undefined;
    return row ? [row] : [];
  }

  private write(route: Route, viewerId: string | null): Promise<void> {
    // Mirrors the owner-scoped policies: an anonymous write is rejected rather
    // than quietly stored. Without this a spec could pass while the app wrote a
    // collection signed out.
    if (viewerId === null) {
      return route.fulfill({status: 401, json: {message: 'anonymous write rejected'}});
    }
    const body = route.request().postDataJSON() as CollectionRow | CollectionRow[];
    const incoming = Array.isArray(body) ? body[0] : body;
    this.writes += 1;
    this.rows.set(viewerId, {...incoming, owner_id: viewerId});
    return route.fulfill({json: []});
  }

  private remove(route: Route, viewerId: string | null): Promise<void> {
    if (viewerId !== null) this.rows.delete(viewerId);
    return route.fulfill({json: []});
  }
}
