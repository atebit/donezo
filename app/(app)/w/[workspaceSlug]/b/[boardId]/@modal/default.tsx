/**
 * @modal/default.tsx — null fallback for the @modal parallel route slot.
 *
 * Required by Next.js when a parallel route slot is declared in the layout.
 * Returning null means "nothing in the modal slot" (no drawer open).
 *
 * Next.js parallel-route default files MUST use a default export per the framework convention.
 * The biome noDefaultExport rule is suppressed here for that reason.
 */

// biome-ignore lint/style/noDefaultExport: Next.js parallel-route default files require a default export
export default function Default() {
  return null;
}
