import { Worker, Job } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { generateJSON } from "../integrations/llm/openrouter";

const AGENT = "intel";

export type IntelJobData = {
  leadId: string;
  agentRunId: string;
};

type BusinessProfile = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  score: number;
  suggestedServices: string[];
};

export function createIntelWorker(connection: { host: string; port: number }) {
  const db = new PrismaClient();

  return new Worker<IntelJobData>(
    "intel",
    async (job: Job<IntelJobData>) => {
      const { leadId, agentRunId } = job.data;

      await db.agentRun.update({
        where: { id: agentRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });

      try {
        const lead = await db.lead.findUniqueOrThrow({
          where: { id: leadId },
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

        const result = { leadId: lead.id, score, profile };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

        logger.info(AGENT, `Completed: ${biz.name}, score=${score}`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "FAILED", finishedAt: new Date(), error: message },
        });
        logger.error(AGENT, "Failed", { error: message });
        throw err;
      }
    },
    { connection, concurrency: 3 }
  );
}
