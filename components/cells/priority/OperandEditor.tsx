"use client";

/**
 * Priority OperandEditor — compact filter operand input for the "priority" cell type.
 *
 * Priority shares the same label model as status. We re-export the StatusOperandEditor
 * pattern here with priority-appropriate aria labels.
 *
 * compact: true is required by the CellTypeDef.OperandEditor contract.
 */

// Priority is structurally identical to status for filter purposes — same label model.
// We simply re-export the status OperandEditor with the same interface.
export { OperandEditor } from "@/components/cells/status/OperandEditor";
