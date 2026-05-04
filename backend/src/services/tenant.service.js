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
    request.headers["x-tenant-host"] ||
    request.headers.host;
  const devSlug = request.headers["x-tenant-slug"];
  const slug = devSlug || extractTenantSlugFromHost(forwardedHost);

  if (!slug) {
    throw new Error("Tenant could not be resolved from request host.");
  }

  const tenant = await prismaClient.tenant.findUnique({
    where: { slug: String(slug) },
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
