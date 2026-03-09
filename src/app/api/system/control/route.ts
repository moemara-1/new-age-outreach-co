import { NextResponse } from "next/server";
import { Queue } from "bullmq";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const QUEUE_NAMES = ["scout", "intel", "builder", "outreach", "closer", "scheduler"];
import { db } from "@/lib/db";

export async function POST(request: Request) {
    try {
        const { action } = await request.json();

        if (!["pause", "resume", "stop", "clear"].includes(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const queues = QUEUE_NAMES.map((name) => new Queue(name, { connection: redis }));

        if (action === "pause") {
            await Promise.all(queues.map((q) => q.pause()));
            logger.info("system", "All queues paused via TopBar");
        } else if (action === "resume") {
            await Promise.all(queues.map((q) => q.resume()));
            logger.info("system", "All queues resumed via TopBar");
        } else if (action === "stop") {
            await Promise.all(
                queues.map(async (q) => {
                    await q.pause();
                    await q.drain();
                })
            );
            logger.info("system", "All queues stopped and drained via TopBar");
        } else if (action === "clear") {
            // Clear activity logs and agent runs but keep leads/campaigns
            await db.activityLog.deleteMany();
            await db.agentRun.deleteMany();
            // Also flush stale jobs from Redis
            await Promise.all(
                queues.map(async (q) => {
                    const failed = await q.getFailed(0, 500);
                    for (const j of failed) await j.remove();
                    const completed = await q.getCompleted(0, 500);
                    for (const j of completed) await j.remove();
                })
            );
            logger.info("system", "Logs, agent runs, and stale jobs cleared via TopBar");
        }

        await Promise.all(queues.map((q) => q.close()));

        return NextResponse.json({ success: true, action });
    } catch (error) {
        logger.error("system", "Error processing control action", { error: String(error) });
        return NextResponse.json({ error: "Failed to process " }, { status: 500 });
    }
}
