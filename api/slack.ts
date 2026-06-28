import { McpRequestSchema, getAuth, ok, err } from "./_shared.js";
import { WebClient } from "@slack/web-api";

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args, auth: rawAuth } = parsed.data;
  const auth = getAuth(rawAuth);

  try {
    const client = new WebClient(auth.slack_token);
    let result: any;

    switch (tool) {
      case "read_slack_history": {
        const { channelId, limit = 10, oldest } = args as any;
        const res = await client.conversations.history({ channel: channelId, limit, oldest });
        if (!res.ok) result = `Error fetching messages: ${res.error}`;
        else result = JSON.stringify(res.messages);
        break;
      }
      case "send_slack_message": {
        const { channelId, text } = args as any;
        const res = await client.chat.postMessage({ channel: channelId, text: `${text}\n\n\n— Sent Via MultimateAIAgent` });
        if (res.ok) result = `Message sent successfully to ${channelId} at ${res.ts}`;
        else result = `Error sending message: ${res.error}`;
        break;
      }
      case "list_conversations": {
        const { types, limit } = args as any;
        const res = await client.conversations.list({ types: types?.join(",") || "public_channel", limit: limit || 100 });
        result = JSON.stringify(res.channels);
        break;
      }
      case "get_user_info": {
        const { userId } = args as any;
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
  } catch (error: any) {
    return err(`Error: ${error.message || error}`);
  }
}
