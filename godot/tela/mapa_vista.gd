class_name MapaVista
extends Control
## O mapa de províncias: terreno, donos, névoa, exércitos, batalhas e toques (arrastar, pinça, tocar).

signal tocou_exercito(id: String)
signal tocou_provincia(id: String)
signal arrastou_ordem(ex_id: String, prov_id: String)

var j: JogoC
var cam := Vector2(300, 400)
var z := 1.0
var sel_prov := ""
var sel_ex := ""
var rota_previa: Array = []
var previa_ex := ""
var previa_destino := ""
var _terreno: Texture2D
var _fase := -1
var _tris := {}
var _toques := {}
var _inicio := Vector2.ZERO
var _arrastou := false
var _pinca := 0.0
var _festas: Array = []
## puxando um exército seu até o destino
var _puxa_ex := ""       # exército debaixo do dedo quando o toque começou
var _puxando := false
var _puxa_pos := Vector2.ZERO
var _puxa_destino := ""
var _puxa_info := ""
var _voo: Tween
## o chão (terreno, donos, névoa, fronteiras) fica numa camada própria, redesenhada só quando muda;
## arrastar e aproximar só mexem na posição dela
var _fundo := Fundo.new()
var _material_agua: ShaderMaterial
var _chao := Chao.new()
var _fumacas: Array = []  # {"prov", "ini"}: marcas que a luta deixa (tempo do jogo)
## por quanto tempo de jogo o lugar de uma batalha fica marcado
const CICATRIZ_DURA := 120.0
## avião de reconhecimento: de quanto em quanto tempo passa e quanto leva para cruzar a tela
const AVIAO_INTERVALO := 42.0
const AVIAO_VOO := 9.0
var imersao := true
var _aviao_t := 24.0
var _aviao_voltas := 0
var _chao_marca := ""
var _visiveis := {}
var _visiveis_em := -1000
var _desenhado_em := 0
var _camera_desenhada := Vector3.ZERO

## o mar e o terreno ficam numa camada com o efeito de água; ela não precisa ser redesenhada
class Fundo extends Node2D:
	var mapa
	func _draw() -> void:
		draw_rect(Rect2(-3000, -3000, 8000, 8000), Color("1b2c37"))
		if mapa.j:
			draw_texture_rect(mapa._terreno, Rect2(0, 0, mapa.j.mapa_w, mapa.j.mapa_h), false)

## ondas e brilho só onde a cor é de água (azulada)
const AGUA := """shader_type canvas_item;
varying vec2 onde;
void vertex() { onde = VERTEX; }
void fragment() {
	vec4 c = COLOR;
	float mar = smoothstep(0.04, 0.085, c.b - c.r) * step(c.r, 0.28);
	float a = sin(onde.x * 0.045 + TIME * 0.85 + sin(onde.y * 0.027 + TIME * 0.3) * 2.2);
	float b = sin(onde.y * 0.11 - TIME * 0.6 + sin(onde.x * 0.02) * 3.0);
	float brilho = smoothstep(0.72, 1.0, a * b);
	float raso = smoothstep(0.26, 0.36, c.b);
	float espuma = raso * smoothstep(0.55, 1.0, sin(TIME * 1.4 - (onde.x + onde.y) * 0.09));
	c.rgb += mar * (brilho * 0.085 + espuma * 0.07);
	COLOR = c;
}"""

class Chao extends Node2D:
	var mapa
	func _draw() -> void:
		mapa._desenhar_chao(self)

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_fundo.mapa = self
	_fundo.show_behind_parent = true
	var sombreador := Shader.new()
	sombreador.code = AGUA
	var material_agua := ShaderMaterial.new()
	material_agua.shader = sombreador
	_material_agua = material_agua
	_fundo.material = material_agua
	add_child(_fundo)
	_chao.mapa = self
	_chao.show_behind_parent = true
	add_child(_chao)

func usar(jogo: JogoC) -> void:
	j = jogo
	_fase = j.fase["n"]
	_terreno = j.chao if j.chao else load("res://dados/terreno%d.png" % _fase)
	_tris = {}
	_festas = []
	_chao_marca = ""
	_visiveis = {}
	_visiveis_em = -1000
	for p in j.lista_prov:
		_tris[p.id] = Geometry2D.triangulate_polygon(p.poli)
	_fumacas = []
	_fundo.queue_redraw()
	j.batalha_resolvida.connect(func(r): marcar_batalha(r["prov"]))
	j.conquista_feita.connect(func(id, dono, _antigo): _festas.append({"prov": id, "cor": Color(Dados.FACCOES[dono]["cor"]), "ini": Time.get_ticks_msec()}))

func zoom_min() -> float:
	return minf(size.x / j.mapa_w, size.y / j.mapa_h) * 0.95 if j else 0.4

func limitar() -> void:
	if j == null:
		return
	z = clampf(z, zoom_min(), 3.2)
	var m := size / 2.0 / z
	cam.x = j.mapa_w / 2.0 if j.mapa_w <= 2.0 * m.x else clampf(cam.x, m.x, j.mapa_w - m.x)
	cam.y = j.mapa_h / 2.0 if j.mapa_h <= 2.0 * m.y else clampf(cam.y, m.y, j.mapa_h - m.y)

func centralizar(p: Vector2, aproximar := true) -> void:
	cam = p
	if aproximar:
		z = clampf(minf(size.x, size.y * 1.25) / 330.0, zoom_min(), 1.8)
	limitar()

## leva a câmera com suavidade até o ponto; qualquer toque interrompe
func focar(p: Vector2) -> void:
	if not _toques.is_empty() or not is_visible_in_tree():
		return
	if _voo:
		_voo.kill()
	_voo = create_tween()
	_voo.tween_method(func(v: Vector2):
		cam = v
		limitar(), cam, p, 0.55).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

func _desenhar_chefe() -> void:
	if j.chefe_id == "" or j.stats.get("chefe_caiu", false):
		return
	for p in j.lista_prov:
		if p.capital and p.capital_de == j.chefe_dono and p.dono == j.chefe_dono:
			var s := para_tela(p.pos) + Vector2(0, -60)
			_texto(s, "CHEFE: " + str(Dados.CHEFES[j.chefe_id]["nome"]).to_upper(), 14, Color("ffd2c8"), Color(0.42, 0.06, 0.04, 0.92))

func _desenhar_reuniao() -> void:
	if j.reuniao == "" or not j.prov.has(j.reuniao):
		return
	var s := para_tela(j.prov[j.reuniao].pos) + Vector2(-34, 34)
	var onda := sin(Time.get_ticks_msec() / 160.0) * 2.0
	draw_line(s, s + Vector2(0, -34), Color(0, 0, 0, 0.7), 5.0, true)
	draw_line(s, s + Vector2(0, -34), Color("f2ead2"), 2.5, true)
	var pano := PackedVector2Array([s + Vector2(1, -34), s + Vector2(24, -29 + onda), s + Vector2(1, -20)])
	draw_colored_polygon(pano, Color("ffb238"))
	draw_polyline(PackedVector2Array([pano[0], pano[1], pano[2]]), Color(0, 0, 0, 0.7), 1.5, true)

func para_tela(p: Vector2) -> Vector2:
	return (p - cam) * z + size / 2.0

func para_mundo(s: Vector2) -> Vector2:
	return (s - size / 2.0) / z + cam

func zoom_em(fator: float, onde: Vector2) -> void:
	var antes := para_mundo(onde)
	z *= fator
	limitar()
	cam += antes - para_mundo(onde)
	limitar()

func _gui_input(ev: InputEvent) -> void:
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_toques[ev.index] = ev.position
			if _voo:
				_voo.kill()
			if _toques.size() == 1:
				_inicio = ev.position
				_arrastou = false
				var e := _exercito_em(ev.position)
				_puxa_ex = e.id if e else ""
				_puxando = false
			elif _toques.size() == 2:
				_cancelar_puxao()
				var v: Array = _toques.values()
				_pinca = v[0].distance_to(v[1])
				_arrastou = true
		else:
			if _toques.has(ev.index):
				_toques.erase(ev.index)
				if _puxando:
					var de := _puxa_ex
					var para := _puxa_destino
					_cancelar_puxao()
					if para != "":
						arrastou_ordem.emit(de, para)
				elif _toques.is_empty() and not _arrastou:
					_tocar(ev.position)
		accept_event()
	elif ev is InputEventScreenDrag and _toques.has(ev.index):
		var antes: Vector2 = _toques[ev.index]
		_toques[ev.index] = ev.position
		if _toques.size() >= 2:
			var v: Array = _toques.values()
			var d: float = v[0].distance_to(v[1])
			if _pinca > 1.0:
				zoom_em(d / _pinca, (v[0] + v[1]) / 2.0)
			_pinca = d
		else:
			if ev.position.distance_to(_inicio) > 10.0:
				_arrastou = true
			# começou em cima de um exército seu: em vez de mover o mapa, puxa a ordem
			if _puxa_ex != "" and j.fim == "" and (_puxando or ev.position.distance_to(_inicio) > 22.0):
				_puxar(ev.position)
			elif _arrastou and _puxa_ex == "":
				cam -= (ev.position - antes) / z
				limitar()
		accept_event()
	elif ev is InputEventMouseButton and ev.pressed and (ev.button_index == MOUSE_BUTTON_WHEEL_UP or ev.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		zoom_em(1.15 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15, ev.position)

func _exercito_em(s: Vector2) -> ExercitoC:
	if j == null:
		return null
	var melhor: ExercitoC = null
	var dist := 34.0
	for e in j.ex:
		if e.dono == "jogador" and not e.em_batalha:
			var d := (para_tela(e.pos) + Vector2(0, 16)).distance_to(s)
			if d < dist:
				dist = d
				melhor = e
	return melhor

func _provincia_em(s: Vector2) -> String:
	var w := para_mundo(s)
	for p in j.lista_prov:
		if Geometry2D.is_point_in_polygon(w, p.poli):
			return p.id
	return ""

func _tocar(s: Vector2) -> void:
	if j == null or j.fim != "":
		return
	var melhor := _exercito_em(s)
	if melhor:
		tocou_exercito.emit(melhor.id)
		return
	var w := para_mundo(s)
	for p in j.lista_prov:
		if Geometry2D.is_point_in_polygon(w, p.poli):
			tocou_provincia.emit(p.id)
			return

func _puxar(onde: Vector2) -> void:
	var e := j.ex_por_id(_puxa_ex)
	if e == null or e.em_batalha:
		_cancelar_puxao()
		return
	if not _puxando:
		_puxando = true
		SonsC.vibrar(20)
	_puxa_pos = onde
	var alvo := _provincia_em(onde)
	if alvo == e.prov and e.rota.is_empty():
		alvo = ""
	if alvo != _puxa_destino:
		_puxa_destino = alvo
		rota_previa = []
		previa_ex = ""
		_puxa_info = ""
		if alvo != "":
			var c := j.rota_para(e, alvo)
			if c.is_empty():
				_puxa_destino = ""
				_puxa_info = "sem caminho"
			else:
				var p: ProvinciaC = j.prov[alvo]
				_puxa_info = "%s %s · %d s" % ["Mover para" if p.dono == "jogador" else "Atacar", p.nome, ceili(c["dist"] / j.vel_ex(e))]
				previa_ex = e.id
				rota_previa = c["rota"]
	queue_redraw()

func _cancelar_puxao() -> void:
	if _puxando:
		previa_ex = ""
		rota_previa = []
	_puxando = false
	_puxa_ex = ""
	_puxa_destino = ""
	_puxa_info = ""

func puxando() -> bool:
	return _puxando

## a seta que sai do exército e acompanha o dedo
func _desenhar_puxao() -> void:
	if not _puxando:
		return
	var e := j.ex_por_id(_puxa_ex)
	if e == null:
		return
	var de := para_tela(e.pos) + Vector2(0, 20)
	var ate := _puxa_pos
	var cor := Color("ffd28a") if _puxa_destino != "" else Color(1, 1, 1, 0.55)
	var meio := de.lerp(ate, 0.5) + Vector2(0, -minf(60.0, de.distance_to(ate) * 0.25))
	var pontos := PackedVector2Array()
	for i in 17:
		var k := i / 16.0
		pontos.append(de.lerp(meio, k).lerp(meio.lerp(ate, k), k))
	draw_polyline(pontos, Color(0, 0, 0, 0.55), 9.0, true)
	draw_polyline(pontos, cor, 5.0, true)
	var dir := (ate - pontos[14]).normalized()
	var lado := Vector2(-dir.y, dir.x)
	draw_colored_polygon(PackedVector2Array([ate + dir * 12.0, ate - dir * 10.0 + lado * 11.0, ate - dir * 10.0 - lado * 11.0]), cor)
	if _puxa_info != "":
		var pos := Vector2(clampf(ate.x, 110.0, size.x - 110.0), maxf(34.0, ate.y - 58.0))
		_texto(pos, _puxa_info, 17, Color("ffe2a8"), Color(0.05, 0.06, 0.05, 0.9))

func _process(dt: float) -> void:
	_passar_tempo_do_aviao(dt)
	if not (is_visible_in_tree() and j):
		return
	if _toques.is_empty():
		limitar()
	var agora := Time.get_ticks_msec()
	if agora - _visiveis_em >= 250 or _visiveis.is_empty():
		_visiveis_em = agora
		for p in j.lista_prov:
			_visiveis[p.id] = j.visivel(p.id)
		_conferir_chao()
	elif sel_prov + previa_destino != _chao_marca.get_slice("#", 1):
		_conferir_chao()
	_fundo.material = null if ArteC.leve else _material_agua
	_fundo.position = size / 2.0 - cam * z
	_fundo.scale = Vector2(z, z)
	_chao.position = _fundo.position
	_chao.scale = _fundo.scale
	# mexendo no mapa, redesenha na hora; parado, 30 vezes por segundo bastam
	var camera := Vector3(cam.x, cam.y, z)
	if camera != _camera_desenhada or agora - _desenhado_em >= (66 if ArteC.leve else 33):
		_camera_desenhada = camera
		_desenhado_em = agora
		queue_redraw()

func _conferir_chao() -> void:
	var estado := ""
	for p in j.lista_prov:
		estado += "%s%d" % [p.dono, int(_visiveis.get(p.id, false))]
	# a espessura das linhas depende do zoom, em degraus para não redesenhar a cada pinça
	var marca := "%s%d#%s" % [estado, roundi(log(z) * 8.0), sel_prov + previa_destino]
	if marca != _chao_marca:
		_chao_marca = marca
		_chao.queue_redraw()

func _desenhar_chao(c: Node2D) -> void:
	if j == null:
		return
	for p in j.lista_prov:
		var tri: PackedInt32Array = _tris[p.id]
		if tri.is_empty():
			continue
		var cor := Color(Dados.FACCOES[p.dono]["cor"])
		cor.a = 0.1 if p.dono == "neutro" else 0.32
		_pintar(c, p, tri, cor)
		if not _visiveis.get(p.id, false):
			_pintar(c, p, tri, Color(0.04, 0.05, 0.06, 0.34))
	for p in j.lista_prov:
		var fechado: PackedVector2Array = p.poli.duplicate()
		fechado.append(p.poli[0])
		if p.dono != "neutro":
			var cc := Color(Dados.FACCOES[p.dono]["cor"])
			cc.a = 0.85
			c.draw_polyline(fechado, cc, 2.0 / z, true)
		if p.id == sel_prov:
			c.draw_polyline(fechado, Color("ffd28a"), 4.0 / z, true)
		if p.id == previa_destino:
			for i in fechado.size() - 1:
				if i % 2 == 0:
					c.draw_line(fechado[i], fechado[i + 1], Color.WHITE, 4.0 / z)

func _texto(pos: Vector2, txt: String, tam: int, cor: Color, fundo := Color(0, 0, 0, 0)) -> Rect2:
	tam = maxi(tam, Estilo.LETRA_MINIMA)
	var f := Estilo.fonte("titulo")
	var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
	var r := Rect2(pos.x - w / 2.0 - 4, pos.y - tam - 2, w + 8, tam + 7)
	if fundo.a > 0.0:
		draw_rect(r, fundo)
	draw_string(f, Vector2(pos.x - w / 2.0, pos.y), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, cor)
	return r

func _draw() -> void:
	if j == null or _visiveis.is_empty():
		return
	var agora := Time.get_ticks_msec() / 1000.0
	_desenhar_nuvens(agora)
	draw_set_transform(size / 2.0 - cam * z, 0.0, Vector2(z, z))
	for e in j.ex:
		if e.rota.is_empty() or not (e.dono == "jogador" or j.ex_visivel(e)):
			continue
		var cor := Color(Dados.FACCOES[e.dono]["cor"])
		var de: Vector2 = e.pos
		for id in e.rota:
			_tracejado(de, j.prov[id].pos, cor, 2.6 / z)
			de = j.prov[id].pos
		draw_circle(de, 5.0 / z, cor)
	if previa_ex != "" and j.ex_por_id(previa_ex):
		var de: Vector2 = j.ex_por_id(previa_ex).pos
		for id in rota_previa:
			_tracejado(de, j.prov[id].pos, Color.WHITE, 3.0 / z)
			de = j.prov[id].pos
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	_desenhar_fumaca_antiga(agora)
	_desenhar_batalhas(agora)
	_desenhar_exercitos(agora)
	for s in j.espioes:
		var q := para_tela(s["pos"])
		draw_circle(q, 9, Color(0, 0, 0, 0.6))
		draw_texture_rect(Estilo.icone("binoculars"), Rect2(q - Vector2(8, 8), Vector2(16, 16)), false, Color("ffd28a"))
	_desenhar_nomes(_visiveis)
	_desenhar_chefe()
	_desenhar_reuniao()
	_desenhar_festas()
	_desenhar_aviao()
	_desenhar_puxao()

func _pintar(onde: CanvasItem, p: ProvinciaC, tri: PackedInt32Array, cor: Color) -> void:
	var cores := PackedColorArray()
	cores.resize(p.poli.size())
	cores.fill(cor)
	RenderingServer.canvas_item_add_triangle_array(onde.get_canvas_item(), tri, p.poli, cores)

func _tracejado(a: Vector2, b: Vector2, cor: Color, w: float) -> void:
	var total := a.distance_to(b)
	var passo := 11.0 / z
	var dir := (b - a).normalized()
	var x := 0.0
	while x < total:
		draw_line(a + dir * x, a + dir * minf(total, x + passo * 0.6), cor, w)
		x += passo

func _boneco(pos: Vector2, dono: String, tipo: String, andando: bool, fase_anim: float, dir: float, esc: float, lutando := false) -> void:
	var cor := Color(Dados.FACCOES[dono]["cor"])
	ArteC.elipse(self, pos + Vector2(0, 0.5), Vector2(15.0, 5.5) * esc, Color(cor.lightened(0.35), 0.5)) # halo na cor do país
	ArteC.elipse(self, pos + Vector2(0, 0.5), Vector2(10.0, 3.0) * esc, Color(0, 0, 0, 0.4))
	var anim := "parado"
	var k := int(fase_anim * 3.0)
	if andando:
		anim = "andar"
		k = int(fase_anim * 15.0)
	elif lutando:
		var ciclo := fposmod(fase_anim, 0.9)
		anim = "atirar" if ciclo < 0.27 else "mirar"
		k = int(ciclo / 0.09) if ciclo < 0.27 else int(fase_anim * 3.0)
	var viva := Color.from_hsv(cor.h, minf(1.0, cor.s * 1.2), minf(1.0, cor.v * 1.4)) # no mapa o boneco é pequeno: cor mais viva
	var tx := ArteC.quadro(tipo, anim, k, viva, ArteC.RES_MAPA)
	draw_set_transform(pos, 0.0, Vector2(dir, 1))
	draw_texture_rect(tx, ArteC.retangulo(Vector2.ZERO, 1.1 * esc), false)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _figuras(tipos: Dictionary, quantos: int) -> Array:
	var l: Array = tipos.keys()
	l.sort_custom(func(a, b): return tipos[a] > tipos[b])
	if l.is_empty():
		l = ["inf"]
	var fig: Array = l.slice(0, quantos)
	while fig.size() < quantos:
		fig.append(l[0])
	return fig

func _desenhar_exercitos(agora: float) -> void:
	var grupos := {}
	for e in j.ex:
		if e.em_batalha or not j.ex_visivel(e):
			continue
		var chave: String = e.id if not e.rota.is_empty() else e.prov + "|" + e.dono
		if not grupos.has(chave):
			grupos[chave] = {"e": e, "n": 0, "tipos": {}, "hp": 0.0, "max": 0.0, "sel": false}
		var g: Dictionary = grupos[chave]
		g["sel"] = g["sel"] or e.id == sel_ex
		g["n"] += e.s.size()
		for s in e.s:
			g["hp"] += maxf(0.0, s.vida)
			g["max"] += s.vida_max()
			g["tipos"][s.tipo] = g["tipos"].get(s.tipo, 0) + 1
	var esc := clampf(z * 0.85, 0.72, 1.35)
	for g in grupos.values():
		var e: ExercitoC = g["e"]
		var s := para_tela(e.pos) + Vector2(0, 39)
		if s.x < -60 or s.y < -60 or s.x > size.x + 60 or s.y > size.y + 80:
			continue
		var cor := Color(Dados.FACCOES[e.dono]["cor"])
		var andando := not e.rota.is_empty()
		var dir := 1.0
		if andando:
			dir = 1.0 if j.prov[e.rota[0]].pos.x >= e.pos.x else -1.0
		if g["sel"]:
			draw_set_transform(s, 0.0, Vector2(1, 0.4))
			draw_arc(Vector2.ZERO, 26 * esc, 0, TAU, 36, Color.WHITE, 3.0, true)
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		# longe: só um marcador com a quantidade (o mapa não fica poluído)
		var longe := z < 0.72
		var meia := 0.0
		if not longe:
			var quantos := 3 if g["n"] >= 10 else (2 if g["n"] >= 4 else 1)
			var fig := _figuras(g["tipos"], quantos)
			var folga := (30.0 if fig.any(func(t): return t in ["art", "cav", "blind"]) else 14.0) * esc
			for k in range(quantos - 1, -1, -1):
				_boneco(s + Vector2((k - (quantos - 1) / 2.0) * folga * dir, -k * 2.0), e.dono, fig[k], andando, agora + k * 0.13, dir, esc)
			meia = (quantos - 1) / 2.0 * folga + 12.0 * esc
		var txt := str(g["n"])
		var larg := maxf(22.0, Estilo.fonte().get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x + 10.0)
		var placa := Rect2(s.x + meia, s.y - 28, larg, 19) if not longe else Rect2(s.x - larg / 2.0, s.y - 14, larg, 19)
		draw_rect(placa, cor)
		draw_rect(placa, Color("ff9f43") if e.sem_suprimento else Color(0, 0, 0, 0.7), false, 2.0 if e.sem_suprimento else 1.0)
		draw_string(Estilo.fonte(), placa.position + Vector2((larg - Estilo.fonte().get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x) / 2.0, 15), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("0d0f0c"))
		if not longe:
			var x := placa.end.x + 3.0
			for tipo in Dados.TROPAS:
				if tipo != "inf" and g["tipos"].has(tipo):
					draw_rect(Rect2(x, placa.position.y, 15, 19), Color(Dados.TROPAS[tipo]["cor"]))
					draw_string(Estilo.fonte(), Vector2(x + 3, placa.position.y + 15), Dados.TROPAS[tipo]["letra"], HORIZONTAL_ALIGNMENT_LEFT, -1, Estilo.LETRA_MINIMA, Color("111111"))
					x += 17.0
			var v: float = g["hp"] / g["max"] if g["max"] > 0.0 else 1.0
			draw_rect(Rect2(s.x - 22, s.y + 4, 44, 6), Color(0, 0, 0, 0.75))
			draw_rect(Rect2(s.x - 21, s.y + 5, 42 * v, 4), Estilo.VERDE if v > 0.66 else (Estilo.AMARELO if v > 0.33 else Estilo.VERMELHO))
		if e.general != "" and e.dono == "jogador":
			draw_string(Estilo.fonte(), s + Vector2(-meia - 14, -18), "★", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("ffd28a"))

## sombras de nuvem passando devagar
func _desenhar_nuvens(agora: float) -> void:
	for i in (0 if ArteC.leve else 4):
		var largura: float = j.mapa_w + 500.0
		var mundo := Vector2(fposmod(agora * (9.0 + i * 2.5) + i * 370.0, largura) - 250.0, j.mapa_h * (0.12 + i * 0.23) + sin(agora * 0.08 + i * 2.0) * 60.0)
		var q := para_tela(mundo)
		for k in 3:
			ArteC.elipse(self, q + Vector2((k - 1) * 70.0, absf(k - 1) * 14.0) * z, Vector2(95.0 - absf(k - 1) * 20.0, 48.0 - absf(k - 1) * 9.0) * z, Color(0.0, 0.02, 0.04, 0.055))

## coluna de fumaça subindo; `forca` de 0 a 1
func _coluna_de_fumaca(base: Vector2, agora: float, semente: int, forca: float) -> void:
	for k in (3 if ArteC.leve else 7):
		var fase := fposmod(agora * 0.34 + k / 7.0 + semente * 0.13, 1.0)
		var q := base + Vector2(sin(k * 2.3 + semente) * 9.0 + fase * 26.0, -fase * 78.0) * z
		var raio := (6.0 + fase * 17.0) * z
		var tom := 0.16 + fase * 0.34
		ArteC.elipse(self, q, Vector2(raio, raio * 0.86), Color(tom, tom * 0.96, tom * 0.9, 0.5 * (1.0 - fase) * forca))

## uma luta acabou aqui: o chão fica com crateras e fumaça (outra no mesmo lugar renova)
func marcar_batalha(prov_id: String) -> void:
	_fumacas = _fumacas.filter(func(x): return x["prov"] != prov_id)
	_fumacas.append({"prov": prov_id, "ini": j.t})

## crateras, fogo no começo e fumaça que vai sumindo
func _desenhar_fumaca_antiga(agora: float) -> void:
	_fumacas = _fumacas.filter(func(x): return j.t - x["ini"] < CICATRIZ_DURA and j.t >= x["ini"])
	for f in _fumacas:
		if not j.prov.has(f["prov"]):
			continue
		var idade: float = (j.t - f["ini"]) / CICATRIZ_DURA
		var resta := 1.0 - idade
		var q := para_tela(j.prov[f["prov"]].pos)
		if q.x < -80 or q.y < -80 or q.x > size.x + 80 or q.y > size.y + 80:
			continue
		var semente: int = absi(hash(f["prov"]))
		for k in 7:
			var onde := q + Vector2(fmod(semente / 7.0 + k * 53.0, 90.0) - 45.0, fmod(semente / 13.0 + k * 31.0, 52.0) - 14.0) * z
			var raio := (4.0 + (k % 3) * 2.2) * z
			ArteC.elipse(self, onde, Vector2(raio * 1.35, raio * 0.72), Color(0.45, 0.36, 0.24, 0.55 * minf(1.0, resta * 2.5)))
			ArteC.elipse(self, onde + Vector2(0, raio * 0.1), Vector2(raio, raio * 0.5), Color(0.09, 0.07, 0.05, 0.8 * minf(1.0, resta * 2.5)))
		if idade < 0.28:
			for k in 2:
				var chama := q + Vector2(30 - k * 62, 14 + k * 9) * z
				var pulsa := 0.75 + 0.25 * sin(agora * 11.0 + k * 2.0)
				ArteC.elipse(self, chama, Vector2(4.0, 7.0 * pulsa) * z, Color(1.0, 0.45, 0.12, 0.9 * (1.0 - idade / 0.28)))
				ArteC.elipse(self, chama + Vector2(0, 2) * z, Vector2(2.2, 3.6 * pulsa) * z, Color(1.0, 0.86, 0.4, 0.9 * (1.0 - idade / 0.28)))
		_coluna_de_fumaca(q + Vector2(26, 10) * z, agora, 1, resta)
		_coluna_de_fumaca(q + Vector2(-30, 22) * z, agora, 4, resta * 0.7)

## um avião de reconhecimento cruza o mapa de vez em quando, com a sombra no chão
func _desenhar_aviao() -> void:
	if not imersao or ArteC.leve or _aviao_t >= 0.0:
		return
	var k := 1.0 + _aviao_t / AVIAO_VOO # 0 ao entrar, 1 ao sair
	var ida := _aviao_voltas % 2 == 0
	var x := lerpf(-60.0, size.x + 60.0, k if ida else 1.0 - k)
	var y := size.y * (0.18 + fmod(_aviao_voltas * 0.31, 0.5)) + sin(k * PI) * 30.0
	var dir := 1.0 if ida else -1.0
	for sombra in [true, false]:
		var centro := Vector2(x, y) + (Vector2(26, 44) if sombra else Vector2.ZERO)
		var tinta := Color(0, 0, 0, 0.2) if sombra else Color("5d6650")
		draw_set_transform(centro, 0.0, Vector2(dir, 1.0) * (0.85 if sombra else 1.0))
		draw_colored_polygon(PackedVector2Array([Vector2(18, 0), Vector2(12, -3), Vector2(-16, -2), Vector2(-20, 0), Vector2(-16, 2), Vector2(12, 3)]), tinta)
		draw_colored_polygon(PackedVector2Array([Vector2(6, -1), Vector2(-2, -22), Vector2(-7, -22), Vector2(-4, 0), Vector2(-7, 22), Vector2(-2, 22), Vector2(6, 1)]), tinta.lightened(0.0 if sombra else 0.12))
		draw_colored_polygon(PackedVector2Array([Vector2(-14, 0), Vector2(-19, -8), Vector2(-22, -8), Vector2(-20, 0), Vector2(-22, 8), Vector2(-19, 8)]), tinta)
		if not sombra:
			draw_line(Vector2(19, -7), Vector2(19, 7), Color(0.9, 0.9, 0.85, 0.5), 1.5)
			draw_circle(Vector2(-3, -15), 2.4, Color("c8503c"))
			draw_circle(Vector2(-3, 15), 2.4, Color("c8503c"))
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _passar_tempo_do_aviao(dt: float) -> void:
	if j == null or j.pausado:
		return
	_aviao_t -= dt
	if _aviao_t < -AVIAO_VOO:
		_aviao_t = AVIAO_INTERVALO
		_aviao_voltas += 1

func _desenhar_batalhas(agora: float) -> void:
	for b in j.batalhas:
		var p: ProvinciaC = b.alvo
		if not (j.visivel(p.id) or b.atq_dono == "jogador" or b.def_dono == "jogador"):
			continue
		var s := para_tela(p.pos)
		_coluna_de_fumaca(s + Vector2(22, 6) * z, agora, 2, 1.0)
		_coluna_de_fumaca(s + Vector2(-26, 16) * z, agora, 5, 0.8)
		var pulso := 0.5 + 0.5 * sin(agora * 6.0)
		draw_arc(s + Vector2(0, 6), 34 + 6 * pulso, 0, TAU, 40, Color(1, 0.43, 0.24, 0.45 + 0.4 * pulso), 4.0)
		var de: Vector2 = j.prov[b.ex.de].pos if j.prov.has(b.ex.de) and b.ex.de != p.id else p.pos + Vector2(-40, 30)
		var dir := (para_tela(de) - s).normalized()
		var a := s + dir * 34.0 + Vector2(0, 18)
		for k in 4:
			var ini := a + Vector2(randf_range(-10, 10), randf_range(-10, 6))
			draw_line(ini, ini.lerp(s + Vector2(0, 4), randf()), Color(1, 0.88, 0.54, 0.8), 1.5)
		if randf() < 0.35:
			draw_circle(s + Vector2(randf_range(-18, 18), randf_range(-12, 14)), randf_range(3, 8), Color(1, 0.66, 0.27, 0.85))
		var tipo_a: String = b.atq[0].s.tipo if not b.atq.is_empty() else "inf"
		var tipo_d: String = b.def[0].s.tipo if not b.def.is_empty() else "inf"
		_boneco(a, b.atq_dono, tipo_a, false, agora, 1.0 if dir.x < 0.0 else -1.0, 1.0, not j.pausado)
		_boneco(s + Vector2(0, 20), b.def_dono, tipo_d, false, agora + 0.45, -1.0 if dir.x < 0.0 else 1.0, 1.0, not j.pausado)
		_texto(s + Vector2(0, 44), "%d x %d" % [b.vivos("atq").size(), b.vivos("def").size()], 15, Color("ffd2a8"), Color(0.16, 0.04, 0.02, 0.88))

func _desenhar_nomes(visiveis: Dictionary) -> void:
	var ocupados: Array = []
	var ordem := j.lista_prov.duplicate()
	ordem.sort_custom(func(a, b): return int(a.capital) * 2 + int(a.dono == "jogador") > int(b.capital) * 2 + int(b.dono == "jogador"))
	for p in ordem:
		var s := para_tela(p.pos)
		if s.x < -70 or s.y < -40 or s.x > size.x + 70 or s.y > size.y + 60:
			continue
		var tam := 16 if p.capital else Estilo.LETRA_MINIMA
		var txt: String = ("★ " if p.capital else "") + p.nome.to_upper()
		var w := Estilo.fonte().get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
		var r := Rect2(s.x - w / 2.0 - 4, s.y - 36, w + 8, tam + 7)
		if not p.capital and ocupados.any(func(o): return o.intersects(r)):
			continue
		ocupados.append(r)
		_texto(Vector2(s.x, r.position.y + tam + 2), txt, tam, Color("ffe2a8") if p.capital else Color("efe6cf"), Color(0.05, 0.06, 0.05, 0.74))
		if visiveis[p.id]:
			var marcas := ""
			if p.tem_obra("forte") or p.trinch >= 80.0:
				marcas += "▣ "
			if p.dono == "jogador" and not p.obra.is_empty():
				marcas += "+ "
			if p.dono == "jogador" and not p.capital and p.moral < 35.0:
				marcas += "! "
			if p.dono != "jogador" and j.rel.has(p.dono) and j.rel[p.dono]["estado"] != "guerra":
				marcas += "PAZ" if j.rel[p.dono]["estado"] == "paz" else "ALIADO"
			if marcas != "":
				_texto(Vector2(s.x, r.position.y - 3), marcas.strip_edges(), 12, Color("ffb36b"), Color(0.05, 0.06, 0.05, 0.74))
		# o que a sua província rende, quando o mapa está perto
		if p.dono == "jogador" and z >= 1.25:
			var pd := j.producao_de(p)
			var x := s.x - 68.0
			var linha := Rect2(s.x - 70, r.position.y - 24, 140, 20)
			var itens := [["bread", "comida"], ["bullets", "mun"], ["two-coins", "moedas"], ["cog", "aco"]].filter(func(i): return pd[i[1]] > 0.04)
			linha.size.x = itens.size() * 39.0 + 4.0
			linha.position.x = s.x - linha.size.x / 2.0
			x = linha.position.x + 3.0
			draw_rect(linha, Color(0.05, 0.06, 0.05, 0.74))
			for i in itens:
				draw_texture_rect(Estilo.icone(i[0]), Rect2(x, linha.position.y + 4, 12, 12), false, Color("e6c35a"))
				draw_string(Estilo.fonte(), Vector2(x + 13, linha.position.y + 15), str(snappedf(pd[i[1]], 1.0) if pd[i[1]] >= 1.0 else snappedf(pd[i[1]], 0.1)), HORIZONTAL_ALIGNMENT_LEFT, -1, Estilo.LETRA_MINIMA, Color("cfe8c8") if p.moral >= 35.0 else Color("ffb36b"))
				x += 39.0

func _desenhar_festas() -> void:
	var agora := Time.get_ticks_msec()
	_festas = _festas.filter(func(f): return agora - f["ini"] < 2200)
	for f in _festas:
		var p: ProvinciaC = j.prov[f["prov"]]
		var k: float = (agora - f["ini"]) / 2200.0
		var s := para_tela(p.pos)
		var cor: Color = f["cor"]
		cor.a = 0.55 * (1.0 - k) * (0.6 + 0.4 * absf(sin(k * 14.0)))
		draw_set_transform(size / 2.0 - cam * z, 0.0, Vector2(z, z))
		_pintar(self, p, _tris[p.id], cor)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		var sobe := minf(1.0, k * 2.2)
		var topo := s.y + 10.0 - 62.0 * sobe
		draw_rect(Rect2(s.x - 1.5, topo, 3, s.y + 10.0 - topo), Color("e8e4d0"))
		var pano := PackedVector2Array()
		for i in 7:
			pano.append(Vector2(s.x + 1.5 + i * 5.0, topo + sin(agora / 90.0 - i * 0.9) * i * 0.6))
		for i in range(6, -1, -1):
			pano.append(Vector2(s.x + 1.5 + i * 5.0, topo + 17.0 + sin(agora / 90.0 - i * 0.9) * i * 0.6))
		var cheia: Color = f["cor"]
		draw_colored_polygon(pano, cheia)
		cheia.a = 1.0 - k
		draw_arc(s, 18 + 60 * k, 0, TAU, 40, cheia, 4.0)
