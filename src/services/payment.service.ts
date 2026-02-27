import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createPaymentLink } from "@/integrations/payment/stripe";
import { notifyOpenClaw } from "@/integrations/openclaw/client";

const AGENT = "payment";

export type CreatePaymentInput = {
  leadId: string;
  amountCents: number;
  currency?: string;
};

export type CreatePaymentResult = {
  paymentId: string;
  stripeLinkUrl: string;
};

export async function createLeadPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  const { leadId, amountCents, currency = "usd" } = input;

  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true, payment: true },
  });

  if (lead.payment) {
    logger.info(AGENT, `Payment already exists for ${lead.business.name}`);
    return { paymentId: lead.payment.id, stripeLinkUrl: lead.payment.stripeLinkUrl ?? "" };
  }

  const { url } = await createPaymentLink({
    leadId,
    businessName: lead.business.name,
    amountCents,
    currency,
  });

  const payment = await db.payment.create({
    data: {
      leadId,
      stripeLinkUrl: url,
      amount: amountCents,
      currency,
    },
  });

  await db.activityLog.create({
    data: {
      agent: "OUTREACH",
      title: `Created payment link for ${lead.business.name}`,
      subtitle: `$${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`,
      metadata: { leadId, paymentId: payment.id },
    },
  });

  logger.info(AGENT, `Created payment for ${lead.business.name}`, { paymentId: payment.id });

  return { paymentId: payment.id, stripeLinkUrl: url };
}

export async function markPaymentComplete(params: {
  leadId: string;
  stripePaymentId: string;
}): Promise<void> {
  const { leadId, stripePaymentId } = params;

  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true, payment: true },
  });

  if (lead.payment?.paid) {
    logger.info(AGENT, `Payment already marked complete for ${lead.business.name}`);
    return;
  }

  if (lead.payment) {
    await db.payment.update({
      where: { id: lead.payment.id },
      data: { paid: true, paidAt: new Date(), stripePaymentId },
    });
  } else {
    await db.payment.create({
      data: {
        leadId,
        stripePaymentId,
        amount: 0,
        paid: true,
        paidAt: new Date(),
      },
    });
  }

  await db.lead.update({
    where: { id: leadId },
    data: { status: "CLOSED_WON" },
  });

  await db.activityLog.create({
    data: {
      agent: "CLOSER",
      title: `${lead.business.name} paid!`,
      subtitle: `Lead closed — payment confirmed`,
      metadata: { leadId, stripePaymentId },
    },
  });

  notifyOpenClaw({ event: "lead.closed_won", leadId, data: { stripePaymentId, businessName: lead.business.name } });

  logger.info(AGENT, `Payment complete for ${lead.business.name}`, { stripePaymentId });
}
