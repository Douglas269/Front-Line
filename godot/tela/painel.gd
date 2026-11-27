class_name PainelC
extends ScrollContainer
## Desenha o painel de baixo a partir de uma descrição simples (título, textos, botões, listas).
## Só reconstrói quando a descrição muda, para não engolir toques.

var _coluna := VBoxContainer.new()
var _assinatura := ""
var _o_que := ""

func _ready() -> void:
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var margem := MarginContainer.new()
	margem.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margem.mouse_filter = Control.MOUSE_FILTER_PASS
	for lado in ["margin_left", "margin_right"]:
		margem.add_theme_constant_override(lado, 12)
	margem.add_theme_constant_override("margin_top", 8)
	margem.add_theme_constant_override("margin_bottom", 12)
	add_child(margem)
	_coluna.add_theme_constant_override("separation", 7)
	_coluna.mouse_filter = Control.MOUSE_FILTER_PASS
	margem.add_child(_coluna)

func mostrar(blocos: Array, o_que: String) -> void:
	var sem_funcoes := func(v, f: Callable):
		if v is Dictionary:
			var r := ""
			for k in v:
				if not v[k] is Callable:
					r += str(k) + ":" + f.call(v[k], f) + ";"
			return r
		if v is Array:
			return ",".join(v.map(func(x): return f.call(x, f)))
		return str(v)
	var nova: String = o_que + "|" + sem_funcoes.call(blocos, sem_funcoes)
	if nova == _assinatura:
		return
	_assinatura = nova
	for f in _coluna.get_children():
		_coluna.remove_child(f)
		f.queue_free()
	for b in blocos:
		_coluna.add_child(_peca(b))
	if o_que != _o_que:
		_o_que = o_que
		scroll_vertical = 0

func _peca(b: Dictionary) -> Control:
	match b["tipo"]:
		"titulo":
			var h := HBoxContainer.new()
			var t := Estilo.rotulo(b["t"], 21, Estilo.TEXTO, "titulo", false, true)
			h.add_child(t)
			if b.get("dir", "") != "":
				h.add_child(Estilo.rotulo(b["dir"], 15, b.get("cor", Estilo.VERDE)))
			return h
		"texto":
			return Estilo.texto_rico(b["t"], b.get("tam", 16), b.get("cor", Estilo.MUDO))
		"barra":
			var h := HBoxContainer.new()
			var fundo := ProgressBar.new()
			fundo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			fundo.custom_minimum_size = Vector2(0, 14)
			fundo.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			fundo.show_percentage = false
			fundo.max_value = 1.0
			fundo.value = b["v"]
			fundo.add_theme_stylebox_override("background", Estilo.caixa(Color("4a1c16"), Estilo.BORDA, 1, 6, 0))
			fundo.add_theme_stylebox_override("fill", Estilo.caixa(b["cor"], b["cor"], 0, 6, 0))
			fundo.mouse_filter = Control.MOUSE_FILTER_PASS
			h.add_child(fundo)
			h.add_child(Estilo.rotulo(b["t"], 15, b["cor"]))
			return h
		"alerta":
			var p := PanelContainer.new()
			p.mouse_filter = Control.MOUSE_FILTER_PASS
			p.add_theme_stylebox_override("panel", Estilo.caixa(Color("4a1712"), Color("ff7050"), 3))
			p.add_child(Estilo.rotulo(b["t"], 18, Color("ffd6cf"), "titulo", true, true))
			var t := p.create_tween().set_loops()
			t.tween_property(p, "modulate", Color(1.35, 1.2, 1.1), 0.28)
			t.tween_property(p, "modulate", Color.WHITE, 0.28)
			return p
		"botoes":
			var g := GridContainer.new()
			g.columns = b.get("colunas", 2)
			g.mouse_filter = Control.MOUSE_FILTER_PASS
			g.add_theme_constant_override("h_separation", 8)
			g.add_theme_constant_override("v_separation", 8)
			for x in b["lista"]:
				g.add_child(Estilo.botao(x["t"], x.get("sub", ""), x.get("f", Callable()), x.get("forte", false), x.get("off", false), x.get("perigo", false)))
			return g
		"linha":
			var p := PanelContainer.new()
			p.mouse_filter = Control.MOUSE_FILTER_PASS
			p.add_theme_stylebox_override("panel", Estilo.caixa(Estilo.PAINEL, Estilo.BORDA, 1, 8, 8))
			if b.get("apagada", false):
				p.modulate = Color(1, 1, 1, 0.55)
			var h := HBoxContainer.new()
			h.mouse_filter = Control.MOUSE_FILTER_PASS
			h.add_theme_constant_override("separation", 6)
			p.add_child(h)
			var v := VBoxContainer.new()
			v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			v.mouse_filter = Control.MOUSE_FILTER_PASS
			v.add_child(Estilo.texto_rico(b["t"], 16, Estilo.TEXTO))
			if b.get("sub", "") != "":
				v.add_child(Estilo.texto_rico(b["sub"], 13, Estilo.MUDO))
			h.add_child(v)
			for x in b.get("botoes", []):
				var bt := Estilo.botao(x["t"], x.get("sub", ""), x.get("f", Callable()), true, x.get("off", false))
				bt.size_flags_horizontal = Control.SIZE_SHRINK_END
				bt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
				bt.custom_minimum_size.x = 92
				h.add_child(bt)
			return p
		"tabela":
			var g := GridContainer.new()
			g.columns = b["linhas"][0].size()
			g.mouse_filter = Control.MOUSE_FILTER_PASS
			g.add_theme_constant_override("h_separation", 10)
			var n := 0
			for linha in b["linhas"]:
				for i in linha.size():
					var cel := Estilo.rotulo(linha[i], 14 if n else 12, Estilo.TEXTO if n else Estilo.MUDO)
					cel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
					if i:
						cel.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
					g.add_child(cel)
				n += 1
			return g
	return Control.new()
