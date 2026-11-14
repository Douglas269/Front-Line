// FrontLine · modo CONQUISTA (campanha contra bots, estilo mapa de guerra)
// Página própria (conquista.html), com o mapa gerado em conquista-mapa.js. O modo Trincheiras não muda.
/* ==========================================================================
   Mapa grande com províncias. Você tem EXÉRCITOS: toca num exército, escolhe o destino
   (qualquer província) e quantos soldados vão. Tropa que entra em província inimiga
   sem defesa conquista; com defesa, tem batalha (até 2 minutos, na trincheira).
   Todo soldado precisa comer. Os bots seguem as mesmas regras: recrutam e defendem sempre,
   atacam de vez em quando, erram (esquecem comida, deixam a casa vazia, avaliam mal).
   O espião viaja até a província, não luta: só traz informação.
   Campanha: fase 1 Fronteira, fase 2 Região central, fase 3 A capital.
   ========================================================================== */
const SPRITES = { mira: { w: 170, h: 211, ax: 62, ay: 208 }, andando: { w: 142, h: 197, ax: 87, ay: 193 } };
const IMG = {};
const TIPO_COR = [['inf', 'I', '#e8e4d0', 'Inf'], ['metr', 'M', '#f4d03f', 'Metr'], ['art', 'A', '#ff7f50', 'Art'], ['cav', 'C', '#5dade2', 'Cav'], ['blind', 'B', '#c39bd3', 'Blind']]; // cor de cada tropa no mapa
Object.keys(SPRITES).forEach(k => { const im = new Image(); im.src = 'assets/soldados/' + k + '.png'; IMG[k] = im; });

// ---------- Equilíbrio ----------
const C = {
    CICLO: 5,                 // segundos de mapa por ciclo de economia
    PROD: {                   // por província, por ciclo
        capital:  { comida: 3, mun: 5, moedas: 6 },
        cidade:   { comida: 1, mun: 2, moedas: 4 },
        campo:    { comida: 3, mun: 0, moedas: 1 },
        floresta: { comida: 1, mun: 3, moedas: 0 },
        morro:    { comida: 0, mun: 5, moedas: 1 }
    },
    FOME_CICLO: 10, COME_SE: 30, COME_ALIVIA: 30, // cada soldado come 1 de comida a cada ~15 s: o tamanho do exército depende dos campos
    RECRUTAR: 20, RECRUTAR_EXTRA: 1, TROPA_BASE: 16, // cada soldado acima de 12 encarece o próximo em 2 moedas
    FORTIFICAR: 25, FORT_GANHO: 15, TRINCH_BASE: 40, TRINCH_CAPITAL: 70,
    ESPIAO: 15, ESPIAO_DURA: 60, ESPIAO_VEL: 45, ESPIAO_MAX: 2,
    ARTILHARIA: 30, SAQUE_PARTE: 0.3,
    VEL: 12,                  // velocidade dos exércitos (unidades do mapa por segundo)
    BAT_RITMO: 4,             // a batalha corre no próprio mapa, 4× mais rápido que o relógio de 2 minutos
    BAT_DURACAO: 120, DIST: 300, VELBAT: { avancar: 14, cobertura: 6, recuar: -12 },
    TIRO_DEF: 0.18, TIRO_ATQ: 0.16, DANO_TIRO: 30, TRINCH_PROTEGE: 0.5, TRINCH_PROTEGE_CORPO: 0.2, CORPO_A_CORPO: 0.45, // a trincheira reduz o tiro de quem ataca (e, com o 2º número, o corpo a corpo)
    BLINDADO_RECEBE: 0.35,  // fração do dano que o blindado leva de tiros que não são de artilharia
    CAPITAL_DEFESA: 1.25,     // capital defende 25% melhor
    BOT_PENSA: 8, BOT_PENSA_VAR: 6,
    BOT_PAUSA_ATAQUE: 40,     // depois de atacar, o bot espera pelo menos isto para atacar de novo
    BOT_MARGEM: 1.35          // só ataca quando acha que tem 35% a mais de força
};
const CAPITULOS = ['Capítulo 1 · A Fronteira', 'Capítulo 2 · O Coração do País'];
const FASES = [
    { n: 1, cap: 0, nome: 'Fronteira', semente: 1101, celulas: 52, mar: 0.05, W: 860, H: 1120, bots: ['bravo', 'charlie', 'delta'], tempo: 900, extra: 1, milicia: 0, objetivo: 'semPerder' },
    { n: 2, cap: 0, nome: 'O Rio', semente: 4409, celulas: 56, mar: 0.12, W: 900, H: 1160, bots: ['bravo', 'charlie'], tempo: 840, extra: 1, milicia: 0, botFacil: 0.75, objetivo: 'pesquisa', regra: 'industria', regraTxt: 'região industrial: obras custam metade' },
    { n: 3, cap: 0, nome: 'Região central', semente: 2207, celulas: 66, mar: 0.05, W: 980, H: 1280, bots: ['bravo', 'charlie', 'delta', 'echo'], tempo: 1080, extra: 2, milicia: 1, objetivo: 'capitais' },
    { n: 4, cap: 1, nome: 'Inverno', semente: 5521, celulas: 70, mar: 0.06, W: 1000, H: 1300, bots: ['bravo', 'delta', 'echo'], tempo: 1140, extra: 2, milicia: 0, objetivo: 'baixas', regra: 'inverno', regraTxt: 'inverno: campos produzem 40% menos comida' },
    { n: 5, cap: 1, nome: 'Aliança frágil', semente: 6637, celulas: 76, mar: 0.05, W: 1040, H: 1360, bots: ['bravo', 'charlie', 'delta', 'echo'], tempo: 1260, extra: 3, milicia: 0, objetivo: 'rebeldes', regra: 'paz', regraTxt: 'começa em paz com Charlie (que pode virar aliado… ou não)' },
    { n: 6, cap: 1, nome: 'A capital', semente: 3301, celulas: 86, mar: 0.05, W: 1100, H: 1440, bots: ['bravo', 'charlie', 'delta', 'echo'], tempo: 1200, extra: 2, milicia: 1, capitalForte: 'delta', objetivo: 'capitais' }
];
const NOMES_JOG = ['Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Mendes', 'Rocha', 'Lima', 'Souza', 'Alves', 'Pereira', 'Nunes', 'Barros', 'Dias'];
const FACCOES = {
    jogador: { nome: 'Você', cor: '#6fd06a' },
    bravo:   { nome: 'Bravo', cor: '#e0533f', perso: 'agressivo', esquece: 0.25, coragem: 0.9, vontade: 0.5, reserva: 5 },
    charlie: { nome: 'Charlie', cor: '#e3a23b', perso: 'ladrão', esquece: 0.12, coragem: 1.1, vontade: 0.45, reserva: 10 },
    delta:   { nome: 'Delta', cor: '#a77bd9', perso: 'defensivo', esquece: 0.05, coragem: 1.6, vontade: 0.3, reserva: 20 },
    echo:    { nome: 'Echo', cor: '#4f9fd9', perso: 'oportunista', esquece: 0.15, coragem: 1.0, vontade: 0.45, reserva: 10 },
    neutro:  { nome: 'Milícia', cor: '#9a9a86', perso: 'neutra' }
};
const PERSO_TXT = {
    agressivo: 'agressivo: ataca mais que os outros e às vezes deixa a casa vazia',
    'ladrão': 'ladrão: prefere saquear moedas a conquistar',
    defensivo: 'defensivo: fortifica e junta tropa; ataca pouco, mas com força',
    oportunista: 'oportunista: ataca quem acabou de sair para brigar',
    neutra: 'milícia local: não ataca ninguém, só se defende. Quem chegar primeiro leva.'
};
const TIPO_TXT = { capital: '★ Capital', cidade: '🏘 Cidade', campo: '🌾 Campo', floresta: '🌲 Floresta', morro: '⛰ Morro' };

let G, MAPA, TERRENO;
let proxId = 1;
function soldado(nome, tipo = 'inf') { return { nome, tipo, vida: TROPAS[tipo].vida, fome: 10, cansaco: 0 }; }
const vivos = (l) => l.filter(s => s.vida > 0);
const eficacia = (s) => (s.vida / 100) * (1 - 0.55 * Math.max(0, s.fome - 40) / 60) * (1 - 0.3 * s.cansaco / 100);
const forca = (lista) => lista.reduce((t, s) => t + (s.vida > 0 ? eficacia(s) : 0), 0);
const corFome = (s) => s.vida <= 0 ? '#444' : s.fome >= 75 ? '#e0533f' : s.fome >= 50 ? '#e3b04b' : '#7bc96f';
const provDe = (dono) => Object.values(G.prov).filter(p => p.dono === dono);
const minhas = () => provDe('jogador');
const exDe = (dono) => G.ex.filter(e => e.dono === dono);
const parado = (e) => !e.rota.length && !e.emBatalha;
const exParadosEm = (id, dono) => G.ex.filter(e => e.prov === id && parado(e) && (!dono || e.dono === dono));
const tropaDe = (dono) => exDe(dono).reduce((t, e) => t + e.s.length, 0);
const custoRecrutarTipo = (dono, tipo) => TROPAS[tipo].custo + C.RECRUTAR_EXTRA * Math.max(0, tropaDe(dono) - C.TROPA_BASE);
const custoRecrutar = (dono) => custoRecrutarTipo(dono, 'inf');
function custoVariosTipo(dono, tipo, n) { let t = 0; const tropa = tropaDe(dono); for (let k = 0; k < n; k++) t += TROPAS[tipo].custo + C.RECRUTAR_EXTRA * Math.max(0, tropa + k - C.TROPA_BASE); return t; }
// velocidade do exército: o mais lento manda; estradas, general e ferrovia no destino ajudam
function velEx(e) {
    let v = C.VEL * Math.min(...e.s.map(s => TROPAS[s.tipo || 'inf'].vel), 1.6);
    if (temPesq(e.dono, 'estradas')) v *= 1.2;
    v *= bonusGeneral(e, 'vel');
    const prox = e.rota.length ? G.prov[e.rota[0]] : null;
    if (prox && prox.obras.ferrovia && prox.dono === e.dono) v *= 2;
    return v;
}
const ehCidade = (p) => p.tipo === 'cidade' || p.tipo === 'capital';
const vivoNoJogo = (dono) => dono === 'jogador' || dono === 'neutro' || !G.eliminados[dono];
function noticia(txt, alerta) { if (alerta && typeof som === 'function') som('alerta'); G.noticias.unshift({ txt, alerta, t: G.t }); G.noticias = G.noticias.slice(0, 30); }
/* ---------- Salvamento (no aparelho) ----------
   A partida é gravada a cada poucos segundos, ao trocar de aba e ao sair. O mapa não vai no
   salvamento: ele sai sempre igual da semente da fase; só vão os donos, as tropas e os recursos. */
const SAVE_CONQ = 'frontline-conquista-partida';
function salvarPartida() {
    if (!G || G.fim || G.semSalvar || G.online) return false; // online não salva
    const dados = {
        v: 2, fase: G.fase.n, t: G.t, fac: G.fac, ciclo: G.ciclo, velocidade: G.velocidade, proxId, pesq: G.pesq, rel: G.rel, genFerido: G.genFerido, genXp: G.genXp, stats: G.stats,
        capitalJogador: G.capitalJogador, espiado: G.espiado, revelado: G.revelado, espioes: G.espioes,
        ultimoAtaque: G.ultimoAtaque, eliminados: G.eliminados, pensar: G.pensar, noticias: G.noticias.slice(0, 10), ultimoRelatorio: G.ultimoRelatorio,
        prov: Object.fromEntries(Object.values(G.prov).map(p => [p.id, { dono: p.dono, tipo: p.tipo, trinch: p.trinch, capital: p.capital, moral: p.moral, obras: p.obras, obra: p.obra, conquistadaEm: p.conquistadaEm }])),
        ex: G.ex.map(e => ({ id: e.id, dono: e.dono, s: e.s, prov: e.prov, de: e.de, rota: e.rota, x: e.x, y: e.y, missao: e.missao, origem: e.origem, alertado: e.alertado, general: e.general })),
        salvoEm: Date.now()
    };
    try { localStorage.setItem(SAVE_CONQ, JSON.stringify(dados)); return true; } catch (e) { return false; }
}
function lerSalvamento() { try { const d = JSON.parse(localStorage.getItem(SAVE_CONQ) || 'null'); return d && d.v === 2 && FASES[d.fase - 1] ? d : null; } catch (e) { return null; } }
function apagarSalvamento() { try { localStorage.removeItem(SAVE_CONQ); } catch (e) {} }
function carregarPartida() {
    const d = lerSalvamento(); if (!d) return false;
    novoJogo(d.fase);
    Object.entries(d.prov).forEach(([id, q]) => { if (G.prov[id]) Object.assign(G.prov[id], q); });
    Object.assign(G, { t: d.t, fac: d.fac, ciclo: d.ciclo, velocidade: d.velocidade || 1, capitalJogador: d.capitalJogador, espiado: d.espiado || {}, revelado: d.revelado || {},
        espioes: d.espioes || [], ultimoAtaque: d.ultimoAtaque || {}, eliminados: d.eliminados || {}, pensar: d.pensar || G.pensar, noticias: d.noticias || [], ultimoRelatorio: d.ultimoRelatorio,
        pesq: d.pesq || G.pesq, rel: d.rel || G.rel, genFerido: d.genFerido || {}, genXp: d.genXp || {}, stats: d.stats || {} });
    G.ex = d.ex.filter(e => G.prov[e.prov]).map(e => ({ ...e, rota: (e.rota || []).filter(id => G.prov[id]), emBatalha: false, aguarda: null }));
    proxId = Math.max(proxId, d.proxId || 0);
    G.sel = { tipo: 'prov', id: G.capitalJogador }; G.pausado = true;
    resolverOcupacoes(); // quem estava lutando dentro de território inimigo volta para a batalha
    noticia('💾 Partida carregada. Está pausada: toque em ▶ para continuar.');
    const c = G.prov[G.capitalJogador]; centralizar(c.x, c.y);
    return true;
}
function lerFase() { let n = 1; FASES.forEach(F => { if (faseLiberada(F.n)) n = F.n; }); return n; } // a última fase liberada

/* ---------- Começo de uma fase ---------- */
function novoJogo(numFase) {
    const F = FASES[(numFase || 1) - 1];
    MAPA = gerarMapa(F);
    const r = rngSemente(F.semente + 7);
    G = {
        fase: F, t: 0, fim: null, sel: null, modo: null, pendente: null, noticias: [], espiado: {}, revelado: {}, espioes: [],
        ultimoAtaque: {}, eliminados: {}, batalhas: [], ciclo: 0, ex: [], velocidade: 1,
        fac: { jogador: { comida: 40, mun: 150, moedas: 50 }, neutro: { comida: 0, mun: 100, moedas: 0 } },
        prov: {}, pensar: {}, pausado: false,
        pesq: { jogador: { feitas: {}, atual: null } }, rel: {}, genFerido: {}, genXp: {}, stats: {}
    };
    F.bots.forEach((b, i) => { G.fac[b] = { comida: 40, mun: 150, moedas: b === 'delta' ? 70 : 50 }; G.pensar[b] = 60 + i * 12 + r() * 10; G.pesq[b] = { feitas: {}, atual: null }; G.rel[b] = novaRelacao(); });
    if (F.regra === 'paz' && G.rel.charlie) { G.rel.charlie.estado = 'paz'; G.rel.charlie.ate = 300; }
    MAPA.prov.forEach(pm => {
        const t = r(), tipo = t < 0.38 ? 'campo' : t < 0.58 ? 'floresta' : t < 0.74 ? 'morro' : 'cidade';
        G.prov[pm.id] = { id: pm.id, nome: pm.nome, x: pm.x, y: pm.y, viz: pm.viz, poli: pm.poli, path: caminhoDe(pm.poli), dono: 'neutro', tipo, trinch: C.TRINCH_BASE, capital: false, moral: 60, obras: {}, obra: null };
    });
    const lista = Object.values(G.prov);
    // capitais: a sua embaixo, no meio; as dos bots o mais longe possível umas das outras
    const capJ = lista.filter(p => p.viz.length >= 3).sort((a, b) => (b.y - Math.abs(a.x - MAPA.W / 2) * 0.6) - (a.y - Math.abs(b.x - MAPA.W / 2) * 0.6))[0];
    const capitais = [capJ];
    const donoCap = { [capJ.id]: 'jogador' };
    F.bots.forEach(b => {
        const c = lista.filter(p => !capitais.includes(p) && p.viz.length >= 3).sort((a, z) => dmin(z) - dmin(a))[0];
        capitais.push(c); donoCap[c.id] = b;
        function dmin(p) { return Math.min(...capitais.map(q => Math.hypot(q.x - p.x, q.y - p.y))); }
    });
    function dmin(p) { return Math.min(...capitais.map(q => Math.hypot(q.x - p.x, q.y - p.y))); }
    capitais.forEach(c => {
        const dono = donoCap[c.id];
        Object.assign(c, { dono, tipo: 'capital', capital: true, capitalDe: dono, trinch: C.TRINCH_CAPITAL }); // capitalDe: de quem é a capital de verdade (não muda quando ela é conquistada)
        // províncias iniciais em volta: a primeira é sempre um campo (comida)
        const livres = c.viz.map(id => G.prov[id]).filter(p => p.dono === 'neutro' && !p.capital).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        livres.slice(0, F.extra).forEach((p, k) => { p.dono = dono; p.moral = 85; if (k === 0) p.tipo = 'campo'; criarExercito(dono, p.id, 2); });
        const ex = criarExercito(dono, c.id, dono === F.capitalForte ? 14 : dono === 'delta' ? 10 : 8);
        if (dono === 'delta') ex.s.slice(0, 2).forEach(s => { s.tipo = 'metr'; }); // Delta começa com 2 metralhadoras na capital
        c.moral = 100;
        if (dono === F.capitalForte) { c.trinch = 100; c.obras.forte = true; }
    });
    // milícias nas províncias livres
    lista.filter(p => p.dono === 'neutro').forEach(p => criarExercito('neutro', p.id, (p.tipo === 'cidade' ? 4 : p.tipo === 'campo' ? 2 : 3) + F.milicia));
    TERRENO = pintarTerreno(MAPA, lista, F.semente, Math.min(2, Math.sqrt(4.2e6 / (MAPA.W * MAPA.H)))); // até ~4 milhões de pixels (leve no celular)
    G.capitalJogador = capJ.id;
    G.sel = { tipo: 'prov', id: capJ.id };
    generalDosBots();
    if (generaisLiberados().length) G.ex.find(e => e.dono === 'jogador' && e.prov === capJ.id).general = generaisLiberados()[0].id; // seu primeiro general começa no exército da capital
    noticia(`Fase ${F.n}: ${F.nome}. Tome as capitais inimigas (★).${F.regraTxt ? ' Atenção: ' + F.regraTxt + '.' : ''}`);
    centralizar(capJ.x, capJ.y);
}
function criarExercito(dono, provId, qtd, soldados) {
    const p = G.prov[provId];
    const s = soldados || Array.from({ length: qtd }, (_, k) => soldado(dono === 'jogador' ? NOMES_JOG[(proxId + k) % NOMES_JOG.length] : dono === 'neutro' ? 'Miliciano' : 'Inimigo'));
    const e = { id: 'e' + (proxId++), dono, s, prov: provId, de: provId, rota: [], x: p.x, y: p.y, missao: 'mover', origem: provId };
    G.ex.push(e);
    return e;
}

/* ---------- Caminhos ---------- */
function caminho(deId, paraId, soDe) { // menor distância pelas estradas (Dijkstra pequeno); soDe: só passa por províncias desse dono
    const dist = { [deId]: 0 }, ant = {}, aberto = new Set([deId]), feito = new Set();
    while (aberto.size) {
        let a = null; aberto.forEach(id => { if (a === null || dist[id] < dist[a]) a = id; });
        aberto.delete(a); feito.add(a);
        if (a === paraId) break;
        G.prov[a].viz.forEach(b => {
            if (feito.has(b) || (soDe && b !== paraId && G.prov[b].dono !== soDe)) return;
            const d = dist[a] + Math.hypot(G.prov[a].x - G.prov[b].x, G.prov[a].y - G.prov[b].y);
            if (dist[b] === undefined || d < dist[b]) { dist[b] = d; ant[b] = a; aberto.add(b); }
        });
    }
    if (dist[paraId] === undefined) return null;
    const rota = []; let c = paraId; while (c !== deId) { rota.unshift(c); c = ant[c]; }
    return { rota, dist: dist[paraId] };
}

/* ---------- Ordens (jogador e bots usam as mesmas) ---------- */
// Rota de um exército até o destino. Em marcha, ele segue até a próxima província e de lá muda o rumo.
// Para uma província sua, vai por dentro do seu território quando dá.
function rotaPara(e, destId) {
    const base = e.rota.length ? e.rota[0] : e.prov;
    if (destId === base) return e.rota.length ? { rota: [base], dist: Math.hypot(e.x - G.prov[base].x, e.y - G.prov[base].y) } : null;
    const c = (G.prov[destId].dono === e.dono && caminho(base, destId, e.dono)) || caminho(base, destId);
    if (!c) return null;
    if (!e.rota.length) return c;
    return { rota: [base, ...c.rota], dist: c.dist + Math.hypot(e.x - G.prov[base].x, e.y - G.prov[base].y) };
}
function ordem(exId, destId, qtd, missao) {
    let e = G.ex.find(x => x.id === exId);
    if (!e || e.emBatalha || (!e.rota.length && destId === e.prov)) return false;
    const emMarcha = e.rota.length > 0;
    const c = rotaPara(e, destId); if (!c) return false;
    qtd = emMarcha ? e.s.length : Math.max(1, Math.min(qtd || e.s.length, e.s.length));
    if (qtd < e.s.length) { // divide: vão os mais inteiros
        const ord = vivos(e.s).sort((a, b) => eficacia(b) - eficacia(a)), vao = ord.slice(0, qtd);
        e.s = e.s.filter(s => !vao.includes(s));
        e = criarExercito(e.dono, e.prov, 0, vao);
    }
    Object.assign(e, { rota: c.rota, missao: missao || 'mover', alertado: false });
    if (!emMarcha) Object.assign(e, { origem: e.prov, de: e.prov });
    const alvo = G.prov[destId];
    if (e.dono === 'jogador') noticia(`${emMarcha ? '↪ Novo rumo: ' : ''}${missao === 'saque' ? '💰 Saque' : alvo.dono !== 'jogador' ? '⚔️ Ataque' : '🚶 Tropa'} a caminho de ${alvo.nome} com ${e.s.length} soldados (~${Math.ceil(c.dist / C.VEL)}s).`);
    else avisarSeVisivel(e);
    return e;
}
function avisarSeVisivel(e) {
    if (e.alertado || e.dono === 'jogador') return;
    const destino = G.prov[e.rota[e.rota.length - 1]];
    const contraMim = e.rota.some(id => G.prov[id].dono === 'jogador');
    if (contraMim && (exVisivel(e) || G.espiado[e.dono] > G.t)) {
        e.alertado = true;
        noticia(`🚨 ${FACCOES[e.dono].nome} marcha com ${e.s.length} soldados sobre ${destino.nome}!`, true);
    }
}
function recrutarEm(provId, dono, tipo = 'inf') {
    const p = G.prov[provId], f = G.fac[dono], custo = custoRecrutarTipo(dono, tipo);
    if (!p || p.dono !== dono || f.moedas < custo || !tropaLiberada(dono, tipo)) return false;
    f.moedas -= custo;
    const e = exParadosEm(provId, dono)[0] || criarExercito(dono, provId, 0);
    e.s.push(soldado(dono === 'jogador' ? NOMES_JOG[Math.floor(Math.random() * NOMES_JOG.length)] : 'Inimigo', tipo));
    return true;
}
function recrutar(id, n = 1, tipo = 'inf') {
    let feitos = 0; while (feitos < n && recrutarEm(id, 'jogador', tipo)) feitos++;
    if (feitos) som('recrutar');
    if (feitos) noticia(`${TROPAS[tipo].icone} ${feitos === 1 ? 'Novo' : feitos + ' novos'} (${TROPAS[tipo].nome}) em ${G.prov[id].nome}.`);
    return feitos;
}
function custoVarios(dono, n) { let t = 0; const tropa = tropaDe(dono); for (let k = 0; k < n; k++) t += C.RECRUTAR + C.RECRUTAR_EXTRA * Math.max(0, tropa + k - C.TROPA_BASE); return t; }
function fortificar(id, dono = 'jogador') {
    const p = G.prov[id], f = G.fac[dono];
    if (!p || p.dono !== dono || f.moedas < C.FORTIFICAR || p.trinch >= 100) return false;
    f.moedas -= C.FORTIFICAR; p.trinch = Math.min(100, p.trinch + C.FORT_GANHO);
    if (dono === 'jogador') noticia(`🛡 Trincheira de ${p.nome} reforçada (${Math.round(p.trinch)}%).`);
    return true;
}
// Espião: sai da sua província mais perto, viaja e NÃO luta. Ao chegar, revela a província e as vizinhas
// e mostra os planos do dono (quem ele está atacando) por um tempo.
function espionar(id) {
    const p = G.prov[id], f = G.fac.jogador;
    const custoEsp = custoEspiao();
    if (!p || p.dono === 'jogador' || f.moedas < custoEsp || G.espioes.length >= C.ESPIAO_MAX) return false;
    const base = minhas().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!base) return false;
    f.moedas -= custoEsp;
    G.espioes.push({ para: id, x: base.x, y: base.y });
    noticia(`👁 Espião saiu de ${base.nome} para ${p.nome}. Ele não luta: só observa.`); som('espiao');
    return true;
}

/* ---------- Visão (névoa de guerra) ---------- */
function provVisivel(id) {
    const p = G.prov[id];
    if (p.dono === 'jogador' || G.revelado[id] > G.t) return true;
    const meu = (q) => q.dono === 'jogador' || (G.rel[q.dono] && G.rel[q.dono].estado === 'alianca');
    return meu(p) || p.viz.some(v => meu(G.prov[v]));
}
function exVisivel(e) {
    if (e.dono === 'jogador' || G.espiado[e.dono] > G.t) return true;
    if (provVisivel(e.prov)) return true;
    return e.rota.length > 0 && provVisivel(e.rota[0]);
}
const espiado = (dono) => G.espiado[dono] > G.t;
const custoEspiao = () => temPesq('jogador', 'radio') ? 10 : C.ESPIAO;

/* ---------- Economia ---------- */
// O que uma província rende por ciclo (moral, fábrica e inverno contam); a mesma conta alimenta a economia e o número no mapa
function producaoDe(p) {
    const pr = C.PROD[p.tipo], k = fatorMoral(p), inv = G.fase.regra === 'inverno' && p.tipo === 'campo' ? 0.6 : 1, fab = p.obras.fabrica ? 3 : 0;
    return { comida: pr.comida * k * inv, mun: (pr.mun + fab) * k, moedas: (pr.moedas + fab) * k };
}
function cicloEconomia() {
    G.ciclo++;
    Object.values(G.prov).forEach(p => {
        if (p.dono === 'neutro') return;
        const f = G.fac[p.dono], pd = producaoDe(p);
        const bot = p.dono !== 'jogador' && G.pensar[p.dono] !== undefined ? (typeof DIFC === 'function' ? DIFC() : { vontade: 1, margem: 1, prod: 1 }).prod : 1; // dificuldade dos bots (só na comida)
        f.comida += pd.comida * bot; f.mun += pd.mun; f.moedas += pd.moedas;
        const base = p.capital ? C.TRINCH_CAPITAL : C.TRINCH_BASE;
        if (p.trinch < base) p.trinch = Math.min(base, p.trinch + 2);
    });
    Object.keys(G.fac).filter(d => d !== 'neutro').forEach(dono => {
        const f = G.fac[dono], FX = FACCOES[dono];
        const esquece = dono !== 'jogador' && Math.random() < FX.esquece; // bot erra: esquece de alimentar a tropa
        const porcao = (temPesq(dono, 'racoes') ? 0.7 : 1);
        exDe(dono).forEach(e => {
            const sup = abastecido(e), log = bonusGeneral(e, 'log') > 1;
            const cura = (parado(e) && G.prov[e.prov].obras.hospital && G.prov[e.prov].dono === dono ? 12 : 3) * (temPesq(dono, 'medicina') ? 2 : 1);
            e.semSuprimento = !sup;
            e.s.forEach(s => {
                s.fome = Math.min(100, s.fome + C.FOME_CICLO * (log ? 0.5 : 1) + (sup || log ? 0 : 5));
                const come = porcao * (log ? 0.5 : 1);
                if (!esquece && (sup || log) && s.fome >= C.COME_SE && f.comida >= come) { f.comida -= come; s.fome = Math.max(0, s.fome - C.COME_ALIVIA); }
                if (s.fome >= 90) s.vida -= 4;
                else if (s.fome < 50) s.vida = Math.min(vidaMax(s), s.vida + cura);
                s.cansaco = Math.max(0, s.cansaco - 6);
            });
        });
        if (esquece && espiado(dono)) noticia(`👁 Espião: ${FX.nome} esqueceu de alimentar a tropa.`);
    });
    atualizarMoral();
    G.fase.bots.forEach(b => pensarDiplomacia(b));
    limparMortos();
}
function limparMortos() {
    G.ex.forEach(e => { e.s = e.s.filter(s => s.vida > 0); });
    G.ex = G.ex.filter(e => e.s.length || e.emBatalha);
}

/* ---------- Bots ---------- */
function ameaca(p, dono) { // força inimiga parada ao lado ou marchando para cá
    return G.ex.filter(e => e.dono !== dono && e.dono !== 'neutro' && emGuerra(e.dono, dono) && (e.prov === p.id || p.viz.includes(e.prov) || e.rota.includes(p.id))).reduce((t, e) => t + forca(e.s), 0);
}
function defesaEm(p) { // força que defende a província (com trincheira e capital)
    const def = exParadosEm(p.id, p.dono).reduce((t, e) => t + e.s.reduce((u, s) => u + eficacia(s) * Math.sqrt(TROPAS[s.tipo || 'inf'].def), 0), 0);
    return def * (1 + p.trinch / 250) * (p.capital ? C.CAPITAL_DEFESA : 1) * (p.obras && p.obras.forte ? 1.25 : 1);
}
function pensarBot(dono) {
    const FX = FACCOES[dono], f = G.fac[dono], provs = provDe(dono);
    if (!provs.length || G.eliminados[dono]) return;
    const capital = provs.find(p => p.capital && p.dono === dono);
    // 0) pesquisa e obras (com o dinheiro que sobra)
    if (!G.pesq[dono].atual && f.moedas > FX.reserva + 50 && Math.random() < 0.5) {
        const pref = { agressivo: ['cav', 'estradas', 'metr', 'art', 'blind'], 'ladrão': ['cav', 'radio', 'estradas', 'metr'], defensivo: ['metr', 'concreto', 'art', 'propaganda', 'blind'], oportunista: ['art', 'cav', 'metr', 'racoes', 'blind'] }[FX.perso] || [];
        const id = pref.concat(Object.keys(PESQUISAS)).find(x => pesquisaDisponivel(dono, x) && PESQUISAS[x].custo <= f.moedas - FX.reserva);
        if (id) pesquisar(id, dono);
    }
    if (capital && f.moedas > FX.reserva + 60 && Math.random() < 0.3) {
        const obra = FX.perso === 'defensivo' ? ['forte', 'hospital', 'fabrica'] : ['fabrica', 'forte', 'ferrovia'];
        const alvoObra = [capital, ...provs.filter(q => q.viz.some(v => G.prov[v].dono !== dono))].find(q => !q.obra && obra.some(o => !q.obras[o]));
        if (alvoObra) construir(alvoObra.id, obra.find(o => !alvoObra.obras[o]), dono);
    }
    // 1) recrutar (sempre que sobra dinheiro), primeiro onde está mais ameaçado, com o tipo de tropa do seu jeito
    const cidades = provs.slice().sort((a, b) => (ameaca(b, dono) - forca(exParadosEm(b.id, dono).flatMap(e => e.s))) - (ameaca(a, dono) - forca(exParadosEm(a.id, dono).flatMap(e => e.s))));
    const gosto = { agressivo: ['inf', 'cav', 'cav', 'blind', 'art'], 'ladrão': ['inf', 'cav', 'cav', 'inf'], defensivo: ['inf', 'metr', 'metr', 'art', 'blind'], oportunista: ['inf', 'art', 'cav', 'metr', 'blind'] }[FX.perso] || ['inf'];
    for (let k = 0; k < 3 && cidades.length; k++) {
        const tipos = gosto.filter(t => tropaLiberada(dono, t)), tipo = tipos[Math.floor(Math.random() * tipos.length)] || 'inf';
        if (f.moedas < custoRecrutarTipo(dono, tipo) + FX.reserva || Math.random() < 0.2) break;
        recrutarEm(cidades[0].id, dono, tipo);
    }
    // 2) fortificar a capital (o defensivo mais)
    if (capital && capital.trinch < 95 && f.moedas > (FX.perso === 'defensivo' ? 45 : 90) && Math.random() < 0.5) fortificar(capital.id, dono);
    // 3) defender: manda reforço para província ameaçada (sempre)
    provs.forEach(p => {
        const amea = ameaca(p, dono), guarda = defesaEm(p);
        if (amea <= guarda * 1.05) return;
        const doador = exDe(dono).filter(e => parado(e) && e.prov !== p.id && G.prov[e.prov].viz.includes(p.id) && e.s.length >= 3 && ameaca(G.prov[e.prov], dono) < forca(e.s) * 0.5)
            .sort((a, b) => b.s.length - a.s.length)[0];
        if (doador) ordem(doador.id, p.id, Math.ceil(doador.s.length / 2), 'mover');
    });
    // 4) atacar: com pausa, nem sempre, e só com vantagem (com erro de conta)
    if (G.t < (G.ultimoAtaque[dono] || 0) + C.BOT_PAUSA_ATAQUE || Math.random() > FX.vontade * (typeof DIFC === 'function' ? DIFC() : { vontade: 1, margem: 1, prod: 1 }).vontade) return;
    const opcoes = [];
    exDe(dono).filter(e => parado(e) && e.s.length >= 3).forEach(e => {
        const casa = G.prov[e.prov];
        const deixar = casa.capital ? (FX.perso === 'agressivo' && Math.random() < 0.25 ? 1 : 4) : (ameaca(casa, dono) > 0 ? 2 : 1);
        const manda = e.s.length - deixar; if (manda < 2) return;
        const enviados = vivos(e.s).sort((a, b) => eficacia(b) - eficacia(a)).slice(0, manda);
        casa.viz.map(id => G.prov[id]).filter(q => q.dono !== dono && emGuerra(dono, q.dono)).forEach(q => {
            let est = defesaEm(q) * (1 + (Math.random() - 0.5) * 0.6);
            const fora = G.ex.filter(x => x.dono === q.dono && x.rota.length && x.origem === q.id).length; // oportunista: dono saiu para brigar
            let pref = q.dono === 'neutro' ? 1.3 : q.capital ? 1.4 : 1;
            if (FX.perso === 'oportunista' && fora) pref *= 1.6;
            if (FX.perso === 'agressivo' && q.dono === 'jogador') pref *= 1.2;
            if (q.dono !== 'neutro' && (placar()[q.dono] || 0) >= Math.max(...Object.entries(placar()).filter(([d]) => d !== 'neutro').map(([, n]) => n))) pref *= 1.25; // todos de olho no líder
            opcoes.push({ e, q, manda, est, pref, forcaEnv: forca(enviados) });
        });
    });
    const boas = opcoes.filter(o => o.forcaEnv > o.est * FX.coragem * C.BOT_MARGEM * (typeof DIFC === 'function' ? DIFC() : { vontade: 1, margem: 1, prod: 1 }).margem).sort((a, b) => b.pref * (b.forcaEnv - b.est) - a.pref * (a.forcaEnv - a.est));
    let esc = boas[0];
    if (!esc && FX.perso === 'agressivo' && opcoes.length && Math.random() < 0.08) esc = opcoes[Math.floor(Math.random() * opcoes.length)]; // erro: ataca sem vantagem
    // ladrão: prefere saquear quem tem dinheiro
    if (FX.perso === 'ladrão' && Math.random() < 0.55) {
        const s = opcoes.filter(o => o.q.dono !== 'neutro' && emGuerra(dono, o.q.dono) && G.fac[o.q.dono].moedas > 30 && o.forcaEnv > o.est * 0.9).sort((a, b) => G.fac[b.q.dono].moedas - G.fac[a.q.dono].moedas)[0];
        if (s && ordem(s.e.id, s.q.id, Math.min(4, s.manda), 'saque')) { G.ultimoAtaque[dono] = G.t; return; }
    }
    if (esc && ordem(esc.e.id, esc.q.id, esc.manda, 'ataque')) G.ultimoAtaque[dono] = G.t;
}
function generalDosBots() { // cada bot tem um general no seu maior exército (+12%)
    G.fase.bots.filter(b => G.pensar[b] !== undefined).forEach(b => { const ex = exDe(b); ex.forEach(e => { e.general = null; }); /* só os países dos bots */ const maior = ex.sort((a, z) => z.s.length - a.s.length)[0]; if (maior) maior.general = 'bot'; });
}

/* ---------- Movimento e chegada ---------- */
function moverExercitos(dt) {
    G.ex.slice().forEach(e => {
        if (!e.rota.length || e.emBatalha) return;
        const alvo = G.prov[e.rota[0]];
        const dx = alvo.x - e.x, dy = alvo.y - e.y, d = Math.hypot(dx, dy), passo = velEx(e) * dt;
        if (d <= passo) { e.x = alvo.x; e.y = alvo.y; chegar(e, alvo); }
        else { e.x += dx / d * passo; e.y += dy / d * passo; }
        if (e.dono !== 'jogador' && e.rota.length) avisarSeVisivel(e);
    });
}
function chegar(e, p) {
    e.de = e.prov; e.prov = p.id; e.rota.shift();
    chegarAqui(e, p);
}
function chegarAqui(e, p) {
    if (p.dono !== e.dono && !emGuerra(e.dono, p.dono)) { if (!e.rota.length) parar(e); return; } // em paz: só passa
    if (p.dono !== e.dono) {
        if (e.dono === 'jogador' && G.rel[p.dono]) G.rel[p.dono].atacadoEm = G.t;
        const atual = batalhaEm(p.id);
        if (atual) { // já tem batalha aqui: quem é do lado do atacante entra na luta; outro país espera acabar
            if (e.dono === atual.atqDono) { juntarAoAtaque(atual, e); return; }
            e.emBatalha = true; e.aguarda = p.id; return;
        }
        const defensores = exParadosEm(p.id, p.dono);
        if (defensores.some(d => d.s.length)) {
            const b = criarBatalha(e, p, defensores);
            e.emBatalha = true; defensores.forEach(d => { d.emBatalha = true; });
            b.audivel = e.dono === 'jogador' || p.dono === 'jogador';
            G.batalhas.push(b);
            if (e.dono === 'jogador') noticia(`⚔️ Seus ${e.s.length} soldados atacam ${p.nome} (${b.def.length} defendendo).`);
            else if (p.dono === 'jogador') noticia(`⚔️ ${FACCOES[e.dono].nome} ataca ${p.nome} com ${e.s.length} soldados!`, true);
            return;
        }
        if (e.missao === 'saque') { saquear(e, p); return; }
        conquistar(p, e.dono, e);
    }
    if (!e.rota.length) parar(e);
}
function batalhaEm(provId) {
    if (G.cliente) { // no online o cliente só conhece o placar que o anfitrião mandou
        const v = (G.batalhasVis || []).find(b => b.prov === provId); if (!v) return null;
        const vivo = { s: { vida: 1 } };
        return { alvo: G.prov[provId], atqDono: v.atq, defDono: v.def, atq: Array(v.nA).fill(vivo), def: Array(v.nD).fill(vivo), t: v.t || 0, postAtq: v.pa, postDef: v.pd, usouArt: !!v.art, ex: { de: v.de } };
    }
    return (G.batalhas || []).find(b => b.alvo.id === provId && !b.terminou);
}
function juntarAoAtaque(b, e) { // mais tropa do atacante chega no meio da batalha
    e.s.forEach((s, i) => { b.ex.s.push(s); b.atq.push({ s, dist: C.DIST + Math.random() * 25, x: 30 + Math.random() * 340 }); });
    e.s = []; G.ex = G.ex.filter(x => x !== e);
    if (b.atqDono === 'jogador') noticia(`⚔️ Reforço chegou à batalha de ${b.alvo.nome}.`);
}
function parar(e) {
    if (e.missao === 'voltar') e.missao = 'mover';
    const bt = batalhaEm(e.prov);
    if (bt && bt.defDono === e.dono && !e.emBatalha) { // reforço da defesa entra na trincheira
        e.emBatalha = true; bt.defensores.push(e);
        e.s.forEach((s, i) => bt.def.push({ s, x: 30 + Math.random() * 340 }));
        if (e.dono === 'jogador') noticia(`🛡️ Reforço chegou à defesa de ${bt.alvo.nome}.`);
        return;
    }
    const outro = exParadosEm(e.prov, e.dono).find(x => x !== e);
    if (outro) { outro.s.push(...e.s); e.s = []; G.ex = G.ex.filter(x => x !== e); if (G.sel && G.sel.tipo === 'ex' && G.sel.id === e.id) G.sel = { tipo: 'ex', id: outro.id }; }
}
function saquear(e, p) {
    const f = G.fac[p.dono], roubo = p.dono === 'neutro' ? 0 : Math.floor(f.moedas * C.SAQUE_PARTE);
    if (roubo) { f.moedas -= roubo; G.fac[e.dono].moedas += roubo; }
    if (e.dono === 'jogador' || p.dono === 'jogador' || espiado(e.dono)) noticia(`💰 ${FACCOES[e.dono].nome} saqueou ${p.nome}: ${roubo} moedas.`, p.dono === 'jogador');
    const volta = caminho(e.prov, e.origem);
    e.rota = volta && G.prov[e.origem].dono === e.dono ? volta.rota : []; e.missao = 'voltar';
    if (!e.rota.length) parar(e);
}
function conquistar(p, dono, e) {
    const antigo = p.dono;
    p.dono = dono; p.trinch = 20; p.moral = 30; p.conquistadaEm = G.t; p.obra = null; p.obras.forte = false;
    if (antigo === 'jogador') G.stats.perdidas = (G.stats.perdidas || 0) + 1;
    const ver = dono === 'jogador' || antigo === 'jogador' || provVisivel(p.id) || espiado(dono);
    if (antigo !== 'neutro') { // leva parte do tesouro e da comida
        const fa = G.fac[antigo], fn = G.fac[dono], parte = p.capital ? 0.5 : 0.15;
        ['moedas', 'comida'].forEach(k => { const v = Math.floor(fa[k] * parte); fa[k] -= v; fn[k] += v; });
    }
    if (e) e.s.push(...Array.from({ length: p.tipo === 'cidade' || p.capital ? 2 : 1 }, () => soldado(dono === 'jogador' ? 'Recruta' : 'Inimigo'))); // moradores se juntam
    if (dono === 'jogador') som('conquista'); else if (antigo === 'jogador') som('perda');
    if (ver) noticia(`🏴 ${FACCOES[dono].nome} conquistou ${p.nome}${antigo === 'neutro' ? '' : ' de ' + FACCOES[antigo].nome}.`, antigo === 'jogador');
    if (p.capital && antigo !== 'neutro' && p.capitalDe === antigo) { // só cai quem perde a PRÓPRIA capital (perder uma capital conquistada não elimina ninguém)
        if (antigo === 'jogador' && !G.online) { G.fim = 'derrota'; return mostrarFim(); }
        eliminar(antigo, dono);
    }
    verificarFim();
}
function eliminar(bot, por) {
    G.eliminados[bot] = true;
    G.ex = G.ex.filter(x => x.dono !== bot);
    provDe(bot).forEach(q => { q.dono = 'neutro'; q.trinch = 30; criarExercito('neutro', q.id, 2); });
    noticia(`☠ ${FACCOES[bot].nome} perdeu a capital para ${FACCOES[por].nome} e se rendeu. As províncias dele viraram terra de milícia.`, por === 'jogador');
}
function verificarFim() {
    if (G.fim) return;
    if (G.online && typeof verificarFimOnline === 'function') return verificarFimOnline();
    if (G.prov[G.capitalJogador].dono !== 'jogador') { G.fim = 'derrota'; return mostrarFim(); }
    if (G.fase.bots.every(b => G.eliminados[b])) { G.fim = 'vitoria'; return mostrarFim(); }
}
function placar() { // províncias por facção
    const r = {}; Object.values(G.prov).forEach(p => { r[p.dono] = (r[p.dono] || 0) + 1; }); return r;
}

/* ---------- Batalha: até 2 minutos na trincheira ---------- */
function criarBatalha(e, alvo, defensores) {
    const defS = defensores.flatMap(d => d.s).filter(s => s.vida > 0);
    const b = {
        ex: e, atqDono: e.dono, defDono: alvo.dono, alvo, saque: e.missao === 'saque', defensores, t: 0, terminou: false, vencedor: null,
        atq: e.s.map((s, i, l) => ({ s, dist: C.DIST + Math.random() * 25, x: 30 + (i + 0.5) * (340 / l.length) + (Math.random() - 0.5) * Math.min(14, 300 / l.length) })), // espalhados pela frente
        def: defS.map((s, i) => ({ s, x: 50 + i * (300 / Math.max(1, defS.length - 1 || 1)) })),
        postAtq: 'avancar', postDef: 'equilibrio', efeitos: [], rapido: false,
        genAtq: bonusGeneral(e, 'atq'), genDef: Math.max(...defensores.map(d => bonusGeneral(d, 'def')), 1),
        forte: alvo.obras && alvo.obras.forte ? 1.25 * (temPesq(alvo.dono, 'concreto') ? 1.15 : 1) : 1
    };
    b.passo = (dt) => passoBatalha(b, dt);
    // Ten. Barros: barragem de artilharia de graça no começo
    [e, ...defensores].forEach(x => { if (bonusGeneral(x, 'art') > 1) { const alvos = x === e ? b.def : b.atq; alvos.forEach(a => { a.s.vida -= 25; b.efeitos.push({ x: a.x, y: x === e ? -1 : a.dist, vida: 0.8, tipo: 'explosao' }); }); } });
    return b;
}
function passoBatalha(b, dt) {
    if (b.terminou) return;
    b.t += dt;
    const fa = G.fac[b.atqDono], fd = G.fac[b.defDono];
    const atqVivos = b.atq.filter(a => a.s.vida > 0), defVivos = b.def.filter(d => d.s.vida > 0);
    atqVivos.forEach(a => { a.dist = Math.max(0, Math.min(C.DIST + 25, a.dist - C.VELBAT[b.postAtq] * dt)); }); // para na beira da trincheira
    const pd = b.postDef === 'abrigar' ? { dano: 0.5, rec: 0.5 } : b.postDef === 'atacar' ? { dano: 1.4, rec: 1.3 } : { dano: 1, rec: 1 };
    const exposicao = b.postAtq === 'cobertura' ? 0.5 : 1;
    const dano = () => C.DANO_TIRO * (0.7 + 0.6 * Math.random());
    const noCampo = atqVivos.filter(a => a.dist > 0 && a.dist < 260);
    if (noCampo.length && defVivos.length) {
        const munD = fd.mun > 0 ? 1 : 0.3, cap = b.alvo.capital ? C.CAPITAL_DEFESA : 1;
        defVivos.forEach(d => {
            const T = TROPAS[d.s.tipo || 'inf'];
            if (Math.random() < C.TIRO_DEF * T.def * eficacia(d.s) * pd.dano * exposicao * munD * cap * b.genDef * b.forte * dt) {
                const alvo = noCampo[Math.floor(Math.random() * noCampo.length)]; alvo.s.vida -= dano() * danoContra(d.s.tipo || 'inf', alvo.s.tipo || 'inf'); if (b.audivel) som('tiro', 0.35);
            }
        });
        fd.mun = Math.max(0, fd.mun - defVivos.length * 0.5 * dt);
    }
    if (defVivos.length) {
        const munA = fa.mun > 0 ? 1 : 0.3;
        atqVivos.filter(a => a.dist < (TROPAS[a.s.tipo || 'inf'].longe ? C.DIST + 30 : 220)).forEach(a => { // artilharia atira de longe
            const T = TROPAS[a.s.tipo || 'inf'], corpo = a.dist <= 0;
            const protege = 1 - C.TRINCH_PROTEGE * (T.longe ? 0.4 : 1) * b.alvo.trinch / 100; // artilharia fura a trincheira
            const chance = corpo ? C.CORPO_A_CORPO * T.corpo * eficacia(a.s) * pd.rec * b.genAtq * (1 - C.TRINCH_PROTEGE_CORPO * b.alvo.trinch / 100)
                : C.TIRO_ATQ * T.atq * (b.postAtq === 'cobertura' ? 0.6 : 1) * eficacia(a.s) * munA * protege * pd.rec * b.genAtq;
            if (Math.random() < chance * dt) { const alvo = defVivos[Math.floor(Math.random() * defVivos.length)]; alvo.s.vida -= dano() * danoContra(a.s.tipo || 'inf', alvo.s.tipo || 'inf'); if (b.audivel) som('tiro', 0.45); }
        });
        fa.mun = Math.max(0, fa.mun - atqVivos.length * 0.4 * dt);
    }
    const naTrincheira = atqVivos.filter(a => a.dist <= 0);
    if (naTrincheira.length && defVivos.length) defVivos.forEach(d => { if (Math.random() < C.CORPO_A_CORPO * TROPAS[d.s.tipo || 'inf'].corpo * eficacia(d.s) * b.genDef * dt) { const alvo = naTrincheira[Math.floor(Math.random() * naTrincheira.length)]; alvo.s.vida -= dano() * danoContra(d.s.tipo || 'inf', alvo.s.tipo || 'inf'); } });
    b.atq.forEach(a => { if (a.s.vida <= 0 && !a.morto) { a.morto = true; b.efeitos.push({ x: a.x, y: a.dist, vida: 0.6, tipo: 'abate' }); if (b.audivel) som('abate'); } });
    b.def.forEach(d => { if (d.s.vida <= 0 && !d.morto) { d.morto = true; b.efeitos.push({ x: d.x, y: -1, vida: 0.6, tipo: 'abate' }); } });
    const sobraA = b.atq.filter(a => a.s.vida > 0), sobraD = b.def.filter(d => d.s.vida > 0);
    if (!sobraD.length && sobraA.length) { b.terminou = true; b.vencedor = 'atq'; }
    else if (!sobraA.length) { b.terminou = true; b.vencedor = 'def'; }
    else if (b.postAtq === 'recuar' && sobraA.every(a => a.dist >= C.DIST + 20)) { b.terminou = true; b.vencedor = 'def'; b.recuou = true; }
    else if (b.t >= C.BAT_DURACAO) { b.terminou = true; b.vencedor = 'def'; b.tempo = true; }
}
function artilhariaNaBatalha(b, lado) {
    const f = G.fac.jogador;
    if (f.moedas < C.ARTILHARIA || b.usouArt) return;
    f.moedas -= C.ARTILHARIA; b.usouArt = true;
    const alvos = lado === 'atq' ? b.def : b.atq;
    som('explosao');
    alvos.filter(x => x.s.vida > 0).forEach(x => { x.s.vida -= 35; b.efeitos.push({ x: x.x, y: lado === 'atq' ? -1 : x.dist, vida: 0.8, tipo: 'explosao' }); });
}
function concluirBatalha(b) {
    const e = b.ex, p = b.alvo;
    e.emBatalha = false;
    if (b.atqDono === 'jogador') G.stats.baixas = (G.stats.baixas || 0) + b.atq.filter(a => a.s.vida <= 0).length;
    if (b.defDono === 'jogador') G.stats.baixas = (G.stats.baixas || 0) + b.def.filter(d => d.s.vida <= 0).length;
    if (b.vencedor === 'atq') { generalVenceu(e); b.defensores.forEach(d => { if (!d.s.some(s => s.vida > 0)) generalCaiu(d); }); }
    else { b.defensores.forEach(generalVenceu); if (!e.s.some(s => s.vida > 0)) generalCaiu(e); }
    e.s = e.s.filter(s => s.vida > 0); e.s.forEach(s => { s.cansaco = Math.min(100, s.cansaco + 30); });
    b.defensores.forEach(d => { d.s = d.s.filter(s => s.vida > 0); d.s.forEach(s => { s.cansaco = Math.min(100, s.cansaco + 20); }); });
    G.ex = G.ex.filter(x => x.s.length || x === e);
    const ver = b.atqDono === 'jogador' || b.defDono === 'jogador' || provVisivel(p.id) || espiado(b.atqDono) || espiado(b.defDono);
    if (b.vencedor === 'atq' && e.s.length) {
        if (p.dono !== b.defDono) { if (!e.rota.length) parar(e); return; } // alguém tomou antes
        if (b.saque) { saquear(e, p); return; }
        conquistar(p, e.dono, e);
        if (!e.rota.length && G.ex.includes(e)) parar(e);
    } else {
        if (ver) noticia(`🛡️ ${FACCOES[b.defDono].nome} segurou ${p.nome} contra ${FACCOES[b.atqDono].nome}${b.recuou ? ' (recuaram)' : b.tempo ? ' (o tempo acabou)' : ''}.`, b.atqDono === 'jogador');
        // sobreviventes recuam para de onde vieram (se ainda for deles)
        if (e.s.length && G.prov[e.de] && G.prov[e.de].dono === e.dono) { e.x = G.prov[e.de].x; e.y = G.prov[e.de].y; e.prov = e.de; e.rota = []; e.missao = 'mover'; parar(e); }
        else G.ex = G.ex.filter(x => x !== e);
    }
    limparMortos();
}

/* ---------- O tempo anda ---------- */
function passoMapa(dt) {
    if (G.fim) return;
    G.t += dt;
    if (G.t >= G.fase.tempo) return fimPorTempo();
    if (Math.floor(G.t / C.CICLO) > G.ciclo) { cicloEconomia(); if (G.ciclo % 4 === 0) generalDosBots(); }
    avancarObras(dt); avancarPesquisas(dt);
    Object.keys(G.pensar).forEach(dono => { G.pensar[dono] -= dt; if (G.pensar[dono] <= 0) { G.pensar[dono] = C.BOT_PENSA + Math.random() * C.BOT_PENSA_VAR; pensarBot(dono); } });
    moverExercitos(dt);
    avancarBatalhas(dt);
    // espiões viajando
    G.espioes = G.espioes.filter(s => {
        const p = G.prov[s.para], dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), passo = C.ESPIAO_VEL * dt;
        if (d > passo) { s.x += dx / d * passo; s.y += dy / d * passo; return true; }
        relatorioEspiao(p);
        return false;
    });
}
function avancarBatalhas(dt) {
    const lista = (G.batalhas || []).slice();
    lista.forEach(b => { if (!b.terminou) b.passo(dt * C.BAT_RITMO); });
    lista.filter(b => b.terminou).forEach(b => {
        G.batalhas = G.batalhas.filter(x => x !== b);
        concluirBatalha(b);
        b.defensores.forEach(d => { if (G.ex.includes(d)) { d.emBatalha = false; if (d.s.length) parar(d); } });
        G.ex.filter(x => x.aguarda === b.alvo.id).forEach(x => { x.emBatalha = false; x.aguarda = null; chegarAqui(x, b.alvo); }); // quem esperava a vez
    });
}
function relatorioEspiao(p) {
    const ate = G.t + C.ESPIAO_DURA;
    G.revelado[p.id] = ate; p.viz.forEach(v => { G.revelado[v] = Math.max(G.revelado[v] || 0, ate); });
    let txt = `👁 Relatório de ${p.nome}: `;
    if (p.dono === 'neutro') txt += `milícia com ${exParadosEm(p.id, 'neutro').reduce((t, e) => t + e.s.length, 0)} homens, trincheira ${Math.round(p.trinch)}%.`;
    else {
        G.espiado[p.dono] = ate;
        const f = G.fac[p.dono], ex = exDe(p.dono), marchando = ex.filter(e => e.rota.length && e.missao !== 'voltar');
        const fome = ex.flatMap(e => e.s).filter(s => s.fome >= 50).length;
        txt += `${FACCOES[p.dono].nome} tem ${tropaDe(p.dono)} soldados${fome ? ` (${fome} com fome)` : ''} e ${Math.floor(f.moedas)} moedas.`;
        txt += marchando.length ? ' Está atacando: ' + marchando.map(e => `${G.prov[e.rota[e.rota.length - 1]].nome} (${e.s.length})`).join(', ') + '.' : ' Ninguém marchando agora.';
    }
    noticia(txt); som('espiao');
    G.ultimoRelatorio = txt;
}
function fimPorTempo() {
    if (G.online && typeof fimPorTempoOnline === 'function') return fimPorTempoOnline();
    const pl = placar(), meu = pl.jogador || 0, melhorBot = Math.max(0, ...G.fase.bots.map(b => pl[b] || 0));
    G.fim = meu > melhorBot ? 'pontos' : 'tempo';
    mostrarFim();
}

/* ---------- Câmera (arrastar e zoom) ---------- */
const cvM = document.getElementById('mapa'), cxM = cvM.getContext('2d');
const cam = { x: 300, y: 400, z: 1 };
function ajustar(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); }
const DPR = () => cvM.width / Math.max(1, cvM.getBoundingClientRect().width);
function zoomMin() { const r = cvM.getBoundingClientRect(); return MAPA ? Math.min(r.width / MAPA.W, r.height / MAPA.H) * 0.95 : 0.5; }
function limitarCam() {
    if (!MAPA) return;
    cam.z = Math.max(zoomMin(), Math.min(3, cam.z));
    // o mapa não sai da tela; se couber inteiro numa direção, fica centralizado nela
    const r = cvM.getBoundingClientRect(), mx = r.width / 2 / cam.z, my = r.height / 2 / cam.z;
    cam.x = MAPA.W <= 2 * mx ? MAPA.W / 2 : Math.max(mx, Math.min(MAPA.W - mx, cam.x));
    cam.y = MAPA.H <= 2 * my ? MAPA.H / 2 : Math.max(my, Math.min(MAPA.H - my, cam.y));
}
function irParaCapital() { const c = G && G.prov[G.capitalJogador]; if (c) centralizar(c.x, c.y); }
function centralizar(x, y) { const r = cvM.getBoundingClientRect(); cam.x = x; cam.y = y; cam.z = Math.max(zoomMin(), Math.min(1.4, r.width / 330)); limitarCam(); }
const paraTela = (x, y) => { const r = cvM.getBoundingClientRect(); return { x: (x - cam.x) * cam.z + r.width / 2, y: (y - cam.y) * cam.z + r.height / 2 }; };
const paraMundo = (sx, sy) => { const r = cvM.getBoundingClientRect(); return { x: (sx - r.width / 2) / cam.z + cam.x, y: (sy - r.height / 2) / cam.z + cam.y }; };
function zoomEm(fator, sx, sy) {
    const antes = paraMundo(sx, sy); cam.z *= fator; limitarCam();
    const depois = paraMundo(sx, sy); cam.x += antes.x - depois.x; cam.y += antes.y - depois.y; limitarCam();
}
const toques = new Map(); let arrasto = null, pinca = null, moveu = false;
cvM.addEventListener('pointerdown', ev => {
    cvM.setPointerCapture(ev.pointerId);
    const r = cvM.getBoundingClientRect(), pt = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    toques.set(ev.pointerId, pt);
    if (toques.size === 1) { arrasto = { ...pt, cx: cam.x, cy: cam.y }; moveu = false; }
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam.z }; moveu = true; }
});
cvM.addEventListener('pointermove', ev => {
    if (!toques.has(ev.pointerId)) return;
    const r = cvM.getBoundingClientRect(), pt = { x: ev.clientX - r.left, y: ev.clientY - r.top };
    toques.set(ev.pointerId, pt);
    if (toques.size === 2 && pinca) {
        const [a, b] = [...toques.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomEm((pinca.z * d / pinca.d) / cam.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (toques.size === 1 && arrasto) {
        const dx = pt.x - arrasto.x, dy = pt.y - arrasto.y;
        if (Math.abs(dx) + Math.abs(dy) > 8) moveu = true;
        if (moveu) { cam.x = arrasto.cx - dx / cam.z; cam.y = arrasto.cy - dy / cam.z; limitarCam(); }
    }
});
function soltar(ev) {
    if (!toques.has(ev.pointerId)) return;
    const pt = toques.get(ev.pointerId);
    toques.delete(ev.pointerId);
    if (!toques.size) { if (!moveu) tocarMapa(pt.x, pt.y); arrasto = null; pinca = null; }
}
cvM.addEventListener('pointerup', soltar);
cvM.addEventListener('pointercancel', ev => { toques.delete(ev.pointerId); arrasto = null; pinca = null; });
cvM.addEventListener('wheel', ev => { ev.preventDefault(); const r = cvM.getBoundingClientRect(); zoomEm(ev.deltaY < 0 ? 1.15 : 1 / 1.15, ev.clientX - r.left, ev.clientY - r.top); }, { passive: false });
window.addEventListener('resize', () => { ajustar(cvM); limitarCam(); });
// a área do mapa muda de altura quando o painel de baixo muda: acompanha o tamanho de verdade
if (window.ResizeObserver) new ResizeObserver(() => { ajustar(cvM); limitarCam(); }).observe(cvM);

/* ---------- Toque no mapa: escolher exército, destino ou província ---------- */
function provNoPonto(wx, wy) {
    cxM.save(); cxM.setTransform(1, 0, 0, 1, 0, 0);
    const p = Object.values(G.prov).find(q => cxM.isPointInPath(q.path, wx, wy));
    cxM.restore(); return p;
}
function tocarMapa(sx, sy) {
    if (G.fim) return;
    const w = paraMundo(sx, sy);
    // exércitos seus têm prioridade no toque (fora do modo de escolher destino)
    if (!G.modo) {
        const meu = G.ex.filter(e => e.dono === 'jogador').map(e => ({ e, d: Math.hypot(paraTela(e.x, e.y).x - sx, paraTela(e.x, e.y).y - sy) })).filter(o => o.d < 22).sort((a, b) => a.d - b.d)[0];
        if (meu) { G.sel = { tipo: 'ex', id: meu.e.id }; G.pendente = null; return renderPainel(); }
    }
    const p = provNoPonto(w.x, w.y);
    if (!p) return;
    if (G.modo) { prepararOrdem(G.modo.exId, p.id, G.modo.missao); return; }
    G.sel = { tipo: 'prov', id: p.id }; G.pendente = null; renderPainel();
}
function escolherDestino(exId, missao) { G.modo = { exId, missao }; G.pendente = null; renderPainel(); }
function prepararOrdem(exId, destId, missao) {
    const e = G.ex.find(x => x.id === exId);
    G.modo = null;
    if (!e || (!e.rota.length && destId === e.prov)) { renderPainel(); return; }
    const c = rotaPara(e, destId);
    if (!c) return renderPainel();
    G.pendente = { exId, destId, missao, qtd: e.s.length, rota: c.rota, seg: Math.ceil(c.dist / velEx(e)) };
    G.sel = { tipo: 'ex', id: exId };
    renderPainel();
}
function confirmarOrdem() {
    const o = G.pendente; if (!o) return;
    const novo = ordem(o.exId, o.destId, o.qtd, o.missao);
    if (novo) som('ordem');
    G.pendente = null;
    if (novo) G.sel = { tipo: 'ex', id: novo.id };
    renderPainel();
}
function cancelarMarcha(exId) { // para na próxima província
    const e = G.ex.find(x => x.id === exId); if (!e || !e.rota.length) return;
    e.rota = e.rota.slice(0, 1); e.missao = 'mover'; noticia(`✋ A tropa vai parar em ${G.prov[e.rota[0]].nome}.`); renderPainel();
}

/* ---------- Desenho do mapa ---------- */
function desenharMapa() {
    const r = cvM.getBoundingClientRect(), d = DPR();
    cxM.setTransform(1, 0, 0, 1, 0, 0); cxM.fillStyle = '#12202a'; cxM.fillRect(0, 0, cvM.width, cvM.height);
    if (!MAPA) return;
    if (!toques.size) limitarCam(); // mantém o mapa na tela mesmo se a área mudou de tamanho
    const T = (x, y) => paraTela(x, y);
    cxM.setTransform(cam.z * d, 0, 0, cam.z * d, (r.width / 2 - cam.x * cam.z) * d, (r.height / 2 - cam.y * cam.z) * d);
    cxM.drawImage(TERRENO, 0, 0, MAPA.W, MAPA.H);
    // cores políticas, névoa e seleção
    const selProv = G.sel && G.sel.tipo === 'prov' ? G.sel.id : null;
    Object.values(G.prov).forEach(p => {
        const cor = FACCOES[p.dono].cor;
        cxM.globalAlpha = p.dono === 'neutro' ? 0.12 : 0.34; cxM.fillStyle = cor; cxM.fill(p.path);
        if (!provVisivel(p.id)) { cxM.globalAlpha = 0.28; cxM.fillStyle = '#0a0d10'; cxM.fill(p.path); }
        cxM.globalAlpha = 1;
    });
    // fronteiras entre donos diferentes mais fortes
    Object.values(G.prov).forEach(p => { if (p.dono !== 'neutro') { cxM.strokeStyle = FACCOES[p.dono].cor; cxM.globalAlpha = 0.8; cxM.lineWidth = 1.6 / cam.z; cxM.stroke(p.path); cxM.globalAlpha = 1; } });
    if (selProv) { cxM.strokeStyle = '#ffd28a'; cxM.lineWidth = 3 / cam.z; cxM.stroke(G.prov[selProv].path); }
    if (G.pendente) { cxM.strokeStyle = '#ffffff'; cxM.lineWidth = 3 / cam.z; cxM.setLineDash([6 / cam.z, 4 / cam.z]); cxM.stroke(G.prov[G.pendente.destId].path); cxM.setLineDash([]); }
    // rotas: as suas sempre; as dos outros só se visíveis ou espiadas
    const rotas = G.ex.filter(e => e.rota.length && (e.dono === 'jogador' || espiado(e.dono) || exVisivel(e)));
    rotas.forEach(e => {
        cxM.strokeStyle = FACCOES[e.dono].cor; cxM.lineWidth = 2.2 / cam.z; cxM.setLineDash([5 / cam.z, 4 / cam.z]);
        cxM.beginPath(); cxM.moveTo(e.x, e.y); e.rota.forEach(id => cxM.lineTo(G.prov[id].x, G.prov[id].y)); cxM.stroke(); cxM.setLineDash([]);
        const fim = G.prov[e.rota[e.rota.length - 1]];
        cxM.fillStyle = FACCOES[e.dono].cor; cxM.beginPath(); cxM.arc(fim.x, fim.y, 4 / cam.z, 0, Math.PI * 2); cxM.fill();
    });
    if (G.pendente) { // prévia da ordem
        const e = G.ex.find(x => x.id === G.pendente.exId);
        if (e) { cxM.strokeStyle = '#ffffff'; cxM.lineWidth = 2.5 / cam.z; cxM.setLineDash([3 / cam.z, 3 / cam.z]); cxM.beginPath(); cxM.moveTo(e.x, e.y); G.pendente.rota.forEach(id => cxM.lineTo(G.prov[id].x, G.prov[id].y)); cxM.stroke(); cxM.setLineDash([]); }
    }
    // a partir daqui, em pixels da tela (tamanho fixo)
    cxM.setTransform(d, 0, 0, d, 0, 0);
    // nomes: capitais e as suas primeiro; um nome que encostaria em outro já escrito fica de fora (aparece com zoom)
    const ocupado = [];
    Object.values(G.prov).sort((a, b) => (b.capital - a.capital) || ((b.dono === 'jogador') - (a.dono === 'jogador'))).forEach(p => {
        const s = T(p.x, p.y);
        if (s.x < -60 || s.y < -60 || s.x > r.width + 60 || s.y > r.height + 60) return;
        cxM.textAlign = 'center'; cxM.font = `bold ${p.capital ? 12 : 10}px "Courier New", monospace`;
        const txt = (p.capital ? '★ ' : '') + p.nome.toUpperCase();
        const w = cxM.measureText(txt).width, caixa = { x0: s.x - w / 2 - 3, x1: s.x + w / 2 + 3, y0: s.y - 26, y1: s.y - 9 };
        if (!p.capital && ocupado.some(o => o.x0 < caixa.x1 && caixa.x0 < o.x1 && o.y0 < caixa.y1 && caixa.y0 < o.y1)) return;
        ocupado.push(caixa);
        cxM.fillStyle = 'rgba(0,0,0,.65)'; cxM.fillText(txt, s.x + 1, s.y - 13);
        cxM.fillStyle = p.capital ? '#ffe2a8' : '#efe6cf'; cxM.fillText(txt, s.x, s.y - 14);
        if (p.dono === 'jogador' && provVisivel(p.id)) { // o que a sua província rende a cada ciclo (laranja quando a moral está baixa)
            const pd = producaoDe(p), fmt = (v) => { const q = Math.round(v * 10) / 10; return Number.isInteger(q) ? q : q.toFixed(1); };
            const prod = [['comida', '🍞'], ['mun', '🔫'], ['moedas', '🪙']].filter(([k]) => pd[k] > 0.04).map(([k, e]) => '+' + fmt(pd[k]) + e).join(' ');
            if (prod) {
                cxM.font = 'bold 9px sans-serif'; const w2 = cxM.measureText(prod).width;
                cxM.fillStyle = 'rgba(12,15,13,.72)'; cxM.fillRect(s.x - w2 / 2 - 3, s.y - 41, w2 + 6, 12);
                cxM.fillStyle = p.moral < 35 ? '#ffb36b' : '#cfe8c8'; cxM.fillText(prod, s.x, s.y - 32);
                cxM.font = `bold ${p.capital ? 12 : 10}px "Courier New", monospace`;
            }
        }
        if (provVisivel(p.id)) { // forte, obra em andamento e risco de revolta
            const icones = (p.obras.forte ? '🏰' : p.trinch >= 80 ? '🛡' : '') + (p.dono === 'jogador' && p.obra ? '🏗' : '') + (p.dono === 'jogador' && !p.capital && p.moral < 35 ? '⚠' : '');
            if (icones) { const w0 = cxM.measureText(txt).width; cxM.font = '10px sans-serif'; cxM.textAlign = 'left'; cxM.fillText(icones, s.x + w0 / 2 + 3, s.y - 14); cxM.textAlign = 'center'; }
        }
        if (p.dono !== 'jogador' && G.rel[p.dono] && G.rel[p.dono].estado !== 'guerra') { cxM.font = '10px sans-serif'; cxM.fillText(G.rel[p.dono].estado === 'paz' ? '🕊' : '🤝', s.x, s.y - 28); }
    });
    // batalhas no próprio mapa: anel pulsando, tiros e o placar
    const agora = performance.now() / 1000;
    batalhasParaDesenho().forEach(bt => {
        const p = G.prov[bt.prov]; if (!p || !(provVisivel(p.id) || bt.atq === 'jogador' || bt.def === 'jogador')) return;
        const s = T(p.x, p.y), pulso = 0.5 + 0.5 * Math.sin(agora * 6);
        cxM.strokeStyle = `rgba(255,110,60,${0.45 + 0.4 * pulso})`; cxM.lineWidth = 3; cxM.beginPath(); cxM.arc(s.x, s.y + 4, 26 + 4 * pulso, 0, Math.PI * 2); cxM.stroke();
        const de = bt.de && G.prov[bt.de] ? T(G.prov[bt.de].x, G.prov[bt.de].y) : { x: s.x - 40, y: s.y + 30 };
        const ang = Math.atan2(de.y - s.y, de.x - s.x), ax = s.x + Math.cos(ang) * 26, ay = s.y + 14 + Math.sin(ang) * 20;
        for (let k = 0; k < 4; k++) { const t = Math.random(); cxM.strokeStyle = 'rgba(255,224,138,.8)'; cxM.lineWidth = 1; cxM.beginPath(); const x0 = ax + (Math.random() - 0.5) * 16, y0 = ay + (Math.random() - 0.5) * 16; cxM.moveTo(x0, y0); cxM.lineTo(x0 + (s.x - x0) * t, y0 + (s.y + 4 - y0) * t); cxM.stroke(); }
        if (Math.random() < 0.3) { cxM.fillStyle = 'rgba(255,170,70,.85)'; cxM.beginPath(); cxM.arc(s.x + (Math.random() - 0.5) * 30, s.y + (Math.random() - 0.5) * 20, 3 + Math.random() * 4, 0, Math.PI * 2); cxM.fill(); }
        desenharBoneco(ax, ay, FACCOES[bt.atq].cor, true, Math.max(1, bt.nA), agora, 1, bt.tA);
        desenharBoneco(s.x, s.y + 14, FACCOES[bt.def].cor, false, Math.max(1, bt.nD), agora, 1, bt.tD);
        cxM.font = 'bold 11px "Courier New", monospace'; cxM.textAlign = 'center';
        const txt = `⚔ ${bt.nA} × ${bt.nD}`, w0 = cxM.measureText(txt).width + 10;
        cxM.fillStyle = 'rgba(40,10,6,.85)'; cxM.fillRect(s.x - w0 / 2, s.y + 20, w0, 15); cxM.fillStyle = '#ffd2a8'; cxM.fillText(txt, s.x, s.y + 31);
    });
    // exércitos: bonecos (andando quando marcham) com o número de soldados
    const selEx = G.sel && G.sel.tipo === 'ex' ? G.sel.id : (G.modo ? G.modo.exId : null);
    const agrup = {};
    G.ex.forEach(e => {
        if (!exVisivel(e) || e.emBatalha) return; // quem está lutando aparece na batalha
        const k = e.rota.length ? e.id : e.prov + '|' + e.dono; // parados na mesma província juntam no desenho
        if (!agrup[k]) agrup[k] = { e, n: 0, tipos: {} }; agrup[k].n += e.s.length; e.s.forEach(x => { const t = x.tipo || 'inf'; agrup[k].tipos[t] = (agrup[k].tipos[t] || 0) + 1; });
    });
    let tiposVistos = false; // há tropa além da infantaria no mapa? então mostra a legenda
    Object.values(agrup).forEach(({ e, n, tipos }) => {
        const s = T(e.x, e.y), mexendo = e.rota.length > 0, cor = e.dono === 'neutro' ? '#8a8a78' : FACCOES[e.dono].cor;
        const x = s.x, y = s.y + 18; // abaixo do nome da província
        if (e.id === selEx) { cxM.strokeStyle = '#ffffff'; cxM.lineWidth = 2; cxM.beginPath(); cxM.ellipse(x, y + 1, 17, 6, 0, 0, Math.PI * 2); cxM.stroke(); }
        let dir = 1; if (mexendo) { const prox = G.prov[e.rota[0]]; if (prox) dir = prox.x >= e.x ? 1 : -1; }
        const px0 = 7 + desenharBoneco(x, y, cor, mexendo, n, agora, dir, tipos);
        // número de soldados numa plaquinha da cor do país
        const txt = String(n); cxM.font = 'bold 10px "Courier New", monospace'; const w0 = Math.max(16, cxM.measureText(txt).width + 8);
        cxM.fillStyle = cor; cxM.fillRect(x + px0, y - 22, w0, 13);
        cxM.strokeStyle = e.semSuprimento ? '#ff9f43' : 'rgba(0,0,0,.6)'; cxM.lineWidth = e.semSuprimento ? 2 : 1; cxM.strokeRect(x + px0, y - 22, w0, 13);
        cxM.fillStyle = '#0d0f0c'; cxM.textAlign = 'center'; cxM.fillText(txt, x + px0 + w0 / 2, y - 12);
        // etiqueta de cada tipo de tropa no grupo (cor própria por tipo, legível de longe)
        let px = x + px0 + w0 + 3; cxM.font = 'bold 10px "Courier New", monospace';
        TIPO_COR.forEach(([id, letra, corT]) => { if (!tipos[id]) return; if (id !== 'inf') tiposVistos = true; cxM.fillStyle = corT; cxM.fillRect(px, y - 22, 13, 13); cxM.strokeStyle = 'rgba(0,0,0,.7)'; cxM.lineWidth = 1; cxM.strokeRect(px, y - 22, 13, 13); cxM.fillStyle = '#111'; cxM.fillText(letra, px + 6.5, y - 12); px += 15; });
        if (e.general && e.dono === 'jogador') { cxM.fillStyle = '#ffd28a'; cxM.font = 'bold 11px sans-serif'; cxM.fillText('★', x - 12, y - 16); }
        if (e.missao === 'saque' && mexendo) { cxM.font = '11px sans-serif'; cxM.fillText('💰', x - 13, y - 2); }
    });
    // espiões
    G.espioes.forEach(sp => { const s = T(sp.x, sp.y); cxM.font = '15px sans-serif'; cxM.textAlign = 'center'; cxM.fillText('👁', s.x, s.y + 5); });
    if (tiposVistos) { // legenda das cores das tropas, fixa no topo do mapa
        cxM.setTransform(d, 0, 0, d, 0, 0); cxM.font = 'bold 10px "Courier New", monospace'; cxM.textAlign = 'left';
        const itens = TIPO_COR.map(([, letra, corT, nome]) => ({ letra, corT, nome, w: 17 + cxM.measureText(nome).width }));
        const total = itens.reduce((t, it) => t + it.w, 0) + 6 * (itens.length - 1) + 12;
        let lx = Math.max(4, (r.width - total) / 2) + 6; const ly = 8;
        cxM.fillStyle = 'rgba(12,15,13,.78)'; cxM.fillRect(lx - 6, ly - 4, total, 20); cxM.strokeStyle = 'rgba(211,154,69,.5)'; cxM.strokeRect(lx - 6, ly - 4, total, 20);
        itens.forEach(it => { cxM.fillStyle = it.corT; cxM.fillRect(lx, ly, 12, 12); cxM.fillStyle = '#111'; cxM.textAlign = 'center'; cxM.fillText(it.letra, lx + 6, ly + 10); cxM.textAlign = 'left'; cxM.fillStyle = '#d6e3d1'; cxM.fillText(it.nome, lx + 15, ly + 10); lx += it.w + 6; });
    }
}

// Sprite pintado com a cor do país (feito uma vez por cor e guardado)
const TINTA = {};
function spriteTingido(chave, cor) {
    const k = chave + cor; if (TINTA[k]) return TINTA[k];
    const im = IMG[chave]; if (!im.complete || !im.naturalWidth) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-atop'; x.globalAlpha = 0.6; x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
    return (TINTA[k] = c);
}
// Quais bonecos desenhar num grupo: cada tipo presente aparece (os mais numerosos primeiro); sobrando lugar, repete o mais numeroso
function figurasDoGrupo(tipos, quantos) {
    const lista = Object.entries(tipos || {}).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    if (!lista.length) lista.push('inf');
    const fig = lista.slice(0, quantos);
    while (fig.length < quantos) fig.push(lista[0]);
    return fig;
}
const TIPO_ESPECIAL = { art: 1, cav: 1, blind: 1 };
// Boneco de soldado no mapa: um a três, conforme o tamanho do exército; cada um mostra um tipo de tropa; andando, as pernas mexem
function desenharBoneco(x, y, cor, andando, n, agora, dir = 1, tipos) {
    const quantos = n >= 10 ? 3 : n >= 4 ? 2 : 1, amigo = cor === FACCOES.jogador.cor, fig = figurasDoGrupo(tipos, quantos);
    const folga = fig.some(t => TIPO_ESPECIAL[t]) ? 13 : 9;
    for (let k = quantos - 1; k >= 0; k--) {
        const t = fig[k], bx = x + (k - (quantos - 1) / 2) * folga * dir, by = y - k * 2 + (andando ? Math.abs(Math.sin(agora * 8 + k)) * -2 : 0);
        cxM.fillStyle = 'rgba(0,0,0,.35)'; cxM.beginPath(); cxM.ellipse(bx, by + 1, TIPO_ESPECIAL[t] ? 9 : 6, 2.2, 0, 0, Math.PI * 2); cxM.fill();
        let topo = 29;
        if (TIPO_ESPECIAL[t]) { desenharTropaEspecial(cxM, t, bx, by, cor, amigo, andando, 0.9, dir, true); topo = t === 'art' ? 22 : t === 'cav' ? 25 : 21; }
        else {
            if (t === 'metr') desenharTropaEspecial(cxM, 'metr', bx, by, cor, amigo, andando, 0.9, dir, true);
            const chave = andando ? 'andando' : 'mira', im = IMG[chave], d = SPRITES[chave];
            if (im.complete && im.naturalWidth) {
                const F = 0.13, img = amigo ? im : (spriteTingido(chave, cor) || im); // inimigo: pintado da cor do país
                cxM.save(); cxM.translate(bx, by); cxM.scale(dir, 1); cxM.drawImage(img, -d.ax * F, -d.ay * F, d.w * F, d.h * F); cxM.restore();
            } else { cxM.fillStyle = '#3a3324'; cxM.fillRect(bx - 2, by - 22, 4, 22); }
        }
        cxM.fillStyle = cor; cxM.beginPath(); cxM.arc(bx, by - topo, 3, 0, Math.PI * 2); cxM.fill(); // a cor do país em cima do boneco
        cxM.strokeStyle = 'rgba(0,0,0,.6)'; cxM.lineWidth = 1; cxM.stroke();
    }
    return (quantos - 1) / 2 * folga; // meio-vão do grupo: a plaquinha do número fica depois dele
}
// Ordens dentro de uma batalha no mapa (artilharia e postura), para o atacante ou o defensor
function acaoBatalha(provId, acao) {
    const b = batalhaEm(provId); if (!b) return;
    const souAtq = b.atqDono === 'jogador', souDef = b.defDono === 'jogador';
    if (acao === 'art' && (souAtq || souDef)) artilhariaNaBatalha(b, souAtq ? 'atq' : 'def');
    else if (souAtq && ['avancar', 'cobertura', 'recuar'].includes(acao)) b.postAtq = acao;
    else if (souDef && ['atacar', 'equilibrio', 'abrigar'].includes(acao)) b.postDef = acao;
    renderPainel();
}
function painelBatalha(b) {
    const souAtq = b.atqDono === 'jogador', nA = b.atq.filter(a => a.s.vida > 0).length, nD = b.def.filter(d => d.s.vida > 0).length;
    const outro = souAtq ? b.defDono : b.atqDono, resta = Math.max(0, C.BAT_DURACAO - b.t);
    const posts = souAtq ? [['avancar', '🏃 Avançar', 'rápido, exposto'], ['cobertura', '🛡 Cobertura', 'lento, protegido'], ['recuar', '↩ Recuar', 'volta para casa']]
                         : [['atacar', '🔥 Atacar', '+dano, +risco'], ['equilibrio', '⚖ Equilíbrio', 'padrão'], ['abrigar', '🛡 Abrigar', '−dano recebido']];
    const atual = souAtq ? b.postAtq : b.postDef, f = G.fac.jogador;
    return `<div class="info"><b style="color:#ff9f6a">⚔️ Batalha em ${b.alvo.nome}</b>: você ${souAtq ? nA : nD} × ${souAtq ? nD : nA} ${FACCOES[outro].nome} · ${Math.ceil(resta / C.BAT_RITMO)}s no máximo</div>
        <div class="acoes">${posts.map(([id, t, d]) => botao(t, d, `acaoBatalha('${b.alvo.id}','${id}')`, { forte: atual === id })).join('')}
        ${botao('💥 Artilharia', b.usouArt ? 'já usada' : `${C.ARTILHARIA} 🪙 · fere todos do outro lado`, `acaoBatalha('${b.alvo.id}','art')`, { off: b.usouArt || f.moedas < C.ARTILHARIA })}</div>`;
}
const contarTipos = (lista) => { const r = {}; lista.forEach(x => { if (x.s.vida > 0) { const t = x.s.tipo || 'inf'; r[t] = (r[t] || 0) + 1; } }); return r; };
function batalhasParaDesenho() {
    if (G.cliente) return G.batalhasVis || [];
    return (G.batalhas || []).filter(b => !b.terminou).map(b => ({ prov: b.alvo.id, atq: b.atqDono, def: b.defDono, de: b.ex.de, nA: b.atq.filter(a => a.s.vida > 0).length, nD: b.def.filter(x => x.s.vida > 0).length, tA: contarTipos(b.atq), tD: contarTipos(b.def), t: Math.round(b.t), pa: b.postAtq, pd: b.postDef, art: b.usouArt ? 1 : 0 }));
}

/* ---------- Painel de baixo ---------- */
function botao(txt, sub, acao, opts = {}) { return `<button class="acao${opts.forte ? ' forte' : ''}" onclick="${acao}" ${opts.off ? 'disabled' : ''}>${txt}${sub ? `<small>${sub}</small>` : ''}</button>`; }
function renderPainel() {
    const el = document.getElementById('painel'); if (!G || !el) return;
    let html = '';
    const t = G.sel && G.sel.tipo;
    if (!G.modo && !G.pendente && t === 'recrutar') html = painelRecrutar(G.sel.id);
    else if (!G.modo && !G.pendente && t === 'obras') html = painelObras(G.sel.id);
    else if (!G.modo && !G.pendente && t === 'pesquisa') html = painelPesquisa();
    else if (!G.modo && !G.pendente && t === 'diplo') html = painelDiplomacia();
    else if (!G.modo && !G.pendente && t === 'generais') html = painelGenerais();
    else if (!G.modo && !G.pendente && t === 'escolherGeneral') html = painelEscolherGeneral(G.sel.id);
    else if (G.modo) {
        const e = G.ex.find(x => x.id === G.modo.exId);
        html = `<div class="titulo"><span>${G.modo.missao === 'saque' ? '💰 Saquear' : '⚔️ Mover / atacar'}</span><span class="dono">${e ? e.s.length + ' soldados' : ''}</span></div>
            <div class="info">Toque no mapa na província de destino. Pode ser sua (a tropa vai por dentro do seu território) ou inimiga, vizinha ou longe.</div>
            <div class="acoes">${botao('✖ Cancelar', '', 'G.modo=null;renderPainel()')}</div>`;
    } else if (G.pendente) {
        const o = G.pendente, e = G.ex.find(x => x.id === o.exId), p = G.prov[o.destId];
        if (!e) { G.pendente = null; return renderPainel(); }
        const defVis = provVisivel(p.id) ? exParadosEm(p.id, p.dono).reduce((t, x) => t + x.s.length, 0) : null;
        const quem = p.dono === 'jogador' ? 'sua' : p.dono === 'neutro' ? 'milícia' : FACCOES[p.dono].nome;
        const emPaz = p.dono !== 'jogador' && !emGuerra('jogador', p.dono);
        html = `<div class="titulo"><span>${o.missao === 'saque' ? '💰 Saquear' : p.dono === 'jogador' || emPaz ? '🚶 Mover para' : '⚔️ Atacar'} ${p.nome}</span><span class="dono" style="color:${FACCOES[p.dono].cor}">${quem}</span></div>
            <div class="info">${p.dono === 'jogador' ? 'Província sua.' : emPaz ? `Território de ${quem}, com quem você está em ${G.rel[p.dono].estado === 'paz' ? 'paz' : 'aliança'}: a tropa só passa, sem lutar.` : defVis === null ? 'Defesa: <b>desconhecida</b> (mande um espião).' : `Defesa: <b>${defVis}</b> soldados (${composicao(exParadosEm(p.id, p.dono).flatMap(x => x.s)) || 'ninguém'}) · trincheira ${Math.round(p.trinch)}%${p.obras.forte ? ' · forte (+25%)' : ''}${p.capital ? ' · capital (+25%)' : ''}.`}
            Chega em ~${o.seg}s${o.rota.length > 1 ? ', passando por ' + o.rota.slice(0, -1).map(id => G.prov[id].nome).join(', ') : ''}.</div>
            ${e.rota.length ? `<div class="info">Vão os ${e.s.length} soldados (a tropa já está em marcha).</div>` : `<div class="seletor">Soldados: <button class="passo" onclick="G.pendente.qtd=Math.max(1,G.pendente.qtd-1);renderPainel()">−</button><b>${o.qtd}</b><button class="passo" onclick="G.pendente.qtd=Math.min(${e.s.length},G.pendente.qtd+1);renderPainel()">+</button><button class="passo" style="width:auto;padding:0 8px;font-size:12px" onclick="G.pendente.qtd=${e.s.length};renderPainel()">todos</button><span class="info">ficam ${e.s.length - o.qtd}</span></div>`}
            <div class="acoes">${botao('✔ Confirmar', '', 'confirmarOrdem()', { forte: true })}${botao('✖ Cancelar', '', 'G.pendente=null;renderPainel()')}</div>`;
    } else if (G.sel && G.sel.tipo === 'ex') {
        const e = G.ex.find(x => x.id === G.sel.id);
        if (!e) { G.sel = null; return renderPainel(); }
        const p = G.prov[e.prov], fome = e.s.filter(s => s.fome >= 50).length, cans = e.s.filter(s => s.cansaco >= 40).length;
        html = `<div class="titulo"><span>🪖 Exército · ${e.s.length} soldados</span><span class="dono" style="color:${FACCOES.jogador.cor}">${e.rota.length ? (e.missao === 'saque' ? 'saqueando' : e.missao === 'voltar' ? 'voltando' : 'em marcha') : 'em ' + p.nome}</span></div>
            <div class="soldados">${e.s.map(s => `<span class="sd" title="${s.nome}" style="background:${corFome(s)}"></span>`).join('')}</div>
            <div class="info">${composicao(e.s)} · ${fome ? `<b style="color:#e3b04b">${fome} com fome</b>` : 'tropa alimentada'}${cans ? ` · ${cans} cansados` : ''} · força ${forca(e.s).toFixed(1)}${e.rota.length ? ` · indo para ${G.prov[e.rota[e.rota.length - 1]].nome}` : ''}
            ${e.semSuprimento ? '<br><b style="color:#ff9f43">⚠ Sem suprimento: longe do seu território a tropa não come.</b>' : ''}
            <br>🎖 ${e.general && GENERAIS.find(g => g.id === e.general) ? `${GENERAIS.find(g => g.id === e.general).nome} (${GENERAIS.find(g => g.id === e.general).txt})` : e.general ? 'general do país (+12%)' : 'sem general'}</div>`;
        const btE = e.emBatalha ? (batalhaEm(e.prov) || batalhaEm(e.aguarda)) : null;
        if (btE && (btE.atqDono === 'jogador' || btE.defDono === 'jogador') && !e.aguarda) html += painelBatalha(btE);
        else if (e.aguarda) html += `<div class="info">⏳ Esperando a batalha de ${G.prov[e.aguarda].nome} acabar para entrar.</div>`;
        else html += e.rota.length ? `<div class="acoes">${botao('↪ Mudar destino', 'depois toque no novo destino', `escolherDestino('${e.id}','ataque')`, { forte: true })}${botao('✋ Parar', 'na próxima província', `cancelarMarcha('${e.id}')`)}</div>`
            : `<div class="acoes">${botao('🚶 Mover / ⚔️ Atacar', 'toque no destino: sua província ou inimiga', `escolherDestino('${e.id}','ataque')`, { forte: true })}${botao('💰 Saquear', `rouba ${Math.round(C.SAQUE_PARTE * 100)}% das moedas e volta`, `escolherDestino('${e.id}','saque')`)}${botao('🎖 General', e.general ? 'trocar' : 'designar', `G.sel={tipo:'escolherGeneral',id:'${e.id}'};renderPainel()`)}</div>`;
    } else if (G.sel && G.sel.tipo === 'prov') {
        const p = G.prov[G.sel.id], f = G.fac.jogador, vis = provVisivel(p.id), cor = FACCOES[p.dono].cor;
        const pr = C.PROD[p.tipo];
        html = `<div class="titulo"><span>${p.nome}</span><span class="dono" style="color:${cor}">${p.dono === 'jogador' ? 'SUA' : FACCOES[p.dono].nome.toUpperCase()}${p.dono !== 'jogador' && p.dono !== 'neutro' ? ' · ' + FACCOES[p.dono].perso : ''}</span></div>
            <div class="info">${TIPO_TXT[p.tipo]} · produz ${pr.comida ? pr.comida + '🍞 ' : ''}${pr.mun ? pr.mun + '🔫 ' : ''}${pr.moedas ? pr.moedas + '🪙' : ''} a cada ${C.CICLO}s${vis ? ` · trincheira ${Math.round(p.trinch)}%` : ''}
            ${p.dono !== 'neutro' && (p.dono === 'jogador' || vis) ? `<br>Moral <b style="color:${p.moral < 35 ? '#ff8a7a' : p.moral < 60 ? '#e3b04b' : '#9fd08f'}">${Math.round(p.moral)}%</b>${p.dono === 'jogador' && p.moral < 35 && !p.capital ? ' ⚠ risco de revolta: deixe 3 soldados aqui ou construa um forte' : ''} · produz ${Math.round(fatorMoral(p) * 100)}%` : ''}
            ${Object.keys(p.obras).filter(o => p.obras[o]).length || p.obra ? `<br>${Object.keys(p.obras).filter(o => p.obras[o]).map(o => OBRAS[o].icone + ' ' + OBRAS[o].nome).join(' · ')}${p.obra ? ` · 🏗 ${OBRAS[p.obra.id].nome} (${Math.ceil(p.obra.resta)}s)` : ''}` : ''}<br>`;
        if (vis) {
            const aqui = G.ex.filter(e => e.prov === p.id && !e.rota.length);
            html += aqui.length ? aqui.map(e => `<span style="color:${FACCOES[e.dono].cor}">${FACCOES[e.dono].nome}: ${e.s.length} soldados</span>`).join(' · ') : 'Ninguém defendendo.';
        } else html += 'Na névoa: você não vê as tropas daqui. Mande um espião.';
        if (p.dono !== 'jogador' && p.dono !== 'neutro') {
            html += espiado(p.dono) ? `<br>👁 ${FACCOES[p.dono].nome}: ${Math.floor(G.fac[p.dono].moedas)} moedas, ${Math.floor(G.fac[p.dono].comida)} de comida, ${tropaDe(p.dono)} soldados (espião por mais ${Math.ceil(G.espiado[p.dono] - G.t)}s).` : '<br>' + PERSO_TXT[FACCOES[p.dono].perso];
        } else if (p.dono === 'neutro') html += '<br>' + PERSO_TXT.neutra;
        html += '</div>';
        const btP = batalhaEm(p.id);
        if (btP && (btP.atqDono === 'jogador' || btP.defDono === 'jogador')) html += painelBatalha(btP);
        else if (btP) html += `<div class="info"><b style="color:#ff9f6a">⚔️ ${FACCOES[btP.atqDono].nome} ataca ${p.nome}</b> (${btP.atq.filter(a => a.s.vida > 0).length} × ${btP.def.filter(d => d.s.vida > 0).length})</div>`;
        html += '<div class="acoes">';
        if (p.dono === 'jogador') {
            const meu = exParadosEm(p.id, 'jogador')[0];
            html += botao('🪖 Recrutar 1', `infantaria · ${custoRecrutar('jogador')} 🪙`, `recrutar('${p.id}');renderPainel()`, { off: f.moedas < custoRecrutar('jogador') });
            html += botao('🪖 Recrutar…', 'escolher tipo e quantidade', `G.sel={tipo:'recrutar',id:'${p.id}'};renderPainel()`);
            html += botao('🏗 Obras', p.obra ? `${OBRAS[p.obra.id].nome}: ${Math.ceil(p.obra.resta)}s` : 'forte, ferrovia, fábrica, hospital', `G.sel={tipo:'obras',id:'${p.id}'};renderPainel()`);
            html += botao('🛡 Fortificar', `${C.FORTIFICAR} 🪙 · +${C.FORT_GANHO}% de trincheira`, `fortificar('${p.id}');renderPainel()`, { off: f.moedas < C.FORTIFICAR || p.trinch >= 100 });
            if (meu) html += botao('🪖 Exército daqui', `${meu.s.length} soldados · mover`, `G.sel={tipo:'ex',id:'${meu.id}'};renderPainel()`);
            // trazer tropa de outra província sua (as mais perto primeiro)
            exDe('jogador').filter(e => parado(e) && e.prov !== p.id).map(e => ({ e, c: rotaPara(e, p.id) })).filter(o => o.c).sort((a, b) => a.c.dist - b.c.dist).slice(0, 2)
                .forEach(o => { html += botao(`🚶 Trazer ${o.e.s.length}`, `de ${G.prov[o.e.prov].nome} · ~${Math.ceil(o.c.dist / velEx(o.e))}s`, `prepararOrdem('${o.e.id}','${p.id}','mover')`); });
        } else {
            html += botao('👁 Espião', `${custoEspiao()} 🪙 · viaja e só observa`, `espionar('${p.id}');renderPainel()`, { off: f.moedas < custoEspiao() || G.espioes.length >= C.ESPIAO_MAX });
            if (p.dono !== 'neutro') html += botao('🤝 Diplomacia', DIPLO_TXT[G.rel[p.dono].estado], `G.sel={tipo:'diplo'};renderPainel()`);
            // atalho: atacar com um dos seus exércitos parados (o mais perto primeiro)
            exDe('jogador').filter(parado).map(e => ({ e, c: rotaPara(e, p.id) })).filter(o => o.c).sort((a, b) => a.c.dist - b.c.dist).slice(0, 3)
                .forEach(o => { html += botao(`${emGuerra('jogador', p.dono) ? '⚔️ Atacar' : '🚶 Mover'} com ${o.e.s.length}`, `de ${G.prov[o.e.prov].nome} · ~${Math.ceil(o.c.dist / velEx(o.e))}s`, `prepararOrdem('${o.e.id}','${p.id}','ataque')`, { forte: emGuerra('jogador', p.dono) }); });
        }
        html += '</div>';
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; } // só troca quando mudou (não engole toques)
}

/* ---------- Desenho das tropas no mapa ---------- */
// Tropas especiais em traços (canhão, cavalo, blindado e a arma da metralhadora), para qualquer canvas
function desenharTropaEspecial(cx, tipo, x, y, cor, amigo, andando, esc = 1, dir = 1, subir = amigo) {
    cx.save(); cx.translate(x, y); cx.scale(esc * dir, esc);
    cx.lineWidth = 1.4; cx.strokeStyle = amigo ? '#9fd08f' : cor; cx.fillStyle = amigo ? '#25331f' : '#2a0f10';
    if (tipo === 'art') {
        cx.beginPath(); cx.arc(-5, -6, 6, 0, Math.PI * 2); cx.fill(); cx.stroke();
        cx.beginPath(); cx.moveTo(-5, -8); cx.lineTo(14, subir ? -22 : -2); cx.lineWidth = 4; cx.stroke(); cx.lineWidth = 1.4;
        cx.beginPath(); cx.moveTo(-10, -2); cx.lineTo(-18, 2); cx.stroke();
    } else if (tipo === 'cav') {
        cx.beginPath(); cx.ellipse(0, -10, 10, 5, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
        [-7, -3, 4, 8].forEach(k => { cx.beginPath(); cx.moveTo(k, -6); cx.lineTo(k + (andando ? Math.sin(Date.now() / 90 + k) * 2 : 0), 0); cx.stroke(); });
        cx.beginPath(); cx.moveTo(9, -12); cx.lineTo(14, -18); cx.lineTo(16, -15); cx.stroke();
        cx.beginPath(); cx.arc(0, -21, 3, 0, Math.PI * 2); cx.fill(); cx.stroke(); cx.beginPath(); cx.moveTo(0, -18); cx.lineTo(0, -13); cx.stroke();
    } else if (tipo === 'blind') {
        cx.fillRect(-13, -14, 26, 10); cx.strokeRect(-13, -14, 26, 10);
        cx.fillRect(-6, -20, 12, 6); cx.strokeRect(-6, -20, 12, 6);
        cx.beginPath(); cx.moveTo(6, -17); cx.lineTo(16, subir ? -24 : -12); cx.lineWidth = 2.5; cx.stroke(); cx.lineWidth = 1.4;
        [-9, -3, 3, 9].forEach(k => { cx.beginPath(); cx.arc(k, -2, 2.6, 0, Math.PI * 2); cx.stroke(); });
    } else if (tipo === 'metr') { // a arma no chão, ao lado do soldado
        cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-9, -1); cx.lineTo(-3, -8); cx.lineTo(3, -1); cx.stroke();
        cx.lineWidth = 3; cx.beginPath(); cx.moveTo(-3, -9); cx.lineTo(12, -11); cx.stroke();
    }
    cx.restore();
}

/* ---------- Topo, telas de início e fim ---------- */
function atualizarTopo() {
    const f = G.fac.jogador, tropa = tropaDe('jogador');
    const rec = (id, v, baixo) => { const el = document.getElementById(id); el.querySelector('b').textContent = Math.floor(v); el.classList.toggle('baixo', baixo); };
    rec('rCom', f.comida, f.comida < tropa); rec('rMun', f.mun, f.mun < 60); rec('rMoe', f.moedas, false);
    const pl = placar(); document.getElementById('rProv').querySelector('b').textContent = `${pl.jogador || 0}/${Object.keys(G.prov).length}`;
    const resta = Math.max(0, G.fase.tempo - G.t);
    document.getElementById('relogio').textContent = `⏰ ${String(Math.floor(resta / 60)).padStart(2, '0')}:${String(Math.floor(resta % 60)).padStart(2, '0')}`;
    document.getElementById('fase').textContent = `${G.fase.n}· ${G.fase.nome.toUpperCase()}`;
    document.getElementById('bVelMapa').textContent = G.velocidade === 1 ? '1×' : '2×';
    const bp = document.getElementById('bPausa'); bp.textContent = G.pausado ? '▶' : '⏸'; bp.classList.toggle('on', !!G.pausado);
    document.getElementById('faixaPausa').style.display = G.pausado && !G.fim ? 'block' : 'none';
    const av = document.getElementById('aviso'), n = G.noticias[0];
    if (n && G.t - n.t < (n.alerta ? 7 : 4.5)) { av.textContent = n.txt; av.className = n.alerta ? 'alerta' : ''; av.style.display = 'block'; }
    else av.style.display = 'none';
}
const linkMenu = () => (location.protocol.startsWith('http') ? '/' : 'ponto-alpha.html');
const botaoMenu = () => `<a class="voltarMenu" href="${linkMenu()}">← Modos de jogo</a>`;
function voltarAoMenu() { salvarPartida(); location.href = linkMenu(); } // a partida fica salva
function mostrarTela(html) { document.getElementById('telaCaixa').innerHTML = html; document.getElementById('tela').style.display = 'flex'; }
function esconderTela() { document.getElementById('tela').style.display = 'none'; }
function comecarFase(n) { apagarSalvamento(); novoJogo(n); G.semSalvar = false; esconderTela(); renderPainel(); salvarPartida(); }
function continuarPartida() { if (carregarPartida()) { esconderTela(); renderPainel(); } else mostrarInicio(); }
function pausar(v) { if (!G || G.fim) return; G.pausado = v === undefined ? !G.pausado : v; if (G.pausado) salvarPartida(); atualizarTopo(); }
function mostrarInicio() {
    const sv = lerSalvamento(), m = lerMeta(), tot = totalEstrelas(m);
    const continuar = sv ? `<button class="grande" onclick="continuarPartida()">▶ CONTINUAR · FASE ${sv.fase} (${String(Math.floor(sv.t / 60)).padStart(2, '0')}:${String(Math.floor(sv.t % 60)).padStart(2, '0')} jogados)</button>` : '';
    const estrelas = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
    const fases = CAPITULOS.map((nome, c) => `<div class="capitulo">${nome}</div>` + FASES.filter(F => F.cap === c).map(F => {
        const lib = faseLiberada(F.n), est = m.estrelas[F.n] || 0;
        return `<button class="fase${lib ? '' : ' trancada'}" ${lib ? '' : 'disabled'} onclick="comecarFase(${F.n})"><b>Fase ${F.n} · ${F.nome}</b><span class="estrelas">${lib ? estrelas(est) : '🔒'}</span>
            <small>${lib ? `${F.bots.length} inimigos · ${Math.round(F.tempo / 60)} min${F.regraTxt ? ' · ' + F.regraTxt : ''}<br>★★★ ${OBJETIVOS[F.objetivo].txt}` : 'vença a fase anterior'}</small></button>`;
    }).join('')).join('');
    mostrarTela(`<h2>🗺️ CONQUISTA · CAMPANHA</h2>${continuar}
        <div class="sub">Você comanda um país pequeno. Em volta, países de bots com personalidades diferentes e terras livres com milícia. Os bots brigam entre si; com você, dá para negociar.</div>
        <details class="regras"><summary>Como jogar</summary><div class="lista">🪖 <b>Exércitos:</b> toque num exército seu, em <b>Mover / Atacar</b> e no destino. Você escolhe quantos vão.<br>
        🐎 <b>Tropas:</b> infantaria, metralhadora (segura a trincheira), artilharia (fura trincheira), cavalaria (rápida) e blindado. As 4 últimas saem da 🔬 pesquisa.<br>
        🏴 Entrar em província sem defesa conquista. Com defesa, tem batalha de até 2 minutos.<br>
        🍞 Todo soldado come. Longe do seu território a tropa fica <b>sem suprimento</b> e passa fome.<br>
        😠 <b>Moral:</b> província longe da capital, recém-conquistada ou com inimigo perto produz menos e pode se revoltar. Deixe tropa lá ou construa um forte.<br>
        🏗 <b>Obras:</b> forte, ferrovia, fábrica e hospital, em qualquer província sua.<br>
        🤝 <b>Diplomacia:</b> paz com tributo e aliança com os bots. Cuidado: alguns traem.<br>
        🎖 <b>Generais:</b> dão bônus ao exército, sobem de nível e ficam com você entre as fases. Novos generais saem com as estrelas.<br>
        👁 <b>Espião:</b> viaja e só observa. 💰 <b>Saque:</b> rouba ${Math.round(C.SAQUE_PARTE * 100)}% das moedas e volta.<br>
        ★ Vence quem tomar todas as capitais, ou quem tiver mais províncias quando o tempo acabar. Perder a sua capital é derrota.<br>
        ⭐ Estrelas: ★ vencer · ★★ tomar as capitais usando até 70% do tempo · ★★★ objetivo da fase.<br>
        🖐 Arraste o mapa; dois dedos (ou ＋ －) dão zoom. ⏸ pausa (dá para dar ordens pausado). 💾 Salva sozinho.</div></details>
        ${sv ? '<div class="sub" style="margin-top:8px">Começar uma fase nova apaga a partida salva.</div>' : ''}
        <div class="sub" style="margin-top:8px">⭐ ${tot} estrelas · 🎖 ${generaisLiberados().length} de ${GENERAIS.length} generais</div>
        ${fases}
        ${botaoMenu()}`);
}
function mostrarFim() {
    apagarSalvamento();
    const venceu = G.fim === 'vitoria' || G.fim === 'pontos';
    som(venceu ? 'vitoria' : 'derrota');
    const est = calcularEstrelas(), antes = lerMeta(), totAntes = totalEstrelas(antes), genAntes = generaisLiberados().length;
    guardarProgresso(est);
    const novosGen = generaisLiberados().slice(genAntes);
    const pl = placar(), F = G.fase, mm = Math.floor(G.t / 60), ss = String(Math.floor(G.t % 60)).padStart(2, '0');
    const proxima = F.n < FASES.length && venceu;
    const titulo = { vitoria: `🏆 FASE ${F.n} VENCIDA!`, pontos: '🏆 VITÓRIA POR TERRITÓRIO', tempo: '⏰ O TEMPO ACABOU', derrota: '✝ SUA CAPITAL CAIU' }[G.fim];
    const texto = G.fim === 'vitoria' ? `Todas as capitais inimigas tomadas em ${mm}:${ss}.`
        : G.fim === 'pontos' ? `O tempo acabou e você tem mais províncias que qualquer inimigo (${pl.jogador || 0}).`
        : G.fim === 'tempo' ? `Você terminou com ${pl.jogador || 0} províncias, menos que o maior inimigo. Para vencer: tome as capitais, ou tenha mais terra quando o tempo acabar.`
        : `Você resistiu ${mm}:${ss} e chegou a ter ${pl.jogador || 0} províncias.`;
    const linhas = venceu ? `<div class="lista">${est >= 1 ? '★' : '☆'} vencer<br>${est >= 2 && G.fim === 'vitoria' && G.t <= F.tempo * 0.7 ? '★' : '☆'} tomar as capitais em até ${Math.round(F.tempo * 0.7 / 60)} min<br>${OBJETIVOS[F.objetivo].ok() ? '★' : '☆'} ${OBJETIVOS[F.objetivo].txt}</div>` : '';
    const xp = Object.entries(G.genXp || {}).filter(([, v]) => v).map(([id, v]) => `${GENERAIS.find(g => g.id === id).nome} +${v}`).join(' · ');
    mostrarTela(`<h2>${titulo}</h2><div class="estrelas-grandes">${venceu ? '★'.repeat(est) + '☆'.repeat(3 - est) : ''}</div><div class="sub">${texto}</div>${linhas}
        ${xp ? `<div class="sub" style="margin-top:6px">🎖 Experiência: ${xp}</div>` : ''}
        ${novosGen.map(g => `<div class="sub" style="margin-top:6px;color:#ffd28a">🎖 Novo general liberado: <b>${g.nome}</b> (${g.txt}).</div>`).join('')}
        ${totalEstrelas(lerMeta()) > totAntes ? `<div class="sub" style="margin-top:6px">⭐ Total na campanha: ${totalEstrelas(lerMeta())} estrelas.</div>` : ''}
        ${proxima ? `<button class="grande" onclick="comecarFase(${F.n + 1})">FASE ${F.n + 1}: ${FASES[F.n].nome.toUpperCase()} ▶</button>` : ''}
        ${F.n === FASES.length && venceu ? '<div class="sub" style="margin-top:10px">🎖 Campanha completa!</div>' : ''}
        <button class="grande${proxima ? ' secundaria' : ''}" onclick="comecarFase(${F.n})">JOGAR A FASE ${F.n} DE NOVO</button>
        <button class="grande secundaria" onclick="mostrarInicio()">ESCOLHER FASE</button>${botaoMenu()}`);
}

/* ---------- Som: música (as mesmas do modo Trincheiras) e efeitos gerados no navegador ----------
   A música passa pelo mesmo mixer dos efeitos (no iPhone o volume do <audio> é ignorado).
   O navegador só libera o som depois do primeiro toque na tela. */
const SOM = {
    ligado: (() => { try { return localStorage.getItem('frontline-conquista-som') !== '0'; } catch (e) { return true; } })(),
    ctx: null, efeitos: null, musica: null, ruido: null, ultimo: {}, faixa: null,
    mapa: new Audio('assets/music/war_theme.mp3'), batalha: new Audio('assets/music/to_battle.mp3')
};
[SOM.mapa, SOM.batalha].forEach(a => { a.loop = true; a.preload = 'none'; a.volume = 0.35; }); // só baixa quando for tocar
function iniciarSom() {
    if (SOM.ctx) { if (SOM.ctx.state !== 'running') SOM.ctx.resume().catch(() => {}); return; }
    try {
        SOM.ctx = new (window.AudioContext || window.webkitAudioContext)();
        SOM.efeitos = SOM.ctx.createGain(); SOM.efeitos.gain.value = 0.55; SOM.efeitos.connect(SOM.ctx.destination);
        SOM.musica = SOM.ctx.createGain(); SOM.musica.gain.value = 0.35; SOM.musica.connect(SOM.ctx.destination);
        try { [SOM.mapa, SOM.batalha].forEach(a => { SOM.ctx.createMediaElementSource(a).connect(SOM.musica); a.volume = 1; }); } catch (e) {}
        // ruído branco guardado (base dos tiros e explosões)
        const n = SOM.ctx.sampleRate, buf = SOM.ctx.createBuffer(1, n, n), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        SOM.ruido = buf;
    } catch (e) { SOM.ctx = null; }
}
function tocarMusica(qual) {
    if (SOM.faixa === qual && (!SOM.ligado || !SOM[qual] || !SOM[qual].paused)) return;
    SOM.faixa = qual;
    ['mapa', 'batalha'].forEach(k => { if (k !== qual) SOM[k].pause(); });
    if (!SOM.ligado || !qual || document.hidden) return;
    const a = SOM[qual]; if (qual === 'batalha') a.currentTime = 0;
    const p = a.play(); if (p && p.catch) p.catch(() => {});
}
function alternarSom() {
    SOM.ligado = !SOM.ligado;
    try { localStorage.setItem('frontline-conquista-som', SOM.ligado ? '1' : '0'); } catch (e) {}
    if (SOM.ligado) { iniciarSom(); const q = SOM.faixa || 'mapa'; SOM.faixa = null; tocarMusica(q); } else { SOM.mapa.pause(); SOM.batalha.pause(); }
    atualizarBotaoSom();
}
function atualizarBotaoSom() { const b = document.getElementById('bSom'); if (b) { b.textContent = SOM.ligado ? '🔊' : '🔇'; b.title = SOM.ligado ? 'Desligar o som' : 'Ligar o som'; } }
// efeitos: cada um tem um intervalo mínimo para não virar barulho
function som(tipo, forca = 1) {
    if (!SOM.ligado || !SOM.ctx || SOM.ctx.state !== 'running' || document.hidden) return;
    const agora = SOM.ctx.currentTime, minimo = { tiro: 0.07, abate: 0.15, alerta: 1.2, recrutar: 0.08 }[tipo] || 0.05;
    if (agora - (SOM.ultimo[tipo] || 0) < minimo) return;
    SOM.ultimo[tipo] = agora;
    const c = SOM.ctx, saida = SOM.efeitos;
    const ruido = (dur, filtro, freq, vol, q = 1) => {
        const src = c.createBufferSource(); src.buffer = SOM.ruido; src.playbackRate.value = 0.8 + Math.random() * 0.4;
        const f = c.createBiquadFilter(); f.type = filtro; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(); g.gain.setValueAtTime(vol, agora); g.gain.exponentialRampToValueAtTime(0.001, agora + dur);
        src.connect(f); f.connect(g); g.connect(saida); src.start(agora, Math.random() * 0.5, dur + 0.05);
    };
    const nota = (freq, ini, dur, vol, forma = 'triangle') => {
        const o = c.createOscillator(), g = c.createGain(); o.type = forma; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, agora + ini); g.gain.exponentialRampToValueAtTime(vol, agora + ini + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, agora + ini + dur);
        o.connect(g); g.connect(saida); o.start(agora + ini); o.stop(agora + ini + dur + 0.05);
    };
    if (tipo === 'tiro') { ruido(0.12, 'bandpass', 1400 + Math.random() * 900, 0.35 * forca, 0.8); ruido(0.2, 'lowpass', 300, 0.25 * forca); }
    else if (tipo === 'abate') { ruido(0.25, 'lowpass', 500, 0.3); nota(140, 0, 0.25, 0.12, 'sine'); }
    else if (tipo === 'explosao') { ruido(1.2, 'lowpass', 220, 0.9); ruido(0.4, 'bandpass', 900, 0.4); nota(55, 0, 0.9, 0.3, 'sine'); }
    else if (tipo === 'alerta') { nota(660, 0, 0.16, 0.18, 'square'); nota(520, 0.2, 0.22, 0.18, 'square'); }
    else if (tipo === 'conquista') { [392, 494, 587, 784].forEach((f, i) => nota(f, i * 0.11, 0.35, 0.2)); }
    else if (tipo === 'perda') { [330, 262, 196].forEach((f, i) => nota(f, i * 0.16, 0.4, 0.2, 'sawtooth')); }
    else if (tipo === 'recrutar') { nota(880, 0, 0.08, 0.12, 'square'); nota(1175, 0.06, 0.1, 0.1, 'square'); }
    else if (tipo === 'ordem') { nota(523, 0, 0.09, 0.12); nota(659, 0.07, 0.12, 0.12); }
    else if (tipo === 'espiao') { nota(1047, 0, 0.12, 0.08, 'sine'); nota(1319, 0.12, 0.16, 0.08, 'sine'); }
    else if (tipo === 'vitoria') { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.15, 0.4, 0.22)); }
    else if (tipo === 'derrota') { [392, 349, 311, 262].forEach((f, i) => nota(f, i * 0.28, 0.55, 0.2, 'sawtooth')); }
    else if (tipo === 'toque') nota(740, 0, 0.05, 0.05, 'sine');
}
document.addEventListener('pointerdown', () => { if (SOM.ligado) { iniciarSom(); if (!SOM.faixa) tocarMusica('mapa'); else if (SOM[SOM.faixa] && SOM[SOM.faixa].paused) { const q = SOM.faixa; SOM.faixa = null; tocarMusica(q); } } }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) { SOM.mapa.pause(); SOM.batalha.pause(); } else if (SOM.faixa) { const q = SOM.faixa; SOM.faixa = null; tocarMusica(q); } });

/* ---------- Laço ---------- */
document.addEventListener('visibilitychange', () => { if (document.hidden) salvarPartida(); });
window.addEventListener('pagehide', () => salvarPartida());
let ultimo = performance.now();
function laco(agora) {
    const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    const telaAberta = document.getElementById('tela').style.display === 'flex';
    // batalhas do mapa em que você está: música de batalha e tiroteio de fundo
    const lutando = (G && G.batalhas || []).some(b => !b.terminou && (b.atqDono === 'jogador' || b.defDono === 'jogador'));
    if (G && !G.fim && !G.pausado && !telaAberta && lutando && Math.random() < dt * 5) som('tiro', 0.35);
    if (G && SOM.faixa && SOM.faixa !== (lutando && !G.fim ? 'batalha' : 'mapa')) tocarMusica(lutando && !G.fim ? 'batalha' : 'mapa');
    if (!telaAberta && G && !G.fim && !G.pausado) {
        if (G.cliente) { if (typeof passoCliente === 'function') passoCliente(dt); } else passoMapa(dt * G.velocidade);
    }
    if (G) { desenharMapa(); atualizarTopo(); }
    // salva a cada 5 s de jogo
    if (G && !G.fim && !G.pausado && G.t - (G.salvoT || 0) >= 5) { if (salvarPartida()) G.salvoT = G.t; }
    if (G && Math.floor(agora / 500) !== Math.floor((agora - dt * 1000) / 500) && !G.pendente) renderPainel();
    requestAnimationFrame(laco);
}
atualizarBotaoSom();
ajustar(cvM);
novoJogo(lerSalvamento() ? lerSalvamento().fase : Math.min(lerFase(), FASES.length));
G.semSalvar = true; // a partida de fundo da tela de início não sobrescreve o salvamento
renderPainel();
mostrarInicio();
requestAnimationFrame(laco);
