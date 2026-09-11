#!/usr/bin/env python3
"""Generate Tabrary toolbar icons with stdlib only (no Pillow, no design tool).
Run: python3 tools/make-icons.py
"""
import struct
import zlib
from pathlib import Path

BG = (0xFF, 0xD2, 0x3F)
FG = (0x0A, 0x0A, 0x0A)
SS = 4  # supersample factor for cheap antialiasing


def in_bg(u: float, v: float, r: float = 0.06) -> bool:
    dx = max(r - u, u - (1 - r), 0.0)
    dy = max(r - v, v - (1 - r), 0.0)
    return dx * dx + dy * dy <= r * r


def in_funnel(u: float, v: float) -> bool:
    top, bottom, stem = 0.26, 0.62, 0.78
    if top <= v <= bottom:
        half = 0.34 + (0.06 - 0.34) * ((v - top) / (bottom - top))
        return abs(u - 0.5) <= half
    if bottom < v <= stem:
        return abs(u - 0.5) <= 0.045
    return False


def render(size: int) -> bytes:
    rows = bytearray()
    for y in range(size):
        for x in range(size):
            bg_hits = fg_hits = total = 0
            for sy in range(SS):
                for sx in range(SS):
                    u = (x + (sx + 0.5) / SS) / size
                    v = (y + (sy + 0.5) / SS) / size
                    total += 1
                    if in_bg(u, v):
                        bg_hits += 1
                        if in_funnel(u, v):
                            fg_hits += 1
            if not bg_hits:
                rows += bytes((0, 0, 0, 0))
                continue
            alpha = round(255 * bg_hits / total)
            t = fg_hits / bg_hits
            color = tuple(round(BG[i] + (FG[i] - BG[i]) * t) for i in range(3))
            rows += bytes((*color, alpha))
    return bytes(rows)


def write_png(path: Path, size: int, rgba: bytes) -> None:
    raw = b"".join(b"\x00" + rgba[y * size * 4 : (y + 1) * size * 4] for y in range(size))

    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "extension" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(out / f"icon{size}.png", size, render(size))
        print(f"{out / f'icon{size}.png'} {size}x{size}")
