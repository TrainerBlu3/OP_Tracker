/**
 * Pulls card data from apitcg.com's One Piece TCG endpoint and upserts it
 * into the local Card table (matched by `code`). `block` is computed
 * locally from `setCode`, not taken from the API -- see src/lib/blockMap.ts.
 *
 * Usage:
 *   npm run sync:cards -- --sample        Print one raw card and exit
 *                                          (use this first to check that
 *                                          normalizeCard() in cardApi.ts
 *                                          actually matches the real schema)
 *   npm run sync:cards -- --set=OP01      Sync a single set
 *   npm run sync:cards                    Sync everything
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { fetchCardPage, normalizeCard } from "../src/lib/cardApi";
import { getBlockForSetCode } from "../src/lib/blockMap";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    sample: args.includes("--sample"),
    set: args.find((a) => a.startsWith("--set="))?.split("=")[1],
  };
}

async function main() {
  const { sample, set } = parseArgs();

  if (sample) {
    const page = await fetchCardPage({ page: 1, limit: 1 });
    console.log(JSON.stringify(page.data?.[0] ?? page, null, 2));
    return;
  }

  const setFilter = set?.toUpperCase();
  let page = 1;
  let upserted = 0;

  while (true) {
    const result = await fetchCardPage({ page, limit: 100 });
    const cards = result.data ?? [];
    if (cards.length === 0) break;

    for (const raw of cards) {
      const normalized = normalizeCard(raw);
      if (setFilter && normalized.setCode.toUpperCase() !== setFilter) continue;
      const block = getBlockForSetCode(normalized.setCode);
      await prisma.card.upsert({
        where: { code: normalized.code },
        create: { ...normalized, block },
        update: { ...normalized, block },
      });
      upserted += 1;
    }

    console.log(`Page ${page}: synced ${cards.length} cards (total so far: ${upserted})`);

    const totalPages = result.totalPages ?? (cards.length < 100 ? page : page + 1);
    if (page >= totalPages) break;
    page += 1;
  }

  console.log(`Done. Upserted ${upserted} cards.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
