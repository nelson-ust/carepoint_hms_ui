/**
 * Turn any axios/API error into a human-readable message.
 *
 * Handles the three shapes this backend produces:
 * - our envelope errors:        { message: "..." }
 * - FastAPI validation errors:  { detail: [{ loc, msg, ... }] }
 * - plain-string details:       { detail: "..." }
 * plus the no-response case (backend down / CORS-blocked).
 */
export function apiErrorMessage(err: any, fallback = "Something went wrong. Please retry."): string {
  if (err && !err.response) {
    return "Cannot reach the API server. Check that the backend is running, then retry.";
  }
  const data = err?.response?.data;
  if (typeof data?.message === "string" && data.message) return data.message;
  const detail = data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    const field = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1]) : "";
    const msg = first?.msg || "is invalid";
    return field ? `Invalid request: '${field}' ${msg.toLowerCase()}.` : `Invalid request: ${msg}.`;
  }
  return fallback;
}


/**
 * When a request uses `responseType: "blob"` (e.g. file downloads) and the
 * server responds with an error, axios delivers the JSON error body as a Blob,
 * so apiErrorMessage() can't read it. This reads+parses that Blob in place so
 * the real message is recoverable, then returns the same error for rethrowing.
 */
export async function hydrateBlobError<T = any>(err: T): Promise<T> {
  const anyErr = err as any;
  const data = anyErr?.response?.data;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      try {
        anyErr.response.data = text ? JSON.parse(text) : undefined;
      } catch {
        anyErr.response.data = text ? { message: text } : undefined;
      }
    } catch {
      /* leave the blob as-is if it can't be read */
    }
  }
  return err;
}
