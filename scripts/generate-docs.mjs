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
import {mkdirSync, readFileSync, writeFileSync} from 'fs';
import {basename, resolve} from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'reports');

/** Markdown files to convert, with output filenames and categories */
const DOCS = [
  // Synergy Rules
  {src: 'packages/synergy-engine/SHIFT_TARGET_RULE.md', out: 'SHIFT_TARGET_RULE.html', category: 'Synergy Rules', label: 'Shift Targets'},
  {src: 'packages/synergy-engine/NAMED_COMPANIONS_RULE.md', out: 'NAMED_COMPANIONS_RULE.html', category: 'Synergy Rules', label: 'Named Companions'},
  {src: 'packages/synergy-engine/DISCARD_RULE.md', out: 'DISCARD_RULE.html', category: 'Synergy Rules', label: 'Discard'},
  {src: 'packages/synergy-engine/LOCATION_CONTROL_RULE.md', out: 'LOCATION_CONTROL_RULE.html', category: 'Synergy Rules', label: 'Location Control'},
  {src: 'packages/synergy-engine/REMOVED_RULES.md', out: 'REMOVED_RULES.html', category: 'Synergy Rules', label: 'Removed Rules'},
  // Architecture
  {src: 'packages/synergy-engine/SCORING_DESIGN.md', out: 'SCORING_DESIGN.html', category: 'Architecture', label: 'Scoring Design'},
  {src: 'packages/synergy-engine/README.md', out: 'synergy-engine-README.html', category: 'Architecture', label: 'Synergy Engine'},
  // Quality & Research
  {src: 'docs/SYNERGY_AUDIT.md', out: 'SYNERGY_AUDIT.html', category: 'Quality & Research', label: 'Synergy Audit'},
  {src: 'docs/UX_AUDIT.md', out: 'UX_AUDIT.html', category: 'Quality & Research', label: 'UX Audit'},
  {src: 'docs/UX_REFERENCE.md', out: 'UX_REFERENCE.html', category: 'Quality & Research', label: 'UX Reference'},
  // Project
  {src: 'docs/TECH_STACK.md', out: 'TECH_STACK.html', category: 'Project', label: 'Tech Stack'},
  {src: 'docs/V1_LAUNCH_PLAN.md', out: 'V1_LAUNCH_PLAN.html', category: 'Project', label: 'v1.0 Launch Plan'},
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
  </style>
</head>
<body>
  <a class="back-link" href="index.html">&larr; Back to docs hub</a>
  ${body}
  <div class="doc-footer">Generated by Inkweave docs — local dev reference</div>
</body>
</html>`;

/**
 * Render markdown to HTML via GitHub API.
 * Falls back to wrapping in <pre> if the request fails.
 */
async function renderMarkdown(md) {
  try {
    const res = await fetch('https://api.github.com/markdown', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({text: md, mode: 'gfm'}),
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return await res.text();
  } catch (err) {
    console.warn(`  GitHub API failed (${err.message}), using raw markdown`);
    const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre>${escaped}</pre>`;
  }
}

/** Generate the index hub page linking all docs by category */
function generateIndex() {
  const categories = new Map();
  for (const doc of DOCS) {
    const cat = doc.category || 'Other';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat).push(doc);
  }

  const categoryIcons = {
    'Synergy Rules': '\u2728',
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
    <p>Documentation Hub &mdash; ${DOCS.length} reports</p>
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
    const html = await renderMarkdown(md);
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
