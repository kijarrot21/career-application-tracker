import type { TranslationMessages } from "../types";

export const ID_ID_MESSAGES: TranslationMessages = {
  meta: {
    localeName: "Bahasa Indonesia (id-ID)",
    languageCode: "id-ID",
  },
  nav: {
    pipelineGroup: "Alur Rekrutmen",
    assetsGroup: "Aset & Penemuan Karier",
    dashboard: "Dasbor",
    applications: "Lamaran",
    archive: "Arsip Lamaran",
    interviews: "Wawancara",
    analytics: "Analitik",
    careerProfile: "Profil Karier Utama",
    cvStudio: "Studio CV AI",
    jobs: "Cari Lowongan",
    shortlist: "Daftar Prioritas",
    documents: "Dokumen",
    emails: "Pusat Email",
    credits: "Dompet Kredit",
    sync: "Sinkronisasi Hibrida",
    settings: "Pengaturan",
    collapseSidebar: "Perkecil sidebar",
    expandSidebar: "Perluas sidebar",
    signOut: "Keluar",
    searchPlaceholder: "Cari lowongan, lamaran, perusahaan, atau tag...",
    searchShort: "Cari...",
  },
  common: {
    save: "Simpan",
    saving: "Menyimpan...",
    cancel: "Batal",
    loading: "Memuat...",
    notSet: "Belum diatur",
    notSpecified: "Tidak disebutkan",
    undisclosed: "Tidak diungkapkan",
    from: "Mulai",
    upTo: "Hingga",
    to: "hingga",
    language: "Bahasa",
    timezone: "Zona Waktu",
    currency: "Mata Uang",
    indicativeDisplayNote:
      "Perkiraan tampilan saja (bukan nilai penyelesaian transaksi).",
  },
  statuses: {
    outcome: {
      active: "Aktif",
      successful: "Diterima",
      unsuccessful: "Tidak Lolos",
      withdrawn: "Dibatalkan Kandidat",
      no_response: "Tanpa Respons",
      closed: "Ditutup",
    },
    stageType: {
      sourced: "Ditemukan",
      interested: "Tertarik",
      applied: "Dilamar",
      screening: "Seleksi CV",
      interview: "Wawancara",
      assessment: "Tes / Asesmen",
      offer: "Penawaran Kerja",
      hired: "Diterima",
      rejected: "Ditolak",
      withdrawn: "Mengundurkan Diri",
      no_response: "Tanpa Respons",
    },
    archiveOutcome: {
      rejected: "Ditolak",
      withdrawn: "Mengundurkan Diri",
      hired: "Diterima",
      no_response: "Tanpa Respons",
      closed: "Ditutup",
    },
    triage: {
      new: "Baru",
      interested: "Tertarik",
      shortlisted: "Prioritas",
      not_interested: "Tidak Cocok",
      archived: "Diarsipkan",
    },
    priority: {
      low: "Rendah",
      medium: "Sedang",
      high: "Tinggi",
    },
    workArrangement: {
      onsite: "Di Kantor (On-site)",
      hybrid: "Hibrida",
      remote: "Jarak Jauh (Remote)",
    },
    searchStatus: {
      actively_searching: "Aktif mencari kerja",
      open_to_offers: "Terbuka untuk tawaran",
      paused: "Pencarian dijeda",
      hired: "Sudah diterima / Tidak mencari",
    },
    salaryPeriod: {
      month: "/bln",
      year: "/thn",
      hour: "/jam",
      project: "/proyek",
    },
  },
  settings: {
    pageTitle: "Pengaturan, Kustomisasi Pipeline & Privasi Data",
    pageDescription:
      "Konfigurasi bahasa, zona waktu, mata uang tampilan, tahapan rekrutmen, aturan follow-up, dan privasi data.",
    workspaceSectionTitle: "1. Lokalisasi Workspace & Status Pencarian",
    workspaceSectionDescription:
      "Atur bahasa antarmuka, zona waktu, mata uang tampilan default, dan status pencarian kerja Anda.",
    preferredLanguageLabel: "Bahasa Utama",
    preferredLanguageHint:
      "Mengatur bahasa tampilan antarmuka, format tanggal/angka, dan prompt AI default.",
    timezoneLabel: "Zona Waktu",
    currencyLabel: "Mata Uang Tampilan Default",
    currencyHint:
      "Mata uang tampilan tidak mengubah mata uang transaksi pembayaran yang diverifikasi server.",
    searchStatusLabel: "Status Pencarian Kerja",
    saveWorkspaceButton: "Simpan Pengaturan Workspace",
    workspaceSavedToast: "Pengaturan workspace diperbarui.",
    languageSwitchedToast: "Bahasa diubah ke Bahasa Indonesia (id-ID).",
  },
  help: {
    button: "Panduan modul",
    dialogTitle: "Cara kerja modul ini",
    purposeLabel: "Tujuan",
    fieldsLabel: "Kolom dan aksi penting",
    outcomeLabel: "Hasil yang diharapkan",
    stageLabel: "Tahapan alur kerja terkait",
    nextLabel: "Aksi berikutnya",
    close: "Tutup panduan",
    modules: {
      careerProfile: {
        title: "Profil Karier",
        purpose:
          "Simpan satu sumber data profesional terverifikasi untuk penilaian kesesuaian dan alat AI.",
        fields:
          "Isi data profesional, pengalaman, pendidikan, keahlian, sertifikasi, dan proyek. Hanya keahlian terverifikasi pengguna yang dihitung.",
        outcome:
          "Profil memenuhi aturan isReadyForAi: data profesional, satu pengalaman, dan tiga keahlian terverifikasi.",
        stage: "Profil Karier",
        next: "Simpan CV utama di Dokumen.",
      },
      cvStudio: {
        title: "Studio CV",
        purpose:
          "Urai CV, nilai kualitas ATS, tinjau usulan suntingan, dan ekspor CV yang didasarkan data.",
        fields:
          "Pilih sumber berkas, bahasa, mode privasi, dan setujui suntingan AI sebelum diterapkan.",
        outcome: "Draf CV siap diekspor dan disimpan sebagai versi dokumen.",
        stage: "Unggah CV",
        next: "Simpan CV hasil ekspor di Dokumen.",
      },
      documents: {
        title: "Repositori Dokumen",
        purpose:
          "Simpan versi CV, surat lamaran, sertifikat, dan dokumen lamaran lainnya.",
        fields:
          "Pilih kategori, judul, dan label versi. Unggahan memeriksa jenis berkas, ukuran, dan tanda malware.",
        outcome:
          "Minimal satu CV utama atau khusus memiliki versi berkas tersimpan.",
        stage: "Unggah CV",
        next: "Temukan dan simpan lowongan pekerjaan.",
      },
      jobDiscovery: {
        title: "Penemuan Lowongan",
        purpose:
          "Catat lowongan, cegah duplikasi, dan urutkan peluang sebelum melamar.",
        fields:
          "Isi URL, perusahaan, posisi, gaji, tenggat, platform, dan status triase. Skor kesesuaian dapat diubah di detail lowongan.",
        outcome: "Tersedia lowongan tersimpan dengan data yang cukup untuk dinilai.",
        stage: "Penemuan Lowongan",
        next: "Nilai kesesuaian lowongan tersebut.",
      },
      shortlist: {
        title: "Daftar Pendek",
        purpose:
          "Bandingkan lowongan menarik dan terseleksi berdasarkan skor serta tenggat.",
        fields:
          "Gunakan status triase, perbandingan, skor, dan tenggat. Menandai shortlist belum membuat lamaran.",
        outcome: "Minimal satu lowongan berstatus shortlisted atau interested.",
        stage: "Daftar Pendek",
        next: "Catat lamaran untuk lowongan terpilih.",
      },
      applications: {
        title: "Lamaran",
        purpose:
          "Lacak lamaran melalui tahapan rekrutmen yang dapat disesuaikan.",
        fields:
          "Gunakan papan Kanban atau tabel untuk memindahkan tahap, mencatat alasan, menautkan CV, dan mencatat aktivitas rekruter.",
        outcome: "Lamaran nyata memiliki riwayat tahap dan tindak lanjut terjadwal.",
        stage: "Pembuatan Lamaran",
        next: "Catat wawancara, asesmen, atau tindak lanjut.",
      },
      interviews: {
        title: "Wawancara dan Asesmen",
        purpose:
          "Kelola jadwal wawancara, catatan persiapan, umpan balik, dan asesmen teknis.",
        fields:
          "Catat tanggal, jenis, hasil, dan tahap. Asesmen mencatat tenggat, penyelesaian, skor, dan hasil.",
        outcome: "Aktivitas pelacakan nyata tercatat pada lamaran.",
        stage: "Pelacakan Rekrutmen",
        next: "Buka Lamaran, pilih lamaran, lalu catat penawaran atau hasil akhir.",
      },
      archive: {
        title: "Arsip",
        purpose:
          "Periksa lamaran ditutup, snapshot permanen, dan status retensi tanpa menghapus riwayat.",
        fields:
          "Gunakan hasil penutupan, dokumen tersimpan, kebijakan retensi, pemulihan, dan pengajuan ulang yang disengaja.",
        outcome: "Lamaran selesai memiliki catatan penutupan dan snapshot.",
        stage: "Penawaran dan Hasil",
        next: "Tinjau rekomendasi di dasbor untuk pekerjaan tersisa.",
      },
    },
  },
  onboardingSettings: {
    sectionTitle: "Onboarding & Panduan",
    sectionDescription:
      "Kelola pengaturan guided setup dan tur produk. Tidak mengubah data lamaran.",
    statusTitle: "Status onboarding",
    progressTitle: "Progres alur kerja aktual",
    modeLabel: "Mode",
    guidedStartedLabel: "Guided setup dimulai",
    positionLabel: "Posisi tutorial saat ini",
    completedSectionsLabel: "Bagian tutorial selesai",
    skippedSectionsLabel: "Bagian tutorial dilewati",
    tourActiveLabel: "Langkah tur produk aktif",
    dismissedRemindersLabel: "Pengingat ditutup",
    yes: "Ya",
    no: "Tidak",
    none: "Tidak ada",
    resumeGuidedButton: "Lanjutkan Guided Setup",
    restartGuidedButton: "Ulangi Guided Setup",
    restartTourButton: "Ulangi Tur Produk",
    dismissRemindersButton: "Tutup Pengingat Onboarding",
    resumeToast: "Guided setup siap dilanjutkan.",
    restartGuidedToast: "Guided setup diulang. Data lamaran tidak berubah.",
    restartTourToast: "Tur produk diulang dan dibuka.",
    dismissToast: "Pengingat onboarding ditutup. Rekomendasi tetap aktif.",
    labels: {
      mode: { guided: "Terpandu", self_paced: "Mandiri" },
      section: {
        career_profile: "Profil Karier",
        cv_upload: "Unggah CV",
        job_discovery: "Penemuan Lowongan",
        suitability_evaluation: "Evaluasi Kesesuaian",
        shortlist: "Daftar Pendek",
        job_application: "Lamaran",
        recruitment_tracking: "Pelacakan Rekrutmen",
        offers_outcomes: "Penawaran dan Hasil",
      },
      tourStep: {
        navigation: "Navigasi workspace",
        global_search: "Pencarian global",
        getting_started: "Memulai",
        next_best_action: "Aksi terbaik berikutnya",
        add_vacancy: "Tambah lowongan",
      },
      stage: {
        career_profile: "Profil Karier",
        cv_upload: "Unggah CV",
        job_discovery: "Penemuan Lowongan",
        suitability_evaluation: "Evaluasi Kesesuaian",
        shortlist: "Daftar Pendek",
        job_application: "Lamaran",
        recruitment_tracking: "Pelacakan Rekrutmen",
        offers_outcomes: "Penawaran dan Hasil",
      },
    },
  },
  cv: {
    indonesianTemplateLabel: "Format CV Indonesia (Terstruktur & ATS)",
    internationalTemplateLabel: "Resume Internasional (Gaya AS/Global)",
    sections: {
      summary: "RINGKASAN PROFESIONAL",
      experience: "PENGALAMAN KERJA",
      projects: "PROYEK TERKAIT",
      skills: "KEAHLIAN TEKNIS & KOMPETENSI",
      education: "PENDIDIKAN",
      certifications: "SERTIFIKASI",
      languages: "BAHASA",
      coverLetter: "SURAT LAMARAN (DRAF)",
      technologiesPrefix: "Teknologi",
    },
  },
  errors: {
    UNAUTHORIZED: "Sesi belum terautentikasi. Silakan masuk kembali.",
    FORBIDDEN: "Anda tidak memiliki izin untuk mengakses sumber daya ini.",
    INVALID_WEBHOOK_SIGNATURE: "Tanda tangan webhook pembayaran tidak valid.",
    NOT_FOUND: "Data yang diminta tidak ditemukan.",
    INVALID_ID: "Format ID tidak valid; harus berupa UUID.",
    INVALID_JSON: "Body permintaan harus berupa JSON yang valid.",
    VALIDATION_ERROR: "Validasi input gagal. Periksa kembali isian Anda.",
    UNSUPPORTED_MEDIA_TYPE: "Format file tidak didukung.",
    CONFLICT: "Terjadi konflik versi atau status data.",
    UNPROCESSABLE_ENTITY: "Permintaan tidak dapat diproses karena aturan domain.",
    INSUFFICIENT_CREDITS: "Saldo kredit AI tidak mencukupi.",
    RATE_LIMIT_EXCEEDED: "Batas frekuensi permintaan terlampaui. Coba lagi sebentar.",
    PRIVACY_MODE_BLOCKED: "Penyedia AI cloud diblokir oleh mode privasi Lokal Saja.",
    CONSENT_REQUIRED: "Persetujuan eksplisit diperlukan sebelum mengirim dokumen ke AI cloud.",
    SYNC_FORBIDDEN_ENTITY:
      "Entitas kredit dan pembayaran dikontrol penuh oleh server cloud dan tidak dapat disinkronkan dari perangkat lokal.",
    SYNC_CLOUD_DISABLED: "Sinkronisasi cloud dinonaktifkan menunggu persetujuan produksi.",
    SYNC_LOCAL_ONLY_MODE:
      "Perangkat berada dalam mode offline lokal saja (local_only).",
    ARCHIVE_SNAPSHOT_IMMUTABLE:
      "Snapshot arsip historis bersifat permanen dan tidak dapat diubah.",
    DOCUMENT_VERSION_IMMUTABLE:
      "Versi dokumen yang sudah ada tidak boleh ditimpa.",
    INTERNAL_ERROR: "Terjadi kesalahan internal pada server.",
    UNKNOWN_ERROR: "Terjadi kesalahan yang tidak terduga.",
  },
};

