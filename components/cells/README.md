# Cells Registry

This directory contains every cell-type implementation used by Donezo's dynamic column system. Each type lives in its own folder named after the type's short string id (e.g. `text/`, `status/`, `person/`). The orchestrator (`CellEditor.tsx`) and render dispatcher (`TableCell.tsx`) look up any type through the central registry in `lib/cells/registry.ts`. To add a new cell type, follow the six steps below.

---

## Step 1 — Extend the `column.type` check constraint

Create a new migration in `supabase/migrations/` to add the new type id to the DB check constraint. The filename must follow the monotonically-increasing timestamp format `YYYYMMDDHHMMSS_add_<typename>_column_type.sql`.

```sql
-- supabase/migrations/20260601120000_add_mytype_column_type.sql

alter table public."column" drop constraint if exists column_type_check;
alter table public."column" add constraint column_type_check check (type in (
  'text', 'long_text', 'status', 'priority', 'person', 'date', 'timeline',
  'number', 'currency', 'checkbox', 'file', 'link', 'tags', 'rating',
  'email', 'phone', 'country', 'vote', 'week', 'location',
  'updated_by', 'created_by', 'created_at_col', 'formula',
  'mytype'
));
```

The drop+recreate is safe because the new constraint is a strict superset of the existing one — no existing rows are invalidated. After creating the file, apply it locally:

```
pnpm db:reset
```

> **Reserved words:** `"group"` and `"column"` must be double-quoted in raw SQL (`public."column"`). In Supabase JS client code, `supabase.from("column")` is correct without quoting.

---

## Step 2 — Regenerate types and update the hand-written union

Run the Supabase type generator to pick up the extended constraint:

```
pnpm db:types
```

> **Important:** Supabase's generator emits `string` for check-constrained columns — it does NOT produce a literal union. You must update two files by hand after regeneration:

1. **`lib/cells/types.ts` — `CellTypeId` union.** Add `'mytype'` to the hand-written union that mirrors the constraint. This union is the single source of truth for TypeScript throughout the registry.

   ```ts
   // lib/cells/types.ts
   export type CellTypeId =
     | "text"
     | /* …existing types… */
     | "mytype"; // <- add here
   ```

2. **`lib/validations/column.ts` — `CellTypeIdSchema`.** Add `'mytype'` to the `z.enum([...])` list so the same set is validated on both client and server via the shared Zod schema.

   ```ts
   // lib/validations/column.ts
   export const CellTypeIdSchema = z.enum([
     "text",
     /* …existing types… */
     "mytype", // <- add here
   ]);
   ```

Keep `CellTypeId` and `CellTypeIdSchema` in sync at all times — they encode the same list.

---

## Step 3 — Create `components/cells/<id>/{def.ts, Cell.tsx, Editor.tsx}`

Create a folder `components/cells/mytype/` with three files. Use `components/cells/text/` as the simplest reference implementation.

### `def.ts` — type definition

Export a named constant `mytypeType: CellTypeDef<TValue, TConfig>` satisfying the full `CellTypeDef` interface from `lib/cells/types.ts`.

```ts
// components/cells/mytype/def.ts
import { SomeLucideIcon } from "lucide-react";
import type { CellTypeDef } from "@/lib/cells/types";
import { Cell } from "./Cell";
import { Editor } from "./Editor";

/** Explicit null patch — set ALL 7 value columns in every toRow() call. */
const NULL_VALUE_PATCH = {
  text_value:    null,
  number_value:  null,
  boolean_value: null,
  date_value:    null,
  date_end_value: null,
  label_id:      null,
  json_value:    null,
} as const;

export const mytypeType: CellTypeDef<string, Record<string, never>> = {
  id: "mytype",
  label: "My Type",
  icon: SomeLucideIcon,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "inline", // or "popover" — see Conventions below

  Cell,
  Editor,

  fromRow: (row) => row?.text_value ?? null,

  toRow: (value) => ({
    ...NULL_VALUE_PATCH,
    text_value: value, // only ONE column gets a real value; the rest stay null
  }),

  filterOperators: ["equals", "contains", "is_empty", "is_not_empty"],
  matchesFilter: (value, op, operand) => { /* … */ return false; },

  aggregations: ["count", "count_empty"],
  aggregate: (values, kind) => { /* return a display-ready string */ return "—"; },

  compare: (a, b) => (a ?? "").localeCompare(b ?? ""),

  convertTo: {
    text: { fn: (v) => v ?? null },
  },
};
```

**`toRow` contract — critical:** Every call to `toRow` MUST explicitly set all seven `cell` value columns (`text_value`, `number_value`, `boolean_value`, `date_value`, `date_end_value`, `label_id`, `json_value`). Only one should carry a real value; the rest must be `null`. This is enforced at the DB level by the `cell_one_value_check` constraint, which permits at most one non-null value column per row.

**`fromRow` contract:** Return the typed value or `null`. When reading from `json_value`, always validate the shape with a runtime guard before casting.

**Derived (read-only) types** (`created_by`, `updated_by`, `created_at_col`): `toRow` returns `{}` (empty object, no write). The `Cell` renderer reads from the parent task's `row` prop directly.

### `Cell.tsx` — read-only renderer

Must be wrapped in `React.memo`. Accepts `{ value, config, row }`. Must not import Supabase or trigger any side effects.

```tsx
// components/cells/mytype/Cell.tsx
"use client";
import React from "react";
import type { TaskRow } from "@/lib/cells/types";

interface Props {
  value: string | null;
  config: Record<string, never>;
  row: TaskRow;
}

function MytypeCellInner({ value }: Props) {
  return (
    <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] border border-[color:var(--color-border-strong)] flex items-center px-2 overflow-hidden">
      {value ? (
        <span className="truncate text-sm text-[color:var(--color-fg)]">{value}</span>
      ) : (
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">Empty</span>
      )}
    </div>
  );
}

export const Cell = React.memo(MytypeCellInner);
Cell.displayName = "MytypeCell";
```

### `Editor.tsx` — edit-mode renderer

Accepts `{ value, config, onChange, onClose }`. Must call `onChange(newValue)` then `onClose()` to commit, or call `onClose()` alone to cancel (Esc). Must NOT import Supabase or call server actions — the orchestrator (`CellEditor.tsx`) owns persistence.

**Inline editors** (e.g. `text`, `number`, `checkbox`) render directly in the cell slot; the component can be a plain `<input>` or similar.

**Popover editors** (e.g. `status`, `date`, `person`) render as CONTENT ONLY — do not include a `<Popover.Root>` wrapper. The `<CellEditor />` orchestrator provides the `<Popover.Root>` and `<Popover.Positioner>` when `def.editorMode === "popover"`. See `components/cells/long_text/Editor.tsx` for the normalized content-only pattern.

---

## Step 4 — Register in `lib/cells/registry.ts`

Import the new type's definition and add it to `cellRegistry`. Imports are kept in alphabetical order by path segment.

```ts
// lib/cells/registry.ts (add import alphabetically)
import { mytypeType } from "@/components/cells/mytype/def";

// In cellRegistry:
export const cellRegistry: Record<CellTypeId, CellTypeDef<any, any>> = {
  // …existing entries…
  mytype: mytypeType,
  // …
};
```

---

## Step 5 — Add to `lib/cells/icons.ts`

Add a `mytype` entry to `CELL_TYPE_ICONS`. Choose a `lucide-react` icon that semantically matches the column type. Import it alongside the existing imports (alphabetical order).

```ts
// lib/cells/icons.ts
import { SomeLucideIcon } from "lucide-react";

export const CELL_TYPE_ICONS: Record<CellTypeId, ComponentType<{ className?: string }>> = {
  // …existing entries…
  mytype: SomeLucideIcon,
};
```

Current icon assignments for reference: `text → Type`, `long_text → AlignLeft`, `status → Circle`, `priority → AlertCircle`, `person → Users`, `date → Calendar`, `timeline → BarChart2`, `number → Hash`, `currency → DollarSign`, `checkbox → CheckSquare`, `file → Paperclip`, `link → Link`, `tags → Tags`, `rating → Star`, `email → Mail`, `phone → Phone`, `country → Globe`, `vote → ThumbsUp`, `week → CalendarDays`, `location → MapPin`, `updated_by → UserCheck`, `created_by → UserPlus`, `created_at_col → Clock`, `formula → Sigma`.

---

## Step 6 — Add to `lib/cells/seed-labels.ts` (label-backed types only)

If your cell type uses `label_id` for its value (like `status` and `priority`), add a default labels array so that `createColumn` seeds sensible options when a board admin adds the first column of that type.

```ts
// lib/cells/seed-labels.ts
export const SEED_LABELS: Partial<Record<CellTypeId, Array<{ name: string; color: string; position: number }>>> = {
  // …existing entries…
  mytype: [
    { name: "Option A", color: "#00c875", position: 1 },
    { name: "Option B", color: "#e2445c", position: 2 },
  ],
};
```

Color values must be raw hex here (same precedent as `lib/group-palette.ts`) because CSS custom properties defined in `app/globals.css` cannot be imported into TypeScript. Use the label-color tokens as your palette: `#00c875` (green), `#e2445c` (red), `#fdab3d` (orange), `#579bfc` (blue), `#a25ddc` (purple), `#c4c4c4` (gray), `#333333` (black/critical).

The empty-state pseudo-label (shown when `cell.label_id IS NULL`) is rendered in the `Cell` component using `--color-label-gray`; no DB row is needed for it.

---

## Where things live

| Artifact | Path |
|---|---|
| DB migration | `supabase/migrations/<TS>_add_<typename>_column_type.sql` |
| TypeScript id union | `lib/cells/types.ts` — `CellTypeId` |
| Zod schema | `lib/validations/column.ts` — `CellTypeIdSchema` |
| Registry | `lib/cells/registry.ts` — `cellRegistry` |
| Icons map | `lib/cells/icons.ts` — `CELL_TYPE_ICONS` |
| Default labels | `lib/cells/seed-labels.ts` — `SEED_LABELS` (label-backed only) |
| Type definition | `components/cells/<id>/def.ts` |
| Read renderer | `components/cells/<id>/Cell.tsx` |
| Edit renderer | `components/cells/<id>/Editor.tsx` |

---

## Conventions

### Cell skeleton

Every `Cell` renderer must match the standard cell skeleton dimensions so the table grid stays aligned:

- **Width:** `min-w-[var(--size-cell-w)]` — resolves to `140px`.
- **Height:** `h-[var(--size-cell-h)]` — resolves to `36px`.
- **Border:** `border border-[color:var(--color-border-strong)]` — 1px solid using the `--color-border-strong` token. Do not use raw hex or Tailwind color-scale classes.
- **Hover ring:** `hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)]` — matches the `text` cell pattern.

### React.memo

All `Cell` components must be wrapped with `React.memo` and have an explicit `displayName` set. Editors do not need memoization because they are mounted only while the cell is active.

### Optional contract props

The `<CellEditor />` orchestrator may pass additional props beyond the base `CellTypeDef.Editor` signature for types that require external data:

- `columnId?: string` — available to editors that need to look up labels for a column (e.g. `status`, `priority`).
- `members?: WorkspaceMember[]` — available to `person` and avatar-style cells.
- `currentUserId?: string` — available to vote-style cells so a user can toggle their own vote.

These props are optional and typed as `unknown` at the registry level. Per-type editors cast them inside the component after a runtime guard.

### No Supabase in editors

`Cell.tsx` and `Editor.tsx` must never import from `@supabase/supabase-js` or call server actions. All persistence is handled by `CellEditor.tsx` (the orchestrator). This keeps per-type editors thin and testable in isolation.

### `editorMode`

Set `editorMode: "inline"` when the editor renders directly inside the cell slot (e.g. a plain `<input>`). Set `editorMode: "popover"` when the editor needs a floating panel (e.g. a date picker or label list). Popover editors must ship as content-only — no `<Popover.Root>` inside the editor component itself.
