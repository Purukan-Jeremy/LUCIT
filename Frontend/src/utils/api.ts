const RAW_API_BASE_URL = (import.meta.env.VITE_API_URL || "").trim();

function normalizeApiBaseUrl(value: string) {
  if (!value) return "";

  const withoutTrailingSlash = value.replace(/\/+$/, "");
  return withoutTrailingSlash.endsWith("/api")
    ? withoutTrailingSlash.slice(0, -4)
    : withoutTrailingSlash;
}

export const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);
export const API_TARGET_LABEL =
  API_BASE_URL || `${window.location.origin}/api`;

export function getApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL
    ? `${API_BASE_URL}${normalizedPath}`
    : normalizedPath;
}
