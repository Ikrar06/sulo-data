import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarPdfLinks,
  decreeNumbers,
  diffLines,
  isAllowed,
  material,
  plan,
  robotsRules,
  rowsIssue,
  shouldCommit,
  sitemapLastmod,
  tableRows,
} from './lib.mjs';

const intervals = { robots: 7, pageFallback: 7, pdfHead: 7, pdfFull: 30, heartbeat: 7 };
const NOW = Date.parse('2026-11-16T22:37:00Z');
const daysAgo = (n) => new Date(NOW - n * 86_400_000).toISOString();

test('first run fetches everything once; then only the sitemap until each cadence is due', () => {
  assert.deepEqual(plan({}, NOW, intervals), { robots: true, sitemap: true, pageFallback: true, pdfHead: true, pdfFull: true });
  const recent = { robots: { fetchedAt: daysAgo(1) }, page: { fetchedAt: daysAgo(1) }, pdfHead: { checkedAt: daysAgo(1) }, pdfFull: { checkedAt: daysAgo(1) } };
  assert.deepEqual(plan(recent, NOW, intervals), { robots: false, sitemap: true, pageFallback: false, pdfHead: false, pdfFull: false });
  const week = { ...recent, robots: { fetchedAt: daysAgo(7) }, page: { fetchedAt: daysAgo(7) }, pdfHead: { checkedAt: daysAgo(7) } };
  assert.deepEqual(plan(week, NOW, intervals), { robots: true, sitemap: true, pageFallback: true, pdfHead: true, pdfFull: false });
  assert.equal(plan({ ...recent, pdfFull: { checkedAt: daysAgo(30) } }, NOW, intervals).pdfFull, true);
});

test('robots.txt: the Unhas rules allow the sitemap, the calendar page and uploads', () => {
  const text = [
    'User-agent: Bytespider',
    'Disallow: /',
    '',
    'User-agent: *',
    'Disallow: /wp-admin/',
    'Allow: /wp-admin/admin-ajax.php',
    'Disallow: /?s=',
    'Disallow: /*?s=',
    'Disallow: /xmlrpc.php',
    'Disallow: /wp-json/jet-engine/',
  ].join('\n');
  const rules = robotsRules(text, 'sulo-data-monitor (+https://github.com/Ikrar06/sulo-data)');
  assert.equal(isAllowed(rules, '/page-sitemap1.xml'), true);
  assert.equal(isAllowed(rules, '/kalender-akademik/'), true);
  assert.equal(isAllowed(rules, '/wp-content/uploads/2026/10/kalender-akademik-unhas-2026-2027.pdf'), true);
  assert.equal(isAllowed(rules, '/wp-admin/options.php'), false);
  assert.equal(isAllowed(rules, '/wp-admin/admin-ajax.php'), true);
  assert.equal(isAllowed(rules, '/berita/?s=kalender'), false);
  assert.equal(isAllowed(rules, '/xmlrpc.php'), false);
  // Bytespider's block does not apply to the monitor.
  assert.equal(isAllowed(robotsRules(text, 'Bytespider'), '/kalender-akademik/'), false);
});

test('sitemap: lastmod of the calendar page', () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://www.unhas.ac.id/berita/</loc><lastmod>2026-11-01T10:00:00+08:00</lastmod></url>
    <url><loc>https://www.unhas.ac.id/kalender-akademik/</loc><lastmod>2026-10-21T09:53:25+08:00</lastmod></url>
  </urlset>`;
  assert.deepEqual(sitemapLastmod(xml, '/kalender-akademik/'), { loc: 'https://www.unhas.ac.id/kalender-akademik/', lastmod: '2026-10-21T09:53:25+08:00' });
  assert.equal(sitemapLastmod(xml, '/tidak-ada/'), null);
});

test('page: table rows normalised, decree number and PDF link found', () => {
  const html = `<html><script>var x = '<tr><td>a</td><td>b</td></tr>';</script><body>
    <p>Keputusan Rektor No. 08429/UN4.1/KEP/2026</p>
    <a href="https://www.unhas.ac.id/wp-content/uploads/2026/10/kalender-akademik-unhas-2026-2027.pdf?x=1">Unduh PDF</a>
    <a href="/wp-content/uploads/brosur.pdf">Brosur</a>
    <table><tr><th>Tanggal</th><th>Kegiatan</th></tr>
    <tr><td>20 Jul&nbsp;&ndash;&nbsp;14 Agu 2026</td><td>Pengisian KRS <br>daring&#160;Semester Awal</td></tr>
    <tr><td colspan="2">Semester Akhir</td></tr></table></body></html>`;
  assert.deepEqual(tableRows(html), ['Tanggal | Kegiatan', '20 Jul – 14 Agu 2026 | Pengisian KRS daring Semester Awal']);
  assert.deepEqual(decreeNumbers(html), ['08429/UN4.1/KEP/2026']);
  assert.deepEqual(calendarPdfLinks(html), ['https://www.unhas.ac.id/wp-content/uploads/2026/10/kalender-akademik-unhas-2026-2027.pdf']);
});

test('diff and issue text', () => {
  const { removed, added } = diffLines(['a | 1', 'b | 2'], ['a | 1', 'b | 3']);
  assert.deepEqual({ removed, added }, { removed: ['b | 2'], added: ['b | 3'] });
  const issue = rowsIssue({ lastmodBefore: 'x', lastmodAfter: 'y', removed, added, pageUrl: 'https://www.unhas.ac.id/kalender-akademik/' });
  assert.match(issue.body, /- b \| 2\n\+ b \| 3/);
  assert.match(issue.body, /tidak diubah otomatis/);
});

test('commit only on a material change, or a weekly heartbeat', () => {
  const before = { lastRunAt: daysAgo(1), lastCommitAt: daysAgo(1), sitemap: { checkedAt: daysAgo(1), lastmod: 'a' }, consecutiveFailures: 0 };
  const sameButNewerTimes = { ...before, lastRunAt: daysAgo(0), sitemap: { checkedAt: daysAgo(0), lastmod: 'a' } };
  assert.equal(material(before), material(sameButNewerTimes));
  assert.equal(shouldCommit(before, sameButNewerTimes, NOW, 7), false);
  assert.equal(shouldCommit(before, { ...sameButNewerTimes, consecutiveFailures: 1 }, NOW, 7), true);
  assert.equal(shouldCommit({ ...before, lastCommitAt: daysAgo(7) }, sameButNewerTimes, NOW, 7), true);
});
