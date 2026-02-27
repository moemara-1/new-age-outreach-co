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
};

export type SendEmailResult = {
  resendId: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getClient();

  const { data, error } = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    tags: [
      { name: "lead_id", value: input.leadId },
      { name: "message_type", value: input.messageType },
    ],
  });

  if (error) {
    logger.error(AGENT, `Failed to send to ${input.to}`, { error: error.message });
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info(AGENT, `Sent to ${input.to}`, { resendId: data!.id });

  return { resendId: data!.id };
}
