import { Worker, Job } from "bullmq";
import { logger } from "../lib/logger";

export function createSchedulerWorker(connection: { host: string; port: number }) {
  return new Worker(
    "scheduler",
    async (job: Job) => {
      logger.info("scheduler", `Processing job ${job.id}`, job.data);
      // TODO: Check for pending follow-ups and queue outreach jobs
    },
    { connection }
  );
}
