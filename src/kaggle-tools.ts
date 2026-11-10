/**
 * Native Kaggle API tools.
 * Preferred (2025+): KAGGLE_API_TOKEN=KGAT_...  → Authorization: Bearer
 * Legacy: KAGGLE_USERNAME + KAGGLE_KEY → Basic auth (kaggle.json)
 */

const KAGGLE_API = "https://www.kaggle.com/api/v1";

function authHeader(): string | null {
  const token = process.env.KAGGLE_API_TOKEN || process.env.KAGGLE_KEY;
  // New token format
  if (token && token.startsWith("KGAT_")) {
    return `Bearer ${token}`;
  }
  // Legacy username + key
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (user && key && !key.startsWith("KGAT_")) {
    return "Basic " + Buffer.from(`${user}:${key}`).toString("base64");
  }
  // Token without KGAT_ prefix when no user — treat as bearer
  if (token && !user) {
    return `Bearer ${token}`;
  }
  return null;
}

function missingCreds() {
  return {
    error:
      "Kaggle credentials missing. Prefer KAGGLE_API_TOKEN=KGAT_... on Render (Settings → API → Generate New Token). Legacy: KAGGLE_USERNAME + KAGGLE_KEY from kaggle.json.",
  };
}

async function kaggleFetch(
  path: string,
  opts: {
    method?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
  } = {},
) {
  const auth = authHeader();
  if (!auth) return { ok: false as const, data: missingCreds() };

  const url = new URL(`${KAGGLE_API}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: opts.method || "GET",
    headers: {
      Authorization: auth,
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
  const token = process.env.KAGGLE_API_TOKEN || process.env.KAGGLE_KEY;
  const hasBearer = !!(token && (token.startsWith("KGAT_") || !process.env.KAGGLE_USERNAME));
  const hasLegacy = !!(
    process.env.KAGGLE_USERNAME &&
    process.env.KAGGLE_KEY &&
    !String(process.env.KAGGLE_KEY).startsWith("KGAT_")
  );
  return {
    configured: !!authHeader(),
    mode: hasBearer ? "bearer_KGAT" : hasLegacy ? "legacy_basic" : "none",
    username: process.env.KAGGLE_USERNAME || null,
    has_KAGGLE_API_TOKEN: !!process.env.KAGGLE_API_TOKEN,
    has_KAGGLE_KEY: !!process.env.KAGGLE_KEY,
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
  const r = await kaggleFetch(
    `/datasets/view/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
  );
  return r.data;
}

export async function listDatasetFiles(owner: string, dataset: string) {
  const r = await kaggleFetch(
    `/datasets/list/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
  );
  return r.data;
}

export async function datasetDownloadInfo(owner: string, dataset: string) {
  if (!authHeader()) return missingCreds();
  const path = `/datasets/download/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`;
  return {
    downloadPath: `${KAGGLE_API}${path}`,
    owner,
    dataset,
    note: "Download with Authorization: Bearer $KAGGLE_API_TOKEN (or legacy -u user:key).",
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
  const r = await kaggleFetch("/kernels/pull", {
    query: {
      userName: user,
      kernelSlug: kernel,
      metadata: metadata ? true : false,
    },
  });
  if (!r.ok) {
    const r2 = await kaggleFetch(
      `/kernels/pull/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}`,
    );
    return r2.data;
  }
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

export async function pushKernel(body: Record<string, unknown>) {
  const r = await kaggleFetch("/kernels/push", { method: "POST", body });
  return r.data;
}
