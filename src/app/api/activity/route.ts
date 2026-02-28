import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    const entries = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(entries);
  } catch (err) {
    logger.error("api/activity", "Failed to fetch activity", { error: String(err) });
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
