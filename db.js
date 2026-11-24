// ==============================================================
// MYSQL DATABASE CONNECTOR (2 DATABASE + TABEL TERPISAH PER LANDING PAGE)
//
// Hanya 2 database MySQL:
//   1. laporan_hardware  -> Teknisi Hardware
//        - tabel hp_*     : Service HP, PC & Tab   (landing: hardware_hp)
//        - tabel alat_*   : Service Alat Lain      (landing: hardware_alat)
//        - tabel rusak_*  : Data Barang Rusak      (landing: hardware_rusak)
//   2. laporan_casing    -> Teknisi Casing
//        - tabel admin_*  : Dari Admin Stock       (landing: casing_admin)
//        - tabel paket_*  : Dari Paket             (landing: casing_paket)
//
// Setiap database punya 1 tabel `users` bersama (user: hardware & casing).
// Setiap landing page punya 3 tabel sendiri: <prefix>_jenis_alat,
// <prefix>_kategori_lokasi, <prefix>_laporan  -> data antar landing page
// TIDAK PERNAH tercampur.
// Otomatis membuat database & tabel, auto-seed dari JSON, auto-fallback JSON.
// ==============================================================

const fs = require('fs');
const path = require('path');

let mysql = null;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  console.warn('⚠️ Modul mysql2 belum tersedia. Pastikan menjalankan "npm install mysql2".');
}

// Key landing page (tetap sama dengan frontend) -> database induk + prefix tabel
const LANDING_MAP = {
  hardware_hp:    { db: 'hardware', prefix: 'hp' },
  hardware_alat:  { db: 'hardware', prefix: 'alat' },
  hardware_rusak: { db: 'hardware', prefix: 'rusak' },
  casing_admin:   { db: 'casing',   prefix: 'admin' },
  casing_paket:   { db: 'casing',   prefix: 'paket' }
};

const DB_KEYS = Object.keys(LANDING_MAP);          // 5 landing page
const PARENT_KEYS = ['hardware', 'casing'];        // 2 database

function normalizeDbKey(key) {
  const k = String(key || '').toLowerCase().trim();
  if (k === 'hardware') return 'hardware_hp';
  if (k === 'casing') return 'casing_admin';
  if (DB_KEYS.includes(k)) return k;
  return 'hardware_hp';
}

function tbl(key, name) {
  return '`' + LANDING_MAP[key].prefix + '_' + name + '`';
}

function getDbConfig() {
  const configPath = path.join(__dirname, 'config.json');
  let fileConfig = {};
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error('Gagal membaca config.json:', e.message);
    }
  }

  const fileDbs = fileConfig.databases || {};
  return {
    host: process.env.DB_HOST || fileConfig.host || 'localhost',
    user: process.env.DB_USER || fileConfig.user || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (fileConfig.password !== undefined ? fileConfig.password : ''),
    port: parseInt(process.env.DB_PORT || fileConfig.port || 3306, 10),
    databases: {
      hardware: process.env.DB_HARDWARE || fileDbs.hardware || 'laporan_hardware',
      casing: process.env.DB_CASING || fileDbs.casing || 'laporan_casing'
    }
  };
}

const pools = {};              // pools[parentKey]
const parentStatus = {};       // parentKey -> boolean
const landingStatus = {};      // landingKey -> boolean
PARENT_KEYS.forEach(k => { parentStatus[k] = false; });
DB_KEYS.forEach(k => { landingStatus[k] = false; });

async function createUsersTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`users\` (
      \`id\` BIGINT NOT NULL,
      \`username\` VARCHAR(100) NOT NULL UNIQUE,
      \`password\` VARCHAR(255) NOT NULL,
      \`nama\` VARCHAR(255) NOT NULL,
      \`role\` VARCHAR(100) NOT NULL DEFAULT 'Admin',
      \`avatar\` LONGTEXT NULL,
      \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function createLandingTables(pool, key) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tbl(key, 'jenis_alat')} (
      \`id\` BIGINT NOT NULL,
      \`nama\` VARCHAR(255) NOT NULL,
      \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tbl(key, 'kategori_lokasi')} (
      \`id\` BIGINT NOT NULL,
      \`nama\` VARCHAR(255) NOT NULL,
      \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const p = LANDING_MAP[key].prefix;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tbl(key, 'laporan')} (
      \`id\` BIGINT NOT NULL,
      \`no\` VARCHAR(50) DEFAULT '',
      \`tanggalMasuk\` VARCHAR(50) DEFAULT '',
      \`tanggalKeluar\` VARCHAR(50) DEFAULT '',
      \`jumlahAlat\` INT DEFAULT 1,
      \`keteranganPerbaikan\` TEXT,
      \`jenisAlatId\` BIGINT DEFAULT NULL,
      \`jenisAlatNama\` VARCHAR(255) DEFAULT '',
      \`lokasiDari\` VARCHAR(255) DEFAULT '',
      \`kondisi\` VARCHAR(50) DEFAULT 'Lama',
      \`lamaHari\` INT DEFAULT 0,
      \`persenHidup\` DECIMAL(5,2) DEFAULT NULL,
      \`createdAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      INDEX \`idx_${p}_tgl_masuk\` (\`tanggalMasuk\`),
      INDEX \`idx_${p}_lokasi\` (\`lokasiDari\`),
      INDEX \`idx_${p}_jenis\` (\`jenisAlatNama\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Migrasi: tambah kolom persenHidup bila tabel dibuat dari versi sebelumnya
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'persenHidup'`,
    [LANDING_MAP[key].prefix + '_laporan']
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE ${tbl(key, 'laporan')} ADD COLUMN \`persenHidup\` DECIMAL(5,2) DEFAULT NULL AFTER \`lamaHari\``);
  }
}

// Inisialisasi 2 database + tabel per landing page
async function initDatabase(initialDataMap = {}) {
  if (!mysql) return false;

  const config = getDbConfig();

  // 1. Buat 2 database
  let tempConn = null;
  try {
    tempConn = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port
    });
    for (const pk of PARENT_KEYS) {
      await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.databases[pk]}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    }
    await tempConn.end();
    tempConn = null;
  } catch (err) {
    console.warn(`⚠️ MySQL tidak aktif (${err.message}). Sistem menggunakan penyimpanan file JSON otomatis.`);
    if (tempConn) {
      try { await tempConn.end(); } catch (e) {}
    }
    PARENT_KEYS.forEach(k => { parentStatus[k] = false; });
    DB_KEYS.forEach(k => { landingStatus[k] = false; });
    return false;
  }

  // 2. Pool + tabel users bersama untuk tiap database
  for (const pk of PARENT_KEYS) {
    const dbName = config.databases[pk];
    try {
      const pool = mysql.createPool({
        host: config.host,
        user: config.user,
        password: config.password,
        port: config.port,
        database: dbName,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        charset: 'utf8mb4'
      });
      await createUsersTable(pool);
      pools[pk] = pool;
      parentStatus[pk] = true;
      console.log(`✓ Terhubung ke database MySQL: [${dbName}] (${pk})`);
    } catch (err) {
      console.warn(`⚠️ Gagal menginisialisasi database [${dbName}]: ${err.message}`);
      parentStatus[pk] = false;
      pools[pk] = null;
    }
  }

  // 3. Tabel per landing page + auto-seed bila masih kosong
  for (const key of DB_KEYS) {
    const pk = LANDING_MAP[key].db;
    const pool = pools[pk];
    if (!parentStatus[pk] || !pool) continue;

    try {
      await createLandingTables(pool, key);
      landingStatus[key] = true;

      const [cnt] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM ${tbl(key, 'jenis_alat')}) AS ja,
                (SELECT COUNT(*) FROM ${tbl(key, 'kategori_lokasi')}) AS kl,
                (SELECT COUNT(*) FROM ${tbl(key, 'laporan')}) AS lp`
      );
      const empty = cnt[0].ja === 0 && cnt[0].kl === 0 && cnt[0].lp === 0;
      const seed = initialDataMap[key] || initialDataMap['default'];
      if (empty && seed) {
        console.log(`📦 Memigrasikan data awal ke tabel ${LANDING_MAP[key].prefix}_* [${config.databases[pk]}]...`);
        await saveDataToDb(seed, key);
      }
      console.log(`  ✓ Landing [${key}] -> ${config.databases[pk]}.${LANDING_MAP[key].prefix}_*`);
    } catch (err) {
      console.warn(`⚠️ Gagal menyiapkan tabel landing [${key}]: ${err.message}`);
      landingStatus[key] = false;
    }
  }

  return Object.values(landingStatus).some(Boolean);
}

// Ambil data satu landing page (hanya tabel miliknya + users bersama)
async function getDataFromDb(targetDb = 'hardware_hp') {
  const key = normalizeDbKey(targetDb);
  const pool = pools[LANDING_MAP[key].db];
  if (!landingStatus[key] || !pool) return null;

  try {
    const [users] = await pool.query('SELECT id, username, password, nama, role, avatar FROM users ORDER BY id ASC');
    const [jenisAlat] = await pool.query(`SELECT id, nama FROM ${tbl(key, 'jenis_alat')} ORDER BY nama ASC`);
    const [kategoriLokasi] = await pool.query(`SELECT id, nama FROM ${tbl(key, 'kategori_lokasi')} ORDER BY nama ASC`);
    const [laporan] = await pool.query(
      `SELECT id, no, tanggalMasuk, tanggalKeluar, jumlahAlat, keteranganPerbaikan, jenisAlatId, jenisAlatNama, lokasiDari, kondisi, lamaHari, persenHidup
       FROM ${tbl(key, 'laporan')} ORDER BY id ASC`
    );

    return {
      users: users || [],
      jenisAlat: jenisAlat || [],
      kategoriLokasi: kategoriLokasi || [],
      laporan: laporan || []
    };
  } catch (err) {
    console.error(`Error saat mengambil data dari MySQL [${key}]:`, err.message);
    return null;
  }
}

function uniqueId(raw, seen, counter) {
  let id = parseInt(raw, 10);
  if (!id || seen.has(id)) id = ++counter.n;
  seen.add(id);
  return id;
}

// Simpan data satu landing page. Hanya menyentuh tabel prefix miliknya + users.
async function saveDataToDb(data, targetDb = 'hardware_hp') {
  const key = normalizeDbKey(targetDb);
  const pool = pools[LANDING_MAP[key].db];
  if (!landingStatus[key] || !pool) return false;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Users (tabel bersama di database ini)
    if (Array.isArray(data.users) && data.users.length > 0) {
      await conn.query('DELETE FROM users');
      for (const u of data.users) {
        await conn.query(
          'INSERT INTO users (id, username, password, nama, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
          [u.id || 1, u.username || 'hardware', u.password || '', u.nama || '', u.role || 'Teknisi', u.avatar || null]
        );
      }
    }

    // 2. Jenis alat (khusus landing ini)
    if (Array.isArray(data.jenisAlat)) {
      await conn.query(`DELETE FROM ${tbl(key, 'jenis_alat')}`);
      const seen = new Set();
      const counter = { n: Date.now() };
      for (const j of data.jenisAlat) {
        j.id = uniqueId(j.id, seen, counter);
        await conn.query(`INSERT INTO ${tbl(key, 'jenis_alat')} (id, nama) VALUES (?, ?)`, [j.id, j.nama || '']);
      }
    }

    // 3. Kategori lokasi (khusus landing ini)
    if (Array.isArray(data.kategoriLokasi)) {
      await conn.query(`DELETE FROM ${tbl(key, 'kategori_lokasi')}`);
      const seen = new Set();
      const counter = { n: Date.now() };
      for (const k of data.kategoriLokasi) {
        k.id = uniqueId(k.id, seen, counter);
        await conn.query(`INSERT INTO ${tbl(key, 'kategori_lokasi')} (id, nama) VALUES (?, ?)`, [k.id, k.nama || '']);
      }
    }

    // 4. Laporan (khusus landing ini)
    if (Array.isArray(data.laporan)) {
      await conn.query(`DELETE FROM ${tbl(key, 'laporan')}`);
      const seen = new Set();
      const counter = { n: Date.now() };
      for (const l of data.laporan) {
        l.id = uniqueId(l.id, seen, counter);
        await conn.query(
          `INSERT INTO ${tbl(key, 'laporan')}
          (id, no, tanggalMasuk, tanggalKeluar, jumlahAlat, keteranganPerbaikan, jenisAlatId, jenisAlatNama, lokasiDari, kondisi, lamaHari, persenHidup)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            l.id,
            l.no || '',
            l.tanggalMasuk || '',
            l.tanggalKeluar || '',
            parseInt(l.jumlahAlat, 10) || 1,
            l.keteranganPerbaikan || '',
            l.jenisAlatId || null,
            l.jenisAlatNama || '',
            l.lokasiDari || '',
            l.kondisi || 'Lama',
            parseInt(l.lamaHari, 10) || 0,
            (l.persenHidup === undefined || l.persenHidup === null || l.persenHidup === '' || isNaN(parseFloat(l.persenHidup))) ? null : parseFloat(l.persenHidup)
          ]
        );
      }
    }

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    console.error(`Error saat menyimpan ke MySQL [${key}]:`, err.message);
    return false;
  } finally {
    conn.release();
  }
}

function getDatabaseStatus(targetDb = null) {
  const config = getDbConfig();
  if (targetDb) {
    const key = normalizeDbKey(targetDb);
    const info = LANDING_MAP[key];
    return {
      target: key,
      engine: landingStatus[key] ? 'mysql' : 'json',
      connected: !!landingStatus[key],
      host: config.host,
      port: config.port,
      database: config.databases[info.db],
      tablePrefix: info.prefix + '_'
    };
  }

  const statusMap = {};
  DB_KEYS.forEach(k => {
    const info = LANDING_MAP[k];
    statusMap[k] = {
      connected: !!landingStatus[k],
      database: config.databases[info.db],
      tablePrefix: info.prefix + '_'
    };
  });

  return {
    engine: Object.values(landingStatus).some(Boolean) ? 'mysql' : 'json',
    connected: Object.values(landingStatus).some(Boolean),
    host: config.host,
    port: config.port,
    databases: statusMap
  };
}

module.exports = {
  DB_KEYS,
  PARENT_KEYS,
  LANDING_MAP,
  normalizeDbKey,
  initDatabase,
  getDataFromDb,
  saveDataToDb,
  getDatabaseStatus,
  getDbConfig
};
