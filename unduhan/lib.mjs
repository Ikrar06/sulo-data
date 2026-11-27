// Download counts of Sulo's release files, a row a day. Pure functions:
// what the GitHub API says goes in, text comes out. Nothing about a person
// is read or kept: these are the totals GitHub already shows for each file.
//
// Three kinds since 1.1.0: the Android APK, the extension zip and the iPhone
// .ipa. The iPhone's columns come last in both files, so rows written before
// it are read as they were (its count there is 0).

export const KEPALA = 'tanggal,apk_total,apk_tambah,ekstensi_total,ekstensi_tambah,iphone_total,iphone_tambah';

/** The kinds counted, in the order they are shown. */
export const JENIS = ['apk', 'ekstensi', 'iphone'];
const NOL = { apk: 0, ekstensi: 0, iphone: 0 };

/** A date as YYYY-MM-DD where the students are (Makassar), from the clock given. */
export function tanggalWita(saat) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(saat);
}

/** The app a release file belongs to, or null for what is not an app (checksums, notes). */
export function jenisBerkas(nama) {
  if (/\.apk$/i.test(nama)) return 'apk';
  if (/\.zip$/i.test(nama)) return 'ekstensi';
  if (/\.ipa$/i.test(nama)) return 'iphone';
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
  return { apk: jumlah('apk'), ekstensi: jumlah('ekstensi'), iphone: jumlah('iphone'), rinci };
}

/** A count cell: a number, or 0 for a column a row was written before. */
const angka = (sel) => (sel === undefined || sel === '' ? 0 : Number(sel));

function baca(csv) {
  return csv
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && !b.startsWith('tanggal,'))
    .map((b) => {
      const [tanggal, apk, , ekstensi, , iphone] = b.split(',');
      return { tanggal, apk: Number(apk), ekstensi: Number(ekstensi), iphone: angka(iphone) };
    })
    .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.tanggal) && JENIS.every((j) => Number.isFinite(b[j])));
}

/** Each kind's rise since the row before; a total that went down (a release taken down) is not a negative day. */
const naik = (b, lalu) => Object.fromEntries(JENIS.map((j) => [j, Math.max(0, b[j] - lalu[j])]));

/**
 * The file with today's row written: a day has one row (a second run on the
 * same day replaces it), and "tambah" is the rise since the row before. The
 * first row has nothing before it, so its rise is its total.
 */
export function catat(csv, tanggal, total) {
  const kini = { tanggal, apk: total.apk, ekstensi: total.ekstensi, iphone: total.iphone ?? 0 };
  const baris = [...baca(csv).filter((b) => b.tanggal !== tanggal), kini].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const teks = baris.map((b, i) => {
    const tambah = naik(b, baris[i - 1] ?? NOL);
    return [b.tanggal, ...JENIS.flatMap((j) => [b[j], tambah[j]])].join(',');
  });
  return `${[KEPALA, ...teks].join('\n')}\n`;
}

/** The last rows as a Markdown table, for the run's summary. */
export function ringkasan(csv, banyak = 14) {
  const semua = baca(csv);
  const awal = Math.max(0, semua.length - banyak);
  return [
    '| Tanggal | APK total | APK hari itu | Ekstensi total | Ekstensi hari itu | iPhone total | iPhone hari itu |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...semua.slice(awal).map((b, i) => {
      const tambah = naik(b, semua[awal + i - 1] ?? NOL);
      return `| ${[b.tanggal, ...JENIS.flatMap((j) => [b[j], tambah[j]])].join(' | ')} |`;
    }),
  ].join('\n');
}

export const KEPALA_JAM = 'waktu,apk_total,ekstensi_total,sejak,iphone_total';

const waktuSah = (teks) => typeof teks === 'string' && !Number.isNaN(Date.parse(teks));

function bacaJam(csv) {
  return csv
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const [waktu, apk, ekstensi, sejak = '', iphone] = b.split(',');
      return { waktu, apk: Number(apk), ekstensi: Number(ekstensi), iphone: angka(iphone), sejak: waktuSah(sejak) ? sejak : '' };
    })
    // The header falls out here too (the ones with three or four columns as well): its first cell is not a time.
    .filter((b) => waktuSah(b.waktu) && JENIS.every((j) => Number.isFinite(b[j])));
}

/**
 * The readings file with this reading added, but only when a total changed
 * since the last one (or there is none yet): GitHub keeps no time for a
 * download, so the time of the reading that first saw it is the nearest
 * there is. `sejak` is the time of the reading before this one, when the old
 * total was last seen: the downloads happened between the two. Times are ISO
 * in UTC.
 */
export function catatJam(csv, waktu, total, sejak = '') {
  const baris = bacaJam(csv);
  const akhir = baris.at(-1);
  const kini = { apk: total.apk, ekstensi: total.ekstensi, iphone: total.iphone ?? 0 };
  if (!akhir || JENIS.some((j) => akhir[j] !== kini[j])) {
    const sebelum = akhir && waktuSah(sejak) && Date.parse(sejak) < Date.parse(waktu) ? sejak : '';
    baris.push({ waktu, ...kini, sejak: sebelum });
  }
  return `${[KEPALA_JAM, ...baris.map((b) => [b.waktu, b.apk, b.ekstensi, b.sejak, b.iphone].join(','))].join('\n')}\n`;
}

/** The time of the last reading, from the counts file it wrote (unduhan.json), or '' when there is none to read. */
export function waktuCatatan(json) {
  try {
    const waktu = JSON.parse(json)?.waktu;
    return waktuSah(waktu) ? waktu : '';
  } catch {
    return '';
  }
}

/**
 * The readings that saw new downloads, newest first: when, how many of each,
 * and since when (the reading before it, or the row before when that time
 * was not kept). The first reading is where counting starts, not a rise.
 */
export function kenaikan(csvJam, banyak = 12) {
  const baris = bacaJam(csvJam);
  return baris
    .slice(1)
    .map((b, i) => ({ waktu: b.waktu, sejak: b.sejak || baris[i].waktu, ...naik(b, baris[i]) }))
    .filter((b) => JENIS.some((j) => b[j] > 0))
    .reverse()
    .slice(0, banyak);
}

/** "25 Nov 14.20" in Makassar, from an ISO time. */
export function waktuWita(iso) {
  const b = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${pendek(`${b.year}-${b.month}-${b.day}`)} ${b.hour}.${b.minute}`;
}

/** Readings are ten minutes apart. Further apart than this, a reading was missed and the hour of a download is not known. */
export const JEDA_TEPAT = 30 * 60_000;

/** When a rise happened: the time it was read, or the span since the reading before when readings were missed. */
export function kapan(sejak, waktu) {
  if (!waktuSah(sejak) || Date.parse(waktu) - Date.parse(sejak) <= JEDA_TEPAT) return waktuWita(waktu);
  const [dari, sampai] = [waktuWita(sejak), waktuWita(waktu)];
  const hari = (teks) => teks.slice(0, teks.lastIndexOf(' '));
  return `${dari} sampai ${hari(dari) === hari(sampai) ? sampai.slice(sampai.lastIndexOf(' ') + 1) : sampai}`;
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pendek = (tanggal) => `${Number(tanggal.slice(8))} ${BULAN[Number(tanggal.slice(5, 7)) - 1]}`;
const batang = (n, terbesar, lebar = 24) => (n > 0 ? '█'.repeat(Math.max(1, Math.round((n / terbesar) * lebar))) : '');

/** Each kind's name in the page. */
const NAMA = { apk: 'APK Android', ekstensi: 'Ekstensi (zip)', iphone: 'iPhone (ipa)' };
const KOLOM = { apk: 'APK', ekstensi: 'Ekstensi', iphone: 'iPhone' };

/**
 * The page a person opens to see the counts at a glance (README.md on the
 * "unduhan" branch): totals, today, the last 7 days, a bar a day, and each
 * file's own count. `jam` is the time of the run in Makassar ("23.23"),
 * `csvJam` the readings file.
 */
export function halaman(csv, rinci, jam, csvJam = '') {
  const baris = baca(csv).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const hari = baris.map((b, i) => {
    const tambah = naik(b, baris[i - 1] ?? NOL);
    return { ...b, apkTambah: tambah.apk, ekstensiTambah: tambah.ekstensi, iphoneTambah: tambah.iphone };
  });
  const akhir = hari.at(-1) ?? { tanggal: '', apk: 0, ekstensi: 0, iphone: 0, apkTambah: 0, ekstensiTambah: 0, iphoneTambah: 0 };
  const tujuh = hari.slice(-7);
  const jumlah = (kunci) => tujuh.reduce((n, h) => n + h[kunci], 0);
  const empatBelas = hari.slice(-14);
  const terbesar = Math.max(1, ...empatBelas.flatMap((h) => JENIS.map((j) => h[`${j}Tambah`])));
  const deret = (kunci) => empatBelas.map((h) => `${pendek(h.tanggal).padStart(6)}  ${batang(h[kunci], terbesar)} ${h[kunci]}`).join('\n');
  const terakhir = kenaikan(csvJam);
  const perVersi = [...rinci].sort((a, b) => b.tag.localeCompare(a.tag, undefined, { numeric: true }) || a.berkas.localeCompare(b.berkas));
  return [
    '# Unduhan Sulo',
    '',
    `Diperbarui ${akhir.tanggal ? pendek(akhir.tanggal) : ''} ${akhir.tanggal.slice(0, 4)}, ${jam} WITA. Dibaca ulang otomatis sekitar tiap 10 menit.`,
    '',
    '| | Total | Hari ini | 7 hari terakhir |',
    '| --- | ---: | ---: | ---: |',
    ...JENIS.map((j) => `| ${NAMA[j]} | **${akhir[j]}** | ${akhir[`${j}Tambah`]} | ${jumlah(`${j}Tambah`)} |`),
    '',
    '## Per hari, 14 hari terakhir',
    '',
    ...JENIS.flatMap((j) => [NAMA[j], '', '```', deret(`${j}Tambah`), '```', '']),
    '## Unduhan terakhir',
    '',
    ...(terakhir.length
      ? [`| Waktu (WITA) | ${JENIS.map((j) => KOLOM[j]).join(' | ')} |`, '| --- | ---: | ---: | ---: |', ...terakhir.map((b) => `| ${kapan(b.sejak, b.waktu)} | ${JENIS.map((j) => (b[j] ? `+${b[j]}` : '')).join(' | ')} |`)]
      : ['Belum ada unduhan baru sejak pencatatan waktu dimulai.']),
    '',
    'GitHub tidak menyimpan waktu tiap unduhan. Totalnya dibaca sekitar tiap 10 menit, jadi unduhan di sebuah baris terjadi tidak lama sebelum waktu yang tertulis. Kalau pembacaan sempat terlewat, baris itu menulis rentangnya.',
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
