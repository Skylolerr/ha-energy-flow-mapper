"""Tests for sum meters created as Home Assistant group helpers."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData, UnknownFlow
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import entity_registry as er

from custom_components.energy_flow_mapper import _flow
from custom_components.energy_flow_mapper import sum_meter as sum_module
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.hierarchy import DeviceKind

from .common import MockConfigEntry, WebSocketGenerator
from .conftest import ENERGY_PREFS, _meter
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
        _flow.er,
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


async def test_ws_failed_rate_sum_removes_the_energy_sum(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the rate sum fails, the energy sum is removed again and forgotten."""
    original = sum_module.async_create_sum
    calls = 0

    async def second_fails(*args: Any, **kwargs: Any) -> tuple[str, str]:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise sum_module._failed()
        return await original(*args, **kwargs)

    monkeypatch.setattr(sum_module, "async_create_sum", second_fails)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="Kitchen energy",
        entity_ids=["sensor.kitchen_energy", "sensor.coffee_energy"],
        rate_entity_ids=["sensor.main_power", "sensor.printer_power"],
    )
    assert response["error"]["translation_key"] == "sum_failed"
    assert hass.config_entries.async_entries("group") == []
    assert loaded_entry.runtime_data.helpers.entries() == []


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


async def test_options_flow_failure_removes_the_helper(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A helper whose options could not be set is removed again."""

    async def not_done(flow_id: str, user_input: Any = None) -> dict[str, Any]:
        return {"type": FlowResultType.FORM, "flow_id": flow_id}

    monkeypatch.setattr(hass.config_entries.options, "async_configure", not_done)
    with pytest.raises(HomeAssistantError) as err:
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert err.value.translation_key == "sum_failed"
    assert hass.config_entries.async_entries("group") == []


async def test_missing_entity_removes_the_helper(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A helper without entity is removed again."""
    monkeypatch.setattr(
        _flow.er, "async_entries_for_config_entry", lambda registry, entry: []
    )
    with pytest.raises(HomeAssistantError):
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert hass.config_entries.async_entries("group") == []


@pytest.mark.parametrize("manager", ["flow", "options"])
@pytest.mark.parametrize("error", [InvalidData, UnknownFlow])
async def test_flow_errors_are_mapped(
    hass: HomeAssistant,
    monkeypatch: pytest.MonkeyPatch,
    manager: str,
    error: type[Exception],
) -> None:
    """Errors of the flows end in `sum_failed`, leaving no helper behind."""
    target = getattr(hass.config_entries, manager)
    original = target.async_configure
    calls = 0

    async def failing(flow_id: str, user_input: Any = None) -> dict[str, Any]:
        nonlocal calls
        calls += 1
        if manager == "flow" and calls < 2:
            return await original(flow_id, user_input)
        raise (
            error("refused") if error is UnknownFlow else error("refused", [], None, {})
        )

    monkeypatch.setattr(target, "async_configure", failing)
    with pytest.raises(HomeAssistantError) as err:
        await sum_module.async_create_sum(hass, "x", ["sensor.kitchen_energy"])
    assert err.value.translation_key == "sum_failed"
    assert hass.config_entries.async_entries("group") == []


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_refuses_bad_rate_member_before_creating(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A bad rate member is refused and no helper exists afterwards."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="x",
        entity_ids=["sensor.kitchen_energy"],
        rate_entity_ids=["sensor.main_power", "ext:rate"],
    )
    assert response["error"]["translation_key"] == "sum_not_possible"
    assert response["error"]["translation_placeholders"] == {"entity": "ext:rate"}
    assert hass.config_entries.async_entries("group") == []


@pytest.mark.parametrize("cancel_at", [1, 2])
async def test_create_sum_cancelled_cleans_up(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
    cancel_at: int,
) -> None:
    """A cancelled request removes the sums it made (shielded), then is cancelled.

    1: cancelled while the energy sum is remembered; 2: while the rate sum is
    created, after the energy sum exists.
    """
    helpers = loaded_entry.runtime_data.helpers
    if cancel_at == 1:
        original_add = helpers.async_add

        async def add_cancelled(*args: Any, **kwargs: Any) -> None:
            await original_add(*args, **kwargs)
            raise asyncio.CancelledError

        monkeypatch.setattr(helpers, "async_add", add_cancelled)
    else:
        original = sum_module.async_create_sum
        calls = 0

        async def second_cancelled(*args: Any, **kwargs: Any) -> tuple[str, str]:
            nonlocal calls
            calls += 1
            if calls == 2:
                raise asyncio.CancelledError
            return await original(*args, **kwargs)

        monkeypatch.setattr(sum_module, "async_create_sum", second_cancelled)
    with pytest.raises(asyncio.CancelledError):
        await sum_module.async_create_sums(
            hass,
            helpers,
            "Kitchen energy",
            ["sensor.kitchen_energy", "sensor.coffee_energy"],
            rate_entity_ids=["sensor.main_power", "sensor.printer_power"],
            rate_name="Kitchen power",
        )
    assert hass.config_entries.async_entries("group") == []
    assert helpers.entries() == []


async def test_failed_rate_record_removes_both_sums(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Any error once a sum exists removes every sum of the request."""
    helpers = loaded_entry.runtime_data.helpers
    original_add = helpers.async_add
    calls = 0

    async def second_fails(*args: Any, **kwargs: Any) -> None:
        nonlocal calls
        calls += 1
        await original_add(*args, **kwargs)
        if calls == 2:
            raise RuntimeError("store")

    monkeypatch.setattr(helpers, "async_add", second_fails)
    with pytest.raises(RuntimeError):
        await sum_module.async_create_sums(
            hass,
            helpers,
            "Kitchen energy",
            ["sensor.kitchen_energy"],
            rate_entity_ids=["sensor.main_power"],
            rate_name="Kitchen power",
        )
    assert hass.config_entries.async_entries("group") == []
    assert helpers.entries() == []


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_create_sum_meter_refuses_a_solar(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar source, or a meter that holds it, never goes into a group sum.

    The guided setup builds that gross meter; nothing is created.
    """
    _, holder = await _holder(hass)
    before = len(hass.config_entries.async_entries("group"))
    for member in ("sensor.solar_energy", holder):
        response = await send(
            hass_ws_client,
            hass,
            type=f"{DOMAIN}/create_sum_meter",
            kind="electricity",
            name="x",
            entity_ids=["sensor.kitchen_energy", member],
        )
        assert response["error"]["translation_key"] == "sum_with_solar", response
        assert response["error"]["translation_placeholders"] == {"entity": member}
    assert len(hass.config_entries.async_entries("group")) == before


async def _holder(hass: HomeAssistant) -> tuple[str, str]:
    """Create a hand-made meter that holds the solar (here a group sum)."""
    return await sum_module.async_create_sum(
        hass, "Solar and more", ["sensor.solar_energy", "sensor.garage_energy"]
    )


async def test_ws_create_sum_meter_takes_our_gross_meter(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A gross meter of the setup holds its solar, and sums like any meter."""
    entry_id, gross = await _holder(hass)
    await loaded_entry.runtime_data.helpers.async_add(
        entry_id, {"kind": "gross_energy", "stat": "sensor.main_energy"}
    )
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="Both",
        entity_ids=["sensor.kitchen_energy", gross],
    )
    assert response["success"], response
    got = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert gross not in got["result"]["solar_holds"]


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_create_sum_meter_hand_made_gross_needs_consent(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A meter of the user's that holds the solar sums only when marked gross."""
    _, holder = await _holder(hass)
    msg = {
        "type": f"{DOMAIN}/create_sum_meter",
        "kind": "electricity",
        "name": "Both",
        "entity_ids": ["sensor.kitchen_energy", holder],
    }
    response = await send(hass_ws_client, hass, **msg)
    assert response["error"]["translation_key"] == "sum_with_solar"
    # Marking another member does not help.
    response = await send(
        hass_ws_client, hass, **msg, gross_ok=["sensor.kitchen_energy"]
    )
    assert response["error"]["translation_key"] == "sum_with_solar"
    response = await send(hass_ws_client, hass, **msg, gross_ok=[holder])
    assert response["success"], response


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_create_sum_meter_solar_itself_never_passes(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The solar's own meter is refused even when marked gross."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_sum_meter",
        kind="electricity",
        name="x",
        entity_ids=["sensor.kitchen_energy", "sensor.solar_energy"],
        gross_ok=["sensor.solar_energy"],
    )
    assert response["error"]["translation_key"] == "sum_with_solar"


def _helper(
    hass: HomeAssistant,
    domain: str,
    entity_id: str,
    options: dict[str, Any],
    state_class: str = "total_increasing",
) -> MockConfigEntry:
    """Register a helper entity of `domain` with `options`, without loading it."""
    entry = MockConfigEntry(domain=domain, title=entity_id, options=options)
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        domain,
        entity_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )
    hass.states.async_set(
        entity_id,
        "1.0",
        {
            "device_class": "energy",
            "unit_of_measurement": "kWh",
            "state_class": state_class,
        },
    )
    return entry


def _template(hass: HomeAssistant, entity_id: str, state: str) -> MockConfigEntry:
    return _helper(
        hass, "template", entity_id, {"template_type": "sensor", "state": state}
    )


async def _sum(
    hass: HomeAssistant,
    client: WebSocketGenerator,
    members: list[str],
    gross_ok: list[str] | None = None,
    **extra: Any,
) -> dict[str, Any]:
    msg: dict[str, Any] = {
        "type": f"{DOMAIN}/create_sum_meter",
        "kind": "electricity",
        "name": "x",
        "entity_ids": members,
        **extra,
    }
    if gross_ok is not None:
        msg["gross_ok"] = gross_ok
    return await send(client, hass, **msg)


SOLAR_WITH_POWER = {
    **ENERGY_PREFS,
    "energy_sources": [
        {**source, "stat_rate": "sensor.solar_power"}
        if source["type"] == "solar"
        else source
        for source in ENERGY_PREFS["energy_sources"]
    ],
}
SOLAR_OF_INVERTERS = {
    **ENERGY_PREFS,
    "energy_sources": [
        {**source, "stat_energy_from": "sensor.solar_total"}
        if source["type"] == "solar"
        else source
        for source in ENERGY_PREFS["energy_sources"]
    ],
}


def _refused(response: dict[str, Any], entity: str) -> None:
    assert response["error"]["translation_key"] == "sum_with_solar", response
    assert response["error"]["translation_placeholders"] == {"entity": entity}


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_copy_of_the_solar_is_never_gross(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A template that only reads the solar is the solar: no mark lets it in."""
    _template(hass, "sensor.solar_copy", "{{ states('sensor.solar_energy') | float }}")
    members = ["sensor.kitchen_energy", "sensor.solar_copy"]
    _refused(await _sum(hass, hass_ws_client, members), "sensor.solar_copy")
    _refused(
        await _sum(hass, hass_ws_client, members, ["sensor.solar_copy"]),
        "sensor.solar_copy",
    )


@pytest.mark.parametrize("energy_prefs", [SOLAR_WITH_POWER])
@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_integral_of_the_solar_is_never_gross(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An integral of the solar's power is the solar too, and so is the power."""
    _meter(hass, "sensor.solar_power", device_class="power", unit="W")
    _helper(
        hass,
        "integration",
        "sensor.solar_int",
        {"source": "sensor.solar_power"},
        state_class="total",
    )
    members = ["sensor.attic_energy", "sensor.solar_int"]
    _refused(await _sum(hass, hass_ws_client, members), "sensor.solar_int")
    _refused(
        await _sum(hass, hass_ws_client, members, ["sensor.solar_int"]),
        "sensor.solar_int",
    )
    # The solar's power is no rate of a sum either.
    _meter(hass, "sensor.attic_power", device_class="power", unit="W")
    response = await _sum(
        hass,
        hass_ws_client,
        ["sensor.attic_energy"],
        rate_entity_ids=["sensor.attic_power", "sensor.solar_power"],
    )
    _refused(response, "sensor.solar_power")


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    ("domain", "options"),
    [
        (
            "template",
            {
                "template_type": "sensor",
                "state": "{{ expand('sensor.solar_energy', 'sensor.garage_energy')"
                " | map(attribute='state') | map('float') | sum }}",
            },
        ),
        (
            "group",
            {
                "group_type": "sensor",
                "type": "max",
                "entities": ["sensor.solar_energy", "sensor.garage_energy"],
            },
        ),
    ],
)
async def test_ws_sum_holder_with_unknown_signs_needs_the_mark(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    domain: str,
    options: dict[str, Any],
) -> None:
    """A meter that reads the solar with signs unknown is a holder all the same."""
    _helper(hass, domain, "sensor.mixed", options)
    members = ["sensor.kitchen_energy", "sensor.mixed"]
    _refused(await _sum(hass, hass_ws_client, members), "sensor.mixed")
    response = await _sum(hass, hass_ws_client, members, ["sensor.mixed"])
    assert response["success"], response


@pytest.mark.parametrize("group_type", ["sum", "max"])
@pytest.mark.parametrize("energy_prefs", [SOLAR_OF_INVERTERS])
@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_part_of_the_solar_is_never_gross(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, group_type: str
) -> None:
    """An inverter of a solar made of inverters is part of the solar.

    Also when the solar's signs are unknown (a max group).
    """
    _meter(hass, "sensor.inv1")
    _meter(hass, "sensor.inv2")
    _helper(
        hass,
        "group",
        "sensor.solar_total",
        {
            "group_type": "sensor",
            "type": group_type,
            "entities": ["sensor.inv1", "sensor.inv2"],
        },
    )
    members = ["sensor.kitchen_energy", "sensor.inv1"]
    _refused(await _sum(hass, hass_ws_client, members), "sensor.inv1")
    _refused(await _sum(hass, hass_ws_client, members, ["sensor.inv1"]), "sensor.inv1")


async def test_ws_sum_recorded_gross_needs_its_own_input(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A recorded gross meter edited to read only the solar is the solar."""
    entry = _template(
        hass, "sensor.gross", "{{ states('sensor.solar_energy') | float }}"
    )
    await loaded_entry.runtime_data.helpers.async_add(
        entry.entry_id, {"kind": "gross_energy", "stat": "sensor.main_energy"}
    )
    members = ["sensor.kitchen_energy", "sensor.gross"]
    _refused(await _sum(hass, hass_ws_client, members), "sensor.gross")
    _refused(
        await _sum(hass, hass_ws_client, members, ["sensor.gross"]), "sensor.gross"
    )


async def test_ws_sum_holding_our_gross_meter_needs_no_mark(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A solar reached only through our gross meter makes no holder.

    `get` classifies the meters the same way for the panel.
    """
    helpers = loaded_entry.runtime_data.helpers
    gross = _template(
        hass,
        "sensor.gross",
        "{{ states('sensor.garage_energy') | float"
        " + states('sensor.solar_energy') | float }}",
    )
    await helpers.async_add(
        gross.entry_id, {"kind": "gross_energy", "stat": "sensor.garage_energy"}
    )
    term = _template(hass, "sensor.term", "{{ states('sensor.solar_energy') | float }}")
    await helpers.async_add(term.entry_id, {"kind": "solar_energy", "power": "x"})
    _helper(
        hass,
        "group",
        "sensor.outer",
        {
            "group_type": "sensor",
            "type": "sum",
            "entities": ["sensor.gross", "sensor.coffee_energy"],
        },
    )
    _helper(
        hass,
        "group",
        "sensor.maxg",
        {
            "group_type": "sensor",
            "type": "max",
            "entities": ["sensor.solar_energy", "sensor.attic_energy"],
        },
    )
    response = await _sum(
        hass, hass_ws_client, ["sensor.kitchen_energy", "sensor.outer"]
    )
    assert response["success"], response
    response = await _sum(
        hass, hass_ws_client, ["sensor.kitchen_energy", "sensor.gross"]
    )
    assert response["success"], response
    # Our solar term is the solar, whatever its record says.
    _refused(
        await _sum(
            hass,
            hass_ws_client,
            ["sensor.kitchen_energy", "sensor.term"],
            ["sensor.term"],
        ),
        "sensor.term",
    )
    got = (await send(hass_ws_client, hass, type=f"{DOMAIN}/get"))["result"]
    holds = got["solar_holds"]
    assert holds["sensor.solar_energy"] == "solar"
    assert holds["sensor.term"] == "solar"
    assert holds["sensor.maxg"] == "holder"
    assert "sensor.gross" not in holds
    assert "sensor.outer" not in holds
    assert "sensor.kitchen_energy" not in holds


async def test_undo_removes_the_others_when_one_removal_fails(
    hass: HomeAssistant,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """One sum that cannot be removed does not keep the next one; the error stays."""
    helpers = loaded_entry.runtime_data.helpers
    original_add = helpers.async_add
    original_remove = hass.config_entries.async_remove
    calls = 0
    made: list[str] = []

    async def second_fails(entry_id: str, *args: Any, **kwargs: Any) -> None:
        nonlocal calls
        calls += 1
        made.append(entry_id)
        await original_add(entry_id, *args, **kwargs)
        if calls == 2:
            raise RuntimeError("store")

    async def first_stuck(entry_id: str) -> Any:
        if entry_id == made[0]:
            raise HomeAssistantError("stuck")
        return await original_remove(entry_id)

    monkeypatch.setattr(helpers, "async_add", second_fails)
    monkeypatch.setattr(hass.config_entries, "async_remove", first_stuck)
    with pytest.raises(RuntimeError, match="store"):
        await sum_module.async_create_sums(
            hass,
            helpers,
            "Kitchen energy",
            ["sensor.kitchen_energy"],
            rate_entity_ids=["sensor.main_power"],
            rate_name="Kitchen power",
        )
    assert [e.entry_id for e in hass.config_entries.async_entries("group")] == made[:1]
    assert helpers.entries() == made[:1]
    assert "could not be removed" in caplog.text


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_holder_deeper_than_the_inputs_needs_the_mark(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar deeper than the levels read still makes a holder.

    Too deep to tell it is only the solar, the mark lets it in.
    """
    previous = "sensor.solar_energy"
    for level in range(7):
        entity = f"sensor.level_{level}"
        _template(
            hass,
            entity,
            f"{{{{ states('{previous}') | float }}}}",
        )
        previous = entity
    members = ["sensor.kitchen_energy", previous]
    _refused(await _sum(hass, hass_ws_client, members), previous)
    response = await _sum(hass, hass_ws_client, members, [previous])
    assert response["success"], response


@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_unknown_signs_without_solar_build(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Unknown signs alone make no holder: two templates reading each other."""
    _template(hass, "sensor.cycle_a", "{{ states('sensor.cycle_b') | float }}")
    _template(
        hass,
        "sensor.cycle_b",
        "{{ states('sensor.cycle_a') | float"
        " + states('sensor.garage_energy') | float }}",
    )
    response = await _sum(
        hass, hass_ws_client, ["sensor.kitchen_energy", "sensor.cycle_a"]
    )
    assert response["success"], response


async def _our_gross(hass: HomeAssistant, helpers: Any) -> str:
    """Record a gross meter of ours that reads the garage and the solar."""
    gross = _template(
        hass,
        "sensor.gross_a",
        "{{ states('sensor.garage_energy') | float"
        " + states('sensor.solar_energy') | float }}",
    )
    await helpers.async_add(
        gross.entry_id, {"kind": "gross_energy", "stat": "sensor.garage_energy"}
    )
    return "sensor.gross_a"


async def test_ws_sum_second_path_past_our_gross_meter_needs_the_mark(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A meter adding the solar besides our gross meter holds it (twice)."""
    gross = await _our_gross(hass, loaded_entry.runtime_data.helpers)
    _helper(
        hass,
        "group",
        "sensor.house",
        {
            "group_type": "sensor",
            "type": "sum",
            "entities": [gross, "sensor.solar_energy"],
        },
    )
    _template(hass, "sensor.solar_copy", "{{ states('sensor.solar_energy') | float }}")
    _template(
        hass,
        "sensor.house_t",
        f"{{{{ states('{gross}') | float + states('sensor.solar_copy') | float }}}}",
    )
    for member in ("sensor.house", "sensor.house_t"):
        members = ["sensor.kitchen_energy", member]
        _refused(await _sum(hass, hass_ws_client, members), member)
        response = await _sum(hass, hass_ws_client, members, [member])
        assert response["success"], response
    holds = (await send(hass_ws_client, hass, type=f"{DOMAIN}/get"))["result"][
        "solar_holds"
    ]
    assert holds["sensor.house"] == "holder"
    assert holds["sensor.house_t"] == "holder"
    assert gross not in holds


SOLAR_FROM_METERS = {
    **ENERGY_PREFS,
    "energy_sources": [
        {**source, "stat_energy_from": "sensor.solar_calc"}
        if source["type"] == "solar"
        else {**source, "power_config": {"stat_rate": "sensor.grid_power"}}
        if source["type"] == "grid"
        else source
        for source in ENERGY_PREFS["energy_sources"]
    ],
}


@pytest.mark.parametrize("energy_prefs", [SOLAR_FROM_METERS])
@pytest.mark.usefixtures("loaded_entry")
async def test_ws_sum_solar_built_from_other_meters_leaves_them_alone(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A solar computed from the house and the grid does not make them solar."""
    _template(
        hass,
        "sensor.solar_calc",
        "{{ states('sensor.main_energy') | float"
        " - states('sensor.grid_import') | float"
        " + states('sensor.grid_export') | float }}",
    )
    for member in ("sensor.grid_import", "sensor.grid_export"):
        response = await _sum(hass, hass_ws_client, ["sensor.kitchen_energy", member])
        assert response["success"], response
    holds = (await send(hass_ws_client, hass, type=f"{DOMAIN}/get"))["result"][
        "solar_holds"
    ]
    assert holds == {"sensor.solar_calc": "solar"}
