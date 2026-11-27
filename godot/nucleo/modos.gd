class_name ModosC
extends RefCounted
## Batalha rápida, desafio do dia e as missões da operação. Cada partida dessas é descrita por uma
## "origem" pequena (semente e escolhas), que basta para montar tudo de novo ao carregar.

## regras que mudam a partida: [nome, explicação]
const REGRAS := {
	"inverno": ["Inverno", "campos produzem 40% menos comida"],
	"industria": ["Região industrial", "obras custam metade"],
	"escassez": ["Pouca munição", "a munição rende metade para todos"],
	"fartura": ["Tempos de fartura", "as moedas rendem 40% a mais para todos"],
	"milicia": ["Milícia armada", "cada província neutra tem 2 soldados a mais"],
	"trincheiras": ["Terra cavada", "províncias neutras começam bem entrincheiradas"],
	"veteranos": ["Inimigo calejado", "os inimigos começam com soldados veteranos"],
	"relampago": ["Guerra curta", "só 7 minutos de partida"]
}
const BOTS := ["bravo", "charlie", "delta", "echo"]

static func origem_rapida(mapa: int, tam: String, bots: int, regras: Array, semente: int) -> Dictionary:
	return {"modo": "rapida", "mapa": mapa, "tam": tam, "bots": bots, "regras": regras, "semente": semente}

static func hoje() -> String:
	var d := Time.get_date_dict_from_system()
	return "%04d-%02d-%02d" % [d["year"], d["month"], d["day"]]

## o mesmo dia dá o mesmo desafio em qualquer aparelho
static func origem_diario(dia: String) -> Dictionary:
	var semente := 0
	for c in dia.to_utf8_buffer():
		semente = (semente * 131 + c) % 2000000011
	var rng := RandomNumberGenerator.new()
	rng.seed = semente
	var ids: Array = REGRAS.keys()
	var a: String = ids[rng.randi() % ids.size()]
	var b := a
	while b == a:
		b = ids[rng.randi() % ids.size()]
	return {"modo": "diario", "dia": dia, "mapa": 0, "tam": ["p", "m", "m"][rng.randi() % 3], "bots": 2 + rng.randi() % 2, "regras": [a, b], "semente": semente}

static func nome_de_partida(o: Dictionary) -> String:
	match o.get("modo", ""):
		"rapida": return "Batalha rápida"
		"diario": return "Desafio do dia"
		"operacao": return o.get("nome", "Operação")
	return ""

## a "fase" e o mapa de uma origem: [fase, mapa, textura do chão ou null]
static func montar(o: Dictionary, com_chao := true) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = int(o["semente"])
	var regras: Array = o.get("regras", [])
	var n := int(o.get("mapa", 0))
	var bots: Array
	var mapa: Dictionary
	var chao = null
	if n > 0:
		# um dos mapas da campanha, com a quantidade de inimigos escolhida
		mapa = JogoC.mapas()[n - 1].duplicate(true)
		var donos: Array = Dados.FASES[n - 1]["bots"]
		bots = donos.slice(0, mini(int(o["bots"]), donos.size()))
		for p in mapa["prov"]:
			if p["dono"] != "jogador" and p["dono"] != "neutro" and not bots.has(p["dono"]):
				p["dono"] = "neutro"
				p["capital"] = false
				p["capitalDe"] = ""
				if p["tipo"] == "capital":
					p["tipo"] = "cidade"
				p["trinch"] = 40.0
				p["moral"] = 60.0
		for e in mapa["ex"]:
			if e["dono"] != "jogador" and e["dono"] != "neutro" and not bots.has(e["dono"]):
				e["dono"] = "neutro"
				e["tropas"] = (e["tropas"] as Array).slice(0, 4).map(func(_t): return "inf")
		if com_chao:
			chao = load("res://dados/terreno%d.png" % n)
	else:
		var ordem: Array = BOTS.duplicate()
		for i in range(ordem.size() - 1, 0, -1):
			var k := rng.randi() % (i + 1)
			var tmp = ordem[i]
			ordem[i] = ordem[k]
			ordem[k] = tmp
		bots = ordem.slice(0, int(o["bots"]))
		mapa = GeradorC.gerar(int(o["semente"]), o["tam"], bots)
		if com_chao:
			chao = PintorC.terreno(mapa, int(o["semente"]))
	var tempo := float(o.get("tempo", {"p": 600, "m": 720, "g": 900}.get(o.get("tam", "m"), 720) if n == 0 else Dados.FASES[n - 1]["tempo"]))
	if regras.has("relampago"):
		tempo = 420.0
	var fase := {"n": 0, "cap": 0, "nome": nome_de_partida(o), "bots": bots, "tempo": tempo, "objetivo": o.get("objetivo", "semPerder"), "regras": regras}
	if o.has("bot_facil"):
		fase["bot_facil"] = o["bot_facil"]
	elif o.get("modo", "") != "operacao":
		# sobra de terra para cada país: quanto mais, mais forte o inimigo precisa começar
		var sobra := maxf(0.0, float(mapa["prov"].size()) / (bots.size() + 1) - 11.0)
		if sobra > 0.0:
			fase["bot_facil"] = 1.0 + minf(0.3, sobra * 0.03)
			var extra := mini(16, roundi(sobra * 1.4))
			for e in mapa["ex"]:
				if bots.has(e["dono"]) and (e["tropas"] as Array).size() >= 8:
					for i in extra:
						e["tropas"].append("metr" if i % 4 == 3 else "inf")
	return [fase, mapa, chao]
