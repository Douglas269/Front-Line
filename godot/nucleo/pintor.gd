class_name PintorC
extends RefCounted
## Pinta o chão de um mapa: mar, costa, relevo, florestas, montanhas, plantações, estradas e casas.
## Tudo é desenhado em vetor (SVG) com o dobro da resolução, para as bordas ficarem lisas.
## Serve para os mapas gerados na hora e para os da campanha (ferramentas/pintar_mapas.gd).

const E := 2.0
const CHAO := {"campo": "#6a704a", "cidade": "#6d6752", "capital": "#716a53", "floresta": "#4b5d3a", "morro": "#706049"}

static func terreno(mapa: Dictionary, semente: int) -> ImageTexture:
	var img := imagem(mapa, semente)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

static func imagem(mapa: Dictionary, semente: int) -> Image:
	var w := int(mapa["W"])
	var h := int(mapa["H"])
	var rng := RandomNumberGenerator.new()
	rng.seed = semente + 7
	var polis := {}
	var onde := {}
	for p in mapa["prov"]:
		var poli := PackedVector2Array()
		for q in p["poli"]:
			poli.append(Vector2(q[0], q[1]))
		polis[p["id"]] = poli
		onde[p["id"]] = Vector2(p["x"], p["y"])

	var img := _rasterizar(w, h, _mar(w, h, polis, rng))
	var terra_svg: Array = []
	for p in mapa["prov"]:
		var cor: String = CHAO[p["tipo"]]
		terra_svg.append("<path d='%s' fill='%s' stroke='%s' stroke-width='1.6' stroke-linejoin='round'/>" % [_caminho(polis[p["id"]]), cor, cor])
	var terra := _rasterizar(w, h, "".join(terra_svg))
	var mascara: Image = terra.duplicate()
	var tam := terra.get_size()
	terra.blend_rect_mask(_relevo(w, h, tam, semente, rng), mascara, Rect2i(Vector2i.ZERO, tam), Vector2i.ZERO)
	img.blend_rect(terra, Rect2i(Vector2i.ZERO, tam), Vector2i.ZERO)

	var enfeites := _rasterizar(w, h, _enfeites(mapa, polis, onde, rng))
	img.blend_rect(enfeites, Rect2i(Vector2i.ZERO, tam), Vector2i.ZERO)
	return img

static func _rasterizar(w: int, h: int, corpo: String) -> Image:
	var img := Image.new()
	img.load_svg_from_string("<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' viewBox='0 0 %d %d'>%s</svg>" % [w, h, w, h, corpo], E)
	img.convert(Image.FORMAT_RGBA8)
	return img

static func _caminho(p: PackedVector2Array) -> String:
	var partes: PackedStringArray = []
	for q in p:
		partes.append("%.1f %.1f" % [q.x, q.y])
	return "M" + " L".join(partes) + " Z"

## mar com águas rasas, praia, espuma e algumas marolas
static func _mar(w: int, h: int, polis: Dictionary, rng: RandomNumberGenerator) -> String:
	var s: PackedStringArray = ["<rect width='%d' height='%d' fill='#1b2c37'/>" % [w, h]]
	for faixa in [[54.0, "#1e323f"], [36.0, "#223b47"], [20.0, "#2b4a55"], [11.0, "#3d6169"], [7.0, "#8d8664"]]:
		for id in polis:
			s.append("<path d='%s' fill='%s' stroke='%s' stroke-width='%.1f' stroke-linejoin='round'/>" % [_caminho(polis[id]), faixa[1], faixa[1], faixa[0]])
	for i in int(w * h / 9000.0):
		var x := rng.randf() * w
		var y := rng.randf() * h
		var c := rng.randf_range(7.0, 15.0)
		s.append("<path d='M%.1f %.1f q%.1f -3 %.1f 0' fill='none' stroke='#2a4250' stroke-width='1.1' stroke-linecap='round'/>" % [x, y, c / 2.0, c])
	return "".join(s)

## manchas claras e escuras, pintadas pequenas e ampliadas para ficarem macias
static func _relevo(w: int, h: int, tam: Vector2i, semente: int, rng: RandomNumberGenerator) -> Image:
	var ruido := FastNoiseLite.new()
	ruido.seed = semente
	ruido.frequency = 0.011
	ruido.fractal_octaves = 4
	var passo := 4
	var r := Image.create(w / passo, h / passo, false, Image.FORMAT_RGBA8)
	for y in r.get_height():
		for x in r.get_width():
			# a diferença para o ponto de cima e da esquerda dá a impressão de colinas iluminadas
			var aqui := ruido.get_noise_2d(x * passo, y * passo)
			var luz := (aqui - ruido.get_noise_2d(x * passo - 9, y * passo - 9)) * 0.75
			var v := aqui * 0.08 + luz * 0.8 + rng.randf_range(-0.018, 0.018)
			r.set_pixel(x, y, Color(1.0, 0.96, 0.82, clampf(v, 0.0, 0.2)) if v > 0.0 else Color(0.02, 0.05, 0.03, clampf(-v, 0.0, 0.25)))
	r.resize(tam.x, tam.y, Image.INTERPOLATE_BILINEAR)
	return r

# ------------------------------------------------------------ enfeites
static func _enfeites(mapa: Dictionary, polis: Dictionary, onde: Dictionary, rng: RandomNumberGenerator) -> String:
	var chao: PackedStringArray = []    # plantações, estradas e fronteiras
	var altos: Array = []               # [y, desenho]: árvores, montes e casas, de trás para a frente
	for p in mapa["prov"]:
		var centro: Vector2 = onde[p["id"]]
		var poli: PackedVector2Array = polis[p["id"]]
		match p["tipo"]:
			"campo":
				for q in _espalhar(rng, poli, centro, 5, 34.0, 20.0):
					chao.append(_plantacao(rng, q, poli))
				for q in _espalhar(rng, poli, centro, 5, 30.0, 8.0):
					altos.append([q.y, _arvore(rng, q, 0.8)])
				if rng.randf() < 0.45:
					for q in _espalhar(rng, poli, centro, 1, 48.0, 14.0):
						altos.append([q.y, _casa(rng, q, 0.85)])
			"floresta":
				var bosque := _espalhar(rng, poli, centro, 62, 27.0, 7.0)
				for q in bosque:
					altos.append([q.y, _pinheiro(rng, q) if rng.randf() < 0.55 else _arvore(rng, q, 1.15)])
			"morro":
				for q in _espalhar(rng, poli, centro, 7, 36.0, 16.0):
					altos.append([q.y, _montanha(rng, q, rng.randf_range(17.0, 31.0))])
				for q in _espalhar(rng, poli, centro, 9, 28.0, 7.0):
					altos.append([q.y + 3.0, _pinheiro(rng, q) if rng.randf() < 0.5 else _pedra(rng, q)])
			"cidade", "capital":
				var capital: bool = p["tipo"] == "capital"
				chao.append("<ellipse cx='%.1f' cy='%.1f' rx='%d' ry='%d' fill='#857b5e' fill-opacity='0.45'/>" % [centro.x, centro.y + 16, 50 if capital else 40, 30 if capital else 23])
				for k in 5:
					var a := k * TAU / 5.0 + 0.4
					chao.append("<path d='M%.1f %.1f l%.1f %.1f' stroke='#a3987a' stroke-width='2.4' stroke-linecap='round' fill='none'/>" % [centro.x, centro.y + 14, cos(a) * 44.0, sin(a) * 28.0])
				var quantas := 17 if capital else 11
				var feitas := 0
				var tentativas := 0
				var ocupados: Array = []
				while feitas < quantas and tentativas < 160:
					tentativas += 1
					var q := centro + Vector2(rng.randf_range(-42, 42), rng.randf_range(-10, 40))
					if not Geometry2D.is_point_in_polygon(q, poli) or ocupados.any(func(o): return absf(o.x - q.x) < 11.0 and absf(o.y - q.y) < 8.0):
						continue
					ocupados.append(q)
					feitas += 1
					altos.append([q.y, _casa(rng, q, 1.0)])
				if capital:
					altos.append([centro.y + 6.0, _torre(centro + Vector2(-2, 6))])
				for q in _espalhar(rng, poli, centro, 6, 56.0, 8.0):
					altos.append([q.y, _arvore(rng, q, 0.75)])
	# estradas entre vizinhas, em curva suave
	for p in mapa["prov"]:
		for v in p["viz"]:
			if v < p["id"]:
				continue
			var a: Vector2 = onde[p["id"]]
			var b: Vector2 = onde[v]
			var meio := a.lerp(b, 0.5) + (b - a).orthogonal().normalized() * rng.randf_range(-14.0, 14.0)
			chao.append("<path d='M%.1f %.1f Q%.1f %.1f %.1f %.1f' fill='none' stroke='#b3a67f' stroke-opacity='0.62' stroke-width='2.1' stroke-linecap='round' stroke-dasharray='5 5.5'/>" % [a.x, a.y + 14, meio.x, meio.y + 14, b.x, b.y + 14])
	for id in polis:
		chao.append("<path d='%s' fill='none' stroke='#141a10' stroke-opacity='0.55' stroke-width='1.2' stroke-linejoin='round'/>" % _caminho(polis[id]))
	altos.sort_custom(func(a, b): return a[0] < b[0])
	for x in altos:
		chao.append(x[1])
	return "".join(chao)

## pontos dentro da província, longe do centro (onde ficam o nome e a tropa) e uns dos outros
static func _espalhar(rng: RandomNumberGenerator, poli: PackedVector2Array, centro: Vector2, quantos: int, longe: float, folga: float) -> Array:
	var r: Array = []
	var tentativas := 0
	while r.size() < quantos and tentativas < quantos * 14:
		tentativas += 1
		var q := centro + Vector2(rng.randf_range(-92, 92), rng.randf_range(-86, 86))
		if q.distance_to(centro + Vector2(0, 4)) < longe or r.any(func(o): return o.distance_to(q) < folga):
			continue
		# folga também da borda, para nada passar para o mar
		if [Vector2(-9, 0), Vector2(9, 0), Vector2(0, -12), Vector2(0, 6)].all(func(d): return Geometry2D.is_point_in_polygon(q + d, poli)):
			r.append(q)
	return r

static func _sombra(q: Vector2, rx: float, ry: float) -> String:
	return "<ellipse cx='%.1f' cy='%.1f' rx='%.1f' ry='%.1f' fill='#000000' fill-opacity='0.24'/>" % [q.x + rx * 0.45, q.y, rx, ry]

static func _arvore(rng: RandomNumberGenerator, q: Vector2, e: float) -> String:
	var r := rng.randf_range(4.6, 6.4) * e
	var tons: Array = [["#2c4126", "#41592f", "#597340"], ["#34482a", "#4b6334", "#667f45"], ["#3d4a24", "#586531", "#74803f"]][rng.randi() % 3]
	return _sombra(q + Vector2(0, 1), r * 1.05, r * 0.45) \
		+ "<path d='M%.1f %.1f v%.1f' stroke='#4a3422' stroke-width='%.1f'/>" % [q.x, q.y, -r * 0.9, 1.7 * e] \
		+ "<circle cx='%.1f' cy='%.1f' r='%.1f' fill='%s' stroke='#1c2a18' stroke-width='0.8'/>" % [q.x, q.y - r * 1.35, r, tons[0]] \
		+ "<circle cx='%.1f' cy='%.1f' r='%.1f' fill='%s'/>" % [q.x - r * 0.2, q.y - r * 1.55, r * 0.72, tons[1]] \
		+ "<circle cx='%.1f' cy='%.1f' r='%.1f' fill='%s'/>" % [q.x - r * 0.35, q.y - r * 1.75, r * 0.36, tons[2]]

static func _pinheiro(rng: RandomNumberGenerator, q: Vector2) -> String:
	var alt := rng.randf_range(13.0, 20.0)
	var l := alt * 0.34
	var s := _sombra(q + Vector2(0, 0.5), l * 1.1, l * 0.4)
	for k in 3:
		var base := q.y - k * alt * 0.24
		var larg := l * (1.0 - k * 0.22)
		var topo := base - alt * 0.46
		s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#2b4128' stroke='#18261a' stroke-width='0.7' stroke-linejoin='round'/>" % [q.x - larg, base, q.x, topo, q.x + larg, base]
		s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#48613a'/>" % [q.x - larg * 0.8, base - 0.8, q.x, topo + 1.2, q.x - larg * 0.05, base - 1.4]
	return s

static func _montanha(rng: RandomNumberGenerator, q: Vector2, alt: float) -> String:
	var l := alt * rng.randf_range(0.85, 1.1)
	var topo := q + Vector2(rng.randf_range(-0.16, 0.16) * l, -alt)
	# contorno com quebras nas duas encostas
	var e1 := q + Vector2(-l * 0.62, -alt * rng.randf_range(0.3, 0.46))
	var e2 := topo + Vector2(-l * 0.2, alt * rng.randf_range(0.16, 0.26))
	var d1 := topo + Vector2(l * 0.24, alt * rng.randf_range(0.2, 0.34))
	var d2 := q + Vector2(l * 0.66, -alt * rng.randf_range(0.24, 0.4))
	var crista := topo.lerp(q, 0.46) + Vector2(rng.randf_range(0.0, 0.18) * l, 0)
	var pe := q + Vector2(l * 0.14, 2)
	var s := _sombra(q + Vector2(l * 0.2, 1), l, alt * 0.17)
	s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#8a755a' stroke='#3a2f22' stroke-width='0.9' stroke-linejoin='round'/>" % [q.x - l, q.y, e1.x, e1.y, e2.x, e2.y, topo.x, topo.y, d1.x, d1.y, d2.x, d2.y, q.x + l, q.y]
	s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#4f4031'/>" % [topo.x, topo.y, d1.x, d1.y, d2.x, d2.y, q.x + l, q.y, pe.x, pe.y, crista.x, crista.y]
	s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f' fill='none' stroke='#a99274' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'/>" % [e1.x + 2, e1.y + 1, e2.x + 1, e2.y + 2, topo.x - 0.5, topo.y + 2]
	if alt > 24.0: # neve no alto
		var n1 := topo.lerp(e2, 0.9)
		var n2 := topo.lerp(d1, 0.78)
		var n3 := topo.lerp(crista, 0.42)
		s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#d9d8cc'/>" % [topo.x, topo.y, n2.x, n2.y, n3.x + 2.5, n3.y - 2.0, n3.x, n3.y, topo.x - 1.5, topo.y + alt * 0.2, n1.x, n1.y]
		s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#a9aca6'/>" % [topo.x, topo.y, n2.x, n2.y, n3.x, n3.y]
	return s

static func _pedra(rng: RandomNumberGenerator, q: Vector2) -> String:
	var r := rng.randf_range(2.6, 4.6)
	return _sombra(q, r * 1.2, r * 0.45) + "<path d='M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f Z' fill='#857359' stroke='#3a2f22' stroke-width='0.7' stroke-linejoin='round'/>" % [q.x - r, q.y, r * 0.6, -r * 1.1, r * 0.9, r * 0.2, r * 0.7, r * 0.9]

## retalho de lavoura inclinado, com sulcos
static func _plantacao(rng: RandomNumberGenerator, q: Vector2, poli: PackedVector2Array) -> String:
	var meia := Vector2(rng.randf_range(12.0, 21.0), rng.randf_range(8.0, 13.0))
	var ang := rng.randf_range(-0.6, 0.6)
	var cantos: Array = [Vector2(-meia.x, -meia.y), Vector2(meia.x, -meia.y), Vector2(meia.x, meia.y), Vector2(-meia.x, meia.y)].map(func(c): return q + c.rotated(ang))
	if not cantos.all(func(c): return Geometry2D.is_point_in_polygon(c, poli)):
		return ""
	var tons: Array = [["#8b8248", "#6f6a39"], ["#6e7a3e", "#57632f"], ["#7d6b45", "#655536"], ["#948a52", "#7b7342"]][rng.randi() % 4]
	var s := "<g transform='translate(%.1f %.1f) rotate(%.1f)'><rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' rx='1.5' fill='%s' fill-opacity='0.85' stroke='#47522c' stroke-width='1.2'/>" % [q.x, q.y, rad_to_deg(ang), -meia.x, -meia.y, meia.x * 2.0, meia.y * 2.0, tons[0]]
	var y := -meia.y + 2.8
	while y < meia.y - 1.0:
		s += "<path d='M%.1f %.1f h%.1f' stroke='%s' stroke-width='1.3'/>" % [-meia.x + 1.5, y, meia.x * 2.0 - 3.0, tons[1]]
		y += 3.4
	return s + "</g>"

## casinha vista um pouco de cima: parede, porta e telhado de duas águas
static func _casa(rng: RandomNumberGenerator, q: Vector2, e: float) -> String:
	var l := rng.randf_range(8.0, 12.5) * e
	var a := rng.randf_range(4.2, 5.6) * e
	var telhado: Array = [["#9a4f3a", "#b86a4d"], ["#7b4434", "#955740"], ["#5f5a52", "#787268"], ["#8a6a3c", "#a6834c"]][rng.randi() % 4]
	var x := q.x - l / 2.0
	var s := _sombra(q + Vector2(0, 0.8), l * 0.68, a * 0.45)
	s += "<rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' fill='#c2b494' stroke='#2e271c' stroke-width='0.7'/>" % [x, q.y - a, l, a]
	s += "<rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' fill='#9d9075'/>" % [x + l * 0.62, q.y - a, l * 0.38, a]
	s += "<rect x='%.1f' y='%.1f' width='%.1f' height='%.1f' fill='#3d3022'/>" % [x + l * 0.2, q.y - a * 0.62, l * 0.17, a * 0.62]
	s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='%s' stroke='#2e1d14' stroke-width='0.7' stroke-linejoin='round'/>" % [x - 1.2, q.y - a, x + l * 0.17, q.y - a - a * 0.92, x + l * 0.83, q.y - a - a * 0.92, x + l + 1.2, q.y - a, telhado[0]]
	s += "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='%s'/>" % [x + 0.4, q.y - a - 0.6, x + l * 0.19, q.y - a - a * 0.86, x + l * 0.5, q.y - a - a * 0.86, x + l * 0.42, q.y - a - 0.6, telhado[1]]
	return s

## a torre que marca uma capital
static func _torre(q: Vector2) -> String:
	return _sombra(q + Vector2(2, 1), 9.0, 3.4) \
		+ "<rect x='%.1f' y='%.1f' width='9' height='19' fill='#c9bc9c' stroke='#2e271c' stroke-width='0.8'/>" % [q.x - 4.5, q.y - 19] \
		+ "<rect x='%.1f' y='%.1f' width='3.4' height='19' fill='#a09378'/>" % [q.x + 1.1, q.y - 19] \
		+ "<path d='M%.1f %.1f L%.1f %.1f L%.1f %.1f Z' fill='#8c4634' stroke='#2e1d14' stroke-width='0.8' stroke-linejoin='round'/>" % [q.x - 6.2, q.y - 19, q.x, q.y - 31, q.x + 6.2, q.y - 19] \
		+ "<circle cx='%.1f' cy='%.1f' r='2' fill='#4a3c2a'/>" % [q.x, q.y - 12.5]
