const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const MODEL_NAME = process.env.OLLAMA_MODEL || "llama3.2:3b";

const INTENT_VALUES = [
  "PLACE_ORDER",
  "CHECK_PRICE",
  "CHECK_STOCK",
  "FIND_PRODUCT",
  "ORDER_STATUS",
  "CREDIT_REQUEST",
  "GREETING",
  "UNKNOWN",
];

const CONFIDENCE_VALUES = ["high", "medium", "low"];

const INTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: INTENT_VALUES,
    },
    confidence: {
      type: "string",
      enum: CONFIDENCE_VALUES,
    },
    needsClarification: {
      type: "boolean",
    },
  },
  required: ["intent", "confidence", "needsClarification"],
};

function buildPrompt(userMessage) {
  return [
    "Classify the user's commerce message into exactly one intent.",
    "Return JSON only and follow the provided schema exactly.",
    "Do not infer facts that are not explicit in the message.",
    "If the message is ambiguous, unsupported, or not a commerce request, return intent UNKNOWN with low confidence and needsClarification true.",
    `Supported intents: ${INTENT_VALUES.join(", ")}`,
    "",
    "User message:",
    userMessage,
    "",
    "JSON schema:",
    JSON.stringify(INTENT_SCHEMA),
  ].join("\n");
}

function normalizeIntentResult(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !INTENT_VALUES.includes(payload.intent) ||
    !CONFIDENCE_VALUES.includes(payload.confidence) ||
    typeof payload.needsClarification !== "boolean"
  ) {
    return {
      intent: "UNKNOWN",
      confidence: "low",
      needsClarification: true,
    };
  }

  return {
    intent: payload.intent,
    confidence: payload.confidence,
    needsClarification: payload.needsClarification,
  };
}

async function classifyIntent(userMessage, options = {}) {
  if (typeof userMessage !== "string" || !userMessage.trim()) {
    throw new Error("userMessage must be a non-empty string.");
  }

  const fetchImpl = options.fetchImpl || fetch;

  const response = await fetchImpl(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt: buildPrompt(userMessage.trim()),
      format: INTENT_SCHEMA,
      stream: false,
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with status ${response.status}.`);
  }

  const result = await response.json();

  if (typeof result.response !== "string" || !result.response.trim()) {
    throw new Error("Ollama returned an empty response payload.");
  }

  let parsedResponse;

  try {
    parsedResponse = JSON.parse(result.response);
  } catch {
    return normalizeIntentResult(null);
  }

  return normalizeIntentResult(parsedResponse);
}

module.exports = {
  classifyIntent,
  INTENT_SCHEMA,
  INTENT_VALUES,
  MODEL_NAME,
};
