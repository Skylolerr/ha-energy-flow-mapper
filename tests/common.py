"""Test helpers from Home Assistant's test package.

Home Assistant 2026.11 and newer ship the official `pytest-homeassistant`.
Older releases only have `pytest-homeassistant-custom-component`, which the
tests use for the minimum version. Only one of them is ever installed.
"""

from __future__ import annotations

try:
    from pytest_homeassistant.common import MockConfigEntry
    from pytest_homeassistant.typing import (
        ClientSessionGenerator,
        WebSocketGenerator,
    )
except ImportError:  # Home Assistant before 2026.11
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import (
        ClientSessionGenerator,
        WebSocketGenerator,
    )

__all__ = ["ClientSessionGenerator", "MockConfigEntry", "WebSocketGenerator"]
