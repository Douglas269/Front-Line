extends Control
## FrontLine · Conquista em Godot: junta o jogo (núcleo) com o mapa, os painéis, a batalha animada e as telas.

const CONFIG := "user://config.json"
const PARTIDA := "user://partida.json"
const VERSAO := "0.9"

var campanha: CampanhaC
var jogo: JogoC
var sons := SonsC.new()
var paineis: PaineisC
var menus: MenusC
var recordes: RecordesC
var operacao: OperacaoC
var _fim_info := {} # o que a tela de fim precisa lembrar quando é redesenhada
var config := {"som": true, "musica": true, "dificuldade": "soldado", "batalha_rapida": false, "ver_batalha": true, "guia_feito": false, "vibracao": true, "camera": true, "dicas": {}, "graficos": "auto", "imersao": true}

var sel := {}
var modo := {}
var pendente := {}
var ver_detalhes := false

var _base := VBoxContainer.new()
var _topo := BoxContainer.new()
var _corpo := BoxContainer.new()   # mapa e painel: um sobre o outro no celular, lado a lado no computador
var _linha := ColorRect.new()
var _l2: HBoxContainer
## computador (ou tablet deitado): outra disposição e outra escala
var deitado := false
const PROJETO_EM_PE := Vector2i(540, 1170)
const PROJETO_DEITADO := Vector2i(1200, 720)
const PAINEL_LADO := 440.0         # largura do painel quando fica à direita
const COLUNA_TELA := 680.0         # largura máxima dos menus e cartões
var _margem_tela: MarginContainer
var _l_fase: Label
var _l_relogio: Label
var _b_pausa: Button
var _b_vel: Button
var _recursos := {}
var _faixa := Button.new()
var _faixa_texto: Label
var _faixa_alvo := ""
var _faixa_rosto: RetratoC
var _radio_ouvido := ""
var _area_mapa := Control.new()
var mapa := MapaVista.new()
var _painel := PainelC.new()
var _ferramentas := VBoxContainer.new()
var _b_diplo: Button
var _b_gen: Button
var _zoom := VBoxContainer.new()
var _aviso := PanelContainer.new()
var _aviso_texto: Label
var _aviso_alvo := ""
var _alerta: Button
var _alerta_vez := 0
var _evento := PanelContainer.new()
var _evento_chave := ""
var _evento_tempo: Label
var _resumo := PanelContainer.new()
var _resumo_ate := 0
var _pausa_grande := Button.new()
var _guia := PanelContainer.new()
var _guia_texto: Label
var _guia_botao: Button
var _guia_passo := -1
var _tela := Control.new()
var _tela_atual := ""
var _cena: BatalhaCena
var _batalhas_vistas := {}
var _atualiza := 0.0
var _salvou_em := 0.0
var _margem_topo := 0.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	get_tree().set_quit_on_go_back(false)
	_ler_config()
	campanha = CampanhaC.new(true)
	add_child(sons)
	sons.efeitos = config["som"]
	sons.musica_ligada = config["musica"]
	SonsC.vibracao = config["vibracao"]
	_aplicar_graficos()
	paineis = PaineisC.new(self)
	menus = MenusC.new(self)
	recordes = RecordesC.new()
	operacao = OperacaoC.new()
	var fundo := ColorRect.new()
	fundo.color = Estilo.FUNDO
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fundo)
	_montar_jogo()
	_montar_dica()
	get_window().size_changed.connect(_ajustar_formato)
	_ajustar_formato()
	_aplicar_imersao()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.visible = false
	add_child(_tela)
	_novo_jogo_de_fundo()
	mostrar_inicio()

func _ler_config() -> void:
	if FileAccess.file_exists(CONFIG):
		var d = JSON.parse_string(FileAccess.get_file_as_string(CONFIG))
		if d is Dictionary:
			config.merge(d, true)

func gravar_config() -> void:
	var f := FileAccess.open(CONFIG, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(config))

# ------------------------------------------------------------ montagem
func _montar_jogo() -> void:
	var seguro := DisplayServer.get_display_safe_area()
	var janela := Vector2(DisplayServer.window_get_size())
	if OS.has_feature("mobile") and janela.y > 0.0:
		_margem_topo = seguro.position.y * get_viewport_rect().size.y / janela.y
	_base.set_anchors_preset(Control.PRESET_FULL_RECT)
	_base.offset_top = _margem_topo
	_base.add_theme_constant_override("separation", 0)
	add_child(_base)
	_montar_topo()
	_faixa.custom_minimum_size = Vector2(0, 46)
	_faixa.focus_mode = Control.FOCUS_NONE
	_faixa.pressed.connect(func():
		if _faixa_alvo != "":
			ir_para(_faixa_alvo))
	_faixa_texto = Estilo.rotulo("", 15, Estilo.TEXTO, "normal", false, true)
	_faixa_texto.set_anchors_preset(Control.PRESET_FULL_RECT)
	_faixa_texto.offset_left = 12
	_faixa_texto.offset_right = -12
	_faixa_texto.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_faixa_texto.max_lines_visible = 2
	_faixa.add_child(_faixa_texto)
	_faixa_rosto = RetratoC.criar("bravo", Color(Dados.FACCOES["bravo"]["cor"]), 50.0)
	_faixa_rosto.position = Vector2(8, 4)
	_faixa_rosto.visible = false
	_faixa.add_child(_faixa_rosto)
	_base.add_child(_faixa)
	_corpo.vertical = true
	_corpo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_corpo.add_theme_constant_override("separation", 0)
	_base.add_child(_corpo)
	_area_mapa.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_area_mapa.size_flags_stretch_ratio = 1.2
	_area_mapa.clip_contents = true
	_corpo.add_child(_area_mapa)
	mapa.set_anchors_preset(Control.PRESET_FULL_RECT)
	_area_mapa.add_child(mapa)
	mapa.tocou_exercito.connect(func(id): selecionar({"tipo": "ex", "id": id}))
	mapa.tocou_provincia.connect(_tocou_provincia)
	mapa.arrastou_ordem.connect(_arrastou_ordem)
	_linha.color = Estilo.BORDA
	_linha.custom_minimum_size = Vector2(0, 2)
	_corpo.add_child(_linha)
	_painel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_painel.size_flags_stretch_ratio = 1.0
	_corpo.add_child(_painel)
	_montar_sobre_o_mapa()

func _montar_topo() -> void:
	var margem := MarginContainer.new()
	for k in ["margin_left", "margin_right"]:
		margem.add_theme_constant_override(k, 8)
	margem.add_theme_constant_override("margin_top", 6)
	margem.add_theme_constant_override("margin_bottom", 4)
	margem.add_child(_topo)
	_base.add_child(margem)
	_topo.vertical = true
	_topo.add_theme_constant_override("separation", 6)
	var l1 := HBoxContainer.new()
	l1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l1.add_theme_constant_override("separation", 6)
	_topo.add_child(l1)
	l1.add_child(Estilo.botao_simples("Menu", func(): voltar_ao_menu(), 17, true))
	_l_fase = Estilo.rotulo("", 15, Estilo.AMBAR)
	_l_fase.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_l_fase.clip_text = true
	l1.add_child(_l_fase)
	l1.add_child(Estilo.botao_simples("Ajustes", func(): abrir_ajustes(), 15))
	_b_pausa = Estilo.botao_simples("II", func(): pausar(not jogo.pausado), 18)
	_b_pausa.custom_minimum_size = Vector2(52, 46)
	l1.add_child(_b_pausa)
	_b_vel = Estilo.botao_simples("1x", func(): jogo.velocidade = 2 if jogo.velocidade == 1 else 1, 17)
	_b_vel.custom_minimum_size = Vector2(50, 46)
	l1.add_child(_b_vel)
	_l_relogio = Estilo.rotulo("00:00", 22)
	l1.add_child(_l_relogio)
	var l2 := HBoxContainer.new()
	l2.add_theme_constant_override("separation", 4)
	_l2 = l2
	_topo.add_child(l2)
	for r in [["comida", "bread", "d9a35a"], ["mun", "bullets", "c8d0c4"], ["moedas", "two-coins", "e6c35a"], ["aco", "cog", "9fb3c8"], ["comb", "jerrycan", "e08a3c"], ["mo", "brodie-helmet", "8fad88"], ["prov", "flying-flag", "ffd28a"]]:
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 52)
		Estilo.pintar_botao(b)
		var v := VBoxContainer.new()
		v.set_anchors_preset(Control.PRESET_FULL_RECT)
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		v.add_theme_constant_override("separation", 0)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var i := TextureRect.new()
		i.texture = Estilo.icone(r[1])
		i.modulate = Color(r[2])
		i.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		i.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		i.custom_minimum_size = Vector2(0, 22)
		i.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(i)
		var n := Estilo.rotulo("0", 15, Estilo.TEXTO, "titulo", true)
		v.add_child(n)
		b.add_child(v)
		b.pressed.connect(func(): selecionar({"tipo": "economia"}))
		l2.add_child(b)
		_recursos[r[0]] = n

func _botao_ferramenta(texto: String, icone: String, ao: Callable) -> Button:
	var b := Estilo.botao_simples("", ao, 12)
	b.custom_minimum_size = Vector2(86, 60)
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 0)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var i := TextureRect.new()
	i.texture = Estilo.icone(icone)
	i.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	i.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	i.custom_minimum_size = Vector2(0, 26)
	i.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(i)
	v.add_child(Estilo.rotulo(texto, 12, Estilo.MUDO, "titulo", true))
	b.add_child(v)
	return b

func _cartao(p: PanelContainer, borda: Color, topo := 8.0) -> void:
	p.add_theme_stylebox_override("panel", Estilo.caixa(Color(0.075, 0.095, 0.082, 0.97), borda, 3, 12, 10))
	p.set_anchors_preset(Control.PRESET_TOP_WIDE)
	p.offset_left = 10
	p.offset_right = -10
	p.offset_top = topo
	p.visible = false
	_area_mapa.add_child(p)

func _montar_sobre_o_mapa() -> void:
	_ferramentas.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_ferramentas.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_ferramentas.offset_left = 8
	_ferramentas.offset_bottom = -8
	_ferramentas.add_theme_constant_override("separation", 5)
	_ferramentas.add_child(_botao_ferramenta("Situação", "binoculars", func(): selecionar({"tipo": "situacao"})))
	_ferramentas.add_child(_botao_ferramenta("Pesquisa", "wrench", func(): selecionar({"tipo": "pesquisa"})))
	_b_diplo = _botao_ferramenta("Diplomacia", "walkie-talkie", func(): selecionar({"tipo": "diplomacia"}))
	_ferramentas.add_child(_b_diplo)
	_b_gen = _botao_ferramenta("Generais", "medal", func(): selecionar({"tipo": "generais"}))
	_ferramentas.add_child(_b_gen)
	_area_mapa.add_child(_ferramentas)
	_zoom.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_zoom.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_zoom.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_zoom.offset_right = -8
	_zoom.offset_bottom = -8
	_zoom.add_theme_constant_override("separation", 6)
	for x in [["+", func(): mapa.zoom_em(1.3, mapa.size / 2.0)], ["−", func(): mapa.zoom_em(1.0 / 1.3, mapa.size / 2.0)], ["★", func(): mapa.centralizar(jogo.prov[jogo.capital_jogador].pos)]]:
		var b := Estilo.botao_simples(x[0], x[1], 26)
		b.custom_minimum_size = Vector2(56, 52)
		_zoom.add_child(b)
	_area_mapa.add_child(_zoom)
	_alerta = Estilo.botao_simples("", func(): _ir_ao_problema(), 17)
	_alerta.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_alerta.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_alerta.offset_right = -8
	_alerta.offset_top = 56
	_alerta.custom_minimum_size = Vector2(92, 48)
	_alerta.add_theme_stylebox_override("normal", Estilo.caixa(Color("4a1712"), Color("ff8a6a"), 3, 12, 8))
	_alerta.visible = false
	_area_mapa.add_child(_alerta)
	_aviso.add_theme_stylebox_override("panel", Estilo.caixa(Color(0.075, 0.095, 0.082, 0.9), Estilo.BORDA, 2, 10, 8))
	_aviso.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_aviso.offset_left = 10
	_aviso.offset_right = -10
	_aviso.offset_top = 8
	_aviso.mouse_filter = Control.MOUSE_FILTER_STOP
	_aviso.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed and _aviso_alvo != "":
			ir_para(_aviso_alvo))
	_aviso_texto = Estilo.rotulo("", 15, Estilo.MUDO, "titulo", true, true)
	_aviso.add_child(_aviso_texto)
	_aviso.visible = false
	_area_mapa.add_child(_aviso)
	_cartao(_evento, Estilo.AMBAR)
	_cartao(_resumo, Estilo.VERDE, 54.0)
	_cartao(_guia, Color("4c8f45"))
	var gv := VBoxContainer.new()
	_guia.add_child(gv)
	_guia_texto = Estilo.rotulo("", 17, Estilo.TEXTO, "normal", false, true)
	gv.add_child(_guia_texto)
	var gh := HBoxContainer.new()
	var pular := Estilo.botao_simples("Pular tutorial", func(): _fim_do_guia(), 14)
	gh.add_child(pular)
	var espaco := Control.new()
	espaco.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gh.add_child(espaco)
	_guia_botao = Estilo.botao_simples("Entendi", func(): _avancar_guia(), 17, true)
	_guia_botao.custom_minimum_size = Vector2(130, 46)
	gh.add_child(_guia_botao)
	gv.add_child(gh)
	_pausa_grande.text = "▶\nPAUSADO"
	_pausa_grande.focus_mode = Control.FOCUS_NONE
	_pausa_grande.add_theme_font_override("font", Estilo.fonte())
	_pausa_grande.add_theme_font_size_override("font_size", 18)
	var redondo := Estilo.caixa(Color(0.075, 0.095, 0.082, 0.82), Estilo.AMBAR, 3, 60, 4)
	for k in ["normal", "hover", "pressed"]:
		_pausa_grande.add_theme_stylebox_override(k, redondo)
	_pausa_grande.add_theme_color_override("font_color", Estilo.AMBAR_CLARO)
	_pausa_grande.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_pausa_grande.offset_left = -55
	_pausa_grande.offset_right = 55
	_pausa_grande.offset_top = -114
	_pausa_grande.offset_bottom = -4
	_pausa_grande.pressed.connect(func(): pausar(false))
	_area_mapa.add_child(_pausa_grande)

## deitado só em tela grande: um celular virado de lado continua com o desenho de celular
func _tela_deitada() -> bool:
	var janela := Vector2(DisplayServer.window_get_size())
	var escala := maxf(1.0, DisplayServer.screen_get_scale()) if OS.has_feature("web") else 1.0
	return janela.x > janela.y * 1.1 and janela.y / escala >= 500.0

func _ajustar_formato() -> void:
	var agora := _tela_deitada()
	var mudou := agora != deitado
	deitado = agora
	get_window().content_scale_size = PROJETO_DEITADO if deitado else PROJETO_EM_PE
	if mudou:
		_corpo.vertical = not deitado
		_topo.vertical = not deitado
		_l2.custom_minimum_size.x = 560.0 if deitado else 0.0
		_painel.size_flags_horizontal = Control.SIZE_FILL
		_painel.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_painel.custom_minimum_size.x = PAINEL_LADO if deitado else 0.0
		_area_mapa.size_flags_horizontal = Control.SIZE_EXPAND_FILL if deitado else Control.SIZE_FILL
		_linha.custom_minimum_size = Vector2(2, 0) if deitado else Vector2(0, 2)
	_depois_de_ajustar.call_deferred(mudou)

## já com os tamanhos novos: centraliza os menus e refaz a batalha aberta
func _depois_de_ajustar(mudou: bool) -> void:
	await get_tree().process_frame
	_margens_da_tela()
	if _cena and _cena.b and not _cena.b.terminou:
		var b: BatalhaC = _cena.b
		_fechar_batalha()
		abrir_batalha_animada(b)
	elif _cena and mudou:
		_fechar_batalha()
	if mudou and jogo and not _tela.visible:
		mapa.centralizar(jogo.prov[jogo.capital_jogador].pos)

## os menus ficam numa coluna no meio, em vez de esticados de ponta a ponta
func _margens_da_tela() -> void:
	if _margem_tela == null or not is_instance_valid(_margem_tela):
		return
	var lado := int(maxf(18.0, (get_viewport_rect().size.x - COLUNA_TELA) / 2.0))
	_margem_tela.add_theme_constant_override("margin_left", lado)
	_margem_tela.add_theme_constant_override("margin_right", lado)

## cartões ocupam a largura do mapa e só a altura que o texto pede
func _ajustar_cartao(c: Control) -> void:
	var larg := minf(_area_mapa.size.x - 20.0, COLUNA_TELA)
	c.size = Vector2(larg, 0.0)
	c.position.x = (_area_mapa.size.x - larg) / 2.0
	if c == _guia: # embaixo, para não tampar as províncias de cima
		c.position.y = _area_mapa.size.y - c.size.y - 8.0

# ------------------------------------------------------------ partidas
func _ligar(j: JogoC) -> void:
	jogo = j
	j.dificuldade = config["dificuldade"]
	j.batalha_rapida = config["batalha_rapida"]
	j.som.connect(func(n): sons.tocar(n))
	j.conquista_feita.connect(_ao_conquistar)
	j.batalha_resolvida.connect(_resultado_da_batalha)
	j.acabou.connect(func(): _acabou.call_deferred())
	mapa.usar(j)
	_painel._assinatura = ""
	_batalhas_vistas = {}
	sel = {"tipo": "prov", "id": j.capital_jogador}
	modo = {}
	pendente = {}
	_evento_chave = ""
	_resumo.visible = false
	_fechar_batalha()

func _novo_jogo_de_fundo() -> void:
	var j := JogoC.new(campanha)
	j.novo(1)
	_ligar(j)
	j.pausado = true

func comecar_fase(n: int) -> void:
	_apagar_partida()
	var j := JogoC.new(campanha)
	j.dificuldade = config["dificuldade"]
	j.novo(n)
	campanha.aplicar_reforcos(j)
	_ligar(j)
	if not j.reforcos.is_empty():
		j.noticia("Reforços em campo: %s." % ", ".join(j.reforcos.map(func(id): return Dados.REFORCOS[id]["nome"])))
	_esconder_tela()
	await get_tree().process_frame
	mapa.centralizar(j.prov[j.capital_jogador].pos)
	_guia_passo = -1
	if n == 1:
		pausar(true)
		if not config["guia_feito"]:
			_avancar_guia()
		else:
			j.noticia("Fase 1 pausada: olhe o mapa e toque em ▶ quando estiver pronto.")
	salvar_partida()

func comecar_com_aviso(o: Dictionary) -> void:
	if tem_partida():
		var voltar := _tela_atual
		confirmar("Começar esta partida apaga a que está salva. Continuar?", func(): comecar_origem(o), func(): _voltar_para(voltar))
	else:
		comecar_origem(o)

func _voltar_para(nome: String) -> void:
	match nome:
		"rapida":
			menus.mostrar_rapida()
		"diario":
			menus.mostrar_diario()
		"operacao":
			menus.mostrar_operacao()
		_:
			mostrar_inicio()

func comecar_origem(o: Dictionary) -> void:
	_apagar_partida()
	# pintar um mapa novo leva um instante: avisa antes
	var v := _abrir_tela("carregando")
	_t(v, "Preparando o mapa…", 24, Estilo.AMBAR, "titulo", true)
	await get_tree().process_frame
	await get_tree().process_frame
	var j := JogoC.new(campanha)
	j.dificuldade = config["dificuldade"]
	j.novo_de_origem(o)
	_ligar(j)
	if not j.reforcos.is_empty():
		j.noticia("Reforços em campo: %s." % ", ".join(j.reforcos.map(func(id): return Dados.REFORCOS[id]["nome"])))
	_esconder_tela()
	await get_tree().process_frame
	mapa.centralizar(j.prov[j.capital_jogador].pos)
	_guia_passo = -1
	pausar(true)
	var regras: Array = j.fase.get("regras", [])
	j.noticia("Pausado: olhe o mapa e toque em ▶.%s" % (" Regras: " + ", ".join(regras.map(func(r): return ModosC.REGRAS[r][0])) + "." if not regras.is_empty() else ""))
	salvar_partida()

func tem_partida() -> bool:
	return FileAccess.file_exists(PARTIDA)

func continuar_partida() -> void:
	var d = JSON.parse_string(FileAccess.get_file_as_string(PARTIDA))
	if d is Dictionary and not d.get("origem", {}).is_empty() and int(d["origem"].get("mapa", 0)) == 0:
		var v := _abrir_tela("carregando")
		_t(v, "Preparando o mapa…", 24, Estilo.AMBAR, "titulo", true)
		await get_tree().process_frame
		await get_tree().process_frame
	var j := JogoC.new(campanha)
	if not (d is Dictionary) or not j.carregar(d):
		_apagar_partida()
		mostrar_inicio()
		return
	_ligar(j)
	j.pausado = true
	_esconder_tela()
	await get_tree().process_frame
	mapa.centralizar(j.prov[j.capital_jogador].pos)
	j.noticia("Partida carregada. Está pausada: toque em ▶ para continuar.")

func salvar_partida() -> void:
	if jogo == null or jogo.fim != "" or _tela_atual in ["inicio", "fim", "carregando"]:
		return
	var f := FileAccess.open(PARTIDA, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(jogo.salvar()))
		_salvou_em = jogo.t

func _apagar_partida() -> void:
	if FileAccess.file_exists(PARTIDA):
		DirAccess.remove_absolute(PARTIDA)

# ------------------------------------------------------------ ordens e seleção
func selecionar(s: Dictionary) -> void:
	sel = s
	modo = {}
	pendente = {}
	_atualizar()

func _tocou_provincia(id: String) -> void:
	if not modo.is_empty():
		preparar_ordem(modo["ex"], id, modo["missao"])
		return
	selecionar({"tipo": "prov", "id": id})

## arrastar só prepara a ordem: a tropa sai quando o jogador confirma
func _arrastou_ordem(ex_id: String, prov_id: String) -> void:
	preparar_ordem(ex_id, prov_id, "mover" if jogo.prov[prov_id].dono == "jogador" else "ataque")

func escolher_destino(ex_id: String, missao: String) -> void:
	modo = {"ex": ex_id, "missao": missao}
	pendente = {}
	_atualizar()

func preparar_ordem(ex_id: String, destino: String, missao: String) -> void:
	var e := jogo.ex_por_id(ex_id)
	modo = {}
	if e == null or (e.rota.is_empty() and destino == e.prov):
		_atualizar()
		return
	var c := jogo.rota_para(e, destino)
	if c.is_empty():
		_atualizar()
		return
	pendente = {"ex": ex_id, "destino": destino, "missao": missao, "qtd": e.s.size(), "rota": c["rota"], "seg": ceili(c["dist"] / jogo.vel_ex(e))}
	sel = {"tipo": "ex", "id": ex_id}
	_atualizar()

func mudar_quantidade(d: int) -> void:
	var e := jogo.ex_por_id(pendente.get("ex", ""))
	if e:
		pendente["qtd"] = clampi(int(pendente["qtd"]) + d, 1, e.s.size())
		_atualizar()

func confirmar_ordem() -> void:
	var o := pendente
	pendente = {}
	var e := jogo.ordem(o["ex"], o["destino"], o["qtd"], o["missao"])
	if e:
		sons.tocar("ordem")
		SonsC.vibrar(25)
		sel = {"tipo": "ex", "id": e.id}
	_atualizar()

func cancelar_ordem() -> void:
	modo = {}
	pendente = {}
	_atualizar()

func ir_para(prov_id: String) -> void:
	if jogo.prov.has(prov_id):
		mapa.centralizar(jogo.prov[prov_id].pos)
		selecionar({"tipo": "prov", "id": prov_id})

func postura(b: BatalhaC, id: String) -> void:
	if b.lado_do_jogador() == "atq":
		b.post_atq = id
	else:
		b.post_def = id
	sons.tocar("toque")
	_atualizar()

func tatica(b: BatalhaC, qual: String) -> void:
	var lado := b.lado_do_jogador()
	var ok := false
	match qual:
		"fumaca": ok = b.soltar_fumaca(lado)
		"carga": ok = b.dar_carga()
		"reforco": ok = b.pedir_reforco(lado)
	if ok:
		sons.tocar("ordem")
		SonsC.vibrar(30)
	_atualizar()

func artilharia(b: BatalhaC) -> void:
	b.atirar_artilharia(b.lado_do_jogador())
	_atualizar()

func resolver(b: BatalhaC) -> void:
	if jogo.resolver_agora(b):
		_fechar_batalha()
		jogo._avancar_batalhas(0.0)
	_atualizar()

func pausar(v: bool) -> void:
	if jogo.fim != "":
		return
	jogo.pausado = v
	if v:
		salvar_partida()
	_atualizar()

# ------------------------------------------------------------ avisos que levam ao problema
func _provincia_citada(texto: String) -> String:
	var achada := ""
	var tam := 0
	for p in jogo.lista_prov:
		if p.nome.length() > tam and texto.contains(p.nome):
			achada = p.id
			tam = p.nome.length()
	return achada

## o que pede sua atenção agora, do mais urgente para o menos
func problemas() -> Array:
	var r: Array = []
	for b in jogo.batalhas:
		if b.lado_do_jogador() == "def" and not b.terminou:
			r.append({"t": "%s está sob ataque" % b.alvo.nome, "prov": b.alvo.id})
	var of: Dictionary = jogo.vida.ofensiva
	if not of.is_empty() and jogo.prov[of["alvo"]].dono == "jogador":
		r.append({"t": "Ofensiva contra %s" % jogo.prov[of["alvo"]].nome, "prov": of["alvo"]})
	for e in jogo.ex_de("jogador"):
		if e.sem_suprimento:
			r.append({"t": "Tropa sem suprimento em %s" % jogo.prov[e.prov].nome, "ex": e.id, "prov": e.prov})
	for p in jogo.minhas():
		if not p.capital and p.moral < 20.0:
			r.append({"t": "Moral muito baixa em %s" % p.nome, "prov": p.id})
	# tropa grande parada longe de qualquer inimigo
	for e in jogo.ex_de("jogador"):
		if e.parado() and e.s.size() >= 5 and e.prov != jogo.capital_jogador and e.prov != jogo.reuniao and jogo.prov[e.prov].viz.all(func(v): return jogo.prov[v].dono == "jogador"):
			r.append({"t": Dados.qtd(e.s.size(), "soldado parado na retaguarda", "soldados parados na retaguarda"), "ex": e.id, "prov": e.prov})
	return r

func _ir_ao_problema() -> void:
	var l := problemas()
	if l.is_empty():
		return
	var q: Dictionary = l[_alerta_vez % l.size()]
	_alerta_vez += 1
	jogo.noticia(q["t"] + ".")
	mapa.centralizar(jogo.prov[q["prov"]].pos, false)
	selecionar({"tipo": "ex", "id": q["ex"]} if q.has("ex") else {"tipo": "prov", "id": q["prov"]})

## conquista e perda aparecem: câmera, vibração
func _ao_conquistar(prov_id: String, dono: String, antigo: String) -> void:
	if dono == antigo:
		return
	if dono == "jogador":
		SonsC.vibrar(70)
		if config["camera"] and _cena == null and modo.is_empty() and pendente.is_empty() and not mapa.puxando():
			mapa.focar(jogo.prov[prov_id].pos)
	elif antigo == "jogador":
		SonsC.vibrar(220)

# ------------------------------------------------------------ batalha animada
func abrir_batalha_animada(b: BatalhaC) -> void:
	if _cena or b == null or b.terminou:
		return
	_batalhas_vistas[b.get_instance_id()] = true
	_cena = BatalhaCena.new()
	_cena.abrir(self, b)
	var topo: float = _faixa.get_global_rect().position.y
	_cena.position = Vector2(0, topo)
	_cena.size = Vector2(size.x, size.y - topo)
	_cena.fechar.connect(_fechar_batalha)
	mapa.visible = false
	add_child(_cena)
	move_child(_tela, -1)

func _fechar_batalha() -> void:
	if _cena:
		_cena.encerrar()
		_cena.queue_free()
		_cena = null
		mapa.visible = true

func _resultado_da_batalha(r: Dictionary) -> void:
	if _cena:
		_cena.resultado(r)
		if _cena.b and _cena.b.alvo.id == r["prov"]:
			return
	for f in _resumo.get_children():
		_resumo.remove_child(f)
		f.queue_free()
	_resumo.add_theme_stylebox_override("panel", Estilo.caixa(Color(0.075, 0.095, 0.082, 0.97), Color("4c8f45") if r["venci"] else Color("a8443a"), 3, 12, 10))
	var t: String = "[color=#ffd28a][b]%s[/b][/color]\nPerdas: você %d, inimigo %d" % ["%s: vitória!" % r["nome"] if r["venci"] else "%s: derrota" % r["nome"], r["meus"], r["deles"]]
	if not r["ganho"].is_empty():
		t += "\nPrêmio: " + VidaC.texto_premio(r["ganho"])
	if not r["destaque"].is_empty():
		t += "\nDestaque: %s, %s" % [r["destaque"]["nome"], Dados.qtd(int(r["destaque"]["n"]), "abate", "abates")]
	var h := HBoxContainer.new()
	h.add_child(Estilo.texto_rico(t, 16, Estilo.TEXTO))
	var fechar := Estilo.botao_simples("X", func(): _resumo.visible = false, 18)
	fechar.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	fechar.custom_minimum_size = Vector2(46, 46)
	h.add_child(fechar)
	_resumo.add_child(h)
	_resumo.visible = true
	_resumo_ate = Time.get_ticks_msec() + 7000

# ------------------------------------------------------------ laço
## no automático: 5 segundos seguidos abaixo de 28 quadros por segundo ligam os gráficos leves
var _lento := 0.0
var _ligado_ha := 0.0

func _medir_fluidez(dt: float) -> void:
	if config["graficos"] != "auto" or ArteC.leve:
		return
	_ligado_ha += dt
	if _ligado_ha < 8.0 or _tela.visible: # o começo é sempre mais pesado
		_lento = 0.0
		return
	_lento = _lento + dt if Engine.get_frames_per_second() < 28.0 else maxf(0.0, _lento - dt * 2.0)
	if _lento >= 5.0:
		ArteC.leve = true
		if jogo and jogo.fim == "":
			jogo.noticia("Gráficos leves ligados para o jogo não engasgar (dá para mudar nos Ajustes).")

func _aplicar_imersao() -> void:
	sons.clima_de_guerra = config["imersao"]
	mapa.imersao = config["imersao"]

func _aplicar_graficos() -> void:
	ArteC.leve = config["graficos"] == "leve"
	_lento = 0.0

func _process(dt: float) -> void:
	if jogo == null:
		return
	_medir_fluidez(dt)
	if not _tela.visible and jogo.fim == "":
		if not jogo.pausado and not (_cena and _cena.abrindo):
			jogo.passo(minf(dt, 0.1) * jogo.velocidade)
		if jogo.fim == "":
			# uma batalha sua abre a tela animada sozinha (dá para desligar nos Ajustes)
			if config["ver_batalha"] and not jogo.pausado and _cena == null and _guia_passo < 0 and modo.is_empty() and pendente.is_empty() and not mapa.puxando():
				for b in jogo.batalhas:
					if b.lado_do_jogador() != "" and not b.terminou and not _batalhas_vistas.has(b.get_instance_id()):
						abrir_batalha_animada(b)
						break
			if jogo.t - _salvou_em >= 5.0:
				salvar_partida()
	var lutando := jogo.batalhas.any(func(b): return b.lado_do_jogador() != "" and not b.terminou)
	sons.musica("batalha" if (lutando or _cena) and not _tela.visible else "mapa")
	_atualiza -= dt
	if _atualiza <= 0.0:
		_atualiza = 0.2
		_atualizar()
	_pausa_grande.visible = jogo.pausado and not _tela.visible and _guia_passo < 0 and _cena == null
	if _resumo.visible and Time.get_ticks_msec() > _resumo_ate:
		_resumo.visible = false

func _atualizar() -> void:
	if jogo == null:
		return
	var f: Dictionary = jogo.fac["jogador"]
	var tropa := jogo.tropa_de("jogador")
	var alerta := {"comida": f["comida"] < tropa, "mun": f["mun"] < 60, "moedas": f["atraso"] > 0 or f["moedas"] < jogo.manutencao_de("jogador") * 2, "aco": f["falta_aco"], "comb": f["comb"] < 5 and jogo.ex_de("jogador").any(func(e): return e.s.any(func(s): return jogo.usa_comb(s)))}
	for k in alerta:
		_recursos[k].text = ("▼" if alerta[k] else "") + str(int(f[k]))
		_recursos[k].add_theme_color_override("font_color", Estilo.VERMELHO if alerta[k] else Estilo.TEXTO)
	_recursos["mo"].text = "%d/%d" % [tropa, jogo.mao_de_obra_max("jogador")]
	_recursos["prov"].text = "%d/%d" % [jogo.minhas().size(), jogo.lista_prov.size()]
	var resta := maxf(0.0, jogo.fase["tempo"] - jogo.t)
	_l_relogio.text = "%02d:%02d" % [int(resta / 60.0), int(resta) % 60]
	_l_fase.text = ("%d· %s" % [jogo.fase["n"], jogo.fase["nome"].to_upper()]) if jogo.fase["n"] > 0 else jogo.fase["nome"].to_upper()
	_b_pausa.text = "▶" if jogo.pausado else "II"
	Estilo.pintar_botao(_b_pausa, jogo.pausado)
	_b_vel.text = "%dx" % jogo.velocidade
	_b_diplo.visible = campanha.sistema_liberado("diplomacia", jogo.fase["n"])
	_b_gen.visible = campanha.sistema_liberado("generais", jogo.fase["n"])
	_atualizar_faixa()
	mapa.sel_prov = sel.get("id", "") if sel.get("tipo", "") == "prov" else ""
	mapa.sel_ex = sel.get("id", "") if sel.get("tipo", "") == "ex" else modo.get("ex", "")
	if not mapa.puxando():
		mapa.previa_ex = pendente.get("ex", "")
		mapa.rota_previa = pendente.get("rota", [])
	mapa.previa_destino = pendente.get("destino", "")
	_painel.mostrar(paineis.blocos(), "%s|%s|%s|%s" % [sel.get("tipo", ""), sel.get("id", ""), "modo" if not modo.is_empty() else "", "ordem" if not pendente.is_empty() else ""])
	# aviso curto no topo do mapa
	var mostrar_aviso: bool = not jogo.noticias.is_empty() and jogo.t - jogo.noticias[0]["t"] < (7.0 if jogo.noticias[0]["alerta"] else 4.5) and not _evento.visible and not _guia.visible and not mapa.puxando()
	# o que já está falando no rádio, na faixa de cima, não se repete sobre o mapa
	if mostrar_aviso and _faixa_rosto.visible and str(jogo.noticias[0]["txt"]).begins_with("Rádio, "):
		mostrar_aviso = false
	_aviso.visible = mostrar_aviso
	if mostrar_aviso:
		_aviso_alvo = _provincia_citada(jogo.noticias[0]["txt"])
		_aviso_texto.text = jogo.noticias[0]["txt"] + (" ›" if _aviso_alvo != "" else "")
		_aviso_texto.add_theme_color_override("font_color", Color("ffd6cf") if jogo.noticias[0]["alerta"] else Estilo.MUDO)
		_aviso.add_theme_stylebox_override("panel", Estilo.caixa(Color("4a1712") if jogo.noticias[0]["alerta"] else Color(0.075, 0.095, 0.082, 0.9), Color("8a2b2b") if jogo.noticias[0]["alerta"] else Estilo.BORDA, 2, 10, 8))
	_atualizar_evento()
	_conferir_guia()
	var pend := problemas().size() if jogo.fim == "" else 0
	_alerta.visible = pend > 0 and not _evento.visible and not _guia.visible
	_alerta.text = "⚠ %d  ver" % pend
	_conferir_dicas()
	_ferramentas.visible = not _guia.visible
	_zoom.visible = not _guia.visible
	for c in [_evento, _resumo, _guia]:
		if c.visible:
			_ajustar_cartao(c)

func _atualizar_faixa() -> void:
	var f: Array = jogo.vida.faixa()
	var cores: Array = {"": [Color("14190f"), Estilo.TEXTO], "ok": [Color("16301a"), Color("c9f2bd")], "perigo": [Color("4a1c17"), Color("ffd6cf")], "radio": [Color("2a2214"), Color("ffe2a8")], "vazia": [Color("14190f"), Estilo.MUDO]}[f[0]]
	_faixa_texto.text = f[1]
	_faixa_texto.add_theme_color_override("font_color", cores[1])
	var s := Estilo.caixa(cores[0], Estilo.BORDA, 0, 0, 4)
	for k in ["normal", "hover", "pressed", "focus"]:
		_faixa.add_theme_stylebox_override(k, s)
	_faixa_alvo = f[2]
	# no rádio, o rosto de quem fala e o chiado
	var no_ar: bool = f[0] == "radio" and jogo.vida.radio.has("cara")
	_faixa_rosto.visible = no_ar
	_faixa.custom_minimum_size.y = 58.0 if no_ar else 46.0
	_faixa_texto.offset_left = 68 if no_ar else 12
	if no_ar:
		var r: Dictionary = jogo.vida.radio
		_faixa_rosto.trocar(r["cara"], Color(Dados.FACCOES[r["pais"]]["cor"]))
		if _radio_ouvido != r["txt"] and not _tela.visible:
			_radio_ouvido = r["txt"]
			sons.tocar("radio", -14.0)

func _atualizar_evento() -> void:
	var ev: Dictionary = jogo.vida.evento
	if ev.is_empty() or _guia_passo >= 0 or _tela.visible:
		_evento.visible = false
		return
	var E: Dictionary = VidaC.EVENTOS[ev["id"]]
	var chave := "%s%s" % [ev["id"], E["opcoes"].map(func(o): return jogo.vida.pode_pagar(o["custo"]))]
	if chave != _evento_chave:
		_evento_chave = chave
		for f in _evento.get_children():
			_evento.remove_child(f)
			f.queue_free()
		var v := VBoxContainer.new()
		var h := HBoxContainer.new()
		h.add_child(Estilo.rotulo(E["titulo"], 19, Estilo.AMBAR_CLARO, "titulo", false, true))
		_evento_tempo = Estilo.rotulo("", 17, Estilo.AMBAR_CLARO)
		h.add_child(_evento_tempo)
		v.add_child(h)
		v.add_child(Estilo.rotulo(jogo.vida.texto_do_evento(), 15, Estilo.MUDO, "normal", false, true))
		var g := GridContainer.new()
		g.columns = 2
		g.add_theme_constant_override("h_separation", 8)
		for i in E["opcoes"].size():
			var o: Dictionary = E["opcoes"][i]
			var custo: String = "custa " + VidaC.texto_premio(o["custo"]).replace("+", "") + " · " if not o["custo"].is_empty() else ""
			var n: int = i
			g.add_child(Estilo.botao(o["nome"], custo + o["dica"], func(): _escolher_evento(n), true, not jogo.vida.pode_pagar(o["custo"])))
		v.add_child(g)
		v.add_child(Estilo.botao_simples("Ignorar", func(): _escolher_evento(-1), 14))
		_evento.add_child(v)
	_evento_tempo.text = "%d s" % maxi(0, ceili(ev["ate"] - jogo.t))
	_evento.visible = true
	_ajustar_cartao(_evento)

func _escolher_evento(i: int) -> void:
	if jogo.vida.escolher(i):
		sons.tocar("ordem")
		_evento_chave = ""
	_atualizar()

# ------------------------------------------------------------ tutorial da fase 1
const GUIA := [
	["Você é o verde. Vamos aprender jogando. O jogo fica pausado enquanto você aprende.", "Vamos lá"],
	["Estes bonecos verdes na capital ★ são o seu exército. Segure neles com o dedo (ou o botão do mouse), ARRASTE até uma província cinza vizinha e solte.", ""],
	["O painel mostra a previsão da batalha. Escolha quantos soldados vão e toque em «Confirmar». Nada sai sem você confirmar.", ""],
	["A tropa marcha sozinha. Embaixo do topo aparecem as missões, que dão prêmios. Para mover o mapa, arraste fora das suas tropas. Boa sorte!", "Começar"]
]

## explicações curtas, cada uma só na primeira vez
const DICAS := {
	"batalha": ["A BATALHA", "AVANÇAR chega rápido na trincheira. COBERTURA deita e protege, inclusive da artilharia que avisa antes de cair.\nFUMAÇA faz o inimigo errar mais. CARGA corre e bate mais, mas apanha mais. REFORÇO chama tropa de uma cidade vizinha. Cada um desses três vale uma vez."],
	"atencao": ["O BOTÃO ⚠", "Quando algo pede você (cidade atacada, tropa com fome, moral muito baixa), aparece o botão ⚠ no canto do mapa. Cada toque leva a um dos problemas."],
	"recrutar": ["RECRUTAR SOZINHO", "Já tem várias cidades? Em «Recrutar…» dá para ligar o recrutamento automático. Numa cidade sua, «Reunir aqui» faz os novos soldados marcharem para lá."],
	"veteranos": ["SEUS VETERANOS", "Soldado que sobrevive a 2 batalhas vira veterano e luta melhor. Em «Situação», toque em «Veteranos» para ver a história de cada um."]
}
var _dica := PanelContainer.new()
var _dica_id := ""
var _dica_antes := false

func _montar_dica() -> void:
	_dica.add_theme_stylebox_override("panel", Estilo.caixa(Color(0.075, 0.095, 0.082, 0.98), Color("4c8f45"), 3, 14, 14))
	_dica.visible = false
	add_child(_dica)

func dica(id: String) -> bool:
	if config.get("sem_dicas", false) or config["dicas"].has(id) or _dica_id != "" or _guia_passo >= 0 or _tela.visible or jogo.fim != "":
		return false
	_dica_id = id
	_dica_antes = jogo.pausado
	jogo.pausado = true
	for f in _dica.get_children():
		_dica.remove_child(f)
		f.queue_free()
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.add_child(Estilo.rotulo(DICAS[id][0], 21, Estilo.AMBAR_CLARO, "titulo", true))
	var corpo := Estilo.rotulo(DICAS[id][1], 18, Estilo.TEXTO, "normal", false, true)
	corpo.custom_minimum_size.x = minf(size.x - 24.0, COLUNA_TELA) - 32.0
	v.add_child(corpo)
	var ok := Estilo.botao_simples("Entendi", func(): fechar_dica(), 19, true)
	ok.custom_minimum_size = Vector2(0, 54)
	v.add_child(ok)
	_dica.add_child(v)
	_dica.visible = true
	move_child(_dica, -1)
	_colocar_dica.call_deferred()
	return true

func _colocar_dica() -> void:
	if _dica_id == "":
		return
	var larg := minf(size.x - 24.0, COLUNA_TELA)
	_dica.size = Vector2(larg, 0.0)
	_dica.position = Vector2((size.x - larg) / 2.0, maxf(100.0, (size.y - _dica.size.y) * 0.42))

func fechar_dica() -> void:
	if _dica_id == "":
		return
	config["dicas"][_dica_id] = true
	_dica_id = ""
	_dica.visible = false
	jogo.pausado = _dica_antes
	gravar_config()

## decide qual explicação cabe neste momento
func _conferir_dicas() -> void:
	if _dica_id != "":
		_colocar_dica()
		return
	if _cena != null and _cena.b != null and not _cena.b.terminou:
		dica("batalha")
	elif _cena == null and _alerta.visible:
		dica("atencao")
	elif _cena == null and jogo.t > 30.0 and jogo.minhas().size() >= 4 and modo.is_empty() and pendente.is_empty():
		dica("recrutar")
	elif _cena == null and jogo.ex_de("jogador").any(func(e): return e.s.any(func(x): return x.patente() > 0)) and modo.is_empty() and pendente.is_empty():
		dica("veteranos")

func _avancar_guia() -> void:
	_guia_passo += 1
	if _guia_passo >= GUIA.size():
		_fim_do_guia()
		return
	_guia_texto.text = GUIA[_guia_passo][0]
	_guia_botao.text = GUIA[_guia_passo][1]
	_guia_botao.visible = GUIA[_guia_passo][1] != ""
	_guia.visible = true
	_ajustar_cartao(_guia)

func _conferir_guia() -> void:
	if _guia_passo < 0:
		_guia.visible = false
		return
	var feito := false
	match _guia_passo:
		1: feito = not pendente.is_empty()
		2: feito = jogo.ex_de("jogador").any(func(e): return not e.rota.is_empty())
	if feito:
		_avancar_guia()
	elif _guia_passo == 2 and pendente.is_empty():
		_guia_passo = 0 # cancelou: volta a explicar o arrasto
		_avancar_guia()

func _fim_do_guia() -> void:
	_guia_passo = -1
	_guia.visible = false
	config["guia_feito"] = true
	gravar_config()
	pausar(false)

# ------------------------------------------------------------ telas
func _abrir_tela(nome: String) -> VBoxContainer:
	if _dica_id != "":
		jogo.pausado = _dica_antes
		_dica_id = ""
		_dica.visible = false
	_tela_atual = nome
	for f in _tela.get_children():
		_tela.remove_child(f)
		f.queue_free()
	var fundo := ColorRect.new()
	fundo.color = Color(0.02, 0.027, 0.023, 1.0)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.add_child(fundo)
	var rolagem := ScrollContainer.new()
	rolagem.set_anchors_preset(Control.PRESET_FULL_RECT)
	rolagem.offset_top = _margem_topo
	rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_tela.add_child(rolagem)
	var m := MarginContainer.new()
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	m.mouse_filter = Control.MOUSE_FILTER_PASS
	for k in ["margin_left", "margin_right", "margin_top", "margin_bottom"]:
		m.add_theme_constant_override(k, 18)
	rolagem.add_child(m)
	_margem_tela = m
	_margens_da_tela()
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	v.mouse_filter = Control.MOUSE_FILTER_PASS
	m.add_child(v)
	_tela.visible = true
	_base.visible = false
	move_child(_tela, -1)
	return v

func _esconder_tela() -> void:
	_base.visible = true
	_tela.visible = false
	_tela_atual = ""

func _t(v: VBoxContainer, texto: String, tam := 17, cor := Estilo.MUDO, qual := "normal", centro := false) -> void:
	v.add_child(Estilo.rotulo(texto, tam, cor, qual, centro, true))

func _cartao_reforco(id: String) -> String:
	var R: Dictionary = Dados.REFORCOS[id]
	return "[color=#9fd08f]▲ %s[/color]\n[color=#ff9d8a]▼ %s[/color]" % [R["mais"], R["menos"]]

func _oferta(v: VBoxContainer, fase: int, depois: Callable) -> void:
	var oferta := campanha.oferta_de_reforco(fase)
	if oferta.is_empty():
		return
	_t(v, "ESCOLHA 1 REFORÇO PERMANENTE", 18, Estilo.AMBAR, "titulo")
	for id in oferta:
		var rid: String = id
		v.add_child(Estilo.botao(Dados.REFORCOS[id]["nome"], "▲ %s\n▼ %s" % [Dados.REFORCOS[id]["mais"], Dados.REFORCOS[id]["menos"]], func():
			campanha.escolher_reforco(fase, rid)
			sons.tocar("conquista")
			depois.call_deferred(), true))

func mostrar_inicio() -> void:
	_fechar_batalha()
	var v := _abrir_tela("inicio")
	_t(v, "FRONTLINE", 52, Color("ffd28a"), "marca", true)
	_t(v, "CAMPANHA DE CONQUISTA · feita em Godot", 16, Estilo.MUDO, "titulo", true)
	if tem_partida():
		var d = JSON.parse_string(FileAccess.get_file_as_string(PARTIDA))
		if d is Dictionary:
			var qual := "FASE %d" % int(d["fase"]) if d.get("origem", {}).is_empty() else ModosC.nome_de_partida(d["origem"]).to_upper()
			v.add_child(Estilo.botao("▶ CONTINUAR · %s" % qual, "%s jogados" % RecordesC.relogio(d["t"]), func(): continuar_partida(), true))
	var pend := campanha.fase_com_oferta()
	if pend:
		_oferta(v, pend, func(): mostrar_inicio())
	menus.atalhos(v)
	for c in 2:
		_t(v, Dados.CAPITULOS[c].to_upper(), 17, Estilo.AMBAR, "titulo")
		for F in Dados.FASES:
			if F["cap"] != c:
				continue
			var n: int = F["n"]
			var lib := campanha.fase_liberada(n)
			var est := campanha.estrelas_de(n)
			var sub: String = "%d inimigos · %d min%s\n★★★ %s" % [F["bots"].size(), int(F["tempo"] / 60.0), " · " + F["regra_txt"] if F.has("regra_txt") else "", Dados.OBJETIVOS[F["objetivo"]]] if lib else "vença a fase anterior"
			v.add_child(Estilo.botao("%d. %s   %s" % [n, F["nome"], "★".repeat(est) + "☆".repeat(3 - est) if lib else "(trancada)"], sub, func():
				if tem_partida():
					confirmar("Começar uma fase nova apaga a partida salva. Continuar?", func(): dar_ordens(n), func(): mostrar_inicio())
				else:
					dar_ordens(n), lib, not lib))
	_t(v, "%s · %d de %d generais" % [Dados.qtd(campanha.total_estrelas(), "estrela", "estrelas"), campanha.generais_liberados().size(), Dados.GENERAIS.size()], 15)
	if not campanha.meta["reforcos"].is_empty():
		_t(v, "SEUS REFORÇOS", 16, Estilo.AMBAR, "titulo")
		for id in campanha.meta["reforcos"]:
			v.add_child(Estilo.texto_rico("[b]%s[/b]\n%s" % [Dados.REFORCOS[id]["nome"], _cartao_reforco(id)], 15))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	for x in [["Como jogar", func(): mostrar_como_jogar()], ["Ajustes", func(): abrir_ajustes()], ["Créditos", func(): mostrar_creditos()]]:
		var b := Estilo.botao_simples(x[0], x[1], 16)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size.y = 52
		h.add_child(b)
	v.add_child(h)
	_t(v, "versão %s (Godot) · o jogo online continua na versão web" % VERSAO, 13, Estilo.MUDO, "normal", true)

## as ordens do comando: a situação da fase e quem está do outro lado
func dar_ordens(n: int) -> void:
	if not config["imersao"]:
		comecar_fase(n)
		return
	var F: Dictionary = Dados.FASES[n - 1]
	var O: Dictionary = HistoriaC.ORDENS[n]
	var v := _abrir_tela("ordens")
	sons.tocar("radio", -12.0)
	_t(v, "ORDENS DO COMANDO", 28, Estilo.AMBAR, "marca", true)
	_t(v, "FASE %d · %s" % [n, F["nome"].to_upper()], 20, Estilo.TEXTO, "titulo", true)
	_t(v, O["hora"], 15, Estilo.MUDO, "titulo", true)
	var papel := PanelContainer.new()
	papel.add_theme_stylebox_override("panel", Estilo.caixa(Color("e9e0c4"), Color("8d8266"), 2, 4, 14))
	papel.mouse_filter = Control.MOUSE_FILTER_PASS
	papel.add_child(Estilo.rotulo(O["texto"], 19, Color("221d12"), "leitura", false, true))
	v.add_child(papel)
	_t(v, "DO OUTRO LADO", 17, Estilo.AMBAR, "titulo")
	for bot in F["bots"]:
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 10)
		linha.mouse_filter = Control.MOUSE_FILTER_PASS
		var cor := Color(Dados.FACCOES[bot]["cor"])
		linha.add_child(RetratoC.criar(bot, cor, 56.0))
		linha.add_child(Estilo.texto_rico("[color=#%s][b]%s[/b][/color]
%s" % [cor.to_html(false), VidaC.COMANDANTES[bot]["nome"], Dados.PERSO_TXT[Dados.FACCOES[bot]["perso"]]], 15, Estilo.TEXTO))
		v.add_child(linha)
	_t(v, "Para as 3 estrelas: %s." % Dados.OBJETIVOS[F["objetivo"]], 16, Estilo.AMBAR_CLARO)
	v.add_child(Estilo.botao("AO COMBATE ▶", "", func(): comecar_fase(n), true))
	v.add_child(Estilo.botao("← Voltar", "", func(): mostrar_inicio()))

func mostrar_como_jogar() -> void:
	var v := _abrir_tela("ajuda")
	_t(v, "COMO JOGAR", 30, Estilo.AMBAR, "marca")
	for txt in [
		"Arraste o dedo de um exército seu até a província: uma seta mostra o caminho e você confirma. Também dá para tocar no exército, em «Mover / Atacar» e no destino.",
		"Em «Recrutar…» você liga o recrutamento automático. Numa província sua, «Reunir aqui» manda os recrutas para lá sozinhos.",
		"O botão ⚠ mostra o que pede atenção e leva até lá. Os avisos com › também levam ao lugar.",
		"Na batalha, além da postura e da artilharia, há Fumaça (fica difícil acertar você), Carga (quem ataca corre e bate mais, mas apanha mais) e Reforço (tropa de uma província vizinha). Cada um vale uma vez.",
		"Entrar em província sem defesa conquista. Com defesa, há batalha: Avançar pega quem está abrigado, Cobertura protege do fogo e da artilharia, e a artilharia avisa antes de cair.",
		"Economia: moedas criam a tropa e pagam o soldo; aço cria tropa pesada e obras e é gasto por artilharia e blindados; a mão de obra é o máximo de soldados. Toque nos recursos para ver.",
		"Cada soldado tem história: em «Situação», «Veteranos» mostra os melhores e quem caiu. Na Operação, os três melhores seguem para a missão seguinte, e a última é contra um general chefe.",
		"Missões dão prêmios, os inimigos anunciam ofensivas (segurar rende prêmio) e de vez em quando aparece uma escolha.",
		"Vence quem tomar todas as capitais, segurar 60% das províncias por 1 minuto ou tiver mais terra quando o tempo acabar. Perder a sua capital é derrota.",
		"Arraste o mapa (fora das suas tropas) com um dedo e use dois dedos para aproximar. Dá para dar ordens com o jogo pausado."]:
		_t(v, "• " + txt, 17, Estilo.TEXTO)
	v.add_child(Estilo.botao("← Voltar", "", func(): mostrar_inicio(), true))

func mostrar_creditos() -> void:
	var v := _abrir_tela("creditos")
	_t(v, "CRÉDITOS", 30, Estilo.AMBAR, "marca")
	_t(v, "FrontLine: Douglas, com o parceiro Ruan.\n\nSoldados, cavalos, canhões e blindados: desenhados para este jogo.\nExplosões e fumaça: Smoke Particle Assets, Kenney, CC0.\nÍcones: game-icons.net (Lorc, Delapouite e colaboradores), CC BY 3.0.\nMúsicas: Laments of the War, Evil Approach, Battle Theme A e Determined Pursuit (OpenGameArt.org), CC0.\nFontes: Chakra Petch, Barlow Condensed e Black Ops One, SIL OFL 1.1.\nMotor: Godot Engine, licença MIT.", 16, Estilo.TEXTO)
	v.add_child(Estilo.botao("← Voltar", "", func(): mostrar_inicio(), true))

func abrir_ajustes() -> void:
	var veio_do_jogo := _tela_atual == ""
	var antes := jogo.pausado
	if veio_do_jogo:
		jogo.pausado = true
	var fechar := func():
		if veio_do_jogo:
			_esconder_tela()
			jogo.pausado = antes
		else:
			mostrar_inicio()
	_desenhar_ajustes(fechar)

func _desenhar_ajustes(fechar: Callable) -> void:
	var v := _abrir_tela("ajustes")
	_t(v, "AJUSTES", 30, Estilo.AMBAR, "marca")
	for x in [["som", "Efeitos sonoros"], ["musica", "Música"], ["vibracao", "Vibração"], ["camera", "Câmera mostra o que você conquista"], ["imersao", "Cenas de cinema e falas"], ["ver_batalha", "Abrir a batalha animada sozinha"], ["batalha_rapida", "Resolver batalhas sem assistir"]]:
		var chave: String = x[0]
		v.add_child(Estilo.botao(x[1], "Ligado" if config[chave] else "Desligado", func():
			config[chave] = not config[chave]
			gravar_config()
			sons.efeitos = config["som"]
			sons.ligar_musica(config["musica"])
			_aplicar_imersao()
			SonsC.vibracao = config["vibracao"]
			jogo.batalha_rapida = config["batalha_rapida"]
			_desenhar_ajustes.call_deferred(fechar), config[chave]))
	_t(v, "Gráficos", 17, Estilo.TEXTO, "titulo")
	var g := GridContainer.new()
	g.columns = 3
	g.add_theme_constant_override("h_separation", 8)
	for x in [["auto", "Automático", "alivia se engasgar"], ["completo", "Completo", "todos os efeitos"], ["leve", "Leve", "mais fluido"]]:
		var qual: String = x[0]
		g.add_child(Estilo.botao(x[1], x[2], func():
			config["graficos"] = qual
			gravar_config()
			_aplicar_graficos()
			_desenhar_ajustes.call_deferred(fechar), config["graficos"] == qual))
	v.add_child(g)
	_t(v, "Dificuldade dos bots", 17, Estilo.TEXTO, "titulo")
	for x in [["recruta", "Recruta", "bots atacam menos e reagem devagar"], ["soldado", "Soldado", "o equilíbrio padrão"], ["veterano", "Veterano", "bots atacam mais e reagem rápido"]]:
		var id: String = x[0]
		v.add_child(Estilo.botao(x[1], x[2], func():
			config["dificuldade"] = id
			gravar_config()
			jogo.dificuldade = id
			_desenhar_ajustes.call_deferred(fechar), config["dificuldade"] == id))
	v.add_child(Estilo.botao("Rever o tutorial", "o da Fase 1 e as dicas aparecem de novo", func():
		config["guia_feito"] = false
		config["dicas"] = {}
		gravar_config()))
	v.add_child(Estilo.botao("Recomeçar a campanha", "apaga estrelas, reforços, generais, conquistas e a operação", func():
		confirmar("Apagar TODO o progresso da campanha? Não tem volta.", func():
			campanha.apagar()
			recordes.apagar()
			operacao.apagar()
			_apagar_partida()
			_novo_jogo_de_fundo()
			mostrar_inicio(), fechar)))
	v.add_child(Estilo.botao("✔ Pronto", "", fechar, true))

func confirmar(pergunta: String, sim: Callable, nao := Callable()) -> void:
	var veio := _tela_atual
	var v := _abrir_tela("confirmar")
	_t(v, pergunta, 22, Estilo.TEXTO, "titulo", true)
	v.add_child(Estilo.botao("Sim", "", func():
		if veio == "":
			_esconder_tela()
		sim.call(), false, false, true))
	v.add_child(Estilo.botao("Não", "", func():
		if nao.is_valid():
			nao.call()
		else:
			_esconder_tela(), true))

func voltar_ao_menu() -> void:
	salvar_partida()
	if jogo.fim == "":
		jogo.pausado = true
	mostrar_inicio()

func _acabou() -> void:
	_fechar_batalha()
	_resumo.visible = false
	_apagar_partida()
	var o: Dictionary = jogo.origem
	var tipo: String = o.get("modo", "campanha")
	var est := jogo.calcular_estrelas()
	var gen_antes := campanha.generais_liberados().size()
	if tipo == "campanha":
		campanha.guardar_progresso(jogo, est)
	var etapa := {}
	if tipo == "operacao":
		etapa = operacao.resultado(jogo.venceu(), int(o.get("etapa", 0)), jogo.melhores())
	var chave := ""
	if tipo == "campanha":
		chave = "fase%d" % jogo.fase["n"]
	elif tipo == "diario":
		chave = "diario-" + str(o["dia"])
	var saida := recordes.registrar(jogo, {"modo": tipo, "chave": chave, "dia": o.get("dia", ""), "aleatorio": not o.is_empty() and int(o.get("mapa", 0)) == 0, "operacao_completa": etapa.get("completa", false), "estrelas": campanha.total_estrelas()})
	_fim_info = {"modo": tipo, "estrelas": est, "generais": campanha.generais_liberados().slice(gen_antes), "saida": saida, "etapa": etapa}
	sons.tocar("vitoria" if jogo.venceu() else "derrota")
	_mostrar_fim()

func _mostrar_fim() -> void:
	var v := _abrir_tela("fim")
	var F: Dictionary = jogo.fase
	var tipo: String = _fim_info["modo"]
	var est: int = _fim_info["estrelas"]
	var cabeca: String = ("FASE %d VENCIDA!" % F["n"]) if tipo == "campanha" else "VITÓRIA!"
	var titulo: String = {"vitoria": cabeca, "dominio": "VOCÊ DOMINOU O MAPA!", "pontos": "VITÓRIA POR TERRITÓRIO", "tempo": "O TEMPO ACABOU", "dominado": "O INIMIGO DOMINOU O MAPA", "derrota": "SUA CAPITAL CAIU"}[jogo.fim]
	if _fim_info["etapa"].get("completa", false):
		titulo = "OPERAÇÃO COMPLETA!"
	_t(v, titulo, 30, Estilo.AMBAR_CLARO if jogo.venceu() else Color("ff9d8a"), "marca", true)
	var mm := RecordesC.relogio(jogo.t)
	var pl := jogo.placar()
	var texto: String = {"vitoria": "Todas as capitais inimigas tomadas em %s." % mm, "dominio": "Você segurou a maior parte do mapa e venceu em %s." % mm, "pontos": "O tempo acabou e você tem mais províncias (%d)." % pl.get("jogador", 0), "tempo": "Você terminou com %s, menos que o maior inimigo." % Dados.qtd(int(pl.get("jogador", 0)), "província", "províncias"), "dominado": "%s segurou a maior parte do mapa." % (jogo.nome_de(jogo.vencedor_dominio) if jogo.vencedor_dominio != "" else "O inimigo"), "derrota": "Você resistiu %s." % mm}[jogo.fim]
	if jogo.venceu() and tipo == "campanha":
		_t(v, "★".repeat(est) + "☆".repeat(3 - est), 46, Estilo.AMBAR_CLARO, "titulo", true)
	_t(v, texto, 18, Estilo.TEXTO, "normal", true)
	if jogo.venceu() and tipo == "campanha":
		_t(v, "★ vencer\n%s vencer sem ser por pontos em até %d min\n%s %s" % ["★" if jogo.t <= F["tempo"] * 0.7 and jogo.fim != "pontos" else "☆", roundi(F["tempo"] * 0.7 / 60.0), "★" if jogo.objetivo_ok() else "☆", Dados.OBJETIVOS[F["objetivo"]]], 16)
	for g in _fim_info["generais"]:
		_t(v, "Novo general: %s (%s)" % [g["nome"], g["txt"]], 17, Estilo.AMBAR_CLARO)
	var n: int = F["n"]
	if jogo.venceu() and tipo == "campanha":
		_oferta(v, n, func(): _mostrar_fim())
	var etapa: Dictionary = _fim_info["etapa"]
	if tipo == "operacao" and not etapa.is_empty():
		for id in etapa["premios"]:
			v.add_child(Estilo.texto_rico("[b]Reforço ganho: %s[/b]  %s" % [Dados.REFORCOS[id]["nome"], _cartao_reforco(id)], 16, Estilo.TEXTO))
		if not etapa["fim"] and not etapa.get("veteranos", []).is_empty():
			_t(v, "Seguem com você: %s." % ", ".join(etapa["veteranos"]), 16, Estilo.TEXTO)
		if etapa["fim"] and not etapa["completa"]:
			_t(v, "A operação parou na etapa %d." % etapa["etapa"], 17, Estilo.TEXTO)
	if config["imersao"]:
		v.add_child(HistoriaC.jornal(jogo))
	menus.resumo(v, jogo, _fim_info["saida"])
	var o: Dictionary = jogo.origem.duplicate(true)
	if tipo == "campanha":
		if jogo.venceu() and n < Dados.FASES.size():
			v.add_child(Estilo.botao("FASE %d: %s ▶" % [n + 1, Dados.FASES[n]["nome"].to_upper()], "", func(): dar_ordens(n + 1), true))
		v.add_child(Estilo.botao("Jogar a fase %d de novo" % n, "", func(): comecar_fase(n)))
		v.add_child(Estilo.botao("Escolher fase", "", func(): mostrar_inicio()))
		return
	if tipo == "operacao" and operacao.ativa():
		v.add_child(Estilo.botao("PRÓXIMA ETAPA ▶", "", func(): menus.mostrar_operacao(), true))
	elif tipo == "rapida":
		v.add_child(Estilo.botao("Jogar de novo neste mapa", "", func(): comecar_origem(o)))
		v.add_child(Estilo.botao("Montar outra batalha", "", func(): menus.mostrar_rapida(), true))
	elif tipo == "diario":
		v.add_child(Estilo.botao("Tentar de novo", "para melhorar o tempo", func(): comecar_origem(o)))
	v.add_child(Estilo.botao("Menu", "", func(): mostrar_inicio()))

# ------------------------------------------------------------ sistema do celular
func _notification(what: int) -> void:
	match what:
		NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_WM_CLOSE_REQUEST:
			salvar_partida()
		NOTIFICATION_APPLICATION_FOCUS_OUT:
			if jogo and _tela_atual == "" and jogo.fim == "":
				pausar(true)
		NOTIFICATION_WM_GO_BACK_REQUEST:
			_botao_voltar()

func _botao_voltar() -> void:
	if _dica_id != "":
		fechar_dica()
	elif _tela.visible:
		if _tela_atual == "inicio":
			get_tree().quit()
		elif _tela_atual == "carregando":
			pass
		elif _tela_atual in ["ajustes", "confirmar"] and jogo.t > 0.0:
			_esconder_tela()
		else:
			mostrar_inicio()
	elif _cena:
		_fechar_batalha()
	elif not modo.is_empty() or not pendente.is_empty():
		cancelar_ordem()
	elif sel.get("tipo", "") != "prov":
		selecionar({"tipo": "prov", "id": jogo.capital_jogador})
	else:
		voltar_ao_menu()
