class_name ProvinciaC
extends RefCounted

var id := ""
var nome := ""
var pos := Vector2.ZERO
var viz: Array = []
var poli := PackedVector2Array()
var tipo := "campo"
var dono := "neutro"
var capital := false
var capital_de := ""
var trinch := 40.0
var moral := 60.0
var obras := {}              # "forte": true...
var obra := {}               # {"id":..., "resta":...} ou vazio
var conquistada_em := -999.0

func eh_cidade() -> bool:
	return tipo == "cidade" or tipo == "capital"

func tem_obra(o: String) -> bool:
	return obras.get(o, false)

func salvar() -> Dictionary:
	return {"dono": dono, "tipo": tipo, "trinch": trinch, "capital": capital, "moral": moral, "obras": obras.duplicate(), "obra": obra.duplicate(), "conquistada_em": conquistada_em}

func carregar(d: Dictionary) -> void:
	dono = d["dono"]; tipo = d["tipo"]; trinch = d["trinch"]; capital = d["capital"]; moral = d["moral"]; obras = d["obras"].duplicate(); obra = d["obra"].duplicate(); conquistada_em = d["conquistada_em"]
