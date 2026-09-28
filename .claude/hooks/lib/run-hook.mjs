/**
 * Entry point for the PreToolUse policy modules: `node lib/run-hook.mjs <policy>`.
 *
 * Reads the hook payload from stdin, asks the policy module's decide(), reports a
 * block on stderr and sets the exit code (2 = block, 0 = allow). A payload that
 * is not JSON has nothing to check and is allowed. Any other failure exits 1,
 * which the calling .sh wrapper treats as "the policy could not run".
 */
import {readFileSync} from 'node:fs';

const name = process.argv[2] ?? '';
if (!/^[a-z-]+$/.test(name)) throw new Error(`run-hook: invalid policy name "${name}"`);
const {decide} = await import(new URL(`../${name}.mjs`, import.meta.url));

// A failed read throws (exit 1), so the wrapper fails closed; only text that is not
// JSON counts as "nothing to check".
const raw = readFileSync(0, 'utf8');
let input = null;
try {
  input = JSON.parse(raw);
} catch {
  // Not a PreToolUse payload: nothing to check.
}
const {code, message} = input ? decide(input) : {code: 0, message: ''};
if (message) process.stderr.write(`${message}\n`);
process.exitCode = code;
