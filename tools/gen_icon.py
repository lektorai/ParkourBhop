#!/usr/bin/env python3
"""Generate app icons: icon.png (512), adaptive foreground/background (432),
and the RuStore store icon (512, opaque).

Run from the repository root:  python3 tools/gen_icon.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")

HEART = [
    "..##..##..",
    ".####.####",
    "##########",
    "##########",
    ".########.",
    ".########.",
    "..######..",
    "...####...",
    "....##....",
    "..........",
]

BG_TOP = (59, 110, 240)
BG_BOT = (44, 85, 196)
PAPER = (255, 255, 255)
INK = (43, 45, 66)
GRID = (205, 208, 216)


def gradient(size, top, bot):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    return img


def draw_board(img, box, rows, pad_ratio=0.0, with_clues=True):
    """Draw a nonogram-looking board with the picture inside `box`."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    n = len(rows)
    clue = (x1 - x0) * 0.16 if with_clues else 0
    cs = (x1 - x0 - clue) / n
    gx, gy = x0 + clue, y0 + clue
    # paper
    d.rounded_rectangle(box, radius=int((x1 - x0) * 0.08), fill=PAPER)
    # clue strips
    if with_clues:
        d.rectangle((x0, gy, gx, y1), fill=(236, 232, 222))
        d.rectangle((gx, y0, x1, gy), fill=(236, 232, 222))
        # fake clue dots
        for i in range(n):
            cx = gx + cs * i + cs / 2
            d.ellipse((cx - cs * 0.12, y0 + clue * 0.5 - cs * 0.12, cx + cs * 0.12, y0 + clue * 0.5 + cs * 0.12), fill=(140, 145, 160))
            cy = gy + cs * i + cs / 2
            d.ellipse((x0 + clue * 0.5 - cs * 0.12, cy - cs * 0.12, x0 + clue * 0.5 + cs * 0.12, cy + cs * 0.12), fill=(140, 145, 160))
    # cells
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch == "#":
                p = cs * 0.1
                d.rounded_rectangle((gx + x * cs + p, gy + y * cs + p, gx + (x + 1) * cs - p, gy + (y + 1) * cs - p), radius=int(cs * 0.15), fill=INK)
    # grid
    for i in range(n + 1):
        w = 3 if i % 5 == 0 else 1
        col = (143, 148, 163) if i % 5 == 0 else GRID
        d.line((gx + i * cs, y0, gx + i * cs, y1), fill=col, width=w)
        d.line((x0, gy + i * cs, x1, gy + i * cs), fill=col, width=w)


def make_icon(size, rounded=True, with_board_margin=0.12):
    img = gradient(size, BG_TOP, BG_BOT)
    m = int(size * with_board_margin)
    draw_board(img, (m, m, size - m, size - m), HEART)
    if rounded:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.18), fill=255)
        out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask)
        return out
    return img.convert("RGBA")


def main():
    # Project icon (Godot) – rounded, transparent corners are fine here.
    make_icon(512).save(os.path.join(ROOT, "icon.png"))
    # RuStore store icon must be fully opaque with no transparent edges.
    make_icon(512, rounded=False).convert("RGB").save(os.path.join(ROOT, "store", "icon_512.png"))
    # Adaptive icon: background = gradient, foreground = board centred in safe zone (66% of 432).
    size = 432
    bg = gradient(size, BG_TOP, BG_BOT).convert("RGBA")
    bg.save(os.path.join(ROOT, "assets", "icons", "adaptive_background.png"))
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    m = int(size * 0.24)
    draw_board(fg, (m, m, size - m, size - m), HEART)
    fg.save(os.path.join(ROOT, "assets", "icons", "adaptive_foreground.png"))
    print("icons written")


if __name__ == "__main__":
    main()
