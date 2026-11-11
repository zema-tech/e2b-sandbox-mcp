/** Multi-provider LLM helpers (OpenAI-compatible + xAI Grok). Keys from env on Render. */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type LlmProvider =
  | "groq"
  | "xai"
  | "openai"
  | "openrouter"
  | "together"
  | "deepseek"
  | "fireworks"
  | "mistral"
  | "custom";

export type LlmChatArgs = {
  provider?: LlmProvider;
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  base_url?: string;
  api_key_env?: string;
};

type ProviderConfig = {
  envKey: string;
  /** Base URL, WITHOUT a trailing slash and WITHOUT /chat/completions etc. appended. */
  baseUrl: string;
  defaultModel: string;
};

const PROVIDERS: Record<Exclude<LlmProvider, "custom">, ProviderConfig> = {
  groq: {
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  xai: {
    envKey: "XAI_API_KEY",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-2-latest",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  together: {
    envKey: "TOGETHER_API_KEY",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  },
  deepseek: {
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
  },
  fireworks: {
    envKey: "FIREWORKS_API_KEY",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p1-70b-instruct",
  },
  mistral: {
    envKey: "MISTRAL_API_KEY",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
  },
};

/** Resolves {apiKey, baseUrl} for a provider, or a human-readable error. Shared by
 *  chat/models/embeddings so the three tools can't drift on how a provider is resolved. */
function resolveProvider(args: {
  provider?: LlmProvider;
  base_url?: string;
  api_key_env?: string;
}): { ok: true; resolved: LlmProvider; apiKey: string; baseUrl: string } | { ok: false; error: string } {
  const resolved = args.provider || pickDefaultProvider();

  let apiKey: string | undefined;
  let baseUrl: string;

  if (resolved === "custom") {
    if (!args.base_url) {
      return { ok: false, error: "provider=custom requires base_url" };
    }
    apiKey = process.env[args.api_key_env || "OPENAI_API_KEY"];
    baseUrl = args.base_url.replace(/\/$/, "");
  } else {
    const cfg = PROVIDERS[resolved];
    apiKey = process.env[cfg.envKey];
    baseUrl = cfg.baseUrl;
  }

  if (!apiKey) {
    const envName =
      resolved === "custom" ? args.api_key_env || "OPENAI_API_KEY" : PROVIDERS[resolved].envKey;
    return { ok: false, error: `Missing API key for provider '${resolved}'. Set ${envName} on Render.` };
  }

  return { ok: true, resolved, apiKey, baseUrl };
}

function pickDefaultProvider(): LlmProvider {
  const order: Exclude<LlmProvider, "custom">[] = [
    "groq",
    "xai",
    "openrouter",
    "openai",
    "together",
    "deepseek",
    "fireworks",
    "mistral",
  ];
  for (const p of order) {
    if (process.env[PROVIDERS[p].envKey]) return p;
  }
  return "groq";
}

export async function llmChat(args: LlmChatArgs) {
  const { provider, model, messages, temperature, max_tokens, base_url, api_key_env } = args;

  const resolution = resolveProvider({ provider, base_url, api_key_env });
  if (!resolution.ok) {
    return { error: resolution.error, configured: listLlmProviders() };
  }
  const { resolved, apiKey, baseUrl } = resolution;
  const defaultModel =
    resolved === "custom" ? model || "gpt-4o-mini" : PROVIDERS[resolved].defaultModel;

  const body = {
    model: model || defaultModel,
    messages,
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 2048,
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (resolved === "openrouter") {
    headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://e2b-sandbox-mcp.onrender.com";
    headers["X-Title"] = process.env.OPENROUTER_TITLE || "e2b-sandbox-mcp";
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as any;
  if (!res.ok) {
    return { error: "LLM request failed", status: res.status, data };
  }

  const content =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;

  return {
    provider: resolved,
    model: body.model,
    content,
    usage: data.usage ?? null,
    raw: content ? undefined : data,
  };
}

export type LlmListModelsArgs = {
  provider?: LlmProvider;
  base_url?: string;
  api_key_env?: string;
};

/** Lists models actually available from the provider's own /models endpoint (OpenAI-compatible
 *  convention followed by all providers here), instead of relying on the static models_hint. */
export async function llmListModels(args: LlmListModelsArgs) {
  const resolution = resolveProvider(args);
  if (!resolution.ok) {
    return { error: resolution.error, configured: listLlmProviders() };
  }
  const { resolved, apiKey, baseUrl } = resolution;

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      return { error: "Failed to list models", status: res.status, data };
    }
    const models = Array.isArray(data?.data)
      ? data.data.map((m: any) => m.id).filter(Boolean)
      : data;
    return { provider: resolved, models };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export type LlmEmbeddingsArgs = {
  provider?: LlmProvider;
  model?: string;
  input: string | string[];
  base_url?: string;
  api_key_env?: string;
};

/** Calls the provider's /embeddings endpoint (OpenAI-compatible). Not every provider here
 *  offers embeddings (e.g. groq, xai do not as of this writing) — on those the provider's
 *  own error response is returned as-is rather than guessed/blocked client-side. */
export async function llmEmbeddings(args: LlmEmbeddingsArgs) {
  const { provider, model, input, base_url, api_key_env } = args;
  const resolution = resolveProvider({ provider, base_url, api_key_env });
  if (!resolution.ok) {
    return { error: resolution.error, configured: listLlmProviders() };
  }
  const { resolved, apiKey, baseUrl } = resolution;

  if (!model) {
    return { error: "model is required for embeddings (providers do not have a safe universal default)" };
  }

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    return { error: "Embeddings request failed", status: res.status, data };
  }

  return {
    provider: resolved,
    model,
    embeddings: Array.isArray(data?.data) ? data.data.map((d: any) => d.embedding) : null,
    usage: data?.usage ?? null,
  };
}

export function listLlmProviders() {
  const configured: Record<string, boolean> = {};
  for (const [name, cfg] of Object.entries(PROVIDERS)) {
    configured[name] = !!process.env[cfg.envKey];
  }
  return {
    providers: configured,
    default: pickDefaultProvider(),
    env_vars: Object.fromEntries(
      Object.entries(PROVIDERS).map(([name, cfg]) => [name, cfg.envKey]),
    ),
    models_hint: {
      groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
      xai: ["grok-2-latest", "grok-3", "grok-3-mini"],
      openai: ["gpt-4o", "gpt-4o-mini", "o4-mini"],
      openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
      together: ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"],
      deepseek: ["deepseek-chat", "deepseek-reasoner"],
      fireworks: ["accounts/fireworks/models/llama-v3p1-70b-instruct"],
      mistral: ["mistral-small-latest", "mistral-large-latest"],
    },
  };
}
