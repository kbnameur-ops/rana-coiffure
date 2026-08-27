"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  addDays,
  formatDateLong,
  formatDuration,
  formatPrice,
  minutesToTime,
} from "@/lib/format";

export type BookingService = {
  id: number;
  name: string;
  description: string;
  price_cents: number;
  duration_min: number;
  category: string;
};

export type BookingStaff = {
  id: number;
  name: string;
  role_label: string;
  /** Prestations assurées. Vide = toutes. */
  serviceIds: number[];
};

export type DayAvailability = {
  date: string;
  open: boolean;
  reason?: string;
  slots: number[];
};

type StepId = "service" | "staff" | "slot" | "contact" | "done";

const LABELS: Record<StepId, string> = {
  service: "Prestation",
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
  initialServiceId = null,
  initialDays = [],
}: {
  services: BookingService[];
  staff: BookingStaff[];
  today: string;
  notice: string;
  phone: string;
  maxAdvanceDays: number;
  initialServiceId?: number | null;
  initialDays?: DayAvailability[];
}) {
  const steps: StepId[] = staff.length
    ? ["service", "staff", "slot", "contact", "done"]
    : ["service", "slot", "contact", "done"];

  const [step, setStep] = useState<StepId>(
    initialServiceId ? (staff.length ? "staff" : "slot") : "service",
  );
  const [serviceId, setServiceId] = useState<number | null>(initialServiceId);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [windowStart, setWindowStart] = useState(today);
  const [days, setDays] = useState<DayAvailability[]>(initialDays);
  const [loadingDays, setLoadingDays] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    birthdate: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ref: string; staffName: string } | null>(
    null,
  );
  const topRef = useRef<HTMLDivElement>(null);

  const service = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId],
  );

  /** Une coiffeuse sans compétence déclarée assure toutes les prestations. */
  const qualified = useMemo(
    () =>
      serviceId === null
        ? []
        : staff.filter(
            (s) => s.serviceIds.length === 0 || s.serviceIds.includes(serviceId),
          ),
    [staff, serviceId],
  );

  const chosenStaff = qualified.find((s) => s.id === staffId) ?? null;

  const lastAllowedStart = useMemo(
    () => addDays(today, Math.max(0, maxAdvanceDays - WINDOW_DAYS + 1)),
    [today, maxAdvanceDays],
  );

  const categories = useMemo(() => {
    const map = new Map<string, BookingService[]>();
    for (const s of services) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()];
  }, [services]);

  const loadDays = useCallback(
    async (start: string, id: number, who: number | null) => {
      setLoadingDays(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/availability?prestation=${id}&debut=${start}&jours=${WINDOW_DAYS}&coiffeur=${who ?? "any"}`,
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

  const chooseService = (id: number) => {
    setServiceId(id);
    setStaffId(null);
    setDate(null);
    setSlot(null);
    setDays([]);
    setWindowStart(today);

    const eligible = staff.filter(
      (s) => s.serviceIds.length === 0 || s.serviceIds.includes(id),
    );
    if (eligible.length > 0) {
      goTo("staff");
      return;
    }
    void loadDays(today, id, null);
    goTo("slot");
  };

  const chooseStaff = (id: number | null) => {
    if (!serviceId) return;
    setStaffId(id);
    setDate(null);
    setSlot(null);
    setDays([]);
    setWindowStart(today);
    void loadDays(today, serviceId, id);
    goTo("slot");
  };

  /** Décale la fenêtre de 14 jours et recharge les disponibilités. */
  const shiftWindow = (direction: -1 | 1) => {
    if (!serviceId) return;
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
    void loadDays(next, serviceId, staffId);
  };

  const chooseSlot = (d: string, s: number) => {
    setDate(d);
    setSlot(s);
    goTo("contact");
  };

  const selectedDay = days.find((d) => d.date === date);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!service || !date || slot === null) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
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
          if (serviceId) void loadDays(windowStart, serviceId, staffId);
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

      {/* ------------------------------------------------------ 1 prestation */}
      {step === "service" && (
        <section className="mt-10">
          <h2 className="display text-2xl uppercase">Quelle prestation ?</h2>
          <p className="mt-2 text-ink/60">
            Sélectionnez ce que vous souhaitez, la durée est réservée en
            conséquence.
          </p>

          <div className="mt-8 space-y-10">
            {categories.map(([category, list]) => (
              <div key={category}>
                <div className="flex items-baseline gap-4">
                  <h3 className="eyebrow text-mute">{category}</h3>
                  <span className="h-px grow bg-ink/10" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {list.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => chooseService(s.id)}
                      className="group flex flex-col items-start border border-ink/12 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-lg hover:shadow-ink/5"
                    >
                      <span className="flex w-full items-baseline justify-between gap-3">
                        <span className="font-semibold">{s.name}</span>
                        <span className="display text-lg lining-nums tabular-nums">
                          {formatPrice(s.price_cents)}
                        </span>
                      </span>
                      {s.description && (
                        <span className="mt-2 text-sm leading-relaxed text-ink/60">
                          {s.description}
                        </span>
                      )}
                      <span className="mt-4 text-xs uppercase tracking-[0.16em] text-mute">
                        {formatDuration(s.duration_min)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ 2 qui coiffe */}
      {step === "staff" && service && (
        <section className="mt-10">
          <h2 className="display text-2xl uppercase tracking-[0.06em]">Avec qui ?</h2>
          <p className="mt-2 text-ink/60">
            {service.name} · {formatDuration(service.duration_min)} ·{" "}
            {formatPrice(service.price_cents)}
          </p>

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
      {step === "slot" && service && (
        <section className="mt-10">
          <h2 className="display text-2xl uppercase">Choisissez un créneau</h2>
          <p className="mt-2 text-ink/60">
            {service.name} · {formatDuration(service.duration_min)} ·{" "}
            {formatPrice(service.price_cents)}
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
              {chosenStaff ? ` avec ${chosenStaff.name}` : ""}. Essayez les jours
              suivants
              {chosenStaff ? ", quelqu'un d'autre," : ""} ou appelez le salon au{" "}
              <a className="underline" href={`tel:${phone.replace(/\s/g, "")}`}>
                {phone}
              </a>
              .
            </p>
          )}
        </section>
      )}

      {/* ----------------------------------------------------- 4 coordonnées */}
      {step === "contact" && service && date && slot !== null && (
        <section className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <form onSubmit={submit} className="order-2 lg:order-1">
            <h2 className="display text-2xl uppercase">Vos coordonnées</h2>
            <p className="mt-2 text-ink/60">
              Le numéro de téléphone permet au salon de vous joindre en cas
              d&apos;imprévu.
            </p>

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
                  label="Date de naissance (facultatif)"
                  type="date"
                  value={form.birthdate}
                  onChange={(v) => setForm({ ...form, birthdate: v })}
                  autoComplete="bday"
                />
                <p className="mt-2 text-xs leading-relaxed text-mute">
                  Avec votre numéro, elle vous ouvre l&apos;espace client :
                  historique, annulation en ligne et carte de fidélité.
                </p>
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

          <aside className="order-1 h-fit border border-ink/12 bg-white p-6 lg:order-2">
            <p className="eyebrow text-mute">Récapitulatif</p>
            <dl className="mt-5 space-y-4 text-sm">
              <Row label="Prestation" value={service.name} />
              {staffLine && <Row label="Avec" value={staffLine} />}
              <Row label="Date" value={formatDateLong(date)} capitalize />
              <Row
                label="Heure"
                value={`${minutesToTime(slot)} – ${minutesToTime(slot + service.duration_min)}`}
              />
              <Row label="Durée" value={formatDuration(service.duration_min)} />
            </dl>
            <div className="mt-6 flex items-baseline justify-between border-t border-ink/10 pt-4">
              <span className="eyebrow text-mute">Total</span>
              <span className="display text-2xl">
                {formatPrice(service.price_cents)}
              </span>
            </div>
            <p className="mt-3 text-xs text-mute">Règlement sur place.</p>
          </aside>
        </section>
      )}

      {/* --------------------------------------------------- 5 confirmation */}
      {step === "done" && result && service && date && slot !== null && (
        <section className="mt-12 max-w-xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold text-2xl text-cream">
            ✓
          </div>
          <h2 className="display mt-6 text-3xl uppercase">C&apos;est noté</h2>
          <p className="mt-3 text-lg text-ink/70">
            Votre rendez-vous est confirmé. Référence{" "}
            <strong className="font-semibold tracking-wider">{result.ref}</strong>.
          </p>

          <dl className="mt-8 space-y-4 border-y border-ink/10 py-6 text-sm">
            <Row label="Prestation" value={service.name} />
            {result.staffName && <Row label="Avec" value={result.staffName} />}
            <Row label="Date" value={formatDateLong(date)} capitalize />
            <Row
              label="Heure"
              value={`${minutesToTime(slot)} – ${minutesToTime(slot + service.duration_min)}`}
            />
            <Row label="Au nom de" value={form.name} />
            <Row label="Téléphone" value={form.phone} />
            <Row label="Total" value={formatPrice(service.price_cents)} />
          </dl>

          <p className="mt-6 text-sm leading-relaxed text-ink/60">
            Un empêchement ? Appelez le salon au{" "}
            <a className="underline" href={`tel:${phone.replace(/\s/g, "")}`}>
              {phone}
            </a>{" "}
            en précisant votre référence.
          </p>

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
                setServiceId(null);
                setStaffId(null);
                setDate(null);
                setSlot(null);
                setResult(null);
                setForm({
                  name: "",
                  phone: "",
                  email: "",
                  birthdate: "",
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
