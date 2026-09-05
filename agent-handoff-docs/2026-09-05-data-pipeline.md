# Data Pipeline Session — 2026-09-05

## Session metadata

| Field | Value |
|---|---|
| Date | 2026-09-05 |
| Agent | Claude Sonnet 4.6 |
| Working directory | `apps/data-pipeline/` |
| Primary goal | Build a personal fitness data pipeline using dlt, DuckDB, and SQLMesh for NYCM 2026 marathon training analysis |

## Project motivation

The user had been manually tracking marathon training in `apps/data-pipeline/Notion.md` — daily logs with sleep scores, workout details, running distance, HR, calories, steps, and weekly reflections. The goal is to automate data collection from three sources so the `fact_daily` table can serve as LLM context without manual effort.

Race day: **Sunday November 2, 2026**, Wave 5, 4:1 run-walk strategy.

## Data sources decided

| Source | Method | Status |
|---|---|---|
| MacroFactor | XLSX export (manual, re-export when needed) | **Working** |
| Hevy | CSV export (manual) | **Working** |
| Garmin Connect | Playwright browser interception (no official API) | **Partially working** |
| Strava | Dropped — Garmin has everything Strava has for metrics | N/A |
| Apple Health | Dropped — 1GB XML, Garmin covers same metrics | N/A |

## Stack decisions

- **dlt** — ingestion layer, loads raw data to DuckDB
- **DuckDB** — local file database (`data/fitness.duckdb`), analytical OLAP, zero ops
- **SQLMesh** — transformation layer (user uses it at work; chosen over dbt deliberately)
- **pydantic-settings** — config/credential management (over scattered `os.getenv`)
- **Playwright** — Garmin data acquisition via browser interception
- **uv** — Python package management with `pyproject.toml`

## Data model

### Canonical grains (in priority order)
1. **Day** — `fact_daily` is the spine and primary LLM context table
2. **Week** — `dim_training_week` with targets from Notion
3. **Phase** — `dim_training_phase` (ankle_recovery → base → build → taper → race)
4. **Individual set** — `fact_workout_set` for strength analysis

### Training phases (seeded from Notion)
| Phase | Dates |
|---|---|
| planning | Aug 2, 2026 |
| ankle_recovery | Aug 3 – Aug 16 |
| base | Aug 17 – Sep 6 |
| build | Sep 7 – Oct 18 |
| taper | Oct 19 – Nov 1 |
| race | Nov 2 |

### Key SQLMesh models
```
raw_macrofactor.daily_summary     → fitness.stg_macrofactor_daily
raw_macrofactor.food_log          → fitness.stg_macrofactor_food_log
raw_hevy.workout_sets             → fitness.stg_hevy_sets
raw_garmin.sleep_daily            → fitness.stg_garmin_sleep      (TODO: field names)
raw_garmin.activities             → fitness.stg_garmin_activities
raw_garmin.steps_daily            → fitness.stg_garmin_health_daily (TODO)
                                  → fitness.fact_daily              (spine)
                                  → fitness.fact_workout_set
fitness.dim_training_phase        (seeded from CSV)
fitness.dim_training_week         (seeded from CSV)
```

## Directory structure

```
apps/data-pipeline/
  pyproject.toml                  uv/pip deps
  .env.example                    copy to .env, add GARMIN_EMAIL / GARMIN_PASSWORD
  .dlt/config.toml                file paths, DuckDB path, Garmin start date
  config/
    settings.py                   GarminSettings, MacroFactorSettings, HevySettings (pydantic-settings)
  sources/
    macrofactor.py                dlt @source — reads XLSX Quick Export + Food Log sheets
    hevy.py                       dlt @source — reads CSV, one row per set
    garmin/
      __init__.py
      client.py                   GarminClient Protocol (interface)
      library_client.py           LibraryGarminClient — wraps garminconnect lib (blocked by 429 rate limit)
      web_client.py               WebCookieGarminClient — Playwright browser interception
      source.py                   dlt @source — takes any GarminClient, 28-day chunking
  pipelines/
    run_macrofactor.py            ✅ working
    run_hevy.py                   ✅ working
    run_garmin.py                 ⚠️  partially working (sleep + activities only)
  scripts/
    pilot_garmin.py               tests garminconnect library auth
    sniff_garmin_endpoints.py     opens browser, intercepts and prints all API URLs
    inspect_garmin_responses.py   navigates pages, prints raw JSON response shapes
    test_garmin_fetch.py          tests direct fetch() calls from browser context
  transform/                      SQLMesh project root
    config.py                     DuckDB connection config
    seeds/
      dim_training_phase.csv
      dim_training_week.csv
    models/
      seeds/    dim_training_phase.sql, dim_training_week.sql
      staging/  stg_macrofactor_daily.sql, stg_macrofactor_food_log.sql,
                stg_hevy_sets.sql, stg_garmin_sleep.sql (TODO),
                stg_garmin_health_daily.sql (TODO), stg_garmin_activities.sql
      marts/    fact_daily.sql, fact_workout_set.sql
  data/
    fitness.duckdb                generated, gitignored
    garmin_tokens/
      browser_profile/            Playwright persistent browser profile (gitignored)
    raw/
      macrofactor/                MacroFactor-20260904232342.xlsx
      hevy/                       workout_data.csv
      garmin/                     Sleep (1).csv (weekly aggregate, not used)
```

## Current DuckDB state

```
raw_macrofactor.daily_summary    30 rows   (Aug 6 – Sep 4, 2026)
raw_macrofactor.food_log         220 rows
raw_hevy.workout_sets            5170 rows (337 sessions, 170 exercises)
raw_garmin.sleep_daily           6 rows    (last 7 days only — page loads 7-day window)
raw_garmin.activities            20 rows   (recent activities)
```

Steps, RHR, body battery, HRV tables: **empty** — those pages didn't load those endpoints during the last run.

## Garmin situation (important context)

### garminconnect library (LibraryGarminClient)
Account is rate-limited (429) from too many failed login attempts during debugging. Do not retry for several hours. The library will work once the lockout clears — tokens will cache in `data/garmin_tokens/` and future runs won't re-authenticate.

### WebCookieGarminClient (current active client)
Uses Playwright to navigate real Garmin Connect pages and intercept XHR responses as the SPA loads them. This works because:
- The SPA's auth layer handles authentication internally
- Direct `fetch()` calls 403 even from inside the browser (SPA uses in-memory tokens not accessible to plain fetch)
- `context.request` in Playwright also 403s (different TLS path)
- Navigation + response interception bypasses all of this

### DDD pattern for Garmin
The `GarminClient` Protocol in `sources/garmin/client.py` defines the interface. Two implementations exist:
- `LibraryGarminClient` — use when garminconnect rate limit clears
- `WebCookieGarminClient` — use now

Swap in `pipelines/run_garmin.py` by changing one line.

### What `WebCookieGarminClient` captures per page

| Garmin page | Metrics captured |
|---|---|
| `/modern/sleep` | sleep_daily (6 days: calendarDate, sleepScore, remTime, deepTime, lightTime, avgOvernightHrv, etc.) |
| `/modern/activities` | activities (20 most recent, flat list) |
| `/modern/wellness` | steps_daily — **not confirmed working yet** |
| `/app/body-battery` | body_battery — **not confirmed working yet** |

HRV and RHR were visible in earlier sniffs loading from the sleep page (as secondary widgets), but weren't captured in the last run. The `inspect_garmin_responses.py` script is the right tool to confirm which pages load which endpoints.

### Known limitation: 7-day sleep window
The `/modern/sleep` page only loads the most recent 7 days. To get historical sleep data, either:
1. Run daily going forward (accumulates over time via `merge` write disposition)
2. Use the sleep page's date navigation — navigate to specific weeks and capture each

## What has NOT been done yet

1. **SQLMesh plan not run** — `cd transform && sqlmesh plan` has never been executed. No transformed tables exist yet. The staging and mart SQL files are written but untested.
2. **Garmin staging models are stubs** — `stg_garmin_sleep.sql` and `stg_garmin_health_daily.sql` have `SELECT *` with TODOs. Field names need to be confirmed from `raw_garmin.sleep_daily` column names in DuckDB before writing proper staging models.
3. **Steps/RHR/body battery/HRV not loading** — The intercept approach works but the right page URLs for those metrics haven't been confirmed yet. Run `inspect_garmin_responses.py` to find them.
4. **fact_daily is incomplete** — Sleep join is commented out pending field name verification. Works for MacroFactor + Hevy columns.
5. **Evidence.dev / dashboard** — Not started. Deferred until SQLMesh models are built.
6. **CRUD app for notes** — Explicitly deferred.

## Recommended next steps

### Immediate (next session)
1. Run `inspect_garmin_responses.py`, navigate to the health stats / body battery / HRV pages, capture the response shapes for the missing metrics
2. Update `web_client.py` with the correct page URLs for steps, RHR, body battery, HRV
3. Run `pipelines/run_garmin.py` to confirm all 6 resources load
4. Check `data/fitness.duckdb` — inspect `raw_garmin.sleep_daily` column names (they'll be camelCase normalized by dlt)
5. Update the two TODO staging models with real column names
6. Run `cd transform && sqlmesh plan` to build the transform layer
7. Query `fitness.fact_daily` to verify the spine works

### When garminconnect rate limit clears
Try `python scripts/pilot_garmin.py`. If it works, switch `run_garmin.py` to `LibraryGarminClient` — it can do proper date-range queries and won't need the browser open.

## MacroFactor data shape

**Quick Export sheet** (30 rows, daily):
`date, expenditure_kcal, trend_weight_lbs, weight_lbs, calories_kcal, protein_g, fat_g, carbs_g, target_*, steps, fiber_g, sodium_mg, caffeine_mg, calcium_mg, iron_mg, vitamin_d_mcg, omega3_g`

**Food Log sheet** (220 rows, per food item):
`date, time, food_name, serving_size, serving_qty, serving_weight_g, calories_kcal, protein_g, fat_g, carbs_g, fiber_g, sodium_mg`

## Hevy data shape

5170 rows, 337 sessions, 170 exercises. One row per set.
`title, start_time, end_time, exercise_title, superset_id, exercise_notes, set_index, set_type (normal/warmup/failure/dropset), weight_lbs, reps, distance_miles, duration_seconds, rpe`

`start_time` format: `"3 Sep 2026, 20:08"` — SQLMesh staging uses `strptime(start_time, '%d %b %Y, %H:%M')`.

## Garmin sleep data shape (confirmed from inspect)

```json
{
  "overallStats": { "averageSleepScore": 77.0, ... },
  "individualStats": [
    {
      "calendarDate": "2026-08-30",
      "values": {
        "sleepScore": 90,
        "remTime": 5160,
        "deepTime": 5040,
        "lightTime": 20100,
        "awakeTime": 0,
        "totalSleepTimeInSeconds": 30300,
        "avgOvernightHrv": 90.0,
        "hrv7dAverage": 78.0,
        "avgHeartRate": 53.0,
        "restingHeartRate": 49,
        "bodyBatteryChange": 79,
        "sleepNeed": 540,
        "respiration": 14.39,
        "hrvStatus": "UNBALANCED",
        "sleepScoreQuality": "EXCELLENT",
        "spO2": null,
        "skinTempF": null,
        "skinTempC": null
      }
    }
  ]
}
```

`get_sleep_daily` flattens `values` into the parent dict, so dlt writes all fields as top-level columns. Primary key and cursor: `calendarDate`.

## Garmin activities data shape (confirmed from inspect)

Flat list. Key fields:
`activityId, activityName, activityType.typeKey, startTimeLocal, duration, distance, calories, averageHR, maxHR, elevationGain, steps`

`typeKey` values seen: `"walking"`, `"running"`, `"fitness_equipment"`, etc.

## Environment setup

```bash
cd apps/data-pipeline
uv sync
cp .env.example .env  # fill in GARMIN_EMAIL, GARMIN_PASSWORD
uv run python pipelines/run_macrofactor.py
uv run python pipelines/run_hevy.py
uv run python pipelines/run_garmin.py  # opens browser, must be logged in
```

VSCode interpreter: `apps/data-pipeline/.venv/bin/python`
Set via `.vscode/settings.json` at repo root.

## Key design decisions made (with rationale)

| Decision | Rationale |
|---|---|
| SQLMesh over dbt | User uses SQLMesh at work — deeper investment compounds faster |
| DuckDB over SQLite/Postgres | OLAP-optimized for analytical queries, local file, native dlt destination |
| Drop Strava | No account yet; Garmin covers all the same metrics |
| Drop Apple Health | 1GB XML unsustainable; Garmin covers same metrics |
| pydantic-settings over os.getenv | Single config contract, type validation, no scattered env reads |
| GarminClient Protocol | Swap implementations without changing pipeline code |
| Navigation interception over direct API | Garmin SPA uses in-memory auth; cookies alone don't work for direct calls |
| Medallion architecture | Explicitly rejected — overkill for single-user project; Kimball staging→marts is sufficient |
| Day as canonical grain | Matches user's Notion manual logs; enables "on days when I slept well, how did my runs go?" |
| fact_daily as LLM context table | One flat row per day is the cleanest format to inject into an LLM prompt |
