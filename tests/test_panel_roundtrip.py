"""The solar setup with exactly the messages the panel builds (`solar-setup.ts`).

`panel_message` and `panel_create` mirror `_message()` and `_create()` of the
panel: only the user's choices, and on create what the preview showed.
"""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant

from custom_components.energy_flow_mapper.const import DOMAIN

from .common import WebSocketGenerator
from .test_solar_setup import (
    MAIN,
    NO_DATA,
    PLUG,
    PLUG_RETURNED,
    PRO_EM,
    PRO_EM_POWER,
    SOLAR,
    SOLAR_POWER,
    WITH_SHELLY,
    WITH_SOLAR_POWER,
    Evidence,
    _shelly_plug,
    _shelly_pro_em,
    _template_entries,
    draft,
    evidence,  # noqa: F401 - the fixture, used by name
    lifetime,
    send,
    set_rate,
    set_solar_rate,
    solar_power,  # noqa: F401 - the autouse fixture
)

pytestmark = pytest.mark.usefixtures("sensors")


def panel_message(
    kind: str,
    stat: str,
    choices: dict[str, Any],
    changes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the panel's message: the device, solar, user's choices and draft."""
    msg: dict[str, Any] = {"type": f"{DOMAIN}/{kind}", "stat": stat, "solar": SOLAR}
    msg |= {
        key: choices[key] for key in ("method", "drawn", "returned") if choices.get(key)
    }
    if choices.get("invert") is not None:
        msg["invert"] = choices["invert"]
    if choices.get("periodic"):
        msg["periodic"] = dict(choices["periodic"])
    return msg | (changes or {})


def panel_create(
    stat: str,
    choices: dict[str, Any],
    changes: dict[str, Any] | None,
    preview: dict[str, Any],
    names: dict[str, str],
) -> dict[str, Any]:
    """Return the panel's create: its choices plus what the preview showed."""
    msg = panel_message("create_solar_setup", stat, choices, changes)
    msg |= {
        "method": preview["method"],
        "drawn": preview["drawn"],
        "invert": preview["invert"],
        "offset": preview["offset"],
        "names": {
            helper["role"]: names.get(helper["role"], helper["name_default"])
            for helper in preview["helpers"]
        },
    }
    if preview["returned"]:
        msg["returned"] = preview["returned"]
    return msg


async def roundtrip(
    hass: HomeAssistant,
    ws: WebSocketGenerator,
    stat: str,
    choices: dict[str, Any],
    changes: dict[str, Any] | None = None,
    names: dict[str, str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Preview, then create with what the panel sends; return both answers."""
    shown = await send(
        ws, hass, **panel_message("solar_setup_preview", stat, choices, changes)
    )
    assert shown["success"], shown
    preview: dict[str, Any] = shown["result"]
    created = await send(
        ws, hass, **panel_create(stat, choices, changes, preview, names or {})
    )
    return preview, created


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry")
async def test_em_roundtrip(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    request: pytest.FixtureRequest,
) -> None:
    """EM as suggested, with a signed circuit power: gross energy and power."""
    _shelly_pro_em(hass)
    found: Evidence = request.getfixturevalue("evidence")
    found[PRO_EM_POWER] = lifetime(went_negative=True)
    preview, created = await roundtrip(
        hass, hass_ws_client, PRO_EM, {}, names={"energy": "My gross"}
    )
    assert preview["method"] == "em"
    assert created["success"], created
    assert created["result"]["stat_rate"] is not None
    assert "My gross" in _template_entries(hass)


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry")
async def test_no_data_judged_by_the_user_roundtrip(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    request: pytest.FixtureRequest,
) -> None:
    """Without statistics EM is unverified until the user says "keeps counting"."""
    _shelly_pro_em(hass)
    found: Evidence = request.getfixturevalue("evidence")
    found[PRO_EM] = NO_DATA
    shown = await send(
        hass_ws_client, hass, **panel_message("solar_setup_preview", PRO_EM, {})
    )
    statuses = {m["method"]: m for m in shown["result"]["methods"]}
    assert statuses["em"]["reason"] == "unverified_no_data"
    preview, created = await roundtrip(
        hass, hass_ws_client, PRO_EM, {"periodic": {PRO_EM: False}}
    )
    statuses = {m["method"]: m for m in preview["methods"]}
    assert statuses["em"]["verified"] is True
    assert created["success"], created


@pytest.mark.parametrize("energy_prefs", [WITH_SHELLY])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_net_on_a_plug_keeps_the_previews_returned(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The returned sensor the preview showed is sent and accepted."""
    _shelly_plug(hass)
    preview, created = await roundtrip(hass, hass_ws_client, PLUG, {"method": "net"})
    assert preview["returned"] == PLUG_RETURNED
    assert created["success"], created


@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_draft_only_device_from_power_roundtrip(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """A device only in the draft, turned around, From power."""
    changes = await draft(
        hass_ws_client,
        hass,
        {"type": "add", "stat": "sensor.attic_energy", "stat_rate": "sensor.ups_power"},
        set_solar_rate(SOLAR_POWER),
    )
    preview, created = await roundtrip(
        hass,
        hass_ws_client,
        "sensor.attic_energy",
        {"method": "power", "invert": True},
        changes,
    )
    assert preview["invert"] is True
    assert preview["power"]["circuit_from"] == "draft"
    assert created["success"], created


@pytest.mark.parametrize("energy_prefs", [WITH_SOLAR_POWER])
@pytest.mark.usefixtures("loaded_entry", "evidence")
async def test_refused_draft_power_names_the_power_and_why(
    hass: HomeAssistant, hass_ws_client: WebSocketGenerator
) -> None:
    """The solar's power as the circuit's: refused, as the circuit power, used."""
    changes = await draft(hass_ws_client, hass, set_rate(MAIN, SOLAR_POWER))
    shown = await send(
        hass_ws_client, hass, **panel_message("solar_setup_preview", MAIN, {}, changes)
    )
    assert not shown["success"]
    assert shown["error"]["translation_key"] == "not_offered"
    assert shown["error"]["translation_placeholders"] == {
        "entity_id": SOLAR_POWER,
        "power": "circuit",
        "why": "used",
    }
