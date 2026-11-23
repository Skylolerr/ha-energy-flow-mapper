"""Tests for the guided setup "Solar feeds into this circuit"."""

from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.template import Template
from homeassistant.util.unit_conversion import EnergyConverter, PowerConverter

from custom_components.energy_flow_mapper import (
    energy_access,
    solar_setup,
)
from custom_components.energy_flow_mapper import integral as integral_module
from custom_components.energy_flow_mapper import template_meter as template_module
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.device_rules import Method
from custom_components.energy_flow_mapper.integral import INTEGRAL_OPTIONS
from custom_components.energy_flow_mapper.meter_inputs import meter_inputs
from custom_components.energy_flow_mapper.solar_setup import (
    KWH,
    WATTS,
    Choices,
    gross_energy_template,
    gross_power_template,
    solar_power_template,
)
from custom_components.energy_flow_mapper.stats_probe import StatsEvidence

from .common import MockConfigEntry, WebSocketGenerator, async_fire_time_changed
from .conftest import ENERGY_PREFS, _meter

pytestmark = pytest.mark.usefixtures("sensors")

MAIN = "sensor.main_energy"
MAIN_POWER = "sensor.main_power"
SOLAR = "sensor.solar_energy"
SOLAR_POWER = "sensor.solar_power"
RETURNED = "sensor.main_returned"
# The solar source has a power sensor.
WITH_SOLAR_POWER = {
    **ENERGY_PREFS,
    "energy_sources": [
        {**source, "stat_rate": SOLAR_POWER} if source["type"] == "solar" else source
        for source in ENERGY_PREFS["energy_sources"]
    ],
}
MAC = "AABBCCDDEEFF"
DAY_1 = datetime(2026, 11, 20, tzinfo=UTC)
PRO_EM = "sensor.pro_em_energy"
PRO_EM_RETURNED = "sensor.pro_em_returned"
PRO_EM_POWER = "sensor.pro_em_power"
PLUG = "sensor.plug_energy"
PLUG_RETURNED = "sensor.plug_returned"
PLUG_CONSUMED = "sensor.plug_consumed"
PLUG_POWER = "sensor.plug_power"
# Shelly devices in the settings, with the solar's power sensor.
WITH_SHELLY = {
    **WITH_SOLAR_POWER,
    "device_consumption": [
        *ENERGY_PREFS["device_consumption"],
        {"stat_consumption": PRO_EM, "stat_rate": PRO_EM_POWER, "name": "Pro EM"},
        {"stat_consumption": PLUG, "stat_rate": PLUG_POWER, "name": "Balcony"},
    ],
}


def _series(values: list[float], start: datetime = DAY_1) -> list[Any]:
    """Return hourly points from `start`."""
    return [(start + timedelta(hours=hour), value) for hour, value in enumerate(values)]


# Three days of a counter that rises every day.
RISING = _series([float(hour) for hour in range(72)])


def lifetime(
    *, went_negative: bool = False, series: list[Any] | None = None
) -> StatsEvidence:
    """Evidence of a counter that never resets (rising on three days)."""
    return StatsEvidence(
        periodic=False,
        certain=False,
        reason=None,
        drops=[],
        went_negative=went_negative,
        series=RISING if series is None else series,
    )


DAILY = StatsEvidence(
    periodic=True,
    certain=False,
    reason="drops",
    drops=[],
    went_negative=False,
    series=[],
)
CERTAIN_DAILY = StatsEvidence(
    periodic=True,
    certain=True,
    reason="utility_meter",
    drops=[],
    went_negative=False,
    series=[],
)
NO_DATA = StatsEvidence(
    periodic=None,
    certain=False,
    reason="no_data",
    drops=[],
    went_negative=False,
    series=[],
)


async def send(
    hass_ws_client: WebSocketGenerator,
    hass: HomeAssistant,
    access_token: str | None = None,
    **msg: Any,
) -> dict[str, Any]:
    """Send one command and return the response."""
    client = await (
        hass_ws_client(hass, access_token) if access_token else hass_ws_client(hass)
    )
    await client.send_json_auto_id(msg)
    return await client.receive_json()


def render(hass: HomeAssistant, template: str) -> Any:
    return Template(template, hass).async_render()


def _device_of(hass: HomeAssistant, entity_id: str) -> str:
    entry = er.async_get(hass).async_get(entity_id)
    assert entry is not None
    assert entry.device_id is not None
    return entry.device_id


def _returned(
    hass: HomeAssistant, *, disabled: bool = False, unit: str = "kWh"
) -> None:
    """Give the main meter's device a returned-energy sensor."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        "test",
        "main-returned",
        suggested_object_id="main_returned",
        device_id=_device_of(hass, MAIN),
        original_device_class="energy",
        translation_key="energy_returned",
        unit_of_measurement=unit,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )
    if not disabled:
        hass.states.async_set(
            RETURNED,
            "2",
            {
                "device_class": "energy",
                "unit_of_measurement": unit,
                "state_class": "total_increasing",
            },
        )


def _shelly(
    hass: HomeAssistant,
    entity_id: str,
    device_id: str,
    unique_id: str,
    *,
    device_class: str = "energy",
    translation_key: str | None = None,
    disabled: bool = False,
    state: str = "10",
) -> None:
    unit = "kWh" if device_class == "energy" else "W"
    er.async_get(hass).async_get_or_create(
        "sensor",
        "shelly",
        unique_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        translation_key=translation_key,
        unit_of_measurement=unit,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )
    if not disabled:
        hass.states.async_set(
            entity_id,
            state,
            {"device_class": device_class, "unit_of_measurement": unit},
        )


def _new_device(hass: HomeAssistant, name: str) -> str:
    entry = MockConfigEntry(domain="shelly")
    entry.add_to_hass(hass)
    return (
        dr.async_get(hass)
        .async_get_or_create(
            config_entry_id=entry.entry_id, identifiers={("shelly", name)}
        )
        .id
    )


def _shelly_pro_em(hass: HomeAssistant) -> None:
    """Add a Shelly Pro EM channel: energy, returned energy and power."""
    device = _new_device(hass, "pro_em")
    _shelly(hass, PRO_EM, device, f"{MAC}-em1data:0-total_act_energy", state="500")
    _shelly(
        hass,
        PRO_EM_RETURNED,
        device,
        f"{MAC}-em1data:0-total_act_ret_energy",
        translation_key="energy_returned",
        state="20",
    )
    _shelly(
        hass,
        PRO_EM_POWER,
        device,
        f"{MAC}-em1:0-power",
        device_class="power",
        state="-50",
    )


def _shelly_plug(hass: HomeAssistant) -> None:
    """Add a Shelly Plus Plug S: Energy (both ways), returned, consumed."""
    device = _new_device(hass, "plug")
    _shelly(hass, PLUG, device, f"{MAC}-switch:0-energy", state="10")
    _shelly(
        hass,
        PLUG_RETURNED,
        device,
        f"{MAC}-switch:0-ret_energy",
        translation_key="energy_returned",
        state="2",
    )
    _shelly(
        hass,
        PLUG_CONSUMED,
        device,
        f"{MAC}-switch:0-consumed_energy_switch",
        translation_key="energy_consumed",
        disabled=True,
    )
    _shelly(
        hass,
        PLUG_POWER,
        device,
        f"{MAC}-switch:0-power",
        device_class="power",
        state="5",
    )


@pytest.fixture(autouse=True)
def solar_power(hass: HomeAssistant, sensors: None) -> None:
    """Add a power sensor of the solar (used only where the source names it)."""
    _meter(
        hass,
        SOLAR_POWER,
        device_class="power",
        unit="W",
        state_class="measurement",
        name="Solar power",
        state="300",
    )
    # The circuit meters of these tests count both ways (`total`).
    for meter, value in (
        (MAIN, "1000"),
        ("sensor.kitchen_energy", "1.0"),
        ("sensor.garage_energy", "1.0"),
    ):
        state = hass.states.get(meter)
        assert state is not None
        hass.states.async_set(
            meter, value, {**state.attributes, "state_class": "total"}
        )


async def draft(
    hass_ws_client: WebSocketGenerator, hass: HomeAssistant, *changes: dict[str, Any]
) -> dict[str, Any]:
    """Return a draft (`base_hash`, `changes`) on the saved settings."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    return {"base_hash": response["result"]["hash"], "changes": list(changes)}


def set_rate(stat: str, rate: str | None) -> dict[str, Any]:
    return {"type": "set_rate", "stat": stat, "stat_rate": rate}


def set_solar_rate(rate: str | None, stat: str = SOLAR) -> dict[str, Any]:
    return {
        "type": "set_source_rate",
        "stat": stat,
        "role": "production",
        "stat_rate": rate,
    }


class Evidence(dict[str, StatsEvidence]):
    """Evidence per statistic, and the probes asked for (stats, power_of)."""

    calls: list[tuple[set[str], dict[str, str]]]


@pytest.fixture
def evidence(monkeypatch: pytest.MonkeyPatch) -> Evidence:
    """Fake the statistics probe; unknown statistics are lifetime counters."""
    found = Evidence()
    found.calls = []

    async def fake(
        hass: HomeAssistant,
        stats: Any,
        days: int = 3,
        power_of: Any = None,
    ) -> dict[str, StatsEvidence]:
        found.calls.append((set(stats), dict(power_of or {})))
        return {stat: found.get(stat, lifetime()) for stat in stats}

    monkeypatch.setattr(solar_setup, "async_probe", fake)
    return found


# --- Templates -------------------------------------------------------------


def _set(hass: HomeAssistant, entity_id: str, state: str, unit: str | None) -> None:
    hass.states.async_set(
        entity_id, state, {"unit_of_measurement": unit} if unit else {}
    )


def test_unit_tables_are_home_assistants() -> None:
    """The templates convert with Home Assistant's own factors, every unit."""
    assert set(KWH) == {str(unit) for unit in EnergyConverter.VALID_UNITS}
    assert set(WATTS) == {str(unit) for unit in PowerConverter.VALID_UNITS}
    assert KWH["Wh"] == pytest.approx(0.001)
    assert KWH["MWh"] == pytest.approx(1000)
    assert WATTS["kW"] == pytest.approx(1000)


async def test_gross_energy_template_em(hass: HomeAssistant) -> None:
    """EM: drawn - returned + solar, each read in kWh at render time."""
    template = gross_energy_template(Method.EM, "sensor.d", "sensor.s", "sensor.r")
    _set(hass, "sensor.d", "10", "kWh")
    _set(hass, "sensor.r", "2000", "Wh")
    _set(hass, "sensor.s", "3", "kWh")
    assert render(hass, template) == 11.0
    # The same energy in another unit gives the same value.
    _set(hass, "sensor.r", "2", "kWh")
    assert render(hass, template) == 11.0
    # A missing input or an unknown unit: unknown, never a wrong number.
    _set(hass, "sensor.r", "unavailable", None)
    assert render(hass, template) is None
    _set(hass, "sensor.r", "2", "%")
    assert render(hass, template) is None
    _set(hass, "sensor.r", "2", "kWh")
    _set(hass, "sensor.s", "unknown", "kWh")
    assert render(hass, template) is None


async def test_gross_energy_template_plug(hass: HomeAssistant) -> None:
    """Plug: Energy (both ways) - 2 x returned + solar."""
    template = gross_energy_template(Method.PLUG, "sensor.e", "sensor.s", "sensor.r")
    assert "- 2 * returned" in template
    _set(hass, "sensor.e", "10", "kWh")
    _set(hass, "sensor.r", "2", "kWh")
    _set(hass, "sensor.s", "3000", "Wh")
    assert render(hass, template) == 9.0


async def test_gross_energy_template_net_and_offset(hass: HomeAssistant) -> None:
    """Net: meter + solar; the offset lifts the start, differences stay."""
    template = gross_energy_template(Method.NET, "sensor.m", "sensor.s", offset=300)
    _set(hass, "sensor.m", "-250.5", "kWh")
    _set(hass, "sensor.s", "1", "kWh")
    assert render(hass, template) == 50.5


def test_gross_energy_template_needs_returned() -> None:
    with pytest.raises(ValueError, match="returned"):
        gross_energy_template(Method.EM, "sensor.a", "sensor.c")
    with pytest.raises(ValueError, match="power"):
        gross_energy_template(Method.POWER, "sensor.a", "sensor.c")


async def test_our_gross_meter_subtracts_only_returned(hass: HomeAssistant) -> None:
    """What the gross meter holds, and that only `returned` is subtracted."""
    for entity_id in ("sensor.d", "sensor.r", "sensor.s"):
        _meter(hass, entity_id)
    entry = MockConfigEntry(
        domain="template",
        options={
            "template_type": "sensor",
            "state": gross_energy_template(
                Method.PLUG, "sensor.d", "sensor.s", "sensor.r", offset=100
            ),
        },
    )
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "template",
        entry.entry_id,
        suggested_object_id="gross",
        config_entry=entry,
    )
    assert meter_inputs(hass, "sensor.gross") == {
        "entities": {"sensor.d", "sensor.r", "sensor.s"},
        "signed_known": True,
        "subtracted": {"sensor.r"},
    }


async def test_gross_power_template(hass: HomeAssistant) -> None:
    """Circuit + solar in W; an offline solar counts as 0, the circuit must be."""
    template = gross_power_template("sensor.c", "sensor.p")
    _set(hass, "sensor.c", "-120.04", "W")
    _set(hass, "sensor.p", "0.3", "kW")
    assert render(hass, template) == 180.0
    # Offline solar while the circuit feeds in: unknown, never a fall.
    _set(hass, "sensor.p", "unavailable", None)
    assert render(hass, template) is None
    _set(hass, "sensor.c", "120", "W")
    assert render(hass, template) == 120.0
    _set(hass, "sensor.c", "-120.04", "W")
    _set(hass, "sensor.p", "5", "%")
    assert render(hass, template) is None
    _set(hass, "sensor.p", "300", "W")
    _set(hass, "sensor.c", "unknown", "W")
    assert render(hass, template) is None


async def test_gross_power_template_inverted(hass: HomeAssistant) -> None:
    """An export-positive circuit power is turned around."""
    template = gross_power_template("sensor.c", "sensor.p", invert=True)
    _set(hass, "sensor.c", "120", "W")
    _set(hass, "sensor.p", "300", "W")
    assert render(hass, template) == 180.0
    # After the turn the circuit feeds in: an offline solar gives unknown.
    _set(hass, "sensor.p", "unavailable", None)
    assert render(hass, template) is None
    _set(hass, "sensor.c", "-50", "W")
    assert render(hass, template) == 50.0


async def test_solar_power_template_zero_mapped(hass: HomeAssistant) -> None:
    """The solar's power in W; offline (not a number) is 0, an odd unit unknown."""
    template = solar_power_template("sensor.p")
    _set(hass, "sensor.p", "0.3", "kW")
    assert render(hass, template) == 300.0
    for state in ("unavailable", "unknown"):
        _set(hass, "sensor.p", state, None)
        assert render(hass, template) == 0
    hass.states.async_remove("sensor.p")
    assert render(hass, template) == 0
    _set(hass, "sensor.p", "5", "%")
    assert render(hass, template) is None


@pytest.mark.parametrize(
    ("unit", "kind", "factor"),
    [
        ("kWh", "energy", 1.0),
        ("Wh", "energy", 0.001),
        ("MWh", "energy", 1000.0),
        ("W", "power", 1.0),
        ("kW", "power", 1000.0),
    ],
)
def test_unit_factor(unit: str, kind: Any, factor: float) -> None:
    assert solar_setup.unit_factor(unit, kind) == pytest.approx(factor)


@pytest.mark.parametrize(
    ("unit", "kind"),
    [
        (None, "energy"),
        ("", "energy"),
        ("%", "power"),
        ("W", "energy"),
        ("kWh", "power"),
    ],
)
def test_unit_factor_unknown(unit: str | None, kind: Any) -> None:
    assert solar_setup.unit_factor(unit, kind) is None


# --- Preview ---------------------------------------------------------------


async def preview(
    hass_ws_client: WebSocketGenerator, hass: HomeAssistant, **msg: Any
) -> dict[str, Any]:
    return await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/solar_setup_preview",
        **({"stat": MAIN, "solar": SOLAR} | msg),
    )


async def result_of(
    hass_ws_client: WebSocketGenerator, hass: HomeAssistant, **msg: Any
) -> dict[str, Any]:
    response = await preview(hass_ws_client, hass, **msg)
    assert response["success"], response
    result: dict[str, Any] = response["result"]
    return result


def methods(result: dict[str, Any]) -> dict[str, tuple[bool, bool, str | None]]:
    return {
        m["method"]: (m["offered"], m["verified"], m["reason"])
        for m in result["methods"]
    }


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_methods_for_shelly_pro_em(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A Pro EM channel is an EM meter: verified; the others are not."""
    _shelly_pro_em(hass)
    result = await result_of(hass_ws_client, hass, stat=PRO_EM)
    assert methods(result) == {
        "em": (True, True, "rule_shelly_em"),
        "plug": (True, False, "unverified_against_rule"),
        "net": (True, False, "unverified_net"),
        "power": (True, False, "unverified_power_unsigned"),
    }
    assert result["suggested"] == "em"
    assert result["method"] == "em"
    assert result["rule"] == "rule_shelly_em"
    assert result["drawn"] == PRO_EM
    assert result["returned"] == PRO_EM_RETURNED
    assert result["drawn_candidates"] == [{"entity": PRO_EM, "disabled": False}]
    assert result["returned_candidates"] == [
        {"entity": PRO_EM_RETURNED, "disabled": False}
    ]
    assert result["power"] == {
        "circuit": PRO_EM_POWER,
        "solar": SOLAR_POWER,
        "signed": False,
        "circuit_from": "saved",
        "solar_from": "saved",
    }
    assert result["live"] == {"circuit_w": -50.0, "solar_w": 300.0, "gross_w": 250.0}
    assert result["solar_term"] == {"kind": "integral", "reuse": None}
    assert [h["role"] for h in result["helpers"]] == [
        "solar_power",
        "solar_energy",
        "power",
        "energy",
    ]
    assert result["helpers"][3]["name_default"] == "Pro EM gross"
    assert result["blocked"] is None
    # 500 - 20 + 0 (a new solar integral) is enough.
    assert result["offset"] == 0


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("evidence")
async def test_preview_methods_for_shelly_plug(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A plug's "Energy" counts both ways: Plug, verified, with - 2 x returned."""
    _shelly_plug(hass)
    result = await result_of(hass_ws_client, hass, stat=PLUG)
    assert methods(result)["plug"] == (True, True, "rule_shelly_plug")
    assert methods(result)["em"] == (True, False, "unverified_against_rule")
    assert result["suggested"] == "plug"
    assert result["drawn_candidates"] == [
        {"entity": PLUG, "disabled": False},
        {"entity": PLUG_CONSUMED, "disabled": True},
    ]
    # The disabled "Energy consumed" as drawn: EM verified, but it has no value.
    result = await result_of(
        hass_ws_client, hass, stat=PLUG, method="em", drawn=PLUG_CONSUMED
    )
    assert methods(result)["em"] == (True, True, "rule_shelly_consumed")
    assert result["blocked"] == "input_disabled"
    assert result["blocked_entity"] == PLUG_CONSUMED

    response = await create(hass_ws_client, hass, stat=PLUG, method="plug")
    assert response["success"], response
    energy = _template_entries(hass)["Balcony gross"]
    assert "- 2 * returned" in energy.options["state"]
    # 10 - 2 x 2 + 0 (fresh solar integral), lifted by the offset to >= 100.
    integral = _solar_integral(hass)
    hass.states.async_set(integral, "0", {"unit_of_measurement": "kWh"})
    assert render(hass, energy.options["state"]) == 106.0


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_preview_unknown_device_power_unverified_without_negative(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """An unknown device gets "From power"; verified only once it went below 0."""
    result = await result_of(hass_ws_client, hass)
    assert result["suggested"] == "power"
    assert result["rule"] is None
    assert methods(result) == {
        "em": (False, False, "no_returned_sensor"),
        "plug": (False, False, "no_returned_sensor"),
        "net": (True, False, "unverified_net"),
        "power": (True, False, "unverified_power_unsigned"),
    }
    assert result["power"]["signed"] is False
    assert [h["role"] for h in result["helpers"]] == ["power", "energy"]
    assert result["offset"] == 0

    evidence[MAIN_POWER] = lifetime(went_negative=True)
    result = await result_of(hass_ws_client, hass)
    assert methods(result)["power"] == (True, True, "power_signed")
    assert result["power"]["signed"] is True


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_preview_net_when_meter_went_negative(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """A meter that went below 0 counts both ways: Net, verified."""
    evidence[MAIN] = lifetime(went_negative=True)
    result = await result_of(hass_ws_client, hass)
    assert result["suggested"] == "net"
    assert methods(result)["net"] == (True, True, "rule_net_negative")


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_nothing_suggested_without_power(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """No rule and no power: no method is chosen for the user."""
    result = await result_of(hass_ws_client, hass, stat="sensor.kitchen_energy")
    assert result["suggested"] is None
    assert result["method"] is None
    assert methods(result)["power"] == (False, False, "no_power")
    assert methods(result)["net"] == (True, False, "unverified_net")
    assert result["helpers"] == []
    assert result["blocked"] is None
    assert result["solar_term"] == {"kind": "counter", "reuse": None}


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_preview_reports_evidence_and_reads_powers(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: Evidence,
) -> None:
    """The evidence of every input; each meter's own power explains its falls."""
    _returned(hass)
    result = await result_of(hass_ws_client, hass, method="em")
    assert set(result["evidence"]) == {MAIN, RETURNED, SOLAR, MAIN_POWER, SOLAR_POWER}
    assert result["evidence"][MAIN] == lifetime().as_dict()
    stats, power_of = evidence.calls[-1]
    assert stats == {MAIN, RETURNED, SOLAR, MAIN_POWER, SOLAR_POWER}
    assert power_of == {MAIN: MAIN_POWER, SOLAR: SOLAR_POWER}


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_preview_daily_circuit_offers_only_power(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """A daily circuit meter or returned sensor leaves "From power" only."""
    _returned(hass)
    evidence[RETURNED] = DAILY
    result = await result_of(hass_ws_client, hass)
    assert methods(result)["em"] == (False, False, "daily_input")
    assert methods(result)["net"][0] is True
    evidence[MAIN] = DAILY
    result = await result_of(hass_ws_client, hass)
    assert methods(result)["net"] == (False, False, "daily_input")
    assert result["suggested"] == "power"
    # Asked for anyway: not offered.
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "not_offered"
    assert result["blocked_entity"] == MAIN


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_periodic_switch(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """The user's daily switch overrides a guess, never a certain signal."""
    evidence[MAIN] = DAILY
    result = await result_of(hass_ws_client, hass, periodic={MAIN: False})
    assert methods(result)["net"][0] is True
    result = await result_of(
        hass_ws_client,
        hass,
        stat="sensor.garage_energy",
        periodic={"sensor.garage_energy": True},
    )
    assert methods(result)["net"] == (False, False, "daily_input")
    evidence[MAIN] = CERTAIN_DAILY
    result = await result_of(hass_ws_client, hass, periodic={MAIN: False})
    assert methods(result)["net"] == (False, False, "daily_input")


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_daily_circuit_without_power_blocks(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """No method left: the daily meter is named."""
    evidence["sensor.kitchen_energy"] = DAILY
    result = await result_of(hass_ws_client, hass, stat="sensor.kitchen_energy")
    assert result["blocked"] == "daily_without_power"
    assert result["blocked_entity"] == "sensor.kitchen_energy"


@pytest.mark.usefixtures("loaded_entry")
async def test_solar_without_power_lifetime_ok(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
) -> None:
    """A certainly lifetime solar counter is used as it is, unit-aware."""
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["solar_term"] == {"kind": "counter", "reuse": None}
    assert result["blocked"] is None
    assert [h["role"] for h in result["helpers"]] == ["energy"]
    response = await create(hass_ws_client, hass, method="net", offset=0)
    assert response["success"], response
    energy = _template_entries(hass)["Main gross"]
    assert energy.options["state"] == gross_energy_template(Method.NET, MAIN, SOLAR)
    assert hass.config_entries.async_entries("integration") == _poe(hass)


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    ("solar_evidence", "periodic", "key"),
    [
        (DAILY, None, "solar_needs_power"),
        (CERTAIN_DAILY, None, "solar_needs_power"),
        (NO_DATA, None, "solar_needs_data"),
        (
            StatsEvidence(
                periodic=False,
                certain=False,
                reason=None,
                drops=[(datetime(2026, 11, 22, 6, tzinfo=UTC), 5.0, 0.0)],
                went_negative=False,
                series=RISING,
            ),
            None,
            "solar_needs_power",
        ),
        (lifetime(), True, "solar_needs_power"),
    ],
)
async def test_solar_without_power_daily_blocks(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: dict[str, StatsEvidence],
    solar_evidence: StatsEvidence,
    periodic: bool | None,
    key: str,
) -> None:
    """Daily or ever dropped without power: «needs a power sensor».

    Without statistics: «not enough data yet».
    """
    evidence[SOLAR] = solar_evidence
    msg: dict[str, Any] = {"method": "net"}
    if periodic is not None:
        msg["periodic"] = {SOLAR: periodic}
    result = await result_of(hass_ws_client, hass, **msg)
    assert result["blocked"] == key
    assert result["blocked_entity"] == SOLAR
    response = await create(hass_ws_client, hass, **msg)
    assert response["error"]["translation_key"] == key
    assert hass.config_entries.async_entries("template") == []


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_draft_values(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Power sensors set in the panel but not saved are used, and checked."""
    _shelly_pro_em(hass)
    changes = await draft(
        hass_ws_client,
        hass,
        set_rate(PRO_EM, "sensor.ups_power"),
        set_solar_rate(None),
    )
    result = await result_of(hass_ws_client, hass, stat=PRO_EM, **changes)
    assert result["power"]["circuit"] == "sensor.ups_power"
    assert result["power"]["circuit_from"] == "draft"
    # The draft removed the solar's power: the counter (lifetime) is used.
    assert result["power"]["solar"] is None
    assert result["solar_term"] == {"kind": "counter", "reuse": None}
    for change in (
        set_rate(PRO_EM, "sensor.nope"),
        set_rate(PRO_EM, "switch.x"),
        set_rate(PRO_EM, "sensor.solar_energy"),
        set_solar_rate(PRO_EM),
        set_rate(PRO_EM, SOLAR_POWER),
    ):
        response = await preview(
            hass_ws_client,
            hass,
            stat=PRO_EM,
            **await draft(hass_ws_client, hass, change),
        )
        assert response["error"]["translation_key"] == "not_offered", change


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_pairs_a_power_when_none_is_set(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A device without power gets its own device's single power sensor."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append({"stat_consumption": "sensor.printer_energy"})
    await energy_access.async_write(hass, prefs)
    result = await result_of(hass_ws_client, hass, stat="sensor.printer_energy")
    assert result["power"]["circuit"] == "sensor.printer_power"
    assert result["power"]["circuit_from"] == "paired"
    assert result["power"]["solar"] is None


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_invert_default_and_live(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The live line follows the switch; it is preselected only by a rule."""
    hass.states.async_set(MAIN_POWER, "0.1", {"unit_of_measurement": "kW"})
    result = await result_of(hass_ws_client, hass)
    assert result["invert"] is False
    assert result["live"] == {"circuit_w": 100.0, "solar_w": 300.0, "gross_w": 400.0}
    result = await result_of(hass_ws_client, hass, invert=True)
    assert result["live"] == {"circuit_w": -100.0, "solar_w": 300.0, "gross_w": 200.0}
    hass.states.async_set(SOLAR_POWER, "unavailable", {})
    hass.states.async_set(MAIN_POWER, "unavailable", {})
    result = await result_of(hass_ws_client, hass)
    assert result["live"] == {"circuit_w": None, "solar_w": 0.0, "gross_w": None}


# Kept from before the rewrite: the solar must not already be in the meter.

CIRCUIT_SUM = "sensor.circuit_sum"
# The circuit meter is a sum helper (from "Create sum meter").
WITH_SUM_DEVICE = {
    **ENERGY_PREFS,
    "device_consumption": [
        *ENERGY_PREFS["device_consumption"],
        {"stat_consumption": CIRCUIT_SUM},
    ],
}


def _group_sum(hass: HomeAssistant, entity_id: str, members: list[str]) -> None:
    entry = MockConfigEntry(
        domain="group",
        options={"group_type": "sensor", "type": "sum", "entities": members},
    )
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "group",
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )


@pytest.mark.parametrize("energy_prefs", [WITH_SUM_DEVICE])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_blocks_solar_already_in_the_meter(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A sum meter that already holds the solar would count it twice."""
    _group_sum(hass, CIRCUIT_SUM, [MAIN, SOLAR])
    response = await preview(hass_ws_client, hass, stat=CIRCUIT_SUM)
    result = response["result"]
    assert result["blocked"] == "solar_already_in_meter"
    assert result["blocked_entity"] == CIRCUIT_SUM
    response = await create(hass_ws_client, hass, stat=CIRCUIT_SUM, method="net")
    assert not response["success"]
    assert response["error"]["translation_key"] == "solar_already_in_meter"


SOLAR_INTEGRAL = "sensor.solar_integral"
GROSS_TEMPLATE = "sensor.f11_brutto"
# The solar has a power sensor; the circuit meter is a sum or a template helper.
WITH_HELPER_DEVICES = {
    **WITH_SOLAR_POWER,
    "device_consumption": [
        *ENERGY_PREFS["device_consumption"],
        {"stat_consumption": CIRCUIT_SUM},
        {"stat_consumption": GROSS_TEMPLATE},
    ],
}


def _helper(
    hass: HomeAssistant, domain: str, entity_id: str, options: dict[str, Any]
) -> None:
    """Add a helper config entry with its sensor entity."""
    entry = MockConfigEntry(domain=domain, options=options)
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        domain,
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )


def _integral(hass: HomeAssistant, entity_id: str, source: str) -> None:
    _helper(hass, "integration", entity_id, {"source": source, "method": "left"})


def _template_sensor(hass: HomeAssistant, entity_id: str, state: str) -> None:
    _helper(hass, "template", entity_id, {"template_type": "sensor", "state": state})


@pytest.mark.parametrize("energy_prefs", [WITH_HELPER_DEVICES])
@pytest.mark.usefixtures("evidence")
async def test_setup_blocked_when_sum_contains_integral_of_solar(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A sum with an integral of the solar's power already holds the solar."""
    _integral(hass, SOLAR_INTEGRAL, SOLAR_POWER)
    _group_sum(hass, CIRCUIT_SUM, [MAIN, SOLAR_INTEGRAL])
    response = await preview(hass_ws_client, hass, stat=CIRCUIT_SUM)
    assert response["result"]["blocked"] == "solar_already_in_meter"
    assert response["result"]["blocked_entity"] == CIRCUIT_SUM
    integrals = hass.config_entries.async_entries("integration")
    response = await create(hass_ws_client, hass, stat=CIRCUIT_SUM, method="net")
    assert not response["success"]
    assert response["error"]["translation_key"] == "solar_already_in_meter"
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.async_entries("integration") == integrals
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_setup_blocked_when_circuit_power_holds_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A circuit power that already adds the solar's power counts it twice."""
    _template_sensor(
        hass,
        "sensor.sum_power",
        f"{{{{ states('{MAIN_POWER}') | float + states('{SOLAR_POWER}') | float }}}}",
    )
    hass.states.async_set(
        "sensor.sum_power", "10", {"unit_of_measurement": "W", "device_class": "power"}
    )
    result = await result_of(
        hass_ws_client,
        hass,
        **await draft(hass_ws_client, hass, set_rate(MAIN, "sensor.sum_power")),
    )
    assert result["blocked"] == "solar_already_in_meter"
    assert result["blocked_entity"] == "sensor.sum_power"


@pytest.mark.parametrize("energy_prefs", [WITH_HELPER_DEVICES])
@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize("solar_input", [SOLAR_INTEGRAL, SOLAR, SOLAR_POWER])
async def test_setup_blocked_on_gross_template(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, solar_input: str
) -> None:
    """A gross template that already adds the solar would add it twice."""
    _integral(hass, SOLAR_INTEGRAL, SOLAR_POWER)
    _template_sensor(
        hass,
        GROSS_TEMPLATE,
        "{{ states('sensor.a') | float - states('sensor.b') | float"
        f" + states('{solar_input}') | float }}}}",
    )
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE)
    assert response["result"]["blocked"] == "solar_already_in_meter"
    assert response["result"]["blocked_entity"] == GROSS_TEMPLATE


MAIN_PLUS = "{{ states('sensor.main_energy') | float + "


@pytest.mark.parametrize("energy_prefs", [WITH_HELPER_DEVICES])
@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize(
    ("state", "inner"),
    [
        # Attribute style.
        (
            f"{{{{ states.sensor.main_energy.state | float + states.{SOLAR}.state }}}}",
            [],
        ),
        # Nested: the template adds a sum that holds the solar.
        (
            "{{ states('sensor.main_energy') | float + states('sensor.inner') }}",
            [SOLAR],
        ),
        # Nested: the sum holds an integral of the solar's power.
        (
            "{{ states('sensor.main_energy') | float + states('sensor.inner') }}",
            [SOLAR_INTEGRAL],
        ),
        # Spaces, line breaks, brackets, and the solar only as a literal.
        (f"{MAIN_PLUS}states( '{SOLAR}' ) | float }}}}", []),
        (f"{MAIN_PLUS}states(\n '{SOLAR}') | float }}}}", []),
        (f"{MAIN_PLUS}states['{SOLAR}'].state | float }}}}", []),
        (
            (
                f"{MAIN_PLUS}(['sensor.c','{SOLAR}'] | map('states')"
                " | map('float',0) | sum) }}"
            ),
            [],
        ),
        (
            f"{{% set e = '{SOLAR}' %}}{MAIN_PLUS}states(e) | float }}}}",
            [],
        ),
        (
            (
                f"{MAIN_PLUS}(states.sensor | selectattr('entity_id','in',"
                f"['sensor.c','{SOLAR}']) | map(attribute='state') | map('float',0)"
                " | sum) }}"
            ),
            [],
        ),
    ],
)
async def test_solar_already_in_meter_via_inputs(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    state: str,
    inner: list[str],
) -> None:
    """What a meter holds is followed through helpers and every template form."""
    _integral(hass, SOLAR_INTEGRAL, SOLAR_POWER)
    _group_sum(hass, "sensor.inner", ["sensor.kitchen_energy", *inner])
    _template_sensor(hass, GROSS_TEMPLATE, state)
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE)
    assert response["result"]["blocked"] == "solar_already_in_meter"
    assert response["result"]["blocked_entity"] == GROSS_TEMPLATE


PV_TODAY = "sensor.pv_today"
INVERTER = "sensor.inverter_total"
# The solar source is a daily utility meter (or a template) of the inverter.
WITH_DERIVED_SOLAR = {
    **WITH_HELPER_DEVICES,
    "energy_sources": [
        {**source, "stat_energy_from": PV_TODAY}
        if source["type"] == "solar"
        else source
        for source in WITH_HELPER_DEVICES["energy_sources"]
    ],
}


@pytest.mark.parametrize("energy_prefs", [WITH_DERIVED_SOLAR])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_solar_already_in_meter_via_what_the_solar_is_built_from(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A meter that adds what the solar's statistic is made of holds the solar."""
    _meter(hass, INVERTER)
    _helper(hass, "utility_meter", PV_TODAY, {"source": INVERTER, "cycle": "daily"})
    _template_sensor(hass, GROSS_TEMPLATE, f"{MAIN_PLUS}states('{INVERTER}') }}}}")
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE, solar=PV_TODAY)
    assert response["result"]["blocked"] == "solar_already_in_meter"
    assert response["result"]["blocked_entity"] == GROSS_TEMPLATE


@pytest.mark.parametrize("energy_prefs", [WITH_DERIVED_SOLAR])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_shared_input_number_does_not_hold_the_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Only sensors count: a factor both templates use is no solar."""
    _meter(hass, INVERTER)
    hass.states.async_set("input_number.factor", "1")
    _template_sensor(
        hass,
        PV_TODAY,
        f"{{{{ states('{INVERTER}') | float"
        " * states('input_number.factor') | float }}",
    )
    _template_sensor(
        hass,
        GROSS_TEMPLATE,
        f"{MAIN_PLUS}states('input_number.factor') | float }}}}",
    )
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE, solar=PV_TODAY)
    assert response["result"]["blocked"] != "solar_already_in_meter"


@pytest.mark.parametrize("energy_prefs", [WITH_DERIVED_SOLAR])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_shared_helper_sensor_does_not_hold_the_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Only energy and power sensors count: a date both templates read is no solar."""
    _meter(hass, INVERTER)
    hass.states.async_set("sensor.date", "2026-11-23")
    _template_sensor(
        hass,
        PV_TODAY,
        f"{{{{ states('{INVERTER}') | float if states('sensor.date') else 0 }}}}",
    )
    _template_sensor(
        hass,
        GROSS_TEMPLATE,
        f"{MAIN_PLUS}(1 if states('sensor.date') else 0) }}}}",
    )
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE, solar=PV_TODAY)
    assert response["result"]["blocked"] != "solar_already_in_meter"


@pytest.mark.parametrize("energy_prefs", [WITH_HELPER_DEVICES])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_setup_not_blocked_by_commented_out_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar named only in a Jinja comment is not in the meter."""
    _template_sensor(
        hass,
        GROSS_TEMPLATE,
        f"{{# old: states('{SOLAR}') #}}{{{{ states('sensor.main_energy') }}}}",
    )
    response = await preview(hass_ws_client, hass, stat=GROSS_TEMPLATE)
    assert response["result"]["blocked"] != "solar_already_in_meter"


@pytest.mark.parametrize("energy_prefs", [WITH_HELPER_DEVICES])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_setup_not_blocked_by_unrelated_template_or_integral(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Templates and integrals of other sensors do not hold the solar."""
    _integral(hass, "sensor.heat_pump_integral", MAIN_POWER)
    _integral(hass, "sensor.broken_integral", "")
    _group_sum(hass, CIRCUIT_SUM, [MAIN, "sensor.heat_pump_integral"])
    # Another sensor whose ID starts like the solar's is not the solar.
    _template_sensor(
        hass,
        GROSS_TEMPLATE,
        "{{ states('sensor.main_energy') | float"
        f" + states('{SOLAR}_yesterday') | float }}}}",
    )
    for stat in (CIRCUIT_SUM, GROSS_TEMPLATE):
        response = await preview(hass_ws_client, hass, stat=stat)
        assert response["result"]["blocked"] != "solar_already_in_meter"


@pytest.mark.parametrize("energy_prefs", [WITH_SUM_DEVICE])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_allows_a_sum_without_the_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A sum of other meters is a circuit meter like any other."""
    _group_sum(hass, CIRCUIT_SUM, [MAIN])
    response = await preview(hass_ws_client, hass, stat=CIRCUIT_SUM)
    assert response["result"]["blocked"] != "solar_already_in_meter"


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_reports_disabled_returned_sensor(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A disabled returned sensor is named; the setup never enables it."""
    _returned(hass, disabled=True)
    result = await result_of(hass_ws_client, hass, method="em")
    assert result["returned"] == RETURNED
    assert result["returned_candidates"] == [{"entity": RETURNED, "disabled": True}]
    assert result["blocked"] == "returned_disabled"
    assert result["blocked_entity"] == RETURNED
    entry = er.async_get(hass).async_get(RETURNED)
    assert entry is not None
    assert entry.disabled
    # As a net meter it can still be set up.
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] is None


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_asks_for_a_returned_sensor_without_preselection(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Two returned sensors and no channel to tell them apart: none is chosen."""
    _returned(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "test",
        "main-export-2",
        suggested_object_id="main_export_2",
        device_id=_device_of(hass, MAIN),
        original_device_class="energy",
        translation_key="energy_exported",
    )
    result = await result_of(hass_ws_client, hass, method="em")
    assert result["returned"] is None
    assert len(result["returned_candidates"]) == 2
    assert result["blocked"] == "choose_returned"
    result = await result_of(hass_ws_client, hass, method="em", returned=RETURNED)
    assert result["blocked"] is None


@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize(
    ("change", "entity"),
    [
        ({MAIN: {"unit_of_measurement": "%"}}, MAIN),
        ({SOLAR: {"unit_of_measurement": "%"}}, SOLAR),
    ],
)
async def test_preview_blocks_inputs_without_unit(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    change: dict[str, dict[str, Any]],
    entity: str,
) -> None:
    """An input without an energy unit cannot be read into kWh."""
    for entity_id, attributes in change.items():
        hass.states.async_set(entity_id, "1", attributes)
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "unsupported_input"
    assert result["blocked_entity"] == entity


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_power_without_unit(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A power without a power unit is left out, a solar one stops the setup.

    Without the circuit's: no "From power" and no gross power.
    """
    hass.states.async_set(MAIN_POWER, "1", {"unit_of_measurement": "%"})
    result = await result_of(hass_ws_client, hass, method="net")
    assert methods(result)["power"] == (False, False, "unusable_power")
    assert [h["role"] for h in result["helpers"]] == [
        "solar_power",
        "solar_energy",
        "energy",
    ]
    assert result["blocked"] is None
    hass.states.async_set(SOLAR_POWER, "1", {"unit_of_measurement": "%"})
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "unsupported_input"
    assert result["blocked_entity"] == SOLAR_POWER


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_waits_for_an_unavailable_net_meter(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A net meter can be below 0: without its value the start is unknown.

    An unavailable input keeps the unit its registry entry knows, so the
    reason is the missing value, not the unit.
    """
    hass.states.async_set(MAIN, "unavailable", {})
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "input_not_ready"
    assert result["blocked_entity"] == MAIN
    hass.states.async_remove(MAIN)
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "input_not_ready"
    response = await create(hass_ws_client, hass, method="net")
    assert response["error"]["translation_key"] == "input_not_ready"
    assert response["error"]["translation_placeholders"] == {"entity_id": MAIN}
    assert hass.config_entries.async_entries("template") == []


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_unavailable_added_inputs_count_as_zero(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar counter offline at night, or a drawn meter, only adds.

    Counted as 0 the offset can only get larger, never start below 0. The
    returned energy is subtracted: without it the start is unknown.
    """
    hass.states.async_set(SOLAR, "unavailable", {})
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] is None
    assert result["offset"] == 0
    hass.states.async_set(MAIN, "-50", {"unit_of_measurement": "kWh"})
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["offset"] == 200

    _returned(hass)
    hass.states.async_set(MAIN, "unavailable", {})
    result = await result_of(hass_ws_client, hass, method="em")
    assert result["blocked"] is None
    # 0 - 2 + 0: lifted to the floor.
    assert result["offset"] == 200
    hass.states.async_set(RETURNED, "unknown", {})
    result = await result_of(hass_ws_client, hass, method="em")
    assert result["blocked"] == "input_not_ready"
    assert result["blocked_entity"] == RETURNED


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_external_statistic_is_unsupported(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An external statistic has no state a template could read."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append({"stat_consumption": "tibber:energy"})
    await energy_access.async_write(hass, prefs)
    result = await result_of(hass_ws_client, hass, stat="tibber:energy")
    assert methods(result)["net"] == (False, False, "unsupported_input")
    assert result["blocked"] == "unsupported_input"
    assert result["blocked_entity"] == "tibber:energy"


@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize(
    ("msg", "key", "placeholders"),
    [
        ({"stat": "sensor.nope"}, "unknown_device", {"stat": "sensor.nope"}),
        ({"stat": SOLAR}, "unknown_device", {"stat": SOLAR}),
        (
            {"solar": "sensor.grid_import"},
            "unknown_source",
            {"stat": "sensor.grid_import"},
        ),
        (
            {"solar": MAIN},
            "unknown_source",
            {"stat": MAIN},
        ),
        ({"drawn": "sensor.kitchen_energy"}, "not_offered", None),
        ({"returned": "sensor.grid_export"}, "not_offered", None),
    ],
)
async def test_preview_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    msg: dict[str, str],
    key: str,
    placeholders: dict[str, str] | None,
) -> None:
    """Only an electricity device, a solar source and offered sensors."""
    response = await preview(hass_ws_client, hass, **msg)
    assert response["error"]["translation_key"] == key
    if placeholders is not None:
        assert response["error"]["translation_placeholders"] == placeholders


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_schema_refuses_unknown_method(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    response = await preview(hass_ws_client, hass, method="both")
    assert response["error"]["code"] == "invalid_format"


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER, ENERGY_PREFS])
async def test_setup_blocked_when_the_probe_fails(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A busy recorder stops the setup with a retry reason, not silently."""

    async def busy(*args: Any, **kwargs: Any) -> None:
        return None  # the statistics query on a timeout or failure

    monkeypatch.setattr(solar_setup, "async_probe", busy)
    result = await result_of(hass_ws_client, hass)
    assert result["blocked"] == "daily_check_failed"
    assert result["blocked_entity"] == MAIN
    assert result["evidence"] == {}
    response = await create(hass_ws_client, hass, method="power")
    assert response["error"]["translation_key"] == "daily_check_failed"
    assert hass.config_entries.async_entries("template") == []
    assert loaded_entry.runtime_data.helpers.entries() == []


# --- Create ----------------------------------------------------------------


async def create(
    hass_ws_client: WebSocketGenerator, hass: HomeAssistant, **msg: Any
) -> dict[str, Any]:
    """Create with the offset the preview shows, as the panel does."""
    msg = {"stat": MAIN, "solar": SOLAR, "method": "net"} | msg
    if "offset" not in msg:
        shown = await preview(
            hass_ws_client,
            hass,
            **{key: value for key, value in msg.items() if key != "names"},
        )
        msg["offset"] = shown["result"]["offset"] if shown["success"] else 0
    return await send(hass_ws_client, hass, type=f"{DOMAIN}/create_solar_setup", **msg)


def _entity_of(hass: HomeAssistant, entry_id: str) -> str:
    return er.async_entries_for_config_entry(er.async_get(hass), entry_id)[0].entity_id


def _template_entries(hass: HomeAssistant) -> dict[str, Any]:
    return {e.title: e for e in hass.config_entries.async_entries("template")}


def _poe(hass: HomeAssistant) -> list[Any]:
    """Return the integral the test setup has from the start."""
    return [
        e
        for e in hass.config_entries.async_entries("integration")
        if e.title == "PoE energy"
    ]


def _solar_integral(hass: HomeAssistant) -> str:
    """Return the entity of the (single) integral of the solar's power template."""
    template = next(
        e
        for e in hass.config_entries.async_entries("template")
        if e.options["state"] == solar_power_template(SOLAR_POWER)
    )
    template_entity = _entity_of(hass, template.entry_id)
    integral = next(
        e
        for e in hass.config_entries.async_entries("integration")
        if e.options.get("source") == template_entity
    )
    return _entity_of(hass, integral.entry_id)


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("evidence")
async def test_create_em_template_state_class_total(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """EM: drawn - returned + solar term, `total`, and the gross power."""
    _shelly_pro_em(hass)
    response = await create(hass_ws_client, hass, stat=PRO_EM, method="em")
    assert response["success"], response
    await hass.async_block_till_done()
    templates = _template_entries(hass)
    energy, power = templates["Pro EM gross"], templates["Pro EM gross power"]
    assert energy.options["state_class"] == "total"
    assert energy.options["unit_of_measurement"] == "kWh"
    assert energy.options["device_class"] == "energy"
    integral = _solar_integral(hass)
    assert energy.options["state"] == gross_energy_template(
        Method.EM, PRO_EM, integral, PRO_EM_RETURNED
    )
    assert power.options["state"] == gross_power_template(PRO_EM_POWER, SOLAR_POWER)
    assert power.options["state_class"] == "measurement"
    result = response["result"]
    assert result == {
        "entity_id": _entity_of(hass, energy.entry_id),
        "stat_rate": _entity_of(hass, power.entry_id),
    }
    helpers = loaded_entry.runtime_data.helpers
    records = helpers.records()
    assert records[energy.entry_id] == {
        "kind": "gross_energy",
        "stat": PRO_EM,
        "method": "em",
        "power": power.entry_id,
    }
    assert records[power.entry_id] == {
        "kind": "gross_power",
        "stat": PRO_EM,
        "method": "em",
    }
    assert len(helpers.entries()) == 4


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_create_template_unit_aware_wh_and_kwh(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A unit change of an input (Wh to kWh) does not move the gross meter."""
    _shelly_pro_em(hass)
    hass.states.async_set(
        PRO_EM_RETURNED,
        "20000",
        {"unit_of_measurement": "Wh", "device_class": "energy"},
    )
    response = await create(hass_ws_client, hass, stat=PRO_EM, method="em")
    assert response["success"], response
    gross = response["result"]["entity_id"]
    hass.states.async_set(_solar_integral(hass), "1.5", {"unit_of_measurement": "kWh"})
    await hass.async_block_till_done()
    before = hass.states.get(gross)
    assert before is not None
    assert float(before.state) == pytest.approx(500 - 20 + 1.5)
    hass.states.async_set(
        PRO_EM_RETURNED, "20", {"unit_of_measurement": "kWh", "device_class": "energy"}
    )
    await hass.async_block_till_done()
    after = hass.states.get(gross)
    assert after is not None
    assert after.state == before.state


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_solar_term_integral_of_zero_mapped_power(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """The solar term: an integral of the solar's power that is 0 when offline."""
    response = await create(
        hass_ws_client,
        hass,
        method="net",
        names={"solar_power": "PV 0", "solar_energy": "PV energy"},
    )
    assert response["success"], response
    await hass.async_block_till_done()
    template = _template_entries(hass)["PV 0"]
    assert template.options["state"] == solar_power_template(SOLAR_POWER)
    assert template.options["unit_of_measurement"] == "W"
    template_entity = _entity_of(hass, template.entry_id)
    integral = next(
        e
        for e in hass.config_entries.async_entries("integration")
        if e.title == "PV energy"
    )
    assert integral.options["source"] == template_entity
    assert integral.options["method"] == "left"
    assert integral.options["unit_prefix"] == "k"
    integral_entity = _entity_of(hass, integral.entry_id)
    energy = _template_entries(hass)["Main gross"]
    assert energy.options["state"] == gross_energy_template(
        Method.NET, MAIN, integral_entity
    )
    # Offline at night: the solar term reads 0, never unknown.
    hass.states.async_set(SOLAR_POWER, "unavailable", {})
    await hass.async_block_till_done()
    state = hass.states.get(template_entity)
    assert state is not None
    assert float(state.state) == 0
    records = loaded_entry.runtime_data.helpers.records()
    assert records[template.entry_id] == {"kind": "solar_power", "power": SOLAR_POWER}
    assert records[integral.entry_id] == {
        "kind": "solar_energy",
        "power": SOLAR_POWER,
        "template": template.entry_id,
    }


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_solar_term_reused_for_second_setup(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A second circuit with the same solar reuses its solar term."""
    response = await create(hass_ws_client, hass, method="net")
    assert response["success"], response
    integral = _solar_integral(hass)
    hass.states.async_set(integral, "12.5", {"unit_of_measurement": "kWh"})
    count = len(loaded_entry.runtime_data.helpers.entries())

    result = await result_of(
        hass_ws_client, hass, stat="sensor.garage_energy", method="net"
    )
    assert result["solar_term"] == {"kind": "integral", "reuse": integral}
    assert [h["role"] for h in result["helpers"]] == ["energy"]
    response = await create(
        hass_ws_client,
        hass,
        stat="sensor.garage_energy",
        method="net",
        names={"energy": "Garage gross"},
    )
    assert response["success"], response
    energy = _template_entries(hass)["Garage gross"]
    assert energy.options["state"] == gross_energy_template(
        Method.NET, "sensor.garage_energy", integral, offset=100
    )
    assert len(loaded_entry.runtime_data.helpers.entries()) == count + 1

    # A solar term edited by hand is not reused.
    template = next(
        e
        for e in hass.config_entries.async_entries("template")
        if e.options["state"] == solar_power_template(SOLAR_POWER)
    )
    hass.config_entries.async_update_entry(
        template, options={**template.options, "state": "{{ 1 }}"}
    )
    result = await result_of(
        hass_ws_client, hass, stat="sensor.kitchen_energy", method="net"
    )
    assert result["solar_term"] == {"kind": "integral", "reuse": None}


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_offset_from_used_values_new_integral_zero(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The offset uses what the template reads: a new solar integral is 0.

    50 - 300 + 0 starts at -250 kWh, though the solar counter says 5000.
    """
    _returned(hass)
    hass.states.async_set(MAIN, "50", {"unit_of_measurement": "kWh"})
    hass.states.async_set(RETURNED, "300000", {"unit_of_measurement": "Wh"})
    hass.states.async_set(SOLAR, "5000", {"unit_of_measurement": "kWh"})
    result = await result_of(hass_ws_client, hass, method="em", returned=RETURNED)
    assert result["offset"] == 400
    response = await create(hass_ws_client, hass, method="em", returned=RETURNED)
    assert response["success"], response
    state = _template_entries(hass)["Main gross"].options["state"]
    assert state == gross_energy_template(
        Method.EM, MAIN, _solar_integral(hass), RETURNED, offset=400
    )
    hass.states.async_set(_solar_integral(hass), "0", {"unit_of_measurement": "kWh"})
    assert render(hass, state) == 150.0


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_create_refuses_values_changed(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """An offset that is no longer enough is refused; the panel asks again."""
    _returned(hass)
    result = await result_of(hass_ws_client, hass, method="em")
    assert result["offset"] == 0
    # 1000 - 1950 + 0 now needs 1100.
    hass.states.async_set(RETURNED, "1950", {"unit_of_measurement": "kWh"})
    for offset in (0, 1000, 1150):
        response = await create(hass_ws_client, hass, method="em", offset=offset)
        assert response["error"]["translation_key"] == "values_changed"
    assert hass.config_entries.async_entries("template") == []
    assert loaded_entry.runtime_data.helpers.entries() == []
    # The new offset, or a larger one, is enough.
    response = await create(hass_ws_client, hass, method="em", offset=1200)
    assert response["success"], response
    state = _template_entries(hass)["Main gross"].options["state"]
    assert state.endswith("+ 1200) | round(3) }}{% else %}{{ none }}{% endif %}")


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
@pytest.mark.parametrize(
    "msg",
    [
        {"method": "em", "returned": "sensor.grid_export"},
        {"method": "em"},
        {"method": "net", "drawn": "sensor.kitchen_energy"},
        {"method": "net", "changes": [set_rate(MAIN, "sensor.nope")]},
    ],
)
async def test_create_refuses_not_offered_returned(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    msg: dict[str, Any],
) -> None:
    """Choices outside the preview's lists are refused; nothing is created."""
    if "changes" in msg:
        msg = msg | await draft(hass_ws_client, hass, *msg["changes"])
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_solar_setup",
        stat=MAIN,
        solar=SOLAR,
        offset=0,
        **msg,
    )
    assert response["error"]["translation_key"] == "not_offered"
    assert hass.config_entries.async_entries("template") == []
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.usefixtures("evidence")
async def test_create_with_draft_solar_rate(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A solar power set in the panel only is used for the solar term."""
    changes = await draft(hass_ws_client, hass, set_solar_rate(SOLAR_POWER))
    result = await result_of(hass_ws_client, hass, method="power", **changes)
    assert result["power"]["solar_from"] == "draft"
    assert result["power"]["circuit_from"] == "saved"
    response = await create(hass_ws_client, hass, method="net", **changes)
    assert response["success"], response
    integral = _solar_integral(hass)
    energy = _template_entries(hass)["Main gross"]
    assert energy.options["state"] == gross_energy_template(Method.NET, MAIN, integral)
    assert response["result"]["stat_rate"] is not None


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_power_method_invert(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """From power: an integral of (-circuit + solar), no solar term, no offset."""
    hass.states.async_set(MAIN_POWER, "150", {"unit_of_measurement": "W"})
    response = await create(hass_ws_client, hass, method="power", invert=True, offset=0)
    assert response["success"], response
    await hass.async_block_till_done()
    power = _template_entries(hass)["Main gross power"]
    assert power.options["state"] == gross_power_template(
        MAIN_POWER, SOLAR_POWER, invert=True
    )
    assert set(_template_entries(hass)) == {"Main gross power"}
    stat_rate = _entity_of(hass, power.entry_id)
    state = hass.states.get(stat_rate)
    assert state is not None
    assert float(state.state) == 150.0
    integral = next(
        e
        for e in hass.config_entries.async_entries("integration")
        if e.options.get("source") == stat_rate
    )
    assert integral.title == "Main gross"
    assert integral.options["unit_prefix"] == "k"
    assert response["result"] == {
        "entity_id": _entity_of(hass, integral.entry_id),
        "stat_rate": stat_rate,
    }
    records = loaded_entry.runtime_data.helpers.records()
    assert records[integral.entry_id]["kind"] == "gross_energy"
    assert records[integral.entry_id]["power"] == power.entry_id
    assert records[integral.entry_id]["method"] == "power"


@pytest.mark.usefixtures("evidence")
async def test_create_without_circuit_power_has_no_gross_power(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """Without both power sensors only the energy template is created."""
    response = await create(
        hass_ws_client,
        hass,
        stat="sensor.kitchen_energy",
        names={"energy": " Kitchen gross "},
    )
    assert response["success"], response
    assert response["result"]["stat_rate"] is None
    assert set(_template_entries(hass)) == {"Kitchen gross"}
    assert len(loaded_entry.runtime_data.helpers.entries()) == 1


@pytest.mark.usefixtures("evidence")
async def test_create_refused_when_blocked(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A blocked setup creates nothing and names the reason."""
    _returned(hass, disabled=True)
    response = await create(hass_ws_client, hass, method="em")
    assert response["error"]["translation_key"] == "returned_disabled"
    assert response["error"]["translation_placeholders"] == {"entity_id": RETURNED}
    assert hass.config_entries.async_entries("template") == []
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
@pytest.mark.parametrize("failing", [1, 2, 3])
async def test_solar_setup_rolls_back_on_failure(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
    failing: int,
) -> None:
    """A failing template removes every helper of the request and forgets it."""
    original = solar_setup.async_create_template
    calls = 0

    async def fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == failing:
            raise template_module._failed()
        return await original(*args, **kwargs)

    monkeypatch.setattr(solar_setup, "async_create_template", fails)
    response = await create(hass_ws_client, hass, method="net")
    assert response["error"]["translation_key"] == "template_failed"
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.async_entries("integration") == _poe(hass)
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_rollback_keeps_a_reused_solar_term(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failure removes only what this request made, not the reused term."""
    response = await create(hass_ws_client, hass, method="net")
    assert response["success"], response
    before = loaded_entry.runtime_data.helpers.entries()

    async def fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        raise template_module._failed()

    monkeypatch.setattr(solar_setup, "async_create_template", fails)
    response = await create(hass_ws_client, hass, stat="sensor.garage_energy")
    assert response["error"]["translation_key"] == "template_failed"
    assert loaded_entry.runtime_data.helpers.entries() == before


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_rollback_goes_on_when_a_removal_fails(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Every helper is still removed and the first error is the one raised."""
    original_template = solar_setup.async_create_template
    calls = 0

    async def third_fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise template_module._failed()
        return await original_template(*args, **kwargs)

    original_remove = hass.config_entries.async_remove
    refused: list[str] = []

    async def remove(entry_id: str) -> Any:
        entry = hass.config_entries.async_get_entry(entry_id)
        if entry is not None and entry.domain == "template":
            refused.append(entry_id)
            raise RuntimeError("busy")
        return await original_remove(entry_id)

    original_discard = loaded_entry.runtime_data.helpers.async_discard

    async def discard(entry_id: str) -> None:
        raise OSError("disk full")

    monkeypatch.setattr(solar_setup, "async_create_template", third_fails)
    monkeypatch.setattr(hass.config_entries, "async_remove", remove)
    monkeypatch.setattr(loaded_entry.runtime_data.helpers, "async_discard", discard)
    response = await create(hass_ws_client, hass, method="net")
    assert response["error"]["translation_key"] == "template_failed"
    # The templates could not be removed; they stay recorded as ours.
    # The integral was removed even though forgetting it failed.
    assert sorted(
        e.entry_id for e in hass.config_entries.async_entries("template")
    ) == sorted(refused)
    assert hass.config_entries.async_entries("integration") == _poe(hass)
    assert "busy" in caplog.text
    assert "disk full" in caplog.text
    monkeypatch.setattr(
        loaded_entry.runtime_data.helpers, "async_discard", original_discard
    )


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_solar_setup_rolls_back_a_failed_integral(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The gross integral failing removes the gross power and the solar term."""

    async def fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        raise integral_module._failed()

    monkeypatch.setattr(solar_setup, "async_create_integral", fails)
    response = await create(hass_ws_client, hass, method="power")
    assert response["error"]["translation_key"] == "integral_failed"
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.async_entries("integration") == _poe(hass)
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_create_cancelled_cleans_up(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cancelled request removes what it made (shielded), then is cancelled."""
    original = solar_setup.async_create_template
    calls = 0

    async def cancelled(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise asyncio.CancelledError
        return await original(*args, **kwargs)

    monkeypatch.setattr(solar_setup, "async_create_template", cancelled)
    helpers = loaded_entry.runtime_data.helpers
    prefs = await energy_access.async_get_prefs(hass)
    plan = await solar_setup.async_plan(
        hass, prefs, helpers, Choices(stat=MAIN, solar=SOLAR, method=Method.NET)
    )
    with pytest.raises(asyncio.CancelledError):
        await solar_setup.async_create(hass, helpers, plan, {}, plan.offset)
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.async_entries("integration") == _poe(hass)
    assert helpers.entries() == []


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    "msg",
    [
        {"type": f"{DOMAIN}/solar_setup_preview", "stat": "x", "solar": "y"},
        {
            "type": f"{DOMAIN}/create_solar_setup",
            "stat": "x",
            "solar": "y",
            "method": "net",
            "offset": 0,
        },
    ],
)
async def test_solar_setup_admin_only(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    msg: dict[str, Any],
) -> None:
    """Both commands need an admin."""
    response = await send(hass_ws_client, hass, hass_read_only_access_token, **msg)
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("evidence")
async def test_solar_term_not_reused_when_missing_or_disabled(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A solar term with a disabled integral or a missing template is not reused.

    A record of another solar's term is skipped.
    """
    await loaded_entry.runtime_data.helpers.async_add(
        "other", {"kind": "solar_energy", "power": "sensor.other_power"}
    )
    response = await create(hass_ws_client, hass, method="net")
    assert response["success"], response
    integral = _solar_integral(hass)
    er.async_get(hass).async_update_entity(
        integral, disabled_by=er.RegistryEntryDisabler.USER
    )
    result = await result_of(hass_ws_client, hass, stat="sensor.garage_energy")
    assert result["solar_term"] == {"kind": "integral", "reuse": None}
    er.async_get(hass).async_update_entity(integral, disabled_by=None)
    result = await result_of(hass_ws_client, hass, stat="sensor.garage_energy")
    assert result["solar_term"]["reuse"] == integral
    template = next(
        e
        for e in hass.config_entries.async_entries("template")
        if e.options["state"] == solar_power_template(SOLAR_POWER)
    )
    await hass.config_entries.async_remove(template.entry_id)
    result = await result_of(hass_ws_client, hass, stat="sensor.garage_energy")
    assert result["solar_term"]["reuse"] is None


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_returned_without_energy_unit_is_not_offered(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A returned sensor a template cannot read in kWh leaves out EM and Plug."""
    _returned(hass)
    hass.states.async_set(RETURNED, "2", {"unit_of_measurement": "%"})
    result = await result_of(hass_ws_client, hass, method="em")
    assert methods(result)["em"] == (False, False, "unsupported_input")
    assert result["blocked"] == "not_offered"
    assert result["blocked_entity"] == RETURNED


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_power_method_not_offered_without_power(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """From power, asked for without the solar's power, is not offered."""
    result = await result_of(hass_ws_client, hass, method="power")
    assert methods(result)["power"] == (False, False, "no_power")
    assert result["blocked"] == "not_offered"
    assert result["blocked_entity"] == MAIN_POWER


@pytest.mark.usefixtures("evidence")
async def test_create_needs_a_method(
    hass: HomeAssistant, loaded_entry: MockConfigEntry
) -> None:
    """Without a chosen or suggested method nothing is created."""
    helpers = loaded_entry.runtime_data.helpers
    prefs = await energy_access.async_get_prefs(hass)
    plan = await solar_setup.async_plan(
        hass, prefs, helpers, Choices(stat="sensor.kitchen_energy", solar=SOLAR)
    )
    assert plan.method is None
    with pytest.raises(ServiceValidationError) as err:
        await solar_setup.async_create(hass, helpers, plan, {}, 0)
    assert err.value.translation_key == "not_offered"


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_invert_preselected_by_rule(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A power known to be positive on export (Huawei) is turned around."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        "huawei_solar",
        "HV1_power_meter_active_power",
        suggested_object_id="meter_active_power",
        original_device_class="power",
        unit_of_measurement="W",
    )
    hass.states.async_set(
        "sensor.meter_active_power",
        "100",
        {"unit_of_measurement": "W", "device_class": "power"},
    )
    result = await result_of(
        hass_ws_client,
        hass,
        **await draft(
            hass_ws_client, hass, set_rate(MAIN, "sensor.meter_active_power")
        ),
    )
    assert result["invert"] is True
    assert result["live"]["circuit_w"] == -100.0


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_preview_pairs_the_solars_power(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar without power gets its own device's single power sensor."""
    prefs = deepcopy(ENERGY_PREFS)
    for source in prefs["energy_sources"]:
        if source["type"] == "solar":
            source["stat_energy_from"] = "sensor.printer_energy"
    await energy_access.async_write(hass, prefs)
    result = await result_of(hass_ws_client, hass, solar="sensor.printer_energy")
    assert result["power"]["solar"] == "sensor.printer_power"
    assert result["power"]["solar_from"] == "paired"
    assert result["solar_term"] == {"kind": "integral", "reuse": None}


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_disabled_power_sensors(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A disabled power has no state: never 0 for the solar, never a circuit."""
    registry = er.async_get(hass)
    registry.async_update_entity(MAIN_POWER, disabled_by=er.RegistryEntryDisabler.USER)
    hass.states.async_remove(MAIN_POWER)
    result = await result_of(hass_ws_client, hass, method="net")
    assert methods(result)["power"] == (False, False, "unusable_power")
    assert "power" not in [h["role"] for h in result["helpers"]]
    assert result["blocked"] is None
    registry.async_update_entity(SOLAR_POWER, disabled_by=er.RegistryEntryDisabler.USER)
    hass.states.async_remove(SOLAR_POWER)
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "input_disabled"
    assert result["blocked_entity"] == SOLAR_POWER


# --- Fix round 1 -------------------------------------------------------------


def _template_helper(hass: HomeAssistant, name: str, state: str) -> MockConfigEntry:
    entry = MockConfigEntry(
        domain="template",
        title=name,
        options={
            "name": name,
            "template_type": "sensor",
            "state": state,
            "unit_of_measurement": "W",
            "device_class": "power",
            "state_class": "measurement",
        },
    )
    entry.add_to_hass(hass)
    return entry


async def _set_up(hass: HomeAssistant, entry: MockConfigEntry) -> str:
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return _entity_of(hass, entry.entry_id)


def _number(hass: HomeAssistant, entity_id: str) -> float:
    state = hass.states.get(entity_id)
    assert state is not None
    return float(state.state)


async def _minutes(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, minutes: int
) -> list[float]:
    """Let time pass a minute at a time; return the integral's values."""
    values = []
    for _ in range(minutes):
        freezer.tick(timedelta(minutes=1))
        async_fire_time_changed(hass)
        await hass.async_block_till_done()
        values.append(_number(hass, "sensor.gross"))
    return values


@pytest.mark.parametrize("invert", [False, True])
async def test_from_power_never_falls_in_a_solar_dropout(
    hass: HomeAssistant, freezer: FrozenDateTimeFactory, invert: bool
) -> None:
    """Circuit -400 W, solar 600 W, the solar offline for 10 of 30 minutes.

    The gross power is unknown while the solar is offline and the circuit
    feeds in; Home Assistant's integral counts no area for it and stays
    available, so the gross energy never falls below its start.
    """
    _set(hass, "sensor.c", "400" if invert else "-400", "W")
    _set(hass, "sensor.p", "590", "W")
    power = await _set_up(
        hass,
        _template_helper(
            hass, "gp", gross_power_template("sensor.c", "sensor.p", invert=invert)
        ),
    )
    integral = MockConfigEntry(
        domain="integration",
        title="gross",
        options={"name": "gross", "source": power, **INTEGRAL_OPTIONS},
    )
    integral.add_to_hass(hass)
    assert await _set_up(hass, integral) == "sensor.gross"
    # The integral starts counting at its source's first change.
    freezer.tick(timedelta(minutes=1))
    _set(hass, "sensor.p", "600", "W")
    await hass.async_block_till_done()
    await _minutes(hass, freezer, 6)
    start = _number(hass, "sensor.gross")
    before = await _minutes(hass, freezer, 10)
    _set(hass, "sensor.p", "unavailable", "W")
    await hass.async_block_till_done()
    gap = await _minutes(hass, freezer, 10)
    _set(hass, "sensor.p", "600", "W")
    await hass.async_block_till_done()
    after = await _minutes(hass, freezer, 10)
    values = before + gap + after
    assert min(values) >= start
    assert values == sorted(values)
    assert values[-1] > start


SOLAR_COUNTER_CASES = [
    pytest.param(_series([0.0] * 72), "solar_needs_data", id="flat_three_days"),
    pytest.param(
        _series([float(hour) for hour in range(8)], DAY_1 + timedelta(hours=8)),
        "solar_needs_data",
        id="eight_hours_one_day",
    ),
    pytest.param([], "solar_needs_data", id="no_series"),
    pytest.param(RISING, None, id="rising_three_days"),
]


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(("series", "blocked"), SOLAR_COUNTER_CASES)
async def test_solar_counter_needs_data(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    evidence: Evidence,
    series: list[Any],
    blocked: str | None,
) -> None:
    """Without power the counter must rise in the window, on 2 days or more."""
    evidence[SOLAR] = lifetime(series=series)
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == blocked
    if blocked:
        assert result["blocked_entity"] == SOLAR
        assert result["solar_term"]["kind"] is None
    else:
        assert result["solar_term"]["kind"] == "counter"


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_net_not_offered_for_a_total_increasing_meter(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """HA reads every fall of such a meter as a reset: Net would count export."""
    state = hass.states.get(MAIN)
    assert state is not None
    hass.states.async_set(
        MAIN, "1000", {**state.attributes, "state_class": "total_increasing"}
    )
    result = await result_of(hass_ws_client, hass)
    assert methods(result)["net"] == (False, False, "net_needs_signed_meter")
    result = await result_of(hass_ws_client, hass, method="net")
    assert result["blocked"] == "not_offered"
    # From the registry when there is no state.
    er.async_get(hass).async_update_entity(
        MAIN, capabilities={"state_class": "total_increasing"}
    )
    hass.states.async_remove(MAIN)
    result = await result_of(hass_ws_client, hass)
    assert methods(result)["net"] == (False, False, "net_needs_signed_meter")


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry")
async def test_circuit_input_without_statistics_is_not_verified(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, evidence: Evidence
) -> None:
    """No statistics: not verified, unless the user says it is no daily meter."""
    _shelly_pro_em(hass)
    evidence[PRO_EM] = NO_DATA
    result = await result_of(hass_ws_client, hass, stat=PRO_EM)
    assert methods(result)["em"] == (True, False, "unverified_no_data")
    result = await result_of(
        hass_ws_client, hass, stat=PRO_EM, periodic={PRO_EM: False}
    )
    assert methods(result)["em"] == (True, True, "rule_shelly_em")


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_removed_power_is_not_paired_again(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A power removed in the draft means no power; it is not paired back."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append(
        {
            "stat_consumption": "sensor.printer_energy",
            "stat_rate": "sensor.printer_power",
        }
    )
    await energy_access.async_write(hass, prefs)
    changes = await draft(hass_ws_client, hass, set_rate("sensor.printer_energy", None))
    result = await result_of(
        hass_ws_client, hass, stat="sensor.printer_energy", **changes
    )
    assert result["power"]["circuit"] is None
    assert result["power"]["circuit_from"] is None


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_circuit_pairing_never_takes_the_solars_power(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The solar's own power on the circuit's device is no circuit power."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append({"stat_consumption": "sensor.printer_energy"})
    for source in prefs["energy_sources"]:
        if source["type"] == "solar":
            source["stat_rate"] = "sensor.printer_power"
    await energy_access.async_write(hass, prefs)
    result = await result_of(hass_ws_client, hass, stat="sensor.printer_energy")
    assert result["power"]["circuit"] is None
    assert result["power"]["solar"] == "sensor.printer_power"


@pytest.mark.usefixtures("evidence")
async def test_draft_power_used_elsewhere_or_ours_is_refused(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A power of another device, or a gross helper of ours, is no draft power."""
    prefs = deepcopy(ENERGY_PREFS)
    for device in prefs["device_consumption"]:
        if device["stat_consumption"] == "sensor.garage_energy":
            device["stat_rate"] = "sensor.ups_power"
    await energy_access.async_write(hass, prefs)
    response = await preview(
        hass_ws_client,
        hass,
        **await draft(hass_ws_client, hass, set_rate(MAIN, "sensor.ups_power")),
    )
    assert response["error"]["translation_key"] == "not_offered"
    # Saved like that it is the user's own setting and stays.
    response = await preview(hass_ws_client, hass, stat="sensor.garage_energy")
    assert response["success"], response

    entry = MockConfigEntry(domain="template", options={})
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "template",
        entry.entry_id,
        suggested_object_id="gross_power_ours",
        config_entry=entry,
        original_device_class="power",
    )
    hass.states.async_set(
        "sensor.gross_power_ours",
        "5",
        {"device_class": "power", "unit_of_measurement": "W"},
    )
    await loaded_entry.runtime_data.helpers.async_add(
        entry.entry_id, {"kind": "gross_power", "stat": "x", "method": "em"}
    )
    for change in (
        set_rate("sensor.kitchen_energy", "sensor.gross_power_ours"),
        set_solar_rate("sensor.gross_power_ours"),
    ):
        response = await preview(
            hass_ws_client,
            hass,
            stat="sensor.kitchen_energy",
            **await draft(hass_ws_client, hass, change),
        )
        assert response["error"]["translation_key"] == "not_offered", change


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_em_verified_only_with_the_rules_returned_sensor(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Another channel's returned sensor gives "not verified"."""
    _shelly_pro_em(hass)
    _shelly(
        hass,
        "sensor.pro_em_returned_1",
        _device_of(hass, PRO_EM),
        f"{MAC}-em1data:1-total_act_ret_energy",
        translation_key="energy_returned",
    )
    result = await result_of(hass_ws_client, hass, stat=PRO_EM)
    assert result["returned"] == PRO_EM_RETURNED
    assert methods(result)["em"] == (True, True, "rule_shelly_em")
    result = await result_of(
        hass_ws_client, hass, stat=PRO_EM, returned="sensor.pro_em_returned_1"
    )
    assert methods(result)["em"] == (True, False, "unverified_against_rule")


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize(
    ("domain", "option", "value"),
    [
        ("template", "unit_of_measurement", "kW"),
        ("template", "state_class", "total"),
        ("template", "device_class", "energy"),
        ("integration", "round", 1),
        ("integration", "unit_prefix", "M"),
        ("integration", "unit_time", "min"),
        ("integration", "max_sub_interval", {"hours": 1, "minutes": 0, "seconds": 0}),
    ],
)
async def test_solar_term_changed_by_hand_is_not_reused(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    domain: str,
    option: str,
    value: Any,
) -> None:
    """Any option of the pair that differs from ours: a new pair is made."""
    response = await create(hass_ws_client, hass, method="net")
    assert response["success"], response
    template = next(
        e
        for e in hass.config_entries.async_entries("template")
        if e.options["state"] == solar_power_template(SOLAR_POWER)
    )
    template_entity = _entity_of(hass, template.entry_id)
    entry = (
        template
        if domain == "template"
        else next(
            e
            for e in hass.config_entries.async_entries("integration")
            if e.options.get("source") == template_entity
        )
    )
    hass.config_entries.async_update_entry(
        entry, options={**entry.options, option: value}
    )
    await hass.async_block_till_done()
    result = await result_of(hass_ws_client, hass, stat="sensor.garage_energy")
    assert result["solar_term"] == {"kind": "integral", "reuse": None}


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_paired_power_holding_the_solar_is_dropped(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A paired power that holds the solar only leaves out the gross power."""
    config = MockConfigEntry(domain="test")
    config.add_to_hass(hass)
    device = (
        dr.async_get(hass)
        .async_get_or_create(
            config_entry_id=config.entry_id, identifiers={("test", "circuit")}
        )
        .id
    )
    _meter(hass, "sensor.circuit_energy", device_id=device, state_class="total")
    entry = MockConfigEntry(
        domain="template",
        options={
            "template_type": "sensor",
            "state": f"{{{{ states('{SOLAR_POWER}') | float + 1 }}}}",
        },
    )
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        "template",
        entry.entry_id,
        suggested_object_id="circuit_power",
        config_entry=entry,
        device_id=device,
        original_device_class="power",
    )
    hass.states.async_set(
        "sensor.circuit_power",
        "5",
        {"device_class": "power", "unit_of_measurement": "W"},
    )
    prefs = deepcopy(WITH_SOLAR_POWER)
    prefs["device_consumption"].append({"stat_consumption": "sensor.circuit_energy"})
    await energy_access.async_write(hass, prefs)
    result = await result_of(
        hass_ws_client, hass, stat="sensor.circuit_energy", method="net"
    )
    assert result["power"]["circuit"] is None
    assert result["blocked"] is None
    assert methods(result)["net"][0] is True


@pytest.mark.usefixtures("evidence")
async def test_setup_of_a_device_only_in_the_draft(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A device added in the panel but not saved can be set up."""
    changes = await draft(
        hass_ws_client,
        hass,
        {"type": "add", "stat": "sensor.attic_energy", "stat_rate": "sensor.ups_power"},
    )
    result = await result_of(
        hass_ws_client, hass, stat="sensor.attic_energy", method="net", **changes
    )
    assert result["power"]["circuit"] == "sensor.ups_power"
    assert result["power"]["circuit_from"] == "draft"
    assert result["blocked"] is None
    response = await create(
        hass_ws_client, hass, stat="sensor.attic_energy", method="net", **changes
    )
    assert response["success"], response
    assert "Attic energy gross" in _template_entries(hass)
    # Without the draft the device is unknown.
    response = await preview(hass_ws_client, hass, stat="sensor.attic_energy")
    assert response["error"]["translation_key"] == "unknown_device"


@pytest.mark.usefixtures("evidence")
async def test_setup_with_a_solar_only_in_the_draft(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A solar assigned in the panel but not saved can be used."""
    _meter(hass, "sensor.pv2_energy", state="10")
    changes = await draft(
        hass_ws_client,
        hass,
        {"type": "assign_source", "role": "production", "stat": "sensor.pv2_energy"},
        set_solar_rate(SOLAR_POWER, "sensor.pv2_energy"),
    )
    result = await result_of(
        hass_ws_client, hass, solar="sensor.pv2_energy", method="net", **changes
    )
    assert result["power"]["solar"] == SOLAR_POWER
    assert result["power"]["solar_from"] == "draft"
    assert result["blocked"] is None
    response = await create(
        hass_ws_client, hass, solar="sensor.pv2_energy", method="net", **changes
    )
    assert response["success"], response


@pytest.mark.usefixtures("loaded_entry", "evidence")
@pytest.mark.parametrize("command", ["solar_setup_preview", "create_solar_setup"])
async def test_stale_draft_is_a_conflict(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, command: str
) -> None:
    """A draft on settings that changed meanwhile is refused."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/{command}",
        stat=MAIN,
        solar=SOLAR,
        method="net",
        **({"offset": 0} if command == "create_solar_setup" else {}),
        base_hash="stale",
        changes=[],
    )
    assert response["error"]["translation_key"] == "conflict"
