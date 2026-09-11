#!/usr/bin/env python3
"""Design checks for the side panel. Run: python3 tools/contrast.py
1. WCAG contrast on every text pair, both themes.
2. Dark theme must override every colour token — no silent fall-through.
Parses the real tokens out of extension/sidepanel.css.
"""
import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "extension" / "sidepanel.css"
AA_NORMAL = 4.5


def tokens(block: str) -> dict[str, str]:
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{3,8})", block))


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    channels = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255
        channels.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    r, g, b = channels
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def check_theme_completeness(light: dict[str, str], dark: dict[str, str]) -> bool:
    missing = sorted(set(light) - set(dark))
    if missing:
        print("\nFAIL dark theme does not override:", ", ".join(f"--{m}" for m in missing))
        return False
    print("\nok   dark theme overrides every colour token")
    return True


def check_class_coverage() -> bool:
    """A class used in the real DOM but missing from the stylesheet renders unstyled.
    This is how the preview harness and the panel drifted apart once already."""
    root = CSS.parent.parent
    html = (root / "extension" / "sidepanel.html").read_text()
    js = (root / "extension" / "sidepanel.js").read_text()
    preview = (root / "tools" / "preview.html").read_text()
    css = CSS.read_text()

    used: set[str] = set()
    for attr in re.findall(r'class="([^"]+)"', html):
        used.update(attr.split())
    for attr in re.findall(r'class="([^"]+)"', preview):
        used.update(attr.split())
    for expr in re.findall(r"className:\s*([^,\n]+)", js):
        for literal in re.findall(r"'([^']*)'", expr):
            used.update(literal.split())

    defined = set(re.findall(r"\.([a-zA-Z][\w-]*)", css))
    missing = sorted(used - defined)
    if missing:
        print("\nFAIL no CSS rule for class:", ", ".join(f".{m}" for m in missing))
        return False
    print(f"ok   {len(used)} classes used by html/js/preview all have CSS rules")

    # the harness must not invent UI the panel cannot render (Resume once drifted:
    # cyan in the preview, plain in the panel)
    app_used: set[str] = set()
    for attr in re.findall(r'class="([^"]+)"', html):
        app_used.update(attr.split())
    for expr in re.findall(r"className:\s*([^,\n]+)", js):
        for literal in re.findall(r"'([^']*)'", expr):
            app_used.update(literal.split())
    invented = sorted({c for a in re.findall(r'class="([^"]+)"', preview) for c in a.split()} - app_used)
    if invented:
        print("\nFAIL preview.html shows classes the panel never renders:", ", ".join(invented))
        return False
    print("ok   preview.html only uses classes the panel renders")
    return True


def check_interactions() -> bool:
    """Every interactive control in the markup must have a listener in the code.
    The theme button shipped wired to nothing once; this catches that."""
    root = CSS.parent.parent
    html = (root / "extension" / "sidepanel.html").read_text()
    js = (root / "extension" / "sidepanel.js").read_text()

    controls = re.findall(r'<button id="([\w-]+)"', html) + re.findall(
        r'<input id="([\w-]+)"', html
    )
    unwired = [c for c in controls if f"$('{c}').addEventListener" not in js]
    if unwired:
        print("\nFAIL no listener wired for:", ", ".join(f"#{c}" for c in unwired))
        return False
    print(f"ok   all {len(controls)} interactive controls have listeners")
    return True


def check_hidden_rule() -> bool:
    """An author `display` on a class overrides the UA [hidden] rule, so the panel
    needs an explicit [hidden] { display: none }. Without it the save form renders
    on load instead of waiting for the button click."""
    css = CSS.read_text()
    if not re.search(r"\[hidden\]\s*\{[^}]*display:\s*none", css):
        print("\nFAIL missing [hidden] { display: none } — hidden elements will show")
        return False
    print("ok   [hidden] rule present")
    return True


def check_font_scale() -> bool:
    """Every font-size must come from the scale in :root, so sizes cannot drift
    apart one declaration at a time (the input used to inherit and read small)."""
    css = CSS.read_text()
    root = re.search(r":root\s*\{(.*?)\}", css, re.S).group(1)
    body = css.replace(root, "")
    values = [v.strip() for v in re.findall(r"font-size:\s*([^;]+);", body)]
    raw = [v for v in values if not v.startswith("var(")]
    if raw:
        print("\nFAIL raw font-size outside the scale:", ", ".join(raw))
        return False

    scale = dict(re.findall(r"--(fs-[\w-]+):\s*(\d+px)", root))
    print(f"ok   font scale: {', '.join(f'{k}={v}' for k, v in scale.items())}")
    return True


def main() -> int:
    css = CSS.read_text()
    light = tokens(re.search(r":root\s*\{(.*?)\}", css, re.S).group(1))
    dark_block = re.search(r':root\[data-theme="dark"\]\s*\{(.*?)\}', css, re.S).group(1)
    dark = {**light, **tokens(dark_block)}

    # (foreground, background, minimum) — muted carries small text, so it must pass AA.
    pairs = [
        ("fg", "bg", AA_NORMAL),
        ("fg", "surface", AA_NORMAL),
        ("muted", "bg", AA_NORMAL),
        ("muted", "surface", AA_NORMAL),
        ("primary-fg", "primary", AA_NORMAL),
        ("cyan-fg", "cyan", AA_NORMAL),
        ("danger-fg", "danger", AA_NORMAL),
    ]

    failed = False
    for theme, palette in (("light", light), ("dark", dark)):
        print(f"\n{theme}:")
        for fg, bg, minimum in pairs:
            r = ratio(palette[fg], palette[bg])
            ok = r >= minimum
            failed |= not ok
            print(f"  {'ok  ' if ok else 'FAIL'} {fg:11s} on {bg:8s} {r:5.2f}:1  (need {minimum})")

    failed |= not check_theme_completeness(light, tokens(dark_block))
    failed |= not check_class_coverage()
    failed |= not check_interactions()
    failed |= not check_hidden_rule()
    failed |= not check_font_scale()
    print()
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
