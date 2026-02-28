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
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder",
  },
  "builder-html": {
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder",
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
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
  },
  "general": {
    id: "mistralai/mistral-small-3.1-24b-instruct:free",
    name: "Mistral Small 3.1",
  },
};
