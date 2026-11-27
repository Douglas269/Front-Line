extends SceneTree
## Monta uma folha com todos os quadros das tropas, para conferir o desenho.
## Uso (sem janela): godot --headless --path . -s res://testes/folha.gd -- <arquivo.png> [tipo...]

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var tipos: Array = args.slice(1) if args.size() > 1 else ["inf", "metr", "cav", "art", "blind"]
	var linhas: Array = []
	for tipo in tipos:
		var anims: Dictionary = ArteC.QUADROS["inf" if tipo == "metr" else tipo]
		var linha: Array = []
		for anim in anims:
			if tipo == "metr" and not anim in ["mirar", "atirar", "deitado"]:
				continue
			for k in int(anims[anim]):
				linha.append([tipo, anim, k])
				if linha.size() == 10:
					linhas.append(linha)
					linha = []
		if not linha.is_empty():
			linhas.append(linha)
	var e := 3.0
	var cel := Vector2i(ArteC.CAIXA * e)
	var folha := Image.create(cel.x * 10, cel.y * linhas.size(), false, Image.FORMAT_RGBA8)
	folha.fill(Color("55503f"))
	var inicio := Time.get_ticks_usec()
	var total := 0
	for y in linhas.size():
		for x in linhas[y].size():
			var q: Array = linhas[y][x]
			var img := Image.new()
			var erro := img.load_svg_from_string(ArteC.svg(q[0], q[1], q[2], Color(Dados.FACCOES["jogador"]["cor"])), e)
			if erro != OK:
				print("SVG com erro: ", q)
				continue
			img.convert(Image.FORMAT_RGBA8)
			folha.blend_rect(img, Rect2i(Vector2i.ZERO, cel), Vector2i(x * cel.x, y * cel.y))
			total += 1
	print("%d quadros em %.0f ms" % [total, (Time.get_ticks_usec() - inicio) / 1000.0])
	folha.save_png(args[0])
	quit()
