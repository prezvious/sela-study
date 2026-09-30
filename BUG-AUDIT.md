# Audit awal bug sela.

Tanggal: 30 September 2026. Proyek sekarang berada di `C:\Users\camar\Documents\Coding\sela-study`.

Pemindahan selesai: seluruh 23 file proyek diverifikasi dengan SHA256 sebelum dan setelah dipindahkan. Folder proyek lama sudah tidak ada. Server dijalankan ulang dari folder baru dan tetap menggunakan `http://127.0.0.1:4318/`. Perintah menjalankan aplikasi di README disesuaikan dengan lokasi baru.

Ketiga uji yang sudah ada lulus. Audit tambahan menemukan sembilan masalah: dua direproduksi di browser, enam dengan kode aplikasi asli dalam pengujian terkontrol, dan satu dalam panduan pemasangan. Kesembilan temuan telah dikonfirmasi ulang dan diperbaiki pada tahap berikutnya; lihat FIX-VERIFICATION.md. Uraian, bukti, nomor baris, dan perbaikan yang disarankan di bawah menggambarkan kode sebelum perbaikan dan disimpan sebagai riwayat audit.

Pengujian browser menggunakan origin terpisah `http://localhost:4318/` dengan fixture buatan audit. Catatan pengguna pada origin `http://127.0.0.1:4318/` tidak digunakan untuk reproduksi. Pengujian jam, konkurensi tab, dan respons Auth dilakukan dalam replay Node.js dengan penyimpanan/DOM/layanan tiruan. Ini membuktikan jalur kode yang bermasalah, tetapi tidak mengklaim adanya pengujian akun Supabase nyata atau bahwa semua pengguna akan mengalami masalah tersebut.

## 1. Penambahan tugas melewati batas membuat catatan tidak dapat dibuka — prioritas tinggi

**Lokasi:** `dist/app.mjs:41` (`editTask`), `dist/app.mjs:16` (`persist`), dan `dist/core.mjs:75`.

**Pemicu:** sebuah catatan valid berisi 20.000 tugas, lalu pengguna menambah satu tugas melalui form normal. Batas 20.000 diterapkan pada pembacaan/import, tetapi tidak pada penambahan tugas.

**Bukti T001:** replay menjalankan callback submit form aplikasi yang asli. Penyimpanan berakhir dengan 20.001 tugas. `restoreLocalState()` kemudian menolak JSON tersebut. Setelah reload, aplikasi menganggap catatan tidak dapat dibaca dan menampilkan keadaan kosong beserta kontrol pemulihan.

**Dampak:** catatan asli masih ada dalam JSON mentah, sehingga ini bukan penghapusan fisik data. Namun, pengguna tidak dapat melanjutkan, mengedit, atau menghapus satu tugas melalui UI normal untuk mengurangi jumlahnya: `mutate()` memblokir perubahan ketika data mentah tidak terbaca. Pemulihan memerlukan unduh file asli lalu koreksi JSON, atau mulai ulang.

**Penyebab:** `editTask()` melakukan `next.tasks.push(...)`; `persist()` menulis hasilnya tanpa memvalidasi invariannya. Pembacaan berikutnya baru menerapkan batas.

**Perbaikan yang disarankan:** tolak penambahan sebelum batas terlewati, tampilkan alasan pada form, dan pastikan hasil mutasi tetap valid sebelum ditulis. Audit reproduksi ini secara spesifik membuktikan batas tugas, bukan pencapaian batas itu oleh pengguna sehari-hari.

## 2. Cadangan yang diekspor dapat terlalu besar untuk diimpor kembali — prioritas menengah

**Lokasi:** `dist/app.mjs:43` (`exportData`) dan `dist/app.mjs:75` (`file.size > 20000000`).

**Pemicu:** data berjumlah besar yang masih memenuhi batas format; ekspor menggunakan `JSON.stringify(copy, null, 2)`, sedangkan impor dibatasi 20.000.000 byte.

**Bukti T002:** dataset valid dengan 100.000 segmen menghasilkan JSON ekspor sebesar **26.200.508 byte**, melebihi batas impor. Validasi format dataset berhasil, tetapi pemeriksaan ukuran file UI akan menolaknya sebelum JSON divalidasi.

**Dampak:** cadangan besar yang dibuat aplikasi sendiri tidak dapat dipulihkan lewat alur impor aplikasi. Ini terutama relevan untuk data besar di memori atau cloud; batas kapasitas localStorage browser dapat tercapai lebih dahulu, dan audit ini tidak mengklaim dataset tersebut sudah tersimpan pada browser pengguna.

**Penyebab:** batas jumlah catatan, ukuran ekspor, dan ukuran impor tidak diselaraskan. Pemformatan JSON juga menambah ukuran.

**Perbaikan yang disarankan:** selaraskan batas ukuran yang didukung antara penulisan, ekspor, dan impor; atau sediakan cadangan terkompresi/terbagi yang dapat dipulihkan. Beri peringatan sebelum menghasilkan cadangan yang tidak bisa dibaca kembali.

## 3. Perubahan hampir bersamaan dari dua tab dapat saling menimpa — prioritas tinggi, bersyarat

**Lokasi:** `dist/app.mjs:17` (`mutate`), `dist/app.mjs:16` (`persist`), dan `dist/app.mjs:77` (storage listener).

**Pemicu:** dua tab membaca snapshot yang sama sebelum keduanya selesai menulis. Misalnya tab A menambah tugas A dan tab B menambah tugas B.

**Bukti T003:** replay menjalankan fungsi `mutate()` asli pada dua konteks dengan storage bersama. Urutan dikendalikan: A membaca snapshot, B membaca dan menyimpan tugas B, lalu A menyimpan snapshot lamanya ditambah tugas A. Hasil akhir hanya memuat tugas A; tugas B hilang.

**Dampak:** salah satu perubahan dapat hilang dari snapshot tersimpan. Storage listener menyebarkan hasil akhir, tetapi tidak mengembalikan perubahan yang sudah tertimpa.

**Penyebab:** rangkaian baca–ubah–tulis seluruh JSON tidak dilindungi transaksi atau penguncian. Membaca ulang sebelum setiap mutasi mengurangi stale state biasa, tetapi tidak membuat seluruh rangkaian atomik.

**Batas bukti:** reproduksi memakai interleaving terkontrol, bukan klaim bahwa klik manual dua tab selalu menghasilkan race. Risiko membutuhkan operasi yang bertumpang tindih.

**Perbaikan yang disarankan:** gunakan transaksi IndexedDB atau penguncian antar-tab yang mendukung browser target, ditambah versi snapshot dan penanganan konflik. Jangan mengandalkan storage event sebagai mekanisme pencegah kehilangan update.

## 4. Rincian mata pelajaran pada modal tanggal lama ditimpa data hari ini — prioritas menengah

**Lokasi:** `dist/app.mjs:22` (`subjectRows`), `dist/app.mjs:42` (`showDay`), dan `dist/app.mjs:85`–`87` (tick).

**Pemicu:** dari Ruang belajar, klik tanggal sebelumnya di heatmap dan biarkan modal terbuka setidaknya satu tick timer, sekitar satu detik. Stopwatch tidak harus berjalan.

**Bukti T004 dan browser:** fixture menyimpan satu jam Matematika pada 29 September dan 30 menit pada 30 September. Modal tanggal 29 September tetap menampilkan total `01:00:00` dan timeline satu jam, tetapi baris Matematika berubah menjadi `30m`. Replay dengan hari ini kosong menghasilkan perubahan dari `1j 0m` menjadi `0m`.

**Dampak:** rincian tidak sesuai dengan total pada tanggal yang sama. Data sesi tersimpan tidak berubah; kesalahan terjadi pada tampilan baris durasi dan progres mata pelajaran.

**Penyebab:** saat `view === 'study'`, tick memilih seluruh `[data-subject-time]` dan `[data-subject-progress]` di dokumen. Elemen modal ikut terpilih dan diisi menggunakan agregasi hari ini.

**Perbaikan yang disarankan:** batasi pembaruan ke panel hari ini, atau simpan tanggal/lingkup setiap komponen agar modal memakai agregasi tanggalnya sendiri.

![Rincian kemarin satu jam tetapi baris pelajaran menampilkan 30 menit](C:/Users/camar/Documents/Codex/2026-09-30/sa/outputs/sela-bug-detail-date.jpg)

## 5. Pergantian hari meninggalkan sel “hari ini” pada tanggal kemarin — prioritas menengah

**Lokasi:** `dist/app.mjs:89` dan `dist/app.mjs:92`.

**Pemicu:** biarkan halaman Kalender terbuka melewati tengah malam tanpa berpindah tampilan atau refresh.

**Bukti T005:** jam terkontrol berpindah dari 30 September pukul 23:59:59 ke 1 Oktober pukul 00:00:01. Sel bertanda `.today` masih memiliki `data-date="2026-09-30"`, tetapi tick mengganti aria-label menjadi `1 Oktober 2026: 00:00:00 belajar`.

**Dampak:** penanda, warna/tooltip/label aksesibilitas, dan aksi klik dapat menunjuk tanggal yang berbeda. Klik masih membuka 30 September. Pada grid yang sudah memuat 1 Oktober sebagai tanggal masa depan, status disabled-nya juga belum diperbarui sampai render berikutnya.

**Penyebab:** tick memperbarui sel `.today` yang lama; saat tanggal berganti, render ulang hanya dipanggil pada Ruang belajar dan ketika modal tertutup, bukan pada Kalender. Variabel penanda hari sudah diperbarui sehingga pengecekan pergantian hari tidak mengulang render pada tick berikutnya.

**Perbaikan yang disarankan:** tangani pergantian hari untuk semua tampilan, ubah tanggal sel aktif/status masa depan, dan tunda render dengan penanda pending jika modal harus tetap terbuka.

## 6. Angka kalender mingguan/bulanan tertinggal saat stopwatch berjalan — prioritas menengah

**Lokasi:** `dist/app.mjs:27`, `dist/app.mjs:29`, dan `dist/app.mjs:79`–`93`.

**Pemicu:** mulai belajar lalu buka Kalender → Minggu dan biarkan halaman tetap terbuka. Total footer pada Bulan juga menggunakan nilai saat render.

**Bukti T006:** replay setelah 65 detik memberi label sel hari ini `00:01:05`, tetapi footer tetap `0m belajar minggu ini`. Browser dengan fixture 30 menit hari ini dan satu jam kemarin menunjukkan label hari ini `00:31:55`, tetapi angka hari tetap `30m` dan footer tetap `1j 30m`, bukan `1j 31m`.

**Dampak:** kalender menampilkan angka lama sampai pengguna melakukan aksi yang memicu render, meskipun warna/label sel sudah diperbarui. Data timer terus dihitung; ini kesalahan pembaruan tampilan.

**Penyebab:** tick memperbarui kelas, title, dan aria-label sel hari ini, tetapi tidak mengubah angka `<small>` mingguan atau footer total. Render berkala 30 detik hanya dilakukan untuk halaman Statistik.

**Perbaikan yang disarankan:** beri binding live untuk angka harian/footer kalender atau render ulang komponen kalender pada interval yang sesuai tanpa merusak fokus.

## 7. Impor menerima sesi tumpang tindih dan menjumlahkannya dua kali — prioritas menengah

**Lokasi:** `dist/core.mjs:80` (validasi sesi) dan `dist/core.mjs:65` (agregasi).

**Pemicu:** impor dua sesi dengan ID/runId berbeda yang mencakup interval waktu yang sama. Durasi dan referensi subjek masing-masing valid.

**Bukti T007:** dua sesi 10:00–11:00 pada tanggal yang sama diterima validator. Agregasi menghasilkan dua jam dari interval jam dinding satu jam.

**Dampak:** statistik, target, dan intensitas heatmap dapat membesar secara tidak wajar jika cadangan telah diedit atau menggabungkan catatan yang tumpang tindih. Ini tidak berarti timer biasa selalu menghasilkan duplikasi.

**Penyebab:** validator mengecek durasi, ID unik, dan kesesuaian subjek per run, tetapi tidak mengecek benturan antarinterval. Agregasi menjumlahkan semua interval tanpa deduplikasi.

**Perbaikan yang disarankan:** tetapkan aturan untuk benturan sesuai desain satu subjek aktif: tolak atau minta pengguna menyelesaikan benturan pada impor, atau gunakan perhitungan union interval bila duplikasi memang ingin didukung.

## 8. Navigasi ketika login masih diproses dapat menampilkan error palsu — prioritas menengah

**Lokasi:** `dist/app.mjs:76` (handler submit Auth).

**Pemicu:** mulai Masuk/Daftar pada Pengaturan, lalu berpindah ke Ruang belajar sebelum respons autentikasi kembali.

**Bukti T008:** layanan Auth tiruan menunda respons sukses. Setelah navigasi menghapus elemen `#cloud-status`, respons dipenuhi. Handler mencoba menulis `textContent` pada `null`, lalu toast menampilkan `Cannot set properties of null (setting 'textContent')`.

**Dampak:** pengguna bisa melihat error UI meskipun autentikasi sudah berhasil. Ini bukan bukti bahwa Supabase menolak akun atau bahwa login real sudah diuji.

**Penyebab:** kode setelah `await cloud.authenticate(...)` mengasumsikan form dan elemen status masih berada di halaman.

**Perbaikan yang disarankan:** periksa keberadaan elemen dan tampilkan hasil melalui state/status global. Navigasi harus aman ketika permintaan masih berjalan; alternatifnya, batalkan permintaan/abaikan hasil untuk tampilan yang sudah ditinggalkan.

## 9. Panduan Supabase masih menyuruh menekan tombol yang telah dihapus — prioritas rendah

**Lokasi:** `dist/panduan-supabase.html:1`, langkah keenam.

**Pemicu:** buka panduan dan ikuti instruksi penghubungan Supabase.

**Bukti T009:** panduan masih berbunyi “Pilih Gunakan data saya untuk keluar dari pratinjau contoh”. Tombol tersebut sudah tidak ada dan generator data contoh sudah dihapus.

**Dampak:** pengguna diarahkan ke langkah yang tidak bisa dilakukan. Penyimpanan cloud berikutnya dapat tetap digunakan; masalah ini pada panduan, bukan bukti kegagalan backend.

**Penyebab:** alur UI telah diperbarui, tetapi dokumen setup belum mengikuti perubahan.

**Perbaikan yang disarankan:** hapus instruksi keluar dari data contoh dan langsung jelaskan tombol Simpan ke cloud/Ambil dari cloud.

## Bukti dan cara mengulang

- [Hasil replay JSON](C:/Users/camar/Documents/Codex/2026-09-30/sa/outputs/sela-audit-evidence.json)
- [Runner regresi setelah perbaikan](C:/Users/camar/Documents/Codex/2026-09-30/sa/outputs/sela-audit-repro.mjs)

```powershell
node "C:\Users\camar\Documents\Codex\2026-09-30\sa\outputs\sela-audit-repro.mjs" "C:\Users\camar\Documents\Coding\sela-study"
```

Runner tersebut sekarang menjalankan enam skrip regresi setelah perbaikan dan menulis sela-fix-evidence.json. Kasus UI tetap menjalankan fungsi aplikasi asli dengan DOM, clock, storage, lock dan Auth tiruan. Bukti JSON awal di atas menggambarkan hasil sebelum perbaikan. Lihat FIX-VERIFICATION.md untuk hasil, batas pengujian dan perbaikan setiap temuan.

Autentikasi, RPC, dan RLS Supabase pada layanan nyata tetap belum diuji karena proyek/akun belum tersedia. Pemeriksaan ini juga bukan jaminan bahwa tidak ada bug lain di luar skenario yang dijalankan.
