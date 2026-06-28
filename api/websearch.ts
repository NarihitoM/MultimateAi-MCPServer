import { z } from "zod";
import { getJson } from "serpapi";

const McpRequestSchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
  auth: z.record(z.unknown()).optional(),
});

function ok(content: unknown) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(content) }] }), { headers: { "Content-Type": "application/json" } });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: message }] }), { status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;

  try {
    if (tool !== "web_search") return err(`Unknown tool: ${tool}`);
    const { query } = args as any;
    const response = await getJson({ engine: "google", api_key: process.env.SERP, q: query });
    const results = response.organic_results?.slice(0, 3).map((r: { title: string; snippet: string }) => `${r.title}: ${r.snippet}`).join("\n");
    return ok(results || "No results found.");
  } catch (error: any) {
    return err(`Search failed: ${error.message || error}`);
  }
}
