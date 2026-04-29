#!/usr/bin/env node
/**
 * CodeScene quality-gate enforcement for pre-push.
 *
 * Spawns the CodeScene MCP server (`@codescene/codehealth-mcp`) as a stdio
 * subprocess, sends `tools/call analyze_change_set` over JSON-RPC, and
 * exits non-zero when `quality_gates: failed`. Mirrors the CI gate so a
 * failing branch never reaches the remote.
 *
 * Auth: requires `CS_ACCESS_TOKEN` in the User-scope environment so the
 * spawned subprocess inherits it. Get a token at
 * https://codescene.io/users/me/pat — see reference_codescene_auth.md
 * memory entry for the setup walkthrough.
 *
 * No env-var bypass exists. If CodeScene's service is hard-down and a push
 * is genuinely urgent, use `git push --no-verify` — an explicit, visible
 * action rather than a config-based escape that becomes routine.
 */
import {spawn} from 'node:child_process';
import process from 'node:process';

const BASE_REF = process.env.CODESCENE_BASE_REF || 'origin/master';
const REPO = process.cwd();

const proc = spawn('npx', ['-y', '@codescene/codehealth-mcp'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});

let buf = '';
const responses = new Map();
const send = (msg) => proc.stdin.write(JSON.stringify(msg) + '\n');
const waitFor = (id) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`MCP call ${id} timed out after 120s`)), 120_000);
    responses.set(id, {resolve, reject, timer: t});
  });

proc.stdout.on('data', (chunk) => {
  buf += chunk.toString('utf8');
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id == null) continue;
    const handler = responses.get(msg.id);
    if (handler) {
      clearTimeout(handler.timer);
      responses.delete(msg.id);
      handler.resolve(msg);
    }
  }
});

proc.on('error', (err) => {
  console.error('Failed to spawn CodeScene MCP:', err.message);
  process.exit(2);
});

/** Run the MCP handshake + tools/call, return the analyze_change_set response. */
async function callAnalyzeChangeSet() {
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {name: 'inkweave-pre-push', version: '1.0.0'},
    },
  });
  await waitFor(1);
  proc.stdin.write(
    JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized', params: {}}) + '\n',
  );
  process.stderr.write(`⚙ Running CodeScene analyze_change_set against ${BASE_REF}...\n`);
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'analyze_change_set',
      arguments: {base_ref: BASE_REF, git_repository_path: REPO},
    },
  });
  return await waitFor(2);
}

/**
 * Parse the MCP tool response into a payload, or null if the response is
 * unusable (empty, non-JSON auth error, missing content).
 */
function parseAnalysisResult(result) {
  const text = result.result?.content?.[0]?.text;
  if (!text) return {payload: null, reason: 'empty MCP result'};
  try {
    return {payload: JSON.parse(text), reason: null};
  } catch {
    return {payload: null, reason: `MCP returned non-JSON: ${text.slice(0, 80)}`};
  }
}

/**
 * Collect findings whose top-level `change-type` is "introduced" or "degraded".
 * MCP's `quality_gates: passed` only checks for "introduced" verdicts on files,
 * but CI's "Pay Down Tech Debt" profile rejects ANY degradation to debt-laden
 * files even when the per-file verdict is "stable" (e.g. SynergyToolbar +1 LoC
 * pp 4.59 → 4.608). We mirror that stricter rule locally.
 */
function collectStrictFindings(payload) {
  const violations = [];
  for (const file of payload.results ?? []) {
    for (const finding of file.findings ?? []) {
      const topLevelChange = finding['change-type'];
      if (topLevelChange !== 'introduced' && topLevelChange !== 'degraded') continue;
      violations.push({file: file.name, finding, topLevelChange});
    }
  }
  return violations;
}

function printViolation({file, finding, topLevelChange}) {
  const desc = finding['change-details']?.[0]?.description ?? finding.category;
  const ppDelta = finding['new-pp'] != null && finding['old-pp'] != null
    ? ` (pp ${finding['old-pp']} → ${finding['new-pp']})`
    : '';
  process.stderr.write(`  [${topLevelChange}] ${file} — ${finding.category}${ppDelta}\n    ${desc}\n`);
}

async function main() {
  const result = await callAnalyzeChangeSet();
  const {payload, reason} = parseAnalysisResult(result);
  if (!payload) {
    failOnAuthOrTransport(reason);
    return;
  }
  // Strict-mode check: collect any introduced/degraded findings, regardless of
  // the file's verdict or the top-level quality_gates result.
  const violations = collectStrictFindings(payload);
  if (payload.quality_gates === 'passed' && violations.length === 0) {
    process.stderr.write('✓ CodeScene quality gate: passed (strict)\n');
    process.exit(0);
  }
  process.stderr.write(
    `✗ CodeScene quality gate: ${payload.quality_gates} — ${violations.length} introduced/degraded findings\n\n`,
  );
  for (const v of violations) printViolation(v);
  process.stderr.write(
    '\n  Refactor before pushing. To override, use git push --no-verify (visible, explicit, audited).\n',
  );
  process.exit(1);
}

/**
 * Hard-fail when the MCP subprocess can't reach CodeScene (typically an
 * auth issue: CS_ACCESS_TOKEN is not set in the environment, so the
 * subprocess can't authenticate to the cloud API).
 *
 * No silent bypass. If the user genuinely needs to push without the gate
 * (e.g. CodeScene service is hard-down), `git push --no-verify` is the
 * documented escape — visible in shell history, explicit per-push.
 */
function failOnAuthOrTransport(reason) {
  process.stderr.write(`✗ CodeScene MCP unavailable: ${reason}\n\n`);
  process.stderr.write(
    '  Most likely cause: CS_ACCESS_TOKEN is not set or has expired.\n' +
      '  Fix:\n' +
      '    1. Get a token at https://codescene.io/users/me/pat\n' +
      '    2. setx CS_ACCESS_TOKEN "<paste-token>"   (PowerShell)\n' +
      '    3. Restart your terminal so the User-scope env var propagates.\n\n' +
      '  Service-down emergency only: git push --no-verify\n',
  );
  process.exit(1);
}

main()
  .catch((err) => {
    console.error('CodeScene gate error:', err.message);
    process.exit(2);
  })
  .finally(() => {
    try {
      proc.kill();
    } catch {
      /* ignore */
    }
  });
