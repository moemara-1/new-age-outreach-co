import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { generateJSON } from "@/integrations/llm/openrouter";

const AGENT = "intel";

export type IntelInput = {
  leadId: string;
};

export type BusinessProfile = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  score: number;
  suggestedServices: string[];
};

export type IntelResult = {
  leadId: string;
  score: number;
  profile: BusinessProfile;
};

export async function runIntel(input: IntelInput): Promise<IntelResult> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    include: { business: true },
  });

  const biz = lead.business;
  logger.info(AGENT, `Researching: ${biz.name}`);

  const prompt = `Analyze this local business and provide a lead quality assessment.

Business: ${biz.name}
Category: ${biz.category ?? "Unknown"}
Address: ${biz.address ?? "Unknown"}
Rating: ${biz.rating ?? "N/A"} (${biz.reviewCount ?? 0} reviews)
Phone: ${biz.phone ?? "None listed"}
Website: ${biz.website ?? "None"}

Respond as JSON with this exact structure:
{
  "summary": "2-3 sentence business overview",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "opportunities": ["opportunity for a website/digital presence"],
  "score": 0-100 (lead quality score, higher = more likely to convert),
  "suggestedServices": ["website", "seo", "google-business-profile"]
}

Scoring guide:
- 80-100: High rating, many reviews, no website, clear need
- 60-79: Good business, moderate need
- 40-59: Average, uncertain need
- 0-39: Low potential`;

  const profile = await generateJSON<BusinessProfile>(prompt, {
    task: "intel",
    system: "You are a business analyst scoring local businesses for website lead generation.",
  });

  const score = Math.max(0, Math.min(100, Math.round(profile.score)));

  await db.lead.update({
    where: { id: lead.id },
    data: {
      status: "RESEARCHED",
      leadScore: score,
      profileJson: profile as unknown as Prisma.InputJsonValue,
    },
  });

  await db.activityLog.create({
    data: {
      agent: "INTEL",
      title: `Audited ${biz.name} — score ${score}`,
      subtitle: profile.summary.slice(0, 120),
      metadata: { leadId: lead.id, score },
    },
  });

  logger.info(AGENT, `Completed: ${biz.name}, score=${score}`);

  return { leadId: lead.id, score, profile };
}
