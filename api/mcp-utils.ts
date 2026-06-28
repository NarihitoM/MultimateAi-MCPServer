import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { middleware } from "./middleware.js";
import type { ToolRegistrar } from "./tools/helpers.js";

function sendJson(res: any, status: number, body: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createMcpHandler(
  serviceName: string,
  authExtractor: (req: any) => Record<string, string>,
  registerTools: ToolRegistrar
) {
  return async function handler(req: any, res: any) {
    const mid = middleware(req);
    if (mid.error) {
      return sendJson(res, mid.statusCode || 400, { content: [{ type: "text", text: mid.error }] });
    }

    if (req.method === "GET" || req.method === "DELETE") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(`${serviceName} MCP server is running. Send a POST request with JSON-RPC.`);
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      return res.end("Method not allowed");
    }

    const auth = authExtractor(req);
    const server = new McpServer({ name: `multimate-${serviceName}`, version: "1.0.0" });
    registerTools(server, auth);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  };
}
