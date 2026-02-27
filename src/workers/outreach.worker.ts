import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { generateJSON } from "../integrations/llm/openrouter";
import { sendEmail } from "../integrations/email/resend";

const AGENT = "outreach";

export type OutreachJobData = {
  leadId: string;
  agentRunId: string;
  type?: "INITIAL" | "FOLLOW_UP_1" | "FOLLOW_UP_2" | "FOLLOW_UP_3";
};

type LLMEmail = {
  subject: string;
  body: string;
};

const FOLLOW_UP_CONTEXT: Record<string, string> = {
  INITIAL: "This is the first outreach. Be warm, curious, and lead with value (the free demo site).",
  FOLLOW_UP_1: "This is a gentle follow-up 3 days after the initial email. Keep it short. Reference the demo site again.",
  FOLLOW_UP_2: "This is a second follow-up 7 days after initial. Try a different angle — mention a competitor or local trend.",
  FOLLOW_UP_3: "This is the final follow-up 14 days after initial. Be respectful of their time, offer one last look, no pressure.",
};

const FOLLOW_UP_DELAYS: Record<string, number> = {
  FOLLOW_UP_1: 3 * 24 * 60 * 60 * 1000,
  FOLLOW_UP_2: 7 * 24 * 60 * 60 * 1000,
  FOLLOW_UP_3: 14 * 24 * 60 * 60 * 1000,
};

export function createOutreachWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();

  return new Worker<OutreachJobData>(
    "outreach",
    async (job: Job<OutreachJobData>) => {
      const { leadId, agentRunId, type } = job.data;
      const messageType = type ?? "INITIAL";

      await db.agentRun.update({
        where: { id: agentRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const lead = await db.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: { business: true, demoSite: true, outreachMessages: true },
        });

        if (!lead.contactEmail) {
          throw new Error(`Lead ${lead.id} has no contact email`);
        }

        const skipStatuses = ["REPLIED", "INTERESTED", "CLOSED_WON", "CLOSED_LOST", "UNSUBSCRIBED"];
        if (skipStatuses.includes(lead.status)) {
          logger.info(AGENT, `Skipping ${lead.business.name} — status: ${lead.status}`);
          const result = { leadId: lead.id, skipped: true, reason: lead.status };
          await db.agentRun.update({
            where: { id: agentRunId },
            data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
          });
          return result;
        }

        const alreadySent = lead.outreachMessages.some((m) => m.type === messageType);
        if (alreadySent) {
          logger.info(AGENT, `Already sent ${messageType} to ${lead.business.name}`);
          const result = { leadId: lead.id, skipped: true, reason: "already_sent" };
          await db.agentRun.update({
            where: { id: agentRunId },
            data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
          });
          return result;
        }

        const biz = lead.business;
        const demoUrl = lead.demoSite?.url ?? "N/A";

        const prompt = `Write a cold outreach email for this local business.

Business: ${biz.name}
Category: ${biz.category ?? "Local business"}
Location: ${biz.address ?? "Unknown"}
Contact: ${lead.contactName ?? "Business Owner"}
Demo site URL: ${demoUrl}

${FOLLOW_UP_CONTEXT[messageType]}

Generate JSON:
{
  "subject": "Email subject line (max 60 chars, no spam words, personalized)",
  "body": "Email body in HTML. Keep it under 150 words. Use <p> tags. Include a link to the demo site as a button-style link. Sign off as Max."
}`;

        const email = await generateJSON<LLMEmail>(prompt, {
          task: "outreach",
          system: "You write compelling, personalized cold outreach emails for a web design service. Be concise, human, and value-first. Never use spam words like 'limited time' or 'act now'.",
        });

        const { resendId } = await sendEmail({
          to: lead.contactEmail,
          subject: email.subject,
          html: email.body,
          leadId: lead.id,
          messageType,
        });

        await db.outreachMessage.create({
          data: {
            leadId: lead.id,
            resendId,
            type: messageType,
            subject: email.subject,
            body: email.body,
            sentAt: new Date(),
          },
        });

        if (messageType === "INITIAL") {
          await db.lead.update({
            where: { id: lead.id },
            data: { status: "CONTACTED" },
          });

          const outreachQueue = new Queue("outreach", { connection });
          for (const [followUpType, delay] of Object.entries(FOLLOW_UP_DELAYS)) {
            const followUpRun = await db.agentRun.create({
              data: { agent: "OUTREACH", status: "QUEUED", input: { leadId, type: followUpType } as unknown as Prisma.InputJsonValue },
            });
            await outreachQueue.add("outreach", {
              leadId,
              agentRunId: followUpRun.id,
              type: followUpType,
            }, { delay });
          }
          logger.info(AGENT, `Scheduled 3 follow-ups for ${biz.name}`);
        }

        await db.activityLog.create({
          data: {
            agent: "OUTREACH",
            title: `Sent ${messageType.toLowerCase().replace("_", " ")} to ${biz.name}`,
            subtitle: email.subject,
            metadata: { leadId: lead.id, messageType },
          },
        });

        const result = { leadId: lead.id, subject: email.subject, type: messageType };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

        logger.info(AGENT, `Sent ${messageType} to ${biz.name} (${lead.contactEmail})`);
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
    { connection, concurrency: 5 }
  );
}
