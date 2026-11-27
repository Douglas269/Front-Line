class_name JogoC
extends RefCounted
## O modo Conquista sem tela: economia, ordens, movimento, batalhas, moral, diplomacia, generais e fim de fase.
## (porte fiel de conquista.js e conquista-extra.js)

signal noticia_nova(txt: String, alerta: bool)
signal som(nome: String)
signal conquista_feita(prov_id: String, dono: String, antigo: String)
signal batalha_resolvida(resumo: Dictionary)
signal acabou()

static var _mapas: Array = []

var rng := RandomNumberGenerator.new()
var campanha: CampanhaC
var vida: VidaC
var fase: Dictionary
var mapa_w := 0.0
var mapa_h := 0.0
var prov := {}                # id -> ProvinciaC
var lista_prov: Array = []
var ex: Array = []            # ExercitoC
var batalhas: Array = []      # BatalhaC
var fac := {}                 # dono -> recursos
var pensar := {}              # bots ativos -> segundos até pensar
var pesq := {}
var rel := {}
var t := 0.0
var ciclo := 0
var fim := ""
var vencedor_dominio := ""
var noticias: Array = []
var espiado := {}
var revelado := {}
var espioes: Array = []
var ultimo_ataque := {}
var eliminados := {}
var sem_capital := {}
var gen_ferido := {}
var gen_xp := {}
var stats := {"perdidas": 0, "baixas": 0, "revoltas": 0}
var capital_jogador := ""
var pausado := false
var velocidade := 1
var prox_id := 1
var conf_t := 0.0
var dificuldade := "soldado"
var reforcos: Array = []
var batalha_rapida := false
## ponto de reunião e recrutamento automático
var reuniao := ""
var auto_rec := {"ligado": false, "tipo": "inf", "reserva": 40}
var auto_fila := 0            # recrutas automáticos esperando para marchar
const LOTE_REUNIAO := 3
## uma foto do placar a cada ciclo, para o resumo da partida
var historico: Array = []
## soldados seus que fizeram história e caíram
var memorial: Array = []
## o general que comanda um dos inimigos (só no fim da Operação)
var chefe_id := ""
var chefe_dono := ""
## partidas fora da campanha: como montá-las de novo, e o chão pintado do mapa
var origem := {}
var chao: Texture2D
var extras := true            # missões, acontecimentos, ofensivas e final
var jogador_automatico := false # só nos testes: o robô usa os botões da batalha

static func mapas() -> Array:
	if _mapas.is_empty():
		var f := FileAccess.open("res://dados/mapas.json", FileAccess.READ)
		_mapas = JSON.parse_string(f.get_as_text())
	return _mapas

func _init(c: CampanhaC = null, semente := 0) -> void:
	campanha = c if c else CampanhaC.new(false)
	if semente:
		rng.seed = semente
	else:
		rng.randomize()
	vida = VidaC.new(self)

func noticia(txt: String, alerta := false) -> void:
	noticias.push_front({"txt": txt, "alerta": alerta, "t": t})
	if noticias.size() > 30:
		noticias.resize(30)
	if alerta:
		tocar("alerta")
	noticia_nova.emit(txt, alerta)

func tocar(nome: String) -> void:
	som.emit(nome)

func nome_de(d: String) -> String:
	if d == chefe_dono and chefe_id != "":
		return Dados.CHEFES[chefe_id]["nome"]
	return Dados.FACCOES[d]["nome"]

## o chefe presente é este e comanda este país
func chefe_e(id: String, dono: String) -> bool:
	return chefe_id == id and chefe_dono == dono

# ------------------------------------------------------------ começo
func novo(num: int) -> void:
	origem = {}
	chao = null
	_montar(Dados.FASES[num - 1], mapas()[num - 1])
	noticia("Fase %d: %s. Tome as capitais inimigas (★)." % [num, fase["nome"]])

## partida rápida, desafio do dia ou missão de operação
func novo_de_origem(o: Dictionary, com_chao := true) -> void:
	var partes := ModosC.montar(o, com_chao)
	origem = o.duplicate(true)
	chao = partes[2]
	_montar(partes[0], partes[1])
	_aplicar_regras()
	campanha.aplicar_reforcos(self, o.get("reforcos", []))
	_trazer_veteranos(o.get("veteranos", []))
	_chamar_chefe(o.get("chefe", ""))
	noticia("%s. Tome as capitais inimigas (★)." % fase["nome"])

func _chamar_chefe(id: String) -> void:
	if id == "" or not Dados.CHEFES.has(id):
		return
	chefe_id = id
	chefe_dono = fase["bots"][0]
	var capital: ProvinciaC = null
	for p in lista_prov:
		if p.capital and p.capital_de == chefe_dono:
			capital = p
	if capital:
		var guarda := parados_em(capital.id, chefe_dono)
		if not guarda.is_empty():
			for i in Dados.CHEFE_GUARDA:
				var x := SoldadoC.new("Guarda", "inf")
				x.lutas = 5
				guarda[0].s.append(x)
		if id == "ferro":
			capital.obras["forte"] = true
	if id == "ferro":
		for p in prov_de(chefe_dono):
			p.trinch = 90.0
	var C: Dictionary = Dados.CHEFES[id]
	noticia("CHEFE: %s, %s. Atenção: %s." % [C["nome"], C["titulo"], C["txt"]], true)

## derrubar a capital do chefe rende um prêmio
func _chefe_caiu() -> void:
	if stats.get("chefe_caiu", false):
		return
	stats["chefe_caiu"] = true
	for k in Dados.CHEFE_PREMIO:
		fac["jogador"][k] += Dados.CHEFE_PREMIO[k]
	tocar("vitoria")
	noticia("Você derrotou %s! %s" % [Dados.CHEFES[chefe_id]["nome"], VidaC.texto_premio(Dados.CHEFE_PREMIO)])

func _trazer_veteranos(lista: Array) -> void:
	var na_capital: Array = parados_em(capital_jogador, "jogador")
	if na_capital.is_empty() or lista.is_empty():
		return
	var e: ExercitoC = na_capital[0]
	var i := 0
	for dados_salvos in lista:
		var v := SoldadoC.carregar(dados_salvos)
		v.vida = v.vida_max(); v.fome = 10.0; v.cansaco = 0.0; v.soldo = 0.0
		if i < e.s.size():
			e.s[i] = v
		else:
			e.s.append(v)
		i += 1
	noticia("%s: %s." % [Dados.qtd(i, "veterano da missão anterior está com você", "veteranos da missão anterior estão com você"), ", ".join(e.s.slice(0, i).map(func(x): return x.nome))])

## os melhores soldados vivos: primeiro a patente, depois os abates
func melhores(quantos := 3) -> Array:
	var todos: Array = []
	for e in ex:
		if e.dono == "jogador":
			todos.append_array(e.vivos())
	todos = todos.filter(func(x): return x.lutas > 0)
	todos.sort_custom(func(a, b): return a.patente() * 100 + a.abates * 5 + a.lutas > b.patente() * 100 + b.abates * 5 + b.lutas)
	return todos.slice(0, quantos)

func tem_regra(id: String) -> bool:
	return fase.get("regra", "") == id or fase.get("regras", []).has(id)

## as regras que mexem no começo da partida
func _aplicar_regras() -> void:
	if tem_regra("milicia"):
		for e in ex_de("neutro"):
			for i in 2:
				e.s.append(SoldadoC.new("Miliciano"))
	if tem_regra("trincheiras"):
		for p in lista_prov:
			if p.dono == "neutro":
				p.trinch = 75.0
	if tem_regra("veteranos"):
		for e in ex:
			if e.dono != "jogador" and e.dono != "neutro":
				for x in e.s:
					x.lutas = 2

func _montar(f: Dictionary, m: Dictionary) -> void:
	fase = f
	mapa_w = m["W"]; mapa_h = m["H"]
	prov = {}; lista_prov = []; ex = []; batalhas = []
	t = 0.0; ciclo = 0; fim = ""; noticias = []; espiado = {}; revelado = {}; espioes = []
	ultimo_ataque = {}; eliminados = {}; sem_capital = {}; gen_ferido = {}; gen_xp = {}; rel = {}
	stats = {"perdidas": 0, "baixas": 0, "revoltas": 0, "inimigos": 0, "art": 0, "melhor_nome": "", "melhor_n": 0}
	reuniao = ""; auto_fila = 0; historico = []; memorial = []; chefe_id = ""; chefe_dono = ""
	auto_rec = {"ligado": false, "tipo": "inf", "reserva": 40}
	pausado = false; velocidade = 1; prox_id = 1; reforcos = []
	vida = VidaC.new(self)
	fac = {"jogador": _recursos(40, 150, 50), "neutro": _recursos(0, 100, 0)}
	fac["neutro"]["aco"] = 0.0
	fac["neutro"]["comb"] = 0.0
	pesq = {"jogador": {"feitas": {}, "atual": {}}}
	pensar = {}
	var i := 0
	for b in fase["bots"]:
		fac[b] = _recursos(40, 150, 70 if b == "delta" else 50)
		pensar[b] = 60.0 + i * 12.0 + rng.randf() * 10.0
		pesq[b] = {"feitas": {}, "atual": {}}
		rel[b] = {"estado": "guerra", "ate": 0.0, "recusa_ate": 0.0, "atacado_em": -999.0}
		i += 1
	if fase.get("regra", "") == "paz" and rel.has("charlie"):
		rel["charlie"] = {"estado": "paz", "ate": 480.0, "recusa_ate": 0.0, "atacado_em": -999.0}
	for d in m["prov"]:
		var p := ProvinciaC.new()
		p.id = d["id"]; p.nome = d["nome"]; p.pos = Vector2(d["x"], d["y"]); p.viz = d["viz"].duplicate()
		for pt in d["poli"]:
			p.poli.append(Vector2(pt[0], pt[1]))
		p.tipo = d["tipo"]; p.dono = d["dono"]; p.capital = d["capital"]; p.capital_de = d["capitalDe"]
		p.trinch = d["trinch"]; p.moral = d["moral"]
		if d["forte"]:
			p.obras["forte"] = true
		prov[p.id] = p
		lista_prov.append(p)
	capital_jogador = m["capitalJogador"]
	for d in m["ex"]:
		var soldados: Array = []
		for tp in d["tropas"]:
			var s := SoldadoC.new(_nome_novo(d["dono"], soldados.size()), tp)
			soldados.append(s)
		criar_exercito(d["dono"], d["prov"], 0, soldados)
	gerais_dos_bots()
	var libs := campanha.generais_liberados()
	if not libs.is_empty():
		var e := parados_em(capital_jogador, "jogador")
		if not e.is_empty():
			e[0].general = libs[0]["id"]
	historico.append([0, placar()])

func _recursos(comida: float, mun: float, moedas: float) -> Dictionary:
	return {"comida": float(comida), "mun": float(mun), "moedas": float(moedas), "aco": Dados.ACO_INICIAL, "comb": Dados.COMB_INICIAL, "atraso": 0.0, "falta_aco": false, "comb_gasto": 0.0}

## um nome que nenhum soldado seu esteja usando
func nome_livre() -> String:
	var usados := {}
	for e in ex:
		if e.dono == "jogador":
			for x in e.s:
				usados[x.nome] = true
	var todos: Array = Dados.NOMES_JOG + Dados.APELIDOS_RECRUTA
	var inicio := rng.randi() % todos.size()
	for i in todos.size():
		var n: String = todos[(inicio + i) % todos.size()]
		if not usados.has(n):
			return n
	return "%s %d" % [todos[inicio], prox_id]

func _nome_novo(dono: String, k: int) -> String:
	return Dados.NOMES_JOG[(prox_id + k) % Dados.NOMES_JOG.size()] if dono == "jogador" else ("Miliciano" if dono == "neutro" else "Inimigo")

func criar_exercito(dono: String, prov_id: String, qtd: int, soldados = null) -> ExercitoC:
	var p: ProvinciaC = prov[prov_id]
	var e := ExercitoC.new()
	e.id = "e%d" % prox_id
	prox_id += 1
	e.dono = dono
	if soldados != null:
		e.s = soldados
	else:
		for k in qtd:
			e.s.append(SoldadoC.new(_nome_novo(dono, k)))
	e.prov = prov_id; e.de = prov_id; e.origem = prov_id; e.pos = p.pos
	ex.append(e)
	return e

# ------------------------------------------------------------ consultas
func ex_de(dono: String) -> Array:
	return ex.filter(func(e): return e.dono == dono)

func parados_em(id: String, dono := "") -> Array:
	return ex.filter(func(e): return e.prov == id and e.parado() and (dono == "" or e.dono == dono))

func ex_por_id(id: String) -> ExercitoC:
	for e in ex:
		if e.id == id:
			return e
	return null

func tirar(e: ExercitoC) -> void:
	for i in ex.size():
		if is_same(ex[i], e):
			ex.remove_at(i)
			return

func prov_de(dono: String) -> Array:
	return lista_prov.filter(func(p): return p.dono == dono)

func minhas() -> Array:
	return prov_de("jogador")

func tropa_de(dono: String) -> int:
	var n := 0
	for e in ex:
		if e.dono == dono:
			n += e.s.size()
	return n

func placar() -> Dictionary:
	var r := {}
	for p in lista_prov:
		r[p.dono] = r.get(p.dono, 0) + 1
	return r

func eh_bot(dono: String) -> bool:
	return pensar.has(dono) or (jogador_automatico and dono == "jogador")

func esperteza_bot() -> float:
	return Dados.DIFICULDADES[dificuldade]["esperteza"] * (0.55 if fase["n"] == 1 else 1.0)

func difc() -> Dictionary:
	var d: Dictionary = Dados.DIFICULDADES[dificuldade]
	var facil: float = fase.get("bot_facil", 1.0)
	return {"vontade": d["vontade"] * facil, "margem": d["margem"], "prod": d["prod"] * facil, "renda": d["renda"]}

static func forca(lista: Array) -> float:
	var f := 0.0
	for s in lista:
		if s.vida > 0.0:
			f += s.eficacia()
	return f

func stack_efic(qtd: int) -> float:
	return 1.0 if qtd <= Dados.STACK_LIMITE else maxf(Dados.STACK_PISO, 1.0 - Dados.STACK_PEN * (qtd - Dados.STACK_LIMITE))

# ------------------------------------------------------------ reforços, tropas e economia
func bonus_reforco(dono: String, chave: String) -> float:
	var r := 0.0
	if dono == "jogador":
		for id in reforcos:
			r += Dados.REFORCOS[id].get(chave, 0)
	return r

func custo_artilharia(dono: String) -> float:
	return Dados.ARTILHARIA_MUN - bonus_reforco(dono, "art_barata")

func tem_pesq(dono: String, id: String) -> bool:
	return pesq.has(dono) and pesq[dono]["feitas"].has(id)

func tropa_liberada(dono: String, tipo: String) -> bool:
	var req: String = Dados.TROPAS[tipo]["pesquisa"]
	return req == "" or tem_pesq(dono, req)

func usa_comb(s: SoldadoC) -> bool:
	return Dados.TROPAS[s.tipo]["comb"] > 0.0

func gasto_comb(lista: Array) -> float:
	var r := 0.0
	for s in lista:
		r += Dados.TROPAS[s.tipo]["comb"]
	return r

func sem_comb(s: SoldadoC, dono: String) -> float:
	return 0.5 if usa_comb(s) and fac.has(dono) and fac[dono]["comb"] <= 0.0 else 1.0

func fator_falta_aco(s: SoldadoC, dono: String) -> float:
	return Dados.FALTA_ACO_DANO if fac.has(dono) and fac[dono]["falta_aco"] and Dados.TROPAS[s.tipo]["manut_aco"] > 0.0 else 1.0

func mao_de_obra_max(dono: String) -> int:
	if dono == "neutro":
		return 0
	var r := 0
	for p in lista_prov:
		if p.dono == dono:
			r += Dados.MO[p.tipo]
	return r

func mao_de_obra_livre(dono: String) -> int:
	return maxi(0, mao_de_obra_max(dono) - tropa_de(dono))

func fator_lotacao(dono: String) -> float:
	if dono == "neutro":
		return 1.0
	var usada := tropa_de(dono)
	var maxima := mao_de_obra_max(dono)
	return 1.0 if usada <= maxima else maxf(Dados.LOTACAO_PISO, float(maxima) / usada)

func manutencao_de(dono: String, chave := "manut") -> float:
	var r := 0.0
	for e in ex:
		if e.dono == dono:
			for s in e.s:
				r += Dados.TROPAS[s.tipo][chave]
	return r

static func fator_moral(p: ProvinciaC) -> float:
	return 0.3 + 0.7 * (p.moral / 100.0)

func producao_de(p: ProvinciaC) -> Dictionary:
	var pr: Dictionary = Dados.PROD[p.tipo]
	var k := fator_moral(p)
	var inv := 0.6 if tem_regra("inverno") and p.tipo == "campo" else 1.0
	var fab := p.tem_obra("fabrica")
	var r := {"comida": pr["comida"] * k * inv, "mun": (pr["mun"] + (2.0 if fab else 0.0)) * k, "moedas": pr["moedas"] * k, "aco": (pr["aco"] + (1.0 if fab else 0.0)) * k, "comb": (pr["comb"] + (0.5 if fab else 0.0)) * k}
	if tem_regra("escassez"):
		r["mun"] *= 0.5
	if tem_regra("fartura"):
		r["moedas"] *= 1.4
	if p.dono == "jogador":
		for id in reforcos:
			var m: Dictionary = Dados.REFORCOS[id].get("prod", {})
			for chave in m:
				if id == "siderurgia" and chave == "comida" and p.tipo != "campo":
					continue
				r[chave] *= m[chave]
	return r

func renda_de(dono: String, k: String) -> float:
	var r := 0.0
	for p in lista_prov:
		if p.dono == dono:
			r += producao_de(p)[k]
	return r

func bot_sustenta_aco(dono: String, tipo: String) -> bool:
	return Dados.TROPAS[tipo]["manut_aco"] <= 0.0 or renda_de(dono, "aco") - manutencao_de(dono, "manut_aco") >= Dados.TROPAS[tipo]["manut_aco"]

func motivo_sem_recrutar(dono: String, tipo: String, n := 1) -> String:
	var f: Dictionary = fac[dono]
	var T: Dictionary = Dados.TROPAS[tipo]
	if not tropa_liberada(dono, tipo):
		return "tropa ainda não pesquisada"
	if mao_de_obra_livre(dono) < n:
		return "sem mão de obra livre (tome mais terra ou dispense tropa)"
	if f["moedas"] < n * T["custo"]:
		return "faltam moedas"
	if f["aco"] < n * T["aco"]:
		return "falta aço"
	return ""

func recrutar_em(prov_id: String, dono: String, tipo := "inf") -> bool:
	if sem_capital.has(dono):
		return false
	var p: ProvinciaC = prov.get(prov_id)
	if p == null or p.dono != dono or motivo_sem_recrutar(dono, tipo) != "":
		return false
	fac[dono]["moedas"] -= Dados.TROPAS[tipo]["custo"]
	fac[dono]["aco"] -= Dados.TROPAS[tipo]["aco"]
	var achados := parados_em(prov_id, dono)
	var e: ExercitoC = achados[0] if not achados.is_empty() else criar_exercito(dono, prov_id, 0)
	var nome: String = nome_livre() if dono == "jogador" else "Inimigo"
	e.s.append(SoldadoC.new(nome, tipo))
	if dono == "jogador":
		vida.recrutados += 1
	return true

func recrutar(prov_id: String, n := 1, tipo := "inf") -> int:
	var feitos := 0
	while feitos < n and recrutar_em(prov_id, "jogador", tipo):
		feitos += 1
	if feitos:
		tocar("recrutar")
		noticia("%s (%s) em %s." % ["Novo" if feitos == 1 else "%d novos" % feitos, Dados.TROPAS[tipo]["nome"], prov[prov_id].nome])
	if feitos < n:
		var m := motivo_sem_recrutar("jogador", tipo)
		if m != "":
			noticia("Não deu para recrutar: %s." % m)
	return feitos

func dispensar(ex_id: String, n: int, dono := "jogador") -> int:
	var e := ex_por_id(ex_id)
	if e == null or e.dono != dono or e.em_batalha or e.s.is_empty():
		return 0
	n = clampi(n, 1, e.s.size())
	var ordem_fracos: Array = e.s.duplicate()
	ordem_fracos.sort_custom(func(a, b): return a.eficacia() < b.eficacia())
	for i in n:
		_tirar_soldado(e.s, ordem_fracos[i])
	if e.s.is_empty():
		tirar(e)
	if dono == "jogador":
		noticia("%s." % Dados.qtd(n, "soldado dispensado", "soldados dispensados"))
	return n

static func _tirar_soldado(lista: Array, s: SoldadoC) -> void:
	for i in lista.size():
		if is_same(lista[i], s):
			lista.remove_at(i)
			return

func separar(ex_id: String, n := 1) -> ExercitoC:
	var e := ex_por_id(ex_id)
	if e == null or e.dono != "jogador" or e.em_batalha or not e.rota.is_empty() or e.s.size() < 2:
		return null
	n = clampi(n, 1, e.s.size() - 1)
	var fila: Array = e.s.duplicate()
	fila.sort_custom(func(a, b): return a.eficacia() < b.eficacia())
	var saem: Array = []
	for i in n:
		saem.append(fila[i])
		_tirar_soldado(e.s, fila[i])
	return criar_exercito("jogador", e.prov, 0, saem)

func fortificar(id: String, dono := "jogador") -> bool:
	var p: ProvinciaC = prov.get(id)
	var f: Dictionary = fac[dono]
	if p == null or p.dono != dono or f["moedas"] < Dados.FORTIFICAR or f["aco"] < Dados.FORTIFICAR_ACO or p.trinch >= 100.0:
		return false
	f["moedas"] -= Dados.FORTIFICAR
	f["aco"] -= Dados.FORTIFICAR_ACO
	p.trinch = minf(100.0, p.trinch + Dados.FORT_GANHO)
	if dono == "jogador":
		vida.obras_feitas += 1
		noticia("Trincheira de %s reforçada (%d%%)." % [p.nome, roundi(p.trinch)])
	return true

func custo_obra(dono: String, o: String, chave := "custo") -> int:
	return roundi(Dados.OBRAS[o][chave] * (0.5 if tem_regra("industria") and dono == "jogador" else 1.0))

func construir(id: String, o: String, dono := "jogador") -> bool:
	var p: ProvinciaC = prov.get(id)
	var f: Dictionary = fac[dono]
	var custo := custo_obra(dono, o)
	var aco := custo_obra(dono, o, "aco")
	if p == null or p.dono != dono or not p.obra.is_empty() or p.tem_obra(o) or f["moedas"] < custo or f["aco"] < aco:
		return false
	f["moedas"] -= custo
	f["aco"] -= aco
	var tempo: float = Dados.OBRAS[o]["tempo"] * (0.7 if tem_pesq(dono, "concreto") else 1.0)
	if dono == "jogador":
		if reforcos.has("engenharia"):
			tempo *= 0.65
		vida.obras_feitas += 1
		noticia("Obra começou em %s: %s." % [p.nome, Dados.OBRAS[o]["nome"]])
	p.obra = {"id": o, "resta": tempo}
	return true

func pesquisa_disponivel(dono: String, id: String) -> bool:
	if pesq[dono]["feitas"].has(id):
		return false
	for r in Dados.PESQUISAS[id].get("req", []):
		if not pesq[dono]["feitas"].has(r):
			return false
	return true

func pesquisar(id: String, dono := "jogador") -> bool:
	var st: Dictionary = pesq[dono]
	var P: Dictionary = Dados.PESQUISAS[id]
	if not st["atual"].is_empty() or not pesquisa_disponivel(dono, id) or fac[dono]["moedas"] < P["custo"]:
		return false
	fac[dono]["moedas"] -= P["custo"]
	st["atual"] = {"id": id, "resta": P["tempo"]}
	if dono == "jogador":
		noticia("Pesquisa começou: %s." % P["nome"])
	return true

func custo_espiao() -> int:
	return 10 if tem_pesq("jogador", "radio") else Dados.ESPIAO

func espionar(id: String) -> bool:
	var p: ProvinciaC = prov.get(id)
	var f: Dictionary = fac["jogador"]
	if p == null or p.dono == "jogador" or f["moedas"] < custo_espiao() or espioes.size() >= Dados.ESPIAO_MAX:
		return false
	var base: ProvinciaC = null
	for q in minhas():
		if base == null or q.pos.distance_to(p.pos) < base.pos.distance_to(p.pos):
			base = q
	if base == null:
		return false
	f["moedas"] -= custo_espiao()
	espioes.append({"para": id, "pos": base.pos})
	noticia("Espião saiu de %s para %s." % [base.nome, p.nome])
	tocar("espiao")
	return true

# ------------------------------------------------------------ visão
func esta_espiado(dono: String) -> bool:
	return espiado.get(dono, 0.0) > t

func visivel(id: String) -> bool:
	var p: ProvinciaC = prov[id]
	if p.dono == "jogador" or revelado.get(id, 0.0) > t:
		return true
	if _aliado(p.dono):
		return true
	for v in p.viz:
		var q: ProvinciaC = prov[v]
		if q.dono == "jogador" or _aliado(q.dono):
			return true
	return false

func _aliado(d: String) -> bool:
	return rel.has(d) and rel[d]["estado"] == "alianca"

func ex_visivel(e: ExercitoC) -> bool:
	if e.dono == "jogador" or esta_espiado(e.dono) or visivel(e.prov):
		return true
	return not e.rota.is_empty() and visivel(e.rota[0])

# ------------------------------------------------------------ caminhos, ordens e chegada
func caminho(de_id: String, para_id: String, so_de := "") -> Dictionary:
	var dist := {de_id: 0.0}
	var ant := {}
	var aberto := {de_id: true}
	var feito := {}
	while not aberto.is_empty():
		var a := ""
		for id in aberto:
			if a == "" or dist[id] < dist[a]:
				a = id
		aberto.erase(a)
		feito[a] = true
		if a == para_id:
			break
		for b in prov[a].viz:
			if feito.has(b) or (so_de != "" and b != para_id and prov[b].dono != so_de):
				continue
			var d: float = dist[a] + prov[a].pos.distance_to(prov[b].pos)
			if not dist.has(b) or d < dist[b]:
				dist[b] = d
				ant[b] = a
				aberto[b] = true
	if not dist.has(para_id):
		return {}
	var rota: Array = []
	var c := para_id
	while c != de_id:
		rota.push_front(c)
		c = ant[c]
	return {"rota": rota, "dist": dist[para_id]}

func rota_para(e: ExercitoC, destino: String) -> Dictionary:
	var base: String = e.rota[0] if not e.rota.is_empty() else e.prov
	if destino == base:
		return {"rota": [base], "dist": e.pos.distance_to(prov[base].pos)} if not e.rota.is_empty() else {}
	var c := {}
	if prov[destino].dono == e.dono:
		c = caminho(base, destino, e.dono)
	if c.is_empty():
		c = caminho(base, destino)
	if c.is_empty() or e.rota.is_empty():
		return c
	var r: Array = [base]
	r.append_array(c["rota"])
	return {"rota": r, "dist": c["dist"] + e.pos.distance_to(prov[base].pos)}

## devolve o exército que saiu (ou null)
func ordem(ex_id: String, destino: String, qtd := 0, missao := "mover", aptos = null) -> ExercitoC:
	var e := ex_por_id(ex_id)
	if e == null or e.em_batalha or (e.rota.is_empty() and destino == e.prov):
		return null
	var em_marcha := not e.rota.is_empty()
	var c := rota_para(e, destino)
	if c.is_empty():
		return null
	qtd = e.s.size() if em_marcha else clampi(qtd if qtd > 0 else e.s.size(), 1, e.s.size())
	if qtd < e.s.size():
		var fila: Array = (aptos.filter(func(s): return s.vida > 0.0) if aptos != null else e.vivos())
		fila.sort_custom(func(a, b): return a.eficacia() > b.eficacia())
		var vao: Array = fila.slice(0, qtd)
		for s in vao:
			_tirar_soldado(e.s, s)
		e = criar_exercito(e.dono, e.prov, 0, vao)
	e.rota = c["rota"].duplicate()
	e.missao = missao
	e.alertado = false
	if not em_marcha:
		e.origem = e.prov
		e.de = e.prov
	var alvo: ProvinciaC = prov[destino]
	if e.dono == "jogador":
		noticia("%s a caminho de %s com %s." % ["Saque" if missao == "saque" else ("Ataque" if alvo.dono != "jogador" else "Tropa"), alvo.nome, Dados.qtd(e.s.size(), "soldado", "soldados")])
	else:
		_avisar_se_visivel(e)
	return e

func _avisar_se_visivel(e: ExercitoC) -> void:
	if e.alertado or e.dono == "jogador" or e.rota.is_empty():
		return
	var destino: ProvinciaC = prov[e.rota.back()]
	if e.rota.any(func(id): return prov[id].dono == "jogador") and (ex_visivel(e) or esta_espiado(e.dono)):
		e.alertado = true
		noticia("%s marcha com %s sobre %s!" % [nome_de(e.dono), Dados.qtd(e.s.size(), "soldado", "soldados"), destino.nome], true)

func cancelar_marcha(ex_id: String) -> void:
	var e := ex_por_id(ex_id)
	if e and not e.rota.is_empty():
		e.rota = e.rota.slice(0, 1)
		e.missao = "mover"

func vel_ex(e: ExercitoC) -> float:
	var lento := 1.6
	for s in e.s:
		lento = minf(lento, Dados.TROPAS[s.tipo]["vel"])
	var v := Dados.VEL * lento
	if tem_pesq(e.dono, "estradas"):
		v *= 1.2
	v *= bonus_general(e, "vel")
	if chefe_e("lobo", e.dono):
		v *= Dados.LOBO_VEL
	if not e.rota.is_empty():
		var prox: ProvinciaC = prov[e.rota[0]]
		if prox.tem_obra("ferrovia") and prox.dono == e.dono:
			v *= 2.0
	if fac[e.dono]["comb"] <= 0.0 and e.s.any(func(s): return usa_comb(s)):
		v *= Dados.COMB_DEFICIT_VEL
	if e.dono == "jogador":
		for id in reforcos:
			v *= Dados.REFORCOS[id].get("vel", 1.0)
	return v

func _mover(dt: float) -> void:
	for e in ex.duplicate():
		if e.rota.is_empty() or e.em_batalha or not ex.has(e):
			continue
		var alvo: ProvinciaC = prov[e.rota[0]]
		var d: float = e.pos.distance_to(alvo.pos)
		var andado := vel_ex(e) * dt
		if d <= andado:
			e.pos = alvo.pos
			e.de = e.prov
			e.prov = alvo.id
			e.rota.pop_front()
			_chegar_aqui(e, alvo)
		else:
			e.pos = e.pos.move_toward(alvo.pos, andado)
		if e.dono != "jogador" and not e.rota.is_empty():
			_avisar_se_visivel(e)

func _chegar_aqui(e: ExercitoC, p: ProvinciaC) -> void:
	if p.dono != e.dono and not em_guerra(e.dono, p.dono):
		if e.rota.is_empty():
			_parar(e)
		return
	if p.dono != e.dono:
		if e.dono == "jogador" and rel.has(p.dono):
			rel[p.dono]["atacado_em"] = t
		var atual := batalha_em(p.id)
		if atual:
			if e.dono == atual.atq_dono:
				_juntar_ao_ataque(atual, e)
				return
			e.em_batalha = true
			e.aguarda = p.id
			return
		var defs := parados_em(p.id, p.dono)
		if defs.any(func(d): return not d.s.is_empty()):
			abrir_batalha(e, p, defs)
			return
		if e.missao == "saque":
			_saquear(e, p)
			return
		conquistar(p, e.dono, e)
	if e.rota.is_empty():
		_parar(e)

func batalha_em(prov_id: String) -> BatalhaC:
	for b in batalhas:
		if b.alvo.id == prov_id and not b.terminou:
			return b
	return null

func criar_batalha(e: ExercitoC, p: ProvinciaC, defs: Array) -> BatalhaC:
	var b := BatalhaC.new()
	b.j = self; b.ex = e; b.alvo = p; b.defensores = defs.duplicate(); b.atq_dono = e.dono; b.def_dono = p.dono; b.saque = e.missao == "saque"
	var n := e.s.size()
	for i in n:
		b.atq.append(BatalhaC.entrada(e.s[i], Dados.DIST + rng.randf() * 25.0, 30.0 + (i + 0.5) * (340.0 / n), "atq"))
	var def_s: Array = []
	for d in defs:
		def_s.append_array(d.vivos())
	for i in def_s.size():
		b.def.append(BatalhaC.entrada(def_s[i], 0.0, 50.0 + i * (300.0 / maxf(1.0, def_s.size() - 1)), "def"))
	b.gen_atq = bonus_general(e, "atq")
	for d in defs:
		b.gen_def = maxf(b.gen_def, bonus_general(d, "def"))
	if chefe_e("ferro", b.def_dono):
		b.gen_def *= Dados.FERRO_DEFESA
	b.ef_atq = stack_efic(n)
	b.ef_def = stack_efic(def_s.size())
	b.forte = 1.25 * (1.15 if tem_pesq(p.dono, "concreto") else 1.0) if p.tem_obra("forte") else 1.0
	var todos: Array = [e]
	todos.append_array(defs)
	for x in todos:
		if bonus_general(x, "art") > 1.0:
			for c in (b.def if is_same(x, e) else b.atq):
				c.s.vida -= 25.0
	return b

func abrir_batalha(e: ExercitoC, p: ProvinciaC, defs: Array) -> BatalhaC:
	var b := criar_batalha(e, p, defs)
	e.em_batalha = true
	for d in defs:
		d.em_batalha = true
	b.audivel = e.dono == "jogador" or p.dono == "jogador"
	batalhas.append(b)
	if extras:
		vida.ao_abrir_batalha(e, p)
	if b.audivel and batalha_rapida:
		resolver_agora(b)
		return b
	if e.dono == "jogador":
		noticia("%s %s (%d defendendo)." % [Dados.qtd(e.s.size(), "soldado seu ataca", "soldados seus atacam"), p.nome, b.def.size()])
	elif p.dono == "jogador":
		noticia("%s ataca %s com %s!" % [nome_de(e.dono), p.nome, Dados.qtd(e.s.size(), "soldado", "soldados")], true)
	return b

func resolver_agora(b: BatalhaC) -> bool:
	if b == null or b.terminou or fim != "":
		return false
	b.audivel = false
	var i := 0
	while i < 1500 and not b.terminou:
		b.passo(0.2)
		i += 1
	return b.terminou

func _juntar_ao_ataque(b: BatalhaC, e: ExercitoC) -> void:
	for s in e.s:
		b.ex.s.append(s)
		b.atq.append(BatalhaC.entrada(s, Dados.DIST + rng.randf() * 25.0, 30.0 + rng.randf() * 340.0, "atq"))
	e.s = []
	tirar(e)
	if b.atq_dono == "jogador":
		noticia("Reforço chegou à batalha de %s." % b.alvo.nome)

func _parar(e: ExercitoC) -> void:
	if e.missao == "voltar":
		e.missao = "mover"
	var bt := batalha_em(e.prov)
	if bt and bt.def_dono == e.dono and not e.em_batalha:
		e.em_batalha = true
		bt.defensores.append(e)
		for s in e.s:
			bt.def.append(BatalhaC.entrada(s, 0.0, 30.0 + rng.randf() * 340.0, "def"))
		if e.dono == "jogador":
			noticia("Reforço chegou à defesa de %s." % bt.alvo.nome)
		return
	for outro in parados_em(e.prov, e.dono):
		if not is_same(outro, e):
			outro.s.append_array(e.s)
			e.s = []
			tirar(e)
			return

func _saquear(e: ExercitoC, p: ProvinciaC) -> void:
	var roubo := 0.0
	if p.dono != "neutro":
		roubo = floorf(fac[p.dono]["moedas"] * Dados.SAQUE_PARTE)
		fac[p.dono]["moedas"] -= roubo
		fac[e.dono]["moedas"] += roubo
	if e.dono == "jogador" or p.dono == "jogador" or esta_espiado(e.dono):
		noticia("%s saqueou %s: %s." % [nome_de(e.dono), p.nome, Dados.qtd(int(roubo), "moeda", "moedas")], p.dono == "jogador")
	var volta := caminho(e.prov, e.origem)
	e.rota = volta["rota"] if not volta.is_empty() and prov[e.origem].dono == e.dono else []
	e.missao = "voltar"
	if e.rota.is_empty():
		_parar(e)

func conquistar(p: ProvinciaC, dono: String, e: ExercitoC = null) -> void:
	var antigo := p.dono
	if dono == "jogador" and chefe_id != "" and p.capital and p.capital_de == chefe_dono:
		_chefe_caiu()
	p.dono = dono; p.trinch = 20.0; p.moral = 30.0; p.conquistada_em = t; p.obra = {}; p.obras["forte"] = false
	if antigo == "jogador":
		stats["perdidas"] += 1
	var ver := dono == "jogador" or antigo == "jogador" or visivel(p.id) or esta_espiado(dono)
	if antigo != "neutro":
		var parte := 0.5 if p.capital else 0.15
		for k in ["moedas", "comida", "aco"]:
			var v := floorf(fac[antigo][k] * parte)
			fac[antigo][k] -= v
			fac[dono][k] += v
	if e:
		for i in (2 if p.tipo == "cidade" or p.capital else 1):
			e.s.append(SoldadoC.new("Recruta" if dono == "jogador" else "Inimigo"))
	if dono == "jogador":
		tocar("conquista")
	elif antigo == "jogador":
		tocar("perda")
	if ver:
		noticia("%s conquistou %s%s." % [nome_de(dono), p.nome, "" if antigo == "neutro" else " de " + nome_de(antigo)], antigo == "jogador")
		conquista_feita.emit(p.id, dono, antigo)
	if extras:
		vida.ao_conquistar(p, dono, antigo)
	if p.capital and antigo != "neutro" and p.capital_de == antigo:
		if antigo == "jogador":
			terminar("derrota")
			return
		_deixar_sem_capital(antigo, dono)
	verificar_fim()

func _deixar_sem_capital(bot: String, por: String) -> void:
	sem_capital[bot] = true
	for e in ex_de(bot):
		var corta := ceili(e.s.size() * 0.4)
		e.s = e.s.slice(corta)
	for q in prov_de(bot):
		q.moral = maxf(5.0, q.moral - 25.0)
	_limpar_mortos()
	noticia("%s perdeu a capital para %s: não recruta mais e produz metade." % [nome_de(bot), nome_de(por)], por == "jogador")

func _verificar_sem_capital() -> void:
	for b in sem_capital:
		if not eliminados.has(b) and (prov_de(b).is_empty() or tropa_de(b) == 0):
			eliminar(b, "jogador")

func eliminar(bot: String, por: String) -> void:
	eliminados[bot] = true
	ex = ex.filter(func(x): return x.dono != bot)
	for q in prov_de(bot):
		q.dono = "neutro"
		q.trinch = 30.0
		criar_exercito("neutro", q.id, 2)
	noticia("%s foi eliminado por %s." % [nome_de(bot), nome_de(por)], por == "jogador")

func verificar_fim() -> void:
	if fim != "":
		return
	if prov[capital_jogador].dono != "jogador":
		terminar("derrota")
	elif fase["bots"].all(func(b): return eliminados.has(b)):
		terminar("vitoria")

func terminar(como: String) -> void:
	if fim != "":
		return
	fim = como
	acabou.emit()

func venceu() -> bool:
	return fim in ["vitoria", "pontos", "dominio"]

func objetivo_ok() -> bool:
	match fase["objetivo"]:
		"semPerder": return stats["perdidas"] == 0
		"capitais": return fim == "vitoria" or capitais_tomadas() >= Dados.CAPITAIS_DA_ESTRELA
		"baixas": return stats["baixas"] < 20
		"rebeldes": return stats["revoltas"] == 0
		"pesquisa": return pesq["jogador"]["feitas"].size() >= 4
	return false

## capitais inimigas que estão com você agora
func capitais_tomadas() -> int:
	return lista_prov.filter(func(p): return p.capital and p.capital_de != "jogador" and p.dono == "jogador").size()

func calcular_estrelas() -> int:
	if not venceu():
		return 0
	var e := 1
	if t <= fase["tempo"] * 0.7 and fim != "pontos":
		e += 1
	if objetivo_ok():
		e += 1
	return e

func _concluir_batalha(b: BatalhaC) -> void:
	var minha := b.atq_dono == "jogador" or b.def_dono == "jogador"
	var destaque := {}
	var promovidos: Array = []
	var perdidos: Array = []
	for lado in ["atq", "def"]:
		var dono := b.dono_do_lado(lado)
		for c in b.lista(lado):
			var s: SoldadoC = c.s
			if dono == "jogador" and s.abates > stats.get("melhor_n", 0):
				stats["melhor_n"] = s.abates
				stats["melhor_nome"] = s.nome
			if s.vida <= 0.0:
				if dono == "jogador" and s.patente() > 0:
					perdidos.append(s.nome)
				if dono == "jogador" and (s.patente() > 0 or s.abates >= 2):
					memorial.append({"nome": s.nome, "tipo": s.tipo, "lutas": s.lutas + 1, "abates": s.abates, "patente": s.patente(), "onde": b.alvo.nome, "t": int(t)})
				continue
			var antes := s.patente()
			s.lutas += 1
			if dono == "jogador":
				var venceu_aqui: bool = b.vencedor == lado
				s.registrar("%s em %s%s" % ["Venceu" if venceu_aqui else "Sobreviveu", b.alvo.nome, " com %s" % Dados.qtd(c.abates_luta, "abate", "abates") if c.abates_luta > 0 else ""])
				if s.patente() != antes:
					if s.nome == "Recruta" or s.nome == "Voluntário":
						s.nome = nome_livre()
					s.registrar("Virou %s em %s" % ["elite" if s.patente() == 2 else "veterano", b.alvo.nome])
					promovidos.append(("★★ " if s.patente() == 2 else "★ ") + s.nome)
				if c.abates_luta > 0 and (destaque.is_empty() or c.abates_luta > destaque["n"]):
					destaque = {"nome": s.nome, "n": c.abates_luta}
	var antes_f: Dictionary = fac["jogador"].duplicate()
	var venci := (b.atq_dono == "jogador" and b.vencedor == "atq") or (b.def_dono == "jogador" and b.vencedor == "def")
	if venci:
		vida.vitorias += 1
	_resolver_fim_da_batalha(b)
	if minha and fim == "":
		var ganho := {}
		for k in ["moedas", "comida", "aco"]:
			var d := floori(fac["jogador"][k] - antes_f[k])
			if d > 0:
				ganho[k] = d
		var sou_atq := b.atq_dono == "jogador"
		var perdas := func(l: Array) -> int: return l.filter(func(c): return c.s.vida <= 0.0).size()
		batalha_resolvida.emit({"prov": b.alvo.id, "nome": b.alvo.nome, "venci": venci, "atacando": sou_atq,
			"meus": perdas.call(b.atq if sou_atq else b.def), "deles": perdas.call(b.def if sou_atq else b.atq),
			"destaque": destaque, "promovidos": promovidos, "perdidos": perdidos, "ganho": ganho})

func _resolver_fim_da_batalha(b: BatalhaC) -> void:
	var e := b.ex
	var p := b.alvo
	e.em_batalha = false
	if b.atq_dono == "jogador":
		stats["baixas"] += b.atq.filter(func(c): return c.s.vida <= 0.0).size()
	if b.def_dono == "jogador":
		stats["baixas"] += b.def.filter(func(c): return c.s.vida <= 0.0).size()
	if b.atq_dono == "jogador" or b.def_dono == "jogador":
		var deles: Array = b.def if b.atq_dono == "jogador" else b.atq
		stats["inimigos"] = stats.get("inimigos", 0) + deles.filter(func(c): return c.s.vida <= 0.0).size()
		if b.usou_art:
			stats["art"] = stats.get("art", 0) + 1
	if b.vencedor == "atq":
		_general_venceu(e)
		for d in b.defensores:
			if d.vivos().is_empty():
				_general_caiu(d)
	else:
		for d in b.defensores:
			_general_venceu(d)
		if e.vivos().is_empty():
			_general_caiu(e)
	e.s = e.vivos()
	for s in e.s:
		s.cansaco = minf(100.0, s.cansaco + 30.0)
	for d in b.defensores:
		d.s = d.vivos()
		for s in d.s:
			s.cansaco = minf(100.0, s.cansaco + 20.0)
	ex = ex.filter(func(x): return not x.s.is_empty() or is_same(x, e))
	if b.vencedor == "atq" and not e.s.is_empty():
		if p.dono != b.def_dono:
			if e.rota.is_empty():
				if p.dono != e.dono and em_guerra(e.dono, p.dono):
					_chegar_aqui(e, p)
				else:
					_parar(e)
			return
		if b.saque:
			_saquear(e, p)
			return
		conquistar(p, e.dono, e)
		if e.rota.is_empty() and ex.has(e):
			_parar(e)
	else:
		if b.atq_dono == "jogador" or b.def_dono == "jogador" or visivel(p.id):
			noticia("%s segurou %s contra %s%s." % [nome_de(b.def_dono), p.nome, nome_de(b.atq_dono), " (recuaram)" if b.recuou else (" (o tempo acabou)" if b.por_tempo else "")], b.atq_dono == "jogador")
		_recuar_sobreviventes(e, p)
	_limpar_mortos()

func _destino_do_recuo(e: ExercitoC, p: ProvinciaC) -> ProvinciaC:
	var veio: ProvinciaC = prov.get(e.de) if e.de != p.id else null
	if veio and veio.dono == e.dono:
		return veio
	for v in p.viz:
		if prov[v].dono == e.dono:
			return prov[v]
	if veio and not em_guerra(e.dono, veio.dono):
		return veio
	for v in p.viz:
		if not em_guerra(e.dono, prov[v].dono):
			return prov[v]
	return null

func _recuar_sobreviventes(e: ExercitoC, p: ProvinciaC) -> void:
	var destino: ProvinciaC = _destino_do_recuo(e, p) if not e.s.is_empty() else null
	if destino == null:
		tirar(e)
		if not e.s.is_empty() and e.dono == "jogador":
			noticia("Tropa cercada em %s: %s." % [p.nome, "o último sobrevivente se perdeu" if e.s.size() == 1 else "os %d sobreviventes se perderam" % e.s.size()], true)
		return
	if destino.id != e.de and e.dono == "jogador":
		noticia("Os sobreviventes de %s recuaram para %s." % [p.nome, destino.nome])
	e.pos = destino.pos; e.prov = destino.id; e.rota = []; e.missao = "mover"
	_parar(e)

func _limpar_mortos() -> void:
	for e in ex:
		e.s = e.vivos()
	ex = ex.filter(func(e): return not e.s.is_empty() or e.em_batalha)

func _avancar_batalhas(dt: float) -> void:
	var l := batalhas.duplicate()
	for b in l:
		if not b.terminou:
			b.passo(dt * Dados.BAT_RITMO)
	for b in l:
		if not b.terminou:
			continue
		batalhas.erase(b)
		_concluir_batalha(b)
		for d in b.defensores:
			if ex.has(d):
				d.em_batalha = false
				if not d.s.is_empty():
					_parar(d)
		for x in ex.duplicate():
			if x.aguarda == b.alvo.id:
				x.em_batalha = false
				x.aguarda = ""
				_chegar_aqui(x, b.alvo)

func _resolver_confrontos() -> void:
	var por_prov := {}
	for e in ex:
		if e.parado() and not e.s.is_empty():
			if not por_prov.has(e.prov):
				por_prov[e.prov] = []
			por_prov[e.prov].append(e)
	for id in por_prov:
		var l: Array = por_prov[id]
		var p: ProvinciaC = prov[id]
		if batalha_em(id):
			continue
		var hostil := func(a, b) -> bool: return a.dono != b.dono and em_guerra(a.dono, b.dono)
		var atacante: ExercitoC = null
		for a in l:
			if a.dono != p.dono and l.any(func(d): return hostil.call(a, d)):
				atacante = a
				break
		if atacante == null:
			for a in l:
				if l.any(func(d): return hostil.call(a, d)):
					atacante = a
					break
		if atacante:
			abrir_batalha(atacante, p, l.filter(func(d): return not is_same(d, atacante) and hostil.call(atacante, d)))
			continue
		for a in l:
			if a.dono != "neutro" and a.dono != "jogador" and a.dono != p.dono and a.missao != "saque" and em_guerra(a.dono, p.dono) and not l.any(func(d): return d.dono == p.dono):
				conquistar(p, a.dono, a)
				break

# ------------------------------------------------------------ ciclo da economia
func abastecido(e: ExercitoC) -> bool:
	var p: ProvinciaC = prov[e.prov]
	if e.dono == "neutro":
		return true
	var amigo := func(q: ProvinciaC) -> bool:
		return q.dono == e.dono or (e.dono == "jogador" and _aliado(q.dono)) or (q.dono == "jogador" and _aliado(e.dono))
	if amigo.call(p):
		return true
	for v in p.viz:
		if amigo.call(prov[v]):
			return true
	return false

## marca (ou tira, com "") para onde vão os soldados recrutados sozinhos
func marcar_reuniao(id: String) -> void:
	if id != "" and (not prov.has(id) or prov[id].dono != "jogador"):
		return
	reuniao = id
	auto_fila = 0
	noticia("Ponto de reunião em %s: os recrutas automáticos vão para lá." % prov[id].nome if id != "" else "Ponto de reunião removido.")

## recruta na capital enquanto sobrar a reserva de moedas e houver comida
func _recrutar_sozinho() -> void:
	if not auto_rec["ligado"]:
		return
	var tipo: String = auto_rec["tipo"]
	var f: Dictionary = fac["jogador"]
	if f["moedas"] - Dados.TROPAS[tipo]["custo"] < float(auto_rec["reserva"]) or f["comida"] < tropa_de("jogador"):
		return
	if recrutar_em(capital_jogador, "jogador", tipo) and reuniao != "" and reuniao != capital_jogador:
		auto_fila += 1

func _enviar_recrutas() -> void:
	if reuniao == "" or auto_fila < LOTE_REUNIAO:
		return
	if prov[reuniao].dono != "jogador":
		noticia("O ponto de reunião em %s foi perdido." % prov[reuniao].nome, true)
		reuniao = ""
		auto_fila = 0
		return
	# só marcha por dentro do seu território, para não atacar ninguém sem querer
	if caminho(capital_jogador, reuniao, "jogador").is_empty():
		return
	var achados := parados_em(capital_jogador, "jogador").filter(func(x): return not x.em_batalha)
	if achados.is_empty():
		return
	var e: ExercitoC = achados[0]
	var n := mini(auto_fila, e.s.size())
	var novos: Array = e.s.slice(e.s.size() - n)
	if ordem(e.id, reuniao, n, "mover", novos):
		auto_fila = 0

func ciclo_economia() -> void:
	ciclo += 1
	for p in lista_prov:
		if p.dono == "neutro":
			continue
		var f: Dictionary = fac[p.dono]
		var pd := producao_de(p)
		if sem_capital.has(p.dono):
			for k in pd:
				pd[k] *= 0.5
		var bot: float = difc()["prod"] if pensar.has(p.dono) else 1.0
		f["comida"] += pd["comida"] * bot
		var renda: float = difc()["renda"] if pensar.has(p.dono) else 1.0
		for k in ["mun", "moedas", "aco", "comb"]:
			f[k] += pd[k] * (renda if k == "mun" or k == "moedas" else 1.0)
		var base := Dados.TRINCH_CAPITAL if p.capital else Dados.TRINCH_BASE
		if p.trinch < base:
			p.trinch = minf(base, p.trinch + 2.0)
	var ativos: Array = fac.keys().filter(func(d): return d != "neutro" and (d == "jogador" or not eliminados.has(d)))
	for dono in ativos:
		var f: Dictionary = fac[dono]
		var gasto := 0.0
		for e in ex_de(dono):
			if not e.rota.is_empty() or e.em_batalha:
				gasto += gasto_comb(e.s)
		f["comb"] = maxf(0.0, f["comb"] - gasto)
		f["comb_gasto"] = gasto
		var aco_gasto := manutencao_de(dono, "manut_aco")
		var falta: bool = aco_gasto > 0.0 and f["aco"] < aco_gasto - 0.000001
		if falta and not f["falta_aco"] and dono == "jogador":
			noticia("Falta de aço! Artilharia e blindados não se curam e causam menos dano.", true)
		f["aco"] = maxf(0.0, f["aco"] - aco_gasto)
		f["falta_aco"] = falta
	for dono in ativos:
		var f: Dictionary = fac[dono]
		var custo := manutencao_de(dono)
		if custo > 0.0 and f["moedas"] < custo:
			f["moedas"] = 0.0
			f["atraso"] = minf(100.0, f["atraso"] + Dados.ATRASO_SOBE)
		else:
			f["moedas"] -= custo
			f["atraso"] = maxf(0.0, f["atraso"] - Dados.ATRASO_DESCE)
		for e in ex_de(dono):
			for s in e.s:
				s.soldo = f["atraso"]
		if f["atraso"] >= Dados.ATRASO_DESERTA:
			var foram := 0
			for e in ex_de(dono):
				var antes: int = e.s.size()
				if not e.em_batalha:
					e.s = e.s.filter(func(_s): return rng.randf() > 0.06)
				foram += antes - e.s.size()
			if foram and dono == "jogador":
				noticia("%s por falta de pagamento!" % Dados.qtd(foram, "soldado desertou", "soldados desertaram"), true)
	for dono in fac:
		if dono == "neutro":
			continue
		var f: Dictionary = fac[dono]
		var esquece: bool = dono != "jogador" and rng.randf() < Dados.FACCOES[dono]["esquece"]
		var porcao := 0.7 if tem_pesq(dono, "racoes") else 1.0
		for e in ex_de(dono):
			var sup := abastecido(e)
			var logi := bonus_general(e, "log") > 1.0
			var hosp: bool = e.parado() and prov[e.prov].tem_obra("hospital") and prov[e.prov].dono == dono
			var cura := (12.0 if hosp else 3.0) * (2.0 if tem_pesq(dono, "medicina") else 1.0)
			e.sem_suprimento = not sup
			for s in e.s:
				s.fome = minf(100.0, s.fome + Dados.FOME_CICLO * (0.5 if logi else 1.0) + (0.0 if sup or logi else 5.0))
				var come := porcao * (0.5 if logi else 1.0)
				if not esquece and (sup or logi) and s.fome >= Dados.COME_SE and f["comida"] >= come:
					f["comida"] -= come
					s.fome = maxf(0.0, s.fome - Dados.COME_ALIVIA)
				if s.fome >= 90.0:
					s.vida -= 4.0
				elif s.fome < 50.0 and fator_falta_aco(s, dono) == 1.0:
					s.vida = minf(s.vida_max(), s.vida + cura)
				s.cansaco = maxf(0.0, s.cansaco - 6.0)
	_atualizar_moral()
	for b in fase["bots"]:
		_pensar_diplomacia(b)
	_limpar_mortos()
	_verificar_sem_capital()
	verificar_fim()

func _passos_ate_capital(p: ProvinciaC) -> int:
	var cap: ProvinciaC = null
	for q in lista_prov:
		if q.capital and q.dono == p.dono:
			cap = q
			break
	if cap == null:
		return 6
	var vis := {cap.id: true}
	var fila: Array = [cap.id]
	var d := 0
	while not fila.is_empty() and d < 8:
		if fila.has(p.id):
			return d
		var prox: Array = []
		for id in fila:
			for v in prov[id].viz:
				if not vis.has(v):
					vis[v] = true
					prox.append(v)
		fila = prox
		d += 1
	return 8

func _atualizar_moral() -> void:
	for p in lista_prov:
		if p.dono == "neutro":
			p.moral = 60.0
			continue
		var alvo := 100.0 - 9.0 * _passos_ate_capital(p)
		if ex.any(func(e): return e.dono != p.dono and e.dono != "neutro" and em_guerra(e.dono, p.dono) and (e.prov == p.id or p.viz.has(e.prov))):
			alvo -= 20.0
		if t - p.conquistada_em < 90.0:
			alvo -= 30.0
		if p.tem_obra("forte"):
			alvo += 10.0
		if tem_pesq(p.dono, "propaganda"):
			alvo += 15.0
		if fac[p.dono]["comida"] <= 0.0:
			alvo -= 15.0
		if fac[p.dono]["atraso"] >= 40.0:
			alvo -= 15.0
		if sem_capital.has(p.dono):
			alvo -= 40.0
		if p.capital:
			alvo = maxf(alvo, 90.0)
		alvo = clampf(alvo, 5.0, 100.0)
		p.moral += (alvo - p.moral) * 0.2
		if not p.capital and p.moral < 28.0 and rng.randf() < 0.06:
			var guarda := 0
			for e in parados_em(p.id, p.dono):
				guarda += e.s.size()
			if guarda >= 3:
				continue
			var antigo: String = p.dono
			ex = ex.filter(func(e): return not (e.prov == p.id and e.dono == antigo and e.parado()))
			p.dono = "neutro"; p.obra = {}; p.moral = 60.0; p.trinch = Dados.TRINCH_BASE
			criar_exercito("neutro", p.id, 0, [SoldadoC.new("Rebelde"), SoldadoC.new("Rebelde"), SoldadoC.new("Rebelde")])
			if antigo == "jogador":
				stats["revoltas"] += 1
				noticia("%s se revoltou (moral baixa) e virou terra de milícia!" % p.nome, true)
			verificar_fim()

# ------------------------------------------------------------ diplomacia
func em_guerra(a: String, b: String) -> bool:
	if a == b or a == "neutro" or b == "neutro":
		return a != b
	var bot := b if a == "jogador" else (a if b == "jogador" else "")
	if bot == "":
		return true
	return not rel.has(bot) or rel[bot]["estado"] == "guerra"

func custo_paz(bot: String) -> int:
	return 20 + 4 * int(placar().get(bot, 0))

func chance_aceitar(bot: String, tipo: String) -> float:
	var perso: String = Dados.FACCOES[bot]["perso"]
	var pl := placar()
	var meu: int = pl.get("jogador", 0)
	var dele: int = pl.get(bot, 0)
	var ch: float = {"agressivo": 0.2, "ladrão": 0.45, "defensivo": 0.65, "oportunista": 0.35}.get(perso, 0.4)
	if tipo == "alianca":
		ch -= 0.15
	if meu > dele:
		ch += 0.2
	if t - rel[bot]["atacado_em"] < 60.0:
		ch -= 0.4
	var maior := 0
	for b in fase["bots"]:
		if b != bot and not eliminados.has(b):
			maior = maxi(maior, pl.get(b, 0))
	if tipo == "alianca" and maior > dele:
		ch += 0.25
	return clampf(ch, 0.05, 0.9)

func propor(bot: String, tipo: String) -> bool:
	if not rel.has(bot) or eliminados.has(bot) or t < rel[bot]["recusa_ate"]:
		return false
	var r: Dictionary = rel[bot]
	if (tipo == "alianca" and r["estado"] != "paz") or (tipo == "paz" and r["estado"] != "guerra"):
		return false
	var custo := custo_paz(bot) if tipo == "paz" else 0
	if fac["jogador"]["moedas"] < custo:
		return false
	fac["jogador"]["moedas"] -= custo
	if rng.randf() < chance_aceitar(bot, tipo) + (0.1 if Dados.FACCOES[bot]["perso"] == "ladrão" else 0.0):
		r["estado"] = tipo
		r["ate"] = t + 240.0 if tipo == "paz" else 0.0
		fac[bot]["moedas"] += custo
		noticia("%s aceitou %s." % [nome_de(bot), "a paz por 4 minutos" if tipo == "paz" else "a aliança"])
	else:
		r["recusa_ate"] = t + 45.0
		fac["jogador"]["moedas"] += int(custo / 2.0)
		noticia("%s recusou. Tente de novo em 45 s." % nome_de(bot))
	return true

func declarar_guerra(bot: String, pelo_bot := false) -> void:
	if not rel.has(bot) or rel[bot]["estado"] == "guerra":
		return
	rel[bot]["estado"] = "guerra"
	rel[bot]["ate"] = 0.0
	if pelo_bot:
		noticia("%s rompeu o acordo e declarou guerra!" % nome_de(bot), true)
	else:
		noticia("Você declarou guerra a %s." % nome_de(bot))
	_resolver_ocupacoes()

func _resolver_ocupacoes() -> void:
	for e in ex.duplicate():
		if not ex.has(e) or not e.parado() or e.dono == "neutro":
			continue
		var p: ProvinciaC = prov[e.prov]
		if p.dono != e.dono and em_guerra(e.dono, p.dono):
			_chegar_aqui(e, p)

func _pensar_diplomacia(bot: String) -> void:
	if not rel.has(bot):
		return
	var r: Dictionary = rel[bot]
	if r["estado"] == "paz" and t >= r["ate"]:
		r["estado"] = "guerra"
		noticia("A paz com %s acabou." % nome_de(bot), true)
		_resolver_ocupacoes()
		return
	if r["estado"] != "guerra" and Dados.FACCOES[bot]["perso"] in ["agressivo", "oportunista"]:
		var fraca := minhas().any(func(p): return p.viz.any(func(v): return prov[v].dono == bot) and BotsC.defesa_em(self, p) < 2.0)
		if fraca and rng.randf() < 0.05:
			declarar_guerra(bot, true)

# ------------------------------------------------------------ generais
func bonus_general(e: ExercitoC, hab: String) -> float:
	if e == null or e.general == "":
		return 1.0
	if e.dono != "jogador":
		return 1.12 if hab == "atq" or hab == "def" else 1.0
	for g in Dados.GENERAIS:
		if g["id"] == e.general and g["hab"] == hab:
			var nv := CampanhaC.nivel_general(campanha.xp_general(g["id"]) + gen_xp.get(g["id"], 0))
			var base: float = {"atq": 0.2, "def": 0.25, "vel": 0.35, "log": 0.5, "art": 1.0}[hab]
			return 1.0 + base * (1.0 + 0.15 * (nv - 1))
	return 1.0

func designar_general(ex_id: String, gen: String) -> void:
	var e := ex_por_id(ex_id)
	if e == null or e.dono != "jogador" or gen_ferido.get(gen, 0.0) > t:
		return
	if gen != "":
		for x in ex:
			if x.general == gen:
				x.general = ""
	e.general = gen

func gerais_dos_bots() -> void:
	for b in fase["bots"]:
		if not pensar.has(b):
			continue
		var maior: ExercitoC = null
		for e in ex_de(b):
			e.general = ""
			if maior == null or e.s.size() > maior.s.size():
				maior = e
		if maior:
			maior.general = "bot"

func _general_venceu(e: ExercitoC) -> void:
	if e.dono == "jogador" and e.general != "":
		gen_xp[e.general] = gen_xp.get(e.general, 0) + 1

func _general_caiu(e: ExercitoC) -> void:
	if e.dono == "jogador" and e.general != "":
		gen_ferido[e.general] = t + 60.0
		noticia("Seu general foi ferido e volta em 60 s.", true)
		e.general = ""

# ------------------------------------------------------------ tempo
func passo(dt: float) -> void:
	if fim != "":
		return
	t += dt
	if t >= fase["tempo"]:
		_fim_por_tempo()
		return
	if floori(t / Dados.CICLO) > ciclo:
		ciclo_economia()
		_recrutar_sozinho()
		_enviar_recrutas()
		historico.append([int(t), placar()])
		if ciclo % 4 == 0:
			gerais_dos_bots()
	if fim != "":
		return
	for p in lista_prov:
		if p.obra.is_empty():
			continue
		if p.dono == "neutro":
			p.obra = {}
			continue
		p.obra["resta"] -= dt
		if p.obra["resta"] <= 0.0:
			var o: String = p.obra["id"]
			p.obras[o] = true
			if o == "forte":
				p.trinch = maxf(p.trinch, 80.0)
			if p.dono == "jogador":
				noticia("%s pronto em %s." % [Dados.OBRAS[o]["nome"], p.nome])
			p.obra = {}
	for dono in pesq:
		var st: Dictionary = pesq[dono]
		if st["atual"].is_empty():
			continue
		st["atual"]["resta"] -= dt
		if st["atual"]["resta"] <= 0.0:
			var id: String = st["atual"]["id"]
			st["feitas"][id] = true
			st["atual"] = {}
			if dono == "jogador":
				noticia("Pesquisa pronta: %s." % Dados.PESQUISAS[id]["nome"])
				tocar("conquista")
	for dono in pensar.keys():
		if not pensar.has(dono):
			continue
		pensar[dono] -= dt
		if pensar[dono] <= 0.0:
			pensar[dono] = Dados.BOT_PENSA + rng.randf() * Dados.BOT_PENSA_VAR
			BotsC.pensar_bot(self, dono)
		if fim != "":
			return
	_mover(dt)
	if fim != "":
		return
	_avancar_batalhas(dt)
	if fim != "":
		return
	conf_t += dt
	if conf_t >= 1.0:
		conf_t = 0.0
		_resolver_confrontos()
	if fim != "":
		return
	if extras:
		vida.passo()
	if fim != "":
		return
	var chegaram: Array = []
	for s in espioes:
		var p: ProvinciaC = prov[s["para"]]
		s["pos"] = s["pos"].move_toward(p.pos, Dados.ESPIAO_VEL * dt)
		if s["pos"].distance_to(p.pos) < 0.5:
			chegaram.append(s)
	for s in chegaram:
		espioes.erase(s)
		_relatorio_espiao(prov[s["para"]])

func _relatorio_espiao(p: ProvinciaC) -> void:
	var ate := t + Dados.ESPIAO_DURA
	revelado[p.id] = ate
	for v in p.viz:
		revelado[v] = maxf(revelado.get(v, 0.0), ate)
	var txt := "Espião em %s: " % p.nome
	if p.dono == "neutro":
		var n := 0
		for e in parados_em(p.id, "neutro"):
			n += e.s.size()
		txt += "milícia com %s, trincheira %d%%." % [Dados.qtd(n, "homem", "homens"), roundi(p.trinch)]
	else:
		espiado[p.dono] = ate
		txt += "%s tem %s e %s." % [nome_de(p.dono), Dados.qtd(tropa_de(p.dono), "soldado", "soldados"), Dados.qtd(int(fac[p.dono]["moedas"]), "moeda", "moedas")]
	noticia(txt)
	tocar("espiao")

func _fim_por_tempo() -> void:
	var pl := placar()
	var melhor := 0
	for b in fase["bots"]:
		melhor = maxi(melhor, pl.get(b, 0))
	terminar("pontos" if pl.get("jogador", 0) > melhor else "tempo")

# ------------------------------------------------------------ salvar e carregar
func salvar() -> Dictionary:
	var ps := {}
	for p in lista_prov:
		ps[p.id] = p.salvar()
	var esp := espioes.map(func(s): return {"para": s["para"], "x": s["pos"].x, "y": s["pos"].y})
	return {"v": 1, "fase": fase["n"], "t": t, "ciclo": ciclo, "velocidade": velocidade, "prox_id": prox_id, "fac": fac.duplicate(true), "pesq": pesq.duplicate(true), "rel": rel.duplicate(true),
		"gen_ferido": gen_ferido.duplicate(), "gen_xp": gen_xp.duplicate(), "stats": stats.duplicate(), "capital_jogador": capital_jogador, "espiado": espiado.duplicate(), "revelado": revelado.duplicate(),
		"espioes": esp, "ultimo_ataque": ultimo_ataque.duplicate(), "eliminados": eliminados.duplicate(), "sem_capital": sem_capital.duplicate(), "pensar": pensar.duplicate(), "noticias": noticias.slice(0, 10),
		"prov": ps, "ex": ex.map(func(e): return e.salvar()), "batalhas": batalhas.filter(func(b): return not b.terminou and ex.has(b.ex)).map(func(b): return b.salvar()),
		"vida": vida.salvar(), "reforcos": reforcos.duplicate(),
		"reuniao": reuniao, "auto_rec": auto_rec.duplicate(), "auto_fila": auto_fila, "historico": historico.duplicate(true), "origem": origem.duplicate(true), "memorial": memorial.duplicate(true), "chefe_id": chefe_id, "chefe_dono": chefe_dono}

func carregar(d: Dictionary) -> bool:
	if d.get("v", 0) != 1:
		return false
	if d.get("origem", {}).is_empty():
		novo(int(d["fase"]))
	else:
		novo_de_origem(d["origem"])
	for id in d["prov"]:
		prov[id].carregar(d["prov"][id])
	t = d["t"]; ciclo = int(d["ciclo"]); velocidade = int(d["velocidade"]); fac = d["fac"].duplicate(true); pesq = d["pesq"].duplicate(true); rel = d["rel"].duplicate(true)
	gen_ferido = d["gen_ferido"].duplicate(); gen_xp = d["gen_xp"].duplicate(); stats = d["stats"].duplicate(); capital_jogador = d["capital_jogador"]
	espiado = d["espiado"].duplicate(); revelado = d["revelado"].duplicate(); ultimo_ataque = d["ultimo_ataque"].duplicate()
	eliminados = d["eliminados"].duplicate(); sem_capital = d["sem_capital"].duplicate(); pensar = d["pensar"].duplicate(); noticias = d["noticias"].duplicate(true)
	espioes = d["espioes"].map(func(s): return {"para": s["para"], "pos": Vector2(s["x"], s["y"])})
	reforcos = d["reforcos"].duplicate()
	reuniao = d.get("reuniao", ""); auto_fila = int(d.get("auto_fila", 0))
	auto_rec.merge(d.get("auto_rec", {}), true)
	historico = d.get("historico", []).duplicate(true)
	memorial = d.get("memorial", []).duplicate(true)
	chefe_id = d.get("chefe_id", ""); chefe_dono = d.get("chefe_dono", "")
	ex = []
	for x in d["ex"]:
		ex.append(ExercitoC.carregar(x))
	prox_id = int(d["prox_id"])
	batalhas = []
	for bd in d["batalhas"]:
		var atacante := ex_por_id(bd["ex"])
		var alvo: ProvinciaC = prov.get(bd["alvo"])
		if atacante == null or alvo == null:
			continue
		var defs: Array = []
		var soldados_def: Array = []
		for did in bd["defensores"]:
			var x := ex_por_id(did)
			if x:
				defs.append(x)
				soldados_def.append_array(x.s)
		var b := BatalhaC.new()
		b.j = self; b.ex = atacante; b.alvo = alvo; b.defensores = defs
		for k in ["atq_dono", "def_dono", "saque", "t", "post_atq", "post_def", "usou_art", "audivel", "gen_atq", "gen_def", "ef_atq", "ef_def", "forte"]:
			b.set(k, bd[k])
		for k in ["fumaca", "carga", "pediu"]:
			if bd.has(k):
				b.set(k, bd[k].duplicate(true))
		b.art = bd["art"].duplicate(true); b.ia = bd["ia"].duplicate(true)
		for lado in ["atq", "def"]:
			var de_onde: Array = atacante.s if lado == "atq" else soldados_def
			for c in bd[lado]:
				var i := int(c["i"])
				var s: SoldadoC = de_onde[i] if i >= 0 else SoldadoC.carregar(c["s"])
				var comb := BatalhaC.entrada(s, c["dist"], c["x"], lado)
				comb.morto = c["morto"]; comb.abates_luta = int(c["abates"])
				b.lista(lado).append(comb)
		atacante.em_batalha = true
		for x in defs:
			x.em_batalha = true
		batalhas.append(b)
	for x in d["ex"]:
		var e := ex_por_id(x["id"])
		if e and x["aguarda"] != "" and batalhas.any(func(b): return b.alvo.id == x["aguarda"]):
			e.em_batalha = true
			e.aguarda = x["aguarda"]
	vida.carregar(d["vida"])
	pausado = true
	return true
