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
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
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
  const r = await kaggleFetch("/kernels/status", {
    query: { userName: user, kernelSlug: kernel },
  });
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


/** List files attached to a competition. Requires accepted competition rules. */
export async function listCompetitionFiles(competition: string) {
  const r = await kaggleFetch(
    `/competitions/data/list/${encodeURIComponent(competition)}`,
  );
  return r.data;
}

/** List the authenticated user's submissions for a competition. */
export async function listCompetitionSubmissions(
  competition: string,
  page = 1,
) {
  const r = await kaggleFetch(
    `/competitions/submissions/list/${encodeURIComponent(competition)}`,
    { query: { page } },
  );
  return r.data;
}

/** Retrieve a competition leaderboard in the API's structured response. */
export async function viewCompetitionLeaderboard(competition: string) {
  const r = await kaggleFetch(
    `/competitions/${encodeURIComponent(competition)}/leaderboard/view`,
  );
  return r.data;
}

/**
 * Resolve the latest notebook output download. Kaggle may respond with a
 * redirect to a temporary signed URL, so do not parse the ZIP as text.
 */
export async function getKernelOutput(user: string, kernel: string) {
  const auth = authHeader();
  if (!auth) return missingCreds();

  const url = new URL(`${KAGGLE_API}/kernels/output`);
  url.searchParams.set("userName", user);
  url.searchParams.set("kernelSlug", kernel);

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { Authorization: auth, Accept: "application/json, */*" },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    return {
      available: !!location,
      downloadUrl: location ? new URL(location, url).toString() : null,
      status: response.status,
      note: "The download URL may be temporary. Fetch it promptly and do not share it publicly.",
    };
  }

  const contentType = response.headers.get("content-type") || "unknown";
  if (!response.ok) {
    const detail = await response.text();
    return {
      error: "Kaggle API error",
      status: response.status,
      detail: detail.slice(0, 2000),
    };
  }

  if (contentType.includes("json")) {
    return await response.json();
  }

  return {
    available: true,
    status: response.status,
    contentType,
    contentLength: response.headers.get("content-length"),
    downloadUrl: response.url || url.toString(),
    note: "Kaggle returned a file response. Use the URL immediately to download the output bundle.",
  };
}


/** Check asynchronous dataset creation/version processing status. */
export async function datasetStatus(owner: string, dataset: string) {
  const r = await kaggleFetch(
    `/datasets/status/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
  );
  return r.data;
}

/** List output files generated by a Kaggle kernel. */
export async function listKernelFiles(
  user: string,
  kernel: string,
  args: { pageSize?: number; pageToken?: string; version?: number } = {},
) {
  const r = await kaggleFetch("/kernels/files", {
    query: {
      userName: user,
      kernelSlug: kernel,
      pageSize: args.pageSize ?? 20,
      pageToken: args.pageToken,
      kernelVersionNumber: args.version,
    },
  });
  return r.data;
}

/** Search Kaggle's public model catalogue. */
export async function listModels(args: {
  search?: string;
  owner?: string;
  sortBy?: string;
  pageSize?: number;
  pageToken?: string;
} = {}) {
  const r = await kaggleFetch("/models/list", {
    query: {
      search: args.search,
      owner: args.owner,
      sortBy: args.sortBy ?? "hotness",
      pageSize: args.pageSize ?? 20,
      pageToken: args.pageToken,
    },
  });
  return r.data;
}

/** Retrieve metadata for a Kaggle model. */
export async function getModel(owner: string, model: string) {
  const r = await kaggleFetch(
    `/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/get`,
  );
  return r.data;
}

/** List files for one framework/variation of a Kaggle model. */
export async function listModelInstanceFiles(
  owner: string,
  model: string,
  framework: string,
  instance: string,
  args: { pageSize?: number; pageToken?: string } = {},
) {
  const r = await kaggleFetch(
    `/models/${encodeURIComponent(owner)}/${encodeURIComponent(model)}/${encodeURIComponent(framework)}/${encodeURIComponent(instance)}/files`,
    { query: { pageSize: args.pageSize ?? 20, pageToken: args.pageToken } },
  );
  return r.data;
}
