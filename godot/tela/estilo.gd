class_name Estilo
extends RefCounted
## Cores, fontes e peças de interface no visual do FrontLine.

const FUNDO := Color("0c0f0d")
const PAINEL := Color("131815")
const BORDA := Color("2f3b32")
const AMBAR := Color("d39a45")
const AMBAR_CLARO := Color("ffd28a")
const AMBAR_ESCURO := Color("2a2214")
const TEXTO := Color("dbe6d3")
const MUDO := Color("93a68c")
const VERDE := Color("7bc96f")
const AMARELO := Color("e3b04b")
const VERMELHO := Color("e0533f")

static var _fontes := {}

static func fonte(nome := "titulo") -> Font:
	if _fontes.is_empty():
		_fontes = {"titulo": load("res://fontes/ChakraPetch-700.ttf"), "normal": load("res://fontes/ChakraPetch-500.ttf"),
			"marca": load("res://fontes/BlackOpsOne-400.ttf"), "leitura": load("res://fontes/BarlowCondensed-600.ttf")}
	return _fontes[nome]

static func icone(nome: String) -> Texture2D:
	return load("res://arte/icones/%s.png" % nome)

static func caixa(fundo: Color, borda: Color, grossura := 2, canto := 10, margem := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = fundo
	s.border_color = borda
	s.set_border_width_all(grossura)
	s.set_corner_radius_all(canto)
	s.set_content_margin_all(margem)
	return s

static func rotulo(texto: String, tam := 18, cor := TEXTO, qual := "titulo", centro := false, quebra := false) -> Label:
	var l := Label.new()
	l.text = texto
	l.add_theme_font_override("font", fonte(qual))
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if centro:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if quebra:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return l

static func contornar(l: Label, grossura := 6) -> Label:
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", grossura)
	return l

## texto com marcações [b] e [color=#...]
static func texto_rico(bb: String, tam := 16, cor := MUDO) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.mouse_filter = Control.MOUSE_FILTER_PASS
	r.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	r.add_theme_font_override("normal_font", fonte("normal"))
	r.add_theme_font_override("bold_font", fonte("titulo"))
	r.add_theme_font_size_override("normal_font_size", tam)
	r.add_theme_font_size_override("bold_font_size", tam)
	r.add_theme_color_override("default_color", cor)
	r.text = bb
	return r

static func pintar_botao(b: Button, forte := false, perigo := false) -> void:
	var fundo := PAINEL
	var borda := BORDA
	if forte:
		fundo = AMBAR_ESCURO
		borda = AMBAR
	if perigo:
		fundo = Color("4a1712")
		borda = Color("ff7050")
	b.add_theme_stylebox_override("normal", caixa(fundo, borda))
	b.add_theme_stylebox_override("hover", caixa(fundo, borda))
	b.add_theme_stylebox_override("pressed", caixa(fundo.lightened(0.15), AMBAR_CLARO))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_stylebox_override("disabled", caixa(Color("101311"), Color("222a24")))
	var cor := AMBAR_CLARO if forte or perigo else TEXTO
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(k, cor)
	b.add_theme_color_override("font_disabled_color", Color("5d6a5c"))

## botão com título e subtítulo; o toque só dispara se o dedo não arrastou a lista
static func botao(titulo: String, sub := "", ao := Callable(), forte := false, desligado := false, perigo := false) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_filter = Control.MOUSE_FILTER_PASS
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.disabled = desligado
	pintar_botao(b, forte, perigo)
	var v := VBoxContainer.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 0)
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.offset_left = 6
	v.offset_right = -6
	var t := rotulo(titulo, 18, Color("5d6a5c") if desligado else (AMBAR_CLARO if forte or perigo else TEXTO), "titulo", true, true)
	v.add_child(t)
	if sub != "":
		var s := rotulo(sub, 13, Color("56624f") if desligado else MUDO, "normal", true, true)
		v.add_child(s)
	b.add_child(v)
	b.custom_minimum_size = Vector2(0, 64 if sub != "" else 52)
	v.minimum_size_changed.connect(func(): b.custom_minimum_size.y = maxf(64 if sub != "" else 52, v.get_combined_minimum_size().y + 14))
	if ao.is_valid():
		b.pressed.connect(ao)
	return b

static func botao_simples(texto: String, ao: Callable, tam := 18, forte := false) -> Button:
	var b := Button.new()
	b.text = texto
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_override("font", fonte("titulo"))
	b.add_theme_font_size_override("font_size", tam)
	pintar_botao(b, forte)
	b.pressed.connect(ao)
	return b
