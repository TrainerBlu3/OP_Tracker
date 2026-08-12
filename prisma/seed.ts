/**
 * Dev-only seed data: a handful of hand-typed placeholder cards (real card
 * names, illustrative-only stats -- NOT guaranteed to match official values)
 * so the app is usable before you've run `npm run sync:cards` against a real
 * source. Real syncs upsert by `code` and will overwrite these.
 *
 * Also seeds the two standard Formats. `bannedBlocks: [1]` on "Standard"
 * reflects the official rotation as found via web search in Aug 2026 (Block
 * 1 = OP01-OP04, rotated out of Standard on 2026-04-01). Verify this is
 * still current before relying on it -- see src/lib/blockMap.ts.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { getBlockForSetCode } from "../src/lib/blockMap";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SAMPLE_CARDS = [
  {
    code: "OP01-001",
    name: "Monkey.D.Luffy",
    cardType: "LEADER" as const,
    colors: ["Red"],
    power: 5000,
    life: 5,
    attribute: "Strike",
    family: "Straw Hat Crew",
    setCode: "OP01",
    setName: "Romance Dawn",
    rarity: "L",
  },
  {
    code: "OP01-016",
    name: "Roronoa Zoro",
    cardType: "CHARACTER" as const,
    colors: ["Red"],
    cost: 1,
    power: 3000,
    counter: 1000,
    family: "Straw Hat Crew",
    setCode: "OP01",
    setName: "Romance Dawn",
    rarity: "C",
  },
  {
    code: "OP01-024",
    name: "Nami",
    cardType: "CHARACTER" as const,
    colors: ["Red"],
    cost: 1,
    power: 1000,
    counter: 2000,
    family: "Straw Hat Crew",
    setCode: "OP01",
    setName: "Romance Dawn",
    rarity: "C",
  },
  {
    code: "OP02-013",
    name: "Trafalgar Law",
    cardType: "CHARACTER" as const,
    colors: ["Green"],
    cost: 4,
    power: 5000,
    counter: 1000,
    family: "Heart Pirates",
    setCode: "OP02",
    setName: "Paramount War",
    rarity: "SR",
  },
  {
    code: "OP01-119",
    name: "Gum-Gum Red Roc",
    cardType: "EVENT" as const,
    colors: ["Red"],
    cost: 2,
    family: "Straw Hat Crew",
    setCode: "OP01",
    setName: "Romance Dawn",
    rarity: "SR",
  },
  {
    code: "OP01-025",
    name: "Baratie",
    cardType: "STAGE" as const,
    colors: ["Red"],
    cost: 1,
    setCode: "OP01",
    setName: "Romance Dawn",
    rarity: "C",
  },
  {
    code: "OP06-002",
    name: "Charlotte Katakuri",
    cardType: "LEADER" as const,
    colors: ["Purple"],
    power: 5000,
    life: 5,
    attribute: "Special",
    family: "Big Mom Pirates",
    setCode: "OP06",
    setName: "Wings of the Captain",
    rarity: "L",
  },
  {
    code: "OP06-013",
    name: "Charlotte Linlin",
    cardType: "CHARACTER" as const,
    colors: ["Purple"],
    cost: 8,
    power: 9000,
    counter: 0,
    family: "Big Mom Pirates",
    setCode: "OP06",
    setName: "Wings of the Captain",
    rarity: "SR",
  },
];

async function main() {
  for (const card of SAMPLE_CARDS) {
    // "seed-" prefix keeps these placeholder ids from ever colliding with a
    // real apitcg.com numeric id once a real sync runs.
    const apitcgId = `seed-${card.code}`;
    await prisma.card.upsert({
      where: { apitcgId },
      create: { ...card, apitcgId, block: getBlockForSetCode(card.setCode) },
      update: { ...card, apitcgId, block: getBlockForSetCode(card.setCode) },
    });
  }

  await prisma.format.upsert({
    where: { name: "Standard" },
    create: {
      name: "Standard",
      description: "Official tournament format. Keeps the 3 most recent blocks legal; rotates each April.",
      deckSize: 50,
      maxCopiesPerCard: 4,
      bannedBlocks: [1],
      bannedCardCodes: [],
    },
    update: {
      description: "Official tournament format. Keeps the 3 most recent blocks legal; rotates each April.",
      bannedBlocks: [1],
    },
  });

  await prisma.format.upsert({
    where: { name: "Extra Regulation" },
    create: {
      name: "Extra Regulation",
      description: "All cards legal except the ban list.",
      deckSize: 50,
      maxCopiesPerCard: 4,
      bannedBlocks: [],
      bannedCardCodes: [],
    },
    update: {},
  });

  console.log(`Seeded ${SAMPLE_CARDS.length} sample cards and 2 formats.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
