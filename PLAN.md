# OP Tracker — Working Plan

A comprehensive, hand-off-ready work plan for this project. Written for AI coding agents (and humans) picking up tasks: every item is scoped to be **one branch off `dev`**, merged via PR into `dev`, per the workflow in `AGENTS.md`. Read that file first — it is binding.

Audited 2026-08-13 against `main` (post PR #13/#14). Update checkboxes and prune completed items as you go — this file is the shared backlog.

**Updated 2026-08-13:** C1–C3 shipped (PRs #16–#18, merged to `dev`, pending promotion to `main`). Workstream D moved up in the suggested order (see §8) — a manual `dev`→`main` promotion made the VM-side build's fragility concrete enough to act on now rather than waiting for a 500.

---

## 1. Project snapshot

**What it is:** A private One Piece TCG inventory tracker + deck builder. Users are admin-created (no public signup). Core value: the deck builder knows what you own.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · PostgreSQL on Neon · Prisma 7 (driver adapter `@prisma/adapter-pg`, generated client in `generated/prisma/`, gitignored) · Auth.js v5 credentials · deployed on a GCP e2-micro via systemd `--user` units + Caddy (HTTPS via sslip.io), auto-deploy timer polls `main` every 5 min.

**Key files:**

| Path | What it is |
|---|---|
| `src/lib/rules.ts` | Deck legality engine (pure functions — safest place to add logic) |
| `src/lib/blockMap.ts` | Set code → legality block (ST/EB overrides **still unfilled**) |
| `src/lib/cardApi.ts` + `src/lib/cardSync.ts` | apitcg.com client (verified schema) + sync logic |
| `src/lib/cardVariants.ts` | Art-variant grouping (`baseCardName`, group-by-stat-line) |
| `src/lib/cardRoles.ts` | Ability-keyword role tags derived from card text |
| `src/lib/price.ts` | TCGplayer price formatting |
| `src/components/CardPicker.tsx` | Search/filter grid used by deck editor + inventory |
| `src/components/CardTile.tsx` / `CardDetailModal.tsx` | Art tile w/ badges; click-through detail |
| `src/components/DeckEditorClient.tsx` | The deck editor (largest component; touch carefully) |
| `src/components/InventoryClient.tsx` | Inventory with folders, bulk move |
| `src/app/api/cards/route.ts` | Catalog search endpoint |
| `deploy/` | systemd units, deploy script, Caddyfile |
| `prisma/schema.prisma` | Schema — migrations via `npm run db:migrate`, never hand-edit |

**Formats/legality:** `Format` table drives rules (Standard bans Block 1 as of Apr 2026 rotation; rotates yearly). Blocks derive from set codes locally, not from the API.

---

## 2. Ground rules (read before building anything)

The server is an **always-free e2-micro**: 1 GB RAM, shared with a second app (QuickDash), Postgres is remote (Neon). These are hard constraints, not preferences:

1. **Compute on the client.** Stats, simulations, print layouts, sorting/grouping of already-fetched data — browser-side. New server endpoints need a reason.
2. **Never process images.** Card art is hotlinked from apitcg's CDN via plain `<img>`. No `next/image` optimization (CPU), no uploads, no thumbnailing. The two eslint warnings about `<img>` in `CardThumbnail.tsx` are accepted — do not "fix" them by switching to `next/image`.
3. **Cache what rarely changes.** The card catalog only changes on admin sync. Formats change ~yearly.
4. **The VM build is the #1 instability source.** Deploys compile on the 1 GB box. Until Workstream D fixes this, avoid dependency additions that inflate build memory, and never add a build step that shells out to heavy tooling.
5. **Follow `AGENTS.md` git workflow exactly:** branch from `dev`, PR into `dev` (base set explicitly), one logical change per branch, lint + build must pass, schema changes ship with their migration, `main` only moves by promoting `dev`.
6. **UI changes need visual verification.** Run the app against local Postgres (see README), screenshot with Playwright (Chromium is preinstalled; `executablePath: '/opt/pw-browsers/chromium'`), and confirm before merging.

---

## 3. Workstream A — Performance & responsiveness

Perceived speed matters more than raw speed here; Neon round-trips are the main latency.

- [ ] **A1. Catalog cache headers** — `S`. Add `Cache-Control: public, max-age=3600, stale-while-revalidate` (or Next `revalidate`/`unstable_cache`) to `/api/cards` and `/api/formats`; bust on admin sync (bump a version param or call `revalidatePath`). Cuts Neon round-trips on the hottest endpoint.
- [ ] **A2. Route loading states** — `S`. Add `loading.tsx` skeletons for `/inventory`, `/decks`, `/decks/[id]` (card-shaped shimmer grid). Today, navigation blocks white on Neon queries.
- [ ] **A3. Inventory scaling** — `M`. `/inventory` and its API load the *entire* collection with no pagination. Fine at 100 cards, bad at 2,000. Add incremental loading ("show 100 more") or windowing per folder group. Keep it dumb — no virtualization library unless numbers demand it.
- [ ] **A4. Trim the deck-page payload** — `M`. `/decks/[id]` server-loads the user's whole inventory on every visit just to compute `ownedByCode`. Compute the per-code sums in SQL (`groupBy`) instead of shipping every row, or fetch lazily when the inventory panel opens.
- [ ] **A5. Search pagination in the picker** — `S`. `CardPicker` caps at 60 results with no way to page. Add "load more" using the `page` param the API already supports.

## 4. Workstream B — Design & UX polish

The app is functional but spartan. Reference bars: [deckbuilder.egmanevents.com](https://deckbuilder.egmanevents.com/) (fast, dense builder UX) and [onepiece.gg](https://onepiece.gg/) (filter-rich catalog).

- [ ] **B1. Mobile pass** — `M`. Audit every page at 375px: nav tabs (may overflow with Admin tab + email), card grid columns, `CardDetailModal` (image should stack above badges — partially done), inventory slide-out panel, admin tables. Fix with Tailwind responsive classes only.
- [ ] **B2. Error surfacing** — `S`, high value. Many mutations fail *silently* (`if (!res.ok) return;` in `DecksClient`, `InventoryClient`, `DeckEditorClient`). Add a tiny toast utility (own component, ~50 lines, no library) and surface every failed mutation with a retry hint. Also: login page shows "Invalid email or password" even when the real cause is rate limiting (429) — distinguish it.
- [ ] **B3. Confirm destructive actions** — `S`. "Delete deck" and "Delete folder" fire immediately with no confirmation. Add a lightweight inline confirm (button swaps to "Really delete?" for 3s, or a small dialog). No `window.confirm`.
- [ ] **B4. Empty states with next steps** — `S`. Fresh accounts see near-blank pages. Each empty state should say what to do ("Sync the catalog from Admin", "Add cards from the picker") and link there.
- [ ] **B5. Dark-mode toggle** — `S`. Currently system-preference only (`prefers-color-scheme`). Add a manual toggle persisted in `localStorage`, applied via a class on `<html>` before paint (inline script to avoid flash).
- [ ] **B6. Keyboard & focus** — `S`. `CardDetailModal` closes on Esc but has no focus trap; picker search should submit/focus with `/` shortcut; visible focus rings on tiles.
- [ ] **B7. Document the design tokens** — `S`, docs-only. The de-facto system (zinc surfaces, color-pill map in `types.ts` `COLOR_STYLES`/`COLOR_SOLID`, badge conventions on `CardTile`) lives only in code. Write it into `AGENTS.md` so future UI work stays consistent.

## 5. Workstream C — Features (phased)

### P0 — sharpen the daily loop (all small, client-heavy)

- [x] **C1. Deck stats panel** — `S`. Cost curve (bar per cost 0–10+), type split, counter/trigger counts, color distribution. Pure client math over `deck.cards` already in memory. Put it in the collapsed-by-default area near legality. *The most-missed feature vs. both reference sites.* **Done (PR #16).**
- [x] **C2. Full search filters + sort** — `S`. Extend `/api/cards` + `CardPicker` with cost, power, counter, set, rarity filters and sort (cost / power / name / price). Columns already exist in `Card`; add DB indexes for whatever you make sortable/filterable. **Done (PR #17)** — cost/power range, rarity, and sort (cost/power/name/price) all shipped with new indexes. *Gap:* the API supports `counterMin` and `setCode` filters, but `CardPicker` never exposes UI controls for them — pick those up as a small follow-up if the gap is felt.
- [x] **C3. Deck export + duplicate** — `S`. Copy-to-clipboard decklist in the same `4xOP01-016` format the paste-import reads (round-trip guarantee: export → import must reproduce the deck). Plus a "Duplicate deck" button (server: copy deck + deckCards in one transaction). **Done (PR #18).**
- [ ] **C4. Inventory search + value** — `S`. Filter box over the collection (client-side over loaded items is fine pre-A3), per-folder card counts, collection value total from stored prices (flag "N cards unpriced" like the deck editor does).

### P1 — share it and play with it

- [ ] **C5. Public deck share links** — `M`. Add nullable `shareToken` to `Deck` (migration), a "Share" button that mints one, and a public read-only `/d/[token]` page **excluded from the auth proxy** (`src/proxy.ts`) — render leader, grid, stats; no prices/inventory data. Long cache headers; revoke = null the token.
- [ ] **C6. Test hand** — `S`. Client-only: build the 50-card multiset, Fisher–Yates shuffle, draw 5, one mulligan, then draw-one. A modal in the deck editor using existing `CardTile`s.
- [ ] **C7. Proxy print sheet** — `S–M`. Print-CSS route rendering the deck 9-per-page at real card size (63×88mm) from hotlinked images, quantity-expanded. `@media print` only; zero server work.

### P2 — collection depth

- [ ] **C8. Set completion** — `M`. Per set: distinct codes owned vs. total in catalog, as a progress tile. Two `groupBy` queries. Lives on Inventory or a small dashboard section.
- [ ] **C9. Cross-deck buylist** — `M`. Aggregate the shortfall logic (already in `DeckEditorClient`) across all the user's decks into one deduped "to acquire" list with estimated cost. Extract the shortfall math into `src/lib/` first so both callers share it.
- [ ] **C10. Inventory CSV export/import** — `S`. Export: `code,name,quantity,foilQty,folder,notes`. Import: match by code, create/merge rows, report unmatched codes. This is also the backup story.

### Explicitly out of scope

Meta decks / tier lists / community content (content-ops treadmill), multi-TCG support, deck comments/likes, real-time anything (websockets), image uploads. Don't build these.

## 6. Workstream D — Operations & infra smoothing

**D1 and D2 are next up (see §8)** — VM-side builds are the prime suspect for the outage already seen, and every `dev`→`main` promotion is currently an unattended, unverified build on a 1 GB box with no rollback.

- [ ] **D1. Build off-VM** — `M`, biggest stability win. GitHub Action on push to `main`: `npm ci && npm run build`, tar `.next/` + `generated/` + `public/` + `package.json` + `node_modules` (or run `npm ci --omit=dev` in the artifact), publish as a release/artifact. Rewrite `deploy/deploy.sh` to download + swap + restart instead of compiling. Interim cheap fix if needed sooner: add a 2 GB swap file and `NODE_OPTIONS=--max-old-space-size=768` to the build.
- [ ] **D2. Health check + rollback** — `S`. Add `/api/health` (checks a trivial DB query). `deploy.sh`: after restart, curl it with retries; on failure, `git reset --hard` to the previous rev, rebuild/restart, and log loudly. A bad deploy currently serves errors until someone notices.
- [ ] **D3. Uptime monitoring** — `S`, no code. Point a free external monitor (e.g. UptimeRobot) at `/api/health` (after D2) with email alerts. Document in `deploy/README-https.md`.
- [ ] **D4. Sync robustness** — `S`. Admin-triggered catalog sync should survive apitcg 429s (sleep + resume), report partial progress, and refuse to run concurrently with itself. Check `src/lib/cardSync.ts` for what's already handled before changing it.
- [ ] **D5. Backup note + drill** — `S`, mostly docs. Neon free tier has limited point-in-time restore. Document the restore procedure in README, and rely on C10 (CSV export) as the user-level backup. Verify a restore once.
- [ ] **D6. Journald caps** — `S`. Cap systemd `--user` journal size on the VM (`SystemMaxUse=100M`) so logs can't eat the 30 GB disk. Docs-only change in `deploy/`.

## 7. Workstream E — Code quality & build hygiene

- [ ] **E1. Tests for the rules engine** — `S`. `rules.ts`, `cardVariants.ts`, `cardRoles.ts`, `blockMap.ts` are pure functions — ideal for unit tests. Add vitest, cover: leader color matching, copy limits, banned block/code, unclassified-block warnings, variant grouping edge cases, decklist import format parsing. Wire into `npm test`.
- [ ] **E2. CI on PRs** — `S`. GitHub Action running `lint` + `build` (+ `test` after E1) on every PR. The repo rule says don't merge red — today nothing enforces it. Keep the workflow minimal (Node 22, npm cache) so it's fast on free runners.
- [ ] **E3. Fill `EXPLICIT_BLOCK_OVERRIDES`** — `S`. `blockMap.ts` returns "unclassified" for all `ST*`/`EB*`/`PRB*` sets, so those cards show legality warnings forever. Research each set's official block icon (cards physically carry a block number since the icon system) and fill the map. Cross-check a few against the synced catalog data.
- [ ] **E4. Shared mutation helper** — `M`, refactor. `DeckEditorClient` and `InventoryClient` each hand-roll optimistic updates + stale-response guards (`latestRequestId` / `latestQuantityRequest`). Extract one `useOptimisticMutation` hook; do this *with or after* B2 (toasts) since error paths change. Behavior-preserving — screenshot before/after.
- [ ] **E5. README/AGENTS drift check** — `S`, recurring. After each phase lands, verify README setup steps and env vars still match reality (e.g. port 3001, admin bootstrap instructions).

---

## 8. Suggested execution order

| Order | Items | Why this order |
|---|---|---|
| 1 | ~~C1, C2, C3~~ | **Done** — highest daily-use value, no schema risk, independent of each other |
| 2 | D1, D2 | Moved up from position 5: promoting to `main` now means the VM compiles the build live and unattended, with no rollback if it fails. Do this before the feature surface (and build weight) grows further. |
| 3 | B2, B3, A2 | Makes everything else feel finished; toasts unblock E4 |
| 4 | E1, E2 | Lock in correctness before the feature surface grows |
| 5 | C4, C5, C6 | Rounds out P1; C5 is the first schema migration in the plan |
| 6 | D3 | Once D2's health endpoint exists, point external monitoring at it |
| 7 | A3, A4, C7–C10, B1, B4–B7, E3–E5 | As capacity allows |

**Definition of done for every item:** `npm run lint` and `npm run build` pass · UI changes verified with a screenshot against local Postgres · migration included if schema changed · PR into `dev` with base set explicitly · this file's checkbox ticked in the same PR.
