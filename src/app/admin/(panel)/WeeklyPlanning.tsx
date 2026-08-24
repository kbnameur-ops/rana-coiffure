"use client";

import { useState } from "react";
import { TimeSelect } from "./TimeSelect";
import { WEEKDAYS } from "@/lib/types";

export type DayInput = {
  open: boolean;
  ranges: [{ from: number; to: number } | null, { from: number; to: number } | null];
};

/**
 * Grille hebdomadaire partagée par les horaires du salon et le planning
 * d'un coiffeur : une case par jour, une plage, et une coupure optionnelle.
 */
export function WeeklyPlanning({
  days,
  fallbackNote,
}: {
  days: DayInput[];
  fallbackNote?: string;
}) {
  const [open, setOpen] = useState(days.map((d) => d.open));
  const [split, setSplit] = useState(days.map((d) => d.ranges[1] !== null));

  return (
    <ul className="divide-y divide-ink/10">
      {WEEKDAYS.map((label, i) => {
        const weekday = i + 1;
        const day = days[i];
        return (
          <li key={label} className="flex flex-wrap items-center gap-4 p-4">
            <label className="flex w-40 items-center gap-3">
              <input
                type="checkbox"
                name={`open_${weekday}`}
                checked={open[i]}
                onChange={(e) =>
                  setOpen((prev) =>
                    prev.map((v, k) => (k === i ? e.target.checked : v)),
                  )
                }
                className="h-4 w-4 accent-black"
              />
              <span className="font-semibold">{label}</span>
            </label>

            {open[i] ? (
              <div className="flex flex-wrap items-center gap-3">
                <Pair
                  weekday={weekday}
                  suffix="a"
                  from={day.ranges[0]?.from ?? 600}
                  to={day.ranges[0]?.to ?? 1170}
                />

                {split[i] ? (
                  <>
                    <span className="text-clay">et</span>
                    <Pair
                      weekday={weekday}
                      suffix="b"
                      from={day.ranges[1]?.from ?? 840}
                      to={day.ranges[1]?.to ?? 1170}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSplit((p) => p.map((v, k) => (k === i ? false : v)))
                      }
                      className="text-xs uppercase tracking-wider text-clay underline"
                    >
                      Retirer la coupure
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setSplit((p) => p.map((v, k) => (k === i ? true : v)))
                    }
                    className="text-xs uppercase tracking-wider text-clay underline"
                  >
                    + Coupure déjeuner
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sm text-clay">
                {fallbackNote ?? "Fermé"}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Pair({
  weekday,
  suffix,
  from,
  to,
}: {
  weekday: number;
  suffix: "a" | "b";
  from: number;
  to: number;
}) {
  return (
    <span className="flex items-center gap-2">
      <TimeSelect name={`from_${weekday}_${suffix}`} defaultValue={from} kind="start" />
      <span className="text-clay">→</span>
      <TimeSelect name={`to_${weekday}_${suffix}`} defaultValue={to} kind="end" />
    </span>
  );
}
