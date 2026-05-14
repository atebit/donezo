"use client";

import { createContext, useContext } from "react";

export interface GridTemplateContextValue {
  gridTemplateColumns: string;
}

export const GridTemplateContext = createContext<GridTemplateContextValue>({
  gridTemplateColumns: "auto",
});

export function useGridTemplate(): GridTemplateContextValue {
  return useContext(GridTemplateContext);
}
