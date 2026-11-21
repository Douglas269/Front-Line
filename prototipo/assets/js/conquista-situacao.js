/* ---------- Conquista: painel "Situação" ----------
   Resume quem está ganhando e por quê: território (com ritmo e estimativa), força militar, economia, onde você está
   em risco e onde há chance de atacar. Só mostra o que o jogador pode saber: tropa inimiga fora de visão (e sem espião) aparece
   como "+" (pelo menos o que se viu), nunca o número verdadeiro. */
const SIT_HIST = 8;
function registrarHistoricoSituacao() {
    if (!G || G.cliente) return;
    G.histPlacar = (G.histPlacar || []).concat({ t: G.t, pl: Object.assign({}, placar()) }).slice(-SIT_HIST);
}
const _cicloEconomiaSit = cicloEconomia;
cicloEconomia = function () { _cicloEconomiaSit(); try { registrarHistoricoSituacao(); } catch (e) {} };

// "Poder" de uma tropa em soldados de infantaria: tipo e vida restante contam
const poderDeSoldado = (s) => { const T = TROPAS[s.tipo || 'inf'] || TROPAS.inf; return Math.max(0, s.vida) / T.vida * (T.atq + T.def + T.corpo) / 3; };
const poderDeLista = (exs) => exs.reduce((t, e) => t + e.s.reduce((u, s) => u + poderDeSoldado(s), 0), 0);

// Tropa conhecida de um país: tudo se for o jogador ou se há espião; senão só os exércitos à vista
function forcaConhecida(dono) {
    const todos = exDe(dono), vistos = dono === 'jogador' || espiado(dono) ? todos : todos.filter(exVisivel);
    return { soldados: vistos.reduce((t, e) => t + e.s.length, 0), poder: poderDeLista(vistos), completo: vistos.length === todos.length };
}
function saldosCiclo() {
    const tropa = tropaDe('jogador'), porcao = temPesq('jogador', 'racoes') ? 0.7 : 1;
    return {
        comida: rendaDe('jogador', 'comida') - tropa / (C.COME_ALIVIA / C.FOME_CICLO) * porcao,
        moedas: rendaDe('jogador', 'moedas') - manutencaoDe('jogador')
    };
}
// Ritmo de províncias por ciclo (últimas amostras) e o que isso dá no fim do tempo
function tendenciaDe(dono) {
    const h = G.histPlacar || []; if (h.length < 2) return null;
    const a = h[Math.max(0, h.length - 5)], b = h[h.length - 1], ciclos = Math.max(1, (b.t - a.t) / C.CICLO);
    return ((b.pl[dono] || 0) - (a.pl[dono] || 0)) / ciclos;
}
function projecaoDe(dono) {
    const tend = tendenciaDe(dono), agora = placar()[dono] || 0, total = Object.keys(G.prov).length;
    if (tend === null) return null;
    const ciclosRest = Math.max(0, (G.fase.tempo - G.t) / C.CICLO);
    return Math.max(0, Math.min(total, Math.round(agora + tend * ciclosRest)));
}

// Províncias suas na fronteira com quem está em guerra (risco) e vizinhas à vista que dá para atacar (chance)
function riscosEChances() {
    const riscos = [], chances = [];
    const hostil = (dono) => dono !== 'jogador' && emGuerra('jogador', dono);
    provDe('jogador').forEach(p => {
        const vizHost = p.viz.map(v => G.prov[v]).filter(q => hostil(q.dono));
        if (!vizHost.length) return;
        const meus = poderDeLista(exParadosEm(p.id, 'jogador'));
        const perto = poderDeLista(G.ex.filter(e => hostil(e.dono) && exVisivel(e) && (p.viz.includes(e.prov) || (e.rota.length && e.rota[e.rota.length - 1] === p.id)) ));
        const trinch = Math.round(p.trinch || 0);
        const nivel = meus < 1 ? 2 : (perto > meus * 0.8 ? 2 : (perto > 0 || meus < 3 ? 1 : 0));
        riscos.push({ id: p.id, nome: p.nome, meus, perto, trinch, nivel, capital: !!p.capital });
    });
    riscos.sort((a, b) => b.nivel - a.nivel || (b.capital - a.capital));
    const meusPerto = (q) => q.viz.map(v => G.prov[v]).filter(v => v.dono === 'jogador').reduce((t, v) => t + poderDeLista(exParadosEm(v.id, 'jogador')), 0);
    Object.values(G.prov).filter(q => q.dono !== 'jogador' && q.viz.some(v => G.prov[v].dono === 'jogador') && provVisivel(q.id)).forEach(q => {
        if (q.dono !== 'neutro' && !emGuerra('jogador', q.dono)) return;
        const defs = poderDeLista(exParadosEm(q.id, q.dono)), meu = meusPerto(q), forte = (1 + (q.trinch || 0) / 100 * 0.6) * (q.obras && q.obras.forte ? 1.25 : 1) * (q.capital ? 1.5 : 1);
        chances.push({ id: q.id, nome: q.nome, dono: q.dono, defs, meu, ok: meu >= Math.max(2, defs * forte * 1.4), capital: !!q.capital });
    });
    chances.sort((a, b) => (b.ok - a.ok) || (a.defs - b.defs));
    return { riscos, chances };
}

// Ataques a caminho de uma província sua, só de exércitos que o jogador já vê (ou que um espião mostra): quem, quantos, quando chega
function ataquesACaminho() {
    if (!G || G.cliente) return [];
    return G.ex.filter(e => e.dono !== 'jogador' && e.dono !== 'neutro' && e.rota.length && !e.emBatalha && emGuerra('jogador', e.dono) && exVisivel(e)).map(e => {
        const idx = e.rota.findIndex(id => G.prov[id].dono === 'jogador'); if (idx < 0) return null;
        const alvo = G.prov[e.rota[idx]]; let d = 0, x = e.x, y = e.y;
        for (let i = 0; i <= idx; i++) { const q = G.prov[e.rota[i]]; d += Math.hypot(q.x - x, q.y - y); x = q.x; y = q.y; }
        return { id: e.id, dono: e.dono, n: e.s.length, poder: Math.round(poderDeLista([e])), alvo, eta: Math.max(1, Math.ceil(d / Math.max(0.1, velEx(e)))), meus: Math.round(poderDeLista(exParadosEm(alvo.id, 'jogador'))) };
    }).filter(Boolean).sort((a, b) => a.eta - b.eta);
}
function textoAtaque(a) { return `${FACCOES[a.dono].nome} (${a.n} soldados, poder ${a.poder}) chega em ${a.alvo.nome} em ~${a.eta}s · sua defesa ${a.meus}`; }
// Faixa fixa no mapa: some quando não há ataque; tocar nela leva à província ameaçada
function atualizarAlertaAtaque() {
    let el = document.getElementById('alertaAtq');
    if (!el) { const box = document.getElementById('mapaBox'); if (!box) return; el = document.createElement('button'); el.id = 'alertaAtq'; el.type = 'button'; box.appendChild(el); }
    const lista = G && !G.fim ? ataquesACaminho() : [];
    if (!lista.length) { el.style.display = 'none'; el.dataset.alvo = ''; return; }
    const a = lista[0], risco = a.poder > a.meus * 0.8;
    el.style.display = 'block'; el.dataset.alvo = a.alvo.id; el.className = risco ? 'perigo' : '';
    el.textContent = `${risco ? '▼' : '■'} ${lista.length > 1 ? lista.length + ' ataques a caminho · ' : ''}${textoAtaque(a)} · toque para ver`;
    el.onclick = () => { irParaProvincia(a.alvo.id); try { centralizar(a.alvo.x, a.alvo.y); } catch (e) {} };
}
setInterval(() => { try { atualizarAlertaAtaque(); } catch (e) {} }, 500);

function painelSituacao() {
    try {
        const pl = placar(), total = Object.keys(G.prov).length, donos = ['jogador'].concat(G.fase.bots.filter(b => !G.eliminados[b]));
        const restoSeg = Math.max(0, G.fase.tempo - G.t), min = Math.floor(restoSeg / 60), seg = Math.floor(restoSeg % 60);
        const meu = pl.jogador || 0, lider = donos.slice().sort((a, b) => (pl[b] || 0) - (pl[a] || 0))[0];
        const seta = (v) => v === null ? '' : v > 0.05 ? ' <b style="color:#9fd08f">▲</b>' : v < -0.05 ? ' <b style="color:#ff8a7a">▼</b>' : ' <b style="color:#9aa">■</b>';
        const linhas = donos.map(d => {
            const f = forcaConhecida(d), tend = tendenciaDe(d), cor = FACCOES[d].cor;
            return `<div class="sit-l"><span><i class="sit-ponto" style="background:${cor}"></i>${FACCOES[d].nome}${d === lider ? ' 👑' : ''}</span><span>${pl[d] || 0}/${total}${seta(tend)}</span><span>${f.soldados}${f.completo ? '' : '+'}</span><span>${f.completo ? Math.round(f.poder) : '≥' + Math.round(f.poder)}</span></div>`;
        }).join('');
        const projM = projecaoDe('jogador'), projB = Math.max(0, ...donos.filter(d => d !== 'jogador').map(d => projecaoDe(d) || 0));
        const veredito = meu > Math.max(0, ...donos.filter(d => d !== 'jogador').map(d => pl[d] || 0)) ? { t: 'Você lidera em território.', c: '#9fd08f', s: '▲' } : { t: `${FACCOES[lider].nome} lidera em território.`, c: '#ff8a7a', s: '▼' };
        const proj = projM === null ? 'Ainda juntando dados (alguns ciclos).' : `Se o ritmo continuar: você termina com ~${projM} e o melhor bot com ~${projB} (${projM > projB ? 'vitória por território' : 'não bastaria'}).`;
        const sd = saldosCiclo(), fmt = (v) => (v >= 0 ? '+' : '−') + (Math.round(Math.abs(v) * 10) / 10).toString().replace('.', ',');
        const eco = (ic, v) => `<span style="color:${v < 0 ? '#ff8a7a' : '#9fd08f'}">${v < 0 ? '▼' : '▲'} ${ic} ${fmt(v)}</span>`;
        const rc = riscosEChances();
        const rLinha = (r) => `<div class="sit-r"><span class="sit-t"><span style="color:${r.nivel === 2 ? '#ff8a7a' : r.nivel === 1 ? '#ffd28a' : '#9fd08f'}">${r.nivel === 2 ? '▼' : r.nivel === 1 ? '■' : '●'}</span> <b>${r.nome}</b>${r.capital ? ' (capital)' : ''}: ${r.meus < 1 ? 'sem defesa' : Math.round(r.meus) + ' de poder'}${r.perto > 0 ? ` · inimigo perto ~${Math.round(r.perto)}` : ''} · trincheira ${r.trinch}%</span><button class="mini" onclick="irParaProvincia('${r.id}')">ver</button></div>`;
        const cLinha = (c) => `<div class="sit-r"><span class="sit-t"><span style="color:${c.ok ? '#9fd08f' : '#9aa'}">${c.ok ? '▲' : '●'}</span> <b>${c.nome}</b> (${c.dono === 'neutro' ? 'milícia' : FACCOES[c.dono].nome}${c.capital ? ', capital' : ''}): defesa ~${Math.round(c.defs)} · você ao lado ${Math.round(c.meu)}${c.ok ? ' <b style="color:#9fd08f">dá para atacar</b>' : ''}</span><button class="mini" onclick="irParaProvincia('${c.id}')">ver</button></div>`;
        const riscosAlto = rc.riscos.filter(r => r.nivel > 0).slice(0, 4), chancesTop = rc.chances.slice(0, 4);
        return `<div class="titulo"><span>📊 Situação</span><span class="dono">${min}:${String(seg).padStart(2, '0')} restantes</span></div>
        <div class="info" style="color:${veredito.c}"><b>${veredito.s} ${veredito.t}</b> ${proj}</div>
        <div class="sit"><div class="sit-h"><span></span><span>Províncias</span><span>Soldados</span><span>Poder</span></div>${linhas}</div>
        <div class="info">Economia por ciclo: ${eco('🍞', sd.comida)} · ${eco('🪙', sd.moedas)}${sd.comida < 0 || sd.moedas < 0 ? ' · <b style="color:#ffb36b">saldo negativo: a tropa passa fome ou o soldo atrasa</b>' : ''}</div>
        ${ataquesACaminho().length ? `<div class="info"><b>⚠ Ataques a caminho</b></div>${ataquesACaminho().slice(0, 4).map(a => `<div class="sit-r"><span class="sit-t"><span style="color:${a.poder > a.meus * 0.8 ? '#ff8a7a' : '#ffd28a'}">${a.poder > a.meus * 0.8 ? '▼' : '■'}</span> ${textoAtaque(a)}</span><button class="mini" onclick="irParaProvincia('${a.alvo.id}')">ver</button></div>`).join('')}` : ''}
        <div class="info"><b>Onde você está em risco</b> (fronteira com quem está em guerra)</div>
        ${riscosAlto.length ? riscosAlto.map(rLinha).join('') : '<div class="info">● Nenhuma fronteira ameaçada agora.</div>'}
        <div class="info"><b>Chances de ataque</b> (vizinhas à vista)</div>
        ${chancesTop.length ? chancesTop.map(cLinha).join('') : '<div class="info">Nada à vista. Mande um espião para ver mais longe.</div>'}
        <div class="info" style="font-size:11px">Poder = soldados de infantaria equivalentes (tipo e vida contam). "+" = pelo menos o que você viu; um espião mostra tudo.</div>
        <div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`;
    } catch (e) { return `<div class="titulo"><span>📊 Situação</span></div><div class="info">Indisponível agora.</div><div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`; }
}
function irParaProvincia(id) { if (!G || !G.prov[id]) return; G.sel = { tipo: 'prov', id }; G.modo = null; G.pendente = null; renderPainel(); }
function abrirSituacao() { if (!G) return; G.sel = { tipo: 'situacao' }; G.pendente = null; G.modo = null; renderPainel(); }
