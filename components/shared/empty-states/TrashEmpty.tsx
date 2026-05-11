import { IconArchive } from "@/lib/icons";

export function TrashEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <IconArchive size={24} style={{ color: "var(--color-fg-muted)" }} aria-hidden="true" />
      <p style={{ fontSize: 14, color: "var(--color-fg-muted)" }}>No archived boards.</p>
    </div>
  );
}
