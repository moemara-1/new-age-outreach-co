import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyWebhookSignature } from "@/integrations/payment/stripe";
import { markPaymentComplete } from "@/services/payment.service";
import { logger } from "@/lib/logger";

export async function POST(request: Request): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch {
    logger.warn("webhooks/stripe", "Invalid webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  logger.info("webhooks/stripe", `Event: ${event.type}`, { eventId: event.id });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const leadId = session.metadata?.lead_id;

    if (!leadId) {
      logger.warn("webhooks/stripe", "checkout.session.completed missing lead_id", { sessionId: session.id });
      return NextResponse.json({ received: true });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? session.id;

    try {
      await markPaymentComplete({ leadId, stripePaymentId: paymentIntentId });
    } catch (err) {
      logger.error("webhooks/stripe", "Failed to process payment", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
