# Area 4 — Third-Party Services, Data Regions & GDPR Framing

_Research for GitHub issue #219 "Legal & Product Pages" — raw material for the Privacy Policy, Terms of Use, and IP Disclaimer pages._

## Scope

This doc is the **external-service inventory** and **legal/compliance framing** for Inkweave's legal pages. It enumerates every third-party processor the app depends on, its data-handling posture and hosting region, extracts the authoritative list of hosts the browser actually contacts (the `vercel.json` CSP), documents the data model that a data-subject request would touch, and gathers the exact affiliation facts for the IP Disclaimer. It is **not legal advice** — it is facts + considerations a lawyer/reviewer and the implementer can build on. Data-flow mechanics (which component calls what, when) are Area 3's remit; this doc focuses on _who_ receives data and _where_ it lives. Everything marked **[verify]** is general knowledge that could not be confirmed from repo evidence and must be checked before it goes into a published Privacy Policy.

---

## 1. Subprocessor table

Built from `apps/web/package.json` deps, `vercel.json` CSP, `apps/web/src/features/cards/loader.ts`, and `docs/deck-builder/AUTH_SETUP.md`. Privacy-URL column is general knowledge — **[verify] every URL before publishing**.

| Service | Purpose | Data category it processes | Hosting region | Public privacy policy (verify) |
|---|---|---|---|---|
| **Vercel** (hosting/edge) | Static site + SPA hosting, CDN, TLS, request routing | HTTP request metadata: IP address, user-agent, requested URL (standard server logs) | Global edge network; **company US-based (Vercel Inc.)**. No `regions` key in `vercel.json` → default region. [verify] | vercel.com/legal/privacy-policy |
| **Vercel Web Analytics** (`@vercel/analytics` ^2.0.1) | Page-view + custom-event product analytics | Page paths, referrers, device/geo (coarse), + typed custom events (card IDs/names, ink, type, search query strings, vote metadata) — see `analytics.ts`. **No account identifier attached.** Cookieless. [verify cookieless] | Vercel infra | vercel.com/legal/privacy-policy |
| **Vercel Speed Insights** (`@vercel/speed-insights` ^2.0.0) | Real-user Core Web Vitals (LCP/CLS/INP) | Performance timings + coarse device/route data. Cookieless. [verify] | Vercel infra | vercel.com/legal/privacy-policy |
| **Supabase** (`@supabase/supabase-js` ^2.108.2) | (a) Postgres community-voting backend; (b) Auth (Google/Discord OAuth) for deck accounts | (a) Hashed IP + vote payloads (anonymous); (b) OAuth identity in `auth.users` (email, provider id, tokens) | **eu-central-1 (Frankfurt, Germany)** — project `ttyidjyaxnycbpxwngqr`. Confirmed in `AUTH_SETUP.md` line 5 + CLAUDE.md. **EU-hosted.** | supabase.com/privacy |
| **Sentry** (`@sentry/react` ^10.62.0) | Production error + performance monitoring | Error events: stack traces, URL, user-agent, breadcrumbs, + Supabase query telemetry (via `supabaseIntegration`). May incidentally capture IP. | **Region NOT determinable from repo** (DSN lives in `VITE_SENTRY_DSN` env var; CSP `*.sentry.io` covers both US and EU/DE ingest). **[verify — task expects EU/DE]** | sentry.io/privacy |
| **Google** (OAuth provider) | Federated sign-in for deck accounts | OAuth: name, email, profile (per consent screen) | Google infra — **US-based** | policies.google.com/privacy |
| **Discord** (OAuth provider) | Federated sign-in for deck accounts | OAuth: username, email, avatar (per Discord OAuth2 scopes) | Discord infra — **US-based** | discord.com/privacy |
| **Ravensburger image CDN** (`api.lorcana.ravensburger.com`) | Source of card images | Outbound image GETs. **Production self-hosts hashed AVIFs** (see loader.ts §4) — this host is a **dev/CI fallback only** in prod. | Ravensburger infra [verify] | ravensburger.com privacy [verify] |
| **lorcanaplayer.com** | Source of Set-12 preview images | Referenced as origin only; images are **pre-converted and committed locally** (`/card-images-preview/`), so the browser does not fetch this host in prod. | n/a (not contacted at runtime) | n/a |
| **GitHub API** (`api.github.com`) | `/reveal-admin` tool commits reveal-card data via the REST API | User-supplied Personal Access Token (in `localStorage`) + card JSON | GitHub — US-based | docs.github.com privacy [verify] |
| **vercel.live** | Vercel Toolbar / preview-comment overlay | Preview-deployment collaboration only (not a production end-user data path) [verify] | Vercel infra | vercel.com/legal/privacy-policy |
| **Self-hosted fonts** | Plus Jakarta Sans + Tinos web fonts | **None** — served from `/fonts/*.woff2` on own origin. **No Google Fonts network calls** (grep for `fonts.googleapis`/`gstatic` = 0 hits; #389 self-hosting confirmed). | Own origin | n/a |

**Bundled-but-not-a-processor:** LorcanaJSON (`lorcanajson.org`) supplies the card database at **build time** (`README.md` line 122) — baked into static JSON, no runtime call, processes no user data.

---

## 2. `vercel.json` — the authoritative external-host list

The **Content-Security-Policy** is the ground truth for which third parties the browser is allowed to talk to. Full file is `vercel.json` (99 lines). Security-relevant extracts:

### CSP (`vercel.json` line 94)

```
default-src 'self';
script-src  'self' 'unsafe-inline' https://*.vercel-scripts.com https://vercel.live;
connect-src 'self' https://api.github.com https://*.supabase.co https://*.sentry.io
                   https://va.vercel-analytics.com https://vitals.vercel-insights.com;
img-src     'self' data: https:;
style-src   'self' 'unsafe-inline';
font-src    'self' https://vercel.live;
frame-src   'self' https://vercel.live;
frame-ancestors 'none'
```

**`connect-src` = the definitive list of hosts that receive XHR/fetch/beacon traffic:**

| Host | Third party | Why |
|---|---|---|
| `'self'` | Own origin | Static data JSON, card images, SPA assets |
| `https://api.github.com` | GitHub | `/reveal-admin` commit tool (admin-only) |
| `https://*.supabase.co` | Supabase | Voting RPC + Auth |
| `https://*.sentry.io` | Sentry | Error/perf ingest (covers both US `ingest.us.sentry.io` and EU `ingest.de.sentry.io` → region ambiguous) |
| `https://va.vercel-analytics.com` | Vercel | Web Analytics beacons |
| `https://vitals.vercel-insights.com` | Vercel | Speed Insights beacons |

**`img-src 'self' data: https:`** — wildcard `https:` for images. In production images are same-origin (`/card-images/...`), but the wildcard leaves the door open to any HTTPS image host.

### Image rewrite (`vercel.json` lines 7-13)

```json
{"source": "/card-images/:path*", "destination": "https://api.lorcana.ravensburger.com/images/:path*"}
```

Dev/fallback proxy to Ravensburger. Per CLAUDE.md this rewrite is **dead in production** because every card ships a content-addressed hashed AVIF on the own origin.

### Cache headers & other security headers

- `/card-images/(.*)` → `Cache-Control: public, max-age=31536000, immutable` (safe only because URLs are content-addressed/hashed).
- Global `/(.*)`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, plus the CSP above.
- **No `regions` or `functions` key** in `vercel.json` — the app is a static SPA + edge; there is no serverless-function region declaration to cite.

---

## 3. Data model — what a data-subject request would touch

### 3a. Community voting (anonymous, no account link)

Source: `supabase/migrations/20260330000001_votes_table.sql`, `..._initial_schema.sql`, `..._relax_vote_rate_limit.sql`.

```sql
create table votes (
  id uuid ..., card_a_id text, card_b_id text,
  ip_hash text not null,             -- SHA-256(x-forwarded-for + static salt), NON-REVERSIBLE
  accuracy, is_real, score, would_play, who_carries, difficulty,
  created_at timestamptz );
```

- **No user identifier.** The only quasi-identifier is `ip_hash` — a one-way SHA-256 of the client IP with a server-side static salt (`internal.hash_client_ip()`, `initial_schema.sql` lines 17-31). The raw IP is never stored; the hash is used solely for the 200-pairs/IP/day rate limit.
- **RLS:** votes readable by all (`create policy "read_votes" ... using (true)`, migration `..._0004`); writes only via the `security definer` RPC `submit_vote`, granted to the `anon` role.
- **GDPR implication:** because votes carry no reversible link to a person, they are effectively anonymous aggregate data. A deletion request has **no reliable selector** to target a specific person's votes (you'd need the raw IP + salt to recompute the hash, and even then it's shared/NAT'd). Frame votes as anonymous/aggregated, not personal data — **[verify with counsel]** whether the salted IP hash is "pseudonymous personal data" under GDPR (arguable; the salt is server-only and non-reversible).

### 3b. Deck accounts (authenticated)

- OAuth sign-in (`SessionContext.tsx` lines 51-58, `signInWithOAuth({provider})`) creates a row in Supabase **`auth.users`** with email + provider identity + refresh tokens. This IS personal data tied to an identifiable user.
- Session is stored in **`localStorage`** (`supabase.ts` lines 29-39: `persistSession`, `storageKey: 'inkweave:auth'`, `flowType: 'pkce'`) — **not cookies**.
- **Decks are currently `localStorage`-only.** `deckStorage.ts` (lines 1-9, 15) stores a single draft under `inkweave:deck:draft`; the header comment states the "**debounced Supabase sync and the actual draft→cloud copy … wait on auth (#463) + the decks repository (#464)**." **Grep confirms there is no `decks` table in `supabase/migrations/`** and no Supabase deck writes in `apps/web/src/features/deck/`. So **at present no deck content is stored server-side** — only `auth.users` exists for signed-in users, plus local-only `inkweave:deck:migrated:<uid>` guard flags.
- **GDPR implication:** a deletion request today touches (1) the `auth.users` row (deletable via Supabase Auth admin) and (2) client-side `localStorage` (user-clearable). Once #464 lands, `decks`/`deck_cards` rows keyed on the auth `uid` will also be in scope — the Privacy Policy should describe the current state accurately and either omit cloud decks or clearly label them "coming soon / when signed in." **Do not describe cloud deck storage as live — it is not.**

### 3c. Client-side storage summary (for a cookie/storage disclosure)

| Key | Store | Contents | Set by |
|---|---|---|---|
| `inkweave:auth` | localStorage | Supabase session (JWT + refresh token, PKCE) | supabase.ts |
| `inkweave:deck:draft` | localStorage | Working deck draft | deckStorage.ts |
| `inkweave:deck:migrated:<uid>` | localStorage | First-sign-in migration guard flag | deckStorage.ts |
| `inkweave.reveal-admin.gh-token` | localStorage | Admin GitHub PAT (admin tool only) | useGithubToken.ts |
| Vote de-dup / beta-notice dismissal | localStorage | UI state (per memory + `VITE_SHOW_BETA_NOTICE`) | various |
| Service Worker caches | Cache Storage | Card images, synergy JSON, app shell | VitePWA (vite.config.ts) |

**No `document.cookie` writes found in `apps/web/src`.** Vercel Analytics/Speed Insights are cookieless **[verify]**. This means Inkweave may not set any HTTP cookies at all — relevant to whether an ePrivacy/PECR cookie banner is required (localStorage for non-essential purposes can still trigger consent obligations — **[verify with counsel]**).

---

## 4. GDPR / region specifics

| Fact | Evidence | Implication |
|---|---|---|
| Supabase in **eu-central-1 (Frankfurt)** | `AUTH_SETUP.md` line 5, CLAUDE.md | Primary user data (auth + votes) stays in the **EU** — favorable for GDPR; no default third-country transfer for the DB. |
| Sentry region **unknown** | CSP `*.sentry.io` matches US + EU; DSN in env | **[verify]** — if US, error data (may include IP/URL) is a **third-country transfer** needing an SCC/transfer basis. If EU (`de.sentry.io`), no transfer. Resolve before publishing. |
| Vercel edge/analytics | `vercel.json`, deps | Vercel Inc. is US-based; edge nodes global. Request logs + analytics likely involve **US processing / transfer** → cite Vercel's DPA + SCCs. **[verify]** |
| OAuth Google + Discord | `SessionContext.tsx`, `AUTH_SETUP.md` | Both **US** providers. Federated auth = data shared with a US processor at sign-in → transfer basis needed. **[verify]** |
| Card images self-hosted in prod | `loader.ts` lines 41-60 + CLAUDE.md | No runtime call to Ravensburger/lorcanaplayer for the typical user → no image-CDN transfer in prod. |
| Fonts self-hosted | `index.html` lines 48-56, grep | No Google Fonts → no font-CDN IP leak (the classic GDPR font issue is avoided). |

### Privacy-Policy GDPR checklist (what the page must address)

- [ ] **Data collected** — (a) anonymous votes with salted IP hash; (b) product analytics events (card/search interaction, no account id); (c) error diagnostics (Sentry); (d) for signed-in users: OAuth identity (email, provider id); (e) client-side localStorage/SW cache. **No deck data server-side today.**
- [ ] **Lawful basis** — legitimate interest for anonymous analytics/voting + error monitoring; consent/contract for OAuth account creation & (future) deck storage. **[verify with counsel]**
- [ ] **Special-category data** — none collected.
- [ ] **Retention** — votes: indefinite aggregate (no per-person retention concept); `auth.users`: for account lifetime; analytics/Sentry: per each vendor's retention window **[verify each]**.
- [ ] **Deletion / data-subject rights path** — provide a contact; note that anonymous votes cannot be individually identified/deleted; account deletion removes `auth.users` (+ future deck rows). Users can clear localStorage themselves.
- [ ] **EU hosting** — state Supabase is EU (Frankfurt).
- [ ] **Third-country transfers** — disclose US processors: Vercel, Google, Discord, GitHub (admin), and Sentry-if-US. Reference each vendor's SCCs/DPA. **[verify]**
- [ ] **Subprocessor list** — publish §1 table (or a maintained subset).
- [ ] **Contact for requests** — a controller contact email is required and **does not exist in the repo yet** (see open questions).
- [ ] **Cookies/storage** — disclose localStorage keys (§3c) and cookieless analytics; decide on a cookie/consent banner. **[verify]**
- [ ] **Children** — Lorcana skews all-ages; consider a minimum-age statement. **[verify]**

---

## 5. IP Disclaimer — affiliation & ownership facts

### What the repo currently says (precedent)

| Source | Wording |
|---|---|
| `README.md` line 5 | "A synergy finder for [Disney Lorcana TCG](https://www.disneylorcana.com/) focused on Core format." |
| `README.md` line 122 | "Card data is sourced from [LorcanaJSON](https://lorcanajson.org/) …" |
| `apps/web/index.html` lines 12-15, 32-33 | Title/OG: "Inkweave — Master Lorcana Synergies … synergies for **Disney Lorcana**." |
| `apps/web/package.json` line 5 | "Discover synergistic card combinations for **Disney Lorcana TCG**" |
| `loader.ts` lines 38-39 | Image origins: `api.lorcana.ravensburger.com`, `lorcanaplayer.com` |

### Established facts for the disclaimer

- **Disney Lorcana** is a trademarked TCG **published by Ravensburger under license from Disney.** All card names, images, art, and game text are the intellectual property of **Ravensburger and/or The Walt Disney Company. [verify exact rights-holder attribution wording]**
- **Card images** originate from Ravensburger's CDN (`api.lorcana.ravensburger.com`); card **data** from the community project **LorcanaJSON** (`lorcanajson.org`).
- **Inkweave is an independent, unofficial fan project.** It is **not affiliated with, endorsed, sponsored, or approved by Ravensburger or Disney.**
- Recommended disclaimer skeleton (fan-project standard — **[verify with counsel]**): _"Inkweave is an unofficial fan-made tool. Disney Lorcana, all card images, names, and related marks are trademarks and copyrights of Ravensburger AG and/or The Walt Disney Company. Inkweave is not affiliated with, endorsed, or sponsored by Ravensburger or Disney. Card data provided by LorcanaJSON."_

### Gaps found (no precedent exists — do NOT invent, flag to user)

- **There is NO existing "unofficial / not affiliated" disclaimer anywhere in the repo.** This page has no wording to reuse; the skeleton above is a proposal, not existing copy.
- **`README.md` line 126 says "License: MIT" but there is NO `LICENSE`/`LICENSE.md`/`NOTICE` file at the repo root** (confirmed by directory listing). The code license is asserted but not actually provided — separate from card-IP, but worth flagging since the Terms/IP page may reference "our code vs. their IP."

---

## 6. Discrepancies & notes for the implementer

1. **Issue #219 "Files" cites `apps/web/src/App.tsx` — that file does not exist.** The app uses `apps/web/src/router.tsx` (`createBrowserRouter`, lazy routes). Legal routes must be added there, as non-gated children of `<AppLayout />` (do NOT wrap in `RevealsGate`/`AdminGate`).
2. **Sentry region is unconfirmed from repo evidence** — the single most important open item for the transfers section. Verify against the live `VITE_SENTRY_DSN` in Vercel (`o<org>.ingest.de.sentry.io` = EU; `.us.` or bare = US).
3. **Cloud deck storage is not live** (localStorage only; #464 deferred). Write the Privacy Policy to the current state.
4. **No controller contact email exists in the repo.** The only human identifier is the git author `johnfanidis@gmail.com` (session context) — a dedicated privacy/contact address should be decided by the user, not assumed.
5. **No cookies are set by the app** (localStorage + cookieless analytics) — this simplifies the cookie-banner question but does not eliminate the ePrivacy/localStorage-consent discussion.
