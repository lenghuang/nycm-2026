"""
Opens Garmin Connect and logs all API calls made by the browser.
Navigate to the Sleep, Activities, and Health Stats pages while this runs.
Press Ctrl+C when done — endpoint URLs will be printed.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from playwright.sync_api import sync_playwright
from sources.garmin.web_client import BROWSER_PROFILE_DIR, CONNECT_URL

captured = []

def on_request(request):
    url = request.url
    if any(x in url for x in ["garmin.com/", "connectapi"]):
        if any(x in url for x in ["sleep", "steps", "heart", "battery", "hrv", "activity", "wellness", "stress"]):
            captured.append(f"{request.method} {url}")

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )
    page = context.new_page()
    page.on("request", on_request)
    page.goto(f"{CONNECT_URL}/modern", wait_until="networkidle")

    print("Browser open. Navigate to Sleep, Health Stats, and Activities pages.")
    print("Press Enter when done to see captured endpoints...")
    input()
    context.close()

print("\n=== Captured Garmin API Endpoints ===")
for url in sorted(set(captured)):
    print(url)
