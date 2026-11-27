class_name RecordesC
extends RefCounted
## Recordes e conquistas, guardados no aparelho.

const ARQUIVO := "user://recordes.json"

const CONQUISTAS := {
	"primeira": ["Primeira vitória", "Vença uma partida."],
	"intacto": ["Nem um palmo", "Vença sem perder nenhuma província."],
	"relampago": ["Guerra relâmpago", "Vença em menos de 6 minutos."],
	"dominio": ["Dono do mapa", "Vença por domínio do território."],
	"artilheiro": ["Artilheiro", "Use a artilharia em 4 batalhas de uma partida e vença."],
	"heroi": ["Herói de guerra", "Tenha um soldado com 6 abates."],
	"missoes": ["Cumpridor", "Cumpra 5 missões numa partida."],
	"muralha": ["Muralha", "Repila 2 ofensivas numa partida."],
	"veterano": ["Linha dura", "Vença na dificuldade Veterano."],
	"campanha": ["Campanha completa", "Vença as 6 fases."],
	"estrelas": ["Constelação", "Junte 18 estrelas na campanha."],
	"rapida": ["Improviso", "Vença uma batalha rápida."],
	"aleatorio": ["Explorador", "Vença num mapa gerado na hora."],
	"diario": ["Pontual", "Vença um desafio do dia."],
	"operacao": ["Comandante", "Complete uma operação."],
	"chefe": ["Caçador de generais", "Vença a partida e derrube a capital de um chefe."]
}

var d := {"partidas": 0, "vitorias": 0, "conquistas": {}, "tempos": {}, "diario": {}, "operacoes": 0}

func _init() -> void:
	if FileAccess.file_exists(ARQUIVO):
		var lido = JSON.parse_string(FileAccess.get_file_as_string(ARQUIVO))
		if lido is Dictionary:
			d.merge(lido, true)

func gravar() -> void:
	var f := FileAccess.open(ARQUIVO, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

func apagar() -> void:
	d = {"partidas": 0, "vitorias": 0, "conquistas": {}, "tempos": {}, "diario": {}, "operacoes": 0}
	gravar()

func tem(id: String) -> bool:
	return d["conquistas"].has(id)

func _ganhar(id: String, novas: Array) -> void:
	if not tem(id):
		d["conquistas"][id] = true
		novas.append(id)

static func relogio(seg: float) -> String:
	return "%d:%02d" % [int(seg / 60.0), int(seg) % 60]

## guarda o resultado de uma partida terminada.
## `info`: {"modo": campanha|rapida|diario|operacao, "chave": nome do recorde, "aleatorio": bool, "dia": texto, "operacao_completa": bool, "estrelas": total}
## devolve {"novas": [ids], "recorde": bool, "anterior": segundos ou 0}
func registrar(j: JogoC, info: Dictionary) -> Dictionary:
	var novas: Array = []
	var saida := {"novas": novas, "recorde": false, "anterior": 0.0}
	d["partidas"] += 1
	if j.stats.get("melhor_n", 0) >= 6:
		_ganhar("heroi", novas)
	if j.vida.feitas >= 5:
		_ganhar("missoes", novas)
	if j.vida.repelidas >= 2:
		_ganhar("muralha", novas)
	if j.venceu():
		d["vitorias"] += 1
		_ganhar("primeira", novas)
		if j.stats["perdidas"] == 0:
			_ganhar("intacto", novas)
		if j.t <= 360.0:
			_ganhar("relampago", novas)
		if j.fim == "dominio":
			_ganhar("dominio", novas)
		if j.stats.get("art", 0) >= 4:
			_ganhar("artilheiro", novas)
		if j.dificuldade == "veterano":
			_ganhar("veterano", novas)
		if info.get("modo", "") == "rapida":
			_ganhar("rapida", novas)
		if info.get("aleatorio", false):
			_ganhar("aleatorio", novas)
		if info.get("modo", "") == "diario":
			_ganhar("diario", novas)
			var dia: String = info.get("dia", "")
			if not d["diario"].has(dia) or j.t < d["diario"][dia]:
				d["diario"][dia] = j.t
		if j.stats.get("chefe_caiu", false):
			_ganhar("chefe", novas)
		if info.get("operacao_completa", false):
			_ganhar("operacao", novas)
			d["operacoes"] += 1
		var chave: String = info.get("chave", "")
		if chave != "":
			saida["anterior"] = d["tempos"].get(chave, 0.0)
			if saida["anterior"] <= 0.0 or j.t < saida["anterior"]:
				saida["recorde"] = true
				d["tempos"][chave] = j.t
	if info.get("modo", "") == "campanha":
		if info.get("estrelas", 0) >= 18:
			_ganhar("estrelas", novas)
		if j.venceu() and j.fase["n"] == Dados.FASES.size():
			_ganhar("campanha", novas)
	gravar()
	return saida

## o instante em que você passou à frente em território e não perdeu mais a ponta (-1 se nunca)
static func virada(historico: Array, bots: Array) -> int:
	var desde := -1
	for h in historico:
		var meu: int = int(h[1].get("jogador", 0))
		var melhor := 0
		for b in bots:
			melhor = maxi(melhor, int(h[1].get(b, 0)))
		if meu > melhor:
			if desde < 0:
				desde = int(h[0])
		else:
			desde = -1
	return desde
