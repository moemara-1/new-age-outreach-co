import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

type InboundEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body: InboundEmail = await request.json();

  logger.info("webhooks/email/inbound", "Received reply", { from: body.from, subject: body.subject });

  const toAddress = body.to[0] ?? "";
  const leadIdMatch = toAddress.match(/replies\+([^@]+)@/);
  const leadId = leadIdMatch?.[1];

  if (!leadId) {
    logger.warn("webhooks/email/inbound", "Could not extract lead_id from To address", { to: toAddress });
    return NextResponse.json({ received: true, processed: false });
  }

  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { outreachMessages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (!lead) {
    logger.warn("webhooks/email/inbound", `Lead not found: ${leadId}`);
    return NextResponse.json({ received: true, processed: false });
  }

  const latestMessage = lead.outreachMessages[0];
  if (!latestMessage) {
    logger.warn("webhooks/email/inbound", `No outreach messages for lead: ${leadId}`);
    return NextResponse.json({ received: true, processed: false });
  }

  await db.lead.update({
    where: { id: leadId },
    data: { status: "REPLIED" },
  });

  const agentRun = await db.agentRun.create({
    data: {
      agent: "CLOSER",
      status: "QUEUED",
      input: { leadId, replyBody: body.text, outreachMessageId: latestMessage.id } as never,
    },
  });

  const closerQueue = new Queue("closer", { connection: redis });
  await closerQueue.add("closer", {
    leadId,
    replyBody: body.text,
    outreachMessageId: latestMessage.id,
    agentRunId: agentRun.id,
  });

  await db.activityLog.create({
    data: {
      agent: "CLOSER",
      title: `Reply received from ${lead.contactName ?? "lead"}`,
      subtitle: body.subject,
      metadata: { leadId },
    },
  });

  logger.info("webhooks/email/inbound", `Enqueued closer job for lead ${leadId}`);

  return NextResponse.json({ received: true, processed: true });
}
