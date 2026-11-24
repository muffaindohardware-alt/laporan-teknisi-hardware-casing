// ==========================================
// LAPORAN SERVICE SISTEM ANDROID - WEB APP
// Client-side Application Logic
// ==========================================

const DEFAULT_USERS = [
  {
    id: 1,
    username: 'hardware',
    password: 'hardware123',
    nama: 'Teknisi Hardware',
    role: 'Teknisi Hardware'
  },
  {
    id: 2,
    username: 'casing',
    password: 'casing123',
    nama: 'Teknisi Casing',
    role: 'Teknisi Casing'
  }
];

const DEFAULT_ADMIN = DEFAULT_USERS[0];

const INITIAL_DATA = {
  users: DEFAULT_USERS,
  jenisAlat: [
    { id: 1, nama: 'INF HOT 11 PLAY' },
    { id: 2, nama: 'INF HOT 50I' },
    { id: 3, nama: 'INF HOT 60I' },
    { id: 4, nama: 'INF SMART 10' },
    { id: 5, nama: 'INF SMART 20' },
    { id: 6, nama: 'INF SMART 6+' },
    { id: 7, nama: 'PC' },
    { id: 8, nama: 'SAMSUNG' }
  ],
  kategoriLokasi: [
    { id: 1, nama: 'Teknisi Limin' },
    { id: 2, nama: 'Rutan Bangil' },
    { id: 3, nama: 'Ponpes Salafiyah Sukorejo' },
    { id: 4, nama: 'Hardware Andika' }
  ],
  laporan: []
};

let data = { ...INITIAL_DATA };
let currentDb = 'hardware_hp';
let currentUser = null;
let editingLaporanId = null;
let editingJenisAlatId = null;
let editingLokasiId = null;
let dayCheckInterval = null;
let isSavingLaporan = false;
let pendingAvatarData = null;

// ==========================================
// KONFIGURASI MULTI-LANDING PAGE & MULTI-DATABASE
// ==========================================
const LANDING_CONFIGS = {
  hardware: [
    {
      id: 'hardware_hp',
      title: 'Service HP, PC & Tab',
      shortTitle: 'HP, PC & Tab',
      icon: '📱💻',
      badge: 'HP & PC',
      itemNoun: 'Alat',
      reportNoun: 'Laporan Service HP, PC & Tab',
      desc: 'Sistem laporan service handphone, PC, dan tablet',
      keteranganLabel: 'Keterangan / Jenis Perbaikan',
      jenisLabel: 'Jenis Alat',
      kondisiLabel: 'Lama / Baru'
    },
    {
      id: 'hardware_alat',
      title: 'Service Alat Lain',
      shortTitle: 'Alat Lain',
      icon: '🔌',
      badge: 'Alat Lain',
      itemNoun: 'Peralatan',
      reportNoun: 'Laporan Service Alat Lain',
      desc: 'Sistem laporan service perangkat dan peralatan lainnya',
      keteranganLabel: 'Keterangan / Jenis Perbaikan',
      jenisLabel: 'Jenis Alat / Perangkat',
      kondisiLabel: 'Lama / Baru'
    },
    {
      id: 'hardware_rusak',
      title: 'Data Barang Rusak',
      shortTitle: 'Barang Rusak',
      icon: '⚠️',
      badge: 'Barang Rusak',
      itemNoun: 'Barang Rusak',
      reportNoun: 'Data Barang Rusak',
      desc: 'Pencatatan data barang rusak, afkir, retur, dan kanibal',
      keteranganLabel: 'Keterangan Kerusakan / Alasan Rusak',
      jenisLabel: 'Nama / Jenis Barang Rusak',
      kondisiLabel: 'Kondisi Kerusakan'
    }
  ],
  casing: [
    {
      id: 'casing_admin',
      title: 'Dari Admin Stock',
      shortTitle: 'Admin Stock',
      icon: '📦',
      badge: 'Admin Stock',
      itemNoun: 'Casing',
      reportNoun: 'Laporan Casing - Dari Admin Stock',
      desc: 'Sistem laporan perbaikan casing masuk dari admin stock',
      keteranganLabel: 'Keterangan / Jenis Perbaikan Casing',
      jenisLabel: 'Jenis Casing / Part',
      kondisiLabel: 'Lama / Baru'
    },
    {
      id: 'casing_paket',
      title: 'Dari Paket',
      shortTitle: 'Dari Paket',
      icon: '📮',
      badge: 'Dari Paket',
      itemNoun: 'Casing',
      reportNoun: 'Laporan Casing - Dari Paket',
      desc: 'Sistem laporan perbaikan casing masuk dari kiriman paket',
      keteranganLabel: 'Keterangan / Jenis Perbaikan Casing',
      jenisLabel: 'Jenis Casing / Kiriman',
      kondisiLabel: 'Lama / Baru'
    }
  ]
};

// ==========================================
// KOLOM HASIL DATA (urutan seragam: tabel web, rekap bulanan & Excel)
// No, Jenis/Kategori, Jumlah, Lokasi/Sumber, Tgl Masuk, Tgl Keluar,
// Lama/Baru, Lama Hari, Status, Keterangan/Jenis Perbaikan
// Landing "Data Barang Rusak": tanpa Tgl Keluar/Lama Hari/Status,
// diganti Persentase Sparepart Hidup (%)
// ==========================================
function isRusakLanding() { return currentDb === 'hardware_rusak'; }

function hasTglKeluarVal(l) { return !!(l && l.tanggalKeluar && String(l.tanggalKeluar).trim()); }

function lamaHariDisplay(l) {
  return hasTglKeluarVal(l) ? ((l.lamaHari !== undefined && l.lamaHari !== null ? l.lamaHari : 0) + ' hari') : '-';
}

function getPersenHidup(l) {
  if (!l || l.persenHidup === undefined || l.persenHidup === null || l.persenHidup === '') return null;
  const p = parseFloat(l.persenHidup);
  return isNaN(p) ? null : Math.max(0, Math.min(100, p));
}

function persenHidupDisplay(l) {
  const p = getPersenHidup(l);
  return p === null ? '-' : (Math.round(p * 100) / 100) + '%';
}

function getLaporanColumnKeys() {
  if (isRusakLanding()) {
    return ['no', 'jenis', 'jumlah', 'lokasi', 'tglMasuk', 'kondisi', 'persen', 'keterangan'];
  }
  return ['no', 'jenis', 'jumlah', 'lokasi', 'tglMasuk', 'tglKeluar', 'kondisi', 'lamaHari', 'status', 'keterangan'];
}

function getLaporanColumnLabel(key) {
  const rusak = isRusakLanding();
  const cfg = getCurrentLandingConfig();
  switch (key) {
    case 'no': return 'No';
    case 'jenis': return rusak ? cfg.jenisLabel : 'Jenis / Kategori';
    case 'jumlah': return 'Jumlah';
    case 'lokasi': return 'Lokasi / Sumber';
    case 'tglMasuk': return 'Tanggal Masuk';
    case 'tglKeluar': return 'Tanggal Keluar';
    case 'kondisi': return rusak ? cfg.kondisiLabel : 'Lama / Baru';
    case 'lamaHari': return 'Lama Hari';
    case 'status': return 'Status';
    case 'persen': return 'Sparepart Hidup (%)';
    case 'keterangan': return rusak ? cfg.keteranganLabel : 'Keterangan / Jenis Perbaikan';
  }
  return key;
}

// variant: 'main' | 'pill' (dashboard & rekap bulanan)
function getLaporanCellHtml(key, l, variant) {
  const selesai = hasTglKeluarVal(l);
  switch (key) {
    case 'no': return `<td><strong>${escapeHtml(l.no || '-')}</strong></td>`;
    case 'jenis': return `<td>${escapeHtml(l.jenisAlatNama || '-')}</td>`;
    case 'jumlah': return `<td>${l.jumlahAlat || 1}</td>`;
    case 'lokasi': return `<td>${escapeHtml(l.lokasiDari || '-')}</td>`;
    case 'tglMasuk': return `<td>${escapeHtml(l.tanggalMasuk || '-')}</td>`;
    case 'tglKeluar': return `<td>${escapeHtml(l.tanggalKeluar || '-')}</td>`;
    case 'kondisi': return `<td>${escapeHtml(l.kondisi || 'Lama')}</td>`;
    case 'lamaHari': return `<td>${lamaHariDisplay(l)}</td>`;
    case 'status':
      if (variant === 'pill') {
        return `<td><span class="badge-status-pill ${selesai ? 'selesai' : 'belum'}">${selesai ? '✓ Selesai' : '⏳ Belum Selesai'}</span></td>`;
      }
      return `<td><span class="badge-status ${selesai ? 'status-selesai' : 'status-proses'}">${selesai ? '✓ Selesai' : '⏳ Belum Selesai'}</span></td>`;
    case 'persen': {
      const p = getPersenHidup(l);
      const cls = p === null ? '' : (p >= 70 ? 'tinggi' : (p >= 30 ? 'sedang' : 'rendah'));
      return `<td><span class="persen-pill ${cls}">${persenHidupDisplay(l)}</span></td>`;
    }
    case 'keterangan': return `<td style="text-align:left;">${escapeHtml(l.keteranganPerbaikan || '-')}</td>`;
  }
  return '<td></td>';
}

function renderLaporanHead(rowId, withAksi) {
  const tr = document.getElementById(rowId);
  if (!tr) return;
  let html = getLaporanColumnKeys().map(k => {
    const style = k === 'no' ? ' style="width: 65px;"' : '';
    return `<th${style}>${escapeHtml(getLaporanColumnLabel(k))}</th>`;
  }).join('');
  if (withAksi) html += '<th style="text-align: center; width: 120px;">Aksi</th>';
  tr.innerHTML = html;
}

function sortLaporanByNo(list) {
  const getNum = (no) => parseInt(String(no || '').replace(/[^0-9]/g, ''), 10) || 0;
  return list.slice().sort((a, b) => {
    const na = getNum(a.no), nb = getNum(b.no);
    if (na !== nb) return na - nb;
    const da = a.tanggalMasuk || '', db = b.tanggalMasuk || '';
    if (da !== db) return da.localeCompare(db);
    return (a.id || 0) - (b.id || 0);
  });
}

function getAvgPersenHidup(list) {
  const vals = list.map(getPersenHidup).filter(v => v !== null);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function getCurrentUserRole() {
  if (currentUser && currentUser.username) {
    return currentUser.username.toLowerCase() === 'casing' ? 'casing' : 'hardware';
  }
  return 'hardware';
}

function getLandingListForRole(role) {
  return LANDING_CONFIGS[role] || LANDING_CONFIGS.hardware;
}

function getCurrentLandingConfig() {
  const role = getCurrentUserRole();
  const list = getLandingListForRole(role);
  const found = list.find(item => item.id === currentDb);
  return found || list[0];
}

function renderLandingNavbar() {
  const container = document.getElementById('landingTabsContainer');
  if (!container) return;
  const role = getCurrentUserRole();
  const list = getLandingListForRole(role);

  container.innerHTML = '';
  list.forEach(tab => {
    const isActive = tab.id === currentDb;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `landing-tab-btn ${isActive ? 'active' : ''}`;
    btn.onclick = () => switchLandingPage(tab.id);

    // Dapatkan hitungan laporan untuk badge
    let count = 0;
    if (tab.id === currentDb) {
      count = Array.isArray(data.laporan) ? data.laporan.length : 0;
    } else {
      try {
        const cached = localStorage.getItem(`laporan_service_web_backup_${tab.id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.laporan)) count = parsed.laporan.length;
        }
      } catch (e) {}
    }

    btn.innerHTML = `
      <span class="landing-tab-icon">${tab.icon}</span>
      <span>${tab.title}</span>
      <span class="landing-tab-badge" id="tab-badge-${tab.id}">${count}</span>
    `;
    container.appendChild(btn);
  });

  const sectionBadge = document.getElementById('currentSectionTitle');
  if (sectionBadge) {
    const activeCfg = getCurrentLandingConfig();
    sectionBadge.textContent = activeCfg.title;
  }
}

async function switchLandingPage(targetDbKey) {
  if (currentDb === targetDbKey) return;
  const role = getCurrentUserRole();
  const list = getLandingListForRole(role);
  const targetConfig = list.find(t => t.id === targetDbKey);
  if (!targetConfig) return;

  // Simpan data aktif saat ini sebelum beralih
  await saveData(false);

  currentDb = targetDbKey;
  localStorage.setItem('active_database', currentDb);
  localStorage.setItem(`active_landing_${role}`, currentDb);

  // Muat data untuk database baru
  await loadData(currentDb, false);

  // Update UI navbar dan landing context
  renderLandingNavbar();
  applyLandingPageContext(targetConfig);
  showToast(`✓ Beralih ke bagian: ${targetConfig.title}`, 'info');
}

function applyLandingPageContext(cfg) {
  if (!cfg) cfg = getCurrentLandingConfig();
  const role = getCurrentUserRole();
  const isRusak = cfg.id === 'hardware_rusak';

  // 1. Dashboard Heading
  const dTitle = document.getElementById('dashboardLandingTitle');
  if (dTitle) dTitle.textContent = isRusak ? 'Data Barang Rusak' : `Dashboard ${cfg.title}`;
  const dSub = document.getElementById('dashboardLandingSubtitle');
  if (dSub) dSub.textContent = cfg.desc;

  // 2. Stat Card Labels
  const stat1 = document.getElementById('statCard1Label');
  if (stat1) stat1.textContent = isRusak ? 'TOTAL BARANG RUSAK' : (role === 'casing' ? 'TOTAL CASING' : 'TOTAL LAPORAN');
  const stat2 = document.getElementById('statCard2Label');
  if (stat2) stat2.textContent = isRusak ? 'TOTAL UNIT RUSAK' : 'TOTAL UNIT ALAT';
  const stat3 = document.getElementById('statCard3Label');
  if (stat3) stat3.textContent = isRusak ? 'RATA-RATA SPAREPART HIDUP' : 'SELESAI';
  const stat4 = document.getElementById('statCard4Label');
  if (stat4) stat4.textContent = isRusak ? 'SPAREPART HIDUP 0%' : 'BELUM SELESAI';

  // 3. Navigation Text in Sidebar
  const navLap = document.getElementById('navLaporanText');
  if (navLap) navLap.textContent = isRusak ? 'Data Barang Rusak' : 'Data Laporan';
  const navMas = document.getElementById('navMasterText');
  if (navMas) navMas.textContent = isRusak ? 'Kategori Barang' : 'Data Kategori';

  // 4. Page Laporan Bar
  const pTitle = document.getElementById('pageLaporanTitle');
  if (pTitle) pTitle.textContent = isRusak ? 'Tabel Data Barang Rusak' : `Tabel ${cfg.title}`;
  const pDesc = document.getElementById('pageLaporanDesc');
  if (pDesc) pDesc.textContent = cfg.desc;
  const btnAddMain = document.getElementById('btnTambahLaporanMain');
  if (btnAddMain) btnAddMain.textContent = `+ Tambah ${cfg.itemNoun}`;
  const quickLabel = document.getElementById('sidebarQuickAddLabel');
  if (quickLabel) quickLabel.textContent = `Tambah ${cfg.itemNoun}`;

  // 5. Table Headers
  const thKet = document.getElementById('thTableKeterangan');
  if (thKet) thKet.textContent = cfg.keteranganLabel;
  const thJen = document.getElementById('thTableJenis');
  if (thJen) thJen.textContent = cfg.jenisLabel;
  const thKon = document.getElementById('thTableKondisi');
  if (thKon) thKon.textContent = cfg.kondisiLabel;

  const thRecKet = document.getElementById('thRecentKeterangan');
  if (thRecKet) thRecKet.textContent = cfg.keteranganLabel;
  const thRecJen = document.getElementById('thRecentJenis');
  if (thRecJen) thRecJen.textContent = cfg.jenisLabel;

  // 6. Kategori Master Labels
  const pillAlat = document.getElementById('pillKategoriAlatText');
  if (pillAlat) pillAlat.textContent = isRusak ? '⚠️ Kategori Barang Rusak' : (role === 'casing' ? '📦 Kategori Casing' : '🔧 Kategori Alat');
  const cardTitleJenis = document.getElementById('cardTitleJenisAlat');
  if (cardTitleJenis) cardTitleJenis.textContent = isRusak ? 'Daftar Kategori Barang Rusak' : `Daftar Kategori ${cfg.itemNoun}`;
  const thMasterNama = document.getElementById('thMasterNamaAlat');
  if (thMasterNama) thMasterNama.textContent = `NAMA ${cfg.jenisLabel.toUpperCase()}`;
  const btnAddJenis = document.getElementById('btnTambahJenisAlat');
  if (btnAddJenis) btnAddJenis.textContent = `+ Tambah ${cfg.itemNoun}`;

  // 7. Modal Laporan Labels
  const mTitle = document.getElementById('modalLaporanTitle');
  if (mTitle && !editingLaporanId) mTitle.textContent = `Tambah ${cfg.reportNoun}`;
  const lblJenis = document.getElementById('lblModalJenisAlat');
  if (lblJenis) lblJenis.textContent = `${cfg.jenisLabel} *`;
  const lblKet = document.getElementById('lblModalKeterangan');
  if (lblKet) lblKet.textContent = `${cfg.keteranganLabel} *`;
  const lblKon = document.getElementById('lblModalKondisi');
  if (lblKon) lblKon.textContent = `${cfg.kondisiLabel}`;
  const lblJenisNama = document.getElementById('lblModalJenisAlatNama');
  if (lblJenisNama) lblJenisNama.textContent = `Nama ${cfg.jenisLabel} *`;
  const mJenisTitle = document.getElementById('modalJenisAlatTitle');
  if (mJenisTitle && !editingJenisAlatId) mJenisTitle.textContent = `Tambah Kategori ${cfg.itemNoun}`;

  // 8. Bulanan & Export
  const tabBul = document.getElementById('tabBulananJudul');
  if (tabBul) tabBul.textContent = `Rekap Bulanan - ${cfg.title}`;
  const expTitle = document.getElementById('exportTitle');
  if (expTitle) expTitle.value = `Laporan ${cfg.title} Bulanan`;

  // 9. Mobile Title & Sidebar Badge
  const mobTitle = document.getElementById('mobileTitle');
  if (mobTitle) mobTitle.textContent = cfg.shortTitle;
  const sBadge = document.getElementById('sidebarRoleBadge');
  if (sBadge) sBadge.textContent = role === 'casing' ? 'CASING' : 'HARDWARE';

  // 10. Kolom tabel & field khusus Data Barang Rusak
  renderLaporanHead('recentTableHead', false);
  renderLaporanHead('laporanTableHead', true);
  const setShow = (id, show) => { const el = document.getElementById(id); if (el) el.style.display = show ? '' : 'none'; };
  setShow('grpTglKeluar', !isRusak);
  setShow('grpLamaHari', !isRusak);
  setShow('grpPersenHidup', isRusak);
  setShow('filterGroupStatus', !isRusak);
  if (isRusak && filterStatus !== 'semua') {
    filterStatus = 'semua';
    const fs = document.getElementById('filterStatus');
    if (fs) fs.value = 'semua';
  }
}

function updateDatabaseBadgeUI() {
  const dbBadge = document.getElementById('dbStatusBadge');
  const activeCfg = getCurrentLandingConfig();
  if (dbBadge) {
    dbBadge.innerHTML = `🗄️ Database: <b>${activeCfg.title}</b>`;
  }
}

// Filter state
let filterStatus = 'semua';
let filterJenisAlat = '';
let filterBulan = '';
let filterTahun = '';

const DEFAULT_AVATAR_SVG = `<svg viewBox="0 0 100 100" style="width: 100%; height: 100%; border-radius: 50%;">
  <circle cx="50" cy="50" r="48" fill="#e0f2fe"/>
  <path d="M28 44 C26 28 35 14 50 14 C65 14 74 28 72 44 Z" fill="#b45309"/>
  <path d="M42 56 L42 68 L58 68 L58 56 Z" fill="#fed7aa"/>
  <ellipse cx="50" cy="42" rx="19" ry="20" fill="#fde68a"/>
  <path d="M30 38 C34 22 46 16 54 16 C66 16 70 24 69 32 C61 25 50 22 39 28 C34 30 31 35 30 38 Z" fill="#9a3412"/>
  <ellipse cx="31" cy="42" rx="3.5" ry="5.5" fill="#fde68a"/>
  <ellipse cx="69" cy="42" rx="3.5" ry="5.5" fill="#fde68a"/>
  <circle cx="43" cy="41" r="2.2" fill="#1e293b"/>
  <circle cx="57" cy="41" r="2.2" fill="#1e293b"/>
  <path d="M39 36 Q43 34 47 36" stroke="#9a3412" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M53 36 Q57 34 61 36" stroke="#9a3412" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M45 49 Q50 54 55 49" stroke="#b45309" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M20 92 C22 74 33 66 42 65 L42 76 L50 83 L58 76 L58 65 C67 66 78 74 80 92 Z" fill="#1e293b"/>
  <polygon points="42,65 50,78 39,66" fill="#ffffff"/>
  <polygon points="58,65 50,78 61,66" fill="#ffffff"/>
  <polygon points="50,67 54,72 50,90 46,72" fill="#2563eb"/>
</svg>`;

// ==========================================
// RESPONSIVE MOBILE SIDEBAR TOGGLE
// ==========================================
function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}

// ==========================================
// AUTENTIKASI & AUTO-LOGOUT GANTI HARI
// ==========================================
function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function checkDayChange() {
  if (!currentUser) return;
  const loginDate = localStorage.getItem('auth_login_date');
  const today = getTodayDateString();
  if (loginDate && loginDate !== today) {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_login_date');
    currentUser = null;
    if (dayCheckInterval) {
      clearInterval(dayCheckInterval);
      dayCheckInterval = null;
    }
    showLoginScreen();
    showToast('Sesi Anda telah berakhir karena hari berganti. Silakan login kembali.', 'info');
  }
}

function startDayChangeWatcher() {
  if (dayCheckInterval) clearInterval(dayCheckInterval);
  dayCheckInterval = setInterval(checkDayChange, 60 * 1000);
}

function checkAuth() {
  // Selalu hapus sesi lama agar tidak auto-login — user harus login manual setiap kali buka halaman
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_login_date');
  currentUser = null;
  showLoginScreen();
}

function showLoginScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appScreen) appScreen.style.display = 'none';

  // Kosongkan kedua field agar user harus isi ulang setiap kali
  const userInput = document.getElementById('loginUsername');
  if (userInput) userInput.value = '';
  const pwdInput = document.getElementById('loginPassword');
  if (pwdInput) pwdInput.value = '';
  const errEl = document.getElementById('loginError');
  if (errEl) errEl.style.display = 'none';

  setTimeout(() => {
    if (userInput) userInput.focus();
  }, 100);
}

function showAppScreen() {
  const loginScreen = document.getElementById('loginScreen');
  const appScreen = document.getElementById('appScreen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';

  updateSidebarProfile();
  renderLandingNavbar();
  applyLandingPageContext(getCurrentLandingConfig());
  updateDatabaseBadgeUI();
  showTab('dashboard');
  renderDashboard();
}

function handleLoginSubmit(event) {
  if (event) event.preventDefault();
  const uname = (document.getElementById('loginUsername').value || '').trim();
  const pwd = document.getElementById('loginPassword').value || '';
  const errEl = document.getElementById('loginError');

  const userList = Array.isArray(data.users) && data.users.length > 0 ? data.users : DEFAULT_USERS;
  
  const matchedUser = userList.find(u => 
    u.username && u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd
  ) || DEFAULT_USERS.find(u => 
    u.username && u.username.toLowerCase() === uname.toLowerCase() && u.password === pwd
  );

  if (matchedUser) {
    const isCasing = matchedUser.username.toLowerCase() === 'casing';
    const roleKey = isCasing ? 'casing' : 'hardware';

    currentUser = {
      id: matchedUser.id || 1,
      username: matchedUser.username,
      nama: matchedUser.nama || (isCasing ? 'Teknisi Casing' : 'Teknisi Hardware'),
      role: matchedUser.role || (isCasing ? 'Teknisi Casing' : 'Teknisi Hardware'),
      avatar: matchedUser.avatar || ''
    };

    // Tentukan database landing page default sesuai user yang login
    const savedLanding = localStorage.getItem(`active_landing_${roleKey}`);
    const validLandings = LANDING_CONFIGS[roleKey].map(l => l.id);
    currentDb = validLandings.includes(savedLanding) ? savedLanding : validLandings[0];

    localStorage.setItem('active_database', currentDb);
    localStorage.setItem('auth_user', JSON.stringify(currentUser));
    localStorage.setItem('auth_login_date', getTodayDateString());
    if (errEl) errEl.style.display = 'none';

    // Buka aplikasi utama
    showAppScreen();
    startDayChangeWatcher();
    showToast(`✓ Selamat datang, ${currentUser.nama || currentUser.username}! Terhubung ke ${getCurrentLandingConfig().title}`, 'success');

    // Muat data spesifik database di background
    loadData(currentDb, false);
  } else {
    if (errEl) {
      errEl.textContent = 'Username atau Password salah! Periksa kembali.';
      errEl.style.display = 'block';
    }
    const pwdInput = document.getElementById('loginPassword');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.focus();
    }
  }
}

function togglePasswordVisibility(targetInputId = 'loginPassword') {
  const pwdInput = document.getElementById(targetInputId) || document.getElementById('loginPassword');
  if (!pwdInput) return;
  const isPassword = pwdInput.type === 'password';
  pwdInput.type = isPassword ? 'text' : 'password';

  // Update ikon tombol jika ada
  const btn = event && event.currentTarget;
  if (btn) {
    btn.textContent = isPassword ? '🙈' : '👁️';
    btn.setAttribute('title', isPassword ? 'Sembunyikan password' : 'Lihat password');
  }
}

function logout() {
  if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_login_date');
    currentUser = null;
    if (dayCheckInterval) {
      clearInterval(dayCheckInterval);
      dayCheckInterval = null;
    }
    closeMobileSidebar();
    showLoginScreen();
    showToast('Anda telah keluar dari sistem.', 'info');
  }
}

function updateSidebarProfile() {
  const sidebarUserName = document.getElementById('sidebarUserName');
  const avatarContainer = document.getElementById('sidebarAvatarContainer');

  if (sidebarUserName && currentUser) {
    sidebarUserName.textContent = `${currentUser.username} (${currentUser.role || 'Admin'})`;
  }
  if (avatarContainer) {
    if (currentUser && currentUser.avatar) {
      avatarContainer.innerHTML = `<img src="${currentUser.avatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
    } else {
      avatarContainer.innerHTML = DEFAULT_AVATAR_SVG;
    }
  }
}

// ==========================================
// TOAST NOTIFIKASI & INDIKATOR SIMPAN
// ==========================================
function showToast(message, type = 'info', action = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const span = document.createElement('span');
  span.textContent = message;
  toast.appendChild(span);

  if (action && action.label && action.callback) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    btn.onclick = () => {
      action.callback();
      toast.remove();
    };
    toast.appendChild(btn);
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function updateSaveStatus(status) {
  const indicator = document.getElementById('saveStatusIndicator');
  const textEl = document.getElementById('saveStatusText');
  if (!indicator || !textEl) return;

  if (status === 'saving') {
    indicator.className = 'status-badge saving';
    textEl.textContent = 'Menyimpan...';
  } else if (status === 'saved') {
    indicator.className = 'status-badge saved';
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    textEl.textContent = `Tersimpan otomatis (${timeStr})`;
  } else if (status === 'error') {
    indicator.className = 'status-badge error';
    textEl.textContent = 'Gagal menyimpan!';
  }
}

// ==========================================
// PERSISTENSI DATA (SERVER REST API + LOCALSTORAGE FALLBACK)
// ==========================================
async function loadData(targetDb = null, triggerCheckAuth = true) {
  if (targetDb) {
    currentDb = targetDb;
  } else {
    const role = getCurrentUserRole();
    const savedLanding = localStorage.getItem(`active_landing_${role}`);
    const validLandings = LANDING_CONFIGS[role].map(l => l.id);
    currentDb = validLandings.includes(savedLanding) ? savedLanding : (currentDb || validLandings[0]);
  }

  // Normalisasi alias lama jika ada
  if (currentDb === 'hardware') currentDb = 'hardware_hp';
  if (currentDb === 'casing') currentDb = 'casing_admin';

  try { localStorage.setItem('active_database', currentDb); } catch (e) {}
  updateSaveStatus('saving');
  updateDatabaseBadgeUI();
  let loadedSuccessfully = false;

  // 1. Coba fetch dari server backend Node.js untuk database aktif
  try {
    const res = await fetch(`/api/data?db=${currentDb}`, { cache: 'no-store' });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && typeof serverData === 'object') {
        let users = Array.isArray(serverData.users) && serverData.users.length > 0 ? serverData.users : DEFAULT_USERS;
        let kategoriLokasi = Array.isArray(serverData.kategoriLokasi) ? serverData.kategoriLokasi : INITIAL_DATA.kategoriLokasi;
        
        data = {
          users,
          jenisAlat: Array.isArray(serverData.jenisAlat) ? serverData.jenisAlat : INITIAL_DATA.jenisAlat,
          kategoriLokasi,
          laporan: Array.isArray(serverData.laporan) ? serverData.laporan : []
        };
        // Simpan ke localStorage sebagai offline backup khusus database ini
        try { localStorage.setItem(`laporan_service_web_backup_${currentDb}`, JSON.stringify(data)); } catch (e) {}
        loadedSuccessfully = true;
      }
    }
  } catch (err) {
    console.warn(`Backend API tidak merespons untuk [${currentDb}], memuat dari localStorage offline...`, err);
  }

  // 2. Jika server tidak tersedia, muat dari localStorage offline khusus database ini
  if (!loadedSuccessfully) {
    try {
      const offline = localStorage.getItem(`laporan_service_web_backup_${currentDb}`);
      if (offline) {
        const parsed = JSON.parse(offline);
        data = {
          users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
          jenisAlat: Array.isArray(parsed.jenisAlat) ? parsed.jenisAlat : INITIAL_DATA.jenisAlat,
          kategoriLokasi: Array.isArray(parsed.kategoriLokasi) ? parsed.kategoriLokasi : INITIAL_DATA.kategoriLokasi,
          laporan: Array.isArray(parsed.laporan) ? parsed.laporan : []
        };
      } else {
        data = { ...INITIAL_DATA, laporan: [] };
      }
    } catch (e) {
      data = { ...INITIAL_DATA, laporan: [] };
    }
  }

  updateSaveStatus('saved');
  populateFilterDropdowns();
  renderAll();
  renderLandingNavbar();
  applyLandingPageContext(getCurrentLandingConfig());
  if (triggerCheckAuth) {
    checkAuth();
  }
  checkServerInfo();
  updateDatabaseBadgeUI();

  // Update badge count aktif
  const tabBadge = document.getElementById(`tab-badge-${currentDb}`);
  if (tabBadge && Array.isArray(data.laporan)) {
    tabBadge.textContent = data.laporan.length;
  }
}

async function checkServerInfo() {
  const dbBadge = document.getElementById('dbStatusBadge');
  try {
    const res = await fetch('/api/info', { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      if (dbBadge && info && info.databases) {
        const activeDbInfo = info.databases[currentDb];
        const activeCfg = getCurrentLandingConfig();
        if (activeDbInfo && activeDbInfo.connected && activeDbInfo.engine === 'mysql') {
          dbBadge.style.background = '#ecfdf5';
          dbBadge.style.color = '#047857';
          dbBadge.style.borderColor = '#a7f3d0';
          dbBadge.innerHTML = `🗄️ MySQL: <b>${activeCfg.title}</b> (${activeDbInfo.database})`;
        } else {
          dbBadge.style.background = '#f0fdf4';
          dbBadge.style.color = '#166534';
          dbBadge.style.borderColor = '#bbf7d0';
          dbBadge.innerHTML = `📁 Storage: <b>${activeCfg.title}</b> [JSON: ${currentDb}]`;
        }
      }
    } else if (dbBadge) {
      const activeCfg = getCurrentLandingConfig();
      dbBadge.style.background = '#f1f5f9';
      dbBadge.style.color = '#64748b';
      dbBadge.innerHTML = `📁 Storage Offline: <b>${activeCfg.title}</b>`;
    }
  } catch (e) {
    if (dbBadge) {
      const activeCfg = getCurrentLandingConfig();
      dbBadge.style.background = '#f1f5f9';
      dbBadge.style.color = '#64748b';
      dbBadge.innerHTML = `📁 Storage Offline: <b>${activeCfg.title}</b>`;
    }
  }
}

async function saveData(isManual = false) {
  updateSaveStatus('saving');
  // Selalu simpan ke localStorage offline untuk database aktif
  try {
    localStorage.setItem(`laporan_service_web_backup_${currentDb}`, JSON.stringify(data));
  } catch (e) {}

  let serverSaved = false;
  try {
    const res = await fetch(`/api/save-data?db=${currentDb}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Database': currentDb
      },
      body: JSON.stringify({ ...data, db: currentDb })
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) serverSaved = true;
    }
  } catch (err) {
    console.warn(`Gagal sinkron ke server API [${currentDb}], tersimpan di browser storage saja:`, err);
  }

  updateSaveStatus('saved');
  const activeCfg = getCurrentLandingConfig();
  if (isManual) {
    showToast(`✓ Data "${activeCfg.title}" berhasil disimpan!`, 'success');
  }

  // Update badge count di landing navbar
  const tabBadge = document.getElementById(`tab-badge-${currentDb}`);
  if (tabBadge && Array.isArray(data.laporan)) {
    tabBadge.textContent = data.laporan.length;
  }
}

function manualSaveData() {
  saveData(true);
}

// ==========================================
// TAMPILAN TAB & RENDER
// ==========================================
function getFormattedCurrentMonth() {
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const now = new Date();
  return `${months[now.getMonth()]} ${now.getFullYear()}`;
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const targetTab = document.getElementById('tab-' + tab);
  if (targetTab) targetTab.classList.add('active');

  document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('btn-nav-' + tab);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'dashboard') {
    renderDashboard();
  } else if (tab === 'laporan') {
    renderLaporan();
  } else if (tab === 'master') {
    renderJenisAlat();
    renderKategoriLokasi();
  } else if (tab === 'bulanan') {
    renderCekBulananTab();
  }
}

function renderAll() {
  renderDashboard();
  renderLaporan();
  renderJenisAlat();
  renderJenisAlatSelect();
  renderKategoriLokasi();
  renderLokasiDatalist();
  populateFilterDropdowns();
}

// ==========================================
// DASHBOARD
// ==========================================
function renderDashboard() {
  const totalLaporanEl = document.getElementById('statTotalLaporan');
  const totalAlatEl = document.getElementById('statTotalAlat');
  const totalSelesaiEl = document.getElementById('statTotalSelesai');
  const totalBelumEl = document.getElementById('statTotalBelum');
  const persenSelesaiEl = document.getElementById('statPersenSelesai');
  const persenBelumEl = document.getElementById('statPersenBelum');
  const dateEl = document.getElementById('currentMonthYearDisplay');
  const recentTbody = document.getElementById('recentLaporanTable');

  if (dateEl) {
    dateEl.textContent = getFormattedCurrentMonth();
  }

  const list = Array.isArray(data.laporan) ? data.laporan : [];
  const totalLaporan = list.length;
  const totalAlat = list.reduce((sum, l) => sum + (parseInt(l.jumlahAlat, 10) || 1), 0);
  const rusakMode = isRusakLanding();
  const cols = getLaporanColumnKeys();

  if (totalLaporanEl) totalLaporanEl.textContent = totalLaporan;
  if (totalAlatEl) totalAlatEl.textContent = totalAlat;

  if (rusakMode) {
    const avg = getAvgPersenHidup(list);
    const nol = list.filter(l => getPersenHidup(l) === 0).length;
    const pctNol = totalLaporan > 0 ? Math.round((nol / totalLaporan) * 100) : 0;
    if (totalSelesaiEl) totalSelesaiEl.textContent = `${avg}%`;
    if (totalBelumEl) totalBelumEl.textContent = nol;
    if (persenSelesaiEl) persenSelesaiEl.textContent = 'rata-rata dari seluruh barang rusak';
    if (persenBelumEl) persenBelumEl.textContent = `${pctNol}% dari total barang rusak`;
  } else {
    const selesai = list.filter(hasTglKeluarVal).length;
    const belum = totalLaporan - selesai;
    const pctSelesai = totalLaporan > 0 ? Math.round((selesai / totalLaporan) * 100) : 0;
    const pctBelum = totalLaporan > 0 ? Math.round((belum / totalLaporan) * 100) : 0;
    if (totalSelesaiEl) totalSelesaiEl.textContent = selesai;
    if (totalBelumEl) totalBelumEl.textContent = belum;
    if (persenSelesaiEl) persenSelesaiEl.textContent = `${pctSelesai}% dari total laporan`;
    if (persenBelumEl) persenBelumEl.textContent = `${pctBelum}% dari total laporan`;
  }

  if (!recentTbody) return;
  recentTbody.innerHTML = '';

  if (list.length === 0) {
    recentTbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center; padding: 24px; color: #888;">Belum ada data laporan. Klik tombol <b>"+"</b> di sidebar untuk menambah.</td></tr>`;
    return;
  }

  // Urutkan nomor terkecil di atas sesuai format tabel
  const recentItems = list.slice().sort((a, b) => {
    const getNum = (no) => {
      if (!no) return 0;
      const match = String(no).replace(/[^0-9]/g, '');
      return parseInt(match, 10) || 0;
    };
    const numA = getNum(a.no);
    const numB = getNum(b.no);
    if (numA !== numB) return numA - numB;
    return (a.id || 0) - (b.id || 0);
  }).slice(0, 5);

  recentItems.forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = cols.map(k => getLaporanCellHtml(k, l, 'pill')).join('');
    recentTbody.appendChild(tr);
  });
}

// ==========================================
// DATA LAPORAN (TAB 2)
// ==========================================
function populateFilterDropdowns() {
  const filterJenisEl = document.getElementById('filterJenisAlat');
  if (filterJenisEl) {
    filterJenisEl.innerHTML = '<option value="">Semua Jenis Alat</option>';
    const jenisSet = new Set((data.laporan || []).map(l => l.jenisAlatNama).filter(Boolean));
    [...jenisSet].sort().forEach(nama => {
      const opt = document.createElement('option');
      opt.value = nama;
      opt.textContent = nama;
      filterJenisEl.appendChild(opt);
    });
    if (filterJenisAlat) filterJenisEl.value = filterJenisAlat;
  }

  const filterTahunEl = document.getElementById('filterTahun');
  if (filterTahunEl) {
    filterTahunEl.innerHTML = '<option value="">Semua Tahun</option>';
    const tahunSet = new Set((data.laporan || [])
      .map(l => l.tanggalMasuk && l.tanggalMasuk.split('-')[0])
      .filter(Boolean)
    );
    [...tahunSet].sort().reverse().forEach(thn => {
      const opt = document.createElement('option');
      opt.value = thn;
      opt.textContent = thn;
      filterTahunEl.appendChild(opt);
    });
    if (filterTahun) filterTahunEl.value = filterTahun;
  }
}

function applyFilter() {
  filterStatus = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : 'semua';
  filterJenisAlat = document.getElementById('filterJenisAlat') ? document.getElementById('filterJenisAlat').value : '';
  filterBulan = document.getElementById('filterBulan') ? document.getElementById('filterBulan').value : '';
  filterTahun = document.getElementById('filterTahun') ? document.getElementById('filterTahun').value : '';
  renderLaporan();
  updateFilterBadge();
}

function resetFilter() {
  filterStatus = 'semua';
  filterJenisAlat = '';
  filterBulan = '';
  filterTahun = '';
  if (document.getElementById('filterStatus')) document.getElementById('filterStatus').value = 'semua';
  if (document.getElementById('filterJenisAlat')) document.getElementById('filterJenisAlat').value = '';
  if (document.getElementById('filterBulan')) document.getElementById('filterBulan').value = '';
  if (document.getElementById('filterTahun')) document.getElementById('filterTahun').value = '';
  if (document.getElementById('searchLaporan')) document.getElementById('searchLaporan').value = '';
  renderLaporan();
  updateFilterBadge();
}

function updateFilterBadge() {
  const badge = document.getElementById('filterActiveBadge');
  if (!badge) return;
  const active = [filterStatus !== 'semua', filterJenisAlat, filterBulan, filterTahun].filter(Boolean).length;
  if (active > 0) {
    badge.textContent = active;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function renderLaporan() {
  const tbody = document.getElementById('laporanTable');
  if (!tbody) return;

  const searchInput = document.getElementById('searchLaporan');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  tbody.innerHTML = '';
  
  let list = Array.isArray(data.laporan) ? data.laporan : [];

  // Filter: Pencarian teks
  if (search) {
    list = list.filter(l => {
      const hasTgl = hasTglKeluarVal(l);
      const statusText = isRusakLanding() ? '' : (hasTgl ? 'selesai' : 'belum selesai');
      return (
        (l.no && String(l.no).toLowerCase().includes(search)) ||
        (l.jenisAlatNama && l.jenisAlatNama.toLowerCase().includes(search)) ||
        (l.keteranganPerbaikan && l.keteranganPerbaikan.toLowerCase().includes(search)) ||
        (l.lokasiDari && l.lokasiDari.toLowerCase().includes(search)) ||
        statusText.includes(search)
      );
    });
  }

  // Filter: Status
  if (filterStatus && filterStatus !== 'semua' && !isRusakLanding()) {
    list = list.filter(l => {
      const selesai = !!(l.tanggalKeluar && String(l.tanggalKeluar).trim());
      return filterStatus === 'selesai' ? selesai : !selesai;
    });
  }

  // Filter: Jenis Alat
  if (filterJenisAlat) {
    list = list.filter(l => l.jenisAlatNama === filterJenisAlat);
  }

  // Filter: Bulan
  if (filterBulan) {
    list = list.filter(l => {
      if (!l.tanggalMasuk) return false;
      return l.tanggalMasuk.split('-')[1] === filterBulan;
    });
  }

  // Filter: Tahun
  if (filterTahun) {
    list = list.filter(l => {
      if (!l.tanggalMasuk) return false;
      return l.tanggalMasuk.split('-')[0] === filterTahun;
    });
  }

  if (list.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${getLaporanColumnKeys().length + 1}" style="text-align:center; padding: 25px; color: #888;">
      ${search || filterStatus !== 'semua' || filterJenisAlat || filterBulan || filterTahun
        ? 'Tidak ada data laporan yang sesuai filter/pencarian.'
        : 'Belum ada data laporan. Klik tombol <b>"+ Tambah Laporan"</b> untuk menambah.'}
    </td>`;
    tbody.appendChild(tr);
    return;
  }
  
  // Urutkan ascending berdasarkan nomor laporan
  const colKeys = getLaporanColumnKeys();
  sortLaporanByNo(list).forEach(l => {
    const tr = document.createElement('tr');
    tr.innerHTML = colKeys.map(k => getLaporanCellHtml(k, l, 'main')).join('') + `
      <td class="actions" style="text-align: center;">
        <button class="edit" onclick="editLaporan(${l.id})">Edit</button>
        <button class="delete" onclick="deleteLaporan(${l.id})">Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// MODAL & OPERASI LAPORAN (CRUD)
// ==========================================
function getNextLaporanNo() {
  if (!data.laporan || data.laporan.length === 0) return '1';
  let maxNo = 0;
  data.laporan.forEach(l => {
    const raw = String(l.no || '').trim();
    const num = parseInt(raw.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > maxNo) {
      maxNo = num;
    }
  });
  return String(maxNo + 1);
}

function openLaporanModal() {
  if (!data.jenisAlat || data.jenisAlat.length === 0) {
    alert('Silakan tambah kategori Jenis Alat terlebih dahulu di tab "Data".');
    showTab('master');
    return;
  }

  editingLaporanId = null;
  document.getElementById('modalLaporanTitle').textContent = 'Tambah Laporan';
  document.getElementById('laporanId').value = '';
  document.getElementById('laporanNo').value = getNextLaporanNo();
  document.getElementById('laporanNo').readOnly = true;
  document.getElementById('laporanJumlah').value = 1;

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('laporanTglMasuk').value = today;
  document.getElementById('laporanTglKeluar').value = '';
  document.getElementById('laporanLokasi').value = '';
  document.getElementById('laporanKeterangan').value = '';
  document.getElementById('laporanKondisi').value = 'Lama';
  document.getElementById('laporanLamaHari').value = 0;
  const persenInput = document.getElementById('laporanPersenHidup');
  if (persenInput) persenInput.value = '';

  renderJenisAlatSelect();
  renderLokasiDatalist();
  if (data.jenisAlat.length > 0) {
    document.getElementById('laporanJenisAlat').value = data.jenisAlat[0].id;
  }

  document.getElementById('modalLaporan').classList.add('active');
  setTimeout(() => document.getElementById('laporanLokasi').focus(), 100);
}

function closeLaporanModal() {
  document.getElementById('modalLaporan').classList.remove('active');
}

function hitungLamaHari() {
  const tglMasuk = document.getElementById('laporanTglMasuk').value;
  const tglKeluar = document.getElementById('laporanTglKeluar').value;
  if (tglMasuk && tglKeluar) {
    const masuk = new Date(tglMasuk);
    const keluar = new Date(tglKeluar);
    const diff = Math.round((keluar - masuk) / (1000 * 60 * 60 * 24));
    document.getElementById('laporanLamaHari').value = diff >= 0 ? diff : 0;
  } else {
    document.getElementById('laporanLamaHari').value = 0;
  }
}

function saveLaporan() {
  if (isSavingLaporan) return;
  let no = document.getElementById('laporanNo').value.trim();
  if (!no) {
    no = editingLaporanId ? '1' : getNextLaporanNo();
  }
  const tglMasuk = document.getElementById('laporanTglMasuk').value;
  const tglKeluar = document.getElementById('laporanTglKeluar').value;
  const jumlahAlat = parseInt(document.getElementById('laporanJumlah').value) || 1;
  const keterangan = document.getElementById('laporanKeterangan').value.trim();
  const jenisAlatId = parseInt(document.getElementById('laporanJenisAlat').value);
  const lokasi = document.getElementById('laporanLokasi').value.trim();
  const kondisi = document.getElementById('laporanKondisi').value;
  const rusak = isRusakLanding();
  const lamaHari = rusak ? 0 : (parseInt(document.getElementById('laporanLamaHari').value) || 0);
  const tglKeluarFinal = rusak ? '' : tglKeluar;
  let persenHidup;
  if (rusak) {
    const rawPersen = String(document.getElementById('laporanPersenHidup').value).trim().replace(',', '.');
    const p = parseFloat(rawPersen);
    if (rawPersen === '' || isNaN(p) || p < 0 || p > 100) {
      alert('Persentase Sparepart Hidup wajib diisi dengan angka 0 - 100.');
      document.getElementById('laporanPersenHidup').focus();
      return;
    }
    persenHidup = Math.round(p * 100) / 100;
  }

  if (!tglMasuk) { alert('Tanggal Masuk wajib diisi!'); document.getElementById('laporanTglMasuk').focus(); return; }
  if (!keterangan) { alert('Keterangan / Jenis Perbaikan wajib diisi!'); document.getElementById('laporanKeterangan').focus(); return; }
  if (!lokasi) { alert('Lokasi / Dari wajib diisi!'); document.getElementById('laporanLokasi').focus(); return; }
  if (isNaN(jenisAlatId)) { alert('Silakan pilih Kategori Jenis Alat.'); return; }

  isSavingLaporan = true;
  const jenisAlat = data.jenisAlat.find(j => j.id === jenisAlatId);
  const jenisAlatNama = jenisAlat ? jenisAlat.nama : '';

  // Tambahkan lokasi otomatis ke kategori lokasi jika belum terdaftar
  if (lokasi && !data.kategoriLokasi.some(l => l.nama && l.nama.trim().toLowerCase() === lokasi.toLowerCase())) {
    data.kategoriLokasi.push({ id: Date.now() + 1, nama: lokasi });
  }

  if (editingLaporanId) {
    const idx = data.laporan.findIndex(l => l.id === editingLaporanId);
    if (idx !== -1) {
      data.laporan[idx] = { ...data.laporan[idx], no, tanggalMasuk: tglMasuk, tanggalKeluar: tglKeluarFinal, jumlahAlat, keteranganPerbaikan: keterangan, jenisAlatId, jenisAlatNama, lokasiDari: lokasi, kondisi, lamaHari };
      if (rusak) data.laporan[idx].persenHidup = persenHidup;
    }
  } else {
    const baru = { id: Date.now(), no, tanggalMasuk: tglMasuk, tanggalKeluar: tglKeluarFinal, jumlahAlat, keteranganPerbaikan: keterangan, jenisAlatId, jenisAlatNama, lokasiDari: lokasi, kondisi, lamaHari };
    if (rusak) baru.persenHidup = persenHidup;
    data.laporan.push(baru);
  }

  saveData();
  closeLaporanModal();
  renderAll();
  showToast(editingLaporanId ? '✓ Laporan berhasil diperbarui' : '✓ Laporan baru berhasil ditambahkan', 'success');
  isSavingLaporan = false;
}

function editLaporan(id) {
  const l = data.laporan.find(x => x.id === id);
  if (!l) return;
  editingLaporanId = id;

  renderJenisAlatSelect();
  renderLokasiDatalist();
  document.getElementById('modalLaporanTitle').textContent = 'Edit Laporan';
  document.getElementById('laporanId').value = l.id;
  document.getElementById('laporanNo').value = l.no || '';
  document.getElementById('laporanNo').readOnly = true;
  document.getElementById('laporanJumlah').value = l.jumlahAlat || 1;
  document.getElementById('laporanTglMasuk').value = l.tanggalMasuk || '';
  document.getElementById('laporanTglKeluar').value = l.tanggalKeluar || '';
  document.getElementById('laporanLokasi').value = l.lokasiDari || '';
  document.getElementById('laporanKeterangan').value = l.keteranganPerbaikan || '';
  document.getElementById('laporanKondisi').value = l.kondisi || 'Lama';
  document.getElementById('laporanLamaHari').value = l.lamaHari !== undefined ? l.lamaHari : 0;
  const persenEdit = document.getElementById('laporanPersenHidup');
  if (persenEdit) persenEdit.value = getPersenHidup(l) === null ? '' : getPersenHidup(l);
  document.getElementById('laporanJenisAlat').value = l.jenisAlatId || '';

  document.getElementById('modalLaporan').classList.add('active');
}

function deleteLaporan(id) {
  const l = data.laporan.find(x => x.id === id);
  const noText = l ? ` (${l.no})` : '';
  if (confirm(`Yakin ingin menghapus laporan${noText}?`)) {
    data.laporan = data.laporan.filter(item => item.id !== id);
    saveData();
    renderAll();
    showToast('✓ Laporan berhasil dihapus', 'info');
  }
}

// ==========================================
// IMPORT DATA LAPORAN DARI EXCEL (.xlsx / .xls)
// ==========================================
async function importLaporanExcelFromInput(event) {
  try {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof ExcelJS === 'undefined') {
      alert('Library ExcelJS sedang dimuat atau tidak tersedia.');
      return;
    }

    showToast('Memproses dan membaca file Excel...', 'info');

    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Filter sheet yang valid (bukan sheet master kategori atau lokasi)
    const validSheets = wb.worksheets.filter(ws => {
      const name = (ws.name || '').toLowerCase();
      return !name.includes('master') && !name.includes('lokasi');
    });

    const sheetsToProcess = validSheets.length > 0 ? validSheets : (wb.worksheets.length > 0 ? [wb.worksheets[0]] : []);

    if (sheetsToProcess.length === 0) {
      showToast('⚠ File Excel tidak memiliki lembar kerja data laporan.', 'error');
      event.target.value = '';
      return;
    }

    const importedLaporan = [];

    // Helper format tanggal dari cell Excel ke YYYY-MM-DD
    const parseDateCell = (cell) => {
      if (!cell) return '';
      if (cell.value instanceof Date) {
        const d = cell.value;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      let str = String(cell.text || cell.value || '').trim();
      if (!str || str === '-') return '';
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
      }
      return str;
    };

    sheetsToProcess.forEach(ws => {
      let headerRowIndex = -1;
      let colMap = {};

      ws.eachRow((row, rowNumber) => {
        if (headerRowIndex !== -1) return;
        const texts = [];
        row.eachCell((cell, colNumber) => {
          texts.push({ text: String(cell.text || '').toLowerCase().trim(), col: colNumber });
        });

        const isHeader = texts.some(t => 
          t.text.includes('keterangan') || 
          t.text.includes('perbaikan') || 
          t.text.includes('jenis alat') || 
          t.text.includes('jenis / kategori') || 
          t.text.includes('tanggal masuk')
        );

        if (isHeader) {
          headerRowIndex = rowNumber;
          texts.forEach(t => {
            const txt = t.text;
            if (txt === 'no' || txt === 'nomor') colMap.no = t.col;
            else if (txt.includes('tanggal masuk') || txt.includes('tgl masuk') || txt === 'masuk') colMap.tglMasuk = t.col;
            else if (txt.includes('tanggal keluar') || txt.includes('tgl keluar') || txt === 'keluar') colMap.tglKeluar = t.col;
            else if (txt === 'lama') colMap.qtyLama = t.col;
            else if (txt === 'baru') colMap.qtyBaru = t.col;
            else if (txt.includes('jumlah') || txt.includes('qty')) colMap.jumlah = t.col;
            else if (txt.includes('sparepart hidup') || txt.includes('persen')) colMap.persen = t.col;
            else if (txt.includes('keterangan') || txt.includes('perbaikan') || txt.includes('keluhan')) colMap.keterangan = t.col;
            else if (txt.includes('jenis alat') || txt.includes('jenis / kategori') || txt.includes('kategori alat') || txt.includes('nama / jenis') || txt === 'alat') colMap.jenisAlat = t.col;
            else if (txt.includes('lokasi') || txt.includes('sumber') || txt.includes('dari')) colMap.lokasi = t.col;
            else if (txt.includes('lama / baru') || txt.includes('kondisi')) colMap.kondisi = t.col;
            else if (txt.includes('lama hari')) colMap.lamaHari = t.col;
            else if (txt === 'status') colMap.status = t.col;
          });
        }
      });

      if (headerRowIndex === -1) {
        headerRowIndex = 1;
        colMap = { no: 1, jenisAlat: 2, jumlah: 3, lokasi: 4, tglMasuk: 5, tglKeluar: 6, kondisi: 7, lamaHari: 8, status: 9, keterangan: 10 };
      }

      ws.eachRow((row, rowNumber) => {
        // Lewati header dan subheader (Lama / Baru)
        if (rowNumber <= headerRowIndex + (colMap.qtyLama && colMap.qtyBaru ? 1 : 0)) return;

        const firstCell = String(row.getCell(1).text || '').trim();
        const secondCell = String(row.getCell(2).text || '').trim();

        // Lewati baris jumlah / ringkasan / tanda tangan / kosong
        if (
          firstCell.toUpperCase().includes('JUMLAH') || 
          firstCell.toUpperCase().includes('TOTAL') || 
          firstCell.toUpperCase().includes('CATATAN') || 
          firstCell.toUpperCase().includes('MENGETAHUI') || 
          secondCell.toUpperCase().includes('JUMLAH') ||
          firstCell.toUpperCase().includes('DIBUAT')
        ) {
          return;
        }

        const ketText = (colMap.keterangan ? String(row.getCell(colMap.keterangan).text || '') : '').trim();
        if (!ketText || ketText === '-' || ketText.toLowerCase().includes('catatan / ringkasan')) return;

        const noVal = (colMap.no ? String(row.getCell(colMap.no).text || '') : '').trim();
        const tglMasukVal = parseDateCell(colMap.tglMasuk ? row.getCell(colMap.tglMasuk) : null);
        const tglKeluarVal = parseDateCell(colMap.tglKeluar ? row.getCell(colMap.tglKeluar) : null);
        
        let qty = 1;
        let kondisi = 'Lama';

        const qtyBaruVal = colMap.qtyBaru ? parseInt(row.getCell(colMap.qtyBaru).text, 10) : 0;
        const qtyLamaVal = colMap.qtyLama ? parseInt(row.getCell(colMap.qtyLama).text, 10) : 0;

        if (qtyBaruVal && !isNaN(qtyBaruVal) && qtyBaruVal > 0) {
          qty = qtyBaruVal;
          kondisi = 'Baru';
        } else if (qtyLamaVal && !isNaN(qtyLamaVal) && qtyLamaVal > 0) {
          qty = qtyLamaVal;
          kondisi = 'Lama';
        } else if (colMap.jumlah) {
          const jVal = parseInt(row.getCell(colMap.jumlah).text, 10);
          if (!isNaN(jVal) && jVal > 0) qty = jVal;
        }

        if (colMap.kondisi) {
          const kText = String(row.getCell(colMap.kondisi).text || '').trim().toLowerCase();
          if (kText === 'baru') kondisi = 'Baru';
        }

        const jenisAlatVal = (colMap.jenisAlat ? String(row.getCell(colMap.jenisAlat).text || '').trim() : '') || 'Umum';
        const lokasiVal = (colMap.lokasi ? String(row.getCell(colMap.lokasi).text || '').trim() : '') || 'Kantor';

        let lamaHariVal = 0;
        if (tglMasukVal && tglKeluarVal) {
          const d1 = new Date(tglMasukVal);
          const d2 = new Date(tglKeluarVal);
          if (!isNaN(d1) && !isNaN(d2)) {
            const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            lamaHariVal = diff >= 0 ? diff : 0;
          }
        } else if (colMap.lamaHari) {
          const rawH = parseInt(String(row.getCell(colMap.lamaHari).text || '').replace(/\D/g, ''), 10);
          if (!isNaN(rawH)) lamaHariVal = rawH;
        }

        let persenVal = null;
        if (colMap.persen) {
          const pRaw = parseFloat(String(row.getCell(colMap.persen).text || '').replace('%', '').replace(',', '.'));
          if (!isNaN(pRaw)) persenVal = Math.max(0, Math.min(100, pRaw));
        }

        importedLaporan.push({
          no: noVal,
          tanggalMasuk: tglMasukVal,
          tanggalKeluar: tglKeluarVal,
          jumlahAlat: qty,
          keteranganPerbaikan: ketText,
          jenisAlatNama: jenisAlatVal,
          lokasiDari: lokasiVal,
          kondisi: kondisi,
          lamaHari: lamaHariVal,
          ...(persenVal !== null ? { persenHidup: persenVal } : {})
        });
      });
    });

    if (importedLaporan.length === 0) {
      showToast('⚠ Tidak ditemukan baris data laporan yang valid pada file Excel.', 'error');
      event.target.value = '';
      return;
    }

    if (!Array.isArray(data.laporan)) data.laporan = [];
    if (!Array.isArray(data.jenisAlat)) data.jenisAlat = [];
    if (!Array.isArray(data.kategoriLokasi)) data.kategoriLokasi = [];

    let addedCount = 0;
    let updatedCount = 0;
    let maxId = Date.now();

    importedLaporan.forEach((item, idx) => {
      // 1. Pastikan jenis alat terdaftar
      if (item.jenisAlatNama && !data.jenisAlat.some(j => (j.nama || '').toLowerCase() === item.jenisAlatNama.toLowerCase())) {
        data.jenisAlat.push({ id: maxId + idx + 1000, nama: item.jenisAlatNama });
      }
      const matchedJenis = data.jenisAlat.find(j => (j.nama || '').toLowerCase() === item.jenisAlatNama.toLowerCase());
      const jenisAlatId = matchedJenis ? matchedJenis.id : (maxId + idx + 1000);

      // 2. Pastikan lokasi terdaftar
      if (item.lokasiDari && !data.kategoriLokasi.some(l => (l.nama || '').toLowerCase() === item.lokasiDari.toLowerCase())) {
        data.kategoriLokasi.push({ id: maxId + idx + 5000, nama: item.lokasiDari });
      }

      // 3. Cek apakah laporan sudah ada berdasarkan Nomor atau (TanggalMasuk + Keterangan + Lokasi)
      const existingIdx = data.laporan.findIndex(l => 
        (item.no && String(l.no).trim() === String(item.no).trim()) ||
        (l.tanggalMasuk === item.tanggalMasuk && 
         String(l.keteranganPerbaikan || '').trim().toLowerCase() === String(item.keteranganPerbaikan || '').trim().toLowerCase() && 
         String(l.lokasiDari || '').trim().toLowerCase() === String(item.lokasiDari || '').trim().toLowerCase())
      );

      if (existingIdx !== -1) {
        data.laporan[existingIdx] = {
          ...data.laporan[existingIdx],
          ...item,
          jenisAlatId: jenisAlatId,
          no: item.no || data.laporan[existingIdx].no
        };
        updatedCount++;
      } else {
        const nextNo = item.no || getNextLaporanNo();
        data.laporan.push({
          id: maxId + idx + 1,
          no: nextNo,
          tanggalMasuk: item.tanggalMasuk,
          tanggalKeluar: item.tanggalKeluar,
          jumlahAlat: item.jumlahAlat,
          keteranganPerbaikan: item.keteranganPerbaikan,
          jenisAlatId: jenisAlatId,
          jenisAlatNama: item.jenisAlatNama,
          lokasiDari: item.lokasiDari,
          kondisi: item.kondisi,
          lamaHari: item.lamaHari,
          ...(item.persenHidup !== undefined ? { persenHidup: item.persenHidup } : {})
        });
        addedCount++;
      }
    });

    await saveData();
    renderAll();

    let msg = `✓ Berhasil mengimpor ${addedCount} laporan baru`;
    if (updatedCount > 0) msg += ` dan memperbarui ${updatedCount} laporan yang ada`;
    showToast(msg, 'success');
  } catch (err) {
    console.error('Error import laporan:', err);
    showToast('⚠ Terjadi kesalahan saat membaca file Excel: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

// ==========================================
// KATEGORI ALAT (TAB 3)
// ==========================================
function renderJenisAlat() {
  const tbody = document.getElementById('jenisAlatTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const jenisList = Array.isArray(data.jenisAlat) ? data.jenisAlat : [];
  if (jenisList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: #888;">Belum ada kategori alat. Klik tombol <b>"+ Tambah Kategori"</b> untuk menambahkan.</td></tr>`;
    return;
  }

  // Tanpa kolom JUMLAH DATA sesuai permintaan user
  jenisList.slice().sort((a,b) => (a.nama || '').localeCompare(b.nama || '')).forEach((j, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${index + 1}</strong></td>
      <td><strong>${escapeHtml(j.nama || '')}</strong></td>
      <td class="actions" style="text-align: center;">
        <button class="btn-table-edit" onclick="editJenisAlat(${j.id})">✏️ Edit</button>
        <button class="btn-table-delete" onclick="deleteJenisAlat(${j.id})">🗑️ Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderJenisAlatSelect() {
  const select = document.getElementById('laporanJenisAlat');
  if (!select) return;
  select.innerHTML = '';

  const jenisList = Array.isArray(data.jenisAlat) ? data.jenisAlat : [];
  if (jenisList.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- Belum ada kategori alat --';
    select.appendChild(opt);
    return;
  }

  jenisList.slice().sort((a,b) => (a.nama || '').localeCompare(b.nama || '')).forEach(j => {
    const opt = document.createElement('option');
    opt.value = j.id;
    opt.textContent = j.nama;
    select.appendChild(opt);
  });
}

function openJenisAlatModal() {
  editingJenisAlatId = null;
  document.getElementById('modalJenisAlatTitle').textContent = 'Tambah Kategori Alat';
  document.getElementById('jenisAlatNama').value = '';
  document.getElementById('modalJenisAlat').classList.add('active');
  setTimeout(() => document.getElementById('jenisAlatNama').focus(), 100);
}

function closeJenisAlatModal() {
  document.getElementById('modalJenisAlat').classList.remove('active');
}

function saveJenisAlat() {
  const nama = document.getElementById('jenisAlatNama').value.trim();
  if (!nama) { alert('Nama kategori wajib diisi!'); document.getElementById('jenisAlatNama').focus(); return; }

  if (editingJenisAlatId) {
    const idx = data.jenisAlat.findIndex(j => j.id === editingJenisAlatId);
    if (idx !== -1) {
      data.jenisAlat[idx].nama = nama;
      data.laporan.forEach(l => { if (l.jenisAlatId === editingJenisAlatId) l.jenisAlatNama = nama; });
    }
  } else {
    data.jenisAlat.push({ id: Date.now(), nama });
  }

  saveData();
  closeJenisAlatModal();
  renderAll();
  showToast(editingJenisAlatId ? '✓ Kategori berhasil diubah' : '✓ Kategori berhasil ditambahkan', 'success');
}

function editJenisAlat(id) {
  const j = data.jenisAlat.find(x => x.id === id);
  if (!j) return;
  editingJenisAlatId = id;
  document.getElementById('modalJenisAlatTitle').textContent = 'Edit Kategori Alat';
  document.getElementById('jenisAlatNama').value = j.nama || '';
  document.getElementById('modalJenisAlat').classList.add('active');
  setTimeout(() => document.getElementById('jenisAlatNama').focus(), 100);
}

function deleteJenisAlat(id) {
  const isUsed = (data.laporan || []).some(l => l.jenisAlatId === id);
  const msg = isUsed ? 'Kategori ini digunakan dalam beberapa riwayat laporan. Yakin ingin menghapusnya?' : 'Yakin ingin menghapus kategori ini?';
  if (confirm(msg)) {
    data.jenisAlat = data.jenisAlat.filter(j => j.id !== id);
    saveData();
    renderAll();
    showToast('✓ Kategori berhasil dihapus', 'info');
  }
}

// ==========================================
// KATEGORI LOKASI & SUBTABS
// ==========================================
function switchKategoriSubtab(type) {
  const cardAlat = document.getElementById('cardKategoriAlat');
  const cardLokasi = document.getElementById('cardKategoriLokasi');

  document.querySelectorAll('.kategori-pill').forEach(p => p.classList.remove('active'));
  const activeBtn = document.getElementById('btn-subtab-' + type);
  if (activeBtn) activeBtn.classList.add('active');

  if (type === 'alat') {
    if (cardAlat) {
      cardAlat.style.display = 'block';
      cardAlat.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } else if (type === 'lokasi') {
    if (cardLokasi) {
      cardLokasi.style.display = 'block';
      cardLokasi.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

function renderKategoriLokasi() {
  const tbody = document.getElementById('lokasiTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const lokasiList = Array.isArray(data.kategoriLokasi) ? data.kategoriLokasi : [];
  if (lokasiList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: #888;">Belum ada kategori lokasi. Klik tombol <b>"+ Tambah Kategori"</b> untuk menambahkan.</td></tr>`;
    return;
  }

  // Tanpa kolom JUMLAH DATA sesuai permintaan user
  const sorted = lokasiList.slice().sort((a,b) => (a.nama || '').localeCompare(b.nama || ''));
  sorted.forEach((loc, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${index + 1}</strong></td>
      <td><strong>${escapeHtml(loc.nama || '')}</strong></td>
      <td class="actions" style="text-align: center;">
        <button class="btn-table-edit" onclick="editLokasi(${loc.id})">✏️ Edit</button>
        <button class="btn-table-delete" onclick="deleteLokasi(${loc.id})">🗑️ Hapus</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderLokasiDatalist() {
  const datalist = document.getElementById('lokasiDatalist');
  if (!datalist) return;
  datalist.innerHTML = '';

  const lokasiList = Array.isArray(data.kategoriLokasi) ? data.kategoriLokasi : [];
  lokasiList.slice().sort((a,b) => (a.nama || '').localeCompare(b.nama || '')).forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.nama;
    datalist.appendChild(opt);
  });
}

function openLokasiModal() {
  editingLokasiId = null;
  document.getElementById('modalKategoriLokasiTitle').textContent = 'Tambah Kategori Lokasi';
  document.getElementById('kategoriLokasiId').value = '';
  document.getElementById('kategoriLokasiNama').value = '';
  document.getElementById('modalKategoriLokasi').classList.add('active');
  setTimeout(() => document.getElementById('kategoriLokasiNama').focus(), 100);
}

function closeLokasiModal() {
  document.getElementById('modalKategoriLokasi').classList.remove('active');
}

function editLokasi(id) {
  const loc = (data.kategoriLokasi || []).find(l => l.id === id);
  if (!loc) return;
  editingLokasiId = id;
  document.getElementById('modalKategoriLokasiTitle').textContent = 'Edit Kategori Lokasi';
  document.getElementById('kategoriLokasiId').value = loc.id;
  document.getElementById('kategoriLokasiNama').value = loc.nama || '';
  document.getElementById('modalKategoriLokasi').classList.add('active');
  setTimeout(() => document.getElementById('kategoriLokasiNama').focus(), 100);
}

function saveKategoriLokasi() {
  const nama = document.getElementById('kategoriLokasiNama').value.trim();
  if (!nama) {
    alert('Nama kategori lokasi wajib diisi!');
    document.getElementById('kategoriLokasiNama').focus();
    return;
  }

  if (!Array.isArray(data.kategoriLokasi)) data.kategoriLokasi = [];

  if (editingLokasiId) {
    const idx = data.kategoriLokasi.findIndex(l => l.id === editingLokasiId);
    if (idx !== -1) {
      const oldNama = data.kategoriLokasi[idx].nama;
      data.kategoriLokasi[idx].nama = nama;
      if (oldNama && Array.isArray(data.laporan)) {
        data.laporan.forEach(l => {
          if (l.lokasiDari && l.lokasiDari.trim().toLowerCase() === oldNama.trim().toLowerCase()) {
            l.lokasiDari = nama;
          }
        });
      }
    }
  } else {
    data.kategoriLokasi.push({ id: Date.now(), nama });
  }

  saveData();
  closeLokasiModal();
  renderAll();
  showToast(editingLokasiId ? '✓ Kategori lokasi berhasil diubah' : '✓ Kategori lokasi berhasil ditambahkan', 'success');
}

function deleteLokasi(id) {
  const loc = (data.kategoriLokasi || []).find(l => l.id === id);
  if (!loc) return;
  const isUsed = (data.laporan || []).some(l => (l.lokasiDari || '').trim().toLowerCase() === (loc.nama || '').trim().toLowerCase());
  const msg = isUsed ? `Lokasi "${loc.nama}" digunakan pada beberapa riwayat laporan. Yakin ingin menghapusnya?` : `Yakin ingin menghapus kategori lokasi "${loc.nama}"?`;
  if (confirm(msg)) {
    data.kategoriLokasi = data.kategoriLokasi.filter(l => l.id !== id);
    saveData();
    renderAll();
    showToast('✓ Kategori lokasi berhasil dihapus', 'info');
  }
}

// ==========================================
// EXPORT & IMPORT EXCEL KATEGORI LOKASI (BROWSER-BASED)
// ==========================================
async function exportLokasiExcel() {
  try {
    const lokasiList = Array.isArray(data.kategoriLokasi) ? data.kategoriLokasi : [];
    if (lokasiList.length === 0) {
      showToast('⚠ Belum ada data lokasi untuk diekspor.', 'info');
      return;
    }

    if (typeof ExcelJS === 'undefined') {
      alert('Library ExcelJS sedang dimuat atau tidak tersedia.');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Laporan Service';
    wb.created = new Date();

    const ws = wb.addWorksheet('Data Lokasi', {
      views: [{ showGridLines: true }]
    });

    ws.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Nama Lokasi', key: 'nama', width: 36 }
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 26;
    headerRow.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }
    };

    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    headerRow.getCell(1).border = thinBorder;
    headerRow.getCell(2).border = thinBorder;

    lokasiList.forEach((item, index) => {
      const row = ws.addRow({
        no: index + 1,
        nama: item.nama || ''
      });
      row.height = 22;
      row.font = { name: 'Times New Roman', size: 11 };
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
      row.getCell(1).border = thinBorder;
      row.getCell(2).border = thinBorder;
    });

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlobAsFile(buffer, 'Data_Kategori_Lokasi.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    showToast('✓ Data lokasi berhasil diekspor ke Excel!', 'success');
  } catch (err) {
    console.error(err);
    showToast('⚠ Terjadi kesalahan saat mengekspor data lokasi.', 'error');
  }
}

async function importLokasiExcelFromInput(event) {
  try {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (typeof ExcelJS === 'undefined') {
      alert('Library ExcelJS sedang dimuat atau tidak tersedia.');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const ws = wb.worksheets[0];
    if (!ws) {
      showToast('⚠ File Excel tidak memiliki lembar kerja (worksheet).', 'error');
      return;
    }

    const importedNames = [];
    ws.eachRow((row, rowNumber) => {
      const val1 = (row.getCell(1).text || '').trim();
      const val2 = (row.getCell(2).text || '').trim();

      const low1 = val1.toLowerCase();
      const low2 = val2.toLowerCase();
      if (low1 === 'no' || low1 === 'nomor' || low1 === 'nama lokasi' || low1 === 'lokasi') return;
      if (low2 === 'nama lokasi' || low2 === 'lokasi') return;

      let locName = '';
      if (val2 && !isNaN(val1)) {
        locName = val2;
      } else if (val2 && (low1 === 'no' || !isNaN(val1))) {
        locName = val2;
      } else if (val1 && isNaN(val1)) {
        locName = val1;
      } else if (val2) {
        locName = val2;
      }

      if (locName && locName.toLowerCase() !== 'nama lokasi' && locName.toLowerCase() !== 'lokasi') {
        importedNames.push(locName);
      }
    });

    if (importedNames.length === 0) {
      showToast('⚠ Tidak ditemukan data nama lokasi yang valid pada file Excel.', 'info');
      event.target.value = '';
      return;
    }

    if (!Array.isArray(data.kategoriLokasi)) data.kategoriLokasi = [];

    let addedCount = 0;
    importedNames.forEach(name => {
      const cleanName = name.trim();
      if (!cleanName) return;
      const exists = data.kategoriLokasi.some(l => l.nama && l.nama.trim().toLowerCase() === cleanName.toLowerCase());
      if (!exists) {
        data.kategoriLokasi.push({
          id: Date.now() + Math.floor(Math.random() * 10000),
          nama: cleanName
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      await saveData();
      renderAll();
      showToast(`✓ Berhasil mengimpor ${addedCount} data lokasi baru!`, 'success');
    } else {
      showToast('ℹ Semua data lokasi pada file Excel sudah terdaftar di sistem (tidak ada duplikasi).', 'info');
    }
  } catch (err) {
    console.error(err);
    showToast('⚠ Terjadi kesalahan saat mengimpor file Excel: ' + err.message, 'error');
  } finally {
    event.target.value = '';
  }
}

// ==========================================
// LAPORAN BULANAN (TAB 4)
// ==========================================
function renderCekBulananTab() {
  const resultEl = document.getElementById('tabBulananResult');
  const bulanEl = document.getElementById('tabCekBulan');
  const tahunEl = document.getElementById('tabCekTahun');
  if (!resultEl || !bulanEl || !tahunEl) return;

  if (!tahunEl.value) tahunEl.value = new Date().getFullYear();
  if (!bulanEl.value) bulanEl.value = String(new Date().getMonth() + 1).padStart(2, '0');

  const bulan = bulanEl.value;
  const tahun = String(tahunEl.value);

  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const filtered = (Array.isArray(data.laporan) ? data.laporan : []).filter(l => {
    if (!l.tanggalMasuk) return false;
    const parts = l.tanggalMasuk.split('-');
    return parts[0] === tahun && parts[1] === bulan;
  });

  const sorted = filtered.slice().sort((a, b) => {
    const noA = parseInt(String(a.no || '').replace(/\D/g, '')) || 0;
    const noB = parseInt(String(b.no || '').replace(/\D/g, '')) || 0;
    return noA - noB;
  });

  const totalAlat = sorted.reduce((sum, l) => sum + (parseInt(l.jumlahAlat) || 1), 0);
  const selesai = sorted.filter(hasTglKeluarVal).length;
  const belumSelesai = sorted.length - selesai;
  const rusakBln = isRusakLanding();
  const avgPersenBln = getAvgPersenHidup(sorted);
  const nolBln = sorted.filter(l => getPersenHidup(l) === 0).length;
  const namabulan = monthsIndo[parseInt(bulan) - 1];

  const judulEl = document.getElementById('tabBulananJudul');
  if (judulEl) judulEl.textContent = `Laporan Bulan ${namabulan} ${tahun}`;

  if (sorted.length === 0) {
    resultEl.innerHTML = `
      <div style="text-align:center; padding: 40px; color:#888; background:white; border-radius:14px; border:1px solid #e2e8f0;">
        <div style="font-size: 40px; margin-bottom: 10px;">📋</div>
        <p>Tidak ada data laporan pada bulan <strong>${namabulan} ${tahun}</strong>.</p>
      </div>`;
    return;
  }

  let html = `
    <div class="cek-summary">
      <div class="cek-stat">
        <div class="cek-stat-num">${sorted.length}</div>
        <div class="cek-stat-label">Total Laporan</div>
      </div>
      <div class="cek-stat">
        <div class="cek-stat-num">${totalAlat}</div>
        <div class="cek-stat-label">Total Alat</div>
      </div>
      <div class="cek-stat cek-stat-green">
        <div class="cek-stat-num">${rusakBln ? avgPersenBln + '%' : selesai}</div>
        <div class="cek-stat-label">${rusakBln ? 'Rata-rata Sparepart Hidup' : 'Selesai'}</div>
      </div>
      <div class="cek-stat cek-stat-amber">
        <div class="cek-stat-num">${rusakBln ? nolBln : belumSelesai}</div>
        <div class="cek-stat-label">${rusakBln ? 'Sparepart Hidup 0%' : 'Belum Selesai'}</div>
      </div>
    </div>
    <div class="table-container">
    <table>
      <thead>
        <tr>${getLaporanColumnKeys().map(k => `<th>${escapeHtml(getLaporanColumnLabel(k))}</th>`).join('')}</tr>
      </thead>
      <tbody>`;

  sorted.forEach(l => {
    html += `<tr>${getLaporanColumnKeys().map(k => getLaporanCellHtml(k, l, 'pill')).join('')}</tr>`;
  });

  html += `</tbody></table></div>`;
  resultEl.innerHTML = html;
}

// ==========================================
// EXPORT EXCEL LAPORAN (BROWSER CLIENT-SIDE VIA EXCELJS)
// ==========================================
function populateExportBulanDropdown() {
  const selectEl = document.getElementById('exportPeriodeBulan');
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const groups = new Map();
  (data.laporan || []).forEach(l => {
    const tgl = l.tanggalMasuk || l.tanggalKeluar;
    if (tgl && tgl.includes('-')) {
      const parts = tgl.split('-');
      if (parts.length >= 2) {
        const key = `${parts[0]}-${parts[1]}`;
        groups.set(key, (groups.get(key) || 0) + 1);
      }
    }
  });

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (!groups.has(currentKey)) {
    groups.set(currentKey, 0);
  }

  const sortedKeys = Array.from(groups.keys()).sort().reverse();

  sortedKeys.forEach(key => {
    const count = groups.get(key);
    const parts = key.split('-');
    const blnIdx = parseInt(parts[1], 10) - 1;
    const label = `${monthsIndo[blnIdx]} ${parts[0]}`;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${label} (${count} data laporan)`;
    selectEl.appendChild(opt);
  });

  const optAll = document.createElement('option');
  optAll.value = 'all';
  optAll.textContent = 'Semua Bulan (Gabung)';
  selectEl.appendChild(optAll);

  if (filterBulan && filterTahun) {
    const fKey = `${filterTahun}-${filterBulan}`;
    if (groups.has(fKey)) selectEl.value = fKey;
  }

  onExportBulanChange();
}

function onExportBulanChange() {
  const titleEl = document.getElementById('exportTitle');
  if (titleEl) {
    const activeCfg = getCurrentLandingConfig();
    titleEl.value = `Laporan ${activeCfg.title} Bulanan`;
  }
}

function openExportModal() {
  populateExportBulanDropdown();
  try {
    const savedSig = JSON.parse(localStorage.getItem('export_signature_config') || '{}');
    if (savedSig.title && (!document.getElementById('exportPeriodeBulan') || document.getElementById('exportPeriodeBulan').value === 'all')) {
      document.getElementById('exportTitle').value = savedSig.title;
    }
    if (savedSig.kotaTanggal) document.getElementById('exportKotaTanggal').value = savedSig.kotaTanggal;
    if (savedSig.mengetahuiTitle) document.getElementById('exportMengetahuiTitle').textContent = savedSig.mengetahuiTitle;
    if (savedSig.mengetahuiNama) document.getElementById('exportMengetahuiNama').value = savedSig.mengetahuiNama;
    if (savedSig.mengetahuiJabatan) document.getElementById('exportMengetahuiJabatan').value = savedSig.mengetahuiJabatan;
    if (savedSig.pembuatTitle) {
      document.getElementById('exportPembuatTitle').value = savedSig.pembuatTitle;
    }
    if (savedSig.pembuatNama) document.getElementById('exportPembuatNama').value = savedSig.pembuatNama;
    if (savedSig.pembuatJabatan) document.getElementById('exportPembuatJabatan').value = savedSig.pembuatJabatan;
    if (savedSig.enabled !== undefined) {
      document.getElementById('exportSigEnabled').checked = savedSig.enabled;
      toggleSigForm(savedSig.enabled);
    }
  } catch (e) {}

  document.getElementById('modalExportExcel').classList.add('active');
}

function closeExportModal() {
  document.getElementById('modalExportExcel').classList.remove('active');
}

function toggleSigForm(enabled) {
  const container = document.getElementById('sigFormContainer');
  if (container) {
    container.style.display = enabled ? 'block' : 'none';
  }
}

function setTodayDateSig() {
  const monthsIndo = ['Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'];
  const now = new Date();
  document.getElementById('exportKotaTanggal').value =
    `Magelang, ${now.getDate()} ${monthsIndo[now.getMonth()]} ${now.getFullYear()}`;
}

function getBulanTahunLabel(tanggalStr) {
  const monthsIndo = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  if (!tanggalStr || !tanggalStr.includes('-')) {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${monthsIndo[now.getMonth()]} ${now.getFullYear()}` };
  }
  const parts = tanggalStr.split('-');
  const y = parts[0];
  const mIdx = parseInt(parts[1], 10) - 1;
  const key = `${y}-${parts[1]}`;
  const label = `${monthsIndo[mIdx] || parts[1]} ${y}`;
  return { key, label };
}

function createLaporanSheet(wb, sheetName, items, exportData, monthLabel) {
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  const rusak = isRusakLanding();
  const colKeys = getLaporanColumnKeys();
  const colLetter = (i) => String.fromCharCode(65 + i); // A, B, C ...
  const lastL = colLetter(colKeys.length - 1);
  const prevL = colLetter(colKeys.length - 2);
  const idxOf = (k) => colKeys.indexOf(k);

  let titleText = exportData.title || 'Laporan Service Bulanan Sistem Android';
  if (monthLabel && !titleText.toLowerCase().includes(monthLabel.toLowerCase())) {
    titleText = `${titleText} - ${monthLabel}`;
  }

  // 1. Judul Laporan (Baris 1)
  ws.mergeCells(`A1:${lastL}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = titleText;
  titleCell.font = { name: 'Times New Roman', size: 14, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 36;

  // Styling Konfigurasi
  const headerFont = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  const headerBgColor = 'FF004080'; // Biru tua resmi
  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  // 2. Header Tabel (Baris 3 dan 4, tiap kolom digabung vertikal)
  colKeys.forEach((k, i) => {
    const L = colLetter(i);
    ws.mergeCells(`${L}3:${L}4`);
    ws.getCell(`${L}3`).value = getLaporanColumnLabel(k);
  });

  for (let r = 3; r <= 4; r++) {
    ws.getRow(r).height = 26;
    for (let c = 1; c <= colKeys.length; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }
  }

  // 3. Baris Data Laporan
  let currentRow = 5;
  const sortedItems = sortLaporanByNo(items);

  let totalAlatLama = 0;
  let totalAlatBaru = 0;
  let totalSelesai = 0;
  let totalBelumSelesai = 0;
  const kolKet = idxOf('keterangan');

  sortedItems.forEach((l, index) => {
    const r = ws.getRow(currentRow);
    const isBaru = (l.kondisi || '').toLowerCase() === 'baru';
    const qty = parseInt(l.jumlahAlat, 10) || 1;
    if (isBaru) totalAlatBaru += qty; else totalAlatLama += qty;

    const hasTglKeluar = hasTglKeluarVal(l);
    if (hasTglKeluar) totalSelesai++; else totalBelumSelesai++;

    const ketText = l.keteranganPerbaikan || '-';
    const lines = String(ketText).split('\n').reduce((acc, line) => {
      return acc + Math.max(1, Math.ceil((line.length || 1) / 50));
    }, 0);
    r.height = Math.max(26, lines * 22);

    colKeys.forEach((k, colIdx) => {
      const cell = r.getCell(colIdx + 1);
      let val;
      switch (k) {
        case 'no': val = l.no || (index + 1); break;
        case 'jenis': val = l.jenisAlatNama || '-'; break;
        case 'jumlah': val = qty; break;
        case 'lokasi': val = l.lokasiDari || '-'; break;
        case 'tglMasuk': val = l.tanggalMasuk || '-'; break;
        case 'tglKeluar': val = l.tanggalKeluar || '-'; break;
        case 'kondisi': val = l.kondisi || 'Lama'; break;
        case 'lamaHari': val = lamaHariDisplay(l); break;
        case 'status': val = hasTglKeluar ? 'Selesai' : 'Belum Selesai'; break;
        case 'persen': {
          const p = getPersenHidup(l);
          val = p === null ? '-' : p / 100;
          if (p !== null) cell.numFmt = '0.##%';
          break;
        }
        case 'keterangan': val = ketText; break;
        default: val = '';
      }
      cell.value = val;
      cell.border = thinBorder;
      cell.alignment = (k === 'keterangan')
        ? { horizontal: 'left', vertical: 'middle', wrapText: true }
        : { horizontal: 'center', vertical: 'middle', wrapText: true };

      if (k === 'status') {
        if (hasTglKeluar) {
          cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF15803D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        } else {
          cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFB45309' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
        }
      } else {
        cell.font = { name: 'Times New Roman', size: 12 };
      }
    });

    currentRow++;
  });

  const totalKeseluruhanAlat = totalAlatLama + totalAlatBaru;
  const avgPersen = getAvgPersenHidup(sortedItems);

  // Baris Total Tabel: "JUMLAH" (No + Jenis) | total unit (Jumlah) | ringkasan
  const rowTotal = ws.getRow(currentRow);
  rowTotal.height = 26;
  ws.mergeCells(`A${currentRow}:B${currentRow}`);
  const cellTotalLabel = ws.getCell(`A${currentRow}`);
  cellTotalLabel.value = 'JUMLAH';
  cellTotalLabel.font = { name: 'Times New Roman', size: 12, bold: true };
  cellTotalLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  const cellTotalQty = ws.getCell(`C${currentRow}`);
  cellTotalQty.value = totalKeseluruhanAlat;
  cellTotalQty.font = { name: 'Times New Roman', size: 12, bold: true };
  cellTotalQty.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`D${currentRow}:${lastL}${currentRow}`);
  const cellSummaryInline = ws.getCell(`D${currentRow}`);
  cellSummaryInline.value = rusak
    ? `Total Barang Rusak: ${totalKeseluruhanAlat} unit | Lama: ${totalAlatLama} | Baru: ${totalAlatBaru} | Rata-rata Sparepart Hidup: ${avgPersen}%`
    : `Total Alat: ${totalKeseluruhanAlat} unit | Lama: ${totalAlatLama} | Baru: ${totalAlatBaru} | Selesai: ${totalSelesai} | Belum Selesai: ${totalBelumSelesai}`;
  cellSummaryInline.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF004080' } };
  cellSummaryInline.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  for (let c = 1; c <= colKeys.length; c++) {
    const cell = rowTotal.getCell(c);
    cell.border = thinBorder;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }
  currentRow++;

  // 4. Catatan Otomatis Ringkasan Laporan
  currentRow++;
  ws.mergeCells(`B${currentRow}:E${currentRow}`);
  const cellNoteTitle = ws.getCell(`B${currentRow}`);
  cellNoteTitle.value = 'Catatan / Ringkasan Laporan:';
  cellNoteTitle.font = { name: 'Times New Roman', size: 12, bold: true, underline: true };
  cellNoteTitle.alignment = { horizontal: 'left', vertical: 'middle' };
  currentRow++;

  const summaryItems = [
    { label: '• Jumlah Alat Lama', val: `${totalAlatLama} unit`, color: null },
    { label: '• Jumlah Alat Baru', val: `${totalAlatBaru} unit`, color: null },
    { label: '• Total Keseluruhan Alat', val: `${totalKeseluruhanAlat} unit`, color: 'FF004080', bold: true }
  ];
  if (rusak) {
    summaryItems.push({ label: '• Rata-rata Sparepart Hidup', val: `${avgPersen}%`, color: 'FF15803D', bold: true });
  } else {
    summaryItems.push({ label: '• Status Selesai', val: `${totalSelesai} laporan`, color: 'FF15803D', bold: true });
    summaryItems.push({ label: '• Status Belum Selesai', val: `${totalBelumSelesai} laporan`, color: 'FFB45309', bold: true });
  }

  summaryItems.forEach(item => {
    ws.mergeCells(`B${currentRow}:C${currentRow}`);
    const cLabel = ws.getCell(`B${currentRow}`);
    cLabel.value = item.label;
    cLabel.font = { name: 'Times New Roman', size: 12, bold: !!item.bold };
    cLabel.alignment = { horizontal: 'left', vertical: 'middle' };

    ws.mergeCells(`D${currentRow}:E${currentRow}`);
    const cVal = ws.getCell(`D${currentRow}`);
    cVal.value = `: ${item.val}`;
    const fontOpt = { name: 'Times New Roman', size: 12, bold: true };
    if (item.color) fontOpt.color = { argb: item.color };
    cVal.font = fontOpt;
    cVal.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;
  });

  // 5. Kolom Tanda Tangan (kanan = 2 kolom terakhir, kiri = B:C)
  const sig = exportData.signature;
  if (sig && sig.enabled !== false) {
    const R = `${prevL}`;  // kolom awal blok kanan
    const place = (range, value, bold) => {
      ws.mergeCells(range);
      const cell = ws.getCell(range.split(':')[0]);
      cell.value = value;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { name: 'Times New Roman', size: 12, bold: !!bold };
    };

    currentRow++;
    place(`${R}${currentRow}:${lastL}${currentRow}`, sig.kotaTanggal || 'Magelang, 31 Oktober 2026');

    currentRow++;
    place(`B${currentRow}:C${currentRow}`, sig.mengetahuiTitle || 'Mengetahui,');
    place(`${R}${currentRow}:${lastL}${currentRow}`, sig.pembuatTitle || 'Dibuat Oleh,');

    currentRow += 5; // Spasi tanda tangan fisik

    place(`B${currentRow}:C${currentRow}`, sig.mengetahuiNama || 'Wiyatmo Diarto, SE', true);
    place(`${R}${currentRow}:${lastL}${currentRow}`, sig.pembuatNama || (currentUser && currentUser.nama) || 'Teknisi Service', true);

    currentRow++;
    place(`B${currentRow}:C${currentRow}`, sig.mengetahuiJabatan || 'Manager Muffaindo');
    place(`${R}${currentRow}:${lastL}${currentRow}`, sig.pembuatJabatan || (currentUser && currentUser.role) || 'Teknisi Service');
  }

  // 6. Lebar Kolom (mengikuti urutan kolom)
  const widthMap = {
    no: 7, jenis: 28, jumlah: 10, lokasi: 28, tglMasuk: 17, tglKeluar: 17,
    kondisi: 13, lamaHari: 13, status: 18, persen: 20, keterangan: 54
  };
  ws.columns = colKeys.map(k => ({ width: widthMap[k] || 15 }));
}

async function confirmExportToExcel() {
  const isSigEnabled = document.getElementById('exportSigEnabled').checked;
  const title = (document.getElementById('exportTitle') ? document.getElementById('exportTitle').value.trim() : '') || 'Laporan Service Bulanan Sistem Android';
  const pembuatTitle = (document.getElementById('exportPembuatTitle') ? document.getElementById('exportPembuatTitle').value.trim() : '') || 'Dibuat Oleh,';

  const signatureConfig = {
    title,
    enabled: isSigEnabled,
    kotaTanggal: document.getElementById('exportKotaTanggal').value.trim() || 'Magelang, 31 Oktober 2026',
    mengetahuiTitle: 'Mengetahui,',
    mengetahuiNama: document.getElementById('exportMengetahuiNama').value.trim() || 'Wiyatmo Diarto, SE',
    mengetahuiJabatan: document.getElementById('exportMengetahuiJabatan').value.trim() || 'Manager Muffaindo',
    pembuatTitle: pembuatTitle,
    pembuatNama: document.getElementById('exportPembuatNama').value.trim() || (currentUser && currentUser.nama) || 'Teknisi Service',
    pembuatJabatan: document.getElementById('exportPembuatJabatan').value.trim() || (currentUser && currentUser.role) || 'Teknisi Service'
  };

  try { localStorage.setItem('export_signature_config', JSON.stringify(signatureConfig)); } catch (e) {}

  const selectedMonth = document.getElementById('exportPeriodeBulan') ? document.getElementById('exportPeriodeBulan').value : 'all';

  const activeCfg = getCurrentLandingConfig();
  const dbTag = (activeCfg.shortTitle || activeCfg.title).replace(/[^a-zA-Z0-9]/g, '_');
  let suggestedFilename = `Laporan_${dbTag}.xlsx`;
  const monthsIndo = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  if (selectedMonth && selectedMonth !== 'all' && selectedMonth.includes('-')) {
    const parts = selectedMonth.split('-');
    const blnIdx = parseInt(parts[1], 10) - 1;
    const labelBulan = monthsIndo[blnIdx];
    suggestedFilename = `Laporan_${dbTag}_${labelBulan}_${parts[0]}.xlsx`;
  } else {
    const now = new Date();
    suggestedFilename = `Laporan_${dbTag}_Semua_Bulan_${now.getFullYear()}.xlsx`;
  }

  closeExportModal();
  showToast('Memproses file Excel...', 'info');

  try {
    if (typeof ExcelJS === 'undefined') {
      alert('Library ExcelJS sedang dimuat atau tidak tersedia.');
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Laporan Service';
    wb.created = new Date();

    let laporanList = Array.isArray(data.laporan) ? data.laporan : [];
    if (selectedMonth !== 'all') {
      laporanList = laporanList.filter(l => {
        const tgl = l.tanggalMasuk || l.tanggalKeluar || '';
        const { key } = getBulanTahunLabel(tgl);
        return key === selectedMonth;
      });
    }

    const groups = new Map();
    laporanList.forEach(l => {
      const tgl = l.tanggalMasuk || l.tanggalKeluar || '';
      const { key, label } = getBulanTahunLabel(tgl);
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key).items.push(l);
    });

    if (groups.size === 0) {
      const dummyTgl = (selectedMonth !== 'all') ? `${selectedMonth}-01` : '';
      const { key, label } = getBulanTahunLabel(dummyTgl);
      groups.set(key, { label, items: [] });
    }

    const sortedKeys = Array.from(groups.keys()).sort();
    sortedKeys.forEach(key => {
      const { label, items } = groups.get(key);
      const sheetName = label.substring(0, 31);
      createLaporanSheet(wb, sheetName, items, { title, signature: signatureConfig }, label);
    });

    // Sheet Terakhir: Master Kategori Jenis Alat
    const wsKategori = wb.addWorksheet('Master Kategori', {
      views: [{ showGridLines: true }]
    });

    const headerFont = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    const headerBgColor = 'FF004080';
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    wsKategori.getRow(1).height = 26;
    wsKategori.getCell('A1').value = 'No';
    wsKategori.getCell('B1').value = 'Nama Kategori Alat';
    ['A1', 'B1'].forEach(cellRef => {
      const cell = wsKategori.getCell(cellRef);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });

    const kategoriList = Array.isArray(data.jenisAlat) ? data.jenisAlat : [];
    kategoriList.forEach((j, idx) => {
      const r = wsKategori.getRow(idx + 2);
      r.height = 26;
      r.getCell(1).value = idx + 1;
      r.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r.getCell(1).font = { name: 'Times New Roman', size: 12 };
      r.getCell(1).border = thinBorder;

      r.getCell(2).value = j.nama || '-';
      r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      r.getCell(2).font = { name: 'Times New Roman', size: 12 };
      r.getCell(2).border = thinBorder;
    });

    wsKategori.columns = [
      { width: 8 },
      { width: 36 }
    ];

    const buffer = await wb.xlsx.writeBuffer();
    downloadBlobAsFile(buffer, suggestedFilename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    showToast('✓ File Excel berhasil diunduh!', 'success');
  } catch (err) {
    console.error(err);
    showToast('⚠ Gagal export: ' + err.message, 'error');
  }
}

function downloadBlobAsFile(buffer, filename, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ==========================================
// EDIT PROFIL PENGGUNA
// ==========================================
function openEditProfilModal() {
  if (!currentUser) return;
  const modal = document.getElementById('modalEditProfil');
  if (!modal) return;

  const errEl = document.getElementById('editProfilError');
  if (errEl) errEl.style.display = 'none';

  const userList = Array.isArray(data.users) && data.users.length > 0 ? data.users : DEFAULT_USERS;
  const userObj = userList.find(u => u.id === currentUser.id || (u.username && u.username.toLowerCase() === currentUser.username.toLowerCase())) || currentUser;

  document.getElementById('editProfilNama').value = userObj.nama || currentUser.nama || '';
  document.getElementById('editProfilUsername').value = userObj.username || currentUser.username || '';
  document.getElementById('editProfilRole').value = userObj.role || currentUser.role || 'Admin';
  document.getElementById('editProfilPassword').value = '';
  document.getElementById('editProfilPasswordConfirm').value = '';

  pendingAvatarData = userObj.avatar !== undefined ? userObj.avatar : (currentUser.avatar || null);
  const preview = document.getElementById('editProfilAvatarPreview');
  if (preview) {
    if (pendingAvatarData) {
      preview.innerHTML = `<img src="${pendingAvatarData}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      preview.innerHTML = DEFAULT_AVATAR_SVG;
    }
  }

  modal.classList.add('active');
  setTimeout(() => {
    const input = document.getElementById('editProfilNama');
    if (input) input.focus();
  }, 100);
}

function closeEditProfilModal() {
  const modal = document.getElementById('modalEditProfil');
  if (modal) modal.classList.remove('active');
  pendingAvatarData = null;
}

function handleProfilePhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Silakan pilih file gambar yang valid (JPG, PNG, atau SVG).');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    pendingAvatarData = e.target.result;
    const preview = document.getElementById('editProfilAvatarPreview');
    if (preview) {
      preview.innerHTML = `<img src="${pendingAvatarData}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
  };
  reader.readAsDataURL(file);
}

function resetProfileAvatarToDefault() {
  pendingAvatarData = '';
  const preview = document.getElementById('editProfilAvatarPreview');
  if (preview) {
    preview.innerHTML = DEFAULT_AVATAR_SVG;
  }
}

async function saveEditProfil() {
  if (!currentUser) return;
  const errEl = document.getElementById('editProfilError');
  const nama = (document.getElementById('editProfilNama').value || '').trim();
  const username = (document.getElementById('editProfilUsername').value || '').trim();
  const role = (document.getElementById('editProfilRole').value || '').trim() || 'Admin';
  const pwd = document.getElementById('editProfilPassword').value || '';
  const pwdConfirm = document.getElementById('editProfilPasswordConfirm').value || '';

  if (!nama) {
    if (errEl) {
      errEl.textContent = 'Nama lengkap tidak boleh kosong!';
      errEl.style.display = 'block';
    }
    return;
  }
  if (!username) {
    if (errEl) {
      errEl.textContent = 'Username tidak boleh kosong!';
      errEl.style.display = 'block';
    }
    return;
  }

  const usernameTaken = (data.users || []).some(u => 
    u.id !== currentUser.id && u.username && u.username.toLowerCase() === username.toLowerCase()
  );
  if (usernameTaken) {
    if (errEl) {
      errEl.textContent = `Username "${username}" sudah digunakan oleh akun lain!`;
      errEl.style.display = 'block';
    }
    return;
  }

  if (pwd) {
    if (pwd.length < 5) {
      if (errEl) {
        errEl.textContent = 'Password baru minimal harus 5 karakter!';
        errEl.style.display = 'block';
      }
      return;
    }
    if (pwd !== pwdConfirm) {
      if (errEl) {
        errEl.textContent = 'Konfirmasi password tidak cocok dengan password baru!';
        errEl.style.display = 'block';
      }
      return;
    }
  }

  if (!Array.isArray(data.users)) data.users = [];
  let userIdx = data.users.findIndex(u => u.id === currentUser.id || (u.username && u.username.toLowerCase() === currentUser.username.toLowerCase()));
  
  if (userIdx === -1) {
    const newUser = {
      id: currentUser.id || 1,
      username: username,
      nama: nama,
      role: role,
      password: pwd || 'hardware123',
      avatar: pendingAvatarData !== null ? pendingAvatarData : (currentUser.avatar || '')
    };
    data.users.push(newUser);
  } else {
    data.users[userIdx].nama = nama;
    data.users[userIdx].username = username;
    data.users[userIdx].role = role;
    if (pwd) {
      data.users[userIdx].password = pwd;
    }
    if (pendingAvatarData !== null) {
      data.users[userIdx].avatar = pendingAvatarData;
    }
  }

  currentUser.nama = nama;
  currentUser.username = username;
  currentUser.role = role;
  if (pendingAvatarData !== null) {
    currentUser.avatar = pendingAvatarData;
  }
  localStorage.setItem('auth_user', JSON.stringify(currentUser));

  await saveData();

  updateSidebarProfile();
  const pembuatNamaInput = document.getElementById('exportPembuatNama');
  if (pembuatNamaInput && nama) {
    pembuatNamaInput.value = nama;
  }
  const pembuatJabatanInput = document.getElementById('exportPembuatJabatan');
  if (pembuatJabatanInput && role) {
    pembuatJabatanInput.value = role;
  }

  closeEditProfilModal();
  showToast('✓ Profil pengguna berhasil diperbarui!', 'success');
}

// ==========================================
// UTILITY & EVENT LISTENERS
// ==========================================
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLaporanModal();
    closeJenisAlatModal();
    closeLokasiModal();
    closeExportModal();
    closeEditProfilModal();
    closeMobileSidebar();
  }
});

// Jalankan inisialisasi aplikasi
loadData();
