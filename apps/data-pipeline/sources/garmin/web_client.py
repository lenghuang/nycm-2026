from pathlib import Path

from playwright.sync_api import sync_playwright

CONNECT_URL = "https://connect.garmin.com"
BROWSER_PROFILE_DIR = str(Path("data/garmin_tokens/browser_profile"))


def _open_context(email: str | None, password: str | None):
    p = sync_playwright().start()
    context = p.chromium.launch_persistent_context(
        user_data_dir=BROWSER_PROFILE_DIR,
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
        ignore_default_args=["--enable-automation"],
    )
    page = context.new_page()
    page.goto(f"{CONNECT_URL}/modern", wait_until="networkidle")

    if "sso.garmin.com" in page.url and email and password:
        try:
            page.fill('input[type="email"], input[name="email"]', email)
            page.fill('input[type="password"], input[name="password"]', password)
            page.click('button[type="submit"]')
        except Exception:  # noqa: BLE001
            pass

    if "sso.garmin.com" in page.url:
        print("Complete login in the browser window...")
        page.wait_for_url(f"{CONNECT_URL}/**", timeout=120000)

    page.close()
    return context, p


class WebCookieGarminClient:
    """Navigates Garmin Connect pages and intercepts XHR responses.
    Uses the SPA's own auth — no direct API calls, no Cloudflare battles."""

    def __init__(self, email: str | None = None, password: str | None = None) -> None:
        self._context, self._playwright = _open_context(email, password)

    def close(self) -> None:
        self._context.close()
        self._playwright.stop()

    def _intercept(self, page_url: str, patterns: list[str]) -> dict[str, object]:
        """Navigate to page_url and return first matching response per pattern."""
        captured: dict[str, object] = {}

        def on_response(response):
            for pat in patterns:
                if pat not in captured and pat in response.url and response.status == 200:
                    try:
                        captured[pat] = response.json()
                    except Exception:  # noqa: BLE001
                        pass

        page = self._context.new_page()
        page.on("response", on_response)
        page.goto(page_url, wait_until="networkidle")
        page.close()
        return captured

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/modern/sleep",
            ["sleep-service/stats/sleep/daily"],
        )
        result = data.get("sleep-service/stats/sleep/daily", {})
        return [
            {"calendarDate": item["calendarDate"], **item.get("values", {})}
            for item in result.get("individualStats", [])
        ]

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/modern/sleep",
            ["hrv-service/hrv/daily"],
        )
        result = data.get("hrv-service/hrv/daily", {})
        # Response shape TBD — return raw for now
        return result if isinstance(result, list) else result.get("hrv", [])

    def get_rhr_daily(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/modern/sleep",
            ["usersummary-service/stats/heartRate"],
        )
        result = data.get("usersummary-service/stats/heartRate", {})
        return result if isinstance(result, list) else []

    def get_daily_steps(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/modern/wellness",
            ["usersummary-service/stats/steps"],
        )
        result = data.get("usersummary-service/stats/steps", {})
        return result if isinstance(result, list) else []

    def get_body_battery(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/app/body-battery",
            ["wellness-service/wellness/bodyBattery"],
        )
        result = data.get("wellness-service/wellness/bodyBattery", {})
        return result if isinstance(result, list) else []

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        data = self._intercept(
            f"{CONNECT_URL}/modern/activities",
            ["activitylist-service/activities/search"],
        )
        result = data.get("activitylist-service/activities/search", [])
        return result if isinstance(result, list) else []
