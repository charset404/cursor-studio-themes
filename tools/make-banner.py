# Executado uma vez: gera docs/banner.png para o README.
#   python tools/make-banner.py
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1280, 400


def font(size: int) -> ImageFont.FreeTypeFont:
    for name in ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    image = Image.new("RGB", (W, H), (0x0B, 0x0B, 0x0D))
    draw = ImageDraw.Draw(image)

    # Grade sutil de fundo.
    for x in range(0, W, 32):
        draw.line([(x, 0), (x, H)], fill=(0x12, 0x12, 0x16))
    for y in range(0, H, 32):
        draw.line([(0, y), (W, y)], fill=(0x12, 0x12, 0x16))

    # Dois halos: azul e violeta, borrados para virar luz.
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([-160, -120, 520, 380], fill=(0x7C, 0x9C, 0xFF, 54))
    gdraw.ellipse([760, 40, 1240, 480], fill=(0x8B, 0x5C, 0xF6, 46))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw = ImageDraw.Draw(image)

    # Sete cursores, um por "tema", desenhados à esquerda.
    palette = [(0x7C, 0x9C, 0xFF), (0x8B, 0x5C, 0xF6), (0x22, 0xC5, 0x5E),
               (0xF5, 0xB0, 0x42), (0xF4, 0x72, 0x6E), (0x38, 0xBD, 0xF8),
               (0xE8, 0xE8, 0xEB)]
    for index, colour in enumerate(palette[:6]):
        cx, cy = 80 + index * 52, 300 - int(24 * math.sin(index * 1.1))
        draw.polygon(
            [(cx, cy - 26), (cx, cy + 14), (cx + 9, cy + 5), (cx + 16, cy + 18),
             (cx + 22, cy + 14), (cx + 15, cy + 2), (cx + 26, cy + 2)],
            fill=(255, 255, 255), outline=(10, 10, 12),
        )
        draw.ellipse([cx + 2, cy - 30, cx + 10, cy - 22], fill=colour)

    draw.text((400, 118), "Cursor Studio", font=font(76), fill=(255, 255, 255))
    draw.text((402, 212), "BIBLIOTECA ONLINE", font=font(30), fill=(0x9A, 0x9A, 0xA5))
    draw.text((402, 262), "Temas de cursor para Windows, curados pela comunidade.",
              font=font(22), fill=(0x6E, 0x6E, 0x7A))

    # Filete de acento embaixo do título.
    draw.rectangle([400, 204, 400 + 208, 207], fill=(0x7C, 0x9C, 0xFF))

    target = ROOT / "docs" / "banner.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(target, optimize=True)
    print(f"{target.relative_to(ROOT)}  {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
