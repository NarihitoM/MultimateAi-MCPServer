var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// api/figma.ts
var figma_exports = {};
__export(figma_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(figma_exports);
var import_zod = require("zod");
var import_axios = __toESM(require("axios"));
var FIGMA_API_BASE = "https://api.figma.com/v1";
var McpRequestSchema = import_zod.z.object({
  tool: import_zod.z.string(),
  args: import_zod.z.record(import_zod.z.unknown()),
  auth: import_zod.z.record(import_zod.z.unknown()).optional()
});
function ok(content) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(content) }] }), { headers: { "Content-Type": "application/json" } });
}
function err(message, status = 400) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: message }] }), { status, headers: { "Content-Type": "application/json" } });
}
function figmaGet(token, path) {
  return import_axios.default.get(`${FIGMA_API_BASE}${path}`, { headers: { "X-Figma-Token": token } }).then((r) => r.data);
}
function figmaPost(token, path, body) {
  return import_axios.default.post(`${FIGMA_API_BASE}${path}`, body, { headers: { "X-Figma-Token": token, "Content-Type": "application/json" } }).then((r) => r.data);
}
async function POST(req) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;
  const auth = parsed.data.auth ?? {};
  try {
    const token = auth.figma_token;
    let result;
    switch (tool) {
      case "figma_read_file": {
        const { fileKey, depth } = args;
        const data = await figmaGet(token, `/files/${fileKey}`);
        const simplifyNode = (node) => ({ id: node.id, name: node.name, type: node.type, visible: node.visible, children: node.children ? node.children.map(simplifyNode) : void 0 });
        result = JSON.stringify({ name: data.name, lastModified: data.lastModified, version: data.version, document: simplifyNode(data.document) });
        break;
      }
      case "figma_export_asset": {
        const { fileKey, nodeIds, format } = args;
        const data = await figmaGet(token, `/images/${fileKey}?ids=${nodeIds.join(",")}&format=${format || "png"}`);
        result = JSON.stringify({ images: data.images, err: data.err || null });
        break;
      }
      case "figma_read_comments": {
        const { fileKey } = args;
        const data = await figmaGet(token, `/files/${fileKey}/comments`);
        result = JSON.stringify(data.comments.map((c) => ({ id: c.id, message: c.message, user: c.user?.handle, createdAt: c.created_at, resolved: c.resolved_at !== null, clientMeta: c.client_meta })));
        break;
      }
      case "figma_post_comment": {
        const { fileKey, message } = args;
        const data = await figmaPost(token, `/files/${fileKey}/comments`, { message });
        result = JSON.stringify({ id: data.id, message: data.message, createdAt: data.created_at });
        break;
      }
      case "figma_get_styles": {
        const { fileKey } = args;
        const data = await figmaGet(token, `/files/${fileKey}/styles`);
        result = JSON.stringify({ styles: data.meta?.styles?.map((s) => ({ name: s.name, styleType: s.style_type, key: s.key, description: s.description })) ?? [] });
        break;
      }
      case "figma_get_selection": {
        result = JSON.stringify({ message: "Use the Multimate Figma Plugin to get selected nodes. The plugin must be running in Figma desktop.", instruction: "Open the Multimate Figma Bridge plugin in Figma desktop, select the nodes you want to work with, then ask again." });
        break;
      }
      default:
        return err(`Unknown tool: ${tool}`);
    }
    return ok(result);
  } catch (error) {
    return err(`Error: ${error.message || error}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  POST
});
