/**
 * Native Kaggle API tools (not Composio).
 * Set on Render: KAGGLE_USERNAME + KAGGLE_KEY
 * (from https://www.kaggle.com/settings -> API -> Create New Token)
 */

const KAGGLE_API = "https://www.kaggle.com/api/v1";

function authHeader(): string | null {
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (!user || !key) return null;
  return "Basic " + Buffer.from(`${user}:${key}`).toString("base64");
}

function missingCreds() {
  return {
    error:
      "Kaggle credentials missing. Set KAGGLE_USERNAME and KAGGLE_KEY on Render (Kaggle Settings \u2192 API).",
  };
}

async function kaggleFetch(
  path: string,
  opts: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
) {
  const auth = authHeader();
  if (!auth) return { ok: false as const, data: missingCreds() };

  const url = new URL(`${KAGGLE_API}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method || "GET",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep text */
  }

  if (!res.ok) {
    return {
      ok: false as const,
      data: { error: "Kaggle API error", status: res.status, data },
    };
  }
  return { ok: true as const, data };
}

export function kaggleConfigured() {
  return {
    configured: !!(process.env.KAGGLE_USERNAME && process.env.KAGGLE_KEY),
    username: process.env.KAGGLE_USERNAME || null,
  };
}

export async function listDatasets(args: {
  search?: string;
  page?: number;
  user?: string;
  sortBy?: string;
  maxSize?: number;
}) {
  const r = await kaggleFetch("/datasets/list", {
    query: {
      search: args.search,
      page: args.page ?? 1,
      user: args.user,
      sortBy: args.sortBy ?? "hottest",
      maxSize: args.maxSize,
    },
  });
  return r.data;
}

export async function getDataset(owner: string, dataset: string) {
  const r = await kaggleFetch(`/datasets/view/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`);
  return r.data;
}

export async function listDatasetFiles(owner: string, dataset: string) {
  const r = await kaggleFetch(
    `/datasets/list/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
  );
  return r.data;
}

/** Returns download instructions for the dataset zip */
export async function datasetDownloadInfo(owner: string, dataset: string) {
  const auth = authHeader();
  if (!auth) return missingCreds();
  const path = `/datasets/download/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`;
  return {
    downloadPath: `${KAGGLE_API}${path}`,
    curlExample: `curl -L -u "$KAGGLE_USERNAME:$KAGGLE_KEY" -o dataset.zip "${KAGGLE_API}${path}"`,
    owner,
    dataset,
    note: "Use run_code in E2B with curl + these credentials (from env) to download into the sandbox.",
  };
}

export async function listKernels(args: {
  search?: string;
  page?: number;
  user?: string;
  dataset?: string;
  competition?: string;
  language?: string;
  kernelType?: string;
  sortBy?: string;
}) {
  const r = await kaggleFetch("/kernels/list", {
    query: {
      search: args.search,
      page: args.page ?? 1,
      user: args.user,
      dataset: args.dataset,
      competition: args.competition,
      language: args.language,
      kernelType: args.kernelType,
      sortBy: args.sortBy ?? "hotness",
    },
  });
  return r.data;
}

export async function pullKernel(user: string, kernel: string, metadata = true) {
  const r = await kaggleFetch(
    `/kernels/pull/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}`,
    { query: { metadata: metadata ? "true" : "false" } },
  );
  return r.data;
}

export async function kernelStatus(user: string, kernel: string) {
  const r = await kaggleFetch(
    `/kernels/status/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}`,
  );
  return r.data;
}

export async function listCompetitions(args: {
  search?: string;
  page?: number;
  category?: string;
  sortBy?: string;
}) {
  const r = await kaggleFetch("/competitions/list", {
    query: {
      search: args.search,
      page: args.page ?? 1,
      category: args.category,
      sortBy: args.sortBy,
    },
  });
  return r.data;
}

/**
 * Push / update a kernel. body should match Kaggle kernel push schema
 */
export async function pushKernel(body: Record<string, unknown>) {
  const r = await kaggleFetch("/kernels/push", { method: "POST", body });
  return r.data;
}
