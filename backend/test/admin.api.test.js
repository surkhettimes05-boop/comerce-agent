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

  await createOrder({
    userId: retailer.id,
    tenantId: retailer.tenantId,
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

test("admin catalog endpoints feed products, suppliers, and rates into the agent catalog", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function postJson(path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    assert.equal(response.status, 200, payload.error);
    return payload;
  }

  try {
    const supplier = await postJson("/api/admin/suppliers", {
      name: "Narayani Fresh Supply",
      email: "supplier.narayani@example.com",
      phone: "9812999000",
    });

    const product = await postJson("/api/admin/products", {
      sku: "TEA-MILK-500",
      name: "Milk Tea Premix 500g",
      description: "Premix for tea shops and small cafes.",
      price: "310.00",
    });

    const rate = await postJson("/api/admin/supplier-rates", {
      supplierId: supplier.id,
      productId: product.id,
      supplierSku: "NAR-TEA-MILK-500",
      supplierPrice: "285.00",
      availableStock: 45,
    });

    assert.equal(rate.supplierName, "Narayani Fresh Supply");
    assert.equal(rate.productName, "Milk Tea Premix 500g");
    assert.equal(rate.supplierPrice, "285.00");

    const catalogResponse = await fetch(`${baseUrl}/api/admin/catalog`);
    const catalog = await catalogResponse.json();

    assert.equal(catalogResponse.status, 200);
    assert.equal(
      catalog.products.some((catalogProduct) => catalogProduct.sku === "TEA-MILK-500"),
      true,
    );
    assert.equal(
      catalog.suppliers.some((catalogSupplier) => catalogSupplier.email === "supplier.narayani@example.com"),
      true,
    );

    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: "retailer.kathmandu@example.com",
        message: "Need milk tea premix",
      }),
    });
    const chatPayload = await chatResponse.json();

    assert.equal(chatResponse.status, 200);
    assert.equal(chatPayload.route.agentIntent, "FIND_PRODUCT");
    assert.equal(chatPayload.reply.includes("Milk Tea Premix 500g"), true);
    assert.equal(chatPayload.reply.includes("Narayani Fresh Supply"), true);
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

test("admin import agent previews and commits catalog data", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const importText = [
    "supplier,sku,name,basePrice,supplierPrice,stock,description",
    "Narayani Fresh Supply,TEA-MILK-500,Milk Tea Premix 500g,310,285,45,Premix for tea shops",
  ].join("\n");

  try {
    const previewResponse = await fetch(`${baseUrl}/api/admin/import/preview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: importText }),
    });
    const preview = await previewResponse.json();

    assert.equal(previewResponse.status, 200);
    assert.equal(preview.summary.readyRows, 1);
    assert.equal(preview.rows[0].data.sku, "TEA-MILK-500");

    const commitResponse = await fetch(`${baseUrl}/api/admin/import/commit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows: preview.rows }),
    });
    const commit = await commitResponse.json();

    assert.equal(commitResponse.status, 200);
    assert.equal(commit.importedRows, 1);

    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: "retailer.kathmandu@example.com",
        message: "Need milk tea premix",
      }),
    });
    const chatPayload = await chatResponse.json();

    assert.equal(chatResponse.status, 200);
    assert.equal(chatPayload.reply.includes("Milk Tea Premix 500g"), true);
    assert.equal(chatPayload.reply.includes("Narayani Fresh Supply"), true);
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

test("GET /api/admin/growth/campaigns returns campaign ideas and drafts", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/growth/campaigns`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.summary.retailerCount, 5);
    assert.equal(body.campaigns.length > 0, true);
    assert.equal(body.campaigns[0].suggestedMessage.length > 0, true);
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
