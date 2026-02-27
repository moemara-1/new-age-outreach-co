import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const AGENT = "openclaw";

export type OpenClawEvent =
  | "lead.found"
  | "lead.researched"
  | "lead.site_built"
  | "lead.contacted"
  | "lead.replied"
  | "lead.interested"
  | "lead.closed_won"
  | "lead.closed_lost";

type EventPayload = {
  event: OpenClawEvent;
  leadId: string;
  data: Record<string, unknown>;
};

export async function notifyOpenClaw(payload: EventPayload): Promise<void> {
  const webhookUrl = env.OPENCLAW_WEBHOOK_URL;
  if (!webhookUrl) return;

  const apiKey = env.OPENCLAW_API_KEY;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-api-key": apiKey }),
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      logger.warn(AGENT, `Webhook returned ${res.status}`, { event: payload.event });
    } else {
      logger.debug(AGENT, `Notified: ${payload.event}`, { leadId: payload.leadId });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(AGENT, `Webhook failed: ${message}`, { event: payload.event });
  }
}

export function verifyApiKey(request: Request): boolean {
  const expected = env.OPENCLAW_API_KEY;
  if (!expected) return true;
  const provided = request.headers.get("x-api-key");
  return provided === expected;
}
