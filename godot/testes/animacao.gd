extends SceneTree
## Grava uma batalha com todos os tipos de tropa, quadro a quadro, para conferir as animações.
## Uso (com janela): godot --path . --resolution 432x936 -s res://testes/animacao.gd -- <pasta>

const ARQS := ["user://campanha.json", "user://partida.json", "user://config.json"]
var app
var pasta := ""
var n := 0

func _initialize() -> void:
	pasta = OS.get_cmdline_user_args()[0]
	_rodar()

func gravar(seg: float) -> void:
	var fim := Time.get_ticks_msec() + int(seg * 1000.0)
	while Time.get_ticks_msec() < fim:
		await create_timer(0.1).timeout
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(pasta.path_join("anim%03d.png" % n))
		n += 1

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
	app.comecar_fase(6)
	await create_timer(0.6).timeout
	var j: JogoC = app.jogo
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	var tipos := ["inf", "inf", "metr", "cav", "inf", "blind", "art", "inf"]
	for i in e.s.size():
		e.s[i].tipo = tipos[i % tipos.size()]
		e.s[i].vida = e.s[i].vida_max()
	var alvo := ""
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = v
	for x in j.parados_em(alvo, "neutro"):
		var quais := ["inf", "metr", "inf", "art", "inf", "cav"]
		for i in x.s.size():
			x.s[i].tipo = quais[i % quais.size()]
	j.ordem(e.id, alvo, e.s.size(), "atacar")
	j.pausado = false
	for i in 400:
		j.passo(0.1)
		if not j.batalhas.is_empty():
			break
	for i in 40:
		await create_timer(0.1).timeout
		if app._cena:
			break
	if app._cena == null:
		app.abrir_batalha_animada(j.batalhas[0])
	var b: BatalhaC = app._cena.b
	for c in b.atq + b.def: # mais vida, para a gravação durar
		c.s.vida = c.s.vida_max()
	await gravar(3.0)
	app.postura(b, "cobertura")
	await gravar(2.0)
	j.fac["jogador"]["mun"] = 200.0
	app.artilharia(b)
	await gravar(2.4)
	app.postura(b, "avancar")
	await gravar(2.4)
	for c in b.def:
		c.s.vida = minf(c.s.vida, 6.0)
	await gravar(3.6)
	if app._cena:
		app._fechar_batalha()
	await create_timer(0.8).timeout
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(pasta.path_join("anim-mapa.png"))
	for arq in ARQS:
		if FileAccess.file_exists(arq):
			DirAccess.remove_absolute(arq)
		if FileAccess.file_exists(arq + ".antes"):
			DirAccess.rename_absolute(arq + ".antes", arq)
	print("ANIMACAO: %d quadros, terminou=%s" % [n, b.terminou])
	quit()
