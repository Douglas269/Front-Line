// FrontLine · Trincheiras: o campo guarda o estrago, efeitos de impacto e ameaças novas
// Carregado depois de 07-operacoes.js. Envolve funções do jogo (as declarações de função podem ser reatribuídas).
// - Estrago que fica: crateras (salvas), corpos e cascos queimados no chão por um tempo, fumaça que demora a sumir;
// - Impacto: faíscas e poeira nos acertos, fumaça longa depois de explosões;
// - Ameaças novas (o general inimigo passa a escolhê-las): ☣ ataque químico, 🌑 incursão noturna furtiva, 🔥 lança-chamas.

/* ---------- Estrago no campo ---------- */
const CAMPO = { MAX_CRATERAS: 10, CORPO_VIDA: 300, MAX_CORPOS: 14 };
const campoDe = () => gameState.campo || (gameState.campo = { crateras: [] });
const tempoDeJogo = () => gameState.day * GAME_CONFIG.DAY_DURATION_SEC + gameState.timeSeconds;
let cenaCorpos = []; // corpos e cascos no chão (só enfeite: não entram no salvamento)

function registrarCratera(x, r) {
    const c = campoDe();
    c.crateras.push({ x: Math.max(20, Math.min(380, x)), r: r || (15 + Math.random() * 10), dia: gameState.day, f: Math.random() });
    while (c.crateras.length > CAMPO.MAX_CRATERAS) c.crateras.shift();
}
// O fundo em cache só é repintado quando a "assinatura" muda: as crateras entram nela
const _o8_assinaturaDoFundo = assinaturaDoFundo;
assinaturaDoFundo = function () { return _o8_assinaturaDoFundo() + '|c' + campoDe().crateras.length + ':' + gameState.day; };
const _o8_desenharCeuFundo = desenharCeuFundo;
desenharCeuFundo = function () {
    _o8_desenharCeuFundo();
    campoDe().crateras.forEach(c => { // cratera nova é escura e funda; com os dias, a terra a cobre um pouco
        const idade = Math.max(0, gameState.day - c.dia), a = Math.max(0.45, 1 - idade * 0.08), y = CORTE.SOLO - 9 + (c.f - 0.5) * 8;
        cctx.fillStyle = `rgba(14,11,8,${0.85 * a})`; cctx.beginPath(); cctx.ellipse(c.x, y, c.r, c.r * 0.3, 0, 0, Math.PI * 2); cctx.fill();
        cctx.strokeStyle = `rgba(150,128,92,${0.85 * a})`; cctx.lineWidth = 1.6; cctx.beginPath(); cctx.ellipse(c.x, y - 1, c.r + 2, c.r * 0.34, 0, Math.PI * 1.02, Math.PI * 1.98); cctx.stroke(); // borda levantada
        cctx.fillStyle = `rgba(70,58,40,${0.7 * a})`; for (let q = 0; q < 4; q++) cctx.fillRect(c.x + (q - 1.5) * c.r * 0.55, y - c.r * 0.3 - (q % 2), 2, 1.4); // torrões
    });
};

// Corpos no chão e cascos queimados (somem sozinhos), desenhados antes dos inimigos vivos
const _o8_desenharInimigosCena = desenharInimigosCena;
desenharInimigosCena = function (t) {
    const agora = tempoDeJogo();
    cenaCorpos = cenaCorpos.filter(c => agora - c.t < CAMPO.CORPO_VIDA);
    cenaCorpos.forEach(c => {
        const k = (agora - c.t) / CAMPO.CORPO_VIDA;
        cctx.save(); cctx.translate(c.x, c.y); cctx.globalAlpha = 0.9 * (1 - k * 0.85);
        if (c.tipo === 'blindado') { // casco queimado com fumaça fina
            cctx.fillStyle = '#100d0a'; cctx.fillRect(-11, -6, 22, 5); cctx.fillRect(-5, -9, 10, 3);
            cctx.strokeStyle = '#3a2a1c'; cctx.lineWidth = 0.8; cctx.strokeRect(-11, -6, 22, 5);
            if (!jogoPausado && Math.random() < 0.12 * (1 - k)) { cctx.fillStyle = 'rgba(70,66,58,0.35)'; cctx.beginPath(); cctx.arc((Math.random() - 0.5) * 8, -12 - Math.random() * 8, 2 + Math.random() * 2, 0, Math.PI * 2); cctx.fill(); }
        } else {
            cctx.fillStyle = '#1b1210'; cctx.beginPath(); cctx.ellipse(0, -1, 5, 1.6, 0, 0, Math.PI * 2); cctx.fill();
            cctx.fillStyle = '#2a1c18'; cctx.beginPath(); cctx.ellipse(5.2, -1.6, 1.8, 1.2, 0, 0, Math.PI * 2); cctx.fill(); // capacete
        }
        cctx.restore();
    });
    _o8_desenharInimigosCena(t);
};

/* ---------- Impacto: faíscas, poeira e fumaça que demora ---------- */
function efeitoAcerto(inimigo) {
    if (!inimigo || document.hidden || jogoPausado || Math.random() > 0.45) return;
    if (typeof emiteAcerto === 'function' && CONFIG.particulas !== false) { const q = posInimigoCena(inimigo); emiteAcerto(q.x, q.y - 8); return; } // partículas (08b)
    cenaEfeito('faisca', { inimigo }, 12);
    if (Math.random() < 0.3) cenaEfeito('poeira', { inimigo }, 30);
}
function fumacaNoCampo(x, forca) {
    cenaEfeito('fumacaLonga', { pos: { x, y: CORTE.SOLO - 3 } }, Math.round(120 + 90 * (forca || 1)));
}
const _o8_abaterInimigo = abaterInimigo;
abaterInimigo = function (estado, enemy) {
    const p = posInimigoCena(enemy);
    cenaCorpos.push({ x: p.x, y: p.y, tipo: enemy.type === 'blindado' ? 'blindado' : 'soldado', t: tempoDeJogo() });
    if (typeof emiteMorte === 'function') emiteMorte(p.x, p.y);
    while (cenaCorpos.length > CAMPO.MAX_CORPOS) cenaCorpos.shift();
    if (enemy.type === 'blindado' || enemy.type === 'sapador') { registrarCratera(p.x, 11 + Math.random() * 6); fumacaNoCampo(p.x, 1.4); }
    return _o8_abaterInimigo(estado, enemy);
};
// Bombardeio inimigo: no momento do impacto o campo ganha crateras e fumaça perto do parapeito
const _o8_processBarrage = processBarrage;
processBarrage = function () {
    const havia = gameState.barrage && gameState.barrage.ticks <= 1;
    _o8_processBarrage();
    if (havia && !gameState.barrage) {
        for (let i = 0; i < 2; i++) { const x = 30 + Math.random() * 340; registrarCratera(x); fumacaNoCampo(x, 1); cenaEfeito('explosao', { pos: { x, y: CORTE.SOLO - 8 } }); } // o projétil cai no campo
    }
};
// Novos tipos de efeito na cena (chamado por 05-cena.js para tipos que ela não conhece)
function desenharEfeitoExtra(ef, k, p) {
    if (ef.tipo === 'faisca') {
        cctx.fillStyle = `rgba(255,${200 + Math.round(40 * ef.sx)},130,${1 - k})`;
        for (let q = 0; q < 6; q++) { const a = (q / 6) * Math.PI * 2 + ef.sx * 5, d = 2 + k * 15; cctx.fillRect(p.x + Math.cos(a) * d, p.y - 10 + Math.sin(a) * d - k * 5, 1.5, 1.5); }
    } else if (ef.tipo === 'poeira') {
        cctx.fillStyle = `rgba(140,120,85,${0.35 * (1 - k)})`; cctx.beginPath(); cctx.ellipse(p.x + k * 5, p.y - 3 - k * 7, 4 + k * 8, 2 + k * 3, 0, 0, Math.PI * 2); cctx.fill();
    } else if (ef.tipo === 'fumacaLonga') {
        for (let i = 0; i < 4; i++) {
            cctx.fillStyle = `rgba(72,69,62,${0.3 * (1 - k)})`;
            cctx.beginPath(); cctx.arc(p.x + Math.sin(ef.idade / 22 + i + ef.sx * 6) * 5 + k * 16, p.y - 4 - k * 36 - i * 7, 5 + k * 9 + i * 1.5, 0, Math.PI * 2); cctx.fill();
        }
    }
}

/* ---------- Ameaças novas ---------- */
ENEMY_TYPES.infiltrado = { label: 'INFILTRADO', speed: 1.0, hpMult: 0.7, attackChance: 0.28, furtivo: true,
    dmg: (e) => 1.3 * (e.hp / (e.maxHp || e.hp)) * (1 + PRESSURE.ENEMY_DMG_PER_DAY * gameState.day) };
ENEMY_TYPES.sapador = { label: 'LANÇA-CHAMAS', speed: 0.7, hpMult: 1.6, attackChance: 0.55, alcance: 55,
    dmg: (e) => 3.0 * (e.hp / (e.maxHp || e.hp)) * (1 + PRESSURE.ENEMY_DMG_PER_DAY * gameState.day) };
GENERAL_PLANS.gas = { nome: 'Ataque químico', custo: 7, passos: [{ a: 'gas', d: 0 }],
    pista: '📻 Rádio: cheiro de mostarda no vento… cilindros sendo posicionados.' };
GENERAL_PLANS.incursao = { nome: 'Incursão noturna', custo: 5, passos: [{ a: 'incursao', d: 0 }],
    pista: '📻 Rádio: silêncio estranho do lado deles… batedores sem lanterna.' };
GENERAL_PLANS.chamas = { nome: 'Tropa de choque com lança-chamas', custo: 6, passos: [{ a: 'infantaria', d: 0 }, { a: 'sapador', d: 10 }],
    pista: '📻 Rádio: tropa de choque com tanques de combustível avançando.' };

const _o8_planoViavel = planoViavel;
planoViavel = function (id) {
    if (!_o8_planoViavel(id)) return false;
    if (id === 'gas') return gameState.day >= 6 && !gameState.gas && !gameState.barrage;
    if (id === 'incursao') return gameState.day >= 3 && ehNoite() && !gameState.enemies.some(e => e.type === 'infiltrado');
    if (id === 'chamas') return gameState.day >= 9 && !gameState.enemies.some(e => e.type === 'sapador');
    return true;
};
const _o8_utilidadePlano = utilidadePlano;
utilidadePlano = function (id, sit, m) {
    const b = (x) => (x ? 1 : 0);
    if (id === 'gas') return 0.8 + 0.5 * b(sit.cansado) + 0.3 * b(sit.noite);
    if (id === 'incursao') return 0.9 + 0.7 * b(sit.vigiasFracos) + 0.4 * b(sit.nevoa);
    if (id === 'chamas') return 0.7 + 0.6 * b(sit.trincheiraFraca) + 0.3 * b(sit.noite);
    return _o8_utilidadePlano(id, sit, m);
};
const _o8_executarPasso = executarPasso;
executarPasso = function (acao) {
    if (acao === 'gas') return iniciarGas();
    if (acao === 'incursao') {
        for (let i = 0; i < 3; i++) spawnEnemy('infiltrado', 220 + Math.random() * 25);
        if (Math.random() < 0.5) logFeed('🌑 Movimento suspeito no escuro… os vigias não têm certeza do que viram.', 'text-mil-amberMuted font-bold');
        playTacticalBeep(220, 0.12);
        return;
    }
    if (acao === 'sapador') {
        spawnEnemy('sapador', 230);
        logFeed('🔥 LANÇA-CHAMAS INIMIGO avançando! Derrube-o antes que chegue perto: o fogo queima o posto.', 'text-red-400 font-bold');
        playTacticalBeep(260, 0.25);
        return;
    }
    return _o8_executarPasso(acao);
};
// Furtivo: só aparece de perto, com Vigília Total ou com 3 ou mais soldados de vigília; escondido, a mira cai pela metade
const inimigoOculto = (e) => !!(ENEMY_TYPES[e.type] && ENEMY_TYPES[e.type].furtivo) && !(
    gameState.tacticalOrders.FULL_VIGILANCE || e.distance < 70 || gameState.squad.filter(s => s.hp > 0 && s.duty === 'WATCH').length >= 3);
const _o8_chanceDeAcerto = chanceDeAcerto;
chanceDeAcerto = function (s, arma, enemy, estado) {
    const p = _o8_chanceDeAcerto(s, arma, enemy, estado);
    return enemy && inimigoOculto(enemy) ? p * 0.5 : p;
};
// Lança-chamas: a chama sai à frente dele
function desenharExtraInimigo(e, p, esc, t) {
    if (e.type !== 'sapador') return;
    const comp = 14 + Math.sin(t / 60) * 3, ya = p.y - 8 * esc;
    const g = cctx.createLinearGradient(p.x + 6, ya, p.x + 6 + comp, ya);
    g.addColorStop(0, 'rgba(255,230,140,0.95)'); g.addColorStop(0.5, 'rgba(240,120,40,0.7)'); g.addColorStop(1, 'rgba(120,40,10,0)');
    cctx.fillStyle = g; cctx.beginPath(); cctx.moveTo(p.x + 6, ya - 1.5); cctx.quadraticCurveTo(p.x + 6 + comp * 0.6, ya - 4 - Math.random() * 2, p.x + 6 + comp, ya); cctx.quadraticCurveTo(p.x + 6 + comp * 0.6, ya + 4, p.x + 6, ya + 1.5); cctx.fill();
    cctx.fillStyle = '#e06a2a'; cctx.fillRect(p.x - 5 * esc, ya - 3, 3, 6); // tanque de combustível
    if (typeof emiteChama === 'function' && !jogoPausado) emiteChama(p.x + 6 + comp * 0.8, ya);
}
const _o8_resolverChegadaNaTrincheira = resolverChegadaNaTrincheira;
resolverChegadaNaTrincheira = function (estado, enemy, alive) {
    if (enemy.type !== 'sapador') return _o8_resolverChegadaNaTrincheira(estado, enemy, alive);
    logFeed('🔥 O LANÇA-CHAMAS ALCANÇOU A TRINCHEIRA! Fogo no posto de vigília!', 'text-red-500 font-bold');
    trenchDamage(TRENCH.DAMAGE_INVASION * 1.5, 'o lança-chamas');
    tremer(6, 400); vibrar([120, 60, 120]); somExplosao(0.9);
    cenaEfeito('fogo', { comodo: 'posto' }); cenaEfeito('explosao', { comodo: 'posto' });
    registrarCratera(60 + Math.random() * 280, 12);
    const vigias = alive.filter(s => s.hp > 0 && s.duty === 'WATCH'), alvos = embaralhar(vigias.length ? vigias : alive.filter(s => s.hp > 0)).slice(0, 2);
    alvos.forEach(s => {
        const dano = 22 * diff().enemyDmgMult * PRESSURE.ENEMY_DAMAGE * (estado.tacticalOrders.SHELTER ? shelterMult() : 1);
        s.hp = Math.max(0, s.hp - dano); perdaMoral(s, 6); marcarFerido(s);
        numeroNaCena({ soldado: s.id }, '-' + Math.max(1, Math.round(dano)), '#ff9b4a', 12);
        if (s.hp <= 0) { logFeed(`❌ BAIXA: ${s.rank} ${s.name} morreu queimado!`, 'text-red-500 font-bold'); impacto('morte'); }
    });
};

/* ---------- ☣ Ataque químico ----------
   Aviso de ~8 s reais; a nuvem chega e fica ~7 s reais. Quem não se protege perde vida, moral e fôlego.
   Proteção: soldado no abrigo (descanso) sofre 30%; Máscaras (botão na cena) deixam 10%, mas custam prestígio e
   o esquadrão atira 20% mais devagar enquanto as usa. */
const GAS = { AVISO: 48, DURACAO: 42, DANO: 0.18, MORAL: 0.3, FADIGA: 0.25, ABRIGO: 0.3, MASCARA: 0.1, MASCARA_CUSTO: 10, MASCARA_CADENCIA: 0.8 };
const gasAtivo = () => !!(gameState.gas && gameState.gas.ticks <= 0);
function iniciarGas() {
    gameState.gas = { ticks: GAS.AVISO, dur: GAS.DURACAO, mascaras: false };
    tocarSom('alarme', 0.8);
    if (typeof CONFIG !== 'undefined' && CONFIG.pausaArtilharia && !jogoPausado) {
        alternarPausa(true);
        logFeed('⏸ Jogo pausado no aviso de gás: decida com calma e toque em Continuar.', 'text-mil-amberMuted font-bold');
    }
    logFeed(`☣ ATAQUE QUÍMICO: a nuvem chega em ${seg(GAS.AVISO)}s! Vistam as MÁSCARAS (botão na cena) ou ponham o pessoal no abrigo.`, 'text-red-500 font-bold');
    playTacticalBeep(350, 0.3);
}
function vestirMascaras() {
    const g = gameState.gas;
    if (!g || g.mascaras || gameEnded) return;
    const c = custo(GAS.MASCARA_CUSTO);
    if (gameState.prestige < c) { logFeed(`😷 Faltam ${c - Math.floor(gameState.prestige)} pontos de prestígio para as máscaras.`, 'text-mil-amberMuted'); return; }
    gameState.prestige -= c; g.mascaras = true;
    logFeed('😷 MÁSCARAS VESTIDAS: o gás quase não passa, mas o esquadrão atira mais devagar.', 'text-mil-greenMuted font-bold');
    playTacticalBeep(700, 0.1); renderBotaoMascaras();
}
function processarGas() {
    const g = gameState.gas;
    if (!g) return;
    if (g.ticks > 0) { if (--g.ticks === 0) { logFeed('☣ A NUVEM DE GÁS CHEGOU À TRINCHEIRA!', 'text-red-500 font-bold'); tremer(2, 250); } return; }
    g.dur--;
    gameState.squad.forEach(s => {
        if (s.hp <= 0) return;
        const f = Math.min(s.duty === 'REST' ? GAS.ABRIGO : 1, g.mascaras ? GAS.MASCARA : 1);
        s.hp = Math.max(0, s.hp - GAS.DANO * f * diff().enemyDmgMult);
        perdaMoral(s, GAS.MORAL * f); s.fatigue = Math.min(100, s.fatigue + GAS.FADIGA * f);
        if (f > 0.5 && Math.random() < 0.035) numeroNaCena({ soldado: s.id }, '☣', '#c8e06a', 11);
        if (s.hp <= 0) { logFeed(`❌ BAIXA: ${s.rank} ${s.name} morreu intoxicado!`, 'text-red-500 font-bold'); impacto('morte'); }
    });
    if (g.dur <= 0) {
        logFeed(g.mascaras ? '🌬 O vento levou o gás. Podem tirar as máscaras.' : '🌬 O vento levou o gás. A trincheira cheira a mostarda.', 'text-mil-amberMuted font-bold');
        gameState.gas = null; renderBotaoMascaras();
    }
}
const _o8_processEnemiesAndCombat = processEnemiesAndCombat;
processEnemiesAndCombat = function () { const r = _o8_processEnemiesAndCombat.apply(this, arguments); processarGas(); return r; };
const _o8_cadenciaDe = cadenciaDe;
cadenciaDe = function (s, arma, estado) { const c = _o8_cadenciaDe(s, arma, estado); return gasAtivo() && gameState.gas.mascaras ? c * GAS.MASCARA_CADENCIA : c; };

// Nuvem na cena: um banco de gás rola pela terra de ninguém no aviso e, ao chegar, tinge a trincheira toda
const _o8_desenharClimaCena = desenharClimaCena;
desenharClimaCena = function (t) {
    _o8_desenharClimaCena(t);
    const g = gameState.gas;
    if (!g) return;
    if (g.ticks > 0) {
        const prog = 1 - g.ticks / GAS.AVISO, x0 = -40 + prog * 470;
        for (let i = 0; i < 9; i++) {
            const x = x0 - i * 34 + Math.sin(t / 700 + i) * 6, y = CORTE.SOLO - 20 - (i % 3) * 14 + Math.sin(t / 900 + i * 2) * 3;
            cctx.fillStyle = `rgba(165,190,70,${0.16 + 0.07 * (i % 3)})`; cctx.beginPath(); cctx.ellipse(x, y, 34, 14, 0, 0, Math.PI * 2); cctx.fill();
        }
    } else {
        const pulso = 0.5 + 0.5 * Math.sin(t / 350);
        cctx.fillStyle = `rgba(150,175,60,${0.12 + 0.05 * pulso})`; cctx.fillRect(0, 0, CORTE.W, CORTE.H);
        for (let i = 0; i < 7; i++) { cctx.fillStyle = 'rgba(190,210,90,0.10)'; cctx.beginPath(); cctx.ellipse(((i * 61 + t / 25) % 460) - 30, 150 + ((i * 53) % 230) + Math.sin(t / 600 + i) * 8, 40, 16, 0, 0, Math.PI * 2); cctx.fill(); }
        if (g.mascaras) txtC(200, CORTE.SOLO + 10, '😷 MÁSCARAS VESTIDAS', '#c8e06a', 9, 700, 'center', 10);
    }
};
// Botão "Máscaras" (aparece no aviso e enquanto o gás dura) e faixa de aviso do gás
let btnMascaras = null;
function renderBotaoMascaras() {
    if (!btnMascaras) {
        const ref = document.getElementById('btn-cb-corte');
        if (!ref || !ref.parentElement) return;
        btnMascaras = document.createElement('button');
        btnMascaras.id = 'btn-mascaras-corte'; btnMascaras.type = 'button'; btnMascaras.onclick = vestirMascaras;
        ref.parentElement.appendChild(btnMascaras);
    }
    const g = gameState.gas;
    if (!g || g.mascaras || gameEnded) { btnMascaras.className = 'hidden'; return; }
    const c = custo(GAS.MASCARA_CUSTO), pode = gameState.prestige >= c;
    const txt = pode ? `😷 MÁSCARAS ${c}` : `😷 faltam ${c - Math.floor(gameState.prestige)}`;
    if (btnMascaras.textContent !== txt) btnMascaras.textContent = txt;
    const cls = 'absolute right-1.5 top-10 z-30 px-2 h-7 rounded border-2 font-bold text-[11px] whitespace-nowrap shadow-2xl ' + (pode ? 'bg-lime-800 border-lime-300 text-white animate-pulse' : 'bg-black/85 border-mil-border text-mil-textMuted opacity-80');
    if (btnMascaras.className !== cls) btnMascaras.className = cls;
    btnMascaras.disabled = !pode;
}
const _o8_renderCorte = renderCorte;
renderCorte = function (forcar) {
    _o8_renderCorte(forcar);
    renderBotaoMascaras();
    const g = gameState.gas;
    if (g) {
        const b = document.getElementById('corte-banner'), txt = g.ticks > 0 ? `☣ GÁS EM ${seg(g.ticks)}s · ${g.mascaras ? 'MÁSCARAS VESTIDAS' : 'VISTAM AS MÁSCARAS OU ABRIGO'}` : `☣ NUVEM DE GÁS · ${seg(g.dur)}s${g.mascaras ? ' · máscaras' : ''}`;
        b.classList.remove('hidden'); if (b.textContent !== txt) b.textContent = txt;
    }
};
