-- Daily training log — mirrors the Notion manual log format
-- Run in: mise run notebook  OR  mise run db

WITH workout_notes AS (
  SELECT session_date, STRING_AGG(session_title, ', ' ORDER BY session_title) AS workouts
  FROM (SELECT DISTINCT session_date, session_title FROM fitness.fitness.fact_workout_set)
  GROUP BY 1
)

SELECT
  d.date,
  d.training_week                                           AS week,
  d.phase_name                                              AS phase,

  -- sleep
  d.sleep_score,
  CONCAT(FLOOR(d.sleep_h)::INT, 'h ', ROUND((d.sleep_h % 1) * 60)::INT, 'm') AS sleep,
  ROUND(d.avg_overnight_hrv, 0)::INT                        AS hrv,
  d.body_battery_charged                                    AS bb_charged,
  d.body_battery_drained                                    AS bb_drained,

  -- activity (all day)
  d.total_steps,
  ROUND(d.total_distance_miles, 1)                          AS total_mi,
  d.active_calories,

  -- run
  ROUND(d.run_miles, 2)                                     AS run_mi,
  d.run_avg_hr,

  -- lift
  w.workouts,
  d.strength_sessions,

  -- nutrition
  d.calories_kcal                                           AS eaten_kcal,
  d.protein_g,
  ROUND(d.weight_lbs, 1)                                    AS weight_lbs,

FROM fitness.fitness.fact_daily d
LEFT JOIN workout_notes w ON w.session_date = d.date
WHERE d.date >= '2026-08-02'
ORDER BY d.date DESC;
