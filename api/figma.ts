import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { middleware } from "./middleware.js";
import { registerFigmaTools } from "./tools/index.js";

function sendJson(res: any, status: number, body: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  const mid = middleware(req);
  if (mid.error) {
    return sendJson(res, mid.statusCode || 400, { content: [{ type: "text", text: mid.error }] });
  }

  if (req.method === "GET" || req.method === "DELETE") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Figma MCP server is running. Send a POST request with JSON-RPC.");
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end("Method not allowed");
  }

  const auth: Record<string, string> = {
    figma_token: req.headers["x-figma-token"] || "",
  };

  const server = new McpServer({ name: "multimate-figma", version: "1.0.0" });
  registerFigmaTools(server, auth);

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
