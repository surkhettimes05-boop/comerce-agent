const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyIntent,
  INTENT_SCHEMA,
  INTENT_VALUES,
} = require("../src/services/ollama.service");

test("classifyIntent returns validated JSON intent from Ollama response", async () => {
  const result = await classifyIntent("I need 10 cartons of Wai Wai tomorrow.", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          intent: "PLACE_ORDER",
          confidence: "high",
          needsClarification: false,
        }),
      }),
    }),
  });

  assert.deepEqual(result, {
    intent: "PLACE_ORDER",
    confidence: "high",
    needsClarification: false,
  });
});

test("classifyIntent downgrades invalid model output to UNKNOWN", async () => {
  const result = await classifyIntent("hello", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          intent: "NOT_A_REAL_INTENT",
          confidence: "high",
          needsClarification: false,
        }),
      }),
    }),
  });

  assert.deepEqual(result, {
    intent: "UNKNOWN",
    confidence: "low",
    needsClarification: true,
  });
});

test("exports a strict schema with the supported intent enum", () => {
  assert.equal(INTENT_SCHEMA.type, "object");
  assert.deepEqual(INTENT_SCHEMA.required, [
    "intent",
    "confidence",
    "needsClarification",
  ]);
  assert.deepEqual(INTENT_SCHEMA.properties.intent.enum, INTENT_VALUES);
  assert.equal(INTENT_SCHEMA.additionalProperties, false);
});
