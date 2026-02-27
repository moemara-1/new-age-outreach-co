import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

type ResendEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.opened"
  | "email.clicked"
  | "email.bounced"
  | "email.complained";

type ResendWebhookPayload = {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    tags?: Array<{ name: string; value: string }>;
    click?: { link: string };
  };
};

export async function POST(request: Request): Promise<NextResponse> {
  const svix = new Webhook(env.RESEND_WEBHOOK_SECRET);
  const rawBody = await request.text();

  let payload: ResendWebhookPayload;
  try {
    payload = svix.verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendWebhookPayload;
  } catch {
    logger.warn("webhooks/email", "Invalid webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { type, data } = payload;
  const resendId = data.email_id;

  logger.info("webhooks/email", `Event: ${type}`, { resendId });

  const message = await db.outreachMessage.findUnique({
    where: { resendId },
    include: { lead: true },
  });

  if (!message) {
    logger.warn("webhooks/email", `No message found for resendId: ${resendId}`);
    return NextResponse.json({ received: true });
  }

  switch (type) {
    case "email.opened":
      if (!message.openedAt) {
        await db.outreachMessage.update({
          where: { id: message.id },
          data: { openedAt: new Date() },
        });
        await db.activityLog.create({
          data: {
            agent: "OUTREACH",
            title: `${message.lead.contactName ?? "Lead"} opened email`,
            subtitle: message.subject,
            metadata: { leadId: message.leadId },
          },
        });
      }
      break;

    case "email.clicked":
      if (!message.clickedAt) {
        await db.outreachMessage.update({
          where: { id: message.id },
          data: { clickedAt: new Date() },
        });
        await db.activityLog.create({
          data: {
            agent: "OUTREACH",
            title: `${message.lead.contactName ?? "Lead"} clicked demo link`,
            subtitle: data.click?.link ?? message.subject,
            metadata: { leadId: message.leadId },
          },
        });
      }
      break;

    case "email.bounced":
      await db.lead.update({
        where: { id: message.leadId },
        data: { status: "CLOSED_LOST" },
      });
      await db.activityLog.create({
        data: {
          agent: "OUTREACH",
          title: `Email bounced for ${message.lead.contactName ?? "lead"}`,
          subtitle: message.subject,
          metadata: { leadId: message.leadId },
        },
      });
      break;

    case "email.complained":
      await db.lead.update({
        where: { id: message.leadId },
        data: { status: "UNSUBSCRIBED" },
      });
      break;

    case "email.sent":
    case "email.delivered":
    case "email.delivery_delayed":
      break;
  }

  return NextResponse.json({ received: true });
}
