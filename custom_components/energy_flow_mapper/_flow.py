"""Drive a Home Assistant helper config flow to create one helper.

Sum groups, template sensors and integrals are ordinary helpers made through
the config flow of their integration. This is the one place that runs those
flows: refused input and lost flows end in the caller's error, no flow is left
open, and an entry that cannot be used is removed again.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import suppress
from typing import Any

import probatio as vol
from homeassistant.config_entries import SOURCE_USER
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import (
    FlowManager,
    FlowResultType,
    InvalidData,
    UnknownFlow,
)
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er


def _abort(manager: FlowManager[Any, Any, Any], flow_id: str) -> None:
    """Leave no flow behind."""
    with suppress(UnknownFlow):
        manager.async_abort(flow_id)


async def _configure(
    manager: FlowManager[Any, Any, Any],
    flow_id: str,
    user_input: dict[str, Any],
    error: Callable[[], HomeAssistantError],
) -> Any:
    """Run one flow step; refused input and lost flows end in `error()`.

    A helper's own validation (a unit its device class refuses) raises
    `Invalid` straight out of the step instead of showing a form error.
    """
    try:
        return await manager.async_configure(flow_id, user_input)
    except (InvalidData, UnknownFlow, vol.Invalid) as err:
        _abort(manager, flow_id)
        raise error() from err


async def _run(
    manager: FlowManager[Any, Any, Any],
    result: Any,
    steps: list[dict[str, Any]],
    error: Callable[[], HomeAssistantError],
) -> Any:
    """Send `steps` in order; the last one must create the entry."""
    for step in steps:
        result = await _configure(manager, result["flow_id"], step, error)
    if result["type"] is not FlowResultType.CREATE_ENTRY:
        _abort(manager, result.get("flow_id", ""))
        raise error()
    return result


async def async_run_helper_flow(
    hass: HomeAssistant,
    domain: str,
    steps: list[dict[str, Any]],
    error: Callable[[], HomeAssistantError],
    *,
    options_steps: list[dict[str, Any]] | None = None,
) -> tuple[str, str]:
    """Create a helper of `domain`; return entry ID and entity ID.

    `steps` are the user inputs of the config flow, in order. `options_steps`,
    if given, run through the options flow of the new entry (for settings the
    config flow cannot set). Anything that goes wrong raises `error()`; once
    the entry exists, a failure removes it again: it was made by this request
    and nobody uses it.
    """
    flow = hass.config_entries.flow
    result = await flow.async_init(domain, context={"source": SOURCE_USER})
    result = await _run(flow, result, steps, error)
    entry_id = result["result"].entry_id
    try:
        if options_steps is not None:
            options = hass.config_entries.options
            started = await options.async_init(entry_id)
            await _run(options, started, options_steps, error)
        entities = er.async_entries_for_config_entry(er.async_get(hass), entry_id)
        if not entities:
            raise error()
    except HomeAssistantError:
        await hass.config_entries.async_remove(entry_id)
        raise
    return entry_id, entities[0].entity_id
