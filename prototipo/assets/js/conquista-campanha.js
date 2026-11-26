// FrontLine · Conquista: motivo para continuar a campanha (carregado depois de conquista-guerra.js)
// Reforços permanentes escolhidos a cada fase vencida e os sistemas liberados aos poucos.

/* ---------- Reforços: vencer uma fase pela primeira vez dá 1 de 3 (cada um com vantagem ▲ e preço ▼) ---------- */
const REFORCOS_CQ = {
    calejados:   { nome: 'Tropa calejada', icone: '🎖', mais: 'seus soldados começam a fase como veteranos', menos: 'começa com 2 soldados a menos' },
    artilheiros: { nome: 'Escola de artilharia', icone: '💥', mais: 'a artilharia na batalha custa 30 de munição', menos: 'começa com 40 de munição a menos', artBarata: 10 },
    engenharia:  { nome: 'Corpo de engenharia', icone: '🏗', mais: 'obras 35% mais rápidas', menos: 'começa com 15 moedas a menos' },
    siderurgia:  { nome: 'Siderurgia', icone: '⚙', mais: '+30% de aço por ciclo e +10 no começo', menos: 'campos rendem 10% menos comida', prod: { aco: 1.3, comida: 0.9 } },
    intendencia: { nome: 'Intendência', icone: '📦', mais: '+40 moedas e +25 de comida no começo', menos: 'começa com 8 de aço a menos' },
    motorizada:  { nome: 'Coluna motorizada', icone: '🚚', mais: 'exércitos 12% mais rápidos', menos: 'começa com 10 de combustível e 10 de comida a menos', vel: 1.12 },
    voluntarios: { nome: 'Voluntários', icone: '🙋', mais: '+3 soldados na capital', menos: 'começa com 25 de comida a menos' },
    bastiao:     { nome: 'Bastião', icone: '🛡', mais: 'a capital começa com a trincheira cheia e um forte', menos: 'começa com 20 moedas a menos' },
    celeiro:     { nome: 'Celeiro cheio', icone: '🌾', mais: '+15% de comida por ciclo', menos: '15% menos munição por ciclo', prod: { comida: 1.15, mun: 0.85 } }
};
const reforcosAtivos = () => (G && !G.online && !G.cliente && G.reforcos) || [];
function bonusReforco(dono, chave) { return dono !== 'jogador' ? 0 : reforcosAtivos().reduce((t, id) => t + ((REFORCOS_CQ[id] || {})[chave] || 0), 0); }
function aplicarReforcosNoComeco() {
    const f = G.fac.jogador, tem = (id) => G.reforcos.includes(id), menos = (k, v) => { f[k] = Math.max(0, f[k] - v); };
    const cap = G.prov[G.capitalJogador], exCap = () => exParadosEm(cap.id, 'jogador')[0];
    if (tem('calejados')) { const e = exCap(); if (e) e.s.splice(-2, 2); exDe('jogador').forEach(x => x.s.forEach(s => { s.lutas = 2; })); }
    if (tem('artilheiros')) menos('mun', 40);
    if (tem('engenharia')) menos('moedas', 15);
    if (tem('siderurgia')) f.aco += 10;
    if (tem('intendencia')) { f.moedas += 40; f.comida += 25; menos('aco', 8); }
    if (tem('motorizada')) { menos('comb', 10); menos('comida', 10); }
    if (tem('voluntarios')) { const e = exCap(); for (let i = 0; i < 3 && e; i++) e.s.push(soldado('Voluntário')); menos('comida', 25); }
    if (tem('bastiao')) { cap.trinch = 100; cap.obras.forte = true; menos('moedas', 20); }
}
const _cam_producao = producaoDe;
producaoDe = function (p) {
    const r = _cam_producao(p); if (p.dono !== 'jogador') return r;
    reforcosAtivos().forEach(id => { const m = (REFORCOS_CQ[id] || {}).prod; if (m) Object.entries(m).forEach(([k, x]) => { if (k !== 'comida' || x > 1 || id !== 'siderurgia' || p.tipo === 'campo') r[k] *= x; }); });
    return r;
};
const _cam_vel = velEx;
velEx = function (e) { const v = _cam_vel(e); return e.dono === 'jogador' ? reforcosAtivos().reduce((t, id) => t * ((REFORCOS_CQ[id] || {}).vel || 1), v) : v; };
const _cam_construir = construir;
construir = function (provId, obra, dono = 'jogador') { const r = _cam_construir(provId, obra, dono); if (r && dono === 'jogador' && reforcosAtivos().includes('engenharia') && G.prov[provId].obra) G.prov[provId].obra.resta *= 0.65; return r; };

// a oferta fica guardada: recarregar a página não sorteia outra
function ofertaDeReforco(fase) {
    const m = lerMeta(); m.reforcos = m.reforcos || []; m.escolhidos = m.escolhidos || {}; m.ofertas = m.ofertas || {};
    if (m.escolhidos[fase] || !(m.estrelas[fase] > 0)) return [];
    if (!m.ofertas[fase]) {
        const livres = Object.keys(REFORCOS_CQ).filter(id => !m.reforcos.includes(id));
        for (let i = livres.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [livres[i], livres[j]] = [livres[j], livres[i]]; }
        m.ofertas[fase] = livres.slice(0, 3); gravarMeta(m);
    }
    return m.ofertas[fase];
}
function escolherReforco(fase, id) {
    const m = lerMeta(); if (!ofertaDeReforco(fase).includes(id)) return false;
    const n = lerMeta(); n.reforcos = (n.reforcos || []).concat(id); n.escolhidos = Object.assign(n.escolhidos || {}, { [fase]: id }); gravarMeta(n);
    const el = document.getElementById('ofertaReforco');
    if (el) el.innerHTML = `<div class="sub" style="color:#c9f2bd">🎁 <b>${REFORCOS_CQ[id].nome}</b> agora é seu: vale nas próximas fases.</div>`;
    som('conquista'); return true;
}
const cartaoReforco = (id) => { const R = REFORCOS_CQ[id]; return `<b>${R.icone} ${R.nome}</b><small><span class="mais">▲ ${R.mais}</span><span class="menos">▼ ${R.menos}</span></small>`; };
function htmlDaOferta(fase) {
    const o = ofertaDeReforco(fase); if (!o.length) return '';
    return `<div id="ofertaReforco"><div class="capitulo">🎁 Escolha 1 reforço permanente</div>${o.map(id => `<button class="reforco" onclick="escolherReforco(${fase},'${id}')">${cartaoReforco(id)}</button>`).join('')}</div>`;
}
const faseComOfertaPendente = () => FASES.map(F => F.n).find(n => ofertaDeReforco(n).length) || null;
function htmlDosMeusReforcos() {
    const meus = lerMeta().reforcos || []; if (!meus.length) return '';
    return `<details class="regras"><summary>🎁 Seus reforços (${meus.length})</summary><div class="lista">${meus.map(id => `<div class="reforco fixo">${cartaoReforco(id)}</div>`).join('')}</div></details>`;
}
const _cam_fim = mostrarFim;
mostrarFim = function () {
    const fase = G && G.fase.n, r = _cam_fim();
    if (G && !G.online && ['vitoria', 'pontos', 'dominio'].includes(G.fim)) {
        const caixa = document.getElementById('telaCaixa'), html = htmlDaOferta(fase), botao1 = caixa && caixa.querySelector('button.grande');
        if (html && caixa) { if (botao1) botao1.insertAdjacentHTML('beforebegin', html); else caixa.insertAdjacentHTML('beforeend', html); }
    }
    return r;
};
const _cam_inicio = mostrarInicio;
mostrarInicio = function () {
    _cam_inicio();
    const caixa = document.getElementById('telaCaixa'); if (!caixa) return;
    const pend = faseComOfertaPendente(), alvo = caixa.querySelector('.capitulo');
    const html = (pend ? htmlDaOferta(pend) : '') + htmlDosMeusReforcos();
    if (html && alvo) alvo.insertAdjacentHTML('beforebegin', html);
};
const _cam_comecar = comecarFase;
comecarFase = function (n) {
    const r = _cam_comecar(n);
    G.reforcos = (lerMeta().reforcos || []).filter(id => REFORCOS_CQ[id]);
    if (G.reforcos.length) { aplicarReforcosNoComeco(); noticia(`🎁 Reforços em campo: ${G.reforcos.map(id => REFORCOS_CQ[id].nome).join(', ')}.`); salvarPartida(); renderPainel(); atualizarTopo(); }
    return r;
};

/* ---------- Liberação gradual: a fase 1 não apresenta tudo de uma vez ---------- */
const LIBERA_NA_FASE = { diplomacia: 2, generais: 3 };
const sistemaLiberado = (s) => !G || !!G.online || G.fase.n >= LIBERA_NA_FASE[s] || faseLiberada(LIBERA_NA_FASE[s]);
function aplicarLiberacao() {
    const barra = document.getElementById('ferramentas'); if (!barra) return;
    ['diplomacia', 'generais'].forEach(s => { const bt = [...barra.querySelectorAll('button')].find(x => x.title.toLowerCase() === s); if (bt) { const v = sistemaLiberado(s) ? '' : 'none'; if (bt.style.display !== v) bt.style.display = v; } });
}
const _cam_topo = atualizarTopo;
atualizarTopo = function () { _cam_topo(); aplicarLiberacao(); };
const _cam_painel = renderPainel;
renderPainel = function () {
    const r = _cam_painel.apply(this, arguments);
    const pn = document.getElementById('painel'); if (!pn || !G) return r;
    [['diplomacia', '🤝 Diplomacia'], ['generais', '🎖 General']].forEach(([s, rotulo]) => { if (!sistemaLiberado(s)) pn.querySelectorAll('button.acao').forEach(bt => { if (bt.textContent.trim().startsWith(rotulo)) bt.remove(); }); });
    return r;
};
