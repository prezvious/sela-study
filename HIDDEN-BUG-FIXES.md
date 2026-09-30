# Hidden bug fixes and interface polish

Verified on 30 September 2026. Project: `C:\Users\camar\Documents\Coding\sela-study`.

Seven additional bugs were reproduced and fixed. The earlier nine fixes remain covered by regression tests. The app starts with empty study data, and the copied theme files remain unchanged.

| ID | Confirmed bug | Impact | Status |
| --- | --- | --- | --- |
| H001 | Unfinished settings disappear after another tab saves | Draft input loss | Fixed |
| H002 | Valid integer targets such as 20 minutes are rejected | Cannot save a supported target | Fixed |
| H003 | Delayed cloud reads replace a newer dialog | Wrong confirmation; stale backup snapshot | Fixed |
| H004 | A pending or cached client uses a previous Supabase project | Cloud actions can use the wrong connection | Fixed |
| H005 | An account change redirects a previously prepared backup write | Wrong account's backup may be overwritten | Fixed |
| H006 | Saving a dialog loses keyboard focus | Keyboard navigation returns to the document | Fixed |
| H007 | Controls overflow on narrow mobile screens | Clipped timer buttons and task date controls | Fixed |

## H001 — Settings drafts erased during rendering

**Reproduction:** In tab A, enter an unsaved goal of `20` and Project URL `https://draft.supabase.co`. Save a subject in tab B. The storage event re-renders tab A; its goal becomes `240` and the URL becomes empty. This was observed in the actual browser, before editing the code.

**Cause:** The entire app's HTML is replaced on rendering. The previous implementation restored some focused buttons but did not preserve form values. Appearance changes could cause the same loss within one tab.

**Fix:** Same-view rendering captures and restores dirty settings inputs, including input focus and text selection. Clean inputs follow newly saved values. Explicit navigation discards drafts. Password drafts remain only in the currently displayed form, are cleared after authentication, and are excluded from study storage and JSON backups. A successful configuration save uses the normalized saved values.

**Verification:** Browser tab B saved a task while tab A retained both `20` and its unfinished URL. Regression tests cover appearance changes, clean-value updates, focus, navigation, and password lifetime.

## H002 — Daily target constraints disagree

**Reproduction:** Enter `20` in Target harian. The browser reported `stepMismatch: true` and invalid input because `min=15` and `step=15` allowed only 15-minute increments. Application validation and JSON validation support every integer from 15 through 1440.

**Fix:** Use `step=1` to match the existing data contract. Sidebar goals use the duration formatter, avoiding long fractional-hour labels for goals such as 17 or 20 minutes.

**Verification:** The browser reported `stepMismatch: false`, accepted 20, and displayed “Target harian disimpan.” The regression test also saves 20 through the actual submit handler and checks a 17-minute sidebar label.

## H003 — Stale cloud operations overwrite current UI

**Reproduction:** Start a cloud read, navigate away, and open a task dialog before the read resolves. Resolving the controlled response replaced that task dialog with a cloud confirmation. Returning to Settings before the response completed also needed protection.

**Cause:** The async handler opened its confirmation unconditionally after awaiting the response. Saving also captured local data before the initial cloud read, so edits made before confirmation could be omitted from the backup.

**Fix:** Navigation and dialog changes invalidate pending read confirmations. Cloud operations have a shared busy guard, disabled controls, and retryable error handling. A canceled result leaves the current dialog intact. Saving captures the latest local records under the study lock when the user confirms.

**Verification:** Controlled tests exercise both load and save, duplicate requests, navigation away and back, a new dialog, failure recovery, and a task added after the initial read. The stale response preserves the task dialog; the late task is included in the saved snapshot.

## H004 — Supabase client initialization/configuration races

**Reproduction:** Configure project A, start SDK initialization, configure project B before initialization completes, then resolve initialization. The old implementation cached project A and returned it for subsequent operations. Configuration changed by another tab also left an existing cached client unchanged.

**Fix:** Client initialization is deduplicated and keyed by URL and key. A stale initialization is rejected before creating a client. Existing clients are invalidated when their configuration no longer matches shared storage; their token refresh is stopped. Reads from invalidated clients are rejected instead of becoming confirmations.

**Verification:** Tests run the real cloud module with a deferred SDK factory. They verify concurrent initialization, project changes during loading, cross-tab URL changes, same-project key rotation, delayed reads, and retry after an initialization failure. No real credentials or cloud requests are used.

## H005 — Backup writes can switch accounts between reading and confirmation

**Reproduction:** Read backup revision 1 as account A, change the current authenticated user to B, then save. The original module requested the current user again and dispatched the RPC as B, with no connection to the account whose backup had been reviewed. If B also had revision 1, the revision check alone could allow its backup to be overwritten.

**Fix:** Cloud reads carry their project/account context, including when no backup exists. Save and restore confirmations recheck that context. The save RPC also supplies the expected account UUID, and the SQL function rejects a different request account. This protects the interval between the frontend check and database execution. The schema removes the earlier two-argument function so app writes use the guarded signature.

**Verification:** Client tests reject account and project switches before dispatch, and check the account UUID sent to the RPC. The actual SQL was executed in isolated PostgreSQL through PGlite, with fixture auth roles and UUIDs. Mismatched/null account UUIDs, stale revisions, missing authentication, and anonymous access were rejected; matching-account insert/update and RLS isolation passed.

The schema keeps `security invoker` and row policies based on `auth.uid()`, consistent with the official guidance for [database functions](https://supabase.com/docs/guides/database/functions) and [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security). This is a fixture database check, not a live Supabase account test. When connecting Supabase later, run the current bundled SQL schema. Re-running it preserves existing study rows.

## H006 — Focus disappears after a successful dialog save

**Reproduction:** Open Add subject and save it. The actual browser's focused element became `BODY` because saving replaced the original opener before the dialog closed. Task saves follow the same rendering path.

**Fix:** Record a stable selector for the dialog opener. After closing, focus its current DOM replacement, or the page heading if the opener no longer exists.

**Verification:** After saving a task in the browser, focus returned to the current “Tambah tugas” button (`data-action=add-task`). Dialogs retain their existing native focus containment and close behavior.

## H007 — Narrow-screen controls are clipped

**Reproduction:** At a 320 px viewport, the timer control row had 238 px available but a 269 px scroll width. The task filter had 238 px available but needed 274 px. The timer panel's overflow clipping visibly cut the primary button.

**Fix:** The timer's primary button can shrink while retaining its label and SVG icon. The task date control wraps onto a separate row at narrow widths. Ordinary mobile icon controls have 44 px targets. Form text is enlarged on mobile, subject/task metadata wraps, and heatmap/footer notes are more readable. Dense chart cells keep their chart layout.

**Verification:** At 320 px, both control rows measured 238 px scroll width against 238 px available. Desktop 1440 × 960 and mobile 390 × 844 were also inspected, including long 80-character subject names and dark mode. Long names already wrapped before this pass; they were not reported as a confirmed overflow bug.

## Verification and practical limits

- Eight Node regression scripts pass: core, regressions, empty-state, ui-regressions, backup, storage, hidden-ui, and cloud. The optional schema script passes separately in PGlite.
- The original 26,200,533-byte and 88,148,250-byte backup fixtures still pass export/import validation, with the shared 128 MiB limit.
- Browser checks cover cross-tab drafts, goal submission, dialog focus, timer start/pause/finish, responsive controls, light/dark appearance, and JSON import cleanup. No JavaScript warnings/errors were captured in the checked test tab.
- The interface detector returned no findings. The four copied theme files are SHA256-identical to their source.
- QA records were created only at `localhost:4318` and then replaced with the empty fixture through normal import with backup. The main `127.0.0.1:4318` view has zero timer/total, no subjects or tasks, and no horizontal page overflow.
- Live Supabase Auth, network behavior, payload limits, and hosted deployment remain untested because no project is configured. PGlite uses fixture auth claims and does not replace a live integration test. Download placement in the in-app browser remains unverified; JSON contents and import behavior are tested.
- Existing limitations remain: local browser quota can be below the import limit, wall-clock changes can affect timer duration, and older open tabs need reloading to use updated code. These checks do not establish that every possible bug is absent.

![Polished desktop, empty study data](sela-polished-desktop.png)

![Polished mobile, empty study data](sela-polished-mobile.png)
