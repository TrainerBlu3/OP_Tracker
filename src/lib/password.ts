import bcrypt from "bcryptjs";
import crypto from "crypto";

const SALT_ROUNDS = 12;

/** 16 random bytes -> 32 hex chars (128 bits of entropy), single-use and forced-change on first login. */
export function generateTempPassword(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
