# OP Tracker

A One Piece TCG inventory tracker and deck builder.

- **Inventory** -- track how many copies of each card you own.
- **Deck Builder** -- build 50-card decks with a Leader, filtered/checked against configurable format rules (e.g. "Standard" bans Block 1).

Stack: Next.js (App Router, TypeScript) + PostgreSQL + Prisma + Auth.js (credentials login) + Tailwind CSS.

## How legality works

Format rules live in the `Format` table (`prisma/seed.ts` seeds "Standard" and "Extra Regulation"), not hardcoded -- edit them in the DB (or via Prisma Studio: `npm run db:studio`) as official rules rotate.

Each card's `block` is computed locally from its set code (`src/lib/blockMap.ts`), not pulled from the card data API, since "block" is tournament-rule metadata rather than raw card data. The current mapping (OP01-OP04 = Block 1, OP05-OP08 = Block 2, etc., with Standard banning the oldest block each April) was confirmed via web search in **August 2026** -- verify it's still current, and fill in `EXPLICIT_BLOCK_OVERRIDES` for ST-\*/EB-\* sets, before relying on it.

Deck validation logic (`src/lib/rules.ts`) checks: exactly one Leader, exactly `deckSize` main-deck cards, max copies per card, main-deck cards share a color with the Leader, and no banned blocks/card codes. It runs both in the deck editor UI (for live feedback) and can be reused server-side.

## Card data source

`scripts/sync-cards.ts` pulls cards from **apitcg.com**'s `/api/products` endpoint (filtered to `tcg=one-piece&type=card`) into the local `Card` table.

> **Before relying on this**: the base URL, endpoint shape, auth header, and pagination in `src/lib/cardApi.ts` are confirmed against apitcg.com's own docs. The individual card object's field names, though, are still best-effort -- this was built in a sandbox that couldn't reach apitcg.com/api.apitcg.com at all, so there was no way to fetch a real sample response. Run the sample check below and fix `normalizeCard()` in that file if anything's off.

1. Register (free) at https://apitcg.com/register, grab your key from the Developer Platform, and set `APITCG_API_KEY` in `.env`.
2. Sanity-check the schema: `npm run sync:cards -- --sample` prints one raw card as JSON.
3. Compare it to `normalizeCard()` in `src/lib/cardApi.ts` and adjust field names if they don't match.
4. Run a full sync: `npm run sync:cards` (or `-- --set=OP01` to test one set first).

Until you've done this, `npm run db:seed` loads a handful of hand-typed placeholder cards so the app is usable (see the disclaimer at the top of `prisma/seed.ts` -- their stats aren't guaranteed accurate and get overwritten by a real sync).

## Local development

Prerequisites: Node 22+, a PostgreSQL database.

```bash
cp .env.example .env
# fill in DATABASE_URL, AUTH_SECRET (npx auth secret), AUTH_URL=http://localhost:3000

npm install
npm run db:migrate      # creates tables
npm run db:seed         # sample cards + Standard/Extra Regulation formats
npm run dev
```

Visit http://localhost:3000, register an account, and go to Inventory or Deck Builder.

## Deploying to your GCP VM

This repo ships an auto-deploy setup: a systemd timer on the server polls the `main` branch every 5 minutes and redeploys when it changes -- so `git push` is all you need day to day.

On the VM (as the user that will run the app, not root):

```bash
# 1. Prerequisites: Node 22+, PostgreSQL reachable from this VM, git.

# 2. Clone into ~/op-tracker (the path the units below assume)
git clone <your-repo-url> ~/op-tracker
cd ~/op-tracker

# 3. Configure
cp .env.example .env
# fill in DATABASE_URL (pointing at your Postgres), AUTH_SECRET, and
# AUTH_URL=https://your-domain-or-ip, APITCG_API_KEY if you're syncing cards

# 4. First-time build
npm ci
npm run db:migrate:deploy
npm run build

# 5. Install the systemd --user units
mkdir -p ~/.config/systemd/user
cp deploy/op-tracker.service deploy/op-tracker-deploy.service deploy/op-tracker-deploy.timer \
   ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now op-tracker
systemctl --user enable --now op-tracker-deploy.timer

# 6. Let user services run without an active login session
sudo loginctl enable-linger "$USER"
```

From then on, pushing to `main` gets picked up within 5 minutes: `deploy/deploy.sh` fetches, and if there are new commits, hard-resets the checkout to match `origin/main`, reinstalls dependencies, runs migrations, rebuilds, and restarts the `op-tracker` service. Logs: `journalctl --user -u op-tracker-deploy -f` and `journalctl --user -u op-tracker -f`.

Put a reverse proxy (nginx/Caddy) in front of port 3000 for TLS if you're exposing this beyond your own network -- that's not included here.

Change the polling interval by editing `OnUnitActiveSec` in `deploy/op-tracker-deploy.timer`, and the deploy branch via `OP_TRACKER_BRANCH` in `deploy/op-tracker-deploy.service`.

## Project structure

```
prisma/schema.prisma      Data model: User, Card, InventoryItem, Deck, DeckCard, Format
prisma/seed.ts            Sample cards + default formats
src/lib/rules.ts          Deck legality engine (shared by UI + reusable server-side)
src/lib/blockMap.ts       Set code -> legality block
src/lib/cardApi.ts        apitcg.com client + normalizer
scripts/sync-cards.ts     Card catalog sync script
src/app/inventory/        Inventory tab
src/app/decks/            Deck builder tab
deploy/                   systemd units + poll-and-deploy script for the GCP VM
```
