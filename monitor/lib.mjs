// Pure parts of the academic calendar monitor: parsing, scheduling, diffs and
// issue text. No network, no file system; run.mjs does the I/O.
// The monitor never edits calendar data. It only opens issues with a diff.

const DAY = 86_400_000;

/** Days since an ISO time; Infinity when never. */
export function daysSince(iso, now) {
  return iso ? (now - Date.parse(iso)) / DAY : Infinity;
}

/** What this run should fetch (the sitemap always; the rest on their own cadence). */
export function plan(state, now, intervals) {
  return {
    robots: daysSince(state.robots?.fetchedAt, now) >= intervals.robots,
    sitemap: true,
    pageFallback: daysSince(state.page?.fetchedAt, now) >= intervals.pageFallback,
    pdfHead: daysSince(state.pdfHead?.checkedAt, now) >= intervals.pdfHead,
    pdfFull: daysSince(state.pdfFull?.checkedAt, now) >= intervals.pdfFull,
  };
}

// ---------- robots.txt ----------

/** Allow/Disallow rules that apply to `token` (its own group, else "*"). */
export function robotsRules(text, token) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow')) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  const own = groups.filter((g) => g.agents.some((a) => a !== '*' && token.toLowerCase().includes(a)));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules).filter((r) => r.path !== '');
}

function ruleRegex(path) {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, (c) => (c === '$' ? '$' : `\\${c}`)).replace(/\*/g, '.*');
  return new RegExp(`^${escaped.endsWith('$') ? escaped : escaped}`);
}

/** Longest matching rule wins; Allow wins a tie (RFC 9309). */
export function isAllowed(rules, pathAndQuery) {
  let best = null;
  for (const rule of rules) {
    if (!ruleRegex(rule.path).test(pathAndQuery)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

// ---------- sitemap and page ----------

/** lastmod of the first <url> whose <loc> contains `pattern`. */
export function sitemapLastmod(xml, pattern) {
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(block)?.[1];
    if (loc && loc.includes(pattern)) return { loc, lastmod: /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(block)?.[1] ?? null };
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘' };

export function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const cellText = (html) => decodeEntities(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/** Every table row with at least two non-empty cells, as "cell | cell". */
export function tableRows(html) {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  const rows = [];
  for (const tr of clean.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(cellText).filter(Boolean);
    if (cells.length >= 2) rows.push(cells.join(' | '));
  }
  return rows;
}

/** Decree numbers like 08429/UN4.1/KEP/2026. */
export function decreeNumbers(html) {
  return [...new Set(decodeEntities(html).match(/\b\d{3,6}\/UN4\.1\/KEP\/\d{4}\b/g) ?? [])].sort();
}

/** Links to calendar PDFs on the page. */
export function calendarPdfLinks(html) {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+\.pdf)(?:[?#][^"']*)?["']/gi)].map((m) => decodeEntities(m[1]));
  return [...new Set(links.filter((l) => /kalender/i.test(l)))].sort();
}

export function diffLines(before, after) {
  const a = new Set(before);
  const b = new Set(after);
  return { removed: before.filter((x) => !b.has(x)), added: after.filter((x) => !a.has(x)) };
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- state ----------

/** Fields that change every run and alone never justify a commit. */
const VOLATILE = new Set(['lastRunAt', 'checkedAt', 'fetchedAt', 'lastCommitAt', 'lastSuccessAt']);

export function material(state) {
  return JSON.stringify(state, (key, value) => (VOLATILE.has(key) ? undefined : value));
}

/** Commit when something material changed, or once a week as a heartbeat (keeps the schedule alive). */
export function shouldCommit(before, after, now, heartbeatDays) {
  return material(before) !== material(after) || daysSince(before.lastCommitAt, now) >= heartbeatDays;
}

// ---------- issues ----------

const fence = (lines) => ['```diff', ...lines, '```'].join('\n');

export function rowsIssue({ lastmodBefore, lastmodAfter, removed, added, pageUrl }) {
  return {
    title: 'Kalender akademik: isi tabel di halaman Unhas berubah',
    body: [
      `Halaman: ${pageUrl}`,
      `lastmod sitemap: ${lastmodBefore ?? '-'} -> ${lastmodAfter ?? '-'}`,
      '',
      'Baris yang berubah (normalisasi: sel tabel dipisah " | "):',
      '',
      fence([...removed.map((r) => `- ${r}`), ...added.map((r) => `+ ${r}`)]),
      '',
      'Data kalender tidak diubah otomatis. Periksa terhadap PDF resmi, lalu perbarui berkas override dan naikkan revisi bila perlu.',
    ].join('\n'),
  };
}

export function simpleIssue(title, lines) {
  return { title, body: [...lines, '', 'Data kalender tidak diubah otomatis. Pemantau hanya melapor.'].join('\n') };
}
