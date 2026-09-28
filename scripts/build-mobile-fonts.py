"""Derive Android-compatible Outfit faces from the existing licensed master.

Requires fontTools. Generated TTFs are versioned; EAS needs no Python tooling.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
source = root / "apps/web/public/fonts/Outfit.ttf"
destination = root / "apps/mobile/assets/fonts"
destination.mkdir(parents=True, exist_ok=True)
for label, weight in [("Regular", 400), ("Medium", 500), ("SemiBold", 600), ("Bold", 700), ("ExtraBold", 800)]:
    font = instantiateVariableFont(TTFont(source), {"wght": weight}, inplace=True)
    # Give each static face its own native name; the UI selects the face directly.
    for record in font["name"].names:
        value = {1: f"Outfit {label}", 2: "Regular", 4: f"Outfit {label}",
                 6: f"Outfit-{label}", 16: f"Outfit {label}", 17: "Regular"}.get(record.nameID)
        if value is not None:
            record.string = value.encode(record.getEncoding())
    font.save(destination / f"Outfit-{label}.ttf")
    assert "fvar" not in font
    print(f"Outfit-{label}.ttf: static weight {font['OS/2'].usWeightClass}")
