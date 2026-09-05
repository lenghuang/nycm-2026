MODEL (
  name fitness.fact_workout_set,
  kind FULL,
  description 'One row per strength set. Grain: session + exercise + set_index.'
);

SELECT
  h.session_date,
  h.session_start_ts,
  h.session_title,
  h.exercise_title,
  h.superset_id,
  h.exercise_notes,
  h.set_index,
  h.set_type,
  h.weight_lbs,
  h.reps,
  h.volume_lbs,
  h.distance_miles,
  h.duration_seconds,
  h.rpe,
  w.week_num          AS training_week,
  w.phase_id,
  p.phase_name,
FROM fitness.stg_hevy_sets h
LEFT JOIN fitness.dim_training_week  w ON h.session_date BETWEEN w.start_date AND w.end_date
LEFT JOIN fitness.dim_training_phase p ON w.phase_id = p.phase_id
