import { McpRequestSchema, ok, err } from "./_shared.js";
import { Client } from "@notionhq/client";

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args, auth } = parsed.data;

  try {
    const notion = new Client({ auth: auth?.notion_token });
    let result: any;

    switch (tool) {
      case "read_notion_page": {
        const { pageId } = args as any;
        const pageData: any = await notion.pages.retrieve({ page_id: pageId });
        const blocksData = await notion.blocks.children.list({ block_id: pageId });
        const titleProp = Object.values(pageData.properties).find((p: any) => p.type === "title") as any;
        const title = titleProp?.title[0]?.plain_text || "Untitled";
        const content = blocksData.results.map((block: any) => {
          if (block.type === "paragraph") return block.paragraph.rich_text.map((t: any) => t.plain_text).join("");
          if (block.type === "child_page") return `[Sub-page: "${block.child_page.title}" with ID: ${block.id}]`;
          return `[${block.type} block]`;
        }).join("\n");
        result = JSON.stringify({ success: true, title, content: content || "Page is empty." });
        break;
      }
      case "update_notion_page": {
        const { pageId, title, archived } = args as any;
        const properties: any = {};
        if (title) properties.title = { title: [{ text: { content: title } }] };
        const res = await notion.pages.update({
          page_id: pageId, archived,
          properties: Object.keys(properties).length > 0 ? properties : undefined,
        });
        result = JSON.stringify({
          success: true, message: archived ? "Page archived successfully" : "Page updated successfully",
          pageId: res.id,
        });
        break;
      }
      case "append_notion_blocks": {
        const inp = args as any;
        try {
          await notion.blocks.children.append({ block_id: inp.pageId, children: inp.blocks as any[] });
          result = JSON.stringify({ success: true, message: `Blocks Appended\n\nSuccessfully added ${inp.blocks.length} blocks to the page.` });
        } catch {
          result = JSON.stringify({ success: false, message: "Failed to append blocks to the Notion page." });
        }
        break;
      }
      case "create_new_page": {
        const inp = args as any;
        const res = await notion.pages.create({
          parent: { page_id: inp.parentPageId },
          properties: { title: { title: [{ text: { content: inp.title } }] } },
          children: inp.blocks?.length > 0 ? inp.blocks : undefined,
        });
        result = JSON.stringify({ success: true, message: "New page created successfully", pageId: res.id });
        break;
      }
      case "create_notion_database": {
        const inp = args as any;
        const res = await notion.databases.create({
          parent: { type: "page_id", page_id: inp.parentPageId },
          title: [{ type: "text", text: { content: inp.title } }],
          initial_data_source: { properties: inp.properties as any },
        });
        result = JSON.stringify({ success: true, message: "Database created successfully", databaseId: res.id });
        break;
      }
      case "query_notion_database": {
        const { databaseId, filter, sorts, pageSize = 50 } = args as any;
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
        result = JSON.stringify({ success: true, total: qres.results.length, hasMore: qres.has_more, rows });
        break;
      }
      case "add_notion_database_row": {
        const inp = args as any;
        const res = await notion.pages.create({
          parent: { database_id: inp.databaseId },
          properties: inp.properties as any,
        });
        result = JSON.stringify({ success: true, message: "Row added to database successfully", pageId: res.id });
        break;
      }
      default:
        return err(`Unknown tool: ${tool}`);
    }

    return ok(result);
  } catch (error: any) {
    return err(`Error: ${error.message || error}`);
  }
}
