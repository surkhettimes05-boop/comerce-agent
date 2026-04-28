const test = require("node:test");
const assert = require("node:assert/strict");

const { seedDatabase, prisma } = require("../src/seed/seed");

test("seedDatabase inserts expected Nepal commerce data", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const [retailers, suppliers, products, supplierPricing] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "SUPPLIER" } }),
    prisma.product.count(),
    prisma.supplierProduct.count(),
  ]);

  assert.equal(retailers, 5);
  assert.equal(suppliers, 5);
  assert.equal(products, 20);
  assert.equal(supplierPricing, 40);
});
