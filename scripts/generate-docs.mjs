#!/usr/bin/env node

/**
 * Generate HTML reports from markdown documentation files.
 * Uses GitHub API for markdown rendering (requires internet).
 * Falls back to raw markdown wrapped in <pre> if offline.
 *
 * Usage: node scripts/generate-docs.mjs
 * Output: reports/*.html (gitignored)
 */

import {readFileSync, writeFileSync, mkdirSync} from 'fs';
import {resolve, basename} from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'reports');

/** Markdown files to convert, with output filenames */
const DOCS = [
  // Synergy Rules
  {src: 'packages/synergy-engine/SHIFT_TARGET_RULE.md', out: 'SHIFT_TARGET_RULE.html'},
  {src: 'packages/synergy-engine/NAMED_COMPANIONS_RULE.md', out: 'NAMED_COMPANIONS_RULE.html'},
  {src: 'packages/synergy-engine/DISCARD_RULE.md', out: 'DISCARD_RULE.html'},
  {src: 'packages/synergy-engine/LOCATION_CONTROL_RULE.md', out: 'LOCATION_CONTROL_RULE.html'},
  {src: 'packages/synergy-engine/REMOVED_RULES.md', out: 'REMOVED_RULES.html'},
  // Architecture
  {src: 'packages/synergy-engine/SCORING_DESIGN.md', out: 'SCORING_DESIGN.html'},
  {src: 'packages/synergy-engine/README.md', out: 'synergy-engine-README.html'},
  {src: 'TECH_STACK.md', out: 'TECH_STACK.html'},
  // Quality & Research
  {src: 'docs/SYNERGY_AUDIT.md', out: 'SYNERGY_AUDIT.html'},
  {src: 'docs/UX_AUDIT.md', out: 'UX_AUDIT.html'},
  {src: 'docs/UX_REFERENCE.md', out: 'UX_REFERENCE.html'},
  {src: 'apps/web/e2e/E2E_TESTS.md', out: 'E2E_TESTS.html'},
  // Project
  {src: 'README.md', out: 'README.html'},
  {src: 'CLAUDE.md', out: 'CLAUDE.html'},
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

async function main() {
  mkdirSync(OUT, {recursive: true});

  console.log(`Generating ${DOCS.length} HTML reports into reports/\n`);

  for (const doc of DOCS) {
    const srcPath = resolve(ROOT, doc.src);
    const outPath = resolve(OUT, doc.out);
    const title = basename(doc.src, '.md');

    process.stdout.write(`  ${doc.src} → ${doc.out} ... `);

    const md = readFileSync(srcPath, 'utf-8');
    const html = await renderMarkdown(md);
    writeFileSync(outPath, TEMPLATE(title, html));

    console.log('done');
  }

  console.log(`\nOpen reports/index.html in your browser.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
