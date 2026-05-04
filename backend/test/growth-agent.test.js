const test = require("node:test");
const assert = require("node:assert/strict");

const { seedDatabase, prisma } = require("../src/seed/seed");
const { generateGrowthCampaigns } = require("../src/services/growth-agent.service");

test("generateGrowthCampaigns creates reviewable campaign ideas from catalog data", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const result = await generateGrowthCampaigns({ prismaClient: prisma });

  assert.equal(result.summary.retailerCount, 5);
  assert.equal(result.summary.productCount >= 20, true);
  assert.equal(result.campaigns.length > 0, true);
  assert.equal(result.campaigns[0].title.length > 0, true);
  assert.equal(result.campaigns[0].suggestedMessage.includes("{{retailerName}}"), true);
  assert.equal(result.campaigns[0].reason.includes("NPR"), true);
});
