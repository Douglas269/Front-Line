class_name ArteC
extends RefCounted
## Tropas desenhadas em vetor (SVG) com um esqueleto simples, na cor de cada país.
## Cada pose vira uma imagem lisa em alta resolução, feita uma vez e guardada.

## tamanho da tela de cada quadro, em unidades, e onde ficam os pés dentro dela
const CAIXA := Vector2(80, 78)
const ORIGEM := Vector2(36, 72)
const RES := 5.0 # pixels de imagem por unidade na batalha
const RES_MAPA := 3.0
const GUARDADOS_MAX := 260 # para a memória do aparelho não crescer sem fim

## quantos quadros tem cada animação
const QUADROS := {
	"inf": {"parado": 4, "andar": 12, "mirar": 4, "atirar": 3, "recarregar": 4, "abaixar": 1, "deitado": 4, "deitado_atirar": 3, "cair": 7, "festa": 6},
	"cav": {"parado": 4, "andar": 8, "atirar": 3, "cair": 1},
	"art": {"parado": 1, "andar": 4, "atirar": 3, "cair": 1},
	"blind": {"parado": 1, "andar": 4, "atirar": 3, "cair": 1}
}

const PELE := "#d9a47c"
const BOTA := "#33261b"
const TRACO := "#15130e"
const MADEIRA := "#7a4a27"
const METAL := "#3a3f44"
const COURO := "#b99a66"
const COURO_LONGE := "#7d6844"

static var _cache := {}
static var _disco: Texture2D
## ligado quando o aparelho engasga (ou nos Ajustes): menos fumaça, partículas, chuva e nuvens
static var leve := false

## elipse com uma só imagem: o aparelho junta todas num único desenho (draw_circle desenha uma por vez)
static func elipse(onde: CanvasItem, centro: Vector2, raios: Vector2, cor: Color) -> void:
	if _disco == null:
		var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
		for y in 64:
			for x in 64:
				var d := Vector2(x - 31.5, y - 31.5).length()
				img.set_pixel(x, y, Color(1, 1, 1, clampf(32.0 - d, 0.0, 1.0)))
		img.generate_mipmaps()
		_disco = ImageTexture.create_from_image(img)
	onde.draw_texture_rect(_disco, Rect2(centro - raios, raios * 2.0), false, cor)

## ponta da arma (de onde saem o clarão e o tiro), em unidades a partir dos pés
static func boca(tipo: String, deitado: bool) -> Vector2:
	match tipo:
		"cav": return Vector2(22, -31)
		"art": return Vector2(26, -19)
		"blind": return Vector2(26, -24)
		"metr": return Vector2(27, -9.5) if deitado else Vector2(25, -19.5)
	return Vector2(34, -9) if deitado else Vector2(29, -27)

## onde desenhar um quadro para os pés caírem em `pes`
static func retangulo(pes: Vector2, escala: float) -> Rect2:
	return Rect2(pes - ORIGEM * escala, CAIXA * escala)

static func quadros(tipo: String, anim: String) -> int:
	var t: Dictionary = QUADROS["inf" if tipo == "metr" else tipo]
	return t.get(anim, t["parado"])

## quadro `k` da animação `anim` do tipo de tropa, na cor do país, virado para a direita
static func quadro(tipo: String, anim: String, k: int, cor: Color, res := RES) -> Texture2D:
	var base := "inf" if tipo == "metr" else tipo
	if not QUADROS[base].has(anim):
		anim = "parado"
	k = posmod(k, int(QUADROS[base][anim]))
	var chave := "%s|%s|%d|%s|%d" % [tipo, anim, k, cor.to_html(false), int(res)]
	if _cache.has(chave):
		return _cache[chave]
	var img := Image.new()
	img.load_svg_from_string(svg(tipo, anim, k, cor), res)
	img.fix_alpha_edges()
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	if _cache.size() >= GUARDADOS_MAX:
		_cache.clear() # o que está na tela continua; o resto é refeito quando precisar
	_cache[chave] = t
	return t

static func svg(tipo: String, anim: String, k: int, cor: Color) -> String:
	var corpo := ""
	match tipo:
		"cav": corpo = _cavalaria(anim, k, cor)
		"art": corpo = _artilharia(anim, k, cor)
		"blind": corpo = _blindado(anim, k, cor)
		_: corpo = _soldado(anim, k, cor, tipo == "metr")
	return "<svg xmlns='http://www.w3.org/2000/svg' width='%d' height='%d' viewBox='0 0 %d %d'><g transform='translate(%d %d)'>%s</g></svg>" % [int(CAIXA.x), int(CAIXA.y), int(CAIXA.x), int(CAIXA.y), int(ORIGEM.x), int(ORIGEM.y), corpo]

# ------------------------------------------------------------ peças
static func _hex(c: Color) -> String:
	return "#" + c.to_html(false)

static func _cores(cor: Color) -> Dictionary:
	# a farda puxa um pouco para o verde-oliva, mas a cor do país continua mandando
	var farda := cor.lerp(Color("6f7350"), 0.22)
	return {"tunica": _hex(farda.darkened(0.16)), "tunica_luz": _hex(farda.lightened(0.12)), "calca": _hex(farda.darkened(0.36)), "longe": _hex(farda.darkened(0.55)), "capacete": _hex(farda.darkened(0.3)), "capacete_luz": _hex(farda.lightened(0.08))}

static func _n(v: float) -> String:
	return "%.2f" % v

static func _p(v: Vector2) -> String:
	return "%.2f %.2f" % [v.x, v.y]

## membro: linha grossa de pontas redondas, com contorno
static func _membro(pontos: Array, larg: float, cor: String) -> String:
	var d := "M" + _p(pontos[0])
	for i in range(1, pontos.size()):
		d += " L" + _p(pontos[i])
	return "<path d='%s' fill='none' stroke='%s' stroke-width='%s' stroke-linecap='round' stroke-linejoin='round'/><path d='%s' fill='none' stroke='%s' stroke-width='%s' stroke-linecap='round' stroke-linejoin='round'/>" % [d, TRACO, _n(larg + 1.3), d, cor, _n(larg)]

static func _forma(d: String, cor: String, traco := 0.75) -> String:
	return "<path d='%s' fill='%s' stroke='%s' stroke-width='%s' stroke-linejoin='round'/>" % [d, cor, TRACO, _n(traco)]

static func _circ(c: Vector2, r: float, cor: String, traco := 0.75) -> String:
	return "<circle cx='%s' cy='%s' r='%s' fill='%s' stroke='%s' stroke-width='%s'/>" % [_n(c.x), _n(c.y), _n(r), cor, TRACO, _n(traco)]

## dobra de joelho ou cotovelo: acha o ponto do meio entre a raiz e a ponta
static func _junta(a: Vector2, b: Vector2, c1: float, c2: float, lado: float) -> Vector2:
	var v := b - a
	var d := clampf(v.length(), 0.01, c1 + c2 - 0.01)
	var u := v.normalized()
	var x := (c1 * c1 - c2 * c2 + d * d) / (2.0 * d)
	var h := sqrt(maxf(0.0, c1 * c1 - x * x))
	return a + u * x + Vector2(-u.y, u.x) * h * lado

static func _perna(quadril: Vector2, pe: Vector2, cor: String, perneira: String) -> String:
	var joelho := _junta(quadril, pe + Vector2(0, -1.2), 9.7, 9.7, -1.0)
	var s := _membro([quadril, joelho, pe + Vector2(0, -1.4)], 3.8, cor)
	# perneira e bota
	s += _membro([joelho.lerp(pe, 0.52), pe + Vector2(0, -1.6)], 2.8, perneira)
	s += _forma("M%s L%s Q%s %s L%s Z" % [_p(pe + Vector2(-1.7, -2.4)), _p(pe + Vector2(1.3, -2.2)), _p(pe + Vector2(3.9, -1.3)), _p(pe + Vector2(3.4, 0.6)), _p(pe + Vector2(-1.9, 0.6))], BOTA)
	return s

static func _braco(ombro: Vector2, mao: Vector2, cor: String) -> String:
	var cotovelo := _junta(ombro, mao, 6.8, 6.6, 1.0)
	return _membro([ombro, cotovelo, mao], 3.05, cor) + _circ(mao, 1.28, PELE, 0.55)

static func _fuzil(punho: Vector2, ang: float, baioneta := true) -> String:
	var s := "<g transform='translate(%s) rotate(%s)'>" % [_p(punho), _n(rad_to_deg(ang))]
	s += _forma("M-7.5 -0.6 L-3.5 -1.6 L1 -1.4 L1 0.9 L-2.6 1.0 L-7.2 3.0 Z", MADEIRA)
	s += _forma("M0.5 -1.5 L12.5 -1.2 L12.5 0.4 L0.5 0.9 Z", MADEIRA)
	s += _forma("M1.0 -2.4 L18.5 -2.0 L18.5 -1.0 L1.0 -1.2 Z", METAL, 0.55)
	s += _forma("M-0.6 0.9 L1.8 0.9 L1.2 2.6 L-0.2 2.4 Z", METAL, 0.5)
	if baioneta:
		s += _forma("M18.5 -1.9 L24.5 -1.5 L18.5 -1.2 Z", "#c9ced3", 0.4)
	return s + "</g>"

const CABECA := 0.82 # tamanho da cabeça em relação ao corpo

static func _cabeca(c: Vector2, cores: Dictionary, olho := true, capacete := true) -> String:
	return "<g transform='translate(%s) scale(%s)'>%s</g>" % [_p(c), _n(CABECA), _rosto(Vector2.ZERO, cores, olho, capacete)]

static func _rosto(c: Vector2, cores: Dictionary, olho: bool, capacete: bool) -> String:
	var s := _forma("M%s Q%s %s Q%s %s Q%s %s Q%s %s Z" % [_p(c + Vector2(-3.3, -1.5)), _p(c + Vector2(-3.8, 3.4)), _p(c + Vector2(0.4, 3.7)), _p(c + Vector2(3.4, 3.4)), _p(c + Vector2(3.5, 0.9)), _p(c + Vector2(4.7, 0.1)), _p(c + Vector2(3.4, -0.9)), _p(c + Vector2(3.2, -3.0)), _p(c + Vector2(-3.3, -1.5))], PELE)
	if olho:
		s += "<circle cx='%s' cy='%s' r='0.55' fill='%s'/>" % [_n(c.x + 1.9), _n(c.y - 0.1), TRACO]
	s += "<path d='M%s Q%s %s' fill='none' stroke='#6b4a35' stroke-width='0.5'/>" % [_p(c + Vector2(1.4, 2.0)), _p(c + Vector2(2.3, 2.4)), _p(c + Vector2(3.1, 1.9))]
	if not capacete: # cabelo
		return s + _forma("M%s C%s %s %s Q%s %s Z" % [_p(c + Vector2(-3.6, 0.4)), _p(c + Vector2(-4.4, -5.4)), _p(c + Vector2(2.6, -6.0)), _p(c + Vector2(3.4, -2.4)), _p(c + Vector2(-0.8, -2.8)), _p(c + Vector2(-3.6, 0.4))], "#3b2716")
	# capacete de aba larga: cúpula, aba e um brilho
	s += _forma("M%s C%s %s %s Z" % [_p(c + Vector2(-4.4, -1.4)), _p(c + Vector2(-4.2, -7.6)), _p(c + Vector2(4.4, -7.6)), _p(c + Vector2(4.6, -1.6))], cores["capacete"])
	s += "<path d='M%s Q%s %s' fill='none' stroke='%s' stroke-width='1.1' stroke-linecap='round'/>" % [_p(c + Vector2(-2.4, -4.2)), _p(c + Vector2(-0.4, -6.0)), _p(c + Vector2(2.2, -5.0)), cores["capacete_luz"]]
	s += _forma("M%s Q%s %s Q%s %s Z" % [_p(c + Vector2(-6.4, -1.0)), _p(c + Vector2(0.2, -3.4)), _p(c + Vector2(6.6, -1.4)), _p(c + Vector2(0.2, 0.2)), _p(c + Vector2(-6.4, -1.0))], cores["capacete"])
	return s

static func _tronco(quadril: Vector2, ombro: Vector2, cores: Dictionary) -> String:
	var eixo := (ombro - quadril).normalized()
	var l := Vector2(-eixo.y, eixo.x) # para a frente do peito
	var s := _forma("M%s L%s Q%s %s L%s Q%s %s Z" % [_p(quadril - l * 3.4), _p(ombro - l * 3.9), _p(ombro + eixo * 2.6), _p(ombro + l * 3.6), _p(quadril + l * 3.6), _p(quadril - eixo * 2.0), _p(quadril - l * 3.4)], cores["tunica"])
	s += "<path d='M%s L%s' fill='none' stroke='%s' stroke-width='1.5' stroke-linecap='round'/>" % [_p(quadril.lerp(ombro, 0.25) + l * 2.3), _p(quadril.lerp(ombro, 0.88) + l * 2.2), cores["tunica_luz"]]
	# cinto, bandoleira e bolsa de munição
	s += _membro([quadril.lerp(ombro, 0.12) - l * 3.2, quadril.lerp(ombro, 0.12) + l * 3.2], 1.5, COURO)
	s += "<path d='M%s L%s' fill='none' stroke='%s' stroke-width='1.15'/>" % [_p(ombro - l * 1.8), _p(quadril.lerp(ombro, 0.15) + l * 2.6), COURO]
	s += _circ(quadril.lerp(ombro, 0.16) + l * 2.4, 1.7, "#8a7248", 0.6)
	return s

static func _mochila(quadril: Vector2, ombro: Vector2, cores: Dictionary) -> String:
	var eixo := (ombro - quadril).normalized()
	var l := Vector2(-eixo.y, eixo.x)
	var a := quadril.lerp(ombro, 0.4) - l * 3.2
	var b := quadril.lerp(ombro, 0.95) - l * 3.2
	return _membro([a - l * 1.6, b - l * 1.6], 4.2, cores["longe"]) + _membro([b - l * 1.9 + eixo * 1.6, b + l * 0.4 + eixo * 1.6], 2.4, COURO)

## soldado em pé, descrito por onde ficam quadril, ombro, pés, mãos e fuzil
static func _boneco_em_pe(q: Dictionary, cores: Dictionary, metr: bool) -> String:
	var quadril: Vector2 = q["quadril"]
	var ombro: Vector2 = q["ombro"]
	var punho: Vector2 = q["punho"]
	var ang: float = q["ang"]
	var dir := Vector2(cos(ang), sin(ang))
	var mao_frente: Vector2 = q.get("mao_frente", punho + dir * 8.5)
	var s := _braco(ombro + Vector2(0.8, 0.6), mao_frente, cores["longe"])
	s += _perna(quadril + Vector2(-0.6, 0), q["pe_longe"], cores["longe"], COURO_LONGE)
	s += _mochila(quadril, ombro, cores)
	s += _tronco(quadril, ombro, cores)
	s += _perna(quadril + Vector2(0.8, 0.2), q["pe_perto"], cores["calca"], COURO)
	# um pescoço curto, para a cabeça menor não ficar solta
	var cabeca: Vector2 = q.get("cabeca", ombro + Vector2(1.0, -5.5))
	s += _membro([ombro + Vector2(0.6, -1.2), cabeca + Vector2(0.2, 1.4)], 2.2, PELE)
	s += _cabeca(cabeca, cores)
	if q.get("com_fuzil", true) and not metr:
		s += _fuzil(punho, ang)
	if q.get("clarao", 0.0) > 0.0 and not metr:
		s += _clarao(punho + dir * 25.0, ang, q["clarao"])
	s += _braco(ombro + Vector2(-0.4, 1.0), punho, cores["tunica"])
	if metr:
		s += "<g transform='scale(1 1.2)'>" + _metralhadora(q.get("clarao", 0.0), q.get("recuo", 0.0)) + "</g>"
	return s

static func _clarao(onde: Vector2, ang: float, f: float) -> String:
	return "<g transform='translate(%s) rotate(%s) scale(%s)'><path d='M0 -1.4 L3 -4.2 L3.6 -1.6 L9.5 0 L3.6 1.6 L3 4.2 L0 1.4 Z' fill='#ffb238'/><path d='M0 -0.8 L5.6 0 L0 0.8 Z' fill='#fff4c4'/></g>" % [_p(onde), _n(rad_to_deg(ang)), _n(f)]

static func _metralhadora(clarao: float, recuo: float) -> String:
	var s := _membro([Vector2(12 - recuo, -15), Vector2(7, 0)], 1.5, METAL)
	s += _membro([Vector2(13 - recuo, -15), Vector2(19, 0)], 1.5, METAL)
	s += _membro([Vector2(12 - recuo, -15), Vector2(12, -1)], 1.3, METAL)
	s += _forma("M%s h11 v4.6 h-11 Z" % _p(Vector2(6 - recuo, -18.4)), METAL)
	s += _forma("M%s h8 v2.2 h-8 Z" % _p(Vector2(17 - recuo, -17.4)), "#555c63")
	s += _circ(Vector2(10.5 - recuo, -13.4), 2.2, "#4c5157")
	if clarao > 0.0:
		s += _clarao(Vector2(26 - recuo, -16.3), 0.0, clarao)
	return s

static func _soldado(anim: String, k: int, cor: Color, metr: bool) -> String:
	var cores := _cores(cor)
	match anim:
		"deitado", "deitado_atirar":
			return _de_brucos(anim, k, cores, metr)
		"cair":
			return _queda(k, cores, metr)
	var folego := sin(k / 4.0 * TAU) * 0.45
	var q := {"quadril": Vector2(-0.8, -19.7), "ombro": Vector2(0.4, -30.4 + folego), "pe_longe": Vector2(-4.8, 0), "pe_perto": Vector2(3.8, 0), "punho": Vector2(2.2, -23.2 + folego), "ang": -0.62}
	match anim:
		"andar":
			var t := k / float(QUADROS["inf"]["andar"]) * TAU
			var passo := 8.4
			var sobe := absf(sin(t)) * 1.3
			q["quadril"] = Vector2(-0.5, -18.3 - sobe)
			q["ombro"] = Vector2(2.4, -28.8 - sobe)
			q["pe_perto"] = Vector2(cos(t) * passo, -maxf(0.0, -sin(t)) * 5.0)
			q["pe_longe"] = Vector2(cos(t + PI) * passo, -maxf(0.0, -sin(t + PI)) * 5.0)
			q["punho"] = Vector2(3.8 - cos(t) * 1.1, -22.4 - sobe)
			q["ang"] = -0.34 + sin(t * 2.0) * 0.04
		"mirar", "atirar", "recarregar":
			q["quadril"] = Vector2(-1.6, -17.7)
			q["ombro"] = Vector2(0.6, -28.0 + folego * 0.5)
			q["pe_longe"] = Vector2(-9.0, 0)
			q["pe_perto"] = Vector2(6.6, 0)
			q["punho"] = Vector2(4.4, -27.2 + folego * 0.5)
			q["ang"] = -0.015 + folego * 0.012
			if anim == "atirar":
				var r: float = [2.6, 1.5, 0.5][k]
				q["ombro"] = Vector2(0.6 - r * 0.8, -28.0)
				q["punho"] = Vector2(4.4 - r, -27.2 - r * 0.25)
				q["ang"] = -0.015 - r * 0.07
				q["clarao"] = [1.0, 0.45, 0.0][k]
				q["recuo"] = r
			elif anim == "recarregar":
				var vai: float = [0.5, 1.0, 1.0, 0.45][k]
				q["punho"] = Vector2(4.4, -27.2).lerp(Vector2(3.4, -23.4), vai)
				q["ang"] = lerpf(-0.015, -0.5, vai)
				q["mao_frente"] = (q["punho"] as Vector2) + Vector2([4.0, -0.5, 2.5, 6.0][k], [-1.5, -3.0, -1.0, -2.0][k])
		"abaixar":
			q = {"quadril": Vector2(-2.6, -12.0), "ombro": Vector2(1.8, -21.8), "pe_longe": Vector2(-11.6, 0), "pe_perto": Vector2(7.0, 0), "punho": Vector2(5.2, -19.4), "ang": -0.06}
		"festa":
			var t := k / 6.0 * TAU
			var alto := absf(sin(t)) * 1.6
			q["quadril"] = Vector2(-1, -18.9 - alto * 0.5)
			q["ombro"] = Vector2(0, -29.5 - alto)
			q["pe_longe"] = Vector2(-5.5, 0)
			q["pe_perto"] = Vector2(4.5, 0)
			q["punho"] = Vector2(6.0 + sin(t) * 1.6, -39.0 - alto)
			q["ang"] = -1.35 + sin(t) * 0.18
			q["mao_frente"] = Vector2(-7.2 - sin(t) * 1.2, -36.0 - alto)
	return _boneco_em_pe(q, cores, metr)

static func _de_brucos(anim: String, k: int, cores: Dictionary, metr: bool) -> String:
	var folego := sin(k / 4.0 * TAU) * 0.35
	var r := 0.0
	var clarao := 0.0
	if anim == "deitado_atirar":
		r = [2.2, 1.2, 0.4][k]
		clarao = [1.0, 0.45, 0.0][k]
		folego = 0.0
	var quadril := Vector2(-8.0, -4.2)
	var ombro := Vector2(2.6 - r * 0.6, -8.0 - folego)
	var s := _braco(ombro + Vector2(0.8, 0.4), Vector2(13.0 - r, -6.8), cores["longe"])
	s += _membro([quadril, Vector2(-17.6, -2.2), Vector2(-26.6, -2.0)], 3.45, cores["longe"])
	s += _forma("M-29.4 -4.2 h3.6 v4.2 h-2.7 Z", BOTA)
	s += _tronco(quadril, ombro, cores)
	s += _membro([quadril + Vector2(0, 0.8), Vector2(-17.2, -1.6), Vector2(-24.8, -3.4)], 3.75, cores["calca"])
	s += _forma("M-28.0 -5.8 l3.4 0.6 l-0.7 3.6 l-3.2 -0.8 Z", BOTA)
	s += _cabeca(ombro + Vector2(4.6, -2.6), cores)
	if not metr:
		s += _fuzil(Vector2(9.4 - r, -8.0 - folego * 0.4), -0.02 - r * 0.05)
		if clarao > 0.0:
			s += _clarao(Vector2(34.4 - r, -9.6), 0.0, clarao)
	s += _braco(ombro + Vector2(-0.6, 1.2), Vector2(9.2 - r, -6.6), cores["tunica"])
	if metr:
		s += "<g transform='translate(1 0) scale(1 0.58)'>" + _metralhadora(clarao, r) + "</g>"
	return s

static func _queda(k: int, cores: Dictionary, metr: bool) -> String:
	if k >= 5:
		# caído de costas, o fuzil ao lado
		var afunda := 0.0 if k == 6 else -0.8
		var desenho := "<ellipse cx='-5' cy='-0.5' rx='23' ry='3.2' fill='#4a0f0c' fill-opacity='%s'/>" % ("0.55" if k == 6 else "0.3")
		if not metr:
			desenho += _fuzil(Vector2(7.0, -1.2), 0.12, false)
		desenho += _braco(Vector2(-9.0, -4.0), Vector2(-2.0, -1.8 + afunda), cores["longe"])
		desenho += _membro([Vector2(-1.0, -3.6 + afunda), Vector2(8.0, -7.0 + afunda), Vector2(14.4, -1.8)], 3.45, cores["longe"])
		desenho += _forma("M13.2 -3.4 h3.9 v3.4 h-3.9 Z", BOTA)
		desenho += _tronco(Vector2(-1.5, -3.8 + afunda), Vector2(-12.0, -4.0 + afunda), cores)
		desenho += _membro([Vector2(-0.5, -3.0), Vector2(9.8, -2.2), Vector2(19.6, -1.8)], 3.75, cores["calca"])
		desenho += _forma("M18.5 -4.0 l3.4 -0.4 l0.4 4.4 h-3.4 Z", BOTA)
		desenho += "<g transform='translate(-18.4 -4.6) rotate(-82)'>" + _cabeca(Vector2.ZERO, cores, false, false) + "<path d='M1.1 -0.5 l1.5 1.2 M2.6 -0.5 l-1.5 1.2' stroke='#15130e' stroke-width='0.5'/></g>"
		# o capacete rolou
		desenho += _forma("M-29.6 -0.4 C-29.4 -6.2 -22.6 -6.6 -22.4 -1.4 Z", cores["capacete"]) + _forma("M-31.4 -0.2 Q-26 -2.4 -20.6 -1.4 Q-26 1.0 -31.4 -0.2 Z", cores["capacete"])
		desenho += _braco(Vector2(-11.0, -3.4), Vector2(-14.5, -1.0), cores["tunica"])
		return desenho
	# do impacto até bater no chão: o corpo vai para trás, os joelhos dobram e o fuzil escapa
	var f: float = [0.08, 0.24, 0.45, 0.68, 0.9][k]
	var quadril := Vector2(-1.0, -18.6).lerp(Vector2(-2.6, -5.2), f)
	var inclina := lerpf(-0.12, -1.42, f)
	var ombro := quadril + Vector2(sin(inclina), -cos(inclina)) * 10.6
	var q := {"quadril": quadril, "ombro": ombro, "pe_longe": Vector2(-5.0 + f * 14.0, -f * 1.0), "pe_perto": Vector2(4.0 + f * 14.0, -f * 6.0 * (1.0 - f)), "cabeca": ombro + Vector2(sin(inclina - 0.25), -cos(inclina - 0.25)) * 6.0, "punho": ombro + Vector2(5.0 + f * 3.0, 3.0 - f * 9.0), "ang": -0.5 - f * 1.4, "mao_frente": ombro + Vector2(-5.0 - f * 2.0, -1.0 - f * 6.0), "com_fuzil": false}
	var s := _boneco_em_pe(q, cores, false)
	if not metr:
		s += _fuzil(Vector2(4.0 + f * 7.0, -24.0 + f * 21.0), -0.6 + f * 1.1)
	return s

# ------------------------------------------------------------ cavalaria
static func _perna_cavalo(raiz: Vector2, fase: float, parado: bool, cor: String) -> String:
	var pe := Vector2(raiz.x + cos(fase) * 6.5, -maxf(0.0, -sin(fase)) * 5.0)
	if parado:
		pe = Vector2(raiz.x + 0.6, 0)
	var joelho := _junta(raiz, pe + Vector2(0, -1.0), 6.6, 7.2, 1.0 if raiz.x < 0.0 else -1.0)
	return _membro([raiz, joelho, pe + Vector2(0, -1.2)], 2.7, cor) + _forma("M%s h3.4 l0.5 2 h-4.4 Z" % _p(pe + Vector2(-1.6, -1.9)), "#241a12", 0.6)

static func _cavalaria(anim: String, k: int, cor: Color) -> String:
	if anim == "cair":
		return "<g transform='translate(0 -4) rotate(7)'>" + _cavalaria("parado", 0, cor.darkened(0.45)) + "</g>"
	var cores := _cores(cor)
	var parado := anim != "andar"
	var t := k / 8.0 * TAU
	var sobe := 0.0
	if anim == "andar":
		sobe = sin(t) * 1.4
	elif anim == "parado":
		sobe = sin(k / 4.0 * TAU) * 0.35
	var y := -sobe
	var pelo := "#7a5230"
	var pelo_longe := "#523620"
	var s := _perna_cavalo(Vector2(-9.0, -12.5 + y), t + 2.6, parado, pelo_longe)
	s += _perna_cavalo(Vector2(8.0, -12.5 + y), t + 5.8, parado, pelo_longe)
	s += _membro([Vector2(-13.0, -18.0 + y), Vector2(-18.0, -16.0 + y - sobe), Vector2(-20.5, -10.0 + y)], 2.8, "#2c1c10")
	s += _forma("M-13.5 %s C-14 %s -4 %s 3 %s C8 %s 12 %s 12.5 %s C13 %s 6 %s -2 %s C-9 %s -14.5 %s -13.5 %s Z" % [_n(-18 + y), _n(-23 + y), _n(-22 + y), _n(-20.5 + y), _n(-20 + y), _n(-20 + y), _n(-15 + y), _n(-9 + y), _n(-9.5 + y), _n(-10 + y), _n(-9.5 + y), _n(-12 + y), _n(-18 + y)], pelo)
	s += _forma("M8 %s L15.5 %s Q18 %s 20.5 %s L25.5 %s Q26.5 %s 23.5 %s L17 %s L13 %s Z" % [_n(-19 + y), _n(-29.5 + y), _n(-31.5 + y), _n(-28.5 + y), _n(-23.5 + y), _n(-20.5 + y), _n(-21.5 + y), _n(-23 + y), _n(-13 + y)], pelo)
	s += _forma("M15.2 %s l0.6 -4.4 l2.4 3.6 Z" % _n(-29.8 + y), pelo, 0.6)
	s += "<circle cx='20.4' cy='%s' r='0.6' fill='#15130e'/>" % _n(-27.0 + y)
	s += _membro([Vector2(15.0, -30.0 + y), Vector2(10.5, -23.0 + y), Vector2(8.0, -19.5 + y)], 1.9, "#2c1c10")
	# sela e cavaleiro
	s += _forma("M-7 %s Q-1 %s 5 %s L4 %s Q-1 %s -6 %s Z" % [_n(-21.0 + y), _n(-23.5 + y), _n(-20.5 + y), _n(-16.5 + y), _n(-15.0 + y), _n(-17.0 + y)], "#4a2f1b")
	var quadril := Vector2(-2.0, -23.0 + y * 1.2)
	var ombro := quadril + Vector2(2.6 if anim == "andar" else 0.6, -9.6)
	var r := 0.0
	var clarao := 0.0
	if anim == "atirar":
		r = [2.2, 1.2, 0.4][k]
		clarao = [1.0, 0.45, 0.0][k]
	var punho := ombro + Vector2(4.6 - r, 3.4)
	var ang := -0.12 - r * 0.08
	s += _braco(ombro + Vector2(0.8, 0.6), punho + Vector2(7.0, -1.0), cores["longe"])
	s += _tronco(quadril, ombro, cores)
	s += _membro([ombro + Vector2(0.6, -1.2), ombro + Vector2(1.2, -4.1)], 2.2, PELE)
	s += _cabeca(ombro + Vector2(1.0, -5.5), cores)
	s += _fuzil(punho, ang, false)
	if clarao > 0.0:
		s += _clarao(punho + Vector2(cos(ang), sin(ang)) * 19.0, ang, clarao)
	s += _braco(ombro + Vector2(-0.4, 1.0), punho, cores["tunica"])
	s += _membro([quadril, Vector2(4.0, -18.0 + y), Vector2(1.5, -11.0 + y)], 4.0, cores["calca"])
	s += _forma("M%s h3 l2.6 2.4 h-6 Z" % _p(Vector2(0.2, -12.0 + y)), BOTA)
	s += _perna_cavalo(Vector2(-10.5, -12.0 + y), t, parado, pelo)
	s += _perna_cavalo(Vector2(9.5, -12.0 + y), t + 3.2, parado, pelo)
	return s

# ------------------------------------------------------------ artilharia e blindado
static func _roda(c: Vector2, r: float, giro: float, aro: String) -> String:
	var s := _circ(c, r, "#23201a", 0.9) + _circ(c, r * 0.76, aro, 0.7)
	for i in 6:
		var a := giro + i * PI / 3.0
		s += "<path d='M%s L%s' stroke='#15130e' stroke-width='1.1'/>" % [_p(c), _p(c + Vector2(cos(a), sin(a)) * r * 0.74)]
	return s + _circ(c, r * 0.24, "#8b8f86", 0.6)

static func _artilharia(anim: String, k: int, cor: Color) -> String:
	if anim == "cair":
		return "<g transform='translate(0 -2) rotate(8)'>" + _artilharia("parado", 0, cor.darkened(0.5)) + "</g>"
	var cores := _cores(cor)
	var r := 0.0
	var clarao := 0.0
	if anim == "atirar":
		r = [4.5, 2.8, 1.0][k]
		clarao = [1.5, 0.8, 0.0][k]
	var giro := k * 0.26 if anim == "andar" else r * 0.12
	var base := Vector2(-r * 0.6, -9.0)
	var s := _membro([base, Vector2(-17.0 - r * 0.6, -1.4)], 3.2, cores["longe"])
	s += _roda(Vector2(5.0 - r * 0.6, -8.4), 8.4, giro + 0.5, cores["longe"])
	s += "<g transform='translate(%s) rotate(-9)'>" % _p(Vector2(-r, -14.5))
	s += _forma("M-8 -3.4 L8 -2.8 L8 2.8 L-8 3.4 Z", cores["tunica"])
	s += _forma("M8 -2.2 L25 -1.7 L25 1.7 L8 2.2 Z", METAL)
	s += _forma("M24 -2.6 h3.4 v5.2 h-3.4 Z", METAL)
	if clarao > 0.0:
		s += _clarao(Vector2(28.0, 0.0), 0.0, clarao)
	s += "</g>"
	s += _forma("M%s q6 -1 7 4 l1 13 q-4 3 -9 0 Z" % _p(Vector2(-1.0 - r * 0.6, -23.0)), cores["tunica_luz"])
	s += _roda(Vector2(-1.0 - r * 0.6, -8.6), 8.8, giro, cores["capacete"])
	return s

static func _blindado(anim: String, k: int, cor: Color) -> String:
	if anim == "cair":
		return "<g transform='translate(0 -2) rotate(5)'>" + _blindado("parado", 0, cor.darkened(0.55)) + "</g>"
	var cores := _cores(cor)
	var r := 0.0
	var clarao := 0.0
	if anim == "atirar":
		r = [3.2, 2.0, 0.7][k]
		clarao = [1.4, 0.7, 0.0][k]
	var giro := k * 0.27 if anim == "andar" else 0.0
	var balanco := (0.7 if k % 2 == 0 else 0.0) if anim == "andar" else 0.0
	var y := -balanco
	var s := "<g transform='translate(%s 0)'>" % _n(-r * 0.4)
	s += _forma("M-20 %s L-17 %s L10 %s L21 %s L22 %s L-19 %s Z" % [_n(-9 + y), _n(-19 + y), _n(-19 + y), _n(-13 + y), _n(-7 + y), _n(-6 + y)], cores["tunica"])
	s += "<path d='M-16 %s L9 %s L18 %s' fill='none' stroke='%s' stroke-width='1.3' stroke-linecap='round'/>" % [_n(-17.4 + y), _n(-17.4 + y), _n(-12.8 + y), cores["tunica_luz"]]
	s += _forma("M-9 %s Q-8 %s -2 %s L5 %s Q9 %s 9 %s Z" % [_n(-19 + y), _n(-28 + y), _n(-28.5 + y), _n(-28 + y), _n(-25 + y), _n(-19 + y)], cores["capacete"])
	s += _forma("M%s h17 v2.8 h-17 Z" % _p(Vector2(8.0 - r, -25.6 + y)), METAL)
	if clarao > 0.0:
		s += _clarao(Vector2(26.0 - r, -24.2 + y), 0.0, clarao)
	s += _circ(Vector2(-2.0, -28.6 + y), 2.6, cores["capacete_luz"])
	for x in [-12.0, -4.0, 4.0]:
		s += _forma("M%s h5 v2.4 h-5 Z" % _p(Vector2(x, -15.0 + y)), "#20241f", 0.6)
	for x in [-12.5, 0.5, 14.0]:
		s += _roda(Vector2(x, -5.6), 5.8, giro, "#4a4f48")
	return s + "</g>"
