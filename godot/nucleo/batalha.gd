class_name BatalhaC
extends RefCounted
## Uma batalha numa província. Corre no tempo do mapa (2,5x). A tela de batalha só mostra o que acontece aqui.

class Combatente:
	extends RefCounted
	var s: SoldadoC
	var dist := 0.0
	var x := 0.0
	var morto := false
	var abates_luta := 0
	var lado := "atq"

var j                         # JogoC
var ex: ExercitoC
var alvo: ProvinciaC
var defensores: Array = []
var atq_dono := ""
var def_dono := ""
var atq: Array = []
var def: Array = []
var saque := false
var t := 0.0
var terminou := false
var vencedor := ""
var recuou := false
var por_tempo := false
var post_atq := "avancar"
var post_def := "equilibrio"
var usou_art := false         # o jogador já usou a artilharia dele
var art := {"atq": {"usada": false, "cai": -1.0}, "def": {"usada": false, "cai": -1.0}}
var ia := {}
## táticas de um uso só por batalha
var fumaca := {"atq": {"usada": false, "ate": -1.0}, "def": {"usada": false, "ate": -1.0}}
var carga := {"usada": false, "ate": -1.0}
var pediu := {"atq": false, "def": false}
var audivel := false
var gen_atq := 1.0
var gen_def := 1.0
var ef_atq := 1.0
var ef_def := 1.0
var forte := 1.0
var observada := false        # com a tela de batalha aberta, guarda os acontecimentos para animar
var acontecimentos: Array = []

static func entrada(s: SoldadoC, dist: float, x: float, lado: String) -> Combatente:
	var c := Combatente.new()
	c.s = s; c.dist = dist; c.x = x; c.lado = lado
	return c

func dono_do_lado(lado: String) -> String:
	return atq_dono if lado == "atq" else def_dono

static func outro(lado: String) -> String:
	return "def" if lado == "atq" else "atq"

func lista(lado: String) -> Array:
	return atq if lado == "atq" else def

func vivos(lado: String) -> Array:
	return lista(lado).filter(func(c): return c.s.vida > 0.0)

func lado_do_jogador() -> String:
	return "atq" if atq_dono == "jogador" else ("def" if def_dono == "jogador" else "")

func abrigado(lado: String) -> bool:
	return post_atq == "cobertura" if lado == "atq" else post_def == "abrigar"

func art_a_caminho(contra: String) -> bool:
	return art[outro(contra)]["cai"] >= 0.0

func _avisar(tipo: String, dados: Dictionary) -> void:
	if observada:
		dados["tipo"] = tipo
		acontecimentos.append(dados)

func atirar_artilharia(lado: String) -> bool:
	var dono := dono_do_lado(lado)
	var trovao: bool = j.chefe_e("trovao", dono)
	var custo: float = 0.0 if trovao else j.custo_artilharia(dono)
	var f = j.fac.get(dono)
	if f == null or terminou or art[lado]["usada"] or art[lado]["cai"] >= 0.0 or f["mun"] < custo:
		return false
	f["mun"] -= custo
	var vezes: int = int(art[lado].get("vezes", 0)) + 1
	# o Coronel Trovão só gasta a artilharia depois do segundo disparo
	art[lado] = {"usada": not trovao or vezes >= Dados.TROVAO_VEZES, "cai": t + Dados.ART_AVISO, "vezes": vezes, "ultima": t}
	if dono == "jogador":
		usou_art = true
		j.tocar("canhao")
	elif dono_do_lado(outro(lado)) == "jogador":
		j.noticia("Artilharia de %s a caminho em %s! Toque em %s." % [j.nome_de(dono), alvo.nome, "Abrigar" if lado == "atq" else "Cobertura"], true)
	_avisar("artilharia", {"contra": outro(lado)})
	return true

func fumaca_ativa(lado: String) -> bool:
	return fumaca[lado]["ate"] > t

func carga_ativa() -> bool:
	return carga["ate"] > t and post_atq == "avancar"

## quanto a fumaça atrapalha quem atira contra o `lado`
func _encoberto(lado: String) -> float:
	return Dados.FUMACA_PROTEGE if fumaca_ativa(lado) else 1.0

func soltar_fumaca(lado: String) -> bool:
	var f = j.fac.get(dono_do_lado(lado))
	if f == null or terminou or fumaca[lado]["usada"] or f["mun"] < Dados.FUMACA_MUN:
		return false
	f["mun"] -= Dados.FUMACA_MUN
	fumaca[lado] = {"usada": true, "ate": t + Dados.FUMACA_DURA}
	_avisar("fumaca", {"lado": lado})
	return true

## só quem ataca: corre para a trincheira, bate mais e apanha mais
func dar_carga() -> bool:
	if terminou or carga["usada"]:
		return false
	carga = {"usada": true, "ate": t + Dados.CARGA_DURA}
	post_atq = "avancar"
	_avisar("carga", {})
	return true

## o exército parado numa província vizinha que pode acudir esta batalha
func quem_pode_reforcar(lado: String) -> ExercitoC:
	var dono := dono_do_lado(lado)
	if dono == "neutro" or terminou or pediu[lado]:
		return null
	var melhor: ExercitoC = null
	for v in alvo.viz:
		if j.prov[v].dono != dono:
			continue
		for e in j.parados_em(v, dono):
			if not e.em_batalha and not e.s.is_empty() and (melhor == null or e.s.size() > melhor.s.size()):
				melhor = e
	return melhor

## manda até 4 soldados; eles marcham de verdade e entram quando chegam
func pedir_reforco(lado: String) -> bool:
	var e := quem_pode_reforcar(lado)
	if e == null:
		return false
	var n := mini(Dados.REFORCO_MAX, e.s.size())
	if j.ordem(e.id, alvo.id, n, "ataque" if lado == "atq" else "mover") == null:
		return false
	pediu[lado] = true
	return true

func _queda_da_artilharia() -> void:
	for lado in ["atq", "def"]:
		var a: Dictionary = art[lado]
		if a["cai"] < 0.0 or t < a["cai"]:
			continue
		a["cai"] = -1.0
		var no_alvo := outro(lado)
		var abrigo := Dados.ART_ABRIGADO if abrigado(no_alvo) else 1.0
		var trinch := 1.0 - Dados.ART_TRINCH * alvo.trinch / 100.0 if no_alvo == "def" else 1.0
		if audivel:
			j.tocar("explosao")
		var atingidos := vivos(no_alvo)
		for c in atingidos:
			c.s.vida -= Dados.ART_DANO * abrigo * trinch
		_avisar("queda", {"contra": no_alvo, "atingidos": atingidos, "dano": Dados.ART_DANO * abrigo * trinch, "abrigo": abrigo < 1.0})
		if abrigo < 1.0 and dono_do_lado(no_alvo) == "jogador":
			j.noticia("Abrigo a tempo em %s: a artilharia fez pouco estrago." % alvo.nome)

func _tatica_dos_bots() -> void:
	for lado in ["atq", "def"]:
		var dono := dono_do_lado(lado)
		if not j.eh_bot(dono):
			continue
		if not ia.has(lado):
			ia[lado] = {"prox": 2.0 + j.rng.randf() * 2.0, "avisado": false, "abrigou": false}
		var m: Dictionary = ia[lado]
		var vem := art_a_caminho(lado)
		if vem and not m["avisado"]:
			var a: Dictionary = art[outro(lado)]
			if t >= a["cai"] - Dados.ART_AVISO * 0.5:
				m["avisado"] = true
				if j.rng.randf() < j.esperteza_bot():
					m["abrigou"] = true
					if lado == "atq":
						post_atq = "cobertura"
					else:
						post_def = "abrigar"
			continue
		if vem:
			continue
		if m["abrigou"]:
			m["abrigou"] = false
			m["prox"] = t
		if t < m["prox"]:
			continue
		m["prox"] = t + 3.0 + j.rng.randf() * 2.0
		var meus := vivos(lado).size()
		var deles := vivos(outro(lado)).size()
		if j.chefe_e("trovao", dono):
			if not art[lado]["usada"] and deles >= 2 and t >= 3.0 and t >= float(art[lado].get("ultima", -99.0)) + 12.0:
				atirar_artilharia(lado)
		elif not art[lado]["usada"] and deles >= 4 and t >= 4.0 and j.rng.randf() < 0.25 * j.esperteza_bot():
			atirar_artilharia(lado)
		var apanhando := meus < deles
		if not fumaca[lado]["usada"] and t >= 3.0 and (apanhando or lado == "atq") and j.rng.randf() < 0.12 * j.esperteza_bot():
			soltar_fumaca(lado)
		if lado == "atq" and not carga["usada"] and meus >= deles * 1.5 and atq.any(func(c): return c.s.vida > 0.0 and c.dist < 110.0) and j.rng.randf() < 0.3 * j.esperteza_bot():
			dar_carga()
		if j.rng.randf() > 0.4 + j.esperteza_bot() * 0.6:
			continue
		if lado == "atq":
			if meus < atq.size() * 0.35 and deles > meus * 1.5 and j.rng.randf() < 0.5:
				post_atq = "recuar"
			elif post_atq != "recuar":
				post_atq = "cobertura" if post_def == "atacar" else "avancar"
		else:
			var perto := atq.any(func(c): return c.s.vida > 0.0 and c.dist <= 40.0)
			post_def = "atacar" if perto or post_atq == "avancar" else "equilibrio"

static func dano_contra(a: String, b: String) -> float:
	var k := 1.0
	if Dados.TROPAS[b].get("blindado", false):
		k *= 1.5 if a == "art" else Dados.BLINDADO_RECEBE
	if a == "metr" and b == "cav":
		k *= 1.7
	if a == "cav" and b == "art":
		k *= 1.6
	return k

static func bonus_terreno(tipo: String, terreno: String, lado: String) -> float:
	if lado == "def" and tipo == "inf":
		return 1.3 if terreno == "cidade" or terreno == "capital" else (1.25 if terreno == "floresta" else (1.15 if terreno == "morro" else 1.0))
	if lado == "atq" and tipo == "blind":
		return 1.25 if terreno == "campo" else 1.0
	return 1.0

func _acertar(de: Combatente, para: Combatente, dano: float) -> void:
	var estava := para.s.vida > 0.0
	para.s.vida -= dano
	var matou := estava and para.s.vida <= 0.0
	if matou:
		de.s.abates += 1
		de.abates_luta += 1
	_avisar("tiro", {"de": de, "para": para, "dano": dano, "matou": matou})

func passo(dt: float) -> void:
	if terminou:
		return
	t += dt
	_tatica_dos_bots()
	_queda_da_artilharia()
	var assalto := Dados.ASSALTO_NO_ABRIGO if post_atq == "avancar" and post_def == "abrigar" else 1.0
	var fa: Dictionary = j.fac[atq_dono]
	var fd: Dictionary = j.fac[def_dono]
	var va := vivos("atq")
	var vd := vivos("def")
	for c in va:
		c.dist = clampf(c.dist - Dados.VELBAT[post_atq] * (Dados.CARGA_VEL if carga_ativa() else 1.0) * dt, 0.0, Dados.DIST + 25.0)
	var na_carga := Dados.CARGA_RECEBE if carga_ativa() else 1.0
	var pd_dano := 0.5 if post_def == "abrigar" else (1.4 if post_def == "atacar" else 1.0)
	var pd_rec := 0.5 if post_def == "abrigar" else (1.3 if post_def == "atacar" else 1.0)
	var exposicao := 0.5 if post_atq == "cobertura" else 1.0
	var lot_a: float = j.fator_lotacao(atq_dono)
	var lot_d: float = j.fator_lotacao(def_dono)
	var rng: RandomNumberGenerator = j.rng
	var no_campo := va.filter(func(c): return c.dist > 0.0 and c.dist < 260.0)
	if not no_campo.is_empty() and not vd.is_empty():
		var mun_d := 1.0 if fd["mun"] > 0.0 else 0.3
		var cap := Dados.CAPITAL_DEFESA if alvo.capital else 1.0
		for d in vd:
			var chance: float = Dados.TIRO_DEF * d.s.dados()["def"] * d.s.eficacia() * pd_dano * exposicao * mun_d * cap * gen_def * forte * ef_def * j.sem_comb(d.s, def_dono) * j.fator_falta_aco(d.s, def_dono) * lot_d * bonus_terreno(d.s.tipo, alvo.tipo, "def") * _encoberto("atq") * dt
			if rng.randf() < chance:
				var a = no_campo[rng.randi() % no_campo.size()]
				_acertar(d, a, Dados.DANO_TIRO * (0.7 + 0.6 * rng.randf()) * na_carga * dano_contra(d.s.tipo, a.s.tipo))
				if audivel and not observada:
					j.tocar("tiro")
		fd["mun"] = maxf(0.0, fd["mun"] - vd.size() * 0.5 * dt)
	if not vd.is_empty():
		var mun_a := 1.0 if fa["mun"] > 0.0 else 0.3
		for a in va:
			var T: Dictionary = a.s.dados()
			if a.dist >= (Dados.DIST + 30.0 if T.get("longe", false) else 220.0):
				continue
			var protege := 1.0 - Dados.TRINCH_PROTEGE * (0.4 if T.get("longe", false) else 1.0) * alvo.trinch / 100.0
			var chance := 0.0
			if a.dist <= 0.0:
				chance = Dados.CORPO_A_CORPO * T["corpo"] * a.s.eficacia() * pd_rec * gen_atq * lot_a * j.fator_falta_aco(a.s, atq_dono) * (1.0 - Dados.TRINCH_PROTEGE_CORPO * alvo.trinch / 100.0) * (Dados.CARGA_CORPO if carga_ativa() else 1.0)
			else:
				chance = Dados.TIRO_ATQ * T["atq"] * (0.6 if post_atq == "cobertura" else 1.0) * a.s.eficacia() * mun_a * protege * pd_rec * gen_atq * ef_atq * j.sem_comb(a.s, atq_dono) * j.fator_falta_aco(a.s, atq_dono) * lot_a * bonus_terreno(a.s.tipo, alvo.tipo, "atq")
			if rng.randf() < chance * _encoberto("def") * dt:
				var d = vd[rng.randi() % vd.size()]
				_acertar(a, d, Dados.DANO_TIRO * (0.7 + 0.6 * rng.randf()) * assalto * dano_contra(a.s.tipo, d.s.tipo))
				if audivel and not observada:
					j.tocar("tiro")
		fa["mun"] = maxf(0.0, fa["mun"] - va.size() * 0.4 * dt)
	var na_trincheira := va.filter(func(c): return c.dist <= 0.0)
	if not na_trincheira.is_empty() and not vd.is_empty():
		for d in vd:
			if rng.randf() < Dados.CORPO_A_CORPO * d.s.dados()["corpo"] * d.s.eficacia() * gen_def * lot_d * j.fator_falta_aco(d.s, def_dono) * _encoberto("atq") * dt:
				var vivos_t := na_trincheira.filter(func(c): return c.s.vida > 0.0)
				if vivos_t.is_empty():
					break
				var a = vivos_t[rng.randi() % vivos_t.size()]
				_acertar(d, a, Dados.DANO_TIRO * (0.7 + 0.6 * rng.randf()) * na_carga * dano_contra(d.s.tipo, a.s.tipo))
	for lado in ["atq", "def"]:
		for c in lista(lado):
			if c.s.vida <= 0.0 and not c.morto:
				c.morto = true
				if audivel and lado == "atq":
					j.tocar("abate")
	var sa := vivos("atq")
	var sd := vivos("def")
	if sd.is_empty() and not sa.is_empty():
		terminou = true; vencedor = "atq"
	elif sa.is_empty():
		terminou = true; vencedor = "def"
	elif post_atq == "recuar" and sa.all(func(c): return c.dist >= Dados.DIST + 20.0):
		terminou = true; vencedor = "def"; recuou = true
	elif t >= Dados.BAT_DURACAO:
		terminou = true; vencedor = "def"; por_tempo = true

## parte do poder que é do lado pedido (0 a 1), para a barra "quem está ganhando"
func parte_de(lado: String) -> float:
	var a := 0.0
	var d := 0.0
	for c in vivos("atq"):
		a += c.s.vida / c.s.vida_max()
	for c in vivos("def"):
		d += c.s.vida / c.s.vida_max()
	d *= 1.0 + alvo.trinch / 250.0
	return (a if lado == "atq" else d) / maxf(0.01, a + d)

## o soldado de cada combatente é o mesmo objeto que está no exército: salva só a posição (i)
func salvar() -> Dictionary:
	var defs: Array = defensores.filter(func(d): return j.ex.has(d))
	var soldados_def: Array = []
	for d in defs:
		soldados_def.append_array(d.s)
	var guardar := func(l: Array, soldados: Array) -> Array:
		return l.map(func(c):
			var i := -1
			for k in soldados.size():
				if is_same(soldados[k], c.s):
					i = k
					break
			return {"i": i, "s": c.s.salvar() if i < 0 else [], "dist": c.dist, "x": c.x, "morto": c.morto, "abates": c.abates_luta})
	return {"ex": ex.id, "alvo": alvo.id, "defensores": defs.map(func(d): return d.id), "atq": guardar.call(atq, ex.s), "def": guardar.call(def, soldados_def),
		"atq_dono": atq_dono, "def_dono": def_dono, "saque": saque, "t": t, "post_atq": post_atq, "post_def": post_def, "usou_art": usou_art, "art": art.duplicate(true), "ia": ia.duplicate(true), "fumaca": fumaca.duplicate(true), "carga": carga.duplicate(true), "pediu": pediu.duplicate(true),
		"audivel": audivel, "gen_atq": gen_atq, "gen_def": gen_def, "ef_atq": ef_atq, "ef_def": ef_def, "forte": forte}
