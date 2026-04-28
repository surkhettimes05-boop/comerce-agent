const DEFAULT_BACKEND_BASE_URL = "http://127.0.0.1:5000";

export function getBackendBaseUrl() {
  const configuredBaseUrl =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_BACKEND_BASE_URL;

  return configuredBaseUrl.replace(/\/$/, "");
}
