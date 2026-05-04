const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const appModule = require("../src/app");
const { prisma, seedDatabase } = require("../src/seed/seed");

test("protected routes resolve tenant, account, membership, and user from request context", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = appModule.createApp({
    prismaClient: prisma,
    authMode: "development-header",
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/overview`, {
      headers: {
        "x-forwarded-host": "khaacho-demo.khaacho.test",
        "x-dev-account-email": "retailer.kathmandu@example.com",
      },
    });

    assert.equal(response.status, 200);
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
