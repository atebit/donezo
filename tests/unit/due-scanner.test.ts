/**
 * tests/unit/due-scanner.test.ts
 *
 * Fixture-driven unit tests for lib/notifications/due-scanner.ts.
 *
 * All Supabase calls are mocked via vi.mock so no live DB is needed.
 *
 * Coverage:
 *   - Task 23 hours away → `due_soon` fires once; second run does not duplicate.
 *   - Task 12 minutes overdue → `due_overdue` fires once; second run does not duplicate.
 *   - Multiple date columns on the same task → still single notification per kind.
 *   - Tasks with no assignees → slot claimed but no emit.
 *   - inApp=false preference → no emit row.
 *   - Unauthorized route requests → 401.
 *   - Route returns structured counts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

const BOARD_ID = "bbbb0000-0000-0000-0000-000000000001";
const TASK_ID = "tttt0000-0000-0000-0000-000000000001";
const TASK_ID_2 = "tttt0000-0000-0000-0000-000000000002";
const USER_ID = "uuuu0000-0000-0000-0000-000000000001";
const COL_DATE_1 = "cccc0000-0000-0000-0000-000000000001";
const COL_DATE_2 = "cccc0000-0000-0000-0000-000000000002";

const NOW_ISO = "2026-05-13T12:00:00.000Z";
const in23Hours = new Date(new Date(NOW_ISO).getTime() + 23 * 60 * 60 * 1000).toISOString();
const minus12Min = new Date(new Date(NOW_ISO).getTime() - 12 * 60 * 1000).toISOString();

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

// Mock emit so we can capture calls without hitting the DB.
const mockEmit = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/notifications/emit", () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}));

// Mock getPreferenceFor — default: inApp true, email instant.
const mockGetPreferenceFor = vi.fn().mockResolvedValue({ inApp: true, email: "instant" });
vi.mock("../../lib/notifications/preferences", () => ({
  getPreferenceFor: (...args: unknown[]) => mockGetPreferenceFor(...args),
}));

// Mock logger.
vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// adminClient mock
//
// The scanner calls adminClient().from(table).select(...).eq(...).gte(...) etc.
// Each call to `from()` returns a thenable builder. We maintain a queue of
// results so each successive `from()` call can return a different payload.
// ---------------------------------------------------------------------------

/** Queue of results for successive adminClient().from() calls. */
let mockResultQueue: Array<{ data: unknown; error: unknown; count?: number }> = [];
let mockCallIndex = 0;

function makeBuilder(result: { data: unknown; error: unknown; count?: number }) {
  // The Supabase PostgREST client is a PromiseLike — awaiting the builder
  // resolves to { data, error }. We make a thenable that also supports the
  // full fluent chain (all builder methods return `this`).
  const builder: Record<string, unknown> = {};
  const methods = [
    "select",
    "insert",
    "eq",
    "not",
    "gte",
    "lte",
    "lt",
    "is",
    "throwOnError",
    "order",
    "limit",
    "maybeSingle",
    "single",
    "returning",
  ];
  for (const m of methods) {
    builder[m] = vi.fn().mockReturnThis();
  }
  // Make it thenable — when awaited, resolves to { data, error }.
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Supabase client shape.
  builder.then = (resolve: (v: unknown) => unknown, _reject?: unknown) =>
    Promise.resolve(result).then(resolve);
  return builder;
}

const mockAdminInstance = {
  from: vi.fn((_table: string) => {
    const result = mockResultQueue[mockCallIndex] ?? { data: null, error: null };
    mockCallIndex++;
    return makeBuilder(result);
  }),
};

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: () => mockAdminInstance,
}));

// ---------------------------------------------------------------------------
// Helper: configure the mock queue for a scenario.
// ---------------------------------------------------------------------------

/**
 * Set up a due_soon scenario.
 *
 * When insertCount > 0 (claim succeeds), the interleaved call order is:
 *   from #0: date-cell scan (due_soon window) → dateRows
 *   from #1: task_reminder_sent INSERT → row returned (claimed)
 *   from #2: person-cell scan → personRows
 *   from #3: date-cell scan (overdue window) → []
 *
 * When insertCount = 0 (conflict — already claimed), the processing returns
 * early (no person-cell query), so the order is:
 *   from #0: date-cell scan (due_soon window) → dateRows
 *   from #1: task_reminder_sent INSERT → [] (conflict, not claimed)
 *   from #2: date-cell scan (overdue window) → []
 */
function setupDueSoonQueue(
  dateRows: unknown[],
  insertCount = 1,
  personRows: unknown[] = [{ json_value: { userIds: [USER_ID] }, column: { type: "person" } }],
) {
  mockCallIndex = 0;
  if (insertCount > 0) {
    mockResultQueue = [
      { data: dateRows, error: null },
      { data: [{ task_id: TASK_ID, kind: "due_soon" }], error: null },
      { data: personRows, error: null },
      { data: [], error: null }, // overdue scan (empty)
    ];
  } else {
    // Claim fails → no person-cell query.
    mockResultQueue = [
      { data: dateRows, error: null },
      { data: [], error: null }, // INSERT conflict → empty
      { data: [], error: null }, // overdue scan (empty)
    ];
  }
}

/**
 * Set up an overdue scenario.
 *
 * When insertCount > 0 (claim succeeds):
 *   from #0: date-cell scan (due_soon window) → []  [no rows, no inner loop work]
 *   from #1: date-cell scan (overdue window) → overdueRows
 *   from #2: task_reminder_sent INSERT → row returned (claimed)
 *   from #3: person-cell scan → personRows
 *
 * When insertCount = 0 (conflict):
 *   from #0: date-cell scan (due_soon window) → []
 *   from #1: date-cell scan (overdue window) → overdueRows
 *   from #2: task_reminder_sent INSERT → [] (conflict)
 *   (no person-cell query)
 */
function setupOverdueQueue(
  overdueRows: unknown[],
  insertCount = 1,
  personRows: unknown[] = [{ json_value: { userIds: [USER_ID] }, column: { type: "person" } }],
) {
  mockCallIndex = 0;
  if (insertCount > 0) {
    mockResultQueue = [
      { data: [], error: null }, // due_soon scan (empty)
      { data: overdueRows, error: null },
      { data: [{ task_id: TASK_ID, kind: "due_overdue" }], error: null },
      { data: personRows, error: null },
    ];
  } else {
    mockResultQueue = [
      { data: [], error: null }, // due_soon scan (empty)
      { data: overdueRows, error: null },
      { data: [], error: null }, // INSERT conflict → empty
    ];
  }
}

// Build a due_soon cell row fixture.
function dueSoonRow(taskId: string, colId: string, dateVal: string) {
  return {
    task_id: taskId,
    column_id: colId,
    date_value: dateVal,
    task: { id: taskId, board_id: BOARD_ID, deleted_at: null },
    column: { type: "date" },
  };
}

function overdueRow(taskId: string, colId: string, dateVal: string) {
  return {
    task_id: taskId,
    column_id: colId,
    date_value: dateVal,
    task: { id: taskId, board_id: BOARD_ID, deleted_at: null },
    column: { type: "date" },
  };
}

// ---------------------------------------------------------------------------
// runDueScanner tests
// ---------------------------------------------------------------------------

describe("runDueScanner", () => {
  beforeEach(() => {
    mockCallIndex = 0;
    mockResultQueue = [];
    mockEmit.mockClear();
    mockGetPreferenceFor.mockClear().mockResolvedValue({ inApp: true, email: "instant" });
    mockAdminInstance.from.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getScanner() {
    const { runDueScanner } = await import("../../lib/notifications/due-scanner");
    return runDueScanner;
  }

  it("emits due_soon once for a task 23h away", async () => {
    setupDueSoonQueue([dueSoonRow(TASK_ID, COL_DATE_1, in23Hours)]);

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(result.due_soon.processed).toBe(1);
    expect(result.due_soon.notified).toBe(1);
    expect(result.due_soon.skipped).toBe(0);
    expect(mockEmit).toHaveBeenCalledTimes(1);

    const [rows, context] = mockEmit.mock.calls[0] as [
      Array<{
        user_id: string;
        kind: string;
        payload: { board_id: string; task_id: string; due_date: string };
      }>,
      string,
    ];
    expect(context).toBe("due-scanner:due_soon");
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(USER_ID);
    expect(rows[0].kind).toBe("due_soon");
    expect(rows[0].payload.task_id).toBe(TASK_ID);
    expect(rows[0].payload.board_id).toBe(BOARD_ID);
    expect(rows[0].payload.due_date).toBe(in23Hours);
  });

  it("does not emit due_soon on the second run (slot already claimed)", async () => {
    // insertCount=0 simulates ON CONFLICT DO NOTHING (no row returned).
    setupDueSoonQueue([dueSoonRow(TASK_ID, COL_DATE_1, in23Hours)], 0);

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(result.due_soon.skipped).toBeGreaterThan(0);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits due_overdue once for a task 12 minutes overdue", async () => {
    setupOverdueQueue([overdueRow(TASK_ID, COL_DATE_1, minus12Min)]);

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(result.due_overdue.processed).toBe(1);
    expect(result.due_overdue.notified).toBe(1);
    expect(result.due_overdue.skipped).toBe(0);
    expect(mockEmit).toHaveBeenCalledTimes(1);

    const [rows, context] = mockEmit.mock.calls[0] as [
      Array<{ user_id: string; kind: string; payload: { task_id: string } }>,
      string,
    ];
    expect(context).toBe("due-scanner:due_overdue");
    expect(rows[0].kind).toBe("due_overdue");
    expect(rows[0].payload.task_id).toBe(TASK_ID);
  });

  it("does not emit due_overdue on the second run (slot already claimed)", async () => {
    setupOverdueQueue([overdueRow(TASK_ID, COL_DATE_1, minus12Min)], 0);

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(result.due_overdue.skipped).toBeGreaterThan(0);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it("emits only ONE due_soon when multiple date columns match the same task", async () => {
    // Two rows for the same task but different column IDs.
    const rows = [
      dueSoonRow(TASK_ID, COL_DATE_1, in23Hours),
      dueSoonRow(TASK_ID, COL_DATE_2, in23Hours),
    ];
    // The dedup set in runDueScanner will skip the second row before inserting.
    // Interleaved call order:
    //   #0: due_soon scan → 2 rows (same task_id)
    //   #1: task_reminder_sent INSERT for task 1 (only once — dedup prevents second)
    //   #2: person cells for task 1
    //   #3: overdue scan → []
    mockCallIndex = 0;
    mockResultQueue = [
      { data: rows, error: null },
      { data: [{ task_id: TASK_ID, kind: "due_soon" }], error: null },
      { data: [{ json_value: { userIds: [USER_ID] }, column: { type: "person" } }], error: null },
      { data: [], error: null }, // overdue scan
    ];

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    // processed = 2 (both rows visited), but dedup means only 1 unique task.
    expect(result.due_soon.processed).toBe(2);
    expect(result.due_soon.notified).toBe(1);
    expect(result.due_soon.skipped).toBe(1); // second row deduped
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it("skips notification when no assignees are found for the task", async () => {
    setupDueSoonQueue(
      [dueSoonRow(TASK_ID, COL_DATE_1, in23Hours)],
      1,
      [], // no person cells
    );

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    // Slot was claimed (to prevent retries), but emit was not called.
    expect(mockEmit).not.toHaveBeenCalled();
    expect(result.due_soon.skipped).toBe(1);
  });

  it("respects inApp=false preference — slot claimed but no emit row built", async () => {
    mockGetPreferenceFor.mockResolvedValue({ inApp: false, email: "off" });
    setupDueSoonQueue([dueSoonRow(TASK_ID, COL_DATE_1, in23Hours)]);

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(mockEmit).not.toHaveBeenCalled();
    expect(result.due_soon.skipped).toBe(1);
  });

  it("handles two different tasks independently — both get notified", async () => {
    // Two distinct task IDs in the due_soon window.
    const rows = [
      dueSoonRow(TASK_ID, COL_DATE_1, in23Hours),
      dueSoonRow(TASK_ID_2, COL_DATE_1, in23Hours),
    ];
    // Interleaved call order (task processing happens inside the due_soon loop):
    //   #0: due_soon scan → [task1, task2]
    //   #1: insert for task 1
    //   #2: person cells for task 1
    //   #3: insert for task 2
    //   #4: person cells for task 2
    //   #5: overdue scan → []
    mockCallIndex = 0;
    mockResultQueue = [
      { data: rows, error: null },
      { data: [{ task_id: TASK_ID, kind: "due_soon" }], error: null },
      { data: [{ json_value: { userIds: [USER_ID] }, column: { type: "person" } }], error: null },
      { data: [{ task_id: TASK_ID_2, kind: "due_soon" }], error: null },
      { data: [{ json_value: { userIds: [USER_ID] }, column: { type: "person" } }], error: null },
      { data: [], error: null }, // overdue scan
    ];

    const runDueScanner = await getScanner();
    const result = await runDueScanner();

    expect(result.due_soon.processed).toBe(2);
    expect(result.due_soon.notified).toBe(2);
    expect(result.due_soon.skipped).toBe(0);
    expect(mockEmit).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Route handler tests
// ---------------------------------------------------------------------------

describe("GET /api/cron/due-scanner", () => {
  beforeEach(() => {
    mockCallIndex = 0;
    mockResultQueue = [];
    mockEmit.mockClear();
    mockAdminInstance.from.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getRouteHandler() {
    const mod = await import("../../app/api/cron/due-scanner/route");
    return mod.GET;
  }

  function makeRequest(options: { auth?: string; cronHeader?: string } = {}) {
    const headers = new Headers();
    if (options.auth !== undefined) headers.set("authorization", options.auth);
    if (options.cronHeader !== undefined) headers.set("x-vercel-cron", options.cronHeader);
    return new Request("http://localhost/api/cron/due-scanner", {
      method: "GET",
      headers,
    }) as unknown as import("next/server").NextRequest;
  }

  it("returns 401 when Authorization header is missing and secret is set", async () => {
    const saved = process.env.INTERNAL_CRON_SECRET;
    process.env.INTERNAL_CRON_SECRET = "a-secret-key-that-is-long-enough-123456";
    try {
      const GET = await getRouteHandler();
      const response = await GET(makeRequest());
      expect(response.status).toBe(401);
    } finally {
      process.env.INTERNAL_CRON_SECRET = saved;
    }
  });

  it("returns 401 when Bearer token does not match", async () => {
    const saved = process.env.INTERNAL_CRON_SECRET;
    process.env.INTERNAL_CRON_SECRET = "correct-secret-long-enough-abc12345678";
    try {
      const GET = await getRouteHandler();
      // Provide a token of the same length as the secret, but wrong value.
      const response = await GET(makeRequest({ auth: "Bearer wrong-secret-long-enough-abc12345" }));
      expect(response.status).toBe(401);
    } finally {
      process.env.INTERNAL_CRON_SECRET = saved;
    }
  });

  it("returns 200 with result counts when no secret is configured (open mode)", async () => {
    const saved = process.env.INTERNAL_CRON_SECRET;
    delete process.env.INTERNAL_CRON_SECRET;

    // Both date queries return empty — nothing to process.
    mockCallIndex = 0;
    mockResultQueue = [
      { data: [], error: null }, // due_soon scan
      { data: [], error: null }, // overdue scan
    ];

    try {
      const GET = await getRouteHandler();
      const response = await GET(makeRequest({ cronHeader: "1" }));
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        ok: boolean;
        due_soon: { processed: number; notified: number; skipped: number };
        due_overdue: { processed: number; notified: number; skipped: number };
      };
      expect(body.ok).toBe(true);
      expect(body.due_soon).toMatchObject({ processed: 0, notified: 0, skipped: 0 });
      expect(body.due_overdue).toMatchObject({ processed: 0, notified: 0, skipped: 0 });
    } finally {
      process.env.INTERNAL_CRON_SECRET = saved;
    }
  });

  it("returns 200 with correct token", async () => {
    const secret = "correct-secret-long-enough-abcdefgh";
    const saved = process.env.INTERNAL_CRON_SECRET;
    process.env.INTERNAL_CRON_SECRET = secret;

    mockCallIndex = 0;
    mockResultQueue = [
      { data: [], error: null },
      { data: [], error: null },
    ];

    try {
      const GET = await getRouteHandler();
      const response = await GET(makeRequest({ auth: `Bearer ${secret}`, cronHeader: "1" }));
      expect(response.status).toBe(200);
    } finally {
      process.env.INTERNAL_CRON_SECRET = saved;
    }
  });
});
