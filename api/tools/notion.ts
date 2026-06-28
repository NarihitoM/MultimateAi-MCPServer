import { z } from "zod";
import { Client } from "@notionhq/client";
import type { ToolRegistrar } from "./helpers.js";
import { normalizeBlock, textResult } from "./helpers.js";

export const registerNotionTools: ToolRegistrar = (server, auth) => {
  server.tool("read_notion_page", "Read a Notion page", { pageId: z.string() }, async ({ pageId }) => {
    const notion = new Client({ auth: auth.notion_token });
    const pageData: any = await notion.pages.retrieve({ page_id: pageId });
    const blocksData = await notion.blocks.children.list({ block_id: pageId });
    const titleProp = Object.values(pageData.properties).find((p: any) => p.type === "title") as any;
    const title = titleProp?.title[0]?.plain_text || "Untitled";
    const content = blocksData.results.map((block: any) => {
      if (block.type === "paragraph") return block.paragraph.rich_text.map((t: any) => t.plain_text).join("");
      if (block.type === "child_page") return `[Sub-page: "${block.child_page.title}" with ID: ${block.id}]`;
      return `[${block.type} block]`;
    }).join("\n");
    return textResult({ success: true, title, content: content || "Page is empty." });
  });

  server.tool("update_notion_page", "Update a Notion page", { pageId: z.string(), title: z.string().optional(), archived: z.boolean().optional() }, async ({ pageId, title, archived }) => {
    const notion = new Client({ auth: auth.notion_token });
    const properties: any = {};
    if (title) properties.title = { title: [{ text: { content: title } }] };
    const res = await notion.pages.update({ page_id: pageId, archived, properties: Object.keys(properties).length > 0 ? properties : undefined });
    return textResult({ success: true, message: archived ? "Page archived" : "Page updated", pageId: res.id });
  });

  server.tool("append_notion_blocks", "Append blocks to a Notion page", { pageId: z.string(), blocks: z.array(z.record(z.any())) }, async ({ pageId, blocks }) => {
    const notion = new Client({ auth: auth.notion_token });
    const children = blocks.map(normalizeBlock);
    await notion.blocks.children.append({ block_id: pageId, children });
    return textResult({ success: true, message: `Added ${blocks.length} blocks to the page.` });
  });

  server.tool("create_new_page", "Create a new Notion page", { parentPageId: z.string(), title: z.string(), blocks: z.array(z.record(z.any())).optional() }, async ({ parentPageId, title, blocks }) => {
    const notion = new Client({ auth: auth.notion_token });
    const children = blocks && blocks.length > 0 ? blocks.map(normalizeBlock) : undefined;
    const res = await notion.pages.create({ parent: { page_id: parentPageId }, properties: { title: { title: [{ text: { content: title } }] } }, children });
    return textResult({ success: true, message: "Page created", pageId: res.id });
  });

  server.tool("create_notion_database", "Create a Notion database", { parentPageId: z.string(), title: z.string(), properties: z.record(z.any()) }, async ({ parentPageId, title, properties }) => {
    const notion = new Client({ auth: auth.notion_token });
    const res = await notion.databases.create({ parent: { type: "page_id", page_id: parentPageId }, title: [{ type: "text", text: { content: title } }], initial_data_source: { properties: properties as any } });
    return textResult({ success: true, message: "Database created", databaseId: res.id });
  });

  server.tool("query_notion_database", "Query a Notion database", { databaseId: z.string(), filter: z.record(z.any()).optional(), sorts: z.array(z.record(z.any())).optional(), pageSize: z.number().optional().default(50) }, async ({ databaseId, filter, sorts, pageSize }) => {
    const notion = new Client({ auth: auth.notion_token });
    const body: any = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    const qres = await notion.request({ path: `databases/${databaseId}/query`, method: "post", body }) as any;
    const rows = qres.results.map((page: any) => {
      const props: any = {};
      for (const [key, val] of Object.entries(page.properties)) {
        const p = val as any;
        if (p.type === "title") props[key] = p.title[0]?.plain_text || "";
        else if (p.type === "rich_text") props[key] = p.rich_text[0]?.plain_text || "";
        else if (p.type === "select") props[key] = p.select?.name || null;
        else if (p.type === "multi_select") props[key] = p.multi_select.map((o: any) => o.name);
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
    return textResult({ success: true, total: qres.results.length, hasMore: qres.has_more, rows });
  });

  server.tool("add_notion_database_row", "Add a row to a Notion database", { databaseId: z.string(), properties: z.record(z.any()) }, async ({ databaseId, properties }) => {
    const notion = new Client({ auth: auth.notion_token });
    const res = await notion.pages.create({ parent: { database_id: databaseId }, properties: properties as any });
    return textResult({ success: true, message: "Row added", pageId: res.id });
  });
};
