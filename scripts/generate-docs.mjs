#!/usr/bin/env node

/**
 * Generate HTML reports from markdown documentation files.
 * Uses GitHub API for markdown rendering (requires internet).
 * Falls back to raw markdown wrapped in <pre> if offline.
 *
 * Usage: node scripts/generate-docs.mjs
 * Output: reports/*.html (gitignored)
 */

import {execFileSync} from 'child_process';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'fs';
import {basename, resolve} from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'reports');

const ENGINE_DIR = 'packages/synergy-engine';

/**
 * Synergy-rule docs are auto-discovered from the engine package so adding a new
 * `*_RULE.md` automatically wires it into the hub (no manual list to update).
 * Files with a curated multi-word label go in the override map; everything else
 * derives its label from the filename (SACRIFICE_RULE.md -> "Sacrifice").
 */
const RULE_LABEL_OVERRIDES = {
  'SHIFT_TARGET_RULE.md': 'Shift Targets',
  'NAMED_COMPANIONS_RULE.md': 'Named Companions',
  'SELF_DISCARD_RULE.md': 'Self-Discard',
  'LORE_LOSS_RULE.md': 'Lore Loss',
  'SINGER_SONGS_RULE.md': 'Singer + Songs',
  'MERIDA_WISP_RULE.md': 'Merida - Wisp Conjurer',
  'LOCATION_CONTROL_RULE.md': 'Location Control',
  'DWARFS_RULE.md': 'Seven Dwarfs',
  'TRIBES_RULE.md': 'Classification Tribes',
  'REMOVED_RULES.md': 'Removed Rules',
};

/** Reading order; files not listed sort alphabetically, but always before Removed Rules. */
const RULE_ORDER = [
  'SHIFT_TARGET_RULE.md',
  'NAMED_COMPANIONS_RULE.md',
  'DISCARD_RULE.md',
  'SELF_DISCARD_RULE.md',
  'LORE_LOSS_RULE.md',
  'SINGER_SONGS_RULE.md',
  'SPIKE_SUIT_RULE.md',
  'MERIDA_ARCHER_RULE.md',
  'MERIDA_WISP_RULE.md',
  'FREE_PLAY_RULE.md',
  'LOCATION_CONTROL_RULE.md',
  'RAMP_RULE.md',
  'TOY_RULE.md',
  'SACRIFICE_RULE.md',
  'HEALING_RULE.md',
  'EXERT_RULE.md',
  'BOUNCE_RULE.md',
  'DWARFS_RULE.md',
  'VINELINGS_RULE.md',
  'HUNNY_RULE.md',
  'RED_PANDA_RULE.md',
  'ITEMS_RULE.md',
  'TRIBES_RULE.md',
  'REMOVED_RULES.md',
];

function ruleLabelFromFilename(file) {
  return file
    .replace(/_RULES?\.md$/i, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Discover every `*_RULE.md` / `*_RULES.md` in the engine package as a Synergy Rules doc. */
function discoverRuleDocs() {
  const removed = 'REMOVED_RULES.md';
  const rank = (f) => {
    const i = RULE_ORDER.indexOf(f);
    if (i !== -1) return i;
    return f === removed ? Infinity : RULE_ORDER.length - 1; // unknown rules sit before Removed
  };
  return readdirSync(resolve(ROOT, ENGINE_DIR))
    .filter((f) => /_RULES?\.md$/i.test(f))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((file) => ({
      src: `${ENGINE_DIR}/${file}`,
      out: file.replace(/\.md$/i, '.html'),
      category: 'Synergy Rules',
      label: RULE_LABEL_OVERRIDES[file] ?? ruleLabelFromFilename(file),
    }));
}

/** Markdown files to convert, with output filenames and categories */
const DOCS = [
  // Synergy Rules (auto-discovered from packages/synergy-engine/*_RULE.md)
  ...discoverRuleDocs(),
  // Architecture
  {
    src: 'packages/synergy-engine/SCORING_DESIGN.md',
    out: 'SCORING_DESIGN.html',
    category: 'Architecture',
    label: 'Scoring Design',
  },
  {
    src: 'packages/synergy-engine/README.md',
    out: 'synergy-engine-README.html',
    category: 'Architecture',
    label: 'Synergy Engine',
  },
  // Quality & Research
  {
    src: 'docs/SYNERGY_AUDIT.md',
    out: 'SYNERGY_AUDIT.html',
    category: 'Quality & Research',
    label: 'Synergy Audit',
  },
  {
    src: 'docs/UX_AUDIT.md',
    out: 'UX_AUDIT.html',
    category: 'Quality & Research',
    label: 'UX Audit',
  },
  {
    src: 'docs/UX_REFERENCE.md',
    out: 'UX_REFERENCE.html',
    category: 'Quality & Research',
    label: 'UX Reference',
  },
  // Project
  {
    src: 'docs/DATABASE.md',
    out: 'DATABASE.html',
    category: 'Architecture',
    label: 'Database Architecture',
  },
  {
    src: 'docs/CARD_DATA_PIPELINE.md',
    out: 'CARD_DATA_PIPELINE.html',
    category: 'Architecture',
    label: 'Card Data Pipeline',
  },
  {
    src: 'docs/reveals/START_REVEAL_SEASON.md',
    out: 'START_REVEAL_SEASON.html',
    category: 'Architecture',
    label: 'Start a Reveal Season',
  },
  {src: 'docs/TECH_STACK.md', out: 'TECH_STACK.html', category: 'Project', label: 'Tech Stack'},
  {
    src: 'docs/V1_LAUNCH_PLAN.md',
    out: 'V1_LAUNCH_PLAN.html',
    category: 'Project',
    label: 'v1.0 Launch Plan',
  },
];

/** Standalone HTML reports (not generated from markdown, already exist in reports/) */
const STANDALONE = [
  {
    out: 'META_REPORT.html',
    category: 'Meta & Competitive',
    label: 'Winterspell Meta Report',
    src: 'Core Constructed \u2014 27 tournaments, 8,231 players',
  },
  {
    out: 'COMPETITIVE_ANALYSIS.html',
    category: 'Meta & Competitive',
    label: 'Competitive Analysis',
    src: '575 decklists \u2014 co-occurrence, engine validation, missing rules',
  },
];

const TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Inkweave Docs</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&family=Fira+Code:wght@400&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <script>
    // Click-to-zoom for Mermaid diagrams
    document.addEventListener('click', (e) => {
      const overlay = e.target.closest('.mermaid-zoom-overlay');
      if (overlay) { overlay.remove(); return; }
      const diagram = e.target.closest('.mermaid');
      if (!diagram) return;
      const svg = diagram.querySelector('svg');
      if (!svg) return;
      const o = document.createElement('div');
      o.className = 'mermaid-zoom-overlay';
      o.appendChild(svg.cloneNode(true));
      document.body.appendChild(o);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      document.querySelector('.mermaid-zoom-overlay')?.remove();
    });
  </script>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        background: '#0d0d14',
        primaryColor: '#1a1a2e',
        primaryBorderColor: '#d4af37',
        primaryTextColor: '#e8e8e8',
        secondaryColor: '#1a4a4a',
        tertiaryColor: '#2a1a4a',
        lineColor: '#90a1b9',
        textColor: '#e8e8e8',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        mainBkg: '#1a1a2e',
        secondBkg: '#2a2a3e',
        clusterBkg: 'rgba(212, 175, 55, 0.05)',
        clusterBorder: '#d4af37',
        edgeLabelBackground: '#0d0d14',
        nodeBorder: '#d4af37',
        defaultLinkColor: '#90a1b9',
        labelTextColor: '#e8e8e8',
        noteBkgColor: '#1a4a1a',
        noteBorderColor: '#90ee90',
        noteTextColor: '#e8e8e8',
      },
    });
  </script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #0d0d14;
      color: #e8e8e8;
      max-width: 920px;
      margin: 0 auto;
      padding: 40px 24px 80px;
      line-height: 1.65;
      font-size: 14px;
    }

    /* Navigation */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 32px;
      font-size: 13px;
      color: #90a1b9;
      text-decoration: none;
      transition: color 0.15s;
    }
    .back-link:hover { color: #d4af37; }

    /* Typography */
    h1, h2, h3, h4, h5, h6 {
      color: #e8e8e8;
      margin-top: 2em;
      margin-bottom: 0.6em;
      line-height: 1.3;
      /* TOC anchor scroll — leaves a bit of breathing room above the heading */
      scroll-margin-top: 16px;
    }
    h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 28px;
      color: #d4af37;
      border-bottom: 1px solid #333355;
      padding-bottom: 12px;
      margin-top: 0;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      color: #e8e8e8;
      border-bottom: 1px solid #1a1a2e;
      padding-bottom: 6px;
    }
    h3 { font-size: 15px; font-weight: 600; color: #c8c8d8; }
    h4 { font-size: 14px; font-weight: 600; color: #90a1b9; }
    p { margin: 0.8em 0; }
    strong { color: #e8e8e8; }

    /* Links */
    a { color: #d4af37; text-decoration: none; }
    a:hover { color: #ffb900; text-decoration: underline; }

    /* Code */
    code {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      background: #1a1a2e;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.85em;
      color: #c8c8d8;
    }
    pre {
      background: #1a1a2e;
      border: 1px solid #333355;
      border-radius: 8px;
      padding: 16px 20px;
      overflow-x: auto;
      margin: 16px 0;
    }
    pre code {
      background: none;
      padding: 0;
      font-size: 13px;
      line-height: 1.5;
    }

    /* Tables */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #2a2a44;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #1a1a2e;
      color: #d4af37;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    tr:nth-child(even) { background: rgba(26, 26, 46, 0.4); }
    tr:hover { background: rgba(212, 175, 55, 0.05); }

    /* Blockquotes */
    blockquote {
      border-left: 3px solid #d4af37;
      margin: 16px 0;
      padding: 10px 20px;
      background: rgba(26, 26, 46, 0.5);
      border-radius: 0 6px 6px 0;
      color: #c8c8d8;
    }

    /* Lists */
    ul, ol { padding-left: 24px; margin: 0.6em 0; }
    li { margin: 4px 0; color: #c8c8d8; }
    li strong { color: #e8e8e8; }

    /* Horizontal rules */
    hr { border: none; border-top: 1px solid #333355; margin: 32px 0; }

    /* Images */
    img { max-width: 100%; border-radius: 6px; }

    /* Details/Summary (collapsible sections) */
    details {
      background: #151525;
      border: 1px solid #2a2a44;
      border-radius: 8px;
      margin: 12px 0;
      overflow: hidden;
    }
    details[open] {
      border-color: #333355;
    }
    summary {
      padding: 12px 16px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      color: #e8e8e8;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: color 0.15s, background 0.15s;
      user-select: none;
    }
    summary:hover {
      color: #d4af37;
      background: rgba(212, 175, 55, 0.05);
    }
    summary::before {
      content: '\\25B6';
      font-size: 10px;
      color: #d4af37;
      transition: transform 0.2s;
    }
    details[open] > summary::before {
      transform: rotate(90deg);
    }
    summary::-webkit-details-marker { display: none; }
    details > :not(summary) {
      padding: 0 16px;
    }
    details > :last-child {
      padding-bottom: 16px;
    }
    /* Tighten spacing inside details panels */
    details h1, details h2, details h3, details h4, details h5, details h6 {
      margin-top: 0.8em;
      margin-bottom: 0.2em;
    }
    details p { margin: 0.3em 0; }
    details table, details markdown-accessiblity-table { margin: 4px 0; }
    details markdown-accessiblity-table { display: block; }
    summary + * { margin-top: 0.3em; }

    /* Task lists (GitHub checkboxes) */
    .task-list-item { list-style: none; margin-left: -24px; }
    .task-list-item input[type="checkbox"] {
      margin-right: 6px;
      accent-color: #d4af37;
    }

    /* Mermaid diagram containers — inline at body width; click to enlarge
       opens a full-viewport overlay (see .mermaid-zoom-overlay below). */
    .mermaid {
      position: relative;
      background: #151525;
      border: 1px solid #2a2a44;
      border-radius: 8px;
      padding: 24px;
      margin: 20px 0;
      text-align: center;
      overflow-x: auto;
      cursor: zoom-in;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .mermaid:hover {
      border-color: #d4af37;
      box-shadow: 0 0 24px rgba(212, 175, 55, 0.15);
    }
    .mermaid svg { max-width: 100%; height: auto; }
    /* "Click to enlarge" hint, fades in on hover */
    .mermaid::after {
      content: 'Click to enlarge';
      position: absolute;
      top: 8px;
      right: 12px;
      font-size: 11px;
      color: #90a1b9;
      letter-spacing: 0.5px;
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .mermaid:hover::after { opacity: 0.85; }

    /* Zoom overlay shown on click */
    .mermaid-zoom-overlay {
      position: fixed;
      inset: 0;
      background: rgba(13, 13, 20, 0.96);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      cursor: zoom-out;
      animation: fadeIn 0.18s ease-out;
    }
    .mermaid-zoom-overlay svg {
      max-width: calc(100vw - 64px);
      max-height: calc(100vh - 64px);
      width: auto !important;
      height: auto !important;
    }
    .mermaid-zoom-overlay::after {
      content: 'ESC or click anywhere to close';
      position: absolute;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      color: #90a1b9;
      letter-spacing: 0.5px;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Pseudo-callout boxes (any blockquote whose first child <strong> starts with a label) */
    blockquote.callout {
      border-left: 3px solid #d4af37;
      background: rgba(212, 175, 55, 0.06);
    }
    blockquote.callout-warning {
      border-left-color: #ff9d3a;
      background: rgba(255, 157, 58, 0.07);
    }
    blockquote.callout-warning strong { color: #ff9d3a; }
    blockquote.callout-info {
      border-left-color: #5cb1ff;
      background: rgba(92, 177, 255, 0.06);
    }
    blockquote.callout-info strong { color: #5cb1ff; }
    blockquote.callout-success {
      border-left-color: #90ee90;
      background: rgba(144, 238, 144, 0.06);
    }
    blockquote.callout-success strong { color: #90ee90; }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #0d0d14; }
    ::-webkit-scrollbar-thumb { background: #333355; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #444466; }

    /* Footer */
    .doc-footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #1a1a2e;
      font-size: 12px;
      color: #555;
      text-align: center;
    }

    /* Chart containers */
    .chart-container {
      background: #151525;
      border: 1px solid #2a2a44;
      border-radius: 8px;
      padding: 24px;
      margin: 20px 0;
      position: relative;
    }
    .chart-container canvas {
      max-height: 360px;
    }
    .chart-title {
      font-size: 14px;
      font-weight: 600;
      color: #d4af37;
      margin: 0 0 16px;
      text-align: center;
    }
  </style>
</head>
<body>
  <a class="back-link" href="index.html">&larr; Back to docs hub</a>
  ${body}
  <div class="doc-footer">Generated by Inkweave docs — local dev reference</div>
</body>
</html>`;

/**
 * Categorical series palette for Chart.js on the dark docs hub. Chosen for
 * MUTUAL DISTINGUISHABILITY, not brand fidelity — these are deliberately NOT the
 * ink colours and must not be synced to `INK_COLORS`. The ink palette is tuned for
 * Lorcana symbol fidelity, which makes some of it unusable here: Amethyst
 * (`#64296b`) is only 1.9:1 against a dark canvas and would vanish as a chart
 * series. The old ink-name comments on these entries were misleading, and one
 * (steel `#71717a`) never matched the token at all.
 */
const CHART_COLORS = [
  '#d4af37', // gold
  '#8b5cf6', // violet
  '#10b981', // green
  '#ef4444', // red
  '#3b82f6', // blue
  '#71717a', // grey
  '#f59e0b', // orange
  '#6ee7a0', // pale green
  '#60b5f5', // pale blue
  '#f59090', // pale red
];

/**
 * Transform ```chart code blocks into Chart.js canvas elements.
 *
 * GitHub API renders ```chart blocks as:
 *   <pre><code class="language-chart">...JSON...</code></pre>
 * or sometimes with <div> wrappers. We find these and replace them.
 *
 * Chart JSON format:
 * {
 *   "type": "doughnut" | "bar" | "line" | "pie" | "polarArea",
 *   "title": "Chart Title",
 *   "data": {
 *     "labels": ["A", "B", "C"],
 *     "values": [10, 20, 30]
 *   },
 *   "options": { ... }  // optional Chart.js overrides
 * }
 */
let chartCounter = 0;

function transformChartBlocks(html) {
  // GitHub API renders ```chart as <pre lang="chart" ...><code ...>JSON</code></pre>
  // We match both GitHub's format and the standard language-chart format
  return html.replace(
    /<pre[^>]*lang="chart"[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>|<pre><code class="language-chart">([\s\S]*?)<\/code><\/pre>/g,
    (_, jsonStr1, jsonStr2) => {
      const unescaped = (jsonStr1 || jsonStr2)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      let config;
      try {
        config = JSON.parse(unescaped);
      } catch (err) {
        console.warn(`  Warning: invalid chart JSON — ${err.message}`);
        return `<pre><code>Invalid chart: ${err.message}</code></pre>`;
      }

      const id = `chart-${chartCounter++}`;
      const title = config.title ? `<p class="chart-title">${config.title}</p>` : '';
      const labels = JSON.stringify(config.data.labels);
      const values = JSON.stringify(config.data.values);
      const type = config.type || 'bar';

      // Support multiple datasets
      const datasets = config.data.datasets ? JSON.stringify(config.data.datasets) : null;

      // Build Chart.js config
      const chartConfig = datasets
        ? `{
            type: '${type}',
            data: {
              labels: ${labels},
              datasets: ${datasets}
            },
            options: ${JSON.stringify(buildChartOptions(config))}
          }`
        : `{
            type: '${type}',
            data: {
              labels: ${labels},
              datasets: [{
                data: ${values},
                backgroundColor: ${JSON.stringify(CHART_COLORS.slice(0, config.data.labels.length))},
                borderColor: 'transparent',
                borderWidth: 0
              }]
            },
            options: ${JSON.stringify(buildChartOptions(config))}
          }`;

      return `
        <div class="chart-container">
          ${title}
          <canvas id="${id}"></canvas>
        </div>
        <script>
          new Chart(document.getElementById('${id}'), ${chartConfig});
        </script>`;
    },
  );
}

function buildChartOptions(config) {
  const base = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#e8e8e8',
          font: {family: 'Inter', size: 12},
          padding: 16,
        },
        position: 'bottom',
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleColor: '#d4af37',
        bodyColor: '#e8e8e8',
        borderColor: '#333355',
        borderWidth: 1,
        padding: 12,
        titleFont: {family: 'Inter', weight: '600'},
        bodyFont: {family: 'Inter'},
      },
    },
    scales: {},
  };

  // Add axes styling for bar/line charts
  if (config.type === 'bar' || config.type === 'line') {
    base.scales = {
      x: {
        ticks: {color: '#90a1b9', font: {family: 'Inter', size: 11}},
        grid: {color: 'rgba(51, 51, 85, 0.4)'},
      },
      y: {
        ticks: {color: '#90a1b9', font: {family: 'Inter', size: 11}},
        grid: {color: 'rgba(51, 51, 85, 0.4)'},
        beginAtZero: true,
      },
    };
    // Hide legend for single-dataset bar charts
    if (!config.data.datasets) {
      base.plugins.legend.display = false;
    }
  }

  // Merge user overrides
  if (config.options) {
    Object.assign(base, config.options);
  }

  return base;
}

/**
 * Render markdown to HTML via GitHub API.
 * Falls back to wrapping in <pre> if the request fails.
 */
async function getGitHubToken() {
  try {
    const {execFileSync} = await import('child_process');
    return execFileSync('gh', ['auth', 'token'], {encoding: 'utf-8'}).trim();
  } catch {
    return null;
  }
}

/**
 * Extract ```mermaid blocks from markdown and replace with placeholder sentinels
 * so the GitHub API (which strips code-block language info to `<pre class="notranslate">`)
 * doesn't lose them. We restore the blocks as `<div class="mermaid">...</div>` after
 * rendering, where the client-side Mermaid script in TEMPLATE picks them up.
 */
function extractMermaidBlocks(md) {
  const blocks = [];
  const stubbed = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, content) => {
    blocks.push(content.trim());
    return `@@MERMAID_BLOCK_${blocks.length - 1}@@`;
  });
  return {stubbed, blocks};
}

function restoreMermaidBlocks(html, blocks) {
  return html.replace(/@@MERMAID_BLOCK_(\d+)@@/g, (_, idx) => {
    const content = blocks[Number(idx)];
    if (content === undefined) return '';
    // Mermaid syntax doesn't include literal `<` / `>` / `&` (arrows are `-->`),
    // but escape defensively in case future diagrams use HTML-like labels.
    const escaped = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<div class="mermaid">${escaped}</div>`;
  });
}

/**
 * GitHub's markdown API renders headings without `id` attributes, so anchor
 * links in our TOC (`[Overview](#overview)`) don't scroll anywhere. We
 * post-process to inject ids derived from the heading text — same slug
 * rules GitHub uses on github.com (lowercase, drop punctuation, spaces→hyphens).
 */
function injectHeadingIds(html) {
  return html.replace(/<(h[1-6])>([\s\S]+?)<\/\1>/g, (match, tag, content) => {
    const text = content.replace(/<[^>]+>/g, '').trim();
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    if (!slug) return match;
    return `<${tag} id="${slug}">${content}</${tag}>`;
  });
}

/**
 * GitHub's markdown API strips `class` from <blockquote> for XSS safety. We
 * re-introduce callout variants by inferring from the leading <strong> label:
 *   - "Warning" / "Active debt" / "Footgun" / "Never" / "Danger" → warning
 *   - "Success" / "Complete" / "OK"                              → success
 *   - Anything else with a bold leading label                    → info
 * Blockquotes without a leading <strong> stay plain (no class injection).
 */
function injectCalloutClasses(html) {
  return html.replace(
    /<blockquote>(\s*(?:<p>)?\s*)<strong>([\s\S]+?)<\/strong>/g,
    (match, prefix, label) => {
      // Strip nested HTML (e.g. <code>immutable</code> inside <strong>) before
      // keyword matching so labels with inline code or emphasis still classify.
      const plain = label.replace(/<[^>]+>/g, '').toLowerCase();
      let variant = 'info';
      if (/warning|debt|footgun|danger|caution|never|skippable|risk/.test(plain))
        variant = 'warning';
      else if (/success|complete|ok\b|verified|✓/.test(plain)) variant = 'success';
      return `<blockquote class="callout callout-${variant}">${prefix}<strong>${label}</strong>`;
    },
  );
}

let _ghToken;
async function renderMarkdown(md) {
  const {stubbed, blocks} = extractMermaidBlocks(md);
  try {
    if (_ghToken === undefined) _ghToken = await getGitHubToken();
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    };
    if (_ghToken) headers.Authorization = `Bearer ${_ghToken}`;
    const res = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers,
      body: JSON.stringify({text: stubbed, mode: 'gfm'}),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const html = await res.text();
    return injectHeadingIds(injectCalloutClasses(restoreMermaidBlocks(html, blocks)));
  } catch (err) {
    console.warn(`  GitHub API failed (${err.message}), using raw markdown`);
    const escaped = stubbed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return restoreMermaidBlocks(`<pre>${escaped}</pre>`, blocks);
  }
}

/** Generate the index hub page linking all docs by category */
function generateIndex() {
  const allDocs = [...DOCS, ...STANDALONE];
  const categories = new Map();
  for (const doc of allDocs) {
    const cat = doc.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(doc);
  }

  const categoryIcons = {
    'Synergy Rules': '\u2728',
    'Meta & Competitive': '\uD83D\uDCCA',
    Architecture: '\u2699\uFE0F',
    'Quality & Research': '\uD83D\uDD0D',
    Project: '\uD83D\uDCCB',
  };

  let cardsHtml = '';
  for (const [cat, docs] of categories) {
    const icon = categoryIcons[cat] || '\uD83D\uDCC4';
    cardsHtml += `
      <div class="category">
        <h2>${icon} ${cat}</h2>
        <div class="card-grid">
          ${docs.map((d) => `<a class="card" href="${d.out}"><span class="card-label">${d.label}</span><span class="card-src">${d.src}</span></a>`).join('\n          ')}
        </div>
      </div>`;
  }

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inkweave Docs Hub</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #0d0d14;
      color: #e8e8e8;
      max-width: 920px;
      margin: 0 auto;
      padding: 48px 24px 80px;
      line-height: 1.65;
    }
    .hero {
      text-align: center;
      margin-bottom: 48px;
    }
    .hero h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 36px;
      color: #d4af37;
      margin: 0 0 8px;
      letter-spacing: 2px;
    }
    .hero p {
      color: #90a1b9;
      font-size: 14px;
      margin: 0;
    }
    .category { margin-bottom: 36px; }
    .category h2 {
      font-size: 16px;
      font-weight: 600;
      color: #e8e8e8;
      margin: 0 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #1a1a2e;
    }
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px 20px;
      background: #151525;
      border: 1px solid #2a2a44;
      border-radius: 8px;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
    }
    .card:hover {
      border-color: #d4af37;
      background: #1a1a2e;
      transform: translateY(-1px);
    }
    .card-label {
      font-weight: 600;
      font-size: 14px;
      color: #e8e8e8;
    }
    .card:hover .card-label { color: #d4af37; }
    .card-src {
      font-size: 11px;
      color: #555;
      font-family: 'Fira Code', monospace;
    }
    .doc-footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #1a1a2e;
      font-size: 12px;
      color: #555;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>INKWEAVE</h1>
    <p>Documentation Hub &mdash; ${allDocs.length} reports</p>
  </div>
  ${cardsHtml}
  <div class="doc-footer">Generated by Inkweave docs &mdash; local dev reference</div>
</body>
</html>`;

  writeFileSync(resolve(OUT, 'index.html'), indexHtml);
}

/** Open a file in the default browser (cross-platform) */
function openInBrowser(filePath) {
  try {
    if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', filePath], {stdio: 'ignore'});
    } else if (process.platform === 'darwin') {
      execFileSync('open', [filePath], {stdio: 'ignore'});
    } else {
      execFileSync('xdg-open', [filePath], {stdio: 'ignore'});
    }
  } catch {
    // Silently fail — user can open manually
  }
}

async function main() {
  mkdirSync(OUT, {recursive: true});

  console.log(`Generating ${DOCS.length} HTML reports into reports/\n`);

  for (const doc of DOCS) {
    const srcPath = resolve(ROOT, doc.src);
    const outPath = resolve(OUT, doc.out);
    const title = doc.label || basename(doc.src, '.md');

    process.stdout.write(`  ${doc.src} → ${doc.out} ... `);

    const md = readFileSync(srcPath, 'utf-8');
    const rawHtml = await renderMarkdown(md);
    const html = transformChartBlocks(rawHtml);
    writeFileSync(outPath, TEMPLATE(title, html));

    console.log('done');
  }

  process.stdout.write('\n  Generating index.html hub ... ');
  generateIndex();
  console.log('done');

  const indexPath = resolve(OUT, 'index.html');
  console.log(`\nOpening ${indexPath}`);
  openInBrowser(indexPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
