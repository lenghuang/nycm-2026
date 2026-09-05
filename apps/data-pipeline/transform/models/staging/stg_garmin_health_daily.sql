MODEL (
  name fitness.stg_garmin_health_daily,
  kind VIEW,
  description 'Garmin daily health metrics. Field names verified against pilot_garmin.py output.'
);

-- TODO: verify exact field names by running scripts/pilot_garmin.py
-- and checking raw_garmin.steps_daily, rhr_daily, body_battery, hrv_daily in DuckDB
SELECT
  s.calendar_date::DATE AS date,
  s.total_steps,
  s.total_distance_meters,
  s.active_calories,
  r.resting_heart_rate    AS resting_hr,
  b.charged               AS body_battery_charged,
  b.drained               AS body_battery_drained,
  h.hrv_weekly_average    AS hrv_weekly_avg,
FROM raw_garmin.steps_daily s
LEFT JOIN raw_garmin.rhr_daily   r ON r.calendar_date = s.calendar_date
LEFT JOIN raw_garmin.body_battery b ON b.calendar_date = s.calendar_date
LEFT JOIN raw_garmin.hrv_daily   h ON h.calendar_date = s.calendar_date
