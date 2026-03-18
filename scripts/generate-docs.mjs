#!/usr/bin/env node

/**
 * Generate HTML reports from markdown documentation files.
 * Uses GitHub API for markdown rendering (requires internet).
 * Falls back to raw markdown wrapped in <pre> if offline.
 *
 * Usage: node scripts/generate-docs.mjs
 * Output: reports/*.html (gitignored)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'reports');

/** Markdown files to convert, with output filenames */
const DOCS = [
  // Synergy Rules
  { src: 'packages/synergy-engine/SHIFT_TARGET_RULE.md', out: 'SHIFT_TARGET_RULE.html' },
  { src: 'packages/synergy-engine/NAMED_COMPANIONS_RULE.md', out: 'NAMED_COMPANIONS_RULE.html' },
  { src: 'packages/synergy-engine/DISCARD_RULE.md', out: 'DISCARD_RULE.html' },
  { src: 'packages/synergy-engine/LOCATION_CONTROL_RULE.md', out: 'LOCATION_CONTROL_RULE.html' },
  { src: 'packages/synergy-engine/REMOVED_RULES.md', out: 'REMOVED_RULES.html' },
  // Architecture
  { src: 'packages/synergy-engine/SCORING_DESIGN.md', out: 'SCORING_DESIGN.html' },
  { src: 'packages/synergy-engine/README.md', out: 'synergy-engine-README.html' },
  { src: 'TECH_STACK.md', out: 'TECH_STACK.html' },
  // Quality & Research
  { src: 'docs/SYNERGY_AUDIT.md', out: 'SYNERGY_AUDIT.html' },
  { src: 'docs/UX_AUDIT.md', out: 'UX_AUDIT.html' },
  { src: 'docs/UX_REFERENCE.md', out: 'UX_REFERENCE.html' },
  { src: 'apps/web/e2e/E2E_TESTS.md', out: 'E2E_TESTS.html' },
  // Project
  { src: 'README.md', out: 'README.html' },
  { src: 'CLAUDE.md', out: 'CLAUDE.html' },
];

const TEMPLATE = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Inkweave Docs</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #0d0d14;
      color: #e8e8e8;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 24px;
      line-height: 1.6;
    }
    a { color: #d4af37; }
    a:hover { color: #ffb900; }
    .back-link {
      display: inline-block;
      margin-bottom: 24px;
      font-size: 14px;
      color: #90a1b9;
      text-decoration: none;
    }
    .back-link:hover { color: #d4af37; }
    h1, h2, h3, h4 { color: #e8e8e8; margin-top: 1.5em; margin-bottom: 0.5em; }
    h1 { color: #d4af37; border-bottom: 1px solid #333355; padding-bottom: 8px; }
    code {
      background: #1a1a2e;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #1a1a2e;
      border: 1px solid #333355;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #333355;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #1a1a2e; color: #d4af37; }
    tr:nth-child(even) { background: rgba(26, 26, 46, 0.5); }
    blockquote {
      border-left: 3px solid #d4af37;
      margin: 16px 0;
      padding: 8px 16px;
      color: #90a1b9;
    }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #333355; margin: 24px 0; }
    ul, ol { padding-left: 24px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <a class="back-link" href="index.html">&larr; Back to docs hub</a>
  ${body}
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
      body: JSON.stringify({ text: md, mode: 'gfm' }),
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
  mkdirSync(OUT, { recursive: true });

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
