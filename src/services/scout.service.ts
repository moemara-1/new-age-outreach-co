import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { searchPlaces, filterNoWebsite, type PlaceResult } from "@/integrations/maps/places";

const AGENT = "scout";

export type ScoutInput = {
  campaignId: string;
  location: string;
  category: string;
};

export type ScoutResult = {
  totalFound: number;
  noWebsite: number;
  leadsCreated: number;
};

export async function runScout(input: ScoutInput, apiKey: string): Promise<ScoutResult> {
  const query = `${input.category} in ${input.location}`;
  logger.info(AGENT, `Searching: "${query}"`);

  const allPlaces = await searchPlaces(query, apiKey);
  const noWebsite = filterNoWebsite(allPlaces);

  logger.info(AGENT, `${allPlaces.length} total, ${noWebsite.length} without websites`);

  let leadsCreated = 0;

  for (const place of noWebsite) {
    const created = await upsertBusinessAndLead(place, input.campaignId);
    if (created) leadsCreated++;
  }

  await db.activityLog.create({
    data: {
      agent: "SCOUT",
      title: `Found ${noWebsite.length} leads in ${input.location}`,
      subtitle: `${leadsCreated} new leads created`,
      metadata: { campaignId: input.campaignId, total: allPlaces.length },
    },
  });

  return {
    totalFound: allPlaces.length,
    noWebsite: noWebsite.length,
    leadsCreated,
  };
}

async function upsertBusinessAndLead(place: PlaceResult, campaignId: string): Promise<boolean> {
  const existing = await db.business.findUnique({ where: { placeId: place.placeId } });

  if (existing) {
    const existingLead = await db.lead.findUnique({ where: { businessId: existing.id } });
    if (existingLead) return false;
  }

  const business = await db.business.upsert({
    where: { placeId: place.placeId },
    update: {
      name: place.name,
      address: place.address,
      phone: place.phone,
      website: place.website,
      category: place.category,
      rating: place.rating,
      reviewCount: place.reviewCount,
      lat: place.lat,
      lng: place.lng,
      rawData: place.raw as Prisma.InputJsonValue,
    },
    create: {
      placeId: place.placeId,
      name: place.name,
      address: place.address,
      phone: place.phone,
      website: place.website,
      category: place.category,
      rating: place.rating,
      reviewCount: place.reviewCount,
      lat: place.lat,
      lng: place.lng,
      rawData: place.raw as Prisma.InputJsonValue,
    },
  });

  await db.lead.create({
    data: {
      businessId: business.id,
      campaignId,
      status: "NEW",
    },
  });

  return true;
}
