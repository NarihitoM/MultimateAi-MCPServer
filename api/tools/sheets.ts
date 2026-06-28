import { z } from "zod";
import { google } from "googleapis";
import type { ToolRegistrar } from "./helpers.js";
import { createGoogleAuth, textResult } from "./helpers.js";

export const registerSheetsTools: ToolRegistrar = (server, auth) => {
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
};
