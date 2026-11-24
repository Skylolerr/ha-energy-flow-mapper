"""Tests for the known-device rules (methods, family, returned, power pairing).

The registry entries follow the unique IDs of the real integrations (Shelly,
IoTaWatt, OpenDTU, Emporia, Zigbee2MQTT, Envoy, Huawei Solar), checked in Home
Assistant 2026.10 and 2026.11 where the integration is in core.
"""

from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from custom_components.energy_flow_mapper.device_rules import (
    MeterClass,
    Method,
    classify_meter,
    default_inverted,
    drawn_candidates,
    family,
    paired_power,
    preselect_returned,
    returned_candidates,
)
from custom_components.energy_flow_mapper.stats_probe import StatsEvidence

from .common import MockConfigEntry

MAC = "AABBCCDDEEFF"


def _device(
    hass: HomeAssistant,
    name: str,
    *,
    platform: str = "shelly",
    via: str | None = None,
) -> str:
    """Create a device (via another device if given); return its ID."""
    entry = MockConfigEntry(domain=platform)
    entry.add_to_hass(hass)
    devices = dr.async_get(hass)
    device = devices.async_get_or_create(
        config_entry_id=entry.entry_id, identifiers={(platform, name)}
    )
    if via is not None:
        devices.async_update_device(device.id, via_device_id=via)
    return device.id


def _child(hass: HomeAssistant, name: str, parent: str) -> str:
    """Create a child device (`parent_device_id`); return its ID."""
    devices = dr.async_get(hass)
    owner = devices.async_get(parent)
    assert owner is not None
    return devices.async_get_or_create_child(
        config_entry_id=owner.config_entry_id,
        identifiers={("test", name)},
        parent_device_id=parent,
    ).id


def _entity(
    hass: HomeAssistant,
    entity_id: str,
    device_id: str | None,
    unique_id: str,
    *,
    platform: str = "shelly",
    device_class: str = "energy",
    translation_key: str | None = None,
    name: str | None = None,
    disabled: bool = False,
) -> str:
    """Register a sensor; an enabled one gets a state too. Return its ID."""
    er.async_get(hass).async_get_or_create(
        "sensor",
        platform,
        unique_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        original_name=name,
        translation_key=translation_key,
        disabled_by=er.RegistryEntryDisabler.INTEGRATION if disabled else None,
    )
    if not disabled:
        hass.states.async_set(entity_id, "1.0", {"device_class": device_class})
    return entity_id


def _power(
    hass: HomeAssistant,
    entity_id: str,
    device_id: str | None,
    unique_id: str,
    *,
    platform: str = "shelly",
    disabled: bool = False,
) -> str:
    return _entity(
        hass,
        entity_id,
        device_id,
        unique_id,
        platform=platform,
        device_class="power",
        disabled=disabled,
    )


def _evidence(*, went_negative: bool) -> StatsEvidence:
    return StatsEvidence(
        periodic=False,
        certain=False,
        reason=None,
        drops=[],
        went_negative=went_negative,
        series=[],
    )


def _plug(hass: HomeAssistant, *, returned: bool = True) -> tuple[str, str]:
    """Create a Shelly Plus Plug S: Energy (both ways), returned, consumed."""
    device = _device(hass, "plug")
    energy = _entity(hass, "sensor.plug_energy", device, f"{MAC}-switch:0-energy")
    consumed = _entity(
        hass,
        "sensor.plug_energy_consumed",
        device,
        f"{MAC}-switch:0-consumed_energy_switch",
        translation_key="energy_consumed",
        disabled=True,
    )
    if returned:
        _entity(
            hass,
            "sensor.plug_energy_returned",
            device,
            f"{MAC}-switch:0-ret_energy",
            translation_key="energy_returned",
        )
    _power(hass, "sensor.plug_power", device, f"{MAC}-switch:0-power")
    return energy, consumed


def _pro_3em(hass: HomeAssistant) -> dict[str, str]:
    """Create a Shelly Pro 3EM (triphase): totals on the main device."""
    main = _device(hass, "pro3em")
    ids = {
        "total": _entity(hass, "sensor.p3_total", main, f"{MAC}-emdata:0-total_act"),
        "total_ret": _entity(
            hass,
            "sensor.p3_total_returned",
            main,
            f"{MAC}-emdata:0-total_act_ret",
            translation_key="energy_returned",
        ),
        "total_power": _power(
            hass, "sensor.p3_power", main, f"{MAC}-em:0-total_act_power"
        ),
    }
    for phase in ("a", "b"):
        sub = _device(hass, f"pro3em-{phase}", via=main)
        ids[phase] = _entity(
            hass,
            f"sensor.p3_{phase}_energy",
            sub,
            f"{MAC}-emdata:0-{phase}_total_act_energy",
            disabled=True,
        )
        ids[f"{phase}_ret"] = _entity(
            hass,
            f"sensor.p3_{phase}_returned",
            sub,
            f"{MAC}-emdata:0-{phase}_total_act_ret_energy",
            translation_key="energy_returned",
            disabled=True,
        )
        ids[f"{phase}_power"] = _power(
            hass, f"sensor.p3_{phase}_power", sub, f"{MAC}-em:0-{phase}_act_power"
        )
    return ids


# --- classify_meter ---------------------------------------------------------


async def test_classify_shelly_pro_em_is_em(hass: HomeAssistant) -> None:
    """Every EM component (`em`, `em1`, `emdata`, `em1data`) is an EM meter."""
    main = _device(hass, "proem")
    channel = _device(hass, "proem-0", via=main)
    for component, description in (
        ("em1data:0", "total_act_energy"),
        ("emdata:0", "total_act"),
        ("em1:0", "energy"),
        ("em:0", "energy"),
    ):
        meter = _entity(
            hass,
            f"sensor.{component.replace(':', '_')}",
            channel,
            f"{MAC}-{component}-{description}",
        )
        assert classify_meter(hass, meter, None) == MeterClass(
            Method.EM, "rule_shelly_em"
        )
    # The returned sensor of an EM is not a meter of the drawn energy.
    returned = _entity(
        hass,
        "sensor.proem_returned",
        channel,
        f"{MAC}-em1data:0-total_act_ret_energy",
        translation_key="energy_returned",
    )
    assert classify_meter(hass, returned, None) == MeterClass(None, None)


async def test_classify_shelly_plug_energy_is_plug(hass: HomeAssistant) -> None:
    """A switch's Energy with a returned sensor counts both ways: Plug."""
    energy, _ = _plug(hass)
    assert classify_meter(hass, energy, None) == MeterClass(
        Method.PLUG, "rule_shelly_plug"
    )
    # A device rule wins over the statistics.
    assert classify_meter(hass, energy, _evidence(went_negative=True)) == MeterClass(
        Method.PLUG, "rule_shelly_plug"
    )


async def test_classify_shelly_consumed_is_em(hass: HomeAssistant) -> None:
    """A switch's "Energy consumed" is import only: EM."""
    _, consumed = _plug(hass)
    assert classify_meter(hass, consumed, None) == MeterClass(
        Method.EM, "rule_shelly_consumed"
    )


async def test_classify_switch_without_returned_is_none(hass: HomeAssistant) -> None:
    """Without a returned sensor the firmware may reset the counter."""
    energy, consumed = _plug(hass, returned=False)
    assert classify_meter(hass, energy, None) == MeterClass(None, None)
    assert classify_meter(hass, consumed, None) == MeterClass(None, None)
    # A returned sensor of another switch does not count.
    device = er.async_get(hass).async_get(energy).device_id
    _entity(
        hass,
        "sensor.plug_1_returned",
        device,
        f"{MAC}-switch:1-ret_energy",
        translation_key="energy_returned",
    )
    assert classify_meter(hass, energy, None) == MeterClass(None, None)
    # Other descriptions of a switch never match.
    power = "sensor.plug_power"
    _entity(
        hass,
        "sensor.plug_0_returned",
        device,
        f"{MAC}-switch:0-ret_energy",
        translation_key="energy_returned",
    )
    assert classify_meter(hass, power, None) == MeterClass(None, None)
    light = _entity(hass, "sensor.light", device, f"{MAC}-switch:0")
    assert classify_meter(hass, light, None) == MeterClass(None, None)


async def test_classify_pm1_is_none(hass: HomeAssistant) -> None:
    """PM1 persistence is unverified; Gen1 counters reset: no rule."""
    device = _device(hass, "pm_mini")
    meter = _entity(hass, "sensor.pm_energy", device, f"{MAC}-pm1:0-energy_pm1")
    _entity(
        hass,
        "sensor.pm_returned",
        device,
        f"{MAC}-pm1:0-ret_energy_pm1",
        translation_key="energy_returned",
    )
    assert classify_meter(hass, meter, None) == MeterClass(None, None)
    gen1 = _device(hass, "gen1_em")
    old = _entity(hass, "sensor.gen1_energy", gen1, f"{MAC}-emeter_0-energy")
    _entity(
        hass,
        "sensor.gen1_returned",
        gen1,
        f"{MAC}-emeter_0-energyReturned",
        translation_key="energy_returned",
    )
    assert classify_meter(hass, old, None) == MeterClass(None, None)


async def test_classify_unknown_is_none(hass: HomeAssistant) -> None:
    """Other devices, odd unique IDs and unknown entities get no rule."""
    device = _device(hass, "meter", platform="test")
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    assert classify_meter(hass, meter, None) == MeterClass(None, None)
    assert classify_meter(hass, meter, _evidence(went_negative=False)) == MeterClass(
        None, None
    )
    odd = _entity(hass, "sensor.odd", device, "nodash")
    assert classify_meter(hass, odd, None) == MeterClass(None, None)
    assert classify_meter(hass, "sensor.unknown", None) == MeterClass(None, None)


async def test_classify_net_needs_negative_stats(hass: HomeAssistant) -> None:
    """Net only when the statistics went below 0, not by state class."""
    device = _device(hass, "net", platform="test")
    meter = _entity(hass, "sensor.net", device, "net", platform="test")
    hass.states.async_set(meter, "-3.0", {"state_class": "total"})
    assert classify_meter(hass, meter, None) == MeterClass(None, None)
    assert classify_meter(hass, meter, _evidence(went_negative=False)) == MeterClass(
        None, None
    )
    assert classify_meter(hass, meter, _evidence(went_negative=True)) == MeterClass(
        Method.NET, "rule_net_negative"
    )
    # Also for a statistic that is not in the registry.
    assert classify_meter(
        hass, "sensor.unknown", _evidence(went_negative=True)
    ) == MeterClass(Method.NET, "rule_net_negative")


# --- family -----------------------------------------------------------------


async def test_family_device_parent_and_children(hass: HomeAssistant) -> None:
    """Device, its parent and its children (via and child devices)."""
    parent = _device(hass, "parent", platform="test")
    device = _device(hass, "device", platform="test", via=parent)
    via_child = _device(hass, "via_child", platform="test", via=device)
    child = _child(hass, "child", device)
    sibling = _device(hass, "sibling", platform="test", via=parent)
    grandchild = _device(hass, "grandchild", platform="test", via=via_child)
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    off = _entity(hass, "sensor.off", device, "off", platform="test", disabled=True)
    up = _entity(hass, "sensor.up", parent, "up", platform="test")
    down = _entity(hass, "sensor.down", via_child, "down", platform="test")
    kid = _entity(hass, "sensor.kid", child, "kid", platform="test")
    _entity(hass, "sensor.side", sibling, "side", platform="test")
    _entity(hass, "sensor.deep", grandchild, "deep", platform="test")
    assert [entry.entity_id for entry in family(hass, meter)] == sorted(
        [meter, off, up, down, kid]
    )
    # From a child device, its parent is found by `parent_device_id`.
    assert [entry.entity_id for entry in family(hass, kid)] == sorted([meter, off, kid])


async def test_family_without_device(hass: HomeAssistant) -> None:
    """An entity without device is alone; an unknown one has no family."""
    loose = _entity(hass, "sensor.loose", None, "loose", platform="test")
    assert [entry.entity_id for entry in family(hass, loose)] == [loose]
    assert family(hass, "sensor.unknown") == []


# --- returned_candidates ----------------------------------------------------


async def test_returned_pro_3em_phase_a_first(hass: HomeAssistant) -> None:
    """The same phase comes first, also when it is disabled."""
    ids = _pro_3em(hass)
    assert returned_candidates(hass, ids["a"], ()) == [
        (ids["a_ret"], True),
        (ids["total_ret"], False),
    ]
    # From the totals: the total first, then the phases (children).
    assert returned_candidates(hass, ids["total"], ()) == [
        (ids["total_ret"], False),
        (ids["a_ret"], True),
        (ids["b_ret"], True),
    ]
    # Used sensors are left out.
    assert returned_candidates(hass, ids["total"], {ids["total_ret"]}) == [
        (ids["a_ret"], True),
        (ids["b_ret"], True),
    ]


async def test_returned_includes_disabled_and_children(hass: HomeAssistant) -> None:
    """Disabled sensors and sensors of child devices are candidates."""
    main = _device(hass, "meter", platform="test")
    via_child = _device(hass, "via_child", platform="test", via=main)
    child = _child(hass, "child", main)
    meter = _entity(hass, "sensor.meter", main, "meter", platform="test")
    enabled = _entity(
        hass,
        "sensor.z_export",
        main,
        "z_export",
        platform="test",
        name="Grid export",
    )
    off = _entity(
        hass,
        "sensor.a_returned",
        via_child,
        "a_returned",
        platform="test",
        translation_key="energy_returned",
        disabled=True,
    )
    kid = _entity(
        hass,
        "sensor.b_exported",
        child,
        "b_exported",
        platform="test",
        translation_key="energy_exported",
    )
    # Not returned: a power with a returned key, an import energy.
    _entity(
        hass,
        "sensor.returned_power",
        main,
        "returned_power",
        platform="test",
        device_class="power",
        translation_key="energy_returned",
    )
    _entity(hass, "sensor.import", main, "import", platform="test")
    assert returned_candidates(hass, meter, ()) == [
        (kid, False),
        (enabled, False),
        (off, True),
    ]
    assert returned_candidates(hass, "sensor.unknown", ()) == []


async def test_returned_shelly_channel_first(hass: HomeAssistant) -> None:
    """A Pro EM-50 channel ranks its own returned sensor first."""
    main = _device(hass, "proem50")
    meter = _entity(
        hass, "sensor.ch0_energy", main, f"{MAC}-em1data:0-total_act_energy"
    )
    own = _entity(
        hass,
        "sensor.z_ch0_returned",
        main,
        f"{MAC}-em1data:0-total_act_ret_energy",
        disabled=True,
    )
    other = _entity(
        hass,
        "sensor.a_ch1_returned",
        main,
        f"{MAC}-em1data:1-total_act_ret_energy",
    )
    assert returned_candidates(hass, meter, ()) == [(own, True), (other, False)]


async def test_returned_shelly_name_is_not_returned(hass: HomeAssistant) -> None:
    """A Shelly channel named "PV export" does not make its import returned."""
    device = _device(hass, "pv")
    meter = _entity(
        hass,
        "sensor.pv_energy_consumed",
        device,
        f"{MAC}-switch:0-consumed_energy_switch",
        translation_key="energy_consumed",
        name="PV export energy consumed",
    )
    _entity(
        hass,
        "sensor.pv_export_energy",
        device,
        f"{MAC}-switch:0-energy",
        name="PV export energy",
    )
    returned = _entity(
        hass,
        "sensor.pv_export_returned",
        device,
        f"{MAC}-switch:0-ret_energy",
        name="PV export energy returned",
    )
    assert returned_candidates(hass, meter, ()) == [(returned, False)]


async def test_preselect_returned_needs_own_channel(hass: HomeAssistant) -> None:
    """A keyed meter preselects only a returned sensor of its own channel."""
    ids = _pro_3em(hass)
    assert preselect_returned(hass, ids["a"], set()) == ids["a_ret"]
    assert preselect_returned(hass, ids["total"], set()) == ids["total_ret"]
    # The phase's own returned sensor is used: not the total's.
    assert preselect_returned(hass, ids["a"], {ids["a_ret"]}) is None
    assert preselect_returned(hass, ids["a"], {ids["a_ret"], ids["total_ret"]}) is None


async def test_preselect_returned_without_channel(hass: HomeAssistant) -> None:
    """Without a channel key only a sole candidate is preselected."""
    device = _device(hass, "meter", platform="test")
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    assert preselect_returned(hass, meter, set()) is None
    first = _entity(
        hass,
        "sensor.first_returned",
        device,
        "first_returned",
        platform="test",
        translation_key="energy_returned",
    )
    assert preselect_returned(hass, meter, set()) == first
    second = _entity(
        hass,
        "sensor.second_returned",
        device,
        "second_returned",
        platform="test",
        translation_key="energy_returned",
    )
    assert preselect_returned(hass, meter, set()) is None
    assert preselect_returned(hass, meter, {first}) == second


async def test_preselect_returned_own_used_not_parent(hass: HomeAssistant) -> None:
    """A used own returned sensor never hands over to the parent's."""
    hub = _device(hass, "hub", platform="test")
    device = _device(hass, "device", platform="test", via=hub)
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    own = _entity(
        hass,
        "sensor.own_returned",
        device,
        "own_returned",
        platform="test",
        translation_key="energy_returned",
    )
    grid = _entity(
        hass,
        "sensor.grid_export",
        hub,
        "grid_export",
        platform="test",
        translation_key="energy_exported",
    )
    assert preselect_returned(hass, meter, set()) == own
    assert preselect_returned(hass, meter, {own}) is None
    # A sub-circuit meter without an own returned sensor never gets the hub's
    # (via or child device), though the picker lists it.
    other = _device(hass, "other", platform="test", via=hub)
    meter_2 = _entity(hass, "sensor.meter_2", other, "meter_2", platform="test")
    assert preselect_returned(hass, meter_2, set()) is None
    assert returned_candidates(hass, meter_2, ()) == [(grid, False)]
    kid = _child(hass, "kid", hub)
    meter_3 = _entity(hass, "sensor.meter_3", kid, "meter_3", platform="test")
    assert preselect_returned(hass, meter_3, set()) is None
    assert returned_candidates(hass, meter_3, ()) == [(grid, False)]


# --- paired_power -----------------------------------------------------------


async def test_pair_iotawatt_input_1_not_10(hass: HomeAssistant) -> None:
    """IoTaWatt inputs share one device; the channel token is exact."""
    device = _device(hass, "iotawatt", platform="iotawatt")
    energy_1 = _entity(
        hass,
        "sensor.input_1_wh",
        device,
        "AABB-input-1-WattHours",
        platform="iotawatt",
    )
    energy_10 = _entity(
        hass,
        "sensor.input_10_wh",
        device,
        "AABB-input-10-WattHours",
        platform="iotawatt",
    )
    power_10 = _power(
        hass, "sensor.input_10", device, "AABB-input-10-Watts", platform="iotawatt"
    )
    power_1 = _power(
        hass, "sensor.input_1", device, "AABB-input-1-Watts", platform="iotawatt"
    )
    assert paired_power(hass, energy_1, ()) == power_1
    assert paired_power(hass, energy_10, ()) == power_10
    # An input without its power gets nothing, not another input's power.
    energy_2 = _entity(
        hass,
        "sensor.input_2_wh",
        device,
        "AABB-input-2-WattHours",
        platform="iotawatt",
    )
    assert paired_power(hass, energy_2, ()) is None


async def test_pair_shelly_em1data_to_em1(hass: HomeAssistant) -> None:
    """`em1data:N` pairs with `em1:N`, `emdata:0` with `em:0` (and phases)."""
    main = _device(hass, "proem50")
    energy_0 = _entity(
        hass, "sensor.ch0_energy", main, f"{MAC}-em1data:0-total_act_energy"
    )
    energy_1 = _entity(
        hass, "sensor.ch1_energy", main, f"{MAC}-em1data:1-total_act_energy"
    )
    power_1 = _power(hass, "sensor.ch1_power", main, f"{MAC}-em1:1-power_em1")
    power_0 = _power(hass, "sensor.ch0_power", main, f"{MAC}-em1:0-power_em1")
    assert paired_power(hass, energy_0, ()) == power_0
    assert paired_power(hass, energy_1, ()) == power_1
    ids = _pro_3em(hass)
    assert paired_power(hass, ids["total"], ()) == ids["total_power"]
    assert paired_power(hass, ids["a"], ()) == ids["a_power"]
    plug, _ = _plug(hass)
    assert paired_power(hass, plug, ()) == "sensor.plug_power"
    # Gen1: the block pairs energy and power.
    gen1 = _device(hass, "gen1")
    old = _entity(hass, "sensor.gen1_energy", gen1, f"{MAC}-emeter_1-energy")
    _power(hass, "sensor.gen1_power_0", gen1, f"{MAC}-emeter_0-power")
    old_power = _power(hass, "sensor.gen1_power_1", gen1, f"{MAC}-emeter_1-power")
    assert paired_power(hass, old, ()) == old_power


async def test_pair_opendtu_channel(hass: HomeAssistant) -> None:
    """OpenDTU/AhoyDTU pair by the `{serial}_chN_` prefix."""
    inverter = _device(hass, "inverter", platform="mqtt")
    ac = _entity(
        hass,
        "sensor.inverter_yieldtotal",
        inverter,
        "116190000001_ch0_YieldTotal",
        platform="mqtt",
    )
    dc = _entity(
        hass,
        "sensor.inverter_ch1_yieldtotal",
        inverter,
        "116190000001_ch1_YieldTotal",
        platform="mqtt",
    )
    dc_power = _power(
        hass,
        "sensor.inverter_ch1_power",
        inverter,
        "116190000001_ch1_Power",
        platform="mqtt",
    )
    ac_power = _power(
        hass,
        "sensor.inverter_power",
        inverter,
        "116190000001_ch0_P_AC",
        platform="mqtt",
    )
    assert paired_power(hass, ac, ()) == ac_power
    assert paired_power(hass, dc, ()) == dc_power


async def test_pair_dtu_ac_not_dc(hass: HomeAssistant) -> None:
    """The AC yield (ch0) pairs with the AC power, never a DC power."""
    for platform_id, ac_field, dc_field in (
        ("116190000001", "Power", "PowerDC"),
        ("114181234567", "P_AC", "P_DC"),
    ):
        inverter = _device(hass, platform_id, platform="mqtt")
        ac = _entity(
            hass,
            f"sensor.dtu_{platform_id}_yieldtotal",
            inverter,
            f"{platform_id}_ch0_YieldTotal",
            platform="mqtt",
        )
        _power(
            hass,
            f"sensor.dtu_{platform_id}_dc",
            inverter,
            f"{platform_id}_ch0_{dc_field}",
            platform="mqtt",
        )
        ac_power = _power(
            hass,
            f"sensor.dtu_{platform_id}_ac",
            inverter,
            f"{platform_id}_ch0_{ac_field}",
            platform="mqtt",
        )
        assert paired_power(hass, ac, ()) == ac_power
        assert paired_power(hass, ac, {ac_power}) is None
        # Any other power field of ch0 never pairs either.
        _power(
            hass,
            f"sensor.dtu_{platform_id}_max",
            inverter,
            f"{platform_id}_ch0_MaxPower",
            platform="mqtt",
        )
        assert paired_power(hass, ac, {ac_power}) is None


async def test_pair_only_own_device(hass: HomeAssistant) -> None:
    """A parent's or child's power (the circuit above or below) never pairs."""
    parent = _device(hass, "parent", platform="test")
    device = _device(hass, "device", platform="test", via=parent)
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    # Own device has none, the parent exactly one.
    _power(hass, "sensor.up_power", parent, "up_power", platform="test")
    assert paired_power(hass, meter, ()) is None
    # Own device has none, a via child exactly one.
    other = _device(hass, "other", platform="test")
    meter_2 = _entity(hass, "sensor.meter_2", other, "meter_2", platform="test")
    below = _device(hass, "below", platform="test", via=other)
    _power(hass, "sensor.below_power", below, "below_power", platform="test")
    assert paired_power(hass, meter_2, ()) is None
    # Own device has none, a child device exactly one.
    third = _device(hass, "third", platform="test")
    meter_3 = _entity(hass, "sensor.meter_3", third, "meter_3", platform="test")
    kid = _child(hass, "kid", third)
    _power(hass, "sensor.kid_power", kid, "kid_power", platform="test")
    assert paired_power(hass, meter_3, ()) is None
    # Own device has one, the parent another: the own one.
    own = _power(hass, "sensor.own_power", device, "own_power", platform="test")
    assert paired_power(hass, meter, ()) == own


async def test_pair_own_power_used_or_disabled(hass: HomeAssistant) -> None:
    """A used or disabled own power never hands over to the family."""
    parent = _device(hass, "parent", platform="test")
    device = _device(hass, "device", platform="test", via=parent)
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    own = _power(hass, "sensor.own_power", device, "own_power", platform="test")
    _power(hass, "sensor.up_power", parent, "up_power", platform="test")
    assert paired_power(hass, meter, {own}) is None
    other = _device(hass, "other", platform="test")
    child = _device(hass, "child", platform="test", via=other)
    meter_2 = _entity(hass, "sensor.meter_2", other, "meter_2", platform="test")
    _power(hass, "sensor.off_power", other, "off_power", platform="test", disabled=True)
    _power(hass, "sensor.down_power", child, "down_power", platform="test")
    assert paired_power(hass, meter_2, ()) is None


async def test_pair_none_when_two_unused(hass: HomeAssistant) -> None:
    """Without a rule only a single unused power is a pair."""
    device = _device(hass, "meter", platform="test")
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    assert paired_power(hass, meter, ()) is None
    first = _power(hass, "sensor.first", device, "first", platform="test")
    assert paired_power(hass, meter, ()) == first
    second = _power(hass, "sensor.second", device, "second", platform="test")
    assert paired_power(hass, meter, ()) is None
    assert paired_power(hass, meter, {first}) == second
    # A disabled power has no state: never a pair.
    _power(hass, "sensor.third", device, "third", platform="test", disabled=True)
    assert paired_power(hass, meter, {first}) == second
    assert paired_power(hass, "sensor.unknown", ()) is None
    # An entity without device has no power to pair.
    loose = _entity(hass, "sensor.loose", None, "loose", platform="test")
    assert paired_power(hass, loose, ()) is None
    # Other MQTT devices (no DTU or Zigbee2MQTT unique ID) have no rule either.
    mqtt = _device(hass, "mqtt", platform="mqtt")
    energy = _entity(hass, "sensor.mqtt_energy", mqtt, "mqtt_energy", platform="mqtt")
    power = _power(hass, "sensor.mqtt_power", mqtt, "mqtt_power", platform="mqtt")
    assert paired_power(hass, energy, ()) == power


async def test_pair_skips_used(hass: HomeAssistant) -> None:
    """A used power is never suggested, not even by a rule."""
    plug, _ = _plug(hass)
    assert paired_power(hass, plug, {"sensor.plug_power"}) is None
    device = _device(hass, "meter", platform="test")
    meter = _entity(hass, "sensor.meter", device, "meter", platform="test")
    power = _power(hass, "sensor.power", device, "power", platform="test")
    assert paired_power(hass, meter, {power}) is None


async def test_pair_emporia_same_device(hass: HomeAssistant) -> None:
    """Emporia has one device per channel."""
    circuit_1 = _device(hass, "12345-1", platform="emporia_vue")
    circuit_2 = _device(hass, "12345-2", platform="emporia_vue")
    energy = _entity(
        hass,
        "sensor.circuit_1_energy_today",
        circuit_1,
        "sensor.emporia_vue.1D.12345-1",
        platform="emporia_vue",
    )
    power = _power(
        hass,
        "sensor.circuit_1_power",
        circuit_1,
        "sensor.emporia_vue.instant.12345-1",
        platform="emporia_vue",
    )
    _power(
        hass,
        "sensor.circuit_2_power",
        circuit_2,
        "sensor.emporia_vue.instant.12345-2",
        platform="emporia_vue",
    )
    assert paired_power(hass, energy, ()) == power


async def test_pair_z2m_suffix(hass: HomeAssistant) -> None:
    """Zigbee2MQTT clamps pair by the property suffix (`_a`, `_l1`)."""
    clamp = _device(hass, "clamp", platform="mqtt")
    ieee = "0xa4c1380000000001"
    energy_a = _entity(
        hass,
        "sensor.clamp_energy_a",
        clamp,
        f"{ieee}_energy_a_zigbee2mqtt",
        platform="mqtt",
    )
    energy_l1 = _entity(
        hass,
        "sensor.clamp_energy_l1",
        clamp,
        f"{ieee}_energy_l1_zigbee2mqtt",
        platform="mqtt",
    )
    energy = _entity(
        hass,
        "sensor.clamp_energy",
        clamp,
        f"{ieee}_energy_zigbee2mqtt",
        platform="mqtt",
    )
    power_a = _power(
        hass,
        "sensor.clamp_power_a",
        clamp,
        f"{ieee}_power_a_zigbee2mqtt",
        platform="mqtt",
    )
    _power(
        hass,
        "sensor.clamp_power_b",
        clamp,
        f"{ieee}_power_b_zigbee2mqtt",
        platform="mqtt",
    )
    power_l1 = _power(
        hass,
        "sensor.clamp_power_l1",
        clamp,
        f"{ieee}_power_l1_zigbee2mqtt",
        platform="mqtt",
    )
    power = _power(
        hass, "sensor.clamp_power", clamp, f"{ieee}_power_zigbee2mqtt", platform="mqtt"
    )
    assert paired_power(hass, energy_a, ()) == power_a
    assert paired_power(hass, energy_l1, ()) == power_l1
    assert paired_power(hass, energy, ()) == power


async def test_pair_envoy_keys(hass: HomeAssistant) -> None:
    """Envoy pairs by its key families, per phase, and inverters by serial."""
    envoy = _device(hass, "envoy", platform="enphase_envoy")
    inverter = _device(hass, "inverter", platform="enphase_envoy", via=envoy)

    def energy(key: str, device: str = envoy) -> str:
        return _entity(
            hass,
            f"sensor.envoy_{key}",
            device,
            f"122334_{key}",
            platform="enphase_envoy",
        )

    def power(key: str, device: str = envoy) -> str:
        return _power(
            hass, f"sensor.envoy_{key}_w", device, key, platform="enphase_envoy"
        )

    production = power("122334_production")
    production_l1 = power("122334_production_l1")
    net = power("122334_net_consumption")
    load = power("122334_load_ct_power")
    inverter_power = power("482211", inverter)
    assert paired_power(hass, energy("lifetime_production"), ()) == production
    assert paired_power(hass, energy("daily_production"), ()) == production
    assert paired_power(hass, energy("lifetime_production_l1"), ()) == production_l1
    assert paired_power(hass, energy("lifetime_net_consumption"), ()) == net
    assert paired_power(hass, energy("lifetime_net_production"), ()) == net
    assert paired_power(hass, energy("load_ct_energy_received"), ()) == load
    assert paired_power(hass, energy("lifetime_consumption"), ()) is None
    lifetime = _entity(
        hass,
        "sensor.inverter_lifetime",
        inverter,
        "482211_lifetime_energy",
        platform="enphase_envoy",
    )
    assert paired_power(hass, lifetime, ()) == inverter_power


# --- default_inverted -------------------------------------------------------


async def test_default_inverted_huawei(hass: HomeAssistant) -> None:
    """Huawei's power meter is positive on export; others are not inverted."""
    meter = _device(hass, "huawei_meter", platform="huawei_solar")
    active = _power(
        hass,
        "sensor.power_meter_active_power",
        meter,
        "HV2150012345_power_meter_active_power",
        platform="huawei_solar",
    )
    inverter = _power(
        hass,
        "sensor.inverter_active_power",
        meter,
        "HV2150012345_active_power",
        platform="huawei_solar",
    )
    other = _power(
        hass,
        "sensor.other_power_meter_active_power",
        meter,
        "x_power_meter_active_power",
        platform="test",
    )
    assert default_inverted(hass, active) is True
    assert default_inverted(hass, inverter) is False
    assert default_inverted(hass, other) is False
    assert default_inverted(hass, "sensor.unknown") is False


# --- drawn_candidates -------------------------------------------------------


async def test_drawn_plug_energy_then_consumed(hass: HomeAssistant) -> None:
    """The meter itself first, then the import-only sensor of its channel."""
    energy, consumed = _plug(hass)
    assert drawn_candidates(hass, energy, ()) == [(energy, False), (consumed, True)]
    # A used one is left out; the meter itself always stays.
    assert drawn_candidates(hass, energy, {consumed, energy}) == [(energy, False)]
    # "Energy consumed" as the meter: no other drawn sensor.
    assert drawn_candidates(hass, consumed, ()) == [(consumed, True)]


async def test_drawn_only_own_channel(hass: HomeAssistant) -> None:
    """A 2-channel switch: the other channel's consumed sensor is no candidate."""
    device = _device(hass, "pro2pm")
    energy = _entity(hass, "sensor.ch0_energy", device, f"{MAC}-switch:0-energy")
    own = _entity(
        hass,
        "sensor.ch0_consumed",
        device,
        f"{MAC}-switch:0-consumed_energy_switch",
    )
    _entity(
        hass,
        "sensor.ch1_consumed",
        device,
        f"{MAC}-switch:1-consumed_energy_switch",
        translation_key="energy_consumed",
    )
    assert drawn_candidates(hass, energy, ()) == [(energy, False), (own, False)]


async def test_drawn_without_channel_own_device(hass: HomeAssistant) -> None:
    """Without a channel key only the meter's own device counts."""
    device = _device(hass, "meter", platform="test")
    child = _device(hass, "child", platform="test", via=device)
    meter = _entity(hass, "sensor.m_energy", device, "m-energy", platform="test")
    consumed = _entity(
        hass,
        "sensor.m_consumed",
        device,
        "m-consumed",
        platform="test",
        translation_key="energy_consumed",
    )
    _entity(
        hass,
        "sensor.c_consumed",
        child,
        "c-consumed",
        platform="test",
        translation_key="energy_consumed",
    )
    assert drawn_candidates(hass, meter, ()) == [(meter, False), (consumed, False)]
    # Unknown entities are their own only candidate.
    assert drawn_candidates(hass, "sensor.unknown", ()) == [("sensor.unknown", False)]
