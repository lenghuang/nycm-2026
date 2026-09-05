"""
Navigate to the Garmin sleep page and print the FULL request headers
the SPA sends for gc-api calls. This shows what auth headers we're missing.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from playwright.sync_api import sync_playwright
from sources.garmin.web_client import BROWSER_PROFILE_DIR, CONNECT_URL

captured_headers = {}

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )

    page = context.new_page()

    def intercept(route):
        if "gc-api" in route.request.url and "sleep" in route.request.url:
            captured_headers.update(dict(route.request.headers))
        route.continue_()

    page.route("**/*", intercept)
    page.goto(f"{CONNECT_URL}/modern/sleep", wait_until="networkidle")
    page.wait_for_timeout(3000)
    page.close()
    context.close()

print("\n=== Headers sent by Garmin SPA for gc-api/sleep request ===\n")
for k, v in sorted(captured_headers.items()):
    print(f"  {k}: {v}")
