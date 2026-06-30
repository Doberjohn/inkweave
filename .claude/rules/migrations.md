---
description: Supabase migration workflow for Inkweave (MCP-driven, no CLI).
paths:
  - "supabase/migrations/**"
---

# Supabase migration conventions

When editing a file under `supabase/migrations/`:

- Use the Supabase **MCP tools** for all DB operations; do NOT use the local Supabase CLI.
- Workflow after a schema change:
  1. `apply_migration` (via MCP)
  2. verify with `list_tables` / `execute_sql`
  3. `generate_typescript_types` (regenerate types)
  4. `get_advisors` (security check)
