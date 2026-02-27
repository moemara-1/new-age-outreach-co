import { createScoutWorker } from "./src/workers/scout.worker";
import { createIntelWorker } from "./src/workers/intel.worker";
import { createBuilderWorker } from "./src/workers/builder.worker";
import { createOutreachWorker } from "./src/workers/outreach.worker";
import { createCloserWorker } from "./src/workers/closer.worker";
import { createSchedulerWorker } from "./src/workers/scheduler.worker";

const redisUrl = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

const workers = [
  createScoutWorker(connection),
  createIntelWorker(connection),
  createBuilderWorker(connection),
  createOutreachWorker(connection),
  createCloserWorker(connection),
  createSchedulerWorker(connection),
];

console.log(`Started ${workers.length} workers`);

process.on("SIGTERM", async () => {
  console.log("Shutting down workers...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
