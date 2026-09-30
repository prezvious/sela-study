# Verifikasi dan perbaikan bug sela.

Diperiksa pada 30 September 2026, menggunakan Node.js v24.18.0 dan browser pratinjau Codex. Proyek aktif: `C:\Users\camar\Documents\Coding\sela-study`.

Kesembilan temuan audit dikonfirmasi sebagai bug nyata dan diperbaiki. Temuan batas jumlah/ukuran data, konkurensi, impor tumpang tindih, tengah malam, dan respons login memerlukan kondisi pemicu tertentu. Laporan ini tidak menyatakan bahwa semua pengguna pernah mengalaminya atau bahwa aplikasi bebas dari seluruh kemungkinan bug.

Sebelum perubahan, replay terhadap kode lama kembali menghasilkan T001–T009. Bukti sebelum perbaikan tetap tersedia dalam `sela-audit-evidence.json`. Pemeriksaan setelah perubahan menguji perilaku yang seharusnya terjadi, bukan sekadar mencari baris kode atau mengharapkan bug tetap ada.

| ID | Temuan yang dikonfirmasi | Status |
| --- | --- | --- |
| T001 | Tugas ke-20.001 membuat penyimpanan tidak lolos validasi saat dibuka kembali | Diperbaiki |
| T002 | Ekspor valid 26,2 MB ditolak batas impor 20 MB | Diperbaiki |
| T003 | Dua tab dapat menimpa perubahan karena baca–ubah–tulis tidak atomik | Diperbaiki |
| T004 | Detail tanggal lampau menerima durasi hari ini dari pembaruan timer | Diperbaiki |
| T005 | Kalender mempertahankan penanda tanggal lama setelah tengah malam | Diperbaiki |
| T006 | Angka harian/mingguan/bulanan kalender tidak mengikuti timer | Diperbaiki |
| T007 | Impor interval yang bertumpang tindih menggandakan statistik | Diperbaiki |
| T008 | Respons login setelah berpindah halaman mengakses elemen yang sudah hilang | Diperbaiki |
| T009 | Panduan Supabase menyebut tombol data contoh yang sudah dihapus | Diperbaiki |

## T001 — Batas tugas dan validitas penyimpanan

**Konfirmasi:** form aplikasi lama menambahkan tugas ke-20.001, lalu menyimpan JSON yang ditolak `restoreLocalState()`. Data mentah masih ada; masalahnya adalah aplikasi gagal membacanya kembali, bukan penghapusan fisik data.

**Perbaikan:** `editTask()` memeriksa batas 20.000 di dalam perubahan yang dikunci. `persist()` memvalidasi seluruh snapshot sebelum menulisnya. Pesan batas ditampilkan di form, sehingga pengguna tetap dapat mengedit atau menghapus tugas lama. Batas subjek/tugas/sesi menggunakan konstanta yang sama. Timer juga menolak pembuatan segmen baru setelah batas 100.000 sesi tercapai.

**Verifikasi:** penambahan pada batas ditolak; jumlah tersimpan tetap 20.000 dan dapat dibaca kembali. Edit pada batas berhasil. Setelah satu tugas dihapus, penambahan berhasil. Submit ganda selama proses simpan tidak menciptakan tugas ganda. Mutasi yang menghasilkan tanggal tidak valid tidak mengubah snapshot tersimpan.

## T002 — Cadangan yang diekspor harus dapat diimpor

**Konfirmasi:** 100.000 sesi valid, unik dan tidak tumpang tindih menghasilkan ekspor lama 26.200.508 byte; handler impor lama membatasinya pada 20.000.000 byte. Ini temuan pada batas format data, bukan bukti bahwa penyimpanan browser pengguna pernah mencapai ukuran itu.

**Perbaikan:** ekspor dan impor menggunakan helper serta batas bersama 128 MiB (134.217.728 byte). Batas ini mencakup jumlah record maksimum beserta panjang string dan pengkodean JSON yang didukung. Ekspor mengambil salinan, mencatat segmen timer berjalan sampai waktu ekspor, lalu menutup timer pada salinan tersebut. Timer asli tetap berjalan.

**Verifikasi:** cadangan baru 26.200.533 byte lolos round-trip serta handler impor aplikasi. Fixture dengan 100 subjek, 20.000 tugas, 100.000 sesi, ID sepanjang 100 karakter, nama sepanjang 80 karakter, judul sepanjang 300 karakter dengan karakter yang harus di-escape, dan timestamp 16 digit menghasilkan 88.148.250 byte dan juga lolos. File di atas 128 MiB ditolak sebelum isi file dibaca. Fixture kedua menguji jumlah/string maksimum; durasi semua segmennya tidak diklaim sebagai durasi maksimum format.

**Batas:** kapasitas `localStorage` tetap mengikuti browser dan biasanya lebih kecil dari batas berkas impor. Jika penulisan gagal, aplikasi mempertahankan data sementara di tab, menampilkan peringatan, dan memungkinkan ekspor. Menaikkan batas berkas tidak menjanjikan kapasitas penyimpanan lokal sebesar 128 MiB.

## T003 — Perubahan dari dua tab

**Konfirmasi:** replay lama menyisipkan perubahan tab B di antara pembacaan dan penulisan tab A. Snapshot terakhir kehilangan tugas B. Ini interleaving terkontrol, bukan klaim bahwa klik biasa selalu akan menghasilkan konflik. Spesifikasi juga meminta pengembang mengasumsikan tidak ada mekanisme penguncian untuk operasi `localStorage` lintas agent cluster. [HTML Standard: Web storage](https://html.spec.whatwg.org/multipage/webstorage.html#introduction).

**Perbaikan:** semua perubahan catatan memakai lock bersama untuk origin yang sama, membaca snapshot terbaru setelah memperoleh lock, lalu memvalidasi dan menulisnya. Browser yang mendukungnya menggunakan Web Locks; fallback memakai transaksi IndexedDB `readwrite` sebagai mutex. Impor, pemulihan dan pengambilan cadangan ikut memakai lock serta memeriksa ulang sesi aktif. Event storage yang terlambat membaca nilai terbaru, sehingga tidak mengembalikan UI ke snapshot lama. Pemeriksaan subjek/timer dilakukan lagi di dalam lock. [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction).

**Verifikasi:** dua operasi dimulai sebelum salah satunya selesai; kedua tugas tetap tersimpan. Penolakan mutasi tidak menahan lock berikutnya. Di browser asli, form pada dua tab dikirim bersamaan: “Uji tab A” dan “Uji tab B” tetap terlihat setelah reload. Fallback memakai modul `storage.mjs` asli di halaman uji terpisah: 24 transaksi IndexedDB berjalan serial; satu operasi ditolak, lalu transaksi berikutnya berhasil. Uji browser dua form ini memeriksa integrasi; pembuktian jadwal konflik lama berasal dari replay terkontrol.

**Batas:** tab yang masih menjalankan versi aplikasi lama tidak menggunakan lock baru; muat ulang tab lama setelah pembaruan. Jika browser tidak menyediakan Web Locks maupun IndexedDB, perubahan ditolak dengan pesan yang jelas. Data sementara akibat quota tidak akan diam-diam menimpa perubahan tab lain. Ekspor tetap mengambil catatan sementara milik tab tersebut, dan status penyimpanan menjelaskan bahwa data belum tersimpan permanen. Kasus ini ikut diuji.

## T004 — Detail tanggal lampau

**Konfirmasi:** detail kemarin berisi satu jam, tetapi selector global pada tick mengganti baris subjeknya dengan total hari ini. Total dan timeline modal tetap satu jam, sehingga modal saling bertentangan.

**Perbaikan:** tick memperbarui baris subjek hanya di panel “Belajar hari ini” pada area aplikasi. Modal detail memiliki snapshot tanggalnya sendiri dan tidak menerima pembaruan milik hari lain.

**Verifikasi:** setelah tick dan timer berjalan, panel hari ini berubah sedangkan modal kemarin tetap `1j 0m`, total `01:00:00`. Browser asli menggunakan fixture kemarin 1 jam/hari ini 30 menit dan menunjukkan kedua nilai dengan benar. Bukti visual: `sela-fixed-history.jpg`.

## T005 — Pergantian tengah malam

**Konfirmasi:** saat 30 September berubah menjadi 1 Oktober, kalender lama masih menandai sel 30 September sebagai hari ini tetapi label aksesibilitasnya berubah menjadi 1 Oktober. Sel 1 Oktober tetap dinonaktifkan sebagai tanggal masa depan.

**Perbaikan:** pergantian tanggal diproses sebelum nilai timer/kalender diperbarui. Ruang belajar, kalender, dan statistik dirender ulang untuk tanggal baru, termasuk ketika modal terbuka. Modal tetap terbuka. Tanggal tugas dan cursor yang mengikuti hari ini ikut maju; tanggal yang dipilih manual dipertahankan. Pada pengaturan, hanya header tanggal diperbarui agar isi form tidak hilang.

**Verifikasi:** jam terkontrol `23:59:59 → 00:00:01` diuji pada tiga tampilan dengan dan tanpa modal. Penanda, label dan tombol tanggal baru sesuai 1 Oktober; detail 30 September tetap terbuka. Tanggal tugas manual 28 September tetap 28 September. Pengujian ini tidak mengubah jam komputer pengguna.

## T006 — Angka kalender mengikuti timer

**Konfirmasi:** warna dan label aksesibilitas sel bertambah, tetapi angka di bawah tanggal serta total periode masih memakai nilai saat render awal.

**Perbaikan:** setiap tick juga memperbarui angka harian mingguan dan footer periode menggunakan rentang kalender yang dipilih. Total bulan diperbarui dengan rentang bulan tersebut. Periode lama tetap menampilkan data periode lama.

**Verifikasi:** setelah 65 detik, label `00:01:05`, angka `1m`, dan total periode `1m` sesuai satu sama lain. Uji minggu/bulan sebelumnya tetap nol. Di browser asli, hari ini menunjukkan `00:31:49`, angka `31m`, dan total minggu `1j 31m` dengan riwayat kemarin 1 jam. Bukti visual: `sela-fixed-calendar.jpg`.

## T007 — Interval belajar tumpang tindih

**Konfirmasi:** dua record berbeda sama-sama mencatat 10.00–11.00 dan diterima validator lama. Agregasi menjumlahkannya menjadi dua jam. Pemicu adalah data impor yang tidak konsisten; timer satu tab normal tidak menghasilkan dua sesi bersamaan.

**Perbaikan:** validator mengurutkan interval positif dan menolak tumpang tindih lintas subjek/run, termasuk terhadap timer aktif. Interval yang bersambung tepat di batasnya dan interval berdurasi nol tetap diizinkan. `startTimer()` menolak jam yang lebih awal daripada akhir record tersimpan, agar perubahan jam tidak menghasilkan interval baru yang bertabrakan.

**Verifikasi:** overlap identik, sebagian, bersarang, lintas subjek, dan timer aktif ditolak; sesi berdampingan, urutan input terbalik, dan jeda/lanjut normal diterima. Validator tidak membuang atau menggabungkan record secara diam-diam. Jika catatan lokal lama sudah mengandung overlap, pembacaan menampilkan pemulihan dan berkas mentah tetap dapat diunduh; pengguna perlu membetulkan interval atau mengimpor cadangan valid.

## T008 — Login selesai setelah navigasi

**Konfirmasi:** respons Auth tertunda lalu berhasil setelah pengguna keluar dari pengaturan. UI lama mencoba menulis `textContent` pada elemen status yang sudah tidak ada dan menampilkan error DOM meskipun login berhasil.

**Perbaikan:** hasil/status Auth disimpan dalam state UI tersendiri; elemen hanya diperbarui jika masih ada. Toast keberhasilan/kegagalan tetap benar pada halaman lain. Tombol login/daftar dinonaktifkan selama permintaan berjalan; setelah selesai, tombol aktif kembali dan input kata sandi dibersihkan.

**Verifikasi:** respons berhasil dan gagal yang tertunda diuji setelah navigasi. Toast menampilkan hasil Auth, tidak ada error null; status tetap benar saat kembali ke pengaturan. Kata sandi form asal dibersihkan dan tombol diaktifkan kembali. Ini memakai mock Auth, bukan akun atau koneksi Supabase nyata.

## T009 — Panduan Supabase

**Konfirmasi:** langkah pemasangan menyebut “Gunakan data saya”, padahal tombol tersebut sudah dihapus sesuai permintaan pengguna.

**Perbaikan dan verifikasi:** langkah tersebut dihapus. Panduan sekarang langsung menjelaskan “Simpan ke cloud” dan “Ambil dari cloud”, sesuai tindakan yang ada di aplikasi. Pengujian memeriksa bahwa instruksi tombol lama sudah tidak ada.

## Hasil pengujian dan penggunaan

Enam skrip Node lulus: `core.test.mjs`, `regressions.test.mjs`, `empty-state.test.mjs`, `ui-regressions.test.mjs`, `backup.test.mjs`, dan `storage.test.mjs`. UI replay menjalankan fungsi aplikasi asli dengan DOM, clock, storage, lock dan Auth tiruan untuk menyusun kondisi batas secara deterministik. Uji browser asli terpisah memeriksa detail historis, timer/kalender, perubahan dua tab, reload, impor fixture, serta fallback IndexedDB. Tidak ada galat JavaScript pada pemeriksaan akhir. Origin utama `127.0.0.1:4318` tetap kosong; fixture di `localhost:4318` sudah dibersihkan dan tab pengujian ditutup.

Jalankan seluruh uji dari proyek dengan `node sela-audit-repro.mjs`. Nama skrip dipertahankan agar perintah lama tetap berguna, tetapi sekarang menjalankan regresi setelah perbaikan dan menulis `sela-fix-evidence.json`. `sela-audit-evidence.json` adalah arsip hasil sebelum perbaikan.

Empat file vendor tema/CSS tetap identik dengan sumber mental-math-trainer. Keadaan awal kosong, reset satu kali versi 1, dan penyimpanan catatan pribadi versi 2 tetap diuji. Tidak ada favicon atau ikon brand ditambahkan.

Supabase belum dikonfigurasi, sehingga autentikasi, RPC, batas payload layanan, serta RLS belum diverifikasi menggunakan proyek nyata. Lokasi berkas unduhan di browser pratinjau juga belum diverifikasi; format ekspor, round-trip, dan impor melalui file chooser sudah diperiksa. Pengujian yang lulus mencakup kondisi yang disebutkan di atas, bukan jaminan bahwa tidak ada bug lain.
