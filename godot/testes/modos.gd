extends SceneTree
## Mapas gerados, partidas avulsas e as regras novas, sem tela.
## godot --headless --path . -s res://testes/modos.gd -- [pasta para as imagens do chão]

var falhas := {}
var total := 0

func ck(c: bool, nome: String) -> void:
	total += 1
	if not c:
		falhas[nome] = falhas.get(nome, 0) + 1

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	_mapas(args[0] if not args.is_empty() else "")
	_partidas()
	_regras_novas()
	_historia_e_chefes()
	print("MODOS: %d verificações, %s" % [total, "todas passaram" if falhas.is_empty() else "FALHOU " + str(falhas)])
	quit(0 if falhas.is_empty() else 1)

func _mapas(pasta: String) -> void:
	var ms := 0.0
	var menor := 99.0
	for semente in range(1, 61):
		var tam: String = ["p", "m", "g"][semente % 3]
		var bots: Array = ModosC.BOTS.slice(0, 1 + semente % 4)
		var m := GeradorC.gerar(semente * 7919, tam, bots)
		var P := {}
		for p in m["prov"]:
			P[p["id"]] = p
		ck(P.size() == GeradorC.TAMANHOS[tam]["n"], "quantidade de províncias")
		var vistos := {m["capitalJogador"]: true}
		var fila: Array = [m["capitalJogador"]]
		while not fila.is_empty():
			for v in P[fila.pop_back()]["viz"]:
				if not vistos.has(v):
					vistos[v] = true
					fila.append(v)
		ck(vistos.size() == P.size(), "mapa todo ligado")
		for p in m["prov"]:
			ck(p["poli"].size() >= 3, "contorno da província")
			var poli := PackedVector2Array(p["poli"].map(func(q): return Vector2(q[0], q[1])))
			ck(Geometry2D.is_point_in_polygon(Vector2(p["x"], p["y"]), poli), "centro dentro do contorno")
			ck(not Geometry2D.triangulate_polygon(poli).is_empty(), "contorno pode ser pintado")
			ck(p["viz"].size() >= 1 and p["viz"].all(func(v): return P[v]["viz"].has(p["id"])), "vizinhança dos dois lados")
			for q in m["prov"]:
				if q["id"] != p["id"]:
					menor = minf(menor, Vector2(p["x"], p["y"]).distance_to(Vector2(q["x"], q["y"])))
		for f in ["jogador"] + bots:
			var minhas: Array = m["prov"].filter(func(p): return p["dono"] == f)
			ck(minhas.size() >= 2, "cada país começa com terra")
			ck(minhas.filter(func(p): return p["capital"]).size() == 1, "uma capital por país")
		ck(JSON.stringify(GeradorC.gerar(semente * 7919, tam, bots)) == JSON.stringify(m), "mesma semente, mesmo mapa")
		if pasta != "" and semente <= 3:
			var t0 := Time.get_ticks_msec()
			var tex := PintorC.terreno(m, semente * 7919)
			ms = maxf(ms, Time.get_ticks_msec() - t0)
			tex.get_image().save_png(pasta.path_join("chao-%s.png" % tam))
	print("menor distância entre cidades: %.0f · pintar o chão: até %.0f ms" % [menor, ms])
	ck(menor > 55.0, "cidades não ficam coladas")

func _jogar(j: JogoC) -> void:
	j.jogador_automatico = true
	var i := 0
	while j.fim == "" and i < 12000:
		j.passo(0.1 * 1.0)
		i += 1

func _partidas() -> void:
	var fins := {}
	var vitorias := 0
	var n := 24
	for k in n:
		var camp := CampanhaC.new(false)
		var j := JogoC.new(camp, 100 + k)
		var o := ModosC.origem_rapida(0 if k % 4 else 1 + k % 6, ["p", "m", "g"][k % 3], 2 + k % 2, [ModosC.REGRAS.keys()[k % ModosC.REGRAS.size()]], 5000 + k * 13)
		j.novo_de_origem(o, false)
		ck(j.fase["n"] == 0 and not j.lista_prov.is_empty(), "partida avulsa começa")
		for i in 600:
			j.passo(0.1)
		var d = JSON.parse_string(JSON.stringify(j.salvar()))
		var j2 := JogoC.new(camp, 7)
		ck(j2.carregar(d), "partida avulsa carrega")
		ck(j2.lista_prov.size() == j.lista_prov.size() and j2.tropa_de("jogador") == j.tropa_de("jogador") and absf(j2.t - j.t) < 0.01 and j2.lista_prov.map(func(p): return p.nome + p.dono) == j.lista_prov.map(func(p): return p.nome + p.dono), "carregar devolve a mesma partida")
		_jogar(j2)
		ck(j2.fim != "", "partida avulsa termina")
		ck(j2.historico.size() > 10, "histórico guardado")
		fins[j2.fim] = fins.get(j2.fim, 0) + 1
		vitorias += int(j2.venceu())
	print("partidas avulsas levadas até o fim: %d, finais %s" % [n, fins])
	var a := ModosC.origem_diario("2026-11-26")
	ck(JSON.stringify(a) == JSON.stringify(ModosC.origem_diario("2026-11-26")), "desafio do dia é sempre igual no mesmo dia")
	ck(JSON.stringify(a) != JSON.stringify(ModosC.origem_diario("2026-11-27")), "e muda no dia seguinte")

func _regras_novas() -> void:
	var j := JogoC.new(CampanhaC.new(false), 3)
	j.novo(1)
	# recrutamento automático e ponto de reunião
	var destino := ""
	for p in j.minhas():
		if p.id != j.capital_jogador:
			destino = p.id
	j.marcar_reuniao(destino)
	j.auto_rec["ligado"] = true
	j.auto_rec["reserva"] = 0
	j.fac["jogador"]["moedas"] = 500.0
	j.fac["jogador"]["comida"] = 500.0
	var antes := j.tropa_de("jogador")
	var no_destino: int = j.parados_em(destino, "jogador").reduce(func(a, e): return a + e.s.size(), 0)
	for b in j.pensar:
		j.pensar[b] = 1.0e9
	for i in 600:
		j.passo(0.1)
	ck(j.tropa_de("jogador") > antes, "recruta sozinho")
	ck(j.parados_em(destino, "jogador").reduce(func(a, e): return a + e.s.size(), 0) > no_destino, "recrutas vão ao ponto de reunião")
	j.auto_rec["reserva"] = 100000
	var t := j.tropa_de("jogador")
	for i in 100:
		j.passo(0.1)
	ck(j.tropa_de("jogador") == t, "respeita as moedas guardadas")
	# táticas
	j = JogoC.new(CampanhaC.new(false), 9)
	j.novo(1)
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	var alvo := ""
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = v
	var b := j.abrir_batalha(e, j.prov[alvo], j.parados_em(alvo, "neutro"))
	var mun: float = j.fac["jogador"]["mun"]
	ck(b.soltar_fumaca("atq") and b.fumaca_ativa("atq") and j.fac["jogador"]["mun"] == mun - Dados.FUMACA_MUN, "fumaça funciona e custa munição")
	ck(not b.soltar_fumaca("atq"), "fumaça só uma vez")
	var d0: float = b.atq[0].dist
	b.dar_carga()
	b.passo(1.0)
	ck(b.carga_ativa() and d0 - b.atq[0].dist > Dados.VELBAT["avancar"] * 1.5, "carga corre mais")
	ck(not b.dar_carga(), "carga só uma vez")
	b.passo(Dados.CARGA_DURA)
	ck(not b.carga_ativa(), "carga acaba")
	var quem := b.quem_pode_reforcar("atq")
	ck(quem != null, "há um vizinho para reforçar")
	if quem:
		var n_antes := b.atq.size()
		ck(b.pedir_reforco("atq"), "reforço sai")
		ck(not b.pedir_reforco("atq"), "reforço só uma vez")
		for k in 400:
			for c in b.atq + b.def:
				c.s.vida = c.s.vida_max() # a batalha precisa durar até o reforço chegar
			j.passo(0.1)
			if b.atq.size() > n_antes or b.terminou:
				break
		ck(b.atq.size() > n_antes, "reforço entra na batalha")
	var salvo = JSON.parse_string(JSON.stringify(j.salvar()))
	var j2 := JogoC.new(CampanhaC.new(false), 1)
	j2.carregar(salvo)
	ck(not j2.batalhas.is_empty() and j2.batalhas[0].fumaca["atq"]["usada"] and j2.batalhas[0].carga["usada"], "táticas ficam salvas")
	# todos os acontecimentos funcionam nas duas escolhas
	for id in VidaC.EVENTOS:
		for i in 2:
			var k := JogoC.new(CampanhaC.new(false), 11 + i)
			k.novo(3)
			for r in k.fac["jogador"]:
				if k.fac["jogador"][r] is float:
					k.fac["jogador"][r] = 500.0
			if id == "descontentes":
				for p in k.minhas():
					if not p.capital:
						p.moral = 10.0
			var ok := k.vida.novo_evento(id)
			ck(ok and k.vida.escolher(i) and k.vida.evento.is_empty(), "acontecimento " + id)
	print("acontecimentos: %d" % VidaC.EVENTOS.size())
	# recordes e conquistas
	var r := RecordesC.new()
	var copia: Dictionary = r.d.duplicate(true)
	r.d = {"partidas": 0, "vitorias": 0, "conquistas": {}, "tempos": {}, "diario": {}, "operacoes": 0}
	j = JogoC.new(CampanhaC.new(false), 2)
	j.novo(1)
	j.t = 200.0
	j.fim = "dominio"
	var res := r.registrar(j, {"modo": "campanha", "chave": "fase1", "estrelas": 3})
	ck(res["recorde"] and res["novas"].has("primeira") and res["novas"].has("relampago") and res["novas"].has("intacto"), "conquistas e recorde")
	j.t = 300.0
	res = r.registrar(j, {"modo": "campanha", "chave": "fase1"})
	ck(not res["recorde"] and res["novas"].is_empty() and res["anterior"] == 200.0, "não repete nem piora o recorde")
	r.d = copia
	r.gravar()
	ck(RecordesC.virada([[0, {"jogador": 2, "bravo": 3}], [5, {"jogador": 4, "bravo": 3}], [10, {"jogador": 5, "bravo": 3}]], ["bravo"]) == 5, "momento da virada")

func _historia_e_chefes() -> void:
	# história, memorial e nomes
	var j := JogoC.new(CampanhaC.new(false), 21)
	j.novo(1)
	var nomes := {}
	for b in j.pensar:
		j.pensar[b] = 1.0e9
	j.fac["jogador"]["moedas"] = 5000.0
	for i in 8:
		j.recrutar(j.capital_jogador)
	var e: ExercitoC = j.parados_em(j.capital_jogador, "jogador")[0]
	for x in e.s.slice(e.s.size() - 8):
		ck(not nomes.has(x.nome), "recrutas novos não repetem nome")
		nomes[x.nome] = true
	var alvo := ""
	for v in j.prov[j.capital_jogador].viz:
		if j.prov[v].dono == "neutro":
			alvo = v
	var heroi: SoldadoC = e.s[0]
	heroi.lutas = 1
	var martir: SoldadoC = e.s[1]
	martir.abates = 3
	var b := j.abrir_batalha(e, j.prov[alvo], j.parados_em(alvo, "neutro"))
	martir.vida = 0.0
	for c in b.def:
		c.s.vida = 0.0
	j._avancar_batalhas(0.05)
	ck(b.terminou and heroi.patente() == 1 and heroi.feitos.size() >= 2 and str(heroi.feitos).contains("veterano"), "soldado guarda a história")
	ck(j.memorial.size() == 1 and j.memorial[0]["nome"] == martir.nome, "quem fez história e caiu vai para o memorial")
	var d = JSON.parse_string(JSON.stringify(j.salvar()))
	var j2 := JogoC.new(CampanhaC.new(false), 5)
	j2.carregar(d)
	ck(j2.memorial.size() == 1 and j2.melhores(1)[0].feitos == heroi.feitos, "história e memorial ficam salvos")
	# veteranos seguem na operação, no lugar de recrutas
	var op := OperacaoC.new()
	var copia: Dictionary = op.d.duplicate(true)
	op.nova(77)
	var o := op.escolher(0)
	var base := JogoC.new(CampanhaC.new(false), 5)
	base.novo_de_origem(o, false)
	var r := op.resultado(true, 1, j.melhores(3))
	ck(r["veteranos"].size() > 0 and op.veteranos().size() == r["veteranos"].size(), "operação guarda os melhores")
	var o2 := op.escolher(0)
	var seguinte := JogoC.new(CampanhaC.new(false), 5)
	seguinte.novo_de_origem(o2, false)
	var na_capital: Array = seguinte.parados_em(seguinte.capital_jogador, "jogador")[0].s
	ck(na_capital.any(func(x): return x.nome == heroi.nome and x.patente() >= 1 and x.vida == x.vida_max()), "veterano começa a missão seguinte")
	# a última etapa tem chefes diferentes nos dois caminhos
	while op.etapa() < OperacaoC.ETAPAS:
		ck(op.opcoes().all(func(m): return not op.d["caminho"].has(m["nome"])), "lugar da operação não repete")
		op.escolher(0)
		op.resultado(true, op.etapa(), [])
	ck(op.opcoes().all(func(m): return m.has("chefe")) and op.opcoes()[0]["chefe"] != op.opcoes()[1]["chefe"], "chefe na última etapa")
	op.d = copia
	if copia.is_empty():
		op.apagar()
	else:
		op.gravar()
	# cada chefe faz o que promete
	for id in Dados.CHEFES:
		var origem := ModosC.origem_rapida(0, "p", 2, [], 4242)
		var normal := JogoC.new(CampanhaC.new(false), 8)
		normal.novo_de_origem(origem, false)
		origem["chefe"] = id
		var k := JogoC.new(CampanhaC.new(false), 8)
		k.novo_de_origem(origem, false)
		var dono: String = k.chefe_dono
		var cap: ProvinciaC = null
		for p in k.lista_prov:
			if p.capital and p.capital_de == dono:
				cap = p
		ck(dono != "" and k.nome_de(dono) == Dados.CHEFES[id]["nome"], "chefe tem nome " + id)
		ck(k.parados_em(cap.id, dono)[0].s.size() == normal.parados_em(cap.id, dono)[0].s.size() + Dados.CHEFE_GUARDA, "guarda do chefe " + id)
		var meu: ExercitoC = k.parados_em(k.capital_jogador, "jogador")[0]
		var bt := k.criar_batalha(meu, cap, k.parados_em(cap.id, dono))
		if id == "ferro":
			ck(cap.tem_obra("forte") and k.prov_de(dono).all(func(p): return p.trinch >= 90.0) and bt.gen_def >= Dados.FERRO_DEFESA, "muralha")
		elif id == "trovao":
			k.fac[dono]["mun"] = 0.0
			ck(bt.atirar_artilharia("def") and not bt.art["def"]["usada"], "primeiro disparo de graça")
			ck(not bt.atirar_artilharia("def"), "não atira com outro no ar")
			bt.t += 20.0
			bt._queda_da_artilharia()
			ck(bt.atirar_artilharia("def") and bt.art["def"]["usada"], "segundo disparo")
		else:
			var a1: ExercitoC = k.parados_em(cap.id, dono)[0]
			var a2: ExercitoC = normal.parados_em(cap.id, dono)[0]
			a1.s = a2.s.duplicate()
			ck(k.vel_ex(a1) > normal.vel_ex(a2) * 1.3, "relâmpago")
		var salvo = JSON.parse_string(JSON.stringify(k.salvar()))
		var k2 := JogoC.new(CampanhaC.new(false), 1)
		k2.carregar(salvo)
		ck(k2.chefe_id == id and k2.chefe_dono == dono, "chefe fica salvo " + id)
		k.conquistar(cap, "jogador")
		ck(k.stats.get("chefe_caiu", false), "derrubar o chefe " + id)
	print("história e chefes conferidos")

