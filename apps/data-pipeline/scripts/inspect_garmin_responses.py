"""Print raw structure of intercepted Garmin API responses from the sleep page."""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from playwright.sync_api import sync_playwright
from sources.garmin.web_client import BROWSER_PROFILE_DIR, CONNECT_URL

KEYWORDS = ["sleep", "hrv", "userstats", "wellnessactivity", "bodyBattery", "steps", "heartRate"]

captured = {}

def on_response(response):
    url = response.url
    if not any(k.lower() in url.lower() for k in KEYWORDS):
        return
    if "web-translations" in url or "images" in url:
        return
    if response.status != 200:
        return
    try:
        data = response.json()
        captured[url] = data
    except Exception as e:
        captured[url] = f"[could not parse JSON: {e}]"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )

    page = context.new_page()
    page.on("response", on_response)
    page.goto(f"{CONNECT_URL}/modern/sleep", wait_until="networkidle")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(5000)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(2000)
    page.close()
    context.close()

print(f"\nCaptured {len(captured)} matching responses:\n")
for url, data in captured.items():
    print(f"\n{'='*70}")
    print(f"URL: {url}")
    print(f"{'='*70}")
    text = json.dumps(data, indent=2, default=str)
    print(text[:1500])
    if len(text) > 1500:
        print("... (truncated)")
