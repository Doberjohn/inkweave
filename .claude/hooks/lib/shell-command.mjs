/**
 * Which commands would a shell command line run? The shared parser behind the
 * PreToolUse guards git-write-protection and issue-create-guard (#607).
 *
 * Ported from the tokenizer in inkweave-admin's .claude/hooks/upstream-readonly.sh
 * (feature/1-scaffold, 2026-09-28) and extended. It models what a shell executes,
 * not what the text contains:
 * - Quotes, escapes and comments are resolved, so a quoted mention of `git push`
 *   is an argument, never a command.
 * - Heredoc bodies, PowerShell here-strings and bash array literals are data,
 *   unless a shell reads its script from them (bash <<EOF, literal text piped into
 *   bash or Invoke-Expression) or they hold command substitutions that still run.
 * - Commands nested in $(...), backticks, <(...), PowerShell (...) arguments,
 *   bash|sh -c, powershell|pwsh -Command|-EncodedCommand, cmd /c, eval,
 *   Invoke-Expression, Start-Process, find -exec, git submodule foreach, git
 *   rebase -x and runner prefixes (env, timeout, xargs, ...) are expanded, and so
 *   is a PowerShell assignment's pipeline ($x = git push).
 * - `piped` marks a command whose stdout feeds a pipe, directly or through a
 *   ( ) or { } group, a loop, an if or a case.
 * - Nesting deeper than MAX_DEPTH throws, so the guards fail closed on it.
 *
 * It guards against accidents, not against an adversary: variables, aliases,
 * functions from a shell profile, script files, and a heredoc fed to a shell
 * inside $(...) are not resolved.
 */

export const BASH = 'bash';
export const POWERSHELL = 'powershell';
export const CMD = 'cmd';

const MAX_DEPTH = 8;
const ESCAPE = {[BASH]: '\\', [POWERSHELL]: '`', [CMD]: '^'};

/** The shell dialect a Claude Code tool call is written in. */
export function dialectOf(toolName) {
  return toolName === 'PowerShell' ? POWERSHELL : BASH;
}

/** A program's name as a shell looks it up: basename, case-insensitive, no .exe. */
export function programName(word) {
  const base = String(word ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .toLowerCase();
  return base.replace(/\.(exe|cmd|bat|com)$/, '');
}

/**
 * Every simple command `source` would run, as {argv, piped, dialect}. Prefixes
 * (assignments, reserved words, runners) are removed from argv, and the command
 * lines a command runs are expanded after it.
 */
export function commandsIn(source, dialect = BASH, depth = 0) {
  if (typeof source !== 'string' || !source.trim()) return [];
  checkDepth(depth);
  const stripped = stripDocs(source, dialect);
  const {segments, subs} = new Tokenizer(stripped.text, dialect, stripped.docs).run();
  const own = segments.flatMap((segment) => expand(segment, dialect, depth));
  const nested = [...stripped.subs, ...subs].flatMap((sub) =>
    pipedWhen(segments[sub.owner]?.piped, commandsIn(sub.text, sub.dialect, depth + 1)),
  );
  return [...own, ...nested];
}

// A substitution's output goes where its command's output goes: echo "$(git push)" | tail
// hides the push's status just as git push | tail does.
function pipedWhen(piped, commands) {
  return piped ? commands.map((command) => ({...command, piped: true})) : commands;
}

// Nesting this deep is not an accident. Throwing makes the guards fail closed.
function checkDepth(depth) {
  if (depth > MAX_DEPTH) throw new Error(`command nesting deeper than ${MAX_DEPTH} levels`);
}

// --- git and gh command lines ---------------------------------------------------

const GIT_VALUE_OPTIONS = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--config-env',
  '--attr-source',
]);
// Options that make git print something and exit instead of running a subcommand.
const GIT_TERMINAL_OPTIONS = new Set([
  '--version',
  '-v',
  '--help',
  '-h',
  '--exec-path',
  '--html-path',
  '--man-path',
  '--info-path',
]);

/** {verb, args} of a git command line after git's global options; null for other programs. */
export function gitInvocation(argv) {
  const name = programName(argv[0]);
  const dashed = /^git-([a-z][a-z0-9-]*)$/.exec(name);
  if (dashed) return {verb: dashed[1], args: argv.slice(1)};
  if (name !== 'git') return null;
  const at = gitVerbIndex(argv);
  return at === -1 ? null : {verb: argv[at], args: argv.slice(at + 1)};
}

function gitVerbIndex(argv) {
  let i = 1;
  while (i < argv.length && argv[i].startsWith('-')) {
    if (GIT_TERMINAL_OPTIONS.has(argv[i]) || argv[i].startsWith('--list-cmds')) return -1;
    i += GIT_VALUE_OPTIONS.has(argv[i]) ? 2 : 1;
  }
  return i < argv.length ? i : -1;
}

const GH_VALUE_FLAGS = new Set(['-R', '--repo']);

/** The first two positional words of a gh command line, e.g. ['issue', 'create']; null otherwise. */
export function ghInvocation(argv) {
  if (programName(argv[0]) !== 'gh') return null;
  const words = [];
  for (let i = 1; i < argv.length && words.length < 2; i++) {
    if (GH_VALUE_FLAGS.has(argv[i])) i++;
    else if (!argv[i].startsWith('-')) words.push(argv[i]);
  }
  return words;
}

// --- Heredocs, here-strings and block comments --------------------------------------

/**
 * Removes heredoc bodies (bash), which are data, and PowerShell block comments.
 * Returns the remaining text, the bodies the tokenizer at this level will meet
 * (in case a shell reads its script from one), and the command substitutions an
 * unquoted heredoc or an expandable here-string still runs.
 */
function stripDocs(source, dialect) {
  if (dialect === POWERSHELL) return stripPowerShellDocs(source);
  if (dialect === BASH && source.includes('<<')) return stripHeredocs(source);
  return {text: source, docs: [], subs: []};
}

// PowerShell comments go and here-strings become one literal argument. A scan, not a
// regex, so a "<#" inside a string or a `# ... <#` line comment hides nothing.
function stripPowerShellDocs(source) {
  const st = {src: source, i: 0, out: '', subs: []};
  while (st.i < source.length) {
    if (!PS_DOC_CHAR[source[st.i]]?.(st)) copy(st, 1);
  }
  return {text: st.out, docs: [], subs: st.subs};
}

const copyString = (st) => copied(st, closingQuote(st.src, st.i, POWERSHELL) + 1 - st.i);
const PS_DOC_CHAR = {
  '`': (st) => copied(st, 2),
  "'": copyString,
  '"': copyString,
  '@': (st) => takeHereString(st),
  '<': (st) => st.src[st.i + 1] === '#' && skipBlockComment(st),
  '#': (st) => startsWordAt(st.src, st.i) && skipComment(st),
};

function copied(st, length) {
  copy(st, length);
  return true;
}

// A here-string opens a token (so the @' ending a string like 'someone@' is none) and
// ends at a line starting with its quote and @. It becomes the same text as one literal
// argument, so Invoke-Expression @'...'@ still reads it.
const HERE_STRING = /@(['"])[ \t]*\r?\n([\s\S]*?)\r?\n\1@/y;

function takeHereString(st) {
  if (!/^$|[\s=(,;|&]/.test(st.src[st.i - 1] ?? '')) return false;
  HERE_STRING.lastIndex = st.i;
  const match = HERE_STRING.exec(st.src);
  if (!match) return false;
  const [whole, quote, body] = match;
  if (quote === '"') st.subs.push(...substitutionsIn(body, POWERSHELL));
  st.out += `'${body.replace(/'/g, "''")}'`;
  st.i += whole.length;
  return true;
}

function skipBlockComment(st) {
  const end = st.src.indexOf('#>', st.i + 2);
  st.i = end === -1 ? st.src.length : end + 2;
  st.out += ' ';
  return true;
}

/** The $(...) command substitutions in a text, plus backtick ones in bash. Escaped ones do not run. */
function substitutionsIn(text, dialect) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ESCAPE[dialect]) {
      i++;
      continue;
    }
    const end = substitutionEnd(text, i, dialect);
    if (end === -1) continue;
    found.push({text: text.slice(text[i] === '`' ? i + 1 : i + 2, end), dialect});
    i = end;
  }
  return found;
}

function substitutionEnd(text, i, dialect) {
  if (text[i] === '`' && dialect === BASH) return closingBacktick(text, i);
  if (text[i] !== '$' || text[i + 1] !== '(') return -1;
  return text[i + 2] === '(' ? -1 : closingParen(text, i + 1, dialect);
}

function stripHeredocs(source) {
  const st = {src: source, i: 0, out: '', ctx: ['sh'], pending: [], docs: [], subs: []};
  while (st.i < source.length) heredocStep(st);
  return {text: st.out, docs: st.docs, subs: st.subs};
}

// Contexts: sh = shell text, sub = inside $( <( >(, sq and dq = quotes, bq =
// backticks, arith and arithp = inside (( )) and parentheses within it.
function heredocStep(st) {
  const c = st.src[st.i];
  if (c === '\n') return heredocNewline(st);
  const top = st.ctx[st.ctx.length - 1];
  if (top !== 'sq' && c === '\\') return copy(st, 2);
  (CONTEXT_CHAR[top] ?? shellChar)(st, c, top);
}

const CONTEXT_CHAR = {
  sq: (st, c) => closesOn(st, c, "'"),
  dq: doubleQuoteChar,
  bq: (st, c) => (c === '`' ? closesOn(st, c, '`') : shellChar(st, c)),
  arith: arithChar,
  arithp: arithChar,
};

const SHELL_CHAR = {
  '#': (st) => startsWordAt(st.src, st.i) && skipComment(st),
  "'": (st) => enter(st, 'sq'),
  '"': (st) => enter(st, 'dq'),
  '`': (st) => enter(st, 'bq'),
  '(': (st) => enterParen(st, st.i),
  ')': (st) => leave(st),
  '<': (st) => isHeredocOperator(st) && openHeredoc(st),
};

function shellChar(st, c) {
  if (!SHELL_CHAR[c]?.(st)) copy(st, 1);
}

function copy(st, length) {
  st.out += st.src.slice(st.i, st.i + length);
  st.i += length;
}

function closesOn(st, c, quote) {
  if (c === quote) st.ctx.pop();
  copy(st, 1);
}

function enter(st, context) {
  st.ctx.push(context);
  return false;
}

function leave(st) {
  // A `)` inside backticks closes nothing: only a subshell or a substitution.
  if (st.ctx.length > 1 && st.ctx[st.ctx.length - 1] !== 'bq') st.ctx.pop();
  return false;
}

function doubleQuoteChar(st, c) {
  if (c === '$' && st.src[st.i + 1] === '(') return enterParen(st, st.i + 1);
  if (c === '"') st.ctx.pop();
  copy(st, 1);
}

// At a `(`: `((` opens arithmetic, `$(` `<(` `>(` a substitution, any other a subshell.
function enterParen(st, at) {
  const kind = parenKind(st.src, at);
  st.ctx.push(kind);
  copy(st, at - st.i + (kind === 'arith' ? 2 : 1));
  return true;
}

function parenKind(src, at) {
  if (src[at + 1] === '(') return 'arith';
  return '$<>'.includes(src[at - 1] ?? ' ') ? 'sub' : 'sh';
}

function arithChar(st, c, top) {
  if (c === '(') st.ctx.push('arithp');
  else if (c === ')') return leaveArith(st, top);
  else if (c === '<') return replaceChar(st, ' '); // 1<<2 is a shift, never a heredoc
  copy(st, 1);
}

function leaveArith(st, top) {
  const closesBoth = top === 'arith' && st.src[st.i + 1] === ')';
  if (top === 'arithp' || closesBoth) st.ctx.pop();
  copy(st, closesBoth ? 2 : 1);
}

function replaceChar(st, text) {
  st.out += text;
  st.i++;
}

function skipComment(st) {
  st.i = lineEnd(st.src, st.i) + 1;
  return true;
}

function isHeredocOperator(st) {
  const {src, i} = st;
  if (src[i + 1] !== '<' || src[i - 1] === '<') return false;
  return src[i + 2] !== '<'; // <<< is a herestring
}

// The delimiter is the whole word (END.txt, E"OF", 'END-OF-FILE'), quotes removed.
const HEREDOC = /<<(-?)[ \t]*((?:'[^'\n]*'|"[^"\n]*"|\\.|[^\s;&|<>()'"\\])+)/y;

function openHeredoc(st) {
  HEREDOC.lastIndex = st.i;
  const match = HEREDOC.exec(st.src);
  if (!match) return false;
  st.pending.push({
    word: match[2].replace(/'([^']*)'|"([^"]*)"|\\(.)/g, (_, sq, dq, esc) => sq ?? dq ?? esc),
    dash: match[1] === '-',
    quoted: /['"\\]/.test(match[2]),
    // Only bodies the tokenizer will reach at this level line up with its `<<` count.
    visible: st.ctx.every((context) => context === 'sh'),
  });
  st.out += match[0];
  st.i += match[0].length;
  return true;
}

function heredocNewline(st) {
  st.out += '\n';
  st.i++;
  while (st.pending.length) readBody(st, st.pending.shift());
}

function readBody(st, doc) {
  const lines = [];
  while (st.i < st.src.length) {
    const end = st.src.indexOf('\n', st.i);
    const line = st.src.slice(st.i, end === -1 ? st.src.length : end);
    st.i = end === -1 ? st.src.length : end + 1;
    if (delimiterOf(line, doc.dash) === doc.word) break;
    lines.push(line);
  }
  const body = lines.join('\n');
  if (doc.visible) st.docs.push(body);
  // An unquoted delimiter makes bash expand the body, running its substitutions.
  if (!doc.quoted) st.subs.push(...substitutionsIn(body, BASH));
}

function delimiterOf(line, dash) {
  const trimmed = line.replace(/\r$/, '');
  return dash ? trimmed.replace(/^\t+/, '') : trimmed;
}

// --- Tokenizer ----------------------------------------------------------------------

function closingParen(src, open, dialect) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const skipped = skipLiteral(src, i, dialect);
    if (skipped !== i) i = skipped;
    else if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i;
  }
  return src.length - 1;
}

// Past an escaped character, a quoted string or a comment that starts at i; i itself
// otherwise. Inside $( ) a comment is code too: an apostrophe or `)` in it counts for nothing.
function skipLiteral(src, i, dialect) {
  const c = src[i];
  if (c === ESCAPE[dialect]) return i + 1;
  if (c === "'" || c === '"') return closingQuote(src, i, dialect);
  if (c === '#' && startsWordAt(src, i)) return lineEnd(src, i);
  return i;
}

function closingQuote(src, open, dialect) {
  const quote = src[open];
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] === quote) return i;
    if (quote === "'") continue;
    if (src[i] === ESCAPE[dialect]) i++;
    else if (src[i] === '$' && src[i + 1] === '(') i = closingParen(src, i + 1, dialect);
  }
  return src.length - 1;
}

function closingBacktick(src, open) {
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] === '\\') i++;
    else if (src[i] === '`') return i;
  }
  return -1;
}

// A `)` is no boundary: after $(...) the word goes on, so $(date)#tag is no comment.
function startsWordAt(src, i) {
  return i === 0 || /[\s;&|(]/.test(src[i - 1]);
}

// The index of the last character on the line that holds i.
function lineEnd(src, i) {
  const end = src.indexOf('\n', i);
  return end === -1 ? src.length - 1 : end - 1;
}

const COMMON_CHARS = {
  ' ': 'blank',
  '\t': 'blank',
  '\r': 'blank',
  '\n': 'separator',
  ';': 'separator',
  '|': 'pipe',
  '&': 'ampersand',
  '>': 'redirection',
  "'": 'openQuote',
  '"': 'openQuote',
};
const CHARS = {
  [BASH]: {
    ...COMMON_CHARS,
    '<': 'redirection',
    '(': 'openGroup',
    ')': 'closeGroup',
    '\\': 'escape',
    '`': 'backtick',
    $: 'dollar',
    '#': 'comment',
  },
  [POWERSHELL]: {
    ...COMMON_CHARS,
    '(': 'psParen',
    ')': 'closeGroup',
    '{': 'openBlock',
    '}': 'closeGroup',
    '`': 'escape',
    $: 'dollar',
    '@': 'at',
    '#': 'comment',
  },
  [CMD]: {
    ...COMMON_CHARS,
    "'": null,
    '<': 'redirection',
    '(': 'separator',
    ')': 'separator',
    '^': 'escape',
  },
};

const REDIRECT = /(&>>?|>\||>>?|<<<|<<-?|<>|<)(&(\d+|-))?/y;
const HEREDOC_OPERATORS = new Set(['<<', '<<-']);
const STREAM_NUMBER = /^(\d+|\*)$/;
// Bash compound commands: opening word -> closing word.
const COMPOUND_OPENERS = new Map([
  ['{', '}'],
  ['if', 'fi'],
  ['for', 'done'],
  ['while', 'done'],
  ['until', 'done'],
  ['select', 'done'],
  ['case', 'esac'],
]);
// Words that may come before a compound command's opening word on its line.
const COMPOUND_PREFIXES = new Set(['!', 'time', 'then', 'do', 'else', 'elif']);

/** Splits one command line into simple-command segments: {words, stdin, piped, dialect, feed}. */
class Tokenizer {
  constructor(text, dialect, docs) {
    this.src = text;
    this.dialect = dialect;
    this.chars = CHARS[dialect];
    this.docs = docs;
    this.docIndex = 0;
    this.i = 0;
    this.quote = null;
    this.segments = [];
    this.subs = [];
    this.groups = [];
    this.compounds = [];
    this.lastGroup = null;
    this.feed = null;
    this.resetCommand();
    this.resetWord();
  }

  run() {
    for (; this.i < this.src.length; this.i++) this.step(this.src[this.i]);
    this.endCommand(false);
    return {segments: this.segments, subs: this.subs};
  }

  step(c) {
    if (this.quote) return this.quoted(c);
    const handler = this.chars[c];
    if (handler) this[handler](c);
    else this.append(c);
  }

  peek(offset = 1) {
    return this.src[this.i + offset];
  }

  append(text) {
    this.word += text;
    this.hasWord = true;
  }

  resetWord() {
    this.word = '';
    this.hasWord = false;
  }

  resetCommand() {
    this.words = [];
    this.stdin = null;
    this.redirect = null;
    this.redirected = false;
  }

  blank() {
    this.endWord();
  }

  separator() {
    this.endCommand(false);
  }

  openQuote(c) {
    this.quote = c;
    this.hasWord = true;
  }

  quoted(c) {
    if (c === this.quote) return this.closeQuote();
    if (this.quote === '"') return this.doubleQuoted(c);
    this.word += c;
  }

  closeQuote() {
    // PowerShell doubles a quote inside a string of its kind: 'it''s', "say ""hi""".
    if (this.dialect === POWERSHELL && this.peek() === this.quote) {
      this.word += this.quote;
      this.i++;
      return;
    }
    this.quote = null;
  }

  doubleQuoted(c) {
    if (this.dialect === CMD) return this.append(c);
    if (c === ESCAPE[this.dialect]) return this.escapeInQuotes();
    if (c === '$') return this.dollar(c);
    if (c === '`') return this.backtick(c); // bash only: PowerShell's backtick is its escape
    this.append(c);
  }

  escapeInQuotes() {
    const next = this.peek();
    if (next === undefined) return;
    // In bash double quotes a backslash escapes only $ ` " \ and a newline.
    if (this.dialect === BASH && !'$`"\\\n'.includes(next)) return this.append('\\');
    this.i++;
    if (next !== '\n') this.append(next);
  }

  escape() {
    const next = this.peek();
    if (next === undefined) return;
    this.i++;
    // An escaped line break is a line continuation.
    if (next === '\r' && this.peek() === '\n') this.i++;
    else if (next !== '\n') this.append(next);
  }

  comment(c) {
    if (this.hasWord) return this.append(c);
    this.i = lineEnd(this.src, this.i);
  }

  pipe() {
    if (this.peek() === '|') {
      this.i++;
      return this.endCommand(false);
    }
    if (this.peek() === '&') this.i++; // bash |& pipes stderr too
    this.endCommand(true);
  }

  ampersand(c) {
    if (this.dialect === BASH && this.peek() === '>') return this.redirection(c);
    if (this.peek() === '&') this.i++;
    this.endCommand(false);
  }

  redirection(c) {
    if (this.dialect === BASH && this.peek() === '(') return this.substitution(); // <( >(
    // A digit word right before the operator (PowerShell also *) is its stream number.
    if (this.hasWord && STREAM_NUMBER.test(this.word)) this.resetWord();
    else this.endWord();
    this.redirected = true;
    REDIRECT.lastIndex = this.i;
    const match = REDIRECT.exec(this.src);
    if (!match) return this.append(c);
    this.i += match[0].length - 1;
    if (match[2]) return; // a stream duplicate (2>&1, >&-) names no file
    this.redirect = match[1];
    if (HEREDOC_OPERATORS.has(match[1])) this.stdin = this.docs[this.docIndex++] ?? '';
  }

  dollar(c) {
    if (this.peek() !== '(') return this.append(c);
    if (this.dialect === BASH && this.peek(2) === '(') return this.dataSpan(this.i + 1); // $(( ))
    this.substitution();
  }

  at(c) {
    if (this.peek() === '(') return this.substitution(); // @( ) array subexpression
    this.append(c);
  }

  // $( <( >( @( with the paren at `open`, or a PowerShell ( ) argument: the span stays
  // in the current word, and its inside is analyzed as a command line of its own.
  substitution(open = this.i + 1) {
    const end = closingParen(this.src, open, this.dialect);
    this.addSubs([{text: this.src.slice(open + 1, end), dialect: this.dialect}]);
    this.append(this.src.slice(this.i, end + 1));
    this.i = end;
  }

  // A ( ) span that is data, not commands: $(( )) arithmetic or a name=( ) array.
  // Command substitutions inside it still run.
  dataSpan(open) {
    const end = closingParen(this.src, open, this.dialect);
    const span = this.src.slice(this.i, end + 1);
    this.addSubs(substitutionsIn(span, this.dialect));
    this.append(span);
    this.i = end;
  }

  backtick(c) {
    const end = closingBacktick(this.src, this.i);
    if (end === -1) return this.append(c);
    this.addSubs([{text: this.src.slice(this.i + 1, end), dialect: BASH}]);
    this.append(this.src.slice(this.i, end + 1));
    this.i = end;
  }

  // Each substitution belongs to the command being read, which gets the next segment index.
  addSubs(subs) {
    const owner = this.segments.length;
    this.subs.push(...subs.map((sub) => ({...sub, owner})));
  }

  openGroup() {
    if (this.hasWord && this.word.endsWith('=')) return this.dataSpan(this.i); // name=( ) array
    // A subshell starts a command, possibly after `time`, `!` or a keyword like `then`.
    this.startGroup(!this.hasWord && this.words.every((word) => GROUP_PREFIXES.has(word)));
  }

  // PowerShell { } script block: its output goes wherever the block goes.
  openBlock() {
    this.startGroup(true);
  }

  startGroup(subshell) {
    this.endCommand(false);
    this.groups.push({start: this.segments.length, subshell});
  }

  closeGroup() {
    this.endCommand(false);
    const group = this.groups.pop();
    if (group?.subshell) this.lastGroup = {start: group.start, end: this.segments.length};
  }

  // PowerShell: ( ) after a command word is an argument that runs its pipeline
  // (Write-Output (git push), -ArgumentList ('a','b')). At the start it groups one.
  psParen() {
    if (this.hasWord || this.words.length) return this.substitution(this.i);
    this.startGroup(true);
  }

  endWord() {
    if (!this.hasWord) return;
    if (this.redirect) this.endRedirect();
    else this.words.push(this.word);
    this.resetWord();
  }

  endRedirect() {
    if (this.redirect === '<<<') this.stdin = this.word;
    this.redirect = null;
  }

  // A pipe right after a group pipes the group, even with words in between in PowerShell
  // (Invoke-Command { git push } -NoNewScope | Out-Null). A redirect-only command
  // (`| > out.txt`) consumes the pipe; a bare line break after `|` continues it.
  endCommand(piped) {
    this.endWord();
    if (piped && this.lastGroup) this.markPiped(this.lastGroup.start, this.lastGroup.end);
    if (this.words.length) this.pushSegment(piped);
    else if (this.redirected) this.feed = null;
    this.lastGroup = null;
    this.resetCommand();
  }

  pushSegment(piped) {
    const index = this.segments.length;
    const {words, stdin, dialect, feed} = this;
    const segment = {words, stdin, piped, dialect, feed};
    this.segments.push(segment);
    this.feed = piped ? segment : null; // what the next command reads from the pipe
    if (dialect === BASH) this.trackCompound(index, piped);
  }

  // When a compound command's closing word is piped, so is everything since its opener.
  trackCompound(index, piped) {
    const first = this.words.find((word) => !COMPOUND_PREFIXES.has(word));
    if (first === undefined) return; // only `then`, `do`, `time`...: nothing opens or closes
    if (COMPOUND_OPENERS.has(first)) {
      this.compounds.push({closer: COMPOUND_OPENERS.get(first), start: index});
      return;
    }
    const top = this.compounds[this.compounds.length - 1];
    if (top?.closer !== first) return;
    this.compounds.pop();
    if (piped) this.markPiped(top.start, index);
  }

  markPiped(start, end) {
    for (let k = start; k < end; k++) this.segments[k].piped = true;
  }
}

// --- From segments to the commands they run --------------------------------------------

const RESERVED = new Set([
  '!',
  '{',
  '}',
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'do',
  'done',
  'while',
  'until',
  'esac',
  'coproc',
]);
// Words that may come before a subshell's `(` and still leave it a subshell.
const GROUP_PREFIXES = new Set([...RESERVED, 'time']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*(\[[^\]]*\])?\+?=/;
// PowerShell runs the pipeline on an assignment's right-hand side: $out = git push.
const PS_ASSIGNMENT_TARGET = /^(\[[^\]]*\])*\$[^=]*$/;
const PS_ASSIGNMENT_OPERATOR = /^([-+*/%]|\?\?)?=$/;
const PS_GLUED_ASSIGNMENT = /^(\[[^\]]*\])*\$[^=]*=/;

function expand(segment, dialect, depth) {
  checkDepth(depth);
  const argv = effectiveArgv(segment.words, dialect);
  if (!argv.length) return [];
  const inner = nestedCommands(argv, segment, dialect).flatMap((nested) =>
    expandNested(nested, segment, depth + 1),
  );
  const self = {argv, piped: segment.piped, dialect};
  return [self, ...inner.map((command) => ({...command, piped: command.piped || segment.piped}))];
}

// A command line (source) or an argument list (words) that a command runs.
function expandNested(nested, segment, depth) {
  if (!nested.words) return commandsIn(nested.source, nested.dialect, depth);
  const {piped, dialect} = segment;
  return expand({words: nested.words, stdin: null, feed: null, piped, dialect}, dialect, depth);
}

/** The words after assignments, reserved words and runner prefixes. */
function effectiveArgv(words, dialect) {
  let argv = stripPrefixes(words, dialect);
  for (let hops = 0; argv.length && RUNNERS.has(programName(argv[0])); hops++) {
    checkDepth(hops);
    argv = stripPrefixes(afterRunner(argv), dialect);
  }
  return argv;
}

function stripPrefixes(words, dialect) {
  let rest = stripShellPrefixes(words);
  if (dialect !== POWERSHELL) return rest;
  for (let next = stripAssignment(rest); next !== rest; next = stripAssignment(rest)) {
    rest = stripShellPrefixes(next);
  }
  if (rest[0] === '.') rest = rest.slice(1); // dot-sourcing a program just runs it
  return expandLiteralArguments(rest);
}

// Start-Process reads its own argument list (argumentWords).
const OWN_ARGUMENT_LISTS = new Set(['start-process', 'saps', 'start']);

// PowerShell passes a literal array's items as separate arguments, so git ('push')
// and & git @('push','origin') run git push. Only arguments expand: a statement
// that is just an array, like @('git','push') after an assignment, runs nothing.
function expandLiteralArguments(argv) {
  if (argv.length < 2 || OWN_ARGUMENT_LISTS.has(programName(argv[0]))) return argv;
  return [argv[0], ...argv.slice(1).flatMap(literalItems)];
}

function literalItems(word) {
  const match = /^@?\((.*)\)$/s.exec(word);
  if (!match || !/^\s*(['"])[^'"]*\1\s*(,\s*(['"])[^'"]*\3\s*)*$/.test(match[1])) return [word];
  return match[1].split(',').map((item) => item.trim().slice(1, -1));
}

function stripShellPrefixes(words) {
  let i = 0;
  while (i < words.length) {
    if (words[i] === 'function') i += 2;
    else if (RESERVED.has(words[i]) || ASSIGNMENT.test(words[i])) i++;
    else break;
  }
  return words.slice(i);
}

// `$x = <pipeline>`, `[string]$x += <pipeline>` or `$x=<first word> ...` (PowerShell).
function stripAssignment(words) {
  const [first = '', second = ''] = words;
  if (PS_ASSIGNMENT_TARGET.test(first) && PS_ASSIGNMENT_OPERATOR.test(second))
    return words.slice(2);
  const glued = PS_GLUED_ASSIGNMENT.exec(first);
  if (!glued) return words;
  const rest = first.slice(glued[0].length);
  return rest ? [rest, ...words.slice(1)] : words.slice(1);
}

const runner = (values = [], positionals = 0, split = false) => ({
  values: new Set(values),
  positionals,
  split,
});

// Programs that run their argument words as another command: option words that
// take a value, leading positionals to skip (timeout's duration), and whether an
// option carries the whole command as one string (env -S).
const RUNNERS = new Map([
  ['env', runner(['-u', '--unset', '-C', '--chdir'], 0, true)],
  ['timeout', runner(['-s', '--signal', '-k', '--kill-after'], 1)],
  ['nice', runner(['-n', '--adjustment'])],
  ['nohup', runner()],
  ['time', runner()],
  ['command', runner()],
  ['builtin', runner()],
  ['exec', runner(['-a'])],
  [
    'xargs',
    runner([
      '-a',
      '--arg-file',
      '-d',
      '--delimiter',
      '-E',
      '-I',
      '-L',
      '-n',
      '--max-args',
      '-P',
      '--max-procs',
      '-s',
      '--max-chars',
    ]),
  ],
  ['winpty', runner()],
  ['stdbuf', runner(['-i', '-o', '-e'])],
  ['setsid', runner()],
  ['sudo', runner(['-u', '--user', '-g', '--group', '-C', '-D', '--chdir'])],
  ['doas', runner(['-u', '-C'])],
  ['wsl', runner(['-d', '--distribution', '-u', '--user', '--cd'])],
  ['call', runner()], // cmd: call git push
]);

function afterRunner(argv) {
  const spec = RUNNERS.get(programName(argv[0]));
  const words = argv.slice(1);
  let positionals = spec.positionals;
  let i = 0;
  for (; i < words.length; i++) {
    const split = spec.split ? splitStringAt(words, i) : null;
    if (split) return split;
    const kind = runnerWordKind(words[i], spec);
    if (kind === 'value') i++;
    else if (kind === 'positional' && positionals-- <= 0) break;
  }
  return words.slice(i);
}

// env -S 'git push', -S'git push' and --split-string='git push' split one string into
// the command's words.
function splitStringAt(words, i) {
  const match = /^(?:-S|--split-string=?)([\s\S]*)$/.exec(words[i]);
  if (!match) return null;
  const text = match[1] || (words[i + 1] ?? '');
  const rest = words.slice(match[1] ? i + 1 : i + 2);
  return [...text.split(/\s+/).filter(Boolean), ...rest];
}

function runnerWordKind(word, spec) {
  if (word.startsWith('-')) return spec.values.has(word) ? 'value' : 'flag';
  return ASSIGNMENT.test(word) ? 'assignment' : 'positional';
}

// --- Command lines inside commands ----------------------------------------------------

const nestedCommand = (text, dialect) => (text ? {source: text, dialect} : null);

/** What a command runs besides itself: [{source, dialect}] or [{words}] entries. */
function nestedCommands(argv, segment, dialect) {
  const handler = NESTED.get(programName(argv[0]));
  const nested = handler ? handler(argv.slice(1), segment, dialect) : null;
  if (Array.isArray(nested)) return nested.filter(Boolean);
  return nested ? [nested] : [];
}

const ECHO_PROGRAMS = new Set(['echo', 'printf', 'write-output']);

// What the previous command of a pipeline writes, when that is literal text: echo,
// printf or Write-Output arguments, a heredoc through cat, or a bare PowerShell string.
function pipedText(feed) {
  if (!feed) return null;
  const [program = '', ...args] = stripPrefixes(feed.words, feed.dialect);
  const name = programName(program);
  if (ECHO_PROGRAMS.has(name)) return echoedText(args);
  if (name === 'cat') return feed.stdin;
  return feed.dialect === POWERSHELL && !args.length ? program : null;
}

function echoedText(args) {
  const text = args.filter((arg) => !arg.startsWith('-')).join(' ');
  return text.replace(/\\[nt]/g, '\n');
}

const SHELL_VALUE_OPTIONS = new Set(['-o', '+o', '-O', '+O', '--rcfile', '--init-file']);

// bash -c 'script'; or its script from stdin: a heredoc, a herestring or piped text.
function posixShell(args, segment) {
  const {command, noRun, index} = shellOptions(args);
  if (noRun) return null; // bash -n reads without running; --version and --help exit
  if (command) return nestedCommand(args[index], BASH);
  if (index < args.length) return null; // runs a script file
  return nestedCommand(segment.stdin ?? pipedText(segment.feed), BASH);
}

const NO_RUN_OPTION = /^(-[A-Za-z]*n[A-Za-z]*|--version|--help)$/;

function shellOptions(args) {
  let command = false;
  let noRun = false;
  let i = 0;
  for (; i < args.length && /^[-+]/.test(args[i]); i++) {
    if (/^-[A-Za-z]*c[A-Za-z]*$/.test(args[i])) command = true; // -c, -lc, -ec
    if (NO_RUN_OPTION.test(args[i])) noRun = true;
    if (SHELL_VALUE_OPTIONS.has(args[i])) i++;
  }
  return {command, noRun, index: i};
}

// Parameters that take a value, and their short aliases. PowerShell also accepts any
// unique prefix (-Exec Bypass); prefixes count from three letters, so a one-letter
// flag such as pwsh's -i never swallows the next word.
const POWERSHELL_VALUE_ALIASES = new Set(['ex', 'ep', 'w', 'if', 'of', 'v', 'wd', 'config']);
const POWERSHELL_VALUE_PARAMETERS = [
  'executionpolicy',
  'windowstyle',
  'inputformat',
  'outputformat',
  'version',
  'psconsolefile',
  'configurationname',
  'workingdirectory',
  'settingsfile',
  'custompipename',
];
const ENCODED_ALIASES = new Set(['e', 'ec', 'en', 'enc']);

function takesValue(name) {
  if (POWERSHELL_VALUE_ALIASES.has(name)) return true;
  return name.length >= 3 && POWERSHELL_VALUE_PARAMETERS.some((full) => full.startsWith(name));
}

// powershell -Command <words>, -EncodedCommand <base64>, a bare first argument, or
// commands read from stdin (`-Command -`, or no command at all).
function powershellCommand(args, segment) {
  for (let i = 0; i < args.length; i++) {
    const kind = powershellParameter(args[i]);
    if (kind === 'command') return powershellScript(args.slice(i + 1), segment);
    if (kind === 'encoded') return nestedCommand(decodeCommand(args[i + 1]), POWERSHELL);
    if (kind === 'file') return null;
    if (kind === 'script') return powershellScript(args.slice(i), segment);
    if (kind === 'value') i++;
  }
  return nestedCommand(pipedText(segment.feed), POWERSHELL);
}

function powershellScript(words, segment) {
  const script = words.join(' ');
  return nestedCommand(script === '-' ? pipedText(segment.feed) : script, POWERSHELL);
}

// Parameter names may be abbreviated: -c, -com, -Command.
function powershellParameter(word) {
  if (!/^[-/]/.test(word)) return 'script';
  const name = word.slice(1).toLowerCase();
  if (!name) return 'flag';
  if ('command'.startsWith(name)) return 'command';
  if (ENCODED_ALIASES.has(name) || 'encodedcommand'.startsWith(name)) return 'encoded';
  if ('file'.startsWith(name)) return 'file';
  return takesValue(name) ? 'value' : 'flag';
}

function decodeCommand(text) {
  if (!/^[A-Za-z0-9+/=]+$/.test(text ?? '')) return '';
  return Buffer.from(text, 'base64').toString('utf16le');
}

// cmd /c <words> (Git Bash spells it //c to dodge its path conversion). cmd re-reads
// the raw command line, and Git Bash and PowerShell quote an argument on it only when
// it is empty or has whitespace, so `&&` stays an operator and "a && b" stays text.
function cmdCommand(args) {
  const at = args.findIndex((arg) => /^\/\/?[ck]$/i.test(arg));
  if (at === -1) return null;
  const words = args.slice(at + 1).map((arg) => (arg === '' || /\s/.test(arg) ? `"${arg}"` : arg));
  return cmdReadings(words.join(' ')).map((line) => nestedCommand(line, CMD));
}

// A /c line that starts with a quote loses its first and last quote, unless cmd takes
// it for a quoted program path (cmd /?). Both readings are checked instead of guessing.
function cmdReadings(line) {
  if (!line.startsWith('"')) return [line];
  const last = line.lastIndexOf('"');
  return [line, line.slice(1, last) + line.slice(last + 1)];
}

// Invoke-Expression [-Command] <string>, or the string piped into it.
function invokeExpression(args, segment) {
  const words = args.filter((arg) => !isCommandParameter(arg));
  return nestedCommand(words.length ? words.join(' ') : pipedText(segment.feed), POWERSHELL);
}

function isCommandParameter(word) {
  const name = word.startsWith('-') ? word.slice(1).toLowerCase() : '';
  return name !== '' && 'command'.startsWith(name);
}

const START_VALUE_PARAMETERS = new Set([
  'workingdirectory',
  'verb',
  'windowstyle',
  'redirectstandardinput',
  'redirectstandardoutput',
  'redirectstandarderror',
  'credential',
  'environment',
]);

// Start-Process [-FilePath] <program> [[-ArgumentList] <args>], parameters in any
// order. The argument list may be one string or an array.
function startProcess(args) {
  const words = mergeListWords(args);
  const found = {positional: []};
  for (let i = 0; i < words.length; i++) {
    const kind = startParameter(words[i]);
    if (kind === 'positional') found.positional.push(words[i]);
    else if (kind === 'file' || kind === 'list') found[kind] = words[++i];
    else if (kind === 'value') i++;
  }
  const file = found.file ?? found.positional.shift();
  const list = found.list ?? found.positional.shift();
  return file ? {words: [file, ...argumentWords(list)]} : null;
}

// An array written with spaces arrives as several words: 'reset', '--hard'. A word
// that ends in a comma continues into the next one.
function mergeListWords(args) {
  const merged = [];
  for (const arg of args) {
    const previous = merged[merged.length - 1];
    if (previous?.endsWith(',')) merged[merged.length - 1] = `${previous} ${arg}`;
    else merged.push(arg);
  }
  return merged;
}

function startParameter(word) {
  if (!word.startsWith('-')) return 'positional';
  const name = word.slice(1).toLowerCase();
  if (!name) return 'flag';
  if ('filepath'.startsWith(name)) return 'file';
  if ('argumentlist'.startsWith(name) || name === 'args') return 'list';
  return START_VALUE_PARAMETERS.has(name) ? 'value' : 'flag';
}

// "push origin", 'push','origin', @('push','origin') or ('push','origin') -> words.
function argumentWords(list) {
  if (!list) return [];
  return list
    .replace(/^@?\(|\)$/g, '')
    .split(/[\s,]+/)
    .map((word) => word.replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// PowerShell's `start` is Start-Process. cmd's (and Git Bash's) takes /options first,
// and a quoted first word is the window title: start "push window" git push.
function startCommand(args, segment, dialect) {
  if (dialect === POWERSHELL) return startProcess(args);
  const words = args.filter((arg) => !/^\/\S/.test(arg));
  if (words[0] === '' || /\s/.test(words[0] ?? '')) words.shift();
  return words.length ? {words} : null;
}

const FIND_ACTIONS = new Set(['-exec', '-execdir', '-ok', '-okdir']);

// find ... -exec <command words> ; runs the command for every match, once per action.
// The words stay words: re-joining them would lose quoting (-exec sh -c 'git push' ;).
function findExec(args) {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    if (!FIND_ACTIONS.has(args[i])) continue;
    const end = actionEnd(args, i + 1);
    found.push({words: args.slice(i + 1, end)});
    i = end;
  }
  return found;
}

function actionEnd(args, from) {
  for (let k = from; k < args.length; k++) {
    if (args[k] === ';' || args[k] === '+') return k;
  }
  return args.length;
}

// Git subcommands that run a shell command line of their own.
function gitCommands(args) {
  const git = gitInvocation(['git', ...args]);
  if (git?.verb === 'submodule') return submoduleForeach(git.args);
  if (git?.verb === 'rebase') return rebaseExec(git.args);
  return null;
}

const FOREACH_OPTIONS = new Set(['--recursive', '--quiet', '-q']);

// git submodule foreach <command> runs <command> through a shell in every submodule.
function submoduleForeach(args) {
  const at = args.indexOf('foreach');
  if (at === -1 || args.slice(0, at).some((arg) => !arg.startsWith('-'))) return null;
  const command = args.slice(at + 1).filter((arg) => !FOREACH_OPTIONS.has(arg));
  return nestedCommand(command.join(' '), BASH);
}

// git rebase -x <cmd> / --exec <cmd> runs <cmd> through a shell after each commit.
function rebaseExec(args) {
  const found = [];
  for (let i = 0; i < args.length; i++) {
    const inline = /^(?:--exec=|-x)(.+)$/.exec(args[i]);
    if (inline) found.push(nestedCommand(inline[1], BASH));
    else if (args[i] === '-x' || args[i] === '--exec') found.push(nestedCommand(args[++i], BASH));
  }
  return found;
}

const WATCH_VALUE_OPTIONS = new Set(['-n', '--interval', '-q', '--equexit', '-s', '--shell']);

// watch [options] <command...> joins the command's words and runs them through sh -c.
function watchCommand(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += WATCH_VALUE_OPTIONS.has(args[i]) ? 2 : 1;
  return nestedCommand(args.slice(i).join(' '), BASH);
}

const NESTED = new Map([
  ['watch', watchCommand],
  ['bash', posixShell],
  ['sh', posixShell],
  ['zsh', posixShell],
  ['dash', posixShell],
  ['ksh', posixShell],
  ['powershell', powershellCommand],
  ['pwsh', powershellCommand],
  ['cmd', cmdCommand],
  ['eval', (args) => nestedCommand(args.join(' '), BASH)],
  ['iex', invokeExpression],
  ['invoke-expression', invokeExpression],
  ['start-process', startProcess],
  ['saps', startProcess],
  ['start', startCommand],
  ['find', findExec],
  ['git', gitCommands],
]);
