/**
 * In-memory login attempt limiter, keyed by email. Deliberately not
 * backed by a database or Redis -- this app runs as a single always-on
 * Node process (systemd service), so an in-memory Map is enough and
 * avoids adding infrastructure for a personal-scale app. Resets on
 * process restart, which is an acceptable trade-off at this scale.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // failures older than this don't count toward the limit
const LOCKOUT_MS = 15 * 60 * 1000; // how long a lockout lasts once triggered

interface Entry {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number | null;
}

const attempts = new Map<string, Entry>();

function normalizeKey(email: string): string {
  return email.trim().toLowerCase();
}

export function checkLoginRateLimit(email: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const key = normalizeKey(email);
  const entry = attempts.get(key);
  if (!entry) return { allowed: true };

  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }

  // Lockout expired, or the failure window elapsed without hitting the
  // limit -- either way this key's history no longer matters.
  if ((entry.lockedUntil && entry.lockedUntil <= now) || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(email: string): void {
  const key = normalizeKey(email);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: null });
    return;
  }

  entry.failures += 1;
  if (entry.failures >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

export function resetLoginRateLimit(email: string): void {
  attempts.delete(normalizeKey(email));
}
