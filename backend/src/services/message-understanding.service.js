const UNIT_ALIASES = new Map([
  ["carton", "carton"],
  ["cartons", "carton"],
  ["ctn", "carton"],
  ["crate", "crate"],
  ["crates", "crate"],
  ["sack", "sack"],
  ["sacks", "sack"],
  ["bori", "sack"],
  ["packet", "packet"],
  ["packets", "packet"],
  ["pkt", "packet"],
  ["piece", "piece"],
  ["pieces", "piece"],
  ["pcs", "piece"],
  ["kg", "kg"],
  ["kilo", "kg"],
]);

const NOISE_WORDS = new Set([
  "i",
  "me",
  "need",
  "want",
  "please",
  "pls",
  "find",
  "show",
  "have",
  "compare",
  "price",
  "pricing",
  "rate",
  "rates",
  "kati",
  "ho",
  "ko",
  "cha",
  "chahiyo",
  "chaincha",
  "chaieyo",
  "chaio",
  "order",
  "buy",
  "purchase",
  "pathaunu",
  "pathau",
  "dinu",
  "dinus",
  "bhejnu",
  "bhejdinus",
  "tomorrow",
  "today",
]);

const PRODUCT_ALIASES = new Map([
  ["chini", "sugar"],
  ["chamal", "rice"],
  ["chaamal", "rice"],
  ["bhat", "rice"],
  ["chau", "wai wai noodles"],
  ["chauchau", "wai wai noodles"],
  ["coke", "coca cola"],
]);

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyIntentFromText(normalizedMessage) {
  if (
    /\b(compare|price|pricing|cheapest|supplier prices?|rate|rates|dar|kati|sasto)\b/.test(
      normalizedMessage,
    )
  ) {
    return "COMPARE_PRICE";
  }

  if (
    /\b(order|buy|purchase|carton|cartons|ctn|crate|crates|sack|sacks|bori|pathaunu|pathau|dinu|dinus|bhejnu|bhejdinus)\b/.test(
      normalizedMessage,
    )
  ) {
    return "CREATE_ORDER";
  }

  if (
    /\b(need|find|have|show|search|wai wai|coke|coca|rice|chamal|chaamal|sugar|chini|noodles?|chau|chauchau|chahiyo|chaincha|chaieyo|chaio)\b/.test(
      normalizedMessage,
    )
  ) {
    return "FIND_PRODUCT";
  }

  return "UNKNOWN";
}

function extractQuantity(tokens) {
  for (const token of tokens) {
    const numericValue = Number.parseInt(token, 10);

    if (Number.isInteger(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return null;
}

function extractUnit(tokens) {
  for (const token of tokens) {
    const unit = UNIT_ALIASES.get(token);

    if (unit) {
      return unit;
    }
  }

  return null;
}

function extractProductQuery(tokens) {
  const productTokens = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token) || UNIT_ALIASES.has(token) || NOISE_WORDS.has(token)) {
      continue;
    }

    const alias = PRODUCT_ALIASES.get(token);

    if (alias) {
      productTokens.push(...alias.split(" "));
      continue;
    }

    productTokens.push(token);
  }

  return productTokens.join(" ").trim();
}

function buildClarification(understanding) {
  if (understanding.intent === "UNKNOWN") {
    return "Please tell me the product name, quantity, or whether you want rates or an order.";
  }

  if (!understanding.productQuery) {
    return "Which product do you need?";
  }

  if (understanding.intent === "CREATE_ORDER") {
    if (!understanding.quantity) {
      return `How many ${understanding.productQuery} do you want?`;
    }

    if (!understanding.unit) {
      return `For ${understanding.productQuery}, do you mean pieces, packets, cartons, crates, or sacks?`;
    }

    const hasKnownVariant =
      /\b(chicken|veg|buff|masala|2pm)\b/.test(understanding.productQuery) ||
      /\bchicken|veg|buff|masala|2pm\b/.test(understanding.normalizedMessage);

    if (
      /\b(wai wai|noodles|chau)\b/.test(understanding.productQuery) &&
      !hasKnownVariant
    ) {
      return "Which Wai Wai variant do you want: Chicken, Veg, Buff, Masala, or 2PM?";
    }
  }

  return null;
}

function understandCustomerMessage(message) {
  const normalizedMessage = normalizeText(message);
  const tokens = normalizedMessage ? normalizedMessage.split(" ") : [];
  const intent = classifyIntentFromText(normalizedMessage);
  const understanding = {
    originalMessage: String(message || "").trim(),
    normalizedMessage,
    intent,
    productQuery: extractProductQuery(tokens),
    quantity: extractQuantity(tokens),
    unit: extractUnit(tokens),
    needsClarification: false,
    clarificationQuestion: null,
  };

  understanding.clarificationQuestion = buildClarification(understanding);
  understanding.needsClarification = Boolean(understanding.clarificationQuestion);

  return understanding;
}

module.exports = {
  understandCustomerMessage,
};
