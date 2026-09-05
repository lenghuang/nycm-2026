MODEL (
  name fitness.stg_macrofactor_food_log,
  kind VIEW,
  description 'MacroFactor food log. One row per food item logged.'
);

SELECT
  date::DATE           AS date,
  time::VARCHAR        AS time,
  food_name::VARCHAR   AS food_name,
  serving_size::VARCHAR AS serving_size,
  serving_qty::FLOAT   AS serving_qty,
  serving_weight_g::FLOAT AS serving_weight_g,
  calories_kcal::INTEGER  AS calories_kcal,
  protein_g::FLOAT        AS protein_g,
  fat_g::FLOAT            AS fat_g,
  carbs_g::FLOAT          AS carbs_g,
  fiber_g::FLOAT          AS fiber_g,
  sodium_mg::FLOAT        AS sodium_mg,
FROM raw_macrofactor.food_log
