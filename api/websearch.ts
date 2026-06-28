import { createMcpHandler } from "./mcp-utils.js";
import { registerWebSearchTools } from "./tools/index.js";

export default createMcpHandler("websearch", () => ({}), registerWebSearchTools);
