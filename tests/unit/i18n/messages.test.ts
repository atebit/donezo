/**
 * tests/unit/i18n/messages.test.ts
 *
 * Verifies that every next-intl translation key referenced in app/, components/,
 * and lib/ source files resolves to a non-empty string in messages/en.json.
 *
 * Strategy:
 *  1. Parse each source file for `useTranslations('namespace')` / `getTranslations('namespace')` calls.
 *  2. In the same file, collect `t('key')` call arguments (string literals only).
 *  3. Build fully-qualified keys: `namespace.key`.
 *  4. Verify each key exists and has a non-empty string value in en.json.
 *
 * Note: Variable-based t() calls (e.g. t(variable)) are not checked via regex;
 * their namespaces are verified to exist in en.json separately.
 */

import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const MESSAGES_PATH = path.join(ROOT, "messages/en.json");

// ---------------------------------------------------------------------------
// Load en.json
// ---------------------------------------------------------------------------

const messages: Record<string, unknown> = JSON.parse(readFileSync(MESSAGES_PATH, "utf-8"));

/**
 * Resolve a dot-path key like "empty.noTasks.title" through the messages object.
 * Returns the value or undefined if not found.
 */
function resolvePath(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Collect source files
// ---------------------------------------------------------------------------

const SOURCE_DIRS = ["app", "components", "lib"];

function collectSourceFiles(): string[] {
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) {
    const dirPath = path.join(ROOT, dir);
    try {
      const found = globSync("**/*.{ts,tsx}", {
        cwd: dirPath,
        ignore: ["**/*.test.*", "**/*.spec.*", "**/node_modules/**"],
      });
      for (const f of found) {
        files.push(path.join(dirPath, f));
      }
    } catch {
      // Directory doesn't exist — skip
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Parse a single source file for (namespace, key) pairs
// ---------------------------------------------------------------------------

type TranslationRef = {
  file: string;
  namespace: string;
  key: string;
  fullKey: string;
};

/**
 * Extract translation references from a source file.
 *
 * Matches patterns like:
 *   useTranslations("some.namespace")  / useTranslations('some.namespace')
 *   getTranslations("some.namespace")  / getTranslations('some.namespace')
 *
 * And then all t("key") / t('key') string-literal calls in the same file.
 *
 * Returns an array of { namespace, key, fullKey } tuples for literal-key calls.
 * Also returns the list of namespaces for callers to do additional checks.
 */
type FileAnalysis = {
  refs: TranslationRef[];
  namespaces: string[];
};

function analyzeFile(filePath: string): FileAnalysis {
  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    return { refs: [], namespaces: [] };
  }

  // Extract namespaces used in this file
  const nsPattern = /(?:useTranslations|getTranslations)\(\s*["']([^"']+)["']\s*\)/g;
  const namespaces: string[] = [];
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = nsPattern.exec(source)) !== null) {
    if (m[1]) namespaces.push(m[1]);
  }

  if (namespaces.length === 0) return { refs: [], namespaces: [] };

  // Extract t("key") calls — only single-level string literal keys (no dots)
  // to avoid false positives with full-path strings.
  const tPattern = /\bt\(\s*["']([^"'.]+)["']\s*\)/g;
  const keys: string[] = [];
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = tPattern.exec(source)) !== null) {
    if (m[1]) keys.push(m[1]);
  }

  // Cross-product: each namespace × each literal key
  const refs: TranslationRef[] = [];
  if (keys.length > 0) {
    for (const ns of namespaces) {
      for (const key of keys) {
        refs.push({
          file: filePath.replace(`${ROOT}/`, ""),
          namespace: ns,
          key,
          fullKey: `${ns}.${key}`,
        });
      }
    }
  }

  return { refs, namespaces };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("messages/en.json", () => {
  it("exists and is valid JSON with at least one key", () => {
    expect(typeof messages).toBe("object");
    expect(Object.keys(messages).length).toBeGreaterThan(0);
  });

  it("contains all required top-level namespaces", () => {
    const required = ["nav", "account", "common", "empty"];
    for (const ns of required) {
      expect(messages, `Missing namespace: ${ns}`).toHaveProperty(ns);
    }
  });

  it("contains all spec-required keys", () => {
    const requiredKeys = [
      "nav.home",
      "nav.notifications",
      "nav.account",
      "nav.signOut",
      "account.theme.system",
      "account.theme.light",
      "account.theme.dark",
      "common.cancel",
      "common.save",
      "common.delete",
      "common.add",
      "empty.noBoards.title",
      "empty.noBoards.description",
      "empty.noTasks.title",
      "empty.noTasks.description",
      "empty.noNotifications.title",
      "empty.noNotifications.description",
    ];

    for (const key of requiredKeys) {
      const value = resolvePath(messages, key);
      expect(value, `Key "${key}" missing or not a string`).toBeTruthy();
      expect(typeof value, `Key "${key}" is not a string`).toBe("string");
      expect((value as string).length, `Key "${key}" is empty`).toBeGreaterThan(0);
    }
  });
});

describe("translation key coverage", () => {
  const files = collectSourceFiles();
  const allRefs: TranslationRef[] = [];
  const allNamespaces = new Set<string>();

  for (const f of files) {
    const { refs, namespaces } = analyzeFile(f);
    allRefs.push(...refs);
    for (const ns of namespaces) allNamespaces.add(ns);
  }

  it("finds source files that use useTranslations", () => {
    // At minimum ThemeToggle, NoBoardsInWorkspace, BoardCardList, NotificationList
    expect(allNamespaces.size).toBeGreaterThanOrEqual(4);
  });

  it("expected namespaces are referenced in source", () => {
    const expectedNamespaces = [
      "account.theme",
      "empty.noBoards",
      "empty.noTasks",
      "empty.noNotifications",
    ];
    for (const ns of expectedNamespaces) {
      expect(allNamespaces.has(ns), `Namespace "${ns}" not found in any source file`).toBe(true);
    }
  });

  it("every namespace referenced in source resolves in en.json", () => {
    const missingNamespaces: string[] = [];
    for (const ns of allNamespaces) {
      const value = resolvePath(messages, ns);
      if (value == null) {
        missingNamespaces.push(ns);
      }
    }
    expect(
      missingNamespaces,
      `Namespaces referenced in source but missing from en.json:\n${missingNamespaces.join("\n")}`,
    ).toHaveLength(0);
  });

  it("finds at least 6 literal t() key references in source", () => {
    // NoBoardsInWorkspace (2: title, description) + BoardCardList (2) + NotificationList (2)
    // ThemeToggle uses t(variable) not literal strings — counted separately above.
    expect(allRefs.length).toBeGreaterThanOrEqual(6);
  });

  it("every literal t() key reference resolves to a non-empty string in en.json", () => {
    const missingKeys: string[] = [];

    for (const ref of allRefs) {
      const value = resolvePath(messages, ref.fullKey);
      if (typeof value !== "string" || value.length === 0) {
        missingKeys.push(`${ref.fullKey} (in ${ref.file})`);
      }
    }

    expect(
      missingKeys,
      `Keys referenced in source but missing from en.json:\n${missingKeys.join("\n")}`,
    ).toHaveLength(0);
  });
});
