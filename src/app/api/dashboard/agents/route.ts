export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Returns the current status of all 6 agents based on most recent AgentRun.
 * Designed for client-side polling (5s interval).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;

    const agentNames = ["SCOUT", "INTEL", "BUILDER", "OUTREACH", "CLOSER", "GROWTH"] as const;
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

    const runs = await db.agentRun.findMany({
        where: {
            ...(campaignId && { campaignId }),
            createdAt: { gte: fifteenMinAgo },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
    });

    const result: Record<string, { status: string; statusLabel: string; error?: string }> = {};

    for (const agent of agentNames) {
        const latestRun = runs.find((r) => r.agent === agent);
        if (!latestRun) {
            result[agent] = { status: "idle", statusLabel: "Idle" };
            continue;
        }

        if (latestRun.status === "RUNNING" || latestRun.status === "QUEUED") {
            result[agent] = {
                status: "running",
                statusLabel: latestRun.status === "QUEUED" ? "Queued" : "Running",
            };
        } else if (latestRun.status === "FAILED") {
            result[agent] = {
                status: "error",
                statusLabel: "Failed",
                error: latestRun.error ?? undefined,
            };
        } else if (latestRun.status === "COMPLETED") {
            result[agent] = { status: "completed", statusLabel: "Completed" };
        } else {
            result[agent] = { status: "idle", statusLabel: "Idle" };
        }
    }

    // Also return fresh stats
    const [found, built, sent, replied] = await Promise.all([
        db.lead.count({ where: campaignId ? { campaignId } : undefined }),
        db.demoSite.count({ where: campaignId ? { lead: { campaignId } } : undefined }),
        db.outreachMessage.count({ where: { sentAt: { not: null }, ...(campaignId && { lead: { campaignId } }) } }),
        db.outreachMessage.count({ where: { repliedAt: { not: null }, ...(campaignId && { lead: { campaignId } }) } }),
    ]);

    return NextResponse.json({
        agents: result,
        stats: { found, built, sent, replied },
    });
}
