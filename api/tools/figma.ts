import { z } from "zod";
import axios from "axios";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

const API = "https://api.figma.com/v1";
const get = (token: string, path: string) => axios.get(`${API}${path}`, { headers: { "X-Figma-Token": token } }).then((r: any) => r.data);
const post = (token: string, path: string, body: any) => axios.post(`${API}${path}`, body, { headers: { "X-Figma-Token": token, "Content-Type": "application/json" } }).then((r: any) => r.data);

export const registerFigmaTools: ToolRegistrar = (server, auth) => {
  server.tool("figma_read_file", "Read a Figma file structure", { fileKey: z.string() }, async ({ fileKey }) => {
    const token = auth.figma_token!;
    const data = await get(token, `/files/${fileKey}`);
    const simplify = (n: any): any => ({ id: n.id, name: n.name, type: n.type, visible: n.visible, children: n.children ? n.children.map(simplify) : undefined });
    return textResult({ name: data.name, lastModified: data.lastModified, version: data.version, document: simplify(data.document) });
  });

  server.tool("figma_export_asset", "Export Figma assets as images", { fileKey: z.string(), nodeIds: z.array(z.string()), format: z.string().optional().default("png") }, async ({ fileKey, nodeIds, format }) => {
    const data = await get(auth.figma_token!, `/images/${fileKey}?ids=${nodeIds.join(",")}&format=${format}`);
    return textResult({ images: data.images, err: data.err || null });
  });

  server.tool("figma_read_comments", "Read Figma file comments", { fileKey: z.string() }, async ({ fileKey }) => {
    const data = await get(auth.figma_token!, `/files/${fileKey}/comments`);
    return textResult(data.comments.map((c: any) => ({ id: c.id, message: c.message, user: c.user?.handle, createdAt: c.created_at, resolved: c.resolved_at !== null, clientMeta: c.client_meta })));
  });

  server.tool("figma_post_comment", "Post a comment on a Figma file", { fileKey: z.string(), message: z.string() }, async ({ fileKey, message }) => {
    const data = await post(auth.figma_token!, `/files/${fileKey}/comments`, { message });
    return textResult({ id: data.id, message: data.message, createdAt: data.created_at });
  });

  server.tool("figma_get_styles", "Get Figma file styles", { fileKey: z.string() }, async ({ fileKey }) => {
    const data = await get(auth.figma_token!, `/files/${fileKey}/styles`);
    return textResult({ styles: data.meta?.styles?.map((s: any) => ({ name: s.name, styleType: s.style_type, key: s.key, description: s.description })) ?? [] });
  });

  server.tool("figma_get_selection", "Get Figma selection via plugin (desktop only)", {}, async () => {
    return textResult({ message: "Use the Multimate Figma Plugin to get selected nodes.", instruction: "Open the Multimate Figma Bridge plugin in Figma desktop, select nodes, then ask again." });
  });
};
