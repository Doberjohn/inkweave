/**
 * Policy for issue-create-guard.sh: `gh issue create` (or its alias `gh issue new`)
 * goes through the /draft-issue skill, which publishes with the SKILL_APPROVED=1
 * prefix. Decides on parsed commands (lib/shell-command.mjs), so a PR body or a
 * commit message that mentions the command never blocks.
 */
import {commandsIn, dialectOf, ghInvocation} from './lib/shell-command.mjs';

const ALLOW = Object.freeze({code: 0, message: ''});
const block = (message) => ({code: 2, message});

const CREATE = new Set(['create', 'new']);
const MESSAGE =
  'Use /draft-issue: it scores the draft against the 8-section rubric and calls gh issue create ' +
  'on approval.';
const BASH_BYPASS = 'Bypass: prefix with SKILL_APPROVED=1.';

// PowerShell and Monitor calls cannot carry the prefix; the skill publishes through Bash.
function noPrefixBypass(toolName) {
  const who = toolName === 'PowerShell' ? 'PowerShell' : `A ${toolName} tool call`;
  return (
    `${who} cannot carry the SKILL_APPROVED=1 prefix, so this always blocks here; the skill ` +
    'publishes with the Bash tool.'
  );
}
const PARSE_ERROR =
  'issue-create-guard could not parse this command, and it mentions gh, so it is blocked to be ' +
  'safe.';
const MENTIONS_GH = /(?<![\w-])gh(?!\w)/i;

/** {code, message}: 2 blocks with the message shown to Claude, 0 allows. */
export function decide(input) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) return ALLOW;
  const creates = createsIssue(command, dialectOf(input.tool_name));
  if (creates === null) return MENTIONS_GH.test(command) ? block(PARSE_ERROR) : ALLOW;
  return creates ? approvalCheck(input.tool_name, command) : ALLOW;
}

// The prefix counts only as the literal start of a Bash tool call, as it always has.
function approvalCheck(toolName, command) {
  if (toolName !== 'Bash') return block(`${MESSAGE} ${noPrefixBypass(toolName)}`);
  return command.startsWith('SKILL_APPROVED=1 ') ? ALLOW : block(`${MESSAGE} ${BASH_BYPASS}`);
}

function createsIssue(command, dialect) {
  try {
    return commandsIn(command, dialect).some(isIssueCreation);
  } catch {
    return null;
  }
}

function isIssueCreation({argv}) {
  const words = ghInvocation(argv);
  if (words?.[0] !== 'issue' || !CREATE.has(words[1])) return false;
  return !asksForHelp(argv);
}

// gh issue create flags that take a value: after one, `-h` is that value, not help.
const VALUE_FLAGS = new Set([
  '-t',
  '--title',
  '-b',
  '--body',
  '-F',
  '--body-file',
  '-l',
  '--label',
  '-a',
  '--assignee',
  '-m',
  '--milestone',
  '-p',
  '--project',
  '-R',
  '--repo',
  '-T',
  '--template',
  '--recover',
]);
const isHelpFlag = (arg) => arg === '--help' || arg === '-h';

// `gh issue create --help` only prints usage; `--title -h` still creates an issue.
function asksForHelp(argv) {
  return argv.some((arg, i) => isHelpFlag(arg) && !VALUE_FLAGS.has(argv[i - 1]));
}
