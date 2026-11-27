extends SceneTree
## Fotografa a mesma batalha em vários cenários.
## godot --path . --resolution 432x936 -s res://testes/cenarios.gd -- <pasta>

const ARQS := ["user://campanha.json", "user://partida.json", "user://config.json", "user://recordes.json"]
const QUAIS := [
	["a-noite", {"hora": "noite", "clima": "limpo", "lugar": ""}, "campo"],
	["b-chuva-ruinas", {"hora": "tarde", "clima": "chuva", "lugar": "ruinas"}, "cidade"],
	["c-dia-ponte", {"hora": "dia", "clima": "limpo", "lugar": "ponte"}, "campo"],
	["d-neblina-pantano", {"hora": "manha", "clima": "neblina", "lugar": "pantano"}, "floresta"],
	["e-neve-morro", {"hora": "dia", "clima": "neve", "lugar": ""}, "morro"]
]
var app
var pasta := ""

func _initialize() -> void:
	pasta = OS.get_cmdline_user_args()[0]
	_rodar()

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
	app.config["ver_batalha"] = false
	for q in QUAIS:
		BatalhaCena.forcar = q[1]
		app.comecar_fase(1)
		await create_timer(0.5).timeout
		var j: JogoC = app.jogo
		var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
		var alvo: ProvinciaC = null
		for v in j.prov[j.capital_jogador].viz:
			if j.prov[v].dono == "neutro":
				alvo = j.prov[v]
		alvo.tipo = q[2]
		var b := j.abrir_batalha(e, alvo, j.parados_em(alvo.id, "neutro"))
		j.pausado = false
		app.abrir_batalha_animada(b)
		for i in 38:
			for c in b.atq + b.def:
				c.s.vida = c.s.vida_max()
			await create_timer(0.1).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().get_region(Rect2i(0, 86, 432, 446)).save_png(pasta.path_join(q[0] + ".png"))
		app._fechar_batalha()
	for arq in ARQS:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes"):
			DirAccess.rename_absolute(arq + ".antes", arq)
	var folha := Image.create(432 * QUAIS.size(), 446, false, Image.FORMAT_RGB8)
	for i in QUAIS.size():
		var img := Image.load_from_file(pasta.path_join(QUAIS[i][0] + ".png"))
		img.convert(Image.FORMAT_RGB8)
		folha.blit_rect(img, Rect2i(0, 0, 432, 446), Vector2i(432 * i, 0))
	folha.save_png(pasta.path_join("cenarios.png"))
	print("CENARIOS: prontos")
	quit()
