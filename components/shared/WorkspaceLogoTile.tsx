import { IconHome, IconLightning } from "@/lib/icons";
import { cn } from "@/lib/utils";

type WorkspaceLogoTileProps = {
  workspaceName?: string | null;
  size?: 30 | 24;
  className?: string;
};

function WorkspaceLogoTile({ workspaceName, size = 30, className }: WorkspaceLogoTileProps) {
  const iconSize = size === 30 ? 18 : 14;
  const homeIconSize = size === 30 ? 10 : 8;

  return (
    <span
      role="img"
      aria-label={workspaceName ?? "Workspace"}
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--color-label-green)",
        borderRadius: 8,
      }}
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
    >
      <IconLightning
        style={{ width: iconSize, height: iconSize }}
        color="white"
        aria-hidden="true"
      />
      <IconHome
        style={{
          width: homeIconSize,
          height: homeIconSize,
          position: "absolute",
          bottom: 1,
          right: 1,
        }}
        color="white"
        aria-hidden="true"
      />
    </span>
  );
}

export type { WorkspaceLogoTileProps };
export { WorkspaceLogoTile };
