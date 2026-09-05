"""
Backfill historical sleep data outside the normal incremental pipeline.
Safe to run multiple times — uses merge write disposition (upsert by calendarDate).

Usage:
    uv run python pipelines/backfill_garmin_sleep.py
    uv run python pipelines/backfill_garmin_sleep.py --start 2026-08-02 --end 2026-09-05
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import dlt
from config.settings import GarminSettings
from sources.garmin.web_client import WebCookieGarminClient

parser = argparse.ArgumentParser()
parser.add_argument("--start", default="2026-08-02")
parser.add_argument("--end", default=None)
args = parser.parse_args()

from datetime import datetime, timezone
end = args.end or datetime.now(tz=timezone.utc).date().isoformat()

pipeline = dlt.pipeline(
    pipeline_name="garmin_sleep_backfill",
    destination=dlt.destinations.duckdb("data/fitness.duckdb"),
    dataset_name="raw_garmin",
)

settings = GarminSettings()
client = WebCookieGarminClient(email=settings.email, password=settings.password)

try:
    print(f"Backfilling sleep from {args.start} to {end}...")
    records = client.get_sleep_daily(args.start, end)
    print(f"  Fetched {len(records)} sleep records")

    info = pipeline.run(
        records,
        table_name="sleep_daily",
        write_disposition="merge",
        primary_key="calendarDate",
    )
    print(info)
finally:
    client.close()
