extends SceneTree
## Mede a dificuldade com o robô jogando pelo jogador, com as mesmas configurações do jogo.
## O robô é mais fraco que uma pessoa atenta: sirva-se dos números para comparar, não como verdade.
## godot --headless --path . -s res://testes/equilibrio.gd -- rapida|operacao <partidas> [filtro]

func _initialize() -> void:
	var a := OS.get_cmdline_user_args()
	var n := int(a[1])
	var filtro: String = a[2] if a.size() > 2 else ""
	if a[0] == "rapida":
		for tam in ["p", "m", "g"]:
			if filtro != "" and not filtro.contains(tam):
				continue
			for bots in (a[3].split(",") if a.size() > 3 else ["1","2","3","4"]):
				bots = int(bots)
				var lista: Array = []
				for k in n:
					lista.append(ModosC.origem_rapida(0, tam, bots, [], 900 + k * 37))
				_medir("mapa %s, %d inimigo(s)" % [tam, bots], lista)
	else:
		var op := OperacaoC.new()
		var copia: Dictionary = op.d.duplicate(true)
		for etapa in range(1, OperacaoC.ETAPAS + 1):
			if filtro != "" and not filtro.contains(str(etapa)):
				continue
			for caminho in 2:
				var lista: Array = []
				for k in n:
					op.nova(3000 + k)
					# chega na etapa com os reforços do caminho seguro até ali
					while op.etapa() < etapa:
						op.escolher(0)
						op.resultado(true, op.etapa(), [])
					lista.append(op.escolher(caminho))
				_medir("etapa %d %s" % [etapa, "arriscado" if caminho else "seguro   "], lista)
		op.d = copia
		if copia.is_empty():
			op.apagar()
		else:
			op.gravar()
	quit()

func _medir(nome: String, origens: Array) -> void:
	var venceu := 0
	var fins := {}
	var dur := 0.0
	for k in origens.size():
		var j := JogoC.new(CampanhaC.new(false), 40 + k)
		j.novo_de_origem(origens[k], false)
		j.jogador_automatico = true
		_jogar(j)
		fins[j.fim] = fins.get(j.fim, 0) + 1
		venceu += int(j.venceu())
		dur += j.t
	print("%s: venceu %3d%%  dura %3d s  %s" % [nome, roundi(100.0 * venceu / origens.size()), roundi(dur / origens.size()), JSON.stringify(fins)])

## o mesmo robô "esperto" do teste de regras
func _jogar(j: JogoC) -> void:
	var pensa := 0.0
	var passos := 0
	while j.fim == "" and passos < 20000:
		j.passo(0.5)
		passos += 1
		pensa -= 0.5
		if pensa > 0.0 or j.fim != "":
			continue
		pensa = 3.0
		RoboC.jogar(j)
