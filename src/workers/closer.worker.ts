import { Worker, Job } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { generateJSON, generateText } from "../integrations/llm/openrouter";
import { sendEmail } from "../integrations/email/resend";

const AGENT = "closer";

export type CloserJobData = {
  leadId: string;
  replyBody: string;
  outreachMessageId: string;
  agentRunId: string;
};

type ClassifyResult = {
  classification: "INTERESTED" | "OBJECTION" | "QUESTION" | "NOT_INTERESTED";
  reasoning: string;
};

const STATUS_MAP: Record<string, string> = {
  INTERESTED: "INTERESTED",
  OBJECTION: "OBJECTION",
  QUESTION: "REPLIED",
  NOT_INTERESTED: "CLOSED_LOST",
};

export function createCloserWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();

  return new Worker<CloserJobData>(
    "closer",
    async (job: Job<CloserJobData>) => {
      const { leadId, replyBody, outreachMessageId, agentRunId } = job.data;

      await db.agentRun.update({
        where: { id: agentRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const lead = await db.lead.findUniqueOrThrow({
          where: { id: leadId },
          include: { business: true, demoSite: true, payment: true, outreachMessages: { orderBy: { createdAt: "asc" } } },
        });

        const biz = lead.business;
        const originalMessage = lead.outreachMessages.find((m) => m.type === "INITIAL");
        const context = `Business: ${biz.name} (${biz.category}). Demo site: ${lead.demoSite?.url ?? "N/A"}. Original subject: "${originalMessage?.subject ?? "N/A"}"`;

        const { classification, reasoning } = await generateJSON<ClassifyResult>(
          `Classify this email reply from a business owner who was offered a free demo website.

Context about the outreach:
${context}

Their reply:
${replyBody}

Classify as one of:
- INTERESTED: They want to proceed, asked about pricing, or said something positive
- OBJECTION: They have concerns (cost, timing, trust) but aren't a flat no
- QUESTION: They asked a question that isn't clearly positive or negative
- NOT_INTERESTED: Clear rejection, asked to stop emailing, or hostile

Generate JSON:
{
  "classification": "INTERESTED | OBJECTION | QUESTION | NOT_INTERESTED",
  "reasoning": "Brief explanation (1 sentence)"
}`,
          {
            task: "classify",
            system: "You classify business email replies. Be accurate. When in doubt between OBJECTION and NOT_INTERESTED, lean toward OBJECTION.",
          }
        );

        logger.info(AGENT, `Classified ${biz.name}: ${classification}`, { reasoning });

        const newStatus = STATUS_MAP[classification];
        await db.lead.update({
          where: { id: lead.id },
          data: { status: newStatus as never },
        });

        await db.outreachMessage.update({
          where: { id: outreachMessageId },
          data: { repliedAt: new Date(), replyBody },
        });

        const paymentUrl = lead.payment?.stripeLinkUrl;
        const demoUrl = lead.demoSite?.url ?? "N/A";

        const responseBody = await generateText(
          buildResponsePrompt(classification, {
            businessName: biz.name,
            contactName: lead.contactName ?? "there",
            replyBody,
            demoUrl,
            paymentUrl: paymentUrl ?? null,
            category: biz.category ?? "local business",
          }),
          {
            task: "closer",
            system: "You are Max, a friendly web designer who builds websites for local businesses. Write a reply email. Be human, concise, and helpful. Never be pushy.",
          }
        );

        const responseSubject = `Re: ${originalMessage?.subject ?? "Your website"}`;
        const autoReply = process.env.CLOSER_AUTO_REPLY === "true";

        if (autoReply && lead.contactEmail && classification !== "NOT_INTERESTED") {
          const { resendId } = await sendEmail({
            to: lead.contactEmail,
            subject: responseSubject,
            html: responseBody,
            leadId: lead.id,
            messageType: "REPLY",
          });

          await db.outreachMessage.create({
            data: {
              leadId: lead.id,
              resendId,
              type: "REPLY",
              subject: responseSubject,
              body: responseBody,
              sentAt: new Date(),
            },
          });

          logger.info(AGENT, `Auto-sent reply to ${biz.name}`);
        } else {
          await db.outreachMessage.create({
            data: {
              leadId: lead.id,
              type: "REPLY",
              subject: responseSubject,
              body: responseBody,
            },
          });

          logger.info(AGENT, `Drafted reply for ${biz.name} (manual approval needed)`);
        }

        await db.activityLog.create({
          data: {
            agent: "CLOSER",
            title: `${classification}: ${biz.name} replied`,
            subtitle: reasoning,
            metadata: { leadId: lead.id, classification, autoSent: autoReply && classification !== "NOT_INTERESTED" },
          },
        });

        const result = {
          leadId: lead.id,
          classification,
          reasoning,
          responseSubject,
          autoSent: autoReply && classification !== "NOT_INTERESTED",
        };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

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
    { connection, concurrency: 3 }
  );
}

function buildResponsePrompt(
  classification: string,
  ctx: {
    businessName: string;
    contactName: string;
    replyBody: string;
    demoUrl: string;
    paymentUrl: string | null;
    category: string;
  }
): string {
  const base = `Write a reply to this business owner's email.

Business: ${ctx.businessName} (${ctx.category})
Contact: ${ctx.contactName}
Demo site: ${ctx.demoUrl}
${ctx.paymentUrl ? `Payment link: ${ctx.paymentUrl}` : ""}

Their reply:
${ctx.replyBody}

`;

  switch (classification) {
    case "INTERESTED":
      return base + "They're interested! Thank them, reinforce value, and share the payment link if available. Keep it under 100 words. Write in HTML with <p> tags.";
    case "OBJECTION":
      return base + "They have concerns. Address their specific objection directly and honestly. Don't be defensive. Offer to hop on a quick call if helpful. Keep it under 120 words. Write in HTML with <p> tags.";
    case "QUESTION":
      return base + "They asked a question. Answer it directly and helpfully. If relevant, mention the demo site. Keep it under 100 words. Write in HTML with <p> tags.";
    case "NOT_INTERESTED":
      return base + "They're not interested. Be gracious, thank them for their time, and let them know the demo site stays up if they change their mind. Keep it under 60 words. Write in HTML with <p> tags.";
    default:
      return base + "Write a helpful reply. Keep it under 100 words. Write in HTML with <p> tags.";
  }
}
