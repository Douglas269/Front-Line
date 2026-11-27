class_name GeradorC
extends RefCounted
## Mapas gerados na hora, no mesmo formato dos exportados do jogo web.
## A mesma semente gera sempre o mesmo mapa (é assim que a partida salva e o desafio do dia funcionam).

const TAMANHOS := {
	"p": {"nome": "Pequeno", "w": 860, "h": 1120, "n": 26},
	"m": {"nome": "Médio", "w": 980, "h": 1280, "n": 36},
	"g": {"nome": "Grande", "w": 1100, "h": 1440, "n": 48}
}
const VIZINHO_MIN := 26.0 # fronteira menor que isto não liga duas províncias

static func gerar(semente: int, tam: String, bots: Array) -> Dictionary:
	var T: Dictionary = TAMANHOS[tam]
	var rng := RandomNumberGenerator.new()
	rng.seed = semente
	var w: float = T["w"]
	var h: float = T["h"]
	var costa := _costa(rng, w, h)
	var sitios := _sitios(rng, costa, int(T["n"]))
	var celulas: Array = []
	var ligacoes: Array = []
	for i in sitios.size():
		celulas.append(null)
		ligacoes.append({})
	var raio := sqrt(absf(_area(costa)) / sitios.size())
	for i in sitios.size():
		var cel := _celula(i, sitios, w, h, raio)
		for k in cel.size():
			var v: int = cel[k][1]
			var a: Vector2 = cel[k][0]
			var b: Vector2 = cel[(k + 1) % cel.size()][0]
			if v >= 0 and a.distance_to(b) >= VIZINHO_MIN and Geometry2D.is_point_in_polygon((a + b) / 2.0, costa):
				ligacoes[i][v] = true
				ligacoes[v] = ligacoes[v] if ligacoes[v] is Dictionary else {}
				ligacoes[v][i] = true
		var contorno := PackedVector2Array()
		for q in cel:
			contorno.append(q[0])
		var maior := PackedVector2Array()
		for pedaco in Geometry2D.intersect_polygons(contorno, costa):
			if absf(_area(pedaco)) > absf(_area(maior)):
				maior = pedaco
		celulas[i] = _limpar(maior)
	var onda := FastNoiseLite.new()
	onda.seed = semente + 3
	onda.frequency = 0.021
	# se a ondulação cruzar algum contorno, usa menos ondulação em todos (para continuarem encostados)
	for forca in [13.0, 9.0, 6.0, 3.0, 0.0]:
		var prontas: Array = celulas.map(func(c): return _limpar(_ondular(c, onda, forca)))
		var boas := true
		for i in prontas.size():
			if Geometry2D.triangulate_polygon(prontas[i]).is_empty() or not Geometry2D.is_point_in_polygon(sitios[i], prontas[i]):
				boas = false
				break
		if boas or forca == 0.0:
			celulas = prontas
			break
	_unir_tudo(sitios, ligacoes)

	# capitais: a sua no canto de baixo, as outras o mais longe possível umas das outras
	var cap_jog := 0
	for i in sitios.size():
		if sitios[i].y - sitios[i].x * 0.35 > sitios[cap_jog].y - sitios[cap_jog].x * 0.35:
			cap_jog = i
	var capitais: Array = [cap_jog]
	for b in bots:
		var melhor := -1
		var longe := -1.0
		for i in sitios.size():
			if capitais.has(i):
				continue
			var perto := INF
			for c in capitais:
				perto = minf(perto, sitios[i].distance_to(sitios[c]))
			perto += rng.randf() * 40.0
			if perto > longe:
				longe = perto
				melhor = i
		capitais.append(melhor)

	var donos: Array = []
	var tipos: Array = []
	for i in sitios.size():
		donos.append("neutro")
		var s := rng.randf()
		tipos.append("campo" if s < 0.45 else ("cidade" if s < 0.67 else ("floresta" if s < 0.86 else "morro")))
	var faccoes: Array = ["jogador"]
	faccoes.append_array(bots)
	for k in faccoes.size():
		donos[capitais[k]] = faccoes[k]
		tipos[capitais[k]] = "capital"
	var extras := 2 if int(T["n"]) >= 36 else 1
	for volta in extras:
		for k in faccoes.size():
			var livres: Array = []
			for i in sitios.size():
				if donos[i] == faccoes[k]:
					for v in ligacoes[i]:
						if donos[v] == "neutro" and not capitais.has(v):
							livres.append(v)
			if livres.is_empty() and volta == 0:
				# cercado: pega a província neutra mais perto da capital
				var melhor := -1
				for i in sitios.size():
					if donos[i] == "neutro" and (melhor < 0 or sitios[i].distance_to(sitios[capitais[k]]) < sitios[melhor].distance_to(sitios[capitais[k]])):
						melhor = i
				if melhor >= 0:
					livres.append(melhor)
			if not livres.is_empty():
				donos[livres[rng.randi() % livres.size()]] = faccoes[k]
	# garante campo para a comida de cada país
	for f in faccoes:
		var minhas_p: Array = range(sitios.size()).filter(func(i): return donos[i] == f and not capitais.has(i))
		if not minhas_p.is_empty():
			tipos[minhas_p[0]] = "campo"

	var nomes := _nomes(rng, sitios.size())
	var provincias: Array = []
	var exercitos: Array = []
	for i in sitios.size():
		var id := "p%d" % i
		var eh_capital := capitais.has(i)
		var poli: Array = []
		for pt in celulas[i]:
			poli.append([snappedf(pt.x, 0.1), snappedf(pt.y, 0.1)])
		provincias.append({"id": id, "nome": nomes[i], "x": snappedf(sitios[i].x, 0.1), "y": snappedf(sitios[i].y, 0.1),
			"viz": ligacoes[i].keys().map(func(v): return "p%d" % v), "poli": poli, "tipo": tipos[i], "dono": donos[i], "capital": eh_capital,
			"capitalDe": donos[i] if eh_capital else "", "trinch": 70.0 if eh_capital else 40.0,
			"moral": 100.0 if eh_capital else (85.0 if donos[i] != "neutro" else 60.0), "forte": false})
		var tropas: Array = []
		if eh_capital:
			for k in 8:
				tropas.append("inf")
			if donos[i] == "delta":
				tropas.append_array(["metr", "metr"])
		elif donos[i] != "neutro":
			tropas = ["inf", "inf"]
		else:
			var qtd: int = {"campo": 2, "floresta": 3, "morro": 3, "cidade": 4}[tipos[i]] + (1 if tam != "p" else 0)
			for k in qtd:
				tropas.append("inf")
		exercitos.append({"dono": donos[i], "prov": id, "tropas": tropas})
	return {"W": w, "H": h, "capitalJogador": "p%d" % cap_jog, "prov": provincias, "ex": exercitos}

static func _costa(rng: RandomNumberGenerator, w: float, h: float) -> PackedVector2Array:
	var ruido := FastNoiseLite.new()
	ruido.seed = rng.randi()
	ruido.frequency = 0.9
	var r := PackedVector2Array()
	for i in 72:
		var a := i / 72.0 * TAU
		var v := Vector2(cos(a), sin(a))
		# um oval "estufado" (quase retângulo) com a borda recortada
		var forma := Vector2(signf(v.x) * pow(absf(v.x), 0.72), signf(v.y) * pow(absf(v.y), 0.72))
		var k := 1.0 + ruido.get_noise_2d(v.x * 1.7, v.y * 1.7) * 0.2 + ruido.get_noise_2d(v.x * 6.0 + 9.0, v.y * 6.0) * 0.05
		r.append(Vector2(w / 2.0 + forma.x * w * 0.43 * k, h / 2.0 + forma.y * h * 0.44 * k))
	return r

static func _area(p: PackedVector2Array) -> float:
	var a := 0.0
	for i in p.size():
		var q := p[(i + 1) % p.size()]
		a += p[i].x * q.y - q.x * p[i].y
	return a / 2.0

## pontos espalhados por igual dentro da costa (melhor candidato entre vários)
static func _sitios(rng: RandomNumberGenerator, costa: PackedVector2Array, n: int) -> Array:
	var caixa := Rect2(costa[0], Vector2.ZERO)
	for p in costa:
		caixa = caixa.expand(p)
	var dentro := Geometry2D.offset_polygon(costa, -38.0)
	var area: PackedVector2Array = dentro[0] if not dentro.is_empty() else costa
	var r: Array = []
	while r.size() < n:
		var melhor := Vector2.ZERO
		var longe := -1.0
		var tentativas := 0
		var achados := 0
		while achados < 40 and tentativas < 400:
			tentativas += 1
			var c := caixa.position + Vector2(rng.randf() * caixa.size.x, rng.randf() * caixa.size.y)
			if not Geometry2D.is_point_in_polygon(c, area):
				continue
			achados += 1
			var perto := INF
			for q in r:
				perto = minf(perto, c.distance_squared_to(q))
			if perto > longe:
				longe = perto
				melhor = c
		r.append(melhor)
	return r

## a célula de Voronoi do sítio i: lista de [ponto, vizinho do lado que começa nele]
static func _celula(i: int, sitios: Array, w: float, h: float, raio: float) -> Array:
	var cel: Array = [[Vector2(-60, -60), -1], [Vector2(w + 60, -60), -1], [Vector2(w + 60, h + 60), -1], [Vector2(-60, h + 60), -1]]
	var eu: Vector2 = sitios[i]
	var outros: Array = range(sitios.size()).filter(func(k): return k != i and eu.distance_to(sitios[k]) < raio * 5.0)
	outros.sort_custom(func(a, b): return eu.distance_squared_to(sitios[a]) < eu.distance_squared_to(sitios[b]))
	for k in outros:
		var meio: Vector2 = (eu + sitios[k]) / 2.0
		var normal: Vector2 = (sitios[k] - eu).normalized()
		var novo: Array = []
		for e in cel.size():
			var a: Array = cel[e]
			var b: Array = cel[(e + 1) % cel.size()]
			var da: float = (a[0] - meio).dot(normal)
			var db: float = (b[0] - meio).dot(normal)
			if da <= 0.0:
				novo.append(a)
				if db > 0.0:
					novo.append([a[0].lerp(b[0], da / (da - db)), k])
			elif db <= 0.0:
				novo.append([a[0].lerp(b[0], da / (da - db)), a[1]])
		cel = novo
		if cel.is_empty():
			break
	return cel

static func _limpar(p: PackedVector2Array) -> PackedVector2Array:
	var r := PackedVector2Array()
	for q in p:
		if r.is_empty() or r[r.size() - 1].distance_to(q) > 1.5:
			r.append(q)
	if r.size() > 3 and r[0].distance_to(r[r.size() - 1]) <= 1.5:
		r.remove_at(r.size() - 1)
	return r

static func _ondular(p: PackedVector2Array, onda: FastNoiseLite, forca: float) -> PackedVector2Array:
	var r := PackedVector2Array()
	for i in p.size():
		var a := p[i]
		var b := p[(i + 1) % p.size()]
		var partes := maxi(1, roundi(a.distance_to(b) / 17.0))
		for k in partes:
			var q := a.lerp(b, float(k) / partes)
			r.append(q + Vector2(onda.get_noise_2d(q.x, q.y), onda.get_noise_2d(q.x + 531.0, q.y - 217.0)) * forca)
	return r

## nenhum pedaço do mapa pode ficar isolado
static func _unir_tudo(sitios: Array, ligacoes: Array) -> void:
	while true:
		var vistos := {0: true}
		var fila: Array = [0]
		while not fila.is_empty():
			var a: int = fila.pop_back()
			for b in ligacoes[a]:
				if not vistos.has(b):
					vistos[b] = true
					fila.append(b)
		if vistos.size() == sitios.size():
			return
		var par := [-1, -1]
		var perto := INF
		for a in vistos:
			for b in sitios.size():
				if not vistos.has(b) and sitios[a].distance_to(sitios[b]) < perto:
					perto = sitios[a].distance_to(sitios[b])
					par = [a, b]
		ligacoes[par[0]][par[1]] = true
		ligacoes[par[1]][par[0]] = true

static func _nomes(rng: RandomNumberGenerator, n: int) -> Array:
	var todos: Array = []
	for m in JogoC.mapas():
		for p in m["prov"]:
			if not todos.has(p["nome"]):
				todos.append(p["nome"])
	todos.sort()
	for i in range(todos.size() - 1, 0, -1):
		var k := rng.randi() % (i + 1)
		var tmp = todos[i]
		todos[i] = todos[k]
		todos[k] = tmp
	var extra := 2
	while todos.size() < n:
		todos.append("%s %d" % [todos[todos.size() % 40], extra])
		extra += 1
	return todos.slice(0, n)
