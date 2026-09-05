MODEL (
  name fitness.stg_garmin_health_daily,
  kind VIEW,
  description 'Garmin daily health metrics. TODO: populate once steps_daily/rhr_daily/body_battery/hrv_daily tables are loaded.'
);

-- Placeholder until the health metric resources are confirmed working.
-- Tables needed: raw_garmin.steps_daily, raw_garmin.rhr_daily,
--                raw_garmin.body_battery, raw_garmin.hrv_daily
SELECT
  NULL::DATE    AS date,
  NULL::INTEGER AS total_steps,
  NULL::INTEGER AS active_calories,
  NULL::INTEGER AS resting_hr,
  NULL::INTEGER AS body_battery_charged,
  NULL::INTEGER AS body_battery_drained,
  NULL::DOUBLE  AS hrv_weekly_avg,
WHERE 1 = 0
