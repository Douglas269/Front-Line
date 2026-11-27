extends SceneTree
## Pinta o chão dos 6 mapas da campanha com o mesmo pintor dos mapas gerados (substitui o exportado do jogo web).
## godot --headless --path . -s res://ferramentas/pintar_mapas.gd

func _initialize() -> void:
	for m in JogoC.mapas():
		var inicio := Time.get_ticks_msec()
		var img := PintorC.imagem(m, int(m["n"]) * 977)
		img.convert(Image.FORMAT_RGB8)
		img.save_png("res://dados/terreno%d.png" % int(m["n"]))
		print("mapa %d: %dx%d em %d ms" % [int(m["n"]), img.get_width(), img.get_height(), Time.get_ticks_msec() - inicio])
	quit()
