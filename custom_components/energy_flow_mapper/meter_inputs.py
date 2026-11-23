"""What a meter contains: the inputs of the helper behind a statistic.

Only reads; no helper is ever changed. A helper made in the UI keeps its inputs
in its config entry:

- a template sensor in the text of its `state` template,
- a sensor group in `entities` (only a `sum` adds them up),
- an integral and a utility meter in `source`.

Inputs are followed into helpers they are made of, up to `MAX_DEPTH` levels,
and each helper once per path. A sensor that is no helper, an external
statistic and a helper set up in YAML (no config entry) hold nothing.

`subtracted` are the inputs a template takes away (`a - b`). `signed_known` is
False when it is unclear how an input counts: a group that does not add, a
template that iterates states or uses `expand(`, one that does not compile or
fails to render, a helper that holds itself, or helpers nested deeper than
`MAX_DEPTH`.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Collection, Iterable, MutableMapping
from dataclasses import dataclass
from typing import Final, TypedDict

from homeassistant.core import HomeAssistant, callback, valid_entity_id
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.template import Template

_LOGGER = logging.getLogger(__name__)

MAX_DEPTH: Final = 5

# Where an entity ID stands in a template's text: as a function's argument or
# `states.<entity>`, or in the filter form (`'sensor.x' | states`).
_ENTITY = re.compile(
    r"(?:states\(|state_attr\(|is_state\(|has_value\(|states\.)['\"]?"
    r"([a-z_]+\.[a-z0-9_]+)"
)
_ENTITY_FILTER = re.compile(
    r"['\"]([a-z_]+\.[a-z0-9_]+)['\"]\s*\|\s*"
    r"(?:states|state_attr|is_state|has_value)\b"
)
# Text that needs a render: `expand(`, or iterating (all) states, such as
# `states | …`, `states.sensor | …` or `for … in states` (not the filter
# `'sensor.x' | states`).
_NEEDS_RENDER = re.compile(
    r"expand\(|(?<!\|)(?<!\|\s)\bstates(?:\.[a-z_]+)?\s*\||\bin\s+states\b"
)
# `{% set name = ... %}`.
_SET = re.compile(r"\{%-?\s*set\s+(\w+)\s*=(.*?)-?%\}", re.DOTALL)


class MeterInputs(TypedDict):
    """The inputs of a meter, from all levels."""

    entities: set[str]
    signed_known: bool
    subtracted: set[str]


@dataclass(frozen=True, slots=True)
class _Direct:
    """The inputs of one helper itself, without the inputs of its inputs."""

    entities: frozenset[str] = frozenset()
    subtracted: frozenset[str] = frozenset()
    signed_known: bool = True


_NOTHING: Final = _Direct()

type Cache = MutableMapping[str, _Direct]


def _known(hass: HomeAssistant, registry: er.EntityRegistry, entity_id: str) -> bool:
    """Return True if `entity_id` is an entity: registered or with a state."""
    return (
        registry.async_get(entity_id) is not None
        or hass.states.get(entity_id) is not None
    )


def _minus_operands(text: str) -> Iterable[str]:
    """Yield the text of what each minus applies to.

    An operand runs to the next `+`, `-` or `,` at its own bracket level, or
    to the end of the expression (`}}`, `%}`, a closing bracket). A minus of
    Jinja's whitespace control (`{{-`, `-}}`, `{%-`, `-%}`) is none. This
    takes in more than the operand at times (`- a if x else b`), which only
    marks more inputs as subtracted.
    """
    for match in re.finditer("-", text):
        start = match.start()
        if text[start - 1 : start] in ("{", "%") or text[start + 1 : start + 2] in (
            "}",
            "%",
        ):
            continue
        depth = 0
        end = start + 1
        while end < len(text):
            char = text[end]
            if char in "([":
                depth += 1
            elif char in ")]":
                depth -= 1
                if depth < 0:
                    break
            elif depth == 0 and (char in "+-," or text[end : end + 2] in ("}}", "%}")):
                break
            end += 1
        yield text[start + 1 : end]


def _template_inputs(hass: HomeAssistant, text: str) -> _Direct:
    """Return the inputs of a template, read from its text.

    Entity IDs are read with `_ENTITY` and kept if they are entities. Only
    text with `expand(` or that iterates states is rendered, for the
    entities it reads; their signs are unknown then.
    """
    registry = er.async_get(hass)
    entities = {
        entity
        for entity in [*_ENTITY.findall(text), *_ENTITY_FILTER.findall(text)]
        if valid_entity_id(entity) and _known(hass, registry, entity)
    }
    signed_known = True
    template = Template(text, hass)
    try:
        template.ensure_valid()
    except Exception:  # noqa: BLE001 - any error: the signs are unknown
        signed_known = False
    if _NEEDS_RENDER.search(text):
        signed_known = False
        try:
            info = template.async_render_to_info()
        except Exception:  # any error: the signs are unknown
            _LOGGER.debug("Reading the inputs of a template failed", exc_info=True)
        else:
            entities |= set(info.entities)
    variables = {
        name: {entity for entity in entities if _mentions(value, entity)}
        for name, value in _SET.findall(text)
    }
    subtracted: set[str] = set()
    for operand in _minus_operands(text):
        subtracted |= {entity for entity in entities if _mentions(operand, entity)}
        for name, held in variables.items():
            if re.search(rf"(?<![\w.'\"]){re.escape(name)}(?!\w)", operand):
                subtracted |= held
    return _Direct(frozenset(entities), frozenset(subtracted), signed_known)


def _mentions(text: str, entity: str) -> bool:
    """Return True if `text` names `entity` (not one that starts like it)."""
    return re.search(rf"(?<![\w]){re.escape(entity)}(?!\w)", text) is not None


def _direct(hass: HomeAssistant, entity_id: str) -> _Direct:
    """Return the inputs of the helper behind `entity_id` itself."""
    if not valid_entity_id(entity_id):
        return _NOTHING
    entry = er.async_get(hass).async_get(entity_id)
    config_entry = (
        hass.config_entries.async_get_entry(entry.config_entry_id)
        if entry is not None and entry.config_entry_id
        else None
    )
    if config_entry is None:
        return _NOTHING
    options = config_entry.options
    if config_entry.domain == "template":
        state = options.get("state")
        return _template_inputs(hass, state) if isinstance(state, str) else _NOTHING
    if config_entry.domain == "group" and options.get("group_type") == "sensor":
        members = frozenset(
            str(member) for member in options.get("entities", []) if member
        )
        return _Direct(members, signed_known=options.get("type") == "sum")
    if config_entry.domain in ("integration", "utility_meter") and (
        source := options.get("source")
    ):
        return _Direct(frozenset({str(source)}))
    return _NOTHING


def _cached(hass: HomeAssistant, entity_id: str, cache: Cache) -> _Direct:
    """Return the direct inputs, read once per cache; an error gives unknown."""
    if entity_id not in cache:
        try:
            cache[entity_id] = _direct(hass, entity_id)
        except Exception:  # one meter must not break the others
            _LOGGER.debug("Reading the inputs of %s failed", entity_id, exc_info=True)
            cache[entity_id] = _Direct(signed_known=False)
    return cache[entity_id]


def _collect(
    hass: HomeAssistant,
    entity_id: str,
    cache: Cache,
    path: tuple[str, ...],
    found: MeterInputs,
) -> None:
    """Add the inputs of `entity_id` (level `len(path)`) to `found`.

    `path` holds the helpers above it. What a subtracted input holds is
    subtracted as a whole.
    """
    direct = _cached(hass, entity_id, cache)
    if not direct.signed_known:
        found["signed_known"] = False
    for entity in direct.entities:
        found["entities"].add(entity)
        if entity in path or entity == entity_id:
            found["signed_known"] = False
            continue
        if len(path) + 1 >= MAX_DEPTH:
            if _cached(hass, entity, cache).entities:
                found["signed_known"] = False
            continue
        inner: MeterInputs = {
            "entities": set(),
            "signed_known": True,
            "subtracted": set(),
        }
        _collect(hass, entity, cache, (*path, entity_id), inner)
        found["entities"] |= inner["entities"]
        found["signed_known"] = found["signed_known"] and inner["signed_known"]
        if entity in direct.subtracted:
            found["subtracted"] |= {entity} | inner["entities"]
        else:
            found["subtracted"] |= inner["subtracted"]
    found["subtracted"] |= direct.subtracted


@callback
def meter_inputs(
    hass: HomeAssistant, entity: str, cache: Cache | None = None
) -> MeterInputs:
    """Return what the meter `entity` holds, from all levels.

    `cache` keeps what each helper holds itself; pass one dict for all
    meters of one request.
    """
    found: MeterInputs = {"entities": set(), "signed_known": True, "subtracted": set()}
    _collect(hass, entity, {} if cache is None else cache, (), found)
    return found


@callback
def counted_inputs(
    hass: HomeAssistant, stats: Collection[str], cache: Cache | None = None
) -> dict[str, list[str]]:
    """Return per meter what it counts with a known plus sign.

    These are the inputs that `hierarchy.counted_twice` checks. Meters whose
    signs are unknown, and meters that hold nothing, are left out.
    """
    cache = {} if cache is None else cache
    result: dict[str, list[str]] = {}
    for stat in stats:
        inputs = meter_inputs(hass, stat, cache)
        counted = inputs["entities"] - inputs["subtracted"]
        if inputs["signed_known"] and counted:
            result[stat] = sorted(counted)
    return result
