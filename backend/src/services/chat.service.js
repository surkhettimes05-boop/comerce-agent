const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let defaultPrismaClient;

function getDefaultPrismaClient() {
  if (defaultPrismaClient) {
    return defaultPrismaClient;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to save conversations.");
  }

  const adapter = new PrismaPg({ connectionString });
  defaultPrismaClient = new PrismaClient({ adapter });

  return defaultPrismaClient;
}

function formatMoney(value) {
  const numericValue = Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return numericValue.toFixed(2);
}

function buildFindProductReply(agentResult) {
  if (!agentResult || !Array.isArray(agentResult.products) || agentResult.products.length === 0) {
    return "I could not find a matching product in the current catalog.";
  }

  const topProduct = agentResult.products[0];
  const cheapestSupplier = topProduct.cheapestSupplier;

  if (!cheapestSupplier) {
    return `Best match: ${topProduct.name} (${topProduct.sku}). No supplier pricing is available yet.`;
  }

  const rankedSuppliers = topProduct.rankedSuppliers
    .slice(0, 3)
    .map(
      (supplier, index) =>
        `${index + 1}. ${supplier.supplierName} NPR ${formatMoney(supplier.supplierPrice)}`,
    )
    .join("; ");

  return `Best match: ${topProduct.name} (${topProduct.sku}). Cheapest supplier: ${cheapestSupplier.supplierName} at NPR ${formatMoney(cheapestSupplier.supplierPrice)}. Ranked suppliers: ${rankedSuppliers}.`;
}

function buildComparePriceReply(agentResult) {
  if (!agentResult || !Array.isArray(agentResult.products) || agentResult.products.length === 0) {
    return "I could not find supplier pricing for a matching product.";
  }

  const topProduct = agentResult.products[0];
  const rankedSuppliers = topProduct.rankedSuppliers
    .slice(0, 3)
    .map(
      (supplier, index) =>
        `${index + 1}. ${supplier.supplierName} NPR ${formatMoney(supplier.supplierPrice)}`,
    )
    .join("; ");

  return `Price comparison for ${topProduct.name} (${topProduct.sku}): ${rankedSuppliers}.`;
}

function buildAssistantReply(routeResult) {
  if (!routeResult || routeResult.handled !== true) {
    return "I could not route that request to a supported agent yet.";
  }

  if (routeResult.agentIntent === "FIND_PRODUCT") {
    return buildFindProductReply(routeResult.agentResult);
  }

  if (routeResult.agentIntent === "COMPARE_PRICE") {
    return buildComparePriceReply(routeResult.agentResult);
  }

  if (routeResult.agentIntent === "CREATE_ORDER") {
    return "Order intent detected. Confirmation is required before I save an order.";
  }

  return "Your request was received, but no reply template is available for that agent yet.";
}

function normalizeChatResponse(routeResult, reply) {
  return {
    reply,
    route: {
      handled: routeResult.handled,
      agentIntent: routeResult.agentIntent,
      originalIntent: routeResult.originalIntent,
      classification: routeResult.classification,
      agentName: routeResult.agentResult ? routeResult.agentResult.agentName : null,
    },
    data: routeResult.agentResult,
  };
}

async function handleChatMessage(options = {}) {
  const { userId, userEmail, message, orchestrator } = options;

  if (
    (typeof userId !== "string" || !userId.trim()) &&
    (typeof userEmail !== "string" || !userEmail.trim())
  ) {
    throw new Error("userId or userEmail is required.");
  }

  if (typeof message !== "string" || !message.trim()) {
    throw new Error("message is required.");
  }

  if (!orchestrator || typeof orchestrator.routeMessage !== "function") {
    throw new Error("A valid orchestrator is required.");
  }

  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const trimmedMessage = message.trim();
  const trimmedUserId = typeof userId === "string" ? userId.trim() : "";
  const trimmedUserEmail = typeof userEmail === "string" ? userEmail.trim() : "";

  const user = trimmedUserId
    ? await prismaClient.user.findUnique({
        where: { id: trimmedUserId },
      })
    : await prismaClient.user.findUnique({
        where: { email: trimmedUserEmail },
      });

  if (!user) {
    throw new Error("User not found.");
  }

  const routeResult = await orchestrator.routeMessage(trimmedMessage);
  const reply = buildAssistantReply(routeResult);

  await prismaClient.$transaction([
    prismaClient.conversation.create({
      data: {
        userId: user.id,
        role: "USER",
        message: trimmedMessage,
      },
    }),
    prismaClient.conversation.create({
      data: {
        userId: user.id,
        role: "ASSISTANT",
        message: reply,
      },
    }),
  ]);

  return normalizeChatResponse(routeResult, reply);
}

async function closeChatService() {
  if (!defaultPrismaClient) {
    return;
  }

  await defaultPrismaClient.$disconnect();
  defaultPrismaClient = undefined;
}

module.exports = {
  buildAssistantReply,
  closeChatService,
  handleChatMessage,
};
