const test = require("node:test");
const assert = require("node:assert/strict");

const {
  understandCustomerMessage,
} = require("../src/services/message-understanding.service");

test("understandCustomerMessage extracts product, quantity, unit, and order clarification", () => {
  const result = understandCustomerMessage("2 carton wai wai pathaunu");

  assert.equal(result.intent, "CREATE_ORDER");
  assert.equal(result.productQuery, "wai wai");
  assert.equal(result.quantity, 2);
  assert.equal(result.unit, "carton");
  assert.equal(result.needsClarification, true);
  assert.equal(
    result.clarificationQuestion,
    "Which Wai Wai variant do you want: Chicken, Veg, Buff, Masala, or 2PM?",
  );
});

test("understandCustomerMessage maps romanized product and rate wording", () => {
  const result = understandCustomerMessage("chini ko rate kati ho");

  assert.equal(result.intent, "COMPARE_PRICE");
  assert.equal(result.productQuery, "sugar");
  assert.equal(result.quantity, null);
  assert.equal(result.unit, null);
  assert.equal(result.needsClarification, false);
});

test("understandCustomerMessage asks useful clarification for unknown messages", () => {
  const result = understandCustomerMessage("hello");

  assert.equal(result.intent, "UNKNOWN");
  assert.equal(result.needsClarification, true);
  assert.equal(
    result.clarificationQuestion,
    "Please tell me the product name, quantity, or whether you want rates or an order.",
  );
});
