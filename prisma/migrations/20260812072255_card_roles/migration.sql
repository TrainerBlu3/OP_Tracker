-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
