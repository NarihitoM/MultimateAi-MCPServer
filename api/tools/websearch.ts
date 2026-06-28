import { z } from "zod";
import { getJson } from "serpapi";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

export const registerWebSearchTools: ToolRegistrar = (server, _auth) => {
  server.tool("web_search", "Search the web using Google", { query: z.string() }, async ({ query }) => {
    const response = await getJson({ engine: "google", api_key: process.env.SERP, q: query });
    const results = response.organic_results?.slice(0, 3).map((r: { title: string; snippet: string }) => `${r.title}: ${r.snippet}`).join("\n");
    return textResult(results || "No results found.");
  });
};
