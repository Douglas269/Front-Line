class_name BatalhaCena
extends Control
## A batalha animada. Não decide nada: mostra o que acontece na BatalhaC do jogo e manda as ordens do jogador para ela.

signal fechar()

const ESC := 2.65

## hora do dia: céu de cima, céu do horizonte, cor do sol ou da lua, onde fica, luz sobre o chão e sobre a tropa, nuvens
const HORAS := {
	"manha": {"nome": "Amanhecer", "a": Color(0.3, 0.42, 0.62), "b": Color(0.97, 0.76, 0.62), "astro": Color(1.0, 0.92, 0.72), "onde": Vector2(0.78, 62), "luz": Color(1.0, 0.95, 0.92), "tropa": Color(1.0, 0.97, 0.95), "nuvem": Color(1.0, 0.85, 0.8, 0.22)},
	"dia": {"nome": "Dia", "a": Color(0.32, 0.52, 0.75), "b": Color(0.77, 0.86, 0.91), "astro": Color(1.0, 0.98, 0.86), "onde": Vector2(0.24, 128), "luz": Color(1.2, 1.2, 1.15), "tropa": Color(1.08, 1.08, 1.06), "nuvem": Color(1.0, 1.0, 1.0, 0.28)},
	"tarde": {"nome": "Entardecer", "a": Color(0.17, 0.2, 0.29), "b": Color(0.87, 0.56, 0.33), "astro": Color(1.0, 0.86, 0.58), "onde": Vector2(0.19, 76), "luz": Color.WHITE, "tropa": Color.WHITE, "nuvem": Color(0.95, 0.8, 0.72, 0.2)},
	"noite": {"nome": "Noite", "a": Color(0.025, 0.04, 0.09), "b": Color(0.13, 0.18, 0.3), "astro": Color(0.88, 0.92, 1.0), "onde": Vector2(0.8, 118), "luz": Color(0.5, 0.57, 0.8), "tropa": Color(0.72, 0.78, 0.95), "nuvem": Color(0.45, 0.52, 0.7, 0.12)}
}
const CLIMAS := {"limpo": "", "chuva": "chuva", "neblina": "neblina", "neve": "neve"}
const LUGARES := {"": "", "ruinas": "cidade em ruínas", "ponte": "junto à ponte", "pantano": "chão alagado"}
## os testes podem forçar um cenário
static var forcar := {}

class Boneco:
	extends Node2D
	var cena
	var c: BatalhaC.Combatente
	var cor: Color
	var sprite := Sprite2D.new()
	var quadro := randf() * 8.0
	var passada := randf() * 12.0 # avança com o chão percorrido, para os pés não escorregarem
	var atirando := 0.0
	var recarga := 0.0
	var troca_postura := 0.0
	var estava_deitado := false
	var clarao := 0.0
	var tremor := 0.0
	var morto := false
	var tempo_morto := 0.0
	var andando := false
	var andar_ate := 0.0
	var deitado := false
	var agachado := false # defensor abrigado
	var comemorando := false
	var posto := 0
	var _marca := ""

	func montar() -> void:
		sprite.centered = false
		sprite.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		sprite.scale = Vector2.ONE / ArteC.RES
		add_child(sprite)
		estava_deitado = deitado
		atualizar(0.0)

	## qual animação e qual quadro mostrar agora
	func _pose() -> Array:
		var tipo: String = c.s.tipo
		var veiculo := tipo == "art" or tipo == "cav" or tipo == "blind"
		if morto:
			return ["cair", 0 if veiculo else mini(6, int(tempo_morto / 0.085))]
		if veiculo:
			if atirando > 0.05:
				return ["atirar", 0 if atirando > 0.23 else (1 if atirando > 0.14 else 2)]
			if andando:
				return ["andar", int(passada * (1.0 if tipo == "cav" else 0.7))]
			return ["parado", int(quadro * 0.25)]
		if comemorando:
			return ["festa", int(quadro * 0.8)]
		if troca_postura > 0.0:
			return ["abaixar", 0]
		if atirando > 0.05:
			return ["deitado_atirar" if deitado else "atirar", 0 if atirando > 0.23 else (1 if atirando > 0.14 else 2)]
		if deitado:
			return ["deitado", int(quadro * 0.22)]
		if agachado:
			return ["abaixar", 0]
		if andando:
			return ["andar", int(passada)]
		if recarga > 0.0 and tipo != "metr":
			return ["recarregar", mini(3, int((0.8 - recarga) / 0.2))]
		return ["mirar", int(quadro * 0.22)]

	func atualizar(dt: float) -> void:
		quadro += dt * 11.0
		var antes := atirando
		atirando = maxf(0.0, atirando - dt)
		if antes > 0.0 and atirando <= 0.0 and not deitado and randf() < 0.35:
			recarga = 0.8
			if c.s.tipo == "inf" and cena != null and randf() < 0.35:
				cena.tela.sons.tocar("ferrolho", -14.0)
		recarga = maxf(0.0, recarga - dt)
		troca_postura = maxf(0.0, troca_postura - dt)
		clarao = maxf(0.0, clarao - dt * 6.0)
		tremor = maxf(0.0, tremor - dt * 6.0)
		if deitado != estava_deitado:
			estava_deitado = deitado
			troca_postura = 0.18
		if morto:
			tempo_morto += dt
			modulate = Color.WHITE.lerp(Color(0.62, 0.57, 0.53), clampf((tempo_morto - 0.9) / 1.5, 0.0, 1.0))
		var pose := _pose()
		sprite.texture = ArteC.quadro(c.s.tipo, pose[0], pose[1], cor)
		# o impacto empurra o corpo um pouco para trás
		sprite.position = -ArteC.ORIGEM + Vector2(randf_range(-1.0, 1.0) * tremor - tremor * 0.9, 0.0)
		sprite.self_modulate = Color.WHITE.lerp(Color(2.2, 1.5, 1.35), clarao)
		var marca := "%d|%d|%d|%d" % [roundi(c.s.vida), int(morto), c.s.patente(), int(deitado)]
		if marca != _marca:
			_marca = marca
			queue_redraw()

	func _draw() -> void:
		ArteC.elipse(self, Vector2.ZERO, Vector2(10.0, 3.4), Color(0, 0, 0, 0.32))
		if morto:
			return
		var topo := -20.0 if deitado else -46.0
		var f := clampf(c.s.vida / c.s.vida_max(), 0.0, 1.0)
		if f < 0.999:
			draw_rect(Rect2(-9, topo, 18, 3), Color(0, 0, 0, 0.7))
			draw_rect(Rect2(-9, topo, 18 * f, 3), Estilo.VERDE if f > 0.66 else (Estilo.AMARELO if f > 0.33 else Estilo.VERMELHO))
		if c.s.patente() > 0 and c.lado == cena.b.lado_do_jogador():
			# o texto é desenhado sem a ampliação (e sem espelhar quando o soldado recua)
			var inverso := Vector2(1.0 / scale.x, 1.0 / absf(scale.y))
			draw_set_transform(Vector2(0, topo - 3), 0.0, inverso)
			var texto := ("★★ " if c.s.patente() == 2 else "★ ") + c.s.nome
			var fonte := Estilo.fonte("titulo")
			var larg := fonte.get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			draw_string_outline(fonte, Vector2(-larg / 2.0, 0), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0, 0, 0, 0.8))
			draw_string(fonte, Vector2(-larg / 2.0, 0), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("ffd28a"))
			draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

var tela
var j: JogoC
var b: BatalhaC
var bonecos := {}
var mundo := Node2D.new()
var ceu := Node2D.new()
var ceu_vivo := Node2D.new() # nuvens
var cenario := Node2D.new() # morros, casas, chão: desenhado uma vez só
var neve := Node2D.new()
var _painel_em := 0.0
var amb := {"hora": "tarde", "clima": "limpo", "lugar": ""}
var _sinalizador := 0.0       # quanto falta para o próximo, à noite
var _quadro_cenario: Sprite2D
var _nevoa := Node2D.new()
var marcas := Node2D.new()
var tropas := Node2D.new()
var efeitos := Node2D.new()
var recorte := Control.new()
var largura := 540.0
var altura := 560.0
var chao := 200.0
var trincheira_x := 380.0
var tempo := 0.0
var tremor := 0.0
var buracos: Array = []
var nuvens: Array = []
var _longe := 1.0
var _erro := 0.0
var _granadas := {}
var _acabou := false
var _resumo := {}
var _painel := PainelC.new()
var _clarao := ColorRect.new()
var _faixa := Label.new()
var _fx: Texture2D = preload("res://arte/atlas.png")

func abrir(t, batalha: BatalhaC) -> void:
	tela = t
	j = t.jogo
	b = batalha
	b.observada = true
	b.acontecimentos.clear()
	amb = ambiente(b.alvo.id, b.ex.id, b.alvo.tipo, j.tem_regra("inverno"))
	amb.merge(forcar, true)

static func ambiente(prov_id: String, ex_id: String, tipo: String, inverno: bool) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%s|%s" % [prov_id, ex_id])
	var hora: String = ["manha", "dia", "dia", "tarde", "tarde", "noite"][rng.randi() % 6]
	var clima: String = ["limpo", "limpo", "limpo", "chuva", "neblina"][rng.randi() % 5]
	if inverno:
		clima = "neve"
	var lugar := ""
	if (tipo == "cidade" or tipo == "capital") and rng.randf() < 0.55:
		lugar = "ruinas"
	elif tipo == "campo" and rng.randf() < 0.45:
		lugar = "ponte" if rng.randf() < 0.65 else "pantano"
	elif tipo == "floresta" and rng.randf() < 0.3:
		lugar = "pantano"
	return {"hora": hora, "clima": clima, "lugar": lugar}

func nome_do_ambiente() -> String:
	var partes: Array = [HORAS[amb["hora"]]["nome"]]
	for t in [CLIMAS[amb["clima"]], LUGARES[amb["lugar"]]]:
		if t != "":
			partes.append(t)
	return " · ".join(partes)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	var fundo := ColorRect.new()
	fundo.color = Estilo.FUNDO
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(fundo)
	largura = size.x
	altura = maxf(380.0, size.y * 0.56)
	chao = altura * 0.36
	trincheira_x = largura * 0.7
	recorte.clip_contents = true
	recorte.size = Vector2(largura, altura)
	recorte.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(recorte)
	recorte.add_child(mundo)
	var foto := SubViewport.new()
	foto.size = Vector2i(int(largura) + 60, int(altura) + 30) * 3
	foto.transparent_bg = true
	foto.disable_3d = true
	foto.render_target_update_mode = SubViewport.UPDATE_ONCE
	cenario.position = Vector2(90, 0)
	cenario.scale = Vector2(3, 3)
	cenario.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	foto.add_child(cenario)
	add_child(foto)
	var quadro := Sprite2D.new()
	quadro.centered = false
	quadro.position = Vector2(-30, 0)
	quadro.scale = Vector2.ONE / 3.0
	quadro.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	quadro.texture = foto.get_texture()
	_quadro_cenario = quadro
	var H: Dictionary = HORAS[amb["hora"]]
	var luz: Color = H["luz"]
	var tropa: Color = H["tropa"]
	if amb["clima"] == "chuva":
		luz *= Color(0.82, 0.86, 0.92)
		tropa *= Color(0.9, 0.93, 0.97)
	quadro.modulate = luz
	marcas.modulate = luz
	tropas.modulate = tropa
	for n in [ceu, ceu_vivo, quadro, marcas, tropas, _nevoa, neve, efeitos]:
		mundo.add_child(n)
	_nevoa.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	_nevoa.draw.connect(_desenhar_nevoa)
	_sinalizador = randf_range(1.5, 4.0)
	tela.sons.ambiente("chuva" if amb["clima"] == "chuva" else ("vento" if amb["clima"] != "limpo" or amb["hora"] == "noite" else ""))
	tropas.y_sort_enabled = true
	ceu.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	ceu_vivo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	marcas.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	ceu.draw.connect(_desenhar_ceu)
	ceu_vivo.draw.connect(_desenhar_nuvens)
	cenario.draw.connect(_desenhar_cenario)
	neve.draw.connect(_desenhar_neve)
	marcas.draw.connect(_desenhar_buracos)
	for i in 5:
		nuvens.append([randf_range(0, largura), randf_range(20, chao * 0.55), randf_range(0.7, 1.4), randf_range(3, 9)])
	for i in 22:
		buracos.append([Vector2(randf_range(30, trincheira_x - 40), randf_range(chao + 30, altura - 14)), randf_range(5, 13)])
	var faixa_y := altura - chao - 70.0
	for i in 9:
		var saco := Node2D.new()
		saco.position = Vector2(trincheira_x + sin(i * 1.7) * 6.0, chao + 44 + (faixa_y + 18.0) * i / 8.0)
		var forca_trinch := b.alvo.trinch / 100.0
		saco.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		saco.draw.connect(_desenhar_sacos.bind(saco, i, forca_trinch))
		tropas.add_child(saco)
	_clarao.color = Color(1, 0.8, 0.5, 0)
	_clarao.size = Vector2(largura, altura)
	_clarao.mouse_filter = Control.MOUSE_FILTER_IGNORE
	recorte.add_child(_clarao)
	_painel.position = Vector2(0, altura)
	_painel.size = Vector2(largura, size.y - altura)
	add_child(_painel)
	var linha := ColorRect.new()
	linha.color = Color(Estilo.AMBAR, 0.6)
	linha.position = Vector2(0, altura)
	linha.size = Vector2(largura, 2)
	add_child(linha)
	var nome := Estilo.contornar(Estilo.rotulo("BATALHA DE %s" % b.alvo.nome.to_upper(), 24, Color("ffdb94"), "marca", true))
	nome.position = Vector2(0, 8)
	nome.size = Vector2(largura, 32)
	recorte.add_child(nome)
	_faixa = Estilo.contornar(Estilo.rotulo("%s x %s" % [j.nome_de(b.atq_dono), j.nome_de(b.def_dono)], 17, Estilo.TEXTO, "titulo", true))
	_faixa.position = Vector2(0, 42)
	_faixa.size = Vector2(largura, 26)
	recorte.add_child(_faixa)
	var onde := Estilo.contornar(Estilo.rotulo(nome_do_ambiente(), 13, Color("c9d2c4"), "titulo", true))
	onde.position = Vector2(0, 66)
	onde.size = Vector2(largura, 20)
	recorte.add_child(onde)
	_atualizar_painel()

## quão apertada está a luta: mais forte quando está parelha, quando perdemos gente e com artilharia no ar
func aperto() -> float:
	if b == null or b.terminou:
		return 0.0
	var lado := b.lado_do_jogador() if b.lado_do_jogador() != "" else "atq"
	var parte := b.parte_de(lado)
	var mortos := b.lista(lado).filter(func(c): return c.s.vida <= 0.0).size()
	var v := 0.28 + (1.0 - absf(parte - 0.5) * 2.0) * 0.3 + minf(0.25, float(mortos) / maxf(1.0, b.lista(lado).size()))
	if parte < 0.4:
		v += 0.2
	if b.art_a_caminho(lado) or b.carga_ativa():
		v += 0.3
	return clampf(v, 0.0, 1.0)

func encerrar() -> void:
	if tela:
		tela.sons.tensao(0.0)
		tela.sons.ambiente("")
	if b:
		b.observada = false
		b.acontecimentos.clear()
	Engine.time_scale = 1.0

func resultado(r: Dictionary) -> void:
	if b and r["prov"] == b.alvo.id:
		_resumo = r

func _atualizar_painel() -> void:
	var blocos: Array = []
	if not _acabou:
		var lado := b.lado_do_jogador()
		var parte := b.parte_de(lado if lado != "" else "atq")
		blocos.append({"tipo": "texto", "t": "Você [b]%d[/b]  x  [b]%d[/b] %s" % [b.vivos(lado if lado != "" else "atq").size(), b.vivos(BatalhaC.outro(lado) if lado != "" else "def").size(), j.nome_de(b.def_dono if lado == "atq" else b.atq_dono)], "tam": 20, "cor": Estilo.TEXTO})
		blocos.append({"tipo": "barra", "v": snappedf(parte, 0.02), "t": "ganhando" if parte >= 0.6 else ("perdendo" if parte <= 0.4 else "parelha"), "cor": Estilo.VERDE if parte >= 0.6 else (Estilo.VERMELHO if parte <= 0.4 else Estilo.AMARELO)})
		if lado != "":
			if b.art_a_caminho(lado):
				blocos.append({"tipo": "alerta", "t": "ARTILHARIA A CAMINHO: toque em %s" % ("Cobertura" if lado == "atq" else "Abrigar")})
			var posturas: Array = [["avancar", "AVANÇAR", "rápido, exposto"], ["cobertura", "COBERTURA", "deita e se protege"], ["recuar", "RECUAR", "salva a tropa"]] if lado == "atq" else [["atacar", "ATACAR", "mais fogo, mais risco"], ["equilibrio", "EQUILÍBRIO", "padrão"], ["abrigar", "ABRIGAR", "protege da artilharia"]]
			var atual := b.post_atq if lado == "atq" else b.post_def
			var lista: Array = []
			for q in posturas:
				var id: String = q[0]
				lista.append({"t": q[1], "sub": q[2], "f": func(): tela.postura(b, id), "forte": atual == id, "perigo": b.art_a_caminho(lado) and id in ["cobertura", "abrigar"]})
			var custo := int(j.custo_artilharia("jogador"))
			lista.append({"t": "ARTILHARIA", "sub": ("a caminho…" if b.art_a_caminho(BatalhaC.outro(lado)) else "já usada") if b.usou_art else "%d de munição" % custo, "f": func(): tela.artilharia(b), "off": b.usou_art or j.fac["jogador"]["mun"] < custo})
			blocos.append({"tipo": "botoes", "lista": lista, "colunas": 2})
			blocos.append(tela.paineis.taticas(b))
		blocos.append({"tipo": "botoes", "colunas": 2, "lista": [{"t": "Resolver rápido", "sub": "termina já", "f": func(): tela.resolver(b)}, {"t": "Ver o mapa", "sub": "a luta continua", "f": func(): fechar.emit()}]})
	elif not _resumo.is_empty():
		var r := _resumo
		var titulo: String = ("%s é sua!" % r["nome"] if r["atacando"] else "%s resistiu!" % r["nome"]) if r["venci"] else ("O ataque a %s falhou" % r["nome"] if r["atacando"] else "%s caiu" % r["nome"])
		var t := "Perdas: você [b]%d[/b], inimigo [b]%d[/b]" % [r["meus"], r["deles"]]
		if not r["ganho"].is_empty():
			t += "\nPrêmio: " + VidaC.texto_premio(r["ganho"])
		if not r["destaque"].is_empty():
			t += "\nDestaque: [b]%s[/b], %d abate(s)" % [r["destaque"]["nome"], r["destaque"]["n"]]
		if not r["promovidos"].is_empty():
			t += "\nPromovidos: " + ", ".join(r["promovidos"].slice(0, 4))
		if not r["perdidos"].is_empty():
			t += "\nVeteranos perdidos: " + ", ".join(r["perdidos"].slice(0, 4))
		blocos.append({"tipo": "texto", "t": "[color=%s][b]%s[/b][/color]" % ["#9fd08f" if r["venci"] else "#ff8a7a", titulo.to_upper()], "tam": 24, "cor": Estilo.TEXTO})
		blocos.append({"tipo": "texto", "t": t, "tam": 18, "cor": Estilo.TEXTO})
		blocos.append({"tipo": "botoes", "colunas": 1, "lista": [{"t": "VOLTAR AO MAPA", "f": func(): fechar.emit(), "forte": true}]})
	else:
		blocos.append({"tipo": "botoes", "colunas": 1, "lista": [{"t": "VOLTAR AO MAPA", "f": func(): fechar.emit(), "forte": true}]})
	_painel.mostrar(blocos, "batalha-fim" if _acabou else "batalha")

# ------------------------------------------------------------ laço
func _process(dt: float) -> void:
	if b == null:
		return
	tempo += dt
	var parado: bool = j.pausado
	_faixa.text = "PAUSADO: toque em ▶ no topo" if parado and not _acabou and tela._dica_id == "" else "%s x %s" % [j.nome_de(b.atq_dono), j.nome_de(b.def_dono)]
	var passo := 0.0 if parado else dt * j.velocidade
	tremor = maxf(0.0, tremor - dt * 28.0)
	mundo.position = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * tremor
	for n in nuvens:
		n[0] += n[3] * dt
		if n[0] > largura + 100:
			n[0] = -100.0
	_longe -= dt
	if _longe <= 0.0:
		_longe = randf_range(1.2, 3.4) * (3.0 if ArteC.leve else 1.0)
		_brilho(Vector2(randf_range(20, largura - 20), chao + randf_range(-30, -8)), randf_range(24, 55), Color(1, 0.62, 0.25, 0.6), 0.5)
	# só o que se mexe é redesenhado
	if Engine.get_process_frames() % 3 == 0:
		ceu_vivo.queue_redraw()
	if amb["clima"] == "neve" or amb["clima"] == "chuva":
		neve.queue_redraw()
	if amb["clima"] == "neblina" and Engine.get_process_frames() % 3 == 0:
		_nevoa.queue_redraw()
	if amb["hora"] == "noite" and not parado:
		_sinalizador -= dt
		if _sinalizador <= 0.0:
			_sinalizador = randf_range(6.0, 11.0)
			_lancar_sinalizador()
	_criar_bonecos()
	_tratar_acontecimentos()
	_mover(passo)
	for bn in bonecos.values():
		bn.atualizar(passo)
	if not _acabou and not parado:
		_tiros_de_efeito(passo)
		_lancar_granadas()
		if b.terminou:
			_fim()
			_painel_em = 0.0
	tela.sons.tensao(0.0 if parado or _acabou else aperto())
	if _acabou:
		tela.sons.ambiente("")
	_painel_em -= dt
	if _painel_em <= 0.0:
		_painel_em = 0.15
		_atualizar_painel()

func _criar_bonecos() -> void:
	for lado in ["atq", "def"]:
		var l := b.lista(lado)
		for i in l.size():
			var c: BatalhaC.Combatente = l[i]
			if bonecos.has(c.get_instance_id()):
				continue
			var bn := Boneco.new()
			bn.cena = self
			bn.c = c
			bn.cor = Color(Dados.FACCOES[b.dono_do_lado(lado)]["cor"])
			bn.posto = i % 3
			var faixa_y := altura - chao - 62.0
			var y := chao + 48.0 + faixa_y * (float((i * 7) % maxi(1, mini(13, l.size()))) / maxf(1.0, mini(13, l.size()) - 1.0) if l.size() > 1 else 0.5) + (i / 13) * 7.0
			bn.position = Vector2(_alvo_x(bn, lado), y)
			var fundo := remap(y, chao + 48, altura, 0.86, 1.1)
			bn.scale = Vector2(ESC * fundo * (1.0 if lado == "atq" else -1.0), ESC * fundo)
			tropas.add_child(bn)
			bn.montar()
			if c.s.vida <= 0.0:
				bn.morto = true
				bn.tempo_morto = 3.0
			bonecos[c.get_instance_id()] = bn

func _alvo_x(bn: Boneco, lado: String) -> float:
	if lado == "def":
		return trincheira_x + 44.0 + bn.posto * 42.0
	var perto := trincheira_x - 38.0 - bn.posto * 54.0
	var inicio := 22.0 + (2 - bn.posto) * 26.0
	return lerpf(perto, inicio, clampf(bn.c.dist / Dados.DIST, 0.0, 1.0))

func _mover(dt: float) -> void:
	for bn in bonecos.values():
		if bn.morto:
			continue
		var lado: String = bn.c.lado
		var antes: float = bn.position.x
		bn.andar_ate = maxf(0.0, bn.andar_ate - dt)
		if lado == "atq":
			var alvo := _alvo_x(bn, lado)
			bn.deitado = b.post_atq == "cobertura" and not bn.comemorando
			bn.position.x = move_toward(bn.position.x, alvo, dt * (28.0 if bn.deitado else 90.0))
			var dir := -1.0 if b.post_atq == "recuar" else 1.0
			bn.scale.x = absf(bn.scale.x) * dir
		else:
			bn.deitado = false
			bn.agachado = b.post_def == "abrigar" and not bn.comemorando
			bn.position.x = move_toward(bn.position.x, _alvo_x(bn, lado), dt * 60.0)
			var base: float = bn.get_meta("base_y") if bn.has_meta("base_y") else bn.position.y
			bn.set_meta("base_y", base)
			bn.position.y = lerpf(bn.position.y, base + (12.0 if bn.agachado else 0.0), minf(1.0, dt * 8.0))
		var andou: float = absf(bn.position.x - antes) / maxf(0.1, absf(bn.scale.x))
		bn.passada += andou / 2.3
		if andou > dt * 3.0:
			bn.andar_ate = 0.18 # segura um instante para a pose não piscar
		bn.andando = bn.andar_ate > 0.0 and not bn.deitado and not bn.comemorando
		if bn.andando and andou > 0.0 and randf() < dt * 2.6:
			_particulas(bn.position, Color(0.6, 0.52, 0.38, 0.45), 4, 22.0, Vector2(-signf(bn.scale.x), -0.7), 40.0, 10.0, 0.7, 4.5)

func _tratar_acontecimentos() -> void:
	var lista := b.acontecimentos.duplicate()
	b.acontecimentos.clear()
	for a in lista:
		match a["tipo"]:
			"tiro":
				var de: Boneco = bonecos.get(a["de"].get_instance_id())
				var para: Boneco = bonecos.get(a["para"].get_instance_id())
				if de and para:
					_disparo(de, para, a["dano"], a["matou"])
			"fumaca":
				tela.sons.tocar("fumaca", -10.0)
				_cortina_de_fumaca(a["lado"])
			"carga":
				tela.sons.tocar("apito", -8.0)
				_aviso_rapido("CARGA!", "Avanço rápido para a trincheira")
				j.tocar("alerta")
				tremor = maxf(tremor, 5.0)
				SonsC.vibrar(80)
				for bn in bonecos.values():
					if bn.c.lado == "atq" and not bn.morto:
						_particulas(bn.position, Color(0.65, 0.56, 0.4, 0.6), 10, 70.0, Vector2(-1, -0.4), 35.0, 20.0, 0.9, 7.0)
			"artilharia":
				j.tocar("assobio")
				tremor = maxf(tremor, 4.0)
				for bn in bonecos.values():
					if bn.c.lado == a["contra"] and not bn.morto:
						_mira(bn, maxf(0.4, Dados.ART_AVISO / Dados.BAT_RITMO / maxf(1.0, j.velocidade)))
				if a["contra"] == b.lado_do_jogador():
					SonsC.vibrar(200)
				else:
					_aviso_rapido("FOGO!", "Artilharia a caminho do inimigo")
			"queda":
				var i := 0
				for c in a["atingidos"]:
					var bn: Boneco = bonecos.get(c.get_instance_id())
					if bn == null:
						continue
					if i % 3 == 0:
						_explosao(bn.position + Vector2(randf_range(-18, 18), randf_range(-4, 8)), randf_range(0.8, 1.2))
					bn.clarao = 1.0
					bn.tremor = 1.6
					_numero(bn.position + Vector2(0, -70), "-%d" % roundi(a["dano"]), Color("ffdc8c"))
					i += 1
				_granadas.erase(a["contra"])
				if a["abrigo"] and a["contra"] == b.lado_do_jogador():
					_aviso_rapido("ABRIGO A TEMPO!", "A artilharia fez pouco estrago")

## tiros que não acertam (o jogo só calcula os que acertam; estes dão a sensação de fogo cruzado)
func _tiros_de_efeito(dt: float) -> void:
	_erro -= dt * Dados.BAT_RITMO
	if _erro > 0.0:
		return
	var lado: String = ["atq", "def"][randi() % 2]
	var de_lista: Array = bonecos.values().filter(func(x): return x.c.lado == lado and not x.morto and x.position.x > 8.0)
	var para_lista: Array = bonecos.values().filter(func(x): return x.c.lado != lado and not x.morto)
	_erro = (12.0 if ArteC.leve else 6.0) / maxf(3.0, de_lista.size())
	if de_lista.is_empty() or para_lista.is_empty() or (lado == "atq" and b.post_atq == "recuar"):
		return
	_disparo(de_lista.pick_random(), para_lista.pick_random(), 0.0, false)

func _disparo(de: Boneco, para: Boneco, dano: float, matou: bool) -> void:
	var dir := signf(de.scale.x)
	var esc := absf(de.scale.y)
	var ponta := ArteC.boca(de.c.s.tipo, de.deitado)
	var boca := de.position + Vector2(dir * ponta.x, ponta.y) * esc
	var destino := para.position + Vector2(randf_range(-5, 5), randf_range(-26, -14)) * absf(para.scale.y) * 0.9
	if dano <= 0.0:
		destino += Vector2(dir * randf_range(14, 66), randf_range(-34, 28))
	de.atirando = 0.3
	var canhao: bool = de.c.s.tipo in ["art", "blind"]
	_brilho(boca, 30.0 if canhao else 15.0, Color(1, 0.82, 0.35, 0.95))
	_particulas(boca, Color(0.75, 0.73, 0.68, 0.5), 12 if canhao else 4, 30.0, Vector2(dir, -0.4), 25.0, -20.0, 0.7, 7.0 if canhao else 4.0)
	var traco := Line2D.new()
	traco.width = 5.0 if canhao else 2.4
	traco.default_color = Color(1, 0.9, 0.55, 0.95)
	traco.points = PackedVector2Array([boca, boca])
	efeitos.add_child(traco)
	var voo := create_tween()
	voo.tween_method(func(k: float): traco.points = PackedVector2Array([boca.lerp(destino, maxf(0.0, k - 0.35)), boca.lerp(destino, k)]), 0.0, 1.0, 0.1)
	voo.tween_callback(func():
		traco.queue_free()
		if not is_instance_valid(para):
			return
		if dano > 0.0:
			para.clarao = 1.0
			para.tremor = 1.6
			var peito := para.position + Vector2(0, -20) * absf(para.scale.y)
			_particulas(peito, Color(0.72, 0.07, 0.07), 8, 110.0, Vector2(dir, -0.5), 35.0, 420.0, 0.5, 3.2)
			_numero(peito + Vector2(0, -26), "-%d" % maxi(1, roundi(dano)), Color("ffdc8c") if para.c.lado != b.lado_do_jogador() else Color("ff8c73"))
			if matou:
				_derrubar(para, dir)
		else:
			_particulas(destino, Color(0.62, 0.5, 0.33), 5, 90.0, Vector2(-dir * 0.3, -1), 40.0, 340.0, 0.5, 3.0))
	tela.sons.tocar(SonsC.SOM_DA_TROPA.get(de.c.s.tipo, "tiro"), -10.0 if de.c.s.tipo == "metr" else -8.0)

func _derrubar(bn: Boneco, dir: float) -> void:
	if bn.morto:
		return
	bn.morto = true
	bn.tempo_morto = 0.0
	create_tween().tween_property(bn, "position:x", bn.position.x + dir * randf_range(10, 22), 0.28).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_particulas(bn.position, Color(0.55, 0.46, 0.32, 0.7), 12, 55.0, Vector2(0, -1), 85.0, 90.0, 0.9, 5.0)
	j.tocar("abate")
	if bn.c.lado == b.lado_do_jogador():
		_numero(bn.position + Vector2(0, -90), "%s caiu" % bn.c.s.nome, Color("cce8c7"), 18)

func _lancar_granadas() -> void:
	for lado in ["atq", "def"]:
		var a: Dictionary = b.art[lado]
		var contra := BatalhaC.outro(lado)
		if a["cai"] < 0.0 or _granadas.has(contra):
			continue
		var falta: float = (a["cai"] - b.t) / Dados.BAT_RITMO / maxf(1.0, j.velocidade)
		if falta <= 0.34:
			_granadas[contra] = true
			var alvos: Array = bonecos.values().filter(func(x): return x.c.lado == contra and not x.morto)
			for i in range(0, alvos.size(), 3):
				_granada(alvos[i].position, maxf(0.05, falta))

func _fim() -> void:
	_acabou = true
	for bn in bonecos.values():
		if bn.c.s.vida <= 0.0:
			_derrubar(bn, 1.0 if bn.c.lado == "def" else -1.0)
	var venceu_lado := b.vencedor
	for bn in bonecos.values():
		if not bn.morto and bn.c.lado == venceu_lado:
			bn.comemorando = true
			bn.deitado = false
			bn.andando = false
	var cor := Color(Dados.FACCOES[b.dono_do_lado(venceu_lado)]["cor"])
	if venceu_lado == "atq":
		_bandeira(Vector2(trincheira_x + 60, chao + (altura - chao) * 0.5), cor)
	if b.dono_do_lado(venceu_lado) == "jogador":
		j.tocar("vitoria")
		for i in 6:
			get_tree().create_timer(0.22 * i).timeout.connect(func(): _particulas(Vector2(randf_range(60, largura - 60), chao + randf_range(-60, 30)), Color.from_hsv(randf_range(0.1, 0.4), 0.7, 1.0), 24, 180.0, Vector2(0, -1), 180.0, 220.0, 1.2, 3.5))
	elif b.lado_do_jogador() != "":
		j.tocar("derrota")

func _bandeira(onde: Vector2, cor: Color) -> void:
	var n := Node2D.new()
	n.position = onde
	var k := [0.0]
	n.draw.connect(func():
		var alt: float = 140.0 * minf(1.0, k[0] * 8.0)
		n.draw_rect(Rect2(-3, -155, 6, 155), Color(0.28, 0.2, 0.12))
		var pontos := PackedVector2Array()
		var base: Array = []
		for i in 9:
			var x := 3.0 + i * 9.0
			var onda := sin(tempo * 7.0 - i * 0.8) * i * 0.8
			pontos.append(Vector2(x, -alt - 6 + onda))
			base.push_front(Vector2(x, -alt + 36 + onda))
		pontos.append_array(PackedVector2Array(base))
		n.draw_colored_polygon(pontos, cor))
	efeitos.add_child(n)
	var t := create_tween()
	t.tween_method(func(v: float):
		k[0] = v
		n.queue_redraw(), 0.0, 1.0, 12.0)

func _aviso_rapido(titulo: String, sub: String) -> void:
	var v := VBoxContainer.new()
	v.position = Vector2(-60, chao - 112)
	v.size = Vector2(largura, 70)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.modulate.a = 0.0
	v.add_child(Estilo.contornar(Estilo.rotulo(titulo, 30, Color("ffdb94"), "marca", true)))
	v.add_child(Estilo.contornar(Estilo.rotulo(sub, 18, Estilo.TEXTO, "titulo", true)))
	recorte.add_child(v)
	var t := v.create_tween()
	t.tween_property(v, "position:x", 0.0, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	t.parallel().tween_property(v, "modulate:a", 1.0, 0.2)
	t.tween_interval(1.2)
	t.tween_property(v, "modulate:a", 0.0, 0.3)
	t.tween_callback(v.queue_free)

# ------------------------------------------------------------ efeitos
## nuvens cinza que ficam na frente do lado encoberto enquanto a fumaça durar
func _cortina_de_fumaca(lado: String) -> void:
	var dur: float = Dados.FUMACA_DURA / Dados.BAT_RITMO / maxf(1.0, j.velocidade)
	var x_de := 20.0 if lado == "atq" else trincheira_x - 10.0
	var x_ate := trincheira_x - 30.0 if lado == "atq" else largura
	_preparar_efeitos()
	for i in (14 if ArteC.leve else 30):
		var n := Sprite2D.new()
		n.texture = _luz
		n.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
		var tom := randf_range(0.66, 0.82)
		n.self_modulate = Color(tom, tom, tom * 0.97, 0.5)
		n.scale = Vector2(1.0, 0.72) * (randf_range(70.0, 130.0) / 64.0)
		n.position = Vector2(randf_range(x_de, x_ate), randf_range(chao + 20.0, altura - 20.0))
		n.modulate.a = 0.0
		efeitos.add_child(n)
		var t := n.create_tween()
		t.tween_interval(i * 0.03)
		t.tween_property(n, "modulate:a", 1.0, 0.35)
		t.parallel().tween_property(n, "position", n.position + Vector2(randf_range(-26, 26), randf_range(-18, 4)), dur)
		t.parallel().tween_property(n, "scale", n.scale * randf_range(1.25, 1.6), dur)
		t.tween_property(n, "modulate:a", 0.0, 0.7)
		t.tween_callback(n.queue_free)
	_aviso_rapido("FUMAÇA!", "Fica difícil acertar %s" % ("os seus" if lado == b.lado_do_jogador() else "o inimigo"))

## o clarão e o desbotar das partículas são os mesmos em todo tiro: feitos uma vez
static var _luz: GradientTexture2D
static var _some: Gradient
static var _somar: CanvasItemMaterial

static func _preparar_efeitos() -> void:
	if _luz:
		return
	var grad := Gradient.new()
	grad.set_color(0, Color.WHITE)
	grad.set_color(1, Color(1, 1, 1, 0))
	_luz = GradientTexture2D.new()
	_luz.gradient = grad
	_luz.fill = GradientTexture2D.FILL_RADIAL
	_luz.fill_from = Vector2(0.5, 0.5)
	_luz.fill_to = Vector2(0.5, 0.0)
	_some = Gradient.new()
	_some.set_color(0, Color.WHITE)
	_some.set_color(1, Color(1, 1, 1, 0))
	_some.add_point(0.6, Color(1, 1, 1, 0.9))
	_somar = CanvasItemMaterial.new()
	_somar.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD

func _brilho(onde: Vector2, raio: float, cor: Color, dur := 0.09) -> void:
	_preparar_efeitos()
	var s := Sprite2D.new()
	s.texture = _luz
	s.self_modulate = cor
	s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	s.position = onde
	s.scale = Vector2.ONE * raio / 32.0
	s.material = _somar
	efeitos.add_child(s)
	var t := s.create_tween()
	t.tween_property(s, "modulate:a", 0.0, dur)
	t.tween_callback(s.queue_free)

func _particulas(onde: Vector2, cor: Color, qtd: int, vel: float, dir: Vector2, abertura: float, grav: float, vida: float, tam: float) -> void:
	if ArteC.leve: # sem as nuvenzinhas pequenas, e metade do resto
		if qtd <= 6:
			return
		qtd = maxi(4, qtd / 2)
	var p := CPUParticles2D.new()
	p.position = onde
	p.one_shot = true
	p.explosiveness = 0.95
	p.amount = qtd
	p.lifetime = vida
	p.direction = dir.normalized()
	p.spread = abertura
	p.initial_velocity_min = vel * 0.35
	p.initial_velocity_max = vel
	p.gravity = Vector2(0, grav)
	p.damping_min = 10.0
	p.damping_max = 60.0
	p.scale_amount_min = tam * 0.5
	p.scale_amount_max = tam
	p.color = cor
	_preparar_efeitos()
	p.color_ramp = _some
	efeitos.add_child(p)
	p.emitting = true
	var t := p.create_tween()
	t.tween_interval(vida + 0.4)
	t.tween_callback(p.queue_free)

func _quadros_fx(onde: Vector2, linha_y: int, tam: float, dur: float, somar: bool, atraso := 0.0, deriva := Vector2.ZERO) -> void:
	var s := Sprite2D.new()
	s.texture = _fx
	s.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	s.region_enabled = true
	s.region_rect = Rect2(0, linha_y, 63, 62)
	s.position = onde
	s.scale = Vector2.ONE * tam
	s.rotation = randf() * TAU
	s.visible = false
	if somar:
		var mat := CanvasItemMaterial.new()
		mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		s.material = mat
	efeitos.add_child(s)
	var t := s.create_tween()
	t.tween_interval(maxf(0.001, atraso))
	t.tween_callback(func(): s.visible = true)
	t.tween_method(func(k: float):
		s.region_rect = Rect2(mini(8, int(k * 9)) * 65.7, linha_y, 63, 62)
		s.modulate.a = 1.0 - clampf((k - 0.5) / 0.5, 0.0, 1.0)
		s.position = onde + deriva * k * dur
		s.scale = Vector2.ONE * tam * (0.7 + 0.5 * k), 0.0, 1.0, dur)
	t.tween_callback(s.queue_free)

func _numero(onde: Vector2, texto: String, cor: Color, tam := 21) -> void:
	var l := Estilo.contornar(Estilo.rotulo(texto, tam, cor, "titulo", true))
	l.position = onde + Vector2(-80, 0)
	l.size = Vector2(160, 28)
	efeitos.add_child(l)
	var t := l.create_tween().set_parallel(true)
	t.tween_property(l, "position:y", l.position.y - 32.0, 0.8).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(l, "modulate:a", 0.0, 0.8).set_delay(0.3)
	t.chain().tween_callback(l.queue_free)

func _mira(bn: Boneco, dur: float) -> void:
	var anel := Node2D.new()
	anel.position = bn.position
	var k := [0.0]
	anel.draw.connect(func():
		var cor := Color(1.0, 0.25, 0.18, 0.55 + 0.45 * sin(k[0] * k[0] * 70.0))
		anel.draw_set_transform(Vector2.ZERO, 0.0, Vector2(1, 0.4))
		anel.draw_arc(Vector2.ZERO, lerpf(34.0, 9.0, k[0]), 0, TAU, 32, cor, 3.0, true)
		anel.draw_circle(Vector2.ZERO, 2.5, cor))
	marcas.add_child(anel)
	var t := anel.create_tween()
	t.tween_method(func(v: float):
		k[0] = v
		if is_instance_valid(bn):
			anel.position = bn.position
		anel.queue_redraw(), 0.0, 1.0, dur)
	t.tween_callback(anel.queue_free)

func _granada(onde: Vector2, falta: float) -> void:
	var obus := Line2D.new()
	obus.width = 5.0
	obus.default_color = Color(0.14, 0.12, 0.09)
	efeitos.add_child(obus)
	var de := onde + Vector2(randf_range(-180, -80), -460)
	var t := obus.create_tween()
	t.tween_method(func(k: float): obus.points = PackedVector2Array([de.lerp(onde, maxf(0.0, k - 0.09)), de.lerp(onde, k)]), 0.0, 1.0, falta)
	t.tween_callback(obus.queue_free)

func _explosao(onde: Vector2, tam: float) -> void:
	_quadros_fx(onde + Vector2(0, -28 * tam), 132, 2.1 * tam, 0.22, true)
	_quadros_fx(onde + Vector2(0, -32 * tam), 0, 1.9 * tam, 0.55, false)
	for i in 2:
		_quadros_fx(onde + Vector2(randf_range(-20, 20), randf_range(-56, -26)) * tam, 66, randf_range(1.2, 2.0) * tam, randf_range(1.4, 2.3), false, 0.1 + i * 0.08, Vector2(13, -40))
	_particulas(onde, Color(0.36, 0.27, 0.16), 28, 290.0, Vector2(0, -1), 52.0, 640.0, 1.1, 5.0)
	_particulas(onde, Color(1.0, 0.62, 0.15), 18, 340.0, Vector2(0, -1), 70.0, 520.0, 0.55, 3.0)
	_particulas(onde, Color(0.6, 0.52, 0.4, 0.55), 14, 150.0, Vector2(0, -0.12), 180.0, 30.0, 0.9, 8.0)
	_brilho(onde + Vector2(0, -22), 110.0 * tam, Color(1.0, 0.7, 0.25, 0.8), 0.3)
	var onda := Node2D.new()
	onda.position = onde
	var k := [0.0]
	onda.draw.connect(func():
		onda.draw_set_transform(Vector2.ZERO, 0.0, Vector2(1, 0.4))
		onda.draw_arc(Vector2.ZERO, 10 + 100 * tam * k[0], 0, TAU, 40, Color(1, 0.93, 0.75, 0.75 * (1.0 - k[0])), 5.0 * (1.0 - k[0]) + 1.0))
	efeitos.add_child(onda)
	var t := onda.create_tween()
	t.tween_method(func(v: float):
		k[0] = v
		onda.queue_redraw(), 0.0, 1.0, 0.36)
	t.tween_callback(onda.queue_free)
	buracos.append([onde, randf_range(14, 22) * tam])
	if buracos.size() > 60:
		buracos.pop_front()
	marcas.queue_redraw()
	tremor = 13.0
	_clarao.color = Color(1.0, 0.82, 0.5, 0.24)
	_clarao.create_tween().tween_property(_clarao, "color:a", 0.0, 0.22)
	j.tocar("explosao")
	SonsC.vibrar(50)

# ------------------------------------------------------------ cenário (muda com o terreno da província)
func _faixa_suave(onde: Node2D, de: float, ate: float, cor_a: Color, cor_b: Color) -> void:
	onde.draw_polygon(PackedVector2Array([Vector2(-30, de), Vector2(largura + 30, de), Vector2(largura + 30, ate), Vector2(-30, ate)]), PackedColorArray([cor_a, cor_a, cor_b, cor_b]))

func _desenhar_ceu() -> void:
	var H: Dictionary = HORAS[amb["hora"]]
	var ceu_a: Color = H["a"]
	var ceu_b: Color = H["b"]
	var nublado: bool = amb["clima"] != "limpo"
	if nublado: # céu coberto: as cores puxam para o cinza
		var brilho := 0.34 if amb["hora"] != "noite" else 0.08
		ceu_a = ceu_a.lerp(Color(brilho, brilho * 1.05, brilho * 1.15), 0.65)
		ceu_b = ceu_b.lerp(Color(brilho * 1.7, brilho * 1.75, brilho * 1.8), 0.65)
	var meio := ceu_a.lerp(ceu_b, 0.32)
	_faixa_suave(ceu, -24.0, chao * 0.6, ceu_a, meio)
	_faixa_suave(ceu, chao * 0.6, chao + 26.0, meio, ceu_b)
	if amb["hora"] == "noite" and not nublado:
		for i in 70:
			var q := Vector2(fmod(i * 137.7, largura), fmod(i * 59.3, chao * 0.72))
			ArteC.elipse(ceu, q, Vector2.ONE * (0.7 + (i % 4) * 0.3), Color(1, 1, 1, 0.35 + (i % 5) * 0.12))
	if not nublado:
		var astro: Color = H["astro"]
		var onde := Vector2(largura * H["onde"].x, chao - H["onde"].y)
		var raio := 20.0 if amb["hora"] == "noite" else 32.0
		for k in 4: # o halo
			ArteC.elipse(ceu, onde, Vector2.ONE * raio * (1.8 - k * 0.2), Color(astro, 0.06))
		ArteC.elipse(ceu, onde, Vector2(raio, raio), Color(astro, 0.96))
		if amb["hora"] == "noite": # crateras da lua
			for c in [[Vector2(-6, -4), 4.0], [Vector2(5, 3), 5.5], [Vector2(-2, 8), 2.6]]:
				ArteC.elipse(ceu, onde + c[0], Vector2.ONE * c[1], Color(0.62, 0.68, 0.82, 0.55))

func _desenhar_nuvens() -> void:
	var cor: Color = HORAS[amb["hora"]]["nuvem"]
	var cheias := 1.0
	if amb["clima"] != "limpo":
		cor = Color(cor.r * 0.55, cor.g * 0.58, cor.b * 0.64, minf(0.42, cor.a * 1.9))
		cheias = 1.5
	for n in nuvens:
		for k in 5:
			var r: float = (16.0 - absf(k - 2) * 3) * n[2] * cheias
			ArteC.elipse(ceu_vivo, Vector2(n[0] + (k - 2) * 22 * n[2] * cheias, n[1] + absf(k - 2) * 5), Vector2(1.9, 0.7) * r, cor)

## neve ou chuva, na frente de tudo
func _desenhar_neve() -> void:
	if amb["clima"] == "neve":
		for i in (35 if ArteC.leve else 90):
			var p := Vector2(fmod(i * 61.0 + tempo * (12.0 + i % 9), largura), fmod(i * 37.0 + tempo * (26.0 + i % 13), altura))
			neve.draw_rect(Rect2(p, Vector2(2, 2)), Color(1, 1, 1, 0.65))
	elif amb["clima"] == "chuva":
		var riscos := PackedVector2Array()
		for i in (45 if ArteC.leve else 110):
			var p := Vector2(fposmod(i * 73.0 - tempo * 150.0, largura + 40.0) - 20.0, fposmod(i * 41.0 + tempo * (620.0 + (i % 7) * 40.0), altura + 30.0) - 20.0)
			riscos.append(p)
			riscos.append(p + Vector2(-4.0, 17.0))
		neve.draw_multiline(riscos, Color(0.75, 0.82, 0.95, 0.34), 1.1)
		for i in (0 if ArteC.leve else 14): # respingos no chão
			var fase := fposmod(tempo * 2.6 + i * 0.37, 1.0)
			var q := Vector2(fposmod(i * 197.0 + floorf(tempo * 2.6 + i * 0.37) * 91.0, largura), chao + 14.0 + fposmod(i * 83.0, altura - chao - 24.0))
			neve.draw_arc(q, 1.5 + fase * 5.0, PI, TAU, 8, Color(0.8, 0.86, 0.95, 0.4 * (1.0 - fase)), 1.0)

func _desenhar_nevoa() -> void:
	if amb["clima"] != "neblina":
		return
	var cor := Color(0.72, 0.75, 0.78) if amb["hora"] != "noite" else Color(0.36, 0.42, 0.55)
	for i in 14:
		var x := fposmod(i * 131.0 + tempo * (7.0 + i % 4 * 3.0), largura + 260.0) - 130.0
		var y := chao - 8.0 + fposmod(i * 71.0, (altura - chao) * 0.8)
		ArteC.elipse(_nevoa, Vector2(x, y), Vector2(130.0 + (i % 3) * 40.0, 22.0 + (i % 4) * 7.0), Color(cor, 0.13))

## à noite, um sinalizador sobe e ilumina o campo por uns instantes
func _lancar_sinalizador() -> void:
	var de := Vector2(randf_range(largura * 0.2, largura * 0.8), chao)
	var topo := Vector2(de.x + randf_range(-60, 60), randf_range(86.0, chao * 0.55))
	var luz := Node2D.new()
	luz.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	luz.draw.connect(func():
		ArteC.elipse(luz, Vector2.ZERO, Vector2(16, 16), Color(1.0, 0.9, 0.7, 0.2))
		ArteC.elipse(luz, Vector2.ZERO, Vector2(4, 4), Color(1.0, 0.97, 0.85, 0.95)))
	luz.position = de
	efeitos.add_child(luz)
	var base_chao := _quadro_cenario.modulate
	var base_tropa := tropas.modulate
	var t := luz.create_tween()
	t.tween_property(luz, "position", topo, 0.9).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_callback(func(): _brilho(topo, 240.0, Color(1.0, 0.93, 0.75, 0.45), 2.4))
	t.parallel().tween_property(_quadro_cenario, "modulate", base_chao.lerp(Color(1.15, 1.08, 0.95), 0.75), 0.25)
	t.parallel().tween_property(tropas, "modulate", base_tropa.lerp(Color(1.12, 1.06, 0.98), 0.75), 0.25)
	t.tween_property(luz, "position", topo + Vector2(18, 60), 2.2)
	t.parallel().tween_property(_quadro_cenario, "modulate", base_chao, 2.2).set_ease(Tween.EASE_IN)
	t.parallel().tween_property(tropas, "modulate", base_tropa, 2.2).set_ease(Tween.EASE_IN)
	t.tween_callback(luz.queue_free)

## o lugar: rio com ponte no horizonte, cidade destruída ou chão alagado
func _lugar_ao_fundo(c: Node2D) -> void:
	if amb["lugar"] == "ponte":
		var y := chao - 4.0
		_faixa_suave(c, y - 4.0, y + 20.0, Color(0.22, 0.34, 0.42), Color(0.14, 0.22, 0.29))
		for i in 26:
			c.draw_line(Vector2(fmod(i * 97.0, largura), y + 2.0 + fmod(i * 7.0, 15.0)), Vector2(fmod(i * 97.0, largura) + 16.0, y + 2.0 + fmod(i * 7.0, 15.0)), Color(0.72, 0.83, 0.9, 0.3), 1.0, true)
		var x0 := largura * 0.3
		var pedra := Color(0.34, 0.3, 0.26)
		var tabuleiro := PackedVector2Array([Vector2(x0 - 30, y + 6), Vector2(x0 + 6, y - 24), Vector2(x0 + 214, y - 24), Vector2(x0 + 250, y + 6), Vector2(x0 + 232, y + 12), Vector2(x0 + 208, y - 12), Vector2(x0 + 12, y - 12), Vector2(x0 - 12, y + 12)])
		c.draw_colored_polygon(tabuleiro, pedra)
		for k in 3:
			var cx := x0 + 44.0 + k * 66.0
			var arco := PackedVector2Array()
			arco.append(Vector2(cx - 33, y + 16))
			arco.append(Vector2(cx - 33, y - 14))
			arco.append(Vector2(cx + 33, y - 14))
			arco.append(Vector2(cx + 33, y + 16))
			for q in 9:
				var a := q / 8.0 * PI
				arco.append(Vector2(cx + cos(a) * 24.0, y + 16.0 - sin(a) * 22.0))
			c.draw_colored_polygon(arco, pedra)
		c.draw_line(Vector2(x0 + 4, y - 31), Vector2(x0 + 216, y - 31), pedra.lightened(0.12), 3.0, true)
		for k in 12:
			c.draw_line(Vector2(x0 + 12 + k * 18.0, y - 31), Vector2(x0 + 12 + k * 18.0, y - 23), pedra.lightened(0.12), 2.0)
	elif amb["lugar"] == "ruinas":
		var parede := Color(0.2, 0.175, 0.17)
		for i in 9:
			var x := 4.0 + i * 62.0 + sin(i * 4.1) * 14.0
			var h := 30.0 + fmod(i * 37.0, 52.0)
			var lg := 30.0 + fmod(i * 13.0, 20.0)
			var topo := PackedVector2Array([Vector2(x, chao + 4), Vector2(x, chao - h)])
			for q in 4: # o alto quebrado
				topo.append(Vector2(x + lg * (q + 1) / 4.0, chao - h + fmod(i * 19.0 + q * 23.0, 26.0)))
			topo.append(Vector2(x + lg, chao + 4))
			c.draw_colored_polygon(topo, parede.lerp(Color(0.28, 0.2, 0.17), (i % 3) * 0.3))
			for andar in int(h / 22.0):
				var quente: bool = (i + andar) % 5 == 0
				c.draw_rect(Rect2(x + 7, chao - 14 - andar * 20.0, 7, 10), Color(1.0, 0.55, 0.18, 0.85) if quente else Color(0.07, 0.06, 0.06))
		for i in 34: # entulho
			var q := Vector2(fmod(i * 53.0, largura), chao + 2.0 + fmod(i * 11.0, 12.0))
			c.draw_colored_polygon(PackedVector2Array([q, q + Vector2(5 + i % 4, -5 - i % 5), q + Vector2(13 + i % 6, 0)]), Color(0.25, 0.21, 0.19))

## poças e juncos do chão alagado
func _lugar_no_chao(c: Node2D) -> void:
	if amb["lugar"] != "pantano":
		return
	for i in 9:
		var q := Vector2(fposmod(i * 167.0 + 40.0, trincheira_x - 60.0) + 20.0, chao + 34.0 + fposmod(i * 89.0, altura - chao - 60.0))
		var r := 22.0 + (i % 4) * 9.0
		ArteC.elipse(c, q, Vector2(r * 1.15, r * 0.36), Color(0.13, 0.12, 0.07, 0.8))
		ArteC.elipse(c, q, Vector2(r, r * 0.29), Color(0.24, 0.35, 0.4, 0.85))
		ArteC.elipse(c, q + Vector2(-r * 0.3, -r * 0.06), Vector2(r * 0.4, r * 0.07), Color(0.75, 0.85, 0.9, 0.3))
		for k in 6:
			var pe := q + Vector2(r * (0.75 if k % 2 else -0.9) + k * 2.5, k % 3)
			c.draw_line(pe, pe + Vector2(k - 3, -12 - k % 4 * 3), Color(0.35, 0.4, 0.18), 1.4, true)

func _desenhar_cenario() -> void:
	var c := cenario
	var inverno: bool = amb["clima"] == "neve"
	var tipo := b.alvo.tipo
	var morros := [[44.0 if tipo != "morro" else 82.0, Color(0.31, 0.26, 0.29), 0.017, 0.0], [26.0 if tipo != "morro" else 48.0, Color(0.23, 0.21, 0.2), 0.026, 2.1]]
	for m in morros:
		var pts := PackedVector2Array([Vector2(-30, chao + 10)])
		for i in 21:
			var x := -30.0 + (largura + 60) * i / 20.0
			pts.append(Vector2(x, chao - m[0] * (0.62 + 0.38 * sin(x * m[2] + m[3]))))
		pts.append(Vector2(largura + 30, chao + 10))
		c.draw_colored_polygon(pts, m[1])
		c.draw_polyline(pts, m[1], 1.2, true)
	if (tipo == "cidade" or tipo == "capital") and amb["lugar"] != "ruinas":
		for i in 11:
			var x := 8.0 + i * 50.0 + sin(i * 3.0) * 12.0
			var h := 22.0 + fmod(i * 29.0, 34.0)
			c.draw_rect(Rect2(x, chao - h, 34, h + 4), Color(0.17, 0.15, 0.15))
			c.draw_colored_polygon(PackedVector2Array([Vector2(x - 2, chao - h), Vector2(x + 17, chao - h - 14 - (i % 3) * 4), Vector2(x + 36, chao - h)]), Color(0.21, 0.15, 0.13))
			if i % 2 == 0:
				c.draw_rect(Rect2(x + 8, chao - h + 8, 6, 7), Color(0.95, 0.7, 0.3, 0.7))
	var arvores := 26 if tipo == "floresta" else 7
	for i in arvores:
		var x := fmod(26.0 + i * 78.0 + sin(i * 5.0) * 20.0, largura)
		if tipo == "floresta":
			var h := 28.0 + fmod(i * 17.0, 30.0)
			c.draw_colored_polygon(PackedVector2Array([Vector2(x - 13, chao + 4), Vector2(x, chao - h), Vector2(x + 13, chao + 4)]), Color(0.11, 0.18, 0.12) if i % 2 else Color(0.14, 0.22, 0.14))
		else:
			c.draw_line(Vector2(x, chao + 3), Vector2(x + 3, chao - 28 - (i % 3) * 9), Color(0.1, 0.08, 0.07), 3.0, true)
			c.draw_line(Vector2(x + 2, chao - 18), Vector2(x - 9, chao - 27), Color(0.1, 0.08, 0.07), 2.0, true)
	var terra_a: Color = {"campo": Color(0.35, 0.34, 0.2), "floresta": Color(0.22, 0.29, 0.17), "morro": Color(0.38, 0.32, 0.23), "cidade": Color(0.33, 0.31, 0.25), "capital": Color(0.33, 0.31, 0.25)}[tipo]
	if inverno:
		terra_a = Color(0.72, 0.74, 0.76)
	_faixa_suave(c, chao, altura + 30.0, terra_a, terra_a.darkened(0.35))
	_lugar_ao_fundo(c)
	_lugar_no_chao(c)
	for i in 130:
		var p := Vector2(fmod(i * 83.7, largura), chao + 10 + fmod(i * 47.3, altura - chao - 16))
		ArteC.elipse(c, p, Vector2(2.2 + (i % 4) * 0.5, 1.1), Color(terra_a.lightened(0.2), 0.55) if i % 3 else Color(terra_a.darkened(0.45), 0.7))
	c.draw_colored_polygon(PackedVector2Array([Vector2(trincheira_x + 4, chao + 28), Vector2(largura + 30, chao + 22), Vector2(largura + 30, altura + 30), Vector2(trincheira_x - 6, altura + 30)]), Color(0.16, 0.12, 0.08))
	for y in range(int(chao) + 52, int(altura), 50):
		c.draw_line(Vector2(trincheira_x + 10, y), Vector2(largura + 30, y - 6), Color(0.25, 0.18, 0.11), 5.0)
	var estacas: Array = []
	for i in 6:
		estacas.append(Vector2(largura * 0.37 + (i % 2) * 18.0 + i * 5.0, chao + 40.0 + i * (altura - chao - 52.0) / 5.0))
	for i in 5:
		for h in [8.0, 18.0]:
			var pontos := PackedVector2Array()
			for q in 9:
				var k := q / 8.0
				pontos.append(estacas[i].lerp(estacas[i + 1], k) + Vector2(0, -h + sin(k * PI) * 7.0))
			c.draw_polyline(pontos, Color(0.55, 0.55, 0.52, 0.6), 1.0, true)
	for e in estacas:
		c.draw_line(e, e + Vector2(0, -22), Color(0.2, 0.15, 0.1), 4.0)
	if b.alvo.tem_obra("forte"):
		c.draw_rect(Rect2(largura - 74, chao - 6, 80, 54), Color(0.3, 0.3, 0.28))
		for i in 4:
			c.draw_rect(Rect2(largura - 74 + i * 21, chao - 16, 13, 12), Color(0.3, 0.3, 0.28))
		c.draw_rect(Rect2(largura - 56, chao + 12, 26, 7), Color(0.05, 0.05, 0.05))

func _desenhar_buracos() -> void:
	for q in buracos:
		var r: float = q[1]
		ArteC.elipse(marcas, q[0], Vector2(r, r * 0.4) * 1.25, Color(0.4, 0.32, 0.2, 0.75))
		ArteC.elipse(marcas, q[0] + Vector2(0, 0.4), Vector2(r, r * 0.4), Color(0.12, 0.09, 0.05, 0.9))

func _desenhar_sacos(n: Node2D, semente: int, forca_trinch: float) -> void:
	var cores := [Color(0.62, 0.52, 0.33), Color(0.55, 0.46, 0.29), Color(0.68, 0.57, 0.37)]
	var filas := 1 + int(round(forca_trinch * 2.6))
	var e := Vector2(1.45, 0.86)
	for fila in filas:
		for i in 2:
			var p := Vector2(-13.0 + i * 20.0 + (fila % 2) * 9.0 - fila * 3.0, -7.0 - fila * 12.0)
			ArteC.elipse(n, p, e * 9.2, Color(0.15, 0.11, 0.06))
			ArteC.elipse(n, p + Vector2(0, -0.6) * e, e * 7.9, cores[(semente + fila + i) % 3])
			ArteC.elipse(n, p + Vector2(-2, -3.2) * e, e * 3.0, Color(1, 0.93, 0.72, 0.18))
