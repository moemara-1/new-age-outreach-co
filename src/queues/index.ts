import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

const connection = redis;

export const scoutQueue = new Queue("scout", { connection });
export const intelQueue = new Queue("intel", { connection });
export const builderQueue = new Queue("builder", { connection });
export const outreachQueue = new Queue("outreach", { connection });
export const closerQueue = new Queue("closer", { connection });
export const schedulerQueue = new Queue("scheduler", { connection });
