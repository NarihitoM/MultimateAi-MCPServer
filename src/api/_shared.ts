import { z } from "zod";

export const McpRequestSchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
  auth: z.record(z.unknown()).optional(),
});

export type McpAuth = Record<string, string | undefined>;

export function getAuth(auth: unknown): McpAuth {
  return (auth ?? {}) as McpAuth;
}

export function ok(content: unknown): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text: JSON.stringify(content) }] }),
    { headers: { "Content-Type": "application/json" } }
  );
}

export function err(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ content: [{ type: "text", text: message }] }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}
