extends SceneTree
## Joga pela interface de verdade e fotografa cada tela. Uso (com janela):
## godot --path . --resolution 432x936 -s res://testes/telas.gd -- <pasta das fotos>
## Usa uma pasta de progresso própria e apaga no fim.

var pasta := ""
var app
var falhas: Array = []

func ck(c: bool, nome: String) -> void:
	if not c:
		falhas.append(nome)
		print("FALHOU: ", nome)

func _initialize() -> void:
	pasta = OS.get_cmdline_user_args()[0]
	_rodar()

func espera(seg: float) -> void:
	await create_timer(seg).timeout

func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(pasta.path_join(nome + ".png"))

func _botao_com(no: Node, texto: String) -> Button:
	if no is Button and no.is_visible_in_tree() and not no.disabled:
		if no.text.contains(texto):
			return no
		for l in no.find_children("*", "Label", true, false):
			if l.text.contains(texto):
				return no
	for f in no.get_children():
		var r := _botao_com(f, texto)
		if r:
			return r
	return null

func tocar(texto: String) -> bool:
	var b := _botao_com(app, texto)
	if b == null:
		ck(false, "botão não encontrado: " + texto)
		return false
	b.pressed.emit()
	await espera(0.45)
	return true

func toque_no_mapa(mundo: Vector2, desvio := Vector2.ZERO) -> void:
	var m: MapaVista = app.mapa
	var onde: Vector2 = m.get_global_transform() * (m.para_tela(mundo) + desvio)
	var escala := root.get_final_transform()
	for apertado in [true, false]:
		var ev := InputEventScreenTouch.new()
		ev.index = 0
		ev.pressed = apertado
		ev.position = escala * onde
		Input.parse_input_event(ev)
		await espera(0.08)
	await espera(0.3)

func _rodar() -> void:
	for arq in ["user://campanha.json", "user://partida.json", "user://config.json"]:
		if FileAccess.file_exists(arq):
			DirAccess.copy_absolute(arq, arq + ".antes")
			DirAccess.remove_absolute(arq)
	app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await espera(1.2)
	app.config["sem_dicas"] = true
	await foto("01-menu")
	await tocar("1. Fronteira")
	await foto("00-ordens")
	await tocar("AO COMBATE")
	await espera(1.0)
	await foto("02-tutorial")
	await tocar("Vamos lá")
	var j: JogoC = app.jogo
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	await toque_no_mapa(e.pos, Vector2(0, 16))
	ck(app.sel.get("tipo", "") == "ex", "tocar no exército no mapa seleciona")
	await foto("03-exercito")
	var alvo: ProvinciaC = null
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = j.prov[v]
	await tocar("Mover / Atacar")
	await toque_no_mapa(alvo.pos, Vector2(0, -6))
	ck(app.pendente.get("destino", "") == alvo.id, "tocar na província escolhe o destino")
	await foto("04-previsao")
	await tocar("Confirmar")
	await tocar("Começar")
	ck(not j.pausado, "o tutorial solta o jogo")
	j.velocidade = 2
	for i in 60:
		await espera(0.25)
		if app._cena:
			break
	ck(app._cena != null, "a batalha animada abre sozinha")
	j.velocidade = 1
	await espera(1.6)
	await foto("05-batalha")
	if app._cena:
		var b: BatalhaC = app._cena.b
		j.fac["jogador"]["mun"] = 200.0
		# a batalha precisa durar o teste inteiro: mantém os dois lados de pé
		var de_pe := [true]
		var curar := func():
			while de_pe[0] and not b.terminou:
				for c in b.atq + b.def:
					if c.s.vida > 0.0:
						c.s.vida = c.s.vida_max()
				await create_timer(0.1).timeout
		curar.call()
		await tocar("ARTILHARIA")
		ck(b.usou_art, "artilharia pela tela")
		await espera(1.75)
		await foto("06-artilharia")
		await tocar("COBERTURA")
		ck(b.post_atq == "cobertura", "cobertura pela tela")
		j.fac["neutro"]["mun"] = 200.0
		b.atirar_artilharia("def")
		await espera(0.9)
		await foto("07-aviso")
		await espera(1.6)
		if b.terminou:
			print("(a batalha do teste já tinha terminado em %.1f s, vencedor %s)" % [b.t, b.vencedor])
		await tocar("AVANÇAR")
		de_pe[0] = false
		for c in b.def:
			c.s.vida = minf(c.s.vida, 8.0)
		for i in 80:
			await espera(0.25)
			if b.terminou:
				break
		await espera(1.4)
		await foto("08-vitoria")
		await tocar("VOLTAR AO MAPA")
	await espera(0.6)
	ck(j.minhas().has(alvo) or not j.batalhas.is_empty(), "a conquista acontece")
	await foto("09-mapa-missao")
	app.selecionar({"tipo": "prov", "id": j.capital_jogador})
	await espera(0.5)
	await foto("10-capital")
	var antes := j.tropa_de("jogador")
	j.fac["jogador"]["moedas"] = 200.0
	await espera(0.3)
	await tocar("Recrutar 1")
	ck(j.tropa_de("jogador") == antes + 1, "recrutar pela tela")
	await tocar("Recrutar…")
	await foto("11-recrutar")
	app.selecionar({"tipo": "economia"})
	await espera(0.5)
	await foto("12-economia")
	app.selecionar({"tipo": "situacao"})
	await espera(0.5)
	await foto("13-situacao")
	app.selecionar({"tipo": "prov", "id": j.capital_jogador})
	j.vida.radio = {}
	j.vida.novo_evento("comboio")
	j.fac["jogador"]["moedas"] = 100.0
	await espera(0.6)
	await foto("14-evento")
	await tocar("Escoltar")
	ck(j.vida.evento.is_empty(), "escolher no cartão")
	var bot: String = j.fase["bots"][0]
	var base: ProvinciaC = j.prov_de(bot)[0]
	j.vida.radio = {}
	j.vida.anunciar_ofensiva({"bot": bot, "base": base.id, "alvo": j.capital_jogador})
	await espera(0.6)
	await foto("15-ofensiva")
	# salvar, sair e continuar
	var tempo := j.t
	var tropa := j.tropa_de("jogador")
	await tocar("Menu")
	await foto("16-menu-continuar")
	await tocar("CONTINUAR")
	await espera(0.8)
	ck(absf(app.jogo.t - tempo) < 0.5 and app.jogo.tropa_de("jogador") == tropa and app.jogo.pausado, "continuar volta igual e pausado")
	await tocar("Ajustes")
	await foto("17-ajustes")
	await tocar("Pronto")
	# fase maior com blindados, para o desempenho e o visual
	app.comecar_fase(6)
	await espera(1.2)
	await foto("18-fase6")
	app.mapa.zoom_em(0.3, app.mapa.size / 2.0)
	await espera(0.6)
	await foto("19-fase6-longe")
	j = app.jogo
	for b2 in j.pensar.keys():
		j.pensar[b2] = 1.0e9
	j.t = 100.0
	j.fim = ""
	j.terminar("dominio")
	await espera(1.0)
	await foto("20-fim-reforco")
	ck(app.campanha.estrelas_de(6) >= 1, "vitória guarda estrelas")
	for arq in ["user://campanha.json", "user://partida.json", "user://config.json"]:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes"):
			DirAccess.rename_absolute(arq + ".antes", arq)
	print("TELAS: ", "tudo certo" if falhas.is_empty() else JSON.stringify(falhas))
	quit(0 if falhas.is_empty() else 1)
