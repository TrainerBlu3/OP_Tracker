import { z } from "zod";

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  active: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const inventoryUpsertSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(0),
  foilQty: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
  folderId: z.string().nullable().optional(),
});

export const inventoryItemUpdateSchema = z.object({
  folderId: z.string().nullable(),
});

export const inventoryFolderCreateSchema = z.object({
  name: z.string().min(1).max(60),
});

export const inventoryBulkFolderAssignSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(500),
  folderId: z.string().nullable(),
});

export const deckCreateSchema = z.object({
  name: z.string().min(1).max(100),
  formatId: z.string().min(1).optional(),
});

export const deckUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  leaderId: z.string().nullable().optional(),
  formatId: z.string().nullable().optional(),
});

export const deckCardUpsertSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(0).max(4),
});

export const deckImportSchema = z.object({
  text: z.string().min(1),
});
