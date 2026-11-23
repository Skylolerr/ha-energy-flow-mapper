"""Tests for what a meter (a helper) contains."""

from __future__ import annotations

from typing import Any

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.template import Template

from custom_components.energy_flow_mapper.meter_inputs import (
    counted_inputs,
    meter_inputs,
)
from custom_components.energy_flow_mapper.solar_setup import (
    MeterKind,
    gross_energy_template,
)

from .common import MockConfigEntry
from .conftest import _meter

A, B, C = "sensor.a", "sensor.b", "sensor.c"


@pytest.fixture(autouse=True)
def plain_sensors(hass: HomeAssistant) -> None:
    """Three plain energy sensors."""
    for entity_id in (A, B, C):
        _meter(hass, entity_id)


def _helper(
    hass: HomeAssistant, domain: str, entity_id: str, options: dict[str, Any]
) -> None:
    """Add a helper config entry with its sensor entity."""
    entry = MockConfigEntry(domain=domain, options=options)
    entry.add_to_hass(hass)
    er.async_get(hass).async_get_or_create(
        "sensor",
        domain,
        entry.entry_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        config_entry=entry,
    )


def _template(hass: HomeAssistant, entity_id: str, state: str) -> None:
    _helper(hass, "template", entity_id, {"template_type": "sensor", "state": state})


def _group(
    hass: HomeAssistant, entity_id: str, members: list[str], kind: str = "sum"
) -> None:
    _helper(
        hass,
        "group",
        entity_id,
        {"group_type": "sensor", "type": kind, "entities": members},
    )


@pytest.mark.parametrize(
    ("state", "signed_known"),
    [
        ("{{ states('sensor.a') | float + states('sensor.b') | float }}", True),
        ('{{ states("sensor.a") | float + states.sensor.b.state | float }}', True),
        (
            "{{ (state_attr('sensor.a', 'x') or 0) + states.sensor.b.state | float }}",
            True,
        ),
        (
            "{% if is_state('sensor.a', 'on') and has_value('sensor.b') %}1{% endif %}",
            True,
        ),
        ("{{ 'sensor.a' | states | float + \"sensor.b\"|state_attr('x') }}", True),
        ("{{ states( 'sensor.a' ) | float + states( 'sensor.b' ) | float }}", True),
        ("{{ states(\n 'sensor.a') | float + states(\n 'sensor.b') | float }}", True),
        (
            "{{ states['sensor.a'].state | float + states['sensor.b'].state | float }}",
            True,
        ),
        # Only as quoted literals: inputs, but how they count is unknown.
        ("{{ ['sensor.a','sensor.b'] | map('states') | map('float',0) | sum }}", False),
        (
            (
                "{% set e = 'sensor.a' %}{% set f = 'sensor.b' %}"
                "{{ states(e) | float + states(f) | float }}"
            ),
            False,
        ),
        (
            (
                "{{ states.sensor"
                " | selectattr('entity_id','in',['sensor.a','sensor.b'])"
                " | map(attribute='state') | map('float', 0) | sum }}"
            ),
            False,
        ),
    ],
)
async def test_inputs_template_text_forms(
    hass: HomeAssistant, state: str, signed_known: bool
) -> None:
    """Entity IDs are read from the text of a template, in every common form."""
    _template(hass, "sensor.t", state)
    inputs = meter_inputs(hass, "sensor.t")
    assert inputs == {
        "entities": {A, B},
        "signed_known": signed_known,
        "subtracted": set(),
    }


async def test_inputs_ignore_comments(hass: HomeAssistant) -> None:
    """Code in a Jinja comment is no input."""
    _template(
        hass,
        "sensor.t",
        "{# old: states('sensor.b') + 'sensor.c' | states #}{{ states('sensor.a') }}",
    )
    assert meter_inputs(hass, "sensor.t") == {
        "entities": {A},
        "signed_known": True,
        "subtracted": set(),
    }


async def test_inputs_template_text_needs_a_known_entity(hass: HomeAssistant) -> None:
    """A name that is no entity is not an input; one with only a state is."""
    hass.states.async_set("sensor.yaml_only", "1")
    _template(
        hass,
        "sensor.t",
        "{{ states('sensor.missing') | float(0) + states('sensor.yaml_only')"
        " | float + states('sensor.a') | float }}",
    )
    assert meter_inputs(hass, "sensor.t")["entities"] == {A, "sensor.yaml_only"}


async def test_inputs_expand_renders(hass: HomeAssistant) -> None:
    """`expand(` is rendered to find the entities; their signs are not known."""
    _template(
        hass,
        "sensor.t",
        "{{ expand('sensor.a', 'sensor.b') | map(attribute='state')"
        " | map('float') | sum }}",
    )
    inputs = meter_inputs(hass, "sensor.t")
    assert inputs["entities"] == {A, B}
    assert inputs["signed_known"] is False


async def test_inputs_entity_functions_render(hass: HomeAssistant) -> None:
    """`integration_entities(` and its kind are rendered for the entities read."""
    entry = MockConfigEntry(domain="meters", title="Meters")
    entry.add_to_hass(hass)
    for entity_id in (A, B):
        er.async_get(hass).async_update_entity(
            entity_id, config_entry_id=entry.entry_id
        )
    _template(
        hass,
        "sensor.t",
        "{{ integration_entities('Meters') | map('states') | map('float', 0) | sum }}",
    )
    inputs = meter_inputs(hass, "sensor.t")
    assert inputs["entities"] == {A, B}
    assert inputs["signed_known"] is False


@pytest.mark.parametrize(
    "state",
    [
        (
            "{{ states.sensor | selectattr('entity_id', 'search', 'energy') | list"
            " | count }}"
        ),
        "{% for s in states.sensor %}{{ s.state }}{% endfor %}",
        "{% for s in states %}{{ s.state }}{% endfor %}",
    ],
)
async def test_inputs_iterating_states_renders(hass: HomeAssistant, state: str) -> None:
    """A template that iterates states is rendered and has unknown signs."""
    _template(hass, "sensor.t", state)
    assert meter_inputs(hass, "sensor.t")["signed_known"] is False


async def test_inputs_render_failure_is_unknown(
    hass: HomeAssistant, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A render that raises gives what the text shows, with unknown signs."""

    def fail(*_: Any, **__: Any) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(Template, "async_render_to_info", fail)
    _template(
        hass,
        "sensor.t",
        "{{ states('sensor.a') | float + expand(label_entities('x')) | count }}",
    )
    assert meter_inputs(hass, "sensor.t") == {
        "entities": {A},
        "signed_known": False,
        "subtracted": set(),
    }


async def test_inputs_unparsable_template_is_unknown(hass: HomeAssistant) -> None:
    """A template that does not compile has unknown signs."""
    _template(hass, "sensor.t", "{{ states('sensor.a') | float + }}")
    inputs = meter_inputs(hass, "sensor.t")
    assert inputs["entities"] == {A}
    assert inputs["signed_known"] is False
    # Unclosed, a minus applies up to the end of the text.
    _template(hass, "sensor.u", "{{ states('sensor.a') | float - states('sensor.b')")
    assert meter_inputs(hass, "sensor.u") == {
        "entities": {A, B},
        "signed_known": False,
        "subtracted": {B},
    }


async def test_inputs_of_a_broken_helper_are_unknown(hass: HomeAssistant) -> None:
    """A helper whose options cannot be read holds nothing known."""
    _helper(hass, "group", "sensor.g", {"group_type": "sensor", "entities": 5})
    assert meter_inputs(hass, "sensor.g") == {
        "entities": set(),
        "signed_known": False,
        "subtracted": set(),
    }


async def test_inputs_recursive_sum_of_template(hass: HomeAssistant) -> None:
    """A sum of a template holds the template's inputs too."""
    _template(
        hass, "sensor.t", "{{ states('sensor.a') | float + states.sensor.b.state }}"
    )
    _group(hass, "sensor.s", ["sensor.t", C])
    _helper(hass, "integration", "sensor.i", {"source": "sensor.s", "method": "left"})
    _helper(hass, "utility_meter", "sensor.u", {"source": "sensor.i", "cycle": "none"})
    assert meter_inputs(hass, "sensor.u") == {
        "entities": {"sensor.i", "sensor.s", "sensor.t", A, B, C},
        "signed_known": True,
        "subtracted": set(),
    }


async def test_inputs_of_other_entities_are_empty(hass: HomeAssistant) -> None:
    """Plain sensors, external statistics and helpers without inputs hold nothing."""
    _helper(hass, "integration", "sensor.broken", {"source": ""})
    _helper(hass, "template", "sensor.no_state", {"template_type": "sensor"})
    _helper(hass, "group", "sensor.lights", {"group_type": "light", "entities": [A]})
    _helper(hass, "derivative", "sensor.d", {"source": A})
    empty = {"entities": set(), "signed_known": True, "subtracted": set()}
    for entity_id in (
        A,
        "sensor.unknown",
        "external:stat",
        "sensor.broken",
        "sensor.no_state",
        "sensor.lights",
        "sensor.d",
    ):
        assert meter_inputs(hass, entity_id) == empty, entity_id


async def test_inputs_of_a_group_that_does_not_add(hass: HomeAssistant) -> None:
    """A mean or max group holds its members, but not with a plus sign."""
    _group(hass, "sensor.m", [A, B], kind="max")
    assert meter_inputs(hass, "sensor.m") == {
        "entities": {A, B},
        "signed_known": False,
        "subtracted": set(),
    }


async def test_inputs_cycle_guard(hass: HomeAssistant) -> None:
    """Helpers that hold each other end; their signs are not known."""
    _template(hass, "sensor.x", "{{ states('sensor.y') | float + 1 }}")
    _template(hass, "sensor.y", "{{ states('sensor.x') | float + states('sensor.a') }}")
    inputs = meter_inputs(hass, "sensor.x")
    assert inputs["entities"] == {"sensor.x", "sensor.y", A}
    assert inputs["signed_known"] is False


async def test_inputs_depth_limit(hass: HomeAssistant) -> None:
    """Only five levels are followed; deeper ones make the signs unknown."""
    for level in range(7):
        _template(hass, f"sensor.l{level}", f"{{{{ states('sensor.l{level + 1}') }}}}")
    _meter(hass, "sensor.l7")
    inputs = meter_inputs(hass, "sensor.l0")
    assert inputs["entities"] == {f"sensor.l{level}" for level in range(1, 6)}
    assert inputs["signed_known"] is False
    # Five levels with a plain sensor at the end are all known.
    assert meter_inputs(hass, "sensor.l2") == {
        "entities": {f"sensor.l{level}" for level in range(3, 8)},
        "signed_known": True,
        "subtracted": set(),
    }


@pytest.mark.parametrize(
    ("state", "subtracted"),
    [
        ("{{ states('sensor.a') | float - states('sensor.b') | float }}", {B}),
        ("{{ states('sensor.a')|float-states.sensor.b.state|float }}", {B}),
        ("{{ -states('sensor.a') | float + states('sensor.b') | float }}", {A}),
        # The minus ends at the bracket it stands in.
        (
            (
                "{{ (states('sensor.c') | float - states('sensor.a') | float)"
                " + states('sensor.b') | float }}"
            ),
            {A},
        ),
        (
            (
                "{{ states('sensor.c') | float - (states('sensor.a') | float"
                " + states('sensor.b') | float) }}"
            ),
            {A, B},
        ),
        (
            (
                "{{ states('sensor.c') | float - float(states('sensor.a')) * 2"
                " + states('sensor.b') | float }}"
            ),
            {A},
        ),
        # A hyphen in a comment or a string is no minus.
        (
            (
                "{# Küche-Summe #}"
                "{{ states('sensor.a')|float(0) + states('sensor.b')|float(0) }}"
            ),
            set(),
        ),
        (
            (
                "{% if states('sensor.c') != 'un-available'"
                " and has_value('sensor.b') %}"
                "{{ states('sensor.a')|float + states('sensor.b')|float }}{% endif %}"
            ),
            set(),
        ),
        (
            "{{ 'it\\'s - ' ~ states(\"sensor.a\") ~ \"-\" ~ states('sensor.b') }}",
            set(),
        ),
        # A minus outside the template's code is plain text.
        ("- {{ states('sensor.a') }} - x", set()),
        # Jinja's whitespace control is no minus.
        ("{{- states('sensor.a') | float + states('sensor.b') | float -}}", set()),
        (
            "{%- set x = states('sensor.a') | float -%}{{- x + states('sensor.b') -}}",
            set(),
        ),
        (
            (
                "{% set x = states('sensor.a') | float %}"
                "{% set y = states('sensor.b') %}{{ y | float - x }}"
            ),
            {A},
        ),
    ],
)
async def test_inputs_subtracted_marked(
    hass: HomeAssistant, state: str, subtracted: set[str]
) -> None:
    """A statistic that a template subtracts is marked (`a - b`)."""
    _template(hass, "sensor.t", state)
    inputs = meter_inputs(hass, "sensor.t")
    assert inputs["subtracted"] == subtracted
    assert inputs["signed_known"] is True


async def test_inputs_of_our_gross_meter(hass: HomeAssistant) -> None:
    """The setup's own gross meter subtracts the returned sensor only."""
    _template(
        hass,
        "sensor.gross",
        gross_energy_template(MeterKind.DRAWS, A, C, B, factors={C: 0.001}, offset=100),
    )
    assert meter_inputs(hass, "sensor.gross") == {
        "entities": {A, B, C},
        "signed_known": True,
        "subtracted": {B},
    }


async def test_inputs_subtracted_through_levels(hass: HomeAssistant) -> None:
    """What an inner helper subtracts, or a subtracted helper holds, is subtracted."""
    _template(hass, "sensor.t", "{{ states('sensor.a') | float - states('sensor.b') }}")
    _group(hass, "sensor.s", ["sensor.t", C])
    _template(hass, "sensor.u", "{{ states('sensor.c') | float - states('sensor.s') }}")
    assert meter_inputs(hass, "sensor.s")["subtracted"] == {B}
    inputs = meter_inputs(hass, "sensor.u")
    assert inputs["entities"] == {"sensor.s", "sensor.t", A, B, C}
    # C is added directly and subtracted through the sum: it counts as subtracted.
    assert inputs["subtracted"] == {"sensor.s", "sensor.t", A, B, C}


async def test_inputs_cache_is_shared(hass: HomeAssistant) -> None:
    """One cache serves several meters; a cached helper is read only once."""
    _template(hass, "sensor.t", "{{ states('sensor.a') | float }}")
    cache: dict[str, Any] = {}
    assert meter_inputs(hass, "sensor.t", cache)["entities"] == {A}
    entry = hass.config_entries.async_entries("template")[0]
    hass.config_entries.async_update_entry(entry, options={})
    assert meter_inputs(hass, "sensor.t", cache)["entities"] == {A}
    assert meter_inputs(hass, "sensor.t")["entities"] == set()


async def test_counted_inputs(hass: HomeAssistant) -> None:
    """Per meter, what it counts with a known plus sign; empty ones are left out."""
    _template(hass, "sensor.t", "{{ states('sensor.a') | float - states('sensor.b') }}")
    _template(hass, "sensor.e", "{{ expand('sensor.a') | count }}")
    _group(hass, "sensor.s", ["sensor.t", C])
    assert counted_inputs(hass, ["sensor.s", "sensor.t", "sensor.e", A]) == {
        "sensor.s": [A, C, "sensor.t"],
        "sensor.t": [A],
    }
