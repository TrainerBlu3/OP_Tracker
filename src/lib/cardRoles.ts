/**
 * Derives ability/timing "role" tags (e.g. "On Play", "Blocker", "Trigger")
 * purely from data we already have -- the bracketed keywords OP TCG rules
 * text uses at the start of ability text (e.g. "[On Play] Draw 1 card."),
 * plus `triggerText` presence and `cardType`. No external API calls.
 *
 * The canonical vocabulary (found on the user's own tracking spreadsheet):
 * Main, On Play, Activate Main, On KO, Blocker, Banish, Rush, 1 Per Turn,
 * DON Effect, Counter, Trigger, Event, Stage.
 */

const BRACKET_PATTERN = /\[([^\]]+)\]/g;

/**
 * Maps a raw bracketed keyword (as printed on the card) to its canonical
 * role tag. This is a best-effort text heuristic, not authoritative game
 * data -- a bracket can occasionally reference a keyword conceptually
 * (e.g. "[Blocker]" inside a DON!! effect that debuffs blockers) rather
 * than declaring the card's own ability, so expect the rare false
 * positive rather than a verified rules database.
 */
function canonicalizeRole(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (t === "on play") return "On Play";
  if (t.startsWith("on k.o") || t === "on ko") return "On KO";
  if (t === "blocker") return "Blocker";
  if (t === "banish") return "Banish";
  if (t.startsWith("rush")) return "Rush";
  if (t.startsWith("once per turn") || t === "1 per turn") return "1 Per Turn";
  if (t === "counter") return "Counter";
  if (t === "trigger") return "Trigger";
  if (t.startsWith("don!!")) return "DON Effect";
  if (t.startsWith("activate")) return "Activate Main"; // "Activate: Main"
  if (t === "main") return "Main";
  return null;
}

export function extractRoles(card: {
  ability: string | null;
  triggerText: string | null;
  cardType: string;
}): string[] {
  const roles = new Set<string>();

  for (const text of [card.ability, card.triggerText]) {
    if (!text) continue;
    for (const match of text.matchAll(BRACKET_PATTERN)) {
      const role = canonicalizeRole(match[1]);
      if (role) roles.add(role);
    }
  }

  if (card.triggerText) roles.add("Trigger");
  if (card.cardType === "EVENT") roles.add("Event");
  if (card.cardType === "STAGE") roles.add("Stage");

  return [...roles].sort();
}

/** Every role tag the picker/filter UI can offer, independent of what's actually in the DB. */
export const ALL_ROLES = [
  "Main",
  "On Play",
  "Activate Main",
  "On KO",
  "Blocker",
  "Banish",
  "Rush",
  "1 Per Turn",
  "DON Effect",
  "Counter",
  "Trigger",
  "Event",
  "Stage",
] as const;
