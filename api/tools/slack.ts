import { z } from "zod";
import { WebClient } from "@slack/web-api";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

export const registerSlackTools: ToolRegistrar = (server, auth) => {
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
    return textResult(res.channels);
  });

  server.tool("get_user_info", "Get Slack user info", { userId: z.string() }, async ({ userId }) => {
    const client = new WebClient(auth.slack_token);
    const res = await client.users.info({ user: userId });
    return textResult(res.user);
  });

  server.tool("get_team_info", "Get Slack team info", {}, async () => {
    const client = new WebClient(auth.slack_token);
    const res = await client.team.info();
    return textResult(res.team);
  });
};
