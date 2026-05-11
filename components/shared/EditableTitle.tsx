"use client";

import {
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

export type EditableTitleHandle = { focus: () => void };

type EditableTitleProps = {
  initialValue: string;
  onCommit: (next: string) => Promise<void> | void;
  className?: string;
  ariaLabel?: string;
  variant?: "h1" | "h4" | "body";
  placeholder?: string;
  readOnly?: boolean;
  onEditingChange?: (editing: boolean) => void;
};

const variantStyles: Record<NonNullable<EditableTitleProps["variant"]>, string> = {
  h1: "text-2xl tracking-[0.5px]",
  h4: "text-[18px] font-semibold",
  body: "text-sm",
};

const EditableTitle = forwardRef<EditableTitleHandle, EditableTitleProps>(function EditableTitle(
  {
    initialValue,
    onCommit,
    className,
    ariaLabel,
    variant = "body",
    placeholder,
    readOnly = false,
    onEditingChange,
  },
  ref,
) {
  const [isEditing, setIsEditing] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const setEditing = useCallback(
    (value: boolean) => {
      setIsEditing(value);
      onEditingChange?.(value);
    },
    [onEditingChange],
  );

  // Expose imperative focus() API so parent components (e.g. overflow menu
  // Rename items) can programmatically enter edit mode without prop drilling.
  useImperativeHandle(ref, () => ({
    focus: () => {
      setEditing(true);
      // Defer focus until after the contentEditable element re-renders
      // in editing mode (next tick).
      setTimeout(() => {
        elementRef.current?.focus();
      }, 0);
    },
  }));

  const getCurrentText = useCallback(() => {
    return elementRef.current?.textContent ?? "";
  }, []);

  const revert = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.textContent = initialValue;
    }
  }, [initialValue]);

  const commit = useCallback(async () => {
    const trimmed = getCurrentText().trim();
    if (!trimmed || trimmed === initialValue) {
      revert();
      setEditing(false);
      return;
    }
    try {
      await onCommit(trimmed);
    } catch {
      revert();
      toast.error("Failed to save title. Changes reverted.");
    } finally {
      setEditing(false);
    }
  }, [getCurrentText, initialValue, onCommit, revert, setEditing]);

  const handleClick = useCallback(() => {
    if (readOnly || isEditing) return;
    setEditing(true);
    // Focus is set by the browser when contentEditable is true and user clicks,
    // but we explicitly focus to ensure it happens programmatically.
    requestAnimationFrame(() => {
      elementRef.current?.focus();
    });
  }, [readOnly, isEditing, setEditing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        elementRef.current?.blur();
      } else if (e.key === "Escape") {
        revert();
        setEditing(false);
        elementRef.current?.blur();
      }
    },
    [revert, setEditing],
  );

  const handleBlur = useCallback(() => {
    if (!isEditing) return;
    void commit();
  }, [isEditing, commit]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: contentEditable div is the correct pattern for inline-editable titles; <input>/<textarea> cannot render inline in a table cell
    <div
      ref={elementRef}
      role="textbox"
      contentEditable={readOnly ? "false" : "true"}
      suppressContentEditableWarning
      tabIndex={readOnly ? -1 : 0}
      // Display mode: aria-readonly="true" so screen readers announce the
      // element as writable. Edit mode: aria-multiline="false" for single-line.
      aria-readonly={!isEditing ? true : undefined}
      aria-multiline={isEditing ? false : undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      data-placeholder={placeholder}
      className={cn(
        "m-0 border-none p-1 outline-none",
        "cursor-text",
        "rounded-[5px]",
        "text-[color:var(--color-fg)]",
        "hover:outline hover:outline-[1px] hover:outline-[var(--color-border-strong)]",
        "focus-visible:outline focus-visible:outline-[1px] focus-visible:outline-[var(--color-primary)]",
        variantStyles[variant],
        readOnly && "cursor-default pointer-events-none",
        className,
      )}
    >
      {initialValue}
    </div>
  );
});

export type { EditableTitleProps };
export { EditableTitle };
