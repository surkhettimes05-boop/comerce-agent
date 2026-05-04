const { classifyIntent } = require("../services/ollama.service");
const { understandCustomerMessage } = require("../services/message-understanding.service");
const {
  handleProductAgent,
  queryProductsWithSupplierPricing,
} = require("./product.agent");
const { createOrderDraftFromUnderstanding } = require("../services/order-draft.service");

const SUPPORTED_AGENT_INTENTS = [
  "FIND_PRODUCT",
  "CREATE_ORDER",
  "COMPARE_PRICE",
];

const INTENT_ROUTE_ALIASES = {
  PLACE_ORDER: "CREATE_ORDER",
  CHECK_PRICE: "COMPARE_PRICE",
};

function normalizeIntentForRouting(intent) {
  if (typeof intent !== "string" || !intent.trim()) {
    return "UNKNOWN";
  }

  return INTENT_ROUTE_ALIASES[intent] || intent;
}

function classifyIntentLocally(userMessage) {
  const normalizedMessage = String(userMessage || "").toLowerCase();

  if (
    /\b(compare|price|pricing|cheapest|supplier prices?|rate|rates|dar|kati|kati ho|kati parcha|sasto)\b/.test(
      normalizedMessage,
    )
  ) {
    return {
      intent: "CHECK_PRICE",
      confidence: "medium",
      needsClarification: false,
    };
  }

  if (
    /\b(order|buy|purchase|carton|cartons|crate|crates|sack|sacks|pathaunu|pathau|dinu|dinus|bhejnu|bhejdinus)\b/.test(
      normalizedMessage,
    )
  ) {
    return {
      intent: "PLACE_ORDER",
      confidence: "medium",
      needsClarification: false,
    };
  }

  if (
    /\b(need|find|have|show|search|wai wai|coke|coca|rice|chamal|chaamal|sugar|chini|noodles?|chau chau|chauchau|chahiyo|chaincha|chaieyo|chaio)\b/.test(
      normalizedMessage,
    )
  ) {
    return {
      intent: "FIND_PRODUCT",
      confidence: "medium",
      needsClarification: false,
    };
  }

  return {
    intent: "UNKNOWN",
    confidence: "low",
    needsClarification: true,
  };
}

async function handleComparePriceAgent({ message, prismaClient }) {
  const queryResult = await queryProductsWithSupplierPricing({
    message,
    prismaClient,
  });

  return {
    agentName: "compare-price-agent",
    status: queryResult.productCount > 0 ? "completed" : "no_match",
    query: queryResult.query,
    productCount: queryResult.productCount,
    products: queryResult.products,
  };
}

function createDefaultAgents(sharedContext = {}) {
  return {
    FIND_PRODUCT: async ({ message, understanding }) =>
      handleProductAgent({
        message: understanding.productQuery || message,
        prismaClient: sharedContext.prismaClient,
      }),
    CREATE_ORDER: async ({ message, classification, understanding }) => ({
      ...(await createOrderDraftFromUnderstanding({
        tenantId: sharedContext.tenantId,
        userId: sharedContext.userId,
        message,
        classification,
        understanding,
        prismaClient: sharedContext.prismaClient,
      })),
    }),
    COMPARE_PRICE: async ({ message, understanding }) =>
      handleComparePriceAgent({
        message: understanding.productQuery || message,
        prismaClient: sharedContext.prismaClient,
      }),
  };
}

function buildAgentRegistry(customAgents = {}, sharedContext = {}) {
  return {
    ...createDefaultAgents(sharedContext),
    ...customAgents,
  };
}

async function orchestrateMessage(userMessage, options = {}) {
  if (typeof userMessage !== "string" || !userMessage.trim()) {
    throw new Error("userMessage must be a non-empty string.");
  }

  const classifyIntentFn = options.classifyIntentFn || classifyIntent;
  const agents = buildAgentRegistry(options.agents, {
    prismaClient: options.prismaClient,
    tenantId: options.tenantId,
    userId: options.userId,
  });
  const understanding = understandCustomerMessage(userMessage.trim());
  let classification;

  try {
    classification = await classifyIntentFn(userMessage.trim());
  } catch {
    classification = classifyIntentLocally(userMessage.trim());
  }
  if (classification.intent === "UNKNOWN" && understanding.intent !== "UNKNOWN") {
    classification = {
      intent: understanding.intent,
      confidence: "medium",
      needsClarification: understanding.needsClarification,
    };
  }

  const agentIntent = normalizeIntentForRouting(classification.intent);
  const agentHandler = agents[agentIntent];

  if (
    !SUPPORTED_AGENT_INTENTS.includes(agentIntent) ||
    typeof agentHandler !== "function"
  ) {
    return {
      handled: false,
      agentIntent,
      originalIntent: classification.intent,
      classification,
      understanding,
      agentResult: null,
    };
  }

  const agentPayload = {
    message: userMessage.trim(),
    intent: agentIntent,
    originalIntent: classification.intent,
    classification,
    understanding,
    prismaClient: options.prismaClient,
  };

  const agentResult = await agentHandler(agentPayload);

  return {
    handled: true,
    agentIntent,
    originalIntent: classification.intent,
    classification,
    understanding,
    agentResult,
  };
}

function createOrchestrator(options = {}) {
  return {
    routeMessage(userMessage, context = {}) {
      return orchestrateMessage(userMessage, {
        ...options,
        ...context,
      });
    },
  };
}

module.exports = {
  createOrchestrator,
  orchestrateMessage,
  normalizeIntentForRouting,
  classifyIntentLocally,
  SUPPORTED_AGENT_INTENTS,
};
