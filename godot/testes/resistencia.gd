extends SceneTree
## Deixa o robô jogar fases inteiras com a interface ligada, abrindo todos os painéis,
## para achar erro que só aparece no meio da partida. Uso (com janela):
## godot --path . --resolution 432x936 -s res://testes/resistencia.gd -- <pasta das fotos>

const ARQS := ["user://campanha.json", "user://partida.json", "user://config.json"]
var app
var pasta := ""
var defesas := 0
var batalhas := 0
var paineis_vistos := {}

func _initialize() -> void:
	pasta = OS.get_cmdline_user_args()[0]
	_rodar()

func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(pasta.path_join(nome + ".png"))

func _rodar() -> void:
	for arq in ARQS:
		if FileAccess.file_exists(arq):
			DirAccess.copy_absolute(arq, arq + ".antes")
			DirAccess.remove_absolute(arq)
	app = load("res://principal.tscn").instantiate()
	root.add_child(app)
	await create_timer(0.5).timeout
	app.config["guia_feito"] = true
	app.config["sem_dicas"] = true
	var tiradas := {}
	for fase in [2, 4, 5, 6]:
		app.comecar_fase(fase)
		await create_timer(0.3).timeout
		var j: JogoC = app.jogo
		j.jogador_automatico = true
		j.pausado = false
		var quadro := 0
		var cenas := 0
		while j.fim == "" and quadro < 20000:
			quadro += 1
			# o jogo anda rápido e o robô joga pelo jogador; a interface acompanha
			for i in 4:
				if j.fim == "":
					j.passo(0.1)
			if app._tela.visible:
				break
			if app._cena:
				cenas += 1
				if app._cena.b.lado_do_jogador() == "def" and not tiradas.has("defesa") and cenas > 25:
					tiradas["defesa"] = true
					await foto("r-defesa")
				if cenas > 90 or app._cena.b.terminou:
					app._fechar_batalha()
					cenas = 0
					batalhas += 1
			if quadro % 15 == 0:
				_abrir_um_painel(j, int(quadro / 15.0))
				var chave: String = app.sel.get("tipo", "")
				if chave in ["diplomacia", "generais", "pesquisa", "ex"] and not tiradas.has(chave):
					tiradas[chave] = true
					app._fechar_batalha()
					await create_timer(0.4).timeout
					await foto("r-" + chave)
			await process_frame
		await create_timer(0.6).timeout
		print("fase %d: fim=%s t=%d quadros=%d batalhas vistas=%d" % [fase, j.fim, int(j.t), quadro, batalhas])
		await foto("r-fim-%d" % fase)
	print("painéis abertos: ", paineis_vistos.keys())
	for arq in ARQS:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes"):
			DirAccess.rename_absolute(arq + ".antes", arq)
	print("RESISTENCIA: terminou")
	quit()

func _abrir_um_painel(j: JogoC, n: int) -> void:
	var minhas := j.minhas()
	var tipos := ["prov", "ex", "recrutar", "obras", "pesquisa", "diplomacia", "generais", "economia", "situacao", "dispensar"]
	var tipo: String = tipos[n % tipos.size()]
	var s := {"tipo": tipo}
	if tipo in ["prov", "recrutar", "obras"]:
		if minhas.is_empty():
			return
		s["id"] = minhas[n % minhas.size()].id
		if tipo == "prov" and n % 3 == 0:
			s["id"] = j.lista_prov[n % j.lista_prov.size()].id
	elif tipo in ["ex", "dispensar"]:
		var meus := j.ex_de("jogador")
		if meus.is_empty():
			return
		s["id"] = meus[n % meus.size()].id
		app.ver_detalhes = n % 2 == 0
	app.selecionar(s)
	paineis_vistos[tipo] = true
