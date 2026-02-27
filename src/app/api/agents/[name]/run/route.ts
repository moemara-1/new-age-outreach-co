import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { Queue } from "bullmq";
import { AgentName } from "@prisma/client";

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
}
