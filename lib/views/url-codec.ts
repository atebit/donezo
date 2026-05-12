import { type FilterTree, FilterTreeSchema, type SortKey, SortKeySchema } from "./config-schema";

const MAX_ENCODED_LENGTH = 2048; // 2 KB

/** Base64url-encode JSON. Returns null when input is too large. */
function encodeJson(payload: unknown): string | null {
  const json = JSON.stringify(payload);
  let urlSafe: string;
  if (typeof window === "undefined") {
    urlSafe = Buffer.from(json, "utf8").toString("base64url");
  } else {
    const b64 = btoa(unescape(encodeURIComponent(json)));
    urlSafe = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return urlSafe.length > MAX_ENCODED_LENGTH ? null : urlSafe;
}

function decodeJson<T>(
  encoded: string,
  schema: {
    safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: unknown };
  },
): T | null {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json =
      typeof window === "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : decodeURIComponent(escape(atob(b64)));
    const parsed = schema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeFilterTree(tree: FilterTree): string | null {
  return encodeJson(tree);
}

export function decodeFilterTree(encoded: string): FilterTree | null {
  return decodeJson(encoded, FilterTreeSchema);
}

export function encodeSortKeys(keys: SortKey[]): string | null {
  return encodeJson(keys);
}

export function decodeSortKeys(encoded: string): SortKey[] | null {
  return decodeJson(encoded, {
    safeParse: (v) => SortKeySchema.array().safeParse(v),
  });
}

export const URL_PARAM_KEYS = {
  view: "view",
  filter: "f",
  sort: "s",
  groupBy: "g",
  search: "q",
  density: "d",
} as const;
