extends SceneTree
## Confere por medição os sons feitos em código (ninguém aqui consegue ouvir):
## todos existem, não são mudos nem estouram, e os que repetem emendam o fim no começo.
## godot --headless --path . -s res://testes/sons.gd -- [pasta para salvar os .wav]

func _initialize() -> void:
	_rodar()

func _rodar() -> void:
	var s := SonsC.new()
	root.add_child(s)
	await process_frame
	var args := OS.get_cmdline_user_args()
	var falhas: Array = []
	var nomes: Array = s._sons.keys()
	for nome in SonsC.SOM_DA_TROPA.values() + ["ferrolho", "apito", "fumaca", "chuva", "vento", "tambores"]:
		if not nomes.has(nome):
			falhas.append("falta o som " + nome)
	for nome in nomes:
		var w: AudioStreamWAV = s._sons[nome]
		var n := w.data.size() / 2
		var pico := 0.0
		var soma := 0.0
		var cheios := 0
		for i in n:
			var v := absf(w.data.decode_s16(i * 2) / 32768.0)
			pico = maxf(pico, v)
			soma += v * v
			cheios += int(v > 0.97)
		var media := sqrt(soma / n)
		print("%-12s %4.2f s  pico %.2f  volume %.3f  estourado %.1f%%" % [nome, float(n) / w.mix_rate, pico, media, 100.0 * cheios / n])
		if pico < 0.1 or media < 0.008:
			falhas.append(nome + " quase mudo")
		if float(cheios) / n > 0.03:
			falhas.append(nome + " estourando")
		if w.loop_mode == AudioStreamWAV.LOOP_FORWARD and w.loop_end != n:
			falhas.append(nome + " com volta errada")
		if not args.is_empty():
			w.save_to_wav(args[0].path_join(nome + ".wav"))
	s.tensao(1.0)
	for i in 200:
		s._process(0.05)
	if not s._tambores.playing:
		falhas.append("a percussão não entra com a batalha apertada")
	s.tensao(0.0)
	for i in 200:
		s._process(0.05)
	if s._tambores.playing:
		falhas.append("a percussão não para")
	print("SONS: ", "tudo certo (%d sons)" % nomes.size() if falhas.is_empty() else str(falhas))
	quit(0 if falhas.is_empty() else 1)
