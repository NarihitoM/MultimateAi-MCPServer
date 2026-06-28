var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/api/notion.ts
var notion_exports = {};
__export(notion_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(notion_exports);
var import_zod = require("zod");
var import_client = require("@notionhq/client");
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
async function POST(req) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;
  const auth = parsed.data.auth ?? {};
  try {
    const notion = new import_client.Client({ auth: auth.notion_token });
    let result;
    switch (tool) {
      case "read_notion_page": {
        const { pageId } = args;
        const pageData = await notion.pages.retrieve({ page_id: pageId });
        const blocksData = await notion.blocks.children.list({ block_id: pageId });
        const titleProp = Object.values(pageData.properties).find((p) => p.type === "title");
        const title = titleProp?.title[0]?.plain_text || "Untitled";
        const content = blocksData.results.map((block) => {
          if (block.type === "paragraph") return block.paragraph.rich_text.map((t) => t.plain_text).join("");
          if (block.type === "child_page") return `[Sub-page: "${block.child_page.title}" with ID: ${block.id}]`;
          return `[${block.type} block]`;
        }).join("\n");
        result = JSON.stringify({ success: true, title, content: content || "Page is empty." });
        break;
      }
      case "update_notion_page": {
        const { pageId, title, archived } = args;
        const properties = {};
        if (title) properties.title = { title: [{ text: { content: title } }] };
        const res = await notion.pages.update({ page_id: pageId, archived, properties: Object.keys(properties).length > 0 ? properties : void 0 });
        result = JSON.stringify({ success: true, message: archived ? "Page archived successfully" : "Page updated successfully", pageId: res.id });
        break;
      }
      case "append_notion_blocks": {
        const inp = args;
        try {
          await notion.blocks.children.append({ block_id: inp.pageId, children: inp.blocks });
          result = JSON.stringify({ success: true, message: `Blocks Appended

Successfully added ${inp.blocks.length} blocks to the page.` });
        } catch {
          result = JSON.stringify({ success: false, message: "Failed to append blocks to the Notion page." });
        }
        break;
      }
      case "create_new_page": {
        const inp = args;
        const res = await notion.pages.create({ parent: { page_id: inp.parentPageId }, properties: { title: { title: [{ text: { content: inp.title } }] } }, children: inp.blocks?.length > 0 ? inp.blocks : void 0 });
        result = JSON.stringify({ success: true, message: "New page created successfully", pageId: res.id });
        break;
      }
      case "create_notion_database": {
        const inp = args;
        const res = await notion.databases.create({ parent: { type: "page_id", page_id: inp.parentPageId }, title: [{ type: "text", text: { content: inp.title } }], initial_data_source: { properties: inp.properties } });
        result = JSON.stringify({ success: true, message: "Database created successfully", databaseId: res.id });
        break;
      }
      case "query_notion_database": {
        const { databaseId, filter, sorts, pageSize = 50 } = args;
        const body = { page_size: pageSize };
        if (filter) body.filter = filter;
        if (sorts) body.sorts = sorts;
        const qres = await notion.request({ path: `databases/${databaseId}/query`, method: "post", body });
        const rows = qres.results.map((page) => {
          const props = {};
          for (const [key, val] of Object.entries(page.properties)) {
            const p = val;
            if (p.type === "title") props[key] = p.title[0]?.plain_text || "";
            else if (p.type === "rich_text") props[key] = p.rich_text[0]?.plain_text || "";
            else if (p.type === "select") props[key] = p.select?.name || null;
            else if (p.type === "multi_select") props[key] = p.multi_select.map((o) => o.name);
            else if (p.type === "date") props[key] = p.date?.start || null;
            else if (p.type === "checkbox") props[key] = p.checkbox;
            else if (p.type === "number") props[key] = p.number;
            else if (p.type === "email") props[key] = p.email;
            else if (p.type === "phone") props[key] = p.phone;
            else if (p.type === "url") props[key] = p.url;
            else if (p.type === "status") props[key] = p.status?.name || null;
            else props[key] = `[${p.type}]`;
          }
          return { id: page.id, ...props };
        });
        result = JSON.stringify({ success: true, total: qres.results.length, hasMore: qres.has_more, rows });
        break;
      }
      case "add_notion_database_row": {
        const inp = args;
        const res = await notion.pages.create({ parent: { database_id: inp.databaseId }, properties: inp.properties });
        result = JSON.stringify({ success: true, message: "Row added to database successfully", pageId: res.id });
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
