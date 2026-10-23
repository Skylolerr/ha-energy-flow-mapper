"""Tests for the WebSocket commands used by the panel."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.typing import WebSocketGenerator

from custom_components.energy_flow_mapper import energy_access
from custom_components.energy_flow_mapper import integral as integral_module
from custom_components.energy_flow_mapper.const import DOMAIN, STORAGE_KEY

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
    }
    assert await current_hash(hass_ws_client, hass) == base_hash


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
async def test_failed_write_drops_backup(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If Home Assistant rejects the write, no backup is left behind."""
    base_hash = await current_hash(hass_ws_client, hass)

    async def reject(hass: HomeAssistant, update: Any) -> None:
        raise energy_access.unsupported_error()

    monkeypatch.setattr(energy_access, "async_write", reject)
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
    assert response["result"]["backups"] == []


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
    ],
)
async def test_admin_required(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
    msg: dict[str, Any],
) -> None:
    """Users who are not admins cannot use any command."""
    response = await send(hass_ws_client, hass, hass_read_only_access_token, **msg)
    assert not response["success"]
    assert response["error"]["code"] == "unauthorized"


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
            {"type": "assign_source", "role": "import", "stat": "sensor.attic_energy"},
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


@pytest.mark.usefixtures("loaded_entry")
@pytest.mark.parametrize(
    "power", ["sensor.poe_power", "sensor.printer_power", "sensor.nope"]
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
