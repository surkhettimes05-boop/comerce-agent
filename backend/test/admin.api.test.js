const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const appModule = require("../src/app");
const { seedDatabase, prisma } = require("../src/seed/seed");
const { createOrder } = require("../src/services/order.service");

const createApp = appModule.createApp;

test("GET /api/admin/overview returns real metrics, orders, and products", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findUnique({
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

  await createOrder({
    userId: retailer.id,
    confirmed: true,
    notes: "Admin API seed order.",
    items: [
      { productId: waiWai.id, quantity: 2 },
      { productId: coke.id, quantity: 1 },
    ],
    prismaClient: prisma,
  });

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/overview`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.metrics.totalRetailers, 5);
    assert.equal(body.metrics.totalSuppliers, 5);
    assert.equal(body.metrics.totalProducts, 20);
    assert.equal(body.metrics.totalOrders, 1);
    assert.equal(body.metrics.totalRevenue, "110.00");

    assert.equal(body.orders.length, 1);
    assert.equal(body.orders[0].customerName, "Kathmandu Kirana Store");
    assert.equal(body.orders[0].itemCount, 2);
    assert.equal(body.orders[0].totalAmount, "110.00");

    assert.equal(body.products.length > 0, true);
    assert.equal(body.products[0].sku, "CK-1000-PET");
    assert.equal(body.products.some((product) => product.sku === "WW-CHICK-075"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
