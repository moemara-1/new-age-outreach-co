import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { verifyApiKey } from "@/integrations/openclaw/client";

export async function POST(request: Request): Promise<NextResponse> {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, location, category } = body;

  if (!name || !location || !category) {
    return NextResponse.json({ error: "name, location, and category are required" }, { status: 400 });
  }

  const campaign = await db.campaign.create({
    data: { name, location, category },
  });

  const agentRun = await db.agentRun.create({
    data: {
      agent: "SCOUT",
      campaignId: campaign.id,
      status: "QUEUED",
      input: { campaignId: campaign.id, location, category } as never,
    },
  });

  const scoutQueue = new Queue("scout", { connection: redis });
  await scoutQueue.add("scout", {
    campaignId: campaign.id,
    location,
    category,
    agentRunId: agentRun.id,
  });

  return NextResponse.json({ campaignId: campaign.id, agentRunId: agentRun.id, status: "queued" });
}
