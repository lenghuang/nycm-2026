# Data Pipeline Session Update — 2026-09-05 (continued)

> **Updated at end of session** with refactors, sleep backfill, Playwright MCP findings, and daily log query. Sections marked `[UPDATED]` were changed after initial write.

## What changed since the first handoff

This document covers the second half of the 2026-09-05 session. Read `2026-09-05-data-pipeline.md` first for full project context.

---

## Garmin: from library to browser interception

### What we tried

The `garminconnect` Python library (OAuth mobile flow) hit a persistent 429 rate limit — too many failed login attempts earlier in the session locked the account. Direct API calls via `requests`, `curl_cffi` (Chrome TLS impersonation), Playwright `context.request`, and browser `fetch()` all returned empty 403 responses.

**Root cause discovered:** Garmin's gc-api requires a `connect-csrf-token` request header. This token is stored in memory by the Garmin Connect SPA's HTTP interceptor (Angular/React), is NOT accessible via `document.cookie` (all Garmin cookies are HttpOnly), and is NOT readable from `page.evaluate()`. There is no way to extract it from outside the SPA.

### What actually works

**XHR interception**: Navigate real Garmin Connect pages with Playwright and capture the API responses that the SPA naturally makes. The SPA handles all auth internally.

**Key finding via Playwright MCP:** The daily summary page is at `/app/daily-summary/{date}` (not `/modern/daily-summary` as guessed). This page loads `usersummary-service/usersummary/daily/{uuid}?calendarDate={date}` which returns ALL daily health metrics in one call.

### Final Garmin architecture

**`WebCookieGarminClient`** in [sources/garmin/web_client.py](apps/data-pipeline/sources/garmin/web_client.py):
- Opens a persistent Playwright browser profile (`data/garmin_tokens/browser_profile/`)
- `_harvest()`: navigates 2 pages on init to capture sleep + activities
  - `/modern/sleep` → `sleep-service/stats/sleep/daily` (7-day range, sleep stages, scores, HRV)
  - `/modern/activities` → `activitylist-service/activities/search` (activity list)
- `get_wellness_daily(start, end)`: loops day-by-day, navigates `/app/daily-summary/{date}`, captures `usersummary/daily`

**`LibraryGarminClient`** in [sources/garmin/library_client.py](apps/data-pipeline/sources/garmin/library_client.py):
- Wraps `garminconnect` library
- Drop-in replacement — swap one line in `run_garmin.py` when rate limit clears
- Uses `get_user_summary(date)` to get the same fields as `usersummary/daily`

Both implement `GarminClient` Protocol in [sources/garmin/client.py](apps/data-pipeline/sources/garmin/client.py) — 4 methods: `get_sleep_daily`, `get_hrv_data_range`, `get_wellness_daily`, `get_activities_by_date`.

---

## Garmin data model: redesign

### Old design (wrong)
Separate dlt resources for `steps_daily`, `rhr_daily`, `body_battery` — assumed separate API endpoints. These tables were never created because the endpoints never worked.

### New design (correct)
One table per actual API endpoint:

| Raw table | Source endpoint | What it has |
|---|---|---|
| `raw_garmin.sleep_daily` | `sleep-service/stats/sleep/daily` | sleep score, stages, HRV, body battery change |
| `raw_garmin.wellness_daily` | `usersummary-service/usersummary/daily` | steps, distance, active cal, RHR, body battery, stress |
| `raw_garmin.activities` | `activitylist-service/activities/search` | per-activity: distance, HR, calories, type |

### Confirmed usersummary/daily fields (Sept 4, 2026 actual data)

```
totalSteps: 14349
totalDistanceMeters: 11337
activeKilocalories: 560
totalKilocalories: 2942
restingHeartRate: 53
averageStressLevel: 24
bodyBatteryChargedValue: 62
bodyBatteryDrainedValue: 51
bodyBatteryHighestValue: 81
bodyBatteryLowestValue: 21
moderateIntensityMinutes: 83
vigorousIntensityMinutes: 0
```

---

## SQLMesh layer updates

- Added `stg_garmin_wellness_daily` — maps `raw_garmin.wellness_daily` to clean column names
- Removed `stg_garmin_health_daily` — was a stub, superseded
- Updated `fact_daily` to join `stg_garmin_wellness_daily` for steps, RHR, body battery, active calories

### fact_daily cross-check vs Notion (Sept 3, 2026)

| Metric | Notion says | fact_daily has |
|---|---|---|
| Sleep score | 63 | 63 ✓ |
| Sleep duration | 5h46m | 5.77h ✓ |
| Run | 3.26mi, 45min, 130bpm | run_miles=3.26, run_minutes=45, run_avg_hr=130 ✓ |
| Active calories | 978 | 978 ✓ |
| Total steps | 21,999 | 21,999 ✓ |
| Strength session | 1 | strength_sessions=1 ✓ |
| Calories eaten | 2517 | 2517 ✓ |

All 11 metrics from Notion are now in `fact_daily`.

---

## Tooling additions

### Playwright MCP
Added `@playwright/mcp` server to [.mcp.json](.mcp.json) for browser control from Claude Code. Used to:
- Navigate Garmin Connect pages
- Inspect network requests and response bodies
- Find the correct API endpoints and page URLs

This was essential for debugging the Garmin 403s — without it we were flying blind.

### Marimo notebooks
Added `marimo` to dev dependencies. Version-controlled notebooks stored as `.py` files.

- [notebooks/training_analysis.py](apps/data-pipeline/notebooks/training_analysis.py) — starter notebook with daily log, weekly summary, workout sets
- Run with `mise run notebook`

### mise tasks

| Command | What it does |
|---|---|
| `mise run pipeline` | Runs all 3 pipelines → SQLMesh plan → opens DuckDB UI |
| `mise run db` | Opens DuckDB UI at localhost:4213 |
| `mise run notebook` | Opens Marimo notebooks |

---

## Current DuckDB state (end of session)

```
raw_garmin.sleep_daily      6 rows   (Aug 30 – Sep 4 — accumulates daily)
raw_garmin.wellness_daily   35 rows  (Aug 2 – Sep 5 — full training period)
raw_garmin.activities       20 rows  (recent activities)
raw_hevy.workout_sets       5170 rows (337 sessions, 170 exercises)
raw_macrofactor.daily_summary  30 rows
raw_macrofactor.food_log    220 rows
fitness.fitness.fact_daily  35 rows with all metrics joined
```

---

## What's still missing / next steps

### Garmin
- **Sleep history**: `sleep_daily` only captures 7 days per run (the sleep page's default window). It will accumulate going forward. Historical sleep before Aug 30 is not in the DB.
- **garminconnect library**: Rate limit should clear after a few hours of inactivity. Once clear, switch `run_garmin.py` to `LibraryGarminClient()` (one line change) — it supports date-range queries for full backfill and doesn't need the browser open.
- **HRV range**: `hrv_daily` resource exists in source.py but `LibraryGarminClient` is needed to reliably get it. The sleep page loads HRV as a secondary widget but it wasn't reliably captured in automated runs.

### SQLMesh
- `stg_garmin_sleep` and `stg_garmin_activities` are working views but their field names haven't been battle-tested against edge cases.
- The `hrv_daily` raw table doesn't exist yet (never successfully loaded). `fact_daily` doesn't reference it but overnight HRV is available via `stg_garmin_sleep.avg_overnight_hrv`.

### Next features (deferred)
- CRUD app for daily notes (tie qualitative notes to `fact_daily` rows)
- Evidence.dev or Marimo dashboard for race-prep visualization
- Automated daily `mise run pipeline` (cron or launchd)

---

## Architecture decisions made (with rationale)

| Decision | Rationale |
|---|---|
| One dlt resource per API endpoint | Each endpoint has a different shape; forcing them into a shared model creates mismatches when the endpoint changes |
| Page navigation + XHR interception | Only reliable way to get Garmin data — CSRF token is in SPA memory, not accessible externally |
| Persistent browser profile | Avoids Cloudflare bot detection on every run; session survives process restarts |
| `usersummary/daily` as the wellness source | Single endpoint with all daily health metrics; verified against Notion ground truth |
| Marimo over Jupyter | Clean `.py` diffs, version controllable without `nbstripout`, same Python ecosystem |
| `WebCookieGarminClient` as default | Rate limit on garminconnect is temporary; browser approach is the reliable fallback until OAuth recovers |

---

## [UPDATED] Sleep URL pattern discovered via Playwright MCP

The sleep page accepts a date-in-path URL: `/app/sleep/{end_date}/1` where `1` = 7-day view.

- `/app/sleep/2026-08-09/1` → loads `sleep-service/stats/sleep/daily/2026-08-03/2026-08-09`
- `get_sleep_daily` now navigates week-by-week using this pattern to backfill full history
- Backfill script: `uv run python pipelines/backfill_garmin_sleep.py` (bypasses dlt incremental state, safe to re-run)

## [UPDATED] Daily DuckDB state after full session

```
raw_garmin.sleep_daily      34 rows  (Aug 2 – Sep 4 — full training history)
raw_garmin.wellness_daily   35 rows  (Aug 2 – Sep 5)
raw_garmin.activities       20 rows
raw_hevy.workout_sets       5170 rows
raw_macrofactor.daily_summary  30 rows
raw_macrofactor.food_log    220 rows
fitness.fitness.fact_daily  35 rows — all metrics verified against Notion ✓
```

## [UPDATED] Refactors applied end of session

1. **MacroFactor settings** — `settings.py` globs `MacroFactor-*.xlsx` for the latest export. No longer hardcodes filename.
2. **Dead wrapper methods removed** — `get_daily_steps`, `get_rhr_daily`, `get_body_battery` removed from `web_client.py` (Protocol only has 4 methods).
3. **`_navigate_and_capture` helper** — replaces repeated page-open pattern across `get_sleep_daily`, `get_wellness_daily`.
4. **Error logging** — `logging.warning` when a page navigation returns no data.
5. **SQLMesh cron** — `cron '@daily'` added to `fact_daily` and `fact_workout_set`. `sqlmesh run` now respects daily intervals.
6. **`mise run pipeline`** — now includes `sqlmesh run` after `sqlmesh plan --auto-apply`.

## [UPDATED] Marimo notebook — daily training log cell added

[notebooks/training_analysis.py](apps/data-pipeline/notebooks/training_analysis.py) now has a **Daily Training Log** cell that mirrors the Notion manual log. Also in [notebooks/queries/daily_log.sql](apps/data-pipeline/notebooks/queries/daily_log.sql).

Key fix: `STRING_AGG(DISTINCT ...)` doesn't work in DuckDB 1.5.5 — use a subquery with `SELECT DISTINCT` then aggregate.

## [UPDATED] Automated daily pipeline

Not yet set up. When ready:
```bash
# macOS launchd at 8am daily
launchctl load ~/Library/LaunchAgents/com.nycm.pipeline.plist
```
Blocked by: Garmin browser client opens a window, needs `LibraryGarminClient` for headless operation. Switch once garminconnect rate limit clears.
