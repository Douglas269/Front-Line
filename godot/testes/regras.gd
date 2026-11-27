extends SceneTree
## Testes das regras (sem tela). Uso: godot --headless --path . -s res://testes/regras.gd
## Com "-- robo N" também joga N partidas por fase com o robô "esperto" (igual ao do jogo web).

var falhas: Array = []

func ck(cond: bool, nome: String) -> void:
	if not cond:
		falhas.append(nome)

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	_regras()
	if args.size() >= 2 and args[0] == "robo":
		var fases: Array = [1, 2, 3, 4, 5, 6]
		if args.size() >= 3:
			fases = Array(args[2].split(",")).map(func(x): return int(x))
		for f in fases:
			_medir(f, int(args[1]))
	if args.size() >= 2 and args[0] == "avulsas":
		_medir_avulsas(int(args[1]))
	if falhas.is_empty():
		print("REGRAS: todas as verificações passaram.")
	else:
		print("FALHAS: ", JSON.stringify(falhas, "  "))
	quit(0 if falhas.is_empty() else 1)

func _novo(f := 1) -> JogoC:
	var j := JogoC.new(CampanhaC.new(false), 12345)
	j.novo(f)
	for b in j.pensar.keys():
		j.pensar[b] = 1.0e9
	j.extras = false
	return j

func _regras() -> void:
	var esperado := [26, 25, 36, 39, 44, 50]
	for n in range(1, 7):
		var j := _novo(n)
		ck(j.lista_prov.size() == esperado[n - 1], "fase %d: quantidade de províncias" % n)
		ck(j.lista_prov.all(func(p): return p.viz.all(func(v): return j.prov[v].viz.has(p.id))), "fase %d: vizinhança dos dois lados" % n)
		ck(j.prov[j.capital_jogador].dono == "jogador" and not j.parados_em(j.capital_jogador, "jogador").is_empty(), "fase %d: capital com tropa" % n)
	var j := _novo(1)
	var cap: ProvinciaC = j.prov[j.capital_jogador]
	# produção da capital igual à do jogo web
	var pd := j.producao_de(cap)
	ck(pd["comida"] == 3.0 and pd["mun"] == 5.0 and pd["moedas"] == 6.0, "produção da capital")
	# recrutar custa e ocupa vaga
	j.fac["jogador"]["moedas"] = 100.0
	var tropa := j.tropa_de("jogador")
	ck(j.recrutar(cap.id, 2) == 2 and j.fac["jogador"]["moedas"] == 70.0 and j.tropa_de("jogador") == tropa + 2, "recrutar")
	ck(not j.recrutar_em(cap.id, "jogador", "blind"), "tropa sem pesquisa não sai")
	# mover, dividir e conquistar província sem defesa
	var alvo: ProvinciaC = j.prov[cap.viz[0]]
	j.ex = j.ex.filter(func(e): return not (e.prov == alvo.id and e.dono != "jogador"))
	alvo.dono = "neutro"
	var e: ExercitoC = j.parados_em(cap.id, "jogador")[0]
	var vai := j.ordem(e.id, alvo.id, 3, "ataque")
	ck(vai != null and vai.s.size() == 3, "ordem divide o exército")
	for i in 400:
		j.passo(0.25)
	ck(alvo.dono == "jogador", "entrar sem defesa conquista")
	# batalha: artilharia com aviso e abrigo; recuo não some tropa
	j = _novo(1)
	cap = j.prov[j.capital_jogador]
	alvo = j.prov[cap.viz[0]]
	j.ex = j.ex.filter(func(x): return x.prov != alvo.id)
	alvo.dono = "neutro"
	alvo.trinch = 40.0
	var def := j.criar_exercito("neutro", alvo.id, 8)
	var atq := j.criar_exercito("jogador", cap.id, 10)
	atq.prov = alvo.id; atq.de = cap.id; atq.pos = alvo.pos
	j.fac["jogador"]["mun"] = 200.0
	var b := j.abrir_batalha(atq, alvo, [def])
	var vida_antes := 0.0
	for c in b.def:
		vida_antes += c.s.vida
	ck(b.atirar_artilharia("atq") and j.fac["jogador"]["mun"] == 160.0 and not b.atirar_artilharia("atq"), "artilharia gasta uma vez")
	ck(b.art_a_caminho("def"), "artilharia avisa antes de cair")
	b.post_atq = "recuar"
	var sobrou_antes := 0
	var meus_antes := j.tropa_de("jogador")
	var vivos_antes := b.vivos("atq").size()
	for i in 600:
		if not j.batalhas.has(b):
			break
		sobrou_antes = b.vivos("atq").size()
		j._avancar_batalhas(0.1)
	var mortos: int = vivos_antes - sobrou_antes
	ck(b.recuou and sobrou_antes > 0 and j.tropa_de("jogador") == meus_antes - mortos and j.parados_em(cap.id, "jogador").size() == 1, "recuo volta para a origem sem sumir")
	# consumo de aço e falta
	j = _novo(1)
	var meu: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	meu.s.append(SoldadoC.new("a", "art"))
	meu.s.append(SoldadoC.new("b", "blind"))
	ck(is_equal_approx(j.manutencao_de("jogador", "manut_aco"), 0.3), "aço por ciclo")
	j.fac["jogador"]["aco"] = 0.0
	for k in 12:
		meu.s.append(SoldadoC.new("b", "blind"))
	j.fac["jogador"]["moedas"] = 900.0
	j.ciclo_economia()
	ck(j.fac["jogador"]["falta_aco"], "falta de aço")
	ck(j.fator_lotacao("jogador") < 1.0 and j.fator_lotacao("jogador") >= 0.7, "sublotação")
	# salvar e carregar no meio da batalha
	j = _novo(1)
	cap = j.prov[j.capital_jogador]
	alvo = j.prov[cap.viz[0]]
	j.ex = j.ex.filter(func(x): return x.prov != alvo.id)
	alvo.dono = "neutro"
	def = j.criar_exercito("neutro", alvo.id, 10)
	atq = j.criar_exercito("jogador", cap.id, 8)
	atq.prov = alvo.id; atq.de = cap.id; atq.pos = alvo.pos
	b = j.abrir_batalha(atq, alvo, [def])
	b.post_atq = "cobertura"
	b.atirar_artilharia("atq")
	for i in 10:
		b.passo(0.2)
	var foto := [snappedf(b.t, 0.001), b.post_atq, b.usou_art, b.vivos("atq").size(), b.vivos("def").size(), j.tropa_de("jogador")]
	var texto := JSON.stringify(j.salvar())
	var k2 := JogoC.new(CampanhaC.new(false), 9)
	ck(k2.carregar(JSON.parse_string(texto)), "carrega")
	ck(k2.batalhas.size() == 1, "batalha volta")
	if k2.batalhas.size() == 1:
		var b2: BatalhaC = k2.batalhas[0]
		ck([snappedf(b2.t, 0.001), b2.post_atq, b2.usou_art, b2.vivos("atq").size(), b2.vivos("def").size(), k2.tropa_de("jogador")] == foto, "batalha igual depois de carregar")
		ck(b2.atq.all(func(c): return c.s.vida <= 0.0 or b2.ex.s.any(func(s): return is_same(s, c.s))), "soldados da batalha são os do exército")
	# missões, eventos, ofensiva, domínio
	j = _novo(1)
	j.extras = true
	for i in 32:
		j.passo(0.25)
	ck(not j.vida.missao.is_empty(), "primeira missão cedo")
	for id in VidaC.EVENTOS:
		for op in 2:
			j.fac["jogador"]["moedas"] = 200.0; j.fac["jogador"]["comida"] = 200.0; j.fac["jogador"]["mun"] = 200.0
			var q: ProvinciaC = j.lista_prov.filter(func(p): return not p.capital)[0]
			q.dono = "jogador"
			q.moral = 30.0
			ck(j.vida.novo_evento(id) and j.vida.escolher(op), "evento %s opção %d" % [id, op])
	j = _novo(1)
	var bot: String = j.fase["bots"][0]
	j.pensar[bot] = 500.0
	var base: ProvinciaC = j.prov_de(bot)[0]
	var perto: ProvinciaC = j.prov[base.viz[0]]
	perto.dono = "jogador"
	j.t = 240.0
	ck(j.vida.anunciar_ofensiva({"bot": bot, "base": base.id, "alvo": perto.id}), "anuncia ofensiva")
	var antes_bot := j.tropa_de(bot)
	j.t = j.vida.ofensiva["em"]
	j.vida.passo_ofensiva()
	ck(j.tropa_de(bot) > antes_bot and j.vida.ofensiva.get("lancada", false), "ofensiva chega com reforço")
	j = _novo(1)
	j.t = 100.0
	var n := 0
	for p in j.lista_prov:
		if not p.capital and n < j.vida.provincias_para_dominar():
			p.dono = "jogador"
			n += 1
	j.vida.passo_final()
	j.t += VidaC.FINAL_SEGURA + 1.0
	j.vida.passo_final()
	ck(j.fim == "dominio" and j.calcular_estrelas() >= 2, "domínio vence")
	# campanha: estrelas, reforços
	var c := CampanhaC.new(false)
	var jc := JogoC.new(c, 3)
	jc.novo(1)
	jc.fim = "vitoria"
	jc.t = 100.0
	c.guardar_progresso(jc, jc.calcular_estrelas())
	ck(c.fase_liberada(2) and c.oferta_de_reforco(1).size() == 3, "vitória libera fase e oferta")
	var escolhido: String = c.oferta_de_reforco(1)[0]
	ck(c.escolher_reforco(1, escolhido) and c.oferta_de_reforco(1).is_empty(), "escolhe um reforço")
	for id in Dados.REFORCOS:
		c.meta["reforcos"] = [id]
		jc.novo(1)
		c.aplicar_reforcos(jc)
		ck(jc.reforcos == [id], "aplica reforço " + id)

# ------------------------------------------------------------ robô "esperto" (o mesmo dos testes do jogo web, usando a batalha)
func _medir(fase: int, partidas: int) -> void:
	var venceu := 0
	var fins := {}
	var dur := 0.0
	var inicio := Time.get_ticks_msec()
	for k in partidas:
		var j := JogoC.new(CampanhaC.new(false), 1000 * fase + k + 1)
		j.novo(fase)
		j.jogador_automatico = true
		_jogar(j)
		fins[j.fim] = fins.get(j.fim, 0) + 1
		if j.venceu():
			venceu += 1
		dur += j.t
	print("fase %d: venceu %d%% %s dur %ds (%d s de máquina)" % [fase, roundi(100.0 * venceu / partidas), JSON.stringify(fins), roundi(dur / partidas), (Time.get_ticks_msec() - inicio) / 1000])

## o mesmo robô em mapas gerados na hora
func _medir_avulsas(partidas: int) -> void:
	for tam in ["p", "m", "g"]:
		for bots in [2, 3]:
			var venceu := 0
			var fins := {}
			for k in partidas:
				var j := JogoC.new(CampanhaC.new(false), 40 + k)
				var o := ModosC.origem_rapida(0, tam, bots, [], 900 + k * 37)
				o["bot_facil"] = 0.8
				j.novo_de_origem(o, false)
				j.jogador_automatico = true
				_jogar(j)
				fins[j.fim] = fins.get(j.fim, 0) + 1
				venceu += int(j.venceu())
			print("mapa %s, %d inimigos: venceu %d%% %s" % [tam, bots, roundi(100.0 * venceu / partidas), JSON.stringify(fins)])

func _jogar(j: JogoC) -> void:
	var pensa := 0.0
	var passos := 0
	while j.fim == "":
		j.passo(0.5)
		passos += 1
		if passos > 20000:
			falhas.append("partida travou na fase %d" % j.fase["n"])
			return
		pensa -= 0.5
		if pensa > 0.0 or j.fim != "":
			continue
		pensa = 3.0
		RoboC.jogar(j)
