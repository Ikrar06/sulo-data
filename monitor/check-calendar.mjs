// CI check for the published calendar files (no dependencies):
// latest.json is the newest academic year; every ICS feed is well formed
// (CRLF, lines of at most 75 octets, unique UIDs ending in @sulo, no VALARM).
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../calendar/', import.meta.url);
const files = readdirSync(dir);
const years = files.filter((f) => /^\d{4}-\d{4}\.json$/.test(f)).sort();
const fail = (message) => {
  console.error(`check-calendar: ${message}`);
  process.exitCode = 1;
};
if (years.length === 0) fail('tidak ada berkas tahun ajaran');
const latest = readFileSync(new URL('latest.json', dir), 'utf8');
if (latest !== readFileSync(new URL(years.at(-1), dir), 'utf8')) fail(`latest.json tidak sama dengan ${years.at(-1)}`);

const encoder = new TextEncoder();
for (const name of files.filter((f) => f.endsWith('.ics'))) {
  const text = readFileSync(new URL(name, dir), 'utf8');
  if (!text.startsWith('BEGIN:VCALENDAR\r\n') || !text.endsWith('END:VCALENDAR\r\n')) fail(`${name}: awal atau akhir VCALENDAR salah`);
  if (/[^\r]\n/.test(text)) fail(`${name}: baris tidak diakhiri CRLF`);
  const long = text.split('\r\n').find((l) => encoder.encode(l).length > 75);
  if (long) fail(`${name}: baris lebih dari 75 oktet`);
  const uids = [...text.replace(/\r\n /g, '').matchAll(/^UID:(.*)$/gm)].map((m) => m[1].trim());
  if (new Set(uids).size !== uids.length) fail(`${name}: UID ganda`);
  if (uids.some((u) => !u.endsWith('@sulo'))) fail(`${name}: UID tidak berakhiran @sulo`);
  if (text.includes('BEGIN:VALARM')) fail(`${name}: ada VALARM`);
  console.log(`${name}: ${uids.length} acara`);
}
