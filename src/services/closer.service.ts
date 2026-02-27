import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateJSON, generateText } from "@/integrations/llm/openrouter";

const AGENT = "closer";

export type ReplyClassification = "INTERESTED" | "OBJECTION" | "QUESTION" | "NOT_INTERESTED";

type ClassifyResult = {
  classification: ReplyClassification;
  reasoning: string;
};

const STATUS_MAP: Record<ReplyClassification, string> = {
  INTERESTED: "INTERESTED",
  OBJECTION: "OBJECTION",
  QUESTION: "REPLIED",
  NOT_INTERESTED: "CLOSED_LOST",
};

export async function classifyReply(replyBody: string, context: string): Promise<ClassifyResult> {
  const prompt = `Classify this email reply from a business owner who was offered a free demo website.

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
}`;

  return generateJSON<ClassifyResult>(prompt, {
    task: "classify",
    system: "You classify business email replies. Be accurate. When in doubt between OBJECTION and NOT_INTERESTED, lean toward OBJECTION — most people are just cautious, not hostile.",
  });
}

export type CloserInput = {
  leadId: string;
  replyBody: string;
  outreachMessageId: string;
};

export type CloserResult = {
  leadId: string;
  classification: ReplyClassification;
  responseSubject: string;
  responseBody: string;
  autoSent: boolean;
};

export async function runCloser(input: CloserInput): Promise<CloserResult> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    include: { business: true, demoSite: true, payment: true, outreachMessages: { orderBy: { createdAt: "asc" } } },
  });

  const biz = lead.business;
  const originalMessage = lead.outreachMessages.find((m) => m.type === "INITIAL");
  const context = `Business: ${biz.name} (${biz.category}). Demo site: ${lead.demoSite?.url ?? "N/A"}. Original subject: "${originalMessage?.subject ?? "N/A"}"`;

  const { classification, reasoning } = await classifyReply(input.replyBody, context);
  logger.info(AGENT, `Classified reply from ${biz.name}: ${classification}`, { reasoning });

  const newStatus = STATUS_MAP[classification];
  await db.lead.update({
    where: { id: lead.id },
    data: { status: newStatus as never },
  });

  await db.outreachMessage.update({
    where: { id: input.outreachMessageId },
    data: { repliedAt: new Date(), replyBody: input.replyBody },
  });

  const paymentUrl = lead.payment?.stripeLinkUrl;
  const demoUrl = lead.demoSite?.url ?? "N/A";

  const responsePrompt = buildResponsePrompt(classification, {
    businessName: biz.name,
    contactName: lead.contactName ?? "there",
    replyBody: input.replyBody,
    demoUrl,
    paymentUrl: paymentUrl ?? null,
    category: biz.category ?? "local business",
  });

  const response = await generateText(responsePrompt, {
    task: "closer",
    system: "You are Max, a friendly web designer who builds websites for local businesses. Write a reply email. Be human, concise, and helpful. Never be pushy. Match the tone of the business owner's reply.",
  });

  const responseSubject = `Re: ${originalMessage?.subject ?? "Your website"}`;

  await db.activityLog.create({
    data: {
      agent: "CLOSER",
      title: `${classification}: ${biz.name} replied`,
      subtitle: reasoning,
      metadata: { leadId: lead.id, classification },
    },
  });

  logger.info(AGENT, `Generated response for ${biz.name} (${classification})`);

  return {
    leadId: lead.id,
    classification,
    responseSubject,
    responseBody: response,
    autoSent: false,
  };
}

function buildResponsePrompt(
  classification: ReplyClassification,
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
      return base + `They're interested! Thank them, reinforce value, and share the payment link if available. Keep it under 100 words. Write in HTML with <p> tags.`;

    case "OBJECTION":
      return base + `They have concerns. Address their specific objection directly and honestly. Don't be defensive. Offer to hop on a quick call if helpful. Keep it under 120 words. Write in HTML with <p> tags.`;

    case "QUESTION":
      return base + `They asked a question. Answer it directly and helpfully. If relevant, mention the demo site. Keep it under 100 words. Write in HTML with <p> tags.`;

    case "NOT_INTERESTED":
      return base + `They're not interested. Be gracious, thank them for their time, and let them know the demo site stays up if they change their mind. Keep it under 60 words. Write in HTML with <p> tags.`;
  }
}
