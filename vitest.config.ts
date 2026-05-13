/// <reference types="vitest" />
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, ".") };
const setupFiles = ["./tests/unit/setup.ts"];
const exclude = [".claude/**", "tests/e2e/**", "tests/policies/**", "node_modules/**"];

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    /**
     * Use vitest 4 `projects` to route test files to different environments.
     * .test.tsx files (React components / hooks) run in jsdom.
     * .test.ts files (pure logic, server actions) run in node.
     *
     * This replaces the vitest ≤3 `environmentMatchGlobs` option which was
     * removed in vitest 4.
     */
    projects: [
      {
        // Component / hook tests that use @testing-library/react need jsdom.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "dom",
          include: ["tests/unit/**/*.test.tsx", "tests/unit/**/*.spec.tsx"],
          exclude,
          environment: "jsdom",
          // Provide a URL so jsdom enables localStorage / sessionStorage.
          // Required for Zustand persist middleware (useBoardStore).
          environmentOptions: {
            jsdom: { url: "http://localhost:3000" },
          },
          setupFiles,
        },
      },
      {
        // Pure-logic and server-only tests that don't need a DOM.
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "node",
          include: [
            "tests/unit/**/*.test.ts",
            "tests/unit/**/*.spec.ts",
            "tests/integration/**/*.test.ts",
          ],
          exclude,
          environment: "node",
          setupFiles,
        },
      },
    ],
    // Top-level fallback (used when no project matches, e.g. direct file args).
    passWithNoTests: true,
  },
});
