import Image from "next/image";

/**
 * Le logo est bleu nuit et or : il se pose tel quel sur la porcelaine, qui
 * fait l'essentiel du site. Sur les deux aplats marine — bandeau de rappel et
 * pied de page — le marine du verrou s'effacerait : c'est la déclinaison
 * claire qui prend le relais, chevelure crème et or remonté.
 */

type Teinte = "encre" | "clair";

export function LogoBar({
  shopName,
  className = "",
  priority = false,
  tone = "encre",
}: {
  shopName: string;
  className?: string;
  priority?: boolean;
  tone?: Teinte;
}) {
  return (
    <Image
      src={tone === "clair" ? "/logo/verrou-clair.png" : "/logo/verrou.png"}
      alt={shopName}
      width={900}
      height={453}
      priority={priority}
      className={className}
      sizes="(max-width: 640px) 78vw, 460px"
    />
  );
}

export function LogoMark({
  className = "",
  tone = "encre",
}: {
  className?: string;
  tone?: Teinte;
}) {
  return (
    <Image
      src={tone === "clair" ? "/logo/marque-clair.png" : "/logo/marque.png"}
      alt=""
      width={420}
      height={491}
      className={className}
      sizes="220px"
    />
  );
}
