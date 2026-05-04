const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, seedDatabase } = require("../src/seed/seed");

test("seedDatabase creates a default tenant, accounts, memberships, and tenant-scoped data", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "khaacho-demo" },
    include: {
      memberships: true,
      users: true,
      products: true,
    },
  });

  assert.ok(tenant);
  assert.equal(tenant.currency, "NPR");
  assert.equal(tenant.timezone, "Asia/Kathmandu");
  assert.equal(tenant.memberships.length, 10);
  assert.equal(tenant.users.length, 10);
  assert.equal(tenant.products.length, 20);

  const account = await prisma.account.findUnique({
    where: { email: "retailer.kathmandu@example.com" },
  });

  assert.ok(account);

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId: tenant.id,
      accountId: account.id,
    },
  });

  assert.ok(membership);
  assert.equal(membership.role, "RETAILER_CONTACT");
});
