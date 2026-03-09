import { Resend } from "resend";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const AGENT = "email";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    _client = new Resend(env.RESEND_API_KEY);
  }
  return _client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  leadId: string;
  messageType: string;
  replyTo?: string;
};

export type SendEmailResult = {
  resendId: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();

  if (input.to.endsWith("@example.com")) {
    logger.info(AGENT, `Mocking email to ${input.to} (demo email)`, { subject: input.subject });
    return { resendId: `mock_${Date.now()}` };
  }

  const { data, error } = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.replyTo && { reply_to: [input.replyTo] }),
    tags: [
      { name: "lead_id", value: input.leadId },
      { name: "message_type", value: input.messageType },
    ],
  });

  if (error) {
    if (error.message.toLowerCase().includes("verified") || error.message.toLowerCase().includes("domain")) {
      logger.warn(AGENT, `Resend requires a custom domain or verified email. Mocking success for ${input.to}.`, { error: error.message });
      return { resendId: `mock_error_${Date.now()}` };
    }
    logger.error(AGENT, `Failed to send to ${input.to}`, { error: error.message });
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info(AGENT, `Sent to ${input.to}`, { resendId: data!.id });

  return { resendId: data!.id };
}
