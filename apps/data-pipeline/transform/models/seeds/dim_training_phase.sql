MODEL (
  name fitness.dim_training_phase,
  kind SEED (
    path '../../seeds/dim_training_phase.csv'
  ),
  columns (
    phase_id   INT,
    phase_name VARCHAR,
    start_date DATE,
    end_date   DATE
  )
);
