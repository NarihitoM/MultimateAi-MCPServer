import { McpRequestSchema, ok, err } from "./_shared.js";
import { google } from "googleapis";

function createGoogleAuth(email: string, key: string) {
  return new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, '\n').replace(/\r/g, '').replace(/['"]+/g, '').replace(/^[ \t]+|[ \t]+$/gm, '').trim(),
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/documents"],
  });
}

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args, auth } = parsed.data;

  try {
    const googleAuth = createGoogleAuth(auth?.GOOGLE_EMAIL, auth?.GOOGLE_KEY);
    let result: any;

    switch (tool) {
      case "google_docs_create": {
        const { title, content } = args as any;
        const drive = google.drive({ version: "v3", auth: googleAuth });
        const file = await drive.files.create({
          requestBody: { name: title, mimeType: "application/vnd.google-apps.document" },
          fields: "id,webViewLink",
        });
        const documentId = file.data.id!;
        if (content) {
          const docs = google.docs({ version: "v1", auth: googleAuth });
          await docs.documents.batchUpdate({
            documentId,
            requestBody: { requests: [{ insertText: { location: { index: 1 }, text: content } }] },
          });
        }
        result = JSON.stringify({
          success: true, message: "Document created successfully",
          documentId, url: file.data.webViewLink,
        });
        break;
      }
      case "google_docs_read": {
        const { document_id } = args as any;
        const docs = google.docs({ version: "v1", auth: googleAuth });
        const res = await docs.documents.get({ documentId: document_id });
        if (!res.data || !res.data.body || !res.data.body.content) {
          result = "The document is empty or cannot be read.";
          break;
        }
        const blocks = res.data.body.content
          .map((el: any) => {
            const text = el.paragraph?.elements?.map((e: any) => e.textRun?.content || "").join("") || "";
            const namedStyleType = el.paragraph?.paragraphStyle?.namedStyleType || "NORMAL_TEXT";
            return { type: namedStyleType, text: text.trim(), bullet: el.paragraph?.bullet ? true : false };
          })
          .filter((b: any) => b.text.length > 0);
        result = JSON.stringify({ blocks, text: blocks.map((b: any) => b.text).join("\n").trim() });
        break;
      }
      case "google_docs_delete_file": {
        const { document_id } = args as any;
        const drive = google.drive({ version: "v3", auth: googleAuth });
        await drive.files.delete({ fileId: document_id });
        result = `Document with ID ${document_id} has been permanently deleted.`;
        break;
      }
      case "google_docs_edit": {
        const { document_id, content_blocks, margin_settings } = args as any;
        const docs = google.docs({ version: "v1", auth: googleAuth });
        const doc = await docs.documents.get({ documentId: document_id });
        const bodyContent = doc.data?.body?.content || [];
        let currentDocEndIndex = bodyContent.length > 0
          ? (bodyContent[bodyContent.length - 1].endIndex || 1) - 1
          : 1;
        const requests: any[] = [];
        let nextBulletStartIndex: number | null = null;
        let nextBulletPreset: string | null = null;

        if (margin_settings) {
          requests.push({
            updateDocumentStyle: {
              documentStyle: {
                marginTop: { magnitude: margin_settings.top || 72, unit: "PT" },
                marginBottom: { magnitude: margin_settings.bottom || 72, unit: "PT" },
                marginLeft: { magnitude: margin_settings.left || 72, unit: "PT" },
                marginRight: { magnitude: margin_settings.right || 72, unit: "PT" },
              },
              fields: "marginTop,marginBottom,marginLeft,marginRight",
            },
          });
        }

        for (const block of content_blocks) {
          let start = block.startIndex ?? currentDocEndIndex;
          if (start <= 0) start = 1;
          let end = block.endIndex ?? currentDocEndIndex;
          const textToInsert = (block.text || "") + (block.operation === "CREATE" ? "\n" : "");

          if (block.operation === "DELETE" || block.operation === "UPDATE") {
            let safeEnd = end >= currentDocEndIndex ? currentDocEndIndex : end;
            if (start < safeEnd) {
              requests.push({ deleteContentRange: { range: { startIndex: start, endIndex: safeEnd } } });
            }
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

            if (textFields.length > 0) {
              requests.push({
                updateTextStyle: {
                  range: { startIndex: start, endIndex: newEnd },
                  textStyle: {
                    weightedFontFamily: block.fontFamily ? { fontFamily: block.fontFamily } : undefined,
                    fontSize: block.fontSize ? { magnitude: block.fontSize, unit: "PT" } : undefined,
                    bold: block.bold, italic: block.italic,
                    foregroundColor: block.color ? { color: { rgbColor: block.color } } : undefined,
                  },
                  fields: textFields.join(","),
                },
              });
            }

            const paraFields: string[] = [];
            if (block.alignment) paraFields.push("alignment");
            if (block.lineSpacing) paraFields.push("lineSpacing");
            if (block.spaceAbove !== undefined) paraFields.push("spaceAbove");
            if (block.spaceBelow !== undefined) paraFields.push("spaceBelow");
            if (block.namedStyleType) paraFields.push("namedStyleType");

            if (paraFields.length > 0) {
              requests.push({
                updateParagraphStyle: {
                  range: { startIndex: start, endIndex: newEnd },
                  paragraphStyle: {
                    alignment: block.alignment,
                    lineSpacing: block.lineSpacing,
                    spaceAbove: block.spaceAbove ? { magnitude: block.spaceAbove, unit: "PT" } : undefined,
                    spaceBelow: block.spaceBelow ? { magnitude: block.spaceBelow, unit: "PT" } : undefined,
                    namedStyleType: block.namedStyleType,
                  },
                  fields: paraFields.join(","),
                },
              });
            }

            if (block.bulletPreset === "bullet" || block.bulletPreset === "numbered") {
              if (nextBulletStartIndex === null) { nextBulletStartIndex = start; nextBulletPreset = block.bulletPreset; }
            } else {
              if (nextBulletStartIndex !== null) {
                requests.push({
                  createParagraphBullets: {
                    range: { startIndex: nextBulletStartIndex, endIndex: start },
                    bulletPreset: nextBulletPreset === "numbered" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DASHED_CIRCLE_SQUARE",
                  },
                });
                nextBulletStartIndex = null; nextBulletPreset = null;
              }
            }
          }
        }

        if (nextBulletStartIndex !== null) {
          const lastBlock = content_blocks[content_blocks.length - 1];
          const lastEnd = lastBlock ? (lastBlock.startIndex ?? currentDocEndIndex) + (lastBlock.text || "").length : currentDocEndIndex;
          requests.push({
            createParagraphBullets: {
              range: { startIndex: nextBulletStartIndex, endIndex: lastEnd },
              bulletPreset: nextBulletPreset === "numbered" ? "NUMBERED_DECIMAL_ALPHA_ROMAN" : "BULLET_DASHED_CIRCLE_SQUARE",
            },
          });
        }

        await docs.documents.batchUpdate({ documentId: document_id, requestBody: { requests } });
        result = "Document operation completed successfully.";
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
