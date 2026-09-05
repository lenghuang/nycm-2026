"""Print the raw structure of intercepted Garmin API responses."""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from playwright.sync_api import sync_playwright
from sources.garmin.web_client import BROWSER_PROFILE_DIR, CONNECT_URL

PAGES = [
    (f"{CONNECT_URL}/modern/sleep", [
        "sleep-service/stats/sleep/daily",
    ]),
    (f"{CONNECT_URL}/modern/daily-summary", [
        "usersummary-service/stats/steps",
        "usersummary-service/stats/heartRate",
        "wellness-service/wellness/bodyBattery",
        "hrv-service/hrv/daily",
    ]),
    (f"{CONNECT_URL}/modern/activities", [
        "activitylist-service/activities/search",
    ]),
]

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )

    for page_url, patterns in PAGES:
        print(f"\n{'#'*70}")
        print(f"# Navigating: {page_url}")
        print(f"{'#'*70}")

        captured = {}

        def make_handler(pats):
            def on_response(response):
                for pat in pats:
                    if pat in response.url and response.status == 200:
                        try:
                            captured[pat] = response.json()
                        except Exception:  # noqa: BLE001
                            pass
            return on_response

        page = context.new_page()
        page.on("response", make_handler(patterns))
        page.goto(page_url, wait_until="networkidle")
        page.close()

        for pat, data in captured.items():
            print(f"\n--- {pat} ---")
            text = json.dumps(data, indent=2, default=str)
            print(text[:2000])
            if len(text) > 2000:
                print("... (truncated)")

    context.close()
