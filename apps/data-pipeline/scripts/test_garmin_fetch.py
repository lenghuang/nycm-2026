"""
Tests Garmin API calls from inside the browser using fetch() — guaranteed to work
if the browser can access the endpoint.
"""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from playwright.sync_api import sync_playwright
from sources.garmin.web_client import BROWSER_PROFILE_DIR, CONNECT_URL

ENDPOINTS = [
    "/gc-api/sleep-service/stats/sleep/daily/2026-08-29/2026-09-05",
    "/gc-api/usersummary-service/stats/heartRate/daily/2026-08-29/2026-09-05",
    "/gc-api/hrv-service/hrv/daily/2026-08-29/2026-09-05",
    "/gc-api/activitylist-service/activities/search/activities?startDate=2026-08-29&endDate=2026-09-05&limit=5",
]

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )
    page = context.new_page()
    page.goto(f"{CONNECT_URL}/modern", wait_until="networkidle")

    # Find the CSRF token from cookies or localStorage
    csrf_token = page.evaluate("""() => {
        // Check cookies
        const cookieMatch = document.cookie.match(/connect-csrf-token=([^;]+)/);
        if (cookieMatch) return cookieMatch[1];
        // Check localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.toLowerCase().includes('csrf')) {
                return localStorage.getItem(key);
            }
        }
        return null;
    }""")
    print(f"CSRF token from page: {csrf_token}")

    # Also dump all cookies to see what's available
    cookies = context.cookies()
    csrf_cookies = [c for c in cookies if 'csrf' in c['name'].lower()]
    print(f"CSRF-related cookies: {csrf_cookies}")

    for endpoint in ENDPOINTS:
        print(f"\n{'='*60}")
        print(f"Testing: {endpoint}")
        result = page.evaluate(f"""async () => {{
            const resp = await fetch('{endpoint}', {{
                headers: {{
                    'NK': 'NT',
                    'Accept': 'application/json',
                    'connect-csrf-token': '{csrf_token or ""}'
                }}
            }});
            const body = await resp.text();
            return {{status: resp.status, body: body.slice(0, 500)}};
        }}""")
        print(f"Status: {result['status']}")
        print(f"Body: {result['body']}")

    context.close()
