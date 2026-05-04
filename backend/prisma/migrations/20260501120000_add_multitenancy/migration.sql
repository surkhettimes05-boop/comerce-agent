-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'SUPPLIER_CONTACT', 'RETAILER_CONTACT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrderDraftStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "phone" TEXT,
    "billingAddress" TEXT,
    "panOrVatNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "authSubject" TEXT,
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantMembership" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMembership_pkey" PRIMARY KEY ("id")
);

-- Add tenant/account columns as nullable first so existing local data can be backfilled.
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN "accountId" TEXT;
ALTER TABLE "Product" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "SupplierProduct" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Order" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "CreditProfile" ADD COLUMN "tenantId" TEXT;

-- Backfill existing single-tenant data into the default demo tenant.
INSERT INTO "Tenant" ("id", "name", "slug", "status", "timezone", "currency", "createdAt", "updatedAt")
VALUES ('tenant_khaacho_demo', 'Khaacho Demo Tenant', 'khaacho-demo', 'ACTIVE', 'Asia/Kathmandu', 'NPR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Account" ("id", "email", "displayName", "createdAt", "updatedAt")
SELECT 'acct_' || md5("email"), "email", "name", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("email") DO NOTHING;

UPDATE "User"
SET "tenantId" = 'tenant_khaacho_demo',
    "accountId" = 'acct_' || md5("email")
WHERE "tenantId" IS NULL;

INSERT INTO "TenantMembership" ("id", "tenantId", "accountId", "role", "status", "createdAt", "updatedAt")
SELECT
  'mbr_' || md5('tenant_khaacho_demo:' || "email"),
  'tenant_khaacho_demo',
  'acct_' || md5("email"),
  CASE WHEN "role" = 'SUPPLIER' THEN 'SUPPLIER_CONTACT'::"MembershipRole" ELSE 'RETAILER_CONTACT'::"MembershipRole" END,
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("tenantId", "accountId") DO NOTHING;

UPDATE "Product" SET "tenantId" = 'tenant_khaacho_demo' WHERE "tenantId" IS NULL;
UPDATE "SupplierProduct" SET "tenantId" = 'tenant_khaacho_demo' WHERE "tenantId" IS NULL;
UPDATE "Order" SET "tenantId" = 'tenant_khaacho_demo' WHERE "tenantId" IS NULL;
UPDATE "Conversation" SET "tenantId" = 'tenant_khaacho_demo' WHERE "tenantId" IS NULL;
UPDATE "CreditProfile" SET "tenantId" = 'tenant_khaacho_demo' WHERE "tenantId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "SupplierProduct" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Conversation" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "CreditProfile" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "OrderDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderDraftStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "sourceMessage" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDraftItem" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "packagingUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDraftItem_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "User_email_key";
DROP INDEX "Product_sku_key";
DROP INDEX "SupplierProduct_supplierId_productId_key";
DROP INDEX "CreditProfile_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE UNIQUE INDEX "Account_authSubject_key" ON "Account"("authSubject");
CREATE UNIQUE INDEX "TenantMembership_tenantId_accountId_key" ON "TenantMembership"("tenantId", "accountId");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");
CREATE UNIQUE INDEX "Product_tenantId_sku_key" ON "Product"("tenantId", "sku");
CREATE UNIQUE INDEX "SupplierProduct_tenantId_supplierId_productId_key" ON "SupplierProduct"("tenantId", "supplierId", "productId");
CREATE UNIQUE INDEX "CreditProfile_userId_key" ON "CreditProfile"("userId");
CREATE UNIQUE INDEX "OrderDraftItem_draftId_productId_key" ON "OrderDraftItem"("draftId", "productId");

-- AddForeignKey
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierProduct" ADD CONSTRAINT "SupplierProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditProfile" ADD CONSTRAINT "CreditProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDraftItem" ADD CONSTRAINT "OrderDraftItem_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "OrderDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderDraftItem" ADD CONSTRAINT "OrderDraftItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
