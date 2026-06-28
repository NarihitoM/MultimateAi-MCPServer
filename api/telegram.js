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

// src/api/telegram.ts
var telegram_exports = {};
__export(telegram_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(telegram_exports);
var import_zod = require("zod");
var import_telegram = require("telegram");
var import_sessions = require("telegram/sessions");
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
  const client = new import_telegram.TelegramClient(
    new import_sessions.StringSession(auth.telegram_session),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH || "",
    { connectionRetries: 5 }
  );
  try {
    await client.connect();
    let result;
    switch (tool) {
      case "send_message": {
        const { userid, message } = args;
        await client.sendMessage(userid, { message: `${message}


<i>\u2014 Sent Via MultimateAIAgent</i>`, parseMode: "html" });
        result = JSON.stringify({ success: true, message: "Message sent successfully", to: userid });
        break;
      }
      case "fetch_message": {
        const { userid } = args;
        const messages = await client.getMessages(userid, { limit: 20 });
        result = JSON.stringify({ success: true, message: "Messages fetched successfully", to: userid, data: messages.map((m) => ({ text: m.message, date: m.date })) });
        break;
      }
      case "fetch_chat_user": {
        const { userid } = args;
        const participants = await client.getParticipants(userid);
        result = JSON.stringify({ success: true, data: participants.map((p) => ({ userId: p.id?.toString(), fullName: `${p.firstName || ""} ${p.lastName || ""}`.trim(), username: p.username || null, role: p.participant?.className === "ChannelParticipantAdmin" || p.participant?.className === "ChannelParticipantCreator" ? "admin" : "member" })) });
        break;
      }
      case "get_info": {
        const { userid } = args;
        const info = await client.getEntity(userid);
        result = JSON.stringify({ success: true, data: info });
        break;
      }
      default:
        return err(`Unknown tool: ${tool}`);
    }
    return ok(result);
  } catch (error) {
    return err(`Error: ${error.message || error}`);
  } finally {
    await client.disconnect();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  POST
});
