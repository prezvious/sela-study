# Pemeriksaan aplikasi

Diperiksa kembali pada 30 September 2026 dengan Node.js v24.18.0. Kedelapan skrip regresi menggunakan modul bawaan Node dan lulus. Jalankan `node sela-audit-repro.mjs` untuk menjalankan seluruhnya serta mencatat hasil ke `sela-fix-evidence.json`.

- `core.test.mjs`: mulai/jeda/lanjut/selesai, pemisahan mata pelajaran, timestamp, pemecahan tengah malam, grup sesi, round-trip JSON, dan penolakan format tidak valid.
- `regressions.test.mjs`: fokus tanpa jeda, batas tengah malam, timestamp nol/jam mundur, subjek arsip, tepat 90 hari, ID/tanggal/durasi tidak valid, dictionary aman, 590 pasangan warna kalender dengan kontras minimal 4,5:1, batas konfigurasi Supabase, dan tanpa favicon.
- `empty-state.test.mjs`: pengguna baru kosong, reset satu kali seluruh catatan versi 1, tampilan dipertahankan, catatan pribadi versi 2 tetap tersimpan, impor contoh ditolak, generator/kontrol contoh sudah dihapus.
- `ui-regressions.test.mjs`: batas 20.000 tugas, edit/hapus/tambah pada batas, submit ganda, validasi sebelum penulisan, dua tab, event storage tertunda, guard timer/subjek, isolasi modal tanggal, tengah malam pada tiga tampilan dengan/tanpa modal, tanggal manual, angka kalender minggu/bulan, Auth tertunda setelah navigasi, pemulihan impor, konflik quota, dan panduan terkini. Replay menjalankan fungsi asli dengan DOM/clock/storage/lock/Auth tiruan.
- `backup.test.mjs`: cadangan 26.200.533 byte serta handler impor, fixture jumlah/string maksimum 88.148.250 byte, batas bersama 128 MiB, penolakan file terlalu besar sebelum dibaca, penolakan sesi tumpang tindih, interval berdampingan, timer aktif, jam sebelum akhir record, dan ekspor timer tanpa mengubah timer asli.
- `storage.test.mjs`: kegagalan API tidak mengubah catatan, fallback transaction double serial, penolakan melepas lock, koneksi ditutup.

Browser asli memverifikasi detail kemarin 1 jam dan hari ini 30 menit; angka kalender bertambah mengikuti timer; dua tugas dari dua tab tetap tersedia setelah reload; serta impor fixture melalui file chooser. Halaman uji terpisah memakai modul storage asli dan IndexedDB asli: 24 transaksi serial, penolakan diteruskan, dan transaksi berikutnya berhasil. Halaman ini dapat dijalankan lagi dengan `node tests/browser-lock-smoke.mjs` pada port 4320.

Tidak ada galat JavaScript pada pemeriksaan akhir. Origin `localhost:4318` dipakai khusus fixture dan dikembalikan ke keadaan kosong. Origin utama `127.0.0.1:4318` tetap kosong dengan timer/total nol, tanpa tugas/subjek, dan tanpa overflow horizontal pada viewport browser saat pemeriksaan akhir. Pemeriksaan desktop 1440 × 960 serta mobile 390 × 844 dari tahap sebelumnya tetap tercatat; putaran terbaru memperbaiki kontrol dan keterbacaan mobile sesuai HIDDEN-BUG-FIXES.md.

Empat file tema/CSS tetap cocok SHA256 dengan mental-math-trainer. Uraian perbaikan serta kondisi khusus setiap temuan ada dalam FIX-VERIFICATION.md. BUG-AUDIT.md dan sela-audit-evidence.json merupakan arsip sebelum perbaikan; sela-fix-evidence.json adalah hasil regresi versi saat ini.

Supabase belum dikonfigurasi sehingga Auth/RPC/RLS serta kapasitas payload layanan belum diuji pada layanan nyata. Pengujian Auth menggunakan respons tiruan. Pengunduhan JSON dipicu oleh UI, tetapi lokasi file unduhan pada browser pratinjau belum dapat diverifikasi. Format, round-trip dan impor telah diuji. Kapasitas localStorage mengikuti browser dan tidak sama dengan batas berkas impor 128 MiB. Semua tab versi lama perlu dimuat ulang agar mengikuti lock yang baru.

Server aplikasi aktif secara lokal pada port 4318. Tidak ada deployment daring dilakukan dalam putaran perbaikan ini. Pengujian ini tidak menjamin tidak adanya bug lain di luar kondisi yang diperiksa.

## Pemeriksaan bug tersembunyi

hidden-ui.test.mjs dan cloud.test.mjs lulus untuk draft/fokus form, target integer, masa hidup password, dialog cloud tertunda, submit cloud ganda, snapshot saat konfirmasi, konteks proyek/akun, pergantian konfigurasi antar-tab, race SDK, retry, dan konflik RPC. schema.test.mjs lulus terpisah menggunakan PGlite: pemasangan/rerun SQL, penghapusan signature lama, revisi insert/update, akun berbeda/null, data invalid, RLS, anon dan auth kosong. Role dan auth.uid memakai fixture; layanan Supabase nyata belum diuji.

Browser mengonfirmasi draft goal 20/URL tidak hilang ketika tab lain menyimpan, goal 20 diterima, fokus kembali ke Tambah tugas, serta timer mulai/jeda/selesai. Kontrol timer dan filter tugas kini berukuran scroll/client 238/238 px pada viewport 320 px, dibanding 269/238 dan 274/238 sebelumnya. Mobile 390 × 844, desktop 1440 × 960, nama subjek panjang, dan dark mode diperiksa. Detector antarmuka menghasilkan [] tanpa temuan. Data QA pada localhost sudah dikembalikan kosong. Origin utama tetap kosong.

HIDDEN-BUG-FIXES.md adalah laporan lanjutan tujuh bug dengan bukti sebelum/sesudah dan batas pengujian. Tema sumber tetap disalin persis; tidak ada favicon, ikon brand, atau data contoh ditambahkan.

## Localisation update — 1 October 2026

The current runner has nine regression scripts. `tests/localisation.test.mjs` verifies 371 keys per locale (2,226 entries), matching placeholders, CLDR plural categories, all 59 theme labels, six locales across five views and dialog variants, UK/US date and clock conventions, Russian inflection, invalid and leap dates, preference persistence/cross-tab changes, unchanged study data and pending-dialog/error updates. `tests/cloud.test.mjs` now also checks localised responses to Auth error codes and hides raw server wording. See LOCALISATION-VERIFICATION.md for native browser checks and limits. The previous dated sections remain historical evidence.

## Independent audit and stress update — 1 October 2026

The current runner executes thirteen scripts: the previous nine plus audit-regressions, cloud-audit, ui-audit and stress. Thirteen additional defects were reproduced and fixed in place; see AUDIT-2026-10-01.md for triggers, expected/actual behaviour, causes, fixes and checks. The independent five-agent audit includes a distinct final UI/localisation reviewer.

`node tests/stress.test.mjs` exercises three recorded seeds, seven isolated timezone processes, an independent stopwatch model, an independent tab-operation model, and minute-bucket Intl calendar oracles. It adds generated corruption/limit cases, quota/read failures, controlled account/config/Auth/RPC interleavings, midnight DST and skipped dates. Run `node sela-audit-repro.mjs` for all thirteen scripts. STRESS-TESTS.md documents seed replay, exact limits and isolation.

Native isolated-origin checks verified the named date-picker grid and seven rows in all six languages at 320 pixels, Russian at 1440×960, and ArrowRight/Enter date selection. The original preview process was verified and left running; no real user records or credentials were used. Four vendor files retain identical reference SHA256 hashes. Supabase remains unconfigured; service behaviour is not established by SDK mocks or PGlite fixtures. Passing tests is not a bug-free guarantee.
