// FrontLine · Trincheiras: visual PIXEL ART (teste, ligado em Configurações > "Visual pixel art" ou com ?pixel=1)
// Carregado depois de 05-cena.js e antes de 06/07/08, que se encaixam por cima.
// O estilo clássico continua intacto: cada função abaixo só muda o desenho quando o modo pixel está ligado.
// Arte dos soldados: "Tiny Soldiers of The Old World Wars" (OpenGameArt, CC0), ver assets/pixel/LICENCA.txt.
// Cenário e cômodos são desenhados por código, em blocos.

const PX_QUADROS = {"5":[213,3,39,33],"6":[268,3,39,33],"7":[317,3,43,33],"8":[368,4,42,32],"9":[419,3,30,33],"10":[470,3,33,33],"11":[521,4,34,32],"21":[7,53,25,33],"22":[60,57,31,34],"35":[105,72,45,21],"36":[156,74,45,19],"50":[291,97,24,35],"51":[330,98,25,34],"52":[365,99,25,33],"53":[400,98,25,34],"54":[435,97,25,35],"55":[470,97,25,35],"56":[501,98,24,34],"57":[540,99,22,33],"58":[571,98,24,34],"59":[614,98,20,35],"60":[656,99,20,34],"61":[698,100,20,33],"64":[11,142,20,33],"65":[53,141,20,34],"66":[87,139,24,35],"67":[142,140,23,34],"68":[193,141,29,33],"69":[244,141,41,33],"70":[295,143,26,31],"71":[346,141,29,33],"72":[397,140,23,34],"73":[449,140,25,32],"74":[499,139,14,33],"75":[535,140,23,32],"76":[583,139,14,33],"88":[16,192,35,35],"89":[68,192,35,35],"90":[113,212,35,21],"91":[166,209,36,24],"92":[221,203,35,30],"93":[275,212,35,21],"94":[339,192,35,35],"104":[3,239,45,35],"105":[58,239,45,35],"106":[113,239,49,35],"107":[168,239,35,35],"108":[455,239,35,35],"109":[496,239,29,32],"110":[761,223,41,15],"111":[209,240,35,34],"112":[250,241,35,33],"113":[291,241,35,33],"114":[332,240,35,34],"115":[373,240,35,34],"116":[414,240,35,34],"117":[553,241,27,30],"118":[606,241,28,28],"119":[658,242,36,28],"120":[709,242,36,28],"124":[3,287,41,15],"125":[65,287,41,15],"126":[127,287,41,15],"127":[189,287,56,15],"128":[251,287,40,15],"129":[313,287,41,15],"130":[375,287,41,15],"138":[751,288,35,15],"211":[344,477,63,35],"212":[419,477,53,35],"213":[496,479,51,32],"214":[571,479,51,32],"215":[646,479,51,32],"216":[719,479,41,15],"217":[747,456,41,15],"218":[49,480,53,31],"219":[108,480,53,31],"220":[167,480,53,31],"221":[226,480,53,33],"222":[285,480,53,33],"223":[467,498,15,11],"224":[470,486,15,14],"255":[283,605,53,34],"256":[352,610,54,29],"257":[426,614,50,25],"258":[482,614,64,25],"259":[552,614,64,25],"260":[622,603,49,35],"265":[737,632,29,33],"266":[789,632,22,34],"269":[143,685,49,35],"270":[211,686,51,34],"275":[737,674,41,32],"281":[765,715,41,32],"282":[548,724,34,34],"283":[602,725,39,33],"284":[656,725,39,33],"285":[709,724,45,34],"290":[268,755,22,33],"291":[301,755,22,33],"292":[334,754,22,34],"293":[367,755,22,33],"294":[400,755,22,33],"295":[433,755,22,33],"296":[466,755,22,33],"297":[499,755,22,34]};
const pixelAtivo = () => (typeof CONFIG !== 'undefined' && CONFIG.pixel === true) || /[?&]pixel=1/.test(location.search);
const pxImg = new Image(), pxTanque = new Image();
let pxPronto = false;
pxImg.onload = () => { pxPronto = true; assinaturaFundo = ''; };
pxImg.src = musicBase + 'assets/pixel/soldados.png';
pxTanque.src = musicBase + 'assets/pixel/blindado.png';

// Cores de cada soldado (lenço e faixa do capacete): dá para reconhecer quem é quem sem ler o nome
const PX_COR_SOLDADO = { 1: '#e5483d', 2: '#3d8be5', 3: '#e8c53a', 4: '#f2f2ee', 5: '#e88a2a', 6: '#a96be5' };
const pxVariantes = {};
function pxQuadro(id, s, vermelho) {
    const q = PX_QUADROS[id]; if (!q || !pxPronto) return null;
    const chave = id + '|' + (s ? s.id + s.class : '-') + (vermelho ? 'r' : '');
    if (pxVariantes[chave]) return pxVariantes[chave];
    const PAD = 7, c = document.createElement('canvas'); c.width = q[2] + PAD; c.height = q[3];
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(pxImg, q[0], q[1], q[2], q[3], PAD, 0, q[2], q[3]);
    if (vermelho) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(210,40,40,0.62)'; g.fillRect(0, 0, c.width, c.height); }
    else if (s) {
        const cor = PX_COR_SOLDADO[s.id] || '#ddd', deitado = q[3] < 20, hx = PAD + (deitado ? q[2] - 13 : (q[2] >= 29 ? 8 : 6));
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = cor;
        if (deitado) g.fillRect(hx, 1, 9, 2);
        else { g.fillRect(hx, 3, 9, 1); g.fillRect(hx, 11, 9, 2); }          // faixa do capacete e lenço
        g.globalCompositeOperation = 'source-over';
        if (s.class === 'Médico' && !deitado) { g.fillStyle = '#f4f4ee'; g.fillRect(hx - 1, 15, 5, 5); g.fillStyle = '#c4242a'; g.fillRect(hx + 1, 16, 1, 3); g.fillRect(hx, 17, 3, 1); } // braçadeira com cruz
        if (s.class === 'Engenheiro' && !deitado) { g.globalCompositeOperation = 'destination-over'; g.fillStyle = '#6b4a2a'; g.fillRect(PAD - 4, 8, 1, 16); g.fillStyle = '#9aa0a0'; g.fillRect(PAD - 6, 24, 5, 5); g.globalCompositeOperation = 'source-over'; } // pá nas costas
        if (s.class === 'Atirador de Elite' && !deitado) { g.fillStyle = '#111'; g.fillRect(hx + 9, 12, 5, 1); g.fillStyle = '#6ad0ff'; g.fillRect(hx + 12, 11, 1, 1); } // luneta
        if (s.rank === 'Sgt.' && !deitado) { g.fillStyle = '#f2d34a'; g.fillRect(hx - 1, 17, 3, 1); g.fillRect(hx - 1, 19, 3, 1); } // divisas do sargento
    }
    return pxVariantes[chave] = { c, PAD, w: q[2], h: q[3] };
}
// Desenha um quadro com os pés em (x, y); ancora = coluna do corpo no quadro; flip vira para a esquerda
function pxDesenha(id, x, y, esc, flip, s, vermelho, ancora) {
    const v = pxQuadro(id, s, vermelho); if (!v) return false;
    const w = v.c.width * esc, h = v.c.height * esc, cx = (ancora !== undefined ? ancora : 11 + v.PAD) * esc;
    cctx.save(); cctx.imageSmoothingEnabled = false;
    cctx.translate(Math.round(x), Math.round(y));
    if (flip) cctx.scale(-1, 1);
    cctx.drawImage(v.c, Math.round(-cx), Math.round(-h), Math.round(w), Math.round(h));
    cctx.restore(); return true;
}

// ---------- campo de batalha na vista lateral: nossa trincheira à esquerda, o inimigo vem da direita ----------
const PX_X0 = 118, PX_X1 = 388;
const _px_posInimigoCena = posInimigoCena;
posInimigoCena = function (e) {
    if (!pixelAtivo()) return _px_posInimigoCena(e);
    const d = Math.max(0, Math.min(300, e.distance)), faixa = Math.round((((e.offsetX || 0) + 200) / 400) * 2);
    return { x: PX_X0 + (d / 300) * (PX_X1 - PX_X0), y: CORTE.SOLO - 3 - faixa * 4 };
};
const _px_assinaturaDoFundo = assinaturaDoFundo;
assinaturaDoFundo = function () { return _px_assinaturaDoFundo() + (pixelAtivo() ? '|px' + (pxPronto ? 1 : 0) : ''); };

const PX_CEU = [['#7f9a96', '#b8c0a4'], ['#5b6f66', '#a98f6c'], ['#0b1222', '#1d2a3c'], ['#070b14', '#111a28']];
const pxRuido = (i) => ((i * 2654435761) >>> 0) % 1000 / 1000;
function pxMix(a, b, k) { const p = (h) => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
const _px_desenharCeuFundo = desenharCeuFundo;
desenharCeuFundo = function () {
    if (!pixelAtivo()) return _px_desenharCeuFundo();
    const per = periodoDoDia(), S = CORTE.SOLO, [a, b] = PX_CEU[per];
    for (let i = 0; i < 6; i++) { cctx.fillStyle = i < 3 ? a : (i < 5 ? pxMix(a, b, 0.5) : b); cctx.fillRect(0, i * 18, CORTE.W, 19); } // céu em faixas
    if (per >= 2) { cctx.fillStyle = '#dfe6ee'; for (let i = 0; i < 30; i++) cctx.fillRect(Math.floor(pxRuido(i) * 396), Math.floor(pxRuido(i + 50) * 70), i % 5 ? 1 : 2, i % 5 ? 1 : 2); cctx.fillStyle = '#efe8c8'; cctx.fillRect(326, 20, 12, 12); cctx.fillStyle = a; cctx.fillRect(331, 19, 9, 9); }
    cctx.fillStyle = per >= 2 ? '#0a1018' : '#4a5a4c';                          // colinas em degraus
    for (let x = 0; x < 400; x += 8) cctx.fillRect(x, S - 34 - Math.floor(Math.abs(Math.sin(x * 0.04)) * 9) - (x % 56 < 8 ? 4 : 0), 8, 40);
    cctx.fillStyle = per >= 2 ? '#0d141c' : '#3b4a3d';
    for (let x = 0; x < 400; x += 8) cctx.fillRect(x, S - 22 - Math.floor(Math.abs(Math.sin(x * 0.07 + 1)) * 6), 8, 30);
    cctx.fillStyle = per >= 2 ? '#05080c' : '#1c2118';                          // árvores queimadas
    [[150, 70], [240, 66], [300, 72], [372, 64]].forEach(([x, y]) => { cctx.fillRect(x, y, 3, S - y); cctx.fillRect(x - 6, y + 8, 7, 2); cctx.fillRect(x + 3, y + 16, 8, 2); });
    const solo = ['#5a4a33', '#4b3d2a', '#3d3223'];                             // terra de ninguém em faixas
    for (let i = 0; i < 4; i++) { cctx.fillStyle = solo[Math.min(2, i)]; cctx.fillRect(0, S - 14 + i * 6, CORTE.W, 7); }
    cctx.fillStyle = '#6b5a3e'; for (let i = 0; i < 70; i++) cctx.fillRect(Math.floor(pxRuido(i + 9) * 398), S - 13 + Math.floor(pxRuido(i + 99) * 19), 2, 1);
    cctx.fillStyle = '#2f2a1f'; for (let i = 0; i < 40; i++) cctx.fillRect(Math.floor(pxRuido(i + 300) * 398), S - 12 + Math.floor(pxRuido(i + 400) * 19), 3, 1);
    const xAlc = Math.round(PX_X0 + (140 / 300) * (PX_X1 - PX_X0));             // linha de alcance e arame como marcos verticais
    cctx.fillStyle = 'rgba(217,163,90,0.55)'; for (let y = 16; y < S - 14; y += 6) cctx.fillRect(xAlc, y, 1, 3);
    txtC(xAlc + 3, 12, 'ALCANCE 140m', 'rgba(230,180,100,0.95)', 7, 700, 'left', 8.5);
    const ars = arsenalDe();
    if (ars.arame > 0) {
        const xa = Math.round(PX_X0 + (50 / 300) * (PX_X1 - PX_X0));
        cctx.fillStyle = '#4a3a28'; for (let k = 0; k < 3; k++) cctx.fillRect(xa - 6 + (k % 2) * 12, S - 24, 2, 22);
        cctx.fillStyle = `rgba(190,190,180,${0.4 + 0.6 * ars.arame / 100})`;
        for (let k = 0; k < 4; k++) for (let x = xa - 6; x < xa + 8; x += 2) cctx.fillRect(x, S - 22 + k * 5 + ((x >> 1) % 2), 2, 1);
        txtC(xa + 12, S - 28, `ARAME ${Math.ceil(ars.arame)}%`, '#b9b9ac', 6.5, 700, 'left', 8.5);
    }
    for (let r = 0; r < 3; r++) for (let x = (r % 2) * 7 - 7; x < 112; x += 14) { // parapeito de sacos de areia
        const y = S - 18 + r * 8; if (r === 0 && x > 98) continue;
        cctx.fillStyle = '#8a7c5a'; cctx.fillRect(x, y, 13, 7); cctx.fillStyle = '#a89a74'; cctx.fillRect(x, y, 13, 2); cctx.fillStyle = '#5d533f'; cctx.fillRect(x, y + 6, 13, 1); cctx.fillRect(x + 12, y, 1, 7);
    }
};

const _px_desenharNuvens = desenharNuvens;
desenharNuvens = function (t) {
    if (!pixelAtivo()) return _px_desenharNuvens(t);
    const noite = periodoDoDia() >= 2;
    cctx.fillStyle = noite ? 'rgba(120,140,160,0.10)' : 'rgba(230,230,215,0.16)';
    const off = (t / 120) % 440;
    [[20, 22, 56], [140, 38, 40], [240, 16, 64]].forEach(([x, y, w]) => { const xx = ((x + off) % 440) - 50; cctx.fillRect(Math.round(xx), y, w, 5); cctx.fillRect(Math.round(xx + 8), y - 4, w - 20, 5); });
    cctx.fillStyle = noite ? 'rgba(90,110,130,0.18)' : 'rgba(180,185,165,0.22)'; // névoa baixa em faixas
    cctx.fillRect(0, CORTE.SOLO - 22, CORTE.W, 6); cctx.fillRect(0, CORTE.SOLO - 14, CORTE.W, 4);
};

// ---------- inimigos como sprites ----------
const PX_INIM = { infantaria: [50, 51], patrulha: [64, 50], infiltrado: [5, 6], sapador: [88, 89] };
const _px_desenharInimigosCena = desenharInimigosCena;
desenharInimigosCena = function (t) {
    if (!pixelAtivo() || !pxPronto) return _px_desenharInimigosCena(t);
    if (!temVisao()) {
        cctx.fillStyle = 'rgba(5,7,6,0.88)'; cctx.fillRect(0, 0, CORTE.W, CORTE.SOLO - 2);
        txtC(200, 60, 'NENHUM SOLDADO EM VIGÍLIA', '#c0392b', 10, 700, 'center', 11);
        txtC(200, 78, 'o esquadrão atira às cegas', '#b3c4ae', 8, 500, 'center', 9.5);
        return;
    }
    const maisPerto = gameState.enemies.slice().sort((a, b) => a.distance - b.distance).slice(0, 4), usados = [];
    gameState.enemies.slice().sort((a, b) => b.distance - a.distance).forEach(e => {
        if (typeof inimigoOculto === 'function' && inimigoOculto(e)) return;
        const p = posInimigoCena(e), fase = Math.floor(t / 230 + (e.offsetX || 0) * 0.07);
        const vida = Math.max(0, Math.min(1, e.hp / (e.maxHp || e.hp || 1)));
        const ferido = (e.hp < (e.maxHp || e.hp)) && Math.floor(t / 90) % 7 === 0;
        cctx.fillStyle = 'rgba(0,0,0,0.3)'; cctx.fillRect(Math.round(p.x - 9), Math.round(p.y - 1), 18, 2);
        let topo = 36;
        if (e.type === 'drone') {
            const y = Math.round(p.y - 34 + Math.sin(fase * 1.3) * 2), x = Math.round(p.x);
            cctx.fillStyle = '#1a2024'; cctx.fillRect(x - 6, y, 12, 4); cctx.fillStyle = '#7a8a90'; cctx.fillRect(x - 10, y - 2, 20, 1);
            cctx.fillStyle = fase % 2 ? '#ff3b30' : '#501410'; cctx.fillRect(x - 1, y + 4, 2, 2);
            topo = 42;
        } else if (e.type === 'blindado') {
            if (pxTanque.complete && pxTanque.naturalWidth) {
                cctx.save(); cctx.imageSmoothingEnabled = false; cctx.translate(Math.round(p.x), Math.round(p.y + 6)); cctx.scale(-0.27, 0.27);
                cctx.drawImage(pxTanque, (fase % 3) * 200, 0, 200, 200, -100, -200, 200, 200); cctx.restore();
            }
            topo = 40;
        } else {
            const ids = PX_INIM[e.type] || PX_INIM.infantaria;
            pxDesenha(ids[fase % ids.length], p.x, p.y, 1, true, null, ferido, 13);
        }
        if (typeof desenharExtraInimigo === 'function') desenharExtraInimigo(e, p, 1, t);
        if (vida < 0.98 && e.type !== 'drone') { cctx.fillStyle = '#000'; cctx.fillRect(Math.round(p.x - 8), Math.round(p.y - topo - 3), 16, 3); cctx.fillStyle = vida > 0.5 ? '#d46a6a' : '#ff9a5c'; cctx.fillRect(Math.round(p.x - 7), Math.round(p.y - topo - 2), Math.round(14 * vida), 1); }
        if (maisPerto.includes(e) || e.type === 'blindado') {
            const ry = p.y - topo - 7;
            if (!usados.some(r => Math.abs(r.x - p.x) < 28 && Math.abs(r.y - ry) < 9)) { usados.push({ x: p.x, y: ry }); txtC(p.x, ry, `${Math.round(e.distance)}m`, '#f4a094', 7, 700, 'center', 8.5); }
        }
    });
};

// ---------- tiros: saem do parapeito, não dos cômodos ----------
const _px_desenharTirosCena = desenharTirosCena;
desenharTirosCena = function (pos, t) {
    if (!pixelAtivo()) return _px_desenharTirosCena(pos, t);
    if (!temVisao() || jogoPausado) return;
    const alvos = gameState.enemies.filter(e => e.distance <= TIRO.ALCANCE && e.hp > 0);
    if (!alvos.length) return;
    Object.entries(pos).forEach(([id, p]) => {
        if (p.comodo !== 'posto' && p.comodo !== 'ninhos') return;
        if (Math.random() > (p.comodo === 'ninhos' ? 0.35 : 0.12)) return;
        const e = alvos[Math.floor(Math.random() * alvos.length)], pe = posInimigoCena(e);
        disparosCena[id] = t;
        const ox = 96 + Math.random() * 14, oy = CORTE.SOLO - 24 + (p.comodo === 'ninhos' ? 4 : 0);
        if (typeof emiteDisparo === 'function') emiteDisparo(ox, oy);
        if (CONFIG.rastros) { cctx.fillStyle = p.comodo === 'ninhos' ? '#ffb347' : '#ffe08a'; const n = 14, dx = (pe.x - ox) / n, dy = (pe.y - 18 - oy) / n; for (let k = 0; k < n; k += 2) cctx.fillRect(Math.round(ox + dx * k), Math.round(oy + dy * k), 2, 1); }
    });
};

// ---------- cômodos em tábuas e vigas ----------
const _px_desenharComodoBase = desenharComodoBase;
desenharComodoBase = function (chave) {
    if (!pixelAtivo()) return _px_desenharComodoBase(chave);
    const c = CORTE.comodos[chave], noite = periodoDoDia() >= 2;
    cctx.fillStyle = '#2a2016'; cctx.fillRect(c.x, c.y, c.w, c.h);
    for (let y = c.y + 2; y < c.y + c.h - 4; y += 8) { cctx.fillStyle = (y / 8 | 0) % 2 ? '#3a2c1e' : '#33271a'; cctx.fillRect(c.x + 2, y, c.w - 4, 7); } // tábuas
    cctx.fillStyle = '#1e160e'; for (let y = c.y + 9; y < c.y + c.h - 4; y += 8) cctx.fillRect(c.x + 2, y, c.w - 4, 1);
    for (let vx = c.x + 2; vx < c.x + c.w; vx += Math.max(40, c.w / 3)) { cctx.fillStyle = '#5a4128'; cctx.fillRect(Math.round(vx), c.y, 5, c.h); cctx.fillStyle = '#7a5a38'; cctx.fillRect(Math.round(vx), c.y, 1, c.h); } // vigas
    cctx.fillStyle = '#5a4128'; cctx.fillRect(c.x, c.y, c.w, 5); cctx.fillStyle = '#7a5a38'; cctx.fillRect(c.x, c.y, c.w, 1);
    cctx.fillStyle = '#7a5a38'; cctx.fillRect(c.x, c.y + c.h - 5, c.w, 5); cctx.fillStyle = '#4a3520'; cctx.fillRect(c.x, c.y + c.h - 1, c.w, 1);
    cctx.fillStyle = '#4a3520'; cctx.fillRect(c.x, c.y, 2, c.h); cctx.fillRect(c.x + c.w - 2, c.y, 2, c.h);
    if (noite) { cctx.fillStyle = 'rgba(255,190,90,0.10)'; cctx.fillRect(c.x + 2, c.y + 5, c.w - 4, c.h - 10); }
    cctx.fillStyle = '#16100a'; cctx.fillRect(c.x + 3, c.y + 3, Math.round(6 + c.nome.length * 4.6), 12);
    txtC(c.x + 6, c.y + 12, c.nome, '#f0b765', 8, 700, 'left', 10);
};

// ---------- soldado: sprite; o resto (nome, vida, avisos, seleção) continua sendo desenhado pelo 05-cena ----------
const PX_ESC_SOLDADO = 1.5;
const _px_desenharSilhueta = desenharSilhueta;
desenharSilhueta = function (s, x, y, pose, t) {
    if (!pixelAtivo() || !pxPronto) return _px_desenharSilhueta(s, x, y, pose, t);
    const ferido = (feridosRecentes.get(s.id) || 0) > 0 && Math.floor(t / 80) % 2 === 0;
    const atirou = t - (disparosCena[s.id] || -9999) < 130, bob = Math.round(Math.sin(t / 400 + s.id) * 0.8);
    let id = 265, ax = 18, yy = y + 2;
    if (pose === 'mira') id = atirou ? 275 : (Math.floor(t / 1800 + s.id) % 5 === 0 ? 266 : 265);
    else if (pose === 'ninho') { id = 211 + (atirou ? 1 + (Math.floor(t / 70) % 3) : 0); ax = 24; }
    else if (pose === 'come') { id = 266; yy += bob; }
    else if (pose === 'trabalho') { id = [290, 291, 292, 293][Math.floor(t / 180) % 4]; yy -= Math.abs(Math.round(Math.sin(t / 150) * 1.5)); }
    else if (pose === 'deitado') { id = 124; ax = 27; yy = y + 3; }
    else if (pose === 'panico' || pose === 'encolhido') { id = 138; ax = 27; yy = y + 3; }
    else if (pose === 'arrastado') id = [290, 291, 292, 293][Math.floor(t / 110) % 4];
    if (!PX_QUADROS[id]) id = 265;
    pxDesenha(id, pose === 'panico' ? x + Math.round(Math.sin(t / 40) * 1.2) : x, yy, PX_ESC_SOLDADO, false, s, ferido, ax);
    if (pose === 'trabalho') { const a = Math.sin(t / 150) > 0 ? 0 : 5; cctx.fillStyle = '#9aa0a0'; cctx.fillRect(Math.round(x + 14), Math.round(y - 22 + a), 3, 3); cctx.fillStyle = '#6b4a2a'; cctx.fillRect(Math.round(x + 15), Math.round(y - 19 + a), 1, 8); }
    if (pose === 'come') { cctx.fillStyle = '#c8c8bc'; cctx.fillRect(Math.round(x + 10), Math.round(y - 26), 5, 3); cctx.fillStyle = '#6b5a3a'; cctx.fillRect(Math.round(x + 11), Math.round(y - 27), 3, 1); }
    return true;
};

// ---------- fundo completo: céu/campo/parapeito, terra por baixo, cômodos e móveis (sem degradês nem vinheta) ----------
const _px_desenharFundoCompleto = desenharFundoCompleto;
desenharFundoCompleto = function () {
    if (!pixelAtivo()) return _px_desenharFundoCompleto();
    desenharCeuFundo();
    const S = CORTE.SOLO;
    cctx.fillStyle = '#2b2118'; cctx.fillRect(0, S + 14, CORTE.W, CORTE.H - S);
    cctx.fillStyle = '#35291d'; for (let y = S + 14; y < CORTE.H; y += 10) cctx.fillRect(0, y, CORTE.W, 4);
    cctx.fillStyle = '#463726'; for (let i = 0; i < 160; i++) cctx.fillRect(Math.floor(pxRuido(i + 700) * 398), S + 16 + Math.floor(pxRuido(i + 900) * (CORTE.H - S - 20)), 2, 1);
    cctx.fillStyle = '#1c150e'; for (let i = 0; i < 120; i++) cctx.fillRect(Math.floor(pxRuido(i + 1100) * 398), S + 16 + Math.floor(pxRuido(i + 1300) * (CORTE.H - S - 20)), 3, 2);
    Object.keys(CORTE.comodos).forEach(desenharComodoBase);
    desenharMoveisFundo();
    const per = periodoDoDia();
    if (per >= 2) { cctx.fillStyle = 'rgba(8,18,40,0.22)'; cctx.fillRect(0, 0, CORTE.W, CORTE.H); }
    else if (per === 1) { cctx.fillStyle = 'rgba(255,170,80,0.06)'; cctx.fillRect(0, 0, CORTE.W, CORTE.H); }
};
