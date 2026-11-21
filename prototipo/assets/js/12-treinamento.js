/* ---------- Treinamento com prestígio, avanço 4× e resumo do dia ----------
   O prestígio que sobra vira soldado melhor: Tiro (precisão) e Resistência (recupera vida aos poucos), 3 níveis cada, por soldado.
   O avanço rápido ganha o 4× (só enquanto calmo) e cada dia calmo deixa um resumo no diário. */
const TREINO = {
    tiro:   { nome: 'Tiro', icone: '🎯', base: 80, passo: 50, max: 3, desc: '+7% de precisão por nível' },
    resist: { nome: 'Resistência', icone: '🛡', base: 70, passo: 45, max: 3, regen: 0.25, desc: 'recupera vida aos poucos (+0,25 a cada 10 s por nível)' }
};
const nivelTreino = (s, id) => (s && s.treino && s.treino[id]) || 0;
const custoTreino = (s, id) => custo(TREINO[id].base + TREINO[id].passo * nivelTreino(s, id));
function podeTreinar(s, id) { return s && s.hp > 0 && !s.deserted && nivelTreino(s, id) < TREINO[id].max && gameState.prestige >= custoTreino(s, id) && !gameEnded; }
function treinar(sid, id) {
    const s = gameState.squad.find(x => x.id === sid); if (!s || !TREINO[id] || !podeTreinar(s, id)) return false;
    gameState.prestige -= custoTreino(s, id);
    s.treino = s.treino || { tiro: 0, resist: 0 }; s.treino[id]++;
    logFeed(`${TREINO[id].icone} ${s.rank} ${s.name} treinou ${TREINO[id].nome} (nível ${s.treino[id]}). ${TREINO[id].desc}.`, 'text-mil-greenMuted font-bold');
    try { playTacticalBeep(900, 0.06); } catch (e) {}
    renderTreino(true); try { updateUI(); } catch (e) {}
    return true;
}
// efeitos
const _chanceDeAcertoTr = chanceDeAcerto;
chanceDeAcerto = function (s, arma, enemy, estado = gameState) {
    let p = _chanceDeAcertoTr(s, arma, enemy, estado);
    const n = nivelTreino(s, 'tiro'); if (n) p *= 1 + 0.07 * n;
    return Math.min(0.95, p);
};
const _processSquadNeedsTr = processSquadNeeds;
processSquadNeeds = function () {
    _processSquadNeedsTr();
    if (gameState.timeSeconds % 10 !== 0) return;
    gameState.squad.forEach(s => { const n = nivelTreino(s, 'resist'); if (n && s.hp > 0 && s.hp < 100) s.hp = Math.min(100, s.hp + TREINO.resist.regen * n); });
};
// tela (aba Defesas, abaixo das obras)
let assinaturaTreino = '';
function renderTreino(forcar) {
    let el = document.getElementById('def-treino');
    if (!el) {
        const obras = document.getElementById('def-melhorias'); if (!obras) return;
        el = document.createElement('div'); el.id = 'def-treino'; el.className = 'space-y-1 mt-2';
        obras.parentElement.insertBefore(el, obras.nextSibling);
    }
    const ass = JSON.stringify([gameState.squad.map(s => [s.hp > 0, s.treino]), Math.floor(gameState.prestige / 10)]);
    if (!forcar && ass === assinaturaTreino) return;
    assinaturaTreino = ass;
    const bola = (n, m) => '●'.repeat(n) + '○'.repeat(m - n);
    const botao = (s, id) => {
        const T = TREINO[id], n = nivelTreino(s, id), c = custoTreino(s, id), cheio = n >= T.max;
        return `<button onclick="treinar(${s.id},'${id}')" title="${T.desc}" class="px-2 py-1 btn-tactical rounded text-[11px] ${podeTreinar(s, id) ? '' : 'opacity-50'}" ${podeTreinar(s, id) ? '' : 'disabled'}>${T.icone} ${bola(n, T.max)} ${cheio ? 'máx.' : c + '★'}</button>`;
    };
    el.innerHTML = `<div class="text-xs text-mil-textMuted">TREINAMENTO <span class="normal-case">(gasta prestígio; fica com o soldado)</span></div>` +
        gameState.squad.filter(s => s.hp > 0).map(s => `<div class="flex items-center gap-2 p-1.5 bg-mil-panel border border-mil-border rounded"><b class="flex-1 text-xs">${esc2(s.rank + ' ' + s.name)}</b>${botao(s, 'tiro')}${botao(s, 'resist')}</div>`).join('');
}
const _renderMelhoriasTr = renderMelhorias;
renderMelhorias = function (forcar) { _renderMelhoriasTr(forcar); try { renderTreino(forcar); } catch (e) {} };

/* ---------- Avanço 4× (só calmo) ---------- */
let fatorRapido = 2;
function alternarRapido4() {
    if (!velocidadeRapida) return;
    fatorRapido = fatorRapido === 4 ? 2 : 4; atualizarBotaoRapido4();
    try { playTacticalBeep(fatorRapido === 4 ? 1100 : 950, 0.03); } catch (e) {}
}
function atualizarBotaoRapido4() {
    let b = document.getElementById('btn-rapido4');
    if (!b) {
        const ref = document.getElementById('btn-rapido'); if (!ref) return;
        b = document.createElement('button'); b.id = 'btn-rapido4'; b.type = 'button'; b.onclick = alternarRapido4;
        b.className = 'hidden px-2 min-h-[34px] btn-tactical rounded font-bold text-xs'; b.title = 'Alternar entre 2× e 4× enquanto está calmo';
        ref.parentElement.insertBefore(b, ref.nextSibling);
    }
    b.classList.toggle('hidden', !velocidadeRapida);
    b.textContent = fatorRapido === 4 ? '4×' : '→4×';
    b.classList.toggle('btn-active-order', fatorRapido === 4);
}
const _passoDoRelogioTr = passoDoRelogio;
passoDoRelogio = function () {
    _passoDoRelogioTr();
    if (velocidadeRapida && fatorRapido === 4) { for (let i = 0; i < 2; i++) { if (velocidadeRapida && momentoCalmo() && !jogoPausado) updateGameTick(); } }
    atualizarBotaoRapido4();
};

/* ---------- Resumo do dia ---------- */
const _onNewDayTr = onNewDay;
onNewDay = function () {
    const h = gameState.hist || [], antes = h[h.length - 1];
    _onNewDayTr();
    try {
        const agora = (gameState.hist || [])[(gameState.hist || []).length - 1];
        if (antes && agora && agora.dia === gameState.day && antes.dia === gameState.day - 1) {
            const d = (a, b) => (b - a >= 0 ? '+' : '−') + Math.abs(b - a);
            addDiaryEntry(`Resumo do dia ${antes.dia}: prestígio ${d(antes.pr || 0, agora.pr || 0)}, ração ${d(antes.ra, agora.ra)}, água ${d(antes.ag, agora.ag)}, munição leve ${d(antes.mL, agora.mL)}, trincheira em ${agora.tr}%, ${agora.vivos} soldados de pé.`);
        }
    } catch (e) {}
};
