/**
 * Vitest unit-test setup.
 *
 * Sets the minimum env variables required for lib/env.ts to validate during
 * unit tests. These are not real credentials — they satisfy the Zod URL/string
 * shape checks only.
 *
 * env.test.ts manages its own process.env via beforeEach/afterEach and
 * vi.resetModules(); it does NOT rely on these stubs.
 */

// Only set when not already present (allows individual tests to override).
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";
