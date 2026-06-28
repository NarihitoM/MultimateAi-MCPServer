import { McpRequestSchema, ok, err } from "./_shared.js";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

export async function POST(req: Request) {
  const parsed = McpRequestSchema.safeParse(await req.json());
  if (!parsed.success) return err("Invalid request");
  const { tool, args, auth } = parsed.data;

  const client = new TelegramClient(
    new StringSession(auth?.telegram_session),
    Number(process.env.TELEGRAM_API_ID),
    process.env.TELEGRAM_API_HASH || "",
    { connectionRetries: 5 }
  );

  try {
    await client.connect();
    let result: any;

    switch (tool) {
      case "send_message": {
        const { userid, message } = args as any;
        await client.sendMessage(userid, {
          message: `${message}\n\n\n<i>— Sent Via MultimateAIAgent</i>`,
          parseMode: "html",
        });
        result = JSON.stringify({ success: true, message: "Message sent successfully", to: userid });
        break;
      }
      case "fetch_message": {
        const { userid } = args as any;
        const messages = await client.getMessages(userid, { limit: 20 });
        result = JSON.stringify({
          success: true, message: "Messages fetched successfully", to: userid,
          data: messages.map((m: any) => ({ text: m.message, date: m.date })),
        });
        break;
      }
      case "fetch_chat_user": {
        const { userid } = args as any;
        const participants = await client.getParticipants(userid);
        result = JSON.stringify({
          success: true,
          data: participants.map((p: any) => ({
            userId: p.id?.toString(),
            fullName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
            username: p.username || null,
            role: p.participant?.className === 'ChannelParticipantAdmin' ||
              p.participant?.className === 'ChannelParticipantCreator' ? 'admin' : 'member',
          })),
        });
        break;
      }
      case "get_info": {
        const { userid } = args as any;
        const info = await client.getEntity(userid);
        result = JSON.stringify({ success: true, data: info });
        break;
      }
      default:
        return err(`Unknown tool: ${tool}`);
    }

    return ok(result);
  } catch (error: any) {
    return err(`Error: ${error.message || error}`);
  } finally {
    await client.disconnect();
  }
}
