"use client";

/**
 * LocationEditor — popover-content with lat, lng, and optional label inputs.
 *
 * This component is the popover CONTENT only — no <Popover.Root> here.
 * The orchestrator (<CellEditor />, S15) wraps it with <Popover.Root>.
 *
 * Contract:
 *   - Emit onChange({ lat, lng, label? }) + onClose() on Save or Enter.
 *   - Emit onClose() on Cancel or Escape without committing (Esc handled by
 *     the orchestrator's Popover).
 *   - NO server-action calls. NO Supabase imports.
 */

import { useState } from "react";

import type { LocationValue } from "./def";

interface LocationEditorProps {
  value: LocationValue | null;
  config: Record<string, never>;
  onChange: (next: LocationValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({ value, config: _config, onChange, onClose }: LocationEditorProps) {
  const [lat, setLat] = useState(value?.lat != null ? String(value.lat) : "");
  const [lng, setLng] = useState(value?.lng != null ? String(value.lng) : "");
  const [label, setLabel] = useState(value?.label ?? "");

  const commit = () => {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      onChange(null);
    } else {
      const trimmedLabel = label.trim();
      onChange(
        trimmedLabel
          ? { lat: parsedLat, lng: parsedLng, label: trimmedLabel }
          : { lat: parsedLat, lng: parsedLng },
      );
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3" style={{ minWidth: "var(--size-cell-w)", width: 280 }}>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="location-editor-lat"
          className="text-xs font-medium text-[color:var(--color-fg-muted)]"
        >
          Latitude
        </label>
        <input
          id="location-editor-lat"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          onKeyDown={handleKeyDown}
          // biome-ignore lint/a11y/noAutofocus: cell editor intentionally claims focus when opened by the orchestrator
          autoFocus
          placeholder="e.g. 40.7128"
          className="w-full h-8 px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
          aria-label="Latitude"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="location-editor-lng"
          className="text-xs font-medium text-[color:var(--color-fg-muted)]"
        >
          Longitude
        </label>
        <input
          id="location-editor-lng"
          type="number"
          step="any"
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. -74.0060"
          className="w-full h-8 px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
          aria-label="Longitude"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="location-editor-label"
          className="text-xs font-medium text-[color:var(--color-fg-muted)]"
        >
          Label (optional)
        </label>
        <input
          id="location-editor-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. New York City"
          className="w-full h-8 px-2 text-sm text-[color:var(--color-fg)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-xs)] outline-none focus:outline focus:outline-1 focus:outline-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
          aria-label="Label (optional)"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-xs rounded-[var(--radius-xs)] border border-[color:var(--color-border-strong)] text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          className="px-3 py-1 text-xs rounded-[var(--radius-xs)] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] hover:bg-[color:var(--color-primary-hover)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}
