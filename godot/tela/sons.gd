class_name SonsC
extends Node
## Efeitos feitos por código (como no jogo web) e as músicas do mapa e da batalha em rodízio.

var efeitos := true
var musica_ligada := true
var _sons := {}
var _tocadores: Array = []
var _proximo := 0
var _ultimo := {}
var _musica := AudioStreamPlayer.new()
var _faixa := ""
var _listas := {"mapa": ["lament_of_the_war", "evil_approach"], "batalha": ["battle_theme_a", "determined_pursuit"]}
var _indice := {"mapa": 0, "batalha": 0}
## percussão por cima da música: o volume acompanha o aperto da batalha
var _tambores := AudioStreamPlayer.new()
var _tensao := 0.0
var _tensao_alvo := 0.0
var _ambiente := AudioStreamPlayer.new()
var _ambiente_qual := ""
## as músicas têm média perto de -19 dB; com -14 sumiam no alto-falante do celular
const MUSICA_DB := -6.0
## quanto a música sobe quando a batalha aperta (os picos ficam abaixo do máximo)
const MUSICA_APERTO_DB := 2.0

## cada tropa atira com o próprio som
const SOM_DA_TROPA := {"inf": "tiro", "metr": "rajada", "art": "obus", "cav": "galope", "blind": "canhaozinho"}

func _ready() -> void:
	_sons["tiro"] = _onda(0.2, func(t, k, r): return (r * 0.75 + sin(TAU * 130.0 * t) * 0.35) * pow(1.0 - k, 4.0))
	_sons["explosao"] = _onda(1.2, func(t, k, r): return (r * 0.6 + sin(TAU * (68.0 - 30.0 * k) * t) * 0.75) * pow(1.0 - k, 2.2), 0.16)
	_sons["canhao"] = _onda(0.7, func(t, k, r): return (r * 0.4 + sin(TAU * (90.0 - 50.0 * k) * t)) * pow(1.0 - k, 3.0), 0.2)
	_sons["assobio"] = _onda(2.0, func(t, k, _r): return sin(TAU * (1500.0 * t - 290.0 * t * t)) * 0.2 * sin(PI * minf(1.0, k * 1.05)))
	_sons["abate"] = _onda(0.24, func(t, k, r): return (r * 0.35 + sin(TAU * 95.0 * t) * 0.6) * pow(1.0 - k, 3.0), 0.12)
	_sons["toque"] = _onda(0.07, func(t, k, _r): return sin(TAU * 720.0 * t) * 0.35 * (1.0 - k))
	_sons["alerta"] = _onda(0.45, func(t, _k, _r): return (signf(sin(TAU * (660.0 if t < 0.2 else 520.0) * t)) * 0.18) * (0.0 if t > 0.17 and t < 0.21 else 1.0))
	_sons["recrutar"] = _onda(0.18, func(t, k, _r): return _melodia(t, [880.0, 1175.0], 0.07) * (1.0 - k) * 0.7)
	_sons["ordem"] = _onda(0.2, func(t, k, _r): return _melodia(t, [523.0, 659.0], 0.08) * (1.0 - k) * 0.7)
	_sons["espiao"] = _onda(0.3, func(t, k, _r): return _melodia(t, [1047.0, 1319.0], 0.13) * (1.0 - k) * 0.4)
	_sons["conquista"] = _onda(0.6, func(t, k, _r): return _melodia(t, [392.0, 494.0, 587.0, 784.0], 0.11) * (1.0 - pow(k, 3.0)))
	_sons["perda"] = _onda(0.7, func(t, k, _r): return _melodia(t, [330.0, 262.0, 196.0], 0.17) * (1.0 - pow(k, 3.0)))
	_sons["vitoria"] = _onda(1.2, func(t, k, _r): return _melodia(t, [523.0, 659.0, 784.0, 1047.0, 784.0, 1047.0], 0.17) * (1.0 - pow(k, 3.0)))
	_sons["derrota"] = _onda(1.4, func(t, k, _r): return _melodia(t, [392.0, 349.0, 311.0, 262.0], 0.34) * (1.0 - pow(k, 2.0)))
	# metralhadora: quatro estalos secos em sequência
	_sons["rajada"] = _onda(0.34, func(t, _k, r):
		var q := fmod(t, 0.082)
		return (r * 0.8 + sin(TAU * 190.0 * q) * 0.4) * pow(maxf(0.0, 1.0 - q / 0.06), 3.0))
	# peça de artilharia: estouro grave com cauda
	_sons["obus"] = _onda(0.85, func(t, k, r): return (r * 0.55 * pow(1.0 - k, 6.0) + sin(TAU * (74.0 - 34.0 * k) * t) * 0.95 * pow(1.0 - k, 2.4)), 0.35)
	_sons["canhaozinho"] = _onda(0.45, func(t, k, r): return (r * 0.6 * pow(1.0 - k, 5.0) + sin(TAU * (130.0 - 60.0 * k) * t) * 0.8 * pow(1.0 - k, 3.0)), 0.5)
	# cavalaria: o galope e o tiro
	_sons["galope"] = _onda(0.42, func(t, _k, r):
		var batida := 0.0
		for quando in [0.0, 0.09, 0.2]:
			var d: float = t - quando
			if d >= 0.0 and d < 0.06:
				batida += sin(TAU * 105.0 * d) * pow(1.0 - d / 0.06, 2.0)
		return batida * 0.8 + (r * 0.6 * pow(maxf(0.0, 1.0 - t / 0.08), 4.0) if t < 0.08 else 0.0), 0.45)
	_sons["ferrolho"] = _onda(0.16, func(t, _k, r):
		var estalo := 0.0
		for quando in [0.0, 0.1]:
			var d: float = t - quando
			if d >= 0.0 and d < 0.025:
				estalo += (r * 0.7 + sin(TAU * 2100.0 * d) * 0.4) * (1.0 - d / 0.025)
		return estalo * 0.5)
	# apito de oficial para a carga
	_sons["apito"] = _onda(0.9, func(t, k, r): return (sin(TAU * 2350.0 * t + sin(TAU * 38.0 * t) * 2.6) * 0.34 + r * 0.03) * minf(1.0, t / 0.03) * (1.0 - pow(k, 6.0)))
	_sons["fumaca"] = _onda(1.5, func(_t, k, r): return r * 0.6 * minf(1.0, k * 9.0) * pow(1.0 - k, 1.6), 0.55)
	# clima de guerra: canhão ao longe, passarinho na calmaria e o chiado do rádio
	_sons["longe"] = _onda(1.8, func(t, k, r): return (r * 0.45 + sin(TAU * (46.0 - 16.0 * k) * t) * 0.8) * minf(1.0, t / 0.02) * pow(1.0 - k, 2.6), 0.07)
	_sons["passaro"] = _onda(0.9, _piado)
	_sons["radio"] = _onda(0.55, func(t, k, r):
		var bipe := sin(TAU * 1240.0 * t) * 0.3 if (t < 0.07 or (t > 0.43 and t < 0.5)) else 0.0
		return bipe + r * (0.22 if t > 0.07 and t < 0.43 else 0.0) * (0.55 + 0.45 * sin(TAU * 17.0 * t)) * (1.0 - k * 0.4))
	_sons["chuva"] = _em_volta(_onda(2.4, func(_t, _k, r): return r * 0.34, 0.6))
	_sons["vento"] = _em_volta(_onda(4.0, func(t, k, r): return r * (0.3 + 0.22 * sin(TAU * k * 2.0)) + sin(TAU * 62.0 * t) * 0.015, 0.045))
	_sons["tambores"] = _em_volta(_onda(2.5, _batuque, 0.3))
	for i in 12:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_tocadores.append(p)
	_musica.volume_db = MUSICA_DB
	add_child(_musica)
	_tambores.stream = _sons["tambores"]
	_tambores.volume_db = -60.0
	add_child(_tambores)
	add_child(_ambiente)
	_musica.finished.connect(_proxima_musica)

## marcha em 96 batidas por minuto: bumbo nos tempos e caixa repicando
func _batuque(t: float, _k: float, r: float) -> float:
	var v := 0.0
	for quando in [0.0, 0.625, 1.25, 1.875, 2.1875]:
		var d: float = t - quando
		if d >= 0.0 and d < 0.3:
			v += sin(TAU * (88.0 - 90.0 * d) * d) * pow(1.0 - d / 0.3, 2.5) * 0.85
	for quando in [0.3125, 0.9375, 1.5625, 1.71875, 2.34375, 2.421875]:
		var d: float = t - quando
		if d >= 0.0 and d < 0.07:
			v += r * pow(1.0 - d / 0.07, 3.0) * 0.5
	return v

## amostras que sobram depois do ponto de volta (cópia do começo do som)
const FOLGA_DA_VOLTA := 64

## O misturador do Godot lê algumas amostras além do ponto de volta para suavizar o som.
## Sem essa sobra ele lê fora da memória, e no Android o jogo fechava sozinho na batalha.
static func _em_volta(w: AudioStreamWAV) -> AudioStreamWAV:
	var n := int(w.data.size() / 2.0)
	var dados := w.data
	dados.append_array(dados.slice(0, FOLGA_DA_VOLTA * 2))
	w.data = dados
	w.loop_mode = AudioStreamWAV.LOOP_FORWARD
	w.loop_begin = 0
	w.loop_end = n
	return w

## três piados curtos, cada um subindo um pouco
func _piado(t: float, _k: float, _r: float) -> float:
	var v := 0.0
	for quando in [0.02, 0.2, 0.56]:
		var d: float = t - quando
		if d >= 0.0 and d < 0.11:
			v += sin(TAU * (2900.0 * d + 5200.0 * d * d) + sin(TAU * 31.0 * d) * 1.8) * sin(PI * d / 0.11) * 0.3
	return v

## canhões distantes o tempo todo; passarinhos só quando não há combate
var clima_de_guerra := true
var _proximo_clima := 5.0

func _soar_ao_longe(dt: float) -> void:
	if not clima_de_guerra or not efeitos:
		return
	_proximo_clima -= dt
	if _proximo_clima > 0.0:
		return
	var lutando := _tensao_alvo > 0.02
	_proximo_clima = randf_range(3.0, 7.0) if lutando else randf_range(6.0, 13.0)
	if not lutando and _ambiente_qual == "" and randf() < 0.55:
		tocar("passaro", -19.0, randf_range(0.85, 1.15))
	else:
		tocar("longe", -13.0 if lutando else -18.0, randf_range(0.75, 1.15))

## de 0 (calmo) a 1 (batalha no limite)
func tensao(v: float) -> void:
	_tensao_alvo = clampf(v, 0.0, 1.0)

## som de fundo da batalha ("chuva", "vento" ou "")
func ambiente(qual: String) -> void:
	if not efeitos:
		qual = ""
	if qual == _ambiente_qual:
		return
	_ambiente_qual = qual
	_ambiente.stop()
	if qual != "":
		_ambiente.stream = _sons[qual]
		_ambiente.volume_db = -19.0
		_ambiente.play()

func _process(dt: float) -> void:
	_soar_ao_longe(dt)
	_tensao = move_toward(_tensao, _tensao_alvo if musica_ligada else 0.0, dt * 0.6)
	if _tensao > 0.02:
		_tambores.volume_db = linear_to_db(_tensao * 0.75) - 8.0
		if not _tambores.playing:
			_tambores.play()
	elif _tambores.playing:
		_tambores.stop()
	# a música sobe um pouco junto
	_musica.volume_db = MUSICA_DB + _tensao * MUSICA_APERTO_DB

static var vibracao := true

static func vibrar(ms: int) -> void:
	if vibracao:
		Input.vibrate_handheld(ms)

func tocar(nome: String, db := -7.0, tom := 1.0) -> void:
	if not efeitos or not _sons.has(nome):
		return
	var agora := Time.get_ticks_msec()
	var minimo: int = {"tiro": 70, "rajada": 240, "obus": 220, "canhaozinho": 180, "galope": 260, "ferrolho": 400, "abate": 150, "alerta": 1200, "recrutar": 80}.get(nome, 50)
	if agora - _ultimo.get(nome, -10000) < minimo:
		return
	_ultimo[nome] = agora
	var p: AudioStreamPlayer = _tocadores[_proximo]
	_proximo = (_proximo + 1) % _tocadores.size()
	p.stream = _sons[nome]
	p.volume_db = db
	p.pitch_scale = tom * (randf_range(0.92, 1.1) if nome == "tiro" or nome == "explosao" else 1.0)
	p.play()

func musica(qual: String) -> void:
	if qual == _faixa and (_musica.playing or not musica_ligada):
		return
	_faixa = qual
	_musica.stop()
	if musica_ligada and qual != "":
		_proxima_musica()

func ligar_musica(v: bool) -> void:
	musica_ligada = v
	if not v:
		_musica.stop()
	else:
		var q := _faixa
		_faixa = ""
		musica(q)

func _proxima_musica() -> void:
	if _faixa == "" or not musica_ligada:
		return
	var l: Array = _listas[_faixa]
	var arquivo := "res://som/%s.mp3" % l[_indice[_faixa] % l.size()]
	_indice[_faixa] += 1
	if not ResourceLoader.exists(arquivo): # a cópia leve de teste vai sem as músicas
		return
	_musica.stream = load(arquivo)
	_musica.play()

func _melodia(t: float, notas: Array, dur: float) -> float:
	var f: float = notas[mini(notas.size() - 1, int(t / dur))]
	return (sin(TAU * f * t) + 0.3 * sin(TAU * f * 2.0 * t)) * 0.3

func _onda(dur: float, f: Callable, suave := 1.0) -> AudioStreamWAV:
	var taxa := 22050
	var n := int(taxa * dur)
	var dados := PackedByteArray()
	dados.resize(n * 2)
	var filtro := 0.0
	for i in n:
		filtro += (randf_range(-1.0, 1.0) - filtro) * suave
		var v: float = f.call(float(i) / taxa, float(i) / n, filtro * (1.0 if suave >= 1.0 else 2.4))
		dados.encode_s16(i * 2, int(clampf(v, -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = taxa
	w.data = dados
	return w
