import { logger } from "@/lib/logger";
import { TASK_MODELS, type TaskType } from "./models";

const AGENT = "llm";
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterResponse = {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
};

export type GenerateOpts = {
  task?: TaskType;
  modelOverride?: string;
  maxTokens?: number;
  system?: string;
  temperature?: number;
};

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Missing OPENROUTER_API_KEY");
  return key;
}

export async function generateText(
  prompt: string,
  opts: GenerateOpts = {}
): Promise<string> {
  const modelEntry = TASK_MODELS[opts.task ?? "general"];
  const modelId = opts.modelOverride ?? modelEntry.id;

  const messages: Message[] = [];
  if (opts.system) {
    messages.push({ role: "system", content: opts.system });
  }
  messages.push({ role: "user", content: prompt });

  logger.debug(AGENT, `Generating with ${modelId}`, { promptLength: prompt.length });

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "MAX Lead Generation",
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(AGENT, `OpenRouter error ${res.status}`, { body: text, model: modelId });
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }

  const data: OpenRouterResponse = await res.json();
  const text = data.choices?.[0]?.message?.content ?? "";

  if (data.usage) {
    logger.debug(AGENT, "Generated", {
      model: modelId,
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    });
  }

  return text;
}

export async function generateJSON<T>(
  prompt: string,
  opts: GenerateOpts = {}
): Promise<T> {
  const text = await generateText(prompt, {
    ...opts,
    system: [
      opts.system,
      "Respond with valid JSON only. No markdown, no code fences, no explanation.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const cleaned = text
    .replace(/^```json?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
