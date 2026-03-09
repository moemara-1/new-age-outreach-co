import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { searchPlaces, filterNoWebsite, type PlaceResult } from "../integrations/maps/places";
import { notifyOpenClaw } from "../integrations/openclaw/notify";

const AGENT = "scout";

export type ScoutJobData = {
  campaignId: string;
  location: string;
  category: string;
  agentRunId: string;
};

export function createScoutWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";

  return new Worker<ScoutJobData>(
    "scout",
    async (job: Job<ScoutJobData>) => {
      const { campaignId, location, category, agentRunId } = job.data;

      await db.agentRun.update({
        where: { id: agentRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const query = `${category} in ${location}`;
        logger.info(AGENT, `Searching: "${query}"`);

        const allPlaces = await searchPlaces(query, apiKey);
        const noWebsite = filterNoWebsite(allPlaces);
        let leadsCreated = 0;

        for (const place of noWebsite) {
          const created = await upsertBusinessAndLead(db, place, campaignId);
          if (created) leadsCreated++;
        }

        await db.activityLog.create({
          data: {
            agent: "SCOUT",
            title: `Found ${noWebsite.length} leads in ${location}`,
            subtitle: `${leadsCreated} new leads created`,
            metadata: { campaignId, total: allPlaces.length },
          },
        });

        const result = {
          totalFound: allPlaces.length,
          noWebsite: noWebsite.length,
          leadsCreated,
        };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result },
        });

        if (leadsCreated > 0) {
          notifyOpenClaw({ event: "lead.found", leadId: campaignId, data: result });

          // Instantly trigger the scheduler so the Intel agent picks up the new leads!
          const schedulerQueue = new Queue("scheduler", { connection });
          await schedulerQueue.add("scheduled-check", { agentRunId: "" });
        }

        logger.info(AGENT, "Completed", result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "FAILED", finishedAt: new Date(), error: message },
        });
        logger.error(AGENT, "Failed", { error: message });
        throw err;
      }
    },
    { connection, concurrency: 1 }
  );
}

async function upsertBusinessAndLead(
  db: PrismaClient,
  place: PlaceResult,
  campaignId: string
): Promise<boolean> {
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
    data: { businessId: business.id, campaignId, status: "NEW" },
  });

  return true;
}
