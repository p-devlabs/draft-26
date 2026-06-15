# Supabase MCP integration

The Supabase Plugin for AI Coding Agents bundles:

- **MCP server** — runtime tools the AI agent can call (list tables,
  list policies, execute SQL, generate TypeScript types, manage
  migrations, manage edge functions).
- **Agent skills** — Postgres / Supabase best-practice guidance loaded
  as context.

Official docs: https://supabase.com/docs/guides/ai-tools/plugins

## Install

The MCP server is wired in `.mcp.json` at the repo root (Claude Code
reads this directly; Cursor reads `.cursor/mcp.json` which carries
the same content; OpenCode reads `opencode.json` `mcp` field).

The package: [`@supabase/mcp-server-supabase`](https://www.npmjs.com/package/@supabase/mcp-server-supabase)

Run-time flags worth knowing:

- `--read-only` — server refuses INSERT/UPDATE/DELETE. **Default in
  our config.** Lift only when explicitly needed for a migration
  task and never for user-driven sessions.
- `--project-ref=<id>` — scopes the server to one project. Required
  to avoid accidentally querying the wrong project.

## Environment

```
SUPABASE_ACCESS_TOKEN   # Personal access token from supabase.com/dashboard/account/tokens
SUPABASE_PROJECT_REF    # Project ref from the project URL
```

Both are referenced from `.mcp.json` as `${VAR_NAME}`. Add them to
`.env.local` (gitignored) and to your shell profile if the tool
launches outside your shell context (Cursor on macOS, e.g., does
not always inherit `.env.local`).

## When agents reach for it

- `supabase-be` — schema queries, type generation, migration drafting.
- `rls-auditor` — listing policies, testing policy effects.
- `migration-runner` — applying migrations in a controlled run.

All three are reminded in their `ai/agents/<name>.md` Required
reading section.

## Security posture

- Read-only by default.
- One-project scope (`--project-ref`) prevents cross-project surprise.
- Personal access token lives in env, never in repo.
- Service-role operations (per ADR 0002) NEVER go through this MCP
  server. They go through `src/lib/supabase/admin/` audited wrappers,
  invoked from Server Actions.
