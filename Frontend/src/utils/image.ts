import { API_BASE_URL } from "./api";

export function resolveImageSrc(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "";

  if (
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith("file://")) {
    return "";
  }

  const normalizedPath = raw.startsWith("/") ? raw : `/${raw}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
