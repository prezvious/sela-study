# Localisation design

Keep the existing Indonesian UI and add en-GB, en-US, es-ES, fr-FR and ru-RU. All wording comes from bundled, fixed catalogues. No translation API, AI model or runtime translation generation is used.

A small shared module provides catalogue lookup, interpolation, Intl plural rules, regional date/time/number/unit formatting, and an independently persisted language preference. Study records and their JSON schema remain unchanged. Cross-tab language changes affect both the app and guide. User-authored names are not translated.

Replace app, core, storage and cloud messages with explicit keys. Errors retain their key/parameters so an existing error or toast can be re-rendered in a new language. Re-render open modal content while retaining its draft fields, focus and pending state. Use localized validation instead of browser-supplied English messages.

Date fields display the chosen locale's date order. A small app-owned calendar picker provides localized month/day/navigation labels independently of browser chrome. US calendars start Sunday; other supported calendars start Monday. Machine identifiers, backup schema fields and filenames' ISO date suffixes remain stable.

Translate theme display names outside the copied vendor files. Preserve their original keys, tokens and exact source bytes. Accommodate Cyrillic and longer labels with app styles only.

Verify catalogue key/parameter/plural parity, zero unresolved tokens, number/date conventions, Russian singular/few/many forms, backwards-compatible backups, live switching in all pages/dialogs/guide, native browser validation, cross-tab persistence, and mobile/desktop layouts. Retain the existing regression coverage. Live Supabase remains unavailable; exercise its localized errors using controlled SDK responses.
