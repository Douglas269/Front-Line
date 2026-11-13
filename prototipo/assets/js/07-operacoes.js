// FrontLine · Trincheiras: operações, Quartel, histórias dos soldados, desafio do dia, obras e ordens permanentes
// Carregado depois de 06-conta.js. Envolve funções do jogo (sem mudar as regras de quem joga a campanha de 30 dias):
// - Operação curta (10 dias, situação sorteada) e Desafio do dia (a mesma operação para todos, com ranking);
// - Quartel: insígnias ganhas em cada partida compram melhorias permanentes para as próximas;
// - Cartas para casa, apelidos ganhos em combate e o Memorial dos que caíram (fica entre as partidas);
// - Obras da trincheira em árvore (feitas por quem está na Manutenção) e ordens permanentes da escala.

const OP_KEY = 'frontline-proxima-op', QUARTEL_KEY = 'frontline-quartel', MEMORIAL_KEY = 'frontline-memorial';
const OPERACOES = {
    longa:   { nome: 'Campanha', dias: 30, icone: '🪖', desc: 'A missão completa: 30 dias. Vencer sobe o nível.', insignias: 10 },
    curta:   { nome: 'Operação curta', dias: 10, icone: '⚡', desc: '10 dias com uma situação sorteada. Vale insígnias para o Quartel.', insignias: 4 },
    desafio: { nome: 'Desafio do dia', dias: 10, icone: '📅', desc: 'A mesma operação para todo mundo hoje (nível 6), com ranking. Sem bônus do Quartel.', insignias: 3 }
};
const SITUACOES = {
    chuva:    { nome: 'Temporada de chuvas', desc: 'chove ou tem névoa todo dia: mira e comboio piores' },
    ofensiva: { nome: 'Ofensiva iminente', desc: 'o general ataca com tudo já no dia 3' },
    municao:  { nome: 'Paiol curto', desc: 'começa com 40% menos munição e +60 de prestígio' }
};
const QUARTEL = {
    racao:      { nome: 'Despensa cheia', icone: '🥫', desc: '+25% de ração e água no começo', custo: 3 },
    paiol:      { nome: 'Paiol reforçado', icone: '🧰', desc: '+30% de munição no começo', custo: 3 },
    prestigio:  { nome: 'Verba do QG', icone: '💰', desc: '+60 de prestígio no começo', custo: 4 },
    oficial:    { nome: 'Ten. Prado, oficial de ligação', icone: '🎖️', desc: 'todos começam com +10 de moral', custo: 4 },
    engenharia: { nome: 'Curso de engenharia', icone: '🔨', desc: 'reparo e obras 25% mais rápidos', custo: 5 },
    treino:     { nome: 'Treino de tiro', icone: '🎯', desc: '+8% de acerto para todo o esquadrão', custo: 6 }
};
const OBRAS_T = {
    sacos:      { nome: 'Sacos de areia', icone: '🧱', custo: 60, trabalho: 100, nivel: 1, desc: 'a trincheira perde 25% menos conservação' },
    cozinha:    { nome: 'Cozinha de campanha', icone: '🍲', custo: 50, trabalho: 80, nivel: 1, desc: 'comer gasta 20% menos ração e água' },
    abrigo:     { nome: 'Abrigo profundo', icone: '🛏️', custo: 90, trabalho: 140, nivel: 2, req: 'sacos', desc: 'quem descansa recupera vida e cansaço mais rápido' },
    enfermaria: { nome: 'Enfermaria', icone: '🏥', custo: 80, trabalho: 120, nivel: 2, req: 'cozinha', desc: 'todo ferido se recupera aos poucos' },
    tuneis:     { nome: 'Túneis', icone: '🕳️', custo: 130, trabalho: 180, nivel: 3, req: 'abrigo', desc: 'invasões ferem 40% menos' },
    periscopio: { nome: 'Periscópio', icone: '🔭', custo: 110, trabalho: 150, nivel: 3, req: 'enfermaria', desc: 'quem está de vigília acerta 10% mais' }
};
const APELIDOS = [
    { nome: 'Muralha', cond: (s) => ((s.stats && s.stats.abates) || 0) >= 25 },
    { nome: 'Olho de Águia', cond: (s) => ((s.stats && s.stats.abates) || 0) >= 10 },
    { nome: 'Coração de Leão', cond: (s) => (s.medalhas || []).includes('bravura') },
    { nome: 'Sortudo', cond: (s) => !!s.quaseMorreu },
    { nome: 'Velha Guarda', cond: () => gameState.day >= 20 }
];
const DESTINO_CARTA = { 1: 'às filhas', 2: 'à mãe', 3: 'à namorada, Clara', 4: 'ao irmão, em Recife', 5: 'à esposa, Neusa', 6: 'ao avô' };

/* ---------- Utilidades ---------- */
const lerJSON = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) || padrao; } catch (e) { return padrao; } };
const gravarJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const lerQuartel = () => Object.assign({ insignias: 0, compras: {} }, lerJSON(QUARTEL_KEY, {}));
const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
const sementeDoDia = (dia) => dia.split('-').reduce((t, x) => t * 100 + Number(x), 0) * 2654435761 >>> 0;
function rngSemente32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const opAtual = () => gameState.op || { tipo: 'longa', dias: 30, bonus: [] };
const temBonus = (id) => (opAtual().bonus || []).includes(id);
const obraFeita = (id) => !!(gameState.obrasT && gameState.obrasT.feitas[id]);
const nomeCompleto = (s) => (PERFIS[s.id] ? PERFIS[s.id].nome : s.name);

/* ---------- Começo: partida salva ou operação nova ---------- */
const BASE = { reparoS: TRENCH.REPAIR_SOLDIER, reparoE: TRENCH.REPAIR_ENGINEER, obraS: DEF.OBRA_SOLDADO, obraE: DEF.OBRA_ENGENHEIRO, invasao: GAME_CONFIG.INVASION_DAMAGE, invasaoT: TRENCH.DAMAGE_INVASION };
function aplicarEfeitosPassivos() {
    const eng = temBonus('engenharia') ? 1.25 : 1;
    TRENCH.REPAIR_SOLDIER = BASE.reparoS * eng; TRENCH.REPAIR_ENGINEER = BASE.reparoE * eng;
    DEF.OBRA_SOLDADO = BASE.obraS * eng; DEF.OBRA_ENGENHEIRO = BASE.obraE * eng;
    const tun = obraFeita('tuneis') ? 0.6 : 1;
    GAME_CONFIG.INVASION_DAMAGE = BASE.invasao * tun; TRENCH.DAMAGE_INVASION = BASE.invasaoT * tun;
    GAME_CONFIG.TOTAL_DAYS = opAtual().dias;
    if (opAtual().tipo === 'desafio') { gameState.level = opAtual().nivel || 6; const l = document.getElementById('lbl-level'); if (l) l.textContent = `DESAFIO · NÍV. ${gameState.level}`; }
}
function aplicarExtras(d) {
    gameState.op = d.op || { tipo: 'longa', dias: 30, bonus: [] };
    gameState.obrasT = d.obrasT || { feitas: {}, atual: null, progresso: 0 };
    gameState.ordens = d.ordens || { vigiaMin: 0, reparo: 0, descansoMin: 0 };
    gameState.cartas = d.cartas || [];
    aplicarEfeitosPassivos();
}
function novaOperacao() {
    const pedido = lerJSON(OP_KEY, null);
    try { localStorage.removeItem(OP_KEY); } catch (e) {}
    const tipo = pedido && OPERACOES[pedido.tipo] ? pedido.tipo : 'longa';
    const op = { tipo, dias: OPERACOES[tipo].dias, bonus: [] };
    if (tipo === 'desafio') {
        op.dia = hojeBR(); op.semente = sementeDoDia(op.dia); op.nivel = 6;
        op.situacao = Object.keys(SITUACOES)[op.semente % 3];
        const nativo = Math.random; Math.random = rngSemente32(op.semente ^ 0x5bd1e995); gameState.general = newGeneral(); Math.random = nativo;
    } else {
        op.bonus = Object.keys(lerQuartel().compras);
        if (tipo === 'curta') op.situacao = Object.keys(SITUACOES)[Math.floor(Math.random() * 3)];
    }
    gameState.op = op;
    gameState.obrasT = { feitas: {}, atual: null, progresso: 0 };
    gameState.ordens = { vigiaMin: 0, reparo: 0, descansoMin: 0 };
    gameState.cartas = [];
    const r = gameState.resources;
    if (temBonus('racao')) { r.rations = Math.round(r.rations * 1.25); r.water = Math.round(r.water * 1.25); }
    if (temBonus('paiol')) { r.ammoRifle = Math.round(r.ammoRifle * 1.3); r.ammoHeavy = Math.round(r.ammoHeavy * 1.3); }
    if (temBonus('prestigio')) gameState.prestige += 60;
    if (temBonus('oficial')) gameState.squad.forEach(s => { s.moral = Math.min(100, s.moral + 10); });
    if (op.situacao === 'municao') { r.ammoRifle = Math.round(r.ammoRifle * 0.6); r.ammoHeavy = Math.round(r.ammoHeavy * 0.6); gameState.prestige += 60; }
    if (op.situacao === 'ofensiva') gameState.ofensiva = { dia: 3, hora: sorteiaEntre(OFENSIVA.HORA), anunciada: false, ativa: false, feita: false };
    aplicarEfeitosPassivos();
    if (tipo !== 'longa') {
        const txt = `${OPERACOES[tipo].icone} ${OPERACOES[tipo].nome}: segure a trincheira por ${op.dias} dias. Situação: ${SITUACOES[op.situacao].nome} (${SITUACOES[op.situacao].desc}).`;
        logFeed(txt, 'text-mil-amberMuted font-bold');
        addDiaryEntry(txt);
    }
    if (op.bonus.length) logFeed(`🎖️ Quartel: ${op.bonus.map(b => QUARTEL[b].nome).join(', ')}.`, 'text-mil-greenMuted');
}
/* ---------- Desafio do dia: a lógica do jogo usa um sorteio próprio, igual para todo mundo ----------
   (os efeitos visuais da cena continuam com o sorteio comum, para não mudar a sorte da partida) */
let rngDesafio = null;
function sorteioDoDesafio() {
    if (rngDesafio) return;
    rngDesafio = rngSemente32(opAtual().semente);
    const _tick = updateGameTick;
    updateGameTick = function () { const nativo = Math.random; Math.random = rngDesafio; try { _tick(); } finally { Math.random = nativo; } };
}
(function iniciarOperacao() {
    // loadGame (02-regras.js) já trouxe op/obras/ordens/cartas se havia partida salva
    const salvo = lerJSON(SAVE_KEY, null);
    const carregou = !!gameState.op || (salvo && salvo.v === 1 && gameState.day === salvo.day && gameState.timeSeconds === salvo.timeSeconds && Array.isArray(salvo.squad) && salvo.squad.some(s => s.hp > 0));
    if (carregou) aplicarExtras({ op: gameState.op, obrasT: gameState.obrasT, ordens: gameState.ordens, cartas: gameState.cartas }); else novaOperacao();
    if (opAtual().tipo === 'desafio') sorteioDoDesafio();
})();

/* ---------- Salvamento: saveGame (02-regras.js) já grava op, obrasT, ordens e cartas; ao carregar, reaplica ---------- */
const _loadGame = loadGame;
loadGame = function () { const ok = _loadGame(); if (ok) aplicarExtras({ op: gameState.op, obrasT: gameState.obrasT, ordens: gameState.ordens, cartas: gameState.cartas }); return ok; };


/* ---------- Situação "temporada de chuvas" e histórias a cada dia ---------- */
const _onNewDay = onNewDay;
onNewDay = function () {
    _onNewDay();
    if (opAtual().situacao === 'chuva') {
        gameState.weather = Math.random() < 0.7 ? 'Chuva Forte' : 'Névoa Espessa';
        gameState.supplyLineEff = Math.max(30, gameState.supplyLineEff - 10);
    }
    darApelidos();
    if (gameState.day >= 2 && gameState.day % 3 === 2) escreverCarta();
};

/* ---------- Apelidos, cartas e memorial ---------- */
function darApelidos() {
    gameState.squad.forEach(s => {
        if (s.hp <= 0 || s.deserted) return;
        const a = APELIDOS.find(x => x.cond(s));
        if (!a || s.apelido === a.nome || (s.apelido && APELIDOS.findIndex(x => x.nome === s.apelido) <= APELIDOS.indexOf(a))) return;
        s.apelido = a.nome;
        logFeed(`🏷️ O esquadrão agora chama ${s.rank} ${s.name} de "${a.nome}".`, 'text-mil-amberMuted font-bold');
        addDiaryEntry(`Os homens passaram a chamar ${s.rank} ${s.name} de "${a.nome}". Esse apelido vai ficar.`);
    });
}
function escreverCarta() {
    const recentes = (gameState.cartas || []).slice(-2).map(c => c.id);
    const vivos = gameState.squad.filter(s => s.hp > 0 && !s.deserted);
    const s = vivos.filter(x => !recentes.includes(x.id))[Math.floor(Math.random() * Math.max(1, vivos.length - recentes.length))] || vivos[0];
    if (!s) return;
    const mortos = gameState.squad.filter(x => x.hp <= 0 && !x.deserted);
    const abertura = s.moral >= 70 ? ['Estou bem, de verdade.', 'Hoje até rimos um pouco.', 'Seguro a linha e penso em vocês.'] : s.moral >= 40 ? ['Os dias aqui são longos.', 'Não durmo muito, mas aguento.', 'Faz frio e a lama não seca.'] : ['Não sei quanto tempo mais a gente aguenta.', 'Peço que rezem por nós.', 'Estou cansado como nunca estive.'];
    const meio = [];
    if (s.hunger >= 50 || gameState.resources.rations < 10) meio.push('A comida está pouca, mas a gente divide o que tem.');
    if (mortos.length) meio.push(`Perdemos ${mortos.map(x => x.name).join(' e ')}. Não consigo escrever mais sobre isso.`);
    if (gameState.weather === 'Chuva Forte' || gameState.weather === 'Neve') meio.push(gameState.weather === 'Neve' ? 'Nevou de novo e a água do cantil congela.' : 'Choveu a noite inteira e a trincheira virou rio.');
    if (s.apelido) meio.push(`Os rapazes agora me chamam de "${s.apelido}". Não ria.`);
    if (!meio.length) meio.push(`Faltam ${Math.max(1, GAME_CONFIG.TOTAL_DAYS - gameState.day + 1)} dias para a rendição chegar.`);
    const fecho = ['Guarda um lugar na mesa para mim.', 'Diz a todos que estou voltando.', 'Não esquece de mim.', 'Logo eu volto.'];
    const pega = (l) => l[Math.floor(Math.random() * l.length)];
    const texto = `${pega(abertura)} ${pega(meio)} ${pega(fecho)}`;
    const carta = { dia: gameState.day, id: s.id, texto };
    gameState.cartas = (gameState.cartas || []).concat(carta).slice(-30);
    logFeed(`✉️ ${s.rank} ${s.name} escreveu uma carta ${DESTINO_CARTA[s.id] || 'para casa'} (veja no Diário).`, 'text-mil-textMuted');
    addDiaryEntry(`✉️ Carta de ${s.rank} ${s.name} ${DESTINO_CARTA[s.id] || 'para casa'}: “${texto}”`);
}
function registrarMemorial() {
    const lista = lerJSON(MEMORIAL_KEY, []);
    let mudou = false;
    gameState.squad.forEach(s => {
        if (s.hp > 0 || s.deserted || s.noMemorial) return;
        s.noMemorial = true; mudou = true;
        lista.unshift({ nome: nomeCompleto(s), posto: s.rank, apelido: s.apelido || '', dia: gameState.day, causa: s.hunger >= 75 || s.thirst >= 75 ? 'fome e sede' : 'em combate', abates: (s.stats && s.stats.abates) || 0, data: hojeBR(), op: opAtual().tipo, nivel: gameState.level });
    });
    if (mudou) gravarJSON(MEMORIAL_KEY, lista.slice(0, 120));
}

/* ---------- Obras da trincheira (árvore) ---------- */
function obraDisponivel(id) { const o = OBRAS_T[id]; return !obraFeita(id) && (!o.req || obraFeita(o.req)); }
function comecarObraT(id) {
    const ob = gameState.obrasT, o = OBRAS_T[id];
    if (!o || ob.atual || !obraDisponivel(id)) return false;
    const c = custo(o.custo);
    if (gameState.prestige < c) { logFeed('Prestígio insuficiente!', 'text-red-400'); return false; }
    gameState.prestige -= c; ob.atual = id; ob.progresso = 0;
    logFeed(`🏗️ Obra começou: ${o.nome}. Quem está na Manutenção trabalha nela.`, 'text-mil-greenMuted');
    playTacticalBeep(900, 0.04); renderMelhorias(true); updateUI();
    return true;
}
const _trabalharNaObra = trabalharNaObra;
trabalharNaObra = function (soldier) {
    if (_trabalharNaObra(soldier)) return true; // ponto defensivo em obra tem prioridade
    const ob = gameState.obrasT;
    if (!ob || !ob.atual) return false;
    ob.progresso += (soldier.class === 'Engenheiro' ? DEF.OBRA_ENGENHEIRO : DEF.OBRA_SOLDADO) * (mentalDe(soldier) === 'apatia' ? MENTAL.APATIA_RITMO : 1);
    const o = OBRAS_T[ob.atual];
    if (ob.progresso >= o.trabalho) {
        ob.feitas[ob.atual] = true;
        logFeed(`🏗️ Obra pronta: ${o.nome}. ${o.desc[0].toUpperCase() + o.desc.slice(1)}.`, 'text-mil-greenMuted font-bold');
        addDiaryEntry(`Terminamos ${o.nome.toLowerCase()}. A trincheira está melhor do que quando chegamos.`);
        ob.atual = null; ob.progresso = 0;
        aplicarEfeitosPassivos(); renderMelhorias(true);
    }
    return true;
};
const _trenchDamage = trenchDamage;
trenchDamage = function (qtd, motivo) { return _trenchDamage(obraFeita('sacos') ? qtd * 0.75 : qtd, motivo); };
const _eatInKitchen = eatInKitchen;
eatInKitchen = function (soldier) {
    const r = gameState.resources, antes = { rations: r.rations, water: r.water };
    _eatInKitchen(soldier);
    if (obraFeita('cozinha')) { r.rations += (antes.rations - r.rations) * 0.2; r.water += (antes.water - r.water) * 0.2; }
};
const _chanceDeAcerto = chanceDeAcerto;
chanceDeAcerto = function (s, arma, enemy, estado = gameState) {
    let p = _chanceDeAcerto(s, arma, enemy, estado);
    if (temBonus('treino')) p *= 1.08;
    if (obraFeita('periscopio') && s && s.duty === 'WATCH') p *= 1.1;
    return Math.min(0.95, p);
};

/* ---------- Ordens permanentes (somam à escala automática) ---------- */
function cumprirOrdens() {
    const o = gameState.ordens; if (!o) return;
    const vivos = gameState.squad.filter(s => s.hp > 0 && !s.deserted && mentalDe(s) !== 'panico');
    const conta = (f) => vivos.filter(s => s.duty === f).length;
    const mover = (s, f, motivo, txt) => { if (s.dutyBase === undefined) s.dutyBase = s.duty; s.duty = f; s.ordemMotivo = motivo; logFeed(`📋 ${s.rank} ${s.name} ${txt} (ordem permanente).`, 'text-mil-textMuted', true); };
    // reparo: alguém na Manutenção quando a trincheira cai abaixo do limite
    if (o.reparo > 0) {
        if (gameState.trench < o.reparo && !conta('MAINTENANCE')) {
            const cand = vivos.filter(s => s.duty === 'REST' && s.fatigue < 70).concat(vivos.filter(s => s.duty === 'WATCH' && conta('WATCH') > Math.max(1, o.vigiaMin)))
                .sort((a, b) => (b.class === 'Engenheiro') - (a.class === 'Engenheiro') || a.fatigue - b.fatigue)[0];
            if (cand) mover(cand, 'MAINTENANCE', 'reparo', 'foi reparar a trincheira');
        } else if (gameState.trench >= Math.min(100, o.reparo + 25)) {
            vivos.filter(s => s.ordemMotivo === 'reparo' && s.duty === 'MAINTENANCE').forEach(s => { s.duty = s.dutyBase && s.dutyBase !== 'MAINTENANCE' ? s.dutyBase : 'WATCH'; s.ordemMotivo = null; logFeed(`📋 ${s.rank} ${s.name} terminou o reparo e voltou ao posto.`, 'text-mil-textMuted', true); });
        }
    }
    // vigília mínima
    for (let k = 0; k < 6 && conta('WATCH') < o.vigiaMin; k++) {
        const cand = vivos.filter(s => s.duty === 'REST' && s.fatigue < 60).sort((a, b) => a.fatigue - b.fatigue)[0]
            || vivos.filter(s => s.duty === 'MAINTENANCE' && s.ordemMotivo !== 'reparo' && gameState.trench > 60).sort((a, b) => a.fatigue - b.fatigue)[0];
        if (!cand) break;
        mover(cand, 'WATCH', 'vigia', 'assumiu a vigília'); cand.dutyBase = 'WATCH';
    }
    // descanso mínimo (sem furar a vigília mínima)
    for (let k = 0; k < 6 && conta('REST') < o.descansoMin; k++) {
        const cand = vivos.filter(s => s.duty === 'WATCH' && conta('WATCH') - 1 >= Math.max(1, o.vigiaMin)).sort((a, b) => b.fatigue - a.fatigue)[0];
        if (!cand) break;
        mover(cand, 'REST', 'descanso', 'foi descansar');
    }
}
function mudarOrdem(chave, delta) {
    const o = gameState.ordens, lim = { vigiaMin: [0, 4], reparo: [0, 90], descansoMin: [0, 3] }[chave];
    o[chave] = Math.max(lim[0], Math.min(lim[1], o[chave] + delta));
    renderOrdens(true); playTacticalBeep(800, 0.02);
}

/* ---------- O tempo anda: efeitos das obras, ordens e memorial ---------- */
const _processSquadNeeds = processSquadNeeds;
processSquadNeeds = function () {
    _processSquadNeeds();
    if (gameState.timeSeconds % 10 !== 0) return;
    gameState.squad.forEach(s => {
        if (s.hp <= 0) return;
        if (obraFeita('abrigo') && s.duty === 'REST') { s.hp = Math.min(100, s.hp + 0.3); s.fatigue = Math.max(0, s.fatigue - 1); }
        if (obraFeita('enfermaria') && s.hp < 100) s.hp = Math.min(100, s.hp + 0.25);
    });
    cumprirOrdens();
    registrarMemorial();
};

/* ---------- Fim da operação: vitória da operação curta/desafio, insígnias e ranking ---------- */
const _checkWinLoss = checkWinLoss;
checkWinLoss = function () {
    if (gameEnded) return;
    const op = opAtual();
    if (op.tipo !== 'longa' && gameState.squad.some(s => s.hp > 0) && gameState.day > op.dias) {
        gameEnded = true;
        endGame('🎖️', op.tipo === 'desafio' ? 'DESAFIO CUMPRIDO' : 'OPERAÇÃO CUMPRIDA', 'text-mil-greenMuted',
            `Você segurou a trincheira por ${op.dias} dias${op.situacao ? ` (${SITUACOES[op.situacao].nome})` : ''}. ${op.tipo === 'desafio' ? 'Veja sua posição no ranking de hoje.' : 'As insígnias vão para o Quartel.'}`);
        return;
    }
    return _checkWinLoss();
};
function pontosDoDesafio(venceu) {
    const dias = venceu ? opAtual().dias : Math.max(0, gameState.day - 1);
    const abates = gameState.squad.reduce((t, s) => t + ((s.stats && s.stats.abates) || 0), 0);
    const vivos = gameState.squad.filter(s => s.hp > 0).length;
    return { pontos: dias * 100 + abates * 5 + vivos * 50 + (venceu ? 300 : 0) + Math.floor(Math.max(0, gameState.prestige) / 10), dias, abates };
}
const _endGame = endGame;
endGame = function (icon, title, titleClass, body) {
    darApelidos(); registrarMemorial();
    _endGame(icon, title, titleClass, body);
    const op = opAtual(), venceu = gameState.day > op.dias && gameState.squad.some(s => s.hp > 0);
    const ganhas = venceu ? OPERACOES[op.tipo].insignias : Math.floor(Math.max(0, gameState.day - 1) / 3);
    const q = lerQuartel(); q.insignias += ganhas; gravarJSON(QUARTEL_KEY, q);
    const caidos = gameState.squad.filter(s => s.hp <= 0 && !s.deserted);
    const apelidos = gameState.squad.filter(s => s.apelido).map(s => `${s.rank} ${s.name} "${s.apelido}"`);
    let extra = `<div class="bg-mil-panel border border-mil-border rounded p-2 mt-2 text-left">
        <div class="flex justify-between"><span class="text-mil-amberMuted font-bold">🎖️ +${ganhas} insígnia${ganhas === 1 ? '' : 's'} para o Quartel</span><span class="text-mil-textMuted">total ${q.insignias}</span></div>
        ${apelidos.length ? `<div class="text-mil-textMuted mt-1">🏷️ ${apelidos.join(' · ')}</div>` : ''}
        ${caidos.length ? `<div class="text-mil-textMuted mt-1">🕯️ Entraram para o Memorial: ${caidos.map(s => s.rank + ' ' + s.name).join(', ')}</div>` : ''}
        <button onclick="abrirQuartel()" class="w-full mt-2 py-1.5 btn-tactical rounded font-bold text-xs">🎖️ Abrir o Quartel</button></div>`;
    if (op.tipo === 'desafio') {
        const r = pontosDoDesafio(venceu);
        extra += `<div class="bg-mil-panel border border-mil-amberMuted rounded p-2 mt-2 text-left"><div class="text-mil-amberMuted font-bold">📅 DESAFIO DE ${op.dia.split('-').reverse().join('/')}: ${r.pontos} pontos</div>
            <div class="text-mil-textMuted">${r.dias} dias × 100 · ${r.abates} abates × 5 · sobreviventes × 50${venceu ? ' · +300 por cumprir' : ''} · prestígio ÷ 10</div><div id="desafio-ranking" class="mt-1 text-mil-textMuted">Enviando para o ranking…</div></div>`;
    }
    const el = document.getElementById('end-relatorio'); if (el) el.innerHTML += extra;
    if (op.tipo === 'desafio') enviarDesafio(op.dia, pontosDoDesafio(venceu), venceu); // depois de a caixa existir na tela
};
async function enviarDesafio(dia, r, venceu) {
    const alvo = () => document.getElementById('desafio-ranking');
    if (typeof sb === 'undefined' || !sb || !usuario) { if (alvo()) alvo().textContent = 'Entre na sua conta para aparecer no ranking do desafio.'; return; }
    try {
        const { data: pos, error } = await sb.rpc('enviar_desafio', { p_dia: dia, p_nome: (CONFIG.apelido || 'Comandante').slice(0, 24), p_pontos: r.pontos, p_dias: r.dias, p_abates: r.abates, p_venceu: venceu });
        if (error) throw error;
        if (alvo()) alvo().innerHTML = `Você está em <b class="text-mil-textGlow">${pos}º</b> hoje.` + await htmlRankingDesafio(dia);
    } catch (e) { if (alvo()) alvo().textContent = 'Não deu para enviar ao ranking agora (sem conexão).'; }
}
async function htmlRankingDesafio(dia) {
    if (typeof sb === 'undefined' || !sb || !usuario) return '<div class="text-mil-textMuted mt-1">Entre na sua conta para ver o ranking.</div>';
    try {
        const { data, error } = await sb.rpc('ranking_desafio', { p_dia: dia });
        if (error) throw error;
        if (!data || !data.length) return '<div class="text-mil-textMuted mt-1">Ninguém jogou o desafio de hoje ainda. Seja o primeiro!</div>';
        return '<div class="mt-1">' + data.map(x => `<div class="flex justify-between border-b border-mil-borderDark py-0.5 ${x.eu ? 'text-mil-amberMuted font-bold' : ''}"><span>${x.posicao}º ${escHtml(x.nome)}${x.venceu ? ' ✔' : ''}</span><span>${x.pontos}</span></div>`).join('') + '</div>';
    } catch (e) { return '<div class="text-mil-textMuted mt-1">Ranking indisponível agora.</div>'; }
}
const escHtml = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Nova partida: escolher o tipo de operação ---------- */
novaPartida = async function () { abrirModalOp('nova'); };
async function comecarOperacao(tipo) {
    gravarJSON(OP_KEY, { tipo });
    skipPageHideSave = true;
    try { localStorage.removeItem(SAVE_KEY); localStorage.setItem(NOVA_KEY, String(Date.now())); } catch (e) {}
    try { await Promise.race([enviarNuvem(true), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
    location.reload();
}

/* ---------- Janela das operações e do Quartel ---------- */
function abrirModalOp(aba) {
    let m = document.getElementById('modal-op');
    if (!m) {
        m = document.createElement('div'); m.id = 'modal-op';
        m.className = 'hidden absolute inset-0 bg-black/90 z-50 flex items-start justify-center p-3 overflow-y-auto';
        const pai = document.getElementById('modal-tutorial') ? document.getElementById('modal-tutorial').parentElement : document.body;
        pai.appendChild(m);
    }
    perfilAberto = true; // o relógio para
    m.classList.remove('hidden');
    renderModalOp(aba);
}
function fecharModalOp() { const m = document.getElementById('modal-op'); if (m) m.classList.add('hidden'); perfilAberto = false; }
function abrirQuartel() { document.getElementById('modal-end') && document.getElementById('modal-end').classList.add('hidden'); abrirModalOp('quartel'); }
function comprarQuartel(id) {
    const q = lerQuartel(), it = QUARTEL[id];
    if (!it || q.compras[id] || q.insignias < it.custo) return;
    q.insignias -= it.custo; q.compras[id] = true; gravarJSON(QUARTEL_KEY, q);
    logFeed(`🎖️ Quartel: ${it.nome} liberado. Vale a partir da próxima partida.`, 'text-mil-greenMuted font-bold');
    playTacticalBeep(1200, 0.08); renderModalOp('quartel');
}
async function renderModalOp(aba) {
    const m = document.getElementById('modal-op'); if (!m) return;
    const q = lerQuartel(), memorial = lerJSON(MEMORIAL_KEY, []);
    const abas = [['nova', '🪖 Nova partida'], ['quartel', '🎖️ Quartel'], ['memorial', '🕯️ Memorial'], ['desafio', '📅 Desafio']];
    let corpo = '';
    if (aba === 'nova') {
        corpo = `<div class="text-mil-textMuted mb-2">A partida atual será apagada. Escolha a próxima operação:</div>` +
            Object.entries(OPERACOES).map(([id, o]) => `<button onclick="comecarOperacao('${id}')" class="w-full text-left p-2.5 mb-2 btn-tactical rounded">
                <div class="font-bold text-sm">${o.icone} ${o.nome}${id === 'desafio' ? ' · ' + hojeBR().split('-').reverse().join('/') : ''}</div>
                <div class="text-mil-textMuted font-normal mt-0.5">${o.desc}</div>
                <div class="text-mil-amberMuted font-normal mt-0.5">Vitória: +${o.insignias} insígnias${id === 'longa' ? ' e sobe o nível' : ''}</div></button>`).join('') +
            (Object.keys(q.compras).length ? `<div class="text-mil-greenMuted">Bônus do Quartel que valem (menos no desafio): ${Object.keys(q.compras).map(k => QUARTEL[k].icone + ' ' + QUARTEL[k].nome).join(', ')}</div>` : '');
    } else if (aba === 'quartel') {
        corpo = `<div class="flex justify-between items-center mb-2"><span class="text-mil-textMuted">Insígnias vêm de cada partida: vitória vale mais; derrota dá 1 a cada 3 dias resistidos.</span><span class="text-mil-amberMuted font-bold text-base ml-2 whitespace-nowrap">🎖️ ${q.insignias}</span></div>` +
            Object.entries(QUARTEL).map(([id, it]) => `<div class="flex items-center gap-2 p-2 mb-1.5 bg-mil-panel border border-mil-border rounded">
                <div class="flex-1"><div class="font-bold">${it.icone} ${it.nome}</div><div class="text-mil-textMuted">${it.desc}</div></div>
                ${q.compras[id] ? '<span class="text-mil-greenMuted font-bold">✔ seu</span>' : `<button onclick="comprarQuartel('${id}')" class="px-2 py-1.5 btn-tactical rounded font-bold ${q.insignias < it.custo ? 'opacity-50' : ''}" ${q.insignias < it.custo ? 'disabled' : ''}>${it.custo} 🎖️</button>`}</div>`).join('') +
            `<div class="text-mil-textMuted mt-1">As melhorias valem a partir da próxima partida (campanha ou operação curta).</div>`;
    } else if (aba === 'memorial') {
        corpo = memorial.length ? `<div class="text-mil-textMuted mb-2">Os que caíram defendendo a trincheira, em todas as partidas.</div>` + memorial.slice(0, 60).map(x => `<div class="p-2 mb-1.5 bg-mil-panel border-l-2 border-mil-redAlert rounded">
                <div class="font-bold">🕯️ ${escHtml(x.posto)} ${escHtml(x.nome)}${x.apelido ? ` "${escHtml(x.apelido)}"` : ''}</div>
                <div class="text-mil-textMuted">Caiu no dia ${x.dia} (${x.causa}) · ${x.abates} abates · ${OPERACOES[x.op] ? OPERACOES[x.op].nome : ''}, nível ${x.nivel} · ${String(x.data).split('-').reverse().join('/')}</div></div>`).join('')
            : '<div class="text-mil-textMuted">Ninguém caiu ainda. Que continue assim.</div>';
    } else if (aba === 'desafio') {
        const dia = hojeBR(), sit = SITUACOES[Object.keys(SITUACOES)[sementeDoDia(dia) % 3]];
        corpo = `<div class="p-2 mb-2 bg-mil-panel border border-mil-amberMuted rounded"><div class="font-bold text-mil-amberMuted">📅 Desafio de ${dia.split('-').reverse().join('/')}</div>
            <div class="text-mil-textMuted">10 dias no nível 6, situação: <b class="text-mil-textGlow">${sit.nome}</b> (${sit.desc}). A mesma sorte para todo mundo; vale a melhor tentativa do dia.</div>
            <div class="text-mil-textMuted mt-1">Pontos: dias × 100 + abates × 5 + sobreviventes × 50 + 300 se cumprir + prestígio ÷ 10.</div>
            <button onclick="comecarOperacao('desafio')" class="w-full mt-2 py-2 btn-tactical rounded font-bold">Jogar o desafio de hoje</button></div>
            <div class="font-bold mb-1">Ranking de hoje</div><div id="desafio-lista" class="text-mil-textMuted">Carregando…</div>`;
    }
    m.innerHTML = `<div class="bg-mil-bg border-2 border-mil-amberMuted rounded p-3 max-w-md w-full text-xs mt-2">
        <div class="flex justify-between items-center mb-2"><span class="font-bold text-mil-amberMuted tracking-wider">OPERAÇÕES E QUARTEL</span><button onclick="fecharModalOp()" class="px-2 py-1 btn-tactical rounded">✖</button></div>
        <div class="grid grid-cols-4 gap-1 mb-3">${abas.map(([id, t]) => `<button onclick="renderModalOp('${id}')" class="py-1.5 rounded border ${aba === id ? 'border-mil-amberMuted text-mil-amberMuted bg-mil-panel' : 'border-mil-border text-mil-textMuted'}">${t}</button>`).join('')}</div>
        ${corpo}</div>`;
    if (aba === 'desafio') { const l = await htmlRankingDesafio(hojeBR()); const el = document.getElementById('desafio-lista'); if (el) el.innerHTML = l; }
}

/* ---------- Painéis no jogo: obras (aba Defesas) e ordens permanentes (aba Esquadrão) ---------- */
let assinaturaMelhorias = '', assinaturaOrdens = '';
function renderMelhorias(forcar) {
    let el = document.getElementById('def-melhorias');
    if (!el) {
        const painel = document.getElementById('panel-defense'); if (!painel) return;
        el = document.createElement('div'); el.id = 'def-melhorias'; el.className = 'space-y-2';
        painel.insertBefore(el, painel.firstChild);
    }
    const ob = gameState.obrasT;
    const ass = JSON.stringify([ob, Math.floor(gameState.prestige / 10)]);
    if (!forcar && ass === assinaturaMelhorias) return;
    assinaturaMelhorias = ass;
    const linha = (id) => {
        const o = OBRAS_T[id], feita = obraFeita(id), emObra = ob.atual === id, disp = obraDisponivel(id), c = custo(o.custo);
        const estado = feita ? '<span class="text-mil-greenMuted font-bold">✔ pronta</span>'
            : emObra ? `<span class="text-mil-amberMuted font-bold">${Math.floor(100 * ob.progresso / o.trabalho)}%</span>`
            : disp ? `<button onclick="comecarObraT('${id}')" class="px-2 py-1 btn-tactical rounded font-bold ${ob.atual || gameState.prestige < c ? 'opacity-50' : ''}" ${ob.atual || gameState.prestige < c ? 'disabled' : ''}>${c} pts</button>`
            : `<span class="text-mil-textMuted">🔒 ${OBRAS_T[o.req].nome}</span>`;
        return `<div class="flex items-center gap-2 p-1.5 bg-mil-panel border border-mil-border rounded ${!disp && !feita && !emObra ? 'opacity-60' : ''}"><div class="flex-1"><b>${o.icone} ${o.nome}</b> <span class="text-mil-textMuted">· nível ${o.nivel}</span><div class="text-mil-textMuted">${o.desc}</div></div>${estado}</div>`;
    };
    el.innerHTML = `<div class="text-xs text-mil-textMuted">OBRAS DA TRINCHEIRA <span class="normal-case">(quem está na Manutenção constrói; uma por vez)</span></div>` + Object.keys(OBRAS_T).map(linha).join('');
}
function renderOrdens(forcar) {
    let el = document.getElementById('ordens-permanentes');
    if (!el) {
        const lista = document.getElementById('squad-list'); if (!lista) return;
        el = document.createElement('div'); el.id = 'ordens-permanentes';
        el.className = 'bg-mil-panel border border-mil-border rounded p-1.5 text-xs';
        lista.parentElement.insertBefore(el, lista);
    }
    const o = gameState.ordens, ass = JSON.stringify(o);
    if (!forcar && ass === assinaturaOrdens) return;
    assinaturaOrdens = ass;
    const passo = (k, txt, v) => `<div class="flex items-center justify-between gap-1"><span class="text-mil-textMuted">${txt}</span><span class="flex items-center gap-1"><button onclick="mudarOrdem('${k}',${k === 'reparo' ? -10 : -1})" class="w-6 h-6 btn-tactical rounded font-bold">−</button><b class="w-12 text-center text-mil-textGlow">${v}</b><button onclick="mudarOrdem('${k}',${k === 'reparo' ? 10 : 1})" class="w-6 h-6 btn-tactical rounded font-bold">+</button></span></div>`;
    el.innerHTML = `<div class="text-mil-amberMuted font-bold mb-1">📋 ORDENS PERMANENTES <span class="text-mil-textMuted font-normal">(o esquadrão segue sozinho)</span></div>
        ${passo('vigiaMin', 'Mínimo de vigias', o.vigiaMin ? o.vigiaMin : 'livre')}
        ${passo('reparo', 'Reparar se a trincheira cair abaixo de', o.reparo ? o.reparo + '%' : 'livre')}
        ${passo('descansoMin', 'Mínimo descansando', o.descansoMin ? o.descansoMin : 'livre')}`;
}
const _updateUI = updateUI;
updateUI = function () { _updateUI(); try { renderMelhorias(); renderOrdens(); } catch (e) {} };

/* ---------- Ficha do soldado: apelido e cartas ---------- */
const _abrirPerfil = abrirPerfil;
abrirPerfil = function (id) {
    _abrirPerfil(id);
    const s = gameState.squad.find(x => x.id === id); if (!s) return;
    const dados = document.getElementById('perfil-dados');
    if (s.apelido) document.getElementById('perfil-nome').textContent += ` "${s.apelido}"`;
    const cartas = (gameState.cartas || []).filter(c => c.id === id).slice(-3);
    if (cartas.length && dados) dados.innerHTML += `<div class="mt-1"><span class="text-mil-amberMuted">✉️ Cartas ${DESTINO_CARTA[id] || 'para casa'}:</span>${cartas.map(c => `<div class="font-typewriter mt-0.5">Dia ${c.dia}: “${escHtml(c.texto)}”</div>`).join('')}</div>`;
};

/* ---------- Rodapé: botão do Quartel ---------- */
(function botaoQuartel() {
    const nova = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Nova partida');
    if (!nova || document.getElementById('btn-quartel')) return;
    const b = document.createElement('button');
    b.id = 'btn-quartel'; b.className = 'text-xs px-2 py-1 btn-tactical rounded font-bold whitespace-nowrap';
    b.textContent = `🎖️ Quartel`; b.onclick = () => abrirModalOp('quartel');
    nova.parentElement.insertBefore(b, nova);
})();
renderMelhorias(true); renderOrdens(true);
