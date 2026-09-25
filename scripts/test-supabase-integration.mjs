#!/usr/bin/env node

/**
 * Supabase integration test — runs as the anon role against the live instance.
 *
 * Tests the full client path: PostgREST → security definer RPC → Postgres.
 * Catches issues that unit tests miss (search_path, RLS, grants).
 *
 * Usage: node scripts/test-supabase-integration.mjs
 * Env:   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (reads from apps/web/.env.local)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRequire } from 'module';

// Resolve @supabase/supabase-js from the web app's node_modules (pnpm workspace)
const require = createRequire(resolve(import.meta.dirname, '..', 'apps', 'web', 'package.json'));
const { createClient } = require('@supabase/supabase-js');

// Load env from apps/web/.env.local if not already set
function loadEnv() {
  if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY) return;

  try {
    const envPath = resolve(import.meta.dirname, '..', 'apps', 'web', '.env.local');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const match = line.match(/^(VITE_SUPABASE_\w+)=(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // Env file not found — rely on env vars
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  console.error('Set them in apps/web/.env.local or as environment variables');
  process.exit(1);
}

const supabase = createClient(url, key);

const PREFIX = 'inttest_';
const CARD_A = `${PREFIX}card_alpha`;
const CARD_B = `${PREFIX}card_zeta`;

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}: ${detail}`);
}

async function run() {
  console.log('Supabase Integration Tests');
  console.log(`  URL: ${url}`);
  console.log('');

  // --- Test 1: Submit vote via RPC ---
  console.log('RPC: submit_vote');
  {
    const { error } = await supabase.rpc('submit_vote', {
      p_card_a: CARD_A,
      p_card_b: CARD_B,
      p_accuracy: 1,
    });
    error ? fail('insert quick vote', error.message) : pass('insert quick vote');
  }

  // --- Test 2: Upsert — enrich with score ---
  {
    const { error } = await supabase.rpc('submit_vote', {
      p_card_a: CARD_A,
      p_card_b: CARD_B,
      p_score: 7,
    });
    error ? fail('upsert with score', error.message) : pass('upsert with score');
  }

  // --- Test 3: Canonical ordering (reversed pair) ---
  {
    const { error } = await supabase.rpc('submit_vote', {
      p_card_a: CARD_B,
      p_card_b: CARD_A,
      p_accuracy: -1,
    });
    error ? fail('canonical ordering', error.message) : pass('canonical ordering (reversed pair accepted)');
  }

  // --- Test 4: Read pair_scores view ---
  console.log('');
  console.log('View: pair_scores');
  {
    const { data, error } = await supabase
      .from('pair_scores')
      .select('*')
      .eq('card_a_id', CARD_A)
      .eq('card_b_id', CARD_B)
      .single();

    if (error) {
      fail('read pair scores', error.message);
    } else if (data.avg_score !== 7 || data.total_votes !== 1) {
      fail('read pair scores', `unexpected: avg_score=${data.avg_score}, total=${data.total_votes}`);
    } else {
      pass(`read pair scores (avg_score=${data.avg_score}, accuracy=${data.accuracy_sentiment})`);
    }
  }

  // --- Test 5: Verify COALESCE preserved score after re-vote ---
  {
    const { data, error } = await supabase
      .from('pair_scores')
      .select('avg_score, accuracy_sentiment')
      .eq('card_a_id', CARD_A)
      .eq('card_b_id', CARD_B)
      .single();

    if (error) {
      fail('coalesce preserved score', error.message);
    } else if (data.avg_score !== 7) {
      fail('coalesce preserved score', `score was ${data.avg_score}, expected 7`);
    } else {
      pass(`coalesce preserved score after accuracy re-vote (accuracy=${data.accuracy_sentiment})`);
    }
  }

  // --- Test 6: Direct INSERT blocked by RLS ---
  console.log('');
  console.log('RLS: security');
  {
    const { error } = await supabase.from('votes').insert({
      card_a_id: `${PREFIX}hack_a`,
      card_b_id: `${PREFIX}hack_z`,
      ip_hash: 'fake',
      accuracy: 1,
    });
    error ? pass(`direct INSERT blocked (${error.code})`) : fail('direct INSERT', 'should be blocked by RLS');
  }

  // --- Test 7: Direct UPDATE has no effect (no UPDATE policy) ---
  {
    // PostgREST returns success with 0 rows affected when no UPDATE policy exists.
    // Verify data is unchanged rather than checking for an error.
    await supabase.from('votes').update({ accuracy: 0 }).eq('card_a_id', CARD_A);
    const { data } = await supabase
      .from('pair_scores')
      .select('accuracy_sentiment')
      .eq('card_a_id', CARD_A)
      .eq('card_b_id', CARD_B)
      .single();
    data?.accuracy_sentiment === -1
      ? pass('direct UPDATE has no effect (data unchanged)')
      : fail('direct UPDATE', `accuracy changed to ${data?.accuracy_sentiment}, expected -1`);
  }

  // --- Test 8: Direct DELETE has no effect (no DELETE policy) ---
  {
    await supabase.from('votes').delete().eq('card_a_id', CARD_A);
    const { data } = await supabase
      .from('pair_scores')
      .select('total_votes')
      .eq('card_a_id', CARD_A)
      .eq('card_b_id', CARD_B)
      .single();
    data?.total_votes === 1
      ? pass('direct DELETE has no effect (row still exists)')
      : fail('direct DELETE', `total_votes=${data?.total_votes}, expected 1`);
  }

  // --- Test 9: Raw vote identity is not readable (only the pair_scores aggregate is) ---
  {
    const { data, error } = await supabase.from('votes').select('ip_hash').limit(1);
    error
      ? pass(`ip_hash not readable (${error.code})`)
      : fail('ip_hash readable', `anon read ${data?.length ?? 0} row(s)`);
  }

  // --- Summary ---
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('');
    console.log('NOTE: Test data (inttest_*) left in database — clean up via MCP:');
    console.log("  execute_sql: delete from public.votes where card_a_id like 'inttest_%'");
  }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
