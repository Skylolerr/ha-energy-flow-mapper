"""Remember which suggestions an admin ignored, for every device and admin."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Final, TypedDict

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    SUGGESTIONS_STORAGE_KEY,
    SUGGESTIONS_STORAGE_MINOR_VERSION,
    SUGGESTIONS_STORAGE_VERSION,
)

_KEYS = ("kind", "stat", "parent")
_HINT_KEYS = ("code", "kind", "stat")

# The safety-net hints: a dismissal hides only the event it names (the `data`
# field of the hint), so a new step, gap or day shows again.
EVENT_KEYS: Final = {
    "gross_off": "hour",
    "gross_unknown": "hour",
    "solar_term_short": "day",
    "solar_term_high": "day",
}
# The safety net looks back this many days (hints.WATCH_DAYS); older events
# cannot come back, so their dismissals are dropped when the store is written.
EVENT_DAYS: Final = 7


class SuggestionsData(TypedDict):
    """Content of the store file."""

    ignored: list[dict[str, str]]
    dismissed: list[dict[str, str]]


class _SuggestionsStore(Store[SuggestionsData]):
    """Store with the migrations from versions 1.1 and 1.2."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Migrate older data.

        1.1 had no dismissed hints: add the empty list. 1.2 kept dismissals of
        safety-net hints without their event, so they hid every later event:
        drop them. Other dismissals stay as they are.
        """
        data = old_data
        if old_minor_version < 2:
            data = {**data, "dismissed": data.get("dismissed", [])}
        if old_minor_version < 3 and isinstance(data.get("dismissed"), list):
            data = {
                **data,
                "dismissed": [
                    entry
                    for entry in data["dismissed"]
                    if not (isinstance(entry, dict) and entry.get("code") in EVENT_KEYS)
                ],
            }
        return data


def _hint_entry(raw: Any) -> dict[str, str] | None:
    """Return a valid dismissal `{code, kind, stat[, role][, hour | day]}`, or None.

    A safety-net hint needs its event (`EVENT_KEYS`); other hints keep none.
    """
    if not isinstance(raw, dict) or not all(
        isinstance(raw.get(key), str) for key in _HINT_KEYS
    ):
        return None
    entry = {key: raw[key] for key in _HINT_KEYS}
    role = raw.get("role")
    if role is not None:
        if not isinstance(role, str):
            return None
        entry["role"] = role
    if (event := EVENT_KEYS.get(entry["code"])) is not None:
        if not isinstance(raw.get(event), str):
            return None
        entry[event] = raw[event]
    return entry


def _recent(entry: dict[str, str], since: datetime) -> bool:
    """Return whether a dismissal can still match a hint; one without event can."""
    if "hour" in entry:
        when = dt_util.parse_datetime(entry["hour"])
        return when is not None and when >= since
    if "day" in entry:
        try:
            day = date.fromisoformat(entry["day"])
        except ValueError:
            return False
        return day >= dt_util.as_local(since).date()
    return True


class SuggestionStore:
    """Ignored "included in" suggestions as `{kind, stat, parent}`.

    Also the dismissed hints as `{code, kind, stat}` plus `role` when the hint
    names one (a grid source and the home meter can share a statistic), and
    for a safety-net hint its event (`hour` or `day`): a new event shows again.

    Not an energy setting: not part of backups, export or import.
    """

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store; call async_load before use."""
        self._store: _SuggestionsStore = _SuggestionsStore(
            hass,
            SUGGESTIONS_STORAGE_VERSION,
            SUGGESTIONS_STORAGE_KEY,
            minor_version=SUGGESTIONS_STORAGE_MINOR_VERSION,
        )
        self._ignored: list[dict[str, str]] = []
        self._dismissed: list[dict[str, str]] = []

    async def async_load(self) -> None:
        """Load the list from disk; damaged entries are left out."""
        data = await self._store.async_load()
        raw = data.get("ignored") if isinstance(data, dict) else None
        self._ignored = [
            {key: entry[key] for key in _KEYS}
            for entry in raw or []
            if isinstance(entry, dict)
            and all(isinstance(entry.get(key), str) for key in _KEYS)
        ]
        dismissed = data.get("dismissed") if isinstance(data, dict) else None
        self._dismissed = [
            entry
            for raw_entry in dismissed or []
            if (entry := _hint_entry(raw_entry)) is not None
        ]

    def ignored(self) -> list[dict[str, str]]:
        """Return the ignored suggestions."""
        return [dict(pair) for pair in self._ignored]

    async def async_ignore(
        self, pair: dict[str, str], known: set[tuple[str, str]]
    ) -> None:
        """Ignore a suggestion and save; `known` are the current (kind, stat).

        Ignores whose devices are no longer in the energy dashboard are
        dropped, the new one included.
        """
        pair = {"kind": pair["kind"], "stat": pair["stat"], "parent": pair["parent"]}
        ignored = [p for p in self._ignored if p != pair] + [pair]
        self._ignored = [
            p
            for p in ignored
            if (p["kind"], p["stat"]) in known and (p["kind"], p["parent"]) in known
        ]
        await self._async_save()

    def dismissed(self) -> list[dict[str, str]]:
        """Return the dismissed hints."""
        return [dict(hint) for hint in self._dismissed]

    async def async_dismiss(
        self, hint: dict[str, str], known: set[tuple[str, str]]
    ) -> None:
        """Dismiss a hint and save; `known` are the current (kind, stat).

        Dismissals of statistics that are no longer in the energy dashboard
        are dropped, the new one included. A safety-net hint without its
        event is not kept: it would hide every later event.
        """
        entry = _hint_entry(hint)
        dismissed = [d for d in self._dismissed if d != entry]
        if entry is not None:
            dismissed.append(entry)
        self._dismissed = [d for d in dismissed if (d["kind"], d["stat"]) in known]
        await self._async_save()

    async def async_clear(self, kind: str | None = None) -> None:
        """Show the suggestions and hints of `kind` again, or all of them."""
        self._ignored = [
            p for p in self._ignored if kind is not None and p["kind"] != kind
        ]
        self._dismissed = [
            h for h in self._dismissed if kind is not None and h["kind"] != kind
        ]
        await self._async_save()

    async def async_remove(self) -> None:
        """Delete the store file."""
        self._ignored = []
        self._dismissed = []
        await self._store.async_remove()

    async def _async_save(self) -> None:
        """Save, without dismissals of events the safety net no longer sees."""
        since = dt_util.utcnow() - timedelta(days=EVENT_DAYS)
        self._dismissed = [d for d in self._dismissed if _recent(d, since)]
        await self._store.async_save(
            {"ignored": self._ignored, "dismissed": self._dismissed}
        )
