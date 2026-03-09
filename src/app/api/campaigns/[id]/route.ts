import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing campaign ID" }, { status: 400 });

    try {
        const campaign = await db.campaign.findUnique({
            where: { id },
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // Since Prisma schema lacks onDelete: Cascade, we manually delete children

        // 1. Delete OutreachMessages for these leads
        await db.outreachMessage.deleteMany({
            where: { lead: { campaignId: id } },
        });

        // 2. Delete DemoSites for these leads
        await db.demoSite.deleteMany({
            where: { lead: { campaignId: id } },
        });

        // 3. Delete Payments for these leads
        await db.payment.deleteMany({
            where: { lead: { campaignId: id } },
        });

        // 4. Delete Leads
        await db.lead.deleteMany({
            where: { campaignId: id },
        });

        // 5. Delete AgentRuns
        await db.agentRun.deleteMany({
            where: { campaignId: id },
        });

        // 6. Delete Campaign
        await db.campaign.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
