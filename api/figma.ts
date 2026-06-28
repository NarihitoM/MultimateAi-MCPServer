import { createMcpHandler } from "./mcp-utils.js";
import { registerFigmaTools } from "./tools/index.js";

export default createMcpHandler("figma", (req) => ({
  figma_token: req.headers["x-figma-token"] || "",
}), registerFigmaTools);
