#!/usr/bin/env python3
"""Gera fontes/Simbolos.ttf: os símbolos que as fontes do jogo não têm (desenho próprio).
No computador e no Android o sistema completa o que falta; no navegador não, e eles viravam quadradinhos.
Uso (na pasta godot/): python ferramentas/fonte_simbolos.py"""
import math, os, struct

def area(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2

def fora(p):   # contorno cheio: sentido horário (y para cima)
    return p if area(p) < 0 else p[::-1]

def furo(p):   # buraco: sentido contrário
    return fora(p)[::-1]

def circulo(cx, cy, r, n=28):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]

def estrela(cx, cy, grande, pequeno):
    return [(cx + (grande if i % 2 == 0 else pequeno) * math.cos(math.pi / 2 + i * math.pi / 5),
             cy + (grande if i % 2 == 0 else pequeno) * math.sin(math.pi / 2 + i * math.pi / 5)) for i in range(10)]

def caixa(x0, y0, x1, y1):
    return [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]

SETA = [(70, 295), (450, 295), (450, 140), (730, 350), (450, 560), (450, 405), (70, 405)]

# código: (largura, contornos)
GLIFOS = {
    0x2190: (800, [fora([(800 - x, y) for x, y in SETA])]),
    0x2192: (800, [fora(SETA)]),
    0x25A0: (800, [fora(caixa(110, 60, 690, 640))]),
    0x25A3: (800, [fora(caixa(90, 40, 710, 660)), furo(caixa(180, 130, 620, 570)), fora(caixa(270, 220, 530, 480))]),
    0x25B2: (820, [fora([(70, 60), (410, 660), (750, 60)])]),
    0x25B6: (800, [fora([(150, 40), (150, 660), (720, 350)])]),
    0x25BC: (820, [fora([(70, 640), (750, 640), (410, 40)])]),
    0x25C6: (800, [fora([(400, 690), (700, 350), (400, 10), (100, 350)])]),
    0x25CB: (800, [fora(circulo(400, 350, 300)), furo(circulo(400, 350, 215))]),
    0x25CF: (800, [fora(circulo(400, 350, 300))]),
    0x2605: (860, [fora(estrela(430, 345, 405, 165))]),
    0x2606: (860, [fora(estrela(430, 345, 405, 165)), furo(estrela(430, 345, 255, 104))]),
    0x2691: (800, [fora(caixa(140, 0, 220, 720)), fora([(220, 700), (750, 590), (540, 470), (750, 340), (220, 350)])]),
    0x26A0: (840, [fora([(420, 740), (825, 30), (15, 30)]), furo([(364, 510), (476, 510), (454, 245), (386, 245)]), furo(caixa(376, 100, 464, 188))]),
    0x2714: (840, [fora([(80, 360), (205, 485), (340, 350), (650, 665), (775, 545), (340, 95)])]),
}

def glifo(contornos):
    pontos = [(round(x), round(y)) for c in contornos for x, y in c]
    xs, ys = [p[0] for p in pontos], [p[1] for p in pontos]
    d = struct.pack('>hhhhh', len(contornos), min(xs), min(ys), max(xs), max(ys))
    fim = -1
    for c in contornos:
        fim += len(c)
        d += struct.pack('>H', fim)
    d += struct.pack('>H', 0) + bytes([1] * len(pontos))   # todos na curva, coordenadas inteiras
    for eixo in (0, 1):
        antes = 0
        for p in pontos:
            d += struct.pack('>h', p[eixo] - antes)
            antes = p[eixo]
    return d + b'\0' * (len(d) % 2), (min(xs), min(ys), max(xs), max(ys)), len(pontos)

codigos = sorted(GLIFOS)
dados, caixas, npontos, ncont, larguras = [b''], [], [0], [0], [(500, 0)]
for c in codigos:
    larg, cont = GLIFOS[c]
    d, bb, n = glifo(cont)
    dados.append(d); caixas.append(bb); npontos.append(n); ncont.append(len(cont)); larguras.append((larg, bb[0]))
total = len(dados)
glyf = b''.join(dados)
posicoes, p = [], 0
for d in dados:
    posicoes.append(p); p += len(d)
posicoes.append(p)
loca = struct.pack('>%dI' % len(posicoes), *posicoes)
bx = (min(b[0] for b in caixas), min(b[1] for b in caixas), max(b[2] for b in caixas), max(b[3] for b in caixas))

# cmap formato 4: um trecho por símbolo, mais o trecho final obrigatório
seg = [(c, c, (i + 1 - c) & 0xFFFF) for i, c in enumerate(codigos)] + [(0xFFFF, 0xFFFF, 1)]
n = len(seg)
pot = 2 ** int(math.log2(n))
sub = struct.pack('>HHHHHHH', 4, 16 + 8 * n, 0, 2 * n, 2 * pot, int(math.log2(pot)), 2 * n - 2 * pot)
sub += b''.join(struct.pack('>H', s[1]) for s in seg) + b'\0\0'
sub += b''.join(struct.pack('>H', s[0]) for s in seg) + b''.join(struct.pack('>H', s[2]) for s in seg) + b'\0\0' * n
cmap = struct.pack('>HHHHI', 0, 1, 3, 1, 12) + sub

nomes = {1: 'FL Simbolos', 2: 'Regular', 4: 'FL Simbolos', 6: 'FLSimbolos'}
registros, textos = b'', b''
for k in sorted(nomes):
    t = nomes[k].encode('utf-16-be')
    registros += struct.pack('>HHHHHH', 3, 1, 0x409, k, len(t), len(textos)); textos += t
name = struct.pack('>HHH', 0, len(nomes), 6 + len(registros)) + registros + textos

head = struct.pack('>IIIIHHqqhhhhHHhhh', 0x00010000, 0x00010000, 0, 0x5F0F3CF5, 3, 1000, 0, 0, *bx, 0, 8, 2, 1, 0)
hhea = struct.pack('>IhhhHhhhhhhhhhhhH', 0x00010000, 800, -200, 0, max(l for l, _ in larguras), 0, 0, bx[2], 1, 0, 0, 0, 0, 0, 0, 0, total)
maxp = struct.pack('>IH13H', 0x00010000, total, max(npontos), max(ncont), 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
hmtx = b''.join(struct.pack('>Hh', *x) for x in larguras)
post = struct.pack('>IIhhIIIII', 0x00030000, 0, -100, 50, 0, 0, 0, 0, 0)
tabelas = {b'cmap': cmap, b'glyf': glyf, b'head': head, b'hhea': hhea, b'hmtx': hmtx, b'loca': loca, b'maxp': maxp, b'name': name, b'post': post}

def soma(b):
    b += b'\0' * (-len(b) % 4)
    return sum(struct.unpack('>%dI' % (len(b) // 4), b)) & 0xFFFFFFFF

nt = len(tabelas)
pot = 2 ** int(math.log2(nt))
arquivo = struct.pack('>IHHHH', 0x00010000, nt, pot * 16, int(math.log2(pot)), nt * 16 - pot * 16)
onde = 12 + 16 * nt
corpo = b''
for tag in sorted(tabelas):
    t = tabelas[tag]
    arquivo += struct.pack('>4sIII', tag, soma(t), onde + len(corpo), len(t))
    corpo += t + b'\0' * (-len(t) % 4)
arquivo += corpo
ajuste = (0xB1B0AFBA - soma(arquivo)) & 0xFFFFFFFF
i = arquivo.index(struct.pack('>I', 0x5F0F3CF5)) - 4
arquivo = arquivo[:i] + struct.pack('>I', ajuste) + arquivo[i + 4:]
destino = os.path.join(os.path.dirname(__file__), '..', 'fontes', 'Simbolos.ttf')
open(destino, 'wb').write(arquivo)
print('fontes/Simbolos.ttf: %d símbolos, %d bytes' % (len(codigos), len(arquivo)))
