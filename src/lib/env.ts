function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  get REDIS_URL() { return optional("REDIS_URL", "redis://localhost:6379"); },
  get OPENROUTER_API_KEY() { return required("OPENROUTER_API_KEY"); },
  get GOOGLE_MAPS_API_KEY() { return required("GOOGLE_MAPS_API_KEY"); },
  get RESEND_API_KEY() { return required("RESEND_API_KEY"); },
  get RESEND_WEBHOOK_SECRET() { return required("RESEND_WEBHOOK_SECRET"); },
  get RESEND_FROM_EMAIL() { return optional("RESEND_FROM_EMAIL", "Max <outreach@yourdomain.com>"); },
  get STRIPE_SECRET_KEY() { return required("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET() { return required("STRIPE_WEBHOOK_SECRET"); },
  get CLOUDFLARE_API_TOKEN() { return required("CLOUDFLARE_API_TOKEN"); },
  get CLOUDFLARE_ACCOUNT_ID() { return required("CLOUDFLARE_ACCOUNT_ID"); },
  get OPENCLAW_WEBHOOK_URL() { return optional("OPENCLAW_WEBHOOK_URL"); },
  get OPENCLAW_API_KEY() { return optional("OPENCLAW_API_KEY"); },
  get CLOSER_AUTO_REPLY() { return optional("CLOSER_AUTO_REPLY", "false") === "true"; },
  get APP_URL() { return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"); },
} as const;
