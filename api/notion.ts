import { createMcpHandler } from "./mcp-utils.js";
import { registerNotionTools } from "./tools/index.js";

export default createMcpHandler("notion", (req) => ({
  notion_token: req.headers["x-notion-token"] || "",
}), registerNotionTools);
