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

async function main() {
  // 1. Initialize handshake
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
  // 2. Notify initialized (notification — no id, no response)
  proc.stdin.write(
    JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized', params: {}}) + '\n',
  );

  // 3. Call analyze_change_set
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
  const result = await waitFor(2);

  // The tool returns content as text — first content item holds the JSON payload
  const text = result.result?.content?.[0]?.text;
  if (!text) {
    fallbackToSoftGate('empty MCP result');
    return;
  }

  // CodeScene MCP can return plain-text auth/licensing errors when run
  // outside Claude Code's MCP integration (e.g. via raw `npx`). Detect that
  // shape and fall through to the soft-gate path so pre-push isn't blocked
  // by an environmental issue we can't fix from the hook.
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    fallbackToSoftGate(`MCP returned non-JSON: ${text.slice(0, 80)}`);
    return;
  }

  const gate = payload.quality_gates;
  if (gate === 'passed') {
    process.stderr.write('✓ CodeScene quality gate: passed\n');
    process.exit(0);
  }

  // Failed — surface the specific findings
  process.stderr.write(`✗ CodeScene quality gate: ${gate}\n`);
  for (const file of payload.results ?? []) {
    if (file.verdict !== 'degraded') continue;
    process.stderr.write(`\n  ${file.name} [${file.verdict}]\n`);
    for (const finding of file.findings ?? []) {
      const introduced = finding['change-details']?.[0]?.['change-type'];
      if (introduced !== 'introduced' && introduced !== 'degraded') continue;
      const desc = finding['change-details']?.[0]?.description ?? finding.category;
      process.stderr.write(`    - ${finding.category}: ${desc}\n`);
    }
  }
  process.stderr.write(
    '\n  Bypass with CODESCENE_OK=1 git push (only when findings are pre-existing/acceptable).\n',
  );
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
