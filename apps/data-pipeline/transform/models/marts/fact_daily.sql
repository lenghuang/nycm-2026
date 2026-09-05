MODEL (
  name fitness.fact_daily,
  kind FULL,
  description 'One row per day. The primary LLM context table. Joins all sources on date.'
);

-- Spine: all dates from training start through today
WITH date_spine AS (
  SELECT UNNEST(
    generate_series(DATE '2026-08-02', CURRENT_DATE, INTERVAL '1 day')
  )::DATE AS date
),

run_daily AS (
  SELECT
    activity_date                        AS date,
    SUM(distance_miles)                  AS run_miles,
    SUM(duration_minutes)                AS run_minutes,
    ROUND(AVG(avg_hr), 0)               AS run_avg_hr,
    SUM(calories)                        AS run_calories,
    SUM(training_load)                   AS training_load,
    MAX(aerobic_te)                      AS aerobic_te,
  FROM fitness.stg_garmin_activities
  WHERE is_run
  GROUP BY 1
)

SELECT
  d.date,
  w.week_num          AS training_week,
  w.phase_id,
  p.phase_name,

  -- sleep (garmin) — field names TBD after pilot
  -- s.sleep_score,
  -- s.sleep_duration_h,
  -- s.deep_sleep_h,
  -- s.rem_sleep_h,

  -- health (garmin)
  gh.total_steps,
  gh.active_calories,
  gh.resting_hr,
  gh.body_battery_charged,
  gh.body_battery_drained,
  gh.hrv_weekly_avg,

  -- running (garmin activities)
  r.run_miles,
  r.run_minutes,
  r.run_avg_hr,
  r.training_load,
  r.aerobic_te,

  -- strength (hevy) — daily summary
  hs.session_count     AS strength_sessions,
  hs.total_volume_lbs,

  -- nutrition (macrofactor)
  n.calories_kcal,
  n.target_calories_kcal,
  n.expenditure_kcal,
  n.protein_g,
  n.carbs_g,
  n.fat_g,
  n.fiber_g,
  n.caffeine_mg,
  n.weight_lbs,
  n.trend_weight_lbs,

FROM date_spine d
LEFT JOIN fitness.dim_training_week  w  ON d.date BETWEEN w.start_date AND w.end_date
LEFT JOIN fitness.dim_training_phase p  ON w.phase_id = p.phase_id
LEFT JOIN fitness.stg_garmin_health_daily gh ON gh.date = d.date
-- LEFT JOIN fitness.stg_garmin_sleep    s  ON s.date = d.date  -- uncomment after pilot
LEFT JOIN run_daily r ON r.date = d.date
LEFT JOIN (
  SELECT
    session_date,
    COUNT(DISTINCT session_start_ts) AS session_count,
    SUM(volume_lbs) AS total_volume_lbs,
  FROM fitness.stg_hevy_sets
  GROUP BY 1
) hs ON hs.session_date = d.date
LEFT JOIN fitness.stg_macrofactor_daily n ON n.date = d.date
