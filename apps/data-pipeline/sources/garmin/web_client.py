import json
import time
from pathlib import Path

from curl_cffi import requests as curl_requests
from playwright.sync_api import sync_playwright

CONNECT_URL = "https://connect.garmin.com"
API_BASE = "https://connect.garmin.com/gc-api"
COOKIE_FILE = Path("data/garmin_tokens/session_cookies.json")
BROWSER_PROFILE_DIR = str(Path("data/garmin_tokens/browser_profile"))

LOGIN_URL = "https://sso.garmin.com/portal/api/login"
LOGGED_IN_INDICATOR = "/modern"


def _cookies_expired(cookies: list[dict]) -> bool:
    jwt = next((c for c in cookies if c["name"] == "JWT_WEB"), None)
    if not jwt:
        return True
    expires = jwt.get("expires", 0)
    return bool(expires and expires < time.time())


def _load_cookies() -> list[dict] | None:
    if not COOKIE_FILE.exists():
        return None
    cookies = json.loads(COOKIE_FILE.read_text())
    if _cookies_expired(cookies):
        return None
    return cookies


def _save_cookies(cookies: list[dict]) -> None:
    COOKIE_FILE.parent.mkdir(parents=True, exist_ok=True)
    COOKIE_FILE.write_text(json.dumps(cookies))


def _acquire_cookies(email: str | None = None, password: str | None = None) -> list[dict]:
    """Open persistent browser, auto-fill credentials if provided, extract all cookies."""
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=BROWSER_PROFILE_DIR,
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
        )
        page = context.new_page()
        page.goto(f"{CONNECT_URL}/modern", wait_until="networkidle")

        # Auto-fill credentials if we land on the SSO login page
        if "sso.garmin.com" in page.url and email and password:
            try:
                page.fill('input[type="email"], input[name="email"]', email)
                page.fill('input[type="password"], input[name="password"]', password)
                page.click('button[type="submit"]')
            except Exception:
                pass

        # Wait until we're on the Garmin Connect dashboard (not SSO)
        if "sso.garmin.com" in page.url:
            print("Waiting for Garmin login to complete in the browser window...")
            page.wait_for_url(f"{CONNECT_URL}/**", timeout=120000)

        cookies = context.cookies()
        context.close()

    jwt = next((c for c in cookies if c["name"] == "JWT_WEB"), None)
    if not jwt:
        raise RuntimeError("JWT_WEB not found. Make sure you are logged in.")

    _save_cookies(cookies)
    return cookies


def _cookie_header(cookies: list[dict]) -> str:
    # Only send cookies scoped to connect.garmin.com — avoid SSO/other domain conflicts
    relevant = [
        c for c in cookies
        if "connect.garmin.com" in c.get("domain", "")
        or c.get("domain", "") in (".garmin.com", "garmin.com")
    ]
    print(f"[debug] sending cookies: {[c['name'] for c in relevant]}")
    return "; ".join(f"{c['name']}={c['value']}" for c in relevant)


class WebCookieGarminClient:
    """Garmin client using browser session cookies. No mobile OAuth required."""

    def __init__(self, email: str | None = None, password: str | None = None) -> None:
        self._email = email
        self._password = password
        cookies = _load_cookies() or _acquire_cookies(email, password)
        self._session = self._make_session(cookies)

    def _make_session(self, cookies: list[dict]) -> curl_requests.Session:
        sess = curl_requests.Session(impersonate="chrome")
        sess.headers.update({
            "Cookie": _cookie_header(cookies),
            "NK": "NT",
            "X-app-ver": "4.89.0.0",
            "Accept": "application/json",
        })
        return sess

    def _get(self, path: str, **params) -> list | dict:
        resp = self._session.get(f"{API_BASE}{path}", params=params)
        if resp.status_code in (401, 403):
            COOKIE_FILE.unlink(missing_ok=True)
            raise RuntimeError(
                f"{resp.status_code} on {path}\nResponse: {resp.text[:500]}"
            )
        resp.raise_for_status()
        return resp.json()

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        return self._get(f"/sleep-service/stats/sleep/daily/{start}/{end}")

    def get_daily_steps(self, start: str, end: str) -> list[dict]:
        return self._get(f"/usersummary-service/stats/steps/daily/{start}/{end}")

    def get_rhr_daily(self, start: str, end: str) -> list[dict]:
        return self._get(f"/usersummary-service/stats/heartRate/daily/{start}/{end}")

    def get_body_battery(self, start: str, end: str) -> list[dict]:
        return self._get(
            "/wellness-service/wellness/bodyBattery/reports/daily",
            startDate=start,
            endDate=end,
        )

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        return self._get(f"/hrv-service/hrv/daily/{start}/{end}")

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        return self._get(
            "/activitylist-service/activities/search/activities",
            startDate=start,
            endDate=end,
            limit=100,
        )
