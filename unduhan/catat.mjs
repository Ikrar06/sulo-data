#!/usr/bin/env node
// Writes today's row of download counts. Run by the workflow "unduhan" once a
// day; it reads only the public release list of the Sulo repository.
//
//   node unduhan/catat.mjs <folder that holds unduhan.csv>
//
// UNDUHAN_COBA=1 prints the page it would write and writes nothing.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { catat, halaman, jumlahkan, ringkasan, tanggalWita } from './lib.mjs';

const REPO = 'Ikrar06/sulo';
const folder = process.argv[2];
if (!folder) {
  console.error('unduhan: tulis folder tujuannya, misalnya: node unduhan/catat.mjs data');
  process.exit(1);
}

async function semuaRilis() {
  const semua = [];
  for (let halaman = 1; halaman <= 10; halaman++) {
    const jawab = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${halaman}`, {
      headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
    });
    if (!jawab.ok) throw new Error(`GitHub menjawab ${jawab.status} untuk daftar rilis`);
    const isi = await jawab.json();
    if (!Array.isArray(isi)) throw new Error('daftar rilis bukan array');
    semua.push(...isi);
    if (isi.length < 100) break;
  }
  return semua;
}

try {
  const total = jumlahkan(await semuaRilis());
  const tanggal = tanggalWita(new Date());
  const csvPath = join(folder, 'unduhan.csv');
  const csv = catat(existsSync(csvPath) ? readFileSync(csvPath, 'utf8') : '', tanggal, total);
  const rinci = `${JSON.stringify({ tanggal, apk: total.apk, ekstensi: total.ekstensi, berkas: total.rinci }, null, 2)}\n`;
  const tabel = ringkasan(csv);
  const jam = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  const muka = halaman(csv, total.rinci, jam);
  console.log(`unduhan ${tanggal}: APK ${total.apk}, ekstensi ${total.ekstensi}`);
  if (process.env.UNDUHAN_COBA === '1') {
    console.log(muka);
  } else {
    writeFileSync(csvPath, csv);
    // Each file's own count on the last run (by version).
    writeFileSync(join(folder, 'unduhan.json'), rinci);
    // The page to open: the counts at a glance.
    writeFileSync(join(folder, 'README.md'), muka);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Unduhan Sulo\n\n${tabel}\n`);
  }
} catch (galat) {
  console.error(`unduhan: gagal, tidak ada yang ditulis. ${galat instanceof Error ? galat.message : galat}`);
  process.exit(1);
}
