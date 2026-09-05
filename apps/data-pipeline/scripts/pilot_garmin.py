"""
Run this before building the garmin pipeline to see the actual response shapes.
Usage: python scripts/pilot_garmin.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
from garminconnect import Garmin

load_dotenv()

TOKEN_DIR = os.path.join(os.path.dirname(__file__), "../data/garmin_tokens")
os.makedirs(TOKEN_DIR, exist_ok=True)

client = Garmin(
    email=os.getenv("GARMIN_EMAIL"),
    password=os.getenv("GARMIN_PASSWORD"),
)
client.login(tokenstore=TOKEN_DIR)
print("Logged in successfully\n")

SAMPLE_DATE = "2026-09-01"
SAMPLE_RANGE_START = "2026-08-28"
SAMPLE_RANGE_END = "2026-09-04"

sections = {
    "sleep_data (single day)": lambda: client.get_sleep_data(SAMPLE_DATE),
    "sleep_daily (range, first 2)": lambda: client.get_sleep_daily(SAMPLE_RANGE_START, SAMPLE_RANGE_END)[:2],
    "daily_steps (range)": lambda: client.get_daily_steps(SAMPLE_RANGE_START, SAMPLE_RANGE_END),
    "rhr_daily (range)": lambda: client.get_rhr_daily(SAMPLE_RANGE_START, SAMPLE_RANGE_END),
    "body_battery (range)": lambda: client.get_body_battery(SAMPLE_RANGE_START, SAMPLE_RANGE_END),
    "hrv_data (single day)": lambda: client.get_hrv_data(SAMPLE_DATE),
    "all_day_stress (single day)": lambda: client.get_all_day_stress(SAMPLE_DATE),
    "activities (last 3)": lambda: client.get_activities(0, 3),
    "user_summary (single day)": lambda: client.get_user_summary(SAMPLE_DATE),
}

for label, fn in sections.items():
    print(f"{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    try:
        result = fn()
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: {e}")
    print()
