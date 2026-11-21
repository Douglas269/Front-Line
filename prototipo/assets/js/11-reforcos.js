/* ---------- Reforços do Alto Comando ----------
   A cada 5 dias (5, 10, 15, 20 e 25) o jogador escolhe 1 entre 3 reforços. Cada um tem um bônus (▲) e um preço (▼).
   As escolhas ficam na partida (salvas) e somam por cima dos modificadores de nível. Os efeitos entram por "embrulhos"
   das funções do jogo (mesmo estilo de 07-operacoes.js), então nada de regra antiga muda. */
const REFORCO_DIAS = [5, 10, 15, 20, 25];
const REFORCOS = {
    mira:       { nome: 'Instrução de tiro',      icone: '🎯', bonus: 'Precisão do esquadrão +10%',                 preco: 'Comboio traz 6% menos' },
    parapeito:  { nome: 'Parapeito de concreto',  icone: '🧱', bonus: 'Estrago na trincheira −25%',                 preco: 'Prestígio ganho −10%' },
    rancho:     { nome: 'Rancho eficiente',       icone: '🍲', bonus: 'Cozinha gasta 30% menos ração e água',       preco: 'Inimigos causam +5% de dano' },
    maca:       { nome: 'Maca e plasma',          icone: '🩺', bonus: 'Todo ferido se cura mais rápido',            preco: 'Precisão −3%' },
    abrigo:     { nome: 'Abrigos reforçados',     icone: '🛡', bonus: 'Inimigos causam −12% de dano',               preco: 'Comboio traz 8% menos' },
    paiol:      { nome: 'Paiol ampliado',         icone: '📦', bonus: 'Agora: +350 munição leve e +70 pesada',      preco: 'Inimigos com +8% de vida' },
    cartas:     { nome: 'Cartas de casa',         icone: '✉', bonus: 'Agora: +25 de moral em todo o esquadrão',    preco: 'Apoios da Central +10% mais caros' },
    noturna:    { nome: 'Óptica noturna',         icone: '🔭', bonus: 'Precisão à noite +22%',                      preco: 'Prestígio ganho −6%' },
    imprensa:   { nome: 'Imprensa de guerra',     icone: '📻', bonus: 'Prestígio ganho +30%',                       preco: 'Inimigos causam +5% de dano' },
    revezamento:{ nome: 'Revezamento disciplinado', icone: '🛏', bonus: 'Quem descansa recupera o fôlego mais rápido', preco: 'Precisão −3%' },
    mensageiros:{ nome: 'Rede de mensageiros',    icone: '🏍', bonus: 'Comboio traz 10% mais',                      preco: '6% mais eventos e crises' }
};
const refTem = (id) => !!(gameState.reforcos && gameState.reforcos.indexOf(id) >= 0);

/* ----- Efeitos ----- */
const _diffRef = diff;
diff = function () {
    const d = _diffRef(), t = refTem;
    if (!(gameState.reforcos && gameState.reforcos.length)) return d;
    const dano = (t('rancho') ? 1.05 : 1) * (t('abrigo') ? 0.88 : 1) * (t('imprensa') ? 1.05 : 1);
    const sup = (t('mira') ? 0.94 : 1) * (t('abrigo') ? 0.92 : 1) * (t('mensageiros') ? 1.10 : 1);
    const premio = (t('parapeito') ? 0.9 : 1) * (t('noturna') ? 0.94 : 1) * (t('imprensa') ? 1.3 : 1);
    return Object.assign({}, d, {
        enemyDmgMult: d.enemyDmgMult * dano,
        enemyHpMult: d.enemyHpMult * (t('paiol') ? 1.08 : 1),
        supplyMult: d.supplyMult * sup,
        rewardMult: d.rewardMult * premio,
        costMult: d.costMult * (t('cartas') ? 1.1 : 1),
        eventMult: d.eventMult * (t('mensageiros') ? 1.06 : 1)
    });
};
const _chanceDeAcertoRef = chanceDeAcerto;
chanceDeAcerto = function (s, arma, enemy, estado = gameState) {
    let p = _chanceDeAcertoRef(s, arma, enemy, estado);
    if (estado === gameState && gameState.reforcos && gameState.reforcos.length) {
        if (refTem('mira')) p *= 1.10;
        if (refTem('maca')) p *= 0.97;
        if (refTem('revezamento')) p *= 0.97;
        if (refTem('noturna') && ehNoite(estado) && !estado.tacticalOrders.FULL_VIGILANCE) p *= 1.22;
    }
    return Math.min(0.95, p);
};
const _trenchDamageRef = trenchDamage;
trenchDamage = function (qtd, motivo) { return _trenchDamageRef(refTem('parapeito') ? qtd * 0.75 : qtd, motivo); };
const _eatInKitchenRef = eatInKitchen;
eatInKitchen = function (soldier) {
    const r = gameState.resources, antes = { rations: r.rations, water: r.water };
    _eatInKitchenRef(soldier);
    if (refTem('rancho')) { r.rations += (antes.rations - r.rations) * 0.3; r.water += (antes.water - r.water) * 0.3; }
};
const _processSquadNeedsRef = processSquadNeeds;
processSquadNeeds = function () {
    _processSquadNeedsRef();
    if (gameState.timeSeconds % 10 !== 0 || !(gameState.reforcos && gameState.reforcos.length)) return;
    gameState.squad.forEach(s => {
        if (s.hp <= 0) return;
        if (refTem('maca') && s.hp < 100) s.hp = Math.min(100, s.hp + 0.3);
        if (refTem('revezamento') && s.duty === 'REST') s.fatigue = Math.max(0, s.fatigue - 1.2);
    });
};

/* ----- Oferta e escolha ----- */
function sortearReforcos() {
    const livres = Object.keys(REFORCOS).filter(id => !refTem(id));
    for (let i = livres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [livres[i], livres[j]] = [livres[j], livres[i]]; }
    return livres.slice(0, 3);
}
function escolherReforco(id) {
    if (!REFORCOS[id] || !gameState.reforcoOferta) return;
    gameState.reforcos = (gameState.reforcos || []).concat(id);
    gameState.reforcoOferta = null;
    if (id === 'paiol') { addAmmoRifle(350); addAmmoHeavy(70); }
    if (id === 'cartas') gameState.squad.forEach(s => { if (s.hp > 0) s.moral = Math.min(100, s.moral + 25); });
    const r = REFORCOS[id];
    logFeed(`${r.icone} Reforço do Alto Comando: ${r.nome}. ▲ ${r.bonus} · ▼ ${r.preco}.`, 'text-mil-amberMuted font-bold');
    try { addDiaryEntry(`Reforço escolhido no dia ${gameState.day}: ${r.nome}.`); } catch (e) {}
    fecharReforcos(); desenharReforcosAtivos(); saveGame();
}
function abrirReforcos() {
    let m = document.getElementById('modal-reforco');
    if (!m) {
        m = document.createElement('div'); m.id = 'modal-reforco';
        m.className = 'hidden absolute inset-0 bg-black/90 z-50 flex items-start justify-center p-3 overflow-y-auto';
        const pai = document.getElementById('modal-tutorial') ? document.getElementById('modal-tutorial').parentElement : document.body;
        pai.appendChild(m);
    }
    perfilAberto = true; // o relógio para até escolher
    m.innerHTML = `<div class="w-full max-w-md mt-4 bg-mil-bg border-2 border-mil-amberMuted rounded p-3 text-xs">
        <div class="font-bold text-mil-amberMuted tracking-wider text-sm">REFORÇOS DO ALTO COMANDO · DIA ${gameState.day}</div>
        <div class="text-mil-textMuted mt-1 mb-2">Escolha 1. Todo reforço tem um preço: pense no que seu esquadrão precisa.</div>
        ${gameState.reforcoOferta.map(id => { const r = REFORCOS[id]; return `<button type="button" onclick="escolherReforco('${id}')" class="w-full text-left p-2.5 mb-2 btn-tactical rounded">
            <div class="font-bold text-sm">${r.icone} ${r.nome}</div>
            <div class="text-mil-greenMuted font-normal mt-0.5">▲ ${r.bonus}</div>
            <div class="text-red-400 font-normal mt-0.5">▼ ${r.preco}</div></button>`; }).join('')}</div>`;
    m.classList.remove('hidden');
}
function fecharReforcos() { const m = document.getElementById('modal-reforco'); if (m) m.classList.add('hidden'); perfilAberto = false; }
function ofertarReforcos() {
    if (gameState.reforcoOferta || gameEnded) return;
    if (typeof GuiaT !== 'undefined' && GuiaT.ativo()) return;
    const livres = sortearReforcos(); if (livres.length < 2) return;
    gameState.reforcoOferta = livres; gameState.reforcoDia = gameState.day;
    saveGame();
}
// Em teste automático (robô) escolhe sozinho, sem janela; a janela só abre com ?reforcos=1
const reforcoAutomatico = () => navigator.webdriver && !/[?&]reforcos=1/.test(location.search);
function verificarReforcos() {
    if (!gameState.reforcoOferta || gameEnded) return;
    if (reforcoAutomatico()) { escolherReforco(gameState.reforcoOferta[Math.floor(Math.random() * gameState.reforcoOferta.length)]); return; }
    const m = document.getElementById('modal-reforco');
    if ((!m || m.classList.contains('hidden')) && !menuAberto && !loginAberto && !tutorialAberto && !gameState.activeCrisis) abrirReforcos();
}
const _onNewDayRef = onNewDay;
onNewDay = function () {
    _onNewDayRef();
    if (REFORCO_DIAS.includes(gameState.day) && gameState.day <= GAME_CONFIG.TOTAL_DAYS && gameState.reforcoDia !== gameState.day) { ofertarReforcos(); verificarReforcos(); }
};
const _updateGameTickRef = updateGameTick;
updateGameTick = function () { verificarReforcos(); desenharReforcosAtivos(); return _updateGameTickRef(); };

/* ----- Reforços ativos na tela ----- */
let _reforcosDesenhados = '';
function desenharReforcosAtivos() {
    const el = document.getElementById('reforcos-chip'); if (!el) return;
    const ids = gameState.reforcos || [], chave = ids.join(',');
    if (chave === _reforcosDesenhados) return;
    _reforcosDesenhados = chave;
    el.classList.toggle('hidden', !ids.length);
    el.innerHTML = ids.length ? '<span class="text-mil-textMuted">Reforços:</span> ' + ids.map(id => `<span class="reforco-pill" title="${REFORCOS[id].nome}: ▲ ${REFORCOS[id].bonus} · ▼ ${REFORCOS[id].preco}">${REFORCOS[id].icone} ${REFORCOS[id].nome}</span>`).join('') : '';
}
const _relatorioFinalRef = relatorioFinal;
relatorioFinal = function () {
    const ids = gameState.reforcos || [];
    const lista = ids.length ? `<div class="bg-mil-panel border border-mil-border rounded p-2 mb-2 text-left"><div class="font-bold text-mil-amberMuted mb-1">REFORÇOS ESCOLHIDOS</div><div class="text-mil-textMuted">${ids.map(id => REFORCOS[id].icone + ' ' + REFORCOS[id].nome).join(' · ')}</div></div>` : '';
    return _relatorioFinalRef() + lista;
};
