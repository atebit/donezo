# Epic 12 — Followup Round 1 (non-blocking cleanups)

**Date:** 2026-05-12
**Reviewer:** epic-researcher (Opus)
**Status:** OPTIONAL — none of these block the `epic/12-alternate-views → main` merge. Each is a small code-quality cleanup surfaced by the final review.

---

## Context

The Stage-3 final review for Epic 12 returned `CLEAN (static)`. All DoD bullets are met. The three items below are quality cleanups, not DoD gaps. The user can:
- (a) dispatch executors against these slices on the existing epic branch before opening the PR,
- (b) merge Epic 12 as-is and pick these up in Epic 14 polish, or
- (c) drop them entirely.

Each slice is independently dispatchable (small file scope, no cross-slice dependencies).

---

## Followup Slice 1 — Consolidate routing helpers

**Branch (suggested):** `epic/12-alternate-views/followup-routing-helpers`
**Owner:** epic-executor (Sonnet)
**Size:** ~15 lines net

### Problem

Two helper modules coexist with conflicting `table` URL semantics:

- `lib/views/kind-routes.ts` — used by `hooks/use-board-view.ts:32` (the canonical production path). Maps `table` to the `/table` URL segment. Functions: `kindFromPath(pathname): ViewKind`, `pathForKind(kind, slug, boardId, viewId?): string`.
- `lib/views/kind-router.ts` — used ONLY by its own test `tests/unit/kind-router.test.ts`. Maps `table` to the bare board route (no segment). Functions: `viewKindToSegment(kind): string`, `kindFromPathname(pathname): string`, `buildViewUrl(slug, boardId, view): string`.

Production resolves `table` to `/table?view=<id>` (via `kindFromPath` + `pathForKind`). The `kind-router.ts` helpers would resolve to `/?view=<id>`, which would hit the index redirect page → 1-hop redirect → land at `/table`. So no runtime bug today, but the semantic divergence is a footgun for any future executor who picks the wrong import.

### Owns (write)

- `/Volumes/SSD1T/DEV WORK/donezo/lib/views/kind-router.ts` — DELETE
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/kind-router.test.ts` — DELETE (or rewrite to test `kind-routes.ts` instead — see below)

### Forbidden scope

Any file outside the two above. Do not edit `hooks/use-board-view.ts`, `kind-routes.ts`, or any per-kind page.

### Decision

The `kindFromPath` + `pathForKind` helpers in `kind-routes.ts` already cover everything `kind-router.ts` exposed:
- `viewKindToSegment(kind)` → equivalent to extracting from `pathForKind` URL slice; not needed externally.
- `kindFromPathname(path)` → `kindFromPath(path)` in `kind-routes.ts`.
- `buildViewUrl(slug, boardId, view)` → `pathForKind(view.kind, slug, boardId, view.id)` in `kind-routes.ts`.

No production code imports `kind-router.ts`. Verified by:
```
$ grep -rn "kindFromPathname\|viewKindToSegment\|buildViewUrl" --include="*.ts" --include="*.tsx" | grep -v "_dispatch\|docs/\|/kind-router"
tests/unit/kind-router.test.ts:3:import { buildViewUrl, kindFromPathname, viewKindToSegment } from "../../lib/views/kind-router";
```

The test file `tests/unit/kind-router.test.ts` (177 lines) is good test material — it covers all 6 kinds, round-trips, and unknown-kind fallback. Rewrite it to import from `kind-routes.ts` (`kindFromPath` + `pathForKind`) and adjust the expected `table` URL from the bare route to `/table`. Then delete `kind-router.ts`.

### Definition of done

- `lib/views/kind-router.ts` does not exist.
- `tests/unit/kind-router.test.ts` either does not exist OR has been rewritten to import from `lib/views/kind-routes.ts` and asserts the canonical `/table` segment behavior. Either choice is acceptable; renaming the test file to `kind-routes.test.ts` is preferred for clarity.
- `pnpm exec tsc --noEmit` passes.
- `pnpm exec vitest run` for the relevant test file passes.
- `grep -rn "kind-router" --include="*.ts" --include="*.tsx"` from the repo root returns no hits.

### Escalation triggers

If a hidden consumer of `kind-router.ts` shows up at typecheck time — stop and return a needs-direction report with the import site listed. (Spec author has verified none exist at review time, but list it just in case.)

---

## Followup Slice 2 — Remove dead `BoardRealtimeBootstrap`

**Branch (suggested):** `epic/12-alternate-views/followup-realtime-bootstrap`
**Owner:** epic-executor (Sonnet)
**Size:** ~25 lines deleted

### Problem

`components/board/BoardRealtimeBootstrap.tsx` (23 lines) was originally specified by Slice A to host the `useBoardRealtime` call at the layout level. During implementation it was inlined into `BoardDataProvider.tsx:54` instead. The Bootstrap component is never imported anywhere:

```
$ grep -rn "BoardRealtimeBootstrap" --include="*.ts" --include="*.tsx" | grep -v "_dispatch\|docs/"
components/board/BoardRealtimeBootstrap.tsx:4: * BoardRealtimeBootstrap — ...
components/board/BoardRealtimeBootstrap.tsx:19:export function BoardRealtimeBootstrap() { ... }
```

It is harmless dead code, but it confuses future readers (the file name and docblock suggest it's the realtime mount point, when actually `BoardDataProvider` is).

### Owns (write)

- `/Volumes/SSD1T/DEV WORK/donezo/components/board/BoardRealtimeBootstrap.tsx` — DELETE

### Forbidden scope

Do not modify `BoardDataProvider.tsx`, the layout, or any other file. The realtime mounting must stay exactly where it is (inside `BoardDataProvider`).

### Definition of done

- `components/board/BoardRealtimeBootstrap.tsx` does not exist.
- `pnpm exec tsc --noEmit` passes.
- `grep -rn "BoardRealtimeBootstrap" --include="*.ts" --include="*.tsx"` from the repo root returns no hits.

### Escalation triggers

None expected. If somehow an import shows up, stop and escalate.

---

## Followup Slice 3 — Wire `cardStyle` into Timeline rows

**Branch (suggested):** `epic/12-alternate-views/followup-timeline-cardstyle`
**Owner:** epic-executor (Sonnet)
**Size:** ~80 lines

### Problem

`TimelineConfigSchema` (lib/views/config-schema.ts:139–147) includes `cardStyle: CardStyleSchema.optional()` but no Timeline component consumes it:

```
$ grep -n "cardStyle\|CardStyle\|TaskCard" components/board/timeline/*.tsx
(no output)
```

The Timeline bar (`TimelineBar.tsx`) renders the task title only. The epic doc's "Visual fidelity requirements" section says: *"Card style applied to `<TaskCard />` for kanban/calendar/timeline must come from a single shared renderer — same component, three contexts."*

Two interpretations:
1. **Strict reading:** Timeline must show TaskCard chrome with configured cells on the bar (visible cell rows below title). This is not how Gantt bars usually look — they are positioned bars, not stacked card chrome.
2. **Pragmatic reading:** Timeline bars stay as bars; the `cardStyle` config controls which cell values are shown as adornments **next to or inside** the bar (e.g., person avatar, status pill at the right edge).

Interpretation (2) is more aligned with how Gantt UIs work and is what this followup implements. If the user prefers interpretation (1), escalate with a needs-direction report before implementing.

### Owns (write)

- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineRow.tsx` (extend — accept `cardStyle?: CardStyle` and `cellsByKey?: Map<string, Cell>` and `columns?: Column[]` props; pass to `TimelineBar`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineBar.tsx` (extend — render up to 3 configured cell values inline on/next to the bar; person avatars on the left edge if `showAvatars`, status pill on the right edge if a status cell is in `visibleColumnIds`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/timeline/TimelineView.tsx` (small edit — derive `cardStyle = effective.timeline?.cardStyle`, pass through to each `<TimelineRow />`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/timeline-cardstyle.test.tsx` (NEW — assert that with `cardStyle.visibleColumnIds = [statusColId]`, the bar renders the status pill; with `showAvatars=true`, the bar renders the avatar)

### Forbidden scope

Do not modify any non-timeline component. Do not touch `lib/views/config-schema.ts` (the schema slot already exists and is correct). Do not change the drag-handler signatures.

### Contracts

```ts
// TimelineRow props — new optional fields
interface TimelineRowProps {
  // existing fields…
  cardStyle?: CardStyle;        // NEW — undefined means render the bare bar
  cellsByKey?: Map<string, Cell>; // NEW — same shape used by TaskCard
  columns?: Column[];           // NEW — same shape used by TaskCard
}

// TimelineBar props — new optional fields
interface TimelineBarProps {
  // existing fields…
  cardStyle?: CardStyle;
  cellsByKey?: Map<string, Cell>;
  columns?: Column[];
}
```

### Visual contract

- Avatars (when `cardStyle.showAvatars && visibleColumnIds includes a person column`): stack up to 3 small avatars (16px) flush-left inside the bar; if >3, render "+N" overlap.
- Status pill (when `visibleColumnIds includes a status column`): 16px-high pill rendered flush-right inside the bar, using the cell registry's status color.
- Other cell types in `visibleColumnIds`: skipped for v1 (bar real estate is limited).
- All adornments render only when the bar is wide enough (≥ 80px); below that, omit them to avoid overflow.

### Definition of done

- `TimelineView` derives `cardStyle` from `effective.timeline?.cardStyle` and passes it to each row.
- `TimelineBar` renders configured avatars + status pill inline as described above.
- A new unit test in `tests/unit/timeline-cardstyle.test.tsx` covers: (a) no cardStyle → bare bar, (b) cardStyle with person column + `showAvatars=true` → avatar rendered, (c) cardStyle with status column → status pill rendered.
- Existing `tests/unit/timeline-math.test.ts` still passes (no regression in math helpers).
- `pnpm exec tsc --noEmit` passes.
- Drag/resize handlers are unchanged in behavior.

### Escalation triggers

- If the user prefers interpretation (1) above (TaskCard chrome with stacked cells instead of inline adornments), STOP and escalate. The whole bar layout would need to change.
- If existing tests fail (unexpected coupling to the previous bar layout), STOP and escalate.

---

## Open questions for the user

1. **Interpretation of "Visual fidelity requirements" for timeline cardStyle** — see Followup Slice 3 §"Problem". The author recommends interpretation (2) — inline adornments on the bar. Confirm before dispatching Slice 3.

2. **Followup landing strategy** — dispatch on the existing `epic/12-alternate-views` branch before PR, or merge as-is and bundle these into an Epic 14 polish round?

