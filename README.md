# Career Application Tracker (Personal ATS)

**Career Application Tracker** adalah sistem **Personal Applicant Tracking System (ATS)** berbasis web yang dirancang khusus untuk membantu pencari kerja mengelola seluruh siklus pencarian kerja secara terstruktur—mulai dari menemukan dan mengevaluasi kecocokan lowongan, melacak lamaran di dalam pipeline HR 13 tahap, menjadwalkan wawancara dan *follow-up*, mengklasifikasikan email rekrutmen, mengelola versi dokumen CV/portofolio, hingga menganalisis konversi lamaran berbasis data riil.

---

## Latar Belakang & Konteks

Proses mencari kerja di era modern sering kali terasa berantakan dan melelahkan karena beberapa masalah klasik:

1. **Informasi Tersebar di Banyak Platform**  
   Kandidat melamar lewat LinkedIn, JobStreet, Glints, Kalibrr, Indeed, situs karier perusahaan, hingga referral. Tanpa satu pusat data pribadi, sulit mengingat kapan melamar, posisi apa yang dilamar, versi CV mana yang dikirim, serta siapa kontak rekruternya.
2. **Spreadsheet Cepat Menjadi Tidak Efektif**  
   Catatan manual di Excel/Google Sheets biasanya tidak memiliki riwayat perpindahan tahap (*audit trail*), pengingat *follow-up* otomatis berbasis hari kerja, deteksi duplikat URL lowongan, maupun kalender jadwal wawancara dan tes teknis.
3. **Metrik yang Bias & Terlalu Optimis/Pesimis**  
   Banyak pelamar kesulitan mengukur tingkat keberhasilan mereka secara jujur—misalnya mencampurkan data percobaan dengan data riil, atau menganggap lamaran yang belum dibalas sebagai "ditolak". Aplikasi ini menerapkan prinsip **honest metrics**: data sampel dipisahkan otomatis dari lamaran asli, dan status *No Response* hanya ditetapkan melalui konfirmasi pengguna setelah melewati ambang hari tertentu (default 30 hari).
4. **Privasi Data Karier (UU PDP)**  
   Data pencarian kerja (CV, ekspektasi gaji, korespondensi HR, detail kontak rekruter) bersifat pribadi dan sensitif. Aplikasi ini dibangun dengan pendekatan *privacy-first* yang merujuk pada **UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)**—mendukung isolasi data ketat per pengguna, penyimpanan lokal *zero-setup* dengan PGlite, tanpa *scraping* portal kerja, tanpa pengiriman email otomatis atas nama pengguna, serta hak penuh untuk ekspor (JSON/CSV) dan penghapusan akun permanen.

---

## Target Market (Untuk Siapa Aplikasi Ini?)

| Segmen Pengguna | Karakteristik | Kebutuhan Utama yang Terpenuhi |
|---|---|---|
| **Active Job Seekers** | Melamar 5–30+ posisi per bulan lintas platform (LinkedIn, JobStreet, Glints, Kalibrr, Indeed, career page) | Satu *workspace* terpadu (Kanban & Table), kode unik lamaran (`APP-0001`), pengingat *follow-up* otomatis, pencegahan lamaran duplikat, dan pelacakan wawancara/assessment. |
| **Passive Candidates** | Sudah bekerja, sesekali mengevaluasi peluang baru yang menarik | *Job Shortlist* dan kalkulator **Suitability Score (0–100%)** berbasis profil (keahlian, pengalaman, pendidikan, gaji, lokasi, potensi pertumbuhan) sebelum memutuskan melamar. |
| **Fresh Graduates & Career Switchers** | Membutuhkan struktur proses rekrutmen HR dan pengelolaan banyak versi CV/portofolio | Pipeline standar 13 tahap HR, manajemen versi dokumen (CV/Cover Letter/Sertifikat) yang tertaut ke tiap lamaran, serta analitik tingkat respons antar industri dan platform. |
| **Privacy-Conscious Professionals & Self-Hosters** | Menginginkan kepemilikan penuh atas data karier tanpa *vendor lock-in* atau pelacakan pihak ketiga | Dapat dijalankan 100% lokal (embedded PGlite tanpa perlu install PostgreSQL/Docker) atau *self-hosted* ke PostgreSQL/Supabase, lengkap dengan enkripsi token OAuth dan ekspor data penuh. |

---

## Fitur Utama

- **Dashboard & Command Menu (`⌘K` / `Ctrl+K`)**  
  Ringkasan KPI pencarian kerja, grafik performa, jadwal wawancara mendatang, daftar *follow-up* jatuh tempo/terlambat, serta navigasi cepat via *command menu*.
- **Find Jobs & Suitability Evaluation**  
  Simpan lowongan dengan deteksi platform otomatis dari URL (LinkedIn, JobStreet, Indeed, Glints, Kalibrr, Greenhouse, Lever, Workday, dll. tanpa *scraping*) dan peringatan duplikat. Dilengkapi evaluasi kecocokan **6 kriteria** (*Skills*, *Experience*, *Education*, *Salary*, *Location*, *Career Growth*) dengan bobot yang dapat dikustomisasi.
- **Job Shortlist**  
  Kelompokkan lowongan berdasarkan status triase: *Interested*, *Shortlisted*, *Not Interested*, atau *Archived* sebelum benar-benar dikirim.
- **Applications (Kanban Drag-and-Drop & Data Table)**  
  - Pipeline standar **13 tahap HR**: `Sourced` → `Interested` → `Applied` → `CV Screening` → `HR Interview` → `User Interview` → `Assessment / Technical Test` → `Final Interview` → `Offer` → `Hired` / `Rejected` / `Withdrawn` / `No Response`.
  - Dapat dikustomisasi di pengaturan (ubah nama, warna, urutan, tambah tahap *in-progress*, atau sembunyikan tahap).
  - Mendukung lompat tahap (*skip stage*) dan pencatatan riwayat *append-only* pada `application_status_history`.
  - Detail lamaran lengkap dengan 7 tab: *Overview*, *Timeline*, *Communications*, *Interviews*, *Follow-ups*, *Documents*, dan *Offer*.
- **Interviews, Assessments & Job Offers**  
  Kalender & daftar jadwal wawancara, pelacakan *technical test/assessment* beserta tenggat waktu, serta pencatatan dan perbandingan detail penawaran kerja (*Offer*).
- **Email Center (Manual Log & Opsional OAuth Gmail/Outlook)**  
  Klasifikasi deterministik korespondensi rekrutmen (mendukung istilah Bahasa Indonesia & Inggris) untuk mencocokkan email ke lamaran terkait dan merekomendasikan pembaruan tahap (selalu memerlukan konfirmasi pengguna). Mendukung sinkronisasi *read-only* opsional via Google/Microsoft OAuth dengan token terenkripsi AES-256-GCM.
- **Document Repository (Versioning)**  
  Unggah dan kelola versi CV, *cover letter*, sertifikat, dan berkas lainnya (validasi *magic bytes* hingga 10 MB untuk PDF, DOCX, PNG, JPG, WEBP, TXT, MD) dengan isolasi akses per pengguna serta penautan versi dokumen ke masing-masing lamaran.
- **Analytics & Laporan**  
  Funnel rekrutmen, rasio respons per platform dan perusahaan, distribusi industri, tren bulanan, filter rentang tanggal, pemisahan otomatis data sampel (*sample mode*), serta ekspor laporan analitik.
- **Settings & Hak Data (UU PDP)**  
  Konfigurasi profil kandidat, zona waktu (default `Asia/Jakarta`), mata uang (default `IDR`), preset hari libur nasional Indonesia untuk perhitungan hari kerja *follow-up*, kustomisasi pipeline, muat/hapus data sampel, ekspor seluruh data akun (JSON) atau daftar lamaran (CSV aman dari *formula injection*), hingga penghapusan akun permanen.

---

## Cara Penggunaan

### 1. Instalasi & Menjalankan Secara Lokal

Pastikan **Node.js** (disarankan v20+) dan `npm` sudah terpasang.

```bash
# 1. Install dependencies
npm install

# 2. Generate secret di .env.local dan jalankan migrasi + seed sistem (PGlite lokal)
npm run setup

# 3. Jalankan development server
npm run dev
```

Buka `http://localhost:3000` di browser Anda.

#### Mode Database
- **Lokal (Default)**: Jika `DATABASE_URL` di `.env.local` dibiarkan kosong, aplikasi otomatis menggunakan **PGlite** (PostgreSQL embedded) yang disimpan di `./.data/pglite`. Tidak perlu instalasi PostgreSQL atau Docker.
- **Cloud / Production (PostgreSQL / Supabase)**: Isi `DATABASE_URL=postgres://...` di `.env.local`, lalu jalankan `npm run db:migrate`.
- **Opsional OAuth Email (Phase 3)**: Lihat `.env.example` untuk konfigurasi `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (Gmail API) dan `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` (Microsoft Graph).

---

### 2. Registrasi & Onboarding Awal

1. Buka `http://localhost:3000` dan pilih **Sign Up** untuk membuat akun (kata sandi minimal 10 karakter).
2. Sistem otomatis menginisialisasi pengaturan default dan 13 tahap pipeline HR untuk akun Anda.
3. Pada **Dashboard** awal, Anda dapat memilih:
   - **Load sample data** untuk langsung mengeksplorasi tampilan Kanban, analitik, dan detail lamaran menggunakan data demo (bisa dihapus kapan saja dan otomatis dikecualikan dari analitik begitu Anda punya lamaran asli).
   - **Complete your profile** di **Settings** (keahlian, pengalaman tahunan, pendidikan, ekspektasi gaji, lokasi preferensi) agar fitur *Suitability Score* memberi rekomendasi yang akurat.

---

### 3. Alur Kerja Penggunaan Sehari-hari

1. **Temukan & Evaluasi Lowongan (`Find Jobs` & `Job Shortlist`)**
   - Klik **Add job**, tempel URL lowongan (platform dan ID eksternal akan terdeteksi otomatis tanpa *scraping*), lalu lengkapi perusahaan, posisi, gaji, keahlian, dan tenggat waktu.
   - Buka halaman detail lowongan untuk melihat saran skor di panel **Suitability**, sesuaikan skor/catatan, dan tandai status triase (**Interested** / **Shortlisted**).
2. **Catat Pengiriman Lamaran (`Record Submission`)**
   - Dari halaman detail lowongan (atau langsung seret kartu ke kolom **Applied** di papan Kanban, atau lewat tombol **Log application**), catat tanggal kirim, metode lamaran, versi CV, dan kontak rekruter.
   - Sistem membuat kode unik (`APP-0001`, dst.), mencatat riwayat tahap awal, dan menjadwalkan pengingat *follow-up* pertama (default 5 hari kerja).
3. **Pantau & Pindahkan Tahap Seleksi (`Applications`)**
   - Gunakan tampilan **Kanban** untuk *drag-and-drop* kartu antar tahap, atau tampilan **Table** untuk menyaring, mengurutkan, dan mengunduh CSV.
   - Klik satu lamaran untuk membuka detailnya: catat komunikasi di tab *Communications*, jadwalkan wawancara di tab *Interviews*, kelola tugas di tab *Follow-ups*, tautkan versi CV di tab *Documents*, atau catat penawaran gaji di tab *Offer*.
   - Jika melamar ulang ke lowongan yang pernah ditutup (*Rejected/Withdrawn/No Response*), centang opsi *intentional re-application* beserta alasannya.
4. **Kelola Jadwal, Email & Dokumen**
   - Pantau seluruh jadwal wawancara dan tenggat *assessment* di menu **Interviews**.
   - Hubungkan akun email atau catat korespondensi di **Email Center** untuk mendapatkan saran klasifikasi dan pencocokan lamaran.
   - Simpan master CV, *cover letter*, dan sertifikat per versi di menu **Documents**.
5. **Tinjau Analitik & Kelola Data (`Analytics` & `Settings`)**
   - Buka **Analytics** untuk mengevaluasi *conversion funnel*, platform paling efektif, serta tingkat respons perusahaan.
   - Buka **Settings** untuk menyesuaikan tahap pipeline, mengekspor seluruh data (JSON/CSV), menghapus data sampel, atau menghapus akun secara permanen.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions), React 19, TypeScript (strict)
- **Styling & UI**: Tailwind CSS v4, Radix UI primitives, Lucide icons, Geist & Plus Jakarta Sans fonts
- **Database & ORM**: Drizzle ORM dengan PGlite (lokal) / PostgreSQL (production)
- **Authentication & Security**: Better Auth (database sessions, scrypt hashing, rate limiting), Zod validation, AES-256-GCM (OAuth tokens)
- **Interaksi & Visualisasi**: `@dnd-kit` (Kanban), `recharts` (Analytics), `react-hook-form`, `cmdk`, `sonner`
- **Testing**: Vitest (unit & database integration tests pada in-memory PGlite) dan Playwright (E2E)

---

## Scripts

- `npm run setup`: Membuat secret `.env.local` serta menjalankan migrasi dan *system seed*.
- `npm run dev`: Menjalankan server pengembangan Next.js.
- `npm run build`: Membuat *production build*.
- `npm run start`: Menjalankan hasil *production build*.
- `npm run typecheck`: Validasi TypeScript (`tsc --noEmit`).
- `npm run lint`: Menjalankan ESLint.
- `npm run test`: Menjalankan seluruh unit test & integration test (Vitest).
- `npm run test:e2e`: Menjalankan end-to-end & responsive viewport test (Playwright).
- `npm run db:generate`: Generate migrasi Drizzle baru dari skema.
- `npm run db:migrate`: Menjalankan migrasi database.

---

## Dokumentasi Arsitektur & Desain

- [01. Requirements Analysis](docs/01-requirements-analysis.md)
- [02. User Journeys](docs/02-user-journeys.md)
- [03. Architecture](docs/03-architecture.md)
- [04. Database Schema](docs/04-database-schema.md)
- [05. UI/UX Wireframes](docs/05-wireframes.md)
- [06. Privacy and Security (UU PDP)](docs/06-privacy-and-security.md)
