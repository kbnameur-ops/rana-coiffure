import type { LoyaltyState } from "@/lib/clients";

function Scissors({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M7 4l9 12" />
        <path d="M17 4L8 16" />
        <circle cx="6.5" cy="18.5" r="2.5" />
        <circle cx="17.5" cy="18.5" r="2.5" />
      </g>
    </svg>
  );
}

export function LoyaltyCard({ loyalty }: { loyalty: LoyaltyState }) {
  const ready = loyalty.available > 0;

  return (
    <section className="relative overflow-hidden bg-ink p-7 text-bone sm:p-9">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/15 blur-3xl"
      />

      <div className="relative">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="eyebrow text-gold-soft">Carte de fidélité</p>
          <p className="text-sm lining-nums tabular-nums text-bone/60">
            {loyalty.stamps} / {loyalty.threshold}
          </p>
        </div>

        <h2 className="display mt-4 text-2xl uppercase sm:text-3xl">
          {ready ? loyalty.reward : `${loyalty.threshold} passages, ${loyalty.reward.toLowerCase()}`}
        </h2>

        <ul className="mt-7 flex flex-wrap gap-2.5">
          {Array.from({ length: loyalty.threshold }, (_, i) => {
            const filled = i < loyalty.stamps;
            return (
              <li
                key={i}
                className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${
                  filled
                    ? "border-gold bg-gold-soft text-ink"
                    : "border-bone/20 text-bone/25"
                }`}
              >
                {filled ? (
                  <Scissors className="h-5 w-5" />
                ) : (
                  <span className="text-xs lining-nums tabular-nums">{i + 1}</span>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-7 max-w-md text-sm leading-relaxed text-bone/70">
          {ready ? (
            <>
              Votre carte est complète : <strong className="text-gold-soft">{loyalty.reward.toLowerCase()}</strong>{" "}
              vous attend. Signalez-le au salon lors de votre prochain passage,
              c&apos;est lui qui valide la récompense.
            </>
          ) : (
            <>
              Un tampon par passage honoré. Encore{" "}
              <strong className="text-bone">
                {loyalty.threshold - loyalty.stamps} passage
                {loyalty.threshold - loyalty.stamps > 1 ? "s" : ""}
              </strong>{" "}
              avant {loyalty.reward.toLowerCase()}.
            </>
          )}
        </p>

        {loyalty.redeemed > 0 && (
          <p className="mt-3 text-xs text-bone/45">
            {loyalty.redeemed} récompense{loyalty.redeemed > 1 ? "s" : ""} déjà
            utilisée{loyalty.redeemed > 1 ? "s" : ""}.
          </p>
        )}
      </div>
    </section>
  );
}
