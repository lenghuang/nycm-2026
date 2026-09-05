import marimo

__generated_with = "0.24.0"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    import duckdb
    import pandas as pd

    conn = duckdb.connect("data/fitness.duckdb", read_only=True)
    mo.md("# NYCM 2026 Training Analysis")


@app.cell
def _(conn, mo):
    df = conn.execute("""
        SELECT
            date,
            phase_name,
            training_week,
            sleep_score,
            ROUND(sleep_h, 1)           AS sleep_h,
            avg_overnight_hrv           AS hrv,
            total_steps,
            active_calories,
            resting_heart_rate          AS rhr,
            body_battery_charged,
            run_miles,
            run_avg_hr,
            ROUND(trend_weight_lbs, 1)  AS weight_lbs,
            calories_kcal,
            protein_g
        FROM fitness.fitness.fact_daily
        WHERE date >= '2026-08-02'
        ORDER BY date DESC
        LIMIT 35
    """).df()
    mo.ui.table(df)


@app.cell
def _(conn, mo):
    weekly = conn.execute("""
        SELECT
            w.week_num,
            w.phase_id,
            p.phase_name,
            MIN(d.date)                         AS week_start,
            ROUND(AVG(d.sleep_score), 1)        AS avg_sleep_score,
            ROUND(AVG(d.avg_overnight_hrv), 1)  AS avg_hrv,
            SUM(d.run_miles)                    AS total_run_miles,
            SUM(d.total_steps)                  AS total_steps,
            ROUND(AVG(d.resting_heart_rate), 0) AS avg_rhr,
            ROUND(AVG(d.trend_weight_lbs), 1)   AS avg_weight,
        FROM fitness.fitness.fact_daily d
        JOIN fitness.fitness.dim_training_week w
          ON d.date BETWEEN w.start_date AND w.end_date
        JOIN fitness.fitness.dim_training_phase p
          ON w.phase_id = p.phase_id
        GROUP BY 1, 2, 3
        ORDER BY 1
    """).df()
    mo.md("## Weekly Summary"), mo.ui.table(weekly)


@app.cell
def _(conn, mo):
    sets = conn.execute("""
        SELECT
            session_date,
            session_title,
            exercise_title,
            set_type,
            weight_lbs,
            reps,
            volume_lbs
        FROM fitness.fitness.fact_workout_set
        ORDER BY session_date DESC, session_start_ts, set_index
        LIMIT 100
    """).df()
    mo.md("## Recent Workout Sets"), mo.ui.table(sets)


@app.cell
def _(conn, mo):
    daily_log = conn.execute("""
        WITH workout_notes AS (
          SELECT session_date, STRING_AGG(session_title, ', ' ORDER BY session_title) AS workouts
          FROM (SELECT DISTINCT session_date, session_title FROM fitness.fitness.fact_workout_set)
          GROUP BY 1
        )
        SELECT
          d.date,
          d.training_week                                              AS week,
          d.phase_name                                                 AS phase,
          d.sleep_score,
          CONCAT(FLOOR(d.sleep_h)::INT, 'h ',
                 ROUND((d.sleep_h % 1) * 60)::INT, 'm')               AS sleep,
          ROUND(d.avg_overnight_hrv, 0)::INT                           AS hrv,
          d.body_battery_charged                                       AS bb_chg,
          d.total_steps,
          ROUND(d.total_distance_miles, 1)                             AS total_mi,
          d.active_calories,
          ROUND(d.run_miles, 2)                                        AS run_mi,
          d.run_avg_hr,
          w.workouts,
          ROUND(d.total_volume_lbs, 0)::INT                           AS volume_lbs,
          d.calories_kcal                                              AS eaten_kcal,
          d.protein_g,
          ROUND(d.weight_lbs, 1)                                       AS weight_lbs,
        FROM fitness.fitness.fact_daily d
        LEFT JOIN workout_notes w ON w.session_date = d.date
        WHERE d.date >= '2026-08-02'
        ORDER BY d.date DESC
    """).df()
    mo.md("## Daily Training Log"), mo.ui.table(daily_log)


if __name__ == "__main__":
    app.run()
