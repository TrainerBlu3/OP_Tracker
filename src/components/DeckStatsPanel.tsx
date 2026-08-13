import { type DeckStats } from "@/lib/deckStats";
import { COLOR_SOLID } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: "Character",
  EVENT: "Event",
  STAGE: "Stage",
};

export function DeckStatsPanel({ stats }: { stats: DeckStats }) {
  if (stats.totalCards === 0) {
    return <p className="mt-2 text-sm text-zinc-500">Add cards to the main deck to see stats.</p>;
  }

  const maxCostCount = Math.max(...stats.costCurve, 1);

  return (
    <div className="mt-4 flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-medium">Cost curve</h3>
        <div className="mt-2 flex items-end gap-1.5">
          {stats.costCurve.map((count, cost) => (
            <div key={cost} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t bg-zinc-400 dark:bg-zinc-600"
                  style={{ height: count === 0 ? 0 : `${(count / maxCostCount) * 100}%` }}
                  title={`${count} at cost ${cost}`}
                />
              </div>
              <span className="text-xs text-zinc-500">{cost === 10 ? "10+" : cost}</span>
              <span className="text-xs text-zinc-400">{count || ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <h3 className="text-sm font-medium">Card type</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {Object.entries(stats.typeCounts).map(([type, count]) => (
              <li key={type} className="flex items-center justify-between gap-4">
                <span className="text-zinc-500">{TYPE_LABELS[type] ?? type}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium">Color distribution</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {Object.entries(stats.colorCounts).map(([color, count]) => (
              <li key={color} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR_SOLID[color] ?? "bg-zinc-400"}`} />
                <span className="text-zinc-500">{color}</span>
                <span className="ml-auto">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-medium">Ability timing</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            <li className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Counter</span>
              <span>{stats.counterCount}</span>
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-zinc-500">Trigger</span>
              <span>{stats.triggerCount}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
