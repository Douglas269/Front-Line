class_name HistoriaC
extends RefCounted
## A história em volta da guerra: as ordens antes de cada fase e o jornal depois dela.
## Só conta a partida; não muda nenhuma regra.

const ORDENS := {
	1: {"hora": "05h40 · posto da fronteira", "texto": "Três países atravessaram a linha ao mesmo tempo. A sua guarnição é pequena e a capital está logo atrás de você.\n\nOs inimigos ainda estão se organizando. Use esse primeiro minuto para ocupar as vilas vizinhas antes deles."},
	2: {"hora": "06h15 · margem do rio", "texto": "Do outro lado do rio fica a região das oficinas. Quem tiver as fábricas arma a tropa primeiro.\n\nAqui as obras custam metade: construa e pesquise enquanto segura as passagens."},
	3: {"hora": "04h50 · planalto central", "texto": "As estradas do país se cruzam aqui, e quatro exércitos querem o mesmo cruzamento.\n\nEles também lutam entre si. Espere o vizinho sair de casa e ataque a porta que ficou aberta."},
	4: {"hora": "07h30 · neve até o joelho", "texto": "O inverno chegou antes dos suprimentos. Os campos rendem pouco e a tropa sente fome.\n\nCada soldado perdido faz falta. Avance com cuidado e não desperdice gente."},
	5: {"hora": "22h10 · sala do rádio", "texto": "Charlie assinou uma trégua com você. O major jura que é de verdade. Ninguém no comando acredita muito.\n\nAproveite o silêncio dele para resolver os outros, e deixe uma guarda do lado de Charlie."},
	6: {"hora": "05h00 · última reunião", "texto": "Chegamos ao coração do país. Os quatro comandantes sabem que, se esta frente cair, a guerra acaba.\n\nÉ agora. Leve quem sobreviveu até aqui e traga todos de volta."}
}

const MANCHETES := {
	"vitoria": ["CAPITAIS INIMIGAS CAEM", "Última bandeira adversária é arriada"],
	"dominio": ["O MAPA É NOSSO", "Tropas seguram a maior parte do território e o inimigo desiste"],
	"pontos": ["CESSAR-FOGO COM VANTAGEM", "Ao fim do prazo, a maior parte da terra está conosco"],
	"tempo": ["PRAZO SE ESGOTA SEM VITÓRIA", "Comando admite que o inimigo terminou à frente"],
	"dominado": ["INIMIGO TOMA O MAPA", "Resistência não bastou para conter o avanço"],
	"derrota": ["A CAPITAL CAIU", "Cidade amanhece sob bandeira estrangeira"]
}

## o que o jornal conta sobre esta partida
static func reportagem(j: JogoC) -> Dictionary:
	var m: Array = MANCHETES.get(j.fim, MANCHETES["tempo"])
	var linhas: Array = []
	var minutos := maxi(1, roundi(j.t / 60.0))
	var baixas := int(j.stats.get("baixas", 0))
	var perdas := "não deixaram ninguém para trás" if baixas == 0 else "perderam " + Dados.qtd(baixas, "soldado", "soldados")
	linhas.append("Foram %s de combate. Nossas tropas abateram %s e %s." % [Dados.qtd(minutos, "minuto", "minutos"), Dados.qtd(int(j.stats.get("inimigos", 0)), "inimigo", "inimigos"), perdas])
	var herois: Array = j.melhores(2)
	if not herois.is_empty():
		var nomes: Array = herois.map(func(s): return "%s (%s, %s)" % [s.nome, Dados.qtd(s.lutas, "batalha", "batalhas"), Dados.qtd(s.abates, "abate", "abates")])
		linhas.append("NA LINHA DE FRENTE: %s." % " e ".join(nomes))
	var caidos: Array = j.memorial.duplicate()
	caidos.sort_custom(func(a, b): return int(a["patente"]) * 100 + int(a["abates"]) > int(b["patente"]) * 100 + int(b["abates"]))
	if not caidos.is_empty():
		var lista: Array = caidos.slice(0, 3).map(func(x): return "%s, em %s" % [x["nome"], x["onde"]])
		var resto := caidos.size() - lista.size()
		linhas.append("EM MEMÓRIA: %s%s." % ["; ".join(lista), "; e mais %d" % resto if resto > 0 else ""])
	# uma carta para casa, de quem sobreviveu
	if not herois.is_empty():
		var carta := "Mãe, voltei inteiro. Guarde o meu lugar na mesa." if j.venceu() else "Mãe, não foi desta vez. Estou vivo, e isso já é muito."
		linhas.append("CARTA PARA CASA: «%s» (%s)" % [carta, herois[0].nome])
	return {"manchete": m[0], "linha_fina": m[1], "linhas": linhas}

## a página do jornal, em papel claro
static func jornal(j: JogoC) -> PanelContainer:
	var r := reportagem(j)
	var tinta := Color("221d12")
	var papel := PanelContainer.new()
	var estilo := Estilo.caixa(Color("e9e0c4"), Color("8d8266"), 2, 4, 14)
	papel.add_theme_stylebox_override("panel", estilo)
	papel.mouse_filter = Control.MOUSE_FILTER_PASS
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 7)
	v.mouse_filter = Control.MOUSE_FILTER_PASS
	papel.add_child(v)
	v.add_child(Estilo.rotulo("O CORREIO DA FRONTEIRA", 22, tinta, "marca", true, true))
	v.add_child(Estilo.rotulo("EDIÇÃO EXTRA · %s" % str(j.fase.get("nome", "A guerra")).to_upper(), 14, Color("5c5340"), "titulo", true, true))
	var risco := ColorRect.new()
	risco.color = tinta
	risco.custom_minimum_size.y = 2
	v.add_child(risco)
	v.add_child(Estilo.rotulo(r["manchete"], 27, tinta, "titulo", true, true))
	v.add_child(Estilo.rotulo(r["linha_fina"], 17, Color("3d3626"), "leitura", true, true))
	for texto in r["linhas"]:
		v.add_child(Estilo.rotulo(texto, 17, tinta, "leitura", false, true))
	return papel
