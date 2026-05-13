/**
 * next-intl request configuration (App Router).
 *
 * Called per-request on the server to load the locale and its messages.
 * Single-locale v1: always `'en'`. Locale routing prefixes are disabled.
 *
 * @see https://next-intl.dev/docs/usage/configuration#i18n-request
 */
import { getRequestConfig } from "next-intl/server";

// biome-ignore lint/style/noDefaultExport: next-intl App Router requires a default export for the request config
export default getRequestConfig(async () => {
  const locale = "en";

  return {
    locale,
    // Dynamic import keeps the messages file out of the server bundle for other locales
    // (no-op for single-locale, but establishes the pattern for future locales).
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
