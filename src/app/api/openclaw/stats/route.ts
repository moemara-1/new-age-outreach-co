import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyApiKey } from "@/integrations/openclaw/client";

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [leads, sites, sent, replied, paid, campaigns] = await Promise.all([
    db.lead.count(),
    db.demoSite.count(),
    db.outreachMessage.count({ where: { sentAt: { not: null } } }),
    db.outreachMessage.count({ where: { repliedAt: { not: null } } }),
    db.payment.count({ where: { paid: true } }),
    db.campaign.count({ where: { active: true } }),
  ]);

  return NextResponse.json({ leads, sites, sent, replied, paid, campaigns });
}
