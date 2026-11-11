"""Tests for sum meters created as Home Assistant group helpers."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from custom_components.energy_flow_mapper import sum_meter as sum_module
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.hierarchy import DeviceKind

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import _meter
from .test_websocket import send

pytestmark = pytest.mark.usefixtures("sensors")


async def test_creates_sum_without_ignoring_non_numeric(hass: HomeAssistant) -> None:
    """The group sums, does not ignore non-numeric members and keeps the meter type."""
    entry_id, entity_id = await sum_module.async_create_sum(
        hass, "Kitchen energy", ["sensor.kitchen_energy", "sensor.coffee_energy"]
    )
    entry = hass.config_entries.async_get_entry(entry_id)
    assert entry is not None
    assert entry.domain == "group"
    assert entry.title == "Kitchen energy"
    assert entry.options["type"] == "sum"
    assert entry.options["ignore_non_numeric"] is False
    assert entry.options["hide_members"] is False
    assert entry.options["entities"] == [
        "sensor.kitchen_energy",
        "sensor.coffee_energy",
    ]
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.attributes["state_class"] == "total_increasing"
    assert state.attributes["device_class"] == "energy"
    assert state.state == "2.0"


async def test_converts_mixed_units(hass: HomeAssistant) -> None:
    """A Wh and a kWh member add up to a number in one unit."""
    _meter(hass, "sensor.small_energy", unit="Wh", state="500")
    _, entity_id = await sum_module.async_create_sum(
        hass, "Mixed", ["sensor.small_energy", "sensor.kitchen_energy"]
    )
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state is not None
    assert state.attributes["unit_of_measurement"] in ("kWh", "Wh")
    assert float(state.state) in (pytest.approx(1.5), pytest.approx(1500.0))


async def test_refuses_external_statistic(hass: HomeAssistant) -> None:
    """A statistic that is no sensor entity cannot be summed."""
    with pytest.raises(ServiceValidationError) as err:
        sum_module.check_sum_members(
            hass,
            ["sensor.kitchen_energy", "ext:meter"],
            DeviceKind.ELECTRICITY,
        )
    assert err.value.translation_key == "sum_not_possible"
    assert err.value.translation_placeholders == {"entity": "ext:meter"}


async def test_refuses_missing_entity(hass: HomeAssistant) -> None:
    """A sensor without state cannot be summed."""
    with pytest.raises(ServiceValidationError) as err:
        sum_module.check_sum_members(hass, ["sensor.nope"], DeviceKind.ELECTRICITY)
    assert err.value.translation_placeholders == {"entity": "sensor.nope"}


@pytest.mark.parametrize(
    ("entity", "kind"),
    [
        ("sensor.water_meter", DeviceKind.ELECTRICITY),
        ("sensor.kitchen_energy", DeviceKind.WATER),
        ("sensor.energy_today", DeviceKind.ELECTRICITY),
    ],
)
async def test_refuses_wrong_device_class(
    hass: HomeAssistant, entity: str, kind: DeviceKind
) -> None:
    """Wrong device class or no meter state class is refused, naming the entity."""
    with pytest.raises(ServiceValidationError) as err:
        sum_module.check_sum_members(hass, [entity], kind)
    assert err.value.translation_key == "sum_not_possible"
    assert err.value.translation_placeholders == {"entity": entity}


async def test_refuses_mixed_state_classes(hass: HomeAssistant) -> None:
    """`total` and `total_increasing` together give no state class."""
    with pytest.raises(ServiceValidationError) as err:
        sum_module.check_sum_members(
            hass,
            ["sensor.kitchen_energy", "sensor.attic_energy"],
            DeviceKind.ELECTRICITY,
        )
    assert err.value.translation_key == "sum_state_classes_differ"


async def test_accepts_water(hass: HomeAssistant) -> None:
    """Water meters pass the check for the water kind."""
    sum_module.check_sum_members(hass, ["sensor.water_meter"], DeviceKind.WATER)


async def test_flow_failure_is_reported(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A config flow that does not create an entry is reported."""

    async def no_entry(flow_id: str, user_input: Any = None) -> dict[str, Any]:
        return {"type": FlowResultType.FORM, "flow_id": flow_id}

    monkeypatch.setattr(hass.config_entries.flow, "async_configure", no_entry)
    with pytest.raises(HomeAssistantError) as err:
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert err.value.translation_key == "sum_failed"


async def test_options_flow_failure_is_reported(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An options flow that does not finish is reported."""

    async def not_done(flow_id: str, user_input: Any = None) -> dict[str, Any]:
        return {"type": FlowResultType.FORM, "flow_id": flow_id}

    monkeypatch.setattr(hass.config_entries.options, "async_configure", not_done)
    with pytest.raises(HomeAssistantError) as err:
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert err.value.translation_key == "sum_failed"


async def test_without_entity_is_reported(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An entry without entity is reported."""
    monkeypatch.setattr(
        sum_module.er,
        "async_entries_for_config_entry",
        lambda registry, entry_id: [],
    )
    with pytest.raises(HomeAssistantError) as err:
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert err.value.translation_key == "sum_failed"


async def test_ws_create_sum_meter_with_rate(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """Energy and rate sums are created and both remembered."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="Kitchen energy",
        entity_ids=["sensor.kitchen_energy", "sensor.coffee_energy"],
        rate_entity_ids=["sensor.main_power", "sensor.printer_power"],
    )
    assert response["success"], response
    result = response["result"]
    assert result["entity_id"].startswith("sensor.")
    assert result["stat_rate"].startswith("sensor.")
    assert result["stat_rate"] != result["entity_id"]
    helpers = loaded_entry.runtime_data.helpers.entries()
    assert len(helpers) == 2
    titles = {
        hass.config_entries.async_get_entry(entry_id).title  # type: ignore[union-attr]
        for entry_id in helpers
    }
    assert titles == {"Kitchen energy", "Kitchen energy power"}


async def test_ws_create_sum_meter_without_rate(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """Without rate members, only the energy sum is created."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="water",
        name="Water",
        entity_ids=["sensor.water_meter"],
        rate_entity_ids=[],
    )
    assert response["success"], response
    assert response["result"]["stat_rate"] is None
    assert len(loaded_entry.runtime_data.helpers.entries()) == 1


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_create_sum_meter_refuses(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A member that cannot be summed is refused before anything is created."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="x",
        entity_ids=["sensor.kitchen_energy", "sensor.water_meter"],
    )
    assert response["error"]["translation_key"] == "sum_not_possible"
    assert response["error"]["translation_placeholders"] == {
        "entity": "sensor.water_meter"
    }
    assert hass.config_entries.async_entries("group") == []


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_create_sum_meter_requires_admin(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """Only administrators can create sum meters."""
    response = await send(
        hass_ws_client,
        hass,
        hass_read_only_access_token,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="x",
        entity_ids=["sensor.kitchen_energy"],
    )
    assert response["error"]["code"] == "unauthorized"


async def test_ws_create_sum_meter_rate_names(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """The rate sum gets the given name, or a name for flows."""
    _meter(hass, "sensor.flow_a", device_class="water", unit="m³")
    for rate_name, expected in ((None, "Water flow"), ("Wasser Fluss", "Wasser Fluss")):
        extra = {"rate_name": rate_name} if rate_name else {}
        response = await send(
            hass_ws_client,
            hass,
            type=f"{DOMAIN}/create_sum_meter",
            kind="water",
            name="Water",
            entity_ids=["sensor.water_meter"],
            rate_entity_ids=["sensor.flow_a"],
            **extra,
        )
        assert response["success"], response
        titles = {e.title for e in hass.config_entries.async_entries("group")}
        assert expected in titles
