"""Tests for the shared helper flow driver."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError

from custom_components.energy_flow_mapper import _flow
from custom_components.energy_flow_mapper._flow import async_run_helper_flow
from custom_components.energy_flow_mapper.const import DOMAIN


def _failed() -> HomeAssistantError:
    return HomeAssistantError(translation_domain=DOMAIN, translation_key="flow_test")


def _template_steps(**overrides: Any) -> list[dict[str, Any]]:
    return [
        {"next_step_id": "sensor"},
        {
            "name": "x",
            "state": "{{ 1 }}",
            "unit_of_measurement": "kWh",
            "device_class": "energy",
            "state_class": "total",
            **overrides,
        },
    ]


def _nothing_left(hass: HomeAssistant) -> None:
    assert hass.config_entries.async_entries("template") == []
    assert hass.config_entries.flow.async_progress_by_handler("template") == []


async def test_flow_creates_helper(hass: HomeAssistant) -> None:
    """A valid flow returns the entry and its entity."""
    entry_id, entity_id = await async_run_helper_flow(
        hass, "template", _template_steps(), _failed
    )
    assert hass.config_entries.async_get_entry(entry_id) is not None
    assert entity_id.startswith("sensor.")


async def test_flow_aborts_on_form_error(hass: HomeAssistant) -> None:
    """A unit the device class refuses ends in the caller's error, no flow left."""
    with pytest.raises(HomeAssistantError) as err:
        await async_run_helper_flow(
            hass, "template", _template_steps(unit_of_measurement="W"), _failed
        )
    assert err.value.translation_key == "flow_test"
    _nothing_left(hass)


async def test_flow_aborts_when_it_does_not_create(hass: HomeAssistant) -> None:
    """Steps that stop at a form abort the flow and raise."""
    with pytest.raises(HomeAssistantError):
        await async_run_helper_flow(
            hass, "template", [{"next_step_id": "sensor"}], _failed
        )
    _nothing_left(hass)


async def test_flow_removes_entry_when_entity_missing(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An entry without an entity is removed again."""
    monkeypatch.setattr(
        _flow.er, "async_entries_for_config_entry", lambda registry, entry_id: []
    )
    with pytest.raises(HomeAssistantError) as err:
        await async_run_helper_flow(hass, "template", _template_steps(), _failed)
    assert err.value.translation_key == "flow_test"
    _nothing_left(hass)


async def test_flow_removes_entry_when_options_fail(hass: HomeAssistant) -> None:
    """A failing options step removes the entry that was just created."""
    with pytest.raises(HomeAssistantError):
        await async_run_helper_flow(
            hass,
            "template",
            _template_steps(),
            _failed,
            options_steps=[{"state": "{{ 1 +"}],
        )
    _nothing_left(hass)
