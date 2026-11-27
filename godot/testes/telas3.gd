extends "res://testes/telas2.gd"
## Pela interface: tutorial arrastando, dicas, veteranos, chefe da Operação e opção de gráficos.
## godot --path . --resolution 432x936 -s res://testes/telas3.gd -- <pasta das fotos>

func _rodar() -> void:
	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.copy_absolute(arq, arq + ".antes2")
			DirAccess.remove_absolute(arq)
	app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await espera(1.0)

	# ---- o tutorial ensina a arrastar
	await tocar("1. Fronteira")
	await tocar("AO COMBATE")
	await espera(1.0)
	await tocar("Vamos lá")
	await foto("t01-tutorial-arrastar")
	var j: JogoC = app.jogo
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	var alvo: ProvinciaC = null
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = j.prov[v]
	await arrastar(na_tela(e.pos, Vector2(0, 16)), na_tela(alvo.pos))
	ck(app._guia_passo == 2 and app.pendente.get("destino", "") == alvo.id, "arrastar avança o tutorial")
	await tocar("Cancelar")
	await espera(0.4)
	ck(app._guia_passo == 1, "cancelar volta a ensinar o arrasto")
	await arrastar(na_tela(e.pos, Vector2(0, 16)), na_tela(alvo.pos))
	await tocar("Confirmar")
	await espera(0.4)
	await tocar("Começar")
	ck(not j.pausado and app.config["guia_feito"], "o tutorial termina e solta o jogo")

	# ---- dica na primeira batalha: aparece, pausa, e não volta
	j.velocidade = 2
	for i in 80:
		await espera(0.25)
		if app._dica_id != "":
			break
	ck(app._dica_id == "batalha" and j.pausado, "a dica da batalha pausa o jogo")
	ck(app._dica.size.y < app.size.y * 0.5, "o cartão da dica tem a altura do texto")
	await foto("t02-dica-batalha")
	await tocar("Entendi")
	ck(not j.pausado and app.config["dicas"].has("batalha"), "fechar a dica solta o jogo")
	await espera(0.8)
	ck(app._dica_id != "batalha", "a dica não volta")
	app.config["sem_dicas"] = true
	j.velocidade = 1

	# ---- soldados com história
	if app._cena:
		var b: BatalhaC = app._cena.b
		for c in b.atq:
			c.s.vida = c.s.vida_max()
		b.atq[0].s.lutas = 1
		b.atq[1].s.lutas = 6
		for c in b.def:
			c.s.vida = 0.0
		for i in 40:
			await espera(0.25)
			if b.terminou:
				break
		await espera(0.8)
		await foto("t03-batalha-nomes")
		app._fechar_batalha()
	j.memorial.append({"nome": "Teles", "tipo": "inf", "lutas": 3, "abates": 4, "patente": 1, "onde": alvo.nome, "t": 50})
	app.selecionar({"tipo": "situacao"})
	await espera(0.5)
	await tocar("Veteranos")
	await foto("t04-veteranos")
	await tocar("História")
	ck(app.sel.get("tipo", "") == "soldado", "abre a história do soldado")
	await foto("t05-historia")

	# ---- opção de gráficos
	await tocar("Ajustes")
	await tocar("Leve")
	ck(ArteC.leve and app.config["graficos"] == "leve", "gráficos leves pela tela")
	await foto("t06-ajustes")
	await tocar("Automático")
	ck(not ArteC.leve, "volta ao automático")
	await tocar("Pronto")

	# ---- chefe na última etapa da Operação
	app.operacao.nova(515)
	while app.operacao.etapa() < OperacaoC.ETAPAS:
		app.operacao.escolher(0)
		app.operacao.resultado(true, app.operacao.etapa(), j.melhores(3))
	await tocar("Menu")
	await tocar("Operação")
	await foto("t07-chefes")
	await tocar("Seguro")
	await espera(0.6)
	if _botao_com(app, "Sim"):
		await tocar("Sim")
	await espera(4.0)
	j = app.jogo
	ck(j.chefe_id != "", "a missão final tem chefe")
	for p in j.lista_prov:
		if p.capital and p.capital_de == j.chefe_dono:
			j.revelado[j.chefe_dono] = 1.0e9
			app.mapa.centralizar(p.pos)
	await espera(0.8)
	await foto("t08-chefe-no-mapa")
	await fim_forcado(j, "vitoria")
	await foto("t09-operacao-completa")
	ck(app.recordes.tem("operacao") and not app.operacao.ativa(), "operação completa")

	for arq in GUARDAR:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes2"):
			DirAccess.rename_absolute(arq + ".antes2", arq)
	print("RODADA NOVA: ", "tudo certo" if falhas.is_empty() else JSON.stringify(falhas))
	quit(0 if falhas.is_empty() else 1)
