import { useMemo } from "react";
import BrandIcon from "@/components/BrandIcon";
import { cn } from "@/lib/utils";

type Cell = { date: string; count: number };

export function StreakHeatmap({
  data,
  weeks = 53,
  target,
  streak,
  fullWidth = false,
  className,
}: {
  data: Cell[];
  weeks?: number;
  target?: number;
  streak?: number;
  fullWidth?: boolean;
  className?: string;
}) {
  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of data) m.set(d.date, (m.get(d.date) ?? 0) + d.count);
    return m;
  }, [data]);

  const today = startOfDay(new Date());
  const firstWeekStart = startOfWeek(addDays(today, -(weeks - 1) * 7));

  const grid: Array<Array<Cell | null>> = Array.from({ length: weeks }, (_, weekIndex) => {
    const weekStart = addDays(firstWeekStart, weekIndex * 7);
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = addDays(weekStart, dayIndex);
      if (day > today) return null;
      const iso = toLocalDateKey(day);
      return { date: iso, count: map.get(iso) ?? 0 };
    });
  });

  const monthLabels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  let activeDays = 0;
  let totalCount = 0;
  grid.forEach((col, i) => {
    const first = col.find((c) => c) ?? null;
    if (!first) return;
    const m = new Date(first.date).getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col: i, label: new Date(first.date).toLocaleString(undefined, { month: "short" }) });
      lastMonth = m;
    }
    for (const cell of col) {
      if (!cell || cell.count <= 0) continue;
      activeDays++;
      totalCount += cell.count;
    }
  });

  const targetValue = Math.max(target ?? 0, 1);
  const legendStops = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className={cn(
        fullWidth
          ? "flex w-full flex-col gap-3 rounded-lg border border-border/70 bg-muted/15 p-4"
          : "inline-flex flex-col gap-3 min-w-fit border border-border bg-card p-4",
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-bold">
            <BrandIcon className="h-5 w-5" />
            {(streak ?? 0) > 0
              ? `${streak}-day streak${(streak ?? 0) >= 5 ? ", keep going" : ""}`
              : "Start your streak today"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {activeDays > 0
              ? `${activeDays} active days · ${totalCount.toLocaleString()} replies`
              : "No replies in this range yet"}
          </div>
        </div>

        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `2rem repeat(${weeks}, 0.7rem)` }}>
          <span />
          {monthLabels.map((m, i) => (
            <span key={i} className="text-[10px] text-muted-foreground" style={{ gridColumn: m.col + 2 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          <div className="grid gap-[3px] text-[10px] text-muted-foreground leading-[0.7rem] pt-[0.1rem] w-8">
            {["Sun", "", "Tue", "", "Thu", "", "Sat"].map((label, index) => (
              <span key={`${label}-${index}`} className="h-[0.7rem]">
                {label}
              </span>
            ))}
          </div>
          {grid.map((col, colIndex) => (
            <div key={colIndex} className="grid gap-[3px]" style={{ gridTemplateRows: "repeat(7, 0.7rem)" }}>
              {col.map((c, rowIndex) =>
                c == null ? (
                  <span key={rowIndex} />
                ) : (
                  <span
                    key={rowIndex}
                    title={`${c.date} · ${c.count} / ${targetValue}`}
                    className="h-[0.7rem] w-[0.7rem] border border-border/40"
                    style={cellStyle(c.count, targetValue)}
                  />
                ),
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground" title="Opacity = % of daily reply target met that day">
          <span>0</span>
          {legendStops.map((stop, i) => (
            <span key={i} className="h-3 w-3 border border-border/40" style={{ backgroundColor: `color-mix(in oklab, var(--primary) ${(alphaForRatio(stop)*100).toFixed(1)}%, transparent)` }} />
          ))}
          <span>≥{targetValue}</span>
        </div>
      </div>
    </div>
  );
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function alphaForRatio(ratio: number) {
  if (ratio <= 0) return 0.08;
  if (ratio <= 0.25) return 0.3;
  if (ratio <= 0.5) return 0.5;
  if (ratio <= 0.75) return 0.72;
  if (ratio < 1) return 0.88;
  return 1;
}

function cellStyle(count: number, target: number) {
  if (count <= 0) return { backgroundColor: `color-mix(in oklab, var(--primary) 8%, transparent)` };
  const ratio = Math.min(count / target, 1);
  return { backgroundColor: `color-mix(in oklab, var(--primary) ${(alphaForRatio(ratio)*100).toFixed(1)}%, transparent)` };
}
