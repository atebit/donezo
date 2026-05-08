"use client";

import { useState } from "react";
import { CreateWorkspaceModal } from "@/components/shared/CreateWorkspaceModal";
import { NoWorkspaces } from "@/components/shared/empty-states/NoWorkspaces";

export function FirstRun() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <NoWorkspaces onCreate={() => setOpen(true)} />
      <CreateWorkspaceModal open={open} onOpenChange={setOpen} />
    </>
  );
}
