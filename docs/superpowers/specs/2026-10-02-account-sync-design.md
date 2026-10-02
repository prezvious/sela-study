# Accounts and automatic device sync

Status: approved by the user on 2 October 2026 and implemented. Local regression, stress, and desktop/mobile browser verification passed. Authenticated production database access and email callback delivery remain unverified.

## Objective

People can create an account, sign in, and automatically save and retrieve their entire study workspace on any device or application origin using the same account and Supabase project. Sync requires an internet connection; local changes made offline are saved on that device and retried after reconnecting.

## Existing application and backend evidence

- The maintained application is plain HTML, CSS, and JavaScript in `dist/`, with no frontend build step.
- `dist/cloud.mjs` already implements email/password account creation, sign-in, sign-out, session persistence, account guards, and manual backups.
- `dist/app.mjs` currently stores all users' study data in the same origin-local key and exposes accounts inside the Supabase configuration panel.
- `public.study_data` stores one version-2 JSON document and a revision per account. The existing `save_study_data` RPC rejects stale revisions and checks the expected account.
- On 2 October 2026, the documented project's public Auth settings responded successfully: email authentication and sign-up are enabled, and email confirmation is required. An anonymous read of `study_data` returned permission denied. These checks do not prove authenticated read/write policies or the RPC work end to end.

## Approaches considered

1. **Recommended: extend the existing Supabase snapshot and revision flow.** Add an account interface, isolated local caches, automatic saving, periodic remote reads, and three-way reconciliation. This preserves the existing database and app structure. Background tabs may receive updates later because browsers throttle them; returning to the app refreshes immediately.
2. **Add Supabase Realtime alongside automatic saving.** Remote events can reduce update latency, but require configuring the database publication and maintaining channel lifecycles. Periodic reads are still needed after missed events. This can be added later if polling is insufficient.
3. **Replace snapshots with individual database records.** Per-record writes could support larger workspaces, but require a larger database migration and more changes to existing backup and timer logic. The current application's bounded datasets do not require this replacement.

## Account experience

- Provide a prominent account entry point with separate sign-in and sign-up modes, email/password validation, password confirmation on sign-up, password reset, and sign-out.
- Use the already documented project's browser-safe URL and publishable key as the default configuration. Retain an advanced configuration option for forks. Never embed secret or service-role keys.
- Restore existing sessions when opening the app and handle email-confirmation and password-reset callbacks at the actual application path.
- Show the account's email and a persistent sync indicator: loading account, syncing, synced, offline with pending changes, error, or conflict. Provide retry when appropriate.
- Keep guest study available. Guest records remain separate. Offer an explicit action to import existing guest records into the signed-in account; do not automatically attach another person's local records to an account.
- Preserve the existing theme, responsive layout, keyboard behavior, and complete Indonesian, UK English, US English, Spanish, French, and Russian localisation.

## Everything that syncs

Sync subjects and their colours/archive state, tasks and their dates/completion state, completed study segments, the current running or paused stopwatch, the daily goal, colour theme, appearance mode, interface style, and selected language. Statistics and calendars are computed from the synced records.

Temporary screen state such as open dialogs, navigation, unsent form input, passwords, auth tokens, and device connection settings is not study data. Browser-local drafts and JSON export/import continue to work as appropriate.

## Local persistence and account isolation

- Maintain a separate local workspace and sync metadata for each project/account, plus the existing guest workspace.
- Persist local edits and their dirty state together under the existing cross-tab lock. Keep the last acknowledged cloud snapshot and revision so reconnecting can distinguish local edits from remote edits.
- On sign-in, load that account's cache and cloud workspace before enabling account edits. Do not upload a default empty workspace over an existing account.
- On sign-out or account/project change, invalidate outstanding reads/writes and leave pending edits saved in the original account cache. Switch the visible workspace without leaking records into another account.
- Preserve unreadable-data recovery and storage-quota error reporting. Never show synced until the server has acknowledged the save.

## Synchronisation and reconciliation

- Save after local edits using a short debounce, serialising requests. Do not write a timer tick every second: its timestamps already represent elapsed time.
- Check for remote updates approximately every ten seconds while the page is visible, and immediately on sign-in, focus, and reconnect. Retry failures with bounded backoff.
- Save the validated live timer rather than the manual-backup snapshot, which intentionally finishes a copy of the timer.
- Use the server revision to detect concurrent saves. On a revision conflict, fetch the latest workspace and perform a three-way merge using the last acknowledged snapshot, local changes, and remote changes.
- Merge independent record changes by ID, respect deletions, and merge independently changed settings. Preserve edits made while a request was in flight.
- Changes to the same field or incompatible stopwatch/session changes require explicit conflict resolution. Preserve both versions until resolved and offer local/remote selection with JSON export. Do not silently discard edits or create overlapping sessions.
- Validate reconciled data with the existing invariants before persisting or uploading. An unchanged remote snapshot must not cause another upload loop.

## Implementation boundaries

Keep Supabase Auth and transport in `cloud.mjs`, add a focused sync/reconciliation module, and integrate account-scoped persistence and account controls into `app.mjs`. Extend fixed locale catalogues and styles only where necessary. Retain version-2 compatibility and the current database/RPC contract unless testing identifies a required compatible fix.

## Verification and completion

- Test first sign-in to an existing account, new-account initialisation, signup confirmation, reset callbacks, and expired sessions.
- Test two-device independent edits, deletions, same-field conflicts, concurrent timer actions, stale revisions, edits during save, offline reconnect, and reload with pending changes.
- Test account/project switching and sign-out during delayed reads/writes, including cross-tab events, so old responses cannot affect another workspace.
- Run the existing regression suite and targeted new sync tests. Verify the account UI in a browser at mobile and desktop sizes.
- Update the README and setup guide to describe automatic sync and required Supabase configuration.
- Report separately what is proven by local tests and what is verified against the live service. A real authenticated two-device smoke test requires an authorised test account; do not create accounts or send auth email merely to probe production.

## Workflow checklist

- [x] Inspect project, history, current storage, and authentication.
- [x] Compare approaches and present a concrete design.
- [x] Review this proposal for scope, contradictions, and missing behavior.
- [x] Obtain user approval of this written proposal.
- [x] Implement and verify the approved behavior.
- [x] Report remaining backend configuration and live verification limits in the README.

## Implementation evidence

`node sela-audit-repro.mjs` passed all 14 regression scripts and 23 deterministic stress groups. Additional sync cases verify delayed reads across tabs, preference-only edits after a failed first read, and storage failure during a remote pull. The optional Playwright test passed in Microsoft Edge at desktop and mobile widths using synthetic accounts and intercepted Supabase SDK/server fixtures. It verifies signup/password-reset forms, automatic saving, two-browser stopwatch transfer, sign-out/account isolation, and absence of page errors or horizontal overflow. The Impeccable mechanical UI detector reported no findings. The existing SQL/RPC contract was retained.
