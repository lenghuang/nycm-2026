MODEL (
  name fitness.stg_garmin_sleep,
  kind VIEW,
  description 'Garmin sleep daily. One row per night. Source: /modern/sleep page interception.'
);

SELECT
  calendar_date::DATE                                          AS date,
  sleep_score,
  sleep_score_quality,
  ROUND(total_sleep_time_in_seconds / 3600.0, 2)             AS sleep_h,
  ROUND(deep_time / 3600.0, 2)                               AS deep_sleep_h,
  ROUND(rem_time / 3600.0, 2)                                AS rem_sleep_h,
  ROUND(light_time / 3600.0, 2)                              AS light_sleep_h,
  ROUND(awake_time / 3600.0, 2)                              AS awake_h,
  ROUND(sleep_need / 60.0, 0)                                AS sleep_need_min,
  resting_heart_rate                                          AS rhr_during_sleep,
  avg_heart_rate                                              AS avg_hr_during_sleep,
  avg_overnight_hrv,
  hrv7d_average,
  hrv_status,
  body_battery_change,
  respiration,
  TO_TIMESTAMP(gmt_sleep_start_time_in_millis / 1000)        AS sleep_start_utc,
  TO_TIMESTAMP(gmt_sleep_end_time_in_millis / 1000)          AS sleep_end_utc,
FROM raw_garmin.sleep_daily
