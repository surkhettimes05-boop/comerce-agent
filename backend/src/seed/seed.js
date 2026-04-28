const path = require("node:path");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const retailers = [
  {
    email: "retailer.kathmandu@example.com",
    name: "Kathmandu Kirana Store",
    phone: "9801000001",
    role: "CUSTOMER",
  },
  {
    email: "retailer.pokhara@example.com",
    name: "Pokhara Fresh Mart",
    phone: "9801000002",
    role: "CUSTOMER",
  },
  {
    email: "retailer.lalitpur@example.com",
    name: "Lalitpur Family Pasal",
    phone: "9801000003",
    role: "CUSTOMER",
  },
  {
    email: "retailer.biratnagar@example.com",
    name: "Biratnagar Wholesale Corner",
    phone: "9801000004",
    role: "CUSTOMER",
  },
  {
    email: "retailer.butwal@example.com",
    name: "Butwal Daily Needs",
    phone: "9801000005",
    role: "CUSTOMER",
  },
];

const suppliers = [
  {
    email: "supplier.himalaya@example.com",
    name: "Himalaya Distribution",
    phone: "9812000001",
    role: "SUPPLIER",
  },
  {
    email: "supplier.sagarmatha@example.com",
    name: "Sagarmatha Traders",
    phone: "9812000002",
    role: "SUPPLIER",
  },
  {
    email: "supplier.bagmati@example.com",
    name: "Bagmati Supply House",
    phone: "9812000003",
    role: "SUPPLIER",
  },
  {
    email: "supplier.gandaki@example.com",
    name: "Gandaki Food Suppliers",
    phone: "9812000004",
    role: "SUPPLIER",
  },
  {
    email: "supplier.terai@example.com",
    name: "Terai FMCG Network",
    phone: "9812000005",
    role: "SUPPLIER",
  },
];

const products = [
  {
    sku: "WW-CHICK-075",
    name: "Wai Wai Chicken Noodles 75g",
    description: "Instant noodles popular across Nepal.",
    price: "25.00",
  },
  {
    sku: "WW-VEG-075",
    name: "Wai Wai Veg Noodles 75g",
    description: "Vegetarian Wai Wai noodle pack.",
    price: "25.00",
  },
  {
    sku: "WW-BUFF-075",
    name: "Wai Wai Buff Noodles 75g",
    description: "Buff-flavored Wai Wai noodle pack.",
    price: "30.00",
  },
  {
    sku: "WW-MASALA-075",
    name: "Wai Wai Masala Delights 75g",
    description: "Masala noodle pack for quick resale.",
    price: "28.00",
  },
  {
    sku: "SG-FINE-001",
    name: "Fine Sugar 1kg",
    description: "Refined sugar for tea shops and retail stores.",
    price: "120.00",
  },
  {
    sku: "SG-FINE-005",
    name: "Fine Sugar 5kg",
    description: "Bulk refined sugar pack.",
    price: "590.00",
  },
  {
    sku: "SG-BROWN-001",
    name: "Brown Sugar 1kg",
    description: "Brown sugar for cafes and bakeries.",
    price: "160.00",
  },
  {
    sku: "SG-MISRI-500",
    name: "Mishri Sugar Crystals 500g",
    description: "Sugar crystals used in households and temples.",
    price: "90.00",
  },
  {
    sku: "RC-JEERA-025",
    name: "Jeera Masino Rice 25kg",
    description: "Daily-use rice sack for neighborhood retailers.",
    price: "2200.00",
  },
  {
    sku: "RC-SONA-025",
    name: "Sona Mansuli Rice 25kg",
    description: "Popular medium-grain rice sack.",
    price: "2050.00",
  },
  {
    sku: "RC-BASMATI-020",
    name: "Basmati Rice 20kg",
    description: "Premium basmati rice for restaurants and homes.",
    price: "2750.00",
  },
  {
    sku: "RC-MANSULI-010",
    name: "Mansuli Rice 10kg",
    description: "Compact rice pack for fast-moving retail sales.",
    price: "980.00",
  },
  {
    sku: "CK-250-GLASS",
    name: "Coca-Cola Glass Bottle 250ml",
    description: "Returnable glass bottle soft drink.",
    price: "35.00",
  },
  {
    sku: "CK-500-PET",
    name: "Coca-Cola PET Bottle 500ml",
    description: "Fast-moving bottled soft drink.",
    price: "60.00",
  },
  {
    sku: "CK-1000-PET",
    name: "Coca-Cola PET Bottle 1L",
    description: "Family-size soft drink bottle.",
    price: "115.00",
  },
  {
    sku: "CK-2250-PET",
    name: "Coca-Cola PET Bottle 2.25L",
    description: "Large-format bottle for gatherings.",
    price: "240.00",
  },
  {
    sku: "WW-2PM-080",
    name: "Wai Wai 2PM Noodles 80g",
    description: "Snack-time instant noodle variant.",
    price: "28.00",
  },
  {
    sku: "SG-ICING-500",
    name: "Icing Sugar 500g",
    description: "Powdered sugar for bakery retail channels.",
    price: "85.00",
  },
  {
    sku: "RC-KALO-005",
    name: "Kalo Nun Rice 5kg",
    description: "Specialty black rice grown in Nepal.",
    price: "700.00",
  },
  {
    sku: "CK-ZERO-500",
    name: "Coca-Cola Zero 500ml",
    description: "Zero sugar variant for urban convenience stores.",
    price: "70.00",
  },
];

function buildCreditProfiles(retailerRecords) {
  return retailerRecords.map((retailer, index) => ({
    userId: retailer.id,
    creditScore: 640 + index * 18,
    creditLimit: (25000 + index * 10000).toFixed(2),
    availableCredit: (18000 + index * 7000).toFixed(2),
    riskBand: index < 2 ? "LOW" : index < 4 ? "MEDIUM" : "HIGH",
  }));
}

function buildSupplierPricing(supplierRecords, productRecords) {
  return productRecords.flatMap((product, index) => {
    const primarySupplier = supplierRecords[index % supplierRecords.length];
    const secondarySupplier = supplierRecords[(index + 2) % supplierRecords.length];
    const basePrice = Number(product.price);

    return [
      {
        supplierId: primarySupplier.id,
        productId: product.id,
        supplierSku: `${primarySupplier.name.slice(0, 3).toUpperCase()}-${product.sku}`,
        supplierPrice: (basePrice * 0.88).toFixed(2),
        availableStock: 80 + index * 5,
      },
      {
        supplierId: secondarySupplier.id,
        productId: product.id,
        supplierSku: `${secondarySupplier.name.slice(0, 3).toUpperCase()}-${product.sku}`,
        supplierPrice: (basePrice * 0.91).toFixed(2),
        availableStock: 60 + index * 4,
      },
    ];
  });
}

async function resetDatabase() {
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.creditProfile.deleteMany(),
    prisma.supplierProduct.deleteMany(),
    prisma.product.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedDatabase() {
  await resetDatabase();

  await prisma.user.createMany({ data: [...retailers, ...suppliers] });
  await prisma.product.createMany({ data: products });

  const [retailerRecords, supplierRecords, productRecords] = await Promise.all([
    prisma.user.findMany({ where: { role: "CUSTOMER" }, orderBy: { email: "asc" } }),
    prisma.user.findMany({ where: { role: "SUPPLIER" }, orderBy: { email: "asc" } }),
    prisma.product.findMany({ orderBy: { sku: "asc" } }),
  ]);

  await prisma.creditProfile.createMany({
    data: buildCreditProfiles(retailerRecords),
  });

  await prisma.supplierProduct.createMany({
    data: buildSupplierPricing(supplierRecords, productRecords),
  });

  return {
    retailers: retailerRecords.length,
    suppliers: supplierRecords.length,
    products: productRecords.length,
    supplierPricing: productRecords.length * 2,
  };
}

async function main() {
  const summary = await seedDatabase();
  console.log("Seed completed:", summary);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  prisma,
  seedDatabase,
};
