/**
 * Deterministic seed constants for e2e tests.
 *
 * All IDs and slugs here MUST match supabase/seed.sql exactly.
 * The seed is applied via `supabase db reset` before running e2e tests.
 *
 * Seed sections:
 *   - Demo seed user: 11111111-1111-1111-1111-111111111111 (seed@donezo.local)
 *   - E2E test user:  eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee (e2e-user@donezo.test)
 *   - E2E workspace:  eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01
 *   - E2E board:      eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02
 *   - E2E task 1:     eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10
 *   - E2E task 2:     eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11
 *   - E2E task 3:     eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12
 */

// ---------------------------------------------------------------------------
// E2E user (owner of e2e workspace + board)
// ---------------------------------------------------------------------------
export const E2E_USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
export const E2E_USER_EMAIL = "e2e-user@donezo.test";
export const E2E_USER_PASSWORD = "e2e-test-password-12345";
export const E2E_USER_NAME = "E2E Test User";

// ---------------------------------------------------------------------------
// E2E workspace
// ---------------------------------------------------------------------------
export const E2E_WORKSPACE_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01";
export const E2E_WORKSPACE_SLUG = "e2e-workspace";
export const E2E_WORKSPACE_NAME = "E2E Workspace";

// ---------------------------------------------------------------------------
// E2E board (inside E2E workspace)
// ---------------------------------------------------------------------------
export const E2E_BOARD_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee02";
export const E2E_BOARD_NAME = "E2E Board";

// ---------------------------------------------------------------------------
// E2E group (inside E2E board)
// ---------------------------------------------------------------------------
export const E2E_GROUP_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03";
export const E2E_GROUP_NAME = "E2E Group";

// ---------------------------------------------------------------------------
// E2E tasks (inside E2E group)
// ---------------------------------------------------------------------------
export const E2E_TASK_1_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10";
export const E2E_TASK_1_TITLE = "E2E Task One";

export const E2E_TASK_2_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11";
export const E2E_TASK_2_TITLE = "E2E Task Two";

export const E2E_TASK_3_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12";
export const E2E_TASK_3_TITLE = "E2E Task Three";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------
export const E2E_BOARD_URL = `/w/${E2E_WORKSPACE_SLUG}/b/${E2E_BOARD_ID}`;
export const E2E_TASK_1_URL = `${E2E_BOARD_URL}/t/${E2E_TASK_1_ID}`;

// ---------------------------------------------------------------------------
// Demo seed (from seed.sql — separate from e2e seed)
// ---------------------------------------------------------------------------
export const DEMO_USER_ID = "11111111-1111-1111-1111-111111111111";
export const DEMO_WORKSPACE_ID = "22222222-2222-2222-2222-222222222222";
export const DEMO_BOARD_ID = "33333333-3333-3333-3333-333333333333";
