import { z } from "zod";
import { firecrawl } from "../lib/firecrawl.js";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

export const registerWebSearchTools: ToolRegistrar = (server, _auth) => {
  server.tool("web_search", "Search the web using Google", { query: z.string() }, async ({ query }) => {
    const results = await firecrawl.search(query, { limit: 3 }) as any;
    const web = results?.web || results?.data?.web || [];
    const text = web.map((r: any) => `${r.title}: ${r.description}`).join("\n");
    return textResult(text || "No results found.");
  });

  server.tool("web_scrape", "Scrape a webpage URL and return its full content as markdown", { url: z.string() }, async ({ url }) => {
    const result = await firecrawl.scrape(url, { formats: ["markdown"] }) as any;
    return textResult(result?.markdown || "No content found.");
  });
};
