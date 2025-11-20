import { MessageReceived } from "wa-multi-session";
import { CreateWebhookProps, webhookClient } from ".";
import {
  handleWebhookAudioMessage,
  handleWebhookDocumentMessage,
  handleWebhookImageMessage,
  handleWebhookVideoMessage,
} from "./media";
import { getRagBotResponse, getRagBotResponseStream } from "../services/rag-bot.service";
import { aiControlService } from "../services/ai-control.service";
import { conversationHistoryService } from "../services/conversation-history.service";
import { absensiService } from "../services/absensi.service";
import * as whatsapp from "wa-multi-session";

type WebhookMessageBody = {
  session: string;
  from: string | null;
  message: string | null;

  media: {
    image: string | null;
    video: string | null;
    document: string | null;
    audio: string | null;
  };
};

export const createWebhookMessage =
  (props: CreateWebhookProps) => async (message: MessageReceived) => {
    if (message.key.fromMe || message.key.remoteJid?.includes("broadcast"))
      return;

    const endpoint = `${props.baseUrl}/message`;

    const image = await handleWebhookImageMessage(message);
    const video = await handleWebhookVideoMessage(message);
    const document = await handleWebhookDocumentMessage(message);
    const audio = await handleWebhookAudioMessage(message);

    const messageText =
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      message.message?.imageMessage?.caption ||
      message.message?.videoMessage?.caption ||
      message.message?.documentMessage?.caption ||
      message.message?.contactMessage?.displayName ||
      message.message?.locationMessage?.comment ||
      message.message?.liveLocationMessage?.caption ||
      null;

    const body = {
      session: message.sessionId,
      from: message.key.remoteJid ?? null,
      message: messageText,

      /**
       * media message
       */
      media: {
        image,
        video,
        document,
        audio,
      },
    } satisfies WebhookMessageBody;
    webhookClient.post(endpoint, body).catch(console.error);

    // Auto-respond for finance session
    if (message.sessionId === "finance" && messageText) {
      try {
        const ADMIN_NUMBER = "628979029782@s.whatsapp.net";
        const userNumber = message.key.remoteJid!;
        const trimmedMessage = messageText.trim().toLowerCase();
        const userId = userNumber.replace("@s.whatsapp.net", "");

        // Handle absensi commands (harus di luar AI on/off, hanya untuk nomor terdaftar)
        if (trimmedMessage === "absen masuk" || trimmedMessage === "absen pulang" || trimmedMessage === "cek absen") {
          let response: string;
          
          if (trimmedMessage === "absen masuk") {
            response = await absensiService.absenMasuk(userId);
          } else if (trimmedMessage === "absen pulang") {
            response = await absensiService.absenPulang(userId);
          } else {
            response = await absensiService.cekAbsen(userId);
          }
          
          const socket = whatsapp.getSession(message.sessionId);
          if (socket) {
            await socket.sendMessage(userNumber, {
              text: `@${userId} ${response}`,
              mentions: [userNumber],
            }, {
              quoted: message,
            });
          }
          return;
        }

        // Cek apakah pesan dari admin untuk kontrol AI
        if (userNumber === ADMIN_NUMBER) {
          const adminId = userNumber.replace("@s.whatsapp.net", "");
          
          if (trimmedMessage === "ai on") {
            aiControlService.setAIStatus(true, adminId);
            await whatsapp.sendTextMessage({
              sessionId: message.sessionId,
              to: userNumber,
              text: "✅ AI Bot telah diaktifkan. Sekarang akan merespons semua pertanyaan.\n\n💾 Status disimpan dan akan tetap ON setelah server restart.",
            });
            return;
          } else if (trimmedMessage === "ai off") {
            aiControlService.setAIStatus(false, adminId);
            await whatsapp.sendTextMessage({
              sessionId: message.sessionId,
              to: userNumber,
              text: "⛔ AI Bot telah dinonaktifkan. Tidak akan merespons pertanyaan apapun.\n\n💾 Status disimpan dan akan tetap OFF setelah server restart.",
            });
            return;
          } else if (trimmedMessage === "ai status") {
            const stats = aiControlService.getStats();
            const convStats = conversationHistoryService.getStats();
            await whatsapp.sendTextMessage({
              sessionId: message.sessionId,
              to: userNumber,
              text: `📊 *Status AI Bot*\n\n` +
                `Status: ${stats.aiEnabled ? "🟢 ON" : "🔴 OFF"}\n` +
                `Total Users Tracked: ${stats.totalTrackedUsers}\n` +
                `Blocked Users: ${stats.blockedUsers}\n\n` +
                `💬 *Conversation Stats*\n` +
                `Active Conversations: ${convStats.activeConversations}\n` +
                `Total Messages: ${convStats.totalMessages}`,
            });
            return;
          } else if (trimmedMessage === "clear history") {
            conversationHistoryService.clearAllHistory();
            await whatsapp.sendTextMessage({
              sessionId: message.sessionId,
              to: userNumber,
              text: "🗑️ Semua riwayat percakapan telah dihapus.",
            });
            return;
          }
        }

        // Jika AI dimatikan, jangan respond (kecuali admin)
        if (!aiControlService.getAIStatus()) {
          console.log(
            `AI is OFF. Ignoring message from ${userNumber}: ${messageText}`
          );
          return;
        }

        // Cek spam dan cooldown
        const spamCheck = aiControlService.checkAndTrackMessage(userId);

        // Jika user di-block karena spam
        if (spamCheck.isSpam && aiControlService.isUserBlocked(userId)) {
          const remainingMinutes =
            aiControlService.getBlockTimeRemaining(userId);
          await whatsapp.sendTextMessage({
            sessionId: message.sessionId,
            to: userNumber,
            text: `⚠️ Anda terindikasi spam. Bot akan diam selama ${remainingMinutes} menit ke depan.\n\nSilakan tunggu hingga waktu block selesai.`,
          });
          return;
        }

        // Jika user mengirim pesan terlalu cepat (cooldown)
        if (spamCheck.shouldWait) {
          console.log(
            `User ${userId} sending messages too fast. Ignoring message.`
          );
          return;
        }

        // Jika terdeteksi spam untuk pertama kali
        if (spamCheck.isSpam) {
          await whatsapp.sendTextMessage({
            sessionId: message.sessionId,
            to: userNumber,
            text: "⚠️ Anda terindikasi spam. Bot akan diam selama 1 jam ke depan.\n\nSilakan tunggu hingga waktu block selesai.",
          });
          return;
        }

        // Send typing indicator
        await whatsapp.sendTyping({
          sessionId: message.sessionId,
          to: userNumber,
          duration: 3000,
        });

        // Add user message to conversation history
        conversationHistoryService.addUserMessage(userId, messageText);

        // Get conversation history for this user
        const history = conversationHistoryService.getHistory(userId);

        // Track first message key for editing
        let firstMessageKey: any = undefined;
        let isFirstChunk = true;

        // Get response from RAG bot with streaming
        const ragResponse = await getRagBotResponseStream(
          messageText,
          userId,
          async (chunk: string, fullText: string) => {
            // Format message with suffix
            const formattedText = `${fullText}\n\n> PT Fanbel Finance`;
            
            if (isFirstChunk) {
              // Send first message as reply
              const socket = whatsapp.getSession(message.sessionId);
              if (socket) {
                const result = await socket.sendMessage(userNumber, {
                  text: formattedText,
                }, {
                  quoted: message,
                });
                
                if (result?.key) {
                  firstMessageKey = result.key;
                }
              }
              isFirstChunk = false;
            } else if (firstMessageKey) {
              // Edit existing message for subsequent updates
              try {
                const socket = whatsapp.getSession(message.sessionId);
                if (socket) {
                  await socket.sendMessage(userNumber, {
                    text: formattedText,
                    edit: firstMessageKey,
                  });
                }
              } catch (error) {
                console.error("Failed to edit message:", error);
              }
            }
          },
          history
        );

        // Add assistant response to conversation history
        conversationHistoryService.addAssistantMessage(userId, ragResponse);
      } catch (error) {
        console.error("Error in finance auto-respond:", error);
      }
    }
  };
