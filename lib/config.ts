// lib/config.ts

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "https://www.shopx-ar.com";

export function buildApiUrl(path: string) {
  const cleanBase = API_BASE_URL.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return `${cleanBase}${cleanPath}`;
}