import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/integrations/openclaw/client";

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const campaignId = searchParams.get("campaignId");
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (campaignId) where.campaignId = campaignId;

  const leads = await db.lead.findMany({
    where,
    include: {
      business: { select: { name: true, category: true, address: true, phone: true } },
      demoSite: { select: { url: true } },
      payment: { select: { paid: true, stripeLinkUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(leads);
}
