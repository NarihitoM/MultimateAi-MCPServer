import { z } from "zod";
import { firecrawl } from "../lib/firecrawl.js";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

export const registerWebScrapeTools: ToolRegistrar = (server, _auth) => {
  server.tool("web_scrape", "Scrape a webpage URL and return its full content as markdown", { url: z.string() }, async ({ url }) => {
    const result = await firecrawl.scrape(url, { formats: ["markdown"] }) as any;
    return textResult(result?.markdown || "No content found.");
  });
};
