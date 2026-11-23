# sulo-data

Public data files read by Sulo, the study companion for Unhas students: the remote configuration, the academic calendar and the privacy page.

**Not an official Unhas project.** This repository and Sulo are independent, not affiliated with or endorsed by Universitas Hasanuddin.

[![validate](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml/badge.svg)](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml)

Everything here is served by GitHub Pages at `https://ikrar06.github.io/sulo-data/` and read by installed copies of Sulo. **Changing a file's content or address changes what users get.** Read "Making a change" below first.

## What is here, and who reads it

| File | Read by | What it is |
| --- | --- | --- |
| `config.json` | the extension and the Android app (and the app's background checks) | remote switches and pacing |
| `schema/config.schema.json` | `validate` | the rules `config.json` must follow |
| `calendar/latest.json` | the extension and the Android app | the newest academic year of the calendar |
| `calendar/2026-2027.json` | people, and anything that wants a fixed year | the academic calendar 2026/2027 |
| `calendar/sulo-inti-s1.ics`, `sulo-wisuda.ics`, `sulo-libur-nasional.ics` | Google Calendar and other calendar apps, when a user subscribes | core undergraduate dates, graduations, national holidays |
| `calendar/selisih-2026-2027.md` | people | every difference between the official ICS and this data, with the reason |
| `schema/calendar.schema.json` | `validate` | the rules the calendar files must follow (generated from Sulo's own schema) |
| `privasi.html`, `privacy.html` | people, the store listings, and Sulo's links | the privacy policy, in Indonesian and in English |
| `monitor/` | the monitor workflow | the daily check of the official calendar page |

## config.json

Today's file:

```json
{
  "enabled": true,
  "minIntervalMinutes": 180,
  "message": "",
  "mobile": {
    "backgroundKeepAlive": {
      "enabled": true,
      "dayIntervalMinutes": 20,
      "nightIntervalMinutes": 110,
      "radarEvery": 3
    }
  }
}
```

| Field | Now | Meaning |
| --- | --- | --- |
| `enabled` | `true` | The off switch. `false` stops every request from Sulo to SIKOLA, in the extension and the Android app, and shows `message` instead. |
| `minIntervalMinutes` | `180` | The extension's minimum minutes between automatic checks. It can only slow Sulo down: anything below the built-in 180 is ignored. |
| `message` | `""` | Short plain text (at most 500 characters) shown while `enabled` is `false`. Never rendered as HTML. Empty: Sulo shows its own sentence. |
| `mobile.backgroundKeepAlive.enabled` | `true` | The Android app's background checks ("Pantau tugas baru"), for the users who turned them on. `false` stops them on every phone; the switch in the app's settings turns off and shows `mobile.backgroundKeepAlive.message`. |
| `mobile.backgroundKeepAlive.dayIntervalMinutes` | `20` | Minutes between background checks from 06.00 to 22.59, phone time. Allowed 15 to 110. |
| `mobile.backgroundKeepAlive.nightIntervalMinutes` | `110` | The same from 23.00 to 05.59. Allowed 30 to 110. |
| `mobile.backgroundKeepAlive.radarEvery` | `3` | Course structure checks ride on every n-th daytime check, at most 4 courses each. Allowed 1 to 6. |
| `mobile.backgroundKeepAlive.message` | absent | Optional `{ "id": "...", "en": "..." }`, at most 200 characters each, shown under the switch while it is off. Both languages or none. |
| `mobile.release` | absent, on purpose | A new Android version (below). Left out until the first public release. |

How Sulo reads the file:

- `enabled` and `minIntervalMinutes` are required. Unknown fields are rejected by `validate` (at every level) and ignored by Sulo.
- A file that cannot be fetched, is not valid JSON or does not pass Sulo's own checks changes nothing: Sulo keeps the last good value, or its built-in default (`enabled: true`) if it never had one.
- In `mobile.backgroundKeepAlive`, each number is read on its own: one out of range takes its default (the values above). `enabled` is the exception: if it is there and not `true` or `false`, the whole file counts as invalid, so a broken switch is never read as permission.
- The requests carry nothing about the user: no cookies, no extra headers, no query parameters.

### How fast a change reaches users

GitHub Pages serves the file with `Cache-Control: max-age=600`, so a change is visible to new requests within about 10 minutes of the Pages deploy. After that, it depends on when each copy of Sulo reads the file:

| Where | When it reads `config.json` |
| --- | --- |
| Extension | at most once every 24 hours, at an hour picked by each installation; any hour once 48 hours have passed |
| Android app | when it is opened, if the last read is more than 6 hours old; otherwise once a day |
| Android background checks | the phone reads the file itself at most every 6 hours while background checks are on, without the app being opened |

So `enabled: false` stops the Android background checks within about 6 hours, and every extension within a day or two. Two more limits on the phone: if no read has succeeded for 72 hours, the background checks send nothing to SIKOLA until one does; and if the app has not been opened for 7 days, they stop with one notice.

To switch something off: a pull request that changes `config.json` (see "Making a change"); it takes effect on the next reads above. GitHub's web editor works from a phone too.

### mobile.release

Tells the Android app that a new version exists. It is left out until the first public release, because testers cannot open the download link while the main repository is private. When it is filled in, it sits inside `mobile`, next to `backgroundKeepAlive`:

```json
"release": {
  "versionCode": 10000,
  "versionName": "1.0.0",
  "url": "https://github.com/Ikrar06/sulo/releases/download/v1.0.0/sulo-1.0.0-android.apk",
  "sha256": "<64 hex characters of the APK>",
  "notes": { "id": "...", "en": "..." }
}
```

- A `versionCode` above the installed one shows a card with a Download button that opens `url` in the browser. Sulo never downloads or installs anything itself. Closing the card hides it for 3 days.
- `versionCode` is `major * 10000 + minor * 100 + patch`, so every 0.9.x stays below 1.0.0.
- `url` must be an APK asset of one of Ikrar06's GitHub releases; `sha256` is 64 hex characters; each note is at most 300 characters. One invalid field makes the app ignore the whole section.
- `minVersionCode` (optional, never above `versionCode`) is only for security fixes. Below it the app shows one "update required" screen and sends nothing to SIKOLA until it is updated; the user's data stays.

## Academic calendar

**Unofficial.** Compiled for Sulo from the official documents of Universitas Hasanuddin. **The official document always prevails**; check it for anything important.

- **Source:** Keputusan Rektor No. 08429/UN4.1/KEP/2026, *Kalender Akademik Tahun Akademik 2026/2027*, Direktorat Pendidikan Universitas Hasanuddin ([PDF](https://www.unhas.ac.id/wp-content/uploads/2026/10/kalender-akademik-unhas-2026-2027.pdf)).
- **How it is made:** the ICS from the Unhas calendar page is converted, then corrected and completed from the PDF. Each event says how it was checked (`status_verifikasi`), and every difference from the ICS is listed in [`calendar/selisih-2026-2027.md`](calendar/selisih-2026-2027.md).
- **Coverage:** 1 June 2026 to 30 June 2027, in Asia/Makassar dates. Sulo only accepts a higher `revisi` or a newer academic year.

### Subscribe in Google Calendar

On a computer, next to "Other calendars", click **+**, then **From URL**, and paste one of:

- `https://ikrar06.github.io/sulo-data/calendar/sulo-inti-s1.ics` (core dates for undergraduates)
- `https://ikrar06.github.io/sulo-data/calendar/sulo-wisuda.ics` (graduations)
- `https://ikrar06.github.io/sulo-data/calendar/sulo-libur-nasional.ics` (national holidays)

Google Calendar refreshes subscriptions on its own schedule, sometimes a day later. The feeds hold public dates only.

### The monitor, and the `pantau` branch

`.github/workflows/pantau-kalender.yml` checks the official calendar page once a day (06.37 WITA), politely: it follows `robots.txt`, reads the sitemap daily and the page only when it changed or once a week, and checks the PDF weekly. When it sees a change it **opens an issue with a readable diff**; it never edits the calendar data. Three failed runs in a row also open an issue.

It keeps what it has seen on the **`pantau` branch** (`state.json`), because `main` only accepts changes that pass `validate`, which a bot cannot do. **Do not delete the `pantau` branch**: without it the monitor starts over and reports everything as new.

## Privacy page

- Indonesian: https://ikrar06.github.io/sulo-data/privasi.html
- English: https://ikrar06.github.io/sulo-data/privacy.html

Sulo, its store listings and its first-run guide link to these addresses, so they do not move.

## Making a change

1. A branch and a pull request; nothing is pushed straight to `main`.
2. `validate` must pass before the pull request can be merged. It checks that both schemas are valid, that `config.json` and the calendar files match them, that `calendar/latest.json` is the newest academic year, that the ICS feeds are well formed (line endings, line length, unique ids, no alarms), and runs the monitor's tests.
3. The maintainer, [@Ikrar06](https://github.com/Ikrar06), reviews and merges.

Calendar corrections are welcome as issues or pull requests; please link the official source. This repository never holds personal data: no names, student numbers, grades or anything about one person.

## Links

- Sulo: [Ikrar06/sulo](https://github.com/Ikrar06/sulo) (private for now).
- License: the data here is dedicated to the public domain under [CC0 1.0](LICENSE). The calendar is derived from official documents of Universitas Hasanuddin, which remain authoritative; whether Unhas permits republishing it in this form has not been confirmed yet, and the calendar files will be removed if it objects.
