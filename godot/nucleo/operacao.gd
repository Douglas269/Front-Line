class_name OperacaoC
extends RefCounted
## A campanha com caminhos: 5 etapas em mapas novos. Em cada uma você escolhe entre duas missões
## (a mais arriscada paga o dobro). Os reforços ganhos valem até o fim. Perdeu, a operação acaba.

const ARQUIVO := "user://operacao.json"
const ETAPAS := 5
const LUGARES := ["Passo do Corvo", "Várzea Funda", "Ponte Quebrada", "Alto da Neblina", "Campos de Ferro", "Vale das Cinzas", "Porto Cinzento", "Serra do Sino", "Baixada Rubra", "Colina Treze", "Rio das Pedras", "Mata Escura"]

var d := {}

func _init() -> void:
	if FileAccess.file_exists(ARQUIVO):
		var lido = JSON.parse_string(FileAccess.get_file_as_string(ARQUIVO))
		if lido is Dictionary and lido.has("etapa"):
			d = lido

func gravar() -> void:
	var f := FileAccess.open(ARQUIVO, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))

func apagar() -> void:
	d = {}
	if FileAccess.file_exists(ARQUIVO):
		DirAccess.remove_absolute(ARQUIVO)

func ativa() -> bool:
	return not d.is_empty()

func etapa() -> int:
	return int(d.get("etapa", 1))

func reforcos() -> Array:
	return d.get("reforcos", [])

func veteranos() -> Array:
	return d.get("veteranos", [])

func opcoes() -> Array:
	return d.get("opcoes", [])

func nova(semente: int) -> void:
	d = {"semente": semente, "etapa": 1, "reforcos": [], "caminho": []}
	_sortear()

## as duas missões da etapa atual: a primeira é a mais segura
func _sortear() -> void:
	var n := etapa()
	var rng := RandomNumberGenerator.new()
	rng.seed = int(d["semente"]) * 31 + n
	# um lugar já visitado nesta operação não volta
	var lugares: Array = LUGARES.filter(func(x): return not d.get("caminho", []).has(x))
	var livres: Array = Dados.REFORCOS.keys().filter(func(id): return not reforcos().has(id))
	var lista: Array = []
	for arriscada in [false, true]:
		var nome: String = lugares.pop_at(rng.randi() % lugares.size())
		var tam: String = ["p", "p", "m", "m", "g"][n - 1]
		var bots: int = [2, 2, 2, 3, 3][n - 1]
		if arriscada and n >= 2:
			bots = mini(3, bots + 1)
		var regras: Array = []
		var possiveis: Array = ModosC.REGRAS.keys().filter(func(r): return r != "relampago" or n < ETAPAS)
		if not arriscada: # o caminho seguro só leva regra que não pesa contra você
			possiveis = ["industria", "fartura", "inverno", "escassez"]
		var quantas: int = (1 if n >= 2 else 0) + (1 if arriscada else 0)
		while regras.size() < quantas:
			var r: String = possiveis[rng.randi() % possiveis.size()]
			if not regras.has(r) and not (r == "fartura" and regras.has("escassez")):
				regras.append(r)
		var premios: Array = []
		for i in (2 if arriscada else 1):
			if not livres.is_empty() and n < ETAPAS:
				premios.append(livres.pop_at(rng.randi() % livres.size()))
		var facil: float = ([0.76, 0.77, 0.86, 0.91, 0.98] if arriscada else [0.84, 0.93, 1.05, 0.83, 0.9])[n - 1]
		lista.append({"nome": nome, "arriscada": arriscada, "premios": premios,
			"origem": {"modo": "operacao", "nome": nome, "etapa": n, "mapa": 0, "tam": tam, "bots": bots, "regras": regras, "bot_facil": facil, "semente": rng.randi() % 1000000000}})
	if n >= ETAPAS:
		# a última etapa é contra um general: um diferente em cada caminho
		var chefes: Array = Dados.CHEFES.keys()
		for m in lista:
			var id: String = chefes.pop_at(rng.randi() % chefes.size())
			m["chefe"] = id
			m["origem"]["chefe"] = id
	d["opcoes"] = lista
	d.erase("escolhida")
	gravar()

## começa a missão escolhida e devolve a origem da partida, já com os reforços ganhos
func escolher(i: int) -> Dictionary:
	d["escolhida"] = i
	gravar()
	var o: Dictionary = opcoes()[i]["origem"].duplicate(true)
	o["reforcos"] = reforcos().duplicate()
	o["veteranos"] = veteranos().duplicate(true)
	return o

## guarda o resultado. Devolve {"venceu", "premios", "completa", "fim", "etapa"}
func resultado(venceu: bool, etapa_jogada: int, sobreviventes: Array = []) -> Dictionary:
	if not ativa() or etapa_jogada != etapa() or not d.has("escolhida"):
		return {}
	var m: Dictionary = opcoes()[int(d["escolhida"])]
	var saida := {"venceu": venceu, "premios": [], "completa": false, "fim": false, "etapa": etapa_jogada, "veteranos": sobreviventes.map(func(x): return x.nome) if venceu else []}
	if not venceu:
		saida["fim"] = true
		apagar()
		return saida
	d["reforcos"].append_array(m["premios"])
	d["caminho"].append(m["nome"])
	d["veteranos"] = sobreviventes.map(func(x): return x.salvar())
	saida["premios"] = m["premios"]
	if etapa() >= ETAPAS:
		saida["completa"] = true
		saida["fim"] = true
		apagar()
		return saida
	d["etapa"] = etapa() + 1
	_sortear()
	return saida
