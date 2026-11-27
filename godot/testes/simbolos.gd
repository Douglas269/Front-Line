extends SceneTree
## Todo símbolo escrito no jogo precisa existir nas fontes dele: no navegador não há fonte do sistema.
## godot --headless --path . -s res://testes/simbolos.gd

func _initialize() -> void:
	var usados := {}
	for pasta in ["res://tela", "res://nucleo"]:
		for arq in DirAccess.get_files_at(pasta):
			if arq.ends_with(".gd"):
				for linha in FileAccess.get_file_as_string(pasta.path_join(arq)).split("\n"):
					if not linha.strip_edges().begins_with("#"):
						for c in linha:
							if c.unicode_at(0) > 126:
								usados[c] = true
	var falhas: Array = []
	for qual in ["titulo", "normal", "marca", "leitura"]:
		var f: FontFile = Estilo.fonte(qual)
		f.allow_system_fallback = false
		for s in f.fallbacks:
			s.allow_system_fallback = false
		for c in usados:
			var tem := f.has_char(c.unicode_at(0)) or f.fallbacks.any(func(x): return x.has_char(c.unicode_at(0)))
			if not tem:
				falhas.append("%s sem %s (%04X)" % [qual, c, c.unicode_at(0)])
	print("SIMBOLOS: ", "tudo certo (%d conferidos)" % usados.size() if falhas.is_empty() else str(falhas))
	quit(0 if falhas.is_empty() else 1)
