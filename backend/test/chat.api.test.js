const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const appModule = require("../src/app");
const { seedDatabase, prisma } = require("../src/seed/seed");

const createApp = appModule.createApp;

test("POST /api/chat returns an agent reply and saves the conversation", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const retailer = await prisma.user.findFirst({
    where: { email: "retailer.kathmandu@example.com" },
  });

  const app = createApp({
    orchestrator: {
      routeMessage: async (message) => ({
        handled: true,
        agentIntent: "FIND_PRODUCT",
        originalIntent: "FIND_PRODUCT",
        classification: {
          intent: "FIND_PRODUCT",
          confidence: "high",
          needsClarification: false,
        },
        agentResult: {
          agentName: "find-product-agent",
          status: "completed",
          query: message,
          productCount: 1,
          products: [
            {
              sku: "WW-CHICK-075",
              name: "Wai Wai Chicken Noodles 75g",
              cheapestSupplier: {
                supplierName: "Himalaya Distribution",
                supplierPrice: "22.00",
              },
              rankedSuppliers: [
                {
                  supplierName: "Himalaya Distribution",
                  supplierPrice: "22.00",
                },
              ],
            },
          ],
        },
      }),
    },
    prismaClient: prisma,
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: "retailer.kathmandu@example.com",
        message: "Need Wai Wai Chicken noodles",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.reply.includes("Wai Wai Chicken Noodles 75g"), true);
    assert.equal(body.reply.includes("Himalaya Distribution"), true);
    assert.equal(body.route.agentIntent, "FIND_PRODUCT");
    assert.equal(body.route.handled, true);

    const savedConversation = await prisma.conversation.findMany({
      where: { userId: retailer.id },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(savedConversation.length, 2);
    assert.equal(savedConversation[0].role, "USER");
    assert.equal(savedConversation[0].message, "Need Wai Wai Chicken noodles");
    assert.equal(savedConversation[1].role, "ASSISTANT");
    assert.equal(
      savedConversation[1].message.includes("Himalaya Distribution"),
      true,
    );
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

test("POST /api/chat asks a specific clarification for ambiguous order requests", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: "retailer.kathmandu@example.com",
        message: "2 carton wai wai pathaunu",
      }),
    });

    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.route.agentIntent, "CREATE_ORDER");
    assert.equal(body.route.understanding.productQuery, "wai wai");
    assert.equal(body.route.understanding.quantity, 2);
    assert.equal(body.route.understanding.unit, "carton");
    assert.equal(
      body.reply,
      "Which Wai Wai variant do you want: Chicken, Veg, Buff, Masala, or 2PM?",
    );
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

test("POST /api/chat creates an order draft and confirm endpoint saves it", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = createApp({ prismaClient: prisma });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userEmail: "retailer.kathmandu@example.com",
        message: "2 carton wai wai chicken pathaunu",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.route.agentIntent, "CREATE_ORDER");
    assert.equal(body.data.status, "needs_confirmation");
    assert.equal(body.data.draftId.length > 0, true);
    assert.equal(body.reply.includes("Please confirm this order"), true);

    const confirmResponse = await fetch(
      `http://127.0.0.1:${port}/api/orders/drafts/${body.data.draftId}/confirm`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: "retailer.kathmandu@example.com",
        }),
      },
    );
    const confirmBody = await confirmResponse.json();

    assert.equal(confirmResponse.status, 200);
    assert.equal(confirmBody.status, "CONFIRMED");
    assert.equal(confirmBody.totalAmount, "50.00");
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
