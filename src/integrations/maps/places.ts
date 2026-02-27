import { logger } from "@/lib/logger";

const AGENT = "scout";
const BASE_URL = "https://places.googleapis.com/v1/places:searchText";

export type PlaceResult = {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  lat?: number;
  lng?: number;
  raw: Record<string, unknown>;
};

type TextSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryTypeDisplayName?: { text: string };
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
};

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "nextPageToken",
].join(",");

export async function searchPlaces(
  query: string,
  apiKey: string,
  opts: { maxPages?: number } = {}
): Promise<PlaceResult[]> {
  const maxPages = opts.maxPages ?? 3;
  const results: PlaceResult[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = { textQuery: query, languageCode: "en" };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error(AGENT, `Places API error ${res.status}`, { body: text });
      throw new Error(`Places API ${res.status}: ${text}`);
    }

    const data: TextSearchResponse = await res.json();
    if (!data.places?.length) break;

    for (const p of data.places) {
      results.push(mapPlace(p));
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  logger.info(AGENT, `Found ${results.length} places for "${query}"`);
  return results;
}

export function filterNoWebsite(places: PlaceResult[]): PlaceResult[] {
  return places.filter((p) => !p.website);
}

function mapPlace(p: GooglePlace): PlaceResult {
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    phone: p.nationalPhoneNumber,
    website: p.websiteUri,
    category: p.primaryTypeDisplayName?.text,
    rating: p.rating,
    reviewCount: p.userRatingCount,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    raw: p as unknown as Record<string, unknown>,
  };
}
