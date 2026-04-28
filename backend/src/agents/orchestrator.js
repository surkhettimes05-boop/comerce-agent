const { classifyIntent } = require("../services/ollama.service");
const {
  handleProductAgent,
  queryProductsWithSupplierPricing,
} = require("./product.agent");

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
    FIND_PRODUCT: async ({ message }) =>
      handleProductAgent({
        message,
        prismaClient: sharedContext.prismaClient,
      }),
    CREATE_ORDER: async ({ message, classification }) => ({
      agentName: "create-order-agent",
      status: "needs_confirmation",
      confirmationRequired: true,
      message,
      classification,
      reply:
        "Order intent detected. Confirmation is required before an order can be saved.",
    }),
    COMPARE_PRICE: async ({ message }) =>
      handleComparePriceAgent({
        message,
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
  });
  const classification = await classifyIntentFn(userMessage.trim());
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
      agentResult: null,
    };
  }

  const agentPayload = {
    message: userMessage.trim(),
    intent: agentIntent,
    originalIntent: classification.intent,
    classification,
    prismaClient: options.prismaClient,
  };

  const agentResult = await agentHandler(agentPayload);

  return {
    handled: true,
    agentIntent,
    originalIntent: classification.intent,
    classification,
    agentResult,
  };
}

function createOrchestrator(options = {}) {
  return {
    routeMessage(userMessage) {
      return orchestrateMessage(userMessage, options);
    },
  };
}

module.exports = {
  createOrchestrator,
  orchestrateMessage,
  normalizeIntentForRouting,
  SUPPORTED_AGENT_INTENTS,
};
