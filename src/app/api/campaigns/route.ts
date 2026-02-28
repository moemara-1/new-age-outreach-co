import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  try {
    const campaigns = await db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
    return NextResponse.json(campaigns);
  } catch (err) {
    logger.error("api/campaigns", "Failed to fetch campaigns", { error: String(err) });
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!name || !location || !category) {
      return NextResponse.json(
        { error: "name, location, and category are required" },
        { status: 400 }
      );
    }

    const campaign = await db.campaign.create({
      data: { name, location, category },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    logger.error("api/campaigns", "Failed to create campaign", { error: String(err) });
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
