extends SceneTree
## Mede quadros por segundo e o custo de cada parte da tela.
func _initialize() -> void:
	_rodar()

func medir(nome: String) -> void:
	await create_timer(1.0).timeout
	var n := Engine.get_frames_drawn()
	var t := Time.get_ticks_usec()
	await create_timer(3.0).timeout
	var fps := (Engine.get_frames_drawn() - n) / ((Time.get_ticks_usec() - t) / 1.0e6)
	print("%-22s %7.1f qps  processo %.2f ms  desenhos %d  itens %d" % [nome, fps, Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0, Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME)])

func _rodar() -> void:
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	var arqs := ["user://campanha.json", "user://partida.json", "user://config.json"]
	for a in arqs:
		if FileAccess.file_exists(a):
			DirAccess.copy_absolute(a, a + ".antes")
	var app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await create_timer(0.5).timeout
	app.config["guia_feito"] = true
	app.config["sem_dicas"] = true
	for fase in [1, 6]:
		app.comecar_fase(fase)
		await create_timer(0.3).timeout
		app.pausar(false)
		await medir("fase %d inteiro" % fase)
		app.mapa.visible = false
		await medir("fase %d sem mapa" % fase)
		app.mapa.visible = true
		app._painel.visible = false
		await medir("fase %d sem painel" % fase)
		app._painel.visible = true
	app.config["ver_batalha"] = false
	for leve in [false, true]:
		app.config["graficos"] = "leve" if leve else "completo"
		app._aplicar_graficos()
		BatalhaCena.forcar = {"hora": "noite", "clima": "chuva", "lugar": "ruinas"}
		app.comecar_fase(6)
		await create_timer(0.3).timeout
		var jg: JogoC = app.jogo
		var e: ExercitoC = jg.parados_em(jg.capital_jogador, "jogador")[0]
		var alvo := ""
		for v in jg.prov[jg.capital_jogador].viz:
			if jg.prov[v].dono == "neutro":
				alvo = v
		var bt := jg.abrir_batalha(e, jg.prov[alvo], jg.parados_em(alvo, "neutro"))
		jg.pausado = false
		app.abrir_batalha_animada(bt)
		var vivo := [true]
		var curar := func():
			while vivo[0]:
				for c in bt.atq + bt.def:
					c.s.vida = c.s.vida_max()
				await create_timer(0.1).timeout
		curar.call()
		await medir("batalha %s" % ("leve" if leve else "completa"))
		vivo[0] = false
		app._fechar_batalha()
	for a in arqs:
		if FileAccess.file_exists(a):
			DirAccess.remove_absolute(a)
		if FileAccess.file_exists(a + ".antes"):
			DirAccess.rename_absolute(a + ".antes", a)
	quit()
