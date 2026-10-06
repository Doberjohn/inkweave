# Database Architecture

Inkweave uses [Supabase](https://supabase.com) (hosted Postgres + PostgREST) for community voting. The database stores synergy pair votes from anonymous users and aggregates them into community scores.

**Project**: `ttyidjyaxnycbpxwngqr` | **Region**: eu-central-1 (Frankfurt) | **Tier**: Free | **Auth**: Anonymous (anon key only)

---

## Schema Overview

The database uses two schemas with strict separation of concerns:

```
public (exposed via PostgREST API)
├── votes              table    — individual user votes
├── pair_scores         view    — aggregated scores per card pair
└── submit_vote()       RPC     — the only write path (security definer)

internal (hidden from PostgREST API)
├── rate_limit_config   table   — stores IP hash salt
├── hash_client_ip()    func    — hashes the client IP (cf-connecting-ip, else the last X-Forwarded-For entry)
└── trimmed_mean()      func    — statistical aggregation (drops outliers)
```

The `internal` schema is **not accessible** via the REST API. It contains implementation details that anonymous users should never interact with directly.

```chart
{
  "type": "doughnut",
  "title": "Database Objects by Schema",
  "data": {
    "labels": ["public — tables", "public — views", "public — functions", "internal — tables", "internal — functions"],
    "values": [1, 1, 1, 1, 2]
  }
}
```

---

## Votes Table

The `votes` table stores one row per unique (card pair, IP hash) combination. All vote dimensions are nullable — users can vote on different aspects at different times.

```sql
create table votes (
  id            uuid default gen_random_uuid() primary key,
  card_a_id     text not null,        -- card identifier (sorted: a < b)
  card_b_id     text not null,        -- card identifier (sorted: a < b)
  ip_hash       text not null,        -- SHA-256 of IP + salt (non-reversible)

  -- Vote dimensions (all nullable — partial votes allowed)
  accuracy      smallint,             -- -1 (too high), 0 (Score is fair), 1 (too low)
  is_real       boolean,              -- "would this work in a real game?"
  score         smallint,             -- 1-10 user rating
  would_play    boolean,              -- "would you play these together?"
  who_carries   text,                 -- 'a', 'b', 'both', or 'neither'
  difficulty    smallint,             -- 1 (easy), 2 (medium), 3 (hard to pull off)

  created_at    timestamptz default now() not null,

  constraint pair_ordering check (card_a_id < card_b_id),
  constraint has_vote check (
    accuracy is not null or is_real is not null or score is not null
    or would_play is not null or who_carries is not null or difficulty is not null
  )
);
```

### Constraints

| Constraint | Purpose |
|-----------|---------|
| `pair_ordering` | Enforces canonical ordering (`card_a_id < card_b_id`) so "Card A vs Card B" and "Card B vs Card A" are the same row |
| `has_vote` | Prevents empty votes — at least one dimension must be filled |
| `accuracy` CHECK | Only -1, 0, or 1 |
| `score` CHECK | Only 1-10 |
| `who_carries` CHECK | Only 'a', 'b', 'both', or 'neither' |
| `difficulty` CHECK | Only 1, 2, or 3 |

### Indexes

```sql
-- One vote per (pair, user). Enables upsert on re-vote.
create unique index idx_votes_unique_pair_ip on votes (card_a_id, card_b_id, ip_hash);

-- Fast lookup for pair aggregate queries (used by pair_scores view).
create index idx_votes_pair on votes (card_a_id, card_b_id);

-- Rate limit check: "how many pairs has this IP voted on in the last hour?"
create index idx_votes_rate on votes (ip_hash, created_at);
```

---

## Pair Scores View

The `pair_scores` view aggregates votes into per-pair community scores. It uses `security_invoker = true` so it runs with the caller's permissions (anon), which means RLS on the `votes` table is respected. For that to work, anon holds column-level SELECT on exactly the eight columns the view reads (`card_a_id`, `card_b_id`, `score`, `accuracy`, `is_real`, `would_play`, `difficulty`, `who_carries`). `id`, `ip_hash` and `created_at` are not readable through the API.

```sql
create view pair_scores with (security_invoker = true) as
select
  card_a_id,
  card_b_id,
  count(*)         as total_votes,
  count(score)     as score_votes,
  count(accuracy)  as accuracy_votes,

  -- Trimmed mean: drops top/bottom 10% of scores to resist outliers
  internal.trimmed_mean(
    array_agg(score::numeric) filter (where score is not null)
  )::numeric(4,2)  as avg_score,

  avg(accuracy)::numeric(3,2)         as accuracy_sentiment,
  avg(is_real::int)::numeric(3,2)     as pct_real,
  avg(would_play::int)::numeric(3,2)  as pct_would_play,
  count(*) filter (where who_carries = 'a')       as carries_a,
  count(*) filter (where who_carries = 'b')       as carries_b,
  count(*) filter (where who_carries = 'both')    as carries_both,
  count(*) filter (where who_carries = 'neither') as carries_neither,
  avg(difficulty)::numeric(3,2)       as avg_difficulty

from votes
group by card_a_id, card_b_id;
```

### Aggregation Details

| Column | Type | What it measures |
|--------|------|-----------------|
| `avg_score` | Trimmed mean | Community rating (1-10), outlier-resistant |
| `accuracy_sentiment` | Mean of -1/0/1 | Whether engine scores feel too high (-1) or too low (1) |
| `pct_real` | Mean of boolean | % of voters who think the synergy works in practice |
| `pct_would_play` | Mean of boolean | % of voters who would play these cards together |
| `carries_a/b/both/neither` | Counts | Which card carries the synergy |
| `avg_difficulty` | Mean of 1-3 | How hard the synergy is to execute |

---

## Submit Vote RPC

`submit_vote()` is the **only write path** to the database. It's a `security definer` function, meaning it runs with the function owner's elevated permissions — not the caller's anon role. This lets it INSERT into the `votes` table even though anon has neither an INSERT privilege nor an INSERT policy on it.

```sql
create or replace function public.submit_vote(
  p_card_a text, p_card_b text,
  p_accuracy smallint default null,
  p_is_real boolean default null,
  p_score smallint default null,
  p_would_play boolean default null,
  p_who_carries text default null,
  p_difficulty smallint default null
) returns void as $$
```

### What it does (in order)

1. **Canonical pair ordering**: Sorts `p_card_a` and `p_card_b` so the smaller ID is always `card_a_id`. If swapped, `who_carries` is also flipped ('a' becomes 'b' and vice versa).

2. **IP hashing**: Calls `internal.hash_client_ip()` to get a non-reversible hash of the caller's IP address.

3. **Rate limiting**: Counts how many distinct card pairs this IP has voted on in the last hour. If >= 30, raises exception with error code `P0429`.

4. **Upsert**: Inserts the vote, or on conflict (same pair + same IP) updates using COALESCE — new non-null values fill in blanks, but never erase existing data.

### Upsert Semantics

The COALESCE pattern means votes are **enriching, not overwriting**:

```sql
on conflict (card_a_id, card_b_id, ip_hash) do update set
  accuracy    = coalesce(excluded.accuracy, votes.accuracy),
  is_real     = coalesce(excluded.is_real, votes.is_real),
  score       = coalesce(excluded.score, votes.score),
  ...
  created_at  = now();
```

Example: A user votes `score=7` on pair (A, B). Later they vote `accuracy=-1` on the same pair. Result: one row with `score=7, accuracy=-1` — both dimensions preserved.

> **Note**: `created_at` always updates to `now()` on upsert, reflecting the most recent interaction. This means the rate limit window tracks the latest activity, not the first vote.

---

## Security Model

### Row-Level Security (RLS)

RLS is enabled on the `votes` table with a minimal policy set:

| Policy | Action | Rule | Purpose |
|--------|--------|------|---------|
| `read_votes` | SELECT | `using (true)` | Allows the `pair_scores` view to aggregate data |
| *(none)* | INSERT | — | Blocked — all inserts go through `submit_vote()` RPC |
| *(none)* | UPDATE | — | Blocked — no direct updates possible |
| *(none)* | DELETE | — | Blocked — no direct deletes possible |

**Why no INSERT policy?** The `submit_vote()` function is `security definer`, so it bypasses RLS entirely. This is intentional — the function handles validation, rate limiting, and canonical ordering that raw INSERT would skip.

### Function Security

All functions use `set search_path = ''` to prevent search path injection attacks. Table and function references are fully qualified (`public.votes`, `internal.hash_client_ip()`, `extensions.digest()`).

| Function | Security | Stability | Search Path |
|----------|----------|-----------|-------------|
| `submit_vote()` | DEFINER | *volatile* | `''` |
| `hash_client_ip()` | DEFINER | STABLE | `''` |
| `trimmed_mean()` | *invoker* | IMMUTABLE | `''` |

### Schema Isolation

The `internal` schema has all privileges revoked from `anon` and `authenticated` roles:

```sql
create schema internal;
revoke all on schema internal from anon, authenticated;
```

This means PostgREST cannot expose any `internal` objects — they're invisible to the API.

### Permissions Summary

| Object | anon can... |
|--------|------------|
| `votes` table | SELECT on the eight columns `pair_scores` reads (column-level GRANT; not `id`, `ip_hash` or `created_at`). No write privileges |
| `pair_scores` view | SELECT (explicit GRANT) |
| `submit_vote()` | EXECUTE (explicit GRANT) |
| `internal.*` | Nothing (schema-level REVOKE) |

---

## IP Hashing

User identity is based on IP address hashing — there is no user authentication in v1.0.

```sql
create or replace function internal.hash_client_ip()
returns text as $$
declare
  headers json;
  xff_parts text[];
  client_ip text;
  salt text;
begin
  headers := coalesce(current_setting('request.headers', true), '{}')::json;
  xff_parts := string_to_array(headers->>'x-forwarded-for', ',');
  -- cf-connecting-ip cannot be forged; the LAST x-forwarded-for entry is the
  -- one the edge appended (the first is client-controlled)
  client_ip := lower(btrim(coalesce(
    headers->>'cf-connecting-ip',
    xff_parts[array_length(xff_parts, 1)],
    'unknown'
  )));
  -- Strip a port without truncating IPv6: only [v6]:port and a.b.c.d:port
  -- (abridged here; the exact patterns are in 20260925000000_harden_votes_access.sql)
  -- Load static salt, then SHA-256 (non-reversible)
  select value into salt from internal.rate_limit_config where key = 'static_salt';
  return encode(extensions.digest(client_ip || salt, 'sha256'), 'hex');
end;
```

### Design Decisions

- **Static salt** (not rotating): Stored in `internal.rate_limit_config`. A rotating salt would break the unique constraint deduplication — the same user would appear as a different hash after rotation, allowing double-voting.
- **Non-reversible**: SHA-256 with a salt means even with database access, IPs cannot be recovered (assuming the salt remains secret).
- **'unknown' fallback**: If neither `cf-connecting-ip` nor `x-forwarded-for` is present (shouldn't happen behind Supabase's proxy), all such requests share the same hash. This is acceptable: it's a defensive fallback, not a normal path.
- **Never the first X-Forwarded-For entry**: that entry is whatever the client sends, and a forged header arrives there (probed live on 2026-09-25). `cf-connecting-ip` is set by Cloudflare, which rejects a client-sent one at the edge, and the last X-Forwarded-For entry is the one the edge appended. For an honest client all three agree, so switching sources left existing hashes unchanged.
- **IPv6-safe port stripping**: only `[v6]:port` and `a.b.c.d:port` are stripped, and addresses are lowercased. Until 2026-09-25, `split_part(ip, ':', 1)` cut every IPv6 address to its first hextet (and an IPv4-mapped one to an empty string), merging those voters into one hash; votes merged before then cannot be split.

---

## Rate Limiting

Rate limiting is enforced server-side in the `submit_vote()` function:

- **Limit**: 200 distinct card pairs per IP per day
- **Error code**: `P0429` (custom PostgreSQL error code, mirrors HTTP 429)
- **Scope**: Per unique IP hash, counted by distinct `(card_a_id, card_b_id)` pairs
- **Window**: Rolling 1-day window (`created_at > now() - interval '1 day'`)

```sql
select count(distinct (card_a_id, card_b_id)) into v_rate_count
from public.votes
where ip_hash = v_ip_hash and created_at > now() - interval '1 day';

if v_rate_count >= 200 then
  raise exception 'Rate limit exceeded' using errcode = 'P0429';
end if;
```

**Why 200/day?** Migration `20260622000000` (#302) replaced the original 30-pairs-per-hour throttle, which got in the way of power-voters, with a daily ceiling that still stops a single anonymous IP from flooding the vote distributions. The limit counts distinct pairs voted in the last day, so re-voting a pair already voted on in that window (enriching it with more dimensions) adds nothing to the count. Two caveats:
- Once an IP is at the limit, every vote is refused, re-votes included, because the check runs before the upsert.
- A re-vote resets the row's `created_at`, so re-voting a pair last voted more than a day ago counts toward the next 24 hours again.

The limit holds only because the IP hash can't be forged: `hash_client_ip()` ignores the client-controlled first X-Forwarded-For entry (see IP Hashing).

---

## Client SDK

The TypeScript client lives at `apps/web/src/shared/lib/supabase.ts`. It provides a thin wrapper over the Supabase JS client.

### Environment Gating and Lazy Loading

supabase-js is **not** in the entry chunk (#729). `supabase.ts` imports only its types; the SDK sits behind a dynamic import of `supabaseClient.ts`, the one module that imports it as a value, and ships as its own `supabaseClient-*.js` chunk with its own size budget.

```typescript
// Synchronous, download-free: is voting/auth available at all?
export function isSupabaseConfigured(): boolean;

// Imports supabase-js and creates the client, once. Resolves null without credentials;
// rejects if the SDK fails to download, and the next call retries.
export function loadSupabase(): Promise<SupabaseClient<Database> | null>;
```

When env vars are missing, `isSupabaseConfigured()` is false, `loadSupabase()` resolves `null`, and all voting features gracefully degrade. The app works fully without Supabase — you just can't submit votes. Builds without credentials drop the SDK import entirely.

**Who downloads the SDK:** whoever first needs a client (a vote, a pair-score read, a profile call, a sign-in click), plus `SessionContext` when there is a session to restore: an `inkweave:auth` entry in localStorage (`AUTH_STORAGE_KEY`, pinned against the real supabase-js by `supabaseStorageKey.test.ts`) or the OAuth code on `/auth/callback`. An anonymous visitor who does neither never fetches it.

**Never import `@supabase/supabase-js` as a value anywhere else.** A static import puts the SDK back in the entry chunk. Type imports (`import type`) are fine.

### Vote Submission

```typescript
export async function submitVote(vote: QuickVote | InDepthVote): Promise<VoteResult> {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };
  const supabase = await loadSupabase();  // inside try: a failed download reads as 'Network error'

  const [cardA, cardB] = [vote.cardA, vote.cardB].sort();  // canonical ordering
  const { error } = await supabase.rpc('submit_vote', { p_card_a: cardA, p_card_b: cardB, ... });

  if (error?.code === 'P0429') return { error: 'rate_limited' };
  if (error) return { error: error.message };
  return { error: null };
}
```

Key behaviors:
- **Canonical ordering** enforced at client AND server (belt and suspenders)
- **Rate limit detection**: `P0429` error code mapped to `'rate_limited'` for UI handling
- **Network errors**: Try/catch wraps the RPC call, returning `{error: 'Network error'}`
- **Fire-and-forget**: The voting page submits in background — the UI advances immediately

### Score Reading

```typescript
export async function getPairScore(cardA: string, cardB: string): Promise<PairScore | null> {
  const [a, b] = [cardA, cardB].sort();
  const { data, error } = await supabase
    .from('pair_scores')
    .select('*')
    .eq('card_a_id', a)
    .eq('card_b_id', b)
    .single();
  // PGRST116 = no rows (expected for unvoted pairs)
  if (error?.code === 'PGRST116') return null;
  return data;
}
```

---

## Vote Dimensions

The database captures 6 independent vote dimensions per card pair, each targeting a different aspect of synergy quality. Dimensions vary in granularity — from binary yes/no to a full 1-10 scale:

```chart
{
  "type": "bar",
  "title": "Granularity per Vote Dimension (possible values)",
  "data": {
    "labels": ["Score", "Who Carries", "Accuracy", "Difficulty", "Is Real", "Would Play"],
    "values": [10, 4, 3, 3, 2, 2]
  }
}
```

## Vote Types

The SDK supports two vote shapes for different UI flows:

### QuickVote (Random Pair Voting — #211)

Used by the `/vote` page for rapid-fire scoring:

```typescript
type QuickVote = {
  cardA: string;       // card ID
  cardB: string;       // card ID
  accuracy: -1 | 0 | 1;
};
```

Currently the voting page sends `score` (1-10) and `whoCarries` ('both') via `InDepthVote`.

### InDepthVote (Future — #213)

Multi-dimensional vote for detailed synergy analysis:

```typescript
type InDepthVote = {
  cardA: string;
  cardB: string;
  accuracy?: -1 | 0 | 1;
  isReal?: boolean;
  score?: Score;         // 1-10
  wouldPlay?: boolean;
  whoCarries?: 'a' | 'b' | 'both' | 'neither';
  difficulty?: 1 | 2 | 3;
};
```

---

## Trimmed Mean

The `pair_scores` view uses a trimmed mean instead of a simple average for the `avg_score` column. This drops the top and bottom 10% of scores to resist outlier manipulation.

```sql
create or replace function internal.trimmed_mean(arr numeric[])
returns numeric as $$
declare
  n int := array_length(arr, 1);
  trim_count int;
  sorted numeric[];
begin
  if n is null or n = 0 then return null; end if;
  if n < 3 then return (select avg(x) from unnest(arr) x); end if;

  trim_count := floor(n * 0.1);
  sorted := (select array_agg(x order by x) from unnest(arr) x);
  return (select avg(x) from unnest(sorted[trim_count + 1 : n - trim_count]) x);
end;
```

| Votes | Behavior |
|-------|----------|
| 0 | Returns NULL |
| 1-2 | Falls back to simple average (not enough data to trim) |
| 3+ | Drops `floor(n * 0.1)` from each end, averages the rest |
| 10 | Drops 1 lowest + 1 highest, averages middle 8 |
| 100 | Drops 10 lowest + 10 highest, averages middle 80 |

```chart
{
  "type": "bar",
  "title": "Trimmed Mean — Votes Kept vs Dropped",
  "data": {
    "labels": ["3 votes", "5 votes", "10 votes", "20 votes", "50 votes", "100 votes"],
    "datasets": [
      {"label": "Kept (averaged)", "data": [3, 5, 8, 16, 40, 80], "backgroundColor": "#10b981"},
      {"label": "Dropped (outliers)", "data": [0, 0, 2, 4, 10, 20], "backgroundColor": "#ef4444"}
    ]
  }
}
```

---

## Environment Setup

### Local Development

Create `apps/web/.env.local` (gitignored):

```env
VITE_SUPABASE_URL=https://ttyidjyaxnycbpxwngqr.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-dashboard>
```

Without these variables, the app runs normally but voting is disabled with a console warning.

### Production (Vercel)

Set the same two variables in the Vercel dashboard under **Settings > Environment Variables**:

| Variable | Value | Environments |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://ttyidjyaxnycbpxwngqr.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | *(anon key)* | Production, Preview |

The `VITE_` prefix is required — Vite only embeds env vars with this prefix into the client bundle at build time.

> **The anon key is safe to expose in client-side code.** It's a public key by design. Security comes from RLS policies and the `submit_vote()` security definer function — the anon key only grants access to what RLS explicitly allows.

---

## Migration History

All migrations live in `supabase/migrations/` and are applied via the Supabase MCP `apply_migration` tool.

| Migration | What it does |
|-----------|-------------|
| `20260330000000` | Creates `internal` schema, `pgcrypto` extension, `rate_limit_config` table, `hash_client_ip()` function, `trimmed_mean()` function |
| `20260330000001` | Creates `votes` table with constraints and indexes, enables RLS |
| `20260330000002` | Creates `pair_scores` aggregation view |
| `20260330000003` | Creates `submit_vote()` RPC with canonical ordering, rate limiting, and COALESCE upsert; grants EXECUTE to anon |
| `20260330000004` | Security fixes: pins `search_path = ''` on all functions, adds SELECT policy on votes, recreates view with `security_invoker = true` |
| `20260330000005` | Review fixes: grants SELECT on `pair_scores` to anon, adds `carries_neither` column to view, renames `daily_salt` to `static_salt` |
| `20260330000006` | Fully qualifies `digest()` as `extensions.digest()` for search path safety |
| `20260330000007` | Fully qualifies `public.votes` in `submit_vote()` for search path safety |
| `20260406000001` | Recreates `pair_scores` with the accuracy distribution columns (`accuracy_lower`, `accuracy_right`, `accuracy_higher`) |
| `20260409000001` | Re-applies `security_invoker = on` to `pair_scores` (lost when the view was recreated outside migrations) |
| `20260622000000` | Relaxes the vote rate limit to 200 distinct pairs per IP per day |
| `20260925000000` | Hardens votes access: column-level SELECT for anon and authenticated (no `id`, `ip_hash` or `created_at`, no write grants); `hash_client_ip()` takes `cf-connecting-ip`, else the last X-Forwarded-For entry, and strips ports IPv6-safely |

### Migration Workflow

Schema changes follow this process using Supabase MCP tools:

1. **`apply_migration`** — Apply DDL changes (CREATE, ALTER, DROP)
2. **`list_tables` / `execute_sql`** — Verify schema applied correctly
3. **`generate_typescript_types`** — Regenerate `apps/web/src/shared/lib/database.types.ts`
4. **`get_advisors`** (security) — Check for RLS, search path, or permission warnings
5. **Commit migration SQL** to `supabase/migrations/` for version control

---

## Testing

### Unit Tests (Vitest)

**File**: `apps/web/src/shared/lib/__tests__/supabase.test.ts`

12 test cases covering:
- `isSupabaseConfigured()` / `loadSupabase()` — null without env vars and no client created, singleton behavior, retry after a failed load
- `supabaseStorageKey.test.ts` — the real supabase-js persists the session under `AUTH_STORAGE_KEY`, which `SessionContext` relies on to skip the SDK for anonymous visitors
- `submitVote()` — RPC call params, rate limit detection (P0429), network error handling, success path
- `getPairScore()` — view query, canonical ordering, PGRST116 (no rows) handling

Uses `vi.mock('@supabase/supabase-js')` and `vi.stubEnv()` for isolated testing without a live database.

### Integration Tests (Live Database)

**File**: `scripts/test-supabase-integration.mjs`  
**Command**: `pnpm test:supabase`

8 test cases against the live Supabase instance as the anon role:

| Test | What it verifies |
|------|-----------------|
| RPC insert | `submit_vote()` accepts a quick vote |
| Upsert enrichment | Adding a new dimension preserves existing data |
| Canonical ordering | Reversed card pair auto-normalizes |
| View query | `pair_scores` returns aggregated data |
| COALESCE preservation | Re-voting doesn't erase prior dimensions |
| RLS: INSERT blocked | Direct INSERT fails (no policy) |
| RLS: UPDATE blocked | Direct UPDATE has no effect (no policy) |
| RLS: DELETE blocked | Direct DELETE has no effect (no policy) |

Uses test-data prefix (`inttest_*`) for isolation. Requires `apps/web/.env.local` with live credentials.

```chart
{
  "type": "bar",
  "title": "Test Coverage by Category",
  "data": {
    "labels": ["Client loading", "submitVote()", "getPairScore()", "RPC & Upsert", "RLS Security"],
    "datasets": [
      {"label": "Unit (Vitest)", "data": [6, 6, 3, 0, 0], "backgroundColor": "#8b5cf6"},
      {"label": "Integration (Live DB)", "data": [0, 0, 0, 5, 3], "backgroundColor": "#10b981"}
    ]
  }
}
```

---

## Architecture Diagram

```
Browser (anon key)
    │
    ├── submitVote()  ──►  PostgREST  ──►  submit_vote() [security definer]
    │                                           │
    │                                           ├── hash_client_ip() → IP hash
    │                                           ├── Rate limit check (30/hr)
    │                                           └── UPSERT into votes (COALESCE)
    │
    └── getPairScore() ──►  PostgREST  ──►  pair_scores [security invoker]
                                                │
                                                ├── SELECT from votes (RLS: read_votes)
                                                └── trimmed_mean() aggregation
```

---

## Future Considerations

- **#212 Quick Vote**: Simplified voting flow (accuracy only) — uses existing `QuickVote` type
- **#213 In-Depth Vote**: Multi-dimensional voting — uses full `InDepthVote` type with all 6 dimensions
- **#214 Player Rating**: Display community scores on card detail pages — reads from `pair_scores` view
- **Authentication**: v1.0 uses anonymous voting (IP-based). Future versions may add Supabase Auth for user accounts
- **Vote moderation**: No admin tooling yet. Can query directly via Supabase dashboard
- **Scaling**: Free tier supports ~500MB database + 2GB bandwidth. Monitor via Supabase dashboard as vote volume grows
