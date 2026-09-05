import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dlt
from config.settings import GarminSettings
from sources.garmin import WebCookieGarminClient, LibraryGarminClient, garmin_source

pipeline = dlt.pipeline(
    pipeline_name="garmin",
    destination=dlt.destinations.duckdb("data/fitness.duckdb"),
    dataset_name="raw_garmin",
)

if __name__ == "__main__":
    settings = GarminSettings()

    # Switch to LibraryGarminClient() if garminconnect auth recovers
    client = WebCookieGarminClient(email=settings.email, password=settings.password)
    try:
        info = pipeline.run(garmin_source(client=client, start_date=settings.start_date.isoformat()))
        print(info)
    finally:
        client.close()
