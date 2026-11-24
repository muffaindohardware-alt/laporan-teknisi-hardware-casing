const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const db = require('./db');

const DEFAULT_PORT = process.env.PORT || 3000;

// Otomatis cari folder web/ atau public/ atau root
function getWebDir() {
  if (fs.existsSync(path.join(__dirname, 'web'))) {
    return path.join(__dirname, 'web');
  }
  if (fs.existsSync(path.join(__dirname, 'public'))) {
    return path.join(__dirname, 'public');
  }
  return __dirname;
}

const WEB_DIR = getWebDir();

// 5 landing page (data terpisah per tabel), disimpan di 2 database MySQL: hardware & casing
const DB_KEYS = db.DB_KEYS || ['hardware_hp', 'hardware_alat', 'hardware_rusak', 'casing_admin', 'casing_paket'];

// Normalisasi target database key
function normalizeDbTarget(inputKey) {
  const k = String(inputKey || '').toLowerCase().trim();
  if (k === 'hardware') return 'hardware_hp';
  if (k === 'casing') return 'casing_admin';
  if (DB_KEYS.includes(k)) return k;
  return 'hardware_hp';
}

// User default
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

// Data inisial default per database
const INITIAL_DATA_MAP = {
  hardware_hp: {
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
  },
  hardware_alat: {
    users: DEFAULT_USERS,
    jenisAlat: [
      { id: 1, nama: 'Printer Thermal' },
      { id: 2, nama: 'Barcode Scanner' },
      { id: 3, nama: 'Power Supply / PSU' },
      { id: 4, nama: 'Switch / Router Jaringan' },
      { id: 5, nama: 'Monitor / Display' },
      { id: 6, nama: 'Mesin EDC / POS' },
      { id: 7, nama: 'Alat Elektronik Lain' }
    ],
    kategoriLokasi: [
      { id: 1, nama: 'Gudang Utama' },
      { id: 2, nama: 'Teknisi Limin' },
      { id: 3, nama: 'Rutan Bangil' },
      { id: 4, nama: 'Salafiyah Sukorejo' }
    ],
    laporan: []
  },
  hardware_rusak: {
    users: DEFAULT_USERS,
    jenisAlat: [
      { id: 1, nama: 'LCD Pecah / Garis' },
      { id: 2, nama: 'Mesin Matot / Korslet' },
      { id: 3, nama: 'Baterai Kembung / Drop' },
      { id: 4, nama: 'IC Power / IC Charging' },
      { id: 5, nama: 'Board / Motherboard PC' },
      { id: 6, nama: 'Flexible / Konektor Rusak' },
      { id: 7, nama: 'Kamera / Speaker / Mic' },
      { id: 8, nama: 'Part Rusak Lainnya' }
    ],
    kategoriLokasi: [
      { id: 1, nama: 'Gudang Afkir' },
      { id: 2, nama: 'Gudang Kanibal' },
      { id: 3, nama: 'Teknisi Limin' },
      { id: 4, nama: 'Admin Stock' }
    ],
    laporan: []
  },
  casing_admin: {
    users: DEFAULT_USERS,
    jenisAlat: [
      { id: 1, nama: 'Casing Fullset HOT 11 PLAY' },
      { id: 2, nama: 'Casing Fullset HOT 50I' },
      { id: 3, nama: 'Casing Fullset HOT 60I' },
      { id: 4, nama: 'Backdoor SMART 10' },
      { id: 5, nama: 'Backdoor SMART 20' },
      { id: 6, nama: 'Frame / Bezel LCD' }
    ],
    kategoriLokasi: [
      { id: 1, nama: 'Admin Stock Pusat' },
      { id: 2, nama: 'Gudang Casing' },
      { id: 3, nama: 'Teknisi Casing' }
    ],
    laporan: []
  },
  casing_paket: {
    users: DEFAULT_USERS,
    jenisAlat: [
      { id: 1, nama: 'Paket Casing Inifinix' },
      { id: 2, nama: 'Paket Casing Samsung' },
      { id: 3, nama: 'Paket Backdoor' },
      { id: 4, nama: 'Paket Frame & Kaca Kamera' },
      { id: 5, nama: 'Paket Aksesoris Casing' }
    ],
    kategoriLokasi: [
      { id: 1, nama: 'Ekspedisi J&T' },
      { id: 2, nama: 'Ekspedisi JNE' },
      { id: 3, nama: 'Ekspedisi SiCepat' },
      { id: 4, nama: 'Kiriman Vendor / Supplier' }
    ],
    laporan: []
  }
};

// Tentukan path penyimpanan data JSON lokal
function getDataFilePath(targetDb = 'hardware_hp') {
  const localDataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }

  const key = normalizeDbTarget(targetDb);
  const targetFile = path.join(localDataDir, `laporan-${key.replace(/_/g, '-')}.json`);

  // Jika file baru belum ada, migrasikan dari file lama bila ada
  if (!fs.existsSync(targetFile)) {
    if (key === 'hardware_hp') {
      const oldHwFile = path.join(localDataDir, 'laporan-service-hardware.json');
      const legacyFile = path.join(localDataDir, 'laporan-service.json');
      const sourceFile = fs.existsSync(oldHwFile) ? oldHwFile : (fs.existsSync(legacyFile) ? legacyFile : null);
      if (sourceFile) {
        try {
          fs.copyFileSync(sourceFile, targetFile);
        } catch (e) {}
      }
    } else if (key === 'casing_admin') {
      const oldCsFile = path.join(localDataDir, 'laporan-service-casing.json');
      if (fs.existsSync(oldCsFile)) {
        try {
          fs.copyFileSync(oldCsFile, targetFile);
        } catch (e) {}
      }
    }

    // Jika masih belum ada, buat template awal
    if (!fs.existsSync(targetFile)) {
      const template = INITIAL_DATA_MAP[key] || INITIAL_DATA_MAP.hardware_hp;
      try {
        fs.writeFileSync(targetFile, JSON.stringify(template, null, 2), 'utf-8');
      } catch (e) {}
    }
  }

  return targetFile;
}

// Baca data JSON lokal
function readJsonData(targetDb = 'hardware_hp') {
  const key = normalizeDbTarget(targetDb);
  const filePath = getDataFilePath(key);
  const defaultData = INITIAL_DATA_MAP[key] || INITIAL_DATA_MAP.hardware_hp;
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : DEFAULT_USERS,
        jenisAlat: Array.isArray(parsed.jenisAlat) ? parsed.jenisAlat : defaultData.jenisAlat,
        kategoriLokasi: Array.isArray(parsed.kategoriLokasi) ? parsed.kategoriLokasi : defaultData.kategoriLokasi,
        laporan: Array.isArray(parsed.laporan) ? parsed.laporan : []
      };
    }
  } catch (err) {
    console.error(`Gagal membaca file data JSON [${key}]:`, err.message);
  }
  return defaultData;
}

// Simpan data JSON lokal
function writeJsonData(newData, targetDb = 'hardware_hp') {
  const key = normalizeDbTarget(targetDb);
  const filePath = getDataFilePath(key);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Gagal menyimpan file data JSON [${key}]:`, err.message);
    return false;
  }
}

// Ambil IP Lokal untuk akses jaringan LAN / Wi-Fi
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, ip: iface.address });
      }
    }
  }
  return ips;
}

// Content-Type map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

const server = http.createServer(async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Database');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Normalisasi database tujuan dari query param ?db=... atau header X-Database
    const requestedDb = normalizeDbTarget(parsedUrl.query.db || req.headers['x-database'] || 'hardware_hp');

    // --- API: GET DATA ---
    if (pathname === '/api/data' && req.method === 'GET') {
      let result = null;
      const dbStatus = db.getDatabaseStatus(requestedDb);

      if (dbStatus.connected) {
        result = await db.getDataFromDb(requestedDb);
      }

      if (!result) {
        result = readJsonData(requestedDb);
      }

      result.activeDatabase = requestedDb;
      result.databaseName = dbStatus.database || path.basename(getDataFilePath(requestedDb));

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Database-Engine': dbStatus.engine,
        'X-Database-Target': requestedDb,
        'X-Database-Name': result.databaseName
      });
      res.end(JSON.stringify(result));
      return;
    }

    // --- API: SAVE DATA ---
    if (pathname === '/api/save-data' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 50 * 1024 * 1024) { // 50MB limit
          req.destroy();
        }
      });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const targetDb = normalizeDbTarget(parsedUrl.query.db || parsed.db || req.headers['x-database'] || 'hardware_hp');
          
          // 1. Simpan ke file JSON cadangan khusus database tersebut
          writeJsonData(parsed, targetDb);

          // 2. Simpan ke database MySQL jika terhubung
          const dbStatus = db.getDatabaseStatus(targetDb);
          let dbSuccess = true;
          if (dbStatus.connected) {
            dbSuccess = await db.saveDataToDb(parsed, targetDb);
          }

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            database: targetDb,
            databaseName: dbStatus.database,
            engine: dbStatus.engine,
            dbSaved: dbSuccess
          }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Format data tidak valid: ' + e.message }));
        }
      });
      return;
    }

    // --- API: INFO SERVER ---
    if (pathname === '/api/info' && req.method === 'GET') {
      const dbOverall = db.getDatabaseStatus();
      const statusDatabases = {};
      const backupFiles = {};

      DB_KEYS.forEach(k => {
        statusDatabases[k] = db.getDatabaseStatus(k);
        backupFiles[k] = getDataFilePath(k);
      });

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        status: 'online',
        databases: statusDatabases,
        backupFiles: backupFiles,
        localIps: getLocalIPAddresses()
      }));
      return;
    }

    // --- STATIC FILE SERVING ---
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\' || safePath === '') {
      safePath = '/index.html';
    }

    let filePath = path.join(WEB_DIR, safePath);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(WEB_DIR, 'index.html');
    } else {
      try {
        if (fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch (e) {
        filePath = path.join(WEB_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File tidak ditemukan: ' + safePath);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  } catch (err) {
    console.error('Unhandled request error:', err);
    try {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error: ' + err.message);
    } catch (e) {}
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  // Inisialisasi data map untuk seluruh 5 landing page
  const initialMap = {};
  DB_KEYS.forEach(k => {
    initialMap[k] = readJsonData(k);
  });

  await db.initDatabase(initialMap);

  server.listen(DEFAULT_PORT, '0.0.0.0', () => {
    const ips = getLocalIPAddresses();

    console.log('\n=============================================================');
    console.log('  🌐 Laporan Service Multi-Landing Page Berhasil Dijalankan!');
    console.log('=============================================================');
    console.log(`  ▶ Akses Lokal          : http://localhost:${DEFAULT_PORT}`);
    ips.forEach(item => {
      console.log(`  ▶ Akses LAN (${item.name}): http://${item.ip}:${DEFAULT_PORT}`);
    });
    console.log('-------------------------------------------------------------');
    console.log('  🗄️ 2 Database MySQL, tabel terpisah per landing page:');
    DB_KEYS.forEach(k => {
      const st = db.getDatabaseStatus(k);
      console.log(`   • [${k}] : ${st.connected ? `MySQL [${st.database}].${st.tablePrefix}*` : 'File JSON (' + path.basename(getDataFilePath(k)) + ')'}`);
    });
    console.log('=============================================================\n');
  });
}

startServer();
