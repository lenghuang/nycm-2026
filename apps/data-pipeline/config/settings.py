from datetime import date
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).parent.parent


class GarminSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GARMIN_",
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
    )

    email: str
    password: str
    start_date: date = Field(default=date(2026, 8, 2))
    token_dir: Path = Field(default=_ROOT / "data" / "garmin_tokens")


class MacroFactorSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MACROFACTOR_",
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
    )

    export_path: Path = Field(
        default=_ROOT / "data" / "raw" / "macrofactor" / "MacroFactor-20260904232342.xlsx"
    )


class HevySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HEVY_",
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
    )

    export_path: Path = Field(default=_ROOT / "data" / "raw" / "hevy" / "workout_data.csv")
