// Download counts of Sulo's release files, a row a day. Pure functions:
// what the GitHub API says goes in, text comes out. Nothing about a person
// is read or kept: these are the totals GitHub already shows for each file.

export const KEPALA = 'tanggal,apk_total,apk_tambah,ekstensi_total,ekstensi_tambah';

/** A date as YYYY-MM-DD where the students are (Makassar), from the clock given. */
export function tanggalWita(saat) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(saat);
}

/** The app a release file belongs to, or null for what is not an app (checksums, notes). */
export function jenisBerkas(nama) {
  if (/\.apk$/i.test(nama)) return 'apk';
  if (/\.zip$/i.test(nama)) return 'ekstensi';
  return null;
}

/**
 * Totals over every release, and each file's own count.
 * `rilis` is the body of GET /repos/{owner}/{repo}/releases.
 */
export function jumlahkan(rilis) {
  if (!Array.isArray(rilis)) throw new Error('daftar rilis bukan array');
  const rinci = [];
  for (const r of rilis) {
    for (const a of r?.assets ?? []) {
      const jenis = jenisBerkas(String(a?.name ?? ''));
      const total = a?.download_count;
      if (!jenis) continue;
      if (!Number.isInteger(total) || total < 0) throw new Error(`jumlah unduhan ${a?.name} tidak terbaca`);
      rinci.push({ tag: String(r.tag_name ?? ''), berkas: a.name, jenis, total });
    }
  }
  const jumlah = (jenis) => rinci.filter((b) => b.jenis === jenis).reduce((n, b) => n + b.total, 0);
  return { apk: jumlah('apk'), ekstensi: jumlah('ekstensi'), rinci };
}

function baca(csv) {
  return csv
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && b !== KEPALA)
    .map((b) => {
      const [tanggal, apk, , ekstensi] = b.split(',');
      return { tanggal, apk: Number(apk), ekstensi: Number(ekstensi) };
    })
    .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal) && Number.isFinite(b.apk) && Number.isFinite(b.ekstensi));
}

/**
 * The file with today's row written: a day has one row (a second run on the
 * same day replaces it), and "tambah" is the rise since the row before. The
 * first row has nothing before it, so its rise is its total.
 */
export function catat(csv, tanggal, total) {
  const baris = [...baca(csv).filter((b) => b.tanggal !== tanggal), { tanggal, apk: total.apk, ekstensi: total.ekstensi }].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const teks = baris.map((b, i) => {
    const lalu = baris[i - 1] ?? { apk: 0, ekstensi: 0 };
    // A release that was taken down lowers the total: that is not a negative day.
    return [b.tanggal, b.apk, Math.max(0, b.apk - lalu.apk), b.ekstensi, Math.max(0, b.ekstensi - lalu.ekstensi)].join(',');
  });
  return `${[KEPALA, ...teks].join('\n')}\n`;
}

/** The last rows as a Markdown table, for the run's summary. */
export function ringkasan(csv, banyak = 14) {
  const baris = csv.trim().split('\n').slice(1).slice(-banyak);
  return ['| Tanggal | APK total | APK hari itu | Ekstensi total | Ekstensi hari itu |', '| --- | ---: | ---: | ---: | ---: |', ...baris.map((b) => `| ${b.split(',').join(' | ')} |`)].join('\n');
}
