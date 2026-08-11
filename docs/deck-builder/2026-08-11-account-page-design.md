# Account page design — 2026-08-11

**Status:** approved, built.
**Issue:** #553 (Phase C follow-on). Related: #452 (`collections` migration, not started).

## Why this exists

Not "add a profile screen". The app has **no account surface at all**, so anything
account-shaped gets parented to whatever page happened to be nearby — and when that
page changes, the feature is orphaned. That has now happened twice:

| Component | Built | Mount site | Became unreachable |
|---|---|---|---|
| `DisplayNameDialog` | with story + tests | Yours-tab row | `8d9a3ae3` removed the row by owner ruling |
| `ImportCollectionDialog` | with story + tests | none, ever | shipped in Phase 2 with no caller |

Both are complete, tested components that nothing can open. The page is mostly
**mount sites plus a shell**, which is why it is small — and the structural point is
that it gives account features a permanent home so this cannot recur.

## Scope

`/account`, private. Three sections.

| Section | Contents | Supplied by |
|---|---|---|
| Identity | `@handle` read-only, display name + Change | `DisplayNameDialog` |
| Collection | count, imported date, Import / Re-import / Clear | `ImportCollectionDialog` |
| Session | Sign out | relocated from `AuthButton` |

### Rulings taken

1. **`/account`, not `/profile`.** PLAN line 240 reserves a unique `@handle` for
   "profile publish (Phase 4)", and line 184 names `/u/:handle` as the future public
   surface. `/account` says *private settings* and cannot collide with that.
2. **Signed out renders a sign-in prompt, not a redirect.** A redirect discards the
   URL, so a shared or bookmarked `/account` link looks broken rather than gated.
3. **Display-name editing is reinstated here** (owner, 2026-08-11), reversing the
   placement — not the substance — of `8d9a3ae3`. The ruling removed a *row from the
   Yours tab*; the objection was where it sat, not that the name should be permanent.
   PLAN line 194 records the consequence with teeth: the name is auto-generated,
   public, stamped on every community deck tile, and its owner cannot edit it.
4. **`@handle` is read-only by construction, not by preference.** Uniqueness is
   enforced by the index, so the only correct claim is write-and-catch-23505 on the
   server (PLAN line 184). An edit field would need an availability flow; the display
   name is editable precisely because it carries no uniqueness constraint.
5. **`avatar_url` is NOT surfaced.** RLS here is ROW-level —
   `profiles_select_public_or_own` is `handle is not null or auth.uid() = id` — so
   once a handle exists, anon can read the whole row. The signup trigger deliberately
   writes only the id to keep it free of PII. Surfacing an avatar is a *publishing*
   decision, not a display one, and it buys nothing today.
6. **Clear collection confirms first.** It destroys an import with no undo.
7. **The header's signed-in slot becomes the display name linking to `/account`;**
   sign-out moves onto the page. A session-ending action does not belong one click
   from every screen, and the account surface needs a door.
8. **Import stays reachable from Browse too.** `/account` is the permanent home;
   Browse's Collection button is a contextual shortcut. Bouncing someone to another
   page mid-task is worse than two mount sites, which cost nothing for a component.

### Out of scope

- **`collections` table** — #452. Collections are `localStorage` only today; signing
  in changes nothing about them. See "Not yet connected" below.
- **Public `/u/:handle`** — Phase 4 per PLAN.
- **Deck list** — `/decks` exists; link, do not duplicate.
- **Vote history / collection stats** — considered as a "your stuff" hub and rejected
  as a materially bigger build needing new queries.

## Constraints any change here must respect

- **`AuthButton` renders nothing while `loading`, and nothing when auth is
  unconfigured.** Both are load-bearing: `user` is null during the auth lookup, so a
  naive version shows "Sign in" and swaps to "Sign out" once it resolves — the wrong
  state, flashed on every page load for every returning user.
- **Two surfaces render `AuthButton`**: the desktop header (`HeaderAuth` in
  `CompactHeader`) and `/decks` on mobile, where no header exists.
- **`ImportCollectionDialog` requires `isPoolReady`.** The non-Core chunks load
  lazily; parsing against a partial pool does not fail, it silently reclassifies two
  thirds of a real collection as "outside Core" and drops it.

## Not yet connected — what "collection tied to my account" still needs

Signing in today changes nothing about a collection. `useSession` and `useCollection`
are unrelated; the sign-in gate on Browse's Collection button is a UI check, not a
data link. A collection lives in this browser's `localStorage` and does not follow the
user to another device.

To actually connect it, in order:

1. **`collections` migration** (#452) — table, owner-only RLS, regenerated types.
   Mirrors `decks`: `owner_id uuid references auth.users(id) on delete cascade`,
   `entries jsonb`, `schema_version smallint`. One row per user, not a list.
   **Needs owner authorization — it applies to the live DB.**
2. **`collectionRepository`**, mirroring `profileRepository`, so `CollectionContext`
   reads Supabase when signed in and falls back to `localStorage` when not.
3. **A migration path for existing local collections.** Decide before building: on
   first sign-in with a local collection present, upload / ignore / ask? Getting it
   wrong either discards someone's import or overwrites a newer server copy.
4. Point the account page's Collection section at the repository instead of storage.

The page is built so that step 4 is the only change it needs.
