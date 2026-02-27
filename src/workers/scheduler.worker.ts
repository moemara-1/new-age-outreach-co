import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";

const AGENT = "scheduler";

const STALLED_DAYS = 7;
const NO_REPLY_DAYS = 5;

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
          select: { id: true },
          take: 20,
        });

        if (stalledLeads.length > 0) {
          const outreachQueue = new Queue("outreach", { connection });
          for (const lead of stalledLeads) {
            const run = await db.agentRun.create({
              data: { agent: "OUTREACH", status: "QUEUED", input: { leadId: lead.id } as unknown as Prisma.InputJsonValue },
            });
            await outreachQueue.add("outreach", { leadId: lead.id, agentRunId: run.id });
            queued++;
          }
          logger.info(AGENT, `Queued outreach for ${stalledLeads.length} stalled leads`);
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
