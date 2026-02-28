import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const status = searchParams.get("status");
    const limit = Math.min(Number(searchParams.get("limit") || 50), 200);
    const offset = Number(searchParams.get("offset") || 0);

    const leads = await db.lead.findMany({
      where: {
        ...(campaignId && { campaignId }),
        ...(status && { status: status as never }),
      },
      include: { business: true, demoSite: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(leads);
  } catch (err) {
    logger.error("api/leads", "Failed to fetch leads", { error: String(err) });
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}
