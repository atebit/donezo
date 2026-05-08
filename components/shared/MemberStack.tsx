import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

type Member = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type MemberStackProps = {
  members: Member[];
  max?: number;
  size?: 22 | 24 | 26;
  overlap?: number;
  className?: string;
};

function MemberStack({ members, max = 4, size = 24, overlap = -5, className }: MemberStackProps) {
  const visible = members.slice(0, max);
  const surplus = members.length - visible.length;

  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> is a form element; <span role="group"> is correct for a presentational avatar stack
    <span
      role="group"
      className={cn("inline-flex items-center", className)}
      aria-label={`${members.length} member${members.length !== 1 ? "s" : ""}`}
    >
      {visible.map((member, index) => (
        <span
          key={member.id}
          style={index === 0 ? undefined : { marginLeft: overlap }}
          className="inline-flex"
        >
          <Avatar
            src={member.avatarUrl}
            displayName={member.displayName}
            email={member.email}
            size={size}
            borderColor="white"
          />
        </span>
      ))}
      {surplus > 0 && (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: surplus count span uses aria-label for screen reader clarity; role="img" would be semantically appropriate but biome flags it too
        <span
          aria-label={`${surplus} more member${surplus !== 1 ? "s" : ""}`}
          style={{
            width: size,
            height: size,
            marginLeft: overlap,
            fontSize: 11,
            border: "1px solid var(--color-border)",
            color: "var(--color-fg)",
            backgroundColor: "white",
          }}
          className="inline-flex items-center justify-center rounded-full shrink-0 font-medium leading-none select-none"
        >
          +{surplus}
        </span>
      )}
    </span>
  );
}

export type { Member, MemberStackProps };
export { MemberStack };
