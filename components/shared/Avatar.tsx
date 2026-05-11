import Image from "next/image";

import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: 22 | 24 | 26 | 30 | 37.4;
  borderColor?: "white" | "transparent";
  className?: string;
};

function Avatar({
  src,
  displayName,
  email,
  size = 24,
  borderColor = "transparent",
  className,
}: AvatarProps) {
  const initial = (displayName ?? email ?? "?")[0]?.toUpperCase() ?? "?";
  const altText = displayName ?? email ?? "Avatar";

  const borderStyle =
    borderColor === "white"
      ? { border: "1.6px solid white" }
      : { border: "1.6px solid transparent" };

  const sizeStyle = { width: size, height: size };

  if (src) {
    return (
      <Image
        src={src}
        alt={altText}
        width={size}
        height={size}
        style={{ ...borderStyle, borderRadius: "9999px", objectFit: "cover", flexShrink: 0 }}
        className={cn("rounded-full object-cover shrink-0", className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={displayName ?? email ?? "Unknown user"}
      style={{
        ...sizeStyle,
        ...borderStyle,
        backgroundColor: "var(--color-label-blue)",
        fontSize: Math.round(size * 0.45),
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full shrink-0",
        "text-white font-medium leading-none select-none",
        className,
      )}
    >
      {initial}
    </span>
  );
}

export type { AvatarProps };
export { Avatar };
