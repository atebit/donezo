"use client";
/**
 * Per-tab in-memory cache for signed display URLs.
 *
 * Cache key: `${attachmentId}@${width ?? "raw"}`.
 * TTL: auto-refetches within 60 seconds of expiry so the URL is always fresh
 * when the user opens a preview.
 *
 * The cache is module-level (shared across all hook instances in the same tab)
 * to avoid redundant requests when multiple components display the same image.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getSignedDisplayUrl } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";

type CacheEntry = {
  url: string;
  /** ISO timestamp when the signed URL expires. */
  expiresAt: number; // Date.now() + expiresInSeconds * 1000
};

/**
 * Module-level cache — lives for the lifetime of the browser tab.
 * Key format: `${attachmentId}@${width ?? "raw"}`.
 */
const cache = new Map<string, CacheEntry>();

/**
 * How many milliseconds before expiry we proactively refetch the signed URL.
 * 60 seconds gives the UI enough buffer to swap in the new URL before the
 * old one becomes invalid.
 */
const REFETCH_BUFFER_MS = 60_000;

type UseSignedDisplayUrlOptions = {
  attachmentId: string;
  /** When provided, requests a Supabase image transform at this pixel width. */
  transform?: { width: number } | undefined;
};

type UseSignedDisplayUrlResult = {
  url: string | null;
  isLoading: boolean;
};

function cacheKey(attachmentId: string, width?: number): string {
  return `${attachmentId}@${width ?? "raw"}`;
}

/**
 * Returns a signed display URL for an attachment, caching per tab and
 * auto-refetching within 60s of expiry.
 *
 * `url` is null while the first fetch is in-flight.
 */
export function useSignedDisplayUrl({
  attachmentId,
  transform,
}: UseSignedDisplayUrlOptions): UseSignedDisplayUrlResult {
  const width = transform?.width;
  const key = cacheKey(attachmentId, width);

  const getInitialUrl = (): string | null => {
    const entry = cache.get(key);
    if (!entry) return null;
    // If already expired or expiring within the buffer, treat as absent.
    if (Date.now() >= entry.expiresAt - REFETCH_BUFFER_MS) {
      cache.delete(key);
      return null;
    }
    return entry.url;
  };

  const [url, setUrl] = useState<string | null>(getInitialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(!getInitialUrl());

  // Track active effect instance to avoid state updates after unmount.
  const isMounted = useRef(true);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUrl = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchInput =
        width !== undefined ? { attachmentId, transform: { width } } : { attachmentId };
      const result = await getSignedDisplayUrl(fetchInput);

      if (!isMounted.current) return;

      if (result.ok) {
        const expiresAt = Date.now() + result.data.expiresInSeconds * 1000;
        cache.set(key, { url: result.data.url, expiresAt });
        setUrl(result.data.url);

        // Schedule a refetch before expiry.
        const msUntilRefetch = expiresAt - REFETCH_BUFFER_MS - Date.now();
        if (msUntilRefetch > 0) {
          if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
          refetchTimerRef.current = setTimeout(() => {
            if (isMounted.current) {
              void fetchUrl();
            }
          }, msUntilRefetch);
        }
      } else {
        // Failed — keep any existing URL; don't clear so UI doesn't flash.
        setUrl((prev) => prev);
      }
    } catch {
      // Swallow — keep any existing URL.
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
    // fetchUrl is stable — attachmentId/width/key are captured via closure
    // from the outer scope. useCallback deps are intentionally minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentId, width, key]);

  useEffect(() => {
    isMounted.current = true;

    const cached = cache.get(key);
    const now = Date.now();

    if (cached && now < cached.expiresAt - REFETCH_BUFFER_MS) {
      // Cache hit and still fresh — set URL synchronously and schedule refetch.
      setUrl(cached.url);
      setIsLoading(false);

      const msUntilRefetch = cached.expiresAt - REFETCH_BUFFER_MS - now;
      refetchTimerRef.current = setTimeout(() => {
        if (isMounted.current) void fetchUrl();
      }, msUntilRefetch);
    } else {
      // Cache miss or stale — fetch immediately.
      void fetchUrl();
    }

    return () => {
      isMounted.current = false;
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
    };
  }, [key, fetchUrl]);

  return { url, isLoading };
}

/**
 * Clear the module-level cache (for testing / logout).
 */
export function clearSignedDisplayUrlCache(): void {
  cache.clear();
}
