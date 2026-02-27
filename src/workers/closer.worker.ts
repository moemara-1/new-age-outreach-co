import { Worker, Job } from "bullmq";
import { logger } from "../lib/logger";

export function createCloserWorker(connection: { host: string; port: number }) {
  return new Worker(
    "closer",
    async (job: Job) => {
      logger.info("closer", `Processing job ${job.id}`, job.data);
      // TODO: Classify reply + generate LLM response
    },
    { connection }
  );
}
