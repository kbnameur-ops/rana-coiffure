import "server-only";
import { getSettings } from "./queries";

export type GoogleReview = {
  id: string;
  author: string;
  authorUri?: string;
  photoUri?: string;
  rating: number;
  relativeTime: string;
  text: string;
  reviewUri?: string;
};

export type GoogleReviews = {
  rating: number;
  total: number;
  mapsUri?: string;
  writeUri?: string;
  reviews: GoogleReview[];
};

type PlaceResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  googleMapsLinks?: { reviewsUri?: string; writeAReviewUri?: string };
  reviews?: {
    name?: string;
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
    googleMapsUri?: string;
  }[];
};

const FIELDS = [
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "googleMapsLinks",
  "reviews",
].join(",");

/** Surchargeable pour les tests ; en production, l'API Places de Google. */
const ENDPOINT =
  process.env.GOOGLE_PLACES_ENDPOINT ?? "https://places.googleapis.com/v1/places";

/**
 * Avis Google du salon. Renvoie `null` tant que l'identifiant de fiche ou la
 * clé d'API manquent, ou si Google répond en erreur : la section disparaît
 * alors du site plutôt que d'afficher un bloc cassé.
 *
 * L'API ne renvoie que cinq avis, les plus pertinents selon Google — il n'y a
 * pas de pagination possible.
 */
export async function getGoogleReviews(): Promise<GoogleReviews | null> {
  const settings = await getSettings();
  if (settings.reviews_enabled === "0") return null;

  const placeId = (settings.google_place_id ?? "").trim();
  const key =
    process.env.GOOGLE_PLACES_API_KEY ??
    (settings.google_places_api_key ?? "").trim();
  if (!placeId || !key) return null;

  try {
    const response = await fetch(
      `${ENDPOINT}/${encodeURIComponent(placeId)}?languageCode=fr`,
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELDS,
        },
        // Les avis bougent peu : on interroge Google au plus toutes les six
        // heures plutôt qu'à chaque visite.
        next: { revalidate: 21_600 },
      },
    );

    if (!response.ok) {
      console.error(
        `Avis Google : réponse ${response.status} de l'API Places`,
        (await response.text()).slice(0, 300),
      );
      return null;
    }

    const data = (await response.json()) as PlaceResponse;
    const reviews: GoogleReview[] = (data.reviews ?? [])
      .map((r, i) => ({
        id: r.name ?? `avis-${i}`,
        author: r.authorAttribution?.displayName ?? "Client Google",
        authorUri: r.authorAttribution?.uri,
        photoUri: r.authorAttribution?.photoUri,
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? "",
        text: (r.text?.text ?? r.originalText?.text ?? "").trim(),
        reviewUri: r.googleMapsUri,
      }))
      .filter((r) => r.text.length > 0);

    if (typeof data.rating !== "number" || reviews.length === 0) return null;

    return {
      rating: data.rating,
      total: data.userRatingCount ?? 0,
      mapsUri: data.googleMapsLinks?.reviewsUri ?? data.googleMapsUri,
      writeUri: data.googleMapsLinks?.writeAReviewUri,
      reviews,
    };
  } catch (error) {
    console.error("Avis Google : appel impossible", error);
    return null;
  }
}

/** Diagnostic pour l'espace salon : dit précisément ce qui manque. */
export async function getReviewsStatus(): Promise<{
  configured: boolean;
  message: string;
  count?: number;
  rating?: number;
}> {
  const settings = await getSettings();
  const placeId = (settings.google_place_id ?? "").trim();
  const key =
    process.env.GOOGLE_PLACES_API_KEY ??
    (settings.google_places_api_key ?? "").trim();

  if (!placeId)
    return { configured: false, message: "Identifiant de fiche Google manquant." };
  if (!key)
    return { configured: false, message: "Clé d'API Google manquante." };
  if (settings.reviews_enabled === "0")
    return { configured: true, message: "Avis masqués sur le site." };

  const data = await getGoogleReviews();
  if (!data)
    return {
      configured: false,
      message:
        "Google n'a rien renvoyé. Vérifiez l'identifiant de fiche, la clé et l'activation de l'API Places (New).",
    };

  return {
    configured: true,
    message: "Avis récupérés depuis Google.",
    count: data.reviews.length,
    rating: data.rating,
  };
}
