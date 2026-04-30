# Multi-Tenant SaaS Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current single-tenant commerce agent into a tenant-safe public SaaS for Nepal-market retailers and suppliers, with authenticated tenant membership, tenant-scoped data access, real order confirmation and save flow, and production runtime boundaries.

**Architecture:** Keep the current Express + Prisma + Next.js shape, but introduce a shared-database/shared-schema multi-tenant model with explicit `tenantId` ownership on business records. Resolve tenant from subdomain or forwarded host, resolve the authenticated account and membership through a provider-agnostic JWT/JWKS adapter, and route all business operations through tenant-aware services. Preserve local Ollama for development, but wrap intent classification behind a provider abstraction so public production can use hosted inference without changing orchestrator logic.

**Tech Stack:** Node.js, Express 5, Prisma 7, PostgreSQL, Next.js 16 App Router, CommonJS backend modules, Node test runner, `jose`, `express-rate-limit`

---

## File Structure

### Backend schema and data

- Modify: `backend/prisma/schema.prisma`
  - Add `Tenant`, `Account`, `TenantMembership`, `OrderDraft`, and `OrderDraftItem`
  - Add `tenantId` to all business tables
  - Convert global uniqueness to tenant-scoped uniqueness where appropriate
- Modify: `backend/src/seed/seed.js`
  - Create a default tenant, accounts, memberships, and tenant-scoped commerce data
- Create: `backend/test/tenant.seed.test.js`
  - Verify tenant/account/membership seed output and tenant-aware uniqueness assumptions

### Backend request context and auth

- Create: `backend/src/middleware/request-context.middleware.js`
  - Resolve tenant, account, membership, and user profile for each protected request
- Create: `backend/src/services/tenant.service.js`
  - Resolve tenants from hostnames, forwarded host headers, or local development fallback
- Create: `backend/src/services/auth-provider.service.js`
  - Verify bearer tokens via JWKS and support local dev header fallback
- Create: `backend/test/request-context.test.js`
  - Verify tenant resolution, membership loading, and auth failure paths

### Tenant-aware business services

- Modify: `backend/src/services/chat.service.js`
- Modify: `backend/src/services/admin.service.js`
- Modify: `backend/src/services/order.service.js`
- Modify: `backend/src/agents/product.agent.js`
- Modify: `backend/src/agents/orchestrator.js`
- Create: `backend/test/tenant-isolation.test.js`
  - Verify cross-tenant reads and writes are rejected or hidden

### Order confirmation workflow

- Create: `backend/src/services/order-draft.service.js`
  - Build, persist, summarize, and confirm order drafts
- Modify: `backend/src/services/order.service.js`
  - Confirm drafts into final orders with server-side prices only
- Modify: `backend/src/app.js`
  - Add `POST /api/orders/drafts/:draftId/confirm`
- Create: `backend/test/order-draft.service.test.js`
- Modify: `backend/test/chat.api.test.js`
- Modify: `backend/test/orchestrator.test.js`

### Frontend tenant-aware confirmation UX

- Create: `frontend/lib/chat-state.js`
  - Normalize pending order confirmation payloads for UI
- Create: `frontend/test/chat-state.test.js`
- Modify: `frontend/package.json`
  - Add a frontend test command using the Node test runner
- Modify: `frontend/app/chat/page.js`
  - Render pending order confirmation cards and confirm action
- Modify: `frontend/app/api/chat/route.js`
  - Forward auth and host headers to the backend
- Create: `frontend/app/api/orders/drafts/[draftId]/confirm/route.js`
  - Proxy order confirmation requests
- Modify: `frontend/app/admin/page.js`
  - Forward host-aware tenant context on server-side fetches

### AI abstraction and production hardening

- Create: `backend/src/services/intent-classifier.service.js`
  - Provider-agnostic intent classification entry point
- Create: `backend/src/services/providers/ollama-intent-provider.js`
  - Local development classifier
- Create: `backend/src/services/providers/http-intent-provider.js`
  - Hosted production classifier
- Modify: `backend/src/app.js`
  - Add `/readyz` and request rate limiting
- Create: `backend/test/intent-classifier.test.js`
- Create: `backend/test/readiness.test.js`

### Runtime configuration and deployment docs

- Create: `backend/src/config/runtime-config.js`
  - Validate production env vars and safe defaults
- Create: `backend/test/runtime-config.test.js`
- Modify: `backend/src/server.js`
- Modify: `.env.live.example`
- Modify: `README.md`
- Modify: `scripts/start-live.ps1`
- Modify: `scripts/stop-live.ps1`

## Assumptions

- v1 uses one shared PostgreSQL database and one shared schema with explicit tenant scoping in application code
- tenant identity is resolved from subdomain or forwarded host rather than a post-login tenant picker
- tenant onboarding and account provisioning can be handled by platform operators in the first release; self-serve signup is out of scope for this plan
- managed auth is integrated through JWT verification against a JWKS endpoint, so the backend remains provider-agnostic

## Task 1: Add Tenant Schema Foundation

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/seed/seed.js`
- Create: `backend/test/tenant.seed.test.js`
- Modify: `backend/test/seed.test.js`

- [ ] **Step 1: Write the failing seed and schema test**

```js
// backend/test/tenant.seed.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, seedDatabase } = require("../src/seed/seed");

test("seedDatabase creates a default tenant, accounts, memberships, and tenant-scoped data", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "khaacho-demo" },
    include: {
      memberships: true,
      users: true,
      products: true,
    },
  });

  assert.ok(tenant);
  assert.equal(tenant.currency, "NPR");
  assert.equal(tenant.timezone, "Asia/Kathmandu");
  assert.equal(tenant.memberships.length >= 2, true);
  assert.equal(tenant.users.length, 10);
  assert.equal(tenant.products.length, 20);

  const account = await prisma.account.findUnique({
    where: { email: "retailer.kathmandu@example.com" },
  });

  assert.ok(account);

  const membership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId: tenant.id,
      accountId: account.id,
    },
  });

  assert.ok(membership);
  assert.equal(membership.role, "RETAILER_CONTACT");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tenant.seed.test.js`

Expected: FAIL with Prisma errors such as `prisma.tenant is undefined`, `Unknown model Account`, or missing relation fields.

- [ ] **Step 3: Write the minimal schema and seed implementation**

```prisma
// backend/prisma/schema.prisma
enum TenantStatus {
  ACTIVE
  SUSPENDED
  ARCHIVED
}

enum MembershipRole {
  OWNER
  ADMIN
  STAFF
  SUPPLIER_CONTACT
  RETAILER_CONTACT
}

enum MembershipStatus {
  ACTIVE
  INVITED
  SUSPENDED
}

enum OrderDraftStatus {
  PENDING_CONFIRMATION
  CONFIRMED
  CANCELLED
  EXPIRED
}

model Tenant {
  id              String            @id @default(cuid())
  name            String
  slug            String            @unique
  status          TenantStatus      @default(ACTIVE)
  timezone        String            @default("Asia/Kathmandu")
  currency        String            @default("NPR")
  phone           String?
  billingAddress  String?
  panOrVatNumber  String?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  memberships     TenantMembership[]
  users           User[]
  products        Product[]
  orders          Order[]
  conversations   Conversation[]
  creditProfiles  CreditProfile[]
  orderDrafts     OrderDraft[]
}

model Account {
  id                String             @id @default(cuid())
  email             String             @unique
  displayName       String
  passwordHash      String?
  authSubject       String?            @unique
  isPlatformAdmin   Boolean            @default(false)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt
  memberships       TenantMembership[]
  users             User[]
}

model TenantMembership {
  id          String           @id @default(cuid())
  tenantId    String
  accountId   String
  role        MembershipRole
  status      MembershipStatus @default(ACTIVE)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  account     Account          @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([tenantId, accountId])
}

model User {
  id                String            @id @default(cuid())
  tenantId          String
  accountId         String?
  email             String
  name              String
  role              UserRole          @default(CUSTOMER)
  phone             String?
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  tenant            Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  account           Account?          @relation(fields: [accountId], references: [id], onDelete: SetNull)
  orders            Order[]
  conversations     Conversation[]
  suppliedProducts  SupplierProduct[]
  creditProfile     CreditProfile?

  @@unique([tenantId, email])
}

model Product {
  id                String            @id @default(cuid())
  tenantId          String
  name              String
  sku               String
  description       String?
  price             Decimal           @db.Decimal(10, 2)
  isActive          Boolean           @default(true)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  tenant            Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  supplierProducts  SupplierProduct[]
  orderItems        OrderItem[]
  draftItems        OrderDraftItem[]

  @@unique([tenantId, sku])
}

model OrderDraft {
  id            String           @id @default(cuid())
  tenantId      String
  userId        String
  status        OrderDraftStatus @default(PENDING_CONFIRMATION)
  sourceMessage String
  totalAmount   Decimal          @db.Decimal(10, 2)
  notes         String?
  expiresAt     DateTime
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
  tenant        Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  items         OrderDraftItem[]
}

model OrderDraftItem {
  id            String      @id @default(cuid())
  draftId       String
  productId     String
  quantity      Int
  unitPrice     Decimal     @db.Decimal(10, 2)
  packagingUnit String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  draft         OrderDraft  @relation(fields: [draftId], references: [id], onDelete: Cascade)
  product       Product     @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([draftId, productId])
}
```

```js
// backend/src/seed/seed.js
const defaultTenant = {
  name: "Khaacho Demo Tenant",
  slug: "khaacho-demo",
  currency: "NPR",
  timezone: "Asia/Kathmandu",
};

async function seedDatabase() {
  await resetDatabase();

  const tenant = await prisma.tenant.create({ data: defaultTenant });

  const accountRows = retailers.concat(suppliers).map((person) => ({
    email: person.email,
    displayName: person.name,
  }));

  await prisma.account.createMany({ data: accountRows });

  const accounts = await prisma.account.findMany();
  const accountsByEmail = new Map(accounts.map((account) => [account.email, account]));

  await prisma.user.createMany({
    data: retailers.concat(suppliers).map((person) => ({
      tenantId: tenant.id,
      accountId: accountsByEmail.get(person.email).id,
      email: person.email,
      name: person.name,
      phone: person.phone,
      role: person.role,
    })),
  });

  await prisma.tenantMembership.createMany({
    data: retailers.concat(suppliers).map((person) => ({
      tenantId: tenant.id,
      accountId: accountsByEmail.get(person.email).id,
      role: person.role === "SUPPLIER" ? "SUPPLIER_CONTACT" : "RETAILER_CONTACT",
      status: "ACTIVE",
    })),
  });

  await prisma.product.createMany({
    data: products.map((product) => ({
      tenantId: tenant.id,
      ...product,
    })),
  });
}
```

- [ ] **Step 4: Run validation and targeted tests**

Run: `npx prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`

Run: `npx prisma migrate dev --name add_multitenancy`

Expected: a new migration is created and applied successfully

Run: `node --test test/tenant.seed.test.js test/seed.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/seed/seed.js backend/test/tenant.seed.test.js backend/test/seed.test.js backend/prisma/migrations
git commit -m "feat: add tenant schema foundation"
```

## Task 2: Add Tenant Resolution and Auth Context Middleware

**Files:**
- Create: `backend/src/middleware/request-context.middleware.js`
- Create: `backend/src/services/tenant.service.js`
- Create: `backend/src/services/auth-provider.service.js`
- Modify: `backend/src/app.js`
- Create: `backend/test/request-context.test.js`

- [ ] **Step 1: Write the failing middleware test**

```js
// backend/test/request-context.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const appModule = require("../src/app");
const { prisma, seedDatabase } = require("../src/seed/seed");

test("protected routes resolve tenant, account, membership, and user from request context", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const app = appModule.createApp({
    prismaClient: prisma,
    authMode: "development-header",
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/overview`, {
      headers: {
        "x-forwarded-host": "khaacho-demo.khaacho.test",
        "x-dev-account-email": "retailer.kathmandu@example.com",
      },
    });

    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/request-context.test.js`

Expected: FAIL with `500`, `404`, or missing-tenant/auth errors because request context middleware does not exist yet.

- [ ] **Step 3: Write the minimal tenant and auth context implementation**

```js
// backend/src/services/tenant.service.js
function extractTenantSlugFromHost(rawHost) {
  const hostname = String(rawHost || "").split(":")[0].toLowerCase();
  const parts = hostname.split(".");

  if (parts.length < 3) {
    return null;
  }

  return parts[0];
}

async function resolveTenantFromRequest(request, prismaClient) {
  const forwardedHost =
    request.headers["x-forwarded-host"] ||
    request.headers.host ||
    request.headers["x-tenant-host"];
  const devSlug = request.headers["x-tenant-slug"];
  const slug = devSlug || extractTenantSlugFromHost(forwardedHost);

  if (!slug) {
    throw new Error("Tenant could not be resolved from request host.");
  }

  const tenant = await prismaClient.tenant.findUnique({
    where: { slug },
  });

  if (!tenant || tenant.status !== "ACTIVE") {
    throw new Error("Tenant not found.");
  }

  return tenant;
}

module.exports = {
  extractTenantSlugFromHost,
  resolveTenantFromRequest,
};
```

```js
// backend/src/services/auth-provider.service.js
const { createRemoteJWKSet, jwtVerify } = require("jose");

async function resolveAccountFromRequest(request, prismaClient, options = {}) {
  if (options.authMode === "development-header") {
    const email = request.headers["x-dev-account-email"];

    if (!email) {
      throw new Error("Authentication required.");
    }

    const account = await prismaClient.account.findUnique({
      where: { email: String(email) },
    });

    if (!account) {
      throw new Error("Account not found.");
    }

    return account;
  }

  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new Error("Authentication required.");
  }

  const issuer = process.env.AUTH_ISSUER;
  const jwksUrl = process.env.AUTH_JWKS_URL;
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const { payload } = await jwtVerify(token, jwks, { issuer });

  const account = await prismaClient.account.findFirst({
    where: {
      OR: [
        { authSubject: String(payload.sub) },
        { email: String(payload.email || "") },
      ],
    },
  });

  if (!account) {
    throw new Error("Account not found.");
  }

  return account;
}

module.exports = { resolveAccountFromRequest };
```

```js
// backend/src/middleware/request-context.middleware.js
const { resolveTenantFromRequest } = require("../services/tenant.service");
const { resolveAccountFromRequest } = require("../services/auth-provider.service");

function createRequestContextMiddleware(options = {}) {
  return async function requestContextMiddleware(request, response, next) {
    try {
      const prismaClient = options.prismaClient;
      const tenant = await resolveTenantFromRequest(request, prismaClient);
      const account = await resolveAccountFromRequest(request, prismaClient, options);
      const membership = await prismaClient.tenantMembership.findFirst({
        where: {
          tenantId: tenant.id,
          accountId: account.id,
          status: "ACTIVE",
        },
      });

      if (!membership) {
        response.status(403).json({ error: "Membership not found." });
        return;
      }

      const user = await prismaClient.user.findFirst({
        where: {
          tenantId: tenant.id,
          accountId: account.id,
        },
      });

      request.context = {
        tenant,
        account,
        membership,
        user,
      };

      next();
    } catch (error) {
      const statusCode =
        error.message === "Tenant not found." ? 404 :
        error.message === "Authentication required." ? 401 :
        error.message === "Account not found." ? 401 : 400;

      response.status(statusCode).json({ error: error.message });
    }
  };
}

module.exports = { createRequestContextMiddleware };
```

```js
// backend/src/app.js
const { createRequestContextMiddleware } = require("./middleware/request-context.middleware");

function createApp(options = {}) {
  const app = express();
  const requestContextMiddleware = createRequestContextMiddleware(options);

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use("/api/admin", requestContextMiddleware);
  app.use("/api/chat", requestContextMiddleware);
}
```

- [ ] **Step 4: Run the targeted middleware tests**

Run: `npm install jose`

Expected: install completes and `package-lock.json` updates

Run: `node --test test/request-context.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/request-context.middleware.js backend/src/services/tenant.service.js backend/src/services/auth-provider.service.js backend/src/app.js backend/test/request-context.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add tenant request context middleware"
```

## Task 3: Refactor Business Services for Tenant Isolation

**Files:**
- Modify: `backend/src/services/chat.service.js`
- Modify: `backend/src/services/admin.service.js`
- Modify: `backend/src/services/order.service.js`
- Modify: `backend/src/agents/product.agent.js`
- Modify: `backend/src/agents/orchestrator.js`
- Create: `backend/test/tenant-isolation.test.js`

- [ ] **Step 1: Write the failing isolation test**

```js
// backend/test/tenant-isolation.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, seedDatabase } = require("../src/seed/seed");
const { queryProductsWithSupplierPricing } = require("../src/agents/product.agent");

test("product queries only return records from the active tenant", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const firstTenant = await prisma.tenant.findUnique({
    where: { slug: "khaacho-demo" },
  });

  const secondTenant = await prisma.tenant.create({
    data: {
      name: "Second Tenant",
      slug: "second-tenant",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
    },
  });

  await prisma.product.create({
    data: {
      tenantId: secondTenant.id,
      sku: "WW-CHICK-075",
      name: "Second Tenant Wai Wai",
      price: "99.00",
    },
  });

  const result = await queryProductsWithSupplierPricing({
    tenantId: firstTenant.id,
    message: "Need Wai Wai Chicken noodles",
    prismaClient: prisma,
  });

  assert.equal(result.products[0].name, "Wai Wai Chicken Noodles 75g");
  assert.equal(
    result.products.some((product) => product.name === "Second Tenant Wai Wai"),
    false,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/tenant-isolation.test.js`

Expected: FAIL because `queryProductsWithSupplierPricing` does not yet accept or enforce `tenantId`.

- [ ] **Step 3: Write the minimal tenant-aware service changes**

```js
// backend/src/services/chat.service.js
async function handleChatMessage(options = {}) {
  const { tenantId, userId, message, orchestrator } = options;

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    throw new Error("tenantId is required.");
  }

  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("userId is required.");
  }

  const prismaClient = options.prismaClient || getDefaultPrismaClient();
  const user = await prismaClient.user.findFirst({
    where: {
      id: userId,
      tenantId,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const routeResult = await orchestrator.routeMessage(trimmedMessage, {
    tenantId,
    userId: user.id,
  });
}
```

```js
// backend/src/services/admin.service.js
async function getAdminOverview(options = {}) {
  const { tenantId } = options;
  const prismaClient = options.prismaClient || getDefaultPrismaClient();

  const [totalRetailers, totalSuppliers, totalProducts, totalOrders] = await Promise.all([
    prismaClient.user.count({ where: { tenantId, role: "CUSTOMER" } }),
    prismaClient.user.count({ where: { tenantId, role: "SUPPLIER" } }),
    prismaClient.product.count({ where: { tenantId } }),
    prismaClient.order.count({ where: { tenantId } }),
  ]);
}
```

```js
// backend/src/agents/product.agent.js
async function queryProductsWithSupplierPricing(options = {}) {
  const { tenantId, message, prismaClient } = options;

  const products = await prismaClient.product.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    include: {
      supplierProducts: {
        where: {
          tenantId,
        },
        include: {
          supplier: true,
        },
      },
    },
  });
}
```

```js
// backend/src/services/order.service.js
const user = await transaction.user.findFirst({
  where: {
    id: input.userId,
    tenantId: input.tenantId,
  },
});

const products = await transaction.product.findMany({
  where: {
    tenantId: input.tenantId,
    id: { in: productIds },
    isActive: true,
  },
});
```

```js
// backend/src/agents/orchestrator.js
const agentPayload = {
  tenantId: options.tenantId,
  userId: options.userId,
  message: userMessage.trim(),
  intent: agentIntent,
  originalIntent: classification.intent,
  classification,
  prismaClient: options.prismaClient,
};
```

- [ ] **Step 4: Run targeted and full backend tests**

Run: `node --test test/tenant-isolation.test.js test/chat.api.test.js test/admin.api.test.js test/product.agent.test.js test/order.service.test.js`

Expected: PASS

Run: `npm test`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/chat.service.js backend/src/services/admin.service.js backend/src/services/order.service.js backend/src/agents/product.agent.js backend/src/agents/orchestrator.js backend/test/tenant-isolation.test.js backend/test/chat.api.test.js backend/test/admin.api.test.js backend/test/product.agent.test.js backend/test/order.service.test.js
git commit -m "feat: enforce tenant isolation in services"
```

## Task 4: Implement Real Order Draft and Confirmation Flow

**Files:**
- Create: `backend/src/services/order-draft.service.js`
- Modify: `backend/src/services/order.service.js`
- Modify: `backend/src/agents/orchestrator.js`
- Modify: `backend/src/services/chat.service.js`
- Modify: `backend/src/app.js`
- Create: `backend/test/order-draft.service.test.js`
- Modify: `backend/test/orchestrator.test.js`
- Modify: `backend/test/chat.api.test.js`

- [ ] **Step 1: Write the failing order-draft test**

```js
// backend/test/order-draft.service.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { prisma, seedDatabase } = require("../src/seed/seed");
const {
  createOrderDraftFromMessage,
  confirmOrderDraft,
} = require("../src/services/order-draft.service");

test("createOrderDraftFromMessage stores a confirmation-required draft with server-side totals", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "khaacho-demo" },
  });
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: "retailer.kathmandu@example.com",
    },
  });

  const draft = await createOrderDraftFromMessage({
    tenantId: tenant.id,
    userId: user.id,
    message: "I need 2 Wai Wai Chicken noodles and 1 Coke 500ml",
    prismaClient: prisma,
  });

  assert.equal(draft.status, "PENDING_CONFIRMATION");
  assert.equal(draft.items.length, 2);
  assert.equal(draft.totalAmount, "110.00");
});

test("confirmOrderDraft persists the final order and marks the draft confirmed", async (t) => {
  t.after(async () => {
    await prisma.$disconnect();
  });

  await seedDatabase();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: "khaacho-demo" },
  });
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: "retailer.kathmandu@example.com",
    },
  });

  const draft = await createOrderDraftFromMessage({
    tenantId: tenant.id,
    userId: user.id,
    message: "I need 2 Wai Wai Chicken noodles and 1 Coke 500ml",
    prismaClient: prisma,
  });

  const order = await confirmOrderDraft({
    tenantId: tenant.id,
    draftId: draft.id,
    userId: user.id,
    prismaClient: prisma,
  });

  assert.equal(order.status, "CONFIRMED");
  assert.equal(order.totalAmount, "110.00");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/order-draft.service.test.js`

Expected: FAIL because `order-draft.service.js` does not exist.

- [ ] **Step 3: Write the minimal order draft implementation**

```js
// backend/src/services/order-draft.service.js
const { queryProductsWithSupplierPricing } = require("../agents/product.agent");
const { createOrder } = require("./order.service");

function extractRequestedLineItems(message, matchedProducts) {
  const normalizedMessage = message.toLowerCase();

  return matchedProducts.slice(0, 3).map((product) => {
    const quantityMatch = normalizedMessage.match(new RegExp(`(\\d+)\\s+.*${product.sku.toLowerCase()}`));
    const quantity = quantityMatch ? Number.parseInt(quantityMatch[1], 10) : 1;

    return {
      productId: product.productId,
      quantity,
      packagingUnit: "unit",
    };
  });
}

async function createOrderDraftFromMessage(options = {}) {
  const { tenantId, userId, message, prismaClient } = options;
  const queryResult = await queryProductsWithSupplierPricing({
    tenantId,
    message,
    prismaClient,
  });

  const lineItems = extractRequestedLineItems(message, queryResult.products);

  if (lineItems.length === 0) {
    return {
      agentName: "create-order-agent",
      status: "no_match",
      confirmationRequired: false,
      items: [],
    };
  }

  const products = await prismaClient.product.findMany({
    where: {
      tenantId,
      id: {
        in: lineItems.map((item) => item.productId),
      },
    },
  });

  const productById = new Map(products.map((product) => [product.id, product]));
  const totalAmount = lineItems.reduce((total, item) => {
    const product = productById.get(item.productId);
    return total + Number.parseFloat(product.price.toString()) * item.quantity;
  }, 0);

  const draft = await prismaClient.orderDraft.create({
    data: {
      tenantId,
      userId,
      sourceMessage: message,
      totalAmount: totalAmount.toFixed(2),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      items: {
        create: lineItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: productById.get(item.productId).price.toString(),
          packagingUnit: item.packagingUnit,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  return {
    agentName: "create-order-agent",
    status: "needs_confirmation",
    confirmationRequired: true,
    draftId: draft.id,
    totalAmount: draft.totalAmount.toString(),
    items: draft.items.map((item) => ({
      productId: item.productId,
      sku: item.product.sku,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
    })),
  };
}

async function confirmOrderDraft(options = {}) {
  const { tenantId, draftId, userId, prismaClient } = options;
  const draft = await prismaClient.orderDraft.findFirst({
    where: {
      id: draftId,
      tenantId,
      userId,
      status: "PENDING_CONFIRMATION",
    },
    include: { items: true },
  });

  const order = await createOrder({
    tenantId,
    userId,
    confirmed: true,
    items: draft.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    prismaClient,
  });

  await prismaClient.orderDraft.update({
    where: { id: draftId },
    data: { status: "CONFIRMED" },
  });

  return order;
}

module.exports = {
  createOrderDraftFromMessage,
  confirmOrderDraft,
};
```

```js
// backend/src/agents/orchestrator.js
const { createOrderDraftFromMessage } = require("../services/order-draft.service");

CREATE_ORDER: async ({ tenantId, userId, message, prismaClient }) =>
  createOrderDraftFromMessage({
    tenantId,
    userId,
    message,
    prismaClient,
  }),
```

```js
// backend/src/services/chat.service.js
if (routeResult.agentIntent === "CREATE_ORDER") {
  const agentResult = routeResult.agentResult;

  if (agentResult.status === "needs_confirmation") {
    const itemsSummary = agentResult.items
      .map((item) => `${item.quantity} x ${item.name}`)
      .join(", ");

    return `Order draft ready: ${itemsSummary}. Total NPR ${formatMoney(agentResult.totalAmount)}. Confirm to save this order.`;
  }
}
```

```js
// backend/src/app.js
const { confirmOrderDraft } = require("./services/order-draft.service");

app.post("/api/orders/drafts/:draftId/confirm", async (request, response) => {
  try {
    const result = await confirmOrderDraft({
      tenantId: request.context.tenant.id,
      userId: request.context.user.id,
      draftId: request.params.draftId,
      prismaClient: options.prismaClient,
    });

    response.status(200).json(result);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});
```

- [ ] **Step 4: Run targeted draft and chat tests**

Run: `node --test test/order-draft.service.test.js test/orchestrator.test.js test/chat.api.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/order-draft.service.js backend/src/services/order.service.js backend/src/agents/orchestrator.js backend/src/services/chat.service.js backend/src/app.js backend/test/order-draft.service.test.js backend/test/orchestrator.test.js backend/test/chat.api.test.js
git commit -m "feat: add order draft confirmation flow"
```

## Task 5: Update Frontend for Tenant-Aware Chat and Order Confirmation

**Files:**
- Create: `frontend/lib/chat-state.js`
- Create: `frontend/test/chat-state.test.js`
- Modify: `frontend/package.json`
- Modify: `frontend/app/chat/page.js`
- Modify: `frontend/app/api/chat/route.js`
- Create: `frontend/app/api/orders/drafts/[draftId]/confirm/route.js`
- Modify: `frontend/app/admin/page.js`

- [ ] **Step 1: Write the failing frontend state test**

```js
// frontend/test/chat-state.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { getPendingOrderConfirmation } = require("../lib/chat-state");

test("getPendingOrderConfirmation extracts a pending order draft from chat payload", () => {
  const payload = {
    route: {
      agentIntent: "CREATE_ORDER",
    },
    data: {
      status: "needs_confirmation",
      confirmationRequired: true,
      draftId: "draft_123",
      totalAmount: "110.00",
      items: [
        { name: "Wai Wai Chicken Noodles 75g", quantity: 2 },
        { name: "Coca-Cola PET Bottle 500ml", quantity: 1 },
      ],
    },
  };

  assert.deepEqual(getPendingOrderConfirmation(payload), {
    draftId: "draft_123",
    totalAmount: "110.00",
    itemCount: 2,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/chat-state.test.js`

Expected: FAIL because `frontend/lib/chat-state.js` does not exist.

- [ ] **Step 3: Write the minimal frontend implementation**

```js
// frontend/lib/chat-state.js
function getPendingOrderConfirmation(payload) {
  if (
    payload?.route?.agentIntent !== "CREATE_ORDER" ||
    payload?.data?.status !== "needs_confirmation" ||
    payload?.data?.confirmationRequired !== true
  ) {
    return null;
  }

  return {
    draftId: payload.data.draftId,
    totalAmount: payload.data.totalAmount,
    itemCount: payload.data.items.length,
  };
}

module.exports = {
  getPendingOrderConfirmation,
};
```

```js
// frontend/app/api/chat/route.js
export async function POST(request) {
  const forwardedHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const authorization = request.headers.get("authorization");

  const response = await fetch(`${getBackendBaseUrl()}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-host": forwardedHost,
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
```

```js
// frontend/app/api/orders/drafts/[draftId]/confirm/route.js
import { getBackendBaseUrl } from "../../../../../lib/backend-base-url";

export async function POST(request, { params }) {
  const forwardedHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "";
  const authorization = request.headers.get("authorization");

  const response = await fetch(
    `${getBackendBaseUrl()}/api/orders/drafts/${params.draftId}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-host": forwardedHost,
        ...(authorization ? { authorization } : {}),
      },
      cache: "no-store",
    },
  );

  const responseText = await response.text();

  return new Response(responseText, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/json",
    },
  });
}
```

```js
// frontend/app/chat/page.js
const [pendingConfirmation, setPendingConfirmation] = useState(null);

const normalizedPendingOrder = useMemo(
  () => getPendingOrderConfirmation(lastResponse),
  [lastResponse],
);

useEffect(() => {
  setPendingConfirmation(normalizedPendingOrder);
}, [normalizedPendingOrder]);

async function handleConfirmOrder() {
  if (!pendingConfirmation) {
    return;
  }

  const response = await fetch(
    `/api/orders/drafts/${pendingConfirmation.draftId}/confirm`,
    { method: "POST" },
  );

  const payload = await response.json();

  setTranscript((current) => [
    ...current,
    {
      role: "assistant",
      text: `Order saved successfully. Total NPR ${payload.totalAmount}.`,
      intent: "CREATE_ORDER",
    },
  ]);
  setPendingConfirmation(null);
}
```

```json
// frontend/package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "node --test"
  }
}
```

- [ ] **Step 4: Run frontend tests and build**

Run: `npm test`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/chat-state.js frontend/test/chat-state.test.js frontend/package.json frontend/package-lock.json frontend/app/chat/page.js frontend/app/api/chat/route.js frontend/app/api/orders/drafts/[draftId]/confirm/route.js frontend/app/admin/page.js
git commit -m "feat: add tenant-aware order confirmation ui"
```

## Task 6: Add Provider-Abstraction for Intent Classification and Readiness Checks

**Files:**
- Create: `backend/src/services/intent-classifier.service.js`
- Create: `backend/src/services/providers/ollama-intent-provider.js`
- Create: `backend/src/services/providers/http-intent-provider.js`
- Modify: `backend/src/agents/orchestrator.js`
- Modify: `backend/src/app.js`
- Create: `backend/test/intent-classifier.test.js`
- Create: `backend/test/readiness.test.js`

- [ ] **Step 1: Write the failing provider abstraction test**

```js
// backend/test/intent-classifier.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { createIntentClassifier } = require("../src/services/intent-classifier.service");

test("createIntentClassifier falls back to UNKNOWN when provider throws", async () => {
  const classifier = createIntentClassifier({
    provider: {
      async classifyIntent() {
        throw new Error("provider unavailable");
      },
      async healthCheck() {
        return { ok: false };
      },
    },
  });

  const result = await classifier.classifyIntent("Need Wai Wai");

  assert.deepEqual(result, {
    intent: "UNKNOWN",
    confidence: "low",
    needsClarification: true,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/intent-classifier.test.js`

Expected: FAIL because the classifier abstraction file does not exist.

- [ ] **Step 3: Write the minimal provider abstraction and readiness implementation**

```js
// backend/src/services/intent-classifier.service.js
function createIntentClassifier(options = {}) {
  const provider = options.provider;

  if (!provider || typeof provider.classifyIntent !== "function") {
    throw new Error("A classifier provider is required.");
  }

  return {
    async classifyIntent(message) {
      try {
        return await provider.classifyIntent(message);
      } catch {
        return {
          intent: "UNKNOWN",
          confidence: "low",
          needsClarification: true,
        };
      }
    },
    async healthCheck() {
      if (typeof provider.healthCheck !== "function") {
        return { ok: true, provider: "unknown" };
      }

      return provider.healthCheck();
    },
  };
}

module.exports = { createIntentClassifier };
```

```js
// backend/src/services/providers/ollama-intent-provider.js
const { classifyIntent, INTENT_SCHEMA, MODEL_NAME } = require("../ollama.service");

function createOllamaIntentProvider() {
  return {
    async classifyIntent(message) {
      return classifyIntent(message);
    },
    async healthCheck() {
      return {
        ok: true,
        provider: "ollama",
        model: MODEL_NAME,
        schema: INTENT_SCHEMA.type,
      };
    },
  };
}

module.exports = { createOllamaIntentProvider };
```

```js
// backend/src/services/providers/http-intent-provider.js
function createHttpIntentProvider(options = {}) {
  const endpoint = options.endpoint || process.env.INTENT_API_URL;

  return {
    async classifyIntent(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.INTENT_API_KEY}`,
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Intent provider failed with ${response.status}`);
      }

      return response.json();
    },
    async healthCheck() {
      return { ok: Boolean(endpoint), provider: "http" };
    },
  };
}

module.exports = { createHttpIntentProvider };
```

```js
// backend/src/app.js
const rateLimit = require("express-rate-limit");

app.use(express.json({ limit: "1mb" }));
app.use("/api/chat", rateLimit({ windowMs: 60_000, max: 60 }));

app.get("/readyz", async (_request, response) => {
  try {
    await options.prismaClient.$queryRaw`SELECT 1`;
    const classifierHealth = await options.intentClassifier.healthCheck();

    if (!classifierHealth.ok) {
      response.status(503).json({ status: "degraded", classifierHealth });
      return;
    }

    response.status(200).json({ status: "ok", classifierHealth });
  } catch (error) {
    response.status(503).json({ status: "degraded", error: error.message });
  }
});
```

```js
// backend/src/agents/orchestrator.js
async function orchestrateMessage(userMessage, options = {}) {
  const classifier =
    options.intentClassifier ||
    createIntentClassifier({ provider: options.intentProvider });

  const classification = await classifier.classifyIntent(userMessage.trim());
}
```

- [ ] **Step 4: Run provider and readiness tests**

Run: `npm install express-rate-limit`

Expected: install completes and lockfile updates

Run: `node --test test/intent-classifier.test.js test/readiness.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/intent-classifier.service.js backend/src/services/providers/ollama-intent-provider.js backend/src/services/providers/http-intent-provider.js backend/src/agents/orchestrator.js backend/src/app.js backend/test/intent-classifier.test.js backend/test/readiness.test.js backend/package.json backend/package-lock.json
git commit -m "feat: add production intent provider abstraction"
```

## Task 7: Harden Runtime Configuration and Deployment Validation

**Files:**
- Create: `backend/src/config/runtime-config.js`
- Create: `backend/test/runtime-config.test.js`
- Modify: `backend/src/server.js`
- Modify: `.env.live.example`
- Modify: `README.md`
- Modify: `scripts/start-live.ps1`
- Modify: `scripts/stop-live.ps1`

- [ ] **Step 1: Write the failing runtime-config test**

```js
// backend/test/runtime-config.test.js
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadRuntimeConfig } = require("../src/config/runtime-config");

test("loadRuntimeConfig requires auth and tenant env vars in production mode", () => {
  assert.throws(
    () =>
      loadRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/test",
      }),
    /AUTH_ISSUER is required in production\./,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/runtime-config.test.js`

Expected: FAIL because `runtime-config.js` does not exist.

- [ ] **Step 3: Write the minimal runtime config and docs implementation**

```js
// backend/src/config/runtime-config.js
function loadRuntimeConfig(source = process.env) {
  const config = {
    nodeEnv: source.NODE_ENV || "development",
    databaseUrl: source.DATABASE_URL,
    authIssuer: source.AUTH_ISSUER || "",
    authJwksUrl: source.AUTH_JWKS_URL || "",
    intentProvider: source.INTENT_PROVIDER || "ollama",
    intentApiUrl: source.INTENT_API_URL || "",
    baseDomain: source.BASE_DOMAIN || "localhost",
    cookieDomain: source.COOKIE_DOMAIN || "",
  };

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (config.nodeEnv === "production") {
    if (!config.authIssuer) {
      throw new Error("AUTH_ISSUER is required in production.");
    }

    if (!config.authJwksUrl) {
      throw new Error("AUTH_JWKS_URL is required in production.");
    }

    if (!config.baseDomain) {
      throw new Error("BASE_DOMAIN is required in production.");
    }
  }

  return config;
}

module.exports = { loadRuntimeConfig };
```

```js
// backend/src/server.js
const { loadRuntimeConfig } = require("./config/runtime-config");

dotenv.config();
loadRuntimeConfig();

const PORT = Number.parseInt(process.env.PORT || "5000", 10);
const HOST = process.env.HOST || "0.0.0.0";
```

```env
# .env.live.example
POSTGRES_DB=khaacho_commerce_agent_os
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
BASE_DOMAIN=khaacho.com
COOKIE_DOMAIN=.khaacho.com
AUTH_ISSUER=https://your-auth-provider.example.com/
AUTH_JWKS_URL=https://your-auth-provider.example.com/.well-known/jwks.json
INTENT_PROVIDER=http
INTENT_API_URL=https://your-inference-endpoint.example.com/classify-intent
FRONTEND_PORT=3000
```

```md
<!-- README.md -->
## Production prerequisites

- wildcard DNS for `*.khaacho.com`
- wildcard TLS certificate
- managed Postgres
- managed auth issuer with JWKS endpoint
- hosted intent-classification endpoint or explicitly approved self-hosted inference

## Production tenant routing

Tenant requests are resolved from subdomains such as `acme.khaacho.com`.
The frontend proxy must forward `x-forwarded-host` to the backend.
```

```powershell
# scripts/start-live.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\start-live.ps1 -FrontendPort 3000
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5000/readyz"
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/admin" -Headers @{
  "x-forwarded-host" = "khaacho-demo.khaacho.test"
  "x-dev-account-email" = "retailer.kathmandu@example.com"
}
```

- [ ] **Step 4: Run config tests and full verification**

Run: `node --test test/runtime-config.test.js`

Expected: PASS

Run: `npm test`

Expected: PASS

Run: `npm run build`

Expected: PASS

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\start-live.ps1`

Expected: stack boots locally and `/readyz` plus `/health` return `200`

- [ ] **Step 5: Commit**

```bash
git add backend/src/config/runtime-config.js backend/test/runtime-config.test.js backend/src/server.js .env.live.example README.md scripts/start-live.ps1 scripts/stop-live.ps1
git commit -m "chore: harden production runtime configuration"
```

## Plan Self-Review

### Spec coverage

- Tenant schema, account identity, and membership: covered in Task 1
- Tenant request resolution and auth boundary: covered in Task 2
- Tenant isolation across services and agents: covered in Task 3
- Real order confirmation and save flow: covered in Task 4
- Frontend confirmation UX and host forwarding: covered in Task 5
- AI abstraction and readiness: covered in Task 6
- Production config and deployment validation: covered in Task 7

No spec sections are unassigned.

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain
- Every task contains concrete files, code snippets, run commands, and commit commands

### Type consistency

- Tenant context uses `tenantId`, `account`, `membership`, and `user` consistently across all tasks
- Intent classification abstraction uses the same `classifyIntent()` interface in all affected tasks
- Order flow uses `OrderDraft` and `confirmOrderDraft()` consistently across backend and frontend tasks

No naming contradictions remain.
