from datetime import date
from pathlib import Path
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).parent.parent


class GarminSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="GARMIN_",
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
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
        extra="ignore",
    )

    export_path: Path = Field(default=Path("."))

    @model_validator(mode="after")
    def resolve_latest_export(self) -> "MacroFactorSettings":
        if self.export_path == Path("."):
            candidates = sorted(
                (_ROOT / "data" / "raw" / "macrofactor").glob("MacroFactor-*.xlsx")
            )
            if not candidates:
                raise FileNotFoundError(
                    "No MacroFactor-*.xlsx found in data/raw/macrofactor/"
                )
            self.export_path = candidates[-1]
        return self


class HevySettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HEVY_",
        env_file=str(_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    export_path: Path = Field(default=_ROOT / "data" / "raw" / "hevy" / "workout_data.csv")
