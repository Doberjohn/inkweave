/**
 * Policy for git-write-protection.sh, whose header states the rules.
 *
 * Decides on the commands a tool call would run, as parsed by lib/shell-command.mjs:
 * git options before the subcommand, cd chains, nested shells and runners are
 * seen through, while quoted text, heredoc bodies and comments never count.
 */
import {commandsIn, dialectOf, gitInvocation} from './lib/shell-command.mjs';

const ALLOW = Object.freeze({code: 0, message: ''});
const block = (message) => ({code: 2, message});

const WRITES = new Set(['commit', 'push']);

// `git checkout <rev> -- <path>` overwrites <path>; `git checkout <branch> --` only switches.
function pathsAfterSeparator(args) {
  const at = args.indexOf('--');
  return at !== -1 && at < args.length - 1;
}

// git accepts any unique prefix of a long option, so --har is --hard and --forc is --force.
function longOption(arg, name) {
  return arg.startsWith('--') && arg.length > 2 && name.startsWith(arg.slice(2));
}

function isForce(arg) {
  return longOption(arg, 'force') || /^-[A-Za-z]*f[A-Za-z]*$/.test(arg);
}

// Never bypassable, USER_APPROVED=1 included.
const HARD_RULES = [
  {
    verb: 'checkout',
    matches: pathsAfterSeparator,
    message:
      'Destructive git checkout detected. This discards uncommitted changes. Run this manually.',
  },
  {
    verb: 'restore',
    matches: () => true,
    message: 'git restore detected. This can discard changes. Run this manually.',
  },
  {
    verb: 'reset',
    matches: (args) => args.some((arg) => longOption(arg, 'hard') || longOption(arg, 'mixed')),
    message: 'Destructive git reset detected. This can lose commits/changes. Run this manually.',
  },
  {
    verb: 'clean',
    matches: (args) => args.some(isForce),
    message: 'git clean -f detected. This permanently deletes untracked files. Run this manually.',
  },
  {
    verb: 'worktree',
    matches: (args) => args[0] === 'remove' || args[0] === 'prune',
    message:
      'Worktree deletion detected. Worktrees may be active in other sessions. Run this manually.',
  },
];

// A pipeline reports its LAST command's exit status, so `git push | tail` looks
// green even when the pre-push hook rejected the push. That has happened, so a
// piped commit or push is blocked outright, with no escape hatch: approval is
// about whether the write happens, not whether its result may be hidden.
const PIPE_MESSAGE =
  "Piped git commit/push detected. A pipeline reports the LAST command's exit status, so a " +
  'rejected pre-commit or pre-push hook looks green. This has happened. Run it unpiped and read ' +
  'the full output; for long runs use a background run and read its output file. No prefix ' +
  'bypasses this.';
const SOFT_MESSAGES = {
  commit: 'Git commit detected. Present a summary of changes and get explicit user approval first.',
  push: 'Git push detected. Get explicit user approval first. (E2E runs automatically via pre-push hook.)',
};
const BASH_RETRY =
  'Then retry with USER_APPROVED=1 as the literal first characters of the command.';
// PowerShell and Monitor calls cannot carry the prefix, so commits and pushes go through Bash.
function noPrefixRetry(toolName) {
  const who = toolName === 'PowerShell' ? 'PowerShell' : `A ${toolName} tool call`;
  return (
    `${who} cannot carry the USER_APPROVED=1 prefix, so a commit or push always blocks here: ` +
    'after approval, run it with the Bash tool as `USER_APPROVED=1 git ...`.'
  );
}
const PARSE_ERROR =
  'git-write-protection could not parse this command, and it mentions git, so it is blocked to ' +
  'be safe. Simplify the command, or run it manually.';
const MENTIONS_GIT = /(?<![\w-])git(?!\w)/i;

/** {code, message}: 2 blocks with the message shown to Claude, 0 allows. */
export function decide(input) {
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || !command.trim()) return ALLOW;
  const calls = gitCalls(command, dialectOf(input.tool_name));
  if (!calls) return MENTIONS_GIT.test(command) ? block(PARSE_ERROR) : ALLOW;
  return (
    hardBlock(calls) ?? pipeBlock(calls) ?? softBlock(calls, input.tool_name, command) ?? ALLOW
  );
}

function gitCalls(command, dialect) {
  try {
    return commandsIn(command, dialect).flatMap(({argv, piped}) => {
      const git = gitInvocation(argv);
      return git ? [{...git, piped}] : [];
    });
  } catch {
    return null;
  }
}

function hardBlock(calls) {
  for (const {verb, args} of calls) {
    const rule = HARD_RULES.find((candidate) => candidate.verb === verb && candidate.matches(args));
    if (rule) return block(rule.message);
  }
  return null;
}

function pipeBlock(calls) {
  return calls.some(({verb, piped}) => piped && WRITES.has(verb)) ? block(PIPE_MESSAGE) : null;
}

// The prefix counts only as the literal start of a Bash tool call, as it always has.
function softBlock(calls, toolName, command) {
  const write = calls.find(({verb}) => WRITES.has(verb));
  if (!write) return null;
  const message = SOFT_MESSAGES[write.verb];
  if (toolName !== 'Bash') return block(`${message} ${noPrefixRetry(toolName)}`);
  return command.startsWith('USER_APPROVED=1 ') ? null : block(`${message} ${BASH_RETRY}`);
}
