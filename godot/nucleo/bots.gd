class_name BotsC
extends RefCounted
## Como os países inimigos pensam no mapa (porte de ameaca, defesaEm e pensarBot).

static func ameaca(j: JogoC, p: ProvinciaC, dono: String) -> float:
	var r := 0.0
	for e in j.ex:
		if e.dono != dono and e.dono != "neutro" and j.em_guerra(e.dono, dono) and (e.prov == p.id or p.viz.has(e.prov) or e.rota.has(p.id)):
			r += JogoC.forca(e.s)
	return r

static func defesa_em(j: JogoC, p: ProvinciaC) -> float:
	var d := 0.0
	for e in j.parados_em(p.id, p.dono):
		for s in e.s:
			d += s.eficacia() * sqrt(Dados.TROPAS[s.tipo]["def"])
	return d * (1.0 + p.trinch / 250.0) * (Dados.CAPITAL_DEFESA if p.capital else 1.0) * (1.25 if p.tem_obra("forte") else 1.0)

static func pensar_bot(j: JogoC, dono: String) -> void:
	if j.fase.has("graca") and j.t < j.fase["graca"]:
		return
	var FX: Dictionary = Dados.FACCOES[dono]
	var perso: String = FX["perso"]
	var f: Dictionary = j.fac[dono]
	var provs := j.prov_de(dono)
	if provs.is_empty() or j.eliminados.has(dono):
		return
	var rng := j.rng
	var capital: ProvinciaC = null
	for p in provs:
		if p.capital:
			capital = p
			break
	var manut := j.manutencao_de(dono)
	var sobra: float = f["moedas"] - 4.0 * manut
	var comb_baixo: bool = f["comb"] < 6.0
	var tem_motor := j.ex_de(dono).any(func(e): return e.s.any(func(s): return j.usa_comb(s)))
	# pesquisa
	if j.pesq[dono]["atual"].is_empty() and sobra > FX["reserva"] + 50 and rng.randf() < 0.5:
		var pref: Array = {"agressivo": ["cav", "estradas", "metr", "art", "blind"], "ladrão": ["cav", "radio", "estradas", "metr"], "defensivo": ["metr", "concreto", "art", "propaganda", "blind"], "oportunista": ["art", "cav", "metr", "racoes", "blind"]}.get(perso, []).duplicate()
		pref.append_array(Dados.PESQUISAS.keys())
		for id in pref:
			if j.pesquisa_disponivel(dono, id) and Dados.PESQUISAS[id]["custo"] <= sobra - FX["reserva"]:
				j.pesquisar(id, dono)
				break
	# obras
	if capital and sobra > FX["reserva"] + 60 and rng.randf() < 0.3:
		var obra: Array = ["forte", "hospital", "fabrica"] if perso == "defensivo" else ["fabrica", "forte", "ferrovia"]
		if (comb_baixo and tem_motor) or f["falta_aco"]:
			obra.push_front("fabrica")
		var cand: Array = [capital]
		cand.append_array(provs.filter(func(q): return q.viz.any(func(v): return j.prov[v].dono != dono)))
		for q in cand:
			if q.obra.is_empty() and obra.any(func(o): return not q.tem_obra(o)):
				for o in obra:
					if not q.tem_obra(o):
						j.construir(q.id, o, dono)
						break
				break
	# recrutar, primeiro onde está mais ameaçado
	var peso := {}
	for p in provs:
		var meus: Array = []
		for e in j.parados_em(p.id, dono):
			meus.append_array(e.s)
		peso[p.id] = ameaca(j, p, dono) - JogoC.forca(meus)
	var cidades := provs.duplicate()
	cidades.sort_custom(func(a, b): return peso[a.id] > peso[b.id])
	var gosto: Array = {"agressivo": ["inf", "cav", "cav", "blind", "art"], "ladrão": ["inf", "cav", "cav", "inf"], "defensivo": ["inf", "metr", "metr", "art", "blind"], "oportunista": ["inf", "art", "cav", "metr", "blind"]}.get(perso, ["inf"])
	var saldo := j.renda_de(dono, "moedas") - manut
	for k in 3:
		var tipos: Array = gosto.filter(func(tp): return j.motivo_sem_recrutar(dono, tp) == "" and j.bot_sustenta_aco(dono, tp) and not (tp == "blind" and f["comb"] < 8.0))
		var tipo: String = tipos[rng.randi() % tipos.size()] if not tipos.is_empty() else ("inf" if j.motivo_sem_recrutar(dono, "inf") == "" else "")
		if tipo == "" or f["moedas"] < Dados.TROPAS[tipo]["custo"] + FX["reserva"] or saldo < Dados.TROPAS[tipo]["manut"] + 0.3 or rng.randf() < 0.2:
			break
		if j.recrutar_em(cidades[0].id, dono, tipo):
			saldo -= Dados.TROPAS[tipo]["manut"]
	if capital and capital.trinch < 95.0 and f["moedas"] > (45 if perso == "defensivo" else 90) and rng.randf() < 0.5:
		j.fortificar(capital.id, dono)
	# defender
	for p in provs:
		var am := ameaca(j, p, dono)
		if am <= defesa_em(j, p) * 1.05:
			continue
		var doador: ExercitoC = null
		for e in j.ex_de(dono):
			if e.parado() and e.prov != p.id and j.prov[e.prov].viz.has(p.id) and e.s.size() >= 3 and ameaca(j, j.prov[e.prov], dono) < JogoC.forca(e.s) * 0.5:
				if doador == null or e.s.size() > doador.s.size():
					doador = e
		if doador:
			j.ordem(doador.id, p.id, ceili(doador.s.size() / 2.0), "mover")
	# atacar
	var difc := j.difc()
	var afinco := 1.6 if j.vida.final else 1.0
	if j.t < j.ultimo_ataque.get(dono, 0.0) + Dados.BOT_PAUSA_ATAQUE / afinco or rng.randf() > FX["vontade"] * afinco * difc["vontade"]:
		return
	var opcoes: Array = []
	var pl := j.placar()
	var lider := 0
	for d in pl:
		if d != "neutro":
			lider = maxi(lider, pl[d])
	for e in j.ex_de(dono):
		if not e.parado() or e.s.size() < 3:
			continue
		var casa: ProvinciaC = j.prov[e.prov]
		var deixar := (1 if perso == "agressivo" and rng.randf() < 0.25 else 4) if casa.capital else (2 if ameaca(j, casa, dono) > 0.0 else 1)
		var aptos: Array = e.vivos().filter(func(s): return not (f["comb"] <= 0.0 and j.usa_comb(s)))
		var manda := mini(e.s.size() - deixar, aptos.size())
		if manda < 2:
			continue
		var enviados := aptos.duplicate()
		enviados.sort_custom(func(a, b): return a.eficacia() > b.eficacia())
		var poder := JogoC.forca(enviados.slice(0, manda))
		for vid in casa.viz:
			var q: ProvinciaC = j.prov[vid]
			if q.dono == dono or not j.em_guerra(dono, q.dono):
				continue
			var est := defesa_em(j, q) * (1.0 + (rng.randf() - 0.5) * 0.6)
			var fora := j.ex.any(func(x): return x.dono == q.dono and not x.rota.is_empty() and x.origem == q.id)
			var pref := 1.3 if q.dono == "neutro" else (1.4 if q.capital else 1.0)
			if perso == "oportunista" and fora:
				pref *= 1.6
			if perso == "agressivo" and q.dono == "jogador":
				pref *= 1.2
			if q.dono != "neutro" and pl.get(q.dono, 0) >= lider:
				pref *= 1.25
			opcoes.append({"e": e, "q": q, "manda": manda, "est": est, "pref": pref, "aptos": aptos, "forca": poder})
	var boas: Array = opcoes.filter(func(o): return o["forca"] > o["est"] * FX["coragem"] * Dados.BOT_MARGEM * difc["margem"])
	boas.sort_custom(func(a, b): return a["pref"] * (a["forca"] - a["est"]) > b["pref"] * (b["forca"] - b["est"]))
	var esc = boas[0] if not boas.is_empty() else null
	if esc == null and perso == "agressivo" and not opcoes.is_empty() and rng.randf() < 0.08:
		esc = opcoes[rng.randi() % opcoes.size()]
	if perso == "ladrão" and rng.randf() < 0.55:
		var s: Array = opcoes.filter(func(o): return o["q"].dono != "neutro" and j.em_guerra(dono, o["q"].dono) and j.fac[o["q"].dono]["moedas"] > 30.0 and o["forca"] > o["est"] * 0.9)
		s.sort_custom(func(a, b): return j.fac[a["q"].dono]["moedas"] > j.fac[b["q"].dono]["moedas"])
		if not s.is_empty() and j.ordem(s[0]["e"].id, s[0]["q"].id, mini(4, s[0]["manda"]), "saque", s[0]["aptos"]):
			j.ultimo_ataque[dono] = j.t
			return
	if esc and j.ex.has(esc["e"]) and j.ordem(esc["e"].id, esc["q"].id, esc["manda"], "ataque", esc["aptos"]):
		j.ultimo_ataque[dono] = j.t
