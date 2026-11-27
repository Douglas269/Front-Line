class_name RetratoC
extends Control
## Rosto dos comandantes inimigos, desenhado no mesmo traço simples dos soldados.
## Cada um tem um jeito próprio, para dar para reconhecer sem ler o nome.

const TRACO := Color("15130e")
const PELE := Color("d9a47c")

## quem aparece: "bravo", "charlie", "delta", "echo" ou um chefe ("ferro", "trovao", "lobo")
var quem := "bravo"
var cor := Color("e0533f")

static func criar(id: String, cor_do_pais: Color, tam := 48.0) -> RetratoC:
	var r := RetratoC.new()
	r.quem = id
	r.cor = cor_do_pais
	r.custom_minimum_size = Vector2(tam, tam)
	r.size = Vector2(tam, tam)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

func trocar(id: String, cor_do_pais: Color) -> void:
	if id != quem or cor_do_pais != cor:
		quem = id
		cor = cor_do_pais
		queue_redraw()

func _forma(pontos: Array, tinta: Color, contorno := 1.4) -> void:
	var p := PackedVector2Array(pontos)
	draw_colored_polygon(p, tinta)
	p.append(p[0])
	draw_polyline(p, TRACO, contorno, true)

func _bola(centro: Vector2, raio: float, tinta: Color, contorno := 1.4) -> void:
	draw_circle(centro, raio, tinta, true, -1.0, true)
	if contorno > 0.0:
		draw_arc(centro, raio, 0.0, TAU, 32, TRACO, contorno, true)

func _linha(a: Vector2, b: Vector2, tinta := TRACO, larg := 1.6) -> void:
	draw_line(a, b, tinta, larg, true)

func _draw() -> void:
	var k := minf(size.x, size.y) / 48.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(k, k))
	draw_rect(Rect2(0, 0, 48, 48), cor.darkened(0.62))
	# ombros e gola
	_forma([Vector2(5, 48), Vector2(10, 38), Vector2(19, 35), Vector2(29, 35), Vector2(38, 38), Vector2(43, 48)], cor.darkened(0.15))
	_linha(Vector2(19, 36), Vector2(24, 43), TRACO, 1.2)
	_linha(Vector2(29, 36), Vector2(24, 43), TRACO, 1.2)
	_bola(Vector2(24, 25), 11.5, PELE)
	match quem:
		"bravo", "trovao": _bravo()
		"charlie": _charlie()
		"delta", "ferro": _delta()
		_: _echo()
	if quem == "trovao": # barba cheia
		_forma([Vector2(14, 28), Vector2(19, 31), Vector2(24, 30), Vector2(29, 31), Vector2(34, 28), Vector2(31, 38), Vector2(24, 41), Vector2(17, 38)], Color("6b4a2b"))
	if quem == "ferro": # ponta no capacete
		_forma([Vector2(22, 10), Vector2(24, 2), Vector2(26, 10)], Color("c9b27a"))
	if quem == "lobo": # óculos de piloto
		for x in [19.0, 29.0]:
			_bola(Vector2(x, 15.0), 4.2, Color("9fc4d8"))
		_linha(Vector2(23, 15), Vector2(25, 15))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_rect(Rect2(Vector2.ZERO, size), cor, false, 2.0)

## cara fechada, bigodão e quepe alto de oficial
func _bravo() -> void:
	_forma([Vector2(12, 18), Vector2(14, 8), Vector2(34, 8), Vector2(36, 18)], cor.darkened(0.35))
	_forma([Vector2(11, 18), Vector2(37, 18), Vector2(34, 21), Vector2(14, 21)], Color("1d1b16"))
	_bola(Vector2(24, 12.5), 2.4, Color("e6c35a"), 1.0)
	_linha(Vector2(17, 22), Vector2(22, 24))
	_linha(Vector2(31, 22), Vector2(26, 24))
	_bola(Vector2(20, 25), 1.4, TRACO, 0.0)
	_bola(Vector2(28, 25), 1.4, TRACO, 0.0)
	_forma([Vector2(16, 32), Vector2(21, 28.5), Vector2(24, 30), Vector2(27, 28.5), Vector2(32, 32), Vector2(27, 31.5), Vector2(24, 32.5), Vector2(21, 31.5)], Color("3a2a1c"), 0.8)

## sorriso de lado, barba por fazer e chapéu de aba
func _charlie() -> void:
	for i in 26:
		var p := Vector2(16.0 + fmod(i * 7.3, 16.0), 29.0 + fmod(i * 3.1, 6.0))
		_bola(p, 0.55, Color(0.25, 0.18, 0.12, 0.65), 0.0)
	_forma([Vector2(15, 16), Vector2(18, 7), Vector2(30, 7), Vector2(33, 16)], Color("5b4a30"))
	_forma([Vector2(7, 18), Vector2(15, 14.5), Vector2(33, 14.5), Vector2(41, 16), Vector2(33, 19), Vector2(15, 19)], Color("6e5a3a"))
	_linha(Vector2(16, 13), Vector2(32, 13), cor, 2.4)
	_bola(Vector2(20, 23.5), 1.4, TRACO, 0.0)
	_linha(Vector2(26, 23.5), Vector2(30.5, 23))
	_linha(Vector2(19, 30.5), Vector2(25, 32))
	_linha(Vector2(25, 32), Vector2(31, 29))
	_bola(Vector2(27.5, 31), 1.2, Color("f4cf5a"), 0.0)

## capacete, óculos redondos e bigode grisalho
func _delta() -> void:
	_forma([Vector2(11, 21), Vector2(13, 12), Vector2(19, 8), Vector2(29, 8), Vector2(35, 12), Vector2(37, 21), Vector2(31, 18.5), Vector2(17, 18.5)], cor.darkened(0.3))
	for x in [19.5, 28.5]:
		_bola(Vector2(x, 24.5), 3.8, Color(0.75, 0.86, 0.92, 0.55))
		_bola(Vector2(x, 24.5), 1.1, TRACO, 0.0)
	_linha(Vector2(23, 24), Vector2(25, 24), TRACO, 1.1)
	_forma([Vector2(18, 31.5), Vector2(24, 29.5), Vector2(30, 31.5), Vector2(24, 32.5)], Color("c9c6bd"), 0.8)
	_linha(Vector2(20, 34.5), Vector2(28, 34.5), TRACO, 1.1)

## boina caída para um lado e tapa-olho
func _echo() -> void:
	_forma([Vector2(12, 18), Vector2(13, 11), Vector2(22, 7), Vector2(36, 9), Vector2(40, 15), Vector2(34, 17), Vector2(18, 17)], cor.darkened(0.25))
	_bola(Vector2(18, 13), 2.0, Color("e6c35a"), 1.0)
	_bola(Vector2(20, 24), 1.5, TRACO, 0.0)
	_linha(Vector2(17, 21), Vector2(23, 21.5))
	_linha(Vector2(14, 19), Vector2(35, 27), TRACO, 1.3)
	_bola(Vector2(29, 24), 3.3, Color("1b1915"))
	_linha(Vector2(20, 31.5), Vector2(28, 31.5))
	_linha(Vector2(33, 28), Vector2(30, 33), Color("a8604a"), 1.1)
