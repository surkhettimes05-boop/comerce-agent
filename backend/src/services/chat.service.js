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
    return "I could not find that item in the catalog yet. Please try the brand, product type, or pack size, for example Wai Wai 75g, sugar 1kg, or Coke 500ml.";
  }

  const topProduct = agentResult.products[0];
  const cheapestSupplier = topProduct.cheapestSupplier;

  if (!cheapestSupplier) {
    return `I found ${topProduct.name} (${topProduct.sku}), but supplier pricing is not added yet.`;
  }

  const rankedSuppliers = topProduct.rankedSuppliers
    .slice(0, 3)
    .map(
      (supplier, index) =>
        `${index + 1}. ${supplier.supplierName} NPR ${formatMoney(supplier.supplierPrice)}`,
    )
    .join("; ");

  return `I found ${topProduct.name} (${topProduct.sku}). Best current supplier is ${cheapestSupplier.supplierName} at NPR ${formatMoney(cheapestSupplier.supplierPrice)}. Other options: ${rankedSuppliers}.`;
}

function buildComparePriceReply(agentResult) {
  if (!agentResult || !Array.isArray(agentResult.products) || agentResult.products.length === 0) {
    return "I could not find supplier rates for that item yet. Try the product name or pack size, for example chini 1kg, chamal 25kg, or Coke 1L.";
  }

  const topProduct = agentResult.products[0];
  const rankedSuppliers = topProduct.rankedSuppliers
    .slice(0, 3)
    .map(
      (supplier, index) =>
        `${index + 1}. ${supplier.supplierName} NPR ${formatMoney(supplier.supplierPrice)}`,
    )
    .join("; ");

  return `For ${topProduct.name} (${topProduct.sku}), current supplier rates are: ${rankedSuppliers}.`;
}

function buildAssistantReply(routeResult) {
  const clarificationQuestion = routeResult?.understanding?.clarificationQuestion;

  if (!routeResult || routeResult.handled !== true) {
    return clarificationQuestion || "Please tell me the product name, quantity, or whether you want rates or an order.";
  }

  if (routeResult.agentIntent === "FIND_PRODUCT") {
    return buildFindProductReply(routeResult.agentResult);
  }

  if (routeResult.agentIntent === "COMPARE_PRICE") {
    return buildComparePriceReply(routeResult.agentResult);
  }

  if (routeResult.agentIntent === "CREATE_ORDER") {
    const agentResult = routeResult.agentResult;

    if (agentResult?.status === "needs_clarification") {
      return agentResult.clarificationQuestion || clarificationQuestion;
    }

    if (agentResult?.status === "needs_confirmation") {
      const itemSummary = agentResult.items
        .map((item) => `${item.quantity} ${item.packagingUnit || "unit"} ${item.name}`)
        .join(", ");

      return `Please confirm this order: ${itemSummary}. Total NPR ${agentResult.totalAmount}.`;
    }

    if (clarificationQuestion) {
      return clarificationQuestion;
    }

    const understanding = routeResult.understanding;
    const quantityText = understanding.quantity
      ? `${understanding.quantity} ${understanding.unit || ""}`.trim()
      : "the requested quantity";

    return `I can prepare an order for ${quantityText} of ${understanding.productQuery}. Please confirm before I save it.`;
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
      understanding: routeResult.understanding,
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
    : await prismaClient.user.findFirst({
        where: {
          email: trimmedUserEmail,
          ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        },
      });

  if (!user) {
    throw new Error("User not found.");
  }

  const routeResult = await orchestrator.routeMessage(trimmedMessage, {
    tenantId: options.tenantId || user.tenantId,
    userId: user.id,
  });
  const reply = buildAssistantReply(routeResult);

  await prismaClient.$transaction([
    prismaClient.conversation.create({
      data: {
        tenantId: options.tenantId || user.tenantId,
        userId: user.id,
        role: "USER",
        message: trimmedMessage,
      },
    }),
    prismaClient.conversation.create({
      data: {
        tenantId: options.tenantId || user.tenantId,
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
