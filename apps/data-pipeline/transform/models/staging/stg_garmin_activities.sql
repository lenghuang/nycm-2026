MODEL (
  name fitness.stg_garmin_activities,
  kind VIEW,
  description 'Garmin activities. One row per recorded activity.'
);

SELECT
  activity_id,
  activity_name,
  activity_type,
  start_time_local::DATE                          AS activity_date,
  start_time_local::TIMESTAMP                     AS activity_start_ts,
  ROUND(duration_seconds / 60.0, 1)              AS duration_minutes,
  ROUND(distance_meters / 1000.0, 2)             AS distance_km,
  ROUND(distance_meters / 1609.34, 2)            AS distance_miles,
  calories,
  avg_hr,
  max_hr,
  aerobic_te,
  anaerobic_te,
  activity_type IN ('running', 'treadmill_running', 'track_running') AS is_run,
  activity_type IN ('fitness_equipment', 'strength_training')        AS is_strength,
  activity_type = 'walking'                                          AS is_walk,
FROM raw_garmin.activities
