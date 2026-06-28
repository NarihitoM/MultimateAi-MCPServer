import { createMcpHandler } from "./mcp-utils.js";
import { registerSlackTools } from "./tools/index.js";

export default createMcpHandler("slack", (req) => ({
  slack_token: req.headers["x-slack-token"] || "",
}), registerSlackTools);
