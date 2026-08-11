<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git Workflow

Every feature or fix lives on its own branch. Never commit directly to `main`.

### Branching

- Branch from the latest `main`: `git fetch origin main && git checkout -b <type>/<short-description> origin/main`
- Name branches `<type>/<short-description>`, kebab-case:
  - `feature/` -- new functionality (e.g. `feature/deck-export`)
  - `fix/` -- bug fixes (e.g. `fix/inventory-quantity-reset`)
  - `chore/` -- tooling, deps, config, refactors with no behavior change
  - `docs/` -- documentation only
- One branch per logical change. Don't bundle an unrelated fix into a feature branch, or vice versa.

### Commits

- Commit messages explain *why*, not just *what* -- the diff already shows what changed.
- Create new commits for new work; don't amend or force-push over commits that are already pushed and might be in review, unless explicitly asked to.

### Before opening a PR

- `npm run lint` and `npm run build` must both pass.
- If the change touches `prisma/schema.prisma`, generate and include the migration (`npm run db:migrate`) in the same branch -- don't hand-edit `prisma/migrations/`.
- Update `README.md` if the change affects setup, env vars, scripts, or how the app is run.

### Pull requests

- Open a PR from your branch into `main`. Never push directly to `main`, even for small fixes.
- Title: short, imperative summary of the change (e.g. "Add deck export to JSON").
- Description: what changed and why, plus anything needing manual follow-up (new env vars, migrations to run, external accounts/keys to set up).
- Don't merge with a red build/lint. Don't force-push over a branch that already has review comments without flagging it.
