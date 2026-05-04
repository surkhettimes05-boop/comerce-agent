import { getBackendBaseUrl } from "../../../../lib/backend-base-url";

export async function GET() {
  const response = await fetch(`${getBackendBaseUrl()}/api/admin/catalog`, {
    cache: "no-store",
  });
  const responseText = await response.text();

  return new Response(responseText, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") || "application/json",
    },
  });
}
