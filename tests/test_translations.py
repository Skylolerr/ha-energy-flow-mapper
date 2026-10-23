"""Every translation has the same keys and placeholders as strings.json."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

BASE = Path(__file__).parent.parent / "custom_components" / "energy_flow_mapper"
PLACEHOLDER = re.compile(r"\{(\w+)\}")


def flatten(data: dict[str, Any], prefix: str = "") -> dict[str, str]:
    """Return a flat {dotted.key: text} mapping."""
    flat: dict[str, str] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            flat |= flatten(value, f"{prefix}{key}.")
        else:
            flat[prefix + key] = value
    return flat


def load(path: Path) -> dict[str, str]:
    return flatten(json.loads(path.read_text(encoding="utf-8")))


STRINGS = load(BASE / "strings.json")


@pytest.mark.parametrize("language", ["en", "de", "fr", "it"])
def test_translation_matches_strings(language: str) -> None:
    translation = load(BASE / "translations" / f"{language}.json")
    assert translation.keys() == STRINGS.keys()
    for key, text in STRINGS.items():
        assert sorted(PLACEHOLDER.findall(translation[key])) == sorted(
            PLACEHOLDER.findall(text)
        ), key


def test_english_translation_is_strings() -> None:
    assert load(BASE / "translations" / "en.json") == STRINGS
