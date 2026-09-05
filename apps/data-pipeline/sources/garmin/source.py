from datetime import date, datetime, timedelta, timezone

import dlt

from .client import GarminClient


def _at_least_7_days(cursor_date: str) -> str:
    """Ensure we always request at least 7 days — Garmin stats API minimum."""
    d = date.fromisoformat(cursor_date)
    minimum = datetime.now(tz=timezone.utc).date() - timedelta(days=7)
    return min(d, minimum).isoformat()


@dlt.source(name="garmin")
def garmin_source(client: GarminClient, start_date: str):
    today = datetime.now(tz=timezone.utc).date().isoformat()

    @dlt.resource(name="sleep_daily", write_disposition="merge", primary_key="calendarDate")
    def sleep_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_sleep_daily(_at_least_7_days(cursor.last_value), today)

    @dlt.resource(name="hrv_daily", write_disposition="merge", primary_key="calendarDate")
    def hrv_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_hrv_data_range(_at_least_7_days(cursor.last_value), today)

    @dlt.resource(name="wellness_daily", write_disposition="merge", primary_key="calendarDate")
    def wellness_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        # Page-by-page navigation — no API range minimum, use full cursor
        yield from client.get_wellness_daily(cursor.last_value, today)

    @dlt.resource(name="activities", write_disposition="merge", primary_key="activity_id")
    def activities(cursor=dlt.sources.incremental("start_time_local", initial_value=start_date)):  # noqa: B008
        for a in client.get_activities_by_date(cursor.last_value, today):
            yield {
                "activity_id": a["activityId"],
                "activity_name": a.get("activityName"),
                "activity_type": a.get("activityType", {}).get("typeKey"),
                "start_time_local": a.get("startTimeLocal"),
                "duration_seconds": a.get("duration"),
                "distance_meters": a.get("distance"),
                "calories": a.get("calories"),
                "avg_hr": a.get("averageHR"),
                "max_hr": a.get("maxHR"),
                "training_load": a.get("activityTrainingLoad"),
                "aerobic_te": a.get("aerobicTrainingEffect"),
                "anaerobic_te": a.get("anaerobicTrainingEffect"),
            }

    yield sleep_daily
    yield hrv_daily
    yield wellness_daily
    yield activities
