const test = require("node:test");
const assert = require("node:assert/strict");

const { seedDatabase, prisma } = require("../src/seed/seed");
const {
  confirmOrderDraft,
  createOrderDraftFromUnderstanding,
} = require("../src/services/order-draft.service");
const { understandCustomerMessage } = require("../src/services/message-understanding.service");

test("createOrderDraftFromUnderstanding creates a confirmation draft from exact order details", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findFirst({
    where: { email: "retailer.kathmandu@example.com" },
  });
  const understanding = understandCustomerMessage("2 carton wai wai chicken pathaunu");

  const draft = await createOrderDraftFromUnderstanding({
    tenantId: retailer.tenantId,
    userId: retailer.id,
    message: "2 carton wai wai chicken pathaunu",
    understanding,
    prismaClient: prisma,
  });

  assert.equal(draft.status, "needs_confirmation");
  assert.equal(draft.confirmationRequired, true);
  assert.equal(draft.items.length, 1);
  assert.equal(draft.items[0].sku, "WW-CHICK-075");
  assert.equal(draft.items[0].quantity, 2);
  assert.equal(draft.items[0].packagingUnit, "carton");
  assert.equal(draft.totalAmount, "50.00");
});

test("confirmOrderDraft saves a confirmed order", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findFirst({
    where: { email: "retailer.kathmandu@example.com" },
  });
  const draft = await createOrderDraftFromUnderstanding({
    tenantId: retailer.tenantId,
    userId: retailer.id,
    message: "2 carton wai wai chicken pathaunu",
    understanding: understandCustomerMessage("2 carton wai wai chicken pathaunu"),
    prismaClient: prisma,
  });

  const order = await confirmOrderDraft({
    tenantId: retailer.tenantId,
    userId: retailer.id,
    draftId: draft.draftId,
    prismaClient: prisma,
  });

  assert.equal(order.status, "CONFIRMED");
  assert.equal(order.totalAmount, "50.00");
  assert.equal(order.items[0].sku, "WW-CHICK-075");

  const savedDraft = await prisma.orderDraft.findUnique({
    where: { id: draft.draftId },
  });

  assert.equal(savedDraft.status, "CONFIRMED");
});
