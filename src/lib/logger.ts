type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, agent: string, message: string, data?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    agent,
    message,
    ...(data !== undefined && { data }),
  };
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](JSON.stringify(entry));
}

export const logger = {
  info: (agent: string, msg: string, data?: unknown) => log("info", agent, msg, data),
  warn: (agent: string, msg: string, data?: unknown) => log("warn", agent, msg, data),
  error: (agent: string, msg: string, data?: unknown) => log("error", agent, msg, data),
  debug: (agent: string, msg: string, data?: unknown) => {
    if (process.env.NODE_ENV === "development") log("debug", agent, msg, data);
  },
};
