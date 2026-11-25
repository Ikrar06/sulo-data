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

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pendek = (tanggal) => `${Number(tanggal.slice(8))} ${BULAN[Number(tanggal.slice(5, 7)) - 1]}`;
const batang = (n, terbesar, lebar = 24) => (n > 0 ? '█'.repeat(Math.max(1, Math.round((n / terbesar) * lebar))) : '');

/**
 * The page a person opens to see the counts at a glance (README.md on the
 * "unduhan" branch): totals, today, the last 7 days, a bar a day, and each
 * file's own count. `jam` is the time of the run in Makassar ("23.20").
 */
export function halaman(csv, rinci, jam) {
  const baris = baca(csv).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const hari = baris.map((b, i) => {
    const lalu = baris[i - 1] ?? { apk: 0, ekstensi: 0 };
    return { ...b, apkTambah: Math.max(0, b.apk - lalu.apk), ekstensiTambah: Math.max(0, b.ekstensi - lalu.ekstensi) };
  });
  const akhir = hari.at(-1) ?? { tanggal: '', apk: 0, ekstensi: 0, apkTambah: 0, ekstensiTambah: 0 };
  const tujuh = hari.slice(-7);
  const jumlah = (kunci) => tujuh.reduce((n, h) => n + h[kunci], 0);
  const empatBelas = hari.slice(-14);
  const terbesar = Math.max(1, ...empatBelas.flatMap((h) => [h.apkTambah, h.ekstensiTambah]));
  const deret = (kunci) => empatBelas.map((h) => `${pendek(h.tanggal).padStart(6)}  ${batang(h[kunci], terbesar)} ${h[kunci]}`).join('\n');
  const perVersi = [...rinci].sort((a, b) => b.tag.localeCompare(a.tag, undefined, { numeric: true }) || a.berkas.localeCompare(b.berkas));
  return [
    '# Unduhan Sulo',
    '',
    `Diperbarui ${akhir.tanggal ? pendek(akhir.tanggal) : ''} ${akhir.tanggal.slice(0, 4)}, ${jam} WITA. Dibuat ulang otomatis sekali sehari.`,
    '',
    '| | Total | Hari ini | 7 hari terakhir |',
    '| --- | ---: | ---: | ---: |',
    `| APK Android | **${akhir.apk}** | ${akhir.apkTambah} | ${jumlah('apkTambah')} |`,
    `| Ekstensi (zip) | **${akhir.ekstensi}** | ${akhir.ekstensiTambah} | ${jumlah('ekstensiTambah')} |`,
    '',
    '## Per hari, 14 hari terakhir',
    '',
    'APK Android',
    '',
    '```',
    deret('apkTambah'),
    '```',
    '',
    'Ekstensi (zip)',
    '',
    '```',
    deret('ekstensiTambah'),
    '```',
    '',
    '## Per versi',
    '',
    '| Versi | Berkas | Unduhan |',
    '| --- | --- | ---: |',
    ...perVersi.map((b) => `| ${b.tag} | \`${b.berkas}\` | ${b.total} |`),
    '',
    'Angka ini jumlah unduhan berkas di halaman rilis GitHub, bukan jumlah orang atau pemasangan. Unduhan ulang dan pengambilan otomatis ikut terhitung. Hari pertama memuat semua unduhan sebelum pencatatan dimulai. Riwayat lengkap: `unduhan.csv`.',
    '',
  ].join('\n');
}
