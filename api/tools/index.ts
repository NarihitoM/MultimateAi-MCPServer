import { z } from "zod";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { WebClient } from "@slack/web-api";
import { Client as NotionClient } from "@notionhq/client";
import { google } from "googleapis";
import { firecrawl } from "../lib/firecrawl.js";
import type { McpServer } from "./helpers.js";
import { createGoogleAuth, normalizeBlock, textResult } from "./helpers.js";

function makeTelegramClient(session: string) {
  return new TelegramClient(new StringSession(session), Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH || "", { connectionRetries: 5 });
}

function getN8nHeaders(auth: Record<string, string>) {
  const n8nUrl = auth["X-N8N-URL"];
  if (!n8nUrl) throw new Error("n8n URL not configured.");
  const headers: Record<string, string> = { "X-N8N-URL": n8nUrl };
  if (auth["X-N8N-Cookie"]) headers["Cookie"] = auth["X-N8N-Cookie"];
  if (auth["X-N8N-API-Key"]) headers["X-N8N-API-Key"] = auth["X-N8N-API-Key"];
  return headers;
}

async function n8nFetch(auth: Record<string, string>, path: string, options: RequestInit = {}) {
  const headers = getN8nHeaders(auth);
  const n8nUrl = headers["X-N8N-URL"];
  const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (headers["Cookie"]) fetchHeaders["Cookie"] = headers["Cookie"];
  if (headers["X-N8N-API-Key"]) fetchHeaders["X-N8N-API-Key"] = headers["X-N8N-API-Key"];
  const response = await fetch(`${n8nUrl}/api/v1${path}`, { ...options, headers: { ...fetchHeaders, ...(options.headers as Record<string, string> || {}) } });
  if (!response.ok) throw new Error(`n8n API error (${response.status}): ${await response.text()}`);
  return response.json();
}

export async function registerAllTools(server: McpServer, auth: Record<string, string>) {

  // ── Telegram ──
  server.tool("send_message", "Send a Telegram message", { userid: z.string(), message: z.string() }, async ({ userid, message }) => {
    const client = makeTelegramClient(auth.telegram_session);
    try {
      await client.connect();
      await client.sendMessage(userid, { message: `${message}\n\n\n<i>— Sent Via MultimateAIAgent</i>`, parseMode: "html" });
      return textResult({ success: true, to: userid });
    } finally { await client.disconnect(); }
  });

  server.tool("fetch_message", "Fetch recent Telegram messages", { userid: z.string() }, async ({ userid }) => {
    const client = makeTelegramClient(auth.telegram_session);
    try {
      await client.connect();
      const messages = await client.getMessages(userid, { limit: 20 });
      return textResult({ success: true, to: userid, data: messages.map((m: any) => ({ text: m.message, date: m.date })) });
    } finally { await client.disconnect(); }
  });

  server.tool("fetch_chat_user", "List Telegram chat participants", { userid: z.string() }, async ({ userid }) => {
    const client = makeTelegramClient(auth.telegram_session);
    try {
      await client.connect();
      const participants = await client.getParticipants(userid);
      return textResult({ success: true, data: participants.map((p: any) => ({ userId: p.id?.toString(), fullName: `${p.firstName || ""} ${p.lastName || ""}`.trim(), username: p.username || null, role: p.participant?.className === "ChannelParticipantAdmin" || p.participant?.className === "ChannelParticipantCreator" ? "admin" : "member" })) });
    } finally { await client.disconnect(); }
  });

  server.tool("get_info", "Get Telegram entity info", { userid: z.string() }, async ({ userid }) => {
    const client = makeTelegramClient(auth.telegram_session);
    try {
      await client.connect();
      const info = await client.getEntity(userid);
      return textResult({ success: true, data: info });
    } finally { await client.disconnect(); }
  });

  // ── Slack ──
  server.tool("read_slack_history", "Read Slack channel history", { channelId: z.string(), limit: z.number().optional().default(10), oldest: z.string().optional() }, async ({ channelId, limit, oldest }) => {
    const client = new WebClient(auth.slack_token);
    const res = await client.conversations.history({ channel: channelId, limit, oldest });
    if (!res.ok) return textResult(`Error: ${res.error}`);
    return textResult(res.messages);
  });

  server.tool("send_slack_message", "Send a Slack message", { channelId: z.string(), text: z.string() }, async ({ channelId, text }) => {
    const client = new WebClient(auth.slack_token);
    const res = await client.chat.postMessage({ channel: channelId, text: `${text}\n\n\n— Sent Via MultimateAIAgent` });
    if (!res.ok) return textResult(`Error: ${res.error}`);
    return textResult(`Message sent to ${channelId} at ${res.ts}`);
  });

  server.tool("list_conversations", "List Slack conversations", { types: z.array(z.string()).optional().default(["public_channel"]), limit: z.number().optional().default(100) }, async ({ types, limit }) => {
    const client = new WebClient(auth.slack_token);
    const res = await client.conversations.list({ types: types.join(","), limit });
    if (!res.ok) return textResult(`Error: ${res.error}`);
    return textResult(res.channels);
  });

  server.tool("get_user_info", "Get Slack user info", { userId: z.string() }, async ({ userId }) => {
    const client = new WebClient(auth.slack_token);
    const res = await client.users.info({ user: userId });
    if (!res.ok) return textResult(`Error: ${res.error}`);
    return textResult(res.user);
  });

  server.tool("get_team_info", "Get Slack team info", {}, async () => {
    const client = new WebClient(auth.slack_token);
    const res = await client.team.info();
    if (!res.ok) return textResult(`Error: ${res.error}`);
    return textResult(res.team);
  });

  // ── Notion ──
  server.tool("read_notion_page", "Read a Notion page", { pageId: z.string() }, async ({ pageId }) => {
    const notion = new NotionClient({ auth: auth.notion_token });
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
    const notion = new NotionClient({ auth: auth.notion_token });
    const properties: any = {};
    if (title) properties.title = { title: [{ text: { content: title } }] };
    const res = await notion.pages.update({ page_id: pageId, archived, properties: Object.keys(properties).length > 0 ? properties : undefined });
    return textResult({ success: true, message: archived ? "Page archived" : "Page updated", pageId: res.id });
  });

  server.tool("append_notion_blocks", "Append blocks to a Notion page", { pageId: z.string(), blocks: z.array(z.record(z.any())) }, async ({ pageId, blocks }) => {
    const notion = new NotionClient({ auth: auth.notion_token });
    const children = blocks.map(normalizeBlock);
    await notion.blocks.children.append({ block_id: pageId, children });
    return textResult({ success: true, message: `Added ${blocks.length} blocks to the page.` });
  });

  server.tool("create_new_page", "Create a new Notion page", { parentPageId: z.string(), title: z.string(), blocks: z.array(z.record(z.any())).optional() }, async ({ parentPageId, title, blocks }) => {
    const notion = new NotionClient({ auth: auth.notion_token });
    const children = blocks && blocks.length > 0 ? blocks.map(normalizeBlock) : undefined;
    const res = await notion.pages.create({ parent: { page_id: parentPageId }, properties: { title: { title: [{ text: { content: title } }] } }, children });
    return textResult({ success: true, message: "Page created", pageId: res.id });
  });

  server.tool("create_notion_database", "Create a Notion database", { parentPageId: z.string(), title: z.string(), properties: z.record(z.any()) }, async ({ parentPageId, title, properties }) => {
    const notion = new NotionClient({ auth: auth.notion_token });
    const res = await notion.databases.create({ parent: { type: "page_id", page_id: parentPageId }, title: [{ type: "text", text: { content: title } }], initial_data_source: { properties: properties as any } });
    return textResult({ success: true, message: "Database created", databaseId: res.id });
  });

  server.tool("query_notion_database", "Query a Notion database", { databaseId: z.string(), filter: z.record(z.any()).optional(), sorts: z.array(z.record(z.any())).optional(), pageSize: z.number().optional().default(50) }, async ({ databaseId, filter, sorts, pageSize }) => {
    const notion = new NotionClient({ auth: auth.notion_token });
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
    const notion = new NotionClient({ auth: auth.notion_token });
    const res = await notion.pages.create({ parent: { database_id: databaseId }, properties: properties as any });
    return textResult({ success: true, message: "Row added", pageId: res.id });
  });

  // ── Google Sheets ──
  const sheetsApi = () => google.sheets({ version: "v4", auth: createGoogleAuth(auth.GOOGLE_EMAIL!, auth.GOOGLE_KEY!) });

  server.tool("google_sheets_read", "Read data from a Google Sheet", { spreadsheet_id: z.string(), range: z.string().optional().default("Sheet1!A1:Z100") }, async ({ spreadsheet_id, range }) => {
    const sheets = sheetsApi();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheet_id, range });
    const result = !res.data.values || res.data.values.length === 0 ? "The sheet is currently empty." : JSON.stringify(res.data.values);
    return textResult(result);
  });

  server.tool("google_sheets_edit", "Edit cells in a Google Sheet", { spreadsheet_id: z.string(), range: z.string(), values: z.array(z.array(z.any())) }, async ({ spreadsheet_id, range, values }) => {
    const sheets = sheetsApi();
    const res = await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheet_id, range, valueInputOption: "USER_ENTERED", requestBody: { values } });
    const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
    const sheetName = range.split("!")[0];
    const sheet = meta.data.sheets?.find((s: any) => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId;
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: spreadsheet_id, requestBody: { requests: [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } }] } });
    return textResult(`Updated ${res.data.updatedCells} cells in range ${res.data.updatedRange}.`);
  });

  server.tool("google_sheets_delete", "Clear data from a Google Sheet range", { spreadsheet_id: z.string(), range: z.string() }, async ({ spreadsheet_id, range }) => {
    const sheets = sheetsApi();
    const res = await sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheet_id, range });
    return textResult(`Successfully cleared data in range: ${res.data.clearedRange}`);
  });

  server.tool("google_sheets_create", "Create a new Google Spreadsheet", { title: z.string(), sheetNames: z.array(z.string()).optional() }, async ({ title, sheetNames }) => {
    const sheets = sheetsApi();
    const res = await sheets.spreadsheets.create({ requestBody: { properties: { title }, sheets: sheetNames?.map((n) => ({ properties: { title: n } })) } });
    return textResult({ success: true, spreadsheetId: res.data.spreadsheetId, url: res.data.spreadsheetUrl });
  });

  server.tool("google_sheets_add_sheet", "Add a new sheet tab to a Google Spreadsheet", { spreadsheetId: z.string(), title: z.string() }, async ({ spreadsheetId, title }) => {
    const sheets = sheetsApi();
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
    return textResult({ success: true, message: `Sheet "${title}" added` });
  });

  server.tool("google_sheets_append", "Append rows to a Google Sheet", { spreadsheet_id: z.string(), sheet_name: z.string(), values: z.array(z.array(z.any())) }, async ({ spreadsheet_id, sheet_name, values }) => {
    const sheets = sheetsApi();
    const res = await sheets.spreadsheets.values.append({ spreadsheetId: spreadsheet_id, range: `${sheet_name}!A1`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values } });
    return textResult(`Appended data to: ${res.data.updates?.updatedRange}`);
  });

  // ── Google Docs ──
  const docsApi = () => google.docs({ version: "v1", auth: createGoogleAuth(auth.GOOGLE_EMAIL!, auth.GOOGLE_KEY!) });
  const driveApi = () => google.drive({ version: "v3", auth: createGoogleAuth(auth.GOOGLE_EMAIL!, auth.GOOGLE_KEY!) });

  server.tool("google_docs_create", "Create a new Google Doc", { title: z.string(), content: z.string().optional() }, async ({ title, content }) => {
    const gAuth = createGoogleAuth(auth.GOOGLE_EMAIL!, auth.GOOGLE_KEY!);
    const drive = google.drive({ version: "v3", auth: gAuth });
    const file = await drive.files.create({ requestBody: { name: title, mimeType: "application/vnd.google-apps.document" }, fields: "id,webViewLink" });
    const documentId = file.data.id!;
    if (content) {
      await google.docs({ version: "v1", auth: gAuth }).documents.batchUpdate({ documentId, requestBody: { requests: [{ insertText: { location: { index: 1 }, text: content } }] } });
    }
    return textResult({ success: true, documentId, url: file.data.webViewLink });
  });

  server.tool("google_docs_read", "Read a Google Doc", { document_id: z.string() }, async ({ document_id }) => {
    const docs = docsApi();
    const res = await docs.documents.get({ documentId: document_id });
    if (!res.data?.body?.content) return textResult("The document is empty or cannot be read.");
    const blocks = res.data.body.content.map((el: any) => {
      const text = el.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "";
      return { type: el.paragraph?.paragraphStyle?.namedStyleType || "NORMAL_TEXT", text: text.trim(), bullet: el.paragraph?.bullet ? true : false };
    }).filter((b: any) => b.text.length > 0);
    return textResult({ blocks, text: blocks.map((b: any) => b.text).join("\n").trim() });
  });

  server.tool("google_docs_delete_file", "Delete a Google Doc", { document_id: z.string() }, async ({ document_id }) => {
    await driveApi().files.delete({ fileId: document_id });
    return textResult(`Document ${document_id} permanently deleted.`);
  });

  server.tool("google_docs_edit", "Edit a Google Doc with content blocks", {
    document_id: z.string(),
    content_blocks: z.array(z.record(z.any())),
    margin_settings: z.record(z.any()).optional(),
  }, async ({ document_id, content_blocks, margin_settings }) => {
    const docs = docsApi();
    const doc = await docs.documents.get({ documentId: document_id });
    const bodyContent = doc.data?.body?.content || [];
    let currentDocEndIndex = bodyContent.length > 0 ? (bodyContent[bodyContent.length - 1].endIndex || 1) - 1 : 1;
    const requests: any[] = [];
    let nextBulletStartIndex: number | null = null;
    let nextBulletPreset: string | null = null;

    if (margin_settings) {
      requests.push({ updateDocumentStyle: { documentStyle: { marginTop: { magnitude: margin_settings.top || 72, unit: "PT" }, marginBottom: { magnitude: margin_settings.bottom || 72, unit: "PT" }, marginLeft: { magnitude: margin_settings.left || 72, unit: "PT" }, marginRight: { magnitude: margin_settings.right || 72, unit: "PT" } }, fields: "marginTop,marginBottom,marginLeft,marginRight" } });
    }

    for (const block of content_blocks) {
      let start = block.startIndex ?? currentDocEndIndex;
      if (start <= 0) start = 1;
      let end = block.endIndex ?? currentDocEndIndex;
      const textToInsert = (block.text || "") + (block.operation === "CREATE" ? "\n" : "");

      if (block.operation === "DELETE" || block.operation === "UPDATE") {
        const safeEnd = end >= currentDocEndIndex ? currentDocEndIndex : end;
        if (start < safeEnd) requests.push({ deleteContentRange: { range: { startIndex: start, endIndex: safeEnd } } });
      }

      if (block.operation !== "DELETE") {
        requests.push({ insertText: { location: { index: start }, text: textToInsert } });
        const newEnd = start + textToInsert.length;
        const textFields: string[] = [];
        if (block.fontFamily) textFields.push("weightedFontFamily");
        if (block.fontSize) textFields.push("fontSize");
        if (block.bold !== undefined) textFields.push("bold");
        if (block.italic !== undefined) textFields.push("italic");
        if (block.color) textFields.push("foregroundColor");
        if (textFields.length > 0) requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: newEnd }, textStyle: { weightedFontFamily: block.fontFamily ? { fontFamily: block.fontFamily } : undefined, fontSize: block.fontSize ? { magnitude: block.fontSize, unit: "PT" } : undefined, bold: block.bold, italic: block.italic, foregroundColor: block.color ? { color: { rgbColor: block.color } } : undefined }, fields: textFields.join(",") } });

        const paraFields: string[] = [];
        if (block.alignment) paraFields.push("alignment");
        if (block.lineSpacing) paraFields.push("lineSpacing");
        if (block.spaceAbove !== undefined) paraFields.push("spaceAbove");
        if (block.spaceBelow !== undefined) paraFields.push("spaceBelow");
        if (block.namedStyleType) paraFields.push("namedStyleType");
        if (paraFields.length > 0) requests.push({ updateParagraphStyle: { range: { startIndex: start, endIndex: newEnd }, paragraphStyle: { alignment: block.alignment, lineSpacing: block.lineSpacing, spaceAbove: block.spaceAbove ? { magnitude: block.spaceAbove, unit: "PT" } : undefined, spaceBelow: block.spaceBelow ? { magnitude: block.spaceBelow, unit: "PT" } : undefined, namedStyleType: block.namedStyleType }, fields: paraFields.join(",") } });

        if (block.bulletPreset === "bullet" || block.bulletPreset === "numbered") {
          if (nextBulletStartIndex === null) { nextBulletStartIndex = start; nextBulletPreset = block.bulletPreset; }
        } else if (nextBulletStartIndex !== null) {
          requests.push({ createParagraphBullets: { range: { startIndex: nextBulletStartIndex, endIndex: start }, bulletPreset: nextBulletPreset === "numbered" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DASHED_CIRCLE_SQUARE" } });
          nextBulletStartIndex = null;
          nextBulletPreset = null;
        }
      }
    }
    if (nextBulletStartIndex !== null) {
      const lastBlock = content_blocks[content_blocks.length - 1];
      const lastEnd = lastBlock ? (lastBlock.startIndex ?? currentDocEndIndex) + (lastBlock.text || "").length : currentDocEndIndex;
      requests.push({ createParagraphBullets: { range: { startIndex: nextBulletStartIndex, endIndex: lastEnd }, bulletPreset: nextBulletPreset === "numbered" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DASHED_CIRCLE_SQUARE" } });
    }

    await docs.documents.batchUpdate({ documentId: document_id, requestBody: { requests } });
    return textResult("Document operation completed successfully.");
  });

  // ── Web Search & Scrape ──
  server.tool("web_search", "Search the web using Google", { query: z.string() }, async ({ query }) => {
    const results = await firecrawl.search(query, { limit: 3 }) as any;
    const web = results?.web || results?.data?.web || [];
    const text = web.map((r: any) => `${r.title}: ${r.description}`).join("\n");
    return textResult(text || "No results found.");
  });

  server.tool("web_scrape", "Scrape a webpage URL and return its full content as markdown", { url: z.string() }, async ({ url }) => {
    const result = await firecrawl.scrape(url, { formats: ["markdown"] }) as any;
    return textResult(result?.markdown || "No content found.");
  });

  // ── n8n ──
  server.tool("n8n_list_workflows", "List all workflows in n8n", {}, async () => {
    const data = await n8nFetch(auth, "/workflows");
    const workflows = (data.data || []).map((w: any) => `${w.id}: ${w.name} (${w.active ? "active" : "inactive"})`).join("\n");
    return textResult(workflows || "No workflows found.");
  });

  server.tool("n8n_get_workflow", "Get workflow details", { workflowId: z.string().describe("The workflow ID") }, async ({ workflowId }) => {
    const data = await n8nFetch(auth, `/workflows/${workflowId}`);
    return textResult(JSON.stringify(data, null, 2));
  });

  server.tool("n8n_create_workflow", "Create a new workflow", { name: z.string().describe("Workflow name"), nodes: z.array(z.any()).describe("Array of node objects"), connections: z.record(z.any()).describe("Connection map"), settings: z.record(z.any()).optional().describe("Workflow settings") }, async ({ name, nodes, connections, settings }) => {
    const data = await n8nFetch(auth, "/workflows", { method: "POST", body: JSON.stringify({ name, nodes, connections, settings: settings || {} }) });
    return textResult(`Created workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_update_workflow", "Update an existing workflow", { workflowId: z.string().describe("The workflow ID"), name: z.string().optional().describe("New name"), nodes: z.array(z.any()).optional().describe("Updated nodes"), connections: z.record(z.any()).optional().describe("Updated connections"), settings: z.record(z.any()).optional().describe("Updated settings") }, async ({ workflowId, name, nodes, connections, settings }) => {
    const body: any = {};
    if (name) body.name = name;
    if (nodes) body.nodes = nodes;
    if (connections) body.connections = connections;
    if (settings) body.settings = settings;
    const data = await n8nFetch(auth, `/workflows/${workflowId}`, { method: "PATCH", body: JSON.stringify(body) });
    return textResult(`Updated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_delete_workflow", "Delete a workflow", { workflowId: z.string().describe("The workflow ID") }, async ({ workflowId }) => {
    await n8nFetch(auth, `/workflows/${workflowId}`, { method: "DELETE" });
    return textResult(`Deleted workflow ${workflowId}`);
  });

  server.tool("n8n_activate_workflow", "Activate a workflow", { workflowId: z.string().describe("The workflow ID") }, async ({ workflowId }) => {
    const data = await n8nFetch(auth, `/workflows/${workflowId}/activate`, { method: "POST" });
    return textResult(`Activated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_deactivate_workflow", "Deactivate a workflow", { workflowId: z.string().describe("The workflow ID") }, async ({ workflowId }) => {
    const data = await n8nFetch(auth, `/workflows/${workflowId}/deactivate`, { method: "POST" });
    return textResult(`Deactivated workflow: ${data.id} - ${data.name}`);
  });

  server.tool("n8n_trigger_workflow", "Manually execute a workflow", { workflowId: z.string().describe("The workflow ID"), data: z.record(z.any()).optional().describe("Input data") }, async ({ workflowId, data }) => {
    const result = await n8nFetch(auth, `/workflows/${workflowId}/run`, { method: "POST", body: JSON.stringify({ data: data || {} }) });
    return textResult(`Triggered workflow. Execution ID: ${result.id || "unknown"}`);
  });

  server.tool("n8n_list_executions", "List recent executions", { workflowId: z.string().optional().describe("Filter by workflow ID"), status: z.string().optional().describe("Filter by status"), limit: z.number().optional().describe("Number of results") }, async ({ workflowId, status, limit }) => {
    const params = new URLSearchParams();
    if (workflowId) params.set("workflowId", workflowId);
    if (status) params.set("status", status);
    if (limit) params.set("limit", limit.toString());
    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await n8nFetch(auth, `/executions${query}`);
    const executions = (data.data || []).map((e: any) => `${e.id}: ${e.workflowId} - ${e.status} (${e.startedAt})`).join("\n");
    return textResult(executions || "No executions found.");
  });

  server.tool("n8n_get_execution", "Get execution details", { executionId: z.string().describe("The execution ID") }, async ({ executionId }) => {
    const data = await n8nFetch(auth, `/executions/${executionId}`);
    return textResult(JSON.stringify(data, null, 2));
  });

  server.tool("n8n_retry_execution", "Retry a failed execution", { executionId: z.string().describe("The execution ID") }, async ({ executionId }) => {
    const data = await n8nFetch(auth, `/executions/${executionId}/retry`, { method: "POST", body: JSON.stringify({ retrySuccessfulWorkflow: true }) });
    return textResult(`Retried execution ${executionId}. New ID: ${data.id || "unknown"}`);
  });

  server.tool("n8n_list_credentials", "List available credentials", {}, async () => {
    const data = await n8nFetch(auth, "/credentials");
    const creds = (data.data || []).map((c: any) => `${c.id}: ${c.name} (${c.type})`).join("\n");
    return textResult(creds || "No credentials found.");
  });
}
