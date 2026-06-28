import { google } from "googleapis";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolRegistrar = (server: McpServer, auth: Record<string, string>) => void;

export function createGoogleAuth(email: string, key: string) {
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/['"]+/g, "").replace(/^[ \t]+|[ \t]+$/gm, "").trim(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"],
  });
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
