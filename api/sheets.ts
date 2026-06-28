import { createMcpHandler } from "./mcp-utils.js";
import { registerSheetsTools } from "./tools/index.js";

export default createMcpHandler("sheets", (req) => ({
  GOOGLE_EMAIL: req.headers["x-google-email"] || "",
  GOOGLE_KEY: req.headers["x-google-key"] || "",
}), registerSheetsTools);
