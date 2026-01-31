#!/usr/bin/env node
/**
 * Updates the README.md with current test coverage percentage.
 * Run after: pnpm vitest run --coverage
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../../..');
const readmePath = resolve(rootDir, 'README.md');
const coveragePath = resolve(__dirname, '../coverage/coverage-summary.json');

function getBadgeColor(pct) {
  if (pct >= 90) return 'brightgreen';
  if (pct >= 80) return 'green';
  if (pct >= 70) return 'yellowgreen';
  if (pct >= 60) return 'yellow';
  if (pct >= 50) return 'orange';
  return 'red';
}

function updateReadme() {
  if (!existsSync(coveragePath)) {
    console.error('Coverage summary not found. Run: pnpm --filter web vitest run --coverage');
    process.exit(1);
  }

  const coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
  const totalLines = coverage.total.lines.pct;
  const totalStatements = coverage.total.statements.pct;
  const totalBranches = coverage.total.branches.pct;
  const totalFunctions = coverage.total.functions.pct;

  const color = getBadgeColor(totalLines);
  const badge = `![Coverage](https://img.shields.io/badge/coverage-${totalLines}%25-${color})`;

  let readme = readFileSync(readmePath, 'utf8');

  // Update or add badge after title
  const badgeRegex = /!\[Coverage\]\(https:\/\/img\.shields\.io\/badge\/coverage-[\d.]+%25-\w+\)/;

  if (badgeRegex.test(readme)) {
    readme = readme.replace(badgeRegex, badge);
  } else {
    // Add badge after the first heading
    readme = readme.replace(
      /^(# .+\n)/,
      `$1\n${badge}\n`
    );
  }

  // Update or add coverage table
  const coverageTable = `
| Metric | Coverage |
|--------|----------|
| Statements | ${totalStatements}% |
| Branches | ${totalBranches}% |
| Functions | ${totalFunctions}% |
| Lines | ${totalLines}% |`;

  const tableRegex = /\| Metric \| Coverage \|[\s\S]*?\| Lines \| [\d.]+% \|/;

  if (tableRegex.test(readme)) {
    readme = readme.replace(tableRegex, coverageTable.trim());
  }

  writeFileSync(readmePath, readme);
  console.log(`✓ Updated README.md with coverage: ${totalLines}% lines`);
}

updateReadme();
