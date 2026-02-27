import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { verifyApiKey } from "@/integrations/openclaw/client";
import { createLeadPayment } from "@/services/payment.service";

const VALID_ACTIONS = ["intel", "builder", "outreach", "closer", "payment"] as const;
type Action = typeof VALID_ACTIONS[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await params;
  const body = await request.json();
  const action = body.action as Action;

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `Invalid action. Valid: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (action === "payment") {
    const result = await createLeadPayment({
      leadId,
      amountCents: body.amountCents ?? 49900,
      currency: body.currency ?? "usd",
    });
    return NextResponse.json(result);
  }

  const agentMap: Record<string, string> = {
    intel: "INTEL",
    builder: "BUILDER",
    outreach: "OUTREACH",
    closer: "CLOSER",
  };

  const agentRun = await db.agentRun.create({
    data: {
      agent: agentMap[action] as never,
      status: "QUEUED",
      input: { leadId, ...body } as never,
    },
  });

  const queue = new Queue(action, { connection: redis });
  await queue.add(action, { leadId, agentRunId: agentRun.id, ...body });

  return NextResponse.json({ agentRunId: agentRun.id, status: "queued" });
}
