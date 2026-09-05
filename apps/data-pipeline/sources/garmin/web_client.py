import logging
from datetime import date, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

log = logging.getLogger(__name__)

CONNECT_URL = "https://connect.garmin.com"
BROWSER_PROFILE_DIR = str(Path("data/garmin_tokens/browser_profile"))

_HARVEST_PAGES = [
    {
        "url": f"{CONNECT_URL}/modern/sleep",
        "patterns": ["sleep-service/stats/sleep/daily", "hrv-service/hrv/daily"],
    },
    {
        "url": f"{CONNECT_URL}/modern/activities",
        "patterns": ["activitylist-service/activities/search"],
    },
]


class WebCookieGarminClient:
    """Navigates Garmin Connect pages and intercepts XHR responses.
    Browser opens on construction; call close() when done."""

    def __init__(self, email: str | None = None, password: str | None = None) -> None:
        self._email = email
        self._password = password
        self._harvested: dict[str, object] = {}
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
        """Navigate harvest pages and capture XHR responses the SPA naturally makes."""
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
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(2000)
            page.close()
            self._harvested.update(captured)
            print(f"  {spec['url'].split('/')[-1]}: captured {list(captured.keys())}")

    def close(self) -> None:
        self._context.close()
        self._playwright.stop()

    def _navigate_and_capture(self, url: str, pattern: str) -> dict:
        """Navigate to url and return first JSON response matching pattern."""
        captured: dict = {}

        def on_response(response, cap=captured):
            if pattern in response.url and response.status == 200:
                try:
                    cap["data"] = response.json()
                except Exception:  # noqa: BLE001
                    pass

        page = self._context.new_page()
        page.on("response", on_response)
        page.goto(url, wait_until="networkidle")
        page.close()

        if not captured:
            log.warning("No response captured for pattern %r at %s", pattern, url)

        return captured.get("data", {})

    # ── Protocol implementation ─────────────────────────────────────────────

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        """Navigate /app/sleep/{week_end}/1 week-by-week to capture full sleep history."""
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
        seen: set[str] = set()
        results = []

        week_end = s + timedelta(days=6)
        while week_end <= e + timedelta(days=6):
            target = min(week_end, e).isoformat()
            data = self._navigate_and_capture(
                f"{CONNECT_URL}/app/sleep/{target}/1",
                "sleep-service/stats/sleep/daily",
            )
            for item in data.get("individualStats", []):
                d = item["calendarDate"]
                if d not in seen and d >= start:
                    seen.add(d)
                    results.append({"calendarDate": d, **item.get("values", {})})
            week_end += timedelta(days=7)

        return results

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        result = self._harvested.get("hrv-service/hrv/daily", {})
        return result if isinstance(result, list) else result.get("hrv", [])  # type: ignore[union-attr]

    def get_wellness_daily(self, start: str, end: str) -> list[dict]:
        """Navigate /app/daily-summary/{date} per day to capture usersummary/daily."""
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
        results = []
        d = s
        while d <= e:
            summary = self._navigate_and_capture(
                f"{CONNECT_URL}/app/daily-summary/{d.isoformat()}",
                "usersummary-service/usersummary/daily",
            )
            if summary and "dailySummariesCount" not in str(summary):
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
            else:
                log.warning("No wellness data for %s", d.isoformat())
            d += timedelta(days=1)
        return results

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        result = self._harvested.get("activitylist-service/activities/search", [])
        return result if isinstance(result, list) else []  # type: ignore[return-value]
