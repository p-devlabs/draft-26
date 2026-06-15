# AccessLint

Runtime DOM accessibility audit plugin for Claude Code. Complements
our static `eslint-plugin-jsx-a11y` (which catches structural issues
at lint time) by auditing the rendered DOM against WCAG 2.2.

Source: https://github.com/accesslint/claude-marketplace
Maintainer: AccessLint.

## What it provides

- `accesslint:audit` skill with two modes:
  - **Report mode** — sweeps the scope, detects patterns across
    components, produces a prioritized written report. No edits.
  - **Fix mode** — applies mechanical fixes verbatim and leaves
    TODOs for visual / contextual issues that need human judgement.
- Wraps several underlying MCP tools for live-DOM audits, HTML
  analysis, diffing, and rule discovery.
- Auto-launches Chrome in the background for live-page auditing.
  Also supports authenticated sessions via browser MCPs.

## Install

```bash
claude plugin marketplace add accesslint/claude-marketplace
```

Or wire manually via Claude Code config pointing at the plugin
directory.

## When agents reach for it

- `validator-qa` — when a new UI surface lands, run AccessLint in
  report mode against the prod build to catch runtime-only issues
  (focus management, dynamic ARIA states, contrast under actual
  rendered theme).
- `reviewer` — when reviewing a PR with significant UI changes, run
  AccessLint as a second pass after our static rules.

## Relationship to other a11y machinery

- `eslint-plugin-jsx-a11y` (strict, in `eslint.config.mjs`) — static,
  catches structural a11y at lint time. Fast feedback, runs in CI.
- `@axe-core/playwright` — _deferred_ per the Playwright skill notes.
  Integrates axe into E2E specs. When adopted, this and AccessLint
  overlap somewhat (both run axe-equivalent rules). AccessLint is
  on-demand by an agent; axe-in-Playwright is automated per spec.
- AccessLint — interactive, agent-driven, includes Fix mode that
  ESLint cannot. Best for "review this whole feature for a11y" or
  "find pattern violations across the codebase."

## Workflow

1. New UI component or page lands.
2. Run `accesslint:audit` in report mode against the route or
   component preview.
3. Triage findings: blockers fixed in the same PR; non-blockers
   filed as follow-up issues.
4. For mechanical issues (missing `alt`, incorrect roles, etc.),
   switch to Fix mode and review the diff.
