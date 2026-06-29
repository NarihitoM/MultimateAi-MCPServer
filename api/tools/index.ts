export type { ToolRegistrar } from "./helpers.js";
import { registerTelegramTools } from "./telegram.js";
import { registerSlackTools } from "./slack.js";
import { registerNotionTools } from "./notion.js";
import { registerSheetsTools } from "./sheets.js";
import { registerDocsTools } from "./docs.js";
import { registerWebSearchTools } from "./websearch.js";
import { registerN8nTools } from "./n8n.js";

const registrars = [
  registerTelegramTools,
  registerSlackTools,
  registerNotionTools,
  registerSheetsTools,
  registerDocsTools,
  registerWebSearchTools,
  registerN8nTools,
];

export function registerAllTools(server: any, auth: Record<string, string>) {
  for (const reg of registrars) {
    reg(server, auth);
  }
}
