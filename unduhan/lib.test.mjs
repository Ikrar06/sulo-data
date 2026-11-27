import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catat, catatJam, halaman, jenisBerkas, jumlahkan, kapan, kenaikan, KEPALA, KEPALA_JAM, ringkasan, tanggalWita, waktuCatatan, waktuWita } from './lib.mjs';

const RILIS = [
  {
    tag_name: 'v1.1.0',
    assets: [
      { name: 'sulo-1.1.0-ios.ipa', download_count: 3 },
      { name: 'sulo-1.1.0-ios.ipa.sha256', download_count: 1 },
    ],
  },
  {
    tag_name: 'v1.0.1',
    assets: [
      { name: 'sulo-1.0.1-android.apk', download_count: 5 },
      { name: 'sulo-1.0.1-ekstensi.zip', download_count: 2 },
    ],
  },
  {
    tag_name: 'v1.0.0',
    assets: [
      { name: 'sulo-1.0.0-android.apk', download_count: 40 },
      { name: 'sulo-1.0.0-android.apk.sha256', download_count: 9 },
      { name: 'sulo-1.0.0-ekstensi.zip', download_count: 30 },
      { name: 'sulo-1.0.0-ekstensi.zip.sha256', download_count: 7 },
    ],
  },
];

test('the date is the day in Makassar, not in UTC', () => {
  assert.equal(tanggalWita(new Date('2026-11-25T15:20:00Z')), '2026-11-25');
  assert.equal(tanggalWita(new Date('2026-11-25T16:00:00Z')), '2026-11-26');
});

test('a file is an app by its ending; checksums are not counted', () => {
  assert.equal(jenisBerkas('sulo-1.0.0-android.apk'), 'apk');
  assert.equal(jenisBerkas('sulo-1.0.0-ekstensi.zip'), 'ekstensi');
  assert.equal(jenisBerkas('sulo-1.0.0-android.apk.sha256'), null);
  assert.equal(jenisBerkas('sulo-1.1.0-ios.ipa'), 'iphone');
  assert.equal(jenisBerkas('sulo-1.1.0-ios.ipa.sha256'), null);
});

test('totals run over every release', () => {
  const t = jumlahkan(RILIS);
  assert.deepEqual([t.apk, t.ekstensi, t.iphone], [45, 32, 3]);
  assert.equal(t.rinci.length, 5);
  assert.deepEqual(jumlahkan([]), { apk: 0, ekstensi: 0, iphone: 0, rinci: [] });
});

test('a count that cannot be read stops the run instead of writing a wrong row', () => {
  assert.throws(() => jumlahkan({ message: 'rate limited' }));
  assert.throws(() => jumlahkan([{ tag_name: 'v1.0.0', assets: [{ name: 'a.apk' }] }]));
});

test('the first row rises by its own total; the next by the difference', () => {
  const satu = catat('', '2026-11-25', { apk: 8, ekstensi: 11, iphone: 0 });
  assert.equal(satu, `${KEPALA}\n2026-11-25,8,8,11,11,0,0\n`);
  const dua = catat(satu, '2026-11-26', { apk: 20, ekstensi: 15, iphone: 4 });
  assert.equal(dua, `${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,20,12,15,4,4,4\n`);
});

test('a second run on the same day replaces that day, and later days follow', () => {
  const awal = `${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,20,12,15,4,0,0\n`;
  assert.equal(catat(awal, '2026-11-26', { apk: 23, ekstensi: 15, iphone: 0 }), `${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,23,15,15,4,0,0\n`);
});

test('a total that went down (a release taken down) is not a negative day', () => {
  const awal = `${KEPALA}\n2026-11-25,40,40,30,30,0,0\n`;
  assert.equal(catat(awal, '2026-11-26', { apk: 12, ekstensi: 31, iphone: 0 }), `${KEPALA}\n2026-11-25,40,40,30,30,0,0\n2026-11-26,12,0,31,1,0,0\n`);
});

test('rows written before the iPhone columns are read with its count at 0, and kept with it', () => {
  const lama = 'tanggal,apk_total,apk_tambah,ekstensi_total,ekstensi_tambah\n2026-11-25,40,40,30,30\n';
  assert.equal(catat(lama, '2026-11-28', { apk: 41, ekstensi: 30, iphone: 2 }), `${KEPALA}\n2026-11-25,40,40,30,30,0,0\n2026-11-28,41,1,30,0,2,2\n`);
});

test('the summary is a table of the last rows', () => {
  const t = ringkasan(`${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,20,12,15,4,3,3\n`, 1);
  assert.match(t, /\| 2026-11-26 \| 20 \| 12 \| 15 \| 4 \| 3 \| 3 \|/);
  assert.doesNotMatch(t, /2026-11-25/);
});

test('the page shows totals, today, the last 7 days, a bar a day and each file', () => {
  const csv = `${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,20,12,15,4,3,3\n`;
  const h = halaman(csv, jumlahkan(RILIS).rinci, '23.20');
  assert.match(h, /\| iPhone \(ipa\) \| \*\*3\*\* \| 3 \| 3 \|/);
  assert.match(h, /\| v1\.1\.0 \| `sulo-1\.1\.0-ios\.ipa` \| 3 \|/);
  assert.match(h, /Diperbarui 26 Nov 2026, 23\.20 WITA/);
  assert.match(h, /\| APK Android \| \*\*20\*\* \| 12 \| 20 \|/);
  assert.match(h, /\| Ekstensi \(zip\) \| \*\*15\*\* \| 4 \| 15 \|/);
  assert.match(h, /26 Nov  █+ 12/);
  assert.match(h, /\| v1\.0\.1 \| `sulo-1\.0\.1-android\.apk` \| 5 \|/);
  // The newest version comes first.
  assert.ok(h.indexOf('v1.1.0') < h.indexOf('v1.0.1') && h.indexOf('v1.0.1') < h.indexOf('v1.0.0'));
});

test('a day without downloads has no bar, and an empty file still makes a page', () => {
  const h = halaman(`${KEPALA}\n2026-11-25,8,8,11,11,0,0\n2026-11-26,8,0,12,1,0,0\n`, [], '23.20');
  assert.match(h, /26 Nov   0/);
  assert.match(halaman('', [], '23.20'), /\| APK Android \| \*\*0\*\* \| 0 \| 0 \|/);
  assert.match(halaman('', [], '23.20'), /\| iPhone \(ipa\) \| \*\*0\*\* \| 0 \| 0 \|/);
});

test('a reading is kept only when a total changed, with the time of the reading before it', () => {
  const satu = catatJam('', '2026-11-25T06:20:00Z', { apk: 8, ekstensi: 11, iphone: 0 });
  assert.equal(satu, `${KEPALA_JAM}\n2026-11-25T06:20:00Z,8,11,,0\n`);
  assert.equal(catatJam(satu, '2026-11-25T07:20:00Z', { apk: 8, ekstensi: 11, iphone: 0 }, '2026-11-25T07:10:00Z'), satu);
  assert.equal(catatJam(satu, '2026-11-25T08:20:00Z', { apk: 11, ekstensi: 11, iphone: 0 }, '2026-11-25T08:10:00Z'), `${satu}2026-11-25T08:20:00Z,11,11,2026-11-25T08:10:00Z,0\n`);
  // An iPhone download alone is a change too.
  assert.equal(catatJam(satu, '2026-11-25T08:20:00Z', { apk: 8, ekstensi: 11, iphone: 1 }, '2026-11-25T08:10:00Z'), `${satu}2026-11-25T08:20:00Z,8,11,2026-11-25T08:10:00Z,1\n`);
  // A time that cannot be the reading before (unreadable, or not earlier) is left out.
  assert.equal(catatJam(satu, '2026-11-25T08:20:00Z', { apk: 11, ekstensi: 11, iphone: 0 }, 'kemarin'), `${satu}2026-11-25T08:20:00Z,11,11,,0\n`);
  assert.equal(catatJam(satu, '2026-11-25T08:20:00Z', { apk: 11, ekstensi: 11, iphone: 0 }, '2026-11-25T09:00:00Z'), `${satu}2026-11-25T08:20:00Z,11,11,,0\n`);
});

test('rows written before the fourth column are still read', () => {
  const lama = 'waktu,apk_total,ekstensi_total\n2026-11-25T07:01:51Z,12,14\n';
  assert.equal(catatJam(lama, '2026-11-25T10:07:00Z', { apk: 30, ekstensi: 15, iphone: 0 }, '2026-11-25T09:57:00Z'), `${KEPALA_JAM}\n2026-11-25T07:01:51Z,12,14,,0\n2026-11-25T10:07:00Z,30,15,2026-11-25T09:57:00Z,0\n`);
  // And the ones with four columns, before the iPhone's.
  const empat = 'waktu,apk_total,ekstensi_total,sejak\n2026-11-25T07:01:51Z,12,14,\n';
  assert.equal(catatJam(empat, '2026-11-25T10:07:00Z', { apk: 12, ekstensi: 14, iphone: 2 }, '2026-11-25T09:57:00Z'), `${KEPALA_JAM}\n2026-11-25T07:01:51Z,12,14,,0\n2026-11-25T10:07:00Z,12,14,2026-11-25T09:57:00Z,2\n`);
});

test('the rises: newest first, the first reading left out, each with the time its old total was last seen', () => {
  const csv = `${KEPALA_JAM}\n2026-11-25T06:20:00Z,8,11,\n2026-11-25T08:20:00Z,11,11,2026-11-25T08:10:00Z\n2026-11-25T15:20:00Z,12,14,\n`;
  assert.deepEqual(kenaikan(csv), [
    // No reading time kept: the row before is the last time the old total was known.
    { waktu: '2026-11-25T15:20:00Z', sejak: '2026-11-25T08:20:00Z', apk: 1, ekstensi: 3, iphone: 0 },
    { waktu: '2026-11-25T08:20:00Z', sejak: '2026-11-25T08:10:00Z', apk: 3, ekstensi: 0, iphone: 0 },
  ]);
  assert.deepEqual(kenaikan(''), []);
  assert.equal(kenaikan(csv, 1).length, 1);
});

test('the time of the last reading comes from the counts file, or nothing', () => {
  assert.equal(waktuCatatan('{"waktu":"2026-11-25T09:57:00Z","apk":12}'), '2026-11-25T09:57:00Z');
  assert.equal(waktuCatatan('{"apk":12}'), '');
  assert.equal(waktuCatatan('{"waktu":"tadi"}'), '');
  assert.equal(waktuCatatan('bukan json'), '');
  assert.equal(waktuCatatan(''), '');
});

test('a rise is named by its reading, or by the span when readings were missed', () => {
  assert.equal(kapan('2026-11-25T08:10:00Z', '2026-11-25T08:20:00Z'), '25 Nov 16.20');
  assert.equal(kapan('', '2026-11-25T08:20:00Z'), '25 Nov 16.20');
  assert.equal(kapan('2026-11-25T07:01:51Z', '2026-11-25T10:07:00Z'), '25 Nov 15.01 sampai 18.07');
  assert.equal(kapan('2026-11-25T15:10:00Z', '2026-11-25T18:05:00Z'), '25 Nov 23.10 sampai 26 Nov 02.05');
});

test('a reading\'s time is shown as the clock in Makassar', () => {
  assert.equal(waktuWita('2026-11-25T06:20:00Z'), '25 Nov 14.20');
  assert.equal(waktuWita('2026-11-25T16:05:00Z'), '26 Nov 00.05');
});

test('the page lists the last readings that saw downloads', () => {
  const jam = `${KEPALA_JAM}\n2026-11-25T06:20:00Z,8,11,\n2026-11-25T08:20:00Z,11,11,2026-11-25T08:10:00Z\n2026-11-25T12:00:00Z,12,11,2026-11-25T09:00:00Z\n`;
  const h = halaman(`${KEPALA}\n2026-11-25,12,12,11,11,0,0\n`, [], '20.00', jam);
  assert.match(h, /\| 25 Nov 16\.20 \| \+3 \|  \|  \|/);
  assert.match(h, /\| 25 Nov 17\.00 sampai 20\.00 \| \+1 \|  \|  \|/);
  assert.match(halaman(`${KEPALA}\n2026-11-25,11,11,11,11,0,0\n`, [], '16.20'), /Belum ada unduhan baru/);
});
