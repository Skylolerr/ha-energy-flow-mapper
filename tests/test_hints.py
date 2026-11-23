"""Tests for the hints of the panel (solar circuits, daily sums, power sensors)."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.energy_flow_mapper import candidates as candidates_module
from custom_components.energy_flow_mapper import daily_reset
from custom_components.energy_flow_mapper.candidates import async_stats_info
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.hints import (
    HintCode,
    async_hints,
    async_sum_members,
    returned_sensor,
    sum_members,
)

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import ENERGY_PREFS

type Rows = dict[str, list[dict[str, Any]]]

SOLAR = {"type": "solar", "stat_energy_from": "sensor.solar_energy"}


class FakeRecorder:
    """Run executor jobs like the recorder does."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Keep the instance like get_instance would return it."""
        self.hass = hass

    async def async_add_executor_job(self, func: Any, *args: Any) -> Any:
        """Run the job directly."""
        return func(*args)


@pytest.fixture
def statistics(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> tuple[list[tuple[Any, ...]], Rows]:
    """Fake the recorder; return the calls made to it and its rows."""
    calls: list[tuple[Any, ...]] = []
    data: Rows = {}

    def fake(*args: Any) -> Rows:
        calls.append(args)
        return {stat: data[stat] for stat in args[3] if stat in data}

    monkeypatch.setattr(daily_reset, "statistics_during_period", fake)
    monkeypatch.setattr(daily_reset, "get_instance", FakeRecorder)
    hass.config.components.add("recorder")
    return calls, data


def changes(*values: float | None) -> list[dict[str, Any]]:
    """Return hourly statistics rows with these changes."""
    return [
        {"start": 1_700_000_000 + 3600 * i, "change": v} for i, v in enumerate(values)
    ]


def _device(hass: HomeAssistant, name: str) -> str:
    entry = MockConfigEntry(domain="shelly")
    entry.add_to_hass(hass)
    return (
        dr.async_get(hass)
        .async_get_or_create(config_entry_id=entry.entry_id, identifiers={("x", name)})
        .id
    )


def _entity(
    hass: HomeAssistant,
    entity_id: str,
    device_id: str | None,
    *,
    platform: str = "shelly",
    unique_id: str | None = None,
    translation_key: str | None = None,
    name: str | None = None,
    device_class: str = "energy",
    unit: str = "kWh",
    disabled: bool = False,
) -> None:
    """Register an entity; an enabled one gets a state too."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        platform,
        unique_id or entity_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        original_name=name,
        translation_key=translation_key,
        unit_of_measurement=unit,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )
    if not disabled:
        hass.states.async_set(
            entity_id,
            "1.0",
            {
                "device_class": device_class,
                "unit_of_measurement": unit,
                "state_class": "total_increasing"
                if device_class in ("energy", "water", "gas")
                else "measurement",
            },
        )


def _shelly(
    hass: HomeAssistant, name: str, *, returned_disabled: bool
) -> tuple[str, str]:
    """Create a Shelly with a meter and a returned sensor; return their IDs."""
    device_id = _device(hass, name)
    meter = f"sensor.{name}_energy"
    returned = f"sensor.{name}_energy_returned"
    _entity(hass, meter, device_id, unique_id=f"aabb-{name}-switch:0-energy")
    _entity(
        hass,
        returned,
        device_id,
        unique_id=f"aabb-{name}-switch:0-ret_energy",
        translation_key="energy_returned",
        disabled=returned_disabled,
    )
    return meter, returned


async def _hints(
    hass: HomeAssistant, prefs: dict[str, Any], daily: set[str] | None = None
) -> list[dict[str, Any]]:
    return await async_hints(hass, prefs, async_stats_info(hass, prefs), daily or set())


def _prefs(
    devices: list[dict[str, Any]],
    sources: list[dict[str, Any]] | None = None,
    water: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "energy_sources": [SOLAR] if sources is None else sources,
        "device_consumption": devices,
        "device_consumption_water": water or [],
    }


async def test_returned_hint_disabled_with_children(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A Pro EM channel with a disabled returned sensor and children gets a hint."""
    calls, _ = statistics
    meter, returned = _shelly(hass, "pro_em", returned_disabled=True)
    prefs = _prefs(
        [
            {"stat_consumption": meter},
            {"stat_consumption": "sensor.heat_pump", "included_in_stat": meter},
        ]
    )
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.RETURNED_ENERGY,
            "stat": meter,
            "kind": "electricity",
            "data": {"entity_id": returned, "disabled": True},
        }
    ]
    # A disabled sensor has no statistics to read.
    assert calls == []


async def test_no_returned_hint_disabled_without_children(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """A Shelly plug with a disabled returned sensor and no children: no hint."""
    calls, _ = statistics
    meter, _ = _shelly(hass, "plug", returned_disabled=True)
    assert await _hints(hass, _prefs([{"stat_consumption": meter}])) == []
    assert calls == []


async def test_returned_hint_enabled_and_counting(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """An enabled returned sensor that counted energy lately gets a hint."""
    calls, data = statistics
    meter, returned = _shelly(hass, "balcony", returned_disabled=False)
    other, other_returned = _shelly(hass, "fridge", returned_disabled=False)
    data[returned] = changes(0.0, None, 0.3, 0.0)
    data[other_returned] = changes(0.0, 0.0)
    prefs = _prefs([{"stat_consumption": meter}, {"stat_consumption": other}])
    assert await _hints(hass, prefs) == [
        {
            "code": HintCode.RETURNED_ENERGY,
            "stat": meter,
            "kind": "electricity",
            "data": {"entity_id": returned, "disabled": False},
        }
    ]
    # One query for all returned sensors, of the hourly changes of 3 days.
    assert len(calls) == 1
    _, start, end, ids, period, units, types = calls[0]
    assert ids == {returned, other_returned}
    assert (period, units, types) == ("hour", None, {"change"})
    assert (end - start).days == 3


async def test_no_returned_hint_enabled_but_zero(
    hass: HomeAssistant,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An enabled returned sensor that counted nothing gives no hint."""
    _, data = statistics
    meter, returned = _shelly(hass, "plug", returned_disabled=False)
    prefs = _prefs(
        [
            {"stat_consumption": meter},
            {"stat_consumption": "sensor.lamp", "included_in_stat": meter},
        ]
    )
    data[returned] = changes(0.0, 0.0, None)
    assert await _hints(hass, prefs) == []
    # No statistics at all: no hint either.
    data.clear()
    assert await _hints(hass, prefs) == []

    # A failing recorder only loses the hint.
    def fail(*args: Any) -> Rows:
        raise RuntimeError("database is locked")

    monkeypatch.setattr(daily_reset, "statistics_during_period", fail)
    assert await _hints(hass, prefs) == []
    hass.config.components.remove("recorder")
    assert await _hints(hass, prefs) == []


async def test_no_returned_hint_without_solar(
    hass: HomeAssistant, statistics: tuple[list[tuple[Any, ...]], Rows]
) -> None:
    """Without a solar source, a returned sensor gives no hint and no query."""
    calls, data = statistics
    meter, _ = _shelly(hass, "pro_em", returned_disabled=True)
    plug, plug_returned = _shelly(hass, "plug", returned_disabled=False)
    data[plug_returned] = changes(1.0)
    devices = [
        {"stat_consumption": meter},
        {"stat_consumption": "sensor.heat_pump", "included_in_stat": meter},
        {"stat_consumption": plug},
    ]
    grid = {"type": "grid", "stat_energy_from": "sensor.grid_import"}
    assert await _hints(hass, _prefs(devices, [grid])) == []
    assert calls == []
    # Water devices never get it, even with a solar source.
    assert await _hints(hass, _prefs([], water=devices)) == []
    assert calls == []


async def test_returned_sensor_detection(hass: HomeAssistant) -> None:
    """Returned sensors are found by translation key, Shelly key or name."""
    device_id = _device(hass, "meter")
    _entity(hass, "sensor.meter", device_id)
    # Not returned sensors: power, another key, the meter's own entity.
    _entity(
        hass,
        "sensor.returned_power",
        device_id,
        device_class="power",
        unit="W",
        translation_key="energy_returned",
    )
    _entity(hass, "sensor.consumed", device_id, translation_key="energy_consumed")
    assert returned_sensor(hass, "sensor.meter") is None
    for key in (
        "energy_returned",
        "energy_returned_with_channel_name",
        "energy_exported",
        "energy_return",
    ):
        other_device = _device(hass, key)
        _entity(hass, f"sensor.{key}_meter", other_device)
        _entity(hass, f"sensor.{key}", other_device, translation_key=key, disabled=True)
        assert returned_sensor(hass, f"sensor.{key}_meter") == (f"sensor.{key}", True)
    _entity(
        hass,
        "sensor.a_back",
        device_id,
        translation_key="energy_returned",
        disabled=True,
    )
    assert returned_sensor(hass, "sensor.meter") == ("sensor.a_back", True)
    # An enabled sensor comes first, then by entity ID.
    _entity(
        hass, "sensor.z_grid_export", device_id, platform="test", name="Grid Export"
    )
    assert returned_sensor(hass, "sensor.meter") == ("sensor.z_grid_export", False)

    # A Shelly entity whose registry entry has no translation key yet.
    other = _device(hass, "em")
    _entity(hass, "sensor.em_energy", other)
    _entity(
        hass, "sensor.em_back", other, unique_id="aabb-em1data:0-total_act_ret_energy"
    )
    assert returned_sensor(hass, "sensor.em_energy") == ("sensor.em_back", False)
    _entity(hass, "sensor.x_named", other, platform="test", name="Energy returned")
    assert returned_sensor(hass, "sensor.em_energy") == ("sensor.em_back", False)

    # No device, not in the registry.
    _entity(hass, "sensor.loose", None)
    assert returned_sensor(hass, "sensor.loose") is None
    assert returned_sensor(hass, "sensor.unknown") is None


def _group_sum(
    hass: HomeAssistant, entity_id: str, members: list[str], kind: str = "sum"
) -> str:
    entry = MockConfigEntry(
        domain="group",
        options={"group_type": "sensor", "type": kind, "entities": members},
    )
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "group",
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )
    return entry.entry_id


async def test_daily_in_sum_hint(hass: HomeAssistant) -> None:
    """A group sum mixing daily and other meters gets a hint, device or source."""
    entry_id = _group_sum(hass, "sensor.house", ["sensor.day", "sensor.life"])
    solar_entry = _group_sum(hass, "sensor.pv", ["sensor.pv_day", "sensor.pv_life"])
    _group_sum(hass, "sensor.days", ["sensor.day", "sensor.pv_day"])
    _group_sum(hass, "sensor.highest", ["sensor.day", "sensor.life"], kind="max")
    light = MockConfigEntry(domain="group", options={"group_type": "light"})
    light.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", "test", "x", suggested_object_id="other_group", config_entry=light
    )
    no_group = MockConfigEntry(domain="test")
    no_group.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor", "test", "y", suggested_object_id="plain", config_entry=no_group
    )
    assert sum_members(hass, "sensor.house") == ["sensor.day", "sensor.life"]
    for stat in ("sensor.highest", "sensor.other_group", "sensor.plain", "x:y"):
        assert sum_members(hass, stat) is None

    prefs = _prefs(
        [
            {"stat_consumption": "sensor.house"},
            {"stat_consumption": "sensor.days"},
            {"stat_consumption": "sensor.highest"},
            {"stat_consumption": "sensor.other_group"},
            {"stat_consumption": "sensor.plain"},
        ],
        [{"type": "solar", "stat_energy_from": "sensor.pv"}],
    )
    assert async_sum_members(hass, prefs) == {
        "sensor.day",
        "sensor.life",
        "sensor.pv_day",
        "sensor.pv_life",
    }
    daily = {"sensor.day", "sensor.pv_day"}
    assert await _hints(hass, prefs, daily) == [
        {
            "code": HintCode.DAILY_IN_SUM,
            "stat": "sensor.house",
            "kind": "electricity",
            "data": {
                "entry_id": entry_id,
                "members": ["sensor.day", "sensor.life"],
                "daily": ["sensor.day"],
            },
        },
        {
            "code": HintCode.DAILY_IN_SUM,
            "stat": "sensor.pv",
            "kind": "electricity",
            "data": {
                "entry_id": solar_entry,
                "members": ["sensor.pv_day", "sensor.pv_life"],
                "daily": ["sensor.pv_day"],
            },
        },
    ]
    # Nothing daily: no hint.
    assert await _hints(hass, prefs) == []


async def test_power_available_hint_device_and_source(hass: HomeAssistant) -> None:
    """A device or source without a power sensor whose device has one."""
    plug = _device(hass, "plug")
    _entity(hass, "sensor.plug_energy", plug)
    _entity(hass, "sensor.plug_power", plug, device_class="power", unit="W")
    main = _device(hass, "main")
    _entity(hass, "sensor.main_energy", main)
    _entity(hass, "sensor.main_power", main, device_class="power", unit="W")
    bare = _device(hass, "bare")
    _entity(hass, "sensor.bare_energy", bare)
    inverter = _device(hass, "inverter")
    _entity(hass, "sensor.pv_energy", inverter)
    _entity(hass, "sensor.pv_power", inverter, device_class="power", unit="W")
    grid_meter = _device(hass, "grid")
    _entity(hass, "sensor.grid_in", grid_meter)
    _entity(hass, "sensor.grid_out", grid_meter)
    _entity(hass, "sensor.grid_power", grid_meter, device_class="power", unit="W")
    battery = _device(hass, "battery")
    _entity(hass, "sensor.bat_out", battery)
    _entity(hass, "sensor.bat_power", battery, device_class="power", unit="W")
    tap = _device(hass, "tap")
    _entity(hass, "sensor.tap_water", tap, device_class="water", unit="L")
    _entity(hass, "sensor.tap_flow", tap, device_class="volume_flow_rate", unit="L/min")
    prefs = _prefs(
        [
            {"stat_consumption": "sensor.plug_energy"},
            {"stat_consumption": "sensor.main_energy", "stat_rate": "sensor.x"},
            {"stat_consumption": "sensor.bare_energy"},
            {"stat_consumption": "sensor.loose_energy"},
        ],
        [
            {"type": "solar", "stat_energy_from": "sensor.pv_energy"},
            # Export only: the export's device counts.
            {"type": "grid", "stat_energy_to": "sensor.grid_out"},
            {
                "type": "battery",
                "stat_energy_from": "sensor.bat_out",
                "power_config": {"stat_rate_inverted": "sensor.bat_power"},
            },
            {"type": "solar", "stat_energy_from": "sensor.main_energy"},
            {"type": "other", "stat_energy_from": "sensor.plug_energy"},
        ],
        [{"stat_consumption": "sensor.tap_water"}],
    )

    def power(stat: str, entity_id: str, kind: str = "electricity", **extra: str):
        return {
            "code": HintCode.POWER_AVAILABLE,
            "stat": stat,
            "kind": kind,
            "data": {"entity_id": entity_id, **extra},
        }

    hints = await _hints(hass, prefs)
    assert hints == [
        power("sensor.plug_energy", "sensor.plug_power"),
        power("sensor.tap_water", "sensor.tap_flow", "water"),
        power("sensor.pv_energy", "sensor.pv_power", role="production"),
        power("sensor.grid_out", "sensor.grid_power", role="export"),
        power("sensor.main_energy", "sensor.main_power", role="production"),
    ]


@pytest.fixture
def energy_prefs() -> dict[str, Any]:
    """Return the test preferences plus a plug without power and a group sum."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"] += [
        {"stat_consumption": "sensor.printer_energy"},
        {"stat_consumption": "sensor.house_sum"},
    ]
    return prefs


@pytest.mark.usefixtures("sensors", "loaded_entry")
async def test_get_returns_hints(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    statistics: tuple[list[tuple[Any, ...]], Rows],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """`get` returns the hints; sum members join the one daily query."""
    calls, data = statistics

    async def no_external(hass: HomeAssistant, **kwargs: Any) -> list[Any]:
        return []

    monkeypatch.setattr(candidates_module, "async_list_statistic_ids", no_external)
    # The member `sensor.day_meter` is neither used nor a candidate.
    entry_id = _group_sum(
        hass, "sensor.house_sum", ["sensor.day_meter", "sensor.garage_energy"]
    )
    data["sensor.day_meter"] = [
        {"start": 1_700_000_000 + 3600 * h, "state": 0.5 * (h % 24)} for h in range(72)
    ]
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": f"{DOMAIN}/get"})
    response = await client.receive_json()
    assert response["success"], response
    assert response["result"]["hints"] == [
        {
            "code": "power_available",
            "stat": "sensor.printer_energy",
            "kind": "electricity",
            "data": {"entity_id": "sensor.printer_power"},
        },
        {
            "code": "daily_in_sum",
            "stat": "sensor.house_sum",
            "kind": "electricity",
            "data": {
                "entry_id": entry_id,
                "members": ["sensor.day_meter", "sensor.garage_energy"],
                "daily": ["sensor.day_meter"],
            },
        },
    ]
    assert len(calls) == 1
    assert "sensor.day_meter" in calls[0][3]
