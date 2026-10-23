"""Render the brand icons of Energy Flow Mapper (draft design).

A source block at the top feeds three device blocks through arrows whose
width shows how much energy flows, like the panel's diagram. Transparent
background. Run with the dev venv (needs Pillow and NumPy):

    python scripts/make_brand_icons.py
"""

from __future__ import annotations

from itertools import pairwise
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BRAND = (
    Path(__file__).parent.parent / "custom_components" / "energy_flow_mapper" / "brand"
)
SIZE = 2048  # supersampled canvas, scaled down at the end

SOURCE = (255, 152, 0)  # energy orange, like the solar colour of HA
FLOW = (3, 169, 244)  # HA primary blue
DEVICES = [(3, 169, 244), (41, 182, 246), (79, 195, 247)]
OUTLINE = {"light": (33, 33, 33, 255), "dark": (240, 240, 240, 255)}

TOP = (0.30, 0.06, 0.70, 0.30)  # x0, y0, x1, y1 relative to the size
CHILD_Y = (0.70, 0.94)
CHILD_X = [(0.03, 0.31), (0.36, 0.64), (0.69, 0.97)]
WIDTHS = [0.085, 0.05, 0.025]  # arrow widths: much, some, little energy
RADIUS = 0.06


def px(value: float) -> int:
    """Convert a relative coordinate to canvas pixels."""
    return round(value * SIZE)


def bezier(
    p0: tuple[float, float], p3: tuple[float, float], steps: int = 160
) -> np.ndarray:
    """Vertical-tangent cubic curve between two points (like the panel)."""
    mid = (p0[1] + p3[1]) / 2
    p1, p2 = (p0[0], mid), (p3[0], mid)
    t = np.linspace(0, 1, steps)[:, None]
    points = (
        (1 - t) ** 3 * np.array(p0)
        + 3 * (1 - t) ** 2 * t * np.array(p1)
        + 3 * (1 - t) * t**2 * np.array(p2)
        + t**3 * np.array(p3)
    )
    return points * SIZE


def draw_arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    width: float,
) -> None:
    """Draw a curved arrow whose head grows with its width."""
    half = max(width * 0.9, 0.035)
    length = half * 1.15
    tip_y = end[1]
    base = (end[0], tip_y - length)
    points = bezier(start, base)
    line = px(width)
    for (x0, y0), (x1, y1) in pairwise(points):
        draw.line([(x0, y0), (x1, y1)], fill=FLOW, width=line)
        draw.ellipse(
            [x0 - line / 2, y0 - line / 2, x0 + line / 2, y0 + line / 2], fill=FLOW
        )
    draw.polygon(
        [
            (px(end[0] - half), px(base[1] + 0.004)),
            (px(end[0] + half), px(base[1] + 0.004)),
            (px(end[0]), px(tip_y)),
        ],
        fill=FLOW,
    )


def render(variant: str) -> Image.Image:
    """Render the icon for the light or dark variant."""
    image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    outline = OUTLINE[variant]
    stroke = px(0.018)

    top_bottom = TOP[3]
    for (x0, x1), width in zip(CHILD_X, WIDTHS, strict=True):
        draw_arrow(
            draw,
            ((TOP[0] + TOP[2]) / 2, top_bottom),
            ((x0 + x1) / 2, CHILD_Y[0] - 0.012),
            width,
        )

    draw.rounded_rectangle(
        [px(TOP[0]), px(TOP[1]), px(TOP[2]), px(TOP[3])],
        radius=px(RADIUS),
        fill=SOURCE,
        outline=outline,
        width=stroke,
    )
    for (x0, x1), color in zip(CHILD_X, DEVICES, strict=True):
        draw.rounded_rectangle(
            [px(x0), px(CHILD_Y[0]), px(x1), px(CHILD_Y[1])],
            radius=px(RADIUS),
            fill=color,
            outline=outline,
            width=stroke,
        )
    return image


def main() -> None:
    """Write all icon sizes into the brand folder."""
    BRAND.mkdir(parents=True, exist_ok=True)
    for variant, prefix in (("light", ""), ("dark", "dark_")):
        image = render(variant)
        for name, size in ((f"{prefix}icon.png", 256), (f"{prefix}icon@2x.png", 512)):
            image.resize((size, size), Image.Resampling.LANCZOS).save(
                BRAND / name, optimize=True
            )
    print(f"Icons written to {BRAND}")  # noqa: T201


if __name__ == "__main__":
    main()
