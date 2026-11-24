"""The gross meters of the solar setup against Home Assistant's statistics.

The helpers are created through the real WebSocket commands. A small model
of the circuit then reports its counters and powers every minute, at fixed
times (freezer); the recorder stores the states and Home Assistant's own
statistics compile (`compile_statistics`) runs at every 5-minute boundary,
which also builds the hours. The tests assert the gross meter's hourly
`change`: exactly what the energy dashboard shows.

Timing. Every report happens one second before a whole minute, so a value
posted just before an hour ends belongs to that hour. The setup's integrals
(the solar term, From power) update on a change of their source and then
every minute (`max_sub_interval`), so they have caught up at every hour's
end. Within a minute the inputs report a millisecond apart
(`Circuit.report`). Home Assistant renders a template with `now()` (the
solar's held power) at the start of each minute; here that render happens
at the minute's report, 59 seconds later. So a hold that starts at a
report ends at the report 11 minutes later (its first render 600 s or more
after the dropout), where Home Assistant ends it 10 to 11 minutes after the
dropout.

The setup's look at the inputs' history (`async_probe`) is replaced: the
statistics only begin with the test, so every input counts as a lifetime
counter and every power as signed. The setup's own judgement is tested in
`test_solar_setup.py`.

The recorder must be set up before Home Assistant, so these tests live in
their own module.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import pytest
from freezegun.api import FrozenDateTimeFactory
from homeassistant.components.recorder.statistics import statistics_during_period
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.recorder import get_instance
from homeassistant.util import dt as dt_util

from custom_components.energy_flow_mapper import energy_access, solar_setup
from custom_components.energy_flow_mapper.const import DOMAIN
from custom_components.energy_flow_mapper.stats_probe import StatsEvidence

from .common import MockConfigEntry, WebSocketGenerator

try:
    from pytest_homeassistant.common import async_fire_time_changed_exact
    from pytest_homeassistant.components.recorder.common import (
        async_wait_recording_done,
        do_adhoc_statistics,
    )
except ImportError:  # Home Assistant before 2026.11
    from pytest_homeassistant_custom_component.common import (
        async_fire_time_changed_exact,
    )
    from pytest_homeassistant_custom_component.components.recorder.common import (
        async_wait_recording_done,
        do_adhoc_statistics,
    )

MAC = "AABBCCDDEEFF"
SOLAR = "sensor.solar_energy"
SOLAR_POWER = "sensor.solar_power"
PRO_EM = "sensor.pro_em_energy"
PRO_EM_RETURNED = "sensor.pro_em_returned"
PRO_EM_POWER = "sensor.pro_em_power"
PLUG = "sensor.plug_energy"
PLUG_RETURNED = "sensor.plug_returned"
PLUG_POWER = "sensor.plug_power"
NET = "sensor.net_energy"
NET_POWER = "sensor.net_power"
# The entities of each method's circuit: (meter, returned, power).
CIRCUITS: dict[str, tuple[str, str | None, str]] = {
    "em": (PRO_EM, PRO_EM_RETURNED, PRO_EM_POWER),
    "plug": (PLUG, PLUG_RETURNED, PLUG_POWER),
    "net": (NET, None, NET_POWER),
    "power": (NET, None, NET_POWER),
}
MINUTE = timedelta(minutes=1)
FIVE = timedelta(minutes=5)
HOUR = timedelta(hours=1)
# Every report is this long before a whole minute.
EARLY = timedelta(seconds=1)
# The inputs report this far apart (see `Circuit.report`).
STAGGER = timedelta(milliseconds=1)
# Timers due by then run at a minute's report: those set by the reports of
# the minute before (the solar and the circuit report within 4 ms) as well.
# An integral's timer counts it once more (1 Wh per hour at 10 kW).
SLACK = timedelta(milliseconds=5)

ENERGY = {"device_class": "energy", "unit_of_measurement": "kWh"}
POWER = {
    "device_class": "power",
    "unit_of_measurement": "W",
    "state_class": "measurement",
}
LIFETIME = StatsEvidence(
    periodic=False,
    certain=False,
    reason=None,
    drops=[],
    went_negative=True,
    series=[
        (datetime(2026, 11, 20, tzinfo=dt_util.UTC) + timedelta(hours=hour), hour)
        for hour in range(72)
    ],
)


def settings(stat: str, rate: str, solar_rate: str | None = SOLAR_POWER) -> Any:
    """Return energy settings with one solar source and one circuit."""
    solar: dict[str, Any] = {
        "type": "solar",
        "stat_energy_from": SOLAR,
        "config_entry_solar_forecast": None,
    }
    if solar_rate is not None:
        solar["stat_rate"] = solar_rate
    return {
        "energy_sources": [solar],
        "device_consumption": [
            {"stat_consumption": stat, "stat_rate": rate, "name": "Circuit"}
        ],
        "device_consumption_water": [],
    }


# Home Assistant starts at this time (UTC); the first measured hour is two
# hours later. A test on another day parametrizes `epoch`.
EPOCH = datetime(2026, 11, 20, 10, tzinfo=dt_util.UTC)
# The tests' time zone (US/Pacific) falls back at 09:00 UTC on this day.
DST_EPOCH = datetime(2026, 11, 1, 6, tzinfo=dt_util.UTC)


@pytest.fixture
def epoch() -> datetime:
    """Return the time Home Assistant starts at."""
    return EPOCH


@pytest.fixture
def mock_recorder_before_hass(
    async_test_recorder: Any, freezer: FrozenDateTimeFactory, epoch: datetime
) -> None:
    """Prepare the recorder's database and the time before Home Assistant starts."""
    freezer.move_to(epoch)


@pytest.fixture(autouse=True)
def lifetime_inputs(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every input is a lifetime counter, every power has a sign.

    The setup's checks of the inputs' history are tested elsewhere; here the
    statistics start with the setup.
    """

    async def probe(
        hass: HomeAssistant, stats: Any, days: int = 3, power_of: Any = None
    ) -> dict[str, StatsEvidence]:
        return dict.fromkeys(stats, LIFETIME)

    monkeypatch.setattr(solar_setup, "async_probe", probe)


def _register(
    hass: HomeAssistant,
    entity_id: str,
    unique_id: str,
    *,
    platform: str = "shelly",
    device_id: str | None = None,
    device_class: str = "energy",
    translation_key: str | None = None,
) -> None:
    er.async_get(hass).async_get_or_create(
        "sensor",
        platform,
        unique_id,
        suggested_object_id=entity_id.removeprefix("sensor."),
        device_id=device_id,
        original_device_class=device_class,
        translation_key=translation_key,
        unit_of_measurement="kWh" if device_class == "energy" else "W",
    )


def _device(hass: HomeAssistant, name: str) -> str:
    entry = MockConfigEntry(domain="shelly")
    entry.add_to_hass(hass)
    return (
        dr.async_get(hass)
        .async_get_or_create(
            config_entry_id=entry.entry_id, identifiers={("shelly", name)}
        )
        .id
    )


@pytest.fixture(autouse=True)
def entities(hass: HomeAssistant) -> None:
    """Register the solar, a Shelly Pro EM, a Shelly plug and a net meter."""
    _register(hass, SOLAR, "solar-energy", platform="test")
    _register(hass, SOLAR_POWER, "solar-power", platform="test", device_class="power")
    pro_em = _device(hass, "pro_em")
    _register(hass, PRO_EM, f"{MAC}-em1data:0-total_act_energy", device_id=pro_em)
    _register(
        hass,
        PRO_EM_RETURNED,
        f"{MAC}-em1data:0-total_act_ret_energy",
        device_id=pro_em,
        translation_key="energy_returned",
    )
    _register(
        hass, PRO_EM_POWER, f"{MAC}-em1:0-power", device_id=pro_em, device_class="power"
    )
    plug = _device(hass, "plug")
    _register(hass, PLUG, f"{MAC}-switch:0-energy", device_id=plug)
    _register(
        hass,
        PLUG_RETURNED,
        f"{MAC}-switch:0-ret_energy",
        device_id=plug,
        translation_key="energy_returned",
    )
    _register(
        hass, PLUG_POWER, f"{MAC}-switch:0-power", device_id=plug, device_class="power"
    )
    net = _device(hass, "net")
    _register(hass, NET, "net-energy", platform="test", device_id=net)
    _register(
        hass,
        NET_POWER,
        "net-power",
        platform="test",
        device_id=net,
        device_class="power",
    )


@dataclass
class Circuit:
    """A circuit with a load and a solar inverter, and what its meters report.

    Powers in W. The circuit's power is the load minus the solar (positive
    while it draws from the grid). Each method's meter counts like the real
    device: the EM meter imports and exports apart, the plug's "Energy"
    counts both directions, the net meter is signed. All counters are kWh
    unless `units` says otherwise.
    """

    method: str
    load: float
    solar: float
    drawn: float = 500.0
    returned: float = 20.0
    solar_kwh: float = 1000.0
    # None: the solar power is a number in W; "kW": in kW; else
    # "unavailable", "unknown" or "restored" (unavailable, as Home Assistant
    # restores it after a start).
    solar_state: str | None = None
    # The solar's energy counter is offline (the inverter at night).
    counter_offline: bool = False
    # The circuit's power is reported positive on export.
    invert: bool = False
    units: dict[str, str] = field(default_factory=dict)
    # None: the circuit's power is a number; else this state.
    power_state: str | None = None
    # The circuit lies in a parent circuit with its own net meter (`NET`)
    # and power, whose other loads draw this much (W); None: no parent.
    parent_load: float | None = None
    parent: float = 800.0
    # Inputs polled slowly: entity -> (every, at): it reports only in the
    # minutes whose number is `at` modulo `every`.
    slow: dict[str, tuple[int, int]] = field(default_factory=dict)
    # The true consumption (kWh) per hour (its start), to cross-check the
    # hand calculations of the tests.
    consumed: dict[datetime, float] = field(default_factory=dict)

    @property
    def circuit(self) -> float:
        """The circuit's power (W), positive while it draws."""
        return self.load - self.solar

    @property
    def meter(self) -> str:
        """The circuit's meter."""
        return CIRCUITS[self.method][0]

    @property
    def returned_sensor(self) -> str | None:
        """The circuit's returned meter, if it has one."""
        return CIRCUITS[self.method][1]

    @property
    def power(self) -> str:
        """The circuit's power sensor."""
        return CIRCUITS[self.method][2]

    def truth(self, start: datetime, hours: int) -> list[float]:
        """Return the true consumption of each hour from `start`."""
        return [self.consumed.get(start + hour * HOUR, 0.0) for hour in range(hours)]

    def advance(self, end: datetime, minutes: float = 1) -> None:
        """Count the `minutes` until `end` at the current powers."""
        hours = minutes / 60
        hour = (end - timedelta(minutes=minutes / 2)).replace(
            minute=0, second=0, microsecond=0
        )
        self.consumed[hour] = self.consumed.get(hour, 0.0) + self.load / 1000 * hours
        flow = self.circuit / 1000 * hours
        if self.method == "em":
            self.drawn += max(flow, 0.0)
            self.returned += max(-flow, 0.0)
        elif self.method == "plug":
            self.drawn += abs(flow)
            self.returned += max(-flow, 0.0)
        else:
            self.drawn += flow
        self.solar_kwh += self.solar / 1000 * hours
        if self.parent_load is not None:
            self.parent += (self.circuit + self.parent_load) / 1000 * hours

    def _energy(self, entity_id: str, kwh: float) -> tuple[str, str, dict[str, Any]]:
        unit = self.units.get(entity_id, "kWh")
        value = kwh * 1000 if unit == "Wh" else kwh
        state_class = "total" if entity_id == NET else "total_increasing"
        return (
            entity_id,
            f"{value:.4f}",
            {**ENERGY, "unit_of_measurement": unit, "state_class": state_class},
        )

    def states(self) -> list[tuple[str, str, dict[str, Any]]]:
        """Return every input's state as the devices report it."""
        found = [self._energy(self.meter, self.drawn)]
        if self.returned_sensor is not None:
            found.append(self._energy(self.returned_sensor, self.returned))
        power = -self.circuit if self.invert else self.circuit
        if self.power_state is None:
            found.append((self.power, f"{power:.1f}", POWER))
        else:
            found.append((self.power, self.power_state, {}))
        if self.solar_state == "kW":
            kilowatts = {**POWER, "unit_of_measurement": "kW"}
            found.append((SOLAR_POWER, f"{self.solar / 1000:.4f}", kilowatts))
        elif self.solar_state is None:
            found.append((SOLAR_POWER, f"{self.solar:.1f}", POWER))
        elif self.solar_state == "restored":
            found.append((SOLAR_POWER, "unavailable", {**POWER, "restored": True}))
        else:
            found.append((SOLAR_POWER, self.solar_state, {}))
        if self.counter_offline:
            found.append((SOLAR, "unavailable", {}))
        else:
            found.append(self._energy(SOLAR, self.solar_kwh))
        if self.parent_load is not None:
            found.append(self._energy(NET, self.parent))
            parent_power = self.circuit + self.parent_load
            found.append((NET_POWER, f"{parent_power:.1f}", POWER))
        return found

    async def report(
        self, hass: HomeAssistant, freezer: FrozenDateTimeFactory, minute: int = 0
    ) -> None:
        """Report every input, one after the other, a millisecond apart.

        `minute` is the minute of the hour the report is for; a slowly polled
        input (`slow`) leaves out the others.

        A template renders on each input's change; apart in time, its last
        state of the minute is never tied with one it had on the way, which
        the recorder could otherwise take as the state at a period's start.
        """
        for entity_id, state, attributes in self.states():
            every, at = self.slow.get(entity_id, (1, 0))
            if minute % every != at:
                continue
            hass.states.async_set(entity_id, state, attributes)
            await hass.async_block_till_done()
            freezer.tick(STAGGER)


Event = Callable[[Circuit], Awaitable[None] | None]


class Clock:
    """Moves time a minute at a time and compiles the statistics on the way."""

    def __init__(
        self, hass: HomeAssistant, freezer: FrozenDateTimeFactory, now: datetime
    ) -> None:
        """Start at `now`."""
        self.hass = hass
        self.freezer = freezer
        self.now = now
        freezer.move_to(now)
        async_fire_time_changed_exact(hass, now)

    async def run(
        self,
        circuit: Circuit,
        until: datetime,
        events: dict[datetime, Event] | None = None,
    ) -> None:
        """Report every minute until `until`; `events` change the circuit first.

        Times passed in `events` and `until` are whole minutes; each happens
        at its report one second earlier. The statistics of the 5 minutes
        before `until` are compiled too.
        """
        events = events or {}
        while self.now < until + MINUTE - EARLY:
            when = self.now + MINUTE
            self.freezer.move_to(when)
            async_fire_time_changed_exact(self.hass, when + SLACK)
            await self.hass.async_block_till_done()
            circuit.advance(when)
            if (event := events.get(when + EARLY)) is not None and (
                done := event(circuit)
            ) is not None:
                await done
            await circuit.report(self.hass, self.freezer, (when + EARLY).minute)
            await self.hass.async_block_till_done()
            boundary = when.replace(minute=when.minute - when.minute % 5, second=0)
            if boundary > self.now:
                await async_wait_recording_done(self.hass)
                do_adhoc_statistics(self.hass, start=boundary - FIVE)
                await async_wait_recording_done(self.hass)
            self.now = when


async def _rows(
    hass: HomeAssistant, entity_id: str, start: datetime, end: datetime, period: str
) -> dict[datetime, float]:
    found = await get_instance(hass).async_add_executor_job(
        statistics_during_period,
        hass,
        start,
        end,
        {entity_id},
        period,
        None,
        {"change"},
    )
    return {
        dt_util.utc_from_timestamp(row["start"]): row["change"]
        for row in found.get(entity_id, [])
    }


async def hourly(
    hass: HomeAssistant, entity_id: str, start: datetime, hours: int
) -> list[float | None]:
    """Return the change of each hour from `start` (None: no statistics).

    This is what the energy dashboard shows for the meter.
    """
    found = await _rows(hass, entity_id, start, start + hours * HOUR, "hour")
    return [found.get(start + hour * HOUR) for hour in range(hours)]


async def short_term(
    hass: HomeAssistant, entity_id: str, start: datetime, end: datetime
) -> list[float]:
    """Return the 5-minute changes in [start, end)."""
    return list((await _rows(hass, entity_id, start, end, "5minute")).values())


Connect = Callable[[], Awaitable[Any]]


async def send(client: Connect, **msg: Any) -> dict[str, Any]:
    """Send one command on a new connection and return the response."""
    connection = await client()
    await connection.send_json_auto_id(msg)
    result: dict[str, Any] = await connection.receive_json()
    return result


async def set_up(
    hass: HomeAssistant,
    client: Connect,
    circuit: Circuit,
    **choices: Any,
) -> tuple[str, str | None]:
    """Preview, then create as the panel does; return gross energy and power."""
    message = {"stat": circuit.meter, "solar": SOLAR, "method": circuit.method}
    message |= choices
    shown = await send(client, type=f"{DOMAIN}/solar_setup_preview", **message)
    assert shown["success"], shown
    preview = shown["result"]
    assert preview["blocked"] is None, preview
    create = message | {
        "drawn": preview["drawn"],
        "invert": preview["invert"],
        "offset": preview["offset"],
    }
    if preview["returned"]:
        create["returned"] = preview["returned"]
    created = await send(client, type=f"{DOMAIN}/create_solar_setup", **create)
    assert created["success"], created
    await hass.async_block_till_done()
    return created["result"]["entity_id"], created["result"]["stat_rate"]


@pytest.fixture
async def start(
    recorder_mock: Any,
    hass: HomeAssistant,
    freezer: FrozenDateTimeFactory,
    loaded_entry: MockConfigEntry,
    epoch: datetime,
) -> datetime:
    """Return the first measured hour, two hours after Home Assistant started."""
    return epoch + 2 * HOUR


@pytest.fixture
def client(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    hass_admin_user: Any,
    hass_access_token: str,
) -> Connect:
    """Return a function that opens an admin's WebSocket connection.

    Each connection gets a new access token: the time moves on by hours, so
    the first token expires, and an idle connection misses its heartbeats.
    """
    refresh_token = next(iter(hass_admin_user.refresh_tokens.values()))

    async def connect() -> Any:
        token = hass.auth.async_create_access_token(refresh_token)
        return await hass_ws_client(hass, token)

    return connect


async def begin(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    circuit: Circuit,
    start: datetime,
    until: datetime | None = None,
    **choices: Any,
) -> tuple[Clock, str, str | None]:
    """Set up the gross meter 20 minutes before `start`; run until `until`.

    `until` defaults to `start`.
    """
    clock = Clock(hass, freezer, start - 20 * MINUTE - EARLY)
    await circuit.report(hass, freezer)
    await hass.async_block_till_done()
    await async_wait_recording_done(hass)
    gross, power = await set_up(hass, client, circuit, **choices)
    await clock.run(circuit, until or start)
    return clock, gross, power


def change(**values: Any) -> Event:
    """Return an event that sets attributes of the circuit."""

    def apply(circuit: Circuit) -> None:
        for key, value in values.items():
            setattr(circuit, key, value)

    return apply


def records(hass: HomeAssistant) -> dict[str, Any]:
    """Return the records of the helpers we created (entry ID -> record)."""
    entry = hass.config_entries.async_entries(DOMAIN)[0]
    return dict(entry.runtime_data.helpers.records())


def solar_term(hass: HomeAssistant) -> str:
    """Return the entity of the solar term (our integral of the solar power)."""
    entry_id = next(
        entry_id
        for entry_id, record in records(hass).items()
        if record["kind"] == "solar_energy"
    )
    return er.async_entries_for_config_entry(er.async_get(hass), entry_id)[0].entity_id


def approx(values: list[float], tolerance: float = 0.01) -> list[Any]:
    return [pytest.approx(value, abs=tolerance) for value in values]


# --- Scenarios ---------------------------------------------------------------


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_lag_dip_cancels(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM, exporting: the returned meter lags, polled every 5 minutes.

    The solar term updates every minute (GROSS_INTEGRAL_OPTIONS), so the lag
    comes from a meter here: from 0:30 to 1:30 the returned meter reports
    only at :31, :36, ..., :56, 1:01, ..., 1:26. At the end of hour 0 its last
    report is from 0:56, 4 minutes of export short, while the solar term is
    up to date; the gross meter is that much too high, and too low by the
    same once the meter catches up in hour 1.

    Load 50 W, solar 1500 W (export 1.45 kW). True consumption: 0.05 kWh per
    hour; the lag at the end of hour 0: 1.45 kW x 4 min = 0.0967 kWh.
    Hour 0: 0.05 + 0.0967 = 0.1467. Hour 1: 0.05 - 0.0967 = -0.0467, below 0.
    Hour 2: 0.05. Hours 0 and 1 together: 0.1 = 2 x 0.05, nothing lost; the
    `total` state class books the dip below 0 and its return 1:1.
    """
    circuit = Circuit("em", load=50, solar=1500)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 30 * MINUTE: change(slow={PRO_EM_RETURNED: (5, 1)}),
            start + 90 * MINUTE: change(slow={}),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.05] * 3)
    lag = 1.45 * 4 / 60
    changes = await hourly(hass, gross, start, 3)
    assert changes == approx([0.05 + lag, 0.05 - lag, 0.05])
    assert sum(value or 0.0 for value in changes[:2]) == pytest.approx(0.1, abs=0.01)


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_solar_unavailable_night_keeps_counting(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Net, at sunset: the solar power goes to 0, then unavailable all night.

    The solar term holds 0 for 10 minutes, then gives 0: its integral stays
    available, so the gross meter (net meter + solar term) never turns
    unknown.

    Load 300 W all the time, solar 200 W until 0:10, 0 W until 0:20, then
    unavailable. True consumption: 0.3 kWh in each of the 3 hours; the net
    meter alone counts 0.3 - 0.2 x 10/60 = 0.267 in hour 0.
    """
    circuit = Circuit("net", load=300, solar=200)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 10 * MINUTE: change(solar=0),
            start + 20 * MINUTE: change(solar_state="unavailable"),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])
    term = hass.states.get(solar_term(hass))
    assert term is not None
    assert float(term.state) >= 0
    # A row in each of the 36 periods: the gross meter was never unknown.
    assert len(await short_term(hass, gross, start, start + 3 * HOUR)) == 36


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_unit_change_is_flat(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM: the returned meter switches from kWh to Wh at 0:20, back at 1:20.

    The template converts each input at render time, so the same energy in
    another unit gives the same gross value: no 1000-fold jump.

    Load 400 W, solar 1000 W (600 W export). True consumption: 0.4 kWh per
    hour, and 0.4 x 5/60 = 0.0333 kWh in every 5 minutes.
    """
    circuit = Circuit("em", load=400, solar=1000)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 20 * MINUTE: change(units={PRO_EM_RETURNED: "Wh"}),
            start + 80 * MINUTE: change(units={}),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.4] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.4, 0.4, 0.4])
    steps = await short_term(hass, gross, start, start + 3 * HOUR)
    assert steps == approx([0.4 * 5 / 60] * 36, 0.002)


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_restart_template_reload(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM: every helper of the setup is reloaded at 0:20, as on a restart.

    The gross template renders again from its inputs, the solar term's
    integral restores its value, the solar power template starts without a
    value of its own: no jump.

    Load 300 W, solar 900 W (600 W export). True consumption: 0.3 kWh per
    hour.
    """
    circuit = Circuit("em", load=300, solar=900)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)

    async def reload(_: Circuit) -> None:
        for entry_id in records(hass):
            assert await hass.config_entries.async_reload(entry_id)
        await hass.async_block_till_done()

    await clock.run(circuit, start + 3 * HOUR, {start + 20 * MINUTE: reload})
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_power_method_with_invert(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power with a circuit power that is positive on export, inverted.

    Gross power = -(reported) + solar = circuit + solar = the load.

    Hour 0: load 500 W, solar 800 W (reported +300 W) for 30 minutes, then
    load 900 W (reported -100 W): 0.25 + 0.45 = 0.7 kWh.
    Hour 1: 900 W = 0.9 kWh, the solar off from 1:15 (reported -900 W).
    Hour 2: 900 W = 0.9 kWh.
    """
    circuit = Circuit("power", load=500, solar=800, invert=True)
    clock, gross, power = await begin(
        hass, client, freezer, circuit, start, invert=True
    )
    assert power is not None
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 30 * MINUTE: change(load=900),
            start + 75 * MINUTE: change(solar=0),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.7, 0.9, 0.9])
    assert await hourly(hass, gross, start, 3) == approx([0.7, 0.9, 0.9])


@pytest.mark.parametrize("energy_prefs", [settings(PLUG, PLUG_POWER)])
async def test_compile_input_replaced_triggers_gross_off(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Plug: the plug is replaced at 1:30, its counters start again at 0.

    Load 800 W, solar 500 W, the plug draws 300 W ("Energy" +0.3 kWh per
    hour, returned stays at 30 kWh). True consumption: 0.8 kWh per hour.

    Hour 1: the plug's Energy goes from 101.4 (end of hour 0: 101 + 0.3 x
    80/60) to 0.15 (30 minutes on the new plug), returned from 30 to 0, the
    solar term +0.5: -101.25 + 2 x 30 + 0.5 = -40.75 kWh, the true 0.8 less
    the 41.55 the old counters held at the swap (101.55 - 2 x 30).

    The safety net reads these hourly statistics and reports the fall, with
    the plug as the input that was reset.
    """
    circuit = Circuit("plug", load=800, solar=500, drawn=101.0, returned=30.0)
    clock, gross, power = await begin(hass, client, freezer, circuit, start)
    assert power is not None
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {start + 90 * MINUTE: change(drawn=0.0, returned=0.0)},
    )
    assert circuit.truth(start, 3) == pytest.approx([0.8] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.8, -40.75, 0.8])

    # The gross meter is the device now, with its gross power.
    await energy_access.async_write(hass, settings(gross, power))
    response = await send(client, type=f"{DOMAIN}/get")
    assert response["success"], response
    hints = [h for h in response["result"]["hints"] if h["code"] == "gross_off"]
    assert len(hints) == 1
    assert hints[0]["stat"] == gross
    assert hints[0]["data"] == {
        "direction": "fall",
        "hour": dt_util.as_local(start + HOUR).isoformat(),
        "method": "plug",
        "change_kwh": pytest.approx(-40.75, abs=0.01),
        "power_kwh": pytest.approx(0.8, abs=0.01),
        "input": PLUG,
        "cause": "input",
    }


@pytest.mark.parametrize("energy_prefs", [settings(PLUG, PLUG_POWER)])
async def test_compile_plug_formula_matches_consumption(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Plug: Energy (both directions) - 2 x returned + solar is the load.

    Load 300 W all the time.
    Hour 0: no solar for 30 minutes (draws 300 W: Energy +0.15), then 1000 W
    (exports 700 W: Energy +0.35, returned +0.35), solar term +0.5:
    0.15 + 0.35 - 2 x 0.35 + 0.5 = 0.3 kWh.
    Hour 1: solar 600 W (exports 300 W): 0.3 - 0.6 + 0.6 = 0.3 kWh.
    Hour 2: solar 200 W (draws 100 W): 0.1 + 0.2 = 0.3 kWh.
    """
    circuit = Circuit("plug", load=300, solar=0)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 30 * MINUTE: change(solar=1000),
            start + 60 * MINUTE: change(solar=600),
            start + 120 * MINUTE: change(solar=200),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_short_dropout_held(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM, exporting: the solar power is unavailable from 0:20 to 0:30.

    The solar term holds the last 600 W through the 10 minutes, while the
    returned meter keeps counting the export.

    Load 200 W, solar 600 W (400 W export). True consumption: 0.2 kWh per
    hour. Without the hold, hour 0 would lose 600 W x 10 min = 0.1 kWh.
    """
    circuit = Circuit("em", load=200, solar=600)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 2 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unavailable"),
            start + 30 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 2) == pytest.approx([0.2] * 2)
    changes = await hourly(hass, gross, start, 2)
    assert changes[0] == pytest.approx(0.2, abs=0.005)
    assert changes[1] == pytest.approx(0.2, abs=0.01)


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_dropout_never_falls(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power, exporting: the solar power is unavailable 0:20-0:50.

    The gross power holds the solar like the solar term (10 minutes, as
    rendered: see the module docstring), then the hold ends while the
    circuit feeds in: the gross power is unknown (H6a) instead of the
    circuit's -400 W, so the integral counts nothing and never falls.

    Load 200 W, solar 600 W (circuit -400 W). True consumption: 0.2 kWh per
    hour. The held template renders 0 at 0:30:59 (its first render 600 s or
    more after the dropout), just after the integral's update of that
    minute: the integral has counted the held 200 W up to 0:30:59 and counts
    again from 0:49:59, 19 minutes lost at 200 W.
    Hour 0: 0.2 - 0.2 x 19/60 = 0.1367 kWh. Counting the gap at -400 W would
    have given 0.2 - 0.6 x 19/60 = 0.01.
    """
    circuit = Circuit("power", load=200, solar=600)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 2 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unavailable"),
            start + 50 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 2) == pytest.approx([0.2] * 2)
    assert await hourly(hass, gross, start, 2) == approx([0.2 - 0.2 * 19 / 60, 0.2])
    steps = await short_term(hass, gross, start, start + 2 * HOUR)
    assert len(steps) == 24
    assert min(steps) >= 0


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_unknown_and_restored_give_zero(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM, exporting: the solar is `unknown` 0:20-0:30, `restored` 1:20-1:30.

    No hold for either (maintainer decision H6b, fix round 3): the solar
    term counts 0 at once. The returned meter still counts the export, so
    the gross meter misses that solar energy.

    Load 200 W, solar 600 W (400 W export). True consumption: 0.2 kWh per
    hour. Hours 0 and 1 lose 600 W x 10 min = 0.1 kWh each: 0.1 kWh;
    hour 2: 0.2 kWh.
    """
    circuit = Circuit("em", load=200, solar=600)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unknown"),
            start + 30 * MINUTE: change(solar_state=None),
            start + 80 * MINUTE: change(solar_state="restored"),
            start + 90 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.2] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.1, 0.1, 0.2])


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_net_method(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Net: a signed meter (`total`) that falls while the circuit exports.

    Load 300 W all the time.
    Hour 0: solar 1000 W, the net meter falls 0.7 kWh: -0.7 + 1.0 = 0.3.
    Hour 1: solar 200 W, the net meter rises 0.1: 0.1 + 0.2 = 0.3.
    Hour 2: no solar: 0.3. True consumption: 0.3 kWh per hour.
    """
    circuit = Circuit("net", load=300, solar=1000)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {start + 60 * MINUTE: change(solar=200), start + 120 * MINUTE: change(solar=0)},
    )
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])
    assert await hourly(hass, NET, start, 3) == approx([-0.7, 0.1, 0.3])


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER, None)])
async def test_compile_counter_solar_term_night_pause(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Net with the solar's own lifetime counter (no solar power).

    The inverter goes offline at 0:30 and back at 4:30, its counter
    unavailable meanwhile: the gross meter (net meter + counter) is unknown
    all night and catches up in the morning, when the counter reports again.

    Load 300 W all the time, solar 500 W until 0:30, 400 W from 4:30.
    Hour 0: at 0:30 the net meter reports before the counter goes offline,
    so the last value before the night has 30 minutes of the net meter
    (-0.2 kW: -0.1 kWh) and 29 of the counter (0.5 kW: 0.2417 kWh): 0.1417.
    Hours 1-3: no statistics (unknown): the dashboard shows nothing.
    Hour 4: the rest, from that value to 5:00: 1.5 - 0.1417 = 1.3583 kWh.
    The 5 hours: 1.5 = 5 x 0.3, the true consumption.
    """
    circuit = Circuit("net", load=300, solar=500)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    assert not any(r["kind"] == "solar_energy" for r in records(hass).values())
    await clock.run(
        circuit,
        start + 5 * HOUR,
        {
            start + 30 * MINUTE: change(solar=0, counter_offline=True),
            start + 270 * MINUTE: change(solar=400, counter_offline=False),
        },
    )
    assert circuit.truth(start, 5) == pytest.approx([0.3] * 5)
    changes = await hourly(hass, gross, start, 5)
    assert changes[1:4] == [None, None, None]
    evening = -0.2 * 30 / 60 + 0.5 * 29 / 60
    assert [changes[0], changes[4]] == approx([evening, 1.5 - evening])
    assert sum(value or 0.0 for value in changes) == pytest.approx(1.5, abs=0.01)
    # The documented night pause of the counter path is no safety-net hint.
    hints = await safety_net(hass, client, gross, None)
    assert not [hint for hint in hints if hint["code"] == "gross_unknown"]


async def safety_net(
    hass: HomeAssistant, client: Connect, stat: str, rate: str | None
) -> list[dict[str, Any]]:
    """Make the gross meter the device and return the hints `get` gives it."""
    prefs = settings(stat, rate or "")
    if rate is None:
        del prefs["device_consumption"][0]["stat_rate"]
    await energy_access.async_write(hass, prefs)
    response = await send(client, type=f"{DOMAIN}/get")
    assert response["success"], response
    return [hint for hint in response["result"]["hints"] if hint["stat"] == stat]


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_constant_solar_no_lag(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM, a large solar held exactly constant (an inverter at its limit).

    Its template writes only on a change, so the solar term's integral moves
    on its own timer alone; at a 5-minute interval it lagged up to 5
    minutes at 10 kW behind the export the returned meter counts at once.
    It updates every minute now.

    Load 100 W, solar 9 kW, 10 kW from 0:56. True consumption: 0.1 kWh per
    hour; no safety-net hint.
    """
    circuit = Circuit("em", load=100, solar=9000)
    clock, gross, power = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit, start + 3 * HOUR, {start + 56 * MINUTE: change(solar=10000)}
    )
    assert circuit.truth(start, 3) == pytest.approx([0.1] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.1] * 3, 0.02)
    hints = await safety_net(hass, client, gross, power)
    assert not [hint for hint in hints if hint["code"] == "gross_off"]


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_constant_load_no_lag(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power: an 11 kW load starts at 0:51 and stays exactly constant.

    The gross power then changes no more; its integral moves on its own
    timer, every minute.

    Hour 0: 100 W for 51 minutes and 11 kW for 9: 0.085 + 1.65 = 1.735 kWh.
    Hours 1 and 2: 11 kWh each. No safety-net hint.
    """
    circuit = Circuit("power", load=100, solar=0)
    clock, gross, power = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit, start + 3 * HOUR, {start + 51 * MINUTE: change(load=11000)}
    )
    assert circuit.truth(start, 3) == pytest.approx([1.735, 11, 11])
    assert await hourly(hass, gross, start, 3) == approx([1.735, 11, 11], 0.02)
    hints = await safety_net(hass, client, gross, power)
    assert not [hint for hint in hints if hint["code"] == "gross_off"]


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_dropout_held(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power, importing: the solar power is unavailable 0:20-0:30.

    The gross power takes the solar from the held solar power template, as
    the solar term does: the 10 minutes are held.

    Load 800 W, solar 600 W (circuit +200 W). True consumption: 0.8 kWh per
    hour. Without the hold, hour 0 would lose 600 W x 10 min = 0.1 kWh.
    """
    circuit = Circuit("power", load=800, solar=600)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 2 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unavailable"),
            start + 30 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 2) == pytest.approx([0.8] * 2)
    assert await hourly(hass, gross, start, 2) == approx([0.8, 0.8], 0.02)


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_night_keeps_counting(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power at sunset: the solar goes to 0, then unavailable all night.

    The circuit draws, so the gross power stays the circuit's power plus the
    held 0: the integral keeps counting all night.

    Load 300 W, solar 200 W until 0:10, 0 W until 0:20, then unavailable.
    True consumption: 0.3 kWh in each hour.
    """
    circuit = Circuit("power", load=300, solar=200)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 10 * MINUTE: change(solar=0),
            start + 20 * MINUTE: change(solar_state="unavailable"),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_long_dropout_hold_ends(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM, exporting: the solar is unavailable 0:20-0:50, longer than the hold.

    The solar term holds the last 600 W, then counts 0 until the solar
    reports again.

    Load 200 W, solar 600 W (400 W export). True consumption: 0.2 kWh per
    hour. The hold lasts from the report at 0:19:59 to the render at 0:30:59
    (the first 600 s or more after it; see the module docstring): 11
    minutes; then 0 until 0:49:59: 19 minutes x 0.6 kW = 0.19 kWh missed.
    Hour 0: 0.2 - 0.19 = 0.01 kWh. Hour 1: 0.2 kWh.
    """
    circuit = Circuit("em", load=200, solar=600)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 2 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unavailable"),
            start + 50 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 2) == pytest.approx([0.2] * 2)
    assert await hourly(hass, gross, start, 2) == approx([0.2 - 0.6 * 19 / 60, 0.2])


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_circuit_offline_gross_unknown(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power: the circuit's power is unavailable 0:10-1:40.

    The gross power is unknown meanwhile; its integral counts nothing, and
    the safety net names the circuit's power.

    Load 300 W, no solar. True consumption: 0.3 kWh per hour.
    Hour 0: 10 minutes counted, 0.05. Hour 1: from 1:40, 20 minutes: 0.1.
    Hour 2: 0.3. The gross power's last 5-minute row before the gap is the
    one of 0:05 (it turned unknown at 0:09:59), the first after it the one of
    1:35 (back at 1:39:59): 85 minutes without a row.
    """
    circuit = Circuit("power", load=300, solar=0)
    clock, gross, power = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 10 * MINUTE: change(power_state="unavailable"),
            start + 100 * MINUTE: change(power_state=None),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.05, 0.1, 0.3])
    hints = await safety_net(hass, client, gross, power)
    unknown = [hint for hint in hints if hint["code"] == "gross_unknown"]
    assert [hint["data"] for hint in unknown] == [
        {
            "hour": dt_util.as_local(start + 10 * MINUTE).isoformat(),
            "minutes": 85,
            "method": "power",
            "input": NET_POWER,
        }
    ]


@pytest.mark.parametrize("energy_prefs", [settings(PRO_EM, PRO_EM_POWER)])
async def test_compile_solar_power_unit_change_is_flat(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """EM: the solar's power switches from W to kW at 0:20, back at 1:20.

    The held template reads it in W at render time: the solar term, and so
    the gross meter, do not jump.

    Load 400 W, solar 1000 W. True consumption: 0.4 kWh per hour.
    """
    circuit = Circuit("em", load=400, solar=1000)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 3 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="kW"),
            start + 80 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 3) == pytest.approx([0.4] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.4, 0.4, 0.4])


NESTED = {
    **settings(NET, NET_POWER),
    "device_consumption": [
        {"stat_consumption": NET, "stat_rate": NET_POWER, "name": "Main"},
        {
            "stat_consumption": PRO_EM,
            "stat_rate": PRO_EM_POWER,
            "name": "Circuit",
            "included_in_stat": NET,
        },
    ],
}


@pytest.mark.parametrize("energy_prefs", [NESTED])
async def test_compile_solar_term_reused_by_a_nested_setup(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """The solar feeds an EM circuit inside the main circuit (a Net meter).

    The EM circuit is set up first, the main circuit 10 minutes later; its
    setup reuses the solar term (no new solar helpers) and is right too.

    EM circuit: load 300 W, solar 1000 W, then 0 W from 1:00. The rest of
    the main circuit draws 500 W.
    EM gross: 0.3 kWh per hour. Main gross (net meter + the same solar
    term): 0.3 + 0.5 = 0.8 kWh per hour.
    """
    circuit = Circuit("em", load=300, solar=1000, parent_load=500)
    clock, gross, _ = await begin(
        hass, client, freezer, circuit, start, start - 10 * MINUTE
    )
    term = solar_term(hass)
    before = set(records(hass))
    shown = await send(
        client,
        type=f"{DOMAIN}/solar_setup_preview",
        stat=NET,
        solar=SOLAR,
        method="net",
    )
    assert shown["result"]["solar_term"]["reuse"] == term
    assert [h["role"] for h in shown["result"]["helpers"]] == ["power", "energy"]
    main, _ = await set_up(hass, client, circuit, stat=NET, method="net")
    new = {records(hass)[entry]["kind"] for entry in set(records(hass)) - before}
    assert new == {"gross_power", "gross_energy"}
    await clock.run(circuit, start + 2 * HOUR, {start + HOUR: change(solar=0)})
    assert circuit.truth(start, 2) == pytest.approx([0.3] * 2)
    assert await hourly(hass, gross, start, 2) == approx([0.3, 0.3])
    assert await hourly(hass, main, start, 2) == approx([0.8, 0.8])


@pytest.mark.parametrize("epoch", [DST_EPOCH])
@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_across_the_fall_back(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """Net, through the night the clocks go back (US/Pacific, 1 November).

    Statistics hours are UTC hours: 01:00 PDT, 01:00 PST and 02:00 PST are
    three hours of 0.3 kWh, and the safety net, which works in local time,
    finds nothing.

    Load 300 W, solar 1000 W, 0 W from 1:30. True consumption: 0.3 kWh per
    hour.
    """
    local = [dt_util.as_local(start + hour * HOUR) for hour in range(3)]
    assert [when.hour for when in local] == [1, 1, 2]
    assert local[0].utcoffset() != local[1].utcoffset()
    circuit = Circuit("net", load=300, solar=1000)
    clock, gross, power = await begin(hass, client, freezer, circuit, start)
    await clock.run(circuit, start + 3 * HOUR, {start + 90 * MINUTE: change(solar=0)})
    assert circuit.truth(start, 3) == pytest.approx([0.3] * 3)
    assert await hourly(hass, gross, start, 3) == approx([0.3, 0.3, 0.3])
    hints = await safety_net(hass, client, gross, power)
    assert not [h for h in hints if h["code"] in ("gross_off", "gross_unknown")]


@pytest.mark.parametrize("energy_prefs", [settings(NET, NET_POWER)])
async def test_compile_from_power_sun_rises_in_the_hold(
    hass: HomeAssistant,
    client: Connect,
    freezer: FrozenDateTimeFactory,
    start: datetime,
) -> None:
    """From power: the solar sensor drops out at 0:20, the sun comes out at 0:22.

    The held 300 W is then too low: circuit + held would be below 0. While
    the solar has no number, such a sum is unknown, so the integral counts
    nothing and never falls.

    Load 200 W; solar 300 W, 2000 W from 0:22; the sensor back at 0:30.
    True consumption: 0.2 kWh per hour.
    0:20-0:22: circuit -100 W + held 300 W = 200 W, right.
    0:22-0:30: circuit -1800 W + held 300 W < 0: unknown. The integral has
    counted up to its update at 0:21:59 and counts again from 0:29:59:
    8 minutes at 200 W lost. Hour 0: 0.2 - 0.2 x 8/60 = 0.1733 kWh.
    Counting circuit + held would have given 0.2 - 1.7 x 8/60 = -0.027.
    """
    circuit = Circuit("power", load=200, solar=300)
    clock, gross, _ = await begin(hass, client, freezer, circuit, start)
    await clock.run(
        circuit,
        start + 2 * HOUR,
        {
            start + 20 * MINUTE: change(solar_state="unavailable"),
            start + 22 * MINUTE: change(solar=2000),
            start + 30 * MINUTE: change(solar_state=None),
        },
    )
    assert circuit.truth(start, 2) == pytest.approx([0.2] * 2)
    assert await hourly(hass, gross, start, 2) == approx([0.2 - 0.2 * 8 / 60, 0.2])
    steps = await short_term(hass, gross, start, start + 2 * HOUR)
    assert len(steps) == 24
    assert min(steps) >= 0
