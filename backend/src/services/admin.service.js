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

async function resolveTenantId(prismaClient, tenantId) {
  if (tenantId) {
    return tenantId;
  }

  const tenant = await prismaClient.tenant.findUnique({
    where: { slug: "khaacho-demo" },
  });

  if (!tenant) {
    throw new Error("Tenant not found.");
  }

  return tenant.id;
}

function requireText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required.`);
  }

  return value.trim();
}

function requireMoney(value, fieldName) {
  const formattedValue = formatMoney(value);

  if (Number.parseFloat(formattedValue) < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }

  return formattedValue;
}

function requireStock(value) {
  const stock = Number.parseInt(String(value), 10);

  if (!Number.isInteger(stock) || stock < 0) {
    throw new Error("availableStock must be a non-negative integer.");
  }

  return stock;
}

async function getAdminOverview(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const tenantFilter = options.tenantId ? { tenantId: options.tenantId } : {};

  const [
    totalRetailers,
    totalSuppliers,
    totalProducts,
    totalOrders,
    revenueAggregate,
    orders,
    products,
  ] = await Promise.all([
    prismaClient.user.count({ where: { ...tenantFilter, role: "CUSTOMER" } }),
    prismaClient.user.count({ where: { ...tenantFilter, role: "SUPPLIER" } }),
    prismaClient.product.count({ where: tenantFilter }),
    prismaClient.order.count({ where: tenantFilter }),
    prismaClient.order.aggregate({
      where: tenantFilter,
      _sum: { totalAmount: true },
    }),
    prismaClient.order.findMany({
      where: tenantFilter,
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
      where: tenantFilter,
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

async function getCatalogFeed(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const tenantId = await resolveTenantId(prismaClient, options.tenantId);

  const [products, suppliers] = await Promise.all([
    prismaClient.product.findMany({
      where: { tenantId },
      include: {
        supplierProducts: {
          include: {
            supplier: true,
          },
          orderBy: {
            supplierPrice: "asc",
          },
        },
      },
      orderBy: { sku: "asc" },
    }),
    prismaClient.user.findMany({
      where: {
        tenantId,
        role: "SUPPLIER",
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      price: formatMoney(product.price),
      supplierRates: product.supplierProducts.map((rate) => ({
        id: rate.id,
        supplierId: rate.supplierId,
        supplierName: rate.supplier.name,
        supplierSku: rate.supplierSku,
        supplierPrice: formatMoney(rate.supplierPrice),
        availableStock: rate.availableStock,
      })),
    })),
    suppliers: suppliers.map((supplier) => ({
      id: supplier.id,
      email: supplier.email,
      name: supplier.name,
      phone: supplier.phone,
    })),
  };
}

async function upsertProduct(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const tenantId = await resolveTenantId(prismaClient, options.tenantId);
  const sku = requireText(options.sku, "sku").toUpperCase();
  const name = requireText(options.name, "name");
  const price = requireMoney(options.price, "price");
  const description =
    typeof options.description === "string" && options.description.trim()
      ? options.description.trim()
      : null;

  const product = await prismaClient.product.upsert({
    where: {
      tenantId_sku: {
        tenantId,
        sku,
      },
    },
    create: {
      tenantId,
      sku,
      name,
      description,
      price,
    },
    update: {
      name,
      description,
      price,
      isActive: true,
    },
  });

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: formatMoney(product.price),
  };
}

async function upsertSupplier(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const tenantId = await resolveTenantId(prismaClient, options.tenantId);
  const email = requireText(options.email, "email").toLowerCase();
  const name = requireText(options.name, "name");
  const phone =
    typeof options.phone === "string" && options.phone.trim()
      ? options.phone.trim()
      : null;

  const supplier = await prismaClient.user.upsert({
    where: {
      tenantId_email: {
        tenantId,
        email,
      },
    },
    create: {
      tenantId,
      email,
      name,
      phone,
      role: "SUPPLIER",
    },
    update: {
      name,
      phone,
      role: "SUPPLIER",
    },
  });

  return {
    id: supplier.id,
    email: supplier.email,
    name: supplier.name,
    phone: supplier.phone,
  };
}

async function upsertSupplierRate(options = {}) {
  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const tenantId = await resolveTenantId(prismaClient, options.tenantId);
  const supplierId = requireText(options.supplierId, "supplierId");
  const productId = requireText(options.productId, "productId");
  const supplierPrice = requireMoney(options.supplierPrice, "supplierPrice");
  const availableStock = requireStock(options.availableStock);
  const supplierSku =
    typeof options.supplierSku === "string" && options.supplierSku.trim()
      ? options.supplierSku.trim()
      : null;

  const [supplier, product] = await Promise.all([
    prismaClient.user.findFirst({
      where: {
        id: supplierId,
        tenantId,
        role: "SUPPLIER",
      },
    }),
    prismaClient.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    }),
  ]);

  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  if (!product) {
    throw new Error("Product not found.");
  }

  const rate = await prismaClient.supplierProduct.upsert({
    where: {
      tenantId_supplierId_productId: {
        tenantId,
        supplierId,
        productId,
      },
    },
    create: {
      tenantId,
      supplierId,
      productId,
      supplierSku,
      supplierPrice,
      availableStock,
    },
    update: {
      supplierSku,
      supplierPrice,
      availableStock,
    },
    include: {
      supplier: true,
      product: true,
    },
  });

  return {
    id: rate.id,
    supplierId: rate.supplierId,
    supplierName: rate.supplier.name,
    productId: rate.productId,
    productName: rate.product.name,
    supplierSku: rate.supplierSku,
    supplierPrice: formatMoney(rate.supplierPrice),
    availableStock: rate.availableStock,
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
  getCatalogFeed,
  getAdminOverview,
  upsertProduct,
  upsertSupplier,
  upsertSupplierRate,
};
