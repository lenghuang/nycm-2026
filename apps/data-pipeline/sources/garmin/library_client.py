from datetime import date, timedelta

from garminconnect import Garmin

from config.settings import GarminSettings


class LibraryGarminClient:
    """Garmin client using the garminconnect library (mobile OAuth flow).
    Use when the garminconnect rate limit has cleared."""

    def __init__(self, settings: GarminSettings) -> None:
        settings.token_dir.mkdir(parents=True, exist_ok=True)
        self._client = Garmin(email=settings.email, password=settings.password)
        self._client.login(tokenstore=str(settings.token_dir))

    def get_sleep_daily(self, start: str, end: str) -> list[dict]:
        return self._client.get_sleep_daily(start, end)

    def get_hrv_data_range(self, start: str, end: str) -> list[dict]:
        return self._client.get_hrv_data_range(start, end)

    def get_wellness_daily(self, start: str, end: str) -> list[dict]:
        results = []
        s = date.fromisoformat(start)
        e = date.fromisoformat(end)
        d = s
        while d <= e:
            summary = self._client.get_user_summary(d.isoformat())
            results.append({
                "calendarDate": d.isoformat(),
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

    def get_activities_by_date(self, start: str, end: str) -> list[dict]:
        return self._client.get_activities_by_date(start, end)
