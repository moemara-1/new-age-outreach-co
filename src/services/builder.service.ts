import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateJSON } from "@/integrations/llm/openrouter";
import { buildHTML, type SiteCopy } from "@/templates/base";

const AGENT = "builder";

export type BuilderInput = {
  leadId: string;
};

type LLMCopy = {
  headline: string;
  about: string;
  services: string[];
  cta: string;
};

const CATEGORY_TEMPLATE: Record<string, "restaurant" | "plumber" | "generic"> = {
  restaurant: "restaurant",
  cafe: "restaurant",
  bar: "restaurant",
  bakery: "restaurant",
  plumber: "plumber",
  plumbing: "plumber",
  electrician: "generic",
};

function pickTemplate(category?: string | null): "restaurant" | "plumber" | "generic" {
  if (!category) return "generic";
  const lower = category.toLowerCase();
  for (const [key, template] of Object.entries(CATEGORY_TEMPLATE)) {
    if (lower.includes(key)) return template;
  }
  return "generic";
}

export async function runBuilder(input: BuilderInput): Promise<{
  leadId: string;
  url: string;
  template: string;
}> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    include: { business: true },
  });

  const biz = lead.business;
  const template = pickTemplate(biz.category);

  logger.info(AGENT, `Generating copy for: ${biz.name} (${template})`);

  const prompt = `Write website copy for this local business.

Business: ${biz.name}
Category: ${biz.category ?? "Local business"}
Location: ${biz.address ?? "Unknown"}
Rating: ${biz.rating ?? "N/A"} (${biz.reviewCount ?? 0} reviews)

Generate JSON:
{
  "headline": "Short catchy headline (max 8 words)",
  "about": "2-3 paragraph about section (150-200 words). Professional, warm, local-focused.",
  "services": ["Service 1", "Service 2", "Service 3", "Service 4", "Service 5"],
  "cta": "Call-to-action button text (3-5 words)"
}

Write as if you are the business owner. Be specific to their category. Don't be generic.`;

  const copy = await generateJSON<LLMCopy>(prompt, {
    task: "builder-copy",
    system: "You write compelling website copy for local businesses. Be specific, warm, and professional.",
  });

  const siteCopy: SiteCopy = {
    businessName: biz.name,
    headline: copy.headline,
    about: copy.about,
    services: copy.services,
    cta: copy.cta,
    phone: biz.phone ?? undefined,
    address: biz.address ?? undefined,
  };

  const html = buildHTML(siteCopy, template);

  // TODO: Deploy to Cloudflare Pages — for now store HTML and use placeholder URL
  const placeholderUrl = `https://${lead.id}.max-demo.pages.dev`;

  await db.demoSite.upsert({
    where: { leadId: lead.id },
    update: {
      url: placeholderUrl,
      template,
      htmlContent: html,
      copyJson: copy as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
    create: {
      leadId: lead.id,
      url: placeholderUrl,
      template,
      htmlContent: html,
      copyJson: copy as unknown as Prisma.InputJsonValue,
    },
  });

  await db.lead.update({
    where: { id: lead.id },
    data: { status: "SITE_BUILT" },
  });

  await db.activityLog.create({
    data: {
      agent: "BUILDER",
      title: `Built demo site for ${biz.name}`,
      subtitle: `${template} template — ${copy.headline}`,
      metadata: { leadId: lead.id, template },
    },
  });

  logger.info(AGENT, `Built: ${biz.name} -> ${placeholderUrl}`);

  return { leadId: lead.id, url: placeholderUrl, template };
}
