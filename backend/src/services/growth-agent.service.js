function formatMoney(value) {
  const numericValue = Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    return "0.00";
  }

  return numericValue.toFixed(2);
}

function chooseBestPricedProducts(products) {
  return products
    .map((product) => {
      const rankedRates = [...product.supplierProducts].sort((left, right) => {
        const priceDifference =
          Number.parseFloat(left.supplierPrice.toString()) -
          Number.parseFloat(right.supplierPrice.toString());

        if (priceDifference !== 0) {
          return priceDifference;
        }

        return right.availableStock - left.availableStock;
      });
      const bestRate = rankedRates[0];

      return {
        product,
        bestRate,
        spread:
          rankedRates.length > 1
            ? Number.parseFloat(rankedRates[rankedRates.length - 1].supplierPrice.toString()) -
              Number.parseFloat(bestRate.supplierPrice.toString())
            : 0,
      };
    })
    .filter((entry) => entry.bestRate)
    .sort((left, right) => {
      if (left.spread !== right.spread) {
        return right.spread - left.spread;
      }

      return right.bestRate.availableStock - left.bestRate.availableStock;
    });
}

function buildRetailerSegment(retailers) {
  if (retailers.length === 0) {
    return {
      name: "No retailers available",
      count: 0,
      sampleRetailers: [],
    };
  }

  return {
    name: "All active retailers",
    count: retailers.length,
    sampleRetailers: retailers.slice(0, 3).map((retailer) => ({
      id: retailer.id,
      name: retailer.name,
      email: retailer.email,
      phone: retailer.phone,
    })),
  };
}

function buildCampaignIdea(entry, retailers, index) {
  const product = entry.product;
  const bestRate = entry.bestRate;
  const supplier = bestRate.supplier;
  const customerPrice = formatMoney(product.price);
  const supplierPrice = formatMoney(bestRate.supplierPrice);
  const segment = buildRetailerSegment(retailers);

  return {
    id: `campaign_${index + 1}`,
    title: `${product.name} retailer push`,
    objective: "Increase reorder volume from active retailers",
    targetSegment: segment,
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      customerPrice,
    },
    supplier: {
      id: supplier.id,
      name: supplier.name,
      supplierPrice,
      availableStock: bestRate.availableStock,
    },
    reason: `${supplier.name} has ${bestRate.availableStock} units available at NPR ${supplierPrice}, while customer base price is NPR ${customerPrice}.`,
    suggestedMessage: `Namaste {{retailerName}}, ${product.name} is available now at NPR ${customerPrice}. Current stock is ready from ${supplier.name}. Reply with quantity if you want us to prepare an order.`,
  };
}

async function generateGrowthCampaigns(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();

  const tenantId = options.tenantId;
  const tenantFilter = tenantId ? { tenantId } : {};

  const [retailers, products, recentOrders] = await Promise.all([
    prismaClient.user.findMany({
      where: {
        ...tenantFilter,
        role: "CUSTOMER",
      },
      orderBy: { name: "asc" },
    }),
    prismaClient.product.findMany({
      where: tenantFilter,
      include: {
        supplierProducts: {
          include: {
            supplier: true,
          },
        },
      },
    }),
    prismaClient.order.findMany({
      where: tenantFilter,
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const productIdeas = chooseBestPricedProducts(products)
    .slice(0, 3)
    .map((entry, index) => buildCampaignIdea(entry, retailers, index));

  const reorderIdeas = recentOrders.slice(0, 2).map((order, index) => {
    const productNames = order.items.map((item) => item.product.name).join(", ");

    return {
      id: `reorder_${index + 1}`,
      title: `${order.user.name} reorder nudge`,
      objective: "Recover repeat order from recent buyer",
      targetSegment: {
        name: "Recent buyer",
        count: 1,
        sampleRetailers: [
          {
            id: order.user.id,
            name: order.user.name,
            email: order.user.email,
            phone: order.user.phone,
          },
        ],
      },
      product: null,
      supplier: null,
      reason: `${order.user.name} recently ordered ${productNames || "products"} worth NPR ${formatMoney(order.totalAmount)}.`,
      suggestedMessage: `Namaste ${order.user.name}, do you want to reorder ${productNames || "your recent items"}? Reply with quantity and we will prepare it.`,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      retailerCount: retailers.length,
      productCount: products.length,
      recentOrderCount: recentOrders.length,
      campaignCount: productIdeas.length + reorderIdeas.length,
    },
    campaigns: [...productIdeas, ...reorderIdeas],
  };
}

module.exports = {
  generateGrowthCampaigns,
};
const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let defaultPrismaClient;

function getDefaultPrismaClient() {
  if (defaultPrismaClient) {
    return defaultPrismaClient;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to generate growth campaigns.");
  }

  const adapter = new PrismaPg({ connectionString });
  defaultPrismaClient = new PrismaClient({ adapter });

  return defaultPrismaClient;
}
