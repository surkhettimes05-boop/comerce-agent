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
    throw new Error("DATABASE_URL is required to load admin data.");
  }

  const adapter = new PrismaPg({ connectionString });
  defaultPrismaClient = new PrismaClient({ adapter });

  return defaultPrismaClient;
}

function formatMoney(value) {
  const numericValue = Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  return numericValue.toFixed(2);
}

function sortProductsForAdmin(products) {
  return [...products].sort((left, right) => left.sku.localeCompare(right.sku));
}

async function getAdminOverview(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();

  const [
    totalRetailers,
    totalSuppliers,
    totalProducts,
    totalOrders,
    revenueAggregate,
    orders,
    products,
  ] = await Promise.all([
    prismaClient.user.count({ where: { role: "CUSTOMER" } }),
    prismaClient.user.count({ where: { role: "SUPPLIER" } }),
    prismaClient.product.count(),
    prismaClient.order.count(),
    prismaClient.order.aggregate({
      _sum: { totalAmount: true },
    }),
    prismaClient.order.findMany({
      include: {
        user: true,
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    prismaClient.product.findMany({
      include: {
        supplierProducts: {
          include: {
            supplier: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      totalRetailers,
      totalSuppliers,
      totalProducts,
      totalOrders,
      totalRevenue: formatMoney(revenueAggregate._sum.totalAmount || 0),
    },
    orders: orders.map((order) => ({
      id: order.id,
      customerName: order.user.name,
      customerEmail: order.user.email,
      status: order.status,
      totalAmount: formatMoney(order.totalAmount),
      itemCount: order.items.length,
      createdAt: order.createdAt.toISOString(),
      notes: order.notes,
    })),
    products: sortProductsForAdmin(products).map((product) => {
      const rankedSuppliers = [...product.supplierProducts].sort((left, right) => {
        const priceDifference =
          Number.parseFloat(left.supplierPrice.toString()) -
          Number.parseFloat(right.supplierPrice.toString());

        if (priceDifference !== 0) {
          return priceDifference;
        }

        return left.supplier.name.localeCompare(right.supplier.name);
      });

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: formatMoney(product.price),
        supplierCount: rankedSuppliers.length,
        cheapestSupplier:
          rankedSuppliers.length > 0
            ? {
                supplierName: rankedSuppliers[0].supplier.name,
                supplierPrice: formatMoney(rankedSuppliers[0].supplierPrice),
              }
            : null,
      };
    }),
  };
}

async function closeAdminService() {
  if (!defaultPrismaClient) {
    return;
  }

  await defaultPrismaClient.$disconnect();
  defaultPrismaClient = undefined;
}

module.exports = {
  closeAdminService,
  getAdminOverview,
};
