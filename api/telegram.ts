import { createMcpHandler } from "./mcp-utils.js";
import { registerTelegramTools } from "./tools/index.js";

export default createMcpHandler("telegram", (req) => ({
  telegram_session: req.headers["x-telegram-session"] || "",
}), registerTelegramTools);
