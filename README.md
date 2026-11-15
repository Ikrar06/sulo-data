# sulo-data

Public data files for the Sulo browser extension: the remote configuration today, and the academic calendar later.

Sulo is an unofficial academic companion for Universitas Hasanuddin students. **This repository and the Sulo extension are unofficial and are not affiliated with or endorsed by Universitas Hasanuddin.**

[![validate](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml/badge.svg)](https://github.com/Ikrar06/sulo-data/actions/workflows/validate.yml)

## Contents

| File | Purpose | Status |
|---|---|---|
| `config.json` | Remote kill switch and pacing for the extension | Live |
| `schema/config.schema.json` | JSON Schema for `config.json` | Live |
| `calendar/<academic-year>.json` | Academic calendar, converted by hand from the official PDF | Planned |
| `calendar/<academic-year>.ics` | Subscribable calendar of public academic dates (no personal data) | Planned |

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
- The `main` branch is protected. Every change must pass `validate`, which checks the schema itself and validates `config.json` against it.
- Academic calendar data will be checked twice against the official PDF before it is published. Each file will name its source, revision and date.
- Corrections are welcome as issues or pull requests. Please link the official source.

## Public URLs

Served with GitHub Pages:

- https://ikrar06.github.io/sulo-data/config.json
- https://ikrar06.github.io/sulo-data/schema/config.schema.json

## Main project

The extension lives in [Ikrar06/sulo](https://github.com/Ikrar06/sulo). That repository is private for now and will be opened after talking with the university's system administrators.

## License

The data in this repository is dedicated to the public domain under [CC0 1.0 Universal](LICENSE).

Academic calendar data will be derived from official documents of Universitas Hasanuddin. Each file will always name its source document, and the official document remains authoritative.
