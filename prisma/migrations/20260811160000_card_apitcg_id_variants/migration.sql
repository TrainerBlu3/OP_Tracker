-- Card.code used to be the unique key, which silently collapsed multiple
-- art-variant printings (same code, different art) into one row on sync.
-- Switch the unique key to apitcg.com's own per-printing id (apitcgId) so
-- every art variant gets its own row, and code becomes a plain indexed
-- (non-unique) column shared across variants.

-- 1. Add apitcgId as nullable first, since existing rows have no value yet.
ALTER TABLE "Card" ADD COLUMN "apitcgId" TEXT;

-- 2. Backfill existing rows with a unique placeholder (their own id) so the
--    column can be made NOT NULL/UNIQUE without data loss. These rows keep
--    working for any InventoryItem/DeckCard/Deck.leader that reference them
--    by Card.id; a fresh `npm run sync:cards` will insert proper rows with
--    real apitcgIds alongside them.
UPDATE "Card" SET "apitcgId" = "id" WHERE "apitcgId" IS NULL;

-- 3. Make it required and unique.
ALTER TABLE "Card" ALTER COLUMN "apitcgId" SET NOT NULL;
CREATE UNIQUE INDEX "Card_apitcgId_key" ON "Card"("apitcgId");

-- 4. Drop the old unique constraint on code, replace with a plain index.
DROP INDEX "Card_code_key";
CREATE INDEX "Card_code_idx" ON "Card"("code");
