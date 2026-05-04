import { getBackendBaseUrl } from "../../../../lib/backend-base-url";

export async function POST(request) {
  const body = await request.json();
  const response = await fetch(`${getBackendBaseUrl()}/api/admin/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
