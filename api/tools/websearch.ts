import { z } from "zod";
import Firecrawl from "firecrawl";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

const firecrawl = new Firecrawl();

export const registerWebSearchTools: ToolRegistrar = (server, _auth) => {
  server.tool("web_search", "Search the web using Google", { query: z.string() }, async ({ query }) => {
    const results = await firecrawl.search(query, { limit: 3 });
    const web = (results as any).data?.web || [];
    const text = web.map((r: any) => `${r.title}: ${r.description}`).join("\n");
    return textResult(text || "No results found.");
  });
};
