/// <reference types="vitest" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // Explicitly include only this repo's own test files.
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // Exclude agent worktrees, e2e tests (need Playwright), and policy specs (need pgTAP).
    exclude: [".claude/**", "tests/e2e/**", "tests/policies/**", "node_modules/**"],
    environment: "node",
    passWithNoTests: true,
    // Run the unit setup file before every test module. Sets minimal env stubs.
    setupFiles: ["./tests/unit/setup.ts"],
  },
});
