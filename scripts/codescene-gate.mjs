#!/usr/bin/env node
/**
 * CodeScene quality-gate enforcement for pre-push.
 *
 * Spawns the CodeScene MCP server (`@codescene/codehealth-mcp`) as a stdio
 * subprocess, sends `tools/call analyze_change_set` over JSON-RPC, and
 * exits non-zero when `quality_gates: failed`. Mirrors the CI gate so a
 * failing branch never reaches the remote.
 *
 * Bypass: `CODESCENE_OK=1 git push` (use only when you've verified the
 * findings are pre-existing or otherwise acceptable).
 */
import {spawn} from 'node:child_process';
import process from 'node:process';

const BASE_REF = process.env.CODESCENE_BASE_REF || 'origin/master';
const REPO = process.cwd();

if (process.env.CODESCENE_OK === '1') {
  console.error('⚠️  CodeScene gate bypassed via CODESCENE_OK=1');
  process.exit(0);
}

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

/** Walk the per-file findings and print introduced/degraded violations to stderr. */
function reportFailedGate(payload) {
  process.stderr.write(`✗ CodeScene quality gate: ${payload.quality_gates}\n`);
  for (const file of payload.results ?? []) {
    if (file.verdict !== 'degraded') continue;
    process.stderr.write(`\n  ${file.name} [${file.verdict}]\n`);
    for (const finding of file.findings ?? []) {
      printFindingIfIntroduced(finding);
    }
  }
  process.stderr.write(
    '\n  Bypass with CODESCENE_OK=1 git push (only when findings are pre-existing/acceptable).\n',
  );
}

function printFindingIfIntroduced(finding) {
  const ct = finding['change-details']?.[0]?.['change-type'];
  if (ct !== 'introduced' && ct !== 'degraded') return;
  const desc = finding['change-details']?.[0]?.description ?? finding.category;
  process.stderr.write(`    - ${finding.category}: ${desc}\n`);
}

async function main() {
  const result = await callAnalyzeChangeSet();
  const {payload, reason} = parseAnalysisResult(result);
  if (!payload) {
    fallbackToSoftGate(reason);
    return;
  }
  if (payload.quality_gates === 'passed') {
    process.stderr.write('✓ CodeScene quality gate: passed\n');
    process.exit(0);
  }
  reportFailedGate(payload);
  process.exit(1);
}

/**
 * Soft-gate fallback: when the MCP client can't reach CodeScene (auth
 * issue, network, etc.), require an explicit `CODESCENE_OK=1` to pass.
 * Forces conscious acknowledgment that the gate didn't run automatically.
 */
function fallbackToSoftGate(reason) {
  process.stderr.write(`⚠️  CodeScene MCP unavailable: ${reason}\n`);
  process.stderr.write(
    '   Run analyze_change_set via Claude Code (or your IDE plugin) before pushing,\n' +
      '   then re-push with CODESCENE_OK=1 git push.\n',
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
