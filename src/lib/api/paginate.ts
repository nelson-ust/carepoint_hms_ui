import type { AxiosInstance } from "axios";

/**
 * Largest page size EVERY backend revision is guaranteed to accept.
 *
 * Older backend builds capped the `limit` query param at 100, so a request
 * for more (e.g. limit=500) returned a 422 and broke the page whenever the
 * server was running stale code. Fetching in <=100 chunks keeps list pages
 * working regardless of which backend revision is live.
 */
const SAFE_PAGE = 100;

type PagedEnvelope<T> = {
  success?: boolean;
  message?: string;
  items?: T[];
  count?: number;
  meta?: { total?: number; [key: string]: any };
};

export type MergedPage<T> = {
  success: boolean;
  message: string;
  items: T[];
  count: number;
  meta: { total?: number; [key: string]: any };
};

/**
 * Fetch a paginated list endpoint in backend-safe (<=100) chunks and return a
 * single merged envelope. Extra filter params ride along on every request, and
 * an optional `mapItem` transform is applied to each row as it's collected.
 *
 * A guard bounds the loop so a malformed `meta` can never spin forever.
 */
export async function fetchAllPaged<T>(
  client: AxiosInstance,
  url: string,
  opts: {
    skip?: number;
    limit?: number;
    params?: Record<string, unknown>;
    mapItem?: (item: T) => T;
    defaultMessage?: string;
  } = {},
): Promise<MergedPage<T>> {
  const startSkip = opts.skip ?? 0;
  const desired = opts.limit ?? SAFE_PAGE;
  const extra = opts.params ?? {};
  const mapItem = opts.mapItem;

  const items: T[] = [];
  let skip = startSkip;
  let last: PagedEnvelope<T> | null = null;

  for (let guard = 0; guard < 500; guard += 1) {
    const pageSize = Math.min(SAFE_PAGE, desired - items.length);
    if (pageSize <= 0) break;

    const res = await client.get<PagedEnvelope<T>>(url, {
      params: { ...extra, skip, limit: pageSize },
    });
    last = res.data;

    const pageItems = res.data?.items ?? [];
    for (const item of pageItems) items.push(mapItem ? mapItem(item) : item);

    const total = res.data?.meta?.total;
    const reachedEnd =
      pageItems.length < pageSize ||
      (typeof total === "number" && items.length >= total);
    if (reachedEnd) break;

    skip += pageSize;
  }

  return {
    success: last?.success ?? true,
    message: last?.message ?? opts.defaultMessage ?? "Fetched successfully.",
    items,
    count: items.length,
    meta: {
      ...(last?.meta ?? {}),
      total: last?.meta?.total ?? items.length,
      skip: startSkip,
      limit: items.length,
    },
  };
}
