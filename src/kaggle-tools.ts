/**
 * Native Kaggle API tools (not Composio).
 * Set on Render: KAGGLE_USERNAME + KAGGLE_KEY
 * (from https://www.kaggle.com/settings -> API -> Create New Token)
 */

const KAGGLE_API = "https://www.kaggle.com/api/v1";

function authHeader(): string | null {
  const token = process.env.KAGGLE_API_TOKEN || process.env.KAGGLE_KEY;
  if (token && token.startsWith("KGAT_")) return `Bearer ${token}`;
  const user = process.env.KAGGLE_USERNAME;
  const key = process.env.KAGGLE_KEY;
  if (user && key && !key.startsWith("KGAT_")) {
    return "Basic " + Buffer.from(`${user}:${key}`).toString("base64");
  }
  if (token && !user) return `Bearer ${token}`;
  return null;
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

/**
 * Like kaggleFetch, but for binary responses (file downloads) instead of JSON.
 * Used so a file's bytes can be fetched server-side (where KAGGLE_USERNAME/KAGGLE_KEY
 * actually live) and written straight into an E2B sandbox, without ever handing the
 * Kaggle credentials themselves to the sandbox or to the model.
 */
export async function kaggleFetchBinary(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<
  | { ok: true; buffer: Buffer; contentType: string | null }
  | { ok: false; error: unknown }
> {
  const auth = authHeader();
  if (!auth) return { ok: false, error: missingCreds() };

  const url = new URL(`${KAGGLE_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), { headers: { Authorization: auth } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: { error: "Kaggle API error", status: res.status, data: text },
    };
  }

  const arrayBuffer = await res.arrayBuffer();
  return {
    ok: true,
    buffer: Buffer.from(arrayBuffer),
    contentType: res.headers.get("content-type"),
  };
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
  const r = await kaggleFetch(`/datasets/view/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`);
  return r.data;
}

export async function listDatasetFiles(owner: string, dataset: string) {
  const r = await kaggleFetch(
    `/datasets/list/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
  );
  return r.data;
}

/**
 * Returns download info for the full dataset zip. This does NOT download anything
 * itself (a dataset zip can be large; streaming it through the MCP server into a tool
 * response would risk exhausting memory), it only returns the authenticated URL.
 *
 * Important: KAGGLE_USERNAME/KAGGLE_KEY are secrets configured on THIS server, not
 * inside the E2B sandbox. A curl command using "$KAGGLE_USERNAME:$KAGGLE_KEY" run via
 * run_code inside the sandbox will NOT work unless you explicitly pass those values
 * into the sandbox yourself (e.g. as env vars at sandbox creation) — doing so exposes
 * your Kaggle API key inside that sandbox. For a single file, prefer
 * kaggle_download_dataset_file_to_sandbox, which fetches the bytes here on the server
 * and writes them into the sandbox directly, so the credentials never leave the server.
 */
export async function datasetDownloadInfo(owner: string, dataset: string) {
  const auth = authHeader();
  if (!auth) return missingCreds();
  const path = `/datasets/download/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`;
  return {
    downloadPath: `${KAGGLE_API}${path}`,
    owner,
    dataset,
    note:
      "KAGGLE_USERNAME/KAGGLE_KEY are set on this MCP server, not inside the E2B sandbox — a curl using those env vars will fail unless you pass them into the sandbox explicitly yourself, which exposes your Kaggle key there. For a single file, use kaggle_download_dataset_file_to_sandbox instead (credentials never leave this server). This endpoint returns the whole dataset as a zip, which this server does not stream automatically because of its size.",
  };
}

/** Download info for a single file in a dataset. Same credential caveat as datasetDownloadInfo. */
export function datasetFileDownloadInfo(owner: string, dataset: string, fileName: string) {
  const path = `/datasets/download/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}/${encodeURIComponent(fileName)}`;
  return {
    downloadPath: `${KAGGLE_API}${path}`,
    owner,
    dataset,
    fileName,
    recommended:
      "Use kaggle_download_dataset_file_to_sandbox to fetch this file directly into a code sandbox without ever exposing your Kaggle credentials to it.",
  };
}

/** Fetches a single dataset file's bytes using the server's own Kaggle credentials. */
export async function downloadDatasetFile(owner: string, dataset: string, fileName: string) {
  return kaggleFetchBinary(
    `/datasets/download/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}/${encodeURIComponent(fileName)}`,
  );
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
  let r = await kaggleFetch(
    `/kernels/pull/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}`,
  );
  if (!r.ok) {
    r = await kaggleFetch("/kernels/pull", {
      query: { userName: user, kernelSlug: kernel },
    });
  }
  return r.data;
}

export async function kernelStatus(user: string, kernel: string) {
  let r = await kaggleFetch("/kernels/status", {
    query: { userName: user, kernelSlug: kernel },
  });
  if (!r.ok) {
    r = await kaggleFetch(
      `/kernels/status/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}`,
    );
  }
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
 * Push / update a kernel. `body` is validated against the Kaggle kernel-push schema by
 * the caller (see kernelPushSchema in app.ts) before reaching this function.
 */
export async function pushKernel(body: Record<string, unknown>) {
  const r = await kaggleFetch("/kernels/push", { method: "POST", body });
  return r.data;
}

/** List data files available for a competition. */
export async function competitionListFiles(competition: string, page?: number) {
  const r = await kaggleFetch(`/competitions/data/list/${encodeURIComponent(competition)}`, {
    query: { page: page ?? 1 },
  });
  return r.data;
}

/** Download info for a single competition file. Same credential caveat as dataset downloads. */
export function competitionFileDownloadInfo(competition: string, fileName: string) {
  const path = `/competitions/data/download/${encodeURIComponent(competition)}/${encodeURIComponent(fileName)}`;
  return {
    downloadPath: `${KAGGLE_API}${path}`,
    competition,
    fileName,
    recommended:
      "Use kaggle_download_competition_file_to_sandbox to fetch this file directly into a code sandbox without ever exposing your Kaggle credentials to it.",
  };
}

/** Fetches a single competition file's bytes using the server's own Kaggle credentials. */
export async function downloadCompetitionFile(competition: string, fileName: string) {
  return kaggleFetchBinary(
    `/competitions/data/download/${encodeURIComponent(competition)}/${encodeURIComponent(fileName)}`,
  );
}

/** Lists your own submissions for a competition (requires the configured account to have joined it). */
export async function competitionSubmissions(competition: string, page?: number) {
  const r = await kaggleFetch(`/competitions/submissions/list/${encodeURIComponent(competition)}`, {
    query: { page: page ?? 1 },
  });
  return r.data;
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


export async function kernelOutput(
  user: string,
  kernel: string,
  args: { pageToken?: string } = {},
) {
  const r = await kaggleFetch("/kernels/output", {
    query: {
      userName: user,
      kernelSlug: kernel,
      pageToken: args.pageToken,
    },
  });
  return r.data;
}

export function kernelOutputFileDownloadInfo(user: string, kernel: string, fileName: string) {
  return {
    user,
    kernel,
    fileName,
    recommended:
      "Use kaggle_download_kernel_output_file_to_sandbox so credentials never leave this server.",
  };
}

export async function downloadKernelOutputFile(user: string, kernel: string, fileName: string) {
  // Prefer signed URLs from /kernels/output (REST download paths often 404).
  const listed = await kernelOutput(user, kernel);
  const files: any[] = (listed as any)?.files || [];
  const norm = (s: string) => s.replace(/^\.\//, "").replace(/\\/g, "/");
  const want = norm(fileName);
  const match =
    files.find((f) => norm(f.fileName || f.name || "") === want) ||
    files.find((f) => norm(f.fileName || f.name || "").endsWith("/" + want)) ||
    files.find((f) => (f.fileName || f.name || "").split("/").pop() === want);

  if (match?.url) {
    const res = await fetch(match.url);
    if (!res.ok) {
      return {
        ok: false as const,
        error: {
          error: "Signed URL download failed",
          status: res.status,
          fileName: match.fileName || match.name,
        },
      };
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      ok: true as const,
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get("content-type"),
      resolvedName: match.fileName || match.name || fileName,
    };
  }

  // Fallback REST shapes
  const attempts = [
    `/kernels/output/download/${encodeURIComponent(user)}/${encodeURIComponent(kernel)}/${encodeURIComponent(fileName)}`,
  ];
  let lastErr: unknown = {
    error: "Kernel output file not found in /kernels/output listing",
    fileName,
    available: files.map((f) => f.fileName || f.name).filter(Boolean),
  };
  for (const path of attempts) {
    const r = await kaggleFetchBinary(path);
    if (r.ok) return r;
    lastErr = r.error;
  }
  const r2 = await kaggleFetchBinary("/kernels/output/download", {
    userName: user,
    kernelSlug: kernel,
    filePath: fileName,
    fileName,
  });
  if (r2.ok) return r2;
  return { ok: false as const, error: lastErr || r2.error };
}

export async function datasetCreateNew(body: Record<string, unknown>) {
  const r = await kaggleFetch("/datasets/create/new", { method: "POST", body });
  return r.data;
}

export async function startDatasetFileUpload(args: {
  fileName: string;
  contentLength: number;
  lastModifiedEpochSeconds?: number;
}) {
  const lastMod = args.lastModifiedEpochSeconds ?? Math.floor(Date.now() / 1000);
  const path = `/datasets/upload/file/${args.contentLength}/${lastMod}`;
  const auth = authHeader();
  if (!auth) return missingCreds();
  const url = new URL(`${KAGGLE_API}${path}`);
  const form = new FormData();
  form.append("fileName", args.fileName);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { Authorization: auth, Accept: "application/json" },
    body: form,
  });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) return { error: "Kaggle API error", status: res.status, data };
  return data;
}

export async function putDatasetFileToCreateUrl(
  createUrl: string,
  body: Buffer | Uint8Array,
  contentType = "application/octet-stream",
) {
  const res = await fetch(createUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false as const, status: res.status, data: text };
  }
  return { ok: true as const, status: res.status };
}

export async function uploadFromUrlToDatasetFile(args: {
  sourceUrl: string;
  fileName: string;
  contentLength?: number;
}) {
  let contentLength = args.contentLength;
  if (contentLength == null) {
    const head = await fetch(args.sourceUrl, { method: "HEAD" });
    const cl = head.headers.get("content-length");
    if (cl) contentLength = Number(cl);
  }
  if (contentLength == null || !Number.isFinite(contentLength)) {
    return { error: "contentLength required (or source must expose Content-Length)." };
  }
  const start = await startDatasetFileUpload({ fileName: args.fileName, contentLength });
  if ((start as any)?.error) return start;
  const createUrl = (start as any).createUrl || (start as any).createURL;
  const token = (start as any).token;
  if (!createUrl || !token) return { error: "startDatasetFileUpload missing createUrl/token", start };
  const src = await fetch(args.sourceUrl);
  if (!src.ok || !src.body) return { error: "Source URL fetch failed", status: src.status };
  const put = await fetch(createUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(contentLength),
    },
    body: src.body as any,
    duplex: "half",
  } as any);
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    return { error: "PUT to createUrl failed", status: put.status, data: text, token };
  }
  return { ok: true, token, fileName: args.fileName, contentLength };
}

export async function uploadTextAsDatasetFile(args: { fileName: string; text: string }) {
  const buf = Buffer.from(args.text, "utf8");
  const start = await startDatasetFileUpload({ fileName: args.fileName, contentLength: buf.length });
  if ((start as any)?.error) return start;
  const createUrl = (start as any).createUrl || (start as any).createURL;
  const token = (start as any).token;
  if (!createUrl || !token) return { error: "missing createUrl/token", start };
  const put = await putDatasetFileToCreateUrl(createUrl, buf, "text/plain; charset=utf-8");
  if (!put.ok) return { error: "PUT failed", put, token };
  return { ok: true, token, fileName: args.fileName, bytes: buf.length };
}

export async function datasetCreateVersion(owner: string, dataset: string, body: Record<string, unknown>) {
  const r = await kaggleFetch(
    `/datasets/create/version/${encodeURIComponent(owner)}/${encodeURIComponent(dataset)}`,
    { method: "POST", body },
  );
  return r.data;
}

export async function resolveKernelOutputSignedUrl(user: string, kernel: string, fileName: string) {
  const listed = await kernelOutput(user, kernel);
  if ((listed as any)?.error) return listed;
  const files: any[] = (listed as any)?.files || [];
  const want = fileName.replace(/^\.\//, "");
  const match =
    files.find((f) => (f.fileName || f.name || "") === want) ||
    files.find((f) => (f.fileName || f.name || "").endsWith("/" + want)) ||
    files.find((f) => (f.fileName || f.name || "").split("/").pop() === want);
  if (!match?.url) {
    return {
      error: "File not found in kernel output",
      fileName,
      available: files.map((f) => f.fileName || f.name).filter(Boolean),
    };
  }
  return { fileName: match.fileName || match.name || fileName, url: match.url as string };
}

/** Verify a dataset by view + file list (works for private; list-by-user often hides private). */
export async function verifyDataset(owner: string, dataset: string, expectedFiles?: string[]) {
  const meta = await getDataset(owner, dataset);
  if ((meta as any)?.error) return { ok: false, stage: "get", meta };
  const filesResp = await listDatasetFiles(owner, dataset);
  if ((filesResp as any)?.error) return { ok: false, stage: "files", meta, filesResp };
  const files: any[] =
    (filesResp as any)?.datasetFiles ||
    (Array.isArray(filesResp) ? filesResp : []);
  const names = files.map((f) => f.name || f.nameNullable).filter(Boolean);
  const sizes: Record<string, number> = {};
  for (const f of files) {
    const n = f.name || f.nameNullable;
    if (n) sizes[n] = f.totalBytes ?? f.totalBytesNullable ?? 0;
  }
  let missing: string[] = [];
  if (expectedFiles?.length) {
    missing = expectedFiles.filter((e) => !names.includes(e) && !names.some((n) => n.endsWith("/" + e)));
  }
  return {
    ok: missing.length === 0,
    ref: `${owner}/${dataset}`,
    title: (meta as any)?.title || (meta as any)?.titleNullable,
    isPrivate: (meta as any)?.isPrivate,
    totalBytes: (meta as any)?.totalBytes || (meta as any)?.totalBytesNullable,
    currentVersionNumber: (meta as any)?.currentVersionNumber || (meta as any)?.currentVersionNumberNullable,
    fileCount: names.length,
    files: names.map((n) => ({ name: n, bytes: sizes[n] ?? null })),
    missingExpected: missing,
    note:
      "Private datasets often do NOT appear in kaggle_list_datasets(user=...). Use kaggle_get_dataset / kaggle_dataset_verify instead.",
  };
}
