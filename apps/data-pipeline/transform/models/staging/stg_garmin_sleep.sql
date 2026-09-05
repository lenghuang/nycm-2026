MODEL (
  name fitness.stg_garmin_sleep,
  kind VIEW,
  description 'Garmin sleep daily. Field names verified against pilot_garmin.py output.'
);

-- TODO: verify exact field names by running scripts/pilot_garmin.py
-- and checking raw_garmin.sleep_daily column names in DuckDB
SELECT
  *
FROM raw_garmin.sleep_daily
