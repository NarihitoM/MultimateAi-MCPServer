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

// api/slack.ts
var slack_exports = {};
__export(slack_exports, {
  POST: () => POST
});
module.exports = __toCommonJS(slack_exports);
var import_zod = require("zod");
var import_web_api = require("@slack/web-api");
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
  try {
    const client = new import_web_api.WebClient(auth.slack_token);
    let result;
    switch (tool) {
      case "read_slack_history": {
        const { channelId, limit = 10, oldest } = args;
        const res = await client.conversations.history({ channel: channelId, limit, oldest });
        if (!res.ok) result = `Error fetching messages: ${res.error}`;
        else result = JSON.stringify(res.messages);
        break;
      }
      case "send_slack_message": {
        const { channelId, text } = args;
        const res = await client.chat.postMessage({ channel: channelId, text: `${text}


\u2014 Sent Via MultimateAIAgent` });
        if (res.ok) result = `Message sent successfully to ${channelId} at ${res.ts}`;
        else result = `Error sending message: ${res.error}`;
        break;
      }
      case "list_conversations": {
        const { types, limit } = args;
        const res = await client.conversations.list({ types: types?.join(",") || "public_channel", limit: limit || 100 });
        result = JSON.stringify(res.channels);
        break;
      }
      case "get_user_info": {
        const { userId } = args;
        const res = await client.users.info({ user: userId });
        result = JSON.stringify(res.user);
        break;
      }
      case "get_team_info": {
        const res = await client.team.info();
        result = JSON.stringify(res.team);
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
