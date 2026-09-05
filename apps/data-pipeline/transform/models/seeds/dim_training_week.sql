MODEL (
  name fitness.dim_training_week,
  kind SEED (
    path '../../seeds/dim_training_week.csv'
  ),
  columns (
    week_num         INT,
    phase_id         INT,
    start_date       DATE,
    end_date         DATE,
    target_run_miles FLOAT,
    notes            VARCHAR
  )
);
