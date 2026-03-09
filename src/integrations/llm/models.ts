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
};

export const TASK_MODELS: Record<TaskType, ModelEntry> = {
  "intel": {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
  },
  "builder-copy": {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
  },
  "builder-html": {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
  },
  "outreach": {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
  },
  "closer": {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B",
  },
  "classify": {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
  },
  "general": {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
  },
};
