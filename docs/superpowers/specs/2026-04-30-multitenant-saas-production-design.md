# Multi-Tenant SaaS Production Design

**Date:** 2026-04-30

**Status:** Approved in chat, documented for implementation planning

## Goal

Turn the current single-tenant Khaacho Commerce Agent OS into a production-ready multi-tenant SaaS for Nepal-market retailers and suppliers, with strict tenant isolation, tenant-aware identity and authorization, and a deployable production boundary for the commerce and agent workflows.

## Current State

The current codebase is a single-tenant Express + Prisma backend with a Next.js frontend. Product search, supplier-price comparison, admin metrics, chat orchestration, and seeded Nepal-focused demo data are working locally. However, business data is global, tenant isolation does not exist, and the `CREATE_ORDER` orchestration path is still a confirmation placeholder rather than an end-to-end order save flow.

## Scope

This design covers:

- tenant-aware schema and request boundaries
- tenant-aware authentication and authorization shape
- production routing model
- Nepal-market product and workflow assumptions
- production runtime and AI service boundaries
- the first production release target

This design does not cover:

- custom domains in v1
- cross-tenant marketplaces
- complex workflow engines
- advanced fulfillment integrations
- full billing/subscription implementation

## Product Shape

The target product is a multi-tenant SaaS where each tenant is an independent company. Each tenant has its own:

- users and memberships
- retailers and suppliers
- catalog and supplier pricing
- orders
- conversations
- credit profiles
- admin dashboard and operational data

No business record is shared across tenants in v1.

## Tenant Resolution

### Recommendation

Use tenant subdomains as the primary production model.

Example:

- `acme.khaacho.com`
- `everest-wholesale.khaacho.com`

### Why

- tenant identity is resolved before business logic
- company-specific portals fit the expected B2B experience
- cookie/session behavior is easier to reason about
- support, debugging, and auditing are simpler than a shared post-login tenant picker

### V1 Rule

Every production request resolves a tenant from the hostname. If the tenant slug is missing, unknown, inactive, or suspended, the request is rejected before any business query runs.

### Future Compatibility

The data model should be ready to support custom domains later, but custom-domain routing is out of scope for v1.

## Identity and Authorization Model

### Recommendation

Use a global `Account` identity with tenant-scoped membership instead of relying on a tenant-scoped `User.email` as the login boundary.

### Core Models

#### `Tenant`

Represents one customer company.

Suggested fields:

- `id`
- `name`
- `slug`
- `status`
- `timezone`
- `currency`
- `phone`
- `billingAddress`
- `panOrVatNumber`
- `createdAt`
- `updatedAt`

#### `Account`

Global authenticated identity.

Suggested fields:

- `id`
- `email`
- `passwordHash` or external provider subject
- `displayName`
- `isPlatformAdmin`
- `createdAt`
- `updatedAt`

#### `TenantMembership`

Connects an `Account` to a `Tenant`.

Suggested fields:

- `id`
- `tenantId`
- `accountId`
- `role`
- `status`
- `createdAt`
- `updatedAt`

### Membership Roles

V1 role set:

- `OWNER`
- `ADMIN`
- `STAFF`
- `SUPPLIER_CONTACT`
- `RETAILER_CONTACT`

### Business Profile Shape

The existing `User` table should become a tenant-scoped business/contact profile linked to an `Account` where appropriate.

This preserves the difference between:

- authentication identity
- tenant membership and role
- business contact profile

### Authorization Rule

Every protected request must carry:

- resolved `tenant`
- authenticated `account`
- active `membership`

If any of those are missing, the request is rejected before business logic executes.

## Tenant Data Isolation

### Recommendation

Every business table becomes tenant-scoped with an explicit `tenantId`.

### Tables to Scope

- `User`
- `Product`
- `SupplierProduct`
- `Order`
- `OrderItem` through `Order` and `Product`, plus direct tenant checks where useful
- `Conversation`
- `CreditProfile`

### Isolation Rule

Every service and agent query must require `tenantId`.

Queries must never rely on naked IDs alone. Records from another tenant should be treated as not found rather than exposed with authorization details.

### Uniqueness Changes

Global uniqueness should become tenant-aware where appropriate.

Examples:

- `Product`: `@@unique([tenantId, sku])`
- tenant contact profile: `@@unique([tenantId, email])`
- supplier product relationships: tenant-safe composite uniqueness

### Query Discipline

The application should not allow raw Prisma queries in route handlers that bypass tenant filters. Business logic should flow through tenant-aware service boundaries.

## Backend Request Boundary

### Middleware Context

Add request middleware that resolves and attaches:

- `tenant`
- `account`
- `membership`
- `role`

### Request Flow

1. resolve tenant from hostname
2. authenticate account
3. load active membership for `(tenantId, accountId)`
4. attach request context
5. call tenant-aware service

### Route Rule

Route handlers must not perform cross-tenant lookups. Route code should call services that require tenant context explicitly.

## Order Flow

### Current Gap

`CREATE_ORDER` in the orchestrator is still a placeholder that returns a confirmation-required reply and does not call the real order service.

### Production Requirement

The order flow must become end to end:

1. detect order intent
2. resolve intended products and quantities
3. present a confirmation payload
4. save the order only after explicit confirmation
5. persist order items and conversation history within the tenant

### V1 Constraint

Do not let the LLM invent prices or totals. Product and pricing values must be loaded from tenant-scoped database records.

### Confirmation Rule

Order persistence requires an explicit confirmation flag, not an inferred conversational guess.

## AI and Agent Boundary

### Recommendation

Keep a provider abstraction for intent classification.

### Why

The current local Ollama dependency is suitable for development and internal demos, but it is a weak production dependency for public SaaS unless dedicated inference infrastructure is operated.

### V1 Provider Shape

Use a single interface such as:

- `classifyIntent(message, tenantContext, requestContext)`

Implementations:

- local development adapter for Ollama
- production adapter for a managed model or hosted inference service

### Production Behavior

- `temperature: 0`
- strict schema validation
- request timeout
- bounded retries
- fallback to `UNKNOWN`
- structured logging without unnecessary message-body leakage
- per-tenant rate limiting

### Scope Control

The LLM should remain narrow in responsibility for v1. Deterministic order, pricing, and authorization logic must remain in application code and the database layer.

## Nepal-Market Production Recommendations

The product should favor the operating reality of Nepal's B2B commerce market.

### Grounding

Nepal Rastra Bank payment-system indicators show strong wallet and mobile-banking penetration, which supports a mobile-first SaaS approach for retailer and supplier users. Official provider documentation exists for eSewa, Khalti, and Fonepay, which supports a payment-adapter design rather than hardcoding one gateway.

References:

- [NRB payment indicators](https://www.nrb.org.np/psd/payment-systems-indicators-of-2082-asoj/)
- [eSewa developer docs](https://developer.esewa.com.np/)
- [Khalti docs](https://docs.khalti.com/)
- [Fonepay overview](https://www.fonepay.com/public/about)

### V1 Market-Fit Recommendations

- use `NPR` only in v1
- default all time behavior to `Asia/Kathmandu`
- keep the UI mobile-first
- optimize for product discovery, price comparison, order confirmation, order tracking, and credit visibility before full payment workflows
- support business metadata relevant to Nepal such as PAN/VAT-style details and invoicing fields
- evolve product search toward local aliases, romanized naming, and supplier naming inconsistencies
- strengthen the credit workflow because wholesale commerce often depends on credit-aware ordering
- support packaging-aware ordering concepts such as cartons, sacks, crates, and pieces rather than generic item counts only

### Payment Recommendation

Do not make payment gateway integration the blocker for first production release.

Instead:

- keep the payment service behind an adapter boundary
- design for eSewa, Khalti, and Fonepay integration
- ship the core tenant-safe commerce workflow first

## Frontend Behavior

### V1 Requirements

- derive tenant context from subdomain or resolved server context
- keep chat and admin data tenant-aware
- support explicit order confirmation in the chat/order flow
- preserve a mobile-first layout for retailer and supplier operators

### UX Rules

- never show data from another tenant
- avoid forcing users to choose a tenant after login when subdomain already defines it
- surface clear confirmation before order save
- show pricing and availability sourced from the database, not model text alone

## Runtime and Deployment

### Recommendation

Use managed infrastructure for the public SaaS production cut where possible.

### Suggested V1 Production Stack

- managed Postgres
- managed authentication
- hosted or managed model inference
- application hosting with support for wildcard subdomains
- HTTPS for tenant subdomains

### Local and Demo Runtime

Retain the current host-based and Docker-based scripts for local development and internal validation.

### Operational Controls

Production should include:

- wildcard DNS and SSL for tenant subdomains
- request logging with tenant identifiers
- audit-friendly order and conversation records
- basic rate limiting on public APIs
- health endpoints for platform monitoring
- environment-specific provider selection for AI services

## Security Rules

V1 must enforce:

- tenant-aware authorization on every protected route
- no cross-tenant data access by raw ID
- generic not-found behavior for out-of-tenant records
- no reliance on client-supplied prices
- explicit order confirmation before save
- minimized secret exposure in logs

## Out of Scope for V1

- cross-tenant marketplace data sharing
- custom domains
- advanced workflow engines
- complex supplier integrations
- subscription billing engine
- multilingual NLP expansion beyond the initial search/alias strategy

## First Production Release Definition

The first production release is considered complete when all of the following are true:

- tenant subdomain routing works
- tenant-aware schema is migrated and seeded
- account and membership boundaries exist
- every business query and write path is tenant-scoped
- `CREATE_ORDER` is fully wired through confirmation into the real order service
- chat, admin, product search, and price comparison are tenant-safe
- local Ollama is no longer the only production AI dependency
- the application is deployable to a public SaaS environment with wildcard subdomain support

## Recommended Implementation Order

1. introduce tenant, account, and membership schema
2. migrate existing business tables to tenant scope
3. add tenant-resolution and auth context middleware
4. refactor services and agents to require tenant context
5. wire the real order-confirmation and order-save flow
6. update frontend flows for tenant-aware order confirmation
7. add provider abstraction for production AI inference
8. harden deployment/runtime configuration

## Risks

- retrofitting tenant isolation after a global schema always carries migration and query-regression risk
- identity refactoring touches most business flows
- order confirmation needs deterministic parsing rules if conversational ordering is used
- wildcard subdomain hosting and auth cookie behavior need deliberate deployment testing
- local-model assumptions can hide production latency and reliability issues

## Final Recommendation

Build the first public version as a strict multi-tenant SaaS with:

- tenant subdomains
- global account identity plus tenant membership
- explicit tenant ownership on all business data
- mobile-first Nepal-market workflows
- deterministic database-backed ordering and pricing logic
- managed production infrastructure for auth, database, and model inference

This is the smallest production shape that is technically defensible, favorable to the Nepal B2B commerce market, and aligned with the current product direction.
