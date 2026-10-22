"""Gera o efeito de exemplo (effects/example-aurora-click) e o preview dele.

Um efeito é UM arquivo .bgra: quadros quadrados de 32 bits BGRA com alpha
PRÉ-MULTIPLICADO, um depois do outro, sem cabeçalho. Este script é a referência
executável do formato — copie e troque o desenho.

    python tools/make-example-effect.py
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / "effects" / "example-aurora-click"
EDGE = 128
FRAMES = 24
ACCENT = (0x7C, 0x9C, 0xFF)


def frame(index: int) -> Image.Image:
    """Um anel que se abre e some (alpha cai com o progresso)."""
    progress = index / (FRAMES - 1)
    radius = 6 + progress * 52
    alpha = int(255 * (1 - progress) ** 1.5)
    size = EDGE * 4  # desenha grande e reduz: borda suave
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    centre = size / 2
    r = radius * 4
    draw.ellipse(
        (centre - r, centre - r, centre + r, centre + r),
        outline=(*ACCENT, alpha),
        width=max(1, int(10 - 6 * progress)),
    )
    return image.resize((EDGE, EDGE), Image.LANCZOS)


def to_bgra_premultiplied(image: Image.Image) -> bytes:
    out = bytearray()
    for r, g, b, a in image.getdata():
        out += bytes((b * a // 255, g * a // 255, r * a // 255, a))
    return bytes(out)


def main() -> None:
    FOLDER.mkdir(parents=True, exist_ok=True)
    frames = [frame(i) for i in range(FRAMES)]
    data = b"".join(to_bgra_premultiplied(f) for f in frames)
    assert len(data) == FRAMES * EDGE * EDGE * 4
    (FOLDER / "effect.bgra").write_bytes(data)

    # Preview 640×360: a sequência lado a lado sobre o fundo do app.
    preview = Image.new("RGBA", (640, 360), (0x0B, 0x0B, 0x0B, 255))
    for slot, index in enumerate((0, 6, 12, 18)):
        tile = Image.new("RGBA", (EDGE, EDGE), (0x14, 0x14, 0x14, 255))
        tile.alpha_composite(frames[index])
        preview.alpha_composite(tile.resize((136, 136), Image.LANCZOS), (50 + slot * 140, 112))
    preview.convert("RGB").save(FOLDER / "preview.png", optimize=True)

    meta = {
        "slug": "example-aurora-click",
        "name": "Aurora Click",
        "author": "Cursor Studio",
        "description": "Efeito de exemplo: um anel que se abre no clique. Documenta o formato de efeitos.",
        "version": "1.0.0",
        "license": "MIT",
        "tags": ["exemplo", "template"],
        "preview": "preview.png",
        "accent": "#7c9cff",
        "effect": {"file": "effect.bgra", "frames": FRAMES, "width": EDGE, "height": EDGE},
        "links": [{"slug": "example-aurora", "relation": "recommends"}],
    }
    (FOLDER / "effect.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
