// Academic calendar monitor (GitHub Actions, daily at minute 37).
// Usage: node monitor/run.mjs <state.json>
//
// - Every day: page-sitemap1.xml only, for the calendar page's lastmod.
// - The calendar page: when lastmod changed, or once a week as a fallback.
// - robots.txt: once a week; every URL is checked against it before fetching.
// - The PDF: HEAD once a week; full download and SHA-256 once a month. The
//   first download is compared with the hash of the PDF the maintainer
//   verified (calendar/latest.json).
// - Any refusal, block or error: no retry in the same run. It is recorded in
//   the state; after 3 failed runs in a row an issue says the monitor is not
//   working.
// - Never edits calendar data. Changes become issues with a diff.

import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  calendarPdfLinks,
  decreeNumbers,
  diffLines,
  isAllowed,
  plan,
  robotsRules,
  rowsIssue,
  sha256Hex,
  shouldCommit,
  simpleIssue,
  sitemapLastmod,
  tableRows,
} from './lib.mjs';

const statePath = process.argv[2];
if (!statePath) throw new Error('usage: node monitor/run.mjs <state.json>');
const config = JSON.parse(readFileSync(new URL('./config.json', import.meta.url), 'utf8'));
const data = JSON.parse(readFileSync(new URL('../calendar/latest.json', import.meta.url), 'utf8'));
const expected = { sk: data.sumber.sk.match(/\d{3,6}\/UN4\.1\/KEP\/\d{4}/)?.[0], pdfUrl: data.sumber.pdf_url, sha256: data.sumber.pdf_sha256, pageUrl: data.sumber.halaman_url };

const now = Date.now();
const nowIso = new Date(now).toISOString();
const before = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { version: 1, issues: {}, consecutiveFailures: 0 };
const state = structuredClone(before);
state.issues ??= {};
state.lastRunAt = nowIso;
const summary = [];
const dryRun = process.env.MONITOR_DRY_RUN === '1';

class Stop extends Error {}

/** One request, honest User-Agent, robots.txt respected, no retry. */
async function get(url, method = 'GET') {
  const { pathname, search } = new URL(url);
  if (state.robots?.rules && !isAllowed(state.robots.rules, `${pathname}${search}`)) throw new Stop(`robots.txt melarang ${pathname}`);
  let response;
  try {
    response = await fetch(url, { method, headers: { 'User-Agent': config.userAgent }, redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new Stop(`${method} ${url}: ${error.name === 'TimeoutError' ? 'timeout' : 'jaringan gagal'}`);
  }
  if (!response.ok) throw new Stop(`${method} ${url}: HTTP ${response.status}`);
  return response;
}

function openIssue(key, issue) {
  if (state.issues[key]) return summary.push(`Issue "${key}" sudah ada (#${state.issues[key]}), tidak dibuat lagi.`);
  if (dryRun) {
    state.issues[key] = 'dry-run';
    return summary.push(`[dry-run] issue: ${issue.title}`);
  }
  const url = execFileSync('gh', ['issue', 'create', '--title', issue.title, '--body', issue.body], { encoding: 'utf8' }).trim();
  state.issues[key] = Number(url.split('/').pop()) || url;
  summary.push(`Issue dibuat: ${url}`);
}

async function run() {
  const due = plan(state, now, config.intervalsDays);

  if (due.robots) {
    const text = await (await get(config.robotsUrl)).text();
    state.robots = { fetchedAt: nowIso, rules: robotsRules(text, config.userAgent) };
    summary.push(`robots.txt dibaca (${state.robots.rules.length} aturan berlaku).`);
  }

  const sitemap = sitemapLastmod(await (await get(config.sitemapUrl)).text(), config.pageLocPattern);
  if (!sitemap) throw new Stop(`halaman kalender tidak ada di ${config.sitemapUrl}`);
  const lastmodBefore = state.sitemap?.lastmod ?? config.verifiedLastmod;
  const lastmodChanged = sitemap.lastmod !== lastmodBefore;
  state.sitemap = { checkedAt: nowIso, loc: sitemap.loc, lastmod: sitemap.lastmod };
  summary.push(`lastmod halaman kalender: ${sitemap.lastmod}${lastmodChanged ? ` (berubah dari ${lastmodBefore})` : ' (sama)'}.`);

  if (lastmodChanged || due.pageFallback) {
    const html = await (await get(sitemap.loc)).text();
    const rows = tableRows(html);
    const sk = decreeNumbers(html);
    const pdfLinks = calendarPdfLinks(html);
    const previous = state.page;
    state.page = { fetchedAt: nowIso, lastmod: sitemap.lastmod, rows, sk, pdfLinks };
    summary.push(`Halaman dibaca: ${rows.length} baris tabel, SK ${sk.join(', ') || '-'}, ${pdfLinks.length} tautan PDF kalender.`);
    if (previous?.rows) {
      const { removed, added } = diffLines(previous.rows, rows);
      if (removed.length + added.length > 0) {
        openIssue(`rows:${sitemap.lastmod}:${added.length}:${removed.length}`, rowsIssue({ lastmodBefore, lastmodAfter: sitemap.lastmod, removed, added, pageUrl: sitemap.loc }));
      }
    } else if (lastmodChanged) {
      openIssue(`lastmod:${sitemap.lastmod}`, simpleIssue('Kalender akademik: halaman Unhas diperbarui sejak verifikasi', [`lastmod sitemap ${sitemap.lastmod}, sedangkan saat verifikasi ${lastmodBefore}.`, `Halaman: ${sitemap.loc}`, 'Belum ada snapshot tabel untuk dibandingkan; snapshot pertama sudah disimpan di branch pantau.']));
    }
    if (expected.sk && sk.length > 0 && !sk.includes(expected.sk)) {
      openIssue(`sk:${sk.join(',')}`, simpleIssue('Kalender akademik: nomor SK di halaman berbeda', [`Data: ${expected.sk}`, `Halaman: ${sk.join(', ')}`]));
    }
    if (pdfLinks.length > 0 && !pdfLinks.includes(expected.pdfUrl)) {
      openIssue(`pdf-url:${pdfLinks.join(',')}`, simpleIssue('Kalender akademik: tautan PDF di halaman berubah', [`Data: ${expected.pdfUrl}`, `Halaman: ${pdfLinks.join(', ')}`]));
    }
  }

  if (due.pdfHead) {
    const response = await get(expected.pdfUrl, 'HEAD');
    const head = { status: response.status, contentLength: response.headers.get('content-length'), lastModified: response.headers.get('last-modified'), etag: response.headers.get('etag') };
    const prev = state.pdfHead;
    state.pdfHead = { checkedAt: nowIso, ...head };
    summary.push(`HEAD PDF: ${head.contentLength ?? '?'} byte, Last-Modified ${head.lastModified ?? '-'}.`);
    if (prev && (prev.contentLength !== head.contentLength || prev.lastModified !== head.lastModified || prev.etag !== head.etag)) {
      openIssue(`pdf-head:${head.etag ?? head.lastModified ?? head.contentLength}`, simpleIssue('Kalender akademik: berkas PDF di situs berubah (HEAD)', [`URL: ${expected.pdfUrl}`, `Sebelumnya: ${JSON.stringify({ ...prev, checkedAt: undefined })}`, `Sekarang: ${JSON.stringify(head)}`]));
    }
  }

  if (due.pdfFull) {
    const bytes = await (await get(expected.pdfUrl)).arrayBuffer();
    const sha = await sha256Hex(bytes);
    const prev = state.pdfFull;
    state.pdfFull = { checkedAt: nowIso, sha256: sha, bytes: bytes.byteLength };
    summary.push(`PDF diunduh: ${bytes.byteLength} byte, SHA-256 ${sha}${sha === expected.sha256 ? ' (sama dengan PDF yang diverifikasi)' : ' (BERBEDA dari PDF yang diverifikasi)'}.`);
    if (!prev && sha !== expected.sha256) {
      openIssue(`pdf-hash-vs-verified:${sha}`, simpleIssue('Kalender akademik: PDF di situs berbeda dari yang diverifikasi', [`URL: ${expected.pdfUrl}`, `Diverifikasi: ${expected.sha256}`, `Di situs: ${sha}`, 'Berkas di situs sudah berubah sejak diunduh untuk verifikasi.']));
    } else if (prev && prev.sha256 !== sha) {
      openIssue(`pdf-hash:${sha}`, simpleIssue('Kalender akademik: isi PDF berubah', [`URL: ${expected.pdfUrl}`, `Sebelumnya: ${prev.sha256}`, `Sekarang: ${sha}`]));
    }
  }
}

try {
  await run();
  state.consecutiveFailures = 0;
  state.lastError = null;
  state.lastSuccessAt = nowIso;
  delete state.issues.failing;
} catch (error) {
  if (!(error instanceof Stop)) throw error;
  state.consecutiveFailures = (state.consecutiveFailures ?? 0) + 1;
  state.lastError = { at: nowIso, message: error.message };
  summary.push(`GAGAL (berhenti tanpa mencoba ulang): ${error.message}. Gagal berturut-turut: ${state.consecutiveFailures}.`);
  if (state.consecutiveFailures >= config.failureIssueAfter) {
    openIssue('failing', simpleIssue('Pemantau kalender tidak berjalan', [`Gagal ${state.consecutiveFailures} run berturut-turut.`, `Terakhir: ${error.message}`, 'Server Unhas mungkin menolak atau memblokir permintaan dari GitHub. Pemantau tidak mencoba ulang dalam satu run.']));
  }
}

const commit = shouldCommit(before, state, now, config.intervalsDays.heartbeat);
if (commit) state.lastCommitAt = nowIso;
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
const text = summary.join('\n');
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Pemantau kalender\n\n${summary.map((s) => `- ${s}`).join('\n')}\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `commit=${commit}\n`);
