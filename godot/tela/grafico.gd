class_name GraficoC
extends Control
## Províncias de cada país ao longo da partida.

var historico: Array = []
var donos: Array = []
var total := 1

func mostrar(j: JogoC) -> void:
	historico = j.historico.duplicate(true)
	historico.append([int(j.t), j.placar()])
	donos = ["jogador"]
	donos.append_array(j.fase["bots"])
	total = maxi(1, j.lista_prov.size())
	custom_minimum_size = Vector2(0, 190)
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("10150f"))
	if historico.size() < 2:
		return
	var margem := Rect2(34, 10, size.x - 44, size.y - 34)
	var maximo := 4
	for h in historico:
		for d in donos:
			maximo = maxi(maximo, int(h[1].get(d, 0)))
	maximo = int(ceil(maximo / 4.0)) * 4
	var fim := maxf(1.0, float(historico.back()[0]))
	var fonte := Estilo.fonte("titulo")
	for i in 5:
		var y := margem.end.y - margem.size.y * i / 4.0
		draw_line(Vector2(margem.position.x, y), Vector2(margem.end.x, y), Color(1, 1, 1, 0.09), 1.0)
		draw_string(fonte, Vector2(6, y + 4), str(maximo * i / 4), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("8f9a8a"))
	draw_string(fonte, Vector2(margem.position.x, size.y - 6), "0:00", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("8f9a8a"))
	draw_string(fonte, Vector2(margem.end.x - 36, size.y - 6), RecordesC.relogio(fim), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("8f9a8a"))
	# você por último, para a sua linha ficar por cima
	var ordem: Array = donos.duplicate()
	ordem.reverse()
	for d in ordem:
		var pontos := PackedVector2Array()
		for h in historico:
			pontos.append(Vector2(margem.position.x + margem.size.x * float(h[0]) / fim, margem.end.y - margem.size.y * float(h[1].get(d, 0)) / maximo))
		var cor := Color(Dados.FACCOES[d]["cor"])
		var larg := 4.0 if d == "jogador" else 2.0
		draw_polyline(pontos, cor, larg, true)
		draw_circle(pontos[pontos.size() - 1], larg + 1.0, cor)
