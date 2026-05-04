const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { queryProductsWithSupplierPricing } = require("../agents/product.agent");
const { createOrder } = require("./order.service");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let defaultPrismaClient;

function getDefaultPrismaClient() {
  if (defaultPrismaClient) {
    return defaultPrismaClient;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create order drafts.");
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

function normalizeDraft(draft) {
  return {
    draftId: draft.id,
    status: draft.status,
    totalAmount: formatMoney(draft.totalAmount),
    expiresAt: draft.expiresAt.toISOString(),
    items: draft.items.map((item) => ({
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: formatMoney(item.unitPrice),
      packagingUnit: item.packagingUnit,
      lineTotal: formatMoney(Number.parseFloat(item.unitPrice.toString()) * item.quantity),
    })),
  };
}

async function createOrderDraftFromUnderstanding(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const { tenantId, userId, message, understanding } = options;

  if (!tenantId) {
    throw new Error("tenantId is required.");
  }

  if (!userId) {
    throw new Error("userId is required.");
  }

  if (!understanding || understanding.intent !== "CREATE_ORDER") {
    throw new Error("CREATE_ORDER understanding is required.");
  }

  if (understanding.needsClarification) {
    return {
      agentName: "create-order-agent",
      status: "needs_clarification",
      confirmationRequired: false,
      clarificationQuestion: understanding.clarificationQuestion,
      understanding,
    };
  }

  const quantity = understanding.quantity;
  const packagingUnit = understanding.unit;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("A positive quantity is required.");
  }

  const productResult = await queryProductsWithSupplierPricing({
    query: understanding.productQuery,
    tenantId,
    prismaClient,
    limit: 1,
  });
  const product = productResult.products[0];

  if (!product) {
    return {
      agentName: "create-order-agent",
      status: "needs_clarification",
      confirmationRequired: false,
      clarificationQuestion:
        "I could not find that product in the catalog. Please send the product name or SKU.",
      understanding,
    };
  }

  const totalAmount = Number.parseFloat(product.basePrice) * quantity;
  const draft = await prismaClient.orderDraft.create({
    data: {
      tenantId,
      userId,
      sourceMessage: message,
      totalAmount: formatMoney(totalAmount),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      items: {
        create: [
          {
            productId: product.productId,
            quantity,
            unitPrice: product.basePrice,
            packagingUnit,
          },
        ],
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  return {
    agentName: "create-order-agent",
    confirmationRequired: true,
    understanding,
    ...normalizeDraft(draft),
    status: "needs_confirmation",
  };
}

async function confirmOrderDraft(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  let { tenantId, userId } = options;
  const { draftId } = options;

  if (!userId && options.userEmail) {
    const user = await prismaClient.user.findFirst({
      where: {
        email: options.userEmail,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    userId = user?.id;
    tenantId = tenantId || user?.tenantId;
  }

  const draft = await prismaClient.orderDraft.findFirst({
    where: {
      id: draftId,
      tenantId,
      userId,
      status: "PENDING_CONFIRMATION",
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      items: true,
    },
  });

  if (!draft) {
    throw new Error("Order draft not found or expired.");
  }

  const order = await createOrder({
    tenantId,
    userId,
    confirmed: true,
    notes: draft.notes,
    items: draft.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    prismaClient,
  });

  await prismaClient.orderDraft.update({
    where: { id: draft.id },
    data: { status: "CONFIRMED" },
  });

  return order;
}

module.exports = {
  createOrderDraftFromUnderstanding,
  confirmOrderDraft,
};
