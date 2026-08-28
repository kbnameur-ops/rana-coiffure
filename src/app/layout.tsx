import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/queries";
import { isDatabaseConfigured } from "@/lib/config";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  if (!isDatabaseConfigured())
    return { title: "Configuration requise", robots: { index: false } };

  const s = await getSettings();
  const name = s.shop_name || "Rana Beauté Coiffure";
  const city = s.city || "Paris";
  const tagline = s.tagline || "Salon de coiffure & institut de beauté";
  return {
    title: {
      default: `${name} — ${tagline} à ${city}`,
      template: `%s — ${name}`,
    },
    description: `${name}, ${tagline.toLowerCase()} à ${city}. Coupe, couleur, balayage, lissage, chignon, ongles, extensions de cils, épilation et soins du visage. Réservation en ligne en moins d'une minute.`,
    openGraph: {
      title: `${name} — ${tagline}`,
      description: `${tagline} à ${city}. Coupe, couleur, balayage, coiffure de mariée, ongles, cils, épilation et soins. Réservez votre rendez-vous en ligne.`,
      type: "website",
      locale: "fr_FR",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
