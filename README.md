# sela. — A space to study

sela. is a small, multilingual study workspace for tracking time by subject, planning tasks, and seeing how your study habits develop. Create an account or sign in to automatically save and sync your workspace across devices and application addresses. Guest study remains available with records saved in your browser.

The application uses plain HTML, CSS, and JavaScript modules. There is no frontend build step or package installation for normal use.

## Contents

- [Run locally](#run-locally)
- [Start studying](#start-studying)
- [Features](#features)
- [How time and statistics work](#how-time-and-statistics-work)
- [Storage and JSON backups](#storage-and-json-backups)
- [Supabase setup](#supabase-setup)
- [Languages and appearance](#languages-and-appearance)
- [Static hosting](#static-hosting)
- [Development and tests](#development-and-tests)
- [Troubleshooting](#troubleshooting)
- [Theme attribution and licence](#theme-attribution-and-licence)

## Run locally

Use Node.js 24.x and a modern browser with JavaScript enabled. The verification suite was run with Node.js **v24.18.0**.

```sh
git clone https://github.com/prezvious/sela-study.git
cd sela-study
node server.mjs
```

Open **[http://127.0.0.1:4318/](http://127.0.0.1:4318/)**. Keep that terminal running; press `Ctrl+C` to stop the server. If you already have the repository, run `node server.mjs` from its root directory.

The preview server serves `dist/` and listens only on your computer's loopback address. Open the application through HTTP or HTTPS so the browser can load its JavaScript modules. Opening `dist/index.html` directly as a file is unsupported.

## Start studying

1. Choose a language in the header or in **Settings → Appearance → Language**. Indonesian is the initial default.
2. Open **Subjects** and add a subject, such as Mathematics. New users start with empty records.
3. Return to **Study**, choose your subject, and start the stopwatch. Pause for breaks, resume when ready, and finish when the study session is complete.
4. Add a task for the selected date. A task can be linked to a subject or kept independent.
5. Use **Statistics** and **Calendar** to review your time. Set a daily goal in Settings and export a JSON backup periodically.

Archiving a subject keeps its history. You can restore it later; archived subjects cannot start new study sessions until restored.

## Features

| Area | What you can do |
| --- | --- |
| Study timer | Start, pause, resume, and finish a subject stopwatch; use focus mode; keep an active timer through refreshes and background tabs. |
| Subjects | Add subjects, edit names and colours, archive or restore them, and view their lifetime study totals. |
| Tasks | Plan by date, optionally associate a subject, edit tasks, mark them complete, or delete them. |
| Calendar | Explore the last 90 days, a selected week, or a selected month; open a date for its study details. |
| Statistics | View daily, weekly, and monthly totals, average time, subject breakdowns, uninterrupted focus, and clipped session history. |
| Daily goal | Set a whole number from 15 to 1,440 minutes and follow today's progress. |
| Accounts and sync | Email/password sign-up, sign-in, email confirmation, password reset, automatic saving, offline retry, and conflict resolution. |
| Backups | Export and import validated JSON; export both versions before resolving a sync conflict. |
| Appearance | Choose from 59 themes, light/dark/system mode, and Studio or Opaline Abacus layouts. |
| Languages | Use complete bundled Indonesian, UK English, US English, Spanish, French, and Russian catalogues. |

Calendar heat levels represent no study, less than one hour, one to two hours, two to four hours, and at least four hours.

## How time and statistics work

The stopwatch uses stored timestamps rather than counting visible screen updates. Time continues while a running timer is in the background or its tab is closed; reopening the same application origin restores it. Paused time is excluded. Keep the device clock accurate: a manual clock change can affect elapsed time, and starting before the end of an existing record is rejected.

A session can contain several study segments separated by pauses. Resuming continues the same session. **Longest focus** measures one uninterrupted segment; paused breaks do not combine separate segments into one continuous focus. History and focus durations are clipped to the period currently selected.

Study time is assigned to the browser's **local calendar dates**. For example, studying from 23:30 to 00:30 contributes 30 minutes to each day. Daylight-saving transitions and skipped civil dates are handled when splitting intervals. Changing your timezone can change which date contains a record while preserving its stored timestamps and total elapsed time.

Weeks start on Sunday in US English and Monday in the other languages. A streak counts consecutive dates with recorded study time, starting from today, or from yesterday if today has no study yet.

## Storage and JSON backups

### Where your records live

Guest study records are stored in `localStorage` under `sela.study.v1`; the study schema remains **version 2**. Each signed-in workspace has its own `sela.account.v1.<project-host>.<user-id>` key. The account document and its last acknowledged cloud revision/snapshot are saved together so pending edits survive a reload. Language is included in automatic account sync; JSON study backups contain the study dataset and appearance settings. Supabase connection settings, passwords, and authentication tokens are excluded from study backups.

Browser caches and guest records belong to a particular **origin**: protocol, hostname, and port. Signed-in devices using the same account and project retrieve the same cloud workspace, including on different origins. Guest records require JSON export/import to move between origins. Private browsing, clearing site data, or browser storage eviction can remove local records, including pending edits that have not reached the server.

Changes across tabs use Web Locks, with an IndexedDB transaction fallback. Conflicting or stale operations are rejected to protect current records. Reload every open application tab after updating the code so they use the same locking implementation.

### Export and import

Use **Settings → Data** to export or import a JSON file. Exporting snapshots a running timer without stopping the original stopwatch. Importing replaces the current study dataset, so finish any active or paused session first. The application downloads a backup of the current dataset before replacement; keep that file in case you want to undo the import.

Import validates the schema, identifiers, references, dates, durations, and nonoverlapping intervals. It accepts files up to **128 MiB**, subject to limits of **100 subjects, 20,000 tasks, and 100,000 session records**. That import limit is separate from the browser's usually smaller storage quota. If persistence fails, the application shows an alert and keeps the current in-memory records available for export. Export them before closing that tab.

If saved JSON is unreadable, download the original bytes using the recovery controls before starting fresh. A recovery confirmation is rejected if another tab has repaired or changed the saved data in the meantime.

If an account cache has valid study records but damaged sync metadata, **Repair account cache** downloads the original bytes and preserves the records and running or paused stopwatch. The repaired cache then syncs; a different cloud version requires an explicit conflict choice.

### Legacy records

**Version-1 local datasets are reset once to an empty version-2 dataset**, preserving valid appearance settings. This is an intentional legacy migration. Existing version-2 records remain intact. Demo-marked backups are rejected, and no example subjects, tasks, or sessions are generated for new users.

## Supabase setup

Supabase provides account authentication and **automatic cloud sync**. Sign in using the header's account button or Settings. Subjects, tasks, completed sessions, the running/paused stopwatch, daily goal, theme, interface style, and language sync to the account. Calendar and statistics are calculated from these records.

Edits save locally immediately and are uploaded after a short debounce. Visible pages check for remote changes approximately every ten seconds, and refresh on focus and reconnect. Background browser throttling can delay updates. **Sync now** requests an immediate refresh. Internet access is required for cloud sync; pending local edits retry when connectivity returns. The header shows whether records are saved to the account, pending, offline, or require attention. A running stopwatch syncs timestamps rather than uploading every tick.

Independent edits are merged against the last acknowledged cloud snapshot. Conflicting changes to the same field, incompatible timer changes, or invalid combined study intervals preserve both versions and require a choice. Export each version to inspect it; choosing **Keep device version** or **Use cloud version** downloads both JSON backups before proceeding. JSON exports snapshot active timers; the automatic sync document preserves the live timer. Signing out switches to the separate guest workspace and keeps pending account edits in that account's local cache.

### Project connection

The project owner supplied these browser-safe connection details:

| Setting | Value |
| --- | --- |
| Project URL | `https://ivpfjzzthdwayvygahbx.supabase.co` |
| Publishable key | `sb_publishable_a2GpBJTv5TxDh5QSJZh6nw_gWs4x54G` |

These browser-safe details are the application's defaults, so users do not need to paste them on every device. Fork owners can change them in **Account → Advanced connection settings**. Use the same project on all devices that should share an account.

The publishable key identifies the application. User authentication and database permissions control access to individual backups. The app also accepts a legacy `anon` key, but the publishable key above is preferred. **Secret and service-role keys must remain outside the browser and repository** because they bypass Row Level Security. No server secret is needed by this application. See [Supabase's API-key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

### Prepare the database and authentication

1. Open the project's Supabase Dashboard and its **SQL Editor**.
2. Copy and run the complete [dist/supabase-schema.sql](dist/supabase-schema.sql). It creates `public.study_data`, enables Row Level Security, installs account-scoped policies, and creates the three-parameter `save_study_data` RPC. Run the whole file when updating an older installation so the obsolete RPC signature is removed. It is designed to be rerun without deleting existing backups.
3. Enable the email/password authentication provider. If email confirmation is enabled, users must follow their confirmation email before signing in.
4. In **Authentication → URL Configuration**, set the **Site URL** to the final application address and allow each exact application return URL, including `http://127.0.0.1:4318/` for local preview. Sign-up and password reset return to the application's current path with its query and hash removed. Include a deployed subpath or `index.html` if it appears in the application's address.

The Site URL and redirect allowlist determine where confirmation links can return. Follow [Supabase's redirect-URL documentation](https://supabase.com/docs/guides/auth/redirect-urls) when adding local or hosted addresses.

### Create an account and sync devices

1. Select **Sign in** in the header, then **Create account**. Enter your email, a password of at least eight characters, and its confirmation. The project's Auth settings may impose stronger rules.
2. Confirm your email using the link Supabase sends, then sign in. Existing users can sign in directly. **Forgot password?** sends a reset link and opens the new-password form on return.
3. The account workspace loads automatically. Sign in to the same account on each other device or app address. Wait for **Saved to your account** before relying on another device receiving an edit.
4. To bring this browser's previous guest data into the account, finish its guest stopwatch and use **Add guest records** from Account. This merges subjects, tasks, and completed sessions; it preserves the account's preferences and stopwatch. Guest records are retained separately.
5. If a conflict appears, export and inspect both versions, then choose the version to keep. Unsynchronised edits remain in their account cache until resolved. Use **Sync now** to retry a failed sync.

Each user has one `study_data` row containing `user_id`, `data`, `revision`, and `updated_at`. The supported RPC checks the signed-in account and expected revision before saving. RLS limits authenticated users to their own rows and the schema denies anonymous table access. Full study-data validation is performed by the application; the SQL checks the version marker. Direct writes to your own row can bypass the RPC's revision check, so use the app's save flow for conflict protection.

The pinned Supabase SDK is loaded from `esm.sh` when the application starts authentication. Cloud operations require internet access. Connection settings and auth sessions are saved for the current browser origin. A cached account can reopen its local workspace and preserve offline edits if the application itself loads; this is not an installable offline app or service-worker guarantee. Passwords are cleared from the form after requests.

Read-only live checks on **2 October 2026** confirmed that the documented project's Auth endpoint is reachable, email sign-up is enabled, confirmation is required, and anonymous access to `study_data` is denied. **Authenticated live database/RPC access, confirmation/reset email delivery, and production redirects have not been verified.** Unit tests and real-browser tests use synthetic accounts and intercepted SDK/server fixtures. Project owners must apply the SQL schema and configure redirect URLs as needed. A [localised setup guide](dist/panduan-supabase.html) is included.

## Languages and appearance

| Language | Catalogue | Date entry | First weekday |
| --- | --- | --- | --- |
| Indonesian | `id-ID` | DD/MM/YYYY | Monday |
| English (UK) | `en-GB` | DD/MM/YYYY | Monday |
| English (US) | `en-US` | MM/DD/YYYY | Sunday |
| Spanish | `es-ES` | DD/MM/YYYY | Monday |
| French | `fr-FR` | DD/MM/YYYY | Monday |
| Russian | `ru-RU` | DD.MM.YYYY | Monday |

Dates, time formats, numbers, plurals, validation messages, accessibility labels, theme names, the Supabase guide, and app-owned error pages follow the selected locale. UK English uses a 24-hour clock; US English uses a 12-hour clock. User-entered subject names and task titles keep their original text.

Translations are fixed files in `dist/locales/`; no runtime AI translation service is used. Language changes preserve unsaved settings and dialog drafts, and the preference is shared between tabs on the same origin. Browser controls and external provider pages use their own language settings.

The 59-theme catalogue and three vendor stylesheets are preserved from the theme source. Google Fonts supplies Newsreader, Syne, and IBM Plex Mono; fallback fonts remain available if that request fails. There is no service worker or guaranteed offline installation. See [LOCALISATION.md](LOCALISATION.md) for translation maintenance and [DESIGN.md](DESIGN.md) for design context.

## Static hosting

Publish the **contents of `dist/` as the site's public root** on an HTTPS static host. No build command is needed. Preserve the subdirectories and serve `.mjs` files with a JavaScript MIME type. `server.mjs`, test files, and audit documents are development resources and do not need to be deployed to serve the app.

The included Node server is a local preview server; select a hosting service separately for public access. After moving to a hosted origin, sign in to retrieve the account workspace and add the exact hosted return URL to Supabase's redirect allowlist for email confirmation/password resets. Guest records can be moved with JSON export/import. Forks should ship their own browser-safe project defaults.

## Development and tests

### Repository layout

```text
dist/
  index.html             Application entry point
  app.mjs                Views, forms, and application actions
  core.mjs               Stopwatch, dates, statistics, and validation
  storage.mjs            Cross-tab write locking
  cloud.mjs              Supabase Auth and guarded account transport
  sync.mjs               Account caches, automatic saving and reconciliation
  i18n.mjs               Locale selection and formatting
  date-input.mjs         Localised date entry and calendar picker
  locales/               Six complete translation catalogues
  vendor/                Preserved theme catalogue and stylesheets
  supabase-schema.sql    Cloud table, policies, and save RPC
  panduan-supabase.html  Localised cloud setup guide
  styles.css             Application layout and components
tests/                    Regression, stress, and optional browser/SQL tests
server.mjs                Local preview server on port 4318
sela-audit-repro.mjs       Runner for all 15 regression scripts
```

`dist/` contains the maintained application source and must stay in Git. `.gitignore` excludes credentials, dependencies, local tooling, personal JSON exports, generated evidence, screenshots, and temporary files. Ignoring a file does not remove it from existing Git history; never commit a secret first and rely on `.gitignore` afterward.

### Run verification

```sh
# All 15 regression scripts, including account sync; writes evidence locally.
node sela-audit-repro.mjs

# Bounded, reproducible stress suite: all three default seeds.
node tests/stress.test.mjs

# Replay one seed, or run an individual regression.
node tests/stress.test.mjs --seed=1578770470
node tests/core.test.mjs
node tests/sync.test.mjs
```

The main regression and stress scripts use Node's built-in modules. The current runner covers **15 regression scripts** and **23 stress groups**. Sync regressions cover account isolation, offline reload/reconnect, independent and conflicting device edits, deletions, edits during save, timer transfer, stale account responses, storage-read retries, and conflict cleanup. The confirmed-bug regressions add stale editor merging, metadata recovery, timezone-independent task dates, weekly history boundaries, live subject totals, and guide subpaths. Seven timezone workers cover UTC, Singapore, New York, Paris, Lord Howe, Apia, and Santiago. See [STRESS-TESTS.md](STRESS-TESTS.md) for exact seeds, counts, caps, and isolation.

The optional account browser test starts its own local preview and uses an independently installed Playwright module. It intercepts Supabase with fixtures; it sends no auth email and changes no live records:

```sh
node tests/account-browser.test.mjs /absolute/path/to/playwright/index.mjs
# Windows: optionally append msedge or chrome to use an installed browser.
```

For the optional real-browser IndexedDB fallback check:

```sh
node tests/browser-lock-smoke.mjs
```

Open [http://127.0.0.1:4320/](http://127.0.0.1:4320/), press **Jalankan uji**, and stop that test server when finished. It exercises the real locking module on an isolated test origin.

The optional SQL test needs a separately installed `@electric-sql/pglite` package. Pass the absolute path to its `dist/index.js` without adding that dependency to the application:

```sh
node tests/schema.test.mjs /absolute/path/to/node_modules/@electric-sql/pglite/dist/index.js
```

The SQL test installs the schema twice and checks revisions, account guards, RLS isolation, and anonymous restrictions using isolated fixtures. It does not use the live project.

### Audit documentation and practical limits

[AUDIT-2026-10-03.md](AUDIT-2026-10-03.md) records ten additional confirmed bugs, all corrected in [FIX-VERIFICATION-2026-10-03.md](FIX-VERIFICATION-2026-10-03.md). [AUDIT-2026-10-01.md](AUDIT-2026-10-01.md) documents 13 earlier confirmed fixes with triggers, expected/actual behaviour, causes, and verification. [VALIDATION.md](VALIDATION.md) records broader checks. Earlier investigations are preserved in [FIX-VERIFICATION.md](FIX-VERIFICATION.md), [HIDDEN-BUG-FIXES.md](HIDDEN-BUG-FIXES.md), and [LOCALISATION-VERIFICATION.md](LOCALISATION-VERIFICATION.md).

Automated results cover synthetic records, controlled browser/SDK doubles, and bounded timezone processes. Native browser checks cover selected layouts and keyboard interactions. They do not establish every browser's quota/locking behaviour, screen-reader speech, live Supabase behaviour, production hosting, or freedom from all defects.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `node` is not recognised | Install Node.js, open a new terminal, and check `node --version`. |
| Port 4318 is already in use | Open the existing preview, or stop the process occupying that port before starting another copy. |
| Blank page when opening HTML | Run the local server and use the HTTP URL; check the browser console for blocked JavaScript modules. |
| Records disappeared after changing the URL | Check the previous protocol, hostname, and port. Export there and import at the new origin. |
| Storage is full or unavailable | Export immediately from the affected tab. Make space or enable site storage before relying on persistence. |
| Import or restore is blocked | Finish the active or paused session; verify the JSON file and review the displayed validation error. |
| Cloud table/RPC is missing | Run the complete current `dist/supabase-schema.sql` in the correct project's SQL Editor. |
| Email confirmation returns to the wrong page | Check Supabase's Site URL and redirect allowlist against the actual app origin. |
| Cloud sign-in or save fails | Verify the project URL, publishable key, email confirmation, authentication settings, internet access, and displayed error. |
| A cloud or tab conflict appears | Export the local dataset, review the newest state, and retry the intended change. |

## Theme attribution and licence

The 59-theme catalogue comes from `mental-math-trainer/utils/themes.js`. Its `globals.css`, `redesign.css`, and `interfaceStyles.css` were copied without modification and remain in `dist/vendor/`. The supplied theme-source licence is **GNU GPL version 3**, preserved in [THEME-SOURCE-LICENSE](THEME-SOURCE-LICENSE). Retain that licence and the source attribution when redistributing these assets; no alternative licence is declared here for the application.
