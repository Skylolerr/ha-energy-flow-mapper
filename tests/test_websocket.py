"""Tests for the WebSocket commands used by the panel."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.energy_flow_mapper import energy_access
from custom_components.energy_flow_mapper import integral as integral_module
from custom_components.energy_flow_mapper import websocket as websocket_module
from custom_components.energy_flow_mapper.const import DOMAIN, STORAGE_KEY
from custom_components.energy_flow_mapper.hierarchy import DeviceKind

from .conftest import ENERGY_PREFS

pytestmark = pytest.mark.usefixtures("sensors")


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


async def current_hash(hass_ws_client: WebSocketGenerator, hass: HomeAssistant) -> str:
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    return str(response["result"]["hash"])


def device_list(prefs: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {d["stat_consumption"]: d for d in prefs["device_consumption"]}


@pytest.mark.usefixtures("loaded_entry")
async def test_get(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    """The snapshot has prefs, hash, metadata, candidates and issues."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert response["success"]
    result = response["result"]
    assert result["prefs"] == ENERGY_PREFS
    assert len(result["hash"]) == 16
    assert result["stats"]["sensor.main_energy"]["name"] == "Main energy"
    assert [c["stat"] for c in result["candidates"]] == [
        "sensor.attic_energy",
        "sensor.printer_energy",
    ]
    assert [c["stat"] for c in result["water_candidates"]] == ["sensor.water_meter"]
    assert result["issues"] == []


@pytest.mark.usefixtures("loaded_entry")
async def test_get_reports_issues(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Existing problems are reported, including missing statistics."""
    await energy_access.async_write(
        hass,
        {
            "device_consumption": [
                {"stat_consumption": "sensor.gone"},
                {
                    "stat_consumption": "sensor.main_energy",
                    "included_in_stat": "sensor.nowhere",
                },
            ]
        },
    )
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert [(i["code"], i["stat"]) for i in response["result"]["issues"]] == [
        ("missing_parent", "sensor.main_energy"),
        ("statistic_missing", "sensor.gone"),
    ]


@pytest.mark.usefixtures("loaded_entry")
async def test_validate(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A draft is checked and described without being saved."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=base_hash,
        changes=[
            {
                "type": "move",
                "stat": "sensor.main_energy",
                "parent": "sensor.grinder_energy",
            },
            {"type": "add", "stat": "sensor.printer_energy", "parent": None},
        ],
    )
    assert response["success"]
    result = response["result"]
    assert result["valid"] is False
    assert {(i["code"], i["severity"]) for i in result["issues"]} == {
        ("cycle", "error")
    }
    assert result["diff"][0] == {
        "type": "added",
        "stat": "sensor.printer_energy",
        "parent": None,
        "kind": "electricity",
    }
    assert await current_hash(hass_ws_client, hass) == base_hash


@pytest.mark.usefixtures("loaded_entry")
async def test_save_water(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Water devices and a water meter are saved; electricity stays as it is."""
    hass.states.async_set(
        "sensor.tap_water",
        "1",
        {"device_class": "water", "unit_of_measurement": "L"},
    )
    base_hash = await current_hash(hass_ws_client, hass)
    changes = [
        {"type": "assign_source", "role": "water", "stat": "sensor.water_meter"},
        {"type": "add", "stat": "sensor.tap_water", "kind": "water"},
        {"type": "rename", "stat": "sensor.tap_water", "name": "Tap", "kind": "water"},
    ]
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=base_hash,
        changes=changes,
    )
    result = response["result"]
    assert result["valid"], result
    assert {(e["type"], e.get("kind")) for e in result["diff"]} == {
        ("source_added", None),
        ("added", "water"),
    }
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=changes,
    )
    assert response["success"], response
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs["device_consumption_water"] == [
        {"stat_consumption": "sensor.tap_water", "name": "Tap"}
    ]
    assert prefs["energy_sources"][-1] == {
        "type": "water",
        "stat_energy_from": "sensor.water_meter",
        "stat_cost": None,
        "entity_energy_price": None,
        "number_energy_price": None,
    }
    assert prefs["device_consumption"] == ENERGY_PREFS["device_consumption"]
    # The backup holds the lists as they were before.
    runtime = hass.config_entries.async_loaded_entries(DOMAIN)[0].runtime_data
    backup = runtime.backups.get(response["result"]["backup_id"])
    assert backup["data"] == {
        "energy_sources": ENERGY_PREFS["energy_sources"],
        "device_consumption_water": [],
    }


@pytest.mark.usefixtures("loaded_entry")
async def test_water_unit_warning_and_unknown_kind(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An energy meter in the water list gets a warning; other kinds are refused."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=base_hash,
        changes=[{"type": "add", "stat": "sensor.attic_energy", "kind": "water"}],
    )
    result = response["result"]
    assert result["valid"]
    assert [(i["code"], i["kind"]) for i in result["issues"]] == [
        ("not_water_unit", "water")
    ]
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=base_hash,
        changes=[{"type": "add", "stat": "sensor.attic_energy", "kind": "gas"}],
    )
    assert response["error"]["code"] == "invalid_format"


@pytest.mark.usefixtures("loaded_entry")
async def test_save_with_backup_and_restore(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_storage: dict[str, Any],
) -> None:
    """Saving writes the devices, keeps sources and stores a backup to restore."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[
            {
                "type": "add",
                "stat": "sensor.printer_energy",
                "parent": "sensor.main_energy",
                "stat_rate": "sensor.printer_power",
            },
            {"type": "remove", "stat": "sensor.kitchen_energy"},
            {"type": "rename", "stat": "sensor.garage_energy", "name": "Garage"},
        ],
    )
    assert response["success"], response
    result = response["result"]
    assert result["hash"] != base_hash
    assert result["backup_id"]

    prefs = await energy_access.async_get_prefs(hass)
    devices = device_list(prefs)
    assert "sensor.kitchen_energy" not in devices
    assert devices["sensor.coffee_energy"]["included_in_stat"] == "sensor.main_energy"
    assert devices["sensor.printer_energy"] == {
        "stat_consumption": "sensor.printer_energy",
        "stat_rate": "sensor.printer_power",
        "included_in_stat": "sensor.main_energy",
    }
    assert devices["sensor.garage_energy"]["name"] == "Garage"
    assert prefs["energy_sources"] == ENERGY_PREFS["energy_sources"]

    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    (backup,) = response["result"]["backups"]
    assert backup["id"] == result["backup_id"]
    assert backup["summary"] == {"added": 1, "renamed": 1, "removed": 1, "moved": 1}
    assert backup["user_name"]
    assert "data" not in backup
    stored = hass_storage[STORAGE_KEY]["data"]["backups"][0]["data"]
    assert stored == {"device_consumption": ENERGY_PREFS["device_consumption"]}

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/restore",
        backup_id=backup["id"],
        base_hash=result["hash"],
    )
    assert response["success"], response
    assert response["result"]["hash"] == base_hash
    assert await energy_access.async_get_prefs(hass) == ENERGY_PREFS

    # Restoring created a backup of the state before the restore.
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    newest, oldest = response["result"]["backups"]
    assert oldest["id"] == backup["id"]
    assert newest["summary"] == {"restored": 1}

    # Restoring the same backup again changes nothing.
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/restore",
        backup_id=backup["id"],
        base_hash=base_hash,
    )
    assert response["result"] == {"hash": base_hash, "backup_id": None}


@pytest.mark.usefixtures("loaded_entry")
async def test_save_without_effect(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Changes that end where they started write nothing and make no backup."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[
            {
                "type": "move",
                "stat": "sensor.garage_energy",
                "parent": "sensor.main_energy",
            },
            {"type": "move", "stat": "sensor.garage_energy", "parent": None},
        ],
    )
    assert response["result"] == {"hash": base_hash, "backup_id": None}
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    assert response["result"]["backups"] == []


@pytest.mark.usefixtures("loaded_entry")
async def test_failed_write_keeps_backup(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A write that fails once started keeps its backup; it may have happened."""
    base_hash = await current_hash(hass_ws_client, hass)

    async def fail(hass: HomeAssistant, update: Any, expected_hash: str) -> None:
        raise energy_access.unsupported_error()

    monkeypatch.setattr(energy_access, "async_write", fail)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[{"type": "remove", "stat": "sensor.garage_energy"}],
    )
    assert not response["success"]
    assert response["error"]["translation_key"] == "unsupported_energy_api"
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    assert len(response["result"]["backups"]) == 1


# An external statistic cannot have the fixed price of the grid connection.
EXTERNAL_IMPORT = {
    "type": "assign_source",
    "role": "import",
    "stat": "utility:grid_meter",
}


@pytest.mark.usefixtures("loaded_entry")
async def test_rejected_by_home_assistant(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Validating reports what HA's schemas reject; saving it makes no backup."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=base_hash,
        changes=[EXTERNAL_IMPORT],
    )
    result = response["result"]
    assert result["valid"] is False
    assert result["issues"] == []
    assert "external statistics" in result["rejected"]

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[EXTERNAL_IMPORT],
    )
    assert response["error"]["translation_key"] == "rejected_by_home_assistant"
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    assert response["result"]["backups"] == []
    assert await energy_access.async_get_prefs(hass) == ENERGY_PREFS


@pytest.mark.usefixtures("loaded_entry")
async def test_conflict_while_storing_backup(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A change made elsewhere while the backup is stored is not overwritten."""
    base_hash = await current_hash(hass_ws_client, hass)
    backups = loaded_entry.runtime_data.backups
    add = backups.async_add
    elsewhere = [{"stat_consumption": "sensor.main_energy"}]

    async def add_and_change(*args: Any) -> str:
        backup_id = await add(*args)
        await energy_access.async_write(hass, {"device_consumption": elsewhere})
        return backup_id

    monkeypatch.setattr(backups, "async_add", add_and_change)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[{"type": "remove", "stat": "sensor.garage_energy"}],
    )
    assert response["error"]["translation_key"] == "conflict"
    prefs = await energy_access.async_get_prefs(hass)
    assert prefs["device_consumption"] == elsewhere
    assert backups.entries() == []


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    ("command", "changes", "translation_key"),
    [
        ("save", [{"type": "remove", "stat": "sensor.nope"}], "unknown_device"),
        ("validate", [{"type": "add", "stat": "sensor.main_energy"}], "device_exists"),
        (
            "save",
            [
                {
                    "type": "move",
                    "stat": "sensor.main_energy",
                    "parent": "sensor.main_energy",
                }
            ],
            "invalid_changes",
        ),
        (
            "save",
            [{"type": "add", "stat": "sensor.grid_import"}],
            "invalid_changes",
        ),
    ],
)
async def test_change_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    command: str,
    changes: list[dict[str, Any]],
    translation_key: str,
) -> None:
    """Invalid drafts are refused with a translated error and nothing changes."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/{command}",
        base_hash=base_hash,
        changes=changes,
    )
    assert not response["success"]
    assert response["error"]["translation_domain"] == DOMAIN
    assert response["error"]["translation_key"] == translation_key
    assert await current_hash(hass_ws_client, hass) == base_hash


@pytest.mark.usefixtures("loaded_entry")
async def test_invalid_changes_lists_errors(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The error names the problems."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=await current_hash(hass_ws_client, hass),
        changes=[{"type": "add", "stat": "sensor.grid_import"}],
    )
    assert response["error"]["translation_placeholders"] == {
        "issues": "source_and_device (sensor.grid_import)"
    }


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize("command", ["validate", "save"])
async def test_conflict(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, command: str
) -> None:
    """A draft based on outdated prefs is refused."""
    base_hash = await current_hash(hass_ws_client, hass)
    await energy_access.async_write(hass, {"device_consumption": []})
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/{command}",
        base_hash=base_hash,
        changes=[],
    )
    assert response["error"]["translation_key"] == "conflict"


@pytest.mark.usefixtures("loaded_entry")
async def test_restore_errors(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Unknown backups and outdated hashes are refused."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/restore",
        backup_id="nope",
        base_hash="x",
    )
    assert response["error"]["translation_key"] == "backup_not_found"
    assert response["error"]["translation_placeholders"] == {"backup_id": "nope"}


@pytest.mark.usefixtures("loaded_entry")
async def test_schema_rejects_unknown_change_type(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash="x",
        changes=[{"type": "explode", "stat": "sensor.main_energy"}],
    )
    assert response["error"]["code"] == "invalid_format"


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    "msg",
    [
        {"type": f"{DOMAIN}/get"},
        {"type": f"{DOMAIN}/backups"},
        {"type": f"{DOMAIN}/validate", "base_hash": "x", "changes": []},
        {"type": f"{DOMAIN}/save", "base_hash": "x", "changes": []},
        {"type": f"{DOMAIN}/restore", "base_hash": "x", "backup_id": "x"},
        {"type": f"{DOMAIN}/export"},
        {"type": f"{DOMAIN}/import_check", "base_hash": "x", "document": {}},
        {"type": f"{DOMAIN}/import", "base_hash": "x", "document": {}},
        {"type": f"{DOMAIN}/energy", "period": "today"},
        {"type": f"{DOMAIN}/create_integral", "power_entity_id": "x", "name": "x"},
    ],
)
async def test_admin_required(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    msg: dict[str, Any],
) -> None:
    """Users who are not admins cannot use any command but the card's."""
    response = await send(hass_ws_client, hass, hass_read_only_access_token, **msg)
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


@pytest.mark.usefixtures("loaded_entry")
async def test_card_for_every_user(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """The card reads the electricity tree with names; no prices, no period."""
    response = await send(
        hass_ws_client, hass, hass_read_only_access_token, type=f"{DOMAIN}/card"
    )
    assert response["success"], response
    result = response["result"]
    assert result["kind"] == "electricity"
    assert result["water_unit"] == "L"
    devices = {d["stat"]: d for d in result["devices"]}
    assert list(devices)[:2] == ["sensor.main_energy", "sensor.kitchen_energy"]
    assert devices["sensor.main_energy"] == {
        "stat": "sensor.main_energy",
        "name": "Main",
        "parent": None,
        "stat_rate": "sensor.main_power",
        "area": None,
    }
    assert devices["sensor.kitchen_energy"]["parent"] == "sensor.main_energy"
    assert devices["sensor.kitchen_energy"]["area"] == "Kitchen"
    assert [(s["type"], s["role"], s["stat"]) for s in result["sources"]] == [
        ("grid", "import", "sensor.grid_import"),
        ("grid", "export", "sensor.grid_export"),
        ("solar", "production", "sensor.solar_energy"),
        ("battery", "discharge", "sensor.battery_out"),
        ("battery", "charge", "sensor.battery_in"),
    ]
    assert "energy" not in result
    assert "price" not in str(result)


@pytest.mark.usefixtures("loaded_entry")
async def test_card_water_in_a_period(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    energy_values: dict[str, Any],
) -> None:
    """A water card gets the water tree, its meters and the period values."""
    await energy_access.async_write(
        hass,
        {
            "energy_sources": [
                *ENERGY_PREFS["energy_sources"],
                {"type": "gas", "stat_energy_from": "sensor.gas"},
                {
                    "type": "water",
                    "stat_energy_from": "sensor.water_meter",
                    "name": "Main water",
                    "number_energy_price": 2.0,
                },
            ],
            "device_consumption_water": [
                {"stat_consumption": "sensor.house_water", "name": "House"},
                {
                    "stat_consumption": "portal:garden",
                    "included_in_stat": "sensor.house_water",
                },
            ],
        },
    )
    energy_values.update({"sensor.house_water": 100.0, "portal:garden": 120.0})
    response = await send(
        hass_ws_client,
        hass,
        hass_read_only_access_token,
        type=f"{DOMAIN}/card",
        kind="water",
        period="week",
    )
    result = response["result"]
    assert result["kind"] == "water"
    assert [(d["stat"], d["name"]) for d in result["devices"]] == [
        ("sensor.house_water", "House"),
        ("portal:garden", "portal:garden"),
    ]
    assert result["sources"] == [
        {
            "type": "water",
            "role": "water",
            "stat": "sensor.water_meter",
            "name": "Main water",
        }
    ]
    assert result["period"] == "week"
    assert set(result["energy"]) == {
        "sensor.house_water",
        "portal:garden",
        "sensor.water_meter",
    }
    assert result["untracked"] == {"sensor.house_water": -20.0}
    assert [(i["stat"], i["kind"]) for i in result["issues"]] == [
        ("sensor.house_water", "water")
    ]
    assert "price" not in str(result)


async def test_card_errors(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """Unknown lists and periods are refused; without the entry nothing works."""
    for msg in ({"kind": "gas"}, {"period": "year"}):
        response = await send(hass_ws_client, hass, type=f"{DOMAIN}/card", **msg)
        assert response["error"]["code"] == "invalid_format"
    assert await hass.config_entries.async_unload(loaded_entry.entry_id)
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/card")
    assert response["error"]["translation_key"] == "not_loaded"


@pytest.mark.parametrize(
    "msg",
    [
        {"type": f"{DOMAIN}/get"},
        {"type": f"{DOMAIN}/backups"},
    ],
)
async def test_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    msg: dict[str, Any],
) -> None:
    """Commands fail while the entry is not loaded."""
    assert await hass.config_entries.async_unload(loaded_entry.entry_id)
    response = await send(hass_ws_client, hass, **msg)
    assert response["error"]["translation_key"] == "not_loaded"


async def test_unsupported(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """Commands refuse to work when the energy API does not fit."""
    loaded_entry.runtime_data.supported = False
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert response["error"]["translation_key"] == "unsupported_energy_api"


@pytest.mark.usefixtures("loaded_entry")
async def test_get_lists_power_candidates(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The snapshot lists power-only sensors; nothing is a created helper."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    result = response["result"]
    assert [c["stat"] for c in result["power_candidates"]] == ["sensor.ups_power"]
    assert all(c["created_helper"] is False for c in result["candidates"])


@pytest.mark.usefixtures("loaded_entry")
async def test_save_sources(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Sources are assigned and removed; grid prices stay."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[
            {
                "type": "assign_source",
                "role": "import",
                "stat": "sensor.attic_energy",
                "replace": "sensor.grid_import",
            },
            {"type": "unassign_source", "stat": "sensor.solar_energy"},
            {
                "type": "assign_source",
                "role": "battery",
                "stat": "sensor.printer_energy",
                "stat_to": "sensor.grid_import",
            },
        ],
    )
    assert response["success"], response
    sources = (await energy_access.async_get_prefs(hass))["energy_sources"]
    grid = sources[0]
    assert grid["stat_energy_from"] == "sensor.attic_energy"
    assert grid["number_energy_price"] == 0.3
    assert grid["number_energy_price_export"] == 0.08
    assert [s["type"] for s in sources] == ["grid", "battery", "battery"]
    assert sources[2]["stat_energy_to"] == "sensor.grid_import"
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    (backup,) = response["result"]["backups"]
    assert backup["summary"] == {"source_added": 3, "source_removed": 2}


@pytest.mark.usefixtures("loaded_entry")
async def test_sensor_cannot_be_source_twice(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A statistic used by two sources is refused."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=await current_hash(hass_ws_client, hass),
        changes=[
            {
                "type": "assign_source",
                "role": "production",
                "stat": "sensor.grid_export",
            },
        ],
    )
    assert response["error"]["translation_key"] == "invalid_changes"
    issues = response["error"]["translation_placeholders"]["issues"]
    assert "duplicate_source" in issues


@pytest.mark.usefixtures("loaded_entry")
async def test_unassign_unknown_source(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Removing a statistic that is no source fails."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/validate",
        base_hash=await current_hash(hass_ws_client, hass),
        changes=[{"type": "unassign_source", "stat": "sensor.nope"}],
    )
    assert response["error"]["translation_key"] == "unknown_source"


async def test_create_integral(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A real integral helper is created and remembered."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id="sensor.ups_power",
        name=" UPS energy ",
    )
    assert response["success"], response
    entity_id = response["result"]["entity_id"]
    assert response["result"]["stat_rate"] == "sensor.ups_power"
    entries = hass.config_entries.async_entries("integration")
    helper = next(e for e in entries if e.options.get("source") == "sensor.ups_power")
    assert helper.title == "UPS energy"
    assert helper.options["method"] == "left"
    assert helper.options["unit_prefix"] == "k"
    assert loaded_entry.runtime_data.helpers.entries() == [helper.entry_id]
    await hass.async_block_till_done()
    assert hass.states.get(entity_id) is not None

    # The power sensor is no longer offered; the new meter is labelled.
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    result = response["result"]
    assert result["power_candidates"] == []
    created = [c for c in result["candidates"] if c["stat"] == entity_id]
    assert all(c["created_helper"] for c in created)


async def test_create_water_meter(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
) -> None:
    """A flow sensor gets an integral helper in litres, shown as water."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert [c["stat"] for c in response["result"]["flow_candidates"]] == [
        "sensor.tap_flow"
    ]
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id="sensor.tap_flow",
        name="Tap water",
    )
    assert response["success"], response
    result = response["result"]
    assert result["kind"] == "water"
    assert result["stat_rate"] == "sensor.tap_flow"
    entries = hass.config_entries.async_entries("integration")
    helper = next(e for e in entries if e.options.get("source") == "sensor.tap_flow")
    assert helper.options["unit_time"] == "min"
    assert "unit_prefix" not in helper.options
    entity = er.async_get(hass).async_get(result["entity_id"])
    assert entity is not None
    assert entity.device_class == "water"
    assert loaded_entry.runtime_data.helpers.entries() == [helper.entry_id]
    # Once the flow changes, the meter counts litres and reads as water.
    hass.states.async_set(
        "sensor.tap_flow",
        "6",
        {"device_class": "volume_flow_rate", "unit_of_measurement": "L/min"},
        force_update=True,
    )
    await hass.async_block_till_done()
    state = hass.states.get(result["entity_id"])
    assert state is not None
    assert state.attributes.get("device_class") == "water"
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/get")
    assert response["result"]["flow_candidates"] == []
    # An electricity meter keeps the kind electricity.
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id="sensor.ups_power",
        name="UPS energy",
    )
    assert response["result"]["kind"] == "electricity"


async def test_water_meter_needs_a_flow_unit(hass: HomeAssistant) -> None:
    """A flow in a unit without matching water unit is refused."""
    hass.states.async_set("sensor.drip_flow", "1", {"unit_of_measurement": "mL/s"})
    with pytest.raises(HomeAssistantError) as err:
        await integral_module.async_create_integral(
            hass, "sensor.drip_flow", "Drip", DeviceKind.WATER
        )
    assert err.value.translation_key == "integral_failed"


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    "power",
    ["sensor.poe_power", "sensor.printer_power", "sensor.nope", "sensor.drip_flow"],
)
async def test_create_integral_refuses_other_sensors(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator, power: str
) -> None:
    """Integrated, metered and unknown sensors are refused."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id=power,
        name="x",
    )
    assert response["error"]["translation_key"] == "not_a_power_candidate"
    assert response["error"]["translation_placeholders"] == {"entity_id": power}


@pytest.mark.usefixtures("loaded_entry")
async def test_create_integral_flow_failure(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A flow that does not create an entry is reported."""

    async def no_entry(flow_id: str, user_input: Any) -> dict[str, Any]:
        return {"type": FlowResultType.FORM}

    monkeypatch.setattr(hass.config_entries.flow, "async_configure", no_entry)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id="sensor.ups_power",
        name="",
    )
    assert response["error"]["translation_key"] == "integral_failed"


async def test_create_integral_without_entity(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    loaded_entry: MockConfigEntry,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An entry without entity is reported and not remembered."""
    monkeypatch.setattr(
        integral_module.er,
        "async_entries_for_config_entry",
        lambda registry, entry_id: [],
    )
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/create_integral",
        power_entity_id="sensor.ups_power",
        name="x",
    )
    assert response["error"]["translation_key"] == "integral_failed"
    assert loaded_entry.runtime_data.helpers.entries() == []


@pytest.fixture
def energy_values(monkeypatch: pytest.MonkeyPatch) -> dict[str, float | None]:
    """Fake the energy per statistic returned for any period."""
    values: dict[str, float | None] = {
        "sensor.main_energy": 10.0,
        "sensor.kitchen_energy": 8.0,
        "sensor.coffee_energy": 9.0,
        "sensor.grinder_energy": 1.0,
        "sensor.garage_energy": None,
        "sensor.grid_import": 12.0,
    }
    calls: list[Any] = []

    async def fake(
        hass: HomeAssistant, stats: list[str], period: str, now: Any
    ) -> dict[str, float | None]:
        calls.append((stats, period))
        return {stat: values.get(stat) for stat in stats}

    monkeypatch.setattr(websocket_module, "async_energy", fake)
    values["_calls"] = calls  # type: ignore[assignment]
    return values


@pytest.mark.usefixtures("loaded_entry")
async def test_energy(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    energy_values: dict[str, Any],
) -> None:
    """Energy, untracked energy and warnings of the saved tree."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/energy", period="week")
    assert response["success"], response
    result = response["result"]
    assert result["period"] == "week"
    assert result["start"] < result["end"]
    assert result["energy"]["sensor.main_energy"] == 10.0
    assert result["energy"]["sensor.grid_import"] == 12.0
    assert result["energy"]["sensor.battery_in"] is None
    assert result["untracked"] == {
        "sensor.main_energy": 2.0,
        "sensor.kitchen_energy": -1.0,
        "sensor.coffee_energy": 8.0,
    }
    # The kitchen's coffee machine used more than the kitchen itself.
    assert result["issues"] == [
        {
            "code": "children_exceed_parent",
            "severity": "warning",
            "stat": "sensor.kitchen_energy",
            "details": {"parent": 8.0, "children": 9.0, "excess": 1.0},
            "kind": "electricity",
        }
    ]
    assert result["water_unit"] == "L"
    stats, period = energy_values["_calls"][0]
    assert period == "week"
    assert stats[:5] == [
        "sensor.main_energy",
        "sensor.kitchen_energy",
        "sensor.coffee_energy",
        "sensor.grinder_energy",
        "sensor.garage_energy",
    ]
    assert "sensor.solar_energy" in stats


@pytest.mark.usefixtures("loaded_entry")
async def test_energy_of_water_devices(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    energy_values: dict[str, Any],
) -> None:
    """Water devices get untracked values and their own warning limit (10 L)."""
    await energy_access.async_write(
        hass,
        {
            "device_consumption_water": [
                {"stat_consumption": "sensor.house_water"},
                {
                    "stat_consumption": "sensor.garden_water",
                    "included_in_stat": "sensor.house_water",
                },
                {"stat_consumption": "sensor.shed_water"},
                {
                    "stat_consumption": "sensor.hose_water",
                    "included_in_stat": "sensor.shed_water",
                },
            ]
        },
    )
    energy_values.update(
        {
            # 8 L more than the house: below the limit of 10 L.
            "sensor.house_water": 100.0,
            "sensor.garden_water": 108.0,
            # 12 L more than the shed: a warning.
            "sensor.shed_water": 100.0,
            "sensor.hose_water": 112.0,
        }
    )
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/energy", period="week")
    result = response["result"]
    assert result["untracked"]["sensor.house_water"] == -8.0
    assert result["untracked"]["sensor.shed_water"] == -12.0
    assert [(i["stat"], i["kind"]) for i in result["issues"]] == [
        ("sensor.kitchen_energy", "electricity"),
        ("sensor.shed_water", "water"),
    ]


@pytest.mark.usefixtures("loaded_entry")
async def test_energy_of_a_draft(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    energy_values: dict[str, Any],
) -> None:
    """With a draft, the tree of the draft is used."""
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/energy",
        period="today",
        base_hash=await current_hash(hass_ws_client, hass),
        changes=[{"type": "move", "stat": "sensor.coffee_energy", "parent": None}],
    )
    result = response["result"]
    assert result["issues"] == []
    assert "sensor.kitchen_energy" not in result["untracked"]
    assert result["untracked"]["sensor.coffee_energy"] == 8.0


@pytest.mark.usefixtures("loaded_entry")
async def test_energy_errors(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """Unknown periods and a draft without hash are refused; conflicts too."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/energy", period="year")
    assert response["error"]["code"] == "invalid_format"
    response = await send(
        hass_ws_client, hass, type=f"{DOMAIN}/energy", period="today", changes=[]
    )
    assert response["error"]["code"] == "invalid_format"
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/energy",
        period="today",
        base_hash="old",
        changes=[],
    )
    assert response["error"]["translation_key"] == "conflict"


@pytest.mark.usefixtures("loaded_entry")
async def test_export_current_and_backup(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The current settings and every backup can be exported."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/export")
    document = response["result"]
    assert document["format"] == "energy_flow_mapper"
    assert document["source"] == "current"
    assert dt_util.parse_datetime(document["exported"]) is not None
    assert document["data"] == {
        "energy_sources": ENERGY_PREFS["energy_sources"],
        "device_consumption": ENERGY_PREFS["device_consumption"],
        "device_consumption_water": [],
    }

    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[{"type": "remove", "stat": "sensor.garage_energy"}],
    )
    backup_id = response["result"]["backup_id"]
    response = await send(
        hass_ws_client, hass, type=f"{DOMAIN}/export", backup_id=backup_id
    )
    document = response["result"]
    assert document["source"] == "backup"
    assert document["backup"]["id"] == backup_id
    assert document["data"] == {
        "device_consumption": ENERGY_PREFS["device_consumption"]
    }

    response = await send(
        hass_ws_client, hass, type=f"{DOMAIN}/export", backup_id="nope"
    )
    assert response["error"]["translation_key"] == "backup_not_found"


@pytest.mark.usefixtures("loaded_entry")
async def test_import_round_trip(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """An export brings back the exported state, with a check and a backup first."""
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/export")
    document = response["result"]

    base_hash = await current_hash(hass_ws_client, hass)
    await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/save",
        base_hash=base_hash,
        changes=[
            {"type": "remove", "stat": "sensor.garage_energy"},
            {"type": "unassign_source", "stat": "sensor.solar_energy"},
        ],
    )
    changed_hash = await current_hash(hass_ws_client, hass)

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash=changed_hash,
        document=document,
    )
    result = response["result"]
    assert result["valid"] is True
    assert result["changed"] is True
    assert result["rejected"] is None
    assert {entry["type"] for entry in result["diff"]} == {"added", "source_added"}
    assert await current_hash(hass_ws_client, hass) == changed_hash

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import",
        base_hash=changed_hash,
        document=document,
    )
    assert response["success"], response
    assert response["result"]["backup_id"]
    assert await energy_access.async_get_prefs(hass) == ENERGY_PREFS
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    assert response["result"]["backups"][0]["summary"] == {"imported": 1}

    # Importing the same file again changes nothing and makes no backup.
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash=base_hash,
        document=document,
    )
    assert response["result"]["changed"] is False
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import",
        base_hash=base_hash,
        document=document,
    )
    assert response["result"] == {"hash": base_hash, "backup_id": None}


CYCLE_DOCUMENT = {
    "format": "energy_flow_mapper",
    "version": 1,
    "data": {
        "device_consumption": [
            {"stat_consumption": "sensor.main_energy", "included_in_stat": "sensor.b"},
            {"stat_consumption": "sensor.b", "included_in_stat": "sensor.main_energy"},
        ]
    },
}


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    ("document", "translation_key"),
    [
        ({"format": "something else"}, "invalid_import"),
        (CYCLE_DOCUMENT, "invalid_changes"),
        (
            {
                "format": "energy_flow_mapper",
                "version": 1,
                "data": {"device_consumption": [{"name": "no statistic"}]},
            },
            "rejected_by_home_assistant",
        ),
    ],
)
async def test_import_refused(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    document: dict[str, Any],
    translation_key: str,
) -> None:
    """Wrong files and files with errors in the hierarchy are not written."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import",
        base_hash=base_hash,
        document=document,
    )
    assert response["error"]["translation_key"] == translation_key
    assert await energy_access.async_get_prefs(hass) == ENERGY_PREFS
    response = await send(hass_ws_client, hass, type=f"{DOMAIN}/backups")
    assert response["result"]["backups"] == []


@pytest.mark.usefixtures("loaded_entry")
async def test_import_check_reports_problems(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The check lists hierarchy errors, what HA rejects and wrong files."""
    base_hash = await current_hash(hass_ws_client, hass)
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash=base_hash,
        document=CYCLE_DOCUMENT,
    )
    result = response["result"]
    assert result["valid"] is False
    assert {issue["code"] for issue in result["issues"]} >= {"cycle"}

    rejected = {
        "format": "energy_flow_mapper",
        "version": 1,
        "data": {"device_consumption": [{"name": "no statistic"}]},
    }
    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash=base_hash,
        document=rejected,
    )
    result = response["result"]
    assert result["valid"] is False
    assert result["rejected"]
    # Malformed lists are not checked or described as a hierarchy.
    assert result["issues"] == []
    assert result["diff"] == []

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash=base_hash,
        document={"format": "energy_flow_mapper", "version": 9, "data": {}},
    )
    assert response["error"]["translation_key"] == "invalid_import"

    response = await send(
        hass_ws_client,
        hass,
        type=f"{DOMAIN}/import_check",
        base_hash="outdated",
        document=CYCLE_DOCUMENT,
    )
    assert response["error"]["translation_key"] == "conflict"
