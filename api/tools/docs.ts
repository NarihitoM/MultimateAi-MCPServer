import { z } from "zod";
import { google } from "googleapis";
import type { ToolRegistrar } from "./helpers.js";
import { createGoogleAuth, textResult } from "./helpers.js";

export const registerDocsTools: ToolRegistrar = (server, auth) => {
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
};
