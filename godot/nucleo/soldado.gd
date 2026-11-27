class_name SoldadoC
extends RefCounted

var nome := ""
var tipo := "inf"
var vida := 100.0
var fome := 10.0
var cansaco := 0.0
var soldo := 0.0
var lutas := 0
var abates := 0
var feitos: Array = []        # o que este soldado viveu, do mais antigo ao mais novo
const FEITOS_MAX := 8

func registrar(texto: String) -> void:
	feitos.append(texto)
	if feitos.size() > FEITOS_MAX:
		feitos.pop_front()

func _init(n := "", t := "inf") -> void:
	nome = n
	tipo = t
	vida = Dados.TROPAS[t]["vida"]

func dados() -> Dictionary:
	return Dados.TROPAS[tipo]

func vida_max() -> float:
	return Dados.TROPAS[tipo]["vida"]

## 0 nada, 1 veterano (2 batalhas), 2 elite (5)
func patente() -> int:
	return 2 if lutas >= 5 else (1 if lutas >= 2 else 0)

func eficacia() -> float:
	var bonus: float = [0.0, 0.1, 0.2][patente()]
	return (vida / 100.0) * (1.0 + bonus) * (1.0 - 0.55 * maxf(0.0, fome - 40.0) / 60.0) * (1.0 - 0.3 * cansaco / 100.0) * (1.0 - 0.35 * maxf(0.0, soldo - Dados.ATRASO_EFIC) / 70.0)

func salvar() -> Array:
	return [nome, tipo, vida, fome, cansaco, soldo, lutas, abates, feitos.duplicate()]

static func carregar(a: Array) -> SoldadoC:
	var s := SoldadoC.new(a[0], a[1])
	s.vida = a[2]; s.fome = a[3]; s.cansaco = a[4]; s.soldo = a[5]; s.lutas = int(a[6]); s.abates = int(a[7])
	if a.size() > 8:
		s.feitos = (a[8] as Array).duplicate()
	return s
