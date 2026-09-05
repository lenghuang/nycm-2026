MODEL (
  name fitness.stg_hevy_sets,
  kind VIEW,
  description 'Hevy workout sets. One row per set. session_date derived from start_time.'
);

WITH raw AS (
  SELECT
    title,
    start_time,
    end_time,
    exercise_title,
    superset_id,
    exercise_notes,
    set_index,
    set_type,
    weight_lbs,
    reps,
    distance_miles,
    duration_seconds
  FROM raw_hevy.workout_sets
)

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
  distance_miles,
  duration_seconds,
  ROUND(weight_lbs * reps, 1)                   AS volume_lbs,
FROM raw
