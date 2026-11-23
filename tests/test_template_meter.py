"""Tests for gross meters created as Home Assistant template helpers."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData, UnknownFlow
from homeassistant.exceptions import HomeAssistantError

from custom_components.energy_flow_mapper import template_meter as template_module
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.template_meter import async_create_template

from .conftest import _meter

GROSS = (
    "{% set bezug = states('sensor.a') %}"
    "{% set zurueck = states('sensor.b') %}"
    "{% set solar = states('sensor.c') %}"
    "{% if bezug | is_number and zurueck | is_number and solar | is_number %}"
    "{{ (bezug | float - zurueck | float + solar | float) | round(3) }}"
    "{% else %}{{ none }}{% endif %}"
)


def _no_template_left(hass: HomeAssistant) -> None:
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.flow.async_progress_by_handler("template") == []


async def test_create_template_energy(hass: HomeAssistant) -> None:
    """An energy template is a kWh meter the energy dashboard accepts."""
    entry_id, entity_id = await async_create_template(
        hass, "F11 gross", "{{ 1.5 }}", "energy"
    )
    await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry_id)
    assert entry is not None
    assert entry.domain == "template"
    assert entry.title == "F11 gross"
    assert entry.options["template_type"] == "sensor"
    assert entry.options["state"] == "{{ 1.5 }}"
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == "1.5"
    assert state.attributes["unit_of_measurement"] == "kWh"
    assert state.attributes["device_class"] == "energy"
    assert state.attributes["state_class"] == "total_increasing"


async def test_create_template_power(hass: HomeAssistant) -> None:
    """A power template measures watts."""
    entry_id, entity_id = await async_create_template(
        hass, "F11 gross power", "{{ 230 }}", "power"
    )
    await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry_id)
    assert entry is not None
    assert entry.title == "F11 gross power"
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == "230"
    assert state.attributes["unit_of_measurement"] == "W"
    assert state.attributes["device_class"] == "power"
    assert state.attributes["state_class"] == "measurement"


async def test_gross_template_follows_its_sensors(hass: HomeAssistant) -> None:
    """The gross formula adds solar to the net value and is unknown without input."""
    _meter(hass, "sensor.a", state="10.5")
    _meter(hass, "sensor.b", state="2.25")
    _meter(hass, "sensor.c", state="4.0")
    _, entity_id = await async_create_template(hass, "Gross", GROSS, "energy")
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert float(state.state) == pytest.approx(12.25)

    hass.states.async_set("sensor.c", "unavailable")
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.state == "unknown"


async def test_create_template_failure_leaves_nothing(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A flow that refuses to create the entry ends in `template_failed`."""

    async def no_entry(flow_id: str, user_input: Any = None) -> dict[str, Any]:
        return {"type": FlowResultType.FORM, "flow_id": flow_id}

    monkeypatch.setattr(hass.config_entries.flow, "async_configure", no_entry)
    with pytest.raises(HomeAssistantError) as err:
        await async_create_template(hass, "x", "{{ 1 }}", "energy")
    assert err.value.translation_domain == DOMAIN
    assert err.value.translation_key == "template_failed"
    _no_template_left(hass)


@pytest.mark.parametrize("step", [1, 2])
@pytest.mark.parametrize("error", [InvalidData, UnknownFlow])
async def test_flow_errors_are_mapped(
    hass: HomeAssistant,
    monkeypatch: pytest.MonkeyPatch,
    step: int,
    error: type[Exception],
) -> None:
    """Refused input and lost flows end in `template_failed`, leaving no flow."""
    flow = hass.config_entries.flow
    original = flow.async_configure
    calls = 0

    async def failing(flow_id: str, user_input: Any = None) -> Any:
        nonlocal calls
        calls += 1
        if calls < step:
            return await original(flow_id, user_input)
        raise (
            error("refused") if error is UnknownFlow else error("refused", [], None, {})
        )

    monkeypatch.setattr(flow, "async_configure", failing)
    with pytest.raises(HomeAssistantError) as err:
        await async_create_template(hass, "x", "{{ 1 }}", "power")
    assert err.value.translation_key == "template_failed"
    _no_template_left(hass)


async def test_invalid_template_is_refused(hass: HomeAssistant) -> None:
    """A template HA cannot parse is refused by the flow and leaves nothing."""
    with pytest.raises(HomeAssistantError) as err:
        await async_create_template(hass, "x", "{{ 1 +", "energy")
    assert err.value.translation_key == "template_failed"
    _no_template_left(hass)


async def test_missing_entity_removes_the_helper(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A helper without entity is removed again."""
    monkeypatch.setattr(
        template_module.er,
        "async_entries_for_config_entry",
        lambda registry, entry_id: [],
    )
    with pytest.raises(HomeAssistantError) as err:
        await async_create_template(hass, "x", "{{ 1 }}", "energy")
    assert err.value.translation_key == "template_failed"
    _no_template_left(hass)
