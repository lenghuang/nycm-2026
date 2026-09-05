from sqlmesh.core.config import Config, ModelDefaultsConfig
from sqlmesh.core.config.connection import DuckDBConnectionConfig

config = Config(
    connections={"duckdb": DuckDBConnectionConfig(database="../data/fitness.duckdb")},
    default_connection="duckdb",
    model_defaults=ModelDefaultsConfig(dialect="duckdb"),
)
