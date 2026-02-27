import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const [found, built, sent, replied] = await Promise.all([
    db.lead.count(),
    db.demoSite.count(),
    db.outreachMessage.count({ where: { sentAt: { not: null } } }),
    db.outreachMessage.count({ where: { repliedAt: { not: null } } }),
  ]);

  return NextResponse.json({ found, built, sent, replied });
}
