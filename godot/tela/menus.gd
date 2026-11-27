class_name MenusC
extends RefCounted
## Telas dos outros modos: batalha rápida, desafio do dia, operação e conquistas; e o resumo do fim.

var app # a tela principal
var rapida := {"mapa": 0, "tam": "m", "bots": 2, "regra": ""}

func _init(a) -> void:
	app = a

func _linha_de_botoes(v: VBoxContainer, itens: Array, atual, ao: Callable) -> void:
	var g := GridContainer.new()
	g.columns = mini(3, itens.size())
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	for item in itens:
		var valor = item[0]
		var b := Estilo.botao(item[1], item[2] if item.size() > 2 else "", func(): ao.call(valor), valor == atual)
		g.add_child(b)
	v.add_child(g)

func _voltar(v: VBoxContainer) -> void:
	v.add_child(Estilo.botao("← Voltar", "", func(): app.mostrar_inicio()))

## os quatro atalhos da tela de início
func atalhos(v: VBoxContainer) -> void:
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 8)
	g.add_theme_constant_override("v_separation", 8)
	var op: OperacaoC = app.operacao
	var feito: bool = app.recordes.d["diario"].has(ModosC.hoje())
	g.add_child(Estilo.botao("Operação", "etapa %d de %d" % [op.etapa(), OperacaoC.ETAPAS] if op.ativa() else "campanha com caminhos", func(): mostrar_operacao()))
	g.add_child(Estilo.botao("Desafio do dia", "✔ vencido hoje" if feito else "um mapa novo por dia", func(): mostrar_diario()))
	g.add_child(Estilo.botao("Batalha rápida", "monte do seu jeito", func(): mostrar_rapida()))
	g.add_child(Estilo.botao("Conquistas", "%d de %d" % [app.recordes.d["conquistas"].size(), RecordesC.CONQUISTAS.size()], func(): mostrar_conquistas()))
	v.add_child(g)

# ------------------------------------------------------------ batalha rápida
func mostrar_rapida() -> void:
	var v: VBoxContainer = app._abrir_tela("rapida")
	app._t(v, "BATALHA RÁPIDA", 30, Estilo.AMBAR, "marca")
	app._t(v, "Mapa", 17, Estilo.TEXTO, "titulo")
	var mapas: Array = [[0, "Aleatório", "gerado na hora"]]
	for F in Dados.FASES:
		mapas.append([F["n"], F["nome"]])
	_linha_de_botoes(v, mapas, rapida["mapa"], func(x):
		rapida["mapa"] = x
		mostrar_rapida.call_deferred())
	if rapida["mapa"] == 0:
		app._t(v, "Tamanho", 17, Estilo.TEXTO, "titulo")
		var tams: Array = []
		for id in GeradorC.TAMANHOS:
			tams.append([id, GeradorC.TAMANHOS[id]["nome"], "%d províncias" % GeradorC.TAMANHOS[id]["n"]])
		_linha_de_botoes(v, tams, rapida["tam"], func(x):
			rapida["tam"] = x
			mostrar_rapida.call_deferred())
	var maximo := 4 if rapida["mapa"] == 0 else int(Dados.FASES[rapida["mapa"] - 1]["bots"].size())
	rapida["bots"] = clampi(rapida["bots"], 1, maximo)
	app._t(v, "Inimigos", 17, Estilo.TEXTO, "titulo")
	_linha_de_botoes(v, range(1, maximo + 1).map(func(n): return [n, str(n), "mais fácil"] if n == 1 else [n, str(n)]), rapida["bots"], func(x):
		rapida["bots"] = x
		mostrar_rapida.call_deferred())
	app._t(v, "Regra especial", 17, Estilo.TEXTO, "titulo")
	var regras: Array = [["", "Nenhuma"]]
	for id in ModosC.REGRAS:
		regras.append([id, ModosC.REGRAS[id][0]])
	_linha_de_botoes(v, regras, rapida["regra"], func(x):
		rapida["regra"] = x
		mostrar_rapida.call_deferred())
	if rapida["regra"] != "":
		app._t(v, ModosC.REGRAS[rapida["regra"]][1], 15)
	app._t(v, "A dificuldade é a dos Ajustes (agora: %s)." % app.config["dificuldade"].capitalize(), 14)
	v.add_child(Estilo.botao("COMEÇAR ▶", "", func():
		var o := ModosC.origem_rapida(rapida["mapa"], rapida["tam"], rapida["bots"], [] if rapida["regra"] == "" else [rapida["regra"]], randi() % 1000000000)
		app.comecar_com_aviso(o), true))
	_voltar(v)

# ------------------------------------------------------------ desafio do dia
func mostrar_diario() -> void:
	var v: VBoxContainer = app._abrir_tela("diario")
	var dia := ModosC.hoje()
	var o := ModosC.origem_diario(dia)
	app._t(v, "DESAFIO DO DIA", 30, Estilo.AMBAR, "marca")
	app._t(v, "%s/%s/%s" % [dia.substr(8, 2), dia.substr(5, 2), dia.substr(0, 4)], 18, Estilo.TEXTO, "titulo")
	app._t(v, "Mapa %s · %d inimigos" % [GeradorC.TAMANHOS[o["tam"]]["nome"].to_lower(), o["bots"]], 17, Estilo.TEXTO)
	for r in o["regras"]:
		v.add_child(Estilo.texto_rico("[color=#ffd28a][b]%s[/b][/color]: %s" % [ModosC.REGRAS[r][0], ModosC.REGRAS[r][1]], 17, Estilo.TEXTO))
	var tempos: Dictionary = app.recordes.d["diario"]
	app._t(v, "Seu melhor tempo hoje: %s" % RecordesC.relogio(tempos[dia]) if tempos.has(dia) else "Você ainda não venceu o desafio de hoje.", 16)
	app._t(v, "Amanhã o mapa e as regras mudam.", 14)
	v.add_child(Estilo.botao("JOGAR ▶", "", func(): app.comecar_com_aviso(o), true))
	if not tempos.is_empty():
		app._t(v, "ÚLTIMOS DESAFIOS VENCIDOS", 16, Estilo.AMBAR, "titulo")
		var dias: Array = tempos.keys()
		dias.sort()
		dias.reverse()
		for x in dias.slice(0, 7):
			app._t(v, "%s/%s  ·  %s" % [x.substr(8, 2), x.substr(5, 2), RecordesC.relogio(tempos[x])], 15, Estilo.TEXTO)
	_voltar(v)

# ------------------------------------------------------------ operação
func _descricao(m: Dictionary) -> String:
	var o: Dictionary = m["origem"]
	var partes: Array = ["mapa %s · %d inimigos" % [GeradorC.TAMANHOS[o["tam"]]["nome"].to_lower(), int(o["bots"])]]
	for r in o["regras"]:
		partes.append("%s: %s" % [ModosC.REGRAS[r][0], ModosC.REGRAS[r][1]])
	if m.has("chefe"):
		var C: Dictionary = Dados.CHEFES[m["chefe"]]
		partes.append("CHEFE: %s, %s" % [C["nome"], C["titulo"]])
		partes.append(C["txt"])
	var premios: Array = m["premios"].map(func(id): return Dados.REFORCOS[id]["nome"])
	partes.append("Prêmio: " + (" + ".join(premios) if not premios.is_empty() else "completar a operação"))
	return "\n".join(partes)

func mostrar_operacao() -> void:
	var v: VBoxContainer = app._abrir_tela("operacao")
	var op: OperacaoC = app.operacao
	app._t(v, "OPERAÇÃO", 30, Estilo.AMBAR, "marca")
	if not op.ativa():
		app._t(v, "Cinco missões seguidas, em mapas novos. Em cada etapa você escolhe o caminho: o arriscado tem mais perigo e paga o dobro.", 17, Estilo.TEXTO)
		app._t(v, "Os reforços ganhos acumulam até o fim. Se perder uma missão, a operação acaba. A campanha de 6 fases não muda.", 16)
		if app.recordes.d["operacoes"] > 0:
			app._t(v, "Operações completas: %d" % int(app.recordes.d["operacoes"]), 16, Estilo.AMBAR_CLARO)
		v.add_child(Estilo.botao("COMEÇAR OPERAÇÃO ▶", "", func():
			op.nova(randi() % 1000000)
			mostrar_operacao.call_deferred(), true))
		_voltar(v)
		return
	# a trilha das etapas
	var trilha := ""
	for i in range(1, OperacaoC.ETAPAS + 1):
		trilha += "[color=#9fd08f]●[/color] " if i < op.etapa() else ("[color=#ffd28a]◆[/color] " if i == op.etapa() else "○ ")
	v.add_child(Estilo.texto_rico("[font_size=26]%s[/font_size]  etapa %d de %d" % [trilha, op.etapa(), OperacaoC.ETAPAS], 17, Estilo.TEXTO))
	if not op.d.get("caminho", []).is_empty():
		app._t(v, "Caminho: " + " → ".join(op.d["caminho"]), 14)
	if not op.reforcos().is_empty():
		app._t(v, "SEUS REFORÇOS NESTA OPERAÇÃO", 15, Estilo.AMBAR, "titulo")
		for id in op.reforcos():
			v.add_child(Estilo.texto_rico("[b]%s[/b]  %s" % [Dados.REFORCOS[id]["nome"], app._cartao_reforco(id)], 14))
	if not op.veteranos().is_empty():
		app._t(v, "VETERANOS QUE SEGUEM COM VOCÊ", 15, Estilo.AMBAR, "titulo")
		for dados_salvos in op.veteranos():
			var x := SoldadoC.carregar(dados_salvos)
			app._t(v, "%s%s · %s · %s, %s" % ["★★ " if x.patente() == 2 else ("★ " if x.patente() == 1 else ""), x.nome, Dados.TROPAS[x.tipo]["nome"], Dados.qtd(x.lutas, "batalha", "batalhas"), Dados.qtd(x.abates, "abate", "abates")], 15, Estilo.TEXTO)
	app._t(v, "ESCOLHA O CAMINHO", 18, Estilo.AMBAR, "titulo")
	for i in op.opcoes().size():
		var m: Dictionary = op.opcoes()[i]
		var qual: int = i
		v.add_child(Estilo.botao("%s %s" % ["▲▲ Arriscado ·" if m["arriscada"] else "▲ Seguro ·", m["nome"]], _descricao(m), func(): app.comecar_com_aviso(op.escolher(qual)), not m["arriscada"]))
		for id in m["premios"]:
			v.add_child(Estilo.texto_rico("[b]%s[/b]  %s" % [Dados.REFORCOS[id]["nome"], app._cartao_reforco(id)], 13))
	v.add_child(Estilo.botao("Desistir da operação", "", func(): app.confirmar("Desistir da operação? Os reforços dela se perdem.", func():
		op.apagar()
		mostrar_operacao(), func(): mostrar_operacao()), false, false, true))
	_voltar(v)

# ------------------------------------------------------------ conquistas e recordes
func mostrar_conquistas() -> void:
	var v: VBoxContainer = app._abrir_tela("conquistas")
	var r: RecordesC = app.recordes
	app._t(v, "CONQUISTAS", 30, Estilo.AMBAR, "marca")
	app._t(v, "%d de %d · %s em %s" % [r.d["conquistas"].size(), RecordesC.CONQUISTAS.size(), Dados.qtd(int(r.d["vitorias"]), "vitória", "vitórias"), Dados.qtd(int(r.d["partidas"]), "partida", "partidas")], 16, Estilo.TEXTO)
	for id in RecordesC.CONQUISTAS:
		var c: Array = RecordesC.CONQUISTAS[id]
		var tem := r.tem(id)
		v.add_child(Estilo.texto_rico("[color=%s]%s [b]%s[/b][/color]\n[color=#8f9a8a]%s[/color]" % ["#ffd28a" if tem else "#6d766a", "★" if tem else "☆", c[0], c[1]], 16, Estilo.TEXTO))
	var tempos: Dictionary = r.d["tempos"]
	var fases: Array = Dados.FASES.filter(func(F): return tempos.has("fase%d" % F["n"]))
	if not fases.is_empty():
		app._t(v, "MELHORES TEMPOS DA CAMPANHA", 17, Estilo.AMBAR, "titulo")
		for F in fases:
			app._t(v, "%d. %s  ·  %s" % [F["n"], F["nome"], RecordesC.relogio(tempos["fase%d" % F["n"]])], 16, Estilo.TEXTO)
	_voltar(v)

# ------------------------------------------------------------ fim de partida
## números, gráfico, momento da virada, recorde e conquistas novas
func resumo(v: VBoxContainer, j: JogoC, saida: Dictionary) -> void:
	app._t(v, "COMO FOI A PARTIDA", 17, Estilo.AMBAR, "titulo")
	var g := GraficoC.new()
	v.add_child(g)
	g.mostrar(j)
	var legenda: Array = ["jogador"]
	legenda.append_array(j.fase["bots"])
	v.add_child(Estilo.texto_rico("Províncias:  " + "  ".join(legenda.map(func(d): return "[color=#%s]■ %s[/color]" % [Dados.FACCOES[d]["cor"], j.nome_de(d)])), 14))
	var linhas: Array = [
		"Inimigos abatidos: [b]%d[/b]   ·   Soldados perdidos: [b]%d[/b]" % [int(j.stats.get("inimigos", 0)), int(j.stats["baixas"])],
		"Missões cumpridas: [b]%d[/b]   ·   Ofensivas repelidas: [b]%d[/b]" % [j.vida.feitas, j.vida.repelidas]]
	if j.stats.get("melhor_n", 0) > 0:
		linhas.append("Melhor soldado: [b]%s[/b], %s" % [j.stats["melhor_nome"], Dados.qtd(int(j.stats["melhor_n"]), "abate", "abates")])
	var virada := RecordesC.virada(j.historico + [[int(j.t), j.placar()]], j.fase["bots"])
	linhas.append("Você tomou a ponta em [b]%s[/b] e não largou mais." % RecordesC.relogio(virada) if virada >= 0 else "Você terminou sem a ponta em território.")
	v.add_child(Estilo.texto_rico("\n".join(linhas), 16, Estilo.TEXTO))
	if saida.get("recorde", false):
		app._t(v, "NOVO RECORDE: %s%s" % [RecordesC.relogio(j.t), " (antes %s)" % RecordesC.relogio(saida["anterior"]) if saida["anterior"] > 0.0 else ""], 18, Estilo.AMBAR_CLARO, "titulo")
	for id in saida.get("novas", []):
		v.add_child(Estilo.texto_rico("[color=#ffd28a]★ Conquista nova: [b]%s[/b][/color]\n%s" % RecordesC.CONQUISTAS[id], 16, Estilo.TEXTO))
