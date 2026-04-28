const express = require("express");
const cors = require("cors");
const { createOrchestrator } = require("./agents/orchestrator");
const { handleChatMessage } = require("./services/chat.service");
const { getAdminOverview } = require("./services/admin.service");

function createApp(options = {}) {
  const app = express();
  const orchestrator = options.orchestrator || createOrchestrator({
    prismaClient: options.prismaClient,
  });

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/api/admin/overview", async (_request, response) => {
    try {
      const result = await getAdminOverview({
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
        userId: request.body.userId,
        userEmail: request.body.userEmail,
        message: request.body.message,
        orchestrator,
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

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
