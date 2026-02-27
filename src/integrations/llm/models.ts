export type TaskType =
  | "intel"
  | "builder-copy"
  | "builder-html"
  | "outreach"
  | "closer"
  | "classify"
  | "general";

export type ModelEntry = {
  id: string;
  name: string;
  free?: boolean;
};

export const TASK_MODELS: Record<TaskType, ModelEntry> = {
  "intel": {
    id: "deepseek/deepseek-chat-v3-0324:free",
    name: "DeepSeek V3 (free)",
    free: true,
  },
  "builder-copy": {
    id: "minimax/minimax-m1-80k",
    name: "MiniMax M1",
  },
  "builder-html": {
    id: "minimax/minimax-m1-80k",
    name: "MiniMax M1",
  },
  "outreach": {
    id: "deepseek/deepseek-chat-v3-0324:free",
    name: "DeepSeek V3 (free)",
    free: true,
  },
  "closer": {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
  },
  "classify": {
    id: "deepseek/deepseek-chat-v3-0324:free",
    name: "DeepSeek V3 (free)",
    free: true,
  },
  "general": {
    id: "deepseek/deepseek-chat-v3-0324:free",
    name: "DeepSeek V3 (free)",
    free: true,
  },
};
