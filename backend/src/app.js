const express = require("express");
const cors = require("cors");
const { createOrchestrator } = require("./agents/orchestrator");
const { handleChatMessage } = require("./services/chat.service");
const {
  getAdminOverview,
  getCatalogFeed,
  upsertProduct,
  upsertSupplier,
  upsertSupplierRate,
} = require("./services/admin.service");
const {
  importCatalogRows,
  parseCatalogImportText,
} = require("./services/catalog-import-agent.service");
const { generateGrowthCampaigns } = require("./services/growth-agent.service");
const { confirmOrderDraft } = require("./services/order-draft.service");
const {
  getWebhookVerification,
  handleWhatsAppWebhook,
} = require("./services/whatsapp.service");
const { createRequestContextMiddleware } = require("./middleware/request-context.middleware");

function createApp(options = {}) {
  const app = express();
  const orchestrator = options.orchestrator || createOrchestrator({
    prismaClient: options.prismaClient,
  });

  app.use(cors());
  app.use(express.json());

  if (options.authMode || options.requireRequestContext) {
    app.use(
      "/api",
      createRequestContextMiddleware({
        authMode: options.authMode,
        prismaClient: options.prismaClient,
      }),
    );
  }

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/api/whatsapp/webhook", (request, response) => {
    try {
      const challenge = getWebhookVerification({
        mode: request.query["hub.mode"],
        token: request.query["hub.verify_token"],
        challenge: request.query["hub.challenge"],
        verifyToken: options.whatsappVerifyToken,
      });

      response.status(200).send(challenge);
    } catch (error) {
      response.status(403).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/webhook", async (request, response) => {
    try {
      const result = await handleWhatsAppWebhook({
        payload: request.body,
        orchestrator,
        prismaClient: options.prismaClient,
        tenantId: request.context?.tenant.id,
        defaultUserEmail: options.whatsappDefaultUserEmail,
        sendText: options.whatsappSendText,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/overview", async (_request, response) => {
    try {
      const result = await getAdminOverview({
        tenantId: _request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (_error) {
      response.status(500).json({ error: "Internal server error." });
    }
  });

  app.get("/api/admin/catalog", async (request, response) => {
    try {
      const result = await getCatalogFeed({
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(error.message === "Tenant not found." ? 404 : 500).json({
        error:
          error.message === "Tenant not found."
            ? error.message
            : "Internal server error.",
      });
    }
  });

  app.post("/api/admin/products", async (request, response) => {
    try {
      const result = await upsertProduct({
        ...request.body,
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/suppliers", async (request, response) => {
    try {
      const result = await upsertSupplier({
        ...request.body,
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/supplier-rates", async (request, response) => {
    try {
      const result = await upsertSupplierRate({
        ...request.body,
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      const statusCode =
        error.message === "Supplier not found." || error.message === "Product not found."
          ? 404
          : 400;

      response.status(statusCode).json({ error: error.message });
    }
  });

  app.post("/api/admin/import/preview", async (request, response) => {
    try {
      const result = parseCatalogImportText(request.body.text);

      response.status(result.errors.length > 0 ? 400 : 200).json(result);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/import/commit", async (request, response) => {
    try {
      const result = await importCatalogRows({
        rows: request.body.rows,
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
        upsertProduct,
        upsertSupplier,
        upsertSupplierRate,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/growth/campaigns", async (request, response) => {
    try {
      const result = await generateGrowthCampaigns({
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (_error) {
      response.status(500).json({ error: "Internal server error." });
    }
  });

  app.post("/api/chat", async (request, response) => {
    try {
      const result = await handleChatMessage({
        userId: request.context?.user?.id || request.body.userId,
        userEmail: request.body.userEmail,
        message: request.body.message,
        orchestrator,
        tenantId: request.context?.tenant.id,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      if (error.message === "User not found.") {
        response.status(404).json({ error: error.message });
        return;
      }

      if (
        error.message === "userId or userEmail is required." ||
        error.message === "message is required." ||
        error.message === "A valid orchestrator is required."
      ) {
        response.status(400).json({ error: error.message });
        return;
      }

      response.status(500).json({ error: "Internal server error." });
    }
  });

  app.post("/api/orders/drafts/:draftId/confirm", async (request, response) => {
    try {
      const result = await confirmOrderDraft({
        tenantId: request.context?.tenant.id || request.body.tenantId,
        userId: request.context?.user?.id || request.body.userId,
        userEmail: request.body.userEmail,
        draftId: request.params.draftId,
        prismaClient: options.prismaClient,
      });

      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({ error: error.message });
    }
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
