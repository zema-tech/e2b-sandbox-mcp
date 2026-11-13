import "dotenv/config";
import { app, sandboxManager, codeSandboxManager } from "./app.js";

const PORT = parseInt(process.env.PORT || "10000", 10);

if (!process.env.E2B_API_KEY) {
  console.warn(
    "WARNING: E2B_API_KEY is not set. Tool calls that need E2B will fail until you set it.",
  );
}

// Vercel / serverless hosts import the Express app without binding a port.
export default app;

if (!process.env.VERCEL) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`E2B Computer Use MCP server listening on port ${PORT}`);
    console.log(`Health: http://0.0.0.0:${PORT}/health`);
    console.log(`MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
  });

  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down server...`);

    const forceExit = setTimeout(() => {
      console.warn("Shutdown taking too long, forcing exit.");
      process.exit(1);
    }, 15000);
    forceExit.unref();

    server.close();
    await Promise.allSettled([
      sandboxManager.shutdown(),
      codeSandboxManager.shutdown(),
    ]);
    clearTimeout(forceExit);
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
