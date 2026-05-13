# Add a Cell Type

## When to use this runbook

Use this runbook when adding a new column/cell type to the Donezo board (e.g. a new
data type that does not yet exist in `lib/cells/types.ts`). Examples: `barcode`,
`dependency`, `mirror`.

The cell registry lives in `lib/cells/registry.ts`. Every registered type must
satisfy the `CellTypeDef<TValue, TConfig>` interface defined in `lib/cells/types.ts`.

## Pre-flight

- Read `lib/cells/types.ts` in full. `CellTypeDef` is the contract — every field is
  required unless marked optional.
- Read an existing simple cell type for reference (e.g. `components/cells/checkbox/def.ts`
  or `components/cells/text/def.ts`).
- Determine your type's string id. It must be a lowercase snake_case string (e.g.
  `barcode`). It cannot collide with an existing `CellTypeId`.
- Decide whether the editor renders `"inline"` (directly inside the table cell) or
  `"popover"` (in a floating Base UI Popover). Most types use `"popover"`.

## Steps

### 1. Add the id to `CellTypeId`

In `lib/cells/types.ts`, add the new id to the `CellTypeId` union:

```ts
export type CellTypeId =
  | "text"
  // ... existing types ...
  | "barcode"; // new
```

Also add it to the `cell_type` check constraint in a migration (see **Step 4**).

### 2. Add a migration for the check constraint

The `column_type_check` constraint in Postgres must be extended to allow the new
type string. Create a new migration:

```bash
supabase migration new extend_column_type_barcode
```

In the generated file (`supabase/migrations/<timestamp>_extend_column_type_barcode.sql`):

```sql
-- Extend column_type_check to include the new type id.
ALTER TABLE public.column
  DROP CONSTRAINT IF EXISTS column_type_check,
  ADD CONSTRAINT column_type_check CHECK (
    type IN (
      'text', 'long_text', 'status', 'priority', 'person', 'date', 'timeline',
      'number', 'currency', 'checkbox', 'file', 'link', 'tags', 'rating',
      'email', 'phone', 'country', 'vote', 'week', 'location',
      'updated_by', 'created_by', 'created_at_col', 'formula',
      'barcode' -- new
    )
  );
```

Run `supabase db reset` locally to verify the migration applies cleanly.

### 3. Add RLS check if needed

If the new type introduces new tables (unlikely for most column types — cells share the
`cell` table), or if mutations require additional authorization checks, add RLS policies
in the migration. For column types that only read/write to the `cell` table, no new
RLS is needed — the existing `cell` table policies apply.

If the new type has a companion table (e.g. a `barcode_scan` table):
- Enable RLS on it: `ALTER TABLE public.barcode_scan ENABLE ROW LEVEL SECURITY;`
- Add policies scoped to `workspace_member` / `board_member` using the existing helper
  functions (`role_for_workspace`, `is_workspace_member`) — see
  `supabase/migrations/20260507120000_authz_helpers.sql`.

### 4. Create the type definition file

Create `components/cells/<type_id>/def.ts`:

```ts
// components/cells/barcode/def.ts
import type { CellTypeDef } from "@/lib/cells/types";
import { BarcodeIcon } from "lucide-react";
import { BarcodeCell } from "./cell";
import { BarcodeEditor } from "./editor";

type BarcodeValue = string; // e.g. the raw barcode string
type BarcodeConfig = Record<string, never>; // no per-column config needed

export const barcodeType: CellTypeDef<BarcodeValue, BarcodeConfig> = {
  id: "barcode",
  label: "Barcode",
  icon: BarcodeIcon,
  defaultConfig: {},
  defaultValue: null,
  editorMode: "popover",

  fromRow: (row) => row?.value_text ?? null,
  toRow: (value) => ({
    value_text: value,
    value_number: null,
    value_bool: null,
    value_json: null,
    // ... null all other value columns
  }),

  Cell: BarcodeCell,
  Editor: BarcodeEditor,

  aggregations: ["count", "count_empty"],
  aggregate: (values, kind) => {
    if (kind === "count") return String(values.filter(Boolean).length);
    if (kind === "count_empty") return String(values.filter((v) => !v).length);
    return "";
  },

  filterOperators: ["equals", "not_equals", "contains", "is_empty", "is_not_empty"],
  matchesFilter: (value, op, operand) => {
    if (op === "is_empty") return value === null || value === "";
    if (op === "is_not_empty") return value !== null && value !== "";
    if (op === "equals") return value === operand;
    if (op === "not_equals") return value !== operand;
    if (op === "contains") return typeof operand === "string" && (value ?? "").includes(operand);
    return false;
  },

  toSearchString: (value) => value ?? "",
  compare: (a, b) => (a ?? "").localeCompare(b ?? ""),
  convertTo: {
    text: { fn: (v) => v, lossy: false },
  },
};
```

Create `components/cells/<type_id>/cell.tsx` (read-mode renderer) and
`components/cells/<type_id>/editor.tsx` (edit-mode renderer) following the patterns
from existing cell types.

### 5. Register the type in the registry

In `lib/cells/registry.ts`, import the definition and add it:

```ts
import { barcodeType } from "@/components/cells/barcode/def";

export const cellRegistry: Record<CellTypeId, CellTypeDef<any, any>> = {
  // ... existing entries ...
  barcode: barcodeType,
};
```

### 6. Add the server action for cell updates

Cell mutations go through the existing `updateCell` server action
(`app/**/actions.ts` for the board route). If the new type introduces a new value
column in the `cell` table, ensure:
- The migration adds the column.
- `toRow` in the def explicitly nulls all other value columns.
- The `cell_one_value_check` constraint (if present) is updated to include the new
  column.

No new server action is needed unless the cell type has compound write semantics
(e.g. it writes to a separate table).

### 7. Update `CellTypeIdSchema` in validations

`lib/validations/column.ts` exports a `CellTypeIdSchema` Zod enum. Add the new id:

```ts
export const CellTypeIdSchema = z.enum([
  "text", /* ... */ "barcode",
]);
```

### 8. Run tests

```bash
pnpm typecheck
pnpm lint
pnpm test
```

## Verification

- `pnpm typecheck` passes — no missing keys in `cellRegistry`.
- The new type appears in the add-column picker in the UI.
- A column of the new type can be created, edited, and filtered.
- `supabase db reset` applies cleanly with the new migration.
- Existing cell type tests still pass.

## Rollback

If the new cell type causes regressions:
1. Remove the import and registry entry from `lib/cells/registry.ts`.
2. Remove the `CellTypeId` union entry.
3. Revert the Zod schema.
4. The migration must be reverted via a down migration (add the constraint back
   without the new type id) and `supabase db reset`.

## Related runbooks

- [incident-response.md](incident-response.md) — if a bad cell type makes it to production
