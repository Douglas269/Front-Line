class_name CampanhaC
extends RefCounted
## O progresso que fica entre as partidas: estrelas, generais, reforços. (user://campanha.json)

const ARQUIVO := "user://campanha.json"
var guarda_no_aparelho := true
var meta := {"estrelas": {}, "generais": {}, "reforcos": [], "escolhidos": {}, "ofertas": {}}
var rng := RandomNumberGenerator.new()

func _init(no_aparelho := true) -> void:
	guarda_no_aparelho = no_aparelho
	rng.randomize()
	if guarda_no_aparelho and FileAccess.file_exists(ARQUIVO):
		var d = JSON.parse_string(FileAccess.get_file_as_string(ARQUIVO))
		if d is Dictionary:
			for k in meta:
				if d.has(k):
					meta[k] = d[k]

func gravar() -> void:
	if guarda_no_aparelho:
		var f := FileAccess.open(ARQUIVO, FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify(meta))

func apagar() -> void:
	meta = {"estrelas": {}, "generais": {}, "reforcos": [], "escolhidos": {}, "ofertas": {}}
	gravar()

func estrelas_de(n: int) -> int:
	return int(meta["estrelas"].get(str(n), 0))

func total_estrelas() -> int:
	var r := 0
	for k in meta["estrelas"]:
		r += int(meta["estrelas"][k])
	return r

func fase_liberada(n: int) -> bool:
	return n == 1 or estrelas_de(n - 1) >= 1

## diplomacia aparece na fase 2 e generais na 3 (ou quando a fase já foi liberada)
func sistema_liberado(sistema: String, fase_atual: int) -> bool:
	if fase_atual == 0: # partidas avulsas têm tudo
		return true
	var na: int = {"diplomacia": 2, "generais": 3}[sistema]
	return fase_atual >= na or fase_liberada(na)

func xp_general(id: String) -> int:
	return int(meta["generais"].get(id, 0))

static func nivel_general(xp: int) -> int:
	return mini(5, 1 + int(xp / 3.0))

func generais_liberados() -> Array:
	var tot := total_estrelas()
	return Dados.GENERAIS.filter(func(g): return tot >= g["estrelas"])

func guardar_progresso(j: JogoC, estrelas: int) -> void:
	for id in j.gen_xp:
		meta["generais"][id] = xp_general(id) + int(j.gen_xp[id])
	var n := str(int(j.fase["n"]))
	meta["estrelas"][n] = maxi(estrelas_de(int(j.fase["n"])), estrelas)
	gravar()

## 3 reforços sorteados quando a fase é vencida; ficam guardados até escolher
func oferta_de_reforco(fase: int) -> Array:
	var n := str(fase)
	if meta["escolhidos"].has(n) or estrelas_de(fase) < 1:
		return []
	if not meta["ofertas"].has(n):
		var livres: Array = Dados.REFORCOS.keys().filter(func(id): return not meta["reforcos"].has(id))
		for i in range(livres.size() - 1, 0, -1):
			var k := rng.randi() % (i + 1)
			var tmp = livres[i]
			livres[i] = livres[k]
			livres[k] = tmp
		meta["ofertas"][n] = livres.slice(0, 3)
		gravar()
	return meta["ofertas"][n]

func escolher_reforco(fase: int, id: String) -> bool:
	if not oferta_de_reforco(fase).has(id):
		return false
	meta["reforcos"].append(id)
	meta["escolhidos"][str(fase)] = id
	gravar()
	return true

func fase_com_oferta() -> int:
	for F in Dados.FASES:
		if not oferta_de_reforco(F["n"]).is_empty():
			return F["n"]
	return 0

## aplica os reforços numa partida recém-começada
func aplicar_reforcos(j: JogoC, lista = null) -> void:
	j.reforcos = (lista if lista != null else meta["reforcos"]).filter(func(id): return Dados.REFORCOS.has(id))
	var f: Dictionary = j.fac["jogador"]
	var cap: ProvinciaC = j.prov[j.capital_jogador]
	var da_capital: Array = j.parados_em(cap.id, "jogador")
	var tem := func(id: String) -> bool: return j.reforcos.has(id)
	var menos := func(k: String, v: float) -> void: f[k] = maxf(0.0, f[k] - v)
	if tem.call("calejados"):
		if not da_capital.is_empty():
			da_capital[0].s = da_capital[0].s.slice(0, maxi(1, da_capital[0].s.size() - 2))
		for e in j.ex_de("jogador"):
			for s in e.s:
				s.lutas = 2
	if tem.call("artilheiros"): menos.call("mun", 40.0)
	if tem.call("engenharia"): menos.call("moedas", 15.0)
	if tem.call("siderurgia"): f["aco"] += 10.0
	if tem.call("intendencia"):
		f["moedas"] += 40.0
		f["comida"] += 25.0
		menos.call("aco", 8.0)
	if tem.call("motorizada"):
		menos.call("comb", 10.0)
		menos.call("comida", 10.0)
	if tem.call("voluntarios"):
		if not da_capital.is_empty():
			for i in 3:
				da_capital[0].s.append(SoldadoC.new("Voluntário"))
		menos.call("comida", 25.0)
	if tem.call("bastiao"):
		cap.trinch = 100.0
		cap.obras["forte"] = true
		menos.call("moedas", 20.0)
