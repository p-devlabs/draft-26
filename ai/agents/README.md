# Agents

Role-scoped agent definitions. An agent is a prompt + behavioural
contract that a tool (Claude Code, Cursor, Codex CLI, OpenCode, …)
loads to take on a specific role.

## Matrix — which agent for which task

| Task                                               | Agent                | Layer    |
| -------------------------------------------------- | -------------------- | -------- |
| Build a React component / store / form             | `dev-fe`             | generic  |
| Review an open PR for code + arch                  | `reviewer`           | generic  |
| Add tests (unit / component / E2E) or a11y checks  | `validator-qa`       | generic  |
| Implement a screen from `docs/design/handoff/`     | `design-implementer` | specific |
| A decision was made in conversation; draft the ADR | `adr-proposer`       | specific |

Generic agents handle the bulk of feature work. Specific agents kick in
for high-stakes or low-frequency flows where the cost of getting it
wrong is high. Specific agents preempt generic ones when both could
apply.

## Universal rules

Every agent in this directory operates under these constraints:

1. Read **AGENTS.md** (Non-Negotiables) before doing anything.
2. Check **`docs/decisions/`** for relevant ADRs (when this directory
   exists). Don't suggest alternatives to an Accepted decision without
   surfacing the ADR by number.
3. Follow **`ai/conventions/`** for commits, PRs, and branches.
4. Keep PRs small and reviewable. If the work doesn't fit in one
   coherent diff, propose a stacked-PR plan instead of one big change.
5. Co-author attribution: include a `Co-Authored-By:` footer naming the
   tool that drafted the change.

## File format

Each agent file follows this template:

```markdown
# <Agent name>

## Role

One paragraph.

## When to invoke

- Bullet triggers.

## When NOT to invoke

- Anti-triggers (hand off to which agent instead).

## Required reading

- File paths. Read these before touching code.

## Decision rules

- Domain-specific guidance.

## What this agent produces

- Concrete artefact.

## Hand-off

- Who picks up after.
```

## Adaptation status

These agent files were imported from a sibling Next.js + Supabase
project (vectortrips.app) and still reference framework-specific
patterns (Next.js routing, RSC, ADR numbers from that project). They
work as scaffolding today but need a pass to replace Next-isms with
Vite + React Router and to wire local ADR numbers as Draft 26's
`docs/decisions/` lands.

## Tool-specific bindings

Agents in this directory are the source of truth. Tool-specific files
(e.g. `.claude/agents/`, `.cursor/rules/*.mdc`, `opencode.json`) are
thin pointers — edit the file under `ai/agents/`, not the pointer.
