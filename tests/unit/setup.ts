/**
 * Vitest unit-test setup.
 *
 * Sets the minimum env variables required for lib/env.ts to validate during
 * unit tests. These are not real credentials — they satisfy the Zod URL/string
 * shape checks only.
 *
 * env.test.ts manages its own process.env via beforeEach/afterEach and
 * vi.resetModules(); it does NOT rely on these stubs.
 *
 * DOM environment note: .test.tsx files run in jsdom (via vitest.config.ts
 * `projects`). This setup file runs in both node and jsdom contexts; DOM-specific
 * stubs are guarded by `typeof window !== "undefined"`.
 *
 * Server-only module stubs: lib/logger.ts throws when window is defined
 * (intentional server-guard). Component trees that transitively import it would
 * crash in jsdom. We stub it here so RTL tests can render component trees that
 * indirectly depend on server-only modules via deep import paths (e.g.,
 * lib/cells/registry → cell editors → app action files → lib/logger).
 * This is a test-infra concern; production code is unchanged.
 *
 * vi.mock() calls are hoisted by vitest to before any imports regardless of
 * their physical position in this file.
 */

import { vi } from "vitest";

// Stub lib/logger so server-guard doesn't throw in jsdom when component trees
// pull it in transitively (e.g. via cell editors → server actions → logger).
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// Stub lib/supabase/server so tests that import components pulling in the
// server Supabase client don't hit the "next/headers is not available outside
// of Server Components" guard in jsdom.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockReturnThis(),
    }),
  }),
}));

// Stub next/navigation so components that call usePathname / useRouter / useParams
// don't crash in tests that don't provide a real Next.js router context.
// Individual tests that need specific return values can override via vi.mocked().
vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/"),
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: vi.fn().mockReturnValue({}),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
  useSelectedLayoutSegment: vi.fn().mockReturnValue(null),
  useSelectedLayoutSegments: vi.fn().mockReturnValue([]),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Stub lib/supabase/admin — same reason: server-only guard throws in jsdom.
vi.mock("@/lib/supabase/admin", () => ({
  adminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

// NOTE: lib/activity is intentionally NOT mocked here.
// lib/activity.ts itself has no server-guard; its dependencies (lib/logger and
// lib/supabase/admin) are already mocked above, which is sufficient to prevent
// jsdom crashes. Tests that need to assert on logActivity calls mock it locally.

// RTL jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.)
// Only import when we are in a DOM context (jsdom). In node context the import
// is a no-op because @testing-library/jest-dom/vitest guards itself.
import "@testing-library/jest-dom/vitest";

// RTL cleanup: unmount React trees after each test so elements from one test
// don't bleed into the next. RTL's automatic cleanup relies on a global
// `afterEach`. Since vitest doesn't expose globals by default, we wire it here.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Only set when not already present (allows individual tests to override).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

// Stub window.matchMedia for jsdom (not provided by jsdom out-of-the-box).
// Components that call matchMedia (e.g. theme, responsive hooks) will get a
// safe no-throwing stub. Guard ensures this doesn't crash in the node env.
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  // Stub scrollIntoView — not implemented in jsdom.
  // Components that call el.scrollIntoView() (e.g. MentionPopover) would throw
  // without this stub.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // Stub localStorage for jsdom. jsdom requires a URL to enable localStorage;
  // vitest's jsdom environment may not set one by default. Providing a simple
  // in-memory Map-backed stub covers Zustand persist middleware usage in tests.
  if (typeof localStorage === "undefined" || !localStorage.setItem) {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      writable: true,
      value: {
        setItem: (key: string, val: string) => store.set(key, val),
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => store.delete(key),
        clear: () => store.clear(),
        get length() {
          return store.size;
        },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
    });
  }
}
