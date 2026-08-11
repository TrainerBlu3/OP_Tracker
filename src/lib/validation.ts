import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(80).optional(),
});

export const inventoryUpsertSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.number().int().min(0),
  foilQty: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
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
