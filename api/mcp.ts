import { createMcpHandler } from "./mcp-utils.js";
import {
  registerTelegramTools,
  registerSlackTools,
  registerNotionTools,
  registerFigmaTools,
  registerSheetsTools,
  registerDocsTools,
  registerWebSearchTools,
} from "./tools/index.js";

export default createMcpHandler("mcp", (req) => ({
  notion_token: req.headers["x-notion-token"] || "",
  slack_token: req.headers["x-slack-token"] || "",
  figma_token: req.headers["x-figma-token"] || "",
  telegram_session: req.headers["x-telegram-session"] || "",
  GOOGLE_EMAIL: req.headers["x-google-email"] || "",
  GOOGLE_KEY: req.headers["x-google-key"] || "",
}), (server, auth) => {
  registerTelegramTools(server, auth);
  registerSlackTools(server, auth);
  registerNotionTools(server, auth);
  registerFigmaTools(server, auth);
  registerSheetsTools(server, auth);
  registerDocsTools(server, auth);
  registerWebSearchTools(server, auth);
});
