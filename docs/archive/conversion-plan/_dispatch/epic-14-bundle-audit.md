# Epic 14 Bundle Audit

**Method:** Live build — `ANALYZE=true pnpm build` ran successfully on branch
`epic-14/slice-i-audit-and-visual` (2026-05-13). No build errors. All 19 static
pages generated. The sizes in the table below are the **gzip** figures as
reported by Next.js in its build output (verified: the reported chunk size for
`5804` matches `gzip -c ... | wc -c` exactly, confirming Next.js 15.x reports
gzip sizes).

## Per-Route Initial JS (gzip)

| Route | Route-specific chunk | First Load JS (gzip) | 300 KB Budget |
|---|---|---|---|
| `/` (workspace root) | — | 183 KB | ✅ OK |
| `/_not-found` | — | 104 KB | ✅ OK |
| `/sign-in` | 10.9 KB | 165 KB | ✅ OK |
| `/sign-up` | 11.1 KB | 165 KB | ✅ OK |
| `/forgot-password` | 9.5 KB | 165 KB | ✅ OK |
| `/reset-password` | 12.7 KB | 226 KB | ✅ OK |
| `/verify-email` | 9.4 KB | 211 KB | ✅ OK |
| `/account` | 13.5 KB | 162 KB | ✅ OK |
| `/account/notifications` | 10.0 KB | 159 KB | ✅ OK |
| `/notifications` | 12.2 KB | 139 KB | ✅ OK |
| `/join/[token]` | 1.2 KB | 108 KB | ✅ OK |
| `/w/[workspaceSlug]` | 8.9 KB | 206 KB | ✅ OK |
| `/w/[workspaceSlug]/trash` | 9.3 KB | 144 KB | ✅ OK |
| `/w/[workspaceSlug]/settings/general` | 14.3 KB | 187 KB | ✅ OK |
| `/w/[workspaceSlug]/settings/members` | 17.4 KB | 192 KB | ✅ OK |
| `/w/.../b/[boardId]` (shell/redirect) | 174 B | 104 KB | ✅ OK |
| `/w/.../b/[boardId]/dashboard` | 1.45 KB | **105 KB** | ✅ OK — recharts is lazy |
| `/w/.../b/[boardId]/form` | 12.7 KB | 240 KB | ✅ OK |
| `/w/.../b/[boardId]/kanban` | 15.4 KB | **266 KB** | ✅ OK |
| `/w/.../b/[boardId]/timeline` | 25.1 KB | **183 KB** | ✅ OK |
| `/w/.../b/[boardId]/settings/general` | 18.0 KB | 186 KB | ✅ OK |
| `/w/.../b/[boardId]/settings/members` | 18.5 KB | 192 KB | ✅ OK |
| `/w/.../b/[boardId]/calendar` | 60.1 KB | **319 KB** | ❌ OVER by 19 KB |
| `/w/.../b/[boardId]/table` | 29.4 KB | **396 KB** | ❌ OVER by 96 KB |
| `/w/.../b/[boardId]/t/[taskId]` | 221 B | **755 KB** | ❌ OVER by 455 KB |
| `/w/.../b/[boardId]/(@modal)/t/[taskId]` | 813 B | **756 KB** | ❌ OVER by 456 KB |

## Board Page Status Against 300 KB Budget

**The board table page (`/w/.../b/[boardId]/table`) is OVER BUDGET at 396 KB gzip**
(budget: 300 KB). This is 96 KB above the limit.

The task drawer routes (`/t/[taskId]` and `(@modal)/t/[taskId]`) are critically over at
755–756 KB — primarily due to the Tiptap/ProseMirror bundle loading for the rich-text
comment editor.

The calendar route (`/calendar`) is mildly over at 319 KB (19 KB above limit), driven
by the `react-big-calendar` dependency size.

The dashboard route (`/dashboard`) hits only 105 KB because Epic 12 successfully applied
`next/dynamic` lazy loading for Recharts — this is effective and should be preserved.

## Shared Chunks (loaded on every page)

The 104 KB shared baseline includes:

| Chunk | Gzip | Library |
|---|---|---|
| `e6cca358` | 54.2 KB | `@supabase/ssr`, `@supabase/supabase-js`, core auth |
| `5804` | 46.6 KB | Next.js internals, next-intl, server-action runtime |
| other | 2.76 KB | misc |

Framework (`182 KB` raw / `58 KB` gz) and polyfills (`112 KB` raw / `40 KB` gz) and
`main` (`138 KB` raw / `40 KB` gz) are cached across navigations and not counted
against the per-route 300 KB budget as they are browser-cached after first visit.

## Top Three Offenders on the Board Table Route (396 KB total)

The table route loads these non-shared vendor chunks on top of the 104 KB shared base
and the 19.6 KB board-layout chunk:

| Rank | Chunk | Gzip | Identified Library | Code-Split Candidate? |
|---|---|---|---|---|
| 1 | `9386` | 49.3 KB | `@supabase/realtime-js` (WebSocket, Buffer, base64) | No — Realtime is always needed on the board page |
| 2 | `8397` | 26.4 KB | `mime-db` / file-type detection (likely from `react-dropzone`) | Yes — tree-shake or lazy-load the dropzone in attachments |
| 3 | `2213` | 22.0 KB | Member avatar components, board UI primitives | No — needed for table column headers |

Additional notable chunks loaded by the table route:

- `9655` (18.7 KB gz) — **Zod** validation schemas (table forms and column config)
- `949` (16.3 KB gz) — Board column/cell type registry
- `7617` (14.3 KB gz) — dnd-kit sortable context
- `8664` (14.2 KB gz) — Column config and filter primitives

## Why the Table Route Exceeds Budget

The table route loads all board-level infrastructure in one pass:
`@supabase/realtime-js` (49 KB), `mime-db` (26 KB), Zod (19 KB), dnd-kit (14 KB),
and the full column type registry (16 KB). Together these exceed the budget even before
the table-specific page chunk (26.6 KB gz).

The Epic 12 per-view code splitting **is effective** for Recharts (dashboard, 105 KB)
and to some extent for react-big-calendar (calendar, 319 KB). However, the table route
has not had equivalent splitting applied to its infrastructure.

## Code-Split Candidates

### High impact (file as followups — do NOT fix in this slice):

1. **`mime-db` / `react-dropzone` (26 KB gz):** The attachment dropzone is rendered
   inside the task drawer, not on the board table itself. If `react-dropzone` is
   imported at the module level in a component that the table eagerly loads, it pulls
   `mime-db` into the shared chunk for the table route. This should be lazy-loaded via
   `next/dynamic` at the point where the `<FileDropzone>` component is first rendered
   (inside the task drawer or attachment tab only).

2. **Tiptap/ProseMirror (360 KB gz — chunk `8831`):** This is the primary reason the
   task drawer routes hit 755–756 KB. The rich-text comment editor loads the full
   ProseMirror runtime, all extensions, and the suggestion/mention plugin. This chunk
   is NOT loaded by the table route (confirmed: `8831` is absent from the table's
   bootstrap list). However, opening any task drawer triggers its load. Apply
   `next/dynamic` with `{ ssr: false }` to the `<CommentEditor>` / `<RichTextEditor>`
   component so the 360 KB bundle downloads only when the user actually opens the
   comment tab in a task drawer.

3. **`react-big-calendar` (calendar route, 60.1 KB route-specific gz):** The calendar
   view contributes 60.1 KB of route-specific JS on top of the 319 KB total. The
   react-big-calendar component is already isolated in its own route, but it is
   eager-imported at the page level. Wrapping it in `next/dynamic` with a
   `<Skeleton />` fallback would cut the initial load of the calendar page and avoid
   the FOUC on slower connections.

## Epic 12 Code-Split Verification

Epic 12's dynamic imports remain effective for:

- ✅ **Recharts / react-resizable** (chunk `9845`, 140 KB gz): loaded only by
  `/dashboard` via `next/dynamic`. Absent from all other routes.
- ✅ **react-grid-layout** (`9845` chunk also contains this): same as above.
- ✅ **Table view** is in its own route chunk (`5834`), separate from kanban/calendar.
- ✅ **Kanban view** is in its own route chunk, 15.4 KB route-specific.
- ✅ **Timeline view** is in its own route chunk, 25.1 KB route-specific.

## Followups Filed

The following items exceed the scope of surgical fixes in this slice and are filed here
for the Epic 15 / followup tracking:

**FOLLOWUP-1 (HIGH):** Lazy-load `react-dropzone` / `mime-db` inside the task drawer
using `next/dynamic`. Expected saving: ~26 KB gz off the table route (from 396 KB to
~370 KB).

**FOLLOWUP-2 (CRITICAL):** Lazy-load the Tiptap/ProseMirror comment editor
(`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`, `@tiptap/pm`) via
`next/dynamic({ ssr: false })`. Expected saving: ~360 KB gz off the task drawer routes
(from 756 KB to ~396 KB — still over budget, but manageable with FOLLOWUP-1 applied
simultaneously).

**FOLLOWUP-3 (MEDIUM):** Lazy-load `react-big-calendar` on the calendar page with a
skeleton fallback. Expected saving: reduces calendar route from 319 KB to ~260 KB
(within budget).

**FOLLOWUP-4 (LOW):** Investigate whether Zod (19 KB gz, chunk `9655`) is treeshakable
further. Zod v4 already has good tree-shaking; if the full runtime is included it may
be due to dynamic schema construction in column cell validators.

## Bundle Analyzer Output

The full interactive treemap was generated at `.next/analyze/client.html`,
`.next/analyze/nodejs.html`, and `.next/analyze/edge.html` on this build run.
These files are gitignored (`.next/` is in `.gitignore`) and must be regenerated
locally with `ANALYZE=true pnpm build`.
