import { minutesToTime } from "./format";
import type { OpeningHour } from "./types";
import { WEEKDAYS } from "./types";

export type DayLine = {
  weekday: number;
  label: string;
  ranges: OpeningHour[];
  text: string;
};

export function weekLines(hours: OpeningHour[]): DayLine[] {
  return WEEKDAYS.map((label, i) => {
    const weekday = i + 1;
    const ranges = hours
      .filter((h) => h.weekday === weekday)
      .sort((a, b) => a.open_min - b.open_min);
    return {
      weekday,
      label,
      ranges,
      text: ranges.length
        ? ranges
            .map((r) => `${minutesToTime(r.open_min)} – ${minutesToTime(r.close_min)}`)
            .join(" · ")
        : "Fermé",
    };
  });
}

export function isOpenNow(
  hours: OpeningHour[],
  weekday: number,
  minutes: number,
  closedToday: boolean,
): boolean {
  if (closedToday) return false;
  return hours.some(
    (h) => h.weekday === weekday && minutes >= h.open_min && minutes < h.close_min,
  );
}
