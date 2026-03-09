export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AgentName } from "@prisma/client";

const AGENT_MAP: Record<string, AgentName> = {
  scout: "SCOUT",
  intel: "INTEL",
  builder: "BUILDER",
  outreach: "OUTREACH",
  closer: "CLOSER",
  growth: "GROWTH",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const agentEnum = AGENT_MAP[name.toLowerCase()];
  if (!agentEnum) {
    return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  }

  const latest = await db.agentRun.findFirst({
    where: { agent: agentEnum },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(latest ?? { status: "idle" });
}
