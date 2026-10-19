"""Gera os cursores e o preview do tema de exemplo.

Um .cur é um cabeçalho de 6 bytes seguido de um diretório de 16 bytes por
imagem, e depois dos dados. Cada imagem tem um BITMAPINFOHEADER de 40 bytes com
altura dobrada (a máscara AND vai depois dos pixels), então um cursor 32x32 com
alpha vira 40 + 32*32*4 + 32*32/8 bytes.

    python tools/make-example-theme.py
"""

import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "themes" / "example-aurora"
OUT = THEME / "cursors"


def cursor_bytes(image: Image.Image) -> bytes:
    rgba = image.convert("RGBA")
    width, height = rgba.size

    # Tipo 1 = .cur (ícone de cursor), tipo 2 = .ani. Estes são estáticos.
    header = struct.pack("<HHH", 0, 1, 1)  # reservado, tipo, uma imagem
    entry = struct.pack(
        "<BBBBHHII",
        width if width < 256 else 0,
        height if height < 256 else 0,
        0,  # cores na paleta
        0,  # reservado
        1,  # pontos de espera: 1 para .cur
        32,  # bits por pixel
        width * height * 4 + height * (width // 8) + 40,
        len(header) + 16,
    )

    pixels = rgba.tobytes("raw", "BGRA", rgba.width * 4, -1)

    bitmap_header = struct.pack(
        "<IiiHHIIiiII",
        40,  # tamanho do BITMAPINFOHEADER
        width,
        height * 2,  # dobro da altura por causa da máscara
        1,  # planos
        32,  # bits por pixel
        0,  # BI_RGB
        len(pixels) + height * (width // 8),  # tamanho da imagem
        0,
        0,
        0,
        0,
    )

    # Máscara AND: sobreposta ao alpha; 0 significa "mostrar o pixel".
    mask = b"\x00" * (height * (width // 8))

    return header + entry + bitmap_header + pixels + mask


def draw_pointer(accent: tuple[int, int, int], kind: str) -> Image.Image:
    """Um ponteiro de 32x32 desenhado à mão, só para o exemplo parecer real."""
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    white, ink = (255, 255, 255, 255), (18, 18, 22, 255)

    if kind == "arrow":
        points = [(8, 4), (8, 26), (13, 21), (17, 29), (21, 27), (17, 19), (24, 19)]
        draw.polygon(points, fill=white, outline=ink)
        draw.line(points + [points[0]], fill=ink, width=1)
    elif kind == "hand":
        draw.rounded_rectangle([11, 6, 15, 22], radius=2, fill=white, outline=ink)
        draw.rounded_rectangle([15, 9, 19, 22], radius=2, fill=white, outline=ink)
        draw.rounded_rectangle([19, 12, 23, 22], radius=2, fill=white, outline=ink)
        draw.rounded_rectangle([9, 13, 11, 20], radius=2, fill=white, outline=ink)
        draw.rounded_rectangle([9, 18, 23, 25], radius=3, fill=white, outline=ink)
    else:  # busy
        draw.ellipse([7, 7, 25, 25], outline=accent, width=3)
        draw.arc([7, 7, 25, 25], 200, 340, fill=white, width=3)

    draw.ellipse([3, 3, 6, 6], fill=accent)
    return image


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    accent = (0x7C, 0x9C, 0xFF)

    for name, kind in [("normal", "arrow"), ("link", "hand"), ("busy", "busy")]:
        image = draw_pointer(accent, kind)
        target = OUT / f"{name}.cur"
        target.write_bytes(cursor_bytes(image))
        print(f"{target.relative_to(ROOT)}  {target.stat().st_size} bytes")

    # Preview do cartão: fundo escuro, os três cursores lado a lado.
    preview = Image.new("RGBA", (640, 360), (0x0B, 0x0B, 0x0B, 255))
    canvas = ImageDraw.Draw(preview)
    for x in range(0, 640, 40):
        canvas.line([(x, 0), (x, 360)], fill=(0x14, 0x14, 0x16, 255))
    for y in range(0, 360, 40):
        canvas.line([(0, y), (640, y)], fill=(0x14, 0x14, 0x16, 255))

    glow = Image.new("RGBA", preview.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([200, 40, 440, 320], fill=(0x7C, 0x9C, 0xFF, 42))
    preview = Image.alpha_composite(preview, glow)

    for index, (name, kind) in enumerate([("normal", "arrow"), ("link", "hand"), ("busy", "busy")]):
        icon = draw_pointer(accent, kind).resize((96, 96), Image.NEAREST)
        preview.alpha_composite(icon, (140 + index * 150, 130))

    target = THEME / "preview.png"
    preview.convert("RGB").save(target, optimize=True)
    print(f"{target.relative_to(ROOT)}  {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
