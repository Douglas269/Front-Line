class_name RoboC
extends RefCounted
## O robô "esperto" dos testes: decide o que o jogador faria agora.

static func jogar(j: JogoC) -> void:
	var f: Dictionary = j.fac["jogador"]
	var cap: ProvinciaC = j.prov[j.capital_jogador]
	var am := BotsC.ameaca(j, cap, "jogador")
	var dc := BotsC.defesa_em(j, cap)
	var cidades := j.minhas().filter(func(p): return p.eh_cidade())
	cidades.sort_custom(func(a, z): return a == cap and z != cap)
	for i in 3:
		if f["moedas"] < Dados.RECRUTAR + 12 or cidades.is_empty():
			break
		j.recrutar_em(cap.id if am > dc * 0.8 else cidades[i % cidades.size()].id, "jogador")
	if am > dc and f["moedas"] >= Dados.FORTIFICAR and cap.trinch < 100.0:
		j.fortificar(cap.id)
	if am > dc * 0.9:
		for e in j.ex_de("jogador"):
			if e.parado() and e.prov != cap.id and cap.viz.has(e.prov):
				j.ordem(e.id, cap.id, e.s.size(), "mover")
	for e in j.ex_de("jogador"):
		if not j.ex.has(e) or not e.parado() or e.s.size() < 3:
			continue
		var casa: ProvinciaC = j.prov[e.prov]
		var maior := 0.0
		for x in j.ex:
			if x.dono != "jogador" and x.dono != "neutro" and (casa.viz.has(x.prov) or x.rota.has(casa.id)):
				maior = maxf(maior, JogoC.forca(x.s))
		var ficar := maxi(4, ceili(maior * 0.75)) if casa == cap else maxi(1, ceili(maior * 0.7 / (1.0 + casa.trinch / 250.0)))
		var manda: int = e.s.size() - ficar
		if manda < 2:
			continue
		var env: Array = e.vivos()
		env.sort_custom(func(a, z): return a.eficacia() > z.eficacia())
		var forca_env := JogoC.forca(env.slice(0, manda))
		var boa: ProvinciaC = null
		var boa_def := 0.0
		var desconhecida: ProvinciaC = null
		for v in casa.viz:
			var q: ProvinciaC = j.prov[v]
			if q.dono == "jogador" or j.ex.any(func(x): return x.dono == "jogador" and x.rota.has(q.id)):
				continue
			if not j.visivel(q.id):
				desconhecida = q
				continue
			var d := BotsC.defesa_em(j, q)
			if forca_env > d * 1.3 and (boa == null or (q.capital and not boa.capital) or (q.capital == boa.capital and d < boa_def)):
				boa = q
				boa_def = d
		if desconhecida and f["moedas"] >= Dados.ESPIAO + 10:
			j.espionar(desconhecida.id)
		if boa:
			j.ordem(e.id, boa.id, manda, "ataque")
	for e in j.ex_de("jogador"):
		if not j.ex.has(e) or not e.parado() or not j.prov[e.prov].viz.all(func(v): return j.prov[v].dono == "jogador"):
			continue
		if e.s.size() < (7 if e.prov == cap.id else 2):
			continue
		var melhor := {}
		var destino := ""
		for q in j.minhas():
			if not q.viz.any(func(v): return j.prov[v].dono != "jogador"):
				continue
			var c := j.caminho(e.prov, q.id)
			if not c.is_empty() and (melhor.is_empty() or c["dist"] < melhor["dist"]):
				melhor = c
				destino = q.id
		if destino != "":
			j.ordem(e.id, destino, e.s.size() - 4 if e.prov == cap.id else e.s.size(), "mover")
