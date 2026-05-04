const { resolveAccountFromRequest } = require("../services/auth-provider.service");
const { resolveTenantFromRequest } = require("../services/tenant.service");

function contextErrorStatus(error) {
  if (error.message === "Tenant not found.") {
    return 404;
  }

  if (
    error.message === "Authentication required." ||
    error.message === "Account not found." ||
    error.message === "Authentication provider is not configured."
  ) {
    return 401;
  }

  return 400;
}

function createRequestContextMiddleware(options = {}) {
  return async function requestContextMiddleware(request, response, next) {
    try {
      const prismaClient = options.prismaClient;

      if (!prismaClient) {
        throw new Error("Prisma client is required.");
      }

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
      response.status(contextErrorStatus(error)).json({ error: error.message });
    }
  };
}

module.exports = { createRequestContextMiddleware };
