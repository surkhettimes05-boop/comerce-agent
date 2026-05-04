const test = require("node:test");
const assert = require("node:assert/strict");

const { seedDatabase, prisma } = require("../src/seed/seed");
const { handleProductAgent } = require("../src/agents/product.agent");

test("handleProductAgent returns ranked suppliers with the cheapest first", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const result = await handleProductAgent({
    message: "Need Wai Wai Chicken noodles",
    prismaClient: prisma,
  });

  assert.equal(result.agentName, "find-product-agent");
  assert.equal(result.status, "completed");
  assert.equal(result.productCount > 0, true);

  const topProduct = result.products[0];

  assert.equal(topProduct.sku, "WW-CHICK-075");
  assert.equal(topProduct.cheapestSupplier.supplierName, "Himalaya Distribution");
  assert.equal(topProduct.cheapestSupplier.supplierPrice, "22.00");
  assert.equal(topProduct.rankedSuppliers.length, 2);
  assert.equal(topProduct.rankedSuppliers[0].supplierPrice, "22.00");
  assert.equal(topProduct.rankedSuppliers[1].supplierPrice, "22.75");
});

test("handleProductAgent returns no_match when no products match the message", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const result = await handleProductAgent({
    message: "Need tractor engine oil drums",
    prismaClient: prisma,
  });

  assert.equal(result.status, "no_match");
  assert.equal(result.productCount, 0);
  assert.deepEqual(result.products, []);
});

test("handleProductAgent understands common Nepal-market customer wording", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const noodles = await handleProductAgent({
    message: "chau chau chahiyo",
    prismaClient: prisma,
  });

  assert.equal(noodles.status, "completed");
  assert.equal(noodles.products[0].sku.startsWith("WW-"), true);

  const sugar = await handleProductAgent({
    message: "chini ko rate kati ho",
    prismaClient: prisma,
  });

  assert.equal(sugar.status, "completed");
  assert.equal(sugar.products[0].sku.startsWith("SG-"), true);
});
