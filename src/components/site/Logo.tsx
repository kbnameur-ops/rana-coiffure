import Image from "next/image";

/**
 * Le logo du salon existe en trois états, tous dorés sur fond détouré : le
 * verrou complet là où il y a de la place (héros, pied de page), le verrou
 * horizontal dans les barres de navigation, et l'emblème seul en ornement.
 */

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/logo/embleme.png"
      alt=""
      width={520}
      height={409}
      className={className}
      sizes="220px"
    />
  );
}

export function LogoBar({
  shopName,
  className = "",
  priority = false,
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo/horizontal.png"
      alt={shopName}
      width={820}
      height={425}
      priority={priority}
      className={className}
      sizes="220px"
    />
  );
}

export function LogoFull({
  shopName,
  className = "",
  priority = false,
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo/complet.png"
      alt={`Logo ${shopName}`}
      width={800}
      height={795}
      priority={priority}
      className={className}
      sizes="(max-width: 640px) 72vw, 460px"
    />
  );
}

export function Wordmark({
  name,
  tone = "dark",
  size = "md",
  subtitle = "Salon de coiffure dames",
}: {
  name: string;
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  subtitle?: string | null;
}) {
  const text = tone === "light" ? "text-bone" : "text-ink";
  const sub = tone === "light" ? "text-bone-dim/70" : "text-clay";
  const rule = tone === "light" ? "bg-bone/30" : "bg-ink/20";
  const scale = {
    sm: "text-lg",
    md: "text-2xl sm:text-3xl",
    lg: "text-[clamp(2.2rem,7vw,5rem)]",
  }[size];

  return (
    <span className="inline-flex flex-col">
      <span className={`display ${scale} ${text}`}>{name}</span>
      {subtitle && (
        <span
          className={`flex items-center gap-2 ${size === "lg" ? "mt-4" : "mt-1.5"}`}
        >
          <span className={`h-px w-6 ${rule}`} aria-hidden />
          <span
            className={`eyebrow ${sub} ${size === "lg" ? "text-[0.7rem] sm:text-xs" : "text-[0.6rem]"}`}
          >
            {subtitle}
          </span>
        </span>
      )}
    </span>
  );
}
