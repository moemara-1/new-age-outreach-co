import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { generateJSON, generateText } from "@/integrations/llm/openrouter";
import { logger } from "@/lib/logger";

type Intent = {
  action: "scout" | "intel" | "builder" | "outreach" | "run_pipeline" | "status" | "stats" | "unknown";
  location?: string;
  category?: string;
  leadId?: string;
  campaignId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  let message: string;
  try {
    const body = await request.json();
    message = body.message;
  } catch {
    return NextResponse.json({ reply: "Invalid request body." }, { status: 400 });
  }

  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "Please type a message." });
  }

  if (message.length > 1000) {
    return NextResponse.json({ reply: "Message too long. Keep it under 1000 characters." }, { status: 400 });
  }

  try {
    const intent = await generateJSON<Intent>(
      `Parse this user message into an action intent.

Message: "${message}"

Available actions:
- scout: Find new leads. Needs location and category. Example: "Find plumbers in Austin"
- intel: Research a specific lead. Needs leadId.
- builder: Build a demo site for a lead. Needs leadId.
- outreach: Send outreach email to a lead. Needs leadId.
- run_pipeline: Run all agents / run the pipeline / process leads / trigger agents. Use this when user wants to run ALL agents, the entire pipeline, or says things like "run the other agents", "process my leads", "trigger intel/builder/outreach", "continue the pipeline".
- status: Check system status or agent status.
- stats: Get dashboard statistics.
- unknown: Can't determine intent.

Generate JSON:
{
  "action": "scout | intel | builder | outreach | run_pipeline | status | stats | unknown",
  "location": "city/area if mentioned",
  "category": "business type if mentioned",
  "leadId": "lead ID if mentioned",
  "campaignId": "campaign ID if mentioned"
}`,
      {
        task: "classify",
        system: "You parse natural language into structured intents. Extract all relevant parameters. If unsure, use 'unknown'.",
      }
    );

    switch (intent.action) {
      case "scout": {
        if (!intent.location || !intent.category) {
          return NextResponse.json({ reply: "I need a location and business category. Example: 'Find restaurants in Portland'" });
        }

        const existing = await db.campaign.findFirst({
          where: {
            location: { equals: intent.location!, mode: "insensitive" },
            category: { equals: intent.category!, mode: "insensitive" },
            active: true,
          },
        });

        const campaign = existing ?? await db.campaign.create({
          data: {
            name: `${intent.category} in ${intent.location}`,
            location: intent.location!,
            category: intent.category!,
          },
        });

        const agentRun = await db.agentRun.create({
          data: {
            agent: "SCOUT",
            campaignId: campaign.id,
            status: "QUEUED",
            input: { campaignId: campaign.id, location: intent.location, category: intent.category } as never,
          },
        });

        const queue = new Queue("scout", { connection: redis });
        await queue.add("scout", {
          campaignId: campaign.id,
          location: intent.location,
          category: intent.category,
          agentRunId: agentRun.id,
        });

        return NextResponse.json({
          reply: `Searching for ${intent.category} in ${intent.location}. Scout agent is on it.`,
          action: "scout",
          campaignId: campaign.id,
        });
      }

      case "stats": {
        const [leads, sites, sent, replied, paid] = await Promise.all([
          db.lead.count(),
          db.demoSite.count(),
          db.outreachMessage.count({ where: { sentAt: { not: null } } }),
          db.outreachMessage.count({ where: { repliedAt: { not: null } } }),
          db.payment.count({ where: { paid: true } }),
        ]);

        return NextResponse.json({
          reply: `${leads} leads found, ${sites} demo sites built, ${sent} emails sent, ${replied} replies, ${paid} deals closed.`,
          action: "stats",
        });
      }

      case "status": {
        const running = await db.agentRun.findMany({
          where: { status: { in: ["RUNNING", "QUEUED"] } },
          select: { agent: true, status: true, startedAt: true },
        });

        if (running.length === 0) {
          return NextResponse.json({ reply: "All agents are idle. Say 'run the pipeline' to trigger Intel, Builder, and Outreach for existing leads.", action: "status" });
        }

        const agentList = running.map((r) => `${r.agent.toLowerCase()} (${r.status.toLowerCase()})`).join(", ");
        return NextResponse.json({
          reply: `Active agents: ${agentList}`,
          action: "status",
        });
      }

      case "run_pipeline": {
        // Count pending leads in each stage
        const [newCount, researchedCount, builtCount] = await Promise.all([
          db.lead.count({ where: { status: "NEW" } }),
          db.lead.count({ where: { status: "RESEARCHED" } }),
          db.lead.count({ where: { status: "SITE_BUILT" } }),
        ]);

        if (newCount === 0 && researchedCount === 0 && builtCount === 0) {
          return NextResponse.json({
            reply: "No pending leads to process. Run Scout first to find leads: 'Find [category] in [location]'",
            action: "run_pipeline",
          });
        }

        // Trigger the scheduler which processes all stages
        const schedulerQueue = new Queue("scheduler", { connection: redis });
        await schedulerQueue.add("scheduled-check", { agentRunId: "" });

        const parts = [];
        if (newCount > 0) parts.push(`${newCount} leads → Intel`);
        if (researchedCount > 0) parts.push(`${researchedCount} leads → Builder`);
        if (builtCount > 0) parts.push(`${builtCount} leads → Outreach`);

        return NextResponse.json({
          reply: `Pipeline triggered! Queuing: ${parts.join(", ")}. Agents will start processing with 10s stagger between each lead.`,
          action: "run_pipeline",
        });
      }

      case "intel":
      case "builder":
      case "outreach": {
        if (!intent.leadId) {
          return NextResponse.json({ reply: `I need a lead ID to run ${intent.action}. Which lead?` });
        }

        const lead = await db.lead.findUnique({ where: { id: intent.leadId } });
        if (!lead) {
          return NextResponse.json({ reply: `Lead "${intent.leadId}" not found.` });
        }

        const agentMap: Record<string, string> = { intel: "INTEL", builder: "BUILDER", outreach: "OUTREACH" };
        const agentRun = await db.agentRun.create({
          data: {
            agent: agentMap[intent.action] as never,
            status: "QUEUED",
            input: { leadId: intent.leadId } as never,
          },
        });

        const queue = new Queue(intent.action, { connection: redis });
        await queue.add(intent.action, { leadId: intent.leadId, agentRunId: agentRun.id });

        return NextResponse.json({
          reply: `Running ${intent.action} agent on lead ${intent.leadId}.`,
          action: intent.action,
        });
      }

      default: {
        // Fallback to conversational chat if intent is unknown
        const chatReply = await generateText(
          message,
          {
            task: "general",
            system: "You are the AI assistant for MAX (Marketing Agent E-Xperience). You help users find local business leads, build websites, and send outreach emails. Be helpful, concise, and conversational. Do not use markdown if possible.",
            maxTokens: 500
          }
        );

        return NextResponse.json({
          reply: chatReply,
          action: "unknown",
        });
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("api/chat", "Chat processing failed", { error: errorMsg });

    if (errorMsg.includes("GROQ_API_KEY")) {
      return NextResponse.json({ reply: "OpenRouter is busy. Please add GROQ_API_KEY to your .env file to enable the backup AI!" }, { status: 500 });
    }

    return NextResponse.json({ reply: "Something went wrong. Please try again." }, { status: 500 });
  }
}
