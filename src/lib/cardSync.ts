/**
 * Shared full-catalog sync loop, used by both scripts/sync-cards.ts (CLI)
 * and the admin "Sync card catalog" button (src/app/api/admin/sync-cards).
 * Kept out of scripts/ so the API route doesn't need its own PrismaClient
 * instance -- it reuses the app's existing one from @/lib/db.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { fetchCardPage, normalizeCard } from "@/lib/cardApi";
import { getBlockForSetCode } from "@/lib/blockMap";

export interface CardSyncResult {
  upserted: number;
  pages: number;
}

export async function syncAllCards(prisma: PrismaClient): Promise<CardSyncResult> {
  let page = 1;
  let upserted = 0;

  while (true) {
    const result = await fetchCardPage({ page, limit: 100 });
    const cards = result.data ?? [];
    if (cards.length === 0) break;

    for (const raw of cards) {
      const normalized = normalizeCard(raw);
      const block = getBlockForSetCode(normalized.setCode);
      await prisma.card.upsert({
        where: { apitcgId: normalized.apitcgId },
        create: { ...normalized, block },
        update: { ...normalized, block },
      });
      upserted += 1;
    }

    const totalPages = result.totalPages ?? (cards.length < 100 ? page : page + 1);
    if (page >= totalPages) return { upserted, pages: page };
    page += 1;
  }

  return { upserted, pages: page };
}
