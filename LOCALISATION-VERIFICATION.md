# sela. localisation verification

Completed on 1 October 2026. The working project is `C:\Users\camar\Documents\Coding\sela-study`; the preview is http://127.0.0.1:4318/.

English (UK), English (US), Spanish, French and Russian are implemented alongside Indonesian. Each language has a complete fixed catalogue with 371 keys: 2,226 entries in total. The app loads these local files directly. There is no runtime AI translation, translation API or generated wording in the browser.

## Coverage

All five app views, navigation, buttons, empty states, forms, placeholders, accessible labels, tooltips, confirmations, toast messages, recovery messages, cloud/Auth errors, 59 theme display names, document language/title/description, the Supabase guide and HTTP 403/404 pages use the selected language. Unknown external errors produce a fixed localised fallback. Supabase Auth codes select localised messages without displaying raw server wording.

| Language | Date entry | Clock | First weekday |
|---|---|---|---|
| Indonesian | DD/MM/YYYY | 24-hour | Monday |
| English (UK) | DD/MM/YYYY | 24-hour | Monday |
| English (US) | MM/DD/YYYY | 12-hour | Sunday |
| Spanish | DD/MM/YYYY | 24-hour | Monday |
| French | DD/MM/YYYY | 24-hour | Monday |
| Russian | DD.MM.YYYY | 24-hour | Monday |

Dates, month/weekday labels, numbers, percentages, durations and plural forms use the corresponding locale. Russian counts cover singular, few, many and fractional forms; Spanish and French include the CLDR `many` category. Regional formatting follows [ECMAScript internationalisation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization), and plural categories follow [Unicode CLDR](https://unicode.org/cldr/charts/49/supplemental/language_plural_rules.html). Auth message mapping uses [Supabase's documented error codes](https://supabase.com/docs/guides/auth/debugging/error-codes).

Study days retain the device's time zone. Locale preferences are saved separately from study data and shared across tabs of the same origin. Language changes preserve unsaved settings, dialog drafts, focus, pending submissions and existing keyed errors. Subjects and tasks retain their original user-entered wording. JSON field names, IDs, date values and Supabase identifiers remain stable.

## Confirmed issues found and fixed during implementation

1. **Date errors retained an old format hint.** A date error created under US English originally retained `MM/DD/YYYY` after changing to French. The error now stores a nested localisation key, so both the sentence and the format hint are resolved in the current language. A regression asserts the change to `JJ/MM/AAAA`.
2. **The mobile dialog clipped the date picker.** At 320 pixels the absolutely positioned popup extended outside the dialog and below its scroll area. Inside dialogs the picker now participates in layout, fits the field width and scrolls into view. The complete calendar was inspected, and arrow-key/Enter selection updated the canonical task date correctly.
3. **The mobile language selector clipped its selected name.** An inherited 45% width limit on the header actions narrowed the control. The mobile actions now have the full available width, and the selector has a stable width with space for the mode button.
4. **Unknown URLs returned English-only text.** The local server now serves a localised error page while preserving HTTP 403/404 status codes and the existing directory-traversal guard. Error pages have a language selector and follow the saved appearance.

## Verification

All nine regression scripts passed on the final JavaScript/server implementation. Run `node sela-audit-repro.mjs` from the project to repeat them and regenerate `sela-fix-evidence.json`.

`tests/localisation.test.mjs` checks key/parameter parity, every declared plural category, all theme labels, six languages across five views and dialog variants, regional date/clock conventions, malformed/leap/early-year dates, preference persistence, cross-tab changes, unchanged study records, pending dialogs and errors, and the actual HTTP handler's 403/404 responses. Existing timer, midnight, concurrency, quota, backup, empty-state and cloud-context regressions remain covered. Cloud tests additionally exercise known and unknown Auth errors in all six languages.

Native in-app browser checks covered all five added languages on all five views at 320 pixels (25 combinations), desktop settings at 1280 and 1440 pixels, all five localised guides at 320 pixels, and missing-page copy in all five languages. Final proof images use a 1440 × 960 Russian desktop and a 390 × 844 French mobile. No horizontal page overflow was found in these checks.

Additional native checks exercised the US calendar/date entry, cross-tab language changes with an open task draft and error, unchanged user text after saving, reload persistence, timer start/pause/finish, French history, Spanish-to-French goal errors, localised URL validation, the repaired date picker and keyboard selection. The temporary QA records were replaced with empty records through normal JSON import after a recovery download. The main preview remains empty and retains its existing Indonesian/appearance preference. No JavaScript errors were reported on the main preview's final check.

All four copied theme files match their original `mental-math-trainer` SHA256 hashes. Theme names are localised outside those files. The interface detector reported two advisory border/shadow combinations in the inherited appearance styles; they are visual advisories and the requested copied files remain unchanged.

Evidence files: `sela-fix-evidence.json`, `sela-localisation-browser-evidence.json`, `sela-localisation-theme-hashes.json`, `sela-localised-desktop.png`, `sela-localised-mobile.png` and `sela-package-verification.json`.

## Practical limits

Live Supabase authentication, cloud storage and service payload limits remain untested because no project/account has been configured. Controlled SDK responses verify the app's localised error handling and account/project guards. Browser/operating-system dialogs, the external Supabase dashboard and external documentation use their providers' language settings. Static hosts need their own configuration to serve the supplied error page for missing routes; the bundled local server already does this.

The wording was reviewed for grammar, spelling, accents, punctuation, regional conventions and consistent terminology during implementation. This is not an independent professional language certification, and automated checks cannot prove every wording choice is perfect.
