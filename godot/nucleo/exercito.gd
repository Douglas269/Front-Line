class_name ExercitoC
extends RefCounted

var id := ""
var dono := ""
var s: Array = []            # SoldadoC
var prov := ""
var de := ""
var rota: Array = []         # ids de províncias
var pos := Vector2.ZERO
var missao := "mover"
var origem := ""
var alertado := false
var general := ""
var nome := ""
var em_batalha := false
var aguarda := ""
var sem_suprimento := false

func parado() -> bool:
	return rota.is_empty() and not em_batalha

func vivos() -> Array:
	return s.filter(func(x): return x.vida > 0.0)

func salvar() -> Dictionary:
	return {"id": id, "dono": dono, "s": s.map(func(x): return x.salvar()), "prov": prov, "de": de, "rota": rota.duplicate(), "x": pos.x, "y": pos.y,
		"missao": missao, "origem": origem, "alertado": alertado, "general": general, "nome": nome, "aguarda": aguarda}

static func carregar(d: Dictionary) -> ExercitoC:
	var e := ExercitoC.new()
	e.id = d["id"]; e.dono = d["dono"]; e.s = d["s"].map(func(a): return SoldadoC.carregar(a)); e.prov = d["prov"]; e.de = d["de"]
	e.rota = d["rota"].duplicate(); e.pos = Vector2(d["x"], d["y"]); e.missao = d["missao"]; e.origem = d["origem"]
	e.alertado = d["alertado"]; e.general = d["general"]; e.nome = d["nome"]
	return e
