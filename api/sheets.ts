import { McpRequestSchema, ok, err } from "./_shared.js";
import { google } from "googleapis";

function createGoogleAuth(email: string, key: string) {
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/['"]+/g, '').replace(/^[ \t]+|[ \t]+$/gm, '').trim(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  });
}

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args, auth } = parsed.data;

  try {
    const googleAuth = createGoogleAuth(auth?.GOOGLE_EMAIL, auth?.GOOGLE_KEY);
    const sheets = google.sheets({ version: "v4", auth: googleAuth });
    let result: any;

    switch (tool) {
      case "google_sheets_read": {
        const { spreadsheet_id, range } = args as any;
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheet_id, range: range || "Sheet1!A1:Z100",
        });
        result = !res.data.values || res.data.values.length === 0
          ? "The sheet is currently empty."
          : JSON.stringify(res.data.values);
        break;
      }
      case "google_sheets_edit": {
        const { spreadsheet_id, range, values } = args as any;
        const res = await sheets.spreadsheets.values.update({
          spreadsheetId: spreadsheet_id, range, valueInputOption: "USER_ENTERED", requestBody: { values },
        });
        const meta = await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id });
        const sheetName = range.split("!")[0];
        const sheet = meta.data.sheets?.find((s: any) => s.properties?.title === sheetName);
        const sheetId = sheet?.properties?.sheetId;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: spreadsheet_id,
          requestBody: {
            requests: [{
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true } } },
                fields: "userEnteredFormat.textFormat.bold",
              },
            }],
          },
        });
        result = `Updated ${res.data.updatedCells} cells in range ${res.data.updatedRange}.`;
        break;
      }
      case "google_sheets_delete": {
        const { spreadsheet_id, range } = args as any;
        const res = await sheets.spreadsheets.values.clear({ spreadsheetId: spreadsheet_id, range });
        result = `Successfully cleared data in range: ${res.data.clearedRange}`;
        break;
      }
      case "google_sheets_create": {
        const { title, sheetNames } = args as any;
        const res = await sheets.spreadsheets.create({
          requestBody: {
            properties: { title },
            sheets: sheetNames?.map((name: string) => ({ properties: { title: name } })),
          },
        });
        result = JSON.stringify({
          success: true, message: "Spreadsheet created successfully",
          spreadsheetId: res.data.spreadsheetId, url: res.data.spreadsheetUrl,
        });
        break;
      }
      case "google_sheets_add_sheet": {
        const inp = args as any;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: inp.spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title: inp.title } } }] },
        });
        result = JSON.stringify({ success: true, message: `Sheet "${inp.title}" added successfully` });
        break;
      }
      case "google_sheets_append": {
        const { spreadsheet_id, sheet_name, values } = args as any;
        const res = await sheets.spreadsheets.values.append({
          spreadsheetId: spreadsheet_id, range: `${sheet_name}!A1`,
          valueInputOption: "USER_ENTERED", insertDataOption: "INSERT_ROWS", requestBody: { values },
        });
        result = `Appended data to: ${res.data.updates?.updatedRange}`;
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
