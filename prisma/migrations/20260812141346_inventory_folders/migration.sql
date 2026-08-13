-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "folderId" TEXT;

-- CreateTable
CREATE TABLE "InventoryFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryFolder_userId_name_key" ON "InventoryFolder"("userId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_folderId_idx" ON "InventoryItem"("folderId");

-- AddForeignKey
ALTER TABLE "InventoryFolder" ADD CONSTRAINT "InventoryFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "InventoryFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
