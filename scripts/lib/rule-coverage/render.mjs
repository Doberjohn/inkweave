/**
 * Markdown pieces for the generated coverage blocks (#479): numbers, tables, lists and the
 * ```chart blocks the docs hub (scripts/generate-docs.mjs) draws with Chart.js.
 */

/** 9291 → "9,291". */
export const fmt = (n) => n.toLocaleString('en-US');

/** A share to one decimal place: pct(1, 3) → "33.3%". */
export const pct = (part, whole) => `${whole === 0 ? '0.0' : ((100 * part) / whole).toFixed(1)}%`;

/** Cards' full names, comma-separated, in the order given, or "none". */
export const nameList = (cards) =>
  cards.length === 0 ? 'none' : cards.map((card) => card.fullName).join(', ');

/** "1 card" / "3 cards". */
export const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? '' : 's'}`;

/**
 * How often each key occurs, most common first, ties by key.
 *
 * @param {string[]} keys
 * @returns {Array<[string, number]>}
 */
export function tally(keys) {
  const counts = new Map();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** A tally as text: "Amber 10, Ruby 4", or "none". */
export const tallyText = (keys) =>
  keys.length === 0
    ? 'none'
    : tally(keys)
        .map(([key, n]) => `${key} ${fmt(n)}`)
        .join(', ');

/**
 * A markdown table. Each separator is as wide as its header, the shape the docs already use.
 *
 * @param {string[]} headers
 * @param {Array<Array<string | number>>} rows
 * @returns {string}
 */
export function table(headers, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  const rule = headers.map((h) => '-'.repeat(Math.max(3, h.length)));
  return [line(headers), `|${rule.join('|')}|`, ...rows.map(line)].join('\n');
}

const inline = (value) => JSON.stringify(value);

/** Arrays of plain values stay on one line, the way the hand-written charts were laid out. */
function chartJson(value, indent) {
  if (Array.isArray(value) && value.every((v) => typeof v !== 'object')) {
    return `[${value.map(inline).join(', ')}]`;
  }
  if (typeof value !== 'object' || value === null) return inline(value);
  const pad = '  '.repeat(indent + 1);
  const entries = Array.isArray(value)
    ? value.map((v) => `${pad}${chartJson(v, indent + 1)}`)
    : Object.entries(value).map(([k, v]) => `${pad}${inline(k)}: ${chartJson(v, indent + 1)}`);
  const [open, close] = Array.isArray(value) ? ['[', ']'] : ['{', '}'];
  return `${open}\n${entries.join(',\n')}\n${'  '.repeat(indent)}${close}`;
}

/** A ```chart block. */
export const chart = (spec) => ['```chart', chartJson(spec, 0), '```'].join('\n');

/**
 * A doughnut chart of labelled counts; each label carries its count. Empty slices are left out,
 * since a doughnut draws nothing for them.
 *
 * @param {string} title
 * @param {Array<[string, number]>} slices
 */
export function doughnut(title, slices) {
  const drawn = slices.filter(([, n]) => n > 0);
  return chart({
    type: 'doughnut',
    title,
    data: {
      labels: drawn.map(([label, n]) => `${label} (${fmt(n)})`),
      values: drawn.map(([, n]) => n),
    },
  });
}

/**
 * A single-series bar chart.
 *
 * @param {{title: string, label: string, bars: Array<[string, number]>, colors?: string[]}} spec
 */
export function bars({title, label, bars: entries, colors}) {
  const dataset = {label, data: entries.map(([, n]) => n)};
  if (colors) dataset.backgroundColor = colors;
  return chart({
    type: 'bar',
    title,
    data: {labels: entries.map(([name]) => name), datasets: [dataset]},
  });
}

/** The colour of a score's display tier: Weak <4, Moderate 4-6.9, Strong 7-9.4, Perfect >=9.5. */
export function tierColor(score) {
  if (score >= 9.5) return '#fbbf24';
  if (score >= 7) return '#6ee7a0';
  if (score >= 4) return '#60b5f5';
  return '#f59090';
}

/** The name of a score's display tier. */
export function tierName(score) {
  if (score >= 9.5) return 'Perfect';
  if (score >= 7) return 'Strong';
  if (score >= 4) return 'Moderate';
  return 'Weak';
}
