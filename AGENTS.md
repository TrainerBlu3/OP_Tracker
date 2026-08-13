<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git Workflow

Every feature or fix lives on its own branch. Never commit directly to `main` or `dev`.

Two long-lived branches, not one:

- `main` -- production. The GCP auto-deploy timer (`OP_TRACKER_BRANCH=main` in `deploy/op-tracker-deploy.service`) polls this and deploys it. Nothing lands here except by promoting `dev`.
- `dev` -- integration/staging. All feature/fix work branches from here and merges back here first. This is the default working base, in the IDE or anywhere else -- default to `dev`, not `main`, unless you're specifically promoting to production (see "Promoting to production" below).

### Branching

- Branch from the latest `dev`, not `main`: `git fetch origin dev && git checkout -b <type>/<short-description> origin/dev`
- Name branches `<type>/<short-description>`, kebab-case:
  - `feature/` -- new functionality (e.g. `feature/deck-export`)
  - `fix/` -- bug fixes (e.g. `fix/inventory-quantity-reset`)
  - `chore/` -- tooling, deps, config, refactors with no behavior change
  - `docs/` -- documentation only
- One branch per logical change. Don't bundle an unrelated fix into a feature branch, or vice versa.

### Concurrent AI sessions

Multiple AI coding sessions/tools (a web session, an IDE session, etc.) may be working this repo at the same time. Each session must work on its own branch -- never point two sessions at the same branch name. Before starting work, check whether the branch you're about to use already has commits you didn't make; if so, stop and confirm with the user rather than force-pushing or silently merging over it (see "Pull requests" below for how the merge into `dev` gets reconciled instead).

### Commits

- Commit messages explain *why*, not just *what* -- the diff already shows what changed.
- Create new commits for new work; don't amend or force-push over commits that are already pushed and might be in review, unless explicitly asked to.

### Before opening a PR

- `npm run lint` and `npm run build` must both pass.
- If the change touches `prisma/schema.prisma`, generate and include the migration (`npm run db:migrate`) in the same branch -- don't hand-edit `prisma/migrations/`.
- Update `README.md` if the change affects setup, env vars, scripts, or how the app is run.

### Pull requests

- Open a PR from your branch into `dev` -- set the base explicitly, never rely on whatever GitHub reports as the repository's default branch. The default branch drifted to a stale session branch once already, which silently flipped the merge direction on a couple of PRs; `dev` is the merge target regardless of what's configured as default.
- Never push directly to `main` or `dev`, even for small fixes.
- Title: short, imperative summary of the change (e.g. "Add deck export to JSON").
- Description: what changed and why, plus anything needing manual follow-up (new env vars, migrations to run, external accounts/keys to set up).
- Don't merge with a red build/lint. Don't force-push over a branch that already has review comments without flagging it.
- With multiple branches from concurrent sessions in flight, merge them into `dev` one at a time and rebase/update the others afterward, rather than merging branches into each other directly -- `dev` is the point where everyone's work gets compared and reconciled before it ever reaches production.

### Promoting to production

- Once `dev` is in a state you want live, open a separate PR from `dev` into `main`. This is the only path onto `main` -- never merge a feature branch straight into it.
- This is a deliberate, occasional action (a person deciding "ship this"), not something that happens automatically on every merge into `dev`.
