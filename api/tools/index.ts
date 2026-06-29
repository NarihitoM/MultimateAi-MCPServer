import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { ToolRegistrar } from "./helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKIP = new Set(["index.js", "helpers.js"]);

export async function registerAllTools(server: any, auth: Record<string, string>) {
  const files = readdirSync(__dirname).filter(f => f.endsWith(".js") && !SKIP.has(f));
  for (const file of files) {
    try {
      const mod = await import(`./${file}`);
      const registrar = Object.values(mod).find(v => typeof v === "function") as ToolRegistrar | undefined;
      if (registrar) registrar(server, auth);
    } catch (e) {
      console.error(`Failed to load tools from ${file}:`, e);
    }
  }
}