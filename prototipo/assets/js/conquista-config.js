// FrontLine · Conquista: Configurações (⚙️ no topo), as mesmas preferências do modo Trincheiras
// Som (ligado, música, efeitos, vibração), Jogo (dificuldade dos bots, texto maior), Conta (apelido e progresso) e Dados.
// Tudo fica em 'frontline-config', o mesmo lugar do Trincheiras: mudar aqui muda lá também.

let configConqAberta = false, configConqAba = 'som', pausaAntesConfig = false;
function lerConfigConq() { try { return Object.assign({ volMusica: 45, volEfeitos: 80, vibracao: true, textoGrande: false, apelido: '', dificuldade: 'soldado' }, JSON.parse(localStorage.getItem('frontline-config')) || {}); } catch (e) { return { volMusica: 45, volEfeitos: 80, vibracao: true, textoGrande: false, apelido: '', dificuldade: 'soldado' }; } }
function gravarConfigConq(mudancas) {
    const c = Object.assign(lerConfigConq(), mudancas);
    try { localStorage.setItem('frontline-config', JSON.stringify(c)); } catch (e) {}
    CONFIG_CONQ = c; aplicarConfigConq();
}
let CONFIG_CONQ = lerConfigConq();
function aplicarConfigConq() {
    const c = CONFIG_CONQ;
    if (SOM.ctx && SOM.musica) SOM.musica.gain.value = 0.35 * Math.max(0, c.volMusica) / 45;
    if (SOM.ctx && SOM.efeitos) SOM.efeitos.gain.value = 0.55 * Math.max(0, c.volEfeitos) / 80;
    if (!SOM.ctx) { SOM.mapa.volume = SOM.batalha.volume = Math.min(1, 0.35 * c.volMusica / 45); }
    document.body.classList.toggle('textoGrande', !!c.textoGrande);
}
// o som só nasce no primeiro toque: aplica o volume escolhido assim que nascer
const iniciarSomOriginal = iniciarSom;
iniciarSom = function () { iniciarSomOriginal(); aplicarConfigConq(); };
// vibração nos alertas (se o aparelho deixar)
const noticiaOriginal = noticia;
noticia = function (txt, alerta) { noticiaOriginal(txt, alerta); if (alerta && CONFIG_CONQ.vibracao && navigator.vibrate) { try { navigator.vibrate(120); } catch (e) {} } };

const DIF_TXT = {
    recruta:  { nome: 'Recruta', desc: 'bots atacam menos, pedem mais vantagem e produzem 10% menos' },
    soldado:  { nome: 'Soldado', desc: 'o equilíbrio padrão' },
    veterano: { nome: 'Veterano', desc: 'bots atacam mais, arriscam mais e produzem 10% mais' }
};
function emailDaConta() {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)) { const d = JSON.parse(localStorage.getItem(k)); const u = d && (d.user || (d.currentSession && d.currentSession.user)); if (u && u.email) return u.email; } } } catch (e) {}
    return null;
}
function abrirConfigConq(aba) {
    configConqAberta = true; configConqAba = aba || configConqAba;
    if (G && !G.online && !G.fim) { pausaAntesConfig = !!G.pausado; G.pausado = true; }
    let m = document.getElementById('configConq');
    if (!m) { m = document.createElement('div'); m.id = 'configConq'; document.body.appendChild(m); }
    m.style.display = 'flex';
    renderConfigConq();
}
function fecharConfigConq() {
    configConqAberta = false;
    const m = document.getElementById('configConq'); if (m) m.style.display = 'none';
    if (G && !G.online && !G.fim) G.pausado = pausaAntesConfig;
}
function renderConfigConq() {
    const m = document.getElementById('configConq'); if (!m) return;
    const c = CONFIG_CONQ, a = configConqAba, meta = lerMeta();
    const linhaTog = (rot, sub, on, acao) => `<div class="cfgLinha"><div><b>${rot}</b><small>${sub}</small></div><button class="mini" onclick="${acao}">${on ? 'Ligado' : 'Desligado'}</button></div>`;
    const barra = (rot, chave, v) => `<div class="cfgLinha col"><div class="cfgTopo"><b>${rot}</b><span>${v}%</span></div><input type="range" min="0" max="100" step="5" value="${v}" oninput="gravarConfigConq({ ${chave}: +this.value }); this.previousElementSibling.lastChild.textContent = this.value + '%'"></div>`;
    let corpo = '';
    if (a === 'som') {
        corpo = linhaTog('Som', 'música e efeitos', SOM.ligado, 'alternarSom();renderConfigConq()') + barra('Música', 'volMusica', c.volMusica) + barra('Efeitos', 'volEfeitos', c.volEfeitos)
            + linhaTog('Vibração', 'o celular vibra nos alertas de ataque', c.vibracao, `gravarConfigConq({ vibracao: ${!c.vibracao} });renderConfigConq()`)
            + '<div class="sub">Os volumes valem também no modo Trincheiras.</div>';
    } else if (a === 'jogo') {
        corpo = `<div class="sub" style="margin-bottom:6px">Dificuldade dos bots (vale na campanha; no online, a do anfitrião):</div>` +
            Object.entries(DIF_TXT).map(([id, d]) => `<button class="cfgOpcao${c.dificuldade === id ? ' on' : ''}" onclick="gravarConfigConq({ dificuldade: '${id}' });renderConfigConq()"><b>${d.nome}</b><small>${d.desc}</small></button>`).join('')
            + `<div class="cfgLinha"><div><b>Tutorial da Fase 1</b><small>mostra de novo as dicas ao começar a Fase 1</small></div><button class="mini" onclick="guiaReiniciar();this.textContent='Feito'">Rever</button></div>`
            + linhaTog('Texto maior', 'letras maiores no painel e nas telas', c.textoGrande, `gravarConfigConq({ textoGrande: ${!c.textoGrande} });renderConfigConq()`);
    } else if (a === 'conta') {
        const email = emailDaConta(), vencidas = Object.values(meta.estrelas).filter(v => v > 0).length;
        corpo = `<div class="cfgLinha col"><b>Apelido</b><small>aparece para os outros no online e no ranking</small>
                <input class="campoOn" maxlength="18" value="${(c.apelido || '').replace(/"/g, '&quot;')}" onchange="gravarConfigConq({ apelido: this.value.trim() })" placeholder="Seu apelido"></div>
            <div class="cfgLinha"><div><b>${email ? 'Conta FrontLine' : 'Sem conta'}</b><small>${email ? email : 'progresso salvo só neste aparelho'}</small></div><a class="mini" style="text-decoration:none;text-align:center;padding:8px" href="${linkMenu()}">${email ? 'Conta' : 'Entrar'}</a></div>
            <div class="cfgGrade"><div><small>Estrelas</small><b>${totalEstrelas(meta)}</b></div><div><small>Fases vencidas</small><b>${vencidas}/${FASES.length}</b></div><div><small>Generais</small><b>${generaisLiberados().length}/${GENERAIS.length}</b></div></div>
            <div class="sub">Para entrar ou criar conta, use o botão acima (abre o menu do jogo, entre pelo modo Trincheiras).</div>`;
    } else if (a === 'dados') {
        corpo = `<div class="cfgLinha"><div><b>Apagar a partida salva</b><small>a fase em andamento some; o progresso da campanha fica</small></div><button class="mini" onclick="if(confirm('Apagar a partida salva da Conquista?')){apagarSalvamento();renderConfigConq();}">Apagar</button></div>
            <div class="cfgLinha"><div><b>Recomeçar a campanha</b><small>apaga estrelas, fases liberadas e a experiência dos generais</small></div><button class="mini perigo" onclick="if(confirm('Apagar TODO o progresso da campanha da Conquista? Não tem volta.')){try{localStorage.removeItem('frontline-conquista-meta');localStorage.removeItem('frontline-conquista-fase');}catch(e){} apagarSalvamento(); renderConfigConq();}">Apagar</button></div>`;
    }
    const abas = [['som', '🔊 Som'], ['jogo', '🎮 Jogo'], ['conta', '👤 Conta'], ['dados', '🗂 Dados']];
    m.innerHTML = `<div class="cfgCaixa"><div class="cfgTitulo"><b>⚙️ CONFIGURAÇÕES</b><button class="mini" onclick="fecharConfigConq()">✖</button></div>
        <div class="cfgAbas">${abas.map(([id, t]) => `<button class="${a === id ? 'on' : ''}" onclick="configConqAba='${id}';renderConfigConq()">${t}</button>`).join('')}</div>
        <div class="cfgCorpo">${corpo}</div>
        <a class="voltarMenu" href="${linkMenu()}" onclick="salvarPartida()">🏠 Menu principal</a></div>`;
}
// dificuldade dos bots: a campanha e o anfitrião leem daqui
function DIFC() { const d = ({ recruta: { vontade: 0.75, margem: 1.15, prod: 0.9 }, veterano: { vontade: 1.2, margem: 0.9, prod: 1.1 } })[CONFIG_CONQ.dificuldade] || { vontade: 1, margem: 1, prod: 1 }; const f = (typeof G !== 'undefined' && G && G.fase && G.fase.botFacil) || 1; return { vontade: d.vontade * f, margem: d.margem, prod: d.prod * f }; } // botFacil: a fase pode deixar os bots mais calmos
aplicarConfigConq();

// ---------- Visual pixel art do mapa: o desenho vetorial já pintado vira blocos de 3 px, com poucas cores ----------
let pxPequeno = null;
function pixelarMapa() {
    const S = 3 * DPR(), w = Math.ceil(cvM.width / S), h = Math.ceil(cvM.height / S);
    if (!pxPequeno) pxPequeno = document.createElement('canvas');
    if (pxPequeno.width !== w || pxPequeno.height !== h) { pxPequeno.width = w; pxPequeno.height = h; }
    const g = pxPequeno.getContext('2d', { willReadFrequently: true });
    g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = true; g.clearRect(0, 0, w, h);
    g.drawImage(cvM, 0, 0, cvM.width, cvM.height, 0, 0, w, h);
    let im = null; try { im = g.getImageData(0, 0, w, h); } catch (e) { im = null; } // (aberto como arquivo, a imagem é 'de outra origem': fica só o efeito de blocos)
    const d = im ? im.data : [];
    // suaviza o ruído (cada bloco vira a média dele com os vizinhos em cruz) e achata o brilho em poucos degraus, mantendo o matiz: áreas lisas e bordas nítidas, sem trama
    if (im) {
        const o = new Uint8ClampedArray(d);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
                const v = o[i + c] * 2 + o[(y > 0 ? i - w * 4 : i) + c] + o[(y < h - 1 ? i + w * 4 : i) + c] + o[(x > 0 ? i - 4 : i) + c] + o[(x < w - 1 ? i + 4 : i) + c];
                d[i + c] = v / 6;
            }
            const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, q = Math.max(20, Math.round(lum / 26) * 26), k = lum > 1 ? q / lum : 1;
            d[i] = Math.min(255, d[i] * k); d[i + 1] = Math.min(255, d[i + 1] * k); d[i + 2] = Math.min(255, d[i + 2] * k);
        }
    }
    if (im) g.putImageData(im, 0, 0);
    cxM.setTransform(1, 0, 0, 1, 0, 0); cxM.imageSmoothingEnabled = false;
    cxM.drawImage(pxPequeno, 0, 0, w, h, 0, 0, w * S, h * S);
    cxM.setTransform(DPR(), 0, 0, DPR(), 0, 0);
}
// Soldados do mapa em sprite pixel (grupos só de infantaria/metralhadora; artilharia, cavalaria e blindados seguem como antes)
const PX_SOLD = { img: new Image(), q: { 265: [737, 632, 29, 33], 290: [268, 755, 22, 33], 291: [301, 755, 22, 33], 292: [334, 754, 22, 34], 293: [367, 755, 22, 33] }, tinta: {}, ok: false };
PX_SOLD.img.onload = () => { PX_SOLD.ok = true; };
PX_SOLD.img.src = 'assets/pixel/soldados.png';
const desenharBonecoClassico = desenharBoneco;
desenharBoneco = function (x, y, cor, andando, n, agora, dir = 1, tipos) {
    const quantos = n >= 10 ? 3 : n >= 4 ? 2 : 1, fig = figurasDoGrupo(tipos, quantos);
    if (!PX_SOLD.ok) return desenharBonecoClassico(x, y, cor, andando, n, agora, dir, tipos);
    const folga = fig.some(t => TIPO_ESPECIAL[t]) ? 32 : 12;
    for (let k = quantos - 1; k >= 0; k--) {
        const t = fig[k], bx = x + (k - (quantos - 1) / 2) * folga * dir, by = y - k * 2;
        if (TIPO_ESPECIAL[t]) { // artilharia, cavalaria e blindado: pixel por código
            cxM.fillStyle = 'rgba(0,0,0,.35)'; cxM.fillRect(Math.round(bx - 11), Math.round(by), 22, 2);
            desenharTropaEspecial(cxM, t, bx, by, cor, true, andando, 1, dir, true);
            continue;
        }
        if (t === 'metr') desenharTropaEspecial(cxM, 'metr', bx - 9 * dir, by, cor, true, andando, 1, dir, true);
        const id = andando ? [290, 291, 292, 293][Math.floor(agora * 8 + k) % 4] : 265;
        const q = PX_SOLD.q[id], chave = id + cor;
        let c = PX_SOLD.tinta[chave];
        if (!c) {
            c = PX_SOLD.tinta[chave] = document.createElement('canvas'); c.width = q[2]; c.height = q[3];
            const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; g.drawImage(PX_SOLD.img, q[0], q[1], q[2], q[3], 0, 0, q[2], q[3]);
            pxPintarTime(c, g, cor);
        }
        cxM.fillStyle = 'rgba(0,0,0,.35)'; cxM.fillRect(Math.round(bx - 7), Math.round(by), 14, 2);
        cxM.save(); cxM.imageSmoothingEnabled = false; cxM.translate(Math.round(bx), Math.round(by)); cxM.scale(dir, 1);
        const F = 1.1; cxM.drawImage(c, Math.round(-11 * F), Math.round(-q[3] * F), Math.round(q[2] * F), Math.round(q[3] * F)); cxM.restore();
        cxM.fillStyle = cor; cxM.fillRect(Math.round(bx - 2), Math.round(by - q[3] * F - 6), 5, 5); cxM.strokeStyle = 'rgba(0,0,0,.7)'; cxM.lineWidth = 1; cxM.strokeRect(Math.round(bx - 2) + 0.5, Math.round(by - q[3] * F - 6) + 0.5, 4, 4);
    }
    return (quantos - 1) / 2 * folga;
};

// Todo o time com a mesma cor: o uniforme inteiro vira a cor do país (pele e contorno preto ficam)
const pxRgb = (h) => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const pxCorMais = (h, k) => '#' + pxRgb(h).map(v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('');
function pxPintarTime(c, g, cor) {
    let im = null; try { im = g.getImageData(0, 0, c.width, c.height); } catch (e) { im = null; }
    if (!im) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.8; g.fillStyle = cor; g.fillRect(0, 0, c.width, c.height); return; } // (aberto como arquivo: sem leitura de pixels)
    const d = im.data, [R, G, B] = pxRgb(cor);
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 20) continue;
        const r = d[i], gg = d[i + 1], b = d[i + 2], lum = r * 0.3 + gg * 0.59 + b * 0.11;
        if (r > 170 && gg > 110 && b > 90 && r > gg + 15) continue; // pele
        if (lum < 45) continue;                                    // contorno e arma
        const k = 0.6 + lum / 255 * 0.85;
        d[i] = Math.min(255, R * k); d[i + 1] = Math.min(255, G * k); d[i + 2] = Math.min(255, B * k);
    }
    g.putImageData(im, 0, 0);
}

// Artilharia, cavalaria, blindados e metralhadora em pixel (desenhados por código, na cor do time)
const PX_BMP = {
    blind: ['..........kkkkkk........', '.........kcllcck........', '.........kccccckkkkkkkkk', '..kkkkkkkkkcccccck......', '.kcccllcccccccccccck.....', '.kdcccccccccccccccdk.....', '.kddddddddddddddddk......', '..kgkgkgkgkgkgkgkk.......', '...kkkkkkkkkkkkkk........'],
    cav: ['.........kkk..............', '........kcccs.............', '........kcccsk............', '.........kcck..........kk.', '........kccccck.......kbbk', '........kcccccckkkkkkkkbbbk', '..kk.kkkkcccccckbbbbbbbbbbk', '.kbbkkbbbcccccbbbbbbbbbbbbk', 'kbbbbbbbbbbbbbbbbbbbbbkkkk.', '.kbbbbbbbbbbbbbbbbbbbbk....', '..kbbbbbbbbbbbbbbbbbbk.....', '..kbbkbbk......kbbkkbbk....', '..kbbkbbk......kbbkkbbk....', '..kkkkkkk......kkkkkkk.....'],
    art: ['.............kkkkkk....', '...........kkggggggkk..', '.........kkgggggggkkk..', '..kkkkk.kkgggggggkk....', '.kcccccckkgggggkk......', 'kccddcccckggkkk........', 'kcdkkkdcck.............', 'kcdkgkdcck.............', 'kcdkkkdcck.............', '.kccdddcck.............', '..kkkkkkk..............'],
    metr: ['.......kkkkkkkkk', '.kk...kkggggggggk', '..kk.kkkkkkkk', '...kkgkk', '..kg..gk', '.kg....gk']
};
function desenharTropaEspecial(cx, tipo, x, y, cor, amigo, andando, esc = 1, dir = 1, subir = amigo) {
    const bmp = PX_BMP[tipo]; if (!bmp) return;
    const u = tipo === 'metr' ? 1.3 : 1.5 * esc, W = Math.max(...bmp.map(l => l.length));
    const pal = { k: '#10130f', c: cor, d: pxCorMais(cor, 0.6), l: pxCorMais(cor, 1.35), g: '#7b837b', b: '#5a4128', s: '#e2b996' };
    const bob = tipo === 'cav' && andando ? Math.round(Math.sin(Date.now() / 90)) : 0;
    cx.save(); cx.translate(Math.round(x), Math.round(y)); cx.scale(dir, 1);
    bmp.forEach((lin, j) => { for (let i = 0; i < lin.length; i++) { const ch = lin[i]; if (ch === '.') continue; cx.fillStyle = pal[ch]; cx.fillRect(Math.round((i - W / 2) * u), Math.round((j - bmp.length) * u + (j < 10 ? bob : 0)), Math.ceil(u), Math.ceil(u)); } });
    cx.restore();
}
