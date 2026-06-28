import { z } from "zod";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import type { ToolRegistrar } from "./helpers.js";
import { textResult } from "./helpers.js";

function makeClient(session: string) {
  return new TelegramClient(new StringSession(session), Number(process.env.TELEGRAM_API_ID), process.env.TELEGRAM_API_HASH || "", { connectionRetries: 5 });
}

export const registerTelegramTools: ToolRegistrar = (server, auth) => {
  server.tool("send_message", "Send a Telegram message", { userid: z.string(), message: z.string() }, async ({ userid, message }) => {
    const client = makeClient(auth.telegram_session);
    try {
      await client.connect();
      await client.sendMessage(userid, { message: `${message}\n\n\n<i>— Sent Via MultimateAIAgent</i>`, parseMode: "html" });
      return textResult({ success: true, to: userid });
    } finally { await client.disconnect(); }
  });

  server.tool("fetch_message", "Fetch recent Telegram messages", { userid: z.string() }, async ({ userid }) => {
    const client = makeClient(auth.telegram_session);
    try {
      await client.connect();
      const messages = await client.getMessages(userid, { limit: 20 });
      return textResult({ success: true, to: userid, data: messages.map((m: any) => ({ text: m.message, date: m.date })) });
    } finally { await client.disconnect(); }
  });

  server.tool("fetch_chat_user", "List Telegram chat participants", { userid: z.string() }, async ({ userid }) => {
    const client = makeClient(auth.telegram_session);
    try {
      await client.connect();
      const participants = await client.getParticipants(userid);
      return textResult({ success: true, data: participants.map((p: any) => ({ userId: p.id?.toString(), fullName: `${p.firstName || ""} ${p.lastName || ""}`.trim(), username: p.username || null, role: p.participant?.className === "ChannelParticipantAdmin" || p.participant?.className === "ChannelParticipantCreator" ? "admin" : "member" })) });
    } finally { await client.disconnect(); }
  });

  server.tool("get_info", "Get Telegram entity info", { userid: z.string() }, async ({ userid }) => {
    const client = makeClient(auth.telegram_session);
    try {
      await client.connect();
      const info = await client.getEntity(userid);
      return textResult({ success: true, data: info });
    } finally { await client.disconnect(); }
  });
};
