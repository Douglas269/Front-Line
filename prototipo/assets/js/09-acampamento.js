// FrontLine · Trincheiras: acampamento à noite
// Carregado depois de 08-campo-ameacas.js. Quando a noite começa e o setor está calmo, o relógio para e o esquadrão
// pode gastar "pontos de acampamento" em tarefas (rancho, curativos, cartas, armas, trincheira, sono) e decidir um
// pequeno evento do dia. Depois de encerrar o acampamento, o tempo volta a correr. Vale uma vez por noite.

const ACAMP = { DIA_MIN: 2, INICIO: 120, FIM: 170, PONTOS: 2, PONTOS_ABRIGO: 1, ARMAS_ACERTO: 1.08, ARMAS_DURA: 300 };
const acampDe = () => gameState.acamp || (gameState.acamp = { dia: 0, aberto: false, feitas: {}, pontos: 0, evento: null, armasAte: 0 });
const vivosAcamp = () => gameState.squad.filter(s => s.hp > 0 && !s.deserted);
const custoRancho = () => Math.max(2, Math.round(vivosAcamp().length * 0.5 * (typeof obraFeita === 'function' && obraFeita('cozinha') ? 0.8 : 1)));
const maisFerido = () => vivosAcamp().filter(s => s.hp < 90).sort((a, b) => a.hp - b.hp)[0] || null;
const sortearDoDia = (lista, n) => lista[Math.floor(rngSemente32((gameState.day * 7919) ^ ((opAtual().semente) || 0) ^ n)() * lista.length)];

const ACAMP_TAREFAS = {
    rancho: { icone: '🍲', nome: 'Rancho quente', desc: () => `todos: +8 de moral e −15 de fome · gasta ${custoRancho()} rações`,
        pode: () => gameState.resources.rations >= custoRancho(),
        faz: () => { gameState.resources.rations -= custoRancho(); vivosAcamp().forEach(s => { s.hunger = Math.max(0, s.hunger - 15); s.moral = Math.min(100, s.moral + 8); }); logFeed('🍲 Rancho quente à luz do fogareiro: o esquadrão comeu e relaxou.', 'text-mil-greenMuted'); } },
    curativos: { icone: '🩺', nome: 'Curativos', desc: () => { const f = maisFerido(); return f ? `cura ${f.rank} ${f.name} (+${typeof obraFeita === 'function' && obraFeita('enfermaria') ? 45 : 35} de vida) · gasta 1 kit médico` : 'ninguém ferido'; },
        pode: () => gameState.resources.medkits >= 1 && !!maisFerido(),
        faz: () => { const f = maisFerido(), cura = typeof obraFeita === 'function' && obraFeita('enfermaria') ? 45 : 35; gameState.resources.medkits--; f.hp = Math.min(100, f.hp + cura); logFeed(`🩺 ${f.rank} ${f.name} foi tratado no escuro (+${cura} de vida).`, 'text-mil-greenMuted'); } },
    cartas: { icone: '✉️', nome: 'Cartas para casa', desc: () => 'todos: +6 de moral · uma carta vai para o Diário',
        pode: () => true,
        faz: () => { vivosAcamp().forEach(s => { s.moral = Math.min(100, s.moral + 6); }); if (typeof escreverCarta === 'function') escreverCarta(); } },
    armas: { icone: '🔧', nome: 'Limpar as armas', desc: () => '+8% de acerto até a noite seguinte',
        pode: () => true,
        faz: () => { acampDe().armasAte = tempoDeJogo() + ACAMP.ARMAS_DURA; logFeed('🔧 Armas limpas e engraxadas: tiros mais certeiros até a próxima noite.', 'text-mil-greenMuted'); } },
    trincheira: { icone: '🧱', nome: 'Reforçar a trincheira', desc: () => '+8% de conservação · cansa o esquadrão (+6 de fadiga)',
        pode: () => gameState.trench < 100,
        faz: () => { gameState.trench = Math.min(100, gameState.trench + 8); vivosAcamp().forEach(s => { s.fatigue = Math.min(100, s.fatigue + 6); }); logFeed('🧱 Sacos de areia empilhados à luz da lua: a trincheira ficou mais firme.', 'text-mil-greenMuted'); } },
    sono: { icone: '🛌', nome: 'Dormir cedo', desc: () => 'todos: −25 de fadiga e +5 de vida',
        pode: () => true,
        faz: () => { vivosAcamp().forEach(s => { s.fatigue = Math.max(0, s.fatigue - 25); s.hp = Math.min(100, s.hp + 5); }); logFeed('🛌 O esquadrão dormiu cedo e acordou com o corpo menos pesado.', 'text-mil-greenMuted'); } }
};

// Pequenas histórias da noite: duas escolhas, sem custo de ponto. O sorteio é fixo por dia (o Desafio do dia é igual para todos).
const ACAMP_EVENTOS = [
    { id: 'garrafa', texto: (s) => `${s.rank} ${s.name} achou uma garrafa de aguardente num caixote velho. Ninguém sabe de quem era.`,
      opcoes: [
        { t: 'Dividir com o esquadrão (+5 de moral para todos, −8 de prestígio pela indisciplina)', f: (s) => { vivosAcamp().forEach(x => { x.moral = Math.min(100, x.moral + 5); }); gameState.prestige = Math.max(0, gameState.prestige - 8); return 'A garrafa correu de mão em mão. Riram baixo, como se a guerra tivesse ficado do outro lado do arame.'; } },
        { t: 'Confiscar e entregar ao oficial (+10 de prestígio, −6 de moral de quem achou)', f: (s) => { gameState.prestige += 10; s.moral = Math.max(0, s.moral - 6); return `${s.name} entregou a garrafa sem dizer nada. O oficial anotou o nome dele.`; } }] },
    { id: 'saudade', texto: (s) => `${s.rank} ${s.name} está olhando uma fotografia e quase não fala desde o jantar.`,
      opcoes: [
        { t: 'Sentar com ele a noite toda (+20 de moral dele, +8 de fadiga dele)', f: (s) => { s.moral = Math.min(100, s.moral + 20); s.fatigue = Math.min(100, s.fatigue + 8); return `${s.name} falou da casa, da mãe, do cheiro do café. Dormiu melhor do que em semanas.`; } },
        { t: 'Deixar quieto', f: (s) => { s.moral = Math.max(0, s.moral - 3); return `${s.name} guardou a foto no bolso e virou para a parede.`; } }] },
    { id: 'municao', texto: () => 'Do posto de vigília dá para ver caixas de munição abandonadas na terra de ninguém, perto do arame.',
      opcoes: [
        { t: 'Mandar buscar no escuro (+60 de munição leve; 25% de risco: alguém leva um tiro, −25 de vida)', f: () => {
            const s = sortearDoDia(vivosAcamp(), 77); addAmmoRifle(60);
            if (Math.random() < 0.25 && s) { s.hp = Math.max(1, s.hp - 25); return `Trouxeram as caixas, mas ${s.name} foi atingido na volta (−25 de vida).`; }
            return 'Foram e voltaram sem um ruído. As caixas estavam intactas.'; } },
        { t: 'Não vale o risco', f: () => 'O esquadrão decidiu esperar o comboio. A noite passou calma.' }] },
    { id: 'musica', texto: () => 'O rádio pegou, por alguns minutos, uma música de casa no meio do chiado.',
      opcoes: [
        { t: 'Deixar tocar baixinho (+4 de moral para todos)', f: () => { vivosAcamp().forEach(x => { x.moral = Math.min(100, x.moral + 4); }); return 'Ninguém falou nada até a música acabar.'; } },
        { t: 'Desligar: pode ser armadilha (+6 de prestígio)', f: () => { gameState.prestige += 6; return 'O rádio voltou ao chiado. A disciplina foi mantida.'; } }] }
];

let acampTimerFim = null;
function acampamentoModal() {
    let m = document.getElementById('modal-acampamento');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'modal-acampamento'; m.className = 'hidden absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4';
    m.innerHTML = '<div id="acamp-caixa" class="bg-mil-panel border-2 border-mil-amberMuted rounded p-4 max-w-sm w-full max-h-[92vh] overflow-y-auto space-y-3 shadow-2xl"></div>';
    const ref = document.getElementById('modal-crisis');
    (ref && ref.parentElement ? ref.parentElement : document.body).appendChild(m);
    return m;
}
function abrirAcampamento() {
    const a = acampDe();
    if (!a.aberto) {
        a.aberto = true; a.feitas = {}; a.pontos = ACAMP.PONTOS + (typeof obraFeita === 'function' && obraFeita('abrigo') ? ACAMP.PONTOS_ABRIGO : 0);
        const vivos = vivosAcamp(), sd = sortearDoDia(vivos, 5);
        const ev = sortearDoDia(ACAMP_EVENTOS, 11);
        a.evento = { id: ev.id, sid: sd ? sd.id : 0, resolvido: false, resultado: '' };
        logFeed(`🔥 ACAMPAMENTO: a noite caiu e o front esfriou. O esquadrão pode cuidar de ${a.pontos} coisas antes de dormir.`, 'text-mil-amberMuted font-bold');
        playTacticalBeep(440, 0.12);
    }
    if (typeof velocidadeRapida !== 'undefined' && velocidadeRapida) { velocidadeRapida = false; if (typeof atualizarBotaoRapido === 'function') atualizarBotaoRapido(); }
    gameState.activeCrisis = { id: 'acampamento', ctx: {} }; // o relógio para enquanto o acampamento está aberto
    renderAcampamento();
    acampamentoModal().classList.remove('hidden');
}
function renderAcampamento() {
    const a = acampDe(), caixa = document.getElementById('acamp-caixa') || (acampamentoModal(), document.getElementById('acamp-caixa'));
    const botao = 'w-full py-2 px-2 bg-mil-bg border border-mil-border rounded text-left text-xs text-mil-textGlow transition';
    const soldados = vivosAcamp().map(s => `<div class="flex justify-between text-[11px] text-mil-textMuted"><span>${s.rank} ${s.name}</span><span>❤ ${Math.round(s.hp)} · 🙂 ${Math.round(s.moral)} · 💤 ${Math.round(s.fatigue)}</span></div>`).join('');
    const tarefas = Object.entries(ACAMP_TAREFAS).map(([id, T]) => {
        const feita = !!a.feitas[id], ok = !feita && a.pontos > 0 && T.pode();
        return `<button class="${botao} ${feita ? 'opacity-60 border-mil-greenMuted' : ok ? 'hover:border-mil-textGlow' : 'opacity-40'}" ${ok ? '' : 'disabled'} onclick="acampFazer('${id}')">
            <b>${T.icone} ${T.nome}</b>${feita ? ' <span class="text-mil-greenMuted">✔ feito</span>' : ''}<br><span class="text-mil-textMuted">${T.desc()}</span></button>`;
    }).join('');
    let evento = '';
    if (a.evento) {
        const ev = ACAMP_EVENTOS.find(e => e.id === a.evento.id), s = gameState.squad.find(x => x.id === a.evento.sid) || vivosAcamp()[0];
        if (ev && s) evento = a.evento.resolvido
            ? `<div class="border border-mil-border rounded p-2 text-[12px] text-mil-textGlow font-typewriter"><span class="text-mil-amberMuted font-bold">Na fogueira:</span> ${a.evento.resultado}</div>`
            : `<div class="border border-mil-amberMuted rounded p-2 space-y-1.5"><p class="text-[12px] text-mil-textGlow font-typewriter"><span class="text-mil-amberMuted font-bold">Na fogueira:</span> ${ev.texto(s)}</p>
                ${ev.opcoes.map((o, i) => `<button class="${botao} hover:border-mil-textGlow" onclick="acampEvento(${i})">${i + 1}. ${o.t}</button>`).join('')}</div>`;
    }
    caixa.innerHTML = `<div class="flex items-center gap-2 text-mil-amberMuted font-bold border-b border-mil-border pb-2 text-xs"><span class="text-lg">🔥</span><span>ACAMPAMENTO · NOITE DO DIA ${gameState.day}</span></div>
        <p class="text-[12px] text-mil-textGlow leading-relaxed font-typewriter">A noite caiu e o front esfriou. Escolha em que o esquadrão gasta as horas livres. <b class="text-mil-amberMuted">Pontos: ${a.pontos}</b></p>
        <div class="space-y-0.5 border border-mil-border rounded p-2">${soldados}</div>
        <div class="space-y-1.5">${tarefas}</div>${evento}
        <button class="w-full py-2 bg-mil-oliveDark border border-mil-greenMuted rounded text-xs text-mil-textGlow font-bold hover:border-mil-textGlow" onclick="acampEncerrar()">🌙 ENCERRAR O ACAMPAMENTO</button>`;
}
function acampFazer(id) {
    const a = acampDe(), T = ACAMP_TAREFAS[id];
    if (!a.aberto || !T || a.feitas[id] || a.pontos < 1 || !T.pode()) return;
    T.faz(); a.feitas[id] = true; a.pontos--;
    updateUI(); renderAcampamento();
}
function acampEvento(i) {
    const a = acampDe();
    if (!a.aberto || !a.evento || a.evento.resolvido) return;
    const ev = ACAMP_EVENTOS.find(e => e.id === a.evento.id), s = gameState.squad.find(x => x.id === a.evento.sid) || vivosAcamp()[0], op = ev && ev.opcoes[i];
    if (!op || !s) return;
    a.evento.resultado = op.f(s); a.evento.resolvido = true;
    logFeed(`🔥 ${a.evento.resultado}`, 'text-mil-textMuted');
    updateUI(); renderAcampamento();
}
function acampEncerrar() {
    const a = acampDe();
    if (!a.aberto) return;
    const feitas = Object.keys(a.feitas).map(id => ACAMP_TAREFAS[id].nome.toLowerCase());
    a.aberto = false; a.dia = gameState.day;
    gameState.activeCrisis = null;
    acampamentoModal().classList.add('hidden');
    const resumo = `Noite do dia ${gameState.day} no acampamento: ${feitas.length ? feitas.join(', ') : 'o esquadrão só descansou'}${a.evento && a.evento.resolvido ? '. ' + a.evento.resultado : '.'}`;
    addDiaryEntry(resumo);
    logFeed('🌙 O acampamento se apagou. O esquadrão volta aos postos.', 'text-mil-greenMuted');
    updateUI();
    if (!gameEnded) saveGame();
}
// Quando abrir: começo da noite, setor calmo, uma vez por noite. Se o jogo foi recarregado com o acampamento aberto, reabre.
function acampamentoVerificar() {
    if (gameEnded) return;
    const a = acampDe();
    if (a.aberto) { if (!gameState.activeCrisis) abrirAcampamento(); return; }
    const t = gameState.timeSeconds;
    if (gameState.day < ACAMP.DIA_MIN || t < ACAMP.INICIO || t >= ACAMP.FIM || a.dia === gameState.day) return;
    if (!vivosAcamp().length || gameState.enemies.length || gameState.barrage || gameState.gas || gameState.activeCrisis) return;
    abrirAcampamento();
}
const _o9_updateGameTick = updateGameTick;
updateGameTick = function () {
    const antes = gameState.timeSeconds, dia = gameState.day;
    _o9_updateGameTick();
    if (gameState.timeSeconds !== antes || gameState.day !== dia) acampamentoVerificar(); // só quando o relógio andou (não com o jogo pausado, em menu, login ou tutorial)
};
// Armas limpas acertam mais
const _o9_chanceDeAcerto = chanceDeAcerto;
chanceDeAcerto = function (s, arma, enemy, estado) {
    const p = _o9_chanceDeAcerto(s, arma, enemy, estado);
    return tempoDeJogo() <= acampDe().armasAte ? Math.min(0.95, p * ACAMP.ARMAS_ACERTO) : p;
};

// O acampamento é uma "crise especial": entra na mesma lista (o relógio, o salvamento e os testes tratam tudo igual),
// nunca é sorteada sozinha e é aberta na janela própria. Resolver a crise = encerrar o acampamento.
CRISES.acampamento = {
    titulo: 'ACAMPAMENTO', pode: () => false, texto: () => 'A noite caiu e o front esfriou.',
    opcoes: [{ texto: () => 'Encerrar o acampamento', efeito: () => acampEncerrar() }]
};
const _o9_openCrisis = openCrisis;
openCrisis = function (id, ctx) { if (id === 'acampamento') { acampDe().aberto = true; return abrirAcampamento(); } return _o9_openCrisis(id, ctx); };
