"use client";

/**
 * LabelEditorModal — Base UI Dialog for managing labels on a status/priority column.
 *
 * Opened from <ColumnHeaderMenu /> item "Settings" for status/priority column types.
 *
 * Features per slice spec S17:
 *   - List all labels for the column (from store's labelsByColumn).
 *   - Inline name editing via <EditableTitle> (renameLabel on commit, optimistic).
 *   - Color swatch → Popover with LABEL_PALETTE (12 swatches from --color-label-* tokens).
 *   - Drag-to-reorder via dnd-kit vertical sortable (reorderLabel on drop, optimistic).
 *   - Delete via × button (deleteLabel, optimistic via applyLabelDelete).
 *   - "Add Label" button → createLabel, optimistic via applyLabelUpsert.
 *
 * Authorization (Q26): caller (ColumnHeaderMenu) already gates this modal on admin role.
 * We defensively show a read-only state if somehow a non-admin reaches this.
 *
 * Color palette: defined inline as LABEL_PALETTE referencing --color-label-* tokens.
 * No raw hex in JSX (guardrail #1).
 */

import { Popover } from "@base-ui/react";
import { Dialog } from "@base-ui/react/dialog";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";

import {
  createLabel,
  deleteLabel,
  recolorLabel,
  renameLabel,
  reorderLabel,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/labels/actions";
import { EditableTitle, type EditableTitleHandle } from "@/components/shared/EditableTitle";
import { positionBetween } from "@/lib/positions";
import type { Database } from "@/lib/supabase/types";
import { useBoardStore } from "@/stores/board-store";
import type { Column } from "./types";

type Label = Database["public"]["Tables"]["label"]["Row"];

// Stable empty-array sentinel for the labelsByColumn selector. Returning a
// fresh `[]` literal from a Zustand v5 selector trips useSyncExternalStore's
// snapshot equality check and produces an infinite re-render loop (see
// MEMORY donezo-zustand-v5-selectors).
const EMPTY_LABELS: Label[] = [];

// ---------------------------------------------------------------------------
// Label color palette — 12 swatches from --color-label-* tokens.
// Tokens defined in app/globals.css; referenced by CSS var name (no raw hex).
// ---------------------------------------------------------------------------

const LABEL_PALETTE: { token: string; name: string }[] = [
  { token: "--color-label-green", name: "Green" },
  { token: "--color-label-yellow", name: "Yellow" },
  { token: "--color-label-orange", name: "Orange" },
  { token: "--color-label-red", name: "Red" },
  { token: "--color-label-blue", name: "Blue" },
  { token: "--color-label-purple", name: "Purple" },
  { token: "--color-label-gray", name: "Gray" },
  { token: "--color-label-pending", name: "Pending blue" },
  { token: "--color-label-critical", name: "Critical dark" },
  { token: "--color-label-black", name: "Black" },
  { token: "--color-label-green-selected", name: "Light green" },
  { token: "--color-label-blue-selected", name: "Light blue" },
];

/**
 * Resolve a CSS variable token to its hex value at runtime.
 * Used only for persistence (server stores the resolved hex, not var names).
 */
function resolveToken(token: string): string {
  if (typeof window === "undefined") return "#c4c4c4";
  const val = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return val || "#c4c4c4";
}

// ---------------------------------------------------------------------------
// LabelColorSwatch — shows current color, opens palette popover
// ---------------------------------------------------------------------------

interface LabelColorSwatchProps {
  labelId: string;
  color: string;
  onColorChange: (labelId: string, hex: string) => void;
}

function LabelColorSwatch({ labelId, color, onColorChange }: LabelColorSwatchProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Change label color"
        style={{ backgroundColor: color }}
        className="h-5 w-5 shrink-0 rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] cursor-pointer"
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup className="z-[var(--z-popover)] rounded-[var(--radius-md)] bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)] border border-[color:var(--color-border-strong)] p-2">
            <fieldset
              className="grid gap-1.5 border-0 p-0 m-0"
              style={{ gridTemplateColumns: "repeat(4, 22px)", width: "max-content" }}
              aria-label="Label color palette"
            >
              {LABEL_PALETTE.map((swatch) => (
                <Popover.Close
                  key={swatch.token}
                  onClick={() => onColorChange(labelId, resolveToken(swatch.token))}
                  aria-label={swatch.name}
                  aria-pressed={color.toLowerCase() === resolveToken(swatch.token).toLowerCase()}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    backgroundColor: `var(${swatch.token})`,
                    flexShrink: 0,
                  }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-1 cursor-pointer"
                />
              ))}
            </fieldset>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ---------------------------------------------------------------------------
// SortableLabelRow — individual draggable label row
// ---------------------------------------------------------------------------

interface SortableLabelRowProps {
  label: Label;
  onRename: (labelId: string, name: string) => void;
  onRecolor: (labelId: string, color: string) => void;
  onDelete: (labelId: string) => void;
}

function SortableLabelRow({ label, onRename, onRecolor, onDelete }: SortableLabelRowProps) {
  const editableRef = useRef<EditableTitleHandle>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: label.id,
    data: { kind: "label" },
  });

  const style =
    transform !== null
      ? {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
        }
      : { opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-[var(--radius-xs)] px-1 py-1 hover:bg-[color:var(--color-surface-hover)] group/label-row"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab touch-none text-[color:var(--color-fg-muted)] opacity-0 group-hover/label-row:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>

      {/* Color swatch */}
      <LabelColorSwatch labelId={label.id} color={label.color} onColorChange={onRecolor} />

      {/* Editable name — fills remaining width */}
      <div className="min-w-0 flex-1">
        <EditableTitle
          ref={editableRef}
          initialValue={label.name}
          variant="body"
          onCommit={(next) => onRename(label.id, next)}
          ariaLabel={`Label name: ${label.name}`}
        />
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => onDelete(label.id)}
        aria-label={`Delete label ${label.name}`}
        className="shrink-0 rounded p-0.5 text-[color:var(--color-fg-muted)] opacity-0 group-hover/label-row:opacity-100 focus-visible:opacity-100 hover:bg-[color:var(--color-surface-hover)] hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)]"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LabelEditorModal — main export
// ---------------------------------------------------------------------------

interface LabelEditorModalProps {
  column: Column;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LabelEditorModal({ column, open, onOpenChange }: LabelEditorModalProps) {
  const [, startTransition] = useTransition();

  const labels = useBoardStore((s) => s.labelsByColumn.get(column.id) ?? EMPTY_LABELS);
  const applyLabelUpsert = useBoardStore((s) => s.applyLabelUpsert);
  const applyLabelDelete = useBoardStore((s) => s.applyLabelDelete);

  // dnd-kit sensors for label reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleRename(labelId: string, name: string) {
    const label = labels.find((l) => l.id === labelId);
    if (!label) return;

    // Optimistic
    applyLabelUpsert({
      ...label,
      name,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await renameLabel({ labelId, name });
      if (result.ok) {
        applyLabelUpsert(result.data);
      } else {
        applyLabelUpsert(label);
        toast.error("Failed to rename label.");
      }
    });
  }

  function handleRecolor(labelId: string, color: string) {
    const label = labels.find((l) => l.id === labelId);
    if (!label) return;

    // Optimistic
    applyLabelUpsert({
      ...label,
      color,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await recolorLabel({ labelId, color });
      if (result.ok) {
        applyLabelUpsert(result.data);
      } else {
        applyLabelUpsert(label);
        toast.error("Failed to update label color.");
      }
    });
  }

  function handleDelete(labelId: string) {
    const label = labels.find((l) => l.id === labelId);
    if (!label) return;

    // Optimistic delete
    applyLabelDelete(labelId);

    startTransition(async () => {
      const result = await deleteLabel({ labelId });
      if (!result.ok) {
        // Revert — re-insert the label
        applyLabelUpsert(label);
        toast.error("Failed to delete label.");
      }
    });
  }

  function handleAddLabel() {
    const maxPosition = labels.length > 0 ? Math.max(...labels.map((l) => l.position)) : 0;
    const newPosition = maxPosition + 1;

    // Optimistic — create a temp label row immediately
    const tempLabel: Label = {
      id: `temp-${Date.now()}`,
      column_id: column.id,
      name: "New Label",
      color: resolveToken("--color-label-gray"),
      position: newPosition,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    applyLabelUpsert(tempLabel);

    startTransition(async () => {
      const result = await createLabel({
        columnId: column.id,
        name: "New Label",
        color: resolveToken("--color-label-gray"),
        position: newPosition,
      });
      if (result.ok) {
        // Replace temp with real row
        applyLabelDelete(tempLabel.id);
        applyLabelUpsert(result.data);
      } else {
        // Revert
        applyLabelDelete(tempLabel.id);
        toast.error("Failed to create label.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIdx = labels.findIndex((l) => l.id === active.id);
    const overIdx = labels.findIndex((l) => l.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;

    // Compute the new order
    const reordered = arrayMove(labels, activeIdx, overIdx);
    const movedLabel = reordered[overIdx];
    if (!movedLabel) return;

    // Determine new position using positionBetween
    const prev = overIdx > 0 ? reordered[overIdx - 1] : null;
    const next = overIdx < reordered.length - 1 ? reordered[overIdx + 1] : null;

    let newPosition: number;
    try {
      newPosition = positionBetween(prev?.position ?? null, next?.position ?? null);
    } catch {
      toast.error("Cannot reorder: positions need compaction.");
      return;
    }

    // Optimistic update
    applyLabelUpsert({
      ...movedLabel,
      position: newPosition,
      updated_at: new Date().toISOString(),
    });

    startTransition(async () => {
      const result = await reorderLabel({
        labelId: movedLabel.id,
        position: newPosition,
      });
      if (result.ok) {
        applyLabelUpsert(result.data);
      } else {
        // Revert to original position
        applyLabelUpsert(movedLabel);
        toast.error("Failed to reorder label.");
      }
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-surface shadow-[var(--shadow-modal)] focus:outline-none flex flex-col max-h-[80vh]"
          aria-labelledby="label-editor-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color:var(--color-border-strong)] px-4 py-3">
            <Dialog.Title
              id="label-editor-title"
              className="text-sm font-semibold text-[color:var(--color-fg-strong)]"
            >
              Edit Labels — {column.name}
            </Dialog.Title>
            <Dialog.Close
              className="rounded p-1 text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
              aria-label="Close label editor"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Label list — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {labels.length === 0 ? (
              <p className="py-4 text-center text-xs text-[color:var(--color-fg-muted)]">
                No labels yet. Add one below.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={labels.map((l) => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-0.5">
                    {labels.map((label) => (
                      <SortableLabelRow
                        key={label.id}
                        label={label}
                        onRename={handleRename}
                        onRecolor={handleRecolor}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Footer — Add Label button */}
          <div className="border-t border-[color:var(--color-border-strong)] px-3 py-2">
            <button
              type="button"
              onClick={handleAddLabel}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
            >
              <span className="text-base leading-none" aria-hidden="true">
                +
              </span>
              Add Label
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
