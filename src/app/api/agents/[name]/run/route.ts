import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { Queue } from "bullmq";
import { AgentName } from "@prisma/client";
import { logger } from "@/lib/logger";

const AGENT_MAP: Record<string, AgentName> = {
  scout: "SCOUT",
  intel: "INTEL",
  builder: "BUILDER",
  outreach: "OUTREACH",
  closer: "CLOSER",
  growth: "GROWTH",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const agentEnum = AGENT_MAP[name.toLowerCase()];
  if (!agentEnum) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  try {
    const body = await request.json();

    const agentRun = await db.agentRun.create({
      data: {
        agent: agentEnum,
        campaignId: body.campaignId,
        status: "QUEUED",
        input: body,
      },
    });

    const queue = new Queue(name.toLowerCase(), { connection: redis });
    await queue.add(name.toLowerCase(), {
      ...body,
      agentRunId: agentRun.id,
    });

    return NextResponse.json({ agentRunId: agentRun.id, status: "queued" });
  } catch (err) {
    logger.error("api/agents/run", `Failed to enqueue ${name}`, { error: String(err) });
    return NextResponse.json({ error: "Failed to enqueue agent run" }, { status: 500 });
  }
}
