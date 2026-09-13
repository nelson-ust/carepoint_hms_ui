import { env } from "@/config/env";

/**
 * Resolve a backend asset reference to a fully-qualified URL usable in an
 * `<img src>`.
 *
 * The API serves uploaded assets (e.g. tenant logos) from a `/uploads` static
 * mount at the server *root* — not under the `/api/v1` prefix. Stored URLs are
 * therefore root-relative (`/uploads/...`). We resolve them against the API
 * origin (the base URL with any `/api/vN` suffix stripped).
 *
 * Absolute URLs (S3, CDN, `http(s)://…`, protocol-relative, or `data:`) are
 * returned unchanged.
 */
export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("data:")) return url;
  const origin = env.apiBaseUrl.replace(/\/api\/v\d+\/?$/i, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${path}`;
}
