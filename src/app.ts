import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SandboxManager } from "./sandbox-manager.js";
import { ComputerUseTools } from "./computer-use-tools.js";
import { CodeSandboxManager } from "./code-tools.js";
import { llmChat, listLlmProviders } from "./llm-tools.js";
import * as kaggle from "./kaggle-tools.js";

const MCP_API_TOKEN = process.env.MCP_API_TOKEN;
const E2B_API_KEY = process.env.E2B_API_KEY || null;

// Shared instances (stateless transport, but we keep sandbox state in memory)
const sandboxManager = new SandboxManager(E2B_API_KEY);
const computerUseTools = new ComputerUseTools(sandboxManager);
const codeSandboxManager = new CodeSandboxManager(E2B_API_KEY);

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "e2b-sandbox-mcp", version: "1.4.0" },
    { capabilities: { logging: {} } },
  );

  // ========== DESKTOP TOOLS (existing) ==========

  server.registerTool(
    "create_sandbox",
    {
      description: "Create a new E2B desktop sandbox instance (GUI + VNC)",
      inputSchema: {
        resolution: z
          .tuple([z.number(), z.number()])
          .optional()
          .describe("Screen resolution [width, height]"),
        timeout: z.number().optional().describe("Timeout in milliseconds"),
      },
    },
    async ({ resolution, timeout }) => {
      const result = await sandboxManager.createSandbox(resolution, timeout);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "execute_computer_action",
    {
      description: "Execute a computer action on the desktop sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Sandbox ID to execute action on"),
        action: z.object({
          type: z.enum([
            "click",
            "double_click",
            "type",
            "keypress",
            "move",
            "scroll",
            "drag",
            "screenshot",
          ]),
          x: z.number().optional(),
          y: z.number().optional(),
          text: z.string().optional(),
          keys: z.string().optional(),
          button: z.enum(["left", "right", "middle"]).optional(),
          scroll_x: z.number().optional(),
          scroll_y: z.number().optional(),
          path: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
        }),
      },
    },
    async ({ sandboxId, action }) => {
      const result = await computerUseTools.executeAction(sandboxId, action);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_stream_url",
    {
      description: "Get the VNC stream URL for a desktop sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Sandbox ID to get stream URL for"),
      },
    },
    async ({ sandboxId }) => {
      const result = await sandboxManager.getStreamUrl(sandboxId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ streamUrl: result }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_screenshot",
    {
      description: "Take a screenshot of the desktop sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Sandbox ID to take screenshot of"),
      },
    },
    async ({ sandboxId }) => {
      const result = await computerUseTools.takeScreenshot(sandboxId);
      return {
        content: [
          {
            type: "image",
            data: result.base64,
            mimeType: "image/png",
          },
        ],
      };
    },
  );

  server.registerTool(
    "cleanup_sandbox",
    {
      description: "Clean up and destroy a desktop sandbox instance",
      inputSchema: {
        sandboxId: z.string().describe("Sandbox ID to clean up"),
      },
    },
    async ({ sandboxId }) => {
      const result = await sandboxManager.cleanupSandbox(sandboxId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: result }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_sandboxes",
    {
      description: "List all active desktop sandbox instances",
      inputSchema: {},
    },
    async () => {
      const result = await sandboxManager.listSandboxes();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // ========== CODE INTERPRETER TOOLS (new - for weight-space programming) ==========

  server.registerTool(
    "create_code_sandbox",
    {
      description:
        "Create a new E2B code interpreter sandbox (Python, file system, packages). Use this for loading/editing neural network weights, running ML code, weight-space programming.",
      inputSchema: {
        timeout: z
          .number()
          .optional()
          .describe("Timeout in milliseconds (default 10 minutes)"),
      },
    },
    async ({ timeout }) => {
      const result = await codeSandboxManager.createCodeSandbox(timeout);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "run_code",
    {
      description:
        "Execute code inside a code sandbox. Defaults to Python. Perfect for loading models, inspecting tensors, modifying weights, etc.",
      inputSchema: {
        sandboxId: z.string().describe("Code sandbox ID"),
        code: z.string().describe("Code to execute"),
        language: z
          .enum(["python", "javascript", "bash"])
          .optional()
          .describe("Language (default: python)"),
      },
    },
    async ({ sandboxId, code, language }) => {
      const result = await codeSandboxManager.runCode(
        sandboxId,
        code,
        language || "python",
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "write_file",
    {
      description: "Write a file inside a code sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Code sandbox ID"),
        path: z.string().describe("Absolute path inside the sandbox"),
        content: z.string().describe("File content"),
      },
    },
    async ({ sandboxId, path, content }) => {
      const result = await codeSandboxManager.writeFile(sandboxId, path, content);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "read_file",
    {
      description: "Read a file from a code sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Code sandbox ID"),
        path: z.string().describe("Absolute path inside the sandbox"),
      },
    },
    async ({ sandboxId, path }) => {
      const result = await codeSandboxManager.readFile(sandboxId, path);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "list_files",
    {
      description: "List files/directories inside a code sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Code sandbox ID"),
        path: z
          .string()
          .optional()
          .describe("Directory path (default: /home/user)"),
      },
    },
    async ({ sandboxId, path }) => {
      const result = await codeSandboxManager.listFiles(
        sandboxId,
        path || "/home/user",
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.registerTool(
    "cleanup_code_sandbox",
    {
      description: "Destroy a code sandbox",
      inputSchema: {
        sandboxId: z.string().describe("Code sandbox ID to clean up"),
      },
    },
    async ({ sandboxId }) => {
      const result = await codeSandboxManager.cleanup(sandboxId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: result }, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_code_sandboxes",
    {
      description: "List all active code sandboxes",
      inputSchema: {},
    },
    async () => {
      const result = codeSandboxManager.list();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );


  // ========== LLM TOOLS (Groq / OpenAI-compatible) ==========
  server.registerTool(
    "llm_chat",
    {
      description:
        "Call an LLM using API keys on this server. Providers: groq, xai (Grok), openai, openrouter, together, deepseek, fireworks, mistral, custom. Set matching env keys on Render.",
      inputSchema: {
        provider: z.enum(["groq", "xai", "openai", "openrouter", "together", "deepseek", "fireworks", "mistral", "custom"]).optional(),
        model: z.string().optional().describe("e.g. llama-3.3-70b-versatile, llama-3.1-8b-instant"),
        messages: z.array(
          z.object({
            role: z.enum(["system", "user", "assistant"]),
            content: z.string(),
          }),
        ),
        temperature: z.number().optional(),
        max_tokens: z.number().optional(),
        base_url: z.string().optional(),
        api_key_env: z.string().optional(),
      },
    },
    async (args) => {
      const result = await llmChat(args);
      const isError = !!(result as { error?: string }).error;
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError,
      };
    },
  );

  server.registerTool(
    "llm_list_providers",
    {
      description: "List which LLM API keys are configured (no secrets returned)",
      inputSchema: {},
    },
    async () => {
      return {
        content: [{ type: "text", text: JSON.stringify(listLlmProviders(), null, 2) }],
      };
    },
  );


  // ========== KAGGLE (native API) ==========
  server.registerTool(
    "kaggle_status",
    { description: "Check if Kaggle credentials are configured on this server", inputSchema: {} },
    async () => ({ content: [{ type: "text", text: JSON.stringify(kaggle.kaggleConfigured(), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_list_datasets",
    {
      description: "List/search Kaggle datasets",
      inputSchema: {
        search: z.string().optional(),
        page: z.number().optional(),
        user: z.string().optional(),
        sortBy: z.string().optional(),
        maxSize: z.number().optional(),
      },
    },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.listDatasets(args), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_get_dataset",
    {
      description: "Get metadata for a Kaggle dataset (owner/dataset)",
      inputSchema: { owner: z.string(), dataset: z.string() },
    },
    async ({ owner, dataset }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.getDataset(owner, dataset), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_list_dataset_files",
    {
      description: "List files inside a Kaggle dataset",
      inputSchema: { owner: z.string(), dataset: z.string() },
    },
    async ({ owner, dataset }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.listDatasetFiles(owner, dataset), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_dataset_download_info",
    {
      description: "Get download URL/instructions for a dataset zip (pair with E2B run_code + curl)",
      inputSchema: { owner: z.string(), dataset: z.string() },
    },
    async ({ owner, dataset }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.datasetDownloadInfo(owner, dataset), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_list_kernels",
    {
      description: "List/search Kaggle kernels (notebooks/scripts)",
      inputSchema: {
        search: z.string().optional(),
        page: z.number().optional(),
        user: z.string().optional(),
        dataset: z.string().optional(),
        competition: z.string().optional(),
        language: z.string().optional(),
        kernelType: z.string().optional(),
        sortBy: z.string().optional(),
      },
    },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.listKernels(args), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_pull_kernel",
    {
      description: "Pull a Kaggle kernel source (notebook/script + metadata)",
      inputSchema: {
        user: z.string(),
        kernel: z.string(),
        metadata: z.boolean().optional(),
      },
    },
    async ({ user, kernel, metadata }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.pullKernel(user, kernel, metadata ?? true), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_kernel_status",
    {
      description: "Get execution status of a Kaggle kernel",
      inputSchema: { user: z.string(), kernel: z.string() },
    },
    async ({ user, kernel }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.kernelStatus(user, kernel), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_list_competitions",
    {
      description: "List/search Kaggle competitions",
      inputSchema: {
        search: z.string().optional(),
        page: z.number().optional(),
        category: z.string().optional(),
        sortBy: z.string().optional(),
      },
    },
    async (args) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.listCompetitions(args), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_push_kernel",
    {
      description: "Push/update a Kaggle kernel (run on Kaggle). Pass full kernel push payload.",
      inputSchema: { body: z.record(z.unknown()) },
    },
    async ({ body }) => ({ content: [{ type: "text", text: JSON.stringify(await kaggle.pushKernel(body), null, 2) }] }),
  );

  server.registerTool(
    "kaggle_list_competition_files",
    {
      description: "List downloadable data files for a Kaggle competition. The account may need to accept the competition rules first.",
      inputSchema: { competition: z.string().min(1) },
    },
    async ({ competition }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.listCompetitionFiles(competition), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_list_competition_submissions",
    {
      description: "List the authenticated user's submissions for a Kaggle competition.",
      inputSchema: {
        competition: z.string().min(1),
        page: z.number().int().min(1).optional(),
      },
    },
    async ({ competition, page }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.listCompetitionSubmissions(competition, page ?? 1), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_view_competition_leaderboard",
    {
      description: "View the leaderboard for a Kaggle competition.",
      inputSchema: { competition: z.string().min(1) },
    },
    async ({ competition }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.viewCompetitionLeaderboard(competition), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_get_kernel_output",
    {
      description: "Get the latest output bundle for a Kaggle notebook/kernel (user + kernel slug).",
      inputSchema: { user: z.string().min(1), kernel: z.string().min(1) },
    },
    async ({ user, kernel }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.getKernelOutput(user, kernel), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_dataset_status",
    {
      description: "Check Kaggle dataset creation or version processing status. A 404 can mean the dataset is already published or no processing job is active.",
      inputSchema: { owner: z.string().min(1), dataset: z.string().min(1) },
    },
    async ({ owner, dataset }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.datasetStatus(owner, dataset), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_list_kernel_files",
    {
      description: "List files generated by a Kaggle notebook run, with pagination and optional version number.",
      inputSchema: {
        user: z.string().min(1),
        kernel: z.string().min(1),
        pageSize: z.number().int().min(1).max(200).optional(),
        pageToken: z.string().optional(),
        version: z.number().int().positive().optional(),
      },
    },
    async ({ user, kernel, pageSize, pageToken, version }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.listKernelFiles(user, kernel, { pageSize, pageToken, version }), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_list_models",
    {
      description: "Search Kaggle's model catalogue, optionally filtering by owner and sorting/paging results.",
      inputSchema: {
        search: z.string().optional(),
        owner: z.string().optional(),
        sortBy: z.enum(["hotness", "downloadCount", "voteCount", "notebookCount", "publishTime", "createTime", "updateTime"]).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        pageToken: z.string().optional(),
      },
    },
    async (args) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.listModels(args), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_get_model",
    {
      description: "Retrieve metadata for a Kaggle model using its owner and model slug.",
      inputSchema: { owner: z.string().min(1), model: z.string().min(1) },
    },
    async ({ owner, model }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.getModel(owner, model), null, 2) }],
    }),
  );

  server.registerTool(
    "kaggle_list_model_instance_files",
    {
      description: "List files for a specific Kaggle model framework and variation, with pagination.",
      inputSchema: {
        owner: z.string().min(1),
        model: z.string().min(1),
        framework: z.string().min(1),
        instance: z.string().min(1),
        pageSize: z.number().int().min(1).max(200).optional(),
        pageToken: z.string().optional(),
      },
    },
    async ({ owner, model, framework, instance, pageSize, pageToken }) => ({
      content: [{ type: "text", text: JSON.stringify(await kaggle.listModelInstanceFiles(owner, model, framework, instance, { pageSize, pageToken }), null, 2) }],
    }),
  );

  return server;
}

const RENDER_EXTERNAL_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME;

export const app = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: RENDER_EXTERNAL_HOSTNAME ? [RENDER_EXTERNAL_HOSTNAME] : undefined,
});

// Optional bearer token auth (set MCP_API_TOKEN on Render)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || !MCP_API_TOKEN) {
    next();
    return;
  }

  const auth = req.headers.authorization ?? "";
  const expected = `Bearer ${MCP_API_TOKEN}`;
  if (
    auth.length === expected.length &&
    timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    next();
    return;
  }

  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    e2bConfigured: !!E2B_API_KEY,
    version: "1.4.0",
    features: ["desktop", "code-interpreter", "llm-multi", "kaggle"],
    timestamp: new Date().toISOString(),
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  // Kaggle and LLM tools do not require E2B. E2B-backed tools report their own
  // configuration errors when invoked, so the MCP endpoint remains usable
  // for deployments that only enable Kaggle.
  const server = createServer();
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});
