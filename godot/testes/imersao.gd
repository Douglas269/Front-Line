extends "res://testes/telas2.gd"
## Pela interface: ordens da fase, abertura da batalha, falas, câmera, rádio, marcas no mapa, jornal e o botão que desliga.
## godot --path . --resolution 432x936 -s res://testes/imersao.gd -- <pasta das fotos>

func _rodar() -> void:
	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.copy_absolute(arq, arq + ".antes3")
			DirAccess.remove_absolute(arq)
	app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await espera(1.0)
	app.config["sem_dicas"] = true
	app.config["guia_feito"] = true
	app.config["ver_batalha"] = false

	# ---- ordens antes da fase
	await tocar("1. Fronteira")
	ck(app._tela_atual == "ordens", "a fase começa pelas ordens")
	ck(app._tela.find_children("*", "Control", true, false).filter(func(x): return x is RetratoC).size() == 3, "um rosto para cada inimigo")
	await foto("i01-ordens")
	await tocar("AO COMBATE")
	await espera(0.8)
	var j: JogoC = app.jogo
	ck(j != null and app._tela_atual == "", "ao combate entra no mapa")

	# ---- rádio com o rosto de quem fala
	j.pausado = false
	j.vida.falar("bravo", "contato", "", true)
	await espera(0.6)
	ck(app._faixa_rosto.visible and app._faixa_rosto.quem == "bravo", "o rádio mostra o comandante")
	await foto("i02-radio")

	# ---- abertura: o jogo espera, e um toque pula
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	e.s[0].lutas = 6
	var alvo := ""
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = v
	var b := j.abrir_batalha(e, j.prov[alvo], j.parados_em(alvo, "neutro"))
	j.fac["jogador"]["mun"] = 500.0
	j.pausado = false
	app.abrir_batalha_animada(b)
	await espera(0.7)
	var cena = app._cena
	ck(cena.abrindo, "a batalha abre com a cena de cinema")
	var parado_em := b.t
	var relogio := j.t
	await espera(0.6)
	ck(is_equal_approx(b.t, parado_em) and is_equal_approx(j.t, relogio), "o jogo espera a abertura")
	await foto("i03-abertura")
	cena.pular_abertura()
	await espera(0.5)
	ck(not cena.abrindo and b.t > parado_em, "depois de pular, a luta anda")
	ck(is_equal_approx(cena.cam_zoom, 1.0) and cena.mundo.position.length() < 20.0, "a câmera volta ao normal")

	# ---- falas: aparecem, com o nome, e nunca mais de duas
	for i in 8:
		cena._alguem_fala("solto", "", true)
	await espera(0.3)
	var baloes: Array = cena._baloes.filter(func(x): return is_instance_valid(x))
	ck(baloes.size() >= 1 and baloes.size() <= 2, "no máximo dois balões (%d)" % baloes.size())
	ck(baloes.all(func(x): return x.position.x >= 0.0 and x.position.x + x.size.x <= cena.largura + 1.0), "os balões cabem na tela")
	await app.postura(b, "cobertura")
	await espera(0.3)
	await foto("i04-falas")

	# ---- o fim: câmera lenta que passa e quem perdeu foge
	for c in b.def:
		c.s.vida = minf(c.s.vida, 1.0)
	b.def[0].s.vida = 100000.0
	for c in b.atq:
		c.s.vida = c.s.vida_max()
	await app.postura(b, "avancar")
	for c in b.def:
		c.s.vida = 0.0
	for i in 60:
		await create_timer(0.25, true, false, true).timeout
		if b.terminou:
			break
	await create_timer(0.5, true, false, true).timeout
	ck(b.terminou and Engine.time_scale < 1.0, "a trincheira cai em câmera lenta")
	await foto("i05-momento")
	await create_timer(2.0, true, false, true).timeout
	ck(is_equal_approx(Engine.time_scale, 1.0), "o tempo volta ao normal")
	ck(is_equal_approx(cena.cam_zoom, 1.0), "a câmera volta do final")
	app._fechar_batalha()
	await espera(0.8)

	# ---- marcas no mapa, que somem com o tempo
	ck(app.mapa._fumacas.any(func(x): return x["prov"] == alvo), "a batalha deixa marcas no mapa")
	app.mapa.centralizar(j.prov[alvo].pos)
	app.mapa._aviao_t = -4.5
	await espera(0.3)
	await foto("i06-marcas")
	j.t += MapaVista.CICATRIZ_DURA + 1.0
	await espera(0.4)
	ck(app.mapa._fumacas.is_empty(), "as marcas somem depois")

	# ---- jornal no fim da partida
	j.memorial.append({"nome": "Teles", "tipo": "inf", "lutas": 3, "abates": 4, "patente": 1, "onde": "Bela Cruz", "t": 50})
	var r := HistoriaC.reportagem(j)
	ck(r["linhas"].any(func(x): return x.contains("EM MEMÓRIA: Teles, em Bela Cruz")), "o jornal lembra quem caiu")
	await fim_forcado(j, "dominio")
	var papel: Array = app._tela.find_children("*", "Label", true, false).filter(func(x): return x.text == "O CORREIO DA FRONTEIRA")
	ck(papel.size() == 1, "o jornal aparece no fim")
	var rolagem: ScrollContainer = app._tela.find_children("*", "ScrollContainer", true, false)[0]
	rolagem.scroll_vertical = int(papel[0].global_position.y - 120.0)
	await espera(0.4)
	await foto("i07-jornal")

	# ---- desligado, volta ao jeito direto
	app.config["imersao"] = false
	app._aplicar_imersao()
	app.mostrar_inicio()
	await espera(0.4)
	await tocar("1. Fronteira")
	if _botao_com(app, "Sim"):
		await tocar("Sim")
	await espera(0.8)
	ck(app._tela_atual == "", "desligado: a fase começa sem as ordens")
	j = app.jogo
	e = j.parados_em(j.capital_jogador, "jogador")[0]
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = v
	b = j.abrir_batalha(e, j.prov[alvo], j.parados_em(alvo, "neutro"))
	j.pausado = false
	app.abrir_batalha_animada(b)
	await espera(0.6)
	ck(not app._cena.abrindo and not app.sons.clima_de_guerra, "desligado: sem abertura nem sons de fundo")
	app._cena._alguem_fala("solto", "", true)
	ck(app._cena._baloes.is_empty(), "desligado: sem balões")
	app._fechar_batalha()

	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes3"):
			DirAccess.rename_absolute(arq + ".antes3", arq)
	print("IMERSAO: ", "tudo certo" if falhas.is_empty() else JSON.stringify(falhas))
	quit(0 if falhas.is_empty() else 1)
