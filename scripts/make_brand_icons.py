"""Render the brand icon of Energy Flow Mapper.

A blue app tile in Home Assistant colours with white Sankey ribbons: one
orange source splits into three flows of different width, like the panel's
diagram. The tile works on light
and dark backgrounds, so there is no separate dark icon. Run with the dev
venv (needs Pillow and NumPy):

    python scripts/make_brand_icons.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BRAND = (
    Path(__file__).parent.parent / "custom_components" / "energy_flow_mapper" / "brand"
)
S = 2048  # supersampled canvas, scaled down at the end

TILE_FROM, TILE_TO = (0, 188, 212), (13, 71, 161)  # Home Assistant blues
TILE_RADIUS = 0.225  # relative to the size, like an app icon
SOURCE_COLOR = (255, 183, 77)  # energy orange

SOURCE = (0.355, 0.2, 0.645, 0.285)  # source pill: x0, y0, x1, y1
TARGET_Y = (0.715, 0.8)
TARGET_CENTERS = (0.235, 0.5, 0.765)
SHARES = (0.5, 0.3, 0.2)  # how much each flow takes
ALPHAS = (255, 225, 195)  # bigger flows are brighter
GAP = 0.022  # space between the flows
SEPARATION = 0.03  # space between the flows and the pills
TARGET_EXTRA = 0.06  # target pills are a bit wider than their flow


def gradient(c0: tuple[int, int, int], c1: tuple[int, int, int]) -> Image.Image:
    """Diagonal gradient from the top right to the bottom left."""
    y, x = np.mgrid[0:S, 0:S]
    t = ((S - x) + y) / (2 * S)
    rgb = (
        np.array(c0, float) + (np.array(c1, float) - np.array(c0, float)) * t[..., None]
    )
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


def bezier(p0: tuple[float, float], p3: tuple[float, float]) -> np.ndarray:
    """Vertical-tangent cubic curve, like the connectors of the panel."""
    mid = (p0[1] + p3[1]) / 2
    p1, p2 = (p0[0], mid), (p3[0], mid)
    t = np.linspace(0, 1, 240)[:, None]
    points = (
        (1 - t) ** 3 * np.array(p0)
        + 3 * (1 - t) ** 2 * t * np.array(p1)
        + 3 * (1 - t) * t**2 * np.array(p2)
        + t**3 * np.array(p3)
    )
    return points * S


def render() -> Image.Image:
    """Render the icon on a transparent square canvas."""
    tile = Image.new("L", (S, S), 0)
    ImageDraw.Draw(tile).rounded_rectangle(
        [0, 0, S - 1, S - 1], radius=round(TILE_RADIUS * S), fill=255
    )
    image = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    image.paste(gradient(TILE_FROM, TILE_TO), (0, 0), tile)

    marks = Image.new("L", (S, S), 0)
    draw = ImageDraw.Draw(marks)
    x0, y0, x1, y1 = SOURCE
    available = (x1 - x0) - GAP * (len(SHARES) - 1)
    left = x0
    for share, center, alpha in zip(SHARES, TARGET_CENTERS, ALPHAS, strict=True):
        width = available * share
        top = y1 + SEPARATION
        bottom = TARGET_Y[0] - SEPARATION
        outline = np.concatenate(
            [
                bezier((left, top), (center - width / 2, bottom)),
                bezier((left + width, top), (center + width / 2, bottom))[::-1],
            ]
        )
        draw.polygon([tuple(p) for p in outline], fill=alpha)
        half = width / 2 + TARGET_EXTRA / 2
        draw.rounded_rectangle(
            [
                round((center - half) * S),
                round(TARGET_Y[0] * S),
                round((center + half) * S),
                round(TARGET_Y[1] * S),
            ],
            radius=round((TARGET_Y[1] - TARGET_Y[0]) / 2 * S),
            fill=alpha,
        )
        left += width + GAP
    white = Image.new("RGBA", (S, S), (255, 255, 255, 0))
    white.putalpha(marks)
    image.alpha_composite(white)

    source = Image.new("L", (S, S), 0)
    ImageDraw.Draw(source).rounded_rectangle(
        [round(x0 * S), round(y0 * S), round(x1 * S), round(y1 * S)],
        radius=round((y1 - y0) / 2 * S),
        fill=255,
    )
    orange = Image.new("RGBA", (S, S), (*SOURCE_COLOR, 0))
    orange.putalpha(source)
    image.alpha_composite(orange)
    return image


def main() -> None:
    """Write both icon sizes into the brand folder."""
    BRAND.mkdir(parents=True, exist_ok=True)
    image = render()
    for name, size in (("icon.png", 256), ("icon@2x.png", 512)):
        image.resize((size, size), Image.Resampling.LANCZOS).save(
            BRAND / name, optimize=True
        )
    for name in ("dark_icon.png", "dark_icon@2x.png"):
        (BRAND / name).unlink(missing_ok=True)
    print(f"Icons written to {BRAND}")  # noqa: T201


if __name__ == "__main__":
    main()
