MODEL (
  name fitness.stg_garmin_wellness_daily,
  kind VIEW,
  description 'Garmin daily wellness. Source: usersummary-service/usersummary/daily. One row per day.'
);

SELECT
  calendar_date::DATE           AS date,
  total_steps,
  ROUND(total_distance_meters / 1609.34, 2) AS total_distance_miles,
  active_calories,
  total_calories,
  resting_heart_rate,
  avg_stress,
  body_battery_charged,
  body_battery_drained,
  body_battery_highest,
  body_battery_lowest,
  moderate_intensity_min,
  vigorous_intensity_min,
FROM raw_garmin.wellness_daily
WHERE calendar_date IS NOT NULL
