# Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) with
project-specific scopes.

## Format

```
<type>(<scope>): <subject>

[optional body explaining WHY, wrapped at ~72 cols]

[optional footer(s)]
```

- `type` — required, lower-case, one of the list below.
- `scope` — optional, lower-case, one of the list below (or new with a
  short comment in the PR description).
- `subject` — imperative mood, lower-case, no trailing period, ≤ 72
  chars.
- Body explains **why** (not _what_ — the diff already says that).
- Footers carry `Refs: #N`, `Closes: #N`, `BREAKING CHANGE: ...`, and
  `Co-Authored-By: ...`.

## Types

| Type       | When                                                          |
| ---------- | ------------------------------------------------------------- |
| `feat`     | New user-facing behavior or new capability                    |
| `fix`      | Bug fix that changes behavior                                 |
| `chore`    | Repo or toolchain change with no user-visible effect          |
| `docs`     | Documentation only (README, ADRs, playbooks, `ai/`)           |
| `refactor` | Code change that neither fixes a bug nor adds a feature       |
| `perf`     | Performance improvement                                       |
| `test`     | Adding or fixing tests, no production code change             |
| `ci`       | CI configuration only (`.github/workflows/`)                  |
| `build`    | Build-system / dependency change                              |
| `style`    | Formatting only (run by Prettier; rarely a standalone commit) |
| `revert`   | Reverts a prior commit (reference its SHA in the body)        |

## Scopes

Start with this set. Add new scopes as the codebase grows — propose them
in the PR description so reviewers can spot drift.

| Scope     | Covers                                                     |
| --------- | ---------------------------------------------------------- |
| `public`  | Public profile surface (`src/app/(public)/`)               |
| `admin`   | Admin surface (`src/app/(admin)/`)                         |
| `auth`    | Sign-in / sign-up / session / Supabase Auth                |
| `rls`     | Supabase RLS policies and ownership boundary code          |
| `data`    | Data layer: repositories, services, schemas                |
| `flights` | Flight log domain                                          |
| `profile` | Profile domain                                             |
| `map`     | Leaflet / great-circle / atlas                             |
| `i18n`    | Translation keys, locale wiring                            |
| `a11y`    | Accessibility-focused change                               |
| `csp`     | Content Security Policy, security headers                  |
| `deps`    | Dependency add / update / remove                           |
| `lint`    | ESLint / Prettier config                                   |
| `test`    | Jest / Playwright / MSW config (not the tests themselves)  |
| `ci`      | Workflow files                                             |
| `adr`     | Architecture Decision Records                              |
| `design`  | `docs/design/` and design-token mapping                    |
| `ai`      | `ai/`, `.claude/`, `.cursor/rules/`, Codex/OpenCode config |

If a change spans many scopes, drop the scope rather than chain them.
`fix(public,admin): ...` is not allowed; prefer `fix: ...` and explain
the breadth in the body.

## Subject phrasing

| Good                                           | Bad                         |
| ---------------------------------------------- | --------------------------- |
| `feat(auth): persist session via Supabase SSR` | `Added session persistence` |
| `fix(map): handle missing IATA in popup`       | `bug fix`                   |
| `docs(adr): 0010 — TanStack Query for…`        | `Update docs`               |
| `chore(deps): add @supabase/ssr`               | `add some dependencies`     |

## Body — what belongs there

- The _why_. The user need, the bug symptom, the constraint that forces
  the choice.
- The non-obvious trade-off. The alternative considered and rejected.
- Pointers to ADRs or issues that motivate the change.

What does **not** belong in the body:

- A restatement of the diff.
- "This commit adds X and Y" — that is the subject's job.

## Footers

- `Refs: #N` — related issue (no auto-close).
- `Closes: #N` — closes the issue on merge.
- `BREAKING CHANGE: <description>` — required when shipping a breaking
  change; also bumps the type to `feat!:` or `fix!:` per Conventional
  Commits.
- `Co-Authored-By: Name <email>` — for pair / AI contributions.

## Co-authoring with AI

When an AI agent (Claude Code, Cursor, Codex, OpenCode, ...) drafted
the change, add a `Co-Authored-By:` footer naming the tool. Keep the
review responsibility on the human author — the footer is attribution,
not endorsement.

## Examples

```
feat(admin): scaffold (admin) route group with auth gate

Adds an empty (admin) segment that requires a signed-in user. Falls
back to /sign-in for anonymous visitors. No admin pages yet — this is
the route-group skeleton ADR 0007 calls for.

Refs: #34
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

```
fix(rls): tighten profile_memberships SELECT to owner

The policy let viewer rows leak the owner_id of profiles the viewer
no longer has access to. Switching to `WITH CHECK` plus an explicit
owner_id = auth.uid() resolves the leak. Adds a Jest contract test
that fails on the previous policy.

Closes: #41
```

```
chore(deps): drop unused topojson-atlas

Was pulled in by an earlier map iteration; not referenced since the
manifest move to world-atlas. Saves ~120kB from the public bundle.
```

## Local gates (pre-commit / pre-push)

The repo installs git hooks via `simple-git-hooks` on `npm ci` /
`npm install` (postinstall script). The hooks are:

- **pre-commit** — `lint-staged` runs Prettier + ESLint `--fix` on
  staged files. Fast (<5s typical).
- **pre-push** — `npm run typecheck`. Catches type failures before
  CI runs them.

**Bypass policy**: `--no-verify` and `SKIP_SIMPLE_GIT_HOOKS=1` are
allowed when justified. They are not silent — the bypass should be
mentioned in the PR description so the reviewer can spot the
intentional skip. Habitual bypassing is a smell; if the hook keeps
catching issues, fix the issue, don't dodge.

Hooks **do not** replace CI. CI runs the full `check` script. The
hooks exist to shorten the local feedback loop and to keep PRs
clean of trivial formatting churn.
