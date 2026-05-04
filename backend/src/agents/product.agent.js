const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "any",
  "cha",
  "chaio",
  "chaieyo",
  "chaincha",
  "chahiyo",
  "cartons",
  "compare",
  "do",
  "for",
  "have",
  "i",
  "me",
  "need",
  "of",
  "ko",
  "kati",
  "ho",
  "dinus",
  "dinu",
  "pathaunu",
  "pathau",
  "please",
  "price",
  "rate",
  "rates",
  "show",
  "the",
  "to",
  "want",
  "with",
  "you",
]);

const PRODUCT_ALIASES = new Map([
  ["chau", ["noodles", "wai", "wai"]],
  ["chauchau", ["noodles", "wai", "wai"]],
  ["chini", ["sugar"]],
  ["chamal", ["rice"]],
  ["chaamal", ["rice"]],
  ["bhat", ["rice"]],
  ["coke", ["coca", "cola"]],
  ["coca", ["coca", "cola"]],
  ["cold", ["coca", "cola"]],
  ["drink", ["coca", "cola"]],
]);

let defaultPrismaClient;

function getDefaultPrismaClient() {
  if (defaultPrismaClient) {
    return defaultPrismaClient;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to query products.");
  }

  const adapter = new PrismaPg({ connectionString });
  defaultPrismaClient = new PrismaClient({ adapter });

  return defaultPrismaClient;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMoney(value) {
  const numericValue = Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid currency value: ${value}`);
  }

  return numericValue.toFixed(2);
}

function extractSearchTerms(input) {
  const normalizedQuery = normalizeText(input);
  const tokenSet = new Set(
    normalizedQuery
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token && !STOP_WORDS.has(token) && token.length >= 2),
  );

  for (const token of [...tokenSet]) {
    const aliases = PRODUCT_ALIASES.get(token);

    if (!aliases) {
      continue;
    }

    for (const alias of aliases) {
      tokenSet.add(alias);
    }
  }

  const tokens = [...tokenSet];

  return {
    normalizedQuery,
    tokens: tokens.length > 0 ? tokens : normalizedQuery ? [normalizedQuery] : [],
  };
}

function buildProductSearchWhere(searchTerms, options = {}) {
  const allTerms = [...new Set([searchTerms.normalizedQuery, ...searchTerms.tokens])].filter(
    Boolean,
  );

  return {
    ...(options.tenantId ? { tenantId: options.tenantId } : {}),
    isActive: true,
    OR: allTerms.flatMap((term) => [
      { name: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
    ]),
  };
}

function scoreProductMatch(product, searchTerms) {
  const normalizedName = normalizeText(product.name);
  const normalizedDescription = normalizeText(product.description);
  const normalizedSku = normalizeText(product.sku);

  let score = 0;

  if (searchTerms.normalizedQuery && normalizedSku === searchTerms.normalizedQuery) {
    score += 120;
  }

  if (searchTerms.normalizedQuery && normalizedName === searchTerms.normalizedQuery) {
    score += 100;
  }

  if (
    searchTerms.normalizedQuery &&
    searchTerms.normalizedQuery.length >= 4 &&
    normalizedName.includes(searchTerms.normalizedQuery)
  ) {
    score += 40;
  }

  if (
    searchTerms.normalizedQuery &&
    searchTerms.normalizedQuery.length >= 4 &&
    normalizedDescription.includes(searchTerms.normalizedQuery)
  ) {
    score += 15;
  }

  for (const token of searchTerms.tokens) {
    if (normalizedSku.includes(token)) {
      score += 18;
    }

    if (normalizedName.includes(token)) {
      score += 12;
    }

    if (normalizedDescription.includes(token)) {
      score += 5;
    }
  }

  return score;
}

function rankSupplierOffers(supplierProducts) {
  return supplierProducts
    .map((supplierProduct) => ({
      supplierId: supplierProduct.supplierId,
      supplierName: supplierProduct.supplier.name,
      supplierPhone: supplierProduct.supplier.phone,
      supplierSku: supplierProduct.supplierSku,
      supplierPrice: formatMoney(supplierProduct.supplierPrice),
      availableStock: supplierProduct.availableStock,
    }))
    .sort((left, right) => {
      const priceDifference =
        Number.parseFloat(left.supplierPrice) - Number.parseFloat(right.supplierPrice);

      if (priceDifference !== 0) {
        return priceDifference;
      }

      if (left.availableStock !== right.availableStock) {
        return right.availableStock - left.availableStock;
      }

      return left.supplierName.localeCompare(right.supplierName);
    });
}

function mapProductResult(product, searchScore) {
  const rankedSuppliers = rankSupplierOffers(product.supplierProducts);

  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    basePrice: formatMoney(product.price),
    matchScore: searchScore,
    cheapestSupplier: rankedSuppliers[0] || null,
    rankedSuppliers,
  };
}

async function queryProductsWithSupplierPricing(options = {}) {
  const queryText = options.query || options.message;

  if (typeof queryText !== "string" || !queryText.trim()) {
    throw new Error("message or query must be a non-empty string.");
  }

  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const limit =
    Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 5;
  const searchTerms = extractSearchTerms(queryText);

  if (searchTerms.tokens.length === 0) {
    return {
      query: queryText.trim(),
      productCount: 0,
      products: [],
    };
  }

  const candidateProducts = await prismaClient.product.findMany({
    where: buildProductSearchWhere(searchTerms, options),
    include: {
      supplierProducts: {
        include: {
          supplier: true,
        },
      },
    },
  });

  const rankedProducts = candidateProducts
    .map((product) => ({
      product,
      searchScore: scoreProductMatch(product, searchTerms),
    }))
    .filter((entry) => entry.searchScore > 0 && entry.product.supplierProducts.length > 0)
    .sort((left, right) => {
      if (left.searchScore !== right.searchScore) {
        return right.searchScore - left.searchScore;
      }

      return left.product.name.localeCompare(right.product.name);
    })
    .slice(0, limit)
    .map((entry) => mapProductResult(entry.product, entry.searchScore));

  return {
    query: queryText.trim(),
    productCount: rankedProducts.length,
    products: rankedProducts,
  };
}

async function handleProductAgent(options = {}) {
  const queryResult = await queryProductsWithSupplierPricing(options);

  return {
    agentName: "find-product-agent",
    status: queryResult.productCount > 0 ? "completed" : "no_match",
    query: queryResult.query,
    productCount: queryResult.productCount,
    products: queryResult.products,
  };
}

async function closeProductAgent() {
  if (!defaultPrismaClient) {
    return;
  }

  await defaultPrismaClient.$disconnect();
  defaultPrismaClient = undefined;
}

module.exports = {
  closeProductAgent,
  handleProductAgent,
  queryProductsWithSupplierPricing,
  rankSupplierOffers,
};
