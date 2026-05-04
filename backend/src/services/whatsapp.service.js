const path = require("node:path");
const dotenv = require("dotenv");
const { handleChatMessage } = require("./chat.service");
const { confirmOrderDraft } = require("./order-draft.service");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const DEFAULT_GRAPH_API_VERSION = "v23.0";

function getWebhookVerification(options = {}) {
  const mode = options.mode;
  const token = options.token;
  const challenge = options.challenge;
  const expectedToken =
    options.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expectedToken) {
    throw new Error("WHATSAPP_VERIFY_TOKEN is required.");
  }

  if (mode === "subscribe" && token === expectedToken) {
    return challenge;
  }

  throw new Error("Invalid WhatsApp webhook verification token.");
}

function extractIncomingMessages(payload) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  return entries.flatMap((entry) => {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    return changes.flatMap((change) => {
      const value = change?.value || {};
      const phoneNumberId = value?.metadata?.phone_number_id;
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];

      return messages
        .filter((message) => message?.type === "text" && message?.text?.body)
        .map((message) => {
          const contact = contacts.find((item) => item.wa_id === message.from);

          return {
            messageId: message.id,
            from: message.from,
            phoneNumberId,
            profileName: contact?.profile?.name,
            text: message.text.body,
          };
        });
    });
  });
}

async function resolveUserEmailForWhatsApp(options = {}) {
  if (options.defaultUserEmail) {
    return options.defaultUserEmail;
  }

  const defaultUserEmail =
    process.env.WHATSAPP_DEFAULT_USER_EMAIL ||
    process.env.DEMO_CUSTOMER_EMAIL ||
    "retailer.kathmandu@example.com";

  if (!options.prismaClient || !options.from) {
    return defaultUserEmail;
  }

  const normalizedFrom = String(options.from).replace(/\D/g, "");
  const users = await options.prismaClient.user.findMany({
    where: {
      phone: {
        not: null,
      },
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
    },
    select: {
      email: true,
      phone: true,
    },
  });
  const matchedUser = users.find((user) => {
    const normalizedPhone = String(user.phone || "").replace(/\D/g, "");

    return (
      normalizedPhone &&
      (normalizedFrom.endsWith(normalizedPhone) ||
        normalizedPhone.endsWith(normalizedFrom))
    );
  });

  return matchedUser?.email || defaultUserEmail;
}

function getConfirmDraftId(message) {
  const match = String(message || "").trim().match(/^confirm\s+([a-z0-9_-]+)$/i);

  return match ? match[1] : "";
}

function buildWhatsAppReply(chatResult) {
  const baseReply = chatResult.reply;
  const draftId =
    chatResult.route?.agentIntent === "CREATE_ORDER" &&
    chatResult.data?.status === "needs_confirmation"
      ? chatResult.data.draftId
      : "";

  if (!draftId) {
    return baseReply;
  }

  return `${baseReply}\n\nReply CONFIRM ${draftId} to save it.`;
}

async function sendWhatsAppText(options = {}) {
  const accessToken = options.accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId =
    options.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphApiVersion =
    options.graphApiVersion ||
    process.env.WHATSAPP_GRAPH_API_VERSION ||
    DEFAULT_GRAPH_API_VERSION;

  if (!accessToken) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is required.");
  }

  if (!phoneNumberId) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is required.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: options.to,
        type: "text",
        text: {
          preview_url: false,
          body: options.text,
        },
      }),
    },
  );
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `WhatsApp send failed with ${response.status}: ${responseBody}`,
    );
  }

  return responseBody ? JSON.parse(responseBody) : {};
}

async function handleWhatsAppWebhook(options = {}) {
  const incomingMessages = extractIncomingMessages(options.payload);

  for (const incomingMessage of incomingMessages) {
    const userEmail = await resolveUserEmailForWhatsApp({
      from: incomingMessage.from,
      tenantId: options.tenantId,
      prismaClient: options.prismaClient,
      defaultUserEmail: options.defaultUserEmail,
    });
    const confirmDraftId = getConfirmDraftId(incomingMessage.text);
    let reply;

    if (confirmDraftId) {
      const order = await confirmOrderDraft({
        tenantId: options.tenantId,
        userEmail,
        draftId: confirmDraftId,
        prismaClient: options.prismaClient,
      });

      reply = `Order confirmed. Your order total is NPR ${order.totalAmount}.`;
    } else {
      const chatResult = await handleChatMessage({
        userEmail,
        message: incomingMessage.text,
        orchestrator: options.orchestrator,
        tenantId: options.tenantId,
        prismaClient: options.prismaClient,
      });

      reply = buildWhatsAppReply(chatResult);
    }

    await (options.sendText || sendWhatsAppText)({
      to: incomingMessage.from,
      phoneNumberId: incomingMessage.phoneNumberId,
      text: reply,
    });
  }

  return { received: true, processed: incomingMessages.length };
}

module.exports = {
  buildWhatsAppReply,
  extractIncomingMessages,
  getWebhookVerification,
  handleWhatsAppWebhook,
  sendWhatsAppText,
};
