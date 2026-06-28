import { createMcpHandler } from "./mcp-utils.js";
import { registerDocsTools } from "./tools/index.js";

export default createMcpHandler("docs", (req) => ({
  GOOGLE_EMAIL: req.headers["x-google-email"] || "",
  GOOGLE_KEY: req.headers["x-google-key"] || "",
}), registerDocsTools);
