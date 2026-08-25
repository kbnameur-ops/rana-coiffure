import Image from "next/image";

/**
 * Le logo existe en deux teintes : doré, pour les fonds sombres, et espresso,
 * pour les fonds clairs qui font l'essentiel du site. L'or reste rare — c'est
 * ce qui lui garde sa valeur.
 */

export function LogoMark({
  className = "",
  tone = "gold",
}: {
  className?: string;
  tone?: "gold" | "ink";
}) {
  return (
    <Image
      src={tone === "ink" ? "/logo/embleme-encre.png" : "/logo/embleme.png"}
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
  tone = "gold",
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
  tone?: "gold" | "ink";
}) {
  return (
    <Image
      src={tone === "ink" ? "/logo/horizontal-encre.png" : "/logo/horizontal.png"}
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
  tone = "gold",
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
  tone?: "gold" | "ink";
}) {
  return (
    <Image
      src={tone === "ink" ? "/logo/complet-encre.png" : "/logo/complet.png"}
      alt={`Logo ${shopName}`}
      width={800}
      height={795}
      priority={priority}
      className={className}
      sizes="(max-width: 640px) 72vw, 460px"
    />
  );
}

/**
 * Le verrou doré posé dans un disque espresso : sur une page claire, le logo
 * devient un bijou plutôt qu'une image qui se délave sur l'ivoire.
 */
export function LogoMedallion({
  shopName,
  className = "",
  priority = false,
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={`relative flex aspect-square items-center justify-center rounded-full bg-[radial-gradient(circle_at_35%_28%,#332723,#171110)] shadow-[0_40px_80px_-40px_rgba(36,28,26,0.55)] ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-brass/35"
      />
      <LogoFull
        shopName={shopName}
        priority={priority}
        className="h-auto w-[68%]"
      />
    </span>
  );
}
