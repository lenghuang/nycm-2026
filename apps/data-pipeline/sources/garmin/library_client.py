from garminconnect import Garmin

from config.settings import GarminSettings


class LibraryGarminClient:
    """Garmin client using the garminconnect library (mobile OAuth flow)."""

    def __init__(self, settings: GarminSettings) -> None:
        settings.token_dir.mkdir(parents=True, exist_ok=True)
        self._client = Garmin(email=settings.email, password=settings.password)
        self._client.login(tokenstore=str(settings.token_dir))

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        return self._client.get_sleep_daily(start, end)

    def get_daily_steps(self, start: str, end: str) -> list[dict]:
        return self._client.get_daily_steps(start, end)

    def get_rhr_daily(self, start: str, end: str) -> list[dict]:
        return self._client.get_rhr_daily(start, end)

    def get_body_battery(self, start: str, end: str) -> list[dict]:
        return self._client.get_body_battery(start, end)

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        return self._client.get_hrv_data_range(start, end)

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        return self._client.get_activities_by_date(start, end)
