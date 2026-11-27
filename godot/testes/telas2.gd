extends "res://testes/telas.gd"
## As novidades, pela interface: arrastar, reunião, recrutamento automático, avisos, táticas,
## batalha rápida, desafio do dia, operação, resumo e conquistas.
## godot --path . --resolution 432x936 -s res://testes/telas2.gd -- <pasta das fotos>

const GUARDAR := ["user://campanha.json", "user://partida.json", "user://config.json", "user://recordes.json", "user://operacao.json"]

func _evento_toque(onde: Vector2, apertado: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = 0
	ev.pressed = apertado
	ev.position = root.get_final_transform() * onde
	Input.parse_input_event(ev)

## arrasta o dedo de um ponto a outro; `no_meio` fotografa antes de soltar
func arrastar(de: Vector2, ate: Vector2, no_meio := "") -> void:
	_evento_toque(de, true)
	await espera(0.08)
	var ultimo := de
	for i in range(1, 11):
		var ev := InputEventScreenDrag.new()
		ev.index = 0
		var agora := de.lerp(ate, i / 10.0)
		ev.position = root.get_final_transform() * agora
		ev.relative = root.get_final_transform().basis_xform(agora - ultimo)
		ultimo = agora
		Input.parse_input_event(ev)
		await espera(0.04)
	if no_meio != "":
		await espera(0.25)
		await foto(no_meio)
	_evento_toque(ate, false)
	await espera(0.45)

func na_tela(mundo: Vector2, desvio := Vector2.ZERO) -> Vector2:
	var m: MapaVista = app.mapa
	return m.get_global_transform() * (m.para_tela(mundo) + desvio)

func fim_forcado(j: JogoC, como: String) -> void:
	j.terminar(como)
	await espera(1.0)

func _rodar() -> void:
	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.copy_absolute(arq, arq + ".antes2")
			DirAccess.remove_absolute(arq)
	app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await espera(1.0)
	app.config["guia_feito"] = true
	app.config["sem_dicas"] = true
	await foto("n01-inicio")

	# ---- arrastar para atacar
	await tocar("1. Fronteira")
	await tocar("AO COMBATE")
	await espera(1.0)
	var j: JogoC = app.jogo
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	var alvo: ProvinciaC = null
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = j.prov[v]
	var cam_antes: Vector2 = app.mapa.cam
	await arrastar(na_tela(e.pos, Vector2(0, 16)), na_tela(alvo.pos), "n02-arrastando")
	ck(app.pendente.get("destino", "") == alvo.id and app.pendente.get("ex", "") == e.id, "arrastar do exército prepara o ataque")
	ck(app.mapa.cam.is_equal_approx(cam_antes), "arrastar a tropa não move o mapa")
	ck(e.rota.is_empty(), "nada sai sem confirmar")
	await foto("n03-confirmar")
	await tocar("Cancelar")
	await arrastar(na_tela(e.pos, Vector2(0, 16)), na_tela(e.pos, Vector2(0, 40)))
	ck(app.pendente.is_empty(), "soltar na própria província cancela")
	cam_antes = app.mapa.cam
	var meio: Vector2 = app.mapa.get_global_transform() * Vector2(60, 60)
	await arrastar(meio, meio + Vector2(120, 90))
	ck(not app.mapa.cam.is_equal_approx(cam_antes) and app.pendente.is_empty(), "arrastar fora da tropa move o mapa")
	app.mapa.centralizar(j.prov[j.capital_jogador].pos)
	await espera(0.4)
	await toque_no_mapa(e.pos, Vector2(0, 16))
	ck(app.sel.get("id", "") == e.id, "tocar no exército ainda seleciona")

	# ---- reunião e recrutamento automático
	var outra: ProvinciaC = null
	for p in j.minhas():
		if p.id != j.capital_jogador:
			outra = p
	app.selecionar({"tipo": "prov", "id": outra.id})
	await espera(0.4)
	await tocar("Reunir aqui")
	ck(j.reuniao == outra.id, "ponto de reunião pela tela")
	app.mapa.centralizar(outra.pos)
	await espera(0.4)
	await foto("n04-reuniao")
	app.selecionar({"tipo": "recrutar", "id": j.capital_jogador})
	await espera(0.4)
	await tocar("Ligar")
	ck(j.auto_rec["ligado"], "liga o recrutamento automático")
	await tocar("Guardar +20")
	ck(j.auto_rec["reserva"] == 60, "muda as moedas guardadas")
	await foto("n05-automatico")

	# ---- aviso que leva ao problema
	app.selecionar({"tipo": "prov", "id": j.capital_jogador})
	outra.moral = 8.0
	await espera(0.5)
	ck(app._alerta.visible, "botão de atenção aparece")
	await foto("n06-atencao")
	app._ir_ao_problema()
	await espera(0.5)
	ck(app.sel.get("id", "") != "", "atenção leva ao lugar")
	outra.moral = 80.0

	# ---- táticas na batalha
	j.auto_rec["ligado"] = false
	j.fac["jogador"]["mun"] = 400.0
	e = j.parados_em(j.capital_jogador, "jogador")[0]
	app.preparar_ordem(e.id, alvo.id, "ataque")
	app.pendente["qtd"] = maxi(1, e.s.size() - 2)
	app.confirmar_ordem()
	app.pausar(false)
	j.velocidade = 2
	for i in 80:
		await espera(0.25)
		if app._cena:
			break
	ck(app._cena != null, "batalha abre")
	j.velocidade = 1
	if app._cena:
		var b: BatalhaC = app._cena.b
		for c in b.atq + b.def:
			c.s.vida = c.s.vida_max()
		await espera(0.8)
		await foto("n07-batalha")
		await tocar("FUMAÇA")
		ck(b.fumaca["atq"]["usada"], "fumaça pela tela")
		await espera(1.1)
		await foto("n08-fumaca")
		await tocar("CARGA")
		ck(b.carga["usada"], "carga pela tela")
		await espera(0.6)
		await foto("n09-carga")
		if b.quem_pode_reforcar("atq"):
			await tocar("REFORÇO")
			ck(b.pediu["atq"], "reforço pela tela")
		await espera(0.4)
		app._fechar_batalha()
	await espera(0.5)

	# ---- fim da campanha: resumo com gráfico, recorde e conquistas
	j.t = 215.0
	for i in range(1, 20):
		j.historico.append([i * 11, {"jogador": 2 + int(i / 3.0), "bravo": 6 - int(i / 5.0), "charlie": 4, "delta": 3 + (i % 3)}])
	j.stats["melhor_nome"] = "Ferreira"
	j.stats["melhor_n"] = 7
	await fim_forcado(j, "dominio")
	await foto("n10-fim-campanha")
	ck(app.recordes.tem("primeira") and app.recordes.tem("heroi") and app.recordes.d["tempos"].has("fase1"), "fim guarda recorde e conquistas")
	await tocar("Escolher fase")
	await foto("n11-inicio-atalhos")

	# ---- batalha rápida num mapa gerado
	await tocar("Batalha rápida")
	await tocar("Pequeno")
	await tocar("Milícia armada")
	await foto("n12-rapida")
	await tocar("COMEÇAR")
	await espera(3.5)
	j = app.jogo
	ck(j.fase["n"] == 0 and j.chao != null and j.tem_regra("milicia") and j.lista_prov.size() == 26, "batalha rápida começa com as escolhas")
	await foto("n13-mapa-gerado")
	app.mapa.zoom_em(0.4, app.mapa.size / 2.0)
	await espera(0.6)
	await foto("n14-mapa-gerado-longe")
	var nomes: Array = j.lista_prov.map(func(p): return p.nome + p.dono)
	await tocar("Menu")
	await tocar("CONTINUAR")
	await espera(3.0)
	ck(app.jogo.lista_prov.map(func(p): return p.nome + p.dono) == nomes and app.jogo.chao != null, "continuar traz o mesmo mapa gerado")
	await fim_forcado(app.jogo, "vitoria")
	await foto("n15-fim-rapida")
	ck(app.recordes.tem("rapida") and app.recordes.tem("aleatorio") and app.campanha.estrelas_de(0) == 0, "partida avulsa não mexe na campanha")
	await tocar("Menu")

	# ---- desafio do dia
	await tocar("Desafio do dia")
	await foto("n16-diario")
	await tocar("JOGAR")
	await espera(3.5)
	ck(app.jogo.origem.get("modo", "") == "diario", "desafio começa")
	app.jogo.t = 90.0
	await fim_forcado(app.jogo, "vitoria")
	ck(app.recordes.d["diario"].has(ModosC.hoje()) and app.recordes.tem("diario"), "tempo do desafio guardado")
	await tocar("Menu")

	# ---- operação: escolher caminho, vencer e seguir
	await tocar("Operação")
	await tocar("COMEÇAR OPERAÇÃO")
	await foto("n17-operacao")
	await tocar("Arriscado")
	await espera(3.5)
	ck(app.jogo.origem.get("modo", "") == "operacao", "missão da operação começa")
	await fim_forcado(app.jogo, "vitoria")
	await foto("n18-fim-operacao")
	ck(app.operacao.etapa() == 2 and not app.operacao.reforcos().is_empty(), "avança de etapa e ganha reforço")
	await tocar("PRÓXIMA ETAPA")
	await foto("n19-operacao-2")
	await tocar("Seguro")
	await espera(3.5)
	ck(app.jogo.reforcos.size() == app.operacao.reforcos().size(), "reforços ganhos valem na missão seguinte")
	await fim_forcado(app.jogo, "derrota")
	ck(not app.operacao.ativa(), "derrota encerra a operação")
	await foto("n20-fim-derrota")
	await tocar("Menu")
	await tocar("Conquistas")
	await foto("n21-conquistas")

	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes2"):
			DirAccess.rename_absolute(arq + ".antes2", arq)
	print("NOVIDADES: ", "tudo certo" if falhas.is_empty() else JSON.stringify(falhas))
	quit(0 if falhas.is_empty() else 1)
