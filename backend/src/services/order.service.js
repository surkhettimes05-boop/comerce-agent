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
    throw new Error("DATABASE_URL is required to create orders.");
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

function validateOrderInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Order input is required.");
  }

  if (!input.confirmed) {
    throw new Error("Order confirmation is required.");
  }

  if (typeof input.userId !== "string" || !input.userId.trim()) {
    throw new Error("userId is required.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("At least one order item is required.");
  }

  const seenProductIds = new Set();

  for (const item of input.items) {
    if (!item || typeof item !== "object") {
      throw new Error("Each order item must be an object.");
    }

    if (typeof item.productId !== "string" || !item.productId.trim()) {
      throw new Error("Each order item requires a productId.");
    }

    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error("Each order item requires a positive integer quantity.");
    }

    if (seenProductIds.has(item.productId)) {
      throw new Error("Duplicate productId values are not allowed in one order.");
    }

    seenProductIds.add(item.productId);
  }
}

function normalizeSavedOrder(orderRecord) {
  return {
    id: orderRecord.id,
    userId: orderRecord.userId,
    status: orderRecord.status,
    totalAmount: formatMoney(orderRecord.totalAmount),
    notes: orderRecord.notes,
    items: orderRecord.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: formatMoney(item.unitPrice),
      lineTotal: formatMoney(Number.parseFloat(item.unitPrice.toString()) * item.quantity),
    })),
  };
}

async function createOrder(input) {
  validateOrderInput(input);

  const prismaClient = input.prismaClient || getDefaultPrismaClient();
  const trimmedNotes =
    typeof input.notes === "string" && input.notes.trim() ? input.notes.trim() : null;

  return prismaClient.$transaction(async (transaction) => {
    const user = await transaction.user.findUnique({
      where: { id: input.userId },
    });

    if (!user) {
      throw new Error("User not found.");
    }

    const productIds = input.items.map((item) => item.productId);
    const products = await transaction.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new Error("One or more products were not found or are inactive.");
    }

    const productsById = new Map(products.map((product) => [product.id, product]));
    let totalAmount = 0;

    const orderItemsData = input.items.map((item) => {
      const product = productsById.get(item.productId);
      const unitPrice = Number.parseFloat(product.price.toString());

      totalAmount += unitPrice * item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: formatMoney(unitPrice),
      };
    });

    const savedOrder = await transaction.order.create({
      data: {
        userId: input.userId,
        status: "CONFIRMED",
        totalAmount: formatMoney(totalAmount),
        notes: trimmedNotes,
        items: {
          create: orderItemsData,
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

    return normalizeSavedOrder(savedOrder);
  });
}

async function closeOrderService() {
  if (!defaultPrismaClient) {
    return;
  }

  await defaultPrismaClient.$disconnect();
  defaultPrismaClient = undefined;
}

module.exports = {
  closeOrderService,
  createOrder,
};
