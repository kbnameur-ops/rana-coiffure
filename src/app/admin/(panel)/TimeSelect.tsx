"use client";

import { minutesToTime } from "@/lib/format";
import { PLANNING_MIN, PLANNING_MAX } from "@/lib/types";

const STEP = 15;

function options(from: number, to: number) {
  const out: number[] = [];
  for (let m = from; m <= to; m += STEP) out.push(m);
  return out;
}

/**
 * Les plages se règlent de 08h00 à minuit. Minuit vaut 1440 minutes, valeur
 * qu'un `<input type="time">` ne sait pas représenter — d'où la liste.
 */
export function TimeSelect({
  name,
  defaultValue,
  kind,
}: {
  name: string;
  defaultValue: number;
  kind: "start" | "end";
}) {
  const values =
    kind === "start"
      ? options(PLANNING_MIN, PLANNING_MAX - STEP)
      : options(PLANNING_MIN + STEP, PLANNING_MAX);

  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="border border-ink/20 bg-white px-3 py-2 lining-nums tabular-nums"
    >
      {values.map((m) => (
        <option key={m} value={m}>
          {minutesToTime(m)}
        </option>
      ))}
    </select>
  );
}
