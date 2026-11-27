class_name VidaC
extends RefCounted
## O que deixa a partida viva: missões curtas, acontecimentos com escolha, rádio, ofensivas, ofensiva final e domínio.

const MISSAO_PRIMEIRA := 6.0
const MISSAO_INTERVALO := 18.0
const EVENTO_PRIMEIRO := 75.0
const EVENTO_MIN := 65.0
const EVENTO_VAR := 25.0
const EVENTO_DURA := 30.0
const OFENSIVA_PRIMEIRA := 210.0
const OFENSIVA_MIN := 150.0
const OFENSIVA_VAR := 50.0
const OFENSIVA_AVISO := 35.0
const OFENSIVA_JULGA := 60.0
const OFENSIVA_PREMIO := {"moedas": 45, "aco": 12}
const FINAL_COMECA := 180.0
const FINAL_DOMINIO := 0.6
const FINAL_SEGURA := 60.0
const RADIO_DURA := 6.0
const RADIO_INTERVALO := 14.0
const MOEDA := {"moedas": "moedas", "comida": "comida", "mun": "munição", "aco": "aço", "comb": "combustível"}

const MISSOES := {
	"tomar": {"prazo": 120.0, "premio": {"aco": 10, "moedas": 25}},
	"recrutar": {"prazo": 75.0, "premio": {"comida": 35, "moedas": 10}},
	"vencer": {"prazo": 150.0, "premio": {"mun": 60, "aco": 5}},
	"obra": {"prazo": 90.0, "premio": {"moedas": 30, "aco": 6}},
	"segurar": {"prazo": 75.0, "premio": {"moedas": 35, "mun": 20}}
}
const COMANDANTES := {
	"bravo": {"nome": "Cel. Brandão (Bravo)", "contato": "Encostou na minha fronteira? Vai se arrepender.", "perdeu": "Essa terra é minha. Vou buscar de volta!", "tomou": "Mais uma bandeira minha. Quem é o próximo?", "ofensiva": "Preparem-se. Vou passar por cima de {alvo}.", "repelida": "Sorte. Na próxima não sobra ninguém.", "caiu": "Não… a capital não!"},
	"charlie": {"nome": "Maj. Vilela (Charlie)", "contato": "Calma, amigo. Tudo tem um preço.", "perdeu": "Vai me pagar caro, e com juros.", "tomou": "Obrigado pelo cofre. Estava muito cheio.", "ofensiva": "Soube que {alvo} anda rica. Vou conferir.", "repelida": "Foi só uma visita. Eu volto.", "caiu": "Podemos negociar… tarde demais?"},
	"delta": {"nome": "Gen. Duarte (Delta)", "contato": "Registrei a sua chegada. Não avance.", "perdeu": "Recuo tático. Anote: tático.", "tomou": "Posição assegurada. Daqui não saio.", "ofensiva": "Concentração concluída. Alvo: {alvo}.", "repelida": "Bem defendido. Vou me lembrar.", "caiu": "A linha rompeu. Foi uma boa guerra."},
	"echo": {"nome": "Cap. Esteves (Echo)", "contato": "Eu observo antes de morder.", "perdeu": "Você olhou para o lado errado agora há pouco.", "tomou": "Saiu para brigar e deixou a porta aberta.", "ofensiva": "{alvo} está distraída. Hora perfeita.", "repelida": "Você estava mais atento do que parecia.", "caiu": "Não vi essa chegando."}
}
const EVENTOS := {
	"comboio": {"titulo": "Comboio na estrada", "texto": "Um comboio de suprimentos passa perto da fronteira.", "opcoes": [
		{"nome": "Escoltar o nosso", "dica": "+30 comida e +40 munição, garantido", "custo": {"moedas": 20}},
		{"nome": "Emboscar o deles", "dica": "60%: +40 moedas e +8 aço. 40%: gasta 25 de munição", "custo": {}}]},
	"desertor": {"titulo": "Desertor inimigo", "texto": "Um desertor pede para falar com o comando.", "opcoes": [
		{"nome": "Comprar o mapa dele", "dica": "revela um inimigo por 60 s", "custo": {"moedas": 25}},
		{"nome": "Alistar na tropa", "dica": "+2 soldados. 25% de sabotagem (-30 munição)", "custo": {}}]},
	"mercado": {"titulo": "Mercado negro", "texto": "Um negociante aparece com carga sem nota.", "opcoes": [
		{"nome": "Comprar aço", "dica": "+16 aço", "custo": {"moedas": 30}},
		{"nome": "Vender munição", "dica": "+32 moedas", "custo": {"mun": 45}}]},
	"voluntarios": {"titulo": "Voluntários na praça", "texto": "Moradores querem se alistar.", "opcoes": [
		{"nome": "Aceitar", "dica": "+3 soldados, se houver vaga", "custo": {"comida": 20}},
		{"nome": "Pedir doações", "dica": "+22 comida", "custo": {}}]},
	"descontentes": {"titulo": "Povo descontente", "texto": "A moral está caindo em {prov}.", "opcoes": [
		{"nome": "Distribuir pão", "dica": "moral +35", "custo": {"comida": 25}},
		{"nome": "Impor a ordem", "dica": "trincheira +20, moral -12", "custo": {}}]},
	"engenheiros": {"titulo": "Engenheiros de passagem", "texto": "Uma equipe de engenheiros oferece serviço.", "opcoes": [
		{"nome": "Reforçar a capital", "dica": "trincheira +30", "custo": {"moedas": 20}},
		{"nome": "Buscar combustível", "dica": "+14 combustível e +6 aço", "custo": {"moedas": 18}}]},
	"refugiados": {"titulo": "Refugiados na estrada", "texto": "Famílias fugindo da guerra pedem abrigo.", "opcoes": [
		{"nome": "Acolher", "dica": "moral +15 em tudo e +2 soldados, se houver vaga", "custo": {"comida": 30}},
		{"nome": "Cobrar passagem", "dica": "+25 moedas, moral -6 em tudo", "custo": {}}]},
	"paiol": {"titulo": "Paiol abandonado", "texto": "Batedores acharam um paiol sem guarda.", "opcoes": [
		{"nome": "Vasculhar", "dica": "65%: +60 munição. 35%: explode e fere a tropa da capital", "custo": {}},
		{"nome": "Desmontar com calma", "dica": "+6 aço e +15 munição", "custo": {}}]},
	"radio": {"titulo": "Rádio interceptado", "texto": "O sinal inimigo está aberto.", "opcoes": [
		{"nome": "Decifrar", "dica": "revela todos os inimigos por 30 s", "custo": {"moedas": 30}},
		{"nome": "Interferir", "dica": "os inimigos demoram 20 s a mais para agir", "custo": {"mun": 20}}]},
	"febre": {"titulo": "Febre no acampamento", "texto": "Uma febre se espalha pela tropa.", "opcoes": [
		{"nome": "Comprar remédio", "dica": "toda a tropa recupera a vida", "custo": {"moedas": 30}},
		{"nome": "Aguentar firme", "dica": "toda a tropa perde um pouco de vida", "custo": {}}]},
	"cofre": {"titulo": "Cofre da prefeitura", "texto": "Há um cofre fechado na prefeitura.", "opcoes": [
		{"nome": "Confiscar", "dica": "+50 moedas, moral -10 em tudo", "custo": {}},
		{"nome": "Deixar com o povo", "dica": "moral +12 em tudo", "custo": {}}]},
	"instrutor": {"titulo": "Veterano aposentado", "texto": "Um velho combatente se oferece para ajudar.", "opcoes": [
		{"nome": "Treinar a tropa", "dica": "até 4 soldados ganham experiência", "custo": {"moedas": 35}},
		{"nome": "Pedir conselho", "dica": "trincheira da capital +15", "custo": {}}]},
	"trem": {"titulo": "Trem descarrilado", "texto": "Um trem de carga tombou perto das suas linhas.", "opcoes": [
		{"nome": "Salvar o combustível", "dica": "+20 combustível", "custo": {}},
		{"nome": "Salvar os mantimentos", "dica": "+35 comida", "custo": {}}]},
	"sabotador": {"titulo": "Sabotador capturado", "texto": "Pegamos um sabotador inimigo.", "opcoes": [
		{"nome": "Interrogar", "dica": "65%: revela um inimigo por 45 s. 35%: ele não fala", "custo": {}},
		{"nome": "Trocar por resgate", "dica": "+28 moedas", "custo": {}}]}
}

var j
var missao := {}
var prox_missao := MISSAO_PRIMEIRA
var feitas := 0
var ultimo_tipo := ""
var festa_ate := 0.0
var ultimo_premio := ""
var recrutados := 0
var obras_feitas := 0
var vitorias := 0
var evento := {}
var prox_evento := EVENTO_PRIMEIRO
var ultimo_evento := ""
var radio := {}
var contato := {}
var ofensiva := {}
var prox_ofensiva := OFENSIVA_PRIMEIRA
var lancadas := 0
var repelidas := 0
var final := false
var dominio := {}

const CAMPOS := ["missao", "prox_missao", "feitas", "ultimo_tipo", "festa_ate", "ultimo_premio", "recrutados", "obras_feitas", "vitorias", "evento", "prox_evento", "ultimo_evento", "radio", "contato", "ofensiva", "prox_ofensiva", "lancadas", "repelidas", "final", "dominio"]

func _init(jogo) -> void:
	j = jogo

func salvar() -> Dictionary:
	var d := {}
	for k in CAMPOS:
		var v = get(k)
		d[k] = v.duplicate(true) if v is Dictionary else v
	return d

func carregar(d: Dictionary) -> void:
	for k in CAMPOS:
		if d.has(k):
			set(k, d[k])

static func texto_premio(p: Dictionary) -> String:
	var partes: Array = []
	for k in p:
		partes.append("+%d %s" % [int(p[k]), MOEDA[k]])
	return ", ".join(partes)

func _dar(p: Dictionary) -> void:
	for k in p:
		j.fac["jogador"][k] += p[k]

func pode_pagar(c: Dictionary) -> bool:
	for k in c:
		if j.fac["jogador"][k] < c[k]:
			return false
	return true

func _pagar(c: Dictionary) -> void:
	for k in c:
		j.fac["jogador"][k] = maxf(0.0, j.fac["jogador"][k] - c[k])

# ------------------------------------------------------------ missões
func _criar_missao(tipo: String) -> Dictionary:
	match tipo:
		"tomar":
			var melhor: ProvinciaC = null
			var peso := 0.0
			for q in j.lista_prov:
				if q.dono == "jogador" or q.capital or not j.em_guerra("jogador", q.dono) or not q.viz.any(func(v): return j.prov[v].dono == "jogador"):
					continue
				var p: float = (0.0 if q.dono == "neutro" else 1000.0) + BotsC.defesa_em(j, q)
				if melhor == null or p < peso:
					melhor = q
					peso = p
			return {"alvo": melhor.id} if melhor else {}
		"recrutar":
			return {"base": recrutados} if j.mao_de_obra_livre("jogador") >= 3 else {}
		"vencer":
			return {"base": vitorias} if not _criar_missao("tomar").is_empty() else {}
		"obra":
			return {"base": obras_feitas} if j.minhas().any(func(p): return p.obra.is_empty() or p.trinch < 100.0) else {}
		"segurar":
			return {"base": j.stats["perdidas"]} if j.t > 150.0 and j.minhas().size() >= 3 else {}
	return {}

func texto_missao(m: Dictionary) -> String:
	match m["tipo"]:
		"tomar": return "Tome %s" % j.prov[m["alvo"]].nome
		"recrutar": return "Recrute 3 soldados (%d/3)" % clampi(recrutados - int(m["base"]), 0, 3)
		"vencer": return "Vença uma batalha"
		"obra": return "Fortifique ou comece uma obra"
		_: return "Não perca nenhuma província"

func premio_da_missao(m: Dictionary) -> Dictionary:
	var r := {}
	for k in MISSOES[m["tipo"]]["premio"]:
		r[k] = roundi(MISSOES[m["tipo"]]["premio"][k] * m.get("escala", 1.0))
	return r

func nova_missao() -> bool:
	var tipos: Array = ["tomar", "recrutar"]
	if ultimo_tipo != "":
		tipos = MISSOES.keys().filter(func(x): return x != ultimo_tipo)
		for i in range(tipos.size() - 1, 0, -1):
			var k: int = j.rng.randi() % (i + 1)
			var tmp = tipos[i]
			tipos[i] = tipos[k]
			tipos[k] = tmp
	for tipo in tipos:
		var d := _criar_missao(tipo)
		if d.is_empty():
			continue
		d["tipo"] = tipo
		d["ate"] = j.t + MISSOES[tipo]["prazo"]
		d["escala"] = 1.0 + minf(0.5, feitas * 0.08)
		missao = d
		ultimo_tipo = tipo
		j.noticia("Nova missão: %s." % texto_missao(missao))
		return true
	prox_missao = j.t + 10.0
	return false

func _encerrar_missao(ok: bool) -> void:
	var m := missao
	missao = {}
	prox_missao = j.t + MISSAO_INTERVALO
	if ok:
		var p := premio_da_missao(m)
		_dar(p)
		feitas += 1
		festa_ate = j.t + 4.0
		ultimo_premio = texto_premio(p)
		j.tocar("conquista")
		j.noticia("Missão cumprida! %s" % ultimo_premio)
	else:
		j.noticia("A missão passou. Vem outra em instantes.")

func passo_missoes() -> void:
	if missao.is_empty():
		if j.t >= prox_missao:
			nova_missao()
		return
	var base := int(missao.get("base", 0))
	if missao["tipo"] == "segurar":
		if j.stats["perdidas"] > base:
			_encerrar_missao(false)
		elif j.t >= missao["ate"]:
			_encerrar_missao(true)
		return
	var feita := false
	match missao["tipo"]:
		"tomar": feita = j.prov[missao["alvo"]].dono == "jogador"
		"recrutar": feita = recrutados - base >= 3
		"vencer": feita = vitorias > base
		"obra": feita = obras_feitas > base
	if feita:
		_encerrar_missao(true)
	elif j.t >= missao["ate"]:
		_encerrar_missao(false)

# ------------------------------------------------------------ acontecimentos
func _prov_moral_baixa() -> ProvinciaC:
	var r: ProvinciaC = null
	for p in j.minhas():
		if not p.capital and (r == null or p.moral < r.moral):
			r = p
	return r

func novo_evento(id := "") -> bool:
	if id == "":
		var ids: Array = EVENTOS.keys().filter(func(k): return k != ultimo_evento and (k != "descontentes" or _prov_moral_baixa() != null))
		if ids.is_empty():
			return false
		id = ids[j.rng.randi() % ids.size()]
	evento = {"id": id, "ate": j.t + EVENTO_DURA}
	if id == "descontentes":
		var p := _prov_moral_baixa()
		if p == null:
			evento = {}
			return false
		evento["prov"] = p.id
	ultimo_evento = id
	j.tocar("espiao")
	return true

func texto_do_evento() -> String:
	var t: String = EVENTOS[evento["id"]]["texto"]
	return t.replace("{prov}", j.prov[evento["prov"]].nome) if evento.has("prov") else t

func _alistar(n: int) -> int:
	var achados: Array = j.parados_em(j.capital_jogador, "jogador")
	var e: ExercitoC = achados[0] if not achados.is_empty() else j.criar_exercito("jogador", j.capital_jogador, 0)
	var cabem := mini(n, j.mao_de_obra_livre("jogador"))
	for i in cabem:
		e.s.append(SoldadoC.new("Recruta"))
	if e.s.is_empty():
		j.tirar(e)
	return cabem

func _efeito(id: String, i: int) -> String:
	var rng: RandomNumberGenerator = j.rng
	match id:
		"comboio":
			if i == 0:
				_dar({"comida": 30, "mun": 40})
				return "O comboio chegou inteiro."
			if rng.randf() < 0.6:
				_dar({"moedas": 40, "aco": 8})
				return "Emboscada perfeita: +40 moedas e +8 aço."
			_pagar({"mun": 25})
			return "Era uma isca. Gastamos munição à toa."
		"desertor":
			if i == 0:
				var bots: Array = j.fase["bots"].filter(func(b): return not j.eliminados.has(b))
				if bots.is_empty():
					return "O mapa não servia para nada."
				var escolhido: String = bots[rng.randi() % bots.size()]
				j.espiado[escolhido] = j.t + 60.0
				return "Agora vemos os planos de %s por 60 s." % j.nome_de(escolhido)
			var cabem := _alistar(2)
			if rng.randf() < 0.25:
				_pagar({"mun": 30})
				return "Entraram %d, mas um deles sabotou o paiol." % cabem
			return "%s na tropa da capital." % Dados.qtd(cabem, "soldado entrou", "soldados entraram") if cabem else "Não havia vaga de mão de obra."
		"mercado":
			_dar({"aco": 16} if i == 0 else {"moedas": 32})
			return "Aço no depósito." if i == 0 else "Dinheiro no caixa."
		"voluntarios":
			if i == 0:
				var cabem := _alistar(3)
				if cabem == 0:
					_dar({"comida": 20})
					return "Sem vaga de mão de obra: ficaram para depois."
				return "%s na capital." % Dados.qtd(cabem, "voluntário", "voluntários")
			_dar({"comida": 22})
			return "A população dividiu a comida."
		"descontentes":
			var p: ProvinciaC = j.prov[evento["prov"]]
			if i == 0:
				p.moral = minf(100.0, p.moral + 35.0)
				return "%s se acalmou." % p.nome
			p.trinch = minf(100.0, p.trinch + 20.0)
			p.moral = maxf(5.0, p.moral - 12.0)
			return "%s está sob controle, por enquanto." % p.nome
		"engenheiros":
			if i == 0:
				var c: ProvinciaC = j.prov[j.capital_jogador]
				c.trinch = minf(100.0, c.trinch + 30.0)
				return "A capital ficou mais difícil de tomar."
			_dar({"comb": 14, "aco": 6})
			return "Depósito abastecido."
		"refugiados":
			if i == 0:
				_moral_geral(15.0)
				var cabem := _alistar(2)
				return "O povo agradeceu. %d se alistaram." % cabem
			_dar({"moedas": 25})
			_moral_geral(-6.0)
			return "Entrou dinheiro, mas o povo não gostou."
		"paiol":
			if i == 1:
				_dar({"aco": 6, "mun": 15})
				return "Tudo desmontado sem susto."
			if rng.randf() < 0.65:
				_dar({"mun": 60})
				return "Paiol cheio: +60 munição."
			_vida_da_tropa(-30.0, j.capital_jogador)
			return "O paiol explodiu e feriu a tropa da capital."
		"radio":
			if i == 0:
				for b in j.fase["bots"]:
					j.espiado[b] = maxf(j.espiado.get(b, 0.0), j.t + 30.0)
				return "Por 30 s vemos tudo o que os inimigos fazem."
			for b in j.pensar:
				if j.pensar[b] < 1000000.0:
					j.pensar[b] += 20.0
			return "Os inimigos perderam o contato por um tempo."
		"febre":
			if i == 0:
				_vida_da_tropa(100.0)
				return "A tropa está curada."
			_vida_da_tropa(-18.0)
			return "A febre passou, mas deixou a tropa fraca."
		"cofre":
			if i == 0:
				_dar({"moedas": 50})
				_moral_geral(-10.0)
				return "O dinheiro é nosso. O povo reclamou."
			_moral_geral(12.0)
			return "O povo está do seu lado."
		"instrutor":
			if i == 0:
				var treinados := 0
				for e in j.ex_de("jogador"):
					for s in e.s:
						if treinados < 4 and s.patente() == 0:
							s.lutas += 2
							treinados += 1
				return "%s com o veterano." % Dados.qtd(treinados, "soldado aprendeu", "soldados aprenderam")
			var c: ProvinciaC = j.prov[j.capital_jogador]
			c.trinch = minf(100.0, c.trinch + 15.0)
			return "A capital está mais bem defendida."
		"trem":
			_dar({"comb": 20} if i == 0 else {"comida": 35})
			return "Carga resgatada."
		"sabotador":
			if i == 1:
				_dar({"moedas": 28})
				return "Resgate pago."
			var vivos_b: Array = j.fase["bots"].filter(func(b): return not j.eliminados.has(b))
			if vivos_b.is_empty() or rng.randf() >= 0.65:
				return "Ele não disse uma palavra."
			var alvo: String = vivos_b[rng.randi() % vivos_b.size()]
			j.espiado[alvo] = j.t + 45.0
			return "Ele entregou os planos de %s." % j.nome_de(alvo)
	return ""

func _moral_geral(v: float) -> void:
	for p in j.minhas():
		p.moral = clampf(p.moral + v, 5.0, 100.0)

## cura ou fere a tropa; ferimento de acontecimento nunca mata
func _vida_da_tropa(v: float, so_em := "") -> void:
	for e in j.ex_de("jogador"):
		if so_em != "" and e.prov != so_em:
			continue
		for s in e.s:
			s.vida = clampf(s.vida + v, 5.0, s.vida_max())

func _fim_do_evento() -> void:
	evento = {}
	prox_evento = j.t + EVENTO_MIN + j.rng.randf() * EVENTO_VAR

func escolher(i: int) -> bool:
	if evento.is_empty() or j.fim != "":
		return false
	if i < 0:
		_fim_do_evento()
		return true
	var custo: Dictionary = EVENTOS[evento["id"]]["opcoes"][i]["custo"]
	if not pode_pagar(custo):
		return false
	_pagar(custo)
	j.noticia(_efeito(evento["id"], i))
	_fim_do_evento()
	return true

func passo_eventos() -> void:
	if not evento.is_empty():
		if j.t >= evento["ate"] or (evento.has("prov") and j.prov[evento["prov"]].dono != "jogador"):
			_fim_do_evento()
		return
	if j.t >= prox_evento and j.fase["tempo"] - j.t > 45.0:
		novo_evento()

# ------------------------------------------------------------ rádio
func falar(bot: String, qual: String, alvo := "", urgente := false) -> bool:
	if not COMANDANTES.has(bot):
		return false
	if not urgente and not radio.is_empty() and j.t < radio["ate"] - RADIO_DURA + RADIO_INTERVALO:
		return false
	var eh_chefe: bool = j.chefe_id != "" and bot == j.chefe_dono
	var falas: Dictionary = Dados.CHEFES[j.chefe_id]["falas"] if eh_chefe else COMANDANTES[bot]
	var quem: String = Dados.CHEFES[j.chefe_id]["nome"] if eh_chefe else COMANDANTES[bot]["nome"]
	var txt: String = falas[qual].replace("{alvo}", alvo)
	radio = {"quem": quem, "txt": txt, "ate": j.t + RADIO_DURA}
	j.noticia("Rádio, %s: %s" % [quem, txt])
	return true

func ao_conquistar(p: ProvinciaC, dono: String, antigo: String) -> void:
	if antigo == dono:
		return
	if antigo != "jogador" and antigo != "neutro" and dono == "jogador":
		falar(antigo, "caiu" if p.capital and p.capital_de == antigo else "perdeu", "", p.capital)
	elif antigo == "jogador" and dono != "neutro":
		falar(dono, "tomou")

func ao_abrir_batalha(e: ExercitoC, p: ProvinciaC) -> void:
	var bot := p.dono if e.dono == "jogador" else (e.dono if p.dono == "jogador" else "")
	if bot != "" and bot != "neutro" and not contato.has(bot) and falar(bot, "contato"):
		contato[bot] = 1

# ------------------------------------------------------------ ofensivas
func bots_ativos() -> Array:
	return j.fase["bots"].filter(func(b): return not j.eliminados.has(b) and not j.sem_capital.has(b) and j.pensar.has(b) and j.pensar[b] < 1000000.0 and j.em_guerra(b, "jogador") and not j.prov_de(b).is_empty())

func reforcos_da_ofensiva() -> int:
	var ajuste: int = {"recruta": -2, "veterano": 2}.get(j.dificuldade, 0)
	return maxi(2, 3 + roundi(j.fase["n"] / 2.0) + 3 * lancadas + ajuste)

func planejar_ofensiva() -> Dictionary:
	var opcoes: Array = []
	var total := 0.0
	for b in bots_ativos():
		for base in j.prov_de(b):
			for v in base.viz:
				var q: ProvinciaC = j.prov[v]
				if q.dono != "jogador":
					continue
				var peso: float = (2.0 if Dados.FACCOES[b]["perso"] == "agressivo" else 1.0) * (0.35 if q.capital else 1.0) / (1.0 + BotsC.defesa_em(j, q) / 8.0)
				opcoes.append({"bot": b, "base": base.id, "alvo": q.id, "peso": peso})
				total += peso
	if opcoes.is_empty():
		return {}
	var sorteio: float = j.rng.randf() * total
	for o in opcoes:
		sorteio -= o["peso"]
		if sorteio <= 0.0:
			return o
	return opcoes.back()

func anunciar_ofensiva(plano := {}) -> bool:
	var o: Dictionary = plano if not plano.is_empty() else planejar_ofensiva()
	if o.is_empty():
		return false
	ofensiva = {"bot": o["bot"], "base": o["base"], "alvo": o["alvo"], "em": j.t + OFENSIVA_AVISO, "lancada": false, "ex": "", "julga": 0.0}
	falar(o["bot"], "ofensiva", j.prov[o["alvo"]].nome, true)
	j.noticia("OFENSIVA: %s vai atacar %s em %d s. Reforce!" % [j.nome_de(o["bot"]), j.prov[o["alvo"]].nome, int(OFENSIVA_AVISO)], true)
	return true

func _proxima_ofensiva() -> void:
	prox_ofensiva = j.t + (OFENSIVA_MIN + j.rng.randf() * OFENSIVA_VAR) * (Dados.LOBO_OFENSIVA if j.chefe_id == "lobo" else 1.0)

func lancar_ofensiva() -> bool:
	var o := ofensiva
	var base: ProvinciaC = j.prov[o["base"]]
	var alvo: ProvinciaC = j.prov[o["alvo"]]
	if base.dono != o["bot"] or alvo.dono != "jogador" or not j.em_guerra(o["bot"], "jogador"):
		ofensiva = {}
		_proxima_ofensiva()
		if base.dono == "jogador":
			_dar(OFENSIVA_PREMIO)
			j.noticia("Você tomou a base da ofensiva antes dela sair! %s" % texto_premio(OFENSIVA_PREMIO))
		return false
	var achados: Array = j.parados_em(base.id, o["bot"])
	var e: ExercitoC = achados[0] if not achados.is_empty() else j.criar_exercito(o["bot"], base.id, 0)
	for i in reforcos_da_ofensiva():
		e.s.append(SoldadoC.new("Inimigo"))
	lancadas += 1
	var manda: ExercitoC = j.ordem(e.id, alvo.id, e.s.size(), "ataque")
	ofensiva["lancada"] = true
	ofensiva["ex"] = manda.id if manda else ""
	ofensiva["julga"] = j.t + OFENSIVA_JULGA
	return manda != null

func julgar_ofensiva() -> void:
	var o := ofensiva
	var alvo: ProvinciaC = j.prov[o["alvo"]]
	var e: ExercitoC = j.ex_por_id(o["ex"])
	var ainda: bool = e != null and (not e.rota.is_empty() or e.em_batalha)
	if alvo.dono != "jogador":
		ofensiva = {}
		_proxima_ofensiva()
		return
	if ainda and j.t < o["julga"] + 30.0:
		return
	ofensiva = {}
	_proxima_ofensiva()
	repelidas += 1
	_dar(OFENSIVA_PREMIO)
	falar(o["bot"], "repelida", "", true)
	j.noticia("Ofensiva repelida em %s! %s" % [alvo.nome, texto_premio(OFENSIVA_PREMIO)])

func passo_ofensiva() -> void:
	if not ofensiva.is_empty():
		if not ofensiva["lancada"]:
			if j.t >= ofensiva["em"]:
				lancar_ofensiva()
		elif j.t >= ofensiva["julga"] or j.prov[ofensiva["alvo"]].dono != "jogador" or j.ex_por_id(ofensiva["ex"]) == null:
			julgar_ofensiva()
		return
	if j.t >= prox_ofensiva and j.fase["tempo"] - j.t > OFENSIVA_AVISO + 30.0:
		if not anunciar_ofensiva():
			prox_ofensiva = j.t + 20.0

# ------------------------------------------------------------ final
func provincias_para_dominar() -> int:
	return ceili(j.lista_prov.size() * FINAL_DOMINIO)

func passo_final() -> void:
	if not final and j.fase["tempo"] - j.t <= FINAL_COMECA and not bots_ativos().is_empty():
		final = true
		for b in bots_ativos():
			j.pensar[b] = minf(j.pensar[b], 2.0)
			j.ultimo_ataque[b] = 0.0
		j.noticia("OFENSIVA FINAL: faltam 3 minutos e os inimigos vão com tudo!", true)
	var pl: Dictionary = j.placar()
	var meta := provincias_para_dominar()
	var dono := ""
	var todos: Array = ["jogador"]
	todos.append_array(j.fase["bots"])
	for d in todos:
		if not j.eliminados.has(d) and pl.get(d, 0) >= meta:
			dono = d
			break
	if dono == "":
		dominio = {}
		return
	if dominio.is_empty() or dominio["dono"] != dono:
		dominio = {"dono": dono, "desde": j.t}
		if dono == "jogador":
			j.noticia("Você domina o mapa! Segure %d províncias por %d s para vencer." % [meta, int(FINAL_SEGURA)])
		else:
			j.noticia("%s domina o mapa! Tome terra em %d s ou a guerra acaba." % [j.nome_de(dono), int(FINAL_SEGURA)], true)
	elif j.t - dominio["desde"] >= FINAL_SEGURA:
		j.vencedor_dominio = dono
		j.terminar("dominio" if dono == "jogador" else "dominado")

func passo() -> void:
	passo_missoes()
	passo_eventos()
	passo_ofensiva()
	if j.fim == "":
		passo_final()

## o texto da faixa de objetivo: [classe, texto, provincia_para_ir]
func faixa() -> Array:
	if not radio.is_empty() and j.t < radio["ate"]:
		return ["radio", "%s: %s" % [radio["quem"], radio["txt"]], ""]
	if j.t < festa_ate:
		return ["ok", "Missão cumprida! %s" % ultimo_premio, ""]
	if not dominio.is_empty():
		var resta := maxi(0, ceili(FINAL_SEGURA - (j.t - dominio["desde"])))
		if dominio["dono"] == "jogador":
			return ["ok", "Domínio do mapa: segure por %d s" % resta, ""]
		return ["perigo", "%s domina o mapa: tome terra em %d s" % [j.nome_de(dominio["dono"]), resta], ""]
	if not ofensiva.is_empty():
		var nome: String = j.prov[ofensiva["alvo"]].nome
		if not ofensiva["lancada"]:
			return ["perigo", "Ofensiva de %s em %s: %d s (toque)" % [j.nome_de(ofensiva["bot"]), nome, maxi(0, ceili(ofensiva["em"] - j.t))], ofensiva["alvo"]]
		return ["perigo", "Segure %s! Prêmio: %s" % [nome, texto_premio(OFENSIVA_PREMIO)], ofensiva["alvo"]]
	if not missao.is_empty():
		return ["", "Missão: %s · %d s · %s" % [texto_missao(missao), maxi(0, ceili(missao["ate"] - j.t)), texto_premio(premio_da_missao(missao))], missao.get("alvo", "")]
	if final:
		return ["perigo", "Ofensiva final: ataque ou segure o que é seu", ""]
	return ["vazia", "Próxima missão em instantes…", ""]
