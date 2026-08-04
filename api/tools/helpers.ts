import { google } from "googleapis";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type { McpServer };
export type ToolRegistrar = (server: McpServer, auth: Record<string, string>) => void;

export function createGoogleAuthFromToken(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

export function normalizeBlock(block: any): any {
  const result = { ...block };
  for (const bt of ["paragraph", "heading_1", "heading_2", "heading_3", "callout", "quote", "bulleted_list_item", "numbered_list_item", "to_do", "toggle", "code"]) {
    if (result[bt]?.rich_text) {
      result[bt].rich_text = result[bt].rich_text.map((rt: any) => {
        if (typeof rt === "string") return { type: "text", text: { content: rt } };
        const n = { ...rt, type: rt.type || "text" };
        if (typeof n.text === "string") n.text = { content: n.text };
        return n;
      });
    }
  }
  if (result.type === "column_list" && Array.isArray(result.column_list?.children)) {
    result.column_list.children = result.column_list.children.map(normalizeBlock);
  }
  return result;
}

export function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data) }] };
}
