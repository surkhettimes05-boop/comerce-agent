const test = require("node:test");
const assert = require("node:assert/strict");

const { seedDatabase, prisma } = require("../src/seed/seed");
const { createOrder } = require("../src/services/order.service");

test("createOrder requires confirmation before saving", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findFirst({
    where: { email: "retailer.kathmandu@example.com" },
  });
  const product = await prisma.product.findFirst({
    where: { sku: "WW-CHICK-075" },
  });

  await assert.rejects(
    () =>
      createOrder({
        userId: retailer.id,
        tenantId: retailer.tenantId,
        confirmed: false,
        items: [{ productId: product.id, quantity: 2 }],
        prismaClient: prisma,
      }),
    /Order confirmation is required\./,
  );

  const orderCount = await prisma.order.count();
  assert.equal(orderCount, 0);
});

test("createOrder saves order and items in the database", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findFirst({
    where: { email: "retailer.kathmandu@example.com" },
  });
  const products = await prisma.product.findMany({
    where: {
      sku: {
        in: ["WW-CHICK-075", "CK-500-PET"],
      },
    },
    orderBy: { sku: "asc" },
  });

  const coke = products.find((product) => product.sku === "CK-500-PET");
  const waiWai = products.find((product) => product.sku === "WW-CHICK-075");

  const result = await createOrder({
    userId: retailer.id,
    tenantId: retailer.tenantId,
    confirmed: true,
    notes: "Deliver tomorrow morning.",
    items: [
      { productId: waiWai.id, quantity: 2 },
      { productId: coke.id, quantity: 1 },
    ],
    prismaClient: prisma,
  });

  assert.equal(result.status, "CONFIRMED");
  assert.equal(result.totalAmount, "110.00");
  assert.equal(result.items.length, 2);

  const savedOrder = await prisma.order.findUnique({
    where: { id: result.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  assert.equal(savedOrder.status, "CONFIRMED");
  assert.equal(savedOrder.totalAmount.toString(), "110");
  assert.equal(savedOrder.notes, "Deliver tomorrow morning.");
  assert.equal(savedOrder.items.length, 2);

  const savedItemsBySku = new Map(
    savedOrder.items.map((item) => [item.product.sku, item]),
  );

  assert.equal(savedItemsBySku.get("WW-CHICK-075").quantity, 2);
  assert.equal(savedItemsBySku.get("WW-CHICK-075").unitPrice.toString(), "25");
  assert.equal(savedItemsBySku.get("CK-500-PET").quantity, 1);
  assert.equal(savedItemsBySku.get("CK-500-PET").unitPrice.toString(), "60");
});
