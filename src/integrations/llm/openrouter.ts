import { logger } from "@/lib/logger";
import { TASK_MODELS, type TaskType } from "./models";

const AGENT = "llm";
const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_RETRIES = 3;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  label: string
): Promise<{ ok: true; data: OpenRouterResponse } | { ok: false; status: number; text: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data: OpenRouterResponse = await res.json();
      return { ok: true, data };
    }

    if (res.status === 429 && attempt < MAX_RETRIES - 1) {
      const waitMs = (attempt + 1) * 5000; // 5s, 10s, 15s
      logger.warn(AGENT, `${label} 429 rate limited, retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(waitMs);
      continue;
    }

    const text = await res.text();
    return { ok: false, status: res.status, text };
  }

  return { ok: false, status: 429, text: "Max retries exceeded" };
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

  // Try OpenRouter with retries
  const orResult = await callWithRetry(
    BASE_URL,
    {
      Authorization: `Bearer ${getApiKey()}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "MAX Lead Generation",
    },
    {
      model: modelId,
      messages,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    },
    "OpenRouter"
  );

  if (orResult.ok) {
    const text = orResult.data.choices?.[0]?.message?.content ?? "";
    if (orResult.data.usage) {
      logger.debug(AGENT, "Generated", {
        model: modelId,
        inputTokens: orResult.data.usage.prompt_tokens,
        outputTokens: orResult.data.usage.completion_tokens,
      });
    }
    return text;
  }

  // If OpenRouter failed and we have Groq, try Groq with retries
  if (orResult.status === 429 && process.env.GROQ_API_KEY) {
    logger.warn(AGENT, `OpenRouter exhausted after ${MAX_RETRIES} retries, falling back to Groq`, { model: modelId });

    const groqResult = await callWithRetry(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      {
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: opts.maxTokens ?? 4096,
        ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      },
      "Groq"
    );

    if (groqResult.ok) {
      return groqResult.data.choices?.[0]?.message?.content ?? "";
    }

    throw new Error(`Both OpenRouter and Groq failed. Groq ${groqResult.status}: ${groqResult.text}`);
  }

  logger.error(AGENT, `OpenRouter error ${orResult.status}`, { body: orResult.text, model: modelId });
  throw new Error(`OpenRouter ${orResult.status}: ${orResult.text}`);
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
