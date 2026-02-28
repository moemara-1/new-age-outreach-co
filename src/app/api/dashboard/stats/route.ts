import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const [found, built, sent, replied] = await Promise.all([
      db.lead.count(),
      db.demoSite.count(),
      db.outreachMessage.count({ where: { sentAt: { not: null } } }),
      db.outreachMessage.count({ where: { repliedAt: { not: null } } }),
    ]);

    return NextResponse.json({ found, built, sent, replied });
  } catch (err) {
    logger.error("api/dashboard/stats", "Failed to fetch stats", { error: String(err) });
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
