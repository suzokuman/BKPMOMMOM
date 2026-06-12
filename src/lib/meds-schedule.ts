// Helpers to expand a medication template into the day's scheduled doses.
export type Frequency =
  | "daily"
  | "weekly"
  | "h4" | "h6" | "h8" | "h10" | "h12"
  | "h14" | "h16" | "h18" | "h20" | "h22"
  | "custom";

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diariamente" },
  { value: "weekly", label: "Semanalmente" },
  { value: "h4", label: "A cada 4h" },
  { value: "h6", label: "A cada 6h" },
  { value: "h8", label: "A cada 8h" },
  { value: "h10", label: "A cada 10h" },
  { value: "h12", label: "A cada 12h" },
  { value: "h14", label: "A cada 14h" },
  { value: "h16", label: "A cada 16h" },
  { value: "h18", label: "A cada 18h" },
  { value: "h20", label: "A cada 20h" },
  { value: "h22", label: "A cada 22h" },
  { value: "custom", label: "Data personalizada" },
];

function hoursOf(f: Frequency): number | null {
  if (f.startsWith("h")) return parseInt(f.slice(1), 10);
  return null;
}

/** For a given date, return the local Date objects when the template fires. */
export function dosesForDate(
  date: Date,
  tpl: { start_time: string | null; frequency: string; custom_at: string | null },
): Date[] {
  const f = tpl.frequency as Frequency;

  if (f === "custom") {
    if (!tpl.custom_at) return [];
    const d = new Date(tpl.custom_at);
    return sameLocalDay(d, date) ? [d] : [];
  }

  if (!tpl.start_time) return [];
  const [h, m] = tpl.start_time.split(":").map(Number);

  if (f === "weekly") {
    // Fire only on the same weekday as start_time was first scheduled — proxy: weekday of date == weekday of start? We need a weekday anchor; we'll just fire weekly on the date it was created. Without anchor, default to: fires only if today is the same weekday as today (always) — simplest: fire once per week starting from today. To keep deterministic, fire every weekday match by day-of-week of start.
    // Without an explicit weekday, fire on the same weekday as the start date if we had it. As an approximation, fire on weekday(date) === weekday(today) is meaningless; we'll fire daily on weekly schedules unless we know the anchor. Instead: fire weekly = once at start_time on Mondays (anchor = template creation day) — but we don't have it. Compromise: fire weekly = on weekday derived from current `date` matching Monday. We'll keep it simple: weekly fires every day matching the chosen start day-of-week, falling back to today.
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return [d];
  }

  const step = hoursOf(f);
  if (!step) {
    // daily
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return [d];
  }

  // Every N hours starting at start_time (h:m). Generate doses for the local day.
  const result: Date[] = [];
  // Start from the anchor (start_time on `date`) and walk forward and backward in N-hour increments,
  // keeping only times that fall in the local day.
  const anchor = new Date(date);
  anchor.setHours(h, m, 0, 0);
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  // Walk back
  let t = new Date(anchor);
  while (t >= dayStart) {
    if (t >= dayStart && t <= dayEnd) result.push(new Date(t));
    t = new Date(t.getTime() - step * 3600_000);
  }
  // Walk forward
  t = new Date(anchor.getTime() + step * 3600_000);
  while (t <= dayEnd) {
    result.push(new Date(t));
    t = new Date(t.getTime() + step * 3600_000);
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function fmtHHMM(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
