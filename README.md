# sulo-data

Public data files for the Sulo browser extension: the remote configuration and the Universitas Hasanuddin academic calendar 2026/2027.

Sulo is an unofficial academic companion for Universitas Hasanuddin students. **This repository and the Sulo extension are unofficial and are not affiliated with or endorsed by Universitas Hasanuddin.**

[![validate](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml/badge.svg)](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml)

## Contents

| File | Purpose | Status |
|---|---|---|
| `config.json` | Remote kill switch and pacing for the extension | Live |
| `schema/config.schema.json` | JSON Schema for `config.json` | Live |
| `calendar/2026-2027.json` | Academic calendar 2026/2027 (revision 1), from the official ICS, corrected from the official PDF | Live |
| `calendar/latest.json` | Same as the newest academic year; the extension reads this one | Live |
| `calendar/sulo-inti-s1.ics` | Subscribable feed: core dates for undergraduates (KRS, lectures, UTS, UAS, breaks, grades, evaluations, KKN, deadlines) | Live |
| `calendar/sulo-wisuda.ics` | Subscribable feed: the nine graduation periods | Live |
| `calendar/sulo-libur-nasional.ics` | Subscribable feed: national holidays and joint leave days as listed in the calendar PDF | Live |
| `calendar/selisih-2026-2027.md` | Every difference between the official ICS and this data, with the reason | Live |
| `schema/calendar.schema.json` | JSON Schema for the calendar files (generated from the extension's Zod schema) | Live |
| `monitor/` | Daily monitor of the official calendar page (see below) | Live |

## config.json

```json
{
  "enabled": true,
  "minIntervalMinutes": 180,
  "message": ""
}
```

| Field | Type | Allowed values | Effect in the extension |
|---|---|---|---|
| `enabled` | boolean | `true` or `false` | `false` is a kill switch: every installation stops all requests to SIKOLA and shows `message` instead. `true` resumes normal operation |
| `minIntervalMinutes` | integer | `0` or more | Minimum minutes between background syncs. It can only slow Sulo down. Values below the built-in 180 minutes are ignored |
| `message` | string | Up to 500 characters, optional, default empty | Short plain-text note in Indonesian, shown to users while `enabled` is `false`. Never rendered as HTML |

Unknown fields are rejected by the schema in this repository, and ignored by the extension.

### mobile.release (Android app)

The Android app reads this same file, so announcing a version costs no extra request. Example:

```json
"mobile": {
  "release": {
    "versionCode": 906,
    "versionName": "0.9.6",
    "url": "https://github.com/Ikrar06/sulo/releases/download/v0.9.6/sulo-0.9.6-android.apk",
    "sha256": "<64 hex characters of the APK>",
    "minVersionCode": 0,
    "notes": { "id": "Pengingat lebih tepat waktu.", "en": "Reminders on time more often." }
  }
}
```

- A `versionCode` above the installed one shows a calm card with a Download button that opens `url` in the browser. Sulo never downloads or installs anything itself. Closing the card hides it for 3 days.
- `versionCode` is `major * 10000 + minor * 100 + patch`, so 0.9.x stays below 1.0.0.
- `url` must be an APK asset of one of Ikrar06's GitHub releases. Any invalid field makes the app ignore the whole section.
- `minVersionCode` is only for security fixes. Below it, the app shows one "update required" screen and sends nothing to SIKOLA until updated, and user data stays. It is never above `versionCode`.

## Academic calendar 2026/2027

**Unofficial.** Compiled by Sulo, not by Universitas Hasanuddin. The official document always prevails; please check it for anything important.

- **Source:** Keputusan Rektor No. 08429/UN4.1/KEP/2026, *Kalender Akademik Tahun Akademik 2026/2027*, Direktorat Pendidikan Universitas Hasanuddin ([PDF](https://www.unhas.ac.id/wp-content/uploads/2026/10/kalender-akademik-unhas-2026-2027.pdf), [page](https://www.unhas.ac.id/kalender-akademik/?lang=id)). SHA-256 of the PDF used: `e778ecddb0833418d2a0547f0872fca09d6ed1ef4676880175904aea6bd8155b`.
- **Verified:** 16 November 2026, every event checked against the PDF by the maintainer. Each event carries `status_verifikasi`: `cocok_ics_pdf` (ICS and PDF agree), `cocok_pdf` (only in the PDF), `cocok_skb` (holiday checked against the joint ministerial decree), `perlu_cek` (unclear in the source, see `catatan`).
- **How it is made:** the ICS from the Unhas page is converted, then corrected and completed from the PDF with a reviewed override file (in the extension's repository). Every difference between the ICS and this data, with the reason, is listed in [`calendar/selisih-2026-2027.md`](calendar/selisih-2026-2027.md).
- **Coverage:** 1 June 2026 to 30 June 2027. Dates are inclusive local dates (Asia/Makassar); the ICS feeds use exclusive end dates as RFC 5545 requires.
- **Not yet known:** the first lecture day of the even semester for S1, so teaching weeks of that semester are `null`.

### Subscribe in Google Calendar

1. Open Google Calendar on a computer.
2. Next to "Other calendars", click **+**, then **From URL**.
3. Paste one of these addresses and click **Add calendar**:
   - Core dates for S1: `https://ikrar06.github.io/sulo-data/calendar/sulo-inti-s1.ics`
   - Graduation: `https://ikrar06.github.io/sulo-data/calendar/sulo-wisuda.ics`
   - National holidays: `https://ikrar06.github.io/sulo-data/calendar/sulo-libur-nasional.ics`

Google Calendar refreshes subscribed calendars on its own schedule, which can take several hours to a day. The feeds contain public academic dates only, never anything personal. Events have stable ids, so a new revision updates them instead of duplicating them.

### Monitor

`.github/workflows/pantau-kalender.yml` runs daily at minute 37 (06:37 WITA) with the User-Agent `sulo-data-monitor (+https://github.com/Ikrar06/sulo-data)` and follows `robots.txt`:

- every day it reads only `page-sitemap1.xml`, for the `lastmod` of the calendar page
- it reads the calendar page only when `lastmod` changed, or once a week as a fallback
- it sends a HEAD request for the PDF once a week, and downloads it for a SHA-256 once a month (the first download is compared with the verified hash above)
- if the server refuses, blocks or fails, it does not retry in that run; after 3 failed runs in a row it opens an issue
- changes become issues with a readable diff; **calendar data is never changed automatically**

Its state is kept on the `pantau` branch (`state.json`), committed when something changed and at least once a week.

## How the extension uses this repository

- Sulo fetches each file at most once a day.
- The request carries nothing that identifies the user: no cookies, no extra headers, no query parameters.
- Files are data only and never code. The extension validates each file against its schema before using it.
- If a file cannot be fetched or is invalid, the extension keeps the last valid value. If it has none yet, it uses its built-in default (`enabled: true`).
- These requests do not count against Sulo's daily request budget for SIKOLA, because they do not go to SIKOLA.

## No personal data

This repository never contains personal data: no names, student numbers, grades, schedules of individual students or anything else about a person. Only public, general information belongs here. The subscribable calendar will contain public academic dates only. Personal calendars (assignments, class schedules) are generated locally inside the extension and are never hosted anywhere.

## Changes and review

- Only the maintainer, [@Ikrar06](https://github.com/Ikrar06), can change the data.
- The `main` branch is protected: pull requests must pass `validate` before they can be merged. `validate` checks both schemas, validates `config.json` and the calendar files, checks the ICS feeds, and runs the monitor's tests. The maintainer may push directly, and those pushes run `validate` too.
- Academic calendar data is checked against the official PDF before it is published. Each file names its source, revision and verification date. A new revision raises `revisi`; the extension only accepts a higher revision or a newer academic year.
- Corrections are welcome as issues or pull requests. Please link the official source.

## Public URLs

Served with GitHub Pages:

- https://ikrar06.github.io/sulo-data/config.json
- https://ikrar06.github.io/sulo-data/schema/config.schema.json
- https://ikrar06.github.io/sulo-data/calendar/latest.json
- https://ikrar06.github.io/sulo-data/calendar/2026-2027.json
- https://ikrar06.github.io/sulo-data/calendar/sulo-inti-s1.ics
- https://ikrar06.github.io/sulo-data/calendar/sulo-wisuda.ics
- https://ikrar06.github.io/sulo-data/calendar/sulo-libur-nasional.ics
- https://ikrar06.github.io/sulo-data/schema/calendar.schema.json

## Main project

The extension lives in [Ikrar06/sulo](https://github.com/Ikrar06/sulo). That repository is private for now and will be opened after talking with the university's system administrators.

## License

The data in this repository is dedicated to the public domain under [CC0 1.0 Universal](LICENSE).

Academic calendar data is derived from official documents of Universitas Hasanuddin. Each file names its source document, and the official document remains authoritative. Whether Unhas permits republishing its calendar in this form has not been confirmed yet; if it objects, the calendar files will be taken down.
