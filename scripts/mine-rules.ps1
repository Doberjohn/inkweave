#!/usr/bin/env powershell
# Headless wrapper for the weekly rule-candidate miner (issue #359).
#
# Invoked by Windows Task Scheduler. Runs Claude Code non-interactively against the
# /mine-rules skill with a SCOPED tool allowlist: read-only data access plus the one
# prefixed issue-create command. It cannot edit engine source, commit, or push — those
# tools are simply not in the allowlist, so an unattended run is bounded to "read +
# open one issue".
#
# Targets Windows PowerShell 5.1 (powershell.exe) — pwsh 7 is not assumed.
#
# Manual run / smoke test:
#   powershell -NoProfile -File scripts/mine-rules.ps1            # real run (may open an issue)
#   powershell -NoProfile -File scripts/mine-rules.ps1 -DryRun    # draft only, opens nothing
#
# stdout is teed to reports/mine-rules-last-run.log (reports/ is git-ignored) so the
# result of an unattended run is inspectable after the fact.

param([switch]$DryRun)

# 'Stop' for setup so a bad path fails loudly...
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$prompt = if ($DryRun) { '/mine-rules dry-run' } else { '/mine-rules' }

# --allowedTools is variadic (<tools...>), so each entry is passed as its own arg.
# gh issue create is matched WITH its required SKILL_APPROVED=1 prefix (the
# issue-create-guard hook also enforces that prefix), so an un-prefixed create is
# denied by both the allowlist and the hook.
$allowed = @(
  'Read', 'Glob', 'Grep', 'Write',
  'Bash(pnpm mine-rules)',
  'Bash(pnpm build:engine)',
  'Bash(node:*)',
  'Bash(gh issue list:*)',
  'Bash(gh label list:*)',
  'Bash(SKILL_APPROVED=1 gh issue create:*)'
)

$log = Join-Path $repoRoot 'reports\mine-rules-last-run.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

# ...but 'Continue' around the native call: Windows PowerShell 5.1 wraps a native
# command's stderr lines as NativeCommandError records, which would otherwise abort
# under 'Stop' even on a clean exit. Empty stdin ($null |) skips claude's 3s
# "no stdin" wait. stderr stays on the host stream (not merged) to avoid the wrap.
$ErrorActionPreference = 'Continue'
$null | claude -p $prompt --allowedTools $allowed | Tee-Object -FilePath $log
exit $LASTEXITCODE
