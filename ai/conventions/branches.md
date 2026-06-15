# Branch conventions

## Format

```
<type>/<short-kebab-description>
```

- `type` — the same set as commit types (see [commits.md](./commits.md)),
  restricted to those that make sense for a branch:
  `feat | fix | chore | docs | refactor | perf | test | ci`.
- `description` — 2–6 kebab-case words. Optimised for legibility in
  `git branch` output, not search.

## Examples

```
feat/admin-route-group
fix/map-popup-iata-fallback
chore/test-infrastructure
docs/adr-0011-ui-primitives
refactor/profile-loader-to-rsc
```

## What to avoid

- Personal prefixes (`rafael/...`). The branch is project-scoped, not
  person-scoped.
- Ticket numbers in the branch name. Cross-reference belongs in the
  commit body / PR description.
- Long suffixes. `feat/admin-route-group-with-zustand-and-supabase` →
  `feat/admin-route-group`.
- `wip/...`, `tmp/...`, `experiment/...` for branches you intend to
  push. Keep those local; push under the real name when ready.

## Stacked branches

Stacked branches use the same shape; the dependency is encoded by the
base branch, not by the name:

```
chore/prettier-and-cleanup            (base: main)
chore/test-infrastructure             (base: chore/prettier-and-cleanup)
chore/state-and-supabase              (base: chore/test-infrastructure)
docs/design-handoff                   (base: chore/state-and-supabase)
```

See [prs.md](./prs.md) for how the stack is managed in GitHub.

## When a branch is done

- After merge, delete it locally and on the remote. GitHub does this
  automatically on squash-merge with the default setting.
- If you keep the branch for follow-up work, rebase onto the new
  `main` first.
