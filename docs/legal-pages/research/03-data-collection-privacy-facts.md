# Data-Collection Audit — Factual Basis for the Inkweave Privacy Policy

> **Since #593 (2026-09-30):** the admin tools moved to `Doberjohn/inkweave-admin`. The app no longer has `/admin/*` routes, `AdminGate`, the GitHub PAT in `localStorage` (`inkweave.reveal-admin.gh-token`), `githubCommit.ts`, the admin pages, or `api.github.com` in its CSP `connect-src`. Mentions of them below describe the app as researched.

## Scope

This document is an **evidence-based inventory** of every piece of data the Inkweave web app
(`apps/web`) collects, stores, or transmits, produced by reading the actual source, SQL
migrations, and deploy config on branch `claude/inkweave-deck-builder-af3e5b` (2026-07-09).
Every claim carries a `file:line` citation; anything that could not be verified from the code is
listed as an **open question** rather than guessed. It is written to be the source of truth a
Privacy Policy is drafted _from_ — do not restate anything here that the code does not support.
Domain facts external to the repo (Vercel/Sentry retention windows, DSN region) are flagged as
undeterminable from code.

---

## 1. Executive summary

Inkweave is a **static single-page app** (React + Vite, hosted on Vercel) with a **thin anonymous
backend** (Supabase) used only for community synergy voting. The data surface is small:

- **No account is required to use the app.** Auth (Google/Discord OAuth via Supabase) exists in the
  code but is currently **only wired to the deck builder**, and the cloud-deck storage it was built
  for **is not shipped yet** — decks live **only in the browser's localStorage** today (see §4).
- **No first-party analytics cookies, no third-party ad/tracking cookies.** The only cookie-like
  persistence is `localStorage`/`sessionStorage` (all first-party, device-local) plus Supabase's
  auth token in `localStorage` (see §8).
- **The one piece of network-side personal data is the voter's IP address**, which Supabase hashes
  with a **static salt** for rate-limiting. It is stored as a SHA-256 hex digest, never in the
  clear (see §3). Whether a statically-salted IP hash counts as "personal data" under GDPR is a
  legal question the policy must take a position on — flagged in §10.
- **Behavioral analytics** (Vercel Web Analytics + custom events) track card/vote/search
  interactions **keyed to card IDs, never to a user identity** (see §6).
- **Error monitoring** (Sentry) runs in production and, via its Supabase integration, may capture
  request context (see §5).

### Master inventory (one row per data flow)

| # | Data | Purpose | Stored where / region | Retention | PII? | Evidence |
|---|------|---------|----------------------|-----------|------|----------|
| 1 | Deck draft (name, card IDs, quantities, gameplan, timestamps) | Persist the working deck between visits | Browser `localStorage` (device-local) | Until user clears / overwrites | No (no identity attached) | `features/deck/state/deckStorage.ts:15,80` |
| 2 | Quick + in-depth vote records (per card-pair accuracy/score) | Remember how you voted; de-dup | Browser `localStorage` | Until cleared | No | `features/voting/lib/voteStorage.ts:16-17,74-77,104-109` |
| 3 | Seen/voted pair keys | Skip already-voted pairs in the swipe queue | Browser `localStorage` | Until cleared | No | `features/voting/hooks/usePairQueue.ts:8,26` |
| 4 | Recent search terms (max 6) | Search UX convenience | Browser `localStorage` | Until cleared | Low (free-text the user typed) | `shared/components/SearchBottomSheet.tsx:82,103` |
| 5 | GitHub Personal Access Token (admin only) | Reveal-admin commits card data to the repo | Browser `localStorage` | Until cleared | **Yes — a secret credential** | `shared/hooks/useGithubToken.ts:5,24` |
| 6 | Supabase auth session (JWT, user id, provider tokens) | Keep a signed-in user signed in | Browser `localStorage` key `inkweave:auth` | Until sign-out / expiry | **Yes (when signed in)** | `shared/lib/supabase.ts:29-38` |
| 7 | Stale-deploy reload timestamp | Loop-guard for auto-reload after deploys | Browser `sessionStorage` | Per tab session | No | `shared/lib/staleChunkReload.ts:22,57` |
| 8 | Vote rows: card pair, vote dimensions, **hashed IP**, timestamp | Community synergy scoring + rate-limit | Supabase Postgres (`votes`), project `ttyidjyaxnycbpxwngqr`, eu-central-1 | Not defined (no deletion job in repo) | **Hashed IP = pseudonymous** | `supabase/migrations/20260330000001_votes_table.sql:1-21` |
| 9 | OAuth identity (email, name, avatar, provider id) | Auth for deck cloud sync (not yet used) | Supabase Auth (`auth.users`), eu-central-1 | Until account deletion | **Yes** | `shared/contexts/SessionContext.tsx:51-58` (see §4 caveat) |
| 10 | Behavioral events (card selected, vote submitted, search query, filters) | Product analytics | Vercel Web Analytics | Vercel-defined | No identity; free-text query is user input | `shared/lib/analytics.ts:11-64` |
| 11 | Page views + Web Vitals | Traffic + performance | Vercel Analytics / Speed Insights | Vercel-defined | IP processed transiently by Vercel (see §6) | `AppLayout.tsx:126-127` |
| 12 | Exceptions / traces (10% sample) | Error monitoring | Sentry | Sentry-defined | Possible (IP/request context) | `main.tsx:24-55` |
| 13 | Client IP (edge) | Serving the site, DDoS/security | Vercel edge logs | Vercel-defined | **Yes** | Inherent to Vercel hosting; not app code |

---

## 2. Browser storage: `localStorage` / `sessionStorage`

The complete set of storage keys the app reads or writes. There is **no storage-wrapper util** that
hides additional keys — every module wraps `localStorage`/`sessionStorage` directly with its own
try/catch helpers. A repo-wide grep for `localStorage`/`sessionStorage` returns only the modules
below (plus their tests). **No IndexedDB, Cache Storage, or `navigator.storage` usage exists** in
`src` (grep for `indexedDB|idb|caches\.|navigator\.storage` returns only a false-positive substring
inside `assets/legendary.svg`).

| Key | Store | Written by | Shape / value | Purpose | PII | Leaves device? |
|-----|-------|-----------|---------------|---------|-----|----------------|
| `inkweave:deck:draft` | localStorage | `deckStorage.ts:15` | JSON `Deck` (`id`, `name`, `cards[]`, `inks[]`, `createdAt`, `updatedAt`, `schemaVersion`) | The single active local deck draft | No | **No** (cloud sync deferred, §4) |
| `inkweave:deck:migrated:{uid}` | localStorage | `deckStorage.ts:16,105` | literal `'1'` | Idempotency flag so a signed-in user's draft isn't re-copied to cloud | No (contains a Supabase user id in the key) | No |
| `inkweave:vote:{idA}:{idB}` | localStorage | `voteStorage.ts:16,74-77` | JSON `{accuracy: -1|0|1, timestamp}` | Remember quick-vote per card pair | No | No |
| `inkweave:vote-detail:{idA}:{idB}` | localStorage | `voteStorage.ts:17,104-109` | JSON `{accuracy?, score?, timestamp}` | Remember in-depth vote per pair | No | No |
| `inkweave:voted-pairs` | localStorage | `usePairQueue.ts:8,26` | JSON `string[]` of `"idA:idB"` keys | Filter already-seen pairs from the vote queue | No | No |
| `inkweave-recent-searches` | localStorage | `SearchBottomSheet.tsx:82,103` | JSON `string[]` (≤6 trimmed queries) | Recent-search suggestions | Low — free-text the user typed | No |
| `inkweave.reveal-admin.gh-token` | localStorage | `useGithubToken.ts:5,24` | raw GitHub PAT string | Admin reveal/image tools commit to the repo | **Yes — a live credential** | Sent only to `api.github.com` (§7) |
| `inkweave:auth` | localStorage | `supabase.ts:37` (supabase-js manages contents) | Supabase auth session (access/refresh JWT, user id, provider tokens) | Keep signed-in user signed in across reloads | **Yes (when signed in)** | Token is exchanged with Supabase |
| `stale-chunk-reload-at` | sessionStorage | `staleChunkReload.ts:22,57` | timestamp (ms) string | Loop-guard for post-deploy auto-reload | No | No |

Notes:
- The deck draft is **derived-in-render for inks** and persisted **debounced (400 ms)** plus a
  teardown flush on unmount/`pagehide` (`DeckContext.tsx:126-143`). Nothing about the draft is
  transmitted anywhere today.
- Every reader validates shape and **silently clears corrupt entries** (`deckStorage.ts:65-77`,
  `voteStorage.ts:57-72`) — a resilience detail, not a data flow.
- The GitHub PAT (key `inkweave.reveal-admin.gh-token`) is the **only secret credential** in browser
  storage. It is an internal-admin surface (reveal/image tools), not something a normal end user
  encounters, but the Privacy Policy / Terms should note that admin tooling stores a token locally.

---

## 3. Supabase — community voting backend (the IP-hashing story)

Client: `shared/lib/supabase.ts`. Supabase project `ttyidjyaxnycbpxwngqr`, region **eu-central-1**
(per `CLAUDE.md`). The client is **env-gated** — if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
are unset, `isSupabaseConfigured()` is false, `loadSupabase()` resolves `null`, and all
voting/auth degrade to no-ops. Since #729 the client is also **lazy**: supabase-js is not part of
the page load. It is downloaded on first use, by any of:
- a vote (`submitVote`), or opening a synergy pair's comparison, which reads its community scores
  (`getPairScore` via `usePairScore`, in `CommunityColumn` / `MobileComparisonView`);
- a profile call (`profileRepository.ts`) or a sign-in / sign-out click;
- `SessionContext` finding a session to restore at page load: an `inkweave:auth` entry in
  `localStorage`, the `/auth/callback` path, or an OAuth `code` in the URL. When `localStorage`
  cannot be read it loads too, since a session cannot be ruled out (`SessionContext.tsx`,
  `hasSessionToRestore`).

A visitor who does none of these never loads the Supabase client and sends Supabase nothing.

### 3.1 The `votes` table

Defined in `supabase/migrations/20260330000001_votes_table.sql:1-21`:

| Column | Type | Meaning | Identifying? |
|--------|------|---------|--------------|
| `id` | uuid | Row id | No |
| `card_a_id`, `card_b_id` | text | The rated card pair (canonically ordered) | No |
| `ip_hash` | text **not null** | SHA-256 of the voter's IP + static salt | **Pseudonymous identifier** |
| `accuracy` | smallint (-1/0/1) | "engine score too low / right / too high" | No |
| `is_real` | boolean | Is this a real synergy | No |
| `score` | smallint 1–10 | User's synergy score | No |
| `would_play` | boolean | Would play the pair | No |
| `who_carries` | text (a/b/both/neither) | Which card carries | No |
| `difficulty` | smallint 1–3 | Setup difficulty | No |
| `created_at` | timestamptz | When the (latest) vote landed | No (a timestamp linkable to the ip_hash) |

RLS is **enabled** (`:27`). There is a **unique index on `(card_a_id, card_b_id, ip_hash)`**
(`:23`) — i.e. **one vote per pair per IP-hash**, enforcing de-dup server-side. The
`idx_votes_rate` index on `(ip_hash, created_at)` (`:25`) exists purely for rate-limit lookups.

### 3.2 How a vote is written — the `submit_vote` RPC

The client never inserts into `votes` directly. It calls a `SECURITY DEFINER` RPC
(`shared/lib/supabase.ts:77-115`, `supabase.rpc('submit_vote', …)`). Current definition:
`supabase/migrations/20260622000000_relax_vote_rate_limit.sql` (supersedes the original
`…0003_submit_vote_rpc.sql` and the `…0007` search-path fix). The RPC:
1. Canonically orders the pair (`:20-26`).
2. Computes `v_ip_hash := internal.hash_client_ip()` (`:28`).
3. **Rate-limits: max 200 distinct pairs per IP-hash per rolling day** (`:30-37`; raises `P0429`
   → surfaced to the client as `'rate_limited'`, `supabase.ts:99`). The original limit was 30/hour
   (`…0003:27-33`); `…0622` relaxed it to 200/day (`…0622:1-2`).
4. Upserts, **enriching** existing dimensions rather than erasing them (`:44-51`).

`execute` on `submit_vote` is granted to `anon` (`…0622:55`) — voting is **fully anonymous**, no
sign-in.

### 3.3 The IP hash — exact behavior (CRUCIAL)

`internal.hash_client_ip()`, defined in `…0000_initial_schema.sql:17-31` and hardened across
`…0004`, `…0005`, `…0006`, `…0007`:

```sql
client_ip := coalesce(
  current_setting('request.headers', true)::json->>'x-forwarded-for',
  'unknown'
);
client_ip := split_part(split_part(client_ip, ',', 1), ':', 1);  -- first hop, strip :port
select value into salt from internal.rate_limit_config where key = 'static_salt';
return encode(digest(client_ip || salt, 'sha256'), 'hex');
```

Key facts for the policy:

- **The raw IP is NEVER stored.** Only `sha256(ip || salt)` (hex) is written to `votes.ip_hash`.
- **The salt is STATIC, not rotating.** It is generated **once** at migration time —
  `insert into internal.rate_limit_config (key, value) values ('static_salt',
  encode(gen_random_bytes(32), 'hex'))` (`…0000:13-14`) — a random 32-byte value. Migration
  `…0005:34-35` renamed the key from the misleadingly-named `daily_salt` to `static_salt`,
  confirming it **does not rotate daily** (or ever). **Consequence: the same IP always produces the
  same hash**, so `ip_hash` is a **stable pseudonymous identifier** that links a person's votes over
  time. It is not reversible to an IP without brute-forcing the (secret, server-only) salt, but it
  is linkable. The policy should describe it as "a one-way hash of your IP used to prevent vote
  spam," and §10 flags the GDPR-personal-data question.
- **Storage of the salt is server-only and hidden from the API.** The `internal` schema has all
  privileges revoked from `anon`/`authenticated` (`…0000:2-3`), and the function is
  `SECURITY DEFINER` with `set search_path = ''` (`…0004:2`, `…0006`, `…0007`) so it can read the
  salt without exposing it via PostgREST.
- **`x-forwarded-for` is the IP source** (`…0000:24`), i.e. the client IP as seen by Supabase's
  edge; only the **first hop** is used and any `:port` is stripped (`:27`).

### 3.4 Reading scores — no personal data out

`getPairScore` (`supabase.ts:121-154`) reads the **`pair_scores` view**
(`…0002_pair_scores_view.sql`, refined in `…0005`, `…0406…`), which is a **pure aggregate**:
counts, trimmed-mean score, accuracy distribution, `pct_real`, `pct_would_play`, carries tallies.
The view is `security_invoker` (`…0409…`) and granted `select` to `anon` (`…0005:2`). **No IP hash,
no per-user rows are exposed** — only aggregates grouped by card pair. Reads use `.maybeSingle()`
to avoid Sentry-noise on empty pairs (`supabase.ts:138`; see §5).

### 3.5 What is NOT in Supabase yet

- **No `decks` table.** `shared/lib/database.types.ts:16-58` (the generated schema) contains **only
  `votes` + the `pair_scores` view + `submit_vote`**. There is no deck storage table.
- Deck cloud-sync and the draft→cloud copy are **explicitly deferred** to issue #464
  (`deckStorage.ts:6-9,89-92`). So today, **decks never leave the device** even for a signed-in
  user.

---

## 4. Auth & OAuth (deck cloud sync)

Added on this branch (commit "Supabase Auth for cloud decks, #463"). Code:
`shared/contexts/SessionContext.tsx`, `pages/AuthCallbackPage.tsx`, client config in
`shared/lib/supabase.ts:29-40`.

### 4.1 Configuration

`createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true,
detectSessionInUrl: true, flowType: 'pkce', storageKey: 'inkweave:auth' } })`
(`supabase.ts:29-38`). So:
- **PKCE OAuth flow** (`flowType: 'pkce'`).
- **Session persisted in `localStorage`** under `inkweave:auth` (supabase-js default storage is
  `localStorage` in the browser — **not cookies**; see §8).
- Auto token refresh.

### 4.2 Providers and identity data

`SessionProvider.signIn` calls `supabase.auth.signInWithOAuth({ provider, options: { redirectTo:
`${window.location.origin}/auth/callback` } })` (`SessionContext.tsx:51-58`), with
`AuthProvider = 'google' | 'discord'` (`:9`). The OAuth provider redirects back to
`/auth/callback` (`AuthCallbackPage.tsx`), where supabase-js exchanges the code
(`detectSessionInUrl`) and the app routes to `/decks`.

**What identity data is obtained:** The app requests **default OAuth scopes only** (no custom
`scopes` are passed in `signInWithOAuth`). For Google/Discord that typically yields the user's
**email, display name, avatar URL, and provider account id**, which Supabase Auth stores in
`auth.users` / `auth.identities` and exposes on the client `User` object
(`session.user`, `SessionContext.tsx:67`). The exact claims persisted depend on the Supabase Auth
provider config in the dashboard, which is **not in the repo** — flagged in §10. The `User` object
is held **in memory** in React state (`SessionContext.tsx:27`) and in the `inkweave:auth`
localStorage session.

### 4.3 Where decks are stored (local vs cloud) — IMPORTANT NUANCE

- **Decks are stored LOCAL ONLY today** (`localStorage` key `inkweave:deck:draft`,
  `deckStorage.ts:15`). There is **no code path that writes a deck to Supabase** (no `decks` table
  exists, §3.5).
- The auth is in place **ahead of** the cloud-deck repository (#464). The draft→cloud migration
  helpers (`hasMigratedDraft`/`markDraftMigrated`, `deckStorage.ts:99-106`) are stubs that only
  read/write a local idempotency flag; the actual copy is deferred (`:89-92`).
- **Policy implication:** signing in currently grants an identity to Supabase but **does not yet
  cause any deck data to be uploaded**. The policy should describe cloud deck sync as a feature that
  either (a) is not yet active, or (b) will upload deck contents tied to the user's account once
  #464 ships — coordinate wording with whichever state is live at launch. §10.

---

## 5. Sentry (error monitoring)

Init: `main.tsx:24-55`. **Lazy-loaded and doubly env-gated**: only runs when
`import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN` (`main.tsx:24`). So Sentry is **off in
dev and off in any build without a DSN**.

Config (`main.tsx:40-54`):
- `environment: 'production'`, `tracesSampleRate: 0.1` (10% performance-trace sampling).
- Integrations: `browserTracingIntegration()` always (`:29`), plus
  **`supabaseIntegration({ supabaseClient: SupabaseClient })`** when `VITE_SUPABASE_URL` is set
  (`:35-37`).
- `ignoreErrors`: a stale-deploy chunk-mismatch family only (`:48-53`) — noise suppression, not PII
  scrubbing.
- **No `beforeSend` hook, no `sendDefaultPii` flag, no `setUser` call** anywhere in the codebase
  (grep confirms `main.tsx` is the only Sentry init). So there is **no custom PII-scrubbing** and
  **no explicit user context** attached. Default Sentry behavior applies:
  - Sentry's browser SDK **attaches the client IP by default** (server-side, `{{auto}}`), and
    captures URL, user-agent, breadcrumbs, and stack traces. This is standard Sentry behavior, not
    something the code opts into or out of.
  - The **Supabase integration reports PostgREST errors** as Sentry events — a **known behavior**
    documented in the memory note and mitigated for the one known handled case: `getPairScore` uses
    `.maybeSingle()` specifically so an empty-pair read returns `{data:null,error:null}` instead of
    the `PGRST116` error the integration would otherwise capture (`supabase.ts:136-138`). Other
    handled Supabase errors (e.g. `submitVote` RPC errors, `supabase.ts:102-108`) may still surface
    to Sentry via the integration.

**Region (EU/DE) cannot be determined from code** — it is encoded in the `VITE_SENTRY_DSN` env var
(EU DSNs use `ingest.de.sentry.io`), which is not in the repo. The CSP allows `https://*.sentry.io`
(`vercel.json:94`), which covers both US and EU ingest hosts, so it gives no signal either. §10.

---

## 6. Vercel Analytics + Speed Insights

Mounted app-wide: `<Analytics />` and `<SpeedInsights />` in `AppLayout.tsx:126-127`
(imports `@vercel/analytics/react`, `@vercel/speed-insights/react`, `:3-4`).

### 6.1 Baseline (page views + Web Vitals)

Per Vercel's product behavior (external knowledge, not derivable from this repo): Vercel Web
Analytics is **cookieless** and does not use `localStorage`; it records page views and derives a
per-day, per-visitor **hash** on Vercel's servers from IP + user-agent (Vercel processes the IP
transiently and does not expose or persist the raw IP to the site owner). Speed Insights collects
Web Vitals (LCP/CLS/INP etc.). No identifiers are set on the device by these scripts. **This is
Vercel's documented behavior; the policy should cite Vercel's DPA/privacy docs, not this repo, for
retention specifics.**

### 6.2 Custom events (behavioral tracking) — this IS in the code

The app fires a typed custom-event catalog via `@vercel/analytics`'s `track()`
(`shared/lib/analytics.ts:1,71-76`). Events are **fire-and-forget, no-op in dev, only sent in
production with `<Analytics/>` mounted** (`:69`). The full catalog (`analytics.ts:11-64`):

| Event | Props (all card IDs / enums / user inputs — **no user identity**) |
|-------|------|
| `reveal_card_click` | cardName, cardId, source, ink, type, rarity, franchise |
| `vote_submitted` | voteType, cardAId, cardBId, cardAInk, cardBInk, engineScore, synergyCount, userScore |
| `card_selected` | cardId, cardName, source, ink, type |
| `synergy_card_clicked` | sourceCardId, clickedCardId, clickedCardName, clickedCardInk, groupKey |
| `playstyle_opened` | playstyleId, playstyleName |
| `vote_skipped` | cardAId, cardBId, engineScore |
| `search_submitted` | **query** (trimmed search term — free-text user input), source |
| `filter_applied` | facet, value, action |
| `sort_changed` | sortOrder, previousSort |
| `synergy_group_viewed` | sourceCardId, groupKey, action |

Emitters: `cardAnalytics.ts` (`card_selected`), `voteAnalytics.ts` (`vote_submitted`), and call
sites in `HomePage`, `BrowsePage`, `PlaystyleGalleryPage`, `PlaystyleDetailPage`, vote hooks. Every
prop is a card attribute, enum, or the user's own search string — **none carry a user id, email, or
device fingerprint**. The one free-text field is `search_submitted.query` (`analytics.ts:56`), which
could in principle contain whatever a user types into search. The policy should note that search
terms are sent to analytics.

### 6.3 The internal `/admin/analytics` dashboard is NOT user tracking

`/admin/analytics` (`router.tsx:227-235`) is gated by `AdminGate`, which only checks
`VITE_SHOW_ADMIN_ANALYTICS === 'true'` and otherwise redirects home (`AdminGate.tsx:9-14`) — **no
auth layer** (the comment notes the data is "not sensitive"). It reads **two build-time static
JSON artifacts**: `/data/vote-analytics.json` (`useVoteAnalytics.ts:4`) and
`/data/vercel-analytics.json` (`useVercelAnalytics.ts:4,12`). The Vercel-analytics artifact is
described as "the build-time Vercel Web Analytics artifact" (`vercelAnalyticsTypes.ts:1`,
`useVercelAnalytics.ts:12`) produced by `scripts/precompute-vercel-analytics.mjs`. **These are
pre-aggregated build outputs, not a live per-user tracking feed** — the dashboard shows vote
calibration and aggregate web-analytics event counts, nothing user-identifying.

---

## 7. Other network egress touching user data

The **authoritative allowlist** is the production Content-Security-Policy `connect-src`
(`vercel.json:94`):

```
connect-src 'self' https://api.github.com https://*.supabase.co https://*.sentry.io
            https://va.vercel-analytics.com https://vitals.vercel-insights.com
```

| Destination | What goes there | User data? | Evidence |
|-------------|-----------------|-----------|----------|
| `'self'` (inkweave.ink, Vercel) | Card JSON, synergy JSON, images, app assets | Request IP (edge), no app-level PII in payloads | `index.html:59`, `loader.ts:157` |
| `*.supabase.co` | Vote RPC, pair-score reads, auth token exchange | Hashed IP (server-derived), OAuth session | §3, §4 |
| `*.sentry.io` | Error/trace events (prod + DSN only) | Possible IP/request context | §5 |
| `va.vercel-analytics.com` | Custom events + page views | Search query text; no identity | §6 |
| `vitals.vercel-insights.com` | Web Vitals | No identity | §6 |
| `api.github.com` | **Admin-only** reveal/image tools committing card data | Uses the locally-stored PAT (§2 key 5) | `shared/lib/githubCommit.ts:4,41-52,96-139` |

### 7.1 Card images

Production serves **self-hosted, content-addressed AVIFs** from `'self'`
(`/card-images/{id}.{hash}.avif`, `loader.ts:41-61`, gated by `VITE_LOCAL_IMAGES`). In **dev/CI
only**, images proxy to `api.lorcana.ravensburger.com` via a same-origin rewrite
(`vite.config.ts:225-229`, `vercel.json:8-11`). `img-src 'self' data: https:` (`vercel.json:94`) is
permissive on images but that governs `<img>` loads, not data exfiltration. No user data is sent to
image hosts beyond a standard GET (referrer is limited by `Referrer-Policy:
strict-origin-when-cross-origin`, `vercel.json:85`).

### 7.2 Fonts — self-hosted (confirms #389)

Fonts are **self-hosted**: `index.html:48-56` preloads `/fonts/plus-jakarta-sans-400.woff2` and
`/fonts/tinos-400.woff2` from the origin, with `@font-face` in `index.css`. **No Google Fonts or
other third-party font CDN.** CSP `font-src 'self' https://vercel.live` (`vercel.json:94`) — the
`vercel.live` entry is for Vercel's preview toolbar, not user-facing production fonts.

### 7.3 GitHub API (admin surface)

`shared/lib/githubCommit.ts` talks to `api.github.com` (`:4`) using a **user-supplied PAT**
(`useGithubToken.ts`) to read/commit repo files from the browser (reveal-admin / image-admin
tools). This is an **internal content-management surface**, not something a public visitor triggers,
but it is real network egress: the admin's PAT and the card data they commit go to GitHub. Worth a
line in Terms (admin tooling) rather than the visitor-facing Privacy Policy.

---

## 8. Cookies

**The app sets no cookies of its own.** A repo-wide grep for `document.cookie` / `cookie` in
`apps/web/src` returns **zero matches**. Specifically:

- **Supabase auth uses `localStorage`, not cookies.** The client is the default browser
  `createClient` with `storageKey: 'inkweave:auth'` (`supabase.ts:37`) — supabase-js's browser
  default persists the session to `localStorage`. There is **no `@supabase/ssr` cookie-based
  adapter** in use (grep for `@supabase/ssr` / `createServerClient` returns nothing).
- **Vercel Web Analytics is cookieless** (§6.1).
- The only server-set cookies a visitor might receive are **Vercel platform cookies** (e.g. a
  load-balancing/preview cookie) that are outside app code. If present at launch, they are strictly
  functional. Confirm against the live response headers before making a "no cookies at all" claim.

**Cookie-banner implication:** because there are no first-party analytics/advertising cookies and no
third-party tracking cookies, a **classic cookie-consent banner is likely not legally required** for
cookies specifically. However, GDPR/ePrivacy consent obligations can still attach to the
**IP-hash-based rate limiting** and **behavioral analytics** — this is a legal call, flagged in §10.
Do not state "we use no cookies and therefore need no consent" without counsel sign-off.

---

## 9. Third-party data processors (summary)

| Processor | Role | Data it receives | Region |
|-----------|------|------------------|--------|
| **Vercel** | Hosting + Web Analytics + Speed Insights | Request IP (edge, transient), page views, Web Vitals, custom events (incl. search text) | Vercel infra (not pinned in repo) |
| **Supabase** | Voting DB + Auth | Hashed IP + vote data; OAuth identity (email/name/avatar/provider id) when signed in | **eu-central-1** (per CLAUDE.md) |
| **Sentry** | Error monitoring (prod + DSN only) | Exceptions, 10% traces, default request context (incl. IP) | Undetermined (DSN-encoded) |
| **Google / Discord** | OAuth identity providers | Standard OAuth consent → email, name, avatar, account id | Provider-defined |
| **GitHub** | Admin content commits (admin PAT only) | Card data + the admin's PAT | GitHub infra |
| **Ravensburger CDN** | Card images (dev/CI fallback only; self-hosted in prod) | Standard image GET | n/a in prod |

---

## 10. Open questions / cannot-determine-from-code

These must be resolved (by the user / with legal counsel / against the live deployment) before the
Privacy Policy is finalized. Do **not** guess these.

1. **Is a statically-salted IP hash "personal data" under GDPR?** The salt never rotates
   (`…0000:13-14`, `…0005:34-35`), so `ip_hash` is a stable pseudonymous identifier. Whether the
   policy must treat it as personal data (and offer erasure) is a legal determination.
2. **Vote-data retention.** No deletion/retention job exists in the repo for `votes`. Rows persist
   indefinitely unless a manual/Supabase-side policy is added. Decide and state a retention period.
3. **Sentry region + retention.** Not derivable from code (DSN-encoded). Confirm EU vs US and
   Sentry's data-retention window, and whether `sendDefaultPii` is left at its default.
4. **Exact OAuth scopes / claims persisted by Supabase Auth.** The code passes no custom `scopes`,
   so defaults apply, but the precise fields stored in `auth.users` depend on the Supabase dashboard
   provider config (not in the repo). Enumerate against the live project.
5. **Cloud deck sync state at launch.** Decks are local-only today (§4.3). If #464 ships before
   public launch, the policy must additionally cover deck contents uploaded to Supabase tied to the
   user's account. Confirm which state is live.
6. **Vercel-set functional cookies.** Confirm against live response headers whether Vercel sets any
   platform cookie, so the "cookies" section is accurate to the byte.
7. **Whether analytics/IP-hashing require consent** under GDPR/ePrivacy given no cookies are used.
   Legal call; affects whether any consent UI is needed at all.
8. **Data-subject request handling.** No delete-my-data flow exists in the code (no way to erase a
   `votes` row by IP hash, no account-deletion UI). Decide the operational process and document it.
9. **Issue #219's `App.tsx` reference is stale.** The app uses `router.tsx` +
   `pages/*` + `AppLayout.tsx`, not `App.tsx` (which does not exist). Not a data-collection fact,
   but noted since the issue's file list is out of date — legal pages wire into `router.tsx`.
