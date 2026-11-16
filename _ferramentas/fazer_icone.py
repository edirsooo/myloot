"""Gera o ícone do MyLoot (MyLoot.ico + public/icon.png): baú em pixel-art no fundo branco com brilho laranja.

Uso:  python _ferramentas/fazer_icone.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
S = 1024

P = {
    '.': None,
    'k': (34, 14, 4),      # contorno
    'w': (122, 52, 14),    # madeira
    'W': (168, 80, 24),    # madeira clara
    'd': (84, 32, 8),      # madeira escura
    'o': (255, 126, 0),    # laranja Prestes
    'O': (255, 176, 60),   # laranja claro
    'r': (196, 82, 0),     # laranja escuro
    'g': (255, 214, 64),   # ouro
    'y': (255, 248, 210),  # brilho
}
BAU = [
    "......................",
    "....kkkkkkkkkkkkkk....",
    "...kOOkWWWWWWWWkOOk...",
    "..kOookWWWWWWWWkoook..",
    "..kookwwwwwwwwwwkook..",
    "..kookwwwwwwwwwwkook..",
    "..kkkkkkkkkkkkkkkkkk..",
    "..krrrrrrrkkkkrrrrrk..",
    "..kkkkkkkkgyykkkkkkk..",
    "..kOokWWWkgggkWWWkOk..",
    "..kookwwwkgkgkwwwkok..",
    "..kookwwwwkkkwwwwkok..",
    "..kookwwwwwwwwwwwkok..",
    "..kookwwwwwwwwwwwkok..",
    "..kOokddddddddddddOk..",
    "..kkkkkkkkkkkkkkkkkk..",
    "......................",
]


def pix(grid, cell):
    h, w = len(grid), len(grid[0])
    im = Image.new('RGBA', (w * cell, h * cell), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            if P[ch]:
                d.rectangle((x * cell, y * cell, x * cell + cell - 1, y * cell + cell - 1), fill=P[ch])
    return im


def icone():
    c1, c2 = (255, 255, 255), (238, 236, 244)
    bg = Image.new('RGBA', (S, S))
    px = bg.load()
    for y in range(S):
        for x in range(S):
            t = (x * .3 + y * .7) / S
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((180, 180, 844, 844), fill=(255, 150, 40, 60))
    bg.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((210, 760, 814, 840), fill=(0, 0, 0, 90))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(14)))
    ch = pix(BAU, 36)
    bg.alpha_composite(ch, ((S - ch.width) // 2, (S - ch.height) // 2 + 10))
    d = ImageDraw.Draw(bg)
    for x, y, r in [(800, 250, 9), (220, 300, 6), (850, 520, 5)]:
        d.rectangle((x - r, y - r * 3, x + r, y + r * 3), fill=(255, 166, 40))
        d.rectangle((x - r * 3, y - r, x + r * 3, y + r), fill=(255, 166, 40))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * .22), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(bg, (0, 0), mask)
    return out


def main():
    img = icone()
    os.makedirs(os.path.join(RAIZ, 'public'), exist_ok=True)
    img.resize((256, 256), Image.LANCZOS).save(os.path.join(RAIZ, 'public', 'icon.png'))
    # baú sozinho (sem fundo) para a marca na barra lateral
    pix(BAU, 4).save(os.path.join(RAIZ, 'public', 'bau.png'))
    img.save(os.path.join(RAIZ, 'MyLoot.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    img.save(os.path.join(RAIZ, 'docs', 'img', 'logo.png'))
    print('Ícone gerado.')


main()
