import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { generateJSON } from "@/integrations/llm/openrouter";

type Intent = {
  action: "scout" | "intel" | "builder" | "outreach" | "status" | "stats" | "unknown";
  location?: string;
  category?: string;
  leadId?: string;
  campaignId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const { message } = await request.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json({ reply: "Please type a message." });
  }

  const intent = await generateJSON<Intent>(
    `Parse this user message into an action intent.

Message: "${message}"

Available actions:
- scout: Find new leads. Needs location and category. Example: "Find plumbers in Austin"
- intel: Research a specific lead. Needs leadId.
- builder: Build a demo site for a lead. Needs leadId.
- outreach: Send outreach email to a lead. Needs leadId.
- status: Check system status or agent status.
- stats: Get dashboard statistics.
- unknown: Can't determine intent.

Generate JSON:
{
  "action": "scout | intel | builder | outreach | status | stats | unknown",
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

      const campaign = await db.campaign.create({
        data: {
          name: `${intent.category} in ${intent.location}`,
          location: intent.location,
          category: intent.category,
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
        where: { status: "RUNNING" },
        select: { agent: true, startedAt: true },
      });

      if (running.length === 0) {
        return NextResponse.json({ reply: "All agents are idle.", action: "status" });
      }

      const agentList = running.map((r) => r.agent.toLowerCase()).join(", ");
      return NextResponse.json({
        reply: `Active agents: ${agentList}`,
        action: "status",
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

    default:
      return NextResponse.json({
        reply: "I can help you find leads, check stats, or run agents. Try: 'Find plumbers in Austin' or 'Show me stats'",
        action: "unknown",
      });
  }
}
