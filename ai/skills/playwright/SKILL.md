---
name: playwright
description: Use this skill when writing, debugging, or refactoring Playwright tests. Consult the upstream guides for locators, fixtures, network mocking, visual regression, CI integration, page object patterns, and migration from Cypress / Selenium. Skill is most useful for E2E specs in e2e/ and for one-off Playwright scripts.
source: https://github.com/testdino-hq/playwright-skill
pinned: 2026-05-17
upstream-packs: core, ci, pom, migration, playwright-cli
---

Vendored reference to testdino-hq's Playwright skill. The upstream
ships 70+ guides organized into five packs (`core`, `ci`, `pom`,
`migration`, `playwright-cli`). Rather than copy every guide here,
this entry points at the upstream and records the opinions we adopt.

## When to invoke

- Writing a new Playwright spec under `e2e/`.
- Debugging a flaky or failing spec.
- Refactoring locators, fixtures, or test data setup.
- Configuring Playwright CI matrix, sharding, or reporters.
- Migrating a one-off Cypress / Selenium test (when that situation
  arises).

## Adopted opinions

From the upstream, plus our project context:

- **Fixtures over Page Objects.** The skill's `pom` pack documents
  both; we default to fixtures (`test.extend(...)`) for shared setup.
  POM stays an option for screens with rich interaction surfaces.
- **Locators by accessibility, not by DOM.** Prefer `getByRole`,
  `getByLabel`, `getByText`. `data-testid` is the last resort — same
  policy as our component tests (see
  `docs/reference/tests.md`).
- **`await expect(locator).toBe<…>()` not `await expect(locator).toBeVisible`
  without await.** The `eslint-plugin-playwright` rules in our
  `eslint.config.mjs` catch the common variants.
- **Auth state setup once per project** via storage state, not per
  spec. Eligible for a `__auth.setup.ts` project when Supabase auth
  lands.
- **Network mocking sparingly.** For E2E, we prefer hitting real
  surfaces (the prod build via `npm run preview`) over mocking. MSW
  is for unit / component tests.
- **Critical-flow ceiling.** Per ADR 0008, the critical-flow list
  IS the Playwright scope. Don't add E2E specs for non-critical
  flows; cover those in RTL.

## Hand-off

- New E2E spec → `validator-qa` agent.
- E2E spec reveals an a11y issue → `accesslint` skill for runtime
  audit + `validator-qa` for assertion in the spec.
- Configuration change (workers, sharding) → `dev-fe` plus a CI
  workflow update if applicable.

## Reaching upstream content

When you need a specific guide (e.g. "how to handle file uploads"
or "CircleCI parallel sharding"), browse:

- https://github.com/testdino-hq/playwright-skill
- Specifically the `core/`, `ci/`, `pom/`, `migration/`,
  `playwright-cli/` directories.

The upstream content is large; we deliberately do not vendor every
guide. The skill's `source` URL stays current via the `pinned`
date — when upstream ships a significant rewrite, bump and re-read.
