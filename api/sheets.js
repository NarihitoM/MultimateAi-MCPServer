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

// src/api/sheets.ts
var sheets_exports = {};
__export(sheets_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(sheets_exports);
var import_zod = require("zod");
var import_googleapis = require("googleapis");
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
function createGoogleAuth(email, key) {
  return new import_googleapis.google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/['"]+/g, "").replace(/^[ \t]+|[ \t]+$/gm, "").trim(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
  });
}
async function POST(req) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;
  const auth = parsed.data.auth ?? {};
  try {
    const googleAuth = createGoogleAuth(auth.GOOGLE_EMAIL, auth.GOOGLE_KEY);
    const sheets = import_googleapis.google.sheets({ version: "v4", auth: googleAuth });
    let result;
    switch (tool) {
      case "google_sheets_read": {
        const { spreadsheet_id, range } = args;
        const res = await sheets.spreadsheets.values.get({ spreadsheetId: spreadsheet_id, range: range || "Sheet1!A1:Z100" });
        result = !res.data.values || res.data.values.length === 0 ? "The sheet is currently empty." : JSON.stringify(res.data.values);
        break;
      }
      case "google_sheets_edit": {
        const { spreadsheet_id, range, values } = args;
        const res = await sheets.spreadsheets.values.update({ spreadsheetId: spreadsheet_id, range, valueInputOption: "USER_ENTERED", requestBody: { values } });
        const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
        const sheetName = range.split("!")[0];
        const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
        const sheetId = sheet?.properties?.sheetId;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheet_id,
          requestBody: { requests: [{ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } }] }
        });
        result = `Updated ${res.data.updatedCells} cells in range ${res.data.updatedRange}.`;
        break;
      }
      case "google_sheets_delete": {
        const { spreadsheet_id, range } = args;
        const res = await sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheet_id, range });
        result = `Successfully cleared data in range: ${res.data.clearedRange}`;
        break;
      }
      case "google_sheets_create": {
        const { title, sheetNames } = args;
        const res = await sheets.spreadsheets.create({ requestBody: { properties: { title }, sheets: sheetNames?.map((n) => ({ properties: { title: n } })) } });
        result = JSON.stringify({ success: true, message: "Spreadsheet created successfully", spreadsheetId: res.data.spreadsheetId, url: res.data.spreadsheetUrl });
        break;
      }
      case "google_sheets_add_sheet": {
        const inp = args;
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: inp.spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: inp.title } } }] } });
        result = JSON.stringify({ success: true, message: `Sheet "${inp.title}" added successfully` });
        break;
      }
      case "google_sheets_append": {
        const { spreadsheet_id, sheet_name, values } = args;
        const res = await sheets.spreadsheets.values.append({ spreadsheetId: spreadsheet_id, range: `${sheet_name}!A1`, valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values } });
        result = `Appended data to: ${res.data.updates?.updatedRange}`;
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
