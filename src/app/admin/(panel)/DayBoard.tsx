import Link from "next/link";
import { formatPrice, minutesToTime } from "@/lib/format";
import type { Booking, OpeningHour, Staff, StaffHour } from "@/lib/types";

const PX_PAR_MINUTE = 1.5;

const STATUS: Record<string, string> = {
  confirmed: "border-ink/25 bg-white",
  done: "border-emerald-500/40 bg-emerald-50",
  no_show: "border-red-400/50 bg-red-50",
  pending: "border-gold bg-gold/12",
};

const ETIQUETTE: Record<string, string> = {
  confirmed: "",
  done: "Honoré",
  no_show: "Manqué",
  pending: "À valider",
};

/**
 * Planning du jour : une colonne par coiffeur, le temps qui descend.
 * Les rendez-vous sont posés à leur minute exacte, leur hauteur vaut leur
 * durée — un chevauchement se voit donc immédiatement.
 */
export function DayBoard({
  date,
  team,
  bookings,
  hours,
  staffHours,
}: {
  date: string;
  team: Staff[];
  bookings: Booking[];
  hours: OpeningHour[];
  staffHours: StaffHour[];
}) {
  const plages = [
    ...hours.map((h) => [h.open_min, h.close_min] as const),
    ...staffHours.map((h) => [h.open_min, h.close_min] as const),
    ...bookings.map((b) => [b.start_min, b.end_min] as const),
  ];
  const debut = plages.length
    ? Math.floor(Math.min(...plages.map((p) => p[0])) / 60) * 60
    : 9 * 60;
  const fin = plages.length
    ? Math.ceil(Math.max(...plages.map((p) => p[1])) / 60) * 60
    : 20 * 60;
  const hauteur = (fin - debut) * PX_PAR_MINUTE;

  const heures: number[] = [];
  for (let m = debut; m <= fin; m += 60) heures.push(m);

  const colonnes = [
    ...team.map((m) => ({ id: m.id, nom: m.name, role: m.role_label })),
    ...(bookings.some((b) => b.staff_id === null)
      ? [{ id: null as number | null, nom: "Sans coiffeur", role: "" }]
      : []),
  ];

  if (colonnes.length === 0)
    return (
      <p className="mt-8 border border-ink/12 bg-white p-8 text-ink/60">
        Aucun coiffeur enregistré et aucun rendez-vous ce jour-là.
      </p>
    );

  return (
    <div className="mt-8 overflow-x-auto border border-ink/12 bg-white">
      <div className="flex min-w-max lg:min-w-full">
        {/* échelle des heures */}
        <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-ink/12 bg-white">
          <div className="h-14 border-b border-ink/12" />
          <div className="relative" style={{ height: hauteur }}>
            {heures.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-1/2 text-xs lining-nums tabular-nums text-mute"
                style={{ top: (m - debut) * PX_PAR_MINUTE }}
              >
                {minutesToTime(m)}
              </span>
            ))}
          </div>
        </div>

        {colonnes.map((colonne) => {
          const duJour = bookings.filter((b) => b.staff_id === colonne.id);
          const travail =
            colonne.id === null
              ? []
              : staffHours.filter((h) => h.staff_id === colonne.id);

          return (
            <div
              key={colonne.id ?? "sans"}
              className="min-w-56 flex-1 border-r border-ink/12 last:border-r-0"
            >
              <div className="flex h-14 flex-col justify-center border-b border-ink/12 px-3">
                <p className="truncate font-semibold">{colonne.nom}</p>
                {colonne.role && (
                  <p className="truncate text-xs text-mute">{colonne.role}</p>
                )}
              </div>

              <div className="relative" style={{ height: hauteur }}>
                {/* plages travaillées, en fond */}
                {travail.map((h) => (
                  <div
                    key={h.id}
                    className="absolute inset-x-0 bg-shell/70"
                    style={{
                      top: (h.open_min - debut) * PX_PAR_MINUTE,
                      height: (h.close_min - h.open_min) * PX_PAR_MINUTE,
                    }}
                  />
                ))}

                {/* lignes des heures */}
                {heures.map((m) => (
                  <div
                    key={m}
                    className="absolute inset-x-0 border-t border-ink/8"
                    style={{ top: (m - debut) * PX_PAR_MINUTE }}
                  />
                ))}

                {duJour.map((b) => (
                  <Link
                    key={b.id}
                    href={`/admin/rendez-vous?du=${date}&au=${date}&q=${b.ref}`}
                    className={`absolute inset-x-1 overflow-hidden rounded-sm border-l-2 px-2 py-1 text-xs shadow-sm transition-shadow hover:shadow-md ${STATUS[b.status] ?? STATUS.confirmed}`}
                    style={{
                      top: (b.start_min - debut) * PX_PAR_MINUTE,
                      height: Math.max(
                        26,
                        (b.end_min - b.start_min) * PX_PAR_MINUTE - 2,
                      ),
                    }}
                  >
                    <span className="block truncate font-semibold lining-nums tabular-nums">
                      {minutesToTime(b.start_min)} · {b.customer_name}
                    </span>
                    <span className="block truncate text-ink/60">
                      {b.service_name} · {formatPrice(b.price_cents)}
                    </span>
                    {ETIQUETTE[b.status] && (
                      <span className="block truncate text-[0.65rem] uppercase tracking-wider text-ink/50">
                        {ETIQUETTE[b.status]}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
