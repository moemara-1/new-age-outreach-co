import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";

const AGENT = "scheduler";

const STALLED_DAYS = 7;
const NO_REPLY_DAYS = 5;

// NOTE: Closer agent is REACTIVE — it only fires when an inbound email reply
// arrives via the /api/webhooks/email/inbound route. It is NOT scheduled.

export type SchedulerJobData = {
  agentRunId: string;
};

export function createSchedulerWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();

  const worker = new Worker<SchedulerJobData>(
    "scheduler",
    async (job: Job<SchedulerJobData>) => {
      let agentRunId = job.data.agentRunId;

      if (!agentRunId) {
        const run = await db.agentRun.create({
          data: { agent: "GROWTH", status: "RUNNING", startedAt: new Date() },
        });
        agentRunId = run.id;
      } else {
        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "RUNNING", startedAt: new Date() },
        });
      }

      try {
        const now = new Date();
        let queued = 0;

        const stalledCutoff = new Date(now.getTime() - STALLED_DAYS * 24 * 60 * 60 * 1000);
        const stalledLeads = await db.lead.findMany({
          where: {
            status: "SITE_BUILT",
            updatedAt: { lt: stalledCutoff },
            contactEmail: { not: null },
          },
          select: { id: true, campaignId: true },
          take: 20,
        });

        if (stalledLeads.length > 0) {
          const outreachQueue = new Queue("outreach", { connection });
          for (let i = 0; i < stalledLeads.length; i++) {
            const lead = stalledLeads[i];
            const run = await db.agentRun.create({
              data: { agent: "OUTREACH", campaignId: lead.campaignId, status: "QUEUED", input: { leadId: lead.id } as unknown as Prisma.InputJsonValue },
            });
            await outreachQueue.add("outreach", { leadId: lead.id, agentRunId: run.id }, { delay: i * 10_000 });
            queued++;
          }
          logger.info(AGENT, `Queued outreach for ${stalledLeads.length} stalled leads (staggered 10s apart)`);
        }

        // Instantly queue outreach for freshly built sites (don't wait 7 days!)
        const freshBuiltLeads = await db.lead.findMany({
          where: {
            status: "SITE_BUILT",
            outreachMessages: { none: {} },
          },
          select: { id: true, campaignId: true },
          take: 20,
        });

        if (freshBuiltLeads.length > 0) {
          const outreachQueue = new Queue("outreach", { connection });
          for (let i = 0; i < freshBuiltLeads.length; i++) {
            const lead = freshBuiltLeads[i];
            const run = await db.agentRun.create({
              data: { agent: "OUTREACH", campaignId: lead.campaignId, status: "QUEUED", input: { leadId: lead.id } as unknown as Prisma.InputJsonValue },
            });
            await outreachQueue.add("outreach", { leadId: lead.id, agentRunId: run.id }, { delay: i * 10_000 });
            queued++;
          }
          logger.info(AGENT, `Queued outreach for ${freshBuiltLeads.length} freshly built leads (staggered 10s apart)`);
        }

        const newLeads = await db.lead.findMany({
          where: { status: "NEW" },
          select: { id: true, campaignId: true },
          take: 50,
        });

        if (newLeads.length > 0) {
          const intelQueue = new Queue("intel", { connection });
          for (let i = 0; i < newLeads.length; i++) {
            const lead = newLeads[i];
            const run = await db.agentRun.create({
              data: { agent: "INTEL", campaignId: lead.campaignId, status: "QUEUED", input: { leadId: lead.id } as unknown as Prisma.InputJsonValue },
            });
            await intelQueue.add("intel", { leadId: lead.id, agentRunId: run.id }, { delay: i * 10_000 });
            queued++;
          }
          logger.info(AGENT, `Queued intel for ${newLeads.length} new leads (staggered 10s apart)`);
        }

        const researchedLeads = await db.lead.findMany({
          where: { status: "RESEARCHED" },
          select: { id: true, campaignId: true },
          take: 50,
        });

        if (researchedLeads.length > 0) {
          const builderQueue = new Queue("builder", { connection });
          for (let i = 0; i < researchedLeads.length; i++) {
            const lead = researchedLeads[i];
            const run = await db.agentRun.create({
              data: { agent: "BUILDER", campaignId: lead.campaignId, status: "QUEUED", input: { leadId: lead.id } as unknown as Prisma.InputJsonValue },
            });
            await builderQueue.add("builder", { leadId: lead.id, agentRunId: run.id }, { delay: i * 10_000 });
            queued++;
          }
          logger.info(AGENT, `Queued builder for ${researchedLeads.length} researched leads (staggered 10s apart)`);
        }

        const noReplyCutoff = new Date(now.getTime() - NO_REPLY_DAYS * 24 * 60 * 60 * 1000);
        const openedNoReply = await db.outreachMessage.findMany({
          where: {
            type: "INITIAL",
            openedAt: { not: null, lt: noReplyCutoff },
            lead: {
              status: "CONTACTED",
              outreachMessages: { none: { type: "FOLLOW_UP_1" } },
            },
          },
          select: { leadId: true },
          take: 20,
        });

        if (openedNoReply.length > 0) {
          const outreachQueue = new Queue("outreach", { connection });
          for (const msg of openedNoReply) {
            const run = await db.agentRun.create({
              data: { agent: "OUTREACH", status: "QUEUED", input: { leadId: msg.leadId, type: "FOLLOW_UP_1" } as unknown as Prisma.InputJsonValue },
            });
            await outreachQueue.add("outreach", { leadId: msg.leadId, agentRunId: run.id, type: "FOLLOW_UP_1" });
            queued++;
          }
          logger.info(AGENT, `Queued follow-ups for ${openedNoReply.length} opened-no-reply leads`);
        }

        const result = { stalledProcessed: stalledLeads.length, followUpsQueued: openedNoReply.length, totalQueued: queued };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

        if (queued > 0) {
          await db.activityLog.create({
            data: {
              agent: "GROWTH",
              title: `Scheduler queued ${queued} jobs`,
              subtitle: `${stalledLeads.length} stalled, ${openedNoReply.length} follow-ups`,
              metadata: result,
            },
          });
        }

        logger.info(AGENT, `Completed: ${queued} jobs queued`);
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

  const schedulerQueue = new Queue("scheduler", { connection });
  schedulerQueue.add(
    "scheduled-check",
    { agentRunId: "" },
    {
      repeat: { every: 6 * 60 * 60 * 1000 },
      removeOnComplete: true,
    }
  ).then(() => {
    logger.info(AGENT, "Registered repeatable job (every 6 hours)");
  });

  return worker;
}
