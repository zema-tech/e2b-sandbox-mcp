/** LLM helpers for Groq / OpenAI-compatible providers (API keys from env on Render). */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmChatArgs = {
  provider?: "groq" | "openai" | "custom";
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  base_url?: string;
  api_key_env?: string;
};

export async function llmChat(args: LlmChatArgs) {
  const {
    provider,
    model,
    messages,
    temperature,
    max_tokens,
    base_url,
    api_key_env,
  } = args;

  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let resolvedProvider = provider;
  if (!resolvedProvider) {
    resolvedProvider = groqKey ? "groq" : openaiKey ? "openai" : "groq";
  }

  let apiKey: string | undefined;
  let endpoint: string;
  let defaultModel: string;

  if (resolvedProvider === "groq") {
    apiKey = groqKey;
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
    defaultModel = "llama-3.3-70b-versatile";
  } else if (resolvedProvider === "openai") {
    apiKey = openaiKey;
    endpoint = "https://api.openai.com/v1/chat/completions";
    defaultModel = "gpt-4o-mini";
  } else {
    apiKey = process.env[api_key_env || "OPENAI_API_KEY"];
    endpoint = `${(base_url || "").replace(/\/$/, "")}/chat/completions`;
    defaultModel = model || "gpt-4o-mini";
  }

  if (!apiKey) {
    return {
      error: `Missing API key for provider '${resolvedProvider}'. Set GROQ_API_KEY or OPENAI_API_KEY on Render.`,
    };
  }
  if (resolvedProvider === "custom" && !base_url) {
    return { error: "provider=custom requires base_url" };
  }

  const body = {
    model: model || defaultModel,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 2048,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as any;
  if (!res.ok) {
    return { error: "LLM request failed", status: res.status, data };
  }

  const content =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;

  return {
    provider: resolvedProvider,
    model: body.model,
    content,
    usage: data.usage ?? null,
    raw: content ? undefined : data,
  };
}

export function listLlmProviders() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    default: process.env.GROQ_API_KEY
      ? "groq"
      : process.env.OPENAI_API_KEY
        ? "openai"
        : null,
  };
}
