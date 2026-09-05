MODEL (
  name fitness.stg_macrofactor_daily,
  kind VIEW,
  description 'MacroFactor daily nutrition and weight. One row per date.'
);

SELECT
  date::DATE                    AS date,
  calories_kcal::INTEGER        AS calories_kcal,
  target_calories_kcal::INTEGER AS target_calories_kcal,
  expenditure_kcal::INTEGER     AS expenditure_kcal,
  protein_g::FLOAT              AS protein_g,
  fat_g::FLOAT                  AS fat_g,
  carbs_g::FLOAT                AS carbs_g,
  fiber_g::FLOAT                AS fiber_g,
  sodium_mg::FLOAT              AS sodium_mg,
  caffeine_mg::FLOAT            AS caffeine_mg,
  alcohol_g::FLOAT              AS alcohol_g,
  omega3_g::FLOAT               AS omega3_g,
  weight_lbs::FLOAT             AS weight_lbs,
  trend_weight_lbs::FLOAT       AS trend_weight_lbs,
  steps::INTEGER                AS steps_macrofactor,
FROM raw_macrofactor.daily_summary
