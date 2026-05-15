# i18n Workflow — Donezo (next-intl, v1)

## Overview

Donezo uses [next-intl](https://next-intl.dev) for internationalisation. Version 1 ships
English-only. The scaffolding is designed so that adding a second locale later is a
single-JSON-file operation with no code changes required in component logic.

## Key files

| File | Role |
|---|---|
| `messages/en.json` | All extracted user-facing strings, keyed by namespace.key |
| `i18n/request.ts` | Server-side request config — sets `locale = 'en'` and loads messages |
| `next.config.ts` | Wraps the Next.js config with `createNextIntlPlugin()` |
| `app/layout.tsx` | Provides messages to the client tree via `<NextIntlClientProvider>` |

## How to add a key

1. Open `messages/en.json`.
2. Add the key under the appropriate namespace (e.g. `common`, `nav`, `empty`, `account`).
   Follow the existing dot-path convention: `"namespace": { "key": "English string" }`.
3. In a **server component**, call `getTranslations('namespace')` from `next-intl/server`:
   ```ts
   import { getTranslations } from "next-intl/server";
   const t = await getTranslations("namespace");
   return <h1>{t("key")}</h1>;
   ```
4. In a **client component** (`"use client"`), call `useTranslations('namespace')` from `next-intl`:
   ```ts
   import { useTranslations } from "next-intl";
   const t = useTranslations("namespace");
   return <p>{t("key")}</p>;
   ```
5. Run `pnpm typecheck` to verify the key is valid.

## How to add a locale

When the product is ready for a second language (e.g. French):

1. Create `messages/fr.json` with the same key structure as `messages/en.json`.
   Translate every value.
2. Update `i18n/request.ts` to read the locale from the request rather than hardcoding `'en'`:
   ```ts
   export default getRequestConfig(async ({ requestLocale }) => {
     const locale = (await requestLocale) ?? "en";
     return {
       locale,
       messages: (await import(`../messages/${locale}.json`)).default,
     };
   });
   ```
3. If locale routing prefixes are desired (e.g. `/fr/`), add next-intl middleware and a
   `[locale]` segment to the App Router per the
   [next-intl routing docs](https://next-intl.dev/docs/routing). This is the only step
   that requires structural changes.
4. Update the `lang` attribute in `app/layout.tsx` from `lang="en"` to `lang={locale}`.

## Where strings live (v1)

Only top-level UI chrome strings are extracted in v1. These are in `messages/en.json`:

- `nav.*` — sidebar / topbar navigation labels
- `account.theme.*` — theme toggle option labels (System / Light / Dark)
- `common.*` — shared button labels (Cancel / Save / Delete / Add)
- `empty.*` — empty-state titles and descriptions

## What is NOT extracted in v1

The following strings are intentionally left hardcoded in v1 and deferred to a
future locale-add epic:

- Board internals: group names, column headers, cell labels, status/priority option names
- Comment and activity UI text
- Attachment upload UI
- Task drawer field labels
- Toast / error messages
- Form validation messages
- Date/time formatting strings (handled by next-intl's built-in formatters once locale is wired)
- Email templates (`emails/`)

The guiding principle: extract strings that are **always the same** for every user
(global chrome) in v1. User-generated content and board-specific labels are never
translated.
