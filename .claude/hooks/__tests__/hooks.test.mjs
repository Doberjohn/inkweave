/**
 * End-to-end case table for the shell PreToolUse guards (#607).
 *
 * Every row pipes a PreToolUse payload into the real hook scripts, the way
 * Claude Code runs them (`bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"`),
 * and checks each hook's exit code (2 = block, 0 = allow) and message family.
 * The hooks only parse the command, so no git or gh command runs here.
 */
import {spawn} from 'node:child_process';
import {copyFileSync, existsSync, mkdtempSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const HOOKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_DIR = path.resolve(HOOKS_DIR, '..', '..');
const GIT_HOOK = 'git-write-protection.sh';
const ISSUE_HOOK = 'issue-create-guard.sh';
const BS = String.fromCharCode(92);
// Each row spawns bash and node twice; on a loaded Windows machine that alone can
// take seconds, well past vitest's 5 s default.
const SPAWN_TIMEOUT = 60_000;

const B = 'Bash';
const P = 'PowerShell';
const M = 'Monitor';
const OK = 'ok';
const HARD = 'hard';
const PIPE = 'pipe';
const COMMIT = 'commit';
const PUSH = 'push';
const ISSUE = 'issue';
const PARSE = 'parse';

const MESSAGES = {
  [HARD]: /Run this manually/,
  [PIPE]: /Piped git commit\/push detected/,
  [COMMIT]: /Git commit detected/,
  [PUSH]: /Git push detected/,
  [ISSUE]: /\/draft-issue/,
  [PARSE]: /could not parse this command/,
};
const PREFIX = {
  [COMMIT]: /USER_APPROVED=1/,
  [PUSH]: /USER_APPROVED=1/,
  [ISSUE]: /SKILL_APPROVED=1/,
};
// Where a soft block tells Claude the prefix can go: only a Bash call carries it.
const NO_PREFIX = {[P]: /PowerShell cannot carry/, [M]: /Monitor tool call cannot carry/};

const encoded = (script) => Buffer.from(script, 'utf16le').toString('base64');

// [tool, command, git-write-protection outcome, issue-create-guard outcome, note]
const CASES = [
  // --- commit and push need the USER_APPROVED=1 prefix (soft block) ---
  [B, 'git commit -m "x"', COMMIT, OK, 'plain commit'],
  [B, 'USER_APPROVED=1 git commit -m "x"', OK, OK, 'approved commit'],
  [B, 'git push', PUSH, OK, 'plain push'],
  [B, 'USER_APPROVED=1 git push -u origin fix/607-git-hook-blind-spots', OK, OK, 'approved push'],
  [B, 'USER_APPROVED=0 git push', PUSH, OK, 'only =1 approves'],
  [B, ' USER_APPROVED=1 git push', PUSH, OK, 'a leading space is not the literal start'],
  [B, 'git -C . commit -m x', COMMIT, OK, 'global -C'],
  [B, 'USER_APPROVED=1 git -C . commit -m x', OK, OK, 'approved, global -C'],
  [B, 'git -c user.name=x commit -m x', COMMIT, OK, 'global -c'],
  [B, 'git --no-pager push', PUSH, OK, 'global --no-pager'],
  [B, 'git -p commit -m x', COMMIT, OK, 'global -p'],
  [B, 'git --git-dir=.git --work-tree=. push', PUSH, OK, '--git-dir= and --work-tree='],
  [B, 'git --git-dir .git push', PUSH, OK, '--git-dir <path>'],
  [B, 'git --namespace foo push', PUSH, OK, '--namespace <name>'],
  [B, 'git --exec-path=/usr/lib/git-core commit -m x', COMMIT, OK, '--exec-path=<path>'],
  [B, 'git -C "D:/johnn/Projects/inkweave" push origin HEAD', PUSH, OK, 'global -C, absolute path'],
  [B, 'git  commit -m x', COMMIT, OK, 'double space'],
  [B, 'git\tpush', PUSH, OK, 'tab'],
  [B, 'git "commit" -m x', COMMIT, OK, 'quoted verb'],
  [B, "git c'omm'it -m x", COMMIT, OK, 'partly quoted verb'],
  [B, 'git 2>/dev/null push', PUSH, OK, 'redirection before the verb'],
  [B, `git ${BS}\n  commit -m x`, COMMIT, OK, 'line continuation'],
  [B, 'cd apps/web && git commit -m x', COMMIT, OK, 'cd chain'],
  [B, 'cd apps/web && USER_APPROVED=1 git commit -m x', COMMIT, OK, 'the prefix must lead'],
  [B, 'GIT_TRACE=1 git push', PUSH, OK, 'environment assignment'],
  [B, 'env GIT_TRACE=1 git push', PUSH, OK, 'runner: env'],
  [B, 'env -i PATH="$PATH" git push', PUSH, OK, 'runner: env with options'],
  [B, 'timeout 600 git push', PUSH, OK, 'runner: timeout'],
  [B, 'nohup git push > push.log 2>&1 &', PUSH, OK, 'runner: nohup, backgrounded'],
  [B, 'command git push', PUSH, OK, 'runner: command'],
  [B, 'time git push', PUSH, OK, 'runner: time'],
  [B, 'xargs -n1 git push < remotes.txt', PUSH, OK, 'runner: xargs'],
  [B, '"C:/Program Files/Git/cmd/git.exe" push', PUSH, OK, 'git by Windows path'],
  [B, '/usr/bin/git commit -m x', COMMIT, OK, 'git by POSIX path'],
  [B, 'git.exe push', PUSH, OK, 'git.exe'],
  [B, 'GIT push', PUSH, OK, 'program name is case-insensitive'],
  [B, 'git status && git push', PUSH, OK, 'after &&'],
  [B, 'git status; git push', PUSH, OK, 'after ;'],
  [B, 'git status || git push', PUSH, OK, 'after ||'],
  [B, 'git push || echo "push failed"', PUSH, OK, '|| unapproved'],
  [B, 'USER_APPROVED=1 git push || echo "push failed"', OK, OK, '|| stays legal'],
  [B, 'git status\ngit push', PUSH, OK, 'second line'],
  [B, '(git push)', PUSH, OK, 'subshell'],
  [B, '{ git push; }', PUSH, OK, 'brace group'],
  [B, 'if true; then git push; fi', PUSH, OK, 'if body'],
  [B, 'for r in a b; do git -C "$r" push; done', PUSH, OK, 'loop body'],
  [B, 'f() { git push; }; f', PUSH, OK, 'function body'],
  [B, 'echo "$(git push 2>&1)"', PUSH, OK, 'substitution in double quotes'],
  [B, 'x=$(git push)', PUSH, OK, 'substitution in an assignment'],
  [B, 'echo `git push`', PUSH, OK, 'backtick substitution'],
  [B, 'cat <(git push)', PUSH, OK, 'process substitution'],
  [B, 'bash -c "git push"', PUSH, OK, 'bash -c'],
  [B, "bash -lc 'git -C . push'", PUSH, OK, 'bash -lc'],
  [B, 'bash -e -o pipefail -c "git push"', PUSH, OK, 'bash options with values before -c'],
  [B, "sh -c 'cd sub; git commit -m x'", COMMIT, OK, 'sh -c'],
  [B, 'eval "git push"', PUSH, OK, 'eval'],
  [B, 'powershell -Command "git push"', PUSH, OK, 'powershell -Command'],
  [
    B,
    'powershell.exe -NoProfile -NonInteractive -Command git push',
    PUSH,
    OK,
    'powershell.exe flags',
  ],
  [B, 'powershell -NoProfile "git push"', PUSH, OK, 'powershell positional command'],
  [B, 'pwsh -c "git push"', PUSH, OK, 'pwsh -c'],
  [
    B,
    'powershell -NoProfile -Exec Bypass -Command "git push --force"',
    PUSH,
    OK,
    'powershell -Exec, an abbreviated value parameter',
  ],
  [B, 'powershell -Win Hidden -Command "git reset --hard"', HARD, OK, 'powershell -Win Hidden'],
  [B, 'pwsh -WorkingDir x -Command "git push"', PUSH, OK, 'pwsh -WorkingDir'],
  [B, 'pwsh -i -c "git push"', PUSH, OK, 'pwsh -i is a flag, not a value'],
  [B, `powershell -EncodedCommand ${encoded('git push')}`, PUSH, OK, 'powershell -EncodedCommand'],
  [B, 'cmd //c git push', PUSH, OK, 'cmd //c, the Git Bash spelling'],
  [B, 'cmd.exe /d /s /c "git status & git push"', PUSH, OK, 'cmd /c with an & chain'],
  [B, "bash <<'EOF'\ngit push\nEOF", PUSH, OK, 'heredoc fed to bash'],
  [B, 'sh <<EOF\ngit commit -m x\nEOF', COMMIT, OK, 'heredoc fed to sh'],
  [B, 'bash <<< "git push"', PUSH, OK, 'herestring fed to bash'],
  [B, 'cat <<EOF\n$(git push)\nEOF', PUSH, OK, 'unquoted heredoc runs its substitutions'],
  [B, 'git submodule foreach "git push"', PUSH, OK, 'submodule foreach'],
  [B, 'echo $((1<<2))\ngit push', PUSH, OK, 'arithmetic shift is not a heredoc'],
  [B, 'echo $(( $(git push) + 1 ))', PUSH, OK, 'substitution inside arithmetic'],
  [B, `find . -name x -exec git push ${BS};`, PUSH, OK, 'find -exec'],
  [B, `find . -execdir sh -c 'git push' ${BS};`, PUSH, OK, 'find -execdir with a nested shell'],
  [B, 'coproc git push', PUSH, OK, 'coproc'],
  [
    B,
    'MSG="$(\n  # it\'s the last commit\n  git log -1 --format=%s\n)"\ngit push origin HEAD',
    PUSH,
    OK,
    'an apostrophe in a comment inside $( ) hides nothing',
  ],
  [B, 'OUT="$(\n  # step 1)\n  git push 2>&1\n)"', PUSH, OK, 'a ) in a comment inside $( )'],
  [
    B,
    `find . -maxdepth 0 -exec echo {} ${BS}; -exec git push ${BS};`,
    PUSH,
    OK,
    'every find action',
  ],
  [B, "cat <<'EOF' | bash\ngit push\nEOF", PUSH, OK, 'heredoc through cat into bash'],
  [B, "echo 'git push' | bash", PUSH, OK, 'echo piped into bash'],
  [B, "echo 'git push' | powershell -Command -", PUSH, OK, 'echo piped into powershell'],
  [B, 'arr=($(git push))', PUSH, OK, 'substitution inside an array literal'],
  [B, 'cmd //c call git push', PUSH, OK, 'cmd call'],
  [B, 'git rebase -x "git push" HEAD~1', PUSH, OK, 'git rebase -x runs a command'],
  [
    B,
    'cmd //c git commit -m "a && git reset --hard"',
    COMMIT,
    OK,
    'cmd keeps quoted arguments whole',
  ],
  [
    B,
    'cmd //c "C:/Program Files/Git/cmd/git.exe" push',
    PUSH,
    OK,
    'cmd keeps a quoted program path',
  ],
  [B, 'time\ngit status', OK, OK, 'a bare time line'],
  [B, 'cmd //c "git push"', PUSH, OK, 'cmd //c with the whole command quoted'],
  [B, 'cmd.exe /s /c "git reset --hard"', HARD, OK, 'cmd /s /c with a quoted hard block'],
  [B, "cmd //c git status '&&' git push", PUSH, OK, 'bash hands && to cmd unquoted'],
  [B, 'cmd //c start "push window" git push', PUSH, OK, 'cmd start with a window title'],
  [
    B,
    'w="$(echo $(date +%s)#tag)"; git push',
    PUSH,
    OK,
    'a # right after a substitution is no comment',
  ],
  [
    B,
    'cat <<EOF\nx\nEOF\nurl=https://example.com/c/$(git rev-parse HEAD)#diff; git push',
    PUSH,
    OK,
    'a # right after a substitution, with a heredoc',
  ],
  [B, "echo 'git push' | > out.txt; bash", OK, OK, 'piped text does not reach a later command'],
  [B, "echo 'git push' | bash -n", OK, OK, 'bash -n does not run its input'],
  [B, "echo 'git push' | (bash)", PUSH, OK, 'a subshell reads the pipe'],
  [B, "echo 'git push' |\n  bash", PUSH, OK, 'a line break after | continues the pipe'],
  [
    B,
    'xargs git <<EOF\npush\nEOF',
    OK,
    OK,
    'known gap: xargs reading git arguments from a heredoc',
  ],
  [
    B,
    "OUT=$(bash <<'EOF'\ngit push\nEOF\n)",
    OK,
    OK,
    'known gap: a heredoc fed to a shell inside $( )',
  ],
  [
    B,
    `bash -c "$(cat <<'EOF'\ngit push\nEOF\n)"`,
    OK,
    OK,
    'known gap: a heredoc through $(cat) into bash -c',
  ],
  [
    B,
    "bash <(cat <<'EOF'\ngit push\nEOF\n)",
    OK,
    OK,
    'known gap: bash reading a process substitution',
  ],
  [
    B,
    'USER_APPROVED=1 git status; f() { git push; }; f | tail',
    OK,
    OK,
    'known gap: a piped function call',
  ],
  [B, "env -S 'git push --force'", PUSH, OK, 'env -S splits its command'],
  [B, "env --split-string='git push'", PUSH, OK, 'env --split-string= splits its command'],
  [B, "watch 'git push'", PUSH, OK, 'watch runs its joined arguments'],
  [B, 'watch -n 2 git status', OK, OK, 'watch of a read-only command'],
  [B, 'coproc PUSHER { git push; }', OK, OK, 'known gap: a named coproc'],
  [
    B,
    'USER_APPROVED=1 powershell -Command "git push"',
    OK,
    OK,
    'approval covers the whole Bash call',
  ],
  [
    B,
    'git add -A\nUSER_APPROVED=1 git commit -m x',
    COMMIT,
    OK,
    'the prefix starts the command, not a later line',
  ],
  [B, `${'eval '.repeat(10)}git push`, PARSE, OK, 'nesting past the depth limit fails closed'],
  [
    B,
    `${'eval '.repeat(10)}gh issue create`,
    OK,
    PARSE,
    'nesting past the depth limit fails closed for gh',
  ],

  // --- allowed ---
  [B, 'git status', OK, OK, 'read-only'],
  [B, 'git -C . status', OK, OK, 'read-only behind -C'],
  [B, 'git --no-pager log --oneline -5', OK, OK, 'read-only behind --no-pager'],
  [B, 'git diff | head -50', OK, OK, 'read-only, piped'],
  [B, 'git log --oneline | grep "git push"', OK, OK, 'piped grep for a mention'],
  [B, 'git log --grep="git push"', OK, OK, 'mention inside an option value'],
  [B, 'echo "git push"', OK, OK, 'double-quoted mention'],
  [B, "echo 'git reset --hard'", OK, OK, 'single-quoted mention'],
  [B, "echo '$(git push)'", OK, OK, 'single quotes keep a substitution literal'],
  [
    B,
    'gh pr create --title x --body "never run git reset --hard or git push"',
    OK,
    OK,
    'PR body mention',
  ],
  [B, 'git status # then git push', OK, OK, 'comment mention'],
  [B, "cat <<'EOF'\ngit push\ngit reset --hard\nEOF", OK, OK, 'heredoc body is data'],
  [B, "cat <<'EOF'\n$(git push)\nEOF", OK, OK, 'quoted heredoc keeps substitutions literal'],
  [B, 'grep -rn "git commit" .claude', OK, OK, 'grep for a mention'],
  [B, 'git commit-tree HEAD^{tree} -m x', OK, OK, 'plumbing verb, not commit'],
  [B, 'git --version', OK, OK, 'terminal option'],
  [B, 'git --help commit', OK, OK, 'help for commit'],
  [B, 'git --exec-path commit', OK, OK, 'bare --exec-path prints and exits'],
  [B, 'git fetch origin', OK, OK, 'fetch'],
  [B, 'git pull', OK, OK, 'pull is not in the policy'],
  [B, 'git add -A', OK, OK, 'add'],
  [B, 'git stash', OK, OK, 'stash'],
  [B, 'git branch -d feature/x', OK, OK, 'branch -d'],
  [B, 'git reset --soft HEAD~1', OK, OK, 'soft reset'],
  [B, 'git reset HEAD src/a.ts', OK, OK, 'unstage'],
  [B, 'git checkout main', OK, OK, 'switch branch'],
  [B, 'git checkout -b feature/x', OK, OK, 'new branch'],
  [B, 'git checkout feature/x --', OK, OK, 'bare -- after a branch'],
  [B, 'git clean -n', OK, OK, 'clean dry run'],
  [B, 'git clean -nd', OK, OK, 'clean dry run, cluster'],
  [B, 'git worktree add ../x -b y', OK, OK, 'worktree add'],
  [B, 'git worktree list', OK, OK, 'worktree list'],
  [B, 'rm -rf .claude/worktrees/foo', OK, OK, 'rm is not a git operation'],
  [B, 'bash deploy.sh', OK, OK, 'known gap: a script file is not analyzed'],
  [
    B,
    `node -e "require('child_process').execSync('git push')"`,
    OK,
    OK,
    'known gap: git inside a script',
  ],
  [B, '$GIT push', OK, OK, 'known gap: git through a variable'],
  [
    B,
    `cat > notes.sh <<EOF\nOUT=${BS}$(git push 2>&1)\nEOF`,
    OK,
    OK,
    'escaped substitution in a heredoc',
  ],
  [B, 'cmd=(git push origin HEAD)\necho "${cmd[@]}"', OK, OK, 'array literal is data'],
  [B, 'git clean --dry-r', OK, OK, 'abbreviated --dry-run'],

  // --- piping a commit or push: hard block, no bypass ---
  [B, 'USER_APPROVED=1 git push 2>&1 | tail -20', PIPE, OK, 'piped push'],
  [B, 'USER_APPROVED=1 git -C . push | tail', PIPE, OK, 'piped push behind -C'],
  [B, 'USER_APPROVED=1 git commit -m x | cat', PIPE, OK, 'piped commit'],
  [B, 'USER_APPROVED=1 git push |& tee push.log', PIPE, OK, '|& pipe'],
  [B, 'USER_APPROVED=1 git status; (git push) 2>&1 | tail', PIPE, OK, 'piped subshell'],
  [B, 'USER_APPROVED=1 git status; { git push; } | tail', PIPE, OK, 'piped brace group'],
  [B, 'USER_APPROVED=1 git status; for r in a; do git push; done | tail', PIPE, OK, 'piped loop'],
  [B, 'USER_APPROVED=1 git status; time (git push) 2>&1 | tail', PIPE, OK, 'piped timed subshell'],
  [B, 'USER_APPROVED=1 git status; ! { git push; } | tail', PIPE, OK, 'piped negated brace group'],
  [B, 'USER_APPROVED=1 echo "$(git push 2>&1)" | tail -5', PIPE, OK, 'substitution output piped'],
  [
    B,
    'USER_APPROVED=1 powershell -Command "(git push) | Out-Null"',
    PIPE,
    OK,
    'PS group piped inside an approved call',
  ],
  [
    B,
    'USER_APPROVED=1 powershell -Command "& { git push } | Out-Null"',
    PIPE,
    OK,
    'PS script block piped inside an approved call',
  ],
  [
    B,
    'USER_APPROVED=1 powershell -Command "$(git push) | Out-Null"',
    PIPE,
    OK,
    'PS subexpression piped inside an approved call',
  ],
  [
    B,
    'USER_APPROVED=1 git add -A && if true; then { git commit -m x && git push; } 2>&1 | tail -20; fi',
    PIPE,
    OK,
    'piped group opened after then',
  ],
  [B, 'USER_APPROVED=1 bash -c "git push" | tail', PIPE, OK, 'piped nested shell'],
  [B, 'git push | tail', PIPE, OK, 'piped and unapproved: the pipe message wins'],
  [B, 'USER_APPROVED=1 git commit -m "a | b"', OK, OK, 'pipe inside quotes'],
  [B, 'USER_APPROVED=1 cat msg.txt | git commit -F -', OK, OK, 'pipe into git'],
  [B, 'USER_APPROVED=1 git push && git log -1 | cat', OK, OK, 'the pipe belongs to log'],
  [
    B,
    'USER_APPROVED=1 git push > push.log 2>&1; echo "EXIT=$?"',
    OK,
    OK,
    'redirect to a file instead',
  ],
  [
    B,
    `USER_APPROVED=1 git commit -m "$(cat <<'EOF'\nfix: never git reset --hard, never git push | tail\nEOF\n)"`,
    OK,
    OK,
    'heredoc message with mentions',
  ],
  [
    B,
    `git commit -m "$(cat <<'EOF'\nfix: never git reset --hard, never git push | tail\nEOF\n)"`,
    COMMIT,
    OK,
    'heredoc message, unapproved',
  ],
  [
    B,
    "USER_APPROVED=1 git commit -F- <<'EOF'\nfix: git reset --hard | tail\nEOF",
    OK,
    OK,
    'message on stdin from a heredoc',
  ],

  // --- destructive operations: hard block, even with the prefix ---
  [B, 'git checkout -- .', HARD, OK, 'checkout --'],
  [B, 'git checkout -- src/a.ts', HARD, OK, 'checkout -- <file>'],
  [B, 'git checkout HEAD -- src/a.ts', HARD, OK, 'checkout <rev> -- <file>'],
  [B, 'git -C . checkout -- .', HARD, OK, 'checkout -- behind -C'],
  [B, 'cd sub && git checkout -- .', HARD, OK, 'checkout -- after cd'],
  [B, 'git restore src/a.ts', HARD, OK, 'restore'],
  [B, 'git restore --staged src/a.ts', HARD, OK, 'restore --staged'],
  [B, 'git -c core.x=y restore .', HARD, OK, 'restore behind -c'],
  [B, 'git reset --hard', HARD, OK, 'reset --hard'],
  [B, 'git reset --hard HEAD~1', HARD, OK, 'reset --hard <rev>'],
  [B, 'git reset --mixed HEAD~1', HARD, OK, 'reset --mixed'],
  [B, 'git reset -q --hard HEAD~1', HARD, OK, 'reset -q --hard'],
  [B, 'git reset HEAD~1 --hard', HARD, OK, 'reset <rev> --hard'],
  [B, 'git -C . reset --hard', HARD, OK, 'reset --hard behind -C'],
  [B, 'git --git-dir=.git reset --hard', HARD, OK, 'reset --hard behind --git-dir'],
  [B, 'git  reset  --hard', HARD, OK, 'reset --hard, double spaces'],
  [B, 'git clean -fd', HARD, OK, 'clean -fd'],
  [B, 'git clean -xdf', HARD, OK, 'clean -xdf'],
  [B, 'git clean -d -f', HARD, OK, 'clean -d -f'],
  [B, 'git clean --force', HARD, OK, 'clean --force'],
  [B, 'git clean --dry-run -- -f', OK, OK, 'a -f path after -- is not force'],
  [B, 'git reset -- --hard', OK, OK, 'a --hard path after -- is not a mode'],
  [B, 'git clean -f -- build', HARD, OK, 'clean -f before a path'],
  [B, 'git -C . clean -fdx', HARD, OK, 'clean behind -C'],
  [B, 'git reset --har HEAD~1', HARD, OK, 'abbreviated --hard'],
  [B, 'git reset --mix HEAD~1', HARD, OK, 'abbreviated --mixed'],
  [B, 'git clean --forc -d', HARD, OK, 'abbreviated --force'],
  [B, 'git worktree remove ../x', HARD, OK, 'worktree remove'],
  [B, 'git worktree prune', HARD, OK, 'worktree prune'],
  [B, 'git --no-pager worktree remove x', HARD, OK, 'worktree remove behind an option'],
  [B, 'bash -c "git reset --hard"', HARD, OK, 'nested reset --hard'],
  [B, 'USER_APPROVED=1 git reset --hard', HARD, OK, 'the prefix never bypasses a hard block'],
  [B, 'USER_APPROVED=1 bash -c "git clean -fdx"', HARD, OK, 'prefix and a nested hard block'],
  [
    B,
    'USER_APPROVED=1 git commit -m x && git reset --hard HEAD~1',
    HARD,
    OK,
    'an approved commit does not shield a hard block',
  ],
  [
    B,
    'USER_APPROVED=1 git push; git clean -fdx',
    HARD,
    OK,
    'an approved push does not shield a hard block',
  ],
  [
    B,
    'USER_APPROVED=1 git commit -m "never git reset --hard"',
    OK,
    OK,
    'quoted mention in an approved commit',
  ],

  // --- PowerShell tool ---
  [P, 'git commit -m "x"', COMMIT, OK, 'PS commit'],
  [P, 'git push origin HEAD', PUSH, OK, 'PS push'],
  [P, 'USER_APPROVED=1 git commit -m "x"', COMMIT, OK, 'PS cannot carry the prefix'],
  [P, '$env:USER_APPROVED=1; git push', PUSH, OK, 'PS env var is not approval'],
  [P, '$out = git push 2>&1', PUSH, OK, 'PS assignment runs its pipeline'],
  [P, '$r=git commit -m x', COMMIT, OK, 'PS assignment without spaces'],
  [P, '[string]$o = git push', PUSH, OK, 'PS typed assignment'],
  [
    P,
    '$v = "$(\n  # it\'s the version\n  git describe\n)"; git push',
    PUSH,
    OK,
    'PS apostrophe in a comment inside $( )',
  ],
  [
    P,
    `Start-Process -FilePath "C:${BS}Program Files${BS}Git${BS}cmd${BS}git.exe" -ArgumentList "push" -NoNewWindow -Wait`,
    PUSH,
    OK,
    'PS Start-Process, quoted path with a space',
  ],
  [
    P,
    "Start-Process -FilePath git -ArgumentList @('push','origin','HEAD') -NoNewWindow -Wait",
    PUSH,
    OK,
    'PS Start-Process, @( ) array',
  ],
  [
    P,
    "Start-Process -FilePath git -ArgumentList ('push','origin')",
    PUSH,
    OK,
    'PS Start-Process, ( ) array',
  ],
  [
    P,
    "Start-Process -ArgumentList 'push' -FilePath git -Wait",
    PUSH,
    OK,
    'PS Start-Process, any order',
  ],
  [P, "'git push' | Invoke-Expression", PUSH, OK, 'PS string piped into Invoke-Expression'],
  [P, "Invoke-Expression @'\ngit push\n'@", PUSH, OK, 'PS here-string passed to Invoke-Expression'],
  [P, 'iex -C "git push"', PUSH, OK, 'PS iex with an abbreviated -Command'],
  [P, 'Write-Output (git push)', PUSH, OK, 'PS ( ) argument runs its pipeline'],
  [P, '. git push', PUSH, OK, 'PS dot-sourcing git'],
  [P, "git ('push')", PUSH, OK, 'PS parenthesized literal argument'],
  [P, "& git @('push', 'origin', 'HEAD')", PUSH, OK, 'PS array argument'],
  [
    P,
    "$user = 'someone@'\ngit push\n$body = @'\ntext\n'@",
    PUSH,
    OK,
    'PS string ending in @ is not a here-string',
  ],
  [P, '& (Get-Command git) push', OK, OK, 'known gap: git through Get-Command'],
  [P, 'git -C . push', PUSH, OK, 'PS push behind -C'],
  [P, 'git.exe commit -m x', COMMIT, OK, 'PS git.exe'],
  [P, 'Set-Location apps; git commit -m x', COMMIT, OK, 'PS Set-Location chain'],
  [
    P,
    `& "C:${BS}Program Files${BS}Git${BS}cmd${BS}git.exe" push`,
    PUSH,
    OK,
    'PS call operator and path',
  ],
  [P, 'git pu`sh', PUSH, OK, 'PS backtick escape'],
  [P, 'git commit -m "say `"hi`""', COMMIT, OK, 'PS escaped quotes in a message'],
  [P, 'Get-ChildItem | ForEach-Object { git -C $_.FullName push }', PUSH, OK, 'PS script block'],
  [P, 'if ($true) { git push }', PUSH, OK, 'PS if block'],
  [P, 'Write-Output "$(git push)"', PUSH, OK, 'PS subexpression in double quotes'],
  [P, 'Invoke-Expression "git push"', PUSH, OK, 'PS Invoke-Expression'],
  [P, "iex 'git commit -m x'", COMMIT, OK, 'PS iex'],
  [P, 'Start-Process git -ArgumentList "push"', PUSH, OK, 'PS Start-Process'],
  [
    P,
    "Start-Process -FilePath git -ArgumentList 'commit','-m','x' -Wait",
    COMMIT,
    OK,
    'PS Start-Process, array arguments',
  ],
  [P, "bash -c 'USER_APPROVED=1 git push'", PUSH, OK, 'PS nested bash cannot approve'],
  [P, 'cmd /c git push', PUSH, OK, 'PS nested cmd'],
  [
    P,
    'powershell -ExecutionPol Bypass -Command "git push"',
    PUSH,
    OK,
    'PS nested powershell -ExecutionPol',
  ],
  [P, 'git push 2>&1 | Out-Null', PIPE, OK, 'PS piped push'],
  [P, 'Get-Content msg.txt | git commit -F -', COMMIT, OK, 'PS pipe into git'],
  [P, "git commit -m @'\nnever git reset --hard | tail\n'@", COMMIT, OK, 'PS here-string message'],
  [P, 'git reset --hard', HARD, OK, 'PS reset --hard'],
  [P, 'git -C . clean -fdx', HARD, OK, 'PS clean behind -C'],
  [P, 'git checkout -- .', HARD, OK, 'PS checkout --'],
  [P, 'git status', OK, OK, 'PS read-only'],
  [P, 'git log --oneline -5 | Select-Object -First 3', OK, OK, 'PS read-only, piped'],
  [P, 'Write-Output "git push"', OK, OK, 'PS double-quoted mention'],
  [P, "Write-Output '$(git push)'", OK, OK, 'PS single quotes keep a subexpression literal'],
  [P, 'git status # git push', OK, OK, 'PS comment mention'],
  [P, "@'\ngit push\n'@ | Set-Content notes.txt", OK, OK, 'PS here-string is data'],
  [
    P,
    '@"\nRun `$(git push) to deploy\n"@ | Set-Content notes.md',
    OK,
    OK,
    'PS escaped subexpression',
  ],
  [P, '<#\ngit push\ngit reset --hard\n#>\ngit status', OK, OK, 'PS block comment'],
  [P, 'Write-Output "<#"; git reset --hard #>', HARD, OK, 'PS <# inside a string hides nothing'],
  [
    P,
    'Write-Output hi # note <#\ngit reset --hard\n# #>',
    HARD,
    OK,
    'PS <# inside a line comment hides nothing',
  ],
  [
    P,
    'Invoke-Command { git push } -NoNewScope | Out-Null',
    PIPE,
    OK,
    'PS script block argument piped',
  ],
  [P, 'cmd /c "git push"', PUSH, OK, 'PS cmd /c with the whole command quoted'],
  [P, 'cmd /c "gh issue create --title x"', OK, ISSUE, 'PS cmd /c with quoted gh issue create'],
  [P, "cmd /c git status '&&' git push", PUSH, OK, 'PS hands && to cmd unquoted'],
  [
    P,
    "Start-Process git -ArgumentList 'reset', '--hard' -Wait",
    HARD,
    OK,
    'PS Start-Process list with spaces',
  ],
  [
    P,
    "Start-Process gh -ArgumentList 'issue', 'create', '--title', 'x'",
    OK,
    ISSUE,
    'PS Start-Process gh issue create',
  ],
  [
    P,
    "Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'git push'",
    PUSH,
    OK,
    'PS Start-Process into powershell',
  ],
  [P, "Start-Process cmd -ArgumentList '/c', 'git push'", PUSH, OK, 'PS Start-Process into cmd'],
  [
    P,
    "Start-Process git -ArgumentList @('reset','--hard') -Wait",
    HARD,
    OK,
    'PS Start-Process @( ) list',
  ],
  [
    P,
    "Start-Process -FilePath git -ArgumentList @('-C','.','push')",
    PUSH,
    OK,
    'PS Start-Process @( ) list, option first',
  ],
  [P, "$cmd = @('git', 'push', 'origin', 'HEAD')", OK, OK, 'PS array of words is data'],
  [P, "$parts = ('git', 'reset', '--hard')", OK, OK, 'PS parenthesized array is data'],
  [P, "$args2 = @('gh', 'issue', 'create')", OK, OK, 'PS array naming gh is data'],

  // --- Monitor tool: same shell as Bash, but no approval prefix ---
  [M, 'git push', PUSH, OK, 'Monitor push'],
  [M, 'USER_APPROVED=1 git push', PUSH, OK, 'Monitor cannot carry the prefix'],
  [M, 'git push 2>&1 | grep --line-buffered x', PIPE, OK, 'Monitor piped push'],
  [M, 'git -C . reset --hard', HARD, OK, 'Monitor hard block'],
  [M, 'tail -f build.log | grep --line-buffered ERROR', OK, OK, 'Monitor log watch'],
  [M, 'gh issue create --title x', OK, ISSUE, 'Monitor gh issue create'],

  // --- issue creation goes through /draft-issue ---
  [B, 'gh issue create --title x --body y', OK, ISSUE, 'gh issue create'],
  [
    B,
    'SKILL_APPROVED=1 gh issue create --title x --body-file f.md --label bug',
    OK,
    OK,
    'skill-approved',
  ],
  [B, 'gh  issue create --title x', OK, ISSUE, 'gh, double space'],
  [B, 'gh issue new --title x', OK, ISSUE, 'alias new'],
  [
    B,
    'gh -R Doberjohn/inkweave issue create --title x',
    OK,
    ISSUE,
    'repo flag before the subcommand',
  ],
  [B, 'gh issue -R Doberjohn/inkweave create --title x', OK, ISSUE, 'repo flag between the words'],
  [B, 'gh.exe issue create --title x', OK, ISSUE, 'gh.exe'],
  [B, 'timeout 30 gh issue create --title x', OK, ISSUE, 'gh behind a runner'],
  [B, 'bash -c "gh issue create --title x"', OK, ISSUE, 'gh in nested bash'],
  [B, 'cd x && gh issue create --title x', OK, ISSUE, 'gh after cd'],
  [
    B,
    'cd x && SKILL_APPROVED=1 gh issue create --title x',
    OK,
    ISSUE,
    'the skill prefix must lead',
  ],
  [B, 'gh issue list --limit 5', OK, OK, 'issue list'],
  [B, 'gh issue create --help', OK, OK, 'gh issue create --help only prints usage'],
  [B, "gh issue create --title '-h' --body x", OK, ISSUE, 'a -h title value is not help'],
  [B, 'gh issue view 607', OK, OK, 'issue view'],
  [B, 'gh issue comment 607 --body "file it with gh issue create"', OK, OK, 'comment body mention'],
  [
    B,
    'gh pr create --title x --body "file it with gh issue create"',
    OK,
    OK,
    'PR body mention of gh',
  ],
  [B, 'echo "gh issue create"', OK, OK, 'quoted mention of gh'],
  [
    B,
    'USER_APPROVED=1 git commit -m "docs: publish via gh issue create in the skill"',
    OK,
    OK,
    'commit message mention',
  ],
  [B, 'gh api repos/Doberjohn/inkweave/issues -f title=x', OK, OK, 'known gap: gh api'],
  [P, 'gh issue create --title x', OK, ISSUE, 'PS gh issue create'],
  [P, 'SKILL_APPROVED=1 gh issue create --title x', OK, ISSUE, 'PS cannot carry the skill prefix'],
  [P, 'gh issue new --title x', OK, ISSUE, 'PS alias new'],
  [P, 'gh issue list', OK, OK, 'PS issue list'],
];

/** Git for Windows' bash. System32's bash.exe is WSL and cannot run these hooks. */
function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const gitDirs = (process.env.PATH || '')
    .split(path.delimiter)
    .filter((dir) => dir && existsSync(path.join(dir, 'git.exe')));
  const candidates = [
    process.env.CLAUDE_CODE_GIT_BASH_PATH,
    ...gitDirs.map((dir) => path.join(dir, '..', 'bin', 'bash.exe')),
    'C:/Program Files/Git/bin/bash.exe',
  ];
  const found = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!found) throw new Error('Git Bash not found: set CLAUDE_CODE_GIT_BASH_PATH to its bash.exe');
  return found;
}

const BASH = findBash();

/** Runs a hook script with a PreToolUse payload on stdin, like Claude Code does. */
function runHook(script, input, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(BASH, [script], {cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({code, stdout, stderr}));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

// The spelling Claude Code uses on Windows: a backslash project dir, then forward slashes.
const hookPath = (name) => `${PROJECT_DIR}/.claude/hooks/${name}`;
const payload = (tool, command) => ({tool_name: tool, cwd: PROJECT_DIR, tool_input: {command}});

function expectOutcome(check, result, outcome, tool) {
  const detail = `stderr: ${result.stderr || '(none)'}`;
  check(result.stdout, 'hooks never write to stdout').toBe('');
  if (outcome === OK) {
    check(result.code, detail).toBe(0);
    return;
  }
  check(result.code, detail).toBe(2);
  check(result.stderr).toMatch(MESSAGES[outcome]);
  if (!PREFIX[outcome]) return;
  check(result.stderr).toMatch(tool === B ? PREFIX[outcome] : NO_PREFIX[tool]);
}

describe('shell guard case table', () => {
  it('has a unique note per row', () => {
    const notes = CASES.map((row) => row[4]);
    expect(notes.filter((note, i) => notes.indexOf(note) !== i)).toEqual([]);
  });

  for (const [tool, command, gitOutcome, issueOutcome, note] of CASES) {
    it.concurrent(
      `${tool}: ${note}`,
      async ({expect: check}) => {
        const input = payload(tool, command);
        const [git, issue] = await Promise.all([
          runHook(hookPath(GIT_HOOK), input),
          runHook(hookPath(ISSUE_HOOK), input),
        ]);
        expectOutcome(check, git, gitOutcome, tool);
        expectOutcome(check, issue, issueOutcome, tool);
      },
      SPAWN_TIMEOUT,
    );
  }
});

describe('hook wrappers', {timeout: SPAWN_TIMEOUT}, () => {
  const push = payload(B, 'git push');

  // The policy's own message proves the module ran: a wrapper that cannot find it
  // also exits 2, with "failed to run its policy" instead.
  it('run from an all-backslash script path', async () => {
    const result = await runHook(path.join(HOOKS_DIR, GIT_HOOK), push);
    expect(result.code, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/Git push detected/);
  });

  it('run from a relative script path', async () => {
    const result = await runHook(GIT_HOOK, push, {cwd: HOOKS_DIR});
    expect(result.code, result.stderr).toBe(2);
    expect(result.stderr).toMatch(/Git push detected/);
  });

  it('allow malformed input and an empty command', async () => {
    const results = await Promise.all([
      runHook(hookPath(GIT_HOOK), '{not json'),
      runHook(hookPath(GIT_HOOK), payload(B, '')),
      runHook(hookPath(ISSUE_HOOK), '{not json'),
    ]);
    expect(results.map((result) => result.code)).toEqual([0, 0, 0]);
  });

  it('fail closed on git commands when the policy module cannot run', async () => {
    // A copy of the wrapper without its module next to it, as after a bad edit.
    const dir = mkdtempSync(path.join(tmpdir(), 'hook-wrapper-'));
    copyFileSync(path.join(HOOKS_DIR, GIT_HOOK), path.join(dir, GIT_HOOK));
    copyFileSync(path.join(HOOKS_DIR, ISSUE_HOOK), path.join(dir, ISSUE_HOOK));
    const [git, gitUpper, gitOther, issue] = await Promise.all([
      runHook(path.join(dir, GIT_HOOK), push),
      runHook(path.join(dir, GIT_HOOK), payload(B, 'GIT push')),
      runHook(path.join(dir, GIT_HOOK), payload(B, 'ls -la')),
      runHook(path.join(dir, ISSUE_HOOK), payload(B, 'gh issue create --title x')),
    ]);
    expect(git.code, git.stderr).toBe(2);
    expect(git.stderr).toMatch(/failed to run/);
    expect(gitUpper.code, 'the fallback match ignores case').toBe(2);
    expect(gitOther.code, gitOther.stderr).toBe(0);
    expect(issue.code, issue.stderr).toBe(2);
  });

  it('fail closed on the command field alone, with git as a whole word', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'hook-wrapper-'));
    copyFileSync(path.join(HOOKS_DIR, GIT_HOOK), path.join(dir, GIT_HOOK));
    const inGitDir = {tool_name: B, cwd: 'D:/git/repo', tool_input: {command: 'echo legitimate'}};
    const [legitimate, afterNewline] = await Promise.all([
      runHook(path.join(dir, GIT_HOOK), inGitDir),
      runHook(path.join(dir, GIT_HOOK), payload(B, 'echo hi\ngit push')),
    ]);
    expect(legitimate.code, 'git inside a word or the cwd does not count').toBe(0);
    expect(afterNewline.code, 'a JSON line-break escape counts as a space').toBe(2);
  });
});

describe('policy modules', () => {
  const FUZZ_TOKENS = [
    'git',
    'gh',
    'issue',
    'create',
    'commit',
    'push',
    'reset',
    '--hard',
    'checkout',
    '--',
    '-C',
    '.',
    'bash',
    '-c',
    'powershell',
    '-Command',
    'cmd',
    '/c',
    'eval',
    'iex',
    'env',
    'timeout',
    'X=1',
    ' ',
    '  ',
    '\n',
    '\t',
    '"',
    "'",
    '`',
    BS,
    '$(',
    '$((',
    ')',
    '(',
    '{',
    '}',
    '|',
    '||',
    '|&',
    '&',
    '&&',
    ';',
    '<<',
    '<<-',
    '<<<',
    'EOF',
    "'EOF'",
    '>',
    '2>&1',
    '<(',
    '#',
    "@'",
    "'@",
    '@"',
    '"@',
    '^',
    '%',
    '$x',
    'USER_APPROVED=1 ',
    'SKILL_APPROVED=1 ',
    'if',
    'then',
    'fi',
    'do',
    'done',
  ];

  function randomCommand(random) {
    const length = 1 + Math.floor(random() * 30);
    return Array.from({length}, () => FUZZ_TOKENS[Math.floor(random() * FUZZ_TOKENS.length)]).join(
      '',
    );
  }

  // Deterministic, so a failure reproduces.
  function seeded(seed) {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function parseError(commandsIn, command, dialect) {
    try {
      commandsIn(command, dialect);
      return '';
    } catch (error) {
      return error.message;
    }
  }

  // The one deliberate throw is over-deep nesting, which makes the guards fail closed.
  it('parse 2,000 random command lines in every dialect, throwing only on deep nesting', async () => {
    const {commandsIn} = await import('../lib/shell-command.mjs');
    const random = seeded(607);
    for (let i = 0; i < 2000; i++) {
      const command = randomCommand(random);
      for (const dialect of ['bash', 'powershell', 'cmd']) {
        const error = parseError(commandsIn, command, dialect);
        expect(error, JSON.stringify(command)).toMatch(
          /^(|command nesting deeper than \d+ levels)$/,
        );
      }
    }
  });

  it('decide 2,000 random command lines: a block always carries a message, an allow never', async () => {
    const policies = [
      await import('../git-write-protection.mjs'),
      await import('../issue-create-guard.mjs'),
    ];
    const random = seeded(2026);
    for (let i = 0; i < 2000; i++) {
      const command = randomCommand(random);
      for (const tool of [B, P, M]) {
        for (const policy of policies) {
          const {code, message} = policy.decide(payload(tool, command));
          expect([code, message !== ''], JSON.stringify(command)).toEqual(
            code === 2 ? [2, true] : [0, false],
          );
        }
      }
    }
  });

  it('never spawn processes, so they cannot run git themselves', () => {
    for (const file of [
      'git-write-protection.mjs',
      'issue-create-guard.mjs',
      'lib/shell-command.mjs',
      'lib/run-hook.mjs',
    ]) {
      const source = readFileSync(path.join(HOOKS_DIR, file), 'utf8');
      expect(source, file).not.toMatch(/child_process/);
    }
  });
});
