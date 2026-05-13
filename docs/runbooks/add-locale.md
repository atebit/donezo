# Add a Locale

## When to use this runbook

Use this runbook when the product is ready to support a second language and you need
to add a new locale (e.g. French `fr`, Spanish `es`, German `de`) to the
[next-intl](https://next-intl.dev) configuration.

This is a polished, evergreen version of the workflow documented during Epic 14.
The authoritative technical reference is
[`docs/conversion-plan/_dispatch/epic-14-i18n-workflow.md`](../conversion-plan/_dispatch/epic-14-i18n-workflow.md).

Version 1 of Donezo ships English-only. The i18n scaffolding is designed so that
adding a locale is a single-JSON-file operation with no changes to component logic
(for strings already extracted). Strings intentionally left hardcoded in v1 are
listed at the end of this runbook.

## Pre-flight

- Confirm the locale code you want to add is a valid BCP 47 tag (e.g. `fr`, `es`,
  `de`, `pt-BR`).
- Confirm all strings in `messages/en.json` are up to date (run `pnpm typecheck`
  to surface any type errors in translation key usage).
- Have a translator or translation service ready to provide the full `messages/en.json`
  key set in the target language.

## Steps

### 1. Create the translation file

Create `messages/<locale>.json` with the same key structure as `messages/en.json`.
Translate every value. Example for French:

```bash
cp messages/en.json messages/fr.json
# Then translate each string value in messages/fr.json
```

Every key present in `en.json` must also be present in the new file, or next-intl
will fall back to the English value (the fallback locale is configurable — see
`i18n/request.ts`).

### 2. Update `i18n/request.ts` to use dynamic locale

Replace the hardcoded `'en'` with the request locale:

```ts
// i18n/request.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? "en";
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### 3. Add locale routing (optional — only if URL prefixes are desired)

If you want locale-prefixed URLs (e.g. `/fr/dashboard`):

1. Follow the [next-intl routing docs](https://next-intl.dev/docs/routing) to add
   next-intl middleware and a `[locale]` dynamic segment to the App Router.
2. Update `middleware.ts` to use next-intl's `createMiddleware` with a `locales` array.
3. This is the only step that requires structural route changes.

If URL prefixes are not desired, next-intl can detect locale from the `Accept-Language`
header or a user preference stored in the database/cookie — configure in `i18n/request.ts`.

### 4. Update the `lang` attribute in `app/layout.tsx`

Change:
```tsx
<html lang="en">
```
to:
```tsx
<html lang={locale}>
```

Where `locale` is resolved from the request config.

### 5. Verify typecheck

```bash
pnpm typecheck
```

next-intl's TypeScript integration will catch missing keys if you have the
`createTranslator` type augmentation set up.

### 6. Test locally

```bash
pnpm dev
```

Navigate the app with the browser's language preference set to the new locale
(or add a locale switcher). Confirm translated strings appear.

## Verification

- `pnpm typecheck` passes with no translation-key errors.
- All UI chrome strings (nav, buttons, empty states) are translated.
- Date and number formatting respects the new locale (next-intl uses the Intl API).
- The `lang` attribute on `<html>` is correct in the rendered HTML.

## Rollback

If the new locale causes regressions:
1. Remove `messages/<locale>.json`.
2. Revert `i18n/request.ts` to hardcode `locale = 'en'`.
3. Deploy.

## Strings NOT extracted in v1

The following strings are intentionally hardcoded in v1 and will need extraction
in a future locale pass:

- Board internals: group names, column headers, cell labels, status/priority option names
- Comment and activity UI text
- Attachment upload UI
- Task drawer field labels
- Toast and error messages
- Form validation messages
- Date/time formatting strings (handled by next-intl's Intl formatters once locale is wired)
- Email templates (`emails/`)

## Related runbooks

- None specific. See [epic-14-i18n-workflow.md](../conversion-plan/_dispatch/epic-14-i18n-workflow.md)
  for the original scaffolding notes.
