MODEL (
  name fitness.fact_daily,
  kind FULL,
  cron '@daily',
  description 'One row per day. Primary LLM context table. Joins all confirmed sources on date.'
);

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
    MAX(aerobic_te)                      AS aerobic_te,
  FROM fitness.stg_garmin_activities
  WHERE is_run
  GROUP BY 1
),

strength_daily AS (
  SELECT
    session_date,
    COUNT(DISTINCT session_start_ts)    AS strength_sessions,
    SUM(volume_lbs)                     AS total_volume_lbs,
  FROM fitness.stg_hevy_sets
  GROUP BY 1
)

SELECT
  d.date,
  w.week_num                            AS training_week,
  w.phase_id,
  p.phase_name,

  -- sleep (garmin)
  s.sleep_score,
  s.sleep_score_quality,
  s.sleep_h,
  s.deep_sleep_h,
  s.rem_sleep_h,
  s.awake_h,
  s.avg_overnight_hrv,
  s.hrv7d_average,
  s.hrv_status,
  s.body_battery_change,
  s.sleep_start_utc,
  s.sleep_end_utc,

  -- wellness (garmin)
  gh.total_steps,
  gh.total_distance_miles,
  gh.active_calories,
  gh.resting_heart_rate,
  gh.body_battery_charged,
  gh.body_battery_drained,
  gh.avg_stress,

  -- running (garmin activities)
  r.run_miles,
  r.run_minutes,
  r.run_avg_hr,
  r.run_calories,
  r.aerobic_te,

  -- strength (hevy)
  st.strength_sessions,
  st.total_volume_lbs,

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
LEFT JOIN fitness.dim_training_week       w  ON d.date BETWEEN w.start_date AND w.end_date
LEFT JOIN fitness.dim_training_phase      p  ON w.phase_id = p.phase_id
LEFT JOIN fitness.stg_garmin_sleep        s  ON s.date = d.date
LEFT JOIN fitness.stg_garmin_wellness_daily gh ON gh.date = d.date
LEFT JOIN run_daily                       r  ON r.date = d.date
LEFT JOIN strength_daily                  st ON st.session_date = d.date
LEFT JOIN fitness.stg_macrofactor_daily   n  ON n.date = d.date
