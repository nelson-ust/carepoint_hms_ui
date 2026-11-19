import { lazy } from "react";
import type { ComponentType } from "react";

/**
 * Drop-in replacement for {@link lazy} that self-heals the
 * "Failed to fetch / error loading dynamically imported module" error.
 *
 * That error happens when a new deploy replaces the app's hashed chunk files
 * while a user still has the previous index.html loaded: the old page points at
 * a chunk hash that no longer exists on the server, so the dynamic import 404s.
 *
 * When the import fails with a chunk-load error we force ONE full page reload,
 * which fetches the fresh index.html and the current chunk names. A
 * sessionStorage timestamp guards against an infinite reload loop: if an import
 * still fails shortly after a reload, we let the error propagate to the error
 * boundary instead of reloading again.
 */
const RELOAD_KEY = "chunk-reload-ts";
const RELOAD_WINDOW_MS = 10_000;

function isChunkLoadError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("failed to fetch") ||
    msg.includes("error loading") ||
    msg.includes("importing a module script failed") ||
    msg.includes("module script failed") ||
    msg.includes("unable to preload")
  );
}

/** Reload once per RELOAD_WINDOW_MS; returns true if a reload was triggered. */
export function reloadOnceForStaleChunk(): boolean {
  let last = 0;
  try {
    last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
  } catch {
    /* sessionStorage unavailable — treat as first reload (last stays 0) */
  }
  const now = Date.now();
  if (now - last > RELOAD_WINDOW_MS) {
    try {
      window.sessionStorage.setItem(RELOAD_KEY, String(now));
    } catch {
      /* private mode / storage disabled — reload anyway */
    }
    window.location.reload();
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      if (isChunkLoadError(err) && reloadOnceForStaleChunk()) {
        // Block rendering until the reload takes effect.
        return await new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
