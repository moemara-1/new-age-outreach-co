import { logger } from "../../lib/logger";

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

export function notifyOpenClaw(payload: EventPayload): void {
  const webhookUrl = process.env.OPENCLAW_WEBHOOK_URL;
  if (!webhookUrl) return;

  const apiKey = process.env.OPENCLAW_API_KEY;

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey && { "x-api-key": apiKey }),
    },
    body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() }),
  }).catch((err) => {
    logger.warn("openclaw", `Webhook failed: ${err instanceof Error ? err.message : String(err)}`);
  });
}
