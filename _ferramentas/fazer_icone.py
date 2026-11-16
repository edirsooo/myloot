"""Gera o ícone da Mochila (icon.ico + public/icon.png).

Uso:
  python fazer_icone.py              -> ícone padrão (cubo voxel)
  python fazer_icone.py foto.png     -> recorta do peito para cima, tira o fundo e põe num quadrado
                                         arredondado com degradê roxo e brilhinhos
"""
import os, random, sys, math
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
S = 1024


def degrade(size):
    img = Image.new("RGB", (size, size))
    px = img.load()
    c1, c2 = (255, 126, 0), (124, 58, 237)
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y * 0.65) / size
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t * 0.85) for i in range(3))
    return img


def brilhos(img, n=14):
    d = ImageDraw.Draw(img)
    random.seed(7)
    for _ in range(n):
        x, y = random.randint(60, S - 60), random.randint(60, S - 60)
        r = random.choice([10, 14, 20, 28])
        d.polygon([(x, y - r * 2), (x + r // 2, y - r // 2), (x + r * 2, y), (x + r // 2, y + r // 2),
                   (x, y + r * 2), (x - r // 2, y + r // 2), (x - r * 2, y), (x - r // 2, y - r // 2)], fill=(255, 255, 255, 200))


def cubo(img):
    d = ImageDraw.Draw(img)
    cx, cy, s = S // 2, S // 2 + 30, 300
    d.polygon([(cx, cy - s), (cx + s, cy - s // 2), (cx, cy), (cx - s, cy - s // 2)], fill=(255, 255, 255, 255))
    d.polygon([(cx - s, cy - s // 2), (cx, cy), (cx, cy + s), (cx - s, cy + s // 2)], fill=(255, 214, 170, 255))
    d.polygon([(cx + s, cy - s // 2), (cx, cy), (cx, cy + s), (cx + s, cy + s // 2)], fill=(200, 96, 0, 255))
    for p in [[(cx, cy - s), (cx + s, cy - s // 2), (cx, cy), (cx - s, cy - s // 2)], [(cx - s, cy - s // 2), (cx, cy), (cx, cy + s), (cx - s, cy + s // 2)], [(cx + s, cy - s // 2), (cx, cy), (cx, cy + s), (cx + s, cy + s // 2)]]:
        d.line(p + [p[0]], fill=(60, 26, 0, 255), width=14, joint="curve")


def pessoa(img, caminho):
    from rembg import remove
    foto = Image.open(caminho).convert("RGBA")
    foto = remove(foto)
    bb = foto.getbbox()
    foto = foto.crop(bb)
    w, h = foto.size
    foto = foto.crop((0, 0, w, int(h * 0.55)))  # do peito para cima
    alvo = int(S * 0.86)
    esc = min(alvo / foto.width, alvo / foto.height)
    foto = foto.resize((int(foto.width * esc), int(foto.height * esc)), Image.LANCZOS)
    img.alpha_composite(foto, ((S - foto.width) // 2, S - foto.height - 40))


def main():
    base = degrade(S).convert("RGBA")
    brilhos(base)
    if len(sys.argv) > 1:
        pessoa(base, sys.argv[1])
    else:
        cubo(base)
    base2 = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * 0.22), fill=255)
    base2.paste(base, (0, 0), mask)
    os.makedirs(os.path.join(RAIZ, "public"), exist_ok=True)
    base2.resize((256, 256), Image.LANCZOS).save(os.path.join(RAIZ, "public", "icon.png"))
    base2.save(os.path.join(RAIZ, "Mochila.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("Ícone gerado.")


main()
