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

// api/docs.ts
var docs_exports = {};
__export(docs_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(docs_exports);
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
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"]
  });
}
async function POST(req) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args } = parsed.data;
  const auth = parsed.data.auth ?? {};
  try {
    const googleAuth = createGoogleAuth(auth.GOOGLE_EMAIL, auth.GOOGLE_KEY);
    let result;
    switch (tool) {
      case "google_docs_create": {
        const { title, content } = args;
        const drive = import_googleapis.google.drive({ version: "v3", auth: googleAuth });
        const file = await drive.files.create({ requestBody: { name: title, mimeType: "application/vnd.google-apps.document" }, fields: "id,webViewLink" });
        const documentId = file.data.id;
        if (content) {
          await import_googleapis.google.docs({ version: "v1", auth: googleAuth }).documents.batchUpdate({ documentId, requestBody: { requests: [{ insertText: { location: { index: 1 }, text: content } }] } });
        }
        result = JSON.stringify({ success: true, message: "Document created successfully", documentId, url: file.data.webViewLink });
        break;
      }
      case "google_docs_read": {
        const { document_id } = args;
        const docs = import_googleapis.google.docs({ version: "v1", auth: googleAuth });
        const res = await docs.documents.get({ documentId: document_id });
        if (!res.data?.body?.content) {
          result = "The document is empty or cannot be read.";
          break;
        }
        const blocks = res.data.body.content.map((el) => {
          const text = el.paragraph?.elements?.map((e) => e.textRun?.content || "").join("") || "";
          return { type: el.paragraph?.paragraphStyle?.namedStyleType || "NORMAL_TEXT", text: text.trim(), bullet: el.paragraph?.bullet ? true : false };
        }).filter((b) => b.text.length > 0);
        result = JSON.stringify({ blocks, text: blocks.map((b) => b.text).join("\n").trim() });
        break;
      }
      case "google_docs_delete_file": {
        const { document_id } = args;
        await import_googleapis.google.drive({ version: "v3", auth: googleAuth }).files.delete({ fileId: document_id });
        result = `Document with ID ${document_id} has been permanently deleted.`;
        break;
      }
      case "google_docs_edit": {
        const { document_id, content_blocks, margin_settings } = args;
        const docs = import_googleapis.google.docs({ version: "v1", auth: googleAuth });
        const doc = await docs.documents.get({ documentId: document_id });
        const bodyContent = doc.data?.body?.content || [];
        let currentDocEndIndex = bodyContent.length > 0 ? (bodyContent[bodyContent.length - 1].endIndex || 1) - 1 : 1;
        const requests = [];
        let nextBulletStartIndex = null;
        let nextBulletPreset = null;
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
            const textFields = [];
            if (block.fontFamily) textFields.push("weightedFontFamily");
            if (block.fontSize) textFields.push("fontSize");
            if (block.bold !== void 0) textFields.push("bold");
            if (block.italic !== void 0) textFields.push("italic");
            if (block.color) textFields.push("foregroundColor");
            if (textFields.length > 0) requests.push({ updateTextStyle: { range: { startIndex: start, endIndex: newEnd }, textStyle: { weightedFontFamily: block.fontFamily ? { fontFamily: block.fontFamily } : void 0, fontSize: block.fontSize ? { magnitude: block.fontSize, unit: "PT" } : void 0, bold: block.bold, italic: block.italic, foregroundColor: block.color ? { color: { rgbColor: block.color } } : void 0 }, fields: textFields.join(",") } });
            const paraFields = [];
            if (block.alignment) paraFields.push("alignment");
            if (block.lineSpacing) paraFields.push("lineSpacing");
            if (block.spaceAbove !== void 0) paraFields.push("spaceAbove");
            if (block.spaceBelow !== void 0) paraFields.push("spaceBelow");
            if (block.namedStyleType) paraFields.push("namedStyleType");
            if (paraFields.length > 0) requests.push({ updateParagraphStyle: { range: { startIndex: start, endIndex: newEnd }, paragraphStyle: { alignment: block.alignment, lineSpacing: block.lineSpacing, spaceAbove: block.spaceAbove ? { magnitude: block.spaceAbove, unit: "PT" } : void 0, spaceBelow: block.spaceBelow ? { magnitude: block.spaceBelow, unit: "PT" } : void 0, namedStyleType: block.namedStyleType }, fields: paraFields.join(",") } });
            if (block.bulletPreset === "bullet" || block.bulletPreset === "numbered") {
              if (nextBulletStartIndex === null) {
                nextBulletStartIndex = start;
                nextBulletPreset = block.bulletPreset;
              }
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
        result = "Document operation completed successfully.";
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
