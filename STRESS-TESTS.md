# Reproducible sela. stress tests

The existing project remains at `C:\Users\camar\Documents\Coding\sela-study`. No package installation is required. Run from that directory:

```powershell
node tests/stress.test.mjs
node tests/stress.test.mjs --seed=1578770470
node sela-audit-repro.mjs
```

The first command runs the new stress suite. The second replays one seed. The last runs all thirteen existing and new regression scripts and writes `sela-fix-evidence.json`. The optional PostgreSQL schema test remains separate and requires PGlite.

Default unsigned 32-bit seeds: **1578770470**, **202424542**, **3735928559**. Up to four `--seed=<uint32>` arguments are accepted. The suite prints its seeds, individual groups, timezone worker results and a final JSON PASS/FAIL summary. A failure sets a nonzero exit code. Stopwatch failures include the last 25 generated actions; timezone failures identify the seed, case, zone and exact timestamps.

## Independent checks

- **Stopwatch model:** 600 generated actions per seed, including duplicate starts, pauses, finishes, subject switches, backwards/forwards clock moves and backup snapshots. An independent model records expected intervals, elapsed time, runs and subjects without calling the production helpers to compute expected results.
- **Generated backups:** 48 valid datasets per seed with Unicode, escaped text, prototype-like identifiers, archived subjects, leap/early/late task dates and random nonoverlapping intervals. Round trips preserve records. Separate malformed mutations exercise IDs, dates, durations, overlaps, goals, task fields and record limits.
- **Concurrent tabs:** three isolated application contexts share a synthetic store. Twelve waves of nine operations per seed are scheduled in generated lock order. A Map-based oracle applies operation descriptions independently. Reordered storage notifications must observe the latest committed state. Rejected operations leave the persisted snapshot unchanged.
- **Storage adversity:** twelve quota/read-denial fixtures per seed preserve temporary records for export, detect conflicts with another tab, and reject corrupted writes. Separate malformed persisted JSON remains recoverable without replacing it.
- **Cloud interleavings:** 27 controlled schedules per seed cover SDK initialization, configuration/key changes, delayed Auth and reads, account switches, sign-out, RPC conflicts and same-account token refresh. The fake SDK updates its own synthetic auth storage and emits auth events. Explicit phase gates establish the point at which a request is suspended.
- **Calendar oracle:** seven fresh Node processes use UTC, Singapore, New York, Paris, Lord Howe, Apia and Santiago. Expected time per day is counted minute by minute using `Intl.DateTimeFormat` with an explicit zone, independently of the production midnight calculation. The suite checks duration conservation, contiguous parts, clipped ranges, daily sums and uninterrupted focus. Fixed transitions cover 23/25-hour days, half-hour changes, Santiago's midnight jump and Apia's skipped date.
- **Long timers:** finishing and exporting at 366 days minus one millisecond, exactly 366 days, one millisecond beyond and 367 days preserves every recorded millisecond and the original running state during export.

## Bounds and isolation

The default run performs 1,800 stopwatch actions, 144 generated backup datasets, 324 queued tab operations, 36 quota fixtures, 81 cloud schedules and 264 timezone intervals. The independent timezone oracle samples 365,022 minutes with the default seeds. Every timezone child has a 30-second timeout, a 256-MiB heap cap and a 1-MiB output cap. Input seed count and generated dataset sizes are fixed and bounded. The aggregate runner also limits each script to 60 seconds.

The suite uses built-in Node modules, synthetic in-memory stores, fixtures and mock SDK responses. It does not connect to Supabase, use credentials, touch browser storage, modify project records or launch the normal preview server. Its two files are `tests/stress.test.mjs` and `tests/stress-timezones.mjs`.

Focused regression scripts complement the stress run: `audit-regressions.test.mjs` covers stale recovery/import confirmation schedules, date/timer boundaries and historical/epoch streaks; `cloud-audit.test.mjs` covers identity generations and queued local restore commits; `ui-audit.test.mjs` covers historical labels, complete subject lifetime totals, early-year month ranges/navigation, required date-grid markup and skipped-date column alignment in all six languages.

These checks exercise more sequences and independent invariants than the previous suites. They do not establish live Supabase behaviour, every browser's locking/storage implementation, native screen-reader usability or freedom from all bugs.
