"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  addDays,
  formatDateLong,
  formatDuration,
  formatPrice,
  formatTarif,
  minutesToTime,
} from "@/lib/format";

export type BookingService = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  category: string;
  /** Visuel de la famille, partagé par toutes ses prestations. */
  categoryImage: string;
  /** Photo de la prestation. Vide : la carte reste au texte. */
  image: string;
  /** Le tarif est un plancher : le total ne peut alors qu'être minoré. */
  price_from: boolean;
};

export type BookingStaff = {
  id: number;
  name: string;
  role_label: string;
  /** Prestations assurées. Vide = toutes. */
  serviceIds: number[];
};

export type ClientIdentity = {
  name: string;
  phone: string;
  email: string;
  birthdate: string;
};

export type DayAvailability = {
  date: string;
  open: boolean;
  reason?: string;
  slots: number[];
};

type StepId = "service" | "staff" | "slot" | "contact" | "done";

/** Sur l'étape « coordonnées » : le choix, la connexion, ou la saisie. */
type ContactMode = "choix" | "connexion" | "saisie";

const LABELS: Record<StepId, string> = {
  service: "Prestations",
  staff: "Qui vous coiffe",
  slot: "Créneau",
  contact: "Coordonnées",
  done: "Confirmation",
};

const WINDOW_DAYS = 14;

export function BookingFlow({
  services,
  staff,
  today,
  notice,
  phone,
  maxAdvanceDays,
  initialServiceIds = [],
  initialDays = [],
  clientSpace = true,
  identified = null,
}: {
  services: BookingService[];
  staff: BookingStaff[];
  today: string;
  notice: string;
  phone: string;
  maxAdvanceDays: number;
  initialServiceIds?: number[];
  initialDays?: DayAvailability[];
  /** L'espace client est-il ouvert ? Sinon, pas de connexion proposée. */
  clientSpace?: boolean;
  /** Cliente déjà connectée à son espace : ses coordonnées sont connues. */
  identified?: ClientIdentity | null;
}) {
  const steps: StepId[] = staff.length
    ? ["service", "staff", "slot", "contact", "done"]
    : ["service", "slot", "contact", "done"];

  const [step, setStep] = useState<StepId>(
    initialServiceIds.length ? (staff.length ? "staff" : "slot") : "service",
  );
  // L'ordre du tableau est celui des clics : c'est celui du récapitulatif,
  // et celui dans lequel les soins s'enchaînent dans le fauteuil.
  const [selection, setSelection] = useState<number[]>(initialServiceIds);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [windowStart, setWindowStart] = useState(today);
  const [days, setDays] = useState<DayAvailability[]>(initialDays);
  const [loadingDays, setLoadingDays] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: identified?.name ?? "",
    phone: identified?.phone ?? "",
    email: identified?.email ?? "",
    birthdate: identified?.birthdate ?? "",
    notes: "",
  });

  /**
   * L'étape « coordonnées » commence par proposer la connexion : une habituée
   * retrouve ses informations en deux champs plutôt que de tout ressaisir.
   * Déjà connectée, elle va droit au formulaire, pré-rempli.
   */
  const [contactMode, setContactMode] = useState<ContactMode>(
    identified || !clientSpace ? "saisie" : "choix",
  );
  const [known, setKnown] = useState<ClientIdentity | null>(identified);
  const [login, setLogin] = useState({ phone: "", birthdate: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ref: string; staffName: string } | null>(
    null,
  );
  const topRef = useRef<HTMLDivElement>(null);

  const chosen = useMemo(
    () =>
      selection
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is BookingService => s !== undefined),
    [services, selection],
  );

  // Le cumul commande tout : la durée réservée dans le planning comme le total
  // annoncé à la cliente.
  const totalDuration = chosen.reduce((t, s) => t + s.duration_min, 0);
  const totalPrice = chosen.reduce((t, s) => t + s.price_cents, 0);
  const totalEstime = chosen.some((s) => s.price_from);
  const summaryLine =
    chosen.length === 0
      ? ""
      : `${chosen.map((s) => s.name).join(" + ")} · ${formatDuration(totalDuration)} · ${formatTarif(totalPrice, totalEstime)}`;

  /**
   * Une coiffeuse sans compétence déclarée assure tout. Sinon elle doit couvrir
   * l'ensemble du rendez-vous : on ne partage pas une visite entre deux mains.
   */
  const qualified = useMemo(
    () =>
      selection.length === 0
        ? []
        : staff.filter(
            (s) =>
              s.serviceIds.length === 0 ||
              selection.every((id) => s.serviceIds.includes(id)),
          ),
    [staff, selection],
  );

  const chosenStaff = qualified.find((s) => s.id === staffId) ?? null;

  const lastAllowedStart = useMemo(
    () => addDays(today, Math.max(0, maxAdvanceDays - WINDOW_DAYS + 1)),
    [today, maxAdvanceDays],
  );

  const categories = useMemo(() => {
    const map = new Map<string, { image: string; list: BookingService[] }>();
    for (const s of services) {
      const entry = map.get(s.category) ?? { image: s.categoryImage, list: [] };
      entry.list.push(s);
      map.set(s.category, entry);
    }
    return [...map.entries()];
  }, [services]);

  const loadDays = useCallback(
    async (start: string, ids: number[], who: number | null) => {
      if (ids.length === 0) return;
      setLoadingDays(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/availability?prestation=${ids.join(",")}&debut=${start}&jours=${WINDOW_DAYS}&coiffeur=${who ?? "any"}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { days: DayAvailability[] };
        setDays(data.days);
      } catch {
        setDays([]);
        setError("Impossible de charger les disponibilités. Réessayez.");
      } finally {
        setLoadingDays(false);
      }
    },
    [],
  );

  const goTo = (next: StepId) => {
    setStep(next);
    setError(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /**
   * Ajoute ou retire une prestation. Toute modification change la durée du
   * rendez-vous : le créneau retenu jusque-là ne veut plus rien dire.
   */
  const toggleService = (id: number) => {
    setSelection((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id],
    );
    setStaffId(null);
    setDate(null);
    setSlot(null);
    setDays([]);
    setWindowStart(today);
    setError(null);
  };

  const confirmServices = () => {
    if (selection.length === 0) return;
    const eligible = staff.filter(
      (s) =>
        s.serviceIds.length === 0 ||
        selection.every((id) => s.serviceIds.includes(id)),
    );
    if (eligible.length > 0) {
      goTo("staff");
      return;
    }
    void loadDays(today, selection, null);
    goTo("slot");
  };

  const chooseStaff = (id: number | null) => {
    if (selection.length === 0) return;
    setStaffId(id);
    setDate(null);
    setSlot(null);
    setDays([]);
    setWindowStart(today);
    void loadDays(today, selection, id);
    goTo("slot");
  };

  /** Décale la fenêtre de 14 jours et recharge les disponibilités. */
  const shiftWindow = (direction: -1 | 1) => {
    if (selection.length === 0) return;
    const raw = addDays(windowStart, direction * WINDOW_DAYS);
    const next =
      direction < 0
        ? raw < today
          ? today
          : raw
        : raw > lastAllowedStart
          ? lastAllowedStart
          : raw;
    if (next === windowStart) return;
    setWindowStart(next);
    setDate(null);
    void loadDays(next, selection, staffId);
  };

  const chooseSlot = (d: string, s: number) => {
    setDate(d);
    setSlot(s);
    goTo("contact");
  };

  /**
   * Connexion depuis le tunnel : la session s'ouvre comme sur /espace, et les
   * coordonnées enregistrées remplissent le formulaire. En cas d'échec, la
   * saisie manuelle reste à portée de clic — un rendez-vous ne doit jamais
   * buter sur un problème d'identifiants.
   */
  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/espace/connexion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Connexion impossible.");
        return;
      }
      const identity = data as ClientIdentity;
      setKnown(identity);
      setForm((f) => ({
        ...f,
        name: identity.name,
        phone: identity.phone,
        email: identity.email,
        birthdate: identity.birthdate,
      }));
      setContactMode("saisie");
    } catch {
      setLoginError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setLoggingIn(false);
    }
  };

  /** Repart d'un formulaire vierge : ce rendez-vous est pour quelqu'un d'autre. */
  const forgetIdentity = () => {
    setKnown(null);
    setForm((f) => ({ ...f, name: "", phone: "", email: "", birthdate: "" }));
    setContactMode("saisie");
  };

  const selectedDay = days.find((d) => d.date === date);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (chosen.length === 0 || !date || slot === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selection,
          staffId,
          date,
          startMin: slot,
          customerName: form.name,
          phone: form.phone,
          email: form.email,
          birthdate: form.birthdate,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 : le créneau n'est plus libre, on renvoie au choix du créneau.
        // 400 : saisie à corriger, on reste sur le formulaire.
        if (res.status === 409) {
          setSlot(null);
          goTo("slot");
          void loadDays(windowStart, selection, staffId);
        }
        setError(data.error ?? "Une erreur est survenue.");
        return;
      }
      setResult({ ref: data.ref, staffName: data.staffName ?? "" });
      goTo("done");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentIndex = steps.indexOf(step);
  const staffLine = chosenStaff
    ? chosenStaff.name
    : staff.length
      ? "Sans préférence"
      : null;

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* ---------------------------------------------------------- stepper */}
      <ol className="flex flex-wrap gap-x-2 gap-y-3 border-b border-ink/10 pb-6">
        {steps.map((id, i) => {
          const state = i === currentIndex ? "current" : i < currentIndex ? "done" : "todo";
          const reachable = i < currentIndex && step !== "done";
          return (
            <li key={id} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => goTo(id)}
                className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors ${
                  state === "current"
                    ? "text-ink"
                    : state === "done"
                      ? "text-mute hover:text-ink"
                      : "text-mute/60"
                } ${reachable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-[0.7rem] ${
                    state === "current"
                      ? "border-ink bg-ink text-cream"
                      : state === "done"
                        ? "border-gold bg-gold text-cream"
                        : "border-ink/20"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{LABELS[id]}</span>
              </button>
              {i < steps.length - 1 && (
                <span className="h-px w-6 bg-ink/15 sm:w-10" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <p
          role="alert"
          className="mt-6 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {/* ----------------------------------------------------- 1 prestations */}
      {step === "service" && (
        <section className="mt-10 pb-28">
          <h2 className="display text-2xl uppercase">Quelles prestations ?</h2>
          <p className="mt-2 max-w-xl text-ink/60">
            Cochez tout ce que vous souhaitez : coupe et pose d&apos;ongles dans
            la même visite, par exemple. La durée réservée s&apos;additionne.
          </p>

          <div className="mt-8 space-y-12">
            {categories.map(([category, { image, list }]) => (
              <div key={category}>
                {image && (
                  <div className="relative mb-5 aspect-[16/6] overflow-hidden">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 900px"
                      className="object-cover"
                    />
                    <span className="absolute inset-0 bg-gradient-to-r from-ink/50 to-transparent" />
                    <span className="display absolute bottom-0 left-0 p-5 text-2xl uppercase leading-none text-cream">
                      {category}
                    </span>
                  </div>
                )}
                {/* Le bandeau porte déjà le nom : on ne le répète pas. */}
                {!image && (
                  <div className="mb-4 flex items-baseline gap-4">
                    <h3 className="eyebrow text-mute">{category}</h3>
                    <span className="h-px grow bg-ink/10" />
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((s) => {
                    const rank = selection.indexOf(s.id);
                    const on = rank !== -1;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleService(s.id)}
                        className={`group flex items-start gap-4 border p-5 text-left transition-all hover:-translate-y-0.5 ${
                          on
                            ? "border-gold bg-cream shadow-lg shadow-gold/10"
                            : "border-ink/12 bg-white hover:border-ink hover:shadow-lg hover:shadow-ink/5"
                        }`}
                      >
                        {s.image && (
                          <span className="relative block h-20 w-20 shrink-0 overflow-hidden sm:h-24 sm:w-24">
                            <Image
                              src={s.image}
                              alt=""
                              fill
                              sizes="96px"
                              className="object-cover"
                            />
                          </span>
                        )}
                        <span className="flex min-w-0 grow flex-col">
                        <span className="flex w-full items-baseline justify-between gap-3">
                          <span className="flex items-baseline gap-2.5 font-semibold">
                            <span
                              aria-hidden
                              className={`relative top-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-[0.65rem] transition-colors ${
                                on
                                  ? "border-gold bg-gold text-cream"
                                  : "border-ink/25 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            {s.name}
                          </span>
                          <span
                            className={`shrink-0 lining-nums tabular-nums ${
                              s.price_from
                                ? "text-right text-xs uppercase tracking-wider text-mute"
                                : "display text-lg"
                            }`}
                          >
                            {formatTarif(s.price_cents, s.price_from)}
                          </span>
                        </span>
                        {s.description && (
                          <span className="mt-2 pl-[1.9rem] text-sm leading-relaxed text-ink/60">
                            {s.description}
                          </span>
                        )}
                        <span className="mt-4 flex w-full items-center justify-between gap-3 pl-[1.9rem] text-xs uppercase tracking-[0.16em] text-mute">
                          <span>{formatDuration(s.duration_min)}</span>
                          {on && (
                            <span className="text-gold">
                              Choisie{selection.length > 1 ? ` · ${rank + 1}` : ""}
                            </span>
                          )}
                        </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* La barre reste sous les yeux : le total suit chaque coche. */}
          <div
            className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-porcelain/95 backdrop-blur-md transition-all duration-400 ${
              selection.length
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-full opacity-0"
            }`}
          >
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {chosen.map((s) => s.name).join(" + ") || "Aucune prestation"}
                </p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-mute lining-nums tabular-nums">
                  {chosen.length} prestation{chosen.length > 1 ? "s" : ""} ·{" "}
                  {formatDuration(totalDuration)} ·{" "}
                  {formatTarif(totalPrice, totalEstime)}
                </p>
              </div>
              <button
                type="button"
                onClick={confirmServices}
                className="bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-ink-soft"
              >
                Continuer
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ 2 qui coiffe */}
      {step === "staff" && chosen.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl uppercase tracking-[0.06em]">Avec qui ?</h2>
          <p className="mt-2 text-ink/60">{summaryLine}</p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseStaff(null)}
              className="flex flex-col items-start border border-ink/12 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg hover:shadow-ink/5"
            >
              <span className="font-semibold">Sans préférence</span>
              <span className="mt-2 text-sm leading-relaxed text-ink/60">
                La première personne disponible sur le créneau choisi. C&apos;est
                l&apos;option qui offre le plus d&apos;horaires.
              </span>
            </button>

            {qualified.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => chooseStaff(member.id)}
                className="flex flex-col items-start border border-ink/12 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg hover:shadow-ink/5"
              >
                <span className="flex items-center gap-3">
                  <span
                    className="display flex h-10 w-10 items-center justify-center rounded-full bg-ink text-sm text-cream"
                    aria-hidden
                  >
                    {member.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="font-semibold">{member.name}</span>
                </span>
                {member.role_label && (
                  <span className="mt-3 text-sm leading-relaxed text-ink/60">
                    {member.role_label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- 3 créneau */}
      {step === "slot" && chosen.length > 0 && (
        <section className="mt-10">
          <h2 className="display text-2xl uppercase">Choisissez un créneau</h2>
          <p className="mt-2 text-ink/60">
            {summaryLine}
            {staffLine && ` · ${staffLine}`}
          </p>

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={windowStart <= today || loadingDays}
              onClick={() => shiftWindow(-1)}
              className="border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors enabled:hover:border-ink disabled:opacity-30"
            >
              ← Avant
            </button>
            <p className="text-sm text-mute">
              {loadingDays ? "Chargement…" : "14 jours affichés"}
            </p>
            <button
              type="button"
              disabled={windowStart >= lastAllowedStart || loadingDays}
              onClick={() => shiftWindow(1)}
              className="border border-ink/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors enabled:hover:border-ink disabled:opacity-30"
            >
              Après →
            </button>
          </div>

          <div className="mt-5 -mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
            <div className="flex gap-2">
              {days.map((d) => {
                const available = d.open && d.slots.length > 0;
                const [, m, dd] = d.date.split("-");
                const weekdayLabel = new Date(`${d.date}T12:00:00Z`)
                  .toLocaleDateString("fr-FR", { weekday: "short", timeZone: "UTC" })
                  .replace(".", "");
                const monthLabel = new Date(`${d.date}T12:00:00Z`)
                  .toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" })
                  .replace(".", "");
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!available}
                    onClick={() => setDate(d.date)}
                    title={!available ? (d.reason ?? "Complet") : undefined}
                    className={`w-[74px] shrink-0 border px-2 py-3 text-center transition-colors ${
                      date === d.date
                        ? "border-ink bg-ink text-cream"
                        : available
                          ? "border-ink/15 bg-white hover:border-ink"
                          : "border-ink/10 bg-ink/[0.03] text-mute/60"
                    }`}
                  >
                    <span className="block text-[0.65rem] uppercase tracking-widest">
                      {weekdayLabel}
                    </span>
                    <span className="display mt-1 block text-xl lining-nums tabular-nums">
                      {dd}
                    </span>
                    <span className="block text-[0.65rem] uppercase tracking-widest opacity-70">
                      {monthLabel}
                      <span className="sr-only"> {m}</span>
                    </span>
                    <span className="mt-1 block text-[0.6rem] uppercase tracking-wider">
                      {available ? `${d.slots.length} libres` : "—"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {date && selectedDay && (
            <div className="mt-10 border-t border-ink/10 pt-8">
              <h3 className="font-semibold first-letter:uppercase">
                {formatDateLong(date)}
              </h3>

              {(["Matin", "Après-midi"] as const).map((part) => {
                const slots = selectedDay.slots.filter((s) =>
                  part === "Matin" ? s < 12 * 60 : s >= 12 * 60,
                );
                if (!slots.length) return null;
                return (
                  <div key={part} className="mt-6">
                    <p className="eyebrow text-mute">{part}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => chooseSlot(date, s)}
                          className="border border-ink/15 bg-white px-4 py-2.5 text-sm lining-nums tabular-nums transition-colors hover:border-ink hover:bg-ink hover:text-cream"
                        >
                          {minutesToTime(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!date && !loadingDays && days.every((d) => !d.open || !d.slots.length) && (
            <p className="mt-10 border border-ink/10 bg-white p-6 text-sm text-ink/70">
              Aucune disponibilité sur cette période
              {chosenStaff ? ` avec ${chosenStaff.name}` : ""}
              {selection.length > 1
                ? " pour l'ensemble des prestations choisies"
                : ""}
              . Essayez les jours suivants
              {selection.length > 1 ? ", une prestation de moins," : ""}
              {chosenStaff ? " quelqu'un d'autre," : ""} ou appelez le salon au{" "}
              <a className="underline" href={`tel:${phone.replace(/\s/g, "")}`}>
                {phone}
              </a>
              .
            </p>
          )}
        </section>
      )}

      {/* ----------------------------------------------------- 4 coordonnées */}
      {step === "contact" && chosen.length > 0 && date && slot !== null && (
        <section className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="order-2 lg:order-1">
            {/* Le choix d'entrée : retrouver son espace, ou tout renseigner. */}
            {contactMode === "choix" && (
              <div>
                <h2 className="display text-2xl uppercase">Déjà venue ?</h2>
                <p className="mt-2 max-w-lg text-ink/60">
                  Connectez-vous à votre espace client : vos coordonnées se
                  remplissent toutes seules, et le rendez-vous rejoint votre
                  historique.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setContactMode("connexion")}
                    className="flex flex-col items-start border border-ink/12 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg hover:shadow-ink/5"
                  >
                    <span className="font-semibold">
                      Je suis déjà cliente du salon
                    </span>
                    <span className="mt-2 grow text-sm leading-relaxed text-ink/60">
                      Numéro de téléphone et date de naissance. Pas de mot de
                      passe à retenir.
                    </span>
                    <span className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                      Me connecter →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setContactMode("saisie")}
                    className="flex flex-col items-start border border-ink/12 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg hover:shadow-ink/5"
                  >
                    <span className="font-semibold">Première réservation</span>
                    <span className="mt-2 grow text-sm leading-relaxed text-ink/60">
                      Vous renseignez vos coordonnées : votre espace se crée
                      avec le rendez-vous.
                    </span>
                    <span className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                      Renseigner mes coordonnées →
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* La connexion, sans quitter le tunnel : le créneau reste retenu. */}
            {contactMode === "connexion" && (
              <form onSubmit={connect}>
                <h2 className="display text-2xl uppercase">Votre espace</h2>
                <p className="mt-2 max-w-lg text-ink/60">
                  Pas de mot de passe : votre numéro de téléphone et votre date
                  de naissance suffisent.
                </p>

                <div className="mt-8 max-w-md space-y-5">
                  <Field
                    label="Téléphone"
                    required
                    type="tel"
                    value={login.phone}
                    onChange={(v) => setLogin({ ...login, phone: v })}
                    autoComplete="tel"
                  />
                  <Field
                    label="Date de naissance"
                    required
                    type="date"
                    value={login.birthdate}
                    onChange={(v) => setLogin({ ...login, birthdate: v })}
                    autoComplete="bday"
                  />
                </div>

                {loginError && (
                  <p
                    role="alert"
                    className="mt-5 max-w-lg border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
                  >
                    {loginError}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap items-center gap-5">
                  <button
                    type="submit"
                    disabled={loggingIn}
                    className="bg-ink px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-ink-soft disabled:opacity-60"
                  >
                    {loggingIn ? "Vérification…" : "Me connecter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMode("saisie")}
                    className="text-sm text-mute underline transition-colors hover:text-ink"
                  >
                    Renseigner mes coordonnées à la place
                  </button>
                </div>
              </form>
            )}

            {contactMode === "saisie" && (
            <form onSubmit={submit}>
              <h2 className="display text-2xl uppercase">Vos coordonnées</h2>
              {known ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-cream px-4 py-3">
                  <p className="text-sm">
                    Connectée en tant que{" "}
                    <strong className="font-semibold">
                      {known.name || known.phone}
                    </strong>
                    . Ce rendez-vous rejoindra votre espace.
                  </p>
                  <button
                    type="button"
                    onClick={forgetIdentity}
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-mute underline transition-colors hover:text-ink"
                  >
                    Ce n&apos;est pas vous ?
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-ink/60">
                  Le numéro de téléphone permet au salon de vous joindre en cas
                  d&apos;imprévu.{" "}
                  {clientSpace && (
                    <button
                      type="button"
                      onClick={() => setContactMode("connexion")}
                      className="underline transition-colors hover:text-ink"
                    >
                      Déjà cliente ? Connectez-vous.
                    </button>
                  )}
                </p>
              )}

              <div className="mt-8 space-y-5">
                <Field
                  label="Nom et prénom"
                  required
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  autoComplete="name"
                />
                <Field
                  label="Téléphone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                  autoComplete="tel"
                />
                <div>
                  <Field
                    label={
                      known
                        ? "Date de naissance"
                        : "Date de naissance (facultatif)"
                    }
                    type="date"
                    value={form.birthdate}
                    onChange={(v) => setForm({ ...form, birthdate: v })}
                    autoComplete="bday"
                  />
                  {/* Déjà connectée, elle sait à quoi sert la date. */}
                  {!known && (
                    <p className="mt-2 text-xs leading-relaxed text-mute">
                      Avec votre numéro, elle vous ouvre l&apos;espace client :
                      historique, annulation en ligne et carte de fidélité.
                    </p>
                  )}
                </div>
                <Field
                  label="E-mail (facultatif)"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  autoComplete="email"
                />
                <label className="block">
                  <span className="eyebrow text-mute">Précisions (facultatif)</span>
                  <textarea
                    rows={3}
                    maxLength={500}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-2 w-full border border-ink/20 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-ink"
                    placeholder="Allergie, remarque…"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-8 w-full bg-ink px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-ink-soft disabled:opacity-60 sm:w-auto"
              >
                {submitting ? "Envoi…" : "Confirmer le rendez-vous"}
              </button>
              <p className="mt-4 text-xs leading-relaxed text-mute">{notice}</p>
            </form>
            )}
          </div>

          <aside className="order-1 h-fit border border-ink/12 bg-white p-6 lg:order-2">
            <p className="eyebrow text-mute">Récapitulatif</p>

            <ul className="mt-5 space-y-3 border-b border-ink/10 pb-5 text-sm">
              {chosen.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-4">
                  <span>
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-2 text-xs text-mute lining-nums tabular-nums">
                      {formatDuration(s.duration_min)}
                    </span>
                  </span>
                  <span className="shrink-0 lining-nums tabular-nums">
                    {formatTarif(s.price_cents, s.price_from)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-4 text-sm">
              {staffLine && <Row label="Avec" value={staffLine} />}
              <Row label="Date" value={formatDateLong(date)} capitalize />
              <Row
                label="Heure"
                value={`${minutesToTime(slot)} – ${minutesToTime(slot + totalDuration)}`}
              />
              <Row label="Durée" value={formatDuration(totalDuration)} />
            </dl>
            <div className="mt-6 flex items-baseline justify-between border-t border-ink/10 pt-4">
              <span className="eyebrow text-mute">
                {totalEstime ? "À partir de" : "Total"}
              </span>
              <span className="display text-2xl lining-nums tabular-nums">
                {formatPrice(totalPrice)}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mute">
              {totalEstime
                ? "Une des prestations choisies se chiffre sur place, selon le travail demandé. Règlement sur place."
                : "Règlement sur place."}
            </p>
          </aside>
        </section>
      )}

      {/* --------------------------------------------------- 5 confirmation */}
      {step === "done" && result && chosen.length > 0 && date && slot !== null && (
        <section className="mt-12 max-w-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl text-cream">
            ✓
          </div>
          <h2 className="display mt-6 text-3xl uppercase">C&apos;est noté</h2>
          <p className="mt-3 text-lg text-ink/70">
            Votre rendez-vous est confirmé. Référence{" "}
            <strong className="font-semibold tracking-wider">{result.ref}</strong>.
          </p>

          <ul className="mt-8 space-y-3 border-t border-ink/10 pt-6 text-sm">
            {chosen.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4">
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-mute lining-nums tabular-nums">
                    {formatDuration(s.duration_min)}
                  </span>
                </span>
                <span className="shrink-0 lining-nums tabular-nums">
                  {formatTarif(s.price_cents, s.price_from)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-4 border-b border-ink/10 pb-6 text-sm">
            {result.staffName && <Row label="Avec" value={result.staffName} />}
            <Row label="Date" value={formatDateLong(date)} capitalize />
            <Row
              label="Heure"
              value={`${minutesToTime(slot)} – ${minutesToTime(slot + totalDuration)}`}
            />
            <Row label="Au nom de" value={form.name} />
            <Row label="Téléphone" value={form.phone} />
            <Row
              label={totalEstime ? "À partir de" : "Total"}
              value={formatPrice(totalPrice)}
            />
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-ink/60">
            Un empêchement ? Appelez le salon au{" "}
            <a className="underline" href={`tel:${phone.replace(/\s/g, "")}`}>
              {phone}
            </a>{" "}
            en précisant votre référence.
          </p>

          {/* Une date de naissance donnée ouvre l'espace : autant y mener. */}
          {clientSpace && (known || form.birthdate) && (
            <p className="mt-6 border border-gold/40 bg-cream px-4 py-3 text-sm leading-relaxed">
              {known
                ? "Ce rendez-vous est enregistré dans votre espace client : vous pouvez l'y retrouver, l'annuler et suivre votre carte de fidélité."
                : "Votre espace client est ouvert. Avec votre numéro et votre date de naissance, vous y retrouverez ce rendez-vous, votre historique et votre carte de fidélité."}{" "}
              <Link href="/espace" className="underline hover:text-gold-deep">
                Voir mon espace
              </Link>
              .
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="bg-ink px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] text-cream transition-colors hover:bg-ink-soft"
            >
              Retour à l&apos;accueil
            </Link>
            <button
              type="button"
              onClick={() => {
                setStep("service");
                setSelection([]);
                setStaffId(null);
                setDate(null);
                setSlot(null);
                setResult(null);
                // La cliente reste identifiée : inutile de la reconnecter.
                setContactMode(known ? "saisie" : clientSpace ? "choix" : "saisie");
                setForm({
                  name: known?.name ?? "",
                  phone: known?.phone ?? "",
                  email: known?.email ?? "",
                  birthdate: known?.birthdate ?? "",
                  notes: "",
                });
              }}
              className="border border-ink/20 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.18em] transition-colors hover:border-ink"
            >
              Un autre rendez-vous
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow text-mute">
        {label}
        {required && <span className="ml-1 text-gold">*</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-ink/20 bg-white px-4 py-3 text-base outline-none transition-colors focus:border-ink"
      />
    </label>
  );
}

function Row({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-mute">{label}</dt>
      <dd
        className={`text-right font-medium ${capitalize ? "first-letter:uppercase" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
