import { Worker, Job, Queue } from "bullmq";
import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { generateJSON } from "../integrations/llm/openrouter";
import { deepBusinessResearch } from "../integrations/search/searxng";

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
  targetAudience: string;
  keyDifferentiator: string;
  menuHighlights?: string[];
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
        logger.info(AGENT, `Deep research starting: ${biz.name}`);

        // ─── Step 1: Multi-query SearXNG research ───
        const research = await deepBusinessResearch(biz.name, biz.address, biz.category);

        // ─── Step 2: Determine best email ───
        // Priority: existing lead email > SearXNG-discovered emails > Google Maps (none stored)
        let contactEmail: string | null = lead.contactEmail;
        if (!contactEmail && research.emails.length > 0) {
          contactEmail = research.emails[0]; // Already sorted by relevance in searxng.ts
          logger.info(AGENT, `Found email for ${biz.name}: ${contactEmail}`);
        }

        // ─── Step 3: Determine best phone ───
        let contactPhone: string | null = biz.phone;
        if (!contactPhone && research.phones.length > 0) {
          contactPhone = research.phones[0];
        }

        // ─── Step 4: Build comprehensive LLM prompt with ALL data ───
        const prompt = `You are a business intelligence analyst. Analyze this local business using ALL the data below.
This analysis will be used by:
- A WEBSITE BUILDER agent to create a stunning custom demo website
- An OUTREACH agent to write a highly personalized cold email
So be as SPECIFIC and DETAILED as possible.

## GOOGLE MAPS DATA
Business: ${biz.name}
Category: ${biz.category ?? "Unknown"}
Address: ${biz.address ?? "Unknown"}
Rating: ${biz.rating ?? "N/A"} stars (${biz.reviewCount ?? 0} reviews)
Phone: ${contactPhone ?? "Not found"}
Existing Website: ${biz.website ?? "None — this is why they need us!"}

## WEB SEARCH RESULTS (from Google, Bing, DuckDuckGo)
${research.webSnippets || "No web results found. Analyze based on Google Maps data only."}

## DISCOVERED SOCIAL MEDIA
${research.socialLinks.length > 0 ? research.socialLinks.map((s) => `- ${s.platform}: ${s.url}`).join("\n") : "None found"}

## DISCOVERED CONTACT INFO
Emails found: ${research.emails.length > 0 ? research.emails.join(", ") : "None"}
Phones found: ${research.phones.length > 0 ? research.phones.join(", ") : contactPhone || "None"}

${research.menuInfo ? `## MENU / FOOD INFO\n${research.menuInfo}` : ""}

## RESPOND WITH THIS JSON:
{
  "summary": "4-6 sentences. Deep analysis of what this business does, who their customers are, what's unique about them, and their specific digital presence gaps. Reference REAL data from the search results — mention their reviews, social media activity, menu items, neighborhood etc. Never be generic.",
  "strengths": ["3-5 specific strengths from real data"],
  "weaknesses": ["2-4 specific weaknesses / gaps"],
  "opportunities": ["2-3 specific website/digital opportunities"],
  "score": 0-100,
  "suggestedServices": ["website", "online-menu", "seo", "google-business", "social-media", "online-ordering", "reservation-system"],
  "targetAudience": "Who are their customers? Be specific.",
  "keyDifferentiator": "What makes this business unique vs competitors?"${research.menuInfo ? ',\n  "menuHighlights": ["3-5 popular or notable menu items if available"]' : ""}
}

SCORING: 80-100 = hot lead (high reviews, no website, strong need). 60-79 = warm. 40-59 = luke warm. 0-39 = low potential.`;

        const profile = await generateJSON<BusinessProfile>(prompt, {
          task: "intel",
          system: "You are a senior business analyst. Use EVERY piece of real data provided. Reference specific review counts, menu items, social media handles, and neighborhoods. Never give generic platitudes. Your analysis directly determines the quality of the website we build and the email we send.",
        });

        const score = Math.max(0, Math.min(100, Math.round(profile.score)));

        // ─── Step 5: Save EVERYTHING to the lead ───
        const fullProfile = {
          ...profile,
          discoveredEmails: research.emails,
          discoveredPhones: research.phones,
          socialLinks: research.socialLinks,
          menuInfo: research.menuInfo || undefined,
          webSearchUsed: research.webSnippets.length > 0,
        };

        await db.lead.update({
          where: { id: lead.id },
          data: {
            status: "RESEARCHED",
            leadScore: score,
            profileJson: fullProfile as unknown as Prisma.InputJsonValue,
            ...(contactEmail && { contactEmail }),
            contactName: biz.name, // Use business name as contact name
          },
        });

        // Update business phone if we found one from web search
        if (contactPhone && !biz.phone) {
          await db.business.update({
            where: { id: biz.id },
            data: { phone: contactPhone },
          });
        }

        await db.activityLog.create({
          data: {
            agent: "INTEL",
            title: `Researched ${biz.name} — score ${score}`,
            subtitle: `${research.emails.length} emails, ${research.phones.length} phones, ${research.socialLinks.length} socials found`,
            metadata: {
              leadId: lead.id,
              score,
              emailFound: contactEmail ?? null,
              phonesFound: research.phones,
              socialsFound: research.socialLinks.map((s) => s.platform),
            },
          },
        });

        const result = { leadId: lead.id, score, contactEmail, contactPhone, profile: fullProfile };

        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "COMPLETED", finishedAt: new Date(), output: result as unknown as Prisma.InputJsonValue },
        });

        // Trigger scheduler for Builder
        const schedulerQueue = new Queue("scheduler", { connection });
        await schedulerQueue.add("scheduled-check", { agentRunId: "" });

        logger.info(AGENT, `Completed: ${biz.name}, score=${score}, email=${contactEmail ?? "none"}, phone=${contactPhone ?? "none"}`);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db.agentRun.update({
          where: { id: agentRunId },
          data: { status: "FAILED", finishedAt: new Date(), error: message },
        });
        await db.activityLog.create({
          data: { agent: "INTEL", title: `Failed to research lead`, subtitle: message },
        });
        throw err;
      }
    },
    { connection, concurrency: 1 }
  );
}
