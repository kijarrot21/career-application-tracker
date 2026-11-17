# Career Application Tracker (Personal ATS)

[![CI](https://github.com/kijarrot21/career-application-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/kijarrot21/career-application-tracker/actions/workflows/ci.yml)

**Career Application Tracker** adalah sistem **Personal Applicant Tracking System (ATS)** berbasis web yang dirancang khusus untuk membantu pencari kerja mengelola seluruh siklus pencarian kerja secara terstruktur—mulai dari menemukan dan mengevaluasi kecocokan lowongan, melacak lamaran di dalam pipeline HR 13 tahap, menjadwalkan wawancara dan *follow-up*, mengklasifikasikan email rekrutmen, mengelola versi dokumen CV/portofolio, hingga menganalisis konversi lamaran berbasis data riil.

## Status Proyek (per November 2026)

| Bagian | Status |
|---|---|
| Fase 0–2 (Fondasi, Core ATS, Arsip, Profil Karier) | ✅ Selesai |
| Fase 3–4 (AI Engine Hybrid & Fitur Karier AI / CV Studio) | ✅ Selesai |
| Fase 5–6 (Kredit & Pembayaran Midtrans/Stripe) | ✅ Selesai |
| Fase 7–8 (Sinkronisasi Lokal–Awan & REST API v1) | ✅ Selesai |
| Fase 9 (Lokalisasi id-ID/en-US, IDR/USD) | ✅ Selesai |
| Fase 10 (Keamanan & Tata Kelola Data UU PDP) | ✅ Selesai |
| Fase 11 (QA & Testing) | ✅ Selesai — 1 pengecualian diterima (RLS PostgreSQL, ditunda ke fase hardening awan) |

**Quality gates terverifikasi:** 125/125 unit & integration test (Vitest) · 4/4 E2E (Playwright: core journey + aksesibilitas) · typecheck · lint · production build — semuanya juga dijalankan otomatis oleh [CI GitHub Actions](.github/workflows/ci.yml) pada setiap push dan pull request.

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
- **Application Archive**  
  Arsipan *snapshot* lamaran yang tertutup (*Rejected/Withdrawn/No Response*) beserta catatan penutupan, dengan *retention purge* otomatis dan pencegahan lamaran ulang tanpa konfirmasi.
- **Master Career Profile**  
  Profil karier induk (keahlian, pengalaman, pendidikan, sertifikasi) yang menjadi sumber data terverifikasi untuk *Suitability Score*, *skill-gap analysis*, dan generator AI. Data terverifikasi dilindungi dari penimpaan otomatis oleh AI.
- **AI Engine Hybrid (Ollama / OpenAI / Gemini)**  
  Router AI *provider-agnostic* yang dapat berjalan lokal (Ollama) atau awan (OpenAI/Gemini) dengan *consent gate* eksplisit, pertahanan *prompt injection*, dan *fallback* deterministik. Menjalankan: ekstraksi CV, evaluasi CV, koreksi CV, generasi CV/cover letter, analisis kecocokan lowongan, analisis *skill gap*, dan peta jalan karier.
- **CV Studio**  
  Studio penyuntingan dan generasi CV berbasis AI dengan pratinjau, kontrol versi, dan prinsip *human-in-the-loop* (semua keluaran AI memerlukan konfirmasi).
- **Kredit & Pembayaran**  
  Dompet kredit *server-authoritative* (atomik: `FOR UPDATE` + CAS + kunci idempotensi) untuk membeli kuota fitur AI, dengan pembayaran via **Midtrans** (verifikasi tanda tangan SHA-512) dan **Stripe** (webhook HMAC), lengkap dengan buku besar (*ledger*), reservasi kredit, dan pengembalian dana.
- **Sinkronisasi Hibrida Lokal–Awan**  
  *Outbox pattern* untuk mendorong perubahan lokal ke penyimpanan awan, *pull* perubahan jauh, deteksi konflik berbasis versi dengan resolusi eksplisit, serta *replay* yang aman.
- **REST API v1**  
  API terversi (`/api/v1/*`) dengan autentikasi sesi/API key, validasi Zod, *rate limiting*, dan kunci idempotensi untuk klien eksternal dan sinkronisasi.
- **Lokalisasi Global**  
  Dukungan dua pasar: **Indonesia** (id-ID, IDR, zona waktu Asia/Jakarta) dan **Global** (en-US, USD), dengan atribut `lang` dokumen yang selaras dan format tanggal/mata uang otomatis.

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

> ⚠️ **Aturan operasional penting:** jangan pernah menjalankan `npm run setup` atau `npm run db:migrate` saat `next dev` sedang berjalan. Akses bersamaan ke `./.data/pglite` dapat merusak direktori data secara permanen (bug upstream PGlite [#884](https://github.com/electric-sql/pglite/issues/884)). Hentikan dev server terlebih dahulu.

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

- **Framework**: Next.js 16.4.6 (App Router, Server Components, Server Actions, Turbopack), React 19, TypeScript (strict)
- **Styling & UI**: Tailwind CSS v4, Radix UI primitives, Lucide icons, Geist & Plus Jakarta Sans fonts
- **Database & ORM**: Drizzle ORM 0.45 dengan PGlite (lokal) / PostgreSQL (production)
- **Authentication & Security**: Better Auth 1.7 (database sessions, scrypt hashing, rate limiting), Zod validation, AES-256-GCM (OAuth tokens), PKCE + HMAC state, CSP global, magic-byte upload validation, malware scan hooks, signed download tokens
- **AI**: Ollama (lokal) / OpenAI / Gemini (awan) di belakang router `provider-agnostic` dengan consent gate dan pertahanan prompt injection
- **Pembayaran**: Midtrans (SHA-512) & Stripe (HMAC webhook), dompet kredit atomik server-authoritative
- **Interaksi & Visualisasi**: `@dnd-kit` (Kanban), `recharts` (Analytics), `react-hook-form`, `cmdk`, `sonner`
- **Testing**: Vitest 5 (125 unit & integration tests pada in-memory PGlite) dan Playwright (E2E: core journey + suite aksesibilitas/keyboard)

---

## Scripts

- `npm run setup`: Membuat secret `.env.local` serta menjalankan migrasi dan *system seed*. **⚠️ Hentikan `next dev` dulu — jangan dijalankan bersamaan (lihat peringatan di atas).**
- `npm run dev`: Menjalankan server pengembangan Next.js.
- `npm run build`: Membuat *production build*.
- `npm run start`: Menjalankan hasil *production build*.
- `npm run typecheck`: Validasi TypeScript (`tsc --noEmit`).
- `npm run lint`: Menjalankan ESLint.
- `npm run test`: Menjalankan seluruh unit test & integration test (Vitest, in-memory PGlite terisolasi).
- `npm run test:e2e`: Menjalankan end-to-end & accessibility test (Playwright, in-memory PGlite di port 3105).
- `npm run db:generate`: Generate migrasi Drizzle baru dari skema.
- `npm run db:migrate`: Menjalankan migrasi database. **⚠️ Aturan yang sama: jangan saat dev server aktif.**

---

## Keamanan & Tata Kelola Data

- **Isolasi tenant** ketat per pengguna di setiap query/service (filter `userId` eksplisit + composite foreign keys).
- **Token OAuth** (Gmail/Microsoft) dienkripsi **AES-256-GCM**; alur otorisasi memakai **PKCE (S256)** dan *state* bertanda tangan HMAC dengan perlindungan *replay* (TTL 10 menit, perbandingan *timing-safe*).
- **Unggahan dokumen**: validasi *magic bytes*, batas 10 MB dengan *pre-check* 413, kaitan sandi (*sandbox* CSP) pada respons dokumen inline, *malware scan hooks*, dan *token* unduhan bertanda tangan.
- **CSP global** berbasis lingkungan (`next.config.ts`); penghapusan akun + ekspor data penuh sesuai **UU PDP No. 27/2022**.
- **Pengecualian yang diterima:** Row-Level Security (RLS) PostgreSQL untuk mode awan belum diimplementasikan — terdokumentasi sebagai DEF-11-006 dan ditunda ke fase *cloud hardening*.

---

## Dokumentasi Arsitektur & Desain

### Spesifikasi Fase (01–18)
- [01. Requirements Analysis](docs/01-requirements-analysis.md)
- [02. User Journeys](docs/02-user-journeys.md)
- [03. Architecture](docs/03-architecture.md)
- [04. Database Schema](docs/04-database-schema.md)
- [05. UI/UX Wireframes](docs/05-wireframes.md)
- [06. Privacy and Security (UU PDP)](docs/06-privacy-and-security.md)
- [07. Application Archive](docs/07-application-archive.md)
- [08. Master Career Profile](docs/08-master-career-profile.md)
- [09. AI Architecture](docs/09-ai-architecture.md)
- [10. AI Career Intelligence](docs/10-ai-career-intelligence.md)
- [11. CV Studio](docs/11-cv-studio.md)
- [12. Credit System](docs/12-credit-system.md)
- [13. Payment Architecture](docs/13-payment-architecture.md)
- [14. Hybrid Sync](docs/14-hybrid-sync.md)
- [15. API Reference](docs/15-api-reference.md)
- [16. Global Localization](docs/16-global-localization.md)
- [18. Security and Data Governance](docs/18-security-and-data-governance.md)

### Status & QA (Fase 11)
- [Phase Progress Status](docs/PHASE_PROGRESS_STATUS.md) — tabel status per fase berbasis bukti
- [QA Audit](docs/PHASE_11_QA_AUDIT.md) · [Test Strategy](docs/PHASE_11_TEST_STRATEGY.md) · [Coverage Matrix](docs/PHASE_11_TEST_COVERAGE_MATRIX.md) · [Environment Matrix](docs/PHASE_11_ENVIRONMENT_TEST_MATRIX.md) · [Defect Register](docs/PHASE_11_DEFECT_REGISTER.md)
- [Handover Report](docs/OPENCODE_HANDOVER_REPORT.md) — panduan serah terima untuk kontributor berikutnya

### Referensi Lain
- [Current Architecture](docs/CURRENT_ARCHITECTURE.md) — arsitektur teknis aktual
- [Database Gap Analysis](docs/DATABASE_GAP_ANALYSIS.md) · [Security Review](docs/SECURITY_REVIEW_REPORT.md) · [Security Gap Analysis](docs/SECURITY_GAP_ANALYSIS.md) · [Repository Audit](docs/REPOSITORY_AUDIT.md)
- [UI/UX Audit](docs/ui-ux-audit.md) · [UI/UX Roadmap](docs/ui-ux-improvement-roadmap.md) · [Development Backlog](DEVELOPMENT_BACKLOG.md)
