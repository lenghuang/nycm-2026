import csv
import dlt

from config.settings import HevySettings


@dlt.source(name="hevy")
def hevy_source(settings: HevySettings):
    @dlt.resource(
        name="workout_sets",
        write_disposition="merge",
        primary_key=["start_time", "exercise_title", "set_index"],
        columns={"rpe": {"data_type": "double"}},
    )
    def workout_sets():
        with open(str(settings.export_path), newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                yield {
                    "title": row["title"],
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "exercise_title": row["exercise_title"],
                    "superset_id": row["superset_id"] or None,
                    "exercise_notes": row["exercise_notes"] or None,
                    "set_index": int(row["set_index"]),
                    "set_type": row["set_type"],
                    "weight_lbs": float(row["weight_lbs"]) if row["weight_lbs"] else None,
                    "reps": int(row["reps"]) if row["reps"] else None,
                    "distance_miles": float(row["distance_miles"]) if row["distance_miles"] else None,
                    "duration_seconds": float(row["duration_seconds"]) if row["duration_seconds"] else None,
                    "rpe": float(row["rpe"]) if row["rpe"] else None,
                }

    yield workout_sets
