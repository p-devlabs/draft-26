# ai/skills/

Skills and MCP integrations the project has adopted, and a curated map
of what we considered, deferred, or rejected.

## Source of truth

Each skill we adopt lives under `ai/skills/<name>/` with a `SKILL.md`
(Claude Code skill format with YAML frontmatter) or a `README.md` (for
plugins / CLIs that aren't loaded as a context skill). Tool-specific
bindings (`.claude/skills/`, `.cursor/rules/`, `opencode.json`,
`.mcp.json`) are thin pointers — edit content here, not in the
pointers.

Adoption policy is recorded in **ADR 0014 — Skills & MCP pack**.

## Active pack

| Slot                  | Source                                                            | Mechanism                                                   |
| --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| Supabase MCP          | `@supabase/mcp-server-supabase` (npm)                             | `.mcp.json` at root + `.cursor/mcp.json`                    |
| spec-driven           | `addyosmani/agent-skills/skills/spec-driven-development` (GitHub) | Vendored: `ai/skills/spec-driven/SKILL.md`                  |
| Playwright            | `testdino-hq/playwright-skill` (GitHub)                           | Vendored (pointer): `ai/skills/playwright/SKILL.md`         |
| React best practices  | `vercel-labs/agent-skills/react-best-practices`                   | Vendored (pointer): `ai/skills/vercel-react/SKILL.md`       |
| Composition patterns  | `vercel-labs/agent-skills/composition-patterns`                   | Vendored (pointer): `ai/skills/vercel-composition/SKILL.md` |
| Web design guidelines | `vercel-labs/agent-skills/web-design-guidelines`                  | Vendored (pointer): `ai/skills/vercel-web-design/SKILL.md`  |
| impeccable.style      | `npx impeccable` (CLI) + `PRODUCT.md` / `DESIGN.md` at root       | Install-via-tool: `ai/skills/impeccable/README.md`          |
| AccessLint            | `accesslint/claude-marketplace`                                   | Install-via-tool: `ai/skills/accesslint/README.md`          |

Browsing the **anthropics/skills** upstream catalog
([github.com/anthropics/skills](https://github.com/anthropics/skills))
is encouraged when a new need emerges — adopt selectively via the
same vendoring pattern.

## Deferred (issue stub exists)

| Slot                       | Trigger                                     | Issue |
| -------------------------- | ------------------------------------------- | ----- |
| Sentry MCP                 | Sentry SDK setup                            | #27   |
| browser-use                | First AI-driven exploration use case        | #36   |
| webapp-testing (Anthropic) | Fallback if Playwright skill misses a niche | #37   |

## Skipped (with reasons)

| Item                                               | Why skipped                                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `anthropics/skills/frontend-design`                | Overlaps with `design-implementer` agent + impeccable; we translate handoffs, rarely generate fresh |
| `nextlevelbuilder/ui-ux-pro-max`                   | Heavy CLI install + asset library we don't need (we have a handoff); overlap with impeccable        |
| `claude-code-templates code-reviewer`              | Direct overlap with our `ai/agents/reviewer.md` (Opus, project-specific rules)                      |
| `remotion/agent-skills`                            | Not in scope (programmatic video framework)                                                         |
| `obra/superpowers-skills`                          | Archived 2025-10-27, read-only — risk of staleness                                                  |
| `vercel-labs/agent-skills/react-native-guidelines` | Not mobile                                                                                          |
| `vercel-labs/agent-skills/react-view-transitions`  | Will revisit when we adopt View Transitions API                                                     |
| `vercel-labs/agent-skills/vercel-deploy-claimable` | Already deploying to Vercel without needing claimable flow                                          |

## Reference reading (not installed, browse occasionally)

- [spencerpauly/awesome-cursor-skills](https://github.com/spencerpauly/awesome-cursor-skills) — curated list of Cursor skills
- [mcpdirectory.app/blog/best-cursor-skills-frontend-developers-2026](https://mcpdirectory.app/blog/best-cursor-skills-frontend-developers-2026) — curation article
- [anthropics/skills](https://github.com/anthropics/skills) — official Anthropic skill catalog

## How to add a new skill

1. Decide where it sits: vendor (SKILL.md copied/pointed locally) or
   install-via-tool (CLI / marketplace).
2. Create `ai/skills/<name>/SKILL.md` (vendored) or
   `ai/skills/<name>/README.md` (install-via-tool) with:
   - Frontmatter (name, description) for SKILL.md
   - Source URL with pinned commit / version when possible
   - One paragraph summary of what it does
   - When to invoke it
   - Hand-off to which agent role
3. Add tool bindings:
   - `.claude/skills/<name>/SKILL.md` — thin wrapper pointing at
     `ai/skills/<name>/SKILL.md`
   - `.cursor/rules/<NNN>-skill-<name>.mdc` — manual rule
   - `opencode.json` — add path to `instructions[]`
4. Update this README's tables.
5. If the skill changes how agents work, update the relevant agent
   file's "Required reading" section.

## How to use a skill from a session

- **Claude Code**: `@<skill-name>` in a prompt, or rely on auto-routing
  via the description field in frontmatter.
- **Cursor**: `@rule-name` (where rule name is the MDC file's stem) or
  enable a rule via the rules panel.
- **Codex CLI**: reference the file in your prompt: "read
  `ai/skills/spec-driven/SKILL.md` and follow it for this task."
- **OpenCode**: skills referenced in `opencode.json instructions[]`
  are loaded automatically.
