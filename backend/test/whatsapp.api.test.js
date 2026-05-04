const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const appModule = require("../src/app");
const { seedDatabase, prisma } = require("../src/seed/seed");
const { extractIncomingMessages } = require("../src/services/whatsapp.service");

const createApp = appModule.createApp;

function webhookPayload(text = "Need Wai Wai Chicken noodles") {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: {
                phone_number_id: "1234567890",
              },
              contacts: [
                {
                  wa_id: "9779801000001",
                  profile: {
                    name: "Kathmandu Kirana Store",
                  },
                },
              ],
              messages: [
                {
                  from: "9779801000001",
                  id: "wamid.test",
                  timestamp: "1710000000",
                  type: "text",
                  text: {
                    body: text,
                  },
                },
              ],
            },
            field: "messages",
          },
        ],
      },
    ],
  };
}

test("GET /api/whatsapp/webhook verifies Meta challenge", async () => {
  const app = createApp({
    whatsappVerifyToken: "local-verify-token",
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=local-verify-token&hub.challenge=challenge-123`,
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body, "challenge-123");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("extractIncomingMessages pulls text messages from Meta webhook payload", () => {
  const messages = extractIncomingMessages(webhookPayload("Compare Coke rates"));

  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, "9779801000001");
  assert.equal(messages[0].phoneNumberId, "1234567890");
  assert.equal(messages[0].text, "Compare Coke rates");
  assert.equal(messages[0].profileName, "Kathmandu Kirana Store");
});

test("POST /api/whatsapp/webhook replies through WhatsApp sender", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const sentMessages = [];
  const app = createApp({
    prismaClient: prisma,
    whatsappSendText: async (message) => {
      sentMessages.push(message);

      return { messages: [{ id: "wamid.reply" }] };
    },
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(webhookPayload()),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { received: true, processed: 1 });
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, "9779801000001");
    assert.equal(sentMessages[0].phoneNumberId, "1234567890");
    assert.equal(sentMessages[0].text.includes("Wai Wai Chicken Noodles 75g"), true);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
