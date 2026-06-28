import { z } from "zod";
import axios from "axios";

const FIGMA_API_BASE = "https://api.figma.com/v1";

const McpRequestSchema = z.object({
  tool: z.string(),
  args: z.record(z.unknown()),
  auth: z.record(z.unknown()).optional(),
});

function ok(content: unknown) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(content) }] }), { headers: { "Content-Type": "application/json" } });
}
function err(message: string, status = 400) {
  return new Response(JSON.stringify({ content: [{ type: "text", text: message }] }), { status, headers: { "Content-Type": "application/json" } });
}

function figmaGet(token: string, path: string) {
  return axios.get(`${FIGMA_API_BASE}${path}`, { headers: { "X-Figma-Token": token } }).then((r: any) => r.data);
}

function figmaPost(token: string, path: string, body: any) {
  return axios.post(`${FIGMA_API_BASE}${path}`, body, { headers: { "X-Figma-Token": token, "Content-Type": "application/json" } }).then((r: any) => r.data);
}

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;
  const auth = (parsed.data.auth ?? {}) as Record<string, string | undefined>;

  try {
    const token = auth.figma_token!;
    let result: any;

    switch (tool) {
      case "figma_read_file": {
        const { fileKey, depth } = args as any;
        const data = await figmaGet(token, `/files/${fileKey}`);
        const simplifyNode = (node: any): any => ({ id: node.id, name: node.name, type: node.type, visible: node.visible, children: node.children ? node.children.map(simplifyNode) : undefined });
        result = JSON.stringify({ name: data.name, lastModified: data.lastModified, version: data.version, document: simplifyNode(data.document) });
        break;
      }
      case "figma_export_asset": {
        const { fileKey, nodeIds, format } = args as any;
        const data = await figmaGet(token, `/images/${fileKey}?ids=${nodeIds.join(",")}&format=${format || "png"}`);
        result = JSON.stringify({ images: data.images, err: data.err || null });
        break;
      }
      case "figma_read_comments": {
        const { fileKey } = args as any;
        const data = await figmaGet(token, `/files/${fileKey}/comments`);
        result = JSON.stringify(data.comments.map((c: any) => ({ id: c.id, message: c.message, user: c.user?.handle, createdAt: c.created_at, resolved: c.resolved_at !== null, clientMeta: c.client_meta })));
        break;
      }
      case "figma_post_comment": {
        const { fileKey, message } = args as any;
        const data = await figmaPost(token, `/files/${fileKey}/comments`, { message });
        result = JSON.stringify({ id: data.id, message: data.message, createdAt: data.created_at });
        break;
      }
      case "figma_get_styles": {
        const { fileKey } = args as any;
        const data = await figmaGet(token, `/files/${fileKey}/styles`);
        result = JSON.stringify({ styles: data.meta?.styles?.map((s: any) => ({ name: s.name, styleType: s.style_type, key: s.key, description: s.description })) ?? [] });
        break;
      }
      case "figma_get_selection": {
        result = JSON.stringify({ message: "Use the Multimate Figma Plugin to get selected nodes. The plugin must be running in Figma desktop.", instruction: "Open the Multimate Figma Bridge plugin in Figma desktop, select the nodes you want to work with, then ask again." });
        break;
      }
      default: return err(`Unknown tool: ${tool}`);
    }

    return ok(result);
  } catch (error: any) {
    return err(`Error: ${error.message || error}`);
  }
}
