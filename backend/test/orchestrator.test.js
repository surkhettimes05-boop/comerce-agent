const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createOrchestrator,
  classifyIntentLocally,
  normalizeIntentForRouting,
  SUPPORTED_AGENT_INTENTS,
} = require("../src/agents/orchestrator");

test("orchestrator triggers FIND_PRODUCT agent", async () => {
  const calls = [];
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => ({
      intent: "FIND_PRODUCT",
      confidence: "high",
      needsClarification: false,
    }),
    agents: {
      FIND_PRODUCT: async (payload) => {
        calls.push(payload);
        return { agentName: "find-product-agent" };
      },
    },
  });

  const result = await orchestrator.routeMessage("Do you have Coke 1L?");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].intent, "FIND_PRODUCT");
  assert.equal(result.handled, true);
  assert.equal(result.agentIntent, "FIND_PRODUCT");
  assert.deepEqual(result.agentResult, { agentName: "find-product-agent" });
});

test("orchestrator maps PLACE_ORDER to CREATE_ORDER agent", async () => {
  const calls = [];
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => ({
      intent: "PLACE_ORDER",
      confidence: "medium",
      needsClarification: false,
    }),
    agents: {
      CREATE_ORDER: async (payload) => {
        calls.push(payload);
        return { agentName: "create-order-agent" };
      },
    },
  });

  const result = await orchestrator.routeMessage("I need 10 cartons of Wai Wai.");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].intent, "CREATE_ORDER");
  assert.equal(calls[0].originalIntent, "PLACE_ORDER");
  assert.equal(result.agentIntent, "CREATE_ORDER");
  assert.deepEqual(result.agentResult, { agentName: "create-order-agent" });
});

test("orchestrator maps CHECK_PRICE to COMPARE_PRICE agent", async () => {
  const calls = [];
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => ({
      intent: "CHECK_PRICE",
      confidence: "high",
      needsClarification: false,
    }),
    agents: {
      COMPARE_PRICE: async (payload) => {
        calls.push(payload);
        return { agentName: "compare-price-agent" };
      },
    },
  });

  const result = await orchestrator.routeMessage(
    "Compare Coke 1L pricing across suppliers.",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].intent, "COMPARE_PRICE");
  assert.equal(result.agentIntent, "COMPARE_PRICE");
  assert.deepEqual(result.agentResult, { agentName: "compare-price-agent" });
});

test("orchestrator leaves unsupported intents unhandled", async () => {
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => ({
      intent: "UNKNOWN",
      confidence: "low",
      needsClarification: true,
    }),
  });

  const result = await orchestrator.routeMessage("hello");

  assert.equal(result.handled, false);
  assert.equal(result.agentIntent, "UNKNOWN");
  assert.equal(result.agentResult, null);
});

test("exports supported agent intents and route normalization", () => {
  assert.deepEqual(SUPPORTED_AGENT_INTENTS, [
    "FIND_PRODUCT",
    "CREATE_ORDER",
    "COMPARE_PRICE",
  ]);
  assert.equal(normalizeIntentForRouting("PLACE_ORDER"), "CREATE_ORDER");
  assert.equal(normalizeIntentForRouting("CHECK_PRICE"), "COMPARE_PRICE");
  assert.equal(normalizeIntentForRouting("FIND_PRODUCT"), "FIND_PRODUCT");
});

test("orchestrator falls back to local intent classification when the provider is unavailable", async () => {
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => {
      throw new Error("classifier unavailable");
    },
    agents: {
      FIND_PRODUCT: async () => ({ agentName: "find-product-agent" }),
    },
  });

  const result = await orchestrator.routeMessage("Need Wai Wai Chicken noodles");

  assert.equal(result.handled, true);
  assert.equal(result.agentIntent, "FIND_PRODUCT");
  assert.equal(result.classification.confidence, "medium");
});

test("orchestrator attaches structured customer understanding", async () => {
  const orchestrator = createOrchestrator({
    classifyIntentFn: async () => ({
      intent: "UNKNOWN",
      confidence: "low",
      needsClarification: true,
    }),
    agents: {
      CREATE_ORDER: async (payload) => ({
        agentName: "create-order-agent",
        understanding: payload.understanding,
      }),
    },
  });

  const result = await orchestrator.routeMessage("2 carton wai wai pathaunu");

  assert.equal(result.handled, true);
  assert.equal(result.agentIntent, "CREATE_ORDER");
  assert.equal(result.understanding.productQuery, "wai wai");
  assert.equal(result.understanding.quantity, 2);
  assert.equal(result.understanding.unit, "carton");
  assert.equal(result.understanding.needsClarification, true);
});

test("local intent classifier handles common commerce prompts", () => {
  assert.equal(classifyIntentLocally("Compare Coke 1L prices").intent, "CHECK_PRICE");
  assert.equal(classifyIntentLocally("Order 10 cartons of Wai Wai").intent, "PLACE_ORDER");
  assert.equal(classifyIntentLocally("Need sugar").intent, "FIND_PRODUCT");
  assert.equal(classifyIntentLocally("chini ko rate kati ho").intent, "CHECK_PRICE");
  assert.equal(classifyIntentLocally("2 carton wai wai pathaunu").intent, "PLACE_ORDER");
  assert.equal(classifyIntentLocally("chau chau chahiyo").intent, "FIND_PRODUCT");
});
