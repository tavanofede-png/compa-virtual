"""Compose the 16:9 golden retriever character sheet from Blender renders."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / "renders/golden-stylized"
OUT = STAGE / "miel-character-sheet.png"
PAPER = (244, 236, 224, 255)
INK = (42, 32, 24, 255)
MUTED = (110, 92, 74, 255)
RULE = (214, 200, 182, 255)

W, H = 2560, 1440


def font(size, bold=False):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)


def load(name):
    return Image.open(STAGE / name).convert("RGBA")


def contain(img, box, anchor="center"):
    bw, bh = box[2], box[3]
    scale = min(bw / img.width, bh / img.height)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    resized = img.resize(size, Image.Resampling.LANCZOS)
    x = box[0] + (bw - size[0]) // 2
    y = box[1] + (bh - size[1]) // 2
    if anchor == "bottom":
        y = box[1] + bh - size[1]
    return resized, (x, y)


def label(draw, text, xy, size=22, bold=False, fill=MUTED):
    draw.text(xy, text, font=font(size, bold), fill=fill)


def main():
    sheet = Image.new("RGBA", (W, H), PAPER)
    draw = ImageDraw.Draw(sheet)

    draw.rectangle((0, 0, W, 96), fill=(238, 228, 214, 255))
    draw.line((48, 96, W - 48, 96), fill=RULE, width=2)
    label(draw, "COMPA VIRTUAL", (56, 22), 20, True, MUTED)
    label(draw, "MIEL", (56, 46), 36, True, INK)
    label(draw, "Golden retriever  ·  mascota stylized 3D premium", (220, 58), 22, False, MUTED)
    label(draw, "Anatomía orgánica  ·  pelaje en mechones  ·  sin voxel", (1680, 54), 20, False, MUTED)

    hero, pos = contain(load("hero.png"), (24, 110, 1120, 1180))
    sheet.alpha_composite(hero, pos)
    label(draw, "VISTA HERO  ·  3/4", (56, 1310), 20, True)

    turn = [("front.png", "FRENTE"), ("side.png", "PERFIL"), ("back.png", "ESPALDA"), ("three-quarter.png", "3/4")]
    for i, (name, caption) in enumerate(turn):
        x = 1160 + (i % 4) * 340
        img, pos = contain(load(name), (x, 120, 320, 320))
        sheet.alpha_composite(img, pos)
        label(draw, caption, (x + 12, 444), 18, True)

    face, pos = contain(load("face.png"), (1160, 480, 700, 420))
    sheet.alpha_composite(face, pos)
    label(draw, "ROSTRO", (1172, 900), 18, True)

    draw.rounded_rectangle((1888, 500, 2508, 900), radius=18, outline=RULE, width=2)
    notes = [
        "Joven, noble y compañero.",
        "Hocico medio, orejas caídas.",
        "Pelaje crema–miel con ruff,",
        "pluma en cola y plumas en patas.",
        "Expresión cálida y tranquila,",
        "lista para convivir en el estudio.",
    ]
    label(draw, "DIRECCIÓN", (1910, 518), 18, True, INK)
    for i, line in enumerate(notes):
        label(draw, line, (1910, 558 + i * 46), 22, False, INK)

    poses = [
        ("pose-sit.png", "SENTADO"),
        ("pose-rest.png", "DESCANSANDO"),
        ("pose-trot.png", "TROTANDO"),
        ("pose-play.png", "JUGANDO"),
        ("pose-lookup.png", "MIRANDO ARRIBA"),
    ]
    for i, (name, caption) in enumerate(poses):
        x = 1160 + i * 272
        img, pos = contain(load(name), (x, 940, 260, 360))
        sheet.alpha_composite(img, pos)
        label(draw, caption, (x + 8, 1310), 16, True)

    draw.line((48, 1368, W - 48, 1368), fill=RULE, width=1)
    label(draw, "Lámina de personaje para modelado, rig e integración  ·  fondo de estudio, sin habitación", (56, 1382), 18)

    rgb = Image.new("RGB", sheet.size, PAPER[:3])
    rgb.paste(sheet, mask=sheet.split()[-1])
    rgb.save(OUT, "PNG", optimize=True)
    print("SHEET", OUT, rgb.size)


if __name__ == "__main__":
    main()
