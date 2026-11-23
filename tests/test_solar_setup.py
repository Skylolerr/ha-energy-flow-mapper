"""Tests for the guided setup "Solar feeds into this circuit"."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.template import Template

from custom_components.energy_flow_mapper import energy_access, solar_setup
from custom_components.energy_flow_mapper import integral as integral_module
from custom_components.energy_flow_mapper import template_meter as template_module
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.solar_setup import (
    MeterKind,
    gross_energy_template,
    gross_power_template,
)

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import ENERGY_PREFS, _meter

pytestmark = pytest.mark.usefixtures("sensors")

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


def _main_device(hass: HomeAssistant) -> str:
    entry = er.async_get(hass).async_get("sensor.main_energy")
    assert entry is not None
    assert entry.device_id is not None
    return entry.device_id


def _returned(
    hass: HomeAssistant, *, disabled: bool = False, unit: str = "kWh"
) -> None:
    """Give the main meter's device a Shelly returned-energy sensor."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        "shelly",
        "aabbcc-em1:0-total_act_ret_energy",
        suggested_object_id="main_returned",
        device_id=_main_device(hass),
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


@pytest.fixture
def daily(monkeypatch: pytest.MonkeyPatch) -> set[str]:
    """Fake the daily reset detection; return the set of daily statistics."""
    found: set[str] = set()

    async def fake(hass: HomeAssistant, stats: Any, days: int = 3) -> set[str]:
        return {stat for stat in stats if stat in found}

    monkeypatch.setattr(solar_setup, "async_daily_resetting", fake)
    return found


# --- Templates -------------------------------------------------------------


async def test_gross_energy_template_net(hass: HomeAssistant) -> None:
    """Net: gross = meter + solar, `none` while an input is not a number."""
    template = gross_energy_template(MeterKind.NET, "sensor.a", "sensor.c", None)
    assert template == (
        "{% set meter = states('sensor.a') %}"
        "{% set solar = states('sensor.c') %}"
        "{% if meter | is_number and solar | is_number %}"
        "{{ (meter | float + solar | float) | round(3) }}"
        "{% else %}{{ none }}{% endif %}"
    )
    hass.states.async_set("sensor.a", "-1.5")
    hass.states.async_set("sensor.c", "3")
    assert render(hass, template) == 1.5
    hass.states.async_set("sensor.a", "unknown")
    assert render(hass, template) is None


async def test_gross_energy_template_draws(hass: HomeAssistant) -> None:
    """Draws: gross = drawn - returned + solar (the maintainer's F11 form)."""
    template = gross_energy_template(
        MeterKind.DRAWS, "sensor.drawn", "sensor.solar", "sensor.returned"
    )
    assert template == (
        "{% set meter = states('sensor.drawn') %}"
        "{% set returned = states('sensor.returned') %}"
        "{% set solar = states('sensor.solar') %}"
        "{% if meter | is_number and returned | is_number and solar | is_number %}"
        "{{ (meter | float - returned | float + solar | float) | round(3) }}"
        "{% else %}{{ none }}{% endif %}"
    )
    hass.states.async_set("sensor.drawn", "10")
    hass.states.async_set("sensor.returned", "2")
    hass.states.async_set("sensor.solar", "3")
    assert render(hass, template) == 11.0
    hass.states.async_set("sensor.returned", "unavailable")
    assert render(hass, template) is None


def test_gross_energy_template_draws_needs_returned() -> None:
    with pytest.raises(ValueError, match="returned"):
        gross_energy_template(MeterKind.DRAWS, "sensor.a", "sensor.c", None)


async def test_gross_power_template(hass: HomeAssistant) -> None:
    """Power: circuit + solar, rounded to 1 decimal."""
    template = gross_power_template("sensor.f11_power", "sensor.dtu_power")
    assert template == (
        "{% set circuit = states('sensor.f11_power') %}"
        "{% set solar = states('sensor.dtu_power') %}"
        "{% if circuit | is_number and solar | is_number %}"
        "{{ (circuit | float + solar | float) | round(1) }}"
        "{% else %}{{ none }}{% endif %}"
    )
    hass.states.async_set("sensor.f11_power", "-120.04")
    hass.states.async_set("sensor.dtu_power", "300")
    assert render(hass, template) == 180.0
    hass.states.async_set("sensor.dtu_power", "unavailable")
    assert render(hass, template) is None


async def test_templates_convert_units(hass: HomeAssistant) -> None:
    """Factors turn Wh into kWh and kW into W inside the template."""
    energy = gross_energy_template(
        MeterKind.DRAWS,
        "sensor.drawn",
        "sensor.dtu_today",
        "sensor.returned",
        factors={"sensor.dtu_today": 0.001, "sensor.returned": 1.0},
    )
    assert "solar | float * 0.001" in energy
    assert "returned | float -" not in energy  # a factor of 1 is left out
    hass.states.async_set("sensor.drawn", "10")
    hass.states.async_set("sensor.returned", "2")
    hass.states.async_set("sensor.dtu_today", "3000")
    assert render(hass, energy) == 11.0

    power = gross_power_template(
        "sensor.f11_power", "sensor.dtu_power", factors={"sensor.f11_power": 1000.0}
    )
    hass.states.async_set("sensor.f11_power", "-0.1")
    hass.states.async_set("sensor.dtu_power", "300")
    assert render(hass, power) == 200.0


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
        **({"stat": "sensor.main_energy", "solar": SOLAR} | msg),
    )


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_suggests_draws_with_returned_sensor(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A returned sensor on the meter's device suggests "only draws"."""
    _returned(hass)
    response = await preview(hass_ws_client, hass)
    assert response["success"], response
    assert response["result"] == {
        "suggested_kind": "draws",
        "kind": "draws",
        "returned": RETURNED,
        "returned_disabled": False,
        "circuit_power": "sensor.main_power",
        "solar_power": SOLAR_POWER,
        "daily": [],
        "integrals": [],
        "blocked": None,
        "blocked_entity": None,
    }


@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_suggests_net_without_returned_sensor(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Without a returned sensor the meter counts both ways; no solar power."""
    response = await preview(hass_ws_client, hass)
    result = response["result"]
    assert result["suggested_kind"] == "net"
    assert result["kind"] == "net"
    assert result["returned"] is None
    assert result["returned_disabled"] is False
    assert result["solar_power"] is None
    assert result["blocked"] is None

    # "Only draws" needs the returned sensor.
    response = await preview(hass_ws_client, hass, kind="draws")
    result = response["result"]
    assert result["kind"] == "draws"
    assert result["blocked"] == "no_returned_sensor"
    assert result["blocked_entity"] == "sensor.main_energy"


@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_reports_disabled_returned_sensor(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A disabled returned sensor is named; the setup never enables it."""
    _returned(hass, disabled=True)
    response = await preview(hass_ws_client, hass)
    result = response["result"]
    assert result["suggested_kind"] == "draws"
    assert result["returned"] == RETURNED
    assert result["returned_disabled"] is True
    assert result["blocked"] == "returned_disabled"
    assert result["blocked_entity"] == RETURNED
    entry = er.async_get(hass).async_get(RETURNED)
    assert entry is not None
    assert entry.disabled

    # As a net meter it can still be set up.
    response = await preview(hass_ws_client, hass, kind="net")
    assert response["result"]["blocked"] is None


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_blocks_daily_without_power(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, daily: set[str]
) -> None:
    """A daily solar meter without a power sensor stops the setup."""
    daily.add(SOLAR)
    response = await preview(hass_ws_client, hass)
    result = response["result"]
    assert result["daily"] == [SOLAR]
    assert result["integrals"] == []
    assert result["blocked"] == "daily_without_power"
    assert result["blocked_entity"] == SOLAR


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_keeps_the_first_reason(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, daily: set[str]
) -> None:
    """With several reasons the first one found is reported."""
    _returned(hass, disabled=True)
    daily.add(SOLAR)
    response = await preview(hass_ws_client, hass)
    result = response["result"]
    assert result["blocked"] == "returned_disabled"
    assert result["blocked_entity"] == RETURNED
    assert result["daily"] == [SOLAR]


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_preview_lists_integrals_for_daily_inputs(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, daily: set[str]
) -> None:
    """Daily inputs with their own power get an integral of it."""
    daily.update({SOLAR, "sensor.main_energy"})
    response = await preview(hass_ws_client, hass, kind="net")
    result = response["result"]
    assert result["daily"] == ["sensor.main_energy", SOLAR]
    assert result["integrals"] == [
        {"stat": "sensor.main_energy", "power": "sensor.main_power"},
        {"stat": SOLAR, "power": SOLAR_POWER},
    ]
    assert result["blocked"] is None


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize("stat", ["sensor.main_energy", RETURNED])
async def test_preview_daily_draws_meter_has_no_own_power(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    daily: set[str],
    stat: str,
) -> None:
    """In "only draws", the signed circuit power is not the power of one meter."""
    _returned(hass)
    daily.add(stat)
    response = await preview(hass_ws_client, hass)
    result = response["result"]
    assert result["kind"] == "draws"
    assert result["blocked"] == "daily_without_power"
    assert result["blocked_entity"] == stat


@pytest.mark.usefixtures("loaded_entry", "daily")
@pytest.mark.parametrize(
    ("change", "entity"),
    [
        ({"sensor.main_energy": {"unit_of_measurement": "%"}}, "sensor.main_energy"),
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
    response = await preview(hass_ws_client, hass)
    assert response["result"]["blocked"] == "unsupported_input"
    assert response["result"]["blocked_entity"] == entity


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_blocks_power_without_unit(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A power sensor without a power unit cannot be added either."""
    hass.states.async_set(SOLAR_POWER, "1", {"unit_of_measurement": "%"})
    response = await preview(hass_ws_client, hass)
    assert response["result"]["blocked"] == "unsupported_input"
    assert response["result"]["blocked_entity"] == SOLAR_POWER


@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_uses_registry_unit_of_unavailable_input(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An unavailable input keeps the unit its registry entry knows."""
    hass.states.async_set(SOLAR, "unavailable", {})
    response = await preview(hass_ws_client, hass)
    assert response["result"]["blocked"] is None


@pytest.mark.usefixtures("loaded_entry", "daily")
async def test_preview_external_statistic_is_unsupported(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An external statistic has no state a template could read."""
    prefs = deepcopy(ENERGY_PREFS)
    prefs["device_consumption"].append({"stat_consumption": "tibber:energy"})
    await energy_access.async_write(hass, prefs)
    response = await preview(hass_ws_client, hass, stat="tibber:energy")
    assert response["result"]["blocked"] == "unsupported_input"
    assert response["result"]["blocked_entity"] == "tibber:energy"


@pytest.mark.usefixtures("loaded_entry", "daily")
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
            {"solar": "sensor.main_energy"},
            "unknown_source",
            {"stat": "sensor.main_energy"},
        ),
    ],
)
async def test_preview_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    msg: dict[str, str],
    key: str,
    placeholders: dict[str, str],
) -> None:
    """Only an electricity device and a solar source of the settings."""
    response = await preview(hass_ws_client, hass, **msg)
    assert response["error"]["translation_key"] == key
    assert response["error"]["translation_placeholders"] == placeholders


@pytest.mark.usefixtures("loaded_entry")
async def test_preview_schema_refuses_unknown_kind(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    response = await preview(hass_ws_client, hass, kind="both")
    assert response["error"]["code"] == "invalid_format"


# --- Create ----------------------------------------------------------------


async def create(
    hass_ws_client: WebSocketGenerator, hass: HomeAssistant, **msg: Any
) -> dict[str, Any]:
    return await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_solar_setup",
        **(
            {
                "stat": "sensor.main_energy",
                "solar": SOLAR,
                "kind": "net",
                "name": "Main gross",
                "power_name": "Main gross power",
            }
            | msg
        ),
    )


def _entity_of(hass: HomeAssistant, entry_id: str) -> str:
    return er.async_entries_for_config_entry(er.async_get(hass), entry_id)[0].entity_id


def _template_entries(hass: HomeAssistant) -> dict[str, Any]:
    return {e.title: e for e in hass.config_entries.async_entries("template")}


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_create_solar_setup_uses_integral_for_daily_solar(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
) -> None:
    """A daily solar meter is replaced by an integral of the solar's power."""
    daily.add(SOLAR)
    response = await create(hass_ws_client, hass)
    assert response["success"], response
    integrals = [
        e
        for e in hass.config_entries.async_entries("integration")
        if e.options.get("source") == SOLAR_POWER
    ]
    assert len(integrals) == 1
    integral = integrals[0]
    assert integral.title == "Solar power energy"
    integral_entity = _entity_of(hass, integral.entry_id)

    templates = _template_entries(hass)
    energy, power = templates["Main gross"], templates["Main gross power"]
    assert energy.options["state"] == gross_energy_template(
        MeterKind.NET, "sensor.main_energy", integral_entity, None
    )
    assert power.options["state"] == gross_power_template(
        "sensor.main_power", SOLAR_POWER
    )
    assert SOLAR not in energy.options["state"]
    assert energy.options["unit_of_measurement"] == "kWh"
    assert power.options["unit_of_measurement"] == "W"

    result = response["result"]
    assert result["entity_id"] == _entity_of(hass, energy.entry_id)
    assert result["stat_rate"] == _entity_of(hass, power.entry_id)
    assert loaded_entry.runtime_data.helpers.entries() == [
        integral.entry_id,
        energy.entry_id,
        power.entry_id,
    ]


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_create_integral_of_a_kw_solar_counts_kwh(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
) -> None:
    """The integral of a kW solar counts in kWh, so the gross needs no factor."""
    daily.add(SOLAR)
    hass.states.async_set(
        SOLAR_POWER, "0.3", {"device_class": "power", "unit_of_measurement": "kW"}
    )
    response = await create(hass_ws_client, hass)
    assert response["success"], response
    integral = next(
        e
        for e in hass.config_entries.async_entries("integration")
        if e.options.get("source") == SOLAR_POWER
    )
    assert "unit_prefix" not in integral.options
    integral_entity = _entity_of(hass, integral.entry_id)
    templates = _template_entries(hass)
    assert templates["Main gross"].options["state"] == gross_energy_template(
        MeterKind.NET, "sensor.main_energy", integral_entity, None
    )
    assert templates["Main gross power"].options["state"] == gross_power_template(
        "sensor.main_power", SOLAR_POWER, factors={SOLAR_POWER: 1000.0}
    )


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize("unit", ["BTU/h", None])
async def test_preview_blocks_a_power_without_energy_unit(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    daily: set[str],
    unit: str | None,
) -> None:
    """BTU/h is a power, but its integral is no energy unit; no unit is none."""
    daily.add(SOLAR)
    if unit is None:
        hass.states.async_set(SOLAR_POWER, "1", {})
        er.async_get(hass).async_update_entity(SOLAR_POWER, unit_of_measurement=None)
    else:
        hass.states.async_set(SOLAR_POWER, "1", {"unit_of_measurement": unit})
    response = await preview(hass_ws_client, hass)
    assert response["result"]["blocked"] == "unsupported_input"
    assert response["result"]["blocked_entity"] == SOLAR_POWER


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_create_draws_with_returned_in_wh(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
) -> None:
    """Only draws: drawn - returned + solar, the Wh sensor read as kWh."""
    _returned(hass, unit="Wh")
    hass.states.async_set(
        RETURNED,
        "2000",
        {
            "device_class": "energy",
            "unit_of_measurement": "Wh",
            "state_class": "total_increasing",
        },
    )
    hass.states.async_set("sensor.main_energy", "10", {"unit_of_measurement": "kWh"})
    hass.states.async_set(SOLAR, "3", {"unit_of_measurement": "kWh"})
    hass.states.async_set("sensor.main_power", "-0.2", {"unit_of_measurement": "kW"})
    before = hass.config_entries.async_entries("integration")
    response = await create(
        hass_ws_client, hass, kind="draws", name=" ", power_name=" "
    )
    assert response["success"], response
    await hass.async_block_till_done()
    result = response["result"]
    energy = hass.states.get(result["entity_id"])
    assert energy is not None
    assert float(energy.state) == pytest.approx(11.0)
    power = hass.states.get(result["stat_rate"])
    assert power is not None
    assert float(power.state) == pytest.approx(100.0)
    # Empty names fall back to the device's name in the settings.
    assert set(_template_entries(hass)) == {"Main gross", "Main gross power"}
    assert hass.config_entries.async_entries("integration") == before
    assert len(loaded_entry.runtime_data.helpers.entries()) == 2


async def test_create_without_circuit_power_has_no_gross_power(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
) -> None:
    """Without both power sensors only the energy template is created."""
    response = await create(
        hass_ws_client, hass, stat="sensor.kitchen_energy", name="Kitchen gross"
    )
    assert response["success"], response
    assert response["result"]["stat_rate"] is None
    assert set(_template_entries(hass)) == {"Kitchen gross"}
    assert len(loaded_entry.runtime_data.helpers.entries()) == 1


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_create_names_integrals_as_asked(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
) -> None:
    """The panel can pass translated integral names, per power sensor."""
    daily.update({SOLAR, "sensor.main_energy"})
    # Without a friendly name the registry's name is used, not the entity ID.
    hass.states.async_set(
        SOLAR_POWER, "300", {"device_class": "power", "unit_of_measurement": "W"}
    )
    er.async_get(hass).async_update_entity(SOLAR_POWER, name="Balcony")
    response = await create(
        hass_ws_client,
        hass,
        integral_names={"sensor.main_power": "Main Energie"},
    )
    assert response["success"], response
    titles = {e.title for e in hass.config_entries.async_entries("integration")}
    assert {"Main Energie", "Balcony energy"} <= titles
    assert len(loaded_entry.runtime_data.helpers.entries()) == 4


@pytest.mark.usefixtures("daily")
async def test_create_refused_when_blocked(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A blocked setup creates nothing and names the reason."""
    _returned(hass, disabled=True)
    response = await create(hass_ws_client, hass, kind="draws")
    assert response["error"]["translation_key"] == "returned_disabled"
    assert response["error"]["translation_placeholders"] == {"entity_id": RETURNED}
    assert hass.config_entries.async_entries("template") == []
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.parametrize("failing", [1, 2])
async def test_solar_setup_rolls_back_on_failure(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
    monkeypatch: pytest.MonkeyPatch,
    failing: int,
) -> None:
    """A failing template removes every helper of the request and forgets it."""
    daily.add(SOLAR)
    original = solar_setup.async_create_template
    calls = 0

    async def fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == failing:
            raise template_module._failed()
        return await original(*args, **kwargs)

    monkeypatch.setattr(solar_setup, "async_create_template", fails)
    before = hass.config_entries.async_entries("integration")
    response = await create(hass_ws_client, hass)
    assert response["error"]["translation_key"] == "template_failed"
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.async_entries("integration") == before
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_rollback_goes_on_when_a_removal_fails(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Every helper is still removed and the first error is the one raised."""
    daily.add(SOLAR)
    original_template = solar_setup.async_create_template
    calls = 0

    async def power_fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == 2:
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

    monkeypatch.setattr(solar_setup, "async_create_template", power_fails)
    monkeypatch.setattr(hass.config_entries, "async_remove", remove)
    monkeypatch.setattr(loaded_entry.runtime_data.helpers, "async_discard", discard)
    before = hass.config_entries.async_entries("integration")
    response = await create(hass_ws_client, hass)
    assert response["error"]["translation_key"] == "template_failed"
    # The energy template could not be removed; it stays recorded as ours.
    # The integral was removed even though forgetting it failed.
    assert [e.entry_id for e in hass.config_entries.async_entries("template")] == (
        refused
    )
    assert hass.config_entries.async_entries("integration") == before
    assert "busy" in caplog.text
    assert "disk full" in caplog.text
    monkeypatch.setattr(
        loaded_entry.runtime_data.helpers, "async_discard", original_discard
    )


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
async def test_solar_setup_rolls_back_a_failed_integral(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    daily: set[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The second integral failing removes the first one."""
    daily.update({SOLAR, "sensor.main_energy"})
    original = solar_setup.async_create_integral
    calls = 0

    async def second_fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise integral_module._failed()
        return await original(*args, **kwargs)

    monkeypatch.setattr(solar_setup, "async_create_integral", second_fails)
    before = hass.config_entries.async_entries("integration")
    response = await create(hass_ws_client, hass)
    assert response["error"]["translation_key"] == "integral_failed"
    assert hass.config_entries.async_entries("integration") == before
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    "msg",
    [
        {"type": f"{DOMAIN}/solar_setup_preview", "stat": "x", "solar": "y"},
        {
            "type": f"{DOMAIN}/create_solar_setup",
            "stat": "x",
            "solar": "y",
            "kind": "net",
            "name": "x",
            "power_name": "x",
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
