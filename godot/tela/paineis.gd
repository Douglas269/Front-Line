class_name PaineisC
extends RefCounted
## O que o painel de baixo mostra em cada situação. `tela` é a tela principal (guarda a seleção e as ordens).

var tela
var j: JogoC

func _init(t) -> void:
	tela = t

static func n1(v: float) -> String:
	return str(snappedf(v, 0.1)).replace(".", ",")

func _titulo(t: String, dir := "", cor := Estilo.VERDE) -> Dictionary:
	return {"tipo": "titulo", "t": t, "dir": dir, "cor": cor}

func _txt(t: String, tam := 16, cor := Estilo.MUDO) -> Dictionary:
	return {"tipo": "texto", "t": t, "tam": tam, "cor": cor}

func _bt(t: String, sub: String, f: Callable, extra := {}) -> Dictionary:
	var d := {"t": t, "sub": sub, "f": f}
	d.merge(extra)
	return d

func _grade(lista: Array, colunas := 2) -> Dictionary:
	return {"tipo": "botoes", "lista": lista, "colunas": colunas}

func _voltar(sel: Dictionary, rotulo := "← Voltar") -> Dictionary:
	return _grade([_bt(rotulo, "", func(): tela.selecionar(sel))])

func composicao(lista: Array) -> String:
	var c := {}
	for s in lista:
		c[s.tipo] = c.get(s.tipo, 0) + 1
	var partes: Array = []
	for t in c:
		partes.append("%d %s" % [c[t], Dados.TROPAS[t]["nome"].to_lower()])
	return ", ".join(partes)

func blocos() -> Array:
	j = tela.jogo
	if not tela.modo.is_empty():
		var e := j.ex_por_id(tela.modo["ex"])
		return [_titulo("Saquear" if tela.modo["missao"] == "saque" else "Mover / Atacar", "%d soldados" % e.s.size() if e else ""),
			_txt("Toque no mapa na província de destino. Pode ser sua (a tropa vai por dentro do seu território) ou inimiga."),
			_grade([_bt("Cancelar", "", func(): tela.cancelar_ordem())])]
	if not tela.pendente.is_empty():
		return _ordem_pendente()
	match tela.sel.get("tipo", ""):
		"ex": return _exercito()
		"prov": return _provincia()
		"recrutar": return _recrutar()
		"obras": return _obras()
		"pesquisa": return _pesquisa()
		"diplomacia": return _diplomacia()
		"generais": return _generais()
		"general": return _escolher_general()
		"economia": return _economia()
		"situacao": return _situacao()
		"veteranos": return _veteranos()
		"soldado": return _soldado()
		"dispensar": return _dispensar()
	return [_txt("Toque num exército ou numa província.")]

# ------------------------------------------------------------ recrutamento automático e táticas
func recrutamento_automatico() -> Array:
	var a: Dictionary = j.auto_rec
	var para: String = "ficam na capital" if j.reuniao == "" else "vão para %s em grupos de %d" % [j.prov[j.reuniao].nome, JogoC.LOTE_REUNIAO]
	var r: Array = [{"tipo": "linha", "t": "[b]Recrutar sozinho[/b]  %s" % ("[color=#9fd08f]● ligado[/color]" if a["ligado"] else "○ desligado"),
		"sub": "1 por ciclo na capital, sem baixar das moedas guardadas e só com comida sobrando. Os novos %s." % para,
		"botoes": [_bt("Desligar" if a["ligado"] else "Ligar", "", func(): a["ligado"] = not a["ligado"])]}]
	if a["ligado"]:
		var liberadas: Array = Dados.TROPAS.keys().filter(func(t): return j.tropa_liberada("jogador", t))
		var proximo: String = liberadas[(liberadas.find(a["tipo"]) + 1) % liberadas.size()]
		r.append(_grade([
			_bt(Dados.TROPAS[a["tipo"]]["nome"], "tocar para trocar" if liberadas.size() > 1 else "pesquise outras", func(): a["tipo"] = proximo, {"off": liberadas.size() < 2}),
			_bt("Guardar −20", "%d moedas" % a["reserva"], func(): a["reserva"] = maxi(0, a["reserva"] - 20), {"off": a["reserva"] <= 0}),
			_bt("Guardar +20", "%d moedas" % a["reserva"], func(): a["reserva"] = mini(300, a["reserva"] + 20), {"off": a["reserva"] >= 300})], 3))
	return r

## fumaça, carga e reforço: um uso de cada por batalha
func taticas(b: BatalhaC) -> Dictionary:
	j = tela.jogo
	var lado := b.lado_do_jogador()
	var l: Array = [_bt("FUMAÇA", "ativa agora" if b.fumaca_ativa(lado) else ("já usada" if b.fumaca[lado]["usada"] else "%d munição" % Dados.FUMACA_MUN), func(): tela.tatica(b, "fumaca"), {"off": b.fumaca[lado]["usada"] or j.fac["jogador"]["mun"] < Dados.FUMACA_MUN, "forte": b.fumaca_ativa(lado)})]
	if lado == "atq":
		l.append(_bt("CARGA", "ativa agora" if b.carga_ativa() else ("já usada" if b.carga["usada"] else "corre e bate mais"), func(): tela.tatica(b, "carga"), {"off": b.carga["usada"], "forte": b.carga_ativa()}))
	var quem := b.quem_pode_reforcar(lado)
	l.append(_bt("REFORÇO", "a caminho" if b.pediu[lado] else ("%d de %s" % [mini(Dados.REFORCO_MAX, quem.s.size()), j.prov[quem.prov].nome] if quem else "sem vizinho"), func(): tela.tatica(b, "reforco"), {"off": quem == null}))
	return _grade(l, l.size())

# ------------------------------------------------------------ ordem
func _ordem_pendente() -> Array:
	var o: Dictionary = tela.pendente
	var e := j.ex_por_id(o["ex"])
	if e == null:
		tela.pendente = {}
		return blocos()
	var p: ProvinciaC = j.prov[o["destino"]]
	var quem := "sua" if p.dono == "jogador" else ("milícia" if p.dono == "neutro" else j.nome_de(p.dono))
	var em_paz: bool = p.dono != "jogador" and not j.em_guerra("jogador", p.dono)
	var verbo := "Saquear" if o["missao"] == "saque" else ("Mover para" if p.dono == "jogador" or em_paz else "Atacar")
	var r: Array = [_titulo("%s %s" % [verbo, p.nome], quem, Color(Dados.FACCOES[p.dono]["cor"]))]
	if p.dono == "jogador":
		r.append(_txt("Província sua. Chega em ~%d s." % o["seg"]))
	elif em_paz:
		r.append(_txt("Território em paz: a tropa só passa. Chega em ~%d s." % o["seg"]))
	else:
		var defs: Array = []
		for x in j.parados_em(p.id, p.dono):
			defs.append_array(x.s)
		var info := "Defesa [b]desconhecida[/b] (mande um espião)."
		if j.visivel(p.id):
			info = "Defesa: [b]%d[/b] soldados (%s), trincheira %d%%%s." % [defs.size(), composicao(defs) if not defs.is_empty() else "ninguém", roundi(p.trinch), ", forte" if p.tem_obra("forte") else ""]
		r.append(_txt("%s Chega em ~%d s." % [info, o["seg"]]))
		var vao: Array = e.vivos()
		vao.sort_custom(func(a, b): return a.eficacia() > b.eficacia())
		var ataque := 0.0
		for s in vao.slice(0, e.s.size() if not e.rota.is_empty() else o["qtd"]):
			ataque += s.eficacia() * sqrt(Dados.TROPAS[s.tipo]["atq"])
		if j.visivel(p.id) or j.esta_espiado(p.dono):
			var defesa := BotsC.defesa_em(j, p)
			var razao := ataque / defesa if defesa > 0.0 else 9.0
			var previsao: Array = ["vitória provável", "#7bc96f"] if razao >= 1.5 else (["favorável, mas arriscado", "#c9d66a"] if razao >= 1.2 else (["equilibrado: pode perder", "#e3b04b"] if razao >= 0.95 else ["muito arriscado", "#e0705f"]))
			r.append(_txt("Sua força [b]%s[/b] contra defesa ~[b]%d[/b]: [color=%s][b]%s[/b][/color]" % [n1(ataque), roundi(defesa), previsao[1], previsao[0]]))
	if e.rota.is_empty():
		r.append(_txt("Vão [b]%d[/b] soldados, ficam %d." % [o["qtd"], e.s.size() - o["qtd"]], 18, Estilo.TEXTO))
		r.append(_grade([_bt("−", "", func(): tela.mudar_quantidade(-1)), _bt("+", "", func(): tela.mudar_quantidade(1)), _bt("Todos", "", func(): tela.mudar_quantidade(999))], 3))
	r.append(_grade([_bt("✔ Confirmar", "", func(): tela.confirmar_ordem(), {"forte": true}), _bt("Cancelar", "", func(): tela.cancelar_ordem())]))
	return r

# ------------------------------------------------------------ batalha no painel
func _batalha_blocos(b: BatalhaC) -> Array:
	var lado := b.lado_do_jogador()
	var eu := b.vivos(lado).size()
	var ele := b.vivos(BatalhaC.outro(lado)).size()
	var outro := b.def_dono if lado == "atq" else b.atq_dono
	var parte := b.parte_de(lado)
	var r: Array = [_txt("[color=#ff9f6a][b]Batalha em %s[/b][/color]: você %d x %d %s" % [b.alvo.nome, eu, ele, j.nome_de(outro)])]
	r.append({"tipo": "barra", "v": snappedf(parte, 0.02), "t": "ganhando" if parte >= 0.6 else ("perdendo" if parte <= 0.4 else "parelha"), "cor": Estilo.VERDE if parte >= 0.6 else (Estilo.VERMELHO if parte <= 0.4 else Estilo.AMARELO)})
	if b.art_a_caminho(lado):
		r.append({"tipo": "alerta", "t": "ARTILHARIA A CAMINHO: toque em %s" % ("Cobertura" if lado == "atq" else "Abrigar")})
	r.append(_grade([_bt("▶ VER A BATALHA", "com animação", func(): tela.abrir_batalha_animada(b), {"forte": true}), _bt("Resolver rápido", "termina já", func(): tela.resolver(b))]))
	var posturas: Array = [["avancar", "Avançar", "rápido, exposto"], ["cobertura", "Cobertura", "lento, protegido"], ["recuar", "Recuar", "volta para casa"]] if lado == "atq" else [["atacar", "Atacar", "+dano, +risco"], ["equilibrio", "Equilíbrio", "padrão"], ["abrigar", "Abrigar", "menos dano"]]
	var atual := b.post_atq if lado == "atq" else b.post_def
	var lista: Array = []
	for q in posturas:
		var id: String = q[0]
		lista.append(_bt(q[1], q[2], func(): tela.postura(b, id), {"forte": atual == id, "perigo": b.art_a_caminho(lado) and id in ["cobertura", "abrigar"]}))
	var custo := int(j.custo_artilharia("jogador"))
	lista.append(_bt("Artilharia", ("a caminho…" if b.art_a_caminho(BatalhaC.outro(lado)) else "já usada") if b.usou_art else "%d de munição" % custo, func(): tela.artilharia(b), {"off": b.usou_art or j.fac["jogador"]["mun"] < custo}))
	r.append(_grade(lista))
	if b.lado_do_jogador() != "":
		r.append(taticas(b))
	return r

# ------------------------------------------------------------ exército
func _exercito() -> Array:
	var e := j.ex_por_id(tela.sel["id"])
	if e == null:
		tela.sel = {"tipo": "prov", "id": j.capital_jogador}
		return _provincia()
	var p: ProvinciaC = j.prov[e.prov]
	var hp := 0.0
	var hp_max := 0.0
	var fome := 0
	var vets := 0
	for s in e.s:
		hp += maxf(0.0, s.vida)
		hp_max += s.vida_max()
		fome += 1 if s.fome >= 50.0 else 0
		vets += 1 if s.patente() > 0 else 0
	var estado := ("saqueando" if e.missao == "saque" else ("voltando" if e.missao == "voltar" else "em marcha")) if not e.rota.is_empty() else "em " + p.nome
	var nivel := "Regimento" if e.s.size() < 3 else ("Companhia" if e.s.size() < 8 else ("Batalhão" if e.s.size() < 15 else "Exército"))
	var resumo := "%s · vida %d%%" % [composicao(e.s), roundi(100.0 * hp / maxf(1.0, hp_max))]
	if vets:
		resumo += " · [color=#ffd28a][b]★ %d veterano(s)[/b][/color]" % vets
	resumo += " · [color=#e3b04b]%d com fome[/color]" % fome if fome else " · alimentada"
	if e.s.any(func(s): return j.usa_comb(s)):
		resumo += " · %d de combustível" % int(j.fac["jogador"]["comb"])
		if j.fac["jogador"]["comb"] <= 0.0:
			resumo += " [color=#ff8a7a][b](acabou)[/b][/color]"
	if not e.rota.is_empty():
		resumo += " · indo para %s" % j.prov[e.rota.back()].nome
	if e.sem_suprimento:
		resumo += "\n[color=#ff9f43][b]Sem suprimento: longe do seu território a tropa não come.[/b][/color]"
	if j.fac["jogador"]["falta_aco"] and e.s.any(func(s): return Dados.TROPAS[s.tipo]["manut_aco"] > 0.0):
		resumo += "\n[color=#ff9f43][b]Falta de aço: tropa pesada não se cura e causa menos dano.[/b][/color]"
	if j.fator_lotacao("jogador") < 1.0:
		resumo += "\n[color=#ff9f43][b]Sublotação: o exército rende %d%%.[/b][/color]" % roundi(j.fator_lotacao("jogador") * 100.0)
	var r: Array = [_titulo("%s · %d soldado(s)" % [e.nome if e.nome != "" else nivel, e.s.size()], estado), _txt(resumo)]
	var b := j.batalha_em(e.prov if e.aguarda == "" else e.aguarda) if e.em_batalha else null
	if b and b.lado_do_jogador() != "" and e.aguarda == "":
		r.append_array(_batalha_blocos(b))
	elif e.aguarda != "":
		r.append(_txt("Esperando a batalha de %s acabar para entrar." % j.prov[e.aguarda].nome))
	elif not e.rota.is_empty():
		r.append(_grade([_bt("Mudar destino", "depois toque no novo", func(): tela.escolher_destino(e.id, "ataque"), {"forte": true}), _bt("Parar", "na próxima província", func(): j.cancelar_marcha(e.id))]))
	else:
		var l: Array = [_bt("Mover / Atacar", "toque no destino", func(): tela.escolher_destino(e.id, "ataque"), {"forte": true}), _bt("Saquear", "rouba 30% das moedas", func(): tela.escolher_destino(e.id, "saque"))]
		if j.campanha.sistema_liberado("generais", j.fase["n"]):
			l.append(_bt("General", "trocar" if e.general != "" else "designar", func(): tela.selecionar({"tipo": "general", "id": e.id})))
		l.append(_bt("Dispensar", "devolve vaga e soldo", func(): tela.selecionar({"tipo": "dispensar", "id": e.id})))
		r.append(_grade(l))
	r.append(_grade([_bt("▲ Esconder detalhes" if tela.ver_detalhes else "▼ Detalhes da tropa", "", func(): tela.ver_detalhes = not tela.ver_detalhes)], 1))
	if tela.ver_detalhes:
		var por := {}
		for s in e.s:
			if not por.has(s.tipo):
				por[s.tipo] = []
			por[s.tipo].append(s)
		for t in por:
			var soma := 0.0
			var pior := 100.0
			for s in por[t]:
				var v: float = 100.0 * s.vida / s.vida_max()
				soma += v
				pior = minf(pior, v)
			r.append({"tipo": "linha", "t": "[b]%s x%d[/b]" % [Dados.TROPAS[t]["nome"], por[t].size()], "sub": "vida média %d%%, mais ferido %d%%" % [roundi(soma / por[t].size()), roundi(pior)]})
		var lista_vet: Array = e.s.filter(func(s): return s.patente() > 0)
		lista_vet.sort_custom(func(a, c): return a.lutas > c.lutas)
		var tv := "★ Nenhum veterano ainda: quem sobrevive a 2 batalhas ganha +10%, e a 5, +20%." if lista_vet.is_empty() else "[b]Veteranos[/b]"
		for s in lista_vet.slice(0, 8):
			tv += "\n%s %s (%s): %d batalhas, %d abates" % ["★★" if s.patente() == 2 else "★", s.nome, Dados.TROPAS[s.tipo]["nome"].to_lower(), s.lutas, s.abates]
		r.append(_txt(tv, 14))
		var gen := "sem general"
		for g in Dados.GENERAIS:
			if g["id"] == e.general:
				gen = "%s (%s)" % [g["nome"], g["txt"]]
		if e.general == "bot":
			gen = "general do país"
		r.append(_txt("Força %s · Velocidade %s · Soldo %s e aço %s por ciclo\nGeneral: %s" % [n1(JogoC.forca(e.s)), n1(j.vel_ex(e)), n1(e.s.reduce(func(a, s): return a + Dados.TROPAS[s.tipo]["manut"], 0.0)), n1(e.s.reduce(func(a, s): return a + Dados.TROPAS[s.tipo]["manut_aco"], 0.0)), gen], 14))
		if e.s.size() > 1 and e.rota.is_empty() and not e.em_batalha:
			r.append(_grade([_bt("Separar 1 soldado", "vira um exército novo", func(): j.separar(e.id, 1))], 1))
	return r

# ------------------------------------------------------------ província
func _provincia() -> Array:
	var p: ProvinciaC = j.prov.get(tela.sel.get("id", ""), j.prov[j.capital_jogador])
	var f: Dictionary = j.fac["jogador"]
	var vis := j.visivel(p.id)
	var cor := Color(Dados.FACCOES[p.dono]["cor"])
	var r: Array = [_titulo(p.nome, "SUA" if p.dono == "jogador" else j.nome_de(p.dono).to_upper(), cor)]
	var pr: Dictionary = Dados.PROD[p.tipo]
	var prod: Array = []
	for k in [["comida", "comida"], ["mun", "munição"], ["moedas", "moedas"], ["aco", "aço"]]:
		if pr[k[0]] > 0:
			prod.append("%s %s" % [n1(pr[k[0]]), k[1]])
	var info := "%s · produz %s por ciclo · sustenta %d soldados" % [Dados.TIPO_TXT[p.tipo], ", ".join(prod), Dados.MO[p.tipo]]
	if vis:
		info += " · trincheira %d%%" % roundi(p.trinch)
	if p.dono != "neutro" and (p.dono == "jogador" or vis):
		info += "\nMoral [color=%s][b]%d%%[/b][/color]" % ["#ff8a7a" if p.moral < 35 else ("#e3b04b" if p.moral < 60 else "#9fd08f"), roundi(p.moral)]
		if p.dono == "jogador" and p.moral < 35 and not p.capital:
			info += " · risco de revolta: deixe 3 soldados aqui ou faça um forte"
	var obras: Array = p.obras.keys().filter(func(o): return p.obras[o]).map(func(o): return Dados.OBRAS[o]["nome"])
	if not p.obra.is_empty():
		obras.append("em obra: %s (%d s)" % [Dados.OBRAS[p.obra["id"]]["nome"], ceili(p.obra["resta"])])
	if not obras.is_empty():
		info += "\n" + ", ".join(obras)
	if vis:
		var aqui: Array = j.ex.filter(func(e): return e.prov == p.id and e.rota.is_empty())
		info += "\n" + ("Ninguém defendendo." if aqui.is_empty() else ", ".join(aqui.map(func(e): return "[color=#%s]%s: %d[/color]" % [Dados.FACCOES[e.dono]["cor"], j.nome_de(e.dono), e.s.size()])))
	else:
		info += "\nNa névoa: mande um espião para ver as tropas."
	if p.dono != "jogador":
		if p.dono != "neutro" and j.esta_espiado(p.dono):
			info += "\nEspião: %s tem %d moedas e %d soldados." % [j.nome_de(p.dono), int(j.fac[p.dono]["moedas"]), j.tropa_de(p.dono)]
		else:
			info += "\n" + Dados.PERSO_TXT[Dados.FACCOES[p.dono]["perso"]]
	r.append(_txt(info))
	var b := j.batalha_em(p.id)
	if b and b.lado_do_jogador() != "":
		r.append_array(_batalha_blocos(b))
	elif b:
		r.append(_txt("[color=#ff9f6a][b]%s ataca %s[/b][/color] (%d x %d)" % [j.nome_de(b.atq_dono), p.nome, b.vivos("atq").size(), b.vivos("def").size()]))
	var l: Array = []
	if p.dono == "jogador":
		l.append(_bt("Recrutar 1", "infantaria · %d moedas" % Dados.TROPAS["inf"]["custo"], func(): j.recrutar(p.id), {"off": j.motivo_sem_recrutar("jogador", "inf") != ""}))
		l.append(_bt("Recrutar…", "escolher o tipo", func(): tela.selecionar({"tipo": "recrutar", "id": p.id})))
		l.append(_bt("Obras", Dados.OBRAS[p.obra["id"]]["nome"] if not p.obra.is_empty() else "forte, ferrovia, fábrica…", func(): tela.selecionar({"tipo": "obras", "id": p.id})))
		l.append(_bt("Fortificar", "%d moedas, %d aço" % [Dados.FORTIFICAR, Dados.FORTIFICAR_ACO], func(): j.fortificar(p.id), {"off": f["moedas"] < Dados.FORTIFICAR or f["aco"] < Dados.FORTIFICAR_ACO or p.trinch >= 100.0}))
		if p.id != j.capital_jogador:
			var marcado: bool = j.reuniao == p.id
			l.append(_bt("Tirar reunião" if marcado else "Reunir aqui", "ponto de reunião marcado ⚑" if marcado else "recrutas automáticos vêm para cá", func(): j.marcar_reuniao("" if marcado else p.id), {"forte": marcado}))
		var meus := j.parados_em(p.id, "jogador")
		if not meus.is_empty():
			l.append(_bt("Exército daqui", "%d soldados" % meus[0].s.size(), func(): tela.selecionar({"tipo": "ex", "id": meus[0].id}), {"forte": true}))
		var fora := _mais_perto(p.id, func(e): return e.parado() and e.prov != p.id)
		for o in fora.slice(0, 2):
			var eid: String = o[0].id
			l.append(_bt("Trazer %d" % o[0].s.size(), "de %s · ~%d s" % [j.prov[o[0].prov].nome, o[1]], func(): tela.preparar_ordem(eid, p.id, "mover")))
	else:
		l.append(_bt("Espião", "%d moedas" % j.custo_espiao(), func(): j.espionar(p.id), {"off": f["moedas"] < j.custo_espiao() or j.espioes.size() >= Dados.ESPIAO_MAX}))
		if p.dono != "neutro" and j.campanha.sistema_liberado("diplomacia", j.fase["n"]):
			l.append(_bt("Diplomacia", j.rel[p.dono]["estado"], func(): tela.selecionar({"tipo": "diplomacia"})))
		for o in _mais_perto(p.id, func(e): return e.parado()).slice(0, 3):
			var eid: String = o[0].id
			l.append(_bt("%s com %d" % ["Atacar" if j.em_guerra("jogador", p.dono) else "Mover", o[0].s.size()], "de %s · ~%d s" % [j.prov[o[0].prov].nome, o[1]], func(): tela.preparar_ordem(eid, p.id, "ataque"), {"forte": j.em_guerra("jogador", p.dono)}))
	r.append(_grade(l))
	return r

func _mais_perto(destino: String, filtro: Callable) -> Array:
	var r: Array = []
	for e in j.ex_de("jogador"):
		if not filtro.call(e):
			continue
		var c := j.rota_para(e, destino)
		if not c.is_empty():
			r.append([e, ceili(c["dist"] / j.vel_ex(e)), c["dist"]])
	r.sort_custom(func(a, b): return a[2] < b[2])
	return r

# ------------------------------------------------------------ recrutar, obras, pesquisa
func _recrutar() -> Array:
	var p: ProvinciaC = j.prov[tela.sel["id"]]
	var r: Array = [_titulo("Recrutar em %s" % p.nome, "vagas %d/%d" % [j.tropa_de("jogador"), j.mao_de_obra_max("jogador")])]
	r.append(_txt("Você tem %d moedas e %d de aço." % [int(j.fac["jogador"]["moedas"]), int(j.fac["jogador"]["aco"])], 14))
	r.append_array(recrutamento_automatico())
	for t in Dados.TROPAS:
		var T: Dictionary = Dados.TROPAS[t]
		var lib := j.tropa_liberada("jogador", t)
		var m := j.motivo_sem_recrutar("jogador", t)
		var custo := "%d moedas%s · paga %s moedas%s por ciclo" % [T["custo"], ", %d aço" % T["aco"] if T["aco"] else "", str(T["manut"]).replace(".", ","), " e %s aço" % str(T["manut_aco"]).replace(".", ",") if T["manut_aco"] > 0 else ""]
		var sub: String = T["txt"] + "\n" + (custo + ("\n[color=#e3a37b]%s[/color]" % m if m != "" else "") if lib else "pesquise " + Dados.PESQUISAS[T["pesquisa"]]["nome"])
		var botoes: Array = []
		if lib:
			var tp: String = t
			botoes = [_bt("+1", "", func(): j.recrutar(p.id, 1, tp), {"off": m != ""}), _bt("+5", "", func(): j.recrutar(p.id, 5, tp), {"off": j.motivo_sem_recrutar("jogador", t, 5) != ""})]
		r.append({"tipo": "linha", "t": "[b]%s[/b]" % T["nome"], "sub": sub, "botoes": botoes, "apagada": not lib})
	r.append(_voltar({"tipo": "prov", "id": p.id}))
	return r

func _obras() -> Array:
	var p: ProvinciaC = j.prov[tela.sel["id"]]
	var r: Array = [_titulo("Obras em %s" % p.nome, "%s: %d s" % [Dados.OBRAS[p.obra["id"]]["nome"], ceili(p.obra["resta"])] if not p.obra.is_empty() else "")]
	for id in Dados.OBRAS:
		var O: Dictionary = Dados.OBRAS[id]
		var feito := p.tem_obra(id)
		var c := j.custo_obra("jogador", id)
		var a := j.custo_obra("jogador", id, "aco")
		var oid: String = id
		r.append({"tipo": "linha", "t": "[b]%s[/b]" % O["nome"], "sub": "✔ pronto" if feito else "%s · %d s · %d moedas, %d aço" % [O["txt"], int(O["tempo"]), c, a], "apagada": feito,
			"botoes": [] if feito else [_bt("Construir", "", func(): j.construir(p.id, oid), {"off": not p.obra.is_empty() or j.fac["jogador"]["moedas"] < c or j.fac["jogador"]["aco"] < a})]})
	r.append(_voltar({"tipo": "prov", "id": p.id}))
	return r

func _pesquisa() -> Array:
	var st: Dictionary = j.pesq["jogador"]
	var r: Array = [_titulo("Pesquisa", "%s: %d s" % [Dados.PESQUISAS[st["atual"]["id"]]["nome"], ceili(st["atual"]["resta"])] if not st["atual"].is_empty() else "")]
	for id in Dados.PESQUISAS:
		var P: Dictionary = Dados.PESQUISAS[id]
		var feita: bool = st["feitas"].has(id)
		var disp := j.pesquisa_disponivel("jogador", id)
		var pid: String = id
		var sub: String = P["txt"]
		if P.has("req") and not feita:
			sub += " · precisa de " + " e ".join(P["req"].map(func(x): return Dados.PESQUISAS[x]["nome"]))
		r.append({"tipo": "linha", "t": "[b]%s%s[/b]" % ["✔ " if feita else "", P["nome"]], "sub": sub, "apagada": feita or not disp,
			"botoes": [] if feita or not disp else [_bt("%d" % P["custo"], "%d s" % int(P["tempo"]), func(): j.pesquisar(pid), {"off": not st["atual"].is_empty() or j.fac["jogador"]["moedas"] < P["custo"]})]})
	r.append(_voltar({"tipo": "prov", "id": j.capital_jogador}, "Fechar"))
	return r

# ------------------------------------------------------------ diplomacia e generais
func _diplomacia() -> Array:
	var r: Array = [_titulo("Diplomacia", "os bots brigam entre si", Estilo.MUDO)]
	var pl := j.placar()
	for bot in j.fase["bots"]:
		var cor: String = Dados.FACCOES[bot]["cor"]
		if j.eliminados.has(bot):
			r.append({"tipo": "linha", "t": "[color=#%s][b]%s[/b][/color]" % [cor, j.nome_de(bot)], "sub": "rendido", "apagada": true})
			continue
		var rl: Dictionary = j.rel[bot]
		var b2: String = bot
		var botoes: Array = []
		var espera: bool = j.t < rl["recusa_ate"]
		if rl["estado"] == "guerra":
			botoes.append(_bt("Paz", "%d" % j.custo_paz(bot), func(): j.propor(b2, "paz"), {"off": espera or j.fac["jogador"]["moedas"] < j.custo_paz(bot)}))
		else:
			if rl["estado"] == "paz":
				botoes.append(_bt("Aliança", "grátis", func(): j.propor(b2, "alianca"), {"off": espera}))
			botoes.append(_bt("Guerra", "romper", func(): j.declarar_guerra(b2)))
		var estado: String = {"guerra": "Guerra", "paz": "Paz (%d s)" % ceili(rl["ate"] - j.t), "alianca": "Aliança"}[rl["estado"]]
		r.append({"tipo": "linha", "t": "[color=#%s][b]%s[/b][/color]  %s" % [cor, j.nome_de(bot), estado], "sub": "%d províncias · %s%s" % [pl.get(bot, 0), Dados.FACCOES[bot]["perso"], " · espere %d s" % ceili(rl["recusa_ate"] - j.t) if espera else ""], "botoes": botoes})
	r.append(_txt("Paz: 4 minutos sem ataques. Aliança: sem prazo, e vocês veem o território um do outro. Alguns traem.", 13))
	r.append(_voltar({"tipo": "prov", "id": j.capital_jogador}, "Fechar"))
	return r

func _generais() -> Array:
	var r: Array = [_titulo("Generais", "%d estrelas" % j.campanha.total_estrelas(), Estilo.AMBAR_CLARO)]
	var libs: Array = j.campanha.generais_liberados().map(func(g): return g["id"])
	for g in Dados.GENERAIS:
		var lib: bool = libs.has(g["id"])
		var xp: int = j.campanha.xp_general(g["id"]) + j.gen_xp.get(g["id"], 0)
		var sub: String = g["txt"] if lib else "junte %d estrelas" % g["estrelas"]
		if lib:
			var com: Array = j.ex.filter(func(e): return e.general == g["id"])
			if j.gen_ferido.get(g["id"], 0.0) > j.t:
				sub += " · ferido (%d s)" % ceili(j.gen_ferido[g["id"]] - j.t)
			elif not com.is_empty():
				sub += " · com %d soldados" % com[0].s.size()
		r.append({"tipo": "linha", "t": "[b]%s%s[/b]" % [g["nome"], " · nível %d" % CampanhaC.nivel_general(xp) if lib else ""], "sub": sub, "apagada": not lib})
	r.append(_txt("Toque num exército seu e em General.", 13))
	r.append(_voltar({"tipo": "prov", "id": j.capital_jogador}, "Fechar"))
	return r

func _escolher_general() -> Array:
	var eid: String = tela.sel["id"]
	var r: Array = [_titulo("Escolher general")]
	for g in j.campanha.generais_liberados():
		var gid: String = g["id"]
		var ferido: bool = j.gen_ferido.get(gid, 0.0) > j.t
		r.append({"tipo": "linha", "t": "[b]%s[/b]" % g["nome"], "sub": g["txt"] + (" · ferido" if ferido else ""), "apagada": ferido,
			"botoes": [] if ferido else [_bt("Escolher", "", func():
				j.designar_general(eid, gid)
				tela.selecionar({"tipo": "ex", "id": eid}))]})
	r.append(_grade([_bt("Sem general", "", func():
		j.designar_general(eid, "")
		tela.selecionar({"tipo": "ex", "id": eid})), _bt("← Voltar", "", func(): tela.selecionar({"tipo": "ex", "id": eid}))]))
	return r

# ------------------------------------------------------------ soldados com história
static func _estrelas(patente: int) -> String:
	return "★★ " if patente == 2 else ("★ " if patente == 1 else "")

func _onde_esta(e: ExercitoC) -> String:
	if e.em_batalha:
		return "em batalha"
	return ("indo para " + j.prov[e.rota.back()].nome) if not e.rota.is_empty() else ("em " + j.prov[e.prov].nome)

func _veteranos() -> Array:
	var todos: Array = []
	for e in j.ex_de("jogador"):
		for x in e.vivos():
			if x.lutas > 0:
				todos.append([x, e])
	todos.sort_custom(func(a, b): return a[0].patente() * 100 + a[0].abates * 5 + a[0].lutas > b[0].patente() * 100 + b[0].abates * 5 + b[0].lutas)
	var r: Array = [_titulo("Veteranos", "%d com história" % todos.size(), Estilo.AMBAR)]
	if todos.is_empty():
		r.append(_txt("Ninguém lutou ainda. Quem sobrevive a 2 batalhas vira veterano e luta 10% melhor; com 5, vira elite."))
	for par in todos.slice(0, 12):
		var x: SoldadoC = par[0]
		var id := str(x.get_instance_id())
		r.append({"tipo": "linha", "t": "[b]%s%s[/b]  [color=#8f9a8a]%s[/color]" % [_estrelas(x.patente()), x.nome, Dados.TROPAS[x.tipo]["nome"]],
			"sub": "%d batalha(s) · %d abate(s) · vida %d%% · %s" % [x.lutas, x.abates, roundi(100.0 * x.vida / x.vida_max()), _onde_esta(par[1])],
			"botoes": [_bt("História", "", func(): tela.selecionar({"tipo": "soldado", "id": id}))]})
	if not j.memorial.is_empty():
		r.append(_titulo("Em memória", "%d" % j.memorial.size(), Estilo.MUDO))
		for m in j.memorial.slice(-8):
			r.append(_txt("† [b]%s%s[/b], %s · %d batalha(s), %d abate(s) · caiu em %s" % [_estrelas(int(m["patente"])), m["nome"], Dados.TROPAS[m["tipo"]]["nome"].to_lower(), int(m["lutas"]), int(m["abates"]), m["onde"]], 15))
	r.append(_voltar({"tipo": "situacao"}))
	return r

func _soldado() -> Array:
	for e in j.ex_de("jogador"):
		for x in e.s:
			if str(x.get_instance_id()) == tela.sel.get("id", ""):
				var r: Array = [_titulo("%s%s" % [_estrelas(x.patente()), x.nome], Dados.TROPAS[x.tipo]["nome"], Estilo.AMBAR)]
				var posto: String = ["Recruta", "Veterano: luta 10% melhor", "Elite: luta 20% melhor"][x.patente()]
				var falta := "" if x.patente() == 2 else "  ·  faltam %d batalha(s) para %s" % [(2 if x.patente() == 0 else 5) - x.lutas, "veterano" if x.patente() == 0 else "elite"]
				r.append(_txt("[b]%s[/b]%s\n%d batalha(s) · %d abate(s) · vida %d%% · %s" % [posto, falta, x.lutas, x.abates, roundi(100.0 * x.vida / x.vida_max()), _onde_esta(e)], 16, Estilo.TEXTO))
				r.append(_txt("\n".join(x.feitos.map(func(f): return "• " + f)) if not x.feitos.is_empty() else "Ainda sem registro.", 15))
				r.append(_voltar({"tipo": "veteranos"}))
				return r
	return [_txt("Este soldado não está mais na tropa."), _voltar({"tipo": "veteranos"})]

# ------------------------------------------------------------ economia, situação, dispensar
func _economia() -> Array:
	var f: Dictionary = j.fac["jogador"]
	var come: float = j.tropa_de("jogador") / (Dados.COME_ALIVIA / Dados.FOME_CICLO) * (0.7 if j.tem_pesq("jogador", "racoes") else 1.0)
	var linhas: Array = [["", "Estoque", "Entra", "Sai", "Saldo"]]
	var linha := func(nome: String, estoque: float, entra: float, sai: float):
		var saldo := entra - sai
		linhas.append([nome, str(int(estoque)), "+" + n1(entra), ("−" if sai >= 0.05 else "") + n1(absf(sai)), ("+" if saldo >= 0.0 else "−") + n1(absf(saldo))])
	linha.call("Comida", f["comida"], j.renda_de("jogador", "comida"), come)
	linha.call("Munição", f["mun"], j.renda_de("jogador", "mun"), 0.0)
	linha.call("Dinheiro", f["moedas"], j.renda_de("jogador", "moedas"), j.manutencao_de("jogador"))
	linha.call("Aço", f["aco"], j.renda_de("jogador", "aco"), j.manutencao_de("jogador", "manut_aco"))
	linha.call("Combustível", f["comb"], j.renda_de("jogador", "comb"), f["comb_gasto"])
	var r: Array = [_titulo("Economia", "por ciclo de 5 s", Estilo.MUDO), {"tipo": "tabela", "linhas": linhas}]
	r.append(_txt("Mão de obra: [b]%d/%d[/b] soldados" % [j.tropa_de("jogador"), j.mao_de_obra_max("jogador")]))
	if f["atraso"] > 0.0:
		r.append(_txt("[color=#ffb36b][b]Soldo atrasado (%d%%)[/b]: recrute menos, dispense tropa ou produza mais dinheiro.[/color]" % roundi(f["atraso"])))
	if f["falta_aco"]:
		r.append(_txt("[color=#ffb36b][b]Falta de aço[/b]: tome morros, faça fábricas ou dispense tropa pesada.[/color]"))
	r.append(_txt("Aço cria tropa pesada e obras, e artilharia e blindados gastam um pouco todo ciclo. Eles também gastam combustível em marcha e batalha. Morros e fábricas produzem os dois.", 13))
	r.append(_voltar({"tipo": "prov", "id": j.capital_jogador}, "Fechar"))
	return r

func _situacao() -> Array:
	var pl := j.placar()
	var resta := maxf(0.0, j.fase["tempo"] - j.t)
	var donos: Array = ["jogador"]
	donos.append_array(j.fase["bots"].filter(func(b): return not j.eliminados.has(b)))
	var linhas: Array = [["País", "Províncias", "Soldados"]]
	var lider := "jogador"
	for d in donos:
		if pl.get(d, 0) > pl.get(lider, 0):
			lider = d
		var todos := j.ex_de(d)
		var vistos: Array = todos if d == "jogador" or j.esta_espiado(d) else todos.filter(func(e): return j.ex_visivel(e))
		var n := 0
		for e in vistos:
			n += e.s.size()
		linhas.append([j.nome_de(d), "%d/%d" % [pl.get(d, 0), j.lista_prov.size()], str(n) + ("" if vistos.size() == todos.size() else "+")])
	var r: Array = [_titulo("Situação", "%d:%02d restantes" % [int(resta) / 60, int(resta) % 60], Estilo.MUDO),
		_txt("[color=%s][b]%s[/b][/color]\nDomina quem segurar %d províncias por 1 minuto." % ["#9fd08f" if lider == "jogador" else "#ff8a7a", "Você lidera em território." if lider == "jogador" else j.nome_de(lider) + " lidera em território.", j.vida.provincias_para_dominar()]),
		{"tipo": "tabela", "linhas": linhas}]
	var riscos: Array = []
	for p in j.minhas():
		if not p.viz.any(func(v): return j.prov[v].dono != "jogador" and j.em_guerra("jogador", j.prov[v].dono) and j.prov[v].dono != "neutro"):
			continue
		var defesa := BotsC.defesa_em(j, p)
		var perto := 0.0
		for e in j.ex:
			if e.dono != "jogador" and e.dono != "neutro" and j.ex_visivel(e) and (p.viz.has(e.prov) or (not e.rota.is_empty() and e.rota.back() == p.id)):
				perto += JogoC.forca(e.s)
		if perto > defesa * 0.8 or defesa < 1.0:
			riscos.append([p, perto, defesa])
	r.append(_txt("[b]Onde você está em risco[/b]", 15, Estilo.TEXTO))
	if riscos.is_empty():
		r.append(_txt("Nenhuma fronteira ameaçada agora.", 14))
	for x in riscos.slice(0, 4):
		var pid: String = x[0].id
		r.append({"tipo": "linha", "t": "[b]%s[/b]" % x[0].nome, "sub": "sua defesa %d, inimigo perto %d" % [roundi(x[2]), roundi(x[1])], "botoes": [_bt("Ver", "", func(): tela.ir_para(pid))]})
	r.append(_voltar({"tipo": "prov", "id": j.capital_jogador}, "Fechar"))
	r.append(_grade([_bt("Veteranos", "a história dos seus soldados", func(): tela.selecionar({"tipo": "veteranos"}), {"forte": true})]))
	return r

func _dispensar() -> Array:
	var e := j.ex_por_id(tela.sel["id"])
	if e == null:
		tela.sel = {"tipo": "prov", "id": j.capital_jogador}
		return _provincia()
	var n := e.s.size()
	var op := func(q: int, texto: String) -> Dictionary:
		return _bt(texto, "o exército inteiro" if q >= n else "os mais fracos primeiro", func():
			if q >= n:
				tela.confirmar("Dispensar o exército inteiro (%d soldados)?" % n, func(): j.dispensar(e.id, q))
			else:
				j.dispensar(e.id, q))
	var l: Array = [op.call(1, "Dispensar 1")]
	if n > 5:
		l.append(op.call(5, "Dispensar 5"))
	l.append(op.call(n, "Todos"))
	return [_titulo("Dispensar tropa", "%d soldados" % n), _txt("Devolve a vaga e economiza o soldo, mas não devolve o que foi gasto."), _grade(l), _voltar({"tipo": "ex", "id": e.id})]
