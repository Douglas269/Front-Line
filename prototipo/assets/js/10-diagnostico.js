/* ---------- Histórico da partida e tela "por que perdi" ----------
   Guarda um retrato por dia (recursos, trincheira, vivos) e a causa de cada morte.
   No fim da partida mostra a causa principal, uma linha do tempo curta e dicas ligadas ao que aconteceu. */
const HIST_MAX = 40;
const CAUSAS = {
    'fome e sede': { icone: '🍲', dica: 'Mande à cozinha quem passa de 40 de fome ou sede e ligue a escala automática (Ordens permanentes) para ninguém ficar sem comer.' },
    'gás': { icone: '☣', dica: 'Quando o rádio avisar o ataque químico, aperte Máscaras (ou use Abrigo) antes da nuvem chegar.' },
    'lança-chamas': { icone: '🔥', dica: 'O lança-chamas precisa cair antes de chegar perto: use Supressão, a metralhadora ou o anticarro enquanto ele se aproxima.' },
    'artilharia': { icone: '💥', dica: 'Use Abrigo quando o rádio avisar o bombardeio; a contra-bateria e o drone ajudam a reduzir o estrago.' },
    'combate': { icone: '⚔', dica: 'Mantenha a trincheira acima de 70% (Engenheiro reparando) e 3 vigias nas horas de ataque; descanse em revezamento para a mira não cair.' }
};

function registrarRetratoDoDia() {
    const r = gameState.resources;
    gameState.hist = gameState.hist || [];
    gameState.hist.push({
        dia: gameState.day, ra: Math.round(r.rations), ag: Math.round(r.water), mL: Math.round(r.ammoRifle), mP: Math.round(r.ammoHeavy),
        tr: Math.round(gameState.trench), pr: Math.round(gameState.prestige), vivos: gameState.squad.filter(s => s.hp > 0).length
    });
    if (gameState.hist.length > HIST_MAX) gameState.hist.shift();
}
const _onNewDayDiag = onNewDay;
onNewDay = function () { _onNewDayDiag(); try { registrarRetratoDoDia(); } catch (e) {} };

// Quem morreu, quando e (o melhor palpite de) por quê: olha a situação no momento da morte
function causaDaMorte(s) {
    if (s.hunger >= 75 || s.thirst >= 75) return 'fome e sede';
    if (gameState.gas && !gameState.gas.mascaras && gameState.gas.ticks <= 0) return 'gás';
    if (gameState.enemies.some(e => e.type === 'sapador' && e.distance < 90)) return 'lança-chamas';
    if (gameState.barrage || (gameState.combate && gameState.combate.artilharia)) return 'artilharia';
    return 'combate';
}
const _processSquadNeedsDiag = processSquadNeeds;
processSquadNeeds = function () {
    _processSquadNeedsDiag();
    gameState.squad.forEach(s => {
        if (s.hp > 0 || s.mortoRegistrado) return;
        s.mortoRegistrado = true;
        gameState.mortes = gameState.mortes || [];
        gameState.mortes.push({ dia: gameState.day, nome: (s.rank ? s.rank + ' ' : '') + s.name, causa: causaDaMorte(s) });
    });
};

// Primeiro dia em que cada recurso ficou crítico
function diasCriticos() {
    const h = gameState.hist || [], achou = (f) => { const x = h.find(f); return x ? x.dia : null; };
    return {
        municao: achou(x => x.mL < 80 && x.mP < 15),
        comida: achou(x => x.ra < 6 || x.ag < 6),
        trincheira: achou(x => x.tr < 35)
    };
}

function diagnosticoPartida() {
    const mortes = gameState.mortes || [], venceu = gameState.day > GAME_CONFIG.TOTAL_DAYS;
    const crit = diasCriticos(), contagem = {};
    mortes.forEach(m => { contagem[m.causa] = (contagem[m.causa] || 0) + 1; });
    const principal = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0] || null;
    const linhas = [];
    if (crit.municao) linhas.push(`Dia ${crit.municao}: a munição ficou perigosamente baixa.`);
    if (crit.comida) linhas.push(`Dia ${crit.comida}: ração ou água quase no fim.`);
    if (crit.trincheira) linhas.push(`Dia ${crit.trincheira}: a trincheira caiu abaixo de 35%.`);
    mortes.slice(0, 4).forEach(m => linhas.push(`Dia ${m.dia}: ${m.nome} morreu (${m.causa}).`));
    const dicas = [];
    if (!venceu && principal) dicas.push(CAUSAS[principal].dica);
    if (crit.municao) dicas.push('Munição curta: use Economizar nos momentos calmos, peça reabastecimento antes de zerar e deixe o fogo pesado para os alvos grandes.');
    if (crit.comida && principal !== 'fome e sede') dicas.push('Ração ou água no fim: a cozinha de campanha gasta menos e o comboio chega a cada 2 dias, então guarde um estoque para a espera.');
    if (crit.trincheira && principal !== 'combate') dicas.push('A trincheira caiu muito: deixe o Engenheiro na Manutenção e construa Sacos de areia no Quartel de obras.');
    return { venceu, principal, contagem, linhas: linhas.slice(0, 6), dicas: dicas.slice(0, 3), mortes: mortes.length };
}

function diagnosticoHTML() {
    const d = diagnosticoPartida();
    const item = (t) => `<li class="mb-0.5">${escHtml(t)}</li>`;
    if (d.venceu) {
        const sobreviveu = gameState.squad.filter(s => s.hp > 0).length;
        return `<div class="bg-mil-panel border border-mil-border rounded p-2 mb-2 text-left"><div class="font-bold text-mil-greenMuted mb-1">COMO VOCÊ SEGUROU</div>
            <div class="text-mil-textMuted">${sobreviveu} de ${gameState.squad.length} sobreviveram${d.mortes ? ` · ${d.mortes} baixa(s)` : ''}.${d.dicas.length ? ' Para o próximo nível: ' + escHtml(d.dicas[0]) : ''}</div></div>`;
    }
    const causa = d.principal ? `${CAUSAS[d.principal].icone} ${d.principal}` : 'o esquadrão abandonou a posição';
    return `<div id="diagnostico" class="bg-mil-panel border border-red-900 rounded p-2 mb-2 text-left">
        <div class="font-bold text-red-400 mb-1">POR QUE A POSIÇÃO CAIU</div>
        <div class="text-mil-textGlow mb-1">Causa principal: <b>${escHtml(causa)}</b>${d.mortes ? ` (${d.mortes} baixa${d.mortes > 1 ? 's' : ''})` : ''}</div>
        ${d.linhas.length ? `<ul class="text-mil-textMuted list-none pl-0 mb-1">${d.linhas.map(item).join('')}</ul>` : ''}
        ${d.dicas.length ? `<div class="text-mil-amberMuted font-bold">Para a próxima:</div><ul class="text-mil-amberMuted list-none pl-0">${d.dicas.map(t => '<li class="mb-0.5">▸ ' + escHtml(t) + '</li>').join('')}</ul>` : ''}
    </div>`;
}
const _relatorioFinalDiag = relatorioFinal;
relatorioFinal = function () { let h = ''; try { h = diagnosticoHTML(); } catch (e) {} return h + _relatorioFinalDiag(); };
