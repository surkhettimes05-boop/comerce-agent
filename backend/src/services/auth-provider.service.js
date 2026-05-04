async function resolveDevelopmentAccount(request, prismaClient) {
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

async function resolveJwtAccount(request, prismaClient) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    throw new Error("Authentication required.");
  }

  const issuer = process.env.AUTH_ISSUER;
  const jwksUrl = process.env.AUTH_JWKS_URL;

  if (!issuer || !jwksUrl) {
    throw new Error("Authentication provider is not configured.");
  }

  const { createRemoteJWKSet, jwtVerify } = require("jose");
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

async function resolveAccountFromRequest(request, prismaClient, options = {}) {
  if (options.authMode === "development-header") {
    return resolveDevelopmentAccount(request, prismaClient);
  }

  return resolveJwtAccount(request, prismaClient);
}

module.exports = { resolveAccountFromRequest };
