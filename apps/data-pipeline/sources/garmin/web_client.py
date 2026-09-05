from pathlib import Path

from playwright.sync_api import sync_playwright

CONNECT_URL = "https://connect.garmin.com"
BROWSER_PROFILE_DIR = str(Path("data/garmin_tokens/browser_profile"))

# API patterns and which page + interaction loads them
_HARVEST_PAGES = [
    {
        "url": f"{CONNECT_URL}/modern/sleep",
        "patterns": [
            "sleep-service/stats/sleep/daily",
            "hrv-service/hrv/daily",
        ],
    },
    {
        "url": f"{CONNECT_URL}/modern/activities",
        "patterns": ["activitylist-service/activities/search"],
    },
]


class WebCookieGarminClient:
    """Navigates Garmin Connect pages, clicks widgets, intercepts XHR responses."""

    def __init__(self, email: str | None = None, password: str | None = None) -> None:
        self._email = email
        self._password = password
        self._data: dict[str, object] = {}
        self._playwright = sync_playwright().start()
        self._context = self._playwright.chromium.launch_persistent_context(
            user_data_dir=BROWSER_PROFILE_DIR,
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
        )
        self._ensure_logged_in()
        self._harvest()

    def _ensure_logged_in(self) -> None:
        page = self._context.new_page()
        page.goto(f"{CONNECT_URL}/modern", wait_until="networkidle")

        if "sso.garmin.com" in page.url and self._email and self._password:
            try:
                page.fill('input[type="email"], input[name="email"]', self._email)
                page.fill('input[type="password"], input[name="password"]', self._password)
                page.click('button[type="submit"]')
            except Exception:  # noqa: BLE001
                pass

        if "sso.garmin.com" in page.url:
            print("Complete login in the browser window...")
            page.wait_for_url(f"{CONNECT_URL}/**", timeout=120000)

        page.close()

    def _harvest(self) -> None:
        """Navigate all target pages, click widgets, capture API responses."""
        print("Harvesting Garmin data...")
        for spec in _HARVEST_PAGES:
            captured: dict[str, object] = {}

            def on_response(response, pats=spec["patterns"], cap=captured):
                for pat in pats:
                    if pat not in cap and pat in response.url and response.status == 200:
                        try:
                            cap[pat] = response.json()
                        except Exception:  # noqa: BLE001
                            pass

            page = self._context.new_page()
            page.on("response", on_response)
            page.goto(spec["url"], wait_until="networkidle")

            # Scroll to trigger lazy-loaded widgets
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(2000)

            # Try clicking known widget selectors
            for selector in spec.get("clicks", []):
                for sel in selector.split(", "):
                    try:
                        el = page.query_selector(sel.strip())
                        if el:
                            el.click()
                            page.wait_for_timeout(1500)
                            break
                    except Exception:  # noqa: BLE001
                        pass

            page.wait_for_timeout(2000)
            page.close()
            self._data.update(captured)
            print(f"  {spec['url'].split('/')[-1]}: captured {list(captured.keys())}")

    def close(self) -> None:
        self._context.close()
        self._playwright.stop()

    def _get(self, pattern: str) -> object:
        return self._data.get(pattern, {})

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        result = self._get("sleep-service/stats/sleep/daily")
        return [
            {"calendarDate": item["calendarDate"], **item.get("values", {})}
            for item in result.get("individualStats", [])
        ]

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        result = self._get("hrv-service/hrv/daily")
        return result if isinstance(result, list) else result.get("hrv", [])

    def _get_usersummary_for_date(self, date: str) -> dict:
        """Navigate to a specific day's summary and capture usersummary/daily."""
        captured: dict = {}

        def on_response(response, cap=captured):
            if "usersummary-service/usersummary/daily" in response.url and "dailySummariesCount" not in response.url and response.status == 200:
                try:
                    cap["data"] = response.json()
                except Exception:  # noqa: BLE001
                    pass

        page = self._context.new_page()
        page.on("response", on_response)
        page.goto(f"{CONNECT_URL}/app/daily-summary/{date}", wait_until="networkidle")
        page.close()
        return captured.get("data", {})

    def get_wellness_daily(self, start: str, end: str) -> list[dict]:
        """Per-day wellness: steps, active calories, distance, RHR, body battery, stress."""
        from datetime import date, timedelta
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
        results = []
        d = s
        while d <= e:
            summary = self._get_usersummary_for_date(d.isoformat())
            if summary:
                results.append({
                    "calendarDate": summary.get("calendarDate"),
                    "total_steps": summary.get("totalSteps"),
                    "total_distance_meters": summary.get("totalDistanceMeters"),
                    "active_calories": summary.get("activeKilocalories"),
                    "total_calories": summary.get("totalKilocalories"),
                    "resting_heart_rate": summary.get("restingHeartRate"),
                    "avg_stress": summary.get("averageStressLevel"),
                    "body_battery_charged": summary.get("bodyBatteryChargedValue"),
                    "body_battery_drained": summary.get("bodyBatteryDrainedValue"),
                    "body_battery_highest": summary.get("bodyBatteryHighestValue"),
                    "body_battery_lowest": summary.get("bodyBatteryLowestValue"),
                    "moderate_intensity_min": summary.get("moderateIntensityMinutes"),
                    "vigorous_intensity_min": summary.get("vigorousIntensityMinutes"),
                })
            d += timedelta(days=1)
        return results

    def get_daily_steps(self, start: str, end: str) -> list[dict]:
        return self.get_wellness_daily(start, end)

    def get_rhr_daily(self, start: str, end: str) -> list[dict]:
        return self.get_wellness_daily(start, end)

    def get_body_battery(self, start: str, end: str) -> list[dict]:
        return self.get_wellness_daily(start, end)

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        result = self._get("activitylist-service/activities/search")
        return result if isinstance(result, list) else []
