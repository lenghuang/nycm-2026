MODEL (
  name fitness.stg_hevy_sets,
  kind VIEW,
  description 'Hevy workout sets. One row per set. session_date derived from start_time.'
);

SELECT
  strptime(start_time, '%d %b %Y, %H:%M')::DATE AS session_date,
  strptime(start_time, '%d %b %Y, %H:%M')       AS session_start_ts,
  strptime(end_time,   '%d %b %Y, %H:%M')       AS session_end_ts,
  title                                          AS session_title,
  exercise_title,
  superset_id,
  exercise_notes,
  set_index,
  set_type,
  weight_lbs,
  reps,
  ROUND(weight_lbs * reps, 1)                   AS volume_lbs,
  distance_miles,
  duration_seconds,
  rpe,
FROM raw_hevy.workout_sets
