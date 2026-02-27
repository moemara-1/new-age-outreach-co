import Stripe from "stripe";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const AGENT = "payment";

let _client: Stripe | null = null;

function getClient(): Stripe {
  if (!_client) {
    _client = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return _client;
}

export { getClient as getStripeClient };

export async function createPaymentLink(params: {
  leadId: string;
  businessName: string;
  amountCents: number;
  currency?: string;
}): Promise<{ url: string }> {
  const { leadId, businessName, amountCents, currency = "usd" } = params;
  const stripe = getClient();

  const price = await stripe.prices.create({
    currency,
    unit_amount: amountCents,
    product_data: {
      name: `Website setup for ${businessName}`,
    },
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { lead_id: leadId },
    after_completion: {
      type: "hosted_confirmation",
      hosted_confirmation: {
        custom_message: `Thank you! Your website for ${businessName} will be live within 24 hours.`,
      },
    },
  });

  logger.info(AGENT, `Created payment link for ${businessName}`, { leadId, url: paymentLink.url });

  return { url: paymentLink.url };
}

export function verifyWebhookSignature(rawBody: string, signature: string): Stripe.Event {
  const stripe = getClient();
  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
