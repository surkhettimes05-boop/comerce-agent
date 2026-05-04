import { getBackendBaseUrl } from "../../../lib/backend-base-url";
import CatalogAdminClient from "./catalog-client";

export const dynamic = "force-dynamic";

async function loadCatalog() {
  const response = await fetch(`${getBackendBaseUrl()}/api/admin/catalog`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      products: [],
      suppliers: [],
      loadError: "Unable to load catalog.",
    };
  }

  return response.json();
}

export default async function CatalogAdminPage() {
  const catalog = await loadCatalog();

  return <CatalogAdminClient initialCatalog={catalog} />;
}
