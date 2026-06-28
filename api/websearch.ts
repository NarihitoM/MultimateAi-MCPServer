import { McpRequestSchema, ok, err } from "./_shared.js";
import { getJson } from "serpapi";

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;

  try {
    if (tool !== "web_search") return err(`Unknown tool: ${tool}`);
    const { query } = args as any;

    const response = await getJson({
      engine: "google",
      api_key: process.env.SERP,
      q: query,
    });

    const results = response.organic_results
      ?.slice(0, 3)
      .map((r: { title: string; snippet: string }) => `${r.title}: ${r.snippet}`)
      .join("\n");

    return ok(results || "No results found.");
  } catch (error: any) {
    return err(`Search failed: ${error.message || error}`);
  }
}
