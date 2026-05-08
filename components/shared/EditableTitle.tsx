"use client";

import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

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

function EditableTitle({
  initialValue,
  onCommit,
  className,
  ariaLabel,
  variant = "body",
  placeholder,
  readOnly = false,
  onEditingChange,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const elementRef = useRef<HTMLQuoteElement>(null);

  const setEditing = useCallback(
    (value: boolean) => {
      setIsEditing(value);
      onEditingChange?.(value);
    },
    [onEditingChange],
  );

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
    (e: KeyboardEvent<HTMLQuoteElement>) => {
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

  // Compute ARIA role / level for non-editing display and editing modes.
  const role = isEditing ? "textbox" : variant === "h1" || variant === "h4" ? "heading" : undefined;
  const ariaLevel =
    !isEditing && variant === "h1" ? 1 : !isEditing && variant === "h4" ? 2 : undefined;

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is set dynamically to "heading" when aria-level is present
    <blockquote
      ref={elementRef}
      contentEditable={readOnly ? "false" : "true"}
      suppressContentEditableWarning
      role={role}
      aria-level={ariaLevel}
      aria-label={isEditing && ariaLabel ? ariaLabel : undefined}
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
    </blockquote>
  );
}

export type { EditableTitleProps };
export { EditableTitle };
