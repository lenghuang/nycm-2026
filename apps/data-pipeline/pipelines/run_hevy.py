import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dlt
from config.settings import HevySettings
from sources.hevy import hevy_source

pipeline = dlt.pipeline(
    pipeline_name="hevy",
    destination=dlt.destinations.duckdb("data/fitness.duckdb"),
    dataset_name="raw_hevy",
)

if __name__ == "__main__":
    info = pipeline.run(hevy_source(settings=HevySettings()))
    print(info)
