import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { middleware } from "./middleware.js";
import {
  registerTelegramTools,
  registerSlackTools,
  registerNotionTools,
  registerFigmaTools,
  registerSheetsTools,
  registerDocsTools,
  registerWebSearchTools,
} from "./tools/index.js";

export default async function handler(req: Request): Promise<Response> {
  const mid = middleware(req);
  if (mid.response) return mid.response;

  if (req.method === "GET" || req.method === "DELETE") {
    return new Response("MCP server is running. Send a POST request with JSON-RPC.", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const auth: Record<string, string> = {
    notion_token: req.headers.get("x-notion-token") || "",
    slack_token: req.headers.get("x-slack-token") || "",
    figma_token: req.headers.get("x-figma-token") || "",
    telegram_session: req.headers.get("x-telegram-session") || "",
    GOOGLE_EMAIL: req.headers.get("x-google-email") || "",
    GOOGLE_KEY: req.headers.get("x-google-key") || "",
  };

  const server = new McpServer({ name: "multimate-mcp", version: "1.0.0" });

  registerTelegramTools(server, auth);
  registerSlackTools(server, auth);
  registerNotionTools(server, auth);
  registerFigmaTools(server, auth);
  registerSheetsTools(server, auth);
  registerDocsTools(server, auth);
  registerWebSearchTools(server, auth);

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}
