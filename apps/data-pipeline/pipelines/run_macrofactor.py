import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dlt
from config.settings import MacroFactorSettings
from sources.macrofactor import macrofactor_source

pipeline = dlt.pipeline(
    pipeline_name="macrofactor",
    destination=dlt.destinations.duckdb("data/fitness.duckdb"),
    dataset_name="raw_macrofactor",
)

if __name__ == "__main__":
    info = pipeline.run(macrofactor_source(settings=MacroFactorSettings()))
    print(info)
