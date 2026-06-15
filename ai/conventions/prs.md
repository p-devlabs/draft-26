# Pull request conventions

## Title

The PR title follows the same shape as a commit subject:

```
<type>(<scope>): <subject>
```

See [commits.md](./commits.md) for the type / scope tables and subject
phrasing. The squash-merge commit reuses this title verbatim, so it
must stand alone.

If the PR is part of a stack, do **not** put `[1/N]` in the title — put
it in the description (see below). Title stays clean.

## Body

Use this template (the GitHub PR template at
`.github/pull_request_template.md` mirrors it):

```markdown
## Summary

- 1–3 bullets describing what changed and why
- Reference ADRs / issues that motivate the change

## Test plan

- Concrete commands and outcomes the reviewer can replicate
- E.g. `npm run check` passes locally; `npx playwright test --list` lists N specs

## Risk Checklist

- [ ] Public/private data boundary unchanged or documented
- [ ] Auth/RLS impact reviewed
- [ ] CSP/third-party script impact reviewed
- [ ] i18n keys added or not needed
- [ ] Accessibility impact checked
- [ ] Analytics/audit/logging impact checked
- [ ] Feature flags have owner and removal date, if used

## Notes

- Anything that doesn't fit above: follow-up TODOs, known gaps,
  reviewer asks
```

## Stacked PRs

When a change is too large or too uneven to review as one PR, stack
small PRs end-to-end. Each PR's base branch is the previous PR's branch
(not `main`).

Conventions:

- Branch names mirror the eventual merge order: `chore/prettier`,
  `chore/test-infrastructure`, etc. Don't number them — the dependency
  is encoded in the base branch, not the name.
- The Summary section explicitly states the stack position:
  > Stack info: 2nd of 4. Base is `chore/prettier-and-cleanup` (#18).
  > Merge that first so the diff stays clean.
- Each PR's `Test plan` only validates that PR's slice, not the whole
  stack.
- The top-of-stack PR's description links to all downstream PRs.

When a base PR merges:

- Rebase the next PR onto `main` (`git rebase --onto main <old-base>`).
- GitHub will update the diff once the new base is pushed.
- Don't force-push to a base that other people are reviewing — wait for
  acknowledgement first.

## Risk Checklist — how to use it

The Risk Checklist is not paperwork. Each tickbox maps to a real
project constraint:

- **Public/private data boundary** — ADRs 0001/0002/0003. Any change
  to what ships in the public bundle or what an unauthenticated viewer
  can see needs an explicit note.
- **Auth/RLS impact** — new ownership boundary? new policy? new
  service-role wrapper? Must have a contract test that fails on the
  pre-change policy.
- **CSP** — adding a third-party script, font, or origin needs a CSP
  update in `middleware.js` and a note in the PR.
- **i18n** — see ADR 0006. New user-visible strings need stable keys,
  not concatenation.
- **Accessibility** — see ADR 0006. Interactive features need keyboard
  and screen-reader paths, not just mouse.
- **Analytics/audit/logging** — service-role operations must be
  audited (ADR 0002). Public events need a key per ADR 0005.
- **Feature flags** — flags without owner + removal date rot. Either
  fill both in or don't ship the flag.

A ticked box without an explanation in the Summary or Notes is worse
than an unticked box — the latter at least flags a gap. Untick boxes
that don't apply and say so; don't tick to make the diff look clean.

## When NOT to open a PR

- Trivial inline fixes can wait for the next batch — don't open three
  PRs for three typos in `docs/`.
- WIP that isn't ready for review goes on a branch without a PR until
  it is. Draft PRs are fine if reviewers actually want early eyes.

## Review expectations

Reviewers should explain, in order:

1. Whether the change matches the PR's stated intent.
2. Whether the Risk Checklist is honest.
3. Whether the test plan is sufficient for the risk.
4. Whether the code is the simplest change that meets (1)–(3).

Style nits are last and optional.
