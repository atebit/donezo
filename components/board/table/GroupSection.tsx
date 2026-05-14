"use client";

import type { CSSProperties, ReactNode } from "react";
import { colorToToken } from "./group-color";
import type { Group } from "./types";

interface GroupSectionProps {
  group: Group;
  children: ReactNode;
}

export function GroupSection({ group, children }: GroupSectionProps) {
  return (
    <div
      style={
        {
          "--group-accent": `var(${colorToToken(group.color)})`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
