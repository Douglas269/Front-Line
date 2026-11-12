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
    RECRUTAR: 20, RECRUTAR_EXTRA: 2, TROPA_BASE: 12, // cada soldado acima de 12 encarece o próximo em 2 moedas
    FORTIFICAR: 25, FORT_GANHO: 30, TRINCH_BASE: 40, TRINCH_CAPITAL: 70,
    ESPIAO: 15, ESPIAO_DURA: 60, ESPIAO_VEL: 45, ESPIAO_MAX: 2,
    ARTILHARIA: 30, SAQUE_PARTE: 0.3,
    VEL: 12,                  // velocidade dos exércitos (unidades do mapa por segundo)
    BAT_DURACAO: 120, DIST: 300, VELBAT: { avancar: 14, cobertura: 6, recuar: -12 },
    TIRO_DEF: 0.18, TIRO_ATQ: 0.16, DANO_TIRO: 30, TRINCH_PROTEGE: 0.35, CORPO_A_CORPO: 0.45,
    CAPITAL_DEFESA: 1.25,     // capital defende 25% melhor
    BOT_PENSA: 8, BOT_PENSA_VAR: 6,
    BOT_PAUSA_ATAQUE: 40,     // depois de atacar, o bot espera pelo menos isto para atacar de novo
    BOT_MARGEM: 1.35          // só ataca quando acha que tem 35% a mais de força
};
const FASES = [
    { n: 1, nome: 'Fronteira', semente: 1101, celulas: 52, mar: 0.05, W: 860, H: 1120, bots: ['bravo', 'charlie', 'delta'], tempo: 900, extra: 1, milicia: 0 },
    { n: 2, nome: 'Região central', semente: 2207, celulas: 66, mar: 0.05, W: 980, H: 1280, bots: ['bravo', 'charlie', 'delta', 'echo'], tempo: 1080, extra: 2, milicia: 1 },
    { n: 3, nome: 'A capital', semente: 3301, celulas: 86, mar: 0.05, W: 1100, H: 1440, bots: ['bravo', 'charlie', 'delta', 'echo'], tempo: 1200, extra: 2, milicia: 1, capitalForte: 'delta' }
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
function soldado(nome) { return { nome, vida: 100, fome: 10, cansaco: 0 }; }
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
const custoRecrutar = (dono) => C.RECRUTAR + C.RECRUTAR_EXTRA * Math.max(0, tropaDe(dono) - C.TROPA_BASE);
const ehCidade = (p) => p.tipo === 'cidade' || p.tipo === 'capital';
const vivoNoJogo = (dono) => dono === 'jogador' || dono === 'neutro' || !G.eliminados[dono];
function noticia(txt, alerta) { G.noticias.unshift({ txt, alerta, t: G.t }); G.noticias = G.noticias.slice(0, 30); }
function lerFase() { try { return Math.max(1, +(localStorage.getItem('frontline-conquista-fase') || 1)); } catch (e) { return 1; } }
function liberarFase(n) { try { if (n > lerFase()) localStorage.setItem('frontline-conquista-fase', String(n)); } catch (e) {} }

/* ---------- Começo de uma fase ---------- */
function novoJogo(numFase) {
    const F = FASES[(numFase || 1) - 1];
    MAPA = gerarMapa(F);
    const r = rngSemente(F.semente + 7);
    G = {
        fase: F, t: 0, fim: null, sel: null, modo: null, pendente: null, noticias: [], espiado: {}, revelado: {}, espioes: [],
        ultimoAtaque: {}, eliminados: {}, batalha: null, ciclo: 0, ex: [], velocidade: 1,
        fac: { jogador: { comida: 40, mun: 150, moedas: 50 }, neutro: { comida: 0, mun: 100, moedas: 0 } },
        prov: {}, pensar: {}
    };
    F.bots.forEach((b, i) => { G.fac[b] = { comida: 40, mun: 150, moedas: b === 'delta' ? 70 : 50 }; G.pensar[b] = 60 + i * 12 + r() * 10; });
    MAPA.prov.forEach(pm => {
        const t = r(), tipo = t < 0.38 ? 'campo' : t < 0.58 ? 'floresta' : t < 0.74 ? 'morro' : 'cidade';
        G.prov[pm.id] = { id: pm.id, nome: pm.nome, x: pm.x, y: pm.y, viz: pm.viz, poli: pm.poli, path: caminhoDe(pm.poli), dono: 'neutro', tipo, trinch: C.TRINCH_BASE, capital: false };
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
        Object.assign(c, { dono, tipo: 'capital', capital: true, trinch: C.TRINCH_CAPITAL });
        // províncias iniciais em volta: a primeira é sempre um campo (comida)
        const livres = c.viz.map(id => G.prov[id]).filter(p => p.dono === 'neutro' && !p.capital).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y));
        livres.slice(0, F.extra).forEach((p, k) => { p.dono = dono; if (k === 0) p.tipo = 'campo'; criarExercito(dono, p.id, 2); });
        criarExercito(dono, c.id, dono === F.capitalForte ? 14 : dono === 'delta' ? 10 : 8);
        if (dono === F.capitalForte) c.trinch = 100;
    });
    // milícias nas províncias livres
    lista.filter(p => p.dono === 'neutro').forEach(p => criarExercito('neutro', p.id, (p.tipo === 'cidade' ? 4 : p.tipo === 'campo' ? 2 : 3) + F.milicia));
    TERRENO = pintarTerreno(MAPA, lista, F.semente, Math.min(2, Math.sqrt(4.2e6 / (MAPA.W * MAPA.H)))); // até ~4 milhões de pixels (leve no celular)
    G.capitalJogador = capJ.id;
    G.sel = { tipo: 'prov', id: capJ.id };
    noticia(`Fase ${F.n}: ${F.nome}. Tome as capitais inimigas (★). Toque num exército seu e escolha o destino.`);
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
function recrutarEm(provId, dono) {
    const p = G.prov[provId], f = G.fac[dono], custo = custoRecrutar(dono);
    if (!p || p.dono !== dono || f.moedas < custo) return false;
    f.moedas -= custo;
    const e = exParadosEm(provId, dono)[0] || criarExercito(dono, provId, 0);
    e.s.push(soldado(dono === 'jogador' ? NOMES_JOG[Math.floor(Math.random() * NOMES_JOG.length)] : 'Inimigo'));
    return true;
}
function recrutar(id, n = 1) {
    let feitos = 0; while (feitos < n && recrutarEm(id, 'jogador')) feitos++;
    if (feitos) noticia(`🪖 ${feitos === 1 ? 'Novo soldado' : feitos + ' novos soldados'} em ${G.prov[id].nome}.`);
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
    if (!p || p.dono === 'jogador' || f.moedas < C.ESPIAO || G.espioes.length >= C.ESPIAO_MAX) return false;
    const base = minhas().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!base) return false;
    f.moedas -= C.ESPIAO;
    G.espioes.push({ para: id, x: base.x, y: base.y });
    noticia(`👁 Espião saiu de ${base.nome} para ${p.nome}. Ele não luta: só observa.`);
    return true;
}

/* ---------- Visão (névoa de guerra) ---------- */
function provVisivel(id) {
    const p = G.prov[id];
    if (p.dono === 'jogador' || G.revelado[id] > G.t) return true;
    return p.viz.some(v => G.prov[v].dono === 'jogador');
}
function exVisivel(e) {
    if (e.dono === 'jogador' || G.espiado[e.dono] > G.t) return true;
    if (provVisivel(e.prov)) return true;
    return e.rota.length > 0 && provVisivel(e.rota[0]);
}
const espiado = (dono) => G.espiado[dono] > G.t;

/* ---------- Economia ---------- */
function cicloEconomia() {
    G.ciclo++;
    Object.values(G.prov).forEach(p => {
        if (p.dono === 'neutro') return;
        const f = G.fac[p.dono], pr = C.PROD[p.tipo];
        f.comida += pr.comida; f.mun += pr.mun; f.moedas += pr.moedas;
        const base = p.capital ? C.TRINCH_CAPITAL : C.TRINCH_BASE;
        if (p.trinch < base) p.trinch = Math.min(base, p.trinch + 2);
    });
    Object.keys(G.fac).filter(d => d !== 'neutro').forEach(dono => {
        const f = G.fac[dono], FX = FACCOES[dono];
        const esquece = dono !== 'jogador' && Math.random() < FX.esquece; // bot erra: esquece de alimentar a tropa
        exDe(dono).forEach(e => e.s.forEach(s => {
            s.fome = Math.min(100, s.fome + C.FOME_CICLO);
            if (!esquece && s.fome >= C.COME_SE && f.comida >= 1) { f.comida -= 1; s.fome = Math.max(0, s.fome - C.COME_ALIVIA); }
            if (s.fome >= 90) s.vida -= 4;
            else if (s.fome < 50) s.vida = Math.min(100, s.vida + 3);
            s.cansaco = Math.max(0, s.cansaco - 6);
        }));
        if (esquece && espiado(dono)) noticia(`👁 Espião: ${FX.nome} esqueceu de alimentar a tropa.`);
    });
    limparMortos();
}
function limparMortos() {
    G.ex.forEach(e => { e.s = e.s.filter(s => s.vida > 0); });
    G.ex = G.ex.filter(e => e.s.length || e.emBatalha);
}

/* ---------- Bots ---------- */
function ameaca(p, dono) { // força inimiga parada ao lado ou marchando para cá
    return G.ex.filter(e => e.dono !== dono && e.dono !== 'neutro' && (e.prov === p.id || p.viz.includes(e.prov) || e.rota.includes(p.id))).reduce((t, e) => t + forca(e.s), 0);
}
function defesaEm(p) { // força que defende a província (com trincheira e capital)
    const def = exParadosEm(p.id, p.dono).reduce((t, e) => t + forca(e.s), 0);
    return def * (1 + p.trinch / 250) * (p.capital ? C.CAPITAL_DEFESA : 1);
}
function pensarBot(dono) {
    const FX = FACCOES[dono], f = G.fac[dono], provs = provDe(dono);
    if (!provs.length || G.eliminados[dono]) return;
    const capital = provs.find(p => p.capital && p.dono === dono);
    // 1) recrutar (sempre que sobra dinheiro), primeiro onde está mais ameaçado
    const cidades = provs.slice().sort((a, b) => (ameaca(b, dono) - forca(exParadosEm(b.id, dono).flatMap(e => e.s))) - (ameaca(a, dono) - forca(exParadosEm(a.id, dono).flatMap(e => e.s))));
    for (let k = 0; k < 3 && cidades.length; k++) { if (f.moedas < custoRecrutar(dono) + FX.reserva || Math.random() < 0.2) break; recrutarEm(cidades[0].id, dono); }
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
    if (G.t < (G.ultimoAtaque[dono] || 0) + C.BOT_PAUSA_ATAQUE || Math.random() > FX.vontade) return;
    const opcoes = [];
    exDe(dono).filter(e => parado(e) && e.s.length >= 3).forEach(e => {
        const casa = G.prov[e.prov];
        const deixar = casa.capital ? (FX.perso === 'agressivo' && Math.random() < 0.25 ? 1 : 4) : (ameaca(casa, dono) > 0 ? 2 : 1);
        const manda = e.s.length - deixar; if (manda < 2) return;
        const enviados = vivos(e.s).sort((a, b) => eficacia(b) - eficacia(a)).slice(0, manda);
        casa.viz.map(id => G.prov[id]).filter(q => q.dono !== dono).forEach(q => {
            let est = defesaEm(q) * (1 + (Math.random() - 0.5) * 0.6);
            const fora = G.ex.filter(x => x.dono === q.dono && x.rota.length && x.origem === q.id).length; // oportunista: dono saiu para brigar
            let pref = q.dono === 'neutro' ? 1.3 : q.capital ? 1.4 : 1;
            if (FX.perso === 'oportunista' && fora) pref *= 1.6;
            if (FX.perso === 'agressivo' && q.dono === 'jogador') pref *= 1.2;
            opcoes.push({ e, q, manda, est, pref, forcaEnv: forca(enviados) });
        });
    });
    const boas = opcoes.filter(o => o.forcaEnv > o.est * FX.coragem * C.BOT_MARGEM).sort((a, b) => b.pref * (b.forcaEnv - b.est) - a.pref * (a.forcaEnv - a.est));
    let esc = boas[0];
    if (!esc && FX.perso === 'agressivo' && opcoes.length && Math.random() < 0.08) esc = opcoes[Math.floor(Math.random() * opcoes.length)]; // erro: ataca sem vantagem
    // ladrão: prefere saquear quem tem dinheiro
    if (FX.perso === 'ladrão' && Math.random() < 0.55) {
        const s = opcoes.filter(o => o.q.dono !== 'neutro' && G.fac[o.q.dono].moedas > 30 && o.forcaEnv > o.est * 0.9).sort((a, b) => G.fac[b.q.dono].moedas - G.fac[a.q.dono].moedas)[0];
        if (s && ordem(s.e.id, s.q.id, Math.min(4, s.manda), 'saque')) { G.ultimoAtaque[dono] = G.t; return; }
    }
    if (esc && ordem(esc.e.id, esc.q.id, esc.manda, 'ataque')) G.ultimoAtaque[dono] = G.t;
}

/* ---------- Movimento e chegada ---------- */
function moverExercitos(dt) {
    G.ex.slice().forEach(e => {
        if (!e.rota.length || e.emBatalha) return;
        const alvo = G.prov[e.rota[0]];
        const dx = alvo.x - e.x, dy = alvo.y - e.y, d = Math.hypot(dx, dy), passo = C.VEL * dt;
        if (d <= passo) { e.x = alvo.x; e.y = alvo.y; chegar(e, alvo); }
        else { e.x += dx / d * passo; e.y += dy / d * passo; }
        if (e.dono !== 'jogador' && e.rota.length) avisarSeVisivel(e);
    });
}
function chegar(e, p) {
    e.de = e.prov; e.prov = p.id; e.rota.shift();
    if (p.dono !== e.dono) {
        const defensores = exParadosEm(p.id, p.dono);
        if (defensores.some(d => d.s.length)) {
            const b = criarBatalha(e, p, defensores);
            e.emBatalha = true;
            if (e.dono === 'jogador' || p.dono === 'jogador') {
                if (G.batalha) { while (!b.terminou) b.passo(0.25); concluirBatalha(b); if (e.dono === 'jogador' || p.dono === 'jogador') noticia('⚙️ Batalha resolvida sozinha (você estava em outra).'); }
                else abrirBatalha(b);
            } else { while (!b.terminou) b.passo(0.25); concluirBatalha(b); }
            return;
        }
        if (e.missao === 'saque') { saquear(e, p); return; }
        conquistar(p, e.dono, e);
    }
    if (!e.rota.length) parar(e);
}
function parar(e) {
    if (e.missao === 'voltar') e.missao = 'mover';
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
    p.dono = dono; p.trinch = 20;
    const ver = dono === 'jogador' || antigo === 'jogador' || provVisivel(p.id) || espiado(dono);
    if (antigo !== 'neutro') { // leva parte do tesouro e da comida
        const fa = G.fac[antigo], fn = G.fac[dono], parte = p.capital ? 0.5 : 0.15;
        ['moedas', 'comida'].forEach(k => { const v = Math.floor(fa[k] * parte); fa[k] -= v; fn[k] += v; });
    }
    if (e) e.s.push(...Array.from({ length: p.tipo === 'cidade' || p.capital ? 2 : 1 }, () => soldado(dono === 'jogador' ? 'Recruta' : 'Inimigo'))); // moradores se juntam
    if (ver) noticia(`🏴 ${FACCOES[dono].nome} conquistou ${p.nome}${antigo === 'neutro' ? '' : ' de ' + FACCOES[antigo].nome}.`, antigo === 'jogador');
    if (p.capital && antigo !== 'neutro') {
        if (antigo === 'jogador') { G.fim = 'derrota'; return mostrarFim(); }
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
    if (G.prov[G.capitalJogador].dono !== 'jogador') { G.fim = 'derrota'; return mostrarFim(); }
    if (G.fase.bots.every(b => G.eliminados[b])) { G.fim = 'vitoria'; liberarFase(G.fase.n + 1); return mostrarFim(); }
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
        postAtq: 'avancar', postDef: 'equilibrio', efeitos: [], rapido: false
    };
    b.passo = (dt) => passoBatalha(b, dt);
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
        defVivos.forEach(d => { if (Math.random() < C.TIRO_DEF * eficacia(d.s) * pd.dano * exposicao * munD * cap * dt) noCampo[Math.floor(Math.random() * noCampo.length)].s.vida -= dano(); });
        fd.mun = Math.max(0, fd.mun - defVivos.length * 0.5 * dt);
    }
    if (defVivos.length) {
        const munA = fa.mun > 0 ? 1 : 0.3;
        atqVivos.filter(a => a.dist < 220).forEach(a => {
            const corpo = a.dist <= 0;
            const chance = corpo ? C.CORPO_A_CORPO * eficacia(a.s) * pd.rec
                : C.TIRO_ATQ * (b.postAtq === 'cobertura' ? 0.6 : 1) * eficacia(a.s) * munA * (1 - C.TRINCH_PROTEGE * b.alvo.trinch / 100) * pd.rec;
            if (Math.random() < chance * dt) defVivos[Math.floor(Math.random() * defVivos.length)].s.vida -= dano();
        });
        fa.mun = Math.max(0, fa.mun - atqVivos.length * 0.4 * dt);
    }
    const naTrincheira = atqVivos.filter(a => a.dist <= 0);
    if (naTrincheira.length && defVivos.length) defVivos.forEach(d => { if (Math.random() < C.CORPO_A_CORPO * eficacia(d.s) * dt) naTrincheira[Math.floor(Math.random() * naTrincheira.length)].s.vida -= dano(); });
    b.atq.forEach(a => { if (a.s.vida <= 0 && !a.morto) { a.morto = true; b.efeitos.push({ x: a.x, y: a.dist, vida: 0.6, tipo: 'abate' }); } });
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
    alvos.filter(x => x.s.vida > 0).forEach(x => { x.s.vida -= 35; b.efeitos.push({ x: x.x, y: lado === 'atq' ? -1 : x.dist, vida: 0.8, tipo: 'explosao' }); });
}
function concluirBatalha(b) {
    const e = b.ex, p = b.alvo;
    e.emBatalha = false;
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
    if (G.fim || G.batalha) return;
    G.t += dt;
    if (G.t >= G.fase.tempo) return fimPorTempo();
    if (Math.floor(G.t / C.CICLO) > G.ciclo) cicloEconomia();
    Object.keys(G.pensar).forEach(dono => { G.pensar[dono] -= dt; if (G.pensar[dono] <= 0) { G.pensar[dono] = C.BOT_PENSA + Math.random() * C.BOT_PENSA_VAR; pensarBot(dono); } });
    moverExercitos(dt);
    // espiões viajando
    G.espioes = G.espioes.filter(s => {
        const p = G.prov[s.para], dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), passo = C.ESPIAO_VEL * dt;
        if (d > passo) { s.x += dx / d * passo; s.y += dy / d * passo; return true; }
        relatorioEspiao(p);
        return false;
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
    noticia(txt);
    G.ultimoRelatorio = txt;
}
function fimPorTempo() {
    const pl = placar(), meu = pl.jogador || 0, melhorBot = Math.max(0, ...G.fase.bots.map(b => pl[b] || 0));
    G.fim = meu > melhorBot ? 'pontos' : 'tempo';
    if (G.fim === 'pontos') liberarFase(G.fase.n + 1);
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
window.addEventListener('resize', () => { ajustar(cvM); ajustar(cvB); limitarCam(); });
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
    G.pendente = { exId, destId, missao, qtd: e.s.length, rota: c.rota, seg: Math.ceil(c.dist / C.VEL) };
    G.sel = { tipo: 'ex', id: exId };
    renderPainel();
}
function confirmarOrdem() {
    const o = G.pendente; if (!o) return;
    const novo = ordem(o.exId, o.destId, o.qtd, o.missao);
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
        if (p.trinch >= 80 && provVisivel(p.id)) { cxM.font = '10px sans-serif'; cxM.fillText('🛡', s.x + cxM.measureText(txt).width / 2 + 8, s.y - 14); }
    });
    // exércitos
    const selEx = G.sel && G.sel.tipo === 'ex' ? G.sel.id : (G.modo ? G.modo.exId : null);
    const agrup = {};
    G.ex.forEach(e => {
        if (!exVisivel(e)) return;
        const k = e.rota.length ? e.id : e.prov + '|' + e.dono; // parados na mesma província juntam no desenho
        if (!agrup[k]) agrup[k] = { e, n: 0 }; agrup[k].n += e.s.length;
    });
    Object.values(agrup).forEach(({ e, n }) => {
        const s = T(e.x, e.y), mexendo = e.rota.length > 0, cor = FACCOES[e.dono].cor;
        const off = e.dono === 'jogador' ? 0 : e.dono === 'neutro' ? 0 : 0;
        const x = s.x + off, y = s.y + 6;
        const w = 30, h = 18;
        cxM.fillStyle = 'rgba(0,0,0,.5)'; cxM.fillRect(x - w / 2 + 2, y - h / 2 + 2, w, h);
        cxM.fillStyle = e.dono === 'neutro' ? '#55554a' : cor; cxM.fillRect(x - w / 2, y - h / 2, w, h);
        cxM.strokeStyle = e.id === selEx ? '#ffffff' : 'rgba(0,0,0,.6)'; cxM.lineWidth = e.id === selEx ? 2.5 : 1; cxM.strokeRect(x - w / 2, y - h / 2, w, h);
        cxM.fillStyle = '#0d0f0c'; cxM.font = 'bold 11px "Courier New", monospace'; cxM.textAlign = 'center';
        cxM.fillText((mexendo ? '➤' : '') + n, x, y + 4);
        if (e.missao === 'saque' && mexendo) { cxM.font = '11px sans-serif'; cxM.fillText('💰', x + 18, y - 6); }
    });
    // espiões
    G.espioes.forEach(sp => { const s = T(sp.x, sp.y); cxM.font = '15px sans-serif'; cxM.textAlign = 'center'; cxM.fillText('👁', s.x, s.y + 5); });
}

/* ---------- Painel de baixo ---------- */
function botao(txt, sub, acao, opts = {}) { return `<button class="acao${opts.forte ? ' forte' : ''}" onclick="${acao}" ${opts.off ? 'disabled' : ''}>${txt}${sub ? `<small>${sub}</small>` : ''}</button>`; }
function renderPainel() {
    const el = document.getElementById('painel'); if (!G || !el) return;
    let html = '';
    if (G.modo) {
        const e = G.ex.find(x => x.id === G.modo.exId);
        html = `<div class="titulo"><span>${G.modo.missao === 'saque' ? '💰 Saquear' : '⚔️ Mover / atacar'}</span><span class="dono">${e ? e.s.length + ' soldados' : ''}</span></div>
            <div class="info">Toque no mapa na província de destino. Pode ser sua (a tropa vai por dentro do seu território) ou inimiga, vizinha ou longe.</div>
            <div class="acoes">${botao('✖ Cancelar', '', 'G.modo=null;renderPainel()')}</div>`;
    } else if (G.pendente) {
        const o = G.pendente, e = G.ex.find(x => x.id === o.exId), p = G.prov[o.destId];
        if (!e) { G.pendente = null; return renderPainel(); }
        const defVis = provVisivel(p.id) ? exParadosEm(p.id, p.dono).reduce((t, x) => t + x.s.length, 0) : null;
        const quem = p.dono === 'jogador' ? 'sua' : p.dono === 'neutro' ? 'milícia' : FACCOES[p.dono].nome;
        html = `<div class="titulo"><span>${o.missao === 'saque' ? '💰 Saquear' : p.dono === 'jogador' ? '🚶 Mover para' : '⚔️ Atacar'} ${p.nome}</span><span class="dono" style="color:${FACCOES[p.dono].cor}">${quem}</span></div>
            <div class="info">${p.dono === 'jogador' ? 'Província sua.' : defVis === null ? 'Defesa: <b>desconhecida</b> (mande um espião).' : `Defesa: <b>${defVis}</b> soldados · trincheira ${Math.round(p.trinch)}%${p.capital ? ' · capital (+25%)' : ''}.`}
            Chega em ~${o.seg}s${o.rota.length > 1 ? ', passando por ' + o.rota.slice(0, -1).map(id => G.prov[id].nome).join(', ') : ''}.</div>
            ${e.rota.length ? `<div class="info">Vão os ${e.s.length} soldados (a tropa já está em marcha).</div>` : `<div class="seletor">Soldados: <button class="passo" onclick="G.pendente.qtd=Math.max(1,G.pendente.qtd-1);renderPainel()">−</button><b>${o.qtd}</b><button class="passo" onclick="G.pendente.qtd=Math.min(${e.s.length},G.pendente.qtd+1);renderPainel()">+</button><button class="passo" style="width:auto;padding:0 8px;font-size:12px" onclick="G.pendente.qtd=${e.s.length};renderPainel()">todos</button><span class="info">ficam ${e.s.length - o.qtd}</span></div>`}
            <div class="acoes">${botao('✔ Confirmar', '', 'confirmarOrdem()', { forte: true })}${botao('✖ Cancelar', '', 'G.pendente=null;renderPainel()')}</div>`;
    } else if (G.sel && G.sel.tipo === 'ex') {
        const e = G.ex.find(x => x.id === G.sel.id);
        if (!e) { G.sel = null; return renderPainel(); }
        const p = G.prov[e.prov], fome = e.s.filter(s => s.fome >= 50).length, cans = e.s.filter(s => s.cansaco >= 40).length;
        html = `<div class="titulo"><span>🪖 Exército · ${e.s.length} soldados</span><span class="dono" style="color:${FACCOES.jogador.cor}">${e.rota.length ? (e.missao === 'saque' ? 'saqueando' : e.missao === 'voltar' ? 'voltando' : 'em marcha') : 'em ' + p.nome}</span></div>
            <div class="soldados">${e.s.map(s => `<span class="sd" title="${s.nome}" style="background:${corFome(s)}"></span>`).join('')}</div>
            <div class="info">${fome ? `<b style="color:#e3b04b">${fome} com fome</b>` : 'tropa alimentada'}${cans ? ` · ${cans} cansados` : ''} · força ${forca(e.s).toFixed(1)}${e.rota.length ? ` · indo para ${G.prov[e.rota[e.rota.length - 1]].nome}` : ''}</div>`;
        html += e.rota.length ? `<div class="acoes">${botao('↪ Mudar destino', 'depois toque no novo destino', `escolherDestino('${e.id}','ataque')`, { forte: true })}${botao('✋ Parar', 'na próxima província', `cancelarMarcha('${e.id}')`)}</div>`
            : `<div class="acoes">${botao('🚶 Mover / ⚔️ Atacar', 'toque no destino: sua província ou inimiga', `escolherDestino('${e.id}','ataque')`, { forte: true })}${botao('💰 Saquear', `rouba ${Math.round(C.SAQUE_PARTE * 100)}% das moedas e volta`, `escolherDestino('${e.id}','saque')`)}</div>`;
    } else if (G.sel && G.sel.tipo === 'prov') {
        const p = G.prov[G.sel.id], f = G.fac.jogador, vis = provVisivel(p.id), cor = FACCOES[p.dono].cor;
        const pr = C.PROD[p.tipo];
        html = `<div class="titulo"><span>${p.nome}</span><span class="dono" style="color:${cor}">${p.dono === 'jogador' ? 'SUA' : FACCOES[p.dono].nome.toUpperCase()}${p.dono !== 'jogador' && p.dono !== 'neutro' ? ' · ' + FACCOES[p.dono].perso : ''}</span></div>
            <div class="info">${TIPO_TXT[p.tipo]} · produz ${pr.comida ? pr.comida + '🍞 ' : ''}${pr.mun ? pr.mun + '🔫 ' : ''}${pr.moedas ? pr.moedas + '🪙' : ''} a cada ${C.CICLO}s${vis ? ` · trincheira ${Math.round(p.trinch)}%` : ''}<br>`;
        if (vis) {
            const aqui = G.ex.filter(e => e.prov === p.id && !e.rota.length);
            html += aqui.length ? aqui.map(e => `<span style="color:${FACCOES[e.dono].cor}">${FACCOES[e.dono].nome}: ${e.s.length} soldados</span>`).join(' · ') : 'Ninguém defendendo.';
        } else html += 'Na névoa: você não vê as tropas daqui. Mande um espião.';
        if (p.dono !== 'jogador' && p.dono !== 'neutro') {
            html += espiado(p.dono) ? `<br>👁 ${FACCOES[p.dono].nome}: ${Math.floor(G.fac[p.dono].moedas)} moedas, ${Math.floor(G.fac[p.dono].comida)} de comida, ${tropaDe(p.dono)} soldados (espião por mais ${Math.ceil(G.espiado[p.dono] - G.t)}s).` : '<br>' + PERSO_TXT[FACCOES[p.dono].perso];
        } else if (p.dono === 'neutro') html += '<br>' + PERSO_TXT.neutra;
        html += '</div><div class="acoes">';
        if (p.dono === 'jogador') {
            const meu = exParadosEm(p.id, 'jogador')[0];
            const c5 = custoVarios('jogador', 5);
            html += botao('🪖 Recrutar 1', `${custoRecrutar('jogador')} 🪙`, `recrutar('${p.id}');renderPainel()`, { off: f.moedas < custoRecrutar('jogador') });
            html += botao('🪖 Recrutar 5', `${c5} 🪙 (cada um fica mais caro)`, `recrutar('${p.id}',5);renderPainel()`, { off: f.moedas < c5 });
            html += botao('🛡 Fortificar', `${C.FORTIFICAR} 🪙 · +${C.FORT_GANHO}% de trincheira`, `fortificar('${p.id}');renderPainel()`, { off: f.moedas < C.FORTIFICAR || p.trinch >= 100 });
            if (meu) html += botao('🪖 Exército daqui', `${meu.s.length} soldados · mover`, `G.sel={tipo:'ex',id:'${meu.id}'};renderPainel()`);
            // trazer tropa de outra província sua (as mais perto primeiro)
            exDe('jogador').filter(e => parado(e) && e.prov !== p.id).map(e => ({ e, c: rotaPara(e, p.id) })).filter(o => o.c).sort((a, b) => a.c.dist - b.c.dist).slice(0, 2)
                .forEach(o => { html += botao(`🚶 Trazer ${o.e.s.length}`, `de ${G.prov[o.e.prov].nome} · ~${Math.ceil(o.c.dist / C.VEL)}s`, `prepararOrdem('${o.e.id}','${p.id}','mover')`); });
        } else {
            html += botao('👁 Espião', `${C.ESPIAO} 🪙 · viaja e só observa`, `espionar('${p.id}');renderPainel()`, { off: f.moedas < C.ESPIAO || G.espioes.length >= C.ESPIAO_MAX });
            // atalho: atacar com um dos seus exércitos parados (o mais perto primeiro)
            exDe('jogador').filter(parado).map(e => ({ e, c: rotaPara(e, p.id) })).filter(o => o.c).sort((a, b) => a.c.dist - b.c.dist).slice(0, 3)
                .forEach(o => { html += botao(`⚔️ Atacar com ${o.e.s.length}`, `de ${G.prov[o.e.prov].nome} · ~${Math.ceil(o.c.dist / C.VEL)}s`, `prepararOrdem('${o.e.id}','${p.id}','ataque')`, { forte: true }); });
        }
        html += '</div>';
    }
    if (el._html !== html) { el.innerHTML = html; el._html = html; } // só troca quando mudou (não engole toques)
}

/* ---------- Tela de batalha ---------- */
const cvB = document.getElementById('cvBat'), cxB = cvB.getContext('2d');
function abrirBatalha(b) {
    G.batalha = b;
    const souAtq = b.atqDono === 'jogador';
    b.souAtq = souAtq;
    document.getElementById('batalha').style.display = 'flex';
    ajustar(cvB);
    document.getElementById('batTitulo').textContent = souAtq ? `${b.saque ? '💰 SAQUE EM' : '⚔️ ATAQUE A'} ${b.alvo.nome.toUpperCase()}` : `🛡️ DEFESA DE ${b.alvo.nome.toUpperCase()}`;
    const post = souAtq ? [['avancar', 'AVANÇAR', 'rápido, exposto'], ['cobertura', 'COBERTURA', 'lento, protegido'], ['recuar', 'RECUAR', 'volta para casa']]
                        : [['atacar', 'ATACAR', '+dano, +risco'], ['equilibrio', 'EQUILÍBRIO', 'padrão'], ['abrigar', 'ABRIGAR', '−dano recebido']];
    document.getElementById('batPost').innerHTML = post.map(([id, t, d]) => `<button class="opc" data-p="${id}">${t}<small>${d}</small></button>`).join('');
    document.querySelectorAll('#batPost .opc').forEach(bt => bt.onclick = () => { if (souAtq) b.postAtq = bt.dataset.p; else b.postDef = bt.dataset.p; atualizarBatalhaUI(); });
    document.getElementById('bArt').onclick = () => { artilhariaNaBatalha(b, souAtq ? 'atq' : 'def'); atualizarBatalhaUI(); };
    document.getElementById('bVel').onclick = () => { b.rapido = !b.rapido; atualizarBatalhaUI(); };
    document.getElementById('bAuto').onclick = () => { while (!b.terminou) b.passo(0.25); };
    atualizarBatalhaUI();
}
function atualizarBatalhaUI() {
    const b = G.batalha; if (!b) return;
    const nos = b.souAtq ? b.atq : b.def, eles = b.souAtq ? b.def : b.atq, outro = b.souAtq ? b.defDono : b.atqDono;
    document.getElementById('batNos').innerHTML = `<span style="color:${FACCOES.jogador.cor}">Você: ${nos.filter(x => x.s.vida > 0).length}</span>`;
    document.getElementById('batEles').innerHTML = `<span style="color:${FACCOES[outro].cor}">${FACCOES[outro].nome}: ${eles.filter(x => x.s.vida > 0).length}</span>`;
    const resta = Math.max(0, C.BAT_DURACAO - b.t);
    document.getElementById('batTempo').textContent = `${Math.floor(resta / 60)}:${String(Math.floor(resta % 60)).padStart(2, '0')}`;
    document.querySelector('#tempoBat div').style.width = (100 * resta / C.BAT_DURACAO) + '%';
    const atual = b.souAtq ? b.postAtq : b.postDef;
    document.querySelectorAll('#batPost .opc').forEach(bt => bt.classList.toggle('on', bt.dataset.p === atual));
    document.getElementById('bArt').disabled = b.usouArt || G.fac.jogador.moedas < C.ARTILHARIA;
    document.getElementById('bVel').classList.toggle('on', b.rapido);
}
function fecharBatalha() {
    const b = G.batalha;
    document.getElementById('batalha').style.display = 'none';
    G.batalha = null;
    concluirBatalha(b);
    renderPainel();
}
function desenharBatalha() {
    const b = G.batalha; if (!b) return;
    // o campo ocupa a tela inteira (a altura acompanha o formato do celular)
    const BW = 400, BH = Math.max(360, Math.min(720, BW * cvB.height / Math.max(1, cvB.width))), e = Math.min(cvB.width / BW, cvB.height / BH), ox = (cvB.width - BW * e) / 2, oy = (cvB.height - BH * e) / 2;
    cxB.setTransform(1, 0, 0, 1, 0, 0); cxB.fillStyle = '#10140f'; cxB.fillRect(0, 0, cvB.width, cvB.height);
    cxB.setTransform(e, 0, 0, e, ox, oy);
    const defEmbaixo = !b.souAtq;
    const yTrinch = defEmbaixo ? BH - 70 : 70, yInicio = defEmbaixo ? 26 : BH - 26;
    const chao = cxB.createLinearGradient(0, 0, 0, BH); chao.addColorStop(0, '#3b4535'); chao.addColorStop(0.5, '#454734'); chao.addColorStop(1, '#353a2c');
    cxB.fillStyle = chao; cxB.fillRect(0, 0, BW, BH);
    if (!b.cenario) { // crateras e arame, sorteados uma vez por batalha
        b.cenario = { crateras: Array.from({ length: 14 }, () => ({ x: Math.random() * BW, y: 0.15 + Math.random() * 0.7, r: 6 + Math.random() * 14 })), arame: 0.25 + Math.random() * 0.1 };
    }
    b.cenario.crateras.forEach(c => { const y = yTrinch + (yInicio - yTrinch) * c.y; cxB.fillStyle = 'rgba(20,18,12,.45)'; cxB.beginPath(); cxB.ellipse(c.x, y, c.r, c.r * 0.45, 0, 0, Math.PI * 2); cxB.fill(); cxB.strokeStyle = 'rgba(150,130,95,.25)'; cxB.lineWidth = 1.5; cxB.stroke(); });
    { const ya = yTrinch + (yInicio - yTrinch) * b.cenario.arame; cxB.strokeStyle = 'rgba(170,165,150,.5)'; cxB.lineWidth = 1; // arame farpado
      for (let x = 0; x < BW; x += 14) { cxB.beginPath(); cxB.arc(x + 7, ya, 6, 0, Math.PI * 2); cxB.stroke(); cxB.beginPath(); cxB.moveTo(x, ya - 9); cxB.lineTo(x, ya + 7); cxB.stroke(); } }
    cxB.fillStyle = '#4a3b28'; cxB.fillRect(0, yTrinch - 8, BW, 16);
    cxB.fillStyle = '#7a6646'; for (let x = 0; x < BW; x += 15) { cxB.beginPath(); cxB.ellipse(x + 7.5, yTrinch + (defEmbaixo ? -8 : 8), 8, 4.5, 0, 0, Math.PI * 2); cxB.fill(); cxB.strokeStyle = 'rgba(40,30,18,.6)'; cxB.lineWidth = 0.8; cxB.stroke(); }
    const corDef = FACCOES[b.defDono].cor, corAtq = FACCOES[b.atqDono].cor;
    // posição na tela: o atacante para na beira da trincheira (nunca passa dos sacos de areia)
    const yDef = yTrinch + (defEmbaixo ? 18 : -2);              // onde ficam os defensores
    const yBeira = yTrinch + (yInicio - yTrinch) * 0.09;        // beira da trincheira, do lado do atacante
    const yDoAtq = (dist) => yBeira + (yInicio - yBeira) * (dist / (C.DIST + 25));
    // fim da batalha: quem venceu o ataque pula para dentro da trincheira e finca a bandeira
    let pulo = 0;
    if (b.terminou) { if (!b.fimEm) b.fimEm = performance.now(); pulo = Math.min(1, (performance.now() - b.fimEm) / 900); }
    const venceuAtq = b.terminou && b.vencedor === 'atq';
    b.def.forEach(d => { if (d.s.vida > 0) desenharGente(d.x, yDef, b.defDono === 'jogador', d.s, corDef, false); });
    b.atq.filter(a => a.s.vida > 0).sort((a, z) => (defEmbaixo ? 1 : -1) * (yDoAtq(a.dist) - yDoAtq(z.dist))).forEach(a => {
        let y = yDoAtq(a.dist);
        if (venceuAtq) y = y + (yDef - y) * pulo;
        const andando = !b.terminou && (a.dist > 0 || b.postAtq === 'recuar'); // na beira, para e mira
        desenharGente(a.x, y, b.atqDono === 'jogador', a.s, corAtq, andando);
        if (!b.terminou && a.dist < 220 && Math.random() < 0.05) { cxB.strokeStyle = 'rgba(255,224,138,.6)'; cxB.beginPath(); cxB.moveTo(a.x, y - 8); cxB.lineTo(a.x + (Math.random() - 0.5) * 60, yDef - 10); cxB.stroke(); }
    });
    if (b.terminou) { // bandeira e aviso do resultado
        const cx = BW / 2, venceu = venceuAtq ? corAtq : corDef;
        if (venceuAtq && pulo >= 1) {
            cxB.strokeStyle = '#d8d0b8'; cxB.lineWidth = 2; cxB.beginPath(); cxB.moveTo(cx, yTrinch + 4); cxB.lineTo(cx, yTrinch - 40); cxB.stroke();
            cxB.fillStyle = venceu; cxB.beginPath(); cxB.moveTo(cx, yTrinch - 40); cxB.lineTo(cx + 26, yTrinch - 33); cxB.lineTo(cx, yTrinch - 26); cxB.fill();
        }
        const txt = venceuAtq ? (b.saque ? '💰 SAQUEADA' : '🏴 CONQUISTADA') : b.recuou ? '↩ RECUARAM' : '🛡 TRINCHEIRA MANTIDA';
        cxB.font = 'bold 20px "Courier New", monospace'; cxB.textAlign = 'center';
        const yt = BH / 2; cxB.fillStyle = 'rgba(0,0,0,.6)'; cxB.fillRect(40, yt - 22, BW - 80, 34);
        cxB.fillStyle = venceu; cxB.fillText(txt, cx, yt + 2); cxB.textAlign = 'left';
    }
    b.efeitos.forEach(f => {
        const y = f.y < 0 ? yDef - 10 : yDoAtq(f.y);
        if (f.tipo === 'explosao') { cxB.fillStyle = `rgba(255,160,60,${f.vida})`; cxB.beginPath(); cxB.arc(f.x, y, 18 * (1.3 - f.vida), 0, Math.PI * 2); cxB.fill(); }
        else { cxB.fillStyle = `rgba(255,90,70,${f.vida})`; cxB.font = 'bold 12px monospace'; cxB.fillText('✖', f.x - 4, y - 14); }
    });
}
function desenharGente(x, y, amigo, s, cor, andando) {
    if (amigo) {
        const spr = andando ? 'andando' : 'mira', d = SPRITES[spr], im = IMG[spr], F = 0.16;
        if (im.complete && im.naturalWidth) cxB.drawImage(im, x - d.ax * F, y - d.ay * F, d.w * F, d.h * F);
    } else {
        cxB.fillStyle = '#2a0f10'; cxB.strokeStyle = cor; cxB.lineWidth = 1.2;
        cxB.beginPath(); cxB.arc(x, y - 22, 4.5, 0, Math.PI * 2); cxB.fill(); cxB.stroke();
        cxB.beginPath(); cxB.moveTo(x - 5, y - 17); cxB.lineTo(x + 5, y - 17); cxB.lineTo(x + 4, y); cxB.lineTo(x - 4, y); cxB.closePath(); cxB.fill(); cxB.stroke();
    }
    cxB.fillStyle = corFome(s); cxB.beginPath(); cxB.arc(x, y - 33, 2.5, 0, Math.PI * 2); cxB.fill();
}

/* ---------- Topo, telas de início e fim ---------- */
function atualizarTopo() {
    const f = G.fac.jogador, tropa = tropaDe('jogador');
    const rec = (id, v, baixo) => { const el = document.getElementById(id); el.querySelector('b').textContent = Math.floor(v); el.classList.toggle('baixo', baixo); };
    rec('rCom', f.comida, f.comida < tropa); rec('rMun', f.mun, f.mun < 60); rec('rMoe', f.moedas, false);
    const pl = placar(); document.getElementById('rProv').querySelector('b').textContent = `${pl.jogador || 0}/${Object.keys(G.prov).length}`;
    const resta = Math.max(0, G.fase.tempo - G.t);
    document.getElementById('relogio').textContent = `⏰ ${String(Math.floor(resta / 60)).padStart(2, '0')}:${String(Math.floor(resta % 60)).padStart(2, '0')}`;
    document.getElementById('fase').textContent = `FASE ${G.fase.n} · ${G.fase.nome.toUpperCase()}`;
    document.getElementById('bVelMapa').textContent = G.velocidade === 1 ? '1×' : '2×';
    const av = document.getElementById('aviso'), n = G.noticias[0];
    if (n && G.t - n.t < (n.alerta ? 7 : 4.5)) { av.textContent = n.txt; av.className = n.alerta ? 'alerta' : ''; av.style.display = 'block'; }
    else av.style.display = 'none';
}
const linkMenu = () => (location.protocol.startsWith('http') ? '/' : 'ponto-alpha.html');
const botaoMenu = () => `<a class="voltarMenu" href="${linkMenu()}">← Modos de jogo</a>`;
function voltarAoMenu() { if (G.fim || confirm('Sair da Conquista? A fase em andamento se perde.')) location.href = linkMenu(); }
function mostrarTela(html) { document.getElementById('telaCaixa').innerHTML = html; document.getElementById('tela').style.display = 'flex'; }
function esconderTela() { document.getElementById('tela').style.display = 'none'; }
function comecarFase(n) { novoJogo(n); esconderTela(); renderPainel(); }
function mostrarInicio() {
    const lib = lerFase();
    mostrarTela(`<h2>🗺️ CONQUISTA · CAMPANHA</h2>
        <div class="sub">Você comanda um país pequeno no sul do mapa. Em volta, países de bots com personalidades diferentes e terras livres com milícia. Todos lutam contra todos.</div>
        <div class="lista">🪖 <b>Exércitos:</b> toque num exército seu (quadrado verde), depois em <b>Mover / atacar</b> e no destino. Você escolhe quantos soldados vão.<br>
        🏴 Entrar em província sem defesa conquista. Com defesa, tem batalha de até 2 minutos.<br>
        🍞 Todo soldado come. Sem comida, luta pior e adoece.<br>
        🪖 Recrute em qualquer província sua (1 ou 5 de uma vez) e mova a tropa livremente pelo seu território.<br>
        🏘 Cidades e a capital dão moedas. Campos dão comida, morros e florestas dão munição.<br>
        👁 <b>Espião:</b> viaja até a província e só observa: mostra tropas, tesouro e quem o dono está atacando.<br>
        💰 <b>Saque:</b> rouba ${Math.round(C.SAQUE_PARTE * 100)}% das moedas do dono e volta para casa.<br>
        ★ Vence quem tomar todas as capitais inimigas, ou quem tiver mais províncias quando o tempo acabar. Se perder a sua capital, acabou.<br>
        🖐 Arraste o mapa; use dois dedos (ou ＋ －) para o zoom. ⏩ 2× acelera o mapa.</div>
        ${FASES.map(F => `<button class="fase${F.n > lib ? ' trancada' : ''}" ${F.n > lib ? 'disabled' : ''} onclick="comecarFase(${F.n})"><b>Fase ${F.n} · ${F.nome}</b><small>${F.n > lib ? '🔒 vença a fase anterior' : `${F.bots.length} inimigos · ${Math.round(F.tempo / 60)} minutos${F.capitalForte ? ' · capital fortificada' : ''}`}</small></button>`).join('')}
        ${botaoMenu()}`);
}
function mostrarFim() {
    const pl = placar(), F = G.fase, mm = Math.floor(G.t / 60), ss = String(Math.floor(G.t % 60)).padStart(2, '0');
    const proxima = F.n < FASES.length && (G.fim === 'vitoria' || G.fim === 'pontos');
    const titulo = { vitoria: `🏆 FASE ${F.n} VENCIDA!`, pontos: '🏆 VITÓRIA POR TERRITÓRIO', tempo: '⏰ O TEMPO ACABOU', derrota: '✝ SUA CAPITAL CAIU' }[G.fim];
    const texto = G.fim === 'vitoria' ? `Todas as capitais inimigas tomadas em ${mm}:${ss}.`
        : G.fim === 'pontos' ? `O tempo acabou e você tem mais províncias que qualquer inimigo (${pl.jogador || 0}).`
        : G.fim === 'tempo' ? `Você terminou com ${pl.jogador || 0} províncias, menos que o maior inimigo. Para vencer: tome as capitais, ou tenha mais terra quando o tempo acabar.`
        : `Você resistiu ${mm}:${ss} e chegou a ter ${pl.jogador || 0} províncias.`;
    mostrarTela(`<h2>${titulo}</h2><div class="sub">${texto}</div>
        ${proxima ? `<button class="grande" onclick="comecarFase(${F.n + 1})">FASE ${F.n + 1}: ${FASES[F.n].nome.toUpperCase()} ▶</button>` : ''}
        ${F.n === FASES.length && G.fim !== 'derrota' && G.fim !== 'tempo' ? '<div class="sub" style="margin-top:10px">🎖 Campanha completa! Em breve: Conquista online.</div>' : ''}
        <button class="grande${proxima ? ' secundaria' : ''}" onclick="comecarFase(${F.n})">JOGAR A FASE ${F.n} DE NOVO</button>
        <button class="grande secundaria" onclick="mostrarInicio()">ESCOLHER FASE</button>${botaoMenu()}`);
}

/* ---------- Laço ---------- */
let ultimo = performance.now();
function laco(agora) {
    const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    const telaAberta = document.getElementById('tela').style.display === 'flex';
    if (!telaAberta && G && !G.fim) {
        if (G.batalha) {
            const b = G.batalha;
            b.passo(dt * (b.rapido ? 2 : 1));
            b.efeitos.forEach(f => f.vida -= dt); b.efeitos = b.efeitos.filter(f => f.vida > 0);
            desenharBatalha(); atualizarBatalhaUI();
            if (b.terminou && !b.fechando) { b.fechando = true; setTimeout(fecharBatalha, 1900); }
        } else passoMapa(dt * G.velocidade);
    }
    if (G) { desenharMapa(); atualizarTopo(); }
    if (G && !G.batalha && Math.floor(agora / 500) !== Math.floor((agora - dt * 1000) / 500) && !G.pendente) renderPainel();
    requestAnimationFrame(laco);
}
ajustar(cvM);
novoJogo(Math.min(lerFase(), FASES.length));
renderPainel();
mostrarInicio();
requestAnimationFrame(laco);
