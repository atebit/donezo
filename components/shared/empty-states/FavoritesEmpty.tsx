import { IconStar } from "@/lib/icons";

export function FavoritesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
      <IconStar
        size={80}
        style={{ color: "var(--color-fg-muted)", opacity: 0.4 }}
        aria-hidden="true"
      />
      <p style={{ fontSize: 15, lineHeight: 1.5, color: "var(--color-fg)" }}>
        Easily Access Your Favorite Boards
      </p>
    </div>
  );
}
