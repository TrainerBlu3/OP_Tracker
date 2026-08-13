/**
 * Prints which database the current DATABASE_URL actually points to, so
 * you can confirm you're on the `dev` Neon branch before testing/breaking
 * things, rather than trusting you remembered correctly. Doesn't touch
 * anything -- read-only.
 *
 * Usage: npm run db:whoami
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Update these if you ever recreate a branch and get a new hostname --
// Neon shows the current one in the branch's Connection Details page.
const KNOWN_HOSTS: Record<string, string> = {
  "ep-bold-tooth-a6dk9i9e": "production",
  "ep-aged-lab-a6s9ag85": "dev",
};

const url = process.env.DATABASE_URL ?? "";
const host = url.match(/@([^/]+)\//)?.[1] ?? "";
const hostPrefix = Object.keys(KNOWN_HOSTS).find((h) => host.startsWith(h));
const branchLabel = hostPrefix ? KNOWN_HOSTS[hostPrefix] : "UNRECOGNIZED -- not one of the known branches below";

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`\nBranch: ${branchLabel.toUpperCase()}`);
  console.log(`Host:   ${host || "(DATABASE_URL not set or unparseable)"}\n`);

  if (branchLabel === "production") {
    console.log("!! This is PRODUCTION. Anything you do here is real. !!\n");
  }

  const [cardCount, userCount, deckCount, inventoryCount] = await Promise.all([
    prisma.card.count(),
    prisma.user.count(),
    prisma.deck.count(),
    prisma.inventoryItem.count(),
  ]);
  console.log(`cards: ${cardCount} | users: ${userCount} | decks: ${deckCount} | inventory rows: ${inventoryCount}`);
}

main().finally(() => prisma.$disconnect());
