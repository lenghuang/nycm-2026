from datetime import datetime, timedelta, timezone

import dlt

from .client import GarminClient

_MAX_RANGE_DAYS = 28


def _date_chunks(start: str, end: str):
    """Yield (chunk_start, chunk_end) pairs in 28-day windows."""
    from datetime import date
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    while s <= e:
        chunk_end = min(s + timedelta(days=_MAX_RANGE_DAYS - 1), e)
        yield s.isoformat(), chunk_end.isoformat()
        s = chunk_end + timedelta(days=1)


@dlt.source(name="garmin")
def garmin_source(client: GarminClient, start_date: str):
    today = datetime.now(tz=timezone.utc).date().isoformat()

    @dlt.resource(name="sleep_daily", write_disposition="merge", primary_key="calendarDate")
    def sleep_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_sleep_daily(cursor.last_value, today)

    @dlt.resource(name="steps_daily", write_disposition="merge", primary_key="calendarDate")
    def steps_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_daily_steps(cursor.last_value, today)

    @dlt.resource(name="rhr_daily", write_disposition="merge", primary_key="calendarDate")
    def rhr_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_rhr_daily(cursor.last_value, today)

    @dlt.resource(name="body_battery", write_disposition="merge", primary_key="calendarDate")
    def body_battery(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_body_battery(cursor.last_value, today)

    @dlt.resource(name="hrv_daily", write_disposition="merge", primary_key="calendarDate")
    def hrv_daily(cursor=dlt.sources.incremental("calendarDate", initial_value=start_date)):  # noqa: B008
        yield from client.get_hrv_data_range(cursor.last_value, today)

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
    yield steps_daily
    yield rhr_daily
    yield body_battery
    yield hrv_daily
    yield activities
