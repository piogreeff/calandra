import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath } from "node:url";
import { createCalandraMcpProtocolServer } from "./index.js";

const defaultApiBaseUrl = "https://calandra-api.piogreeff.workers.dev";

export async function startCalandraMcpStdioServer({
  apiBaseUrl = process.env.CALANDRA_API_BASE_URL ?? defaultApiBaseUrl,
}: {
  apiBaseUrl?: string;
} = {}) {
  const server = createCalandraMcpProtocolServer({ apiBaseUrl });
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startCalandraMcpStdioServer().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
