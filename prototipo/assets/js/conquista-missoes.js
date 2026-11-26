// FrontLine · Conquista: objetivos curtos e acontecimentos com escolha (só na campanha; carregado depois de conquista-batalha.js)
// Servem para o jogador ter sempre algo por perto para fazer. Tudo anda no tempo do mapa (pausa junto) e vai no salvamento (G.vida).
const campanhaViva = () => !!G && !G.online && !G.cliente && !G.fim;
const estadoVida = () => (G.vida = G.vida || {});
const premioTxt = (p) => Object.entries(p).map(([k, v]) => `+${v}${{ moedas: '🪙', comida: '🍞', mun: '🔫', aco: '⚙', comb: '⛽' }[k]}`).join(' ');
const darPremio = (p) => Object.entries(p).forEach(([k, v]) => { G.fac.jogador[k] = (G.fac.jogador[k] || 0) + v; });
const podePagar = (c) => !c || Object.entries(c).every(([k, v]) => (G.fac.jogador[k] || 0) >= v);
const pagar = (c) => Object.entries(c || {}).forEach(([k, v]) => { G.fac.jogador[k] = Math.max(0, (G.fac.jogador[k] || 0) - v); });

/* ---------- Missões curtas: uma de cada vez, com prêmio na hora; perder o prazo não tem castigo ---------- */
const MISSAO_PRIMEIRA = 6, MISSAO_INTERVALO = 18;
const MISSOES = {
    tomar: {
        prazo: 120, premio: { aco: 10, moedas: 25 },
        criar() { // uma vizinha sua que dá para atacar: primeiro milícia, a menos defendida
            const alvos = Object.values(G.prov).filter(q => q.dono !== 'jogador' && !q.capital && q.viz.some(v => G.prov[v].dono === 'jogador') && emGuerra('jogador', q.dono));
            const q = alvos.sort((a, b) => (a.dono !== 'neutro') - (b.dono !== 'neutro') || defesaEm(a) - defesaEm(b))[0];
            return q ? { alvo: q.id } : null;
        },
        texto: (m) => `Tome ${G.prov[m.alvo].nome}`, feita: (m) => G.prov[m.alvo].dono === 'jogador'
    },
    recrutar: {
        prazo: 75, premio: { comida: 35, moedas: 10 },
        criar() { return maoDeObraLivre('jogador') >= 3 ? { base: estadoVida().recrutados || 0 } : null; },
        texto: (m) => `Recrute 3 soldados (${Math.min(3, (estadoVida().recrutados || 0) - m.base)}/3)`, feita: (m) => (estadoVida().recrutados || 0) - m.base >= 3
    },
    vencer: {
        prazo: 150, premio: { mun: 60, aco: 5 },
        criar() { return MISSOES.tomar.criar() ? { base: estadoVida().vitorias || 0 } : null; },
        texto: () => 'Vença uma batalha', feita: (m) => (estadoVida().vitorias || 0) > m.base
    },
    obra: {
        prazo: 90, premio: { moedas: 30, aco: 6 },
        criar() { return minhas().some(p => !p.obra || p.trinch < 100) ? { base: estadoVida().obras || 0 } : null; },
        texto: () => 'Fortifique ou comece uma obra', feita: (m) => (estadoVida().obras || 0) > m.base
    },
    segurar: {
        prazo: 75, premio: { moedas: 35, mun: 20 }, noFim: true, // vale se, no fim do prazo, nenhuma província foi perdida
        criar() { return G.t > 150 && minhas().length >= 3 ? { base: G.stats.perdidas || 0 } : null; },
        texto: () => 'Não perca nenhuma província', feita: (m) => (G.stats.perdidas || 0) === m.base, falhou: (m) => (G.stats.perdidas || 0) > m.base
    }
};
function novaMissao() {
    const v = estadoVida(), ordemTipos = ['tomar', 'recrutar', 'vencer', 'obra', 'segurar'];
    const n = v.feitas || 0, primeira = !v.ultimoTipo;
    const tipos = primeira ? ['tomar', 'recrutar'] : ordemTipos.filter(t => t !== v.ultimoTipo).sort(() => Math.random() - 0.5);
    for (const tipo of tipos) {
        const dados = MISSOES[tipo].criar(); if (!dados) continue;
        v.missao = { tipo, ate: G.t + MISSOES[tipo].prazo, escala: 1 + Math.min(0.5, n * 0.08), ...dados };
        v.ultimoTipo = tipo;
        noticia(`🎯 Nova missão: ${MISSOES[tipo].texto(v.missao)}. Prêmio ${premioTxt(premioDe(v.missao))}.`);
        return v.missao;
    }
    v.proxMissao = G.t + 10;
    return null;
}
const premioDe = (m) => Object.fromEntries(Object.entries(MISSOES[m.tipo].premio).map(([k, x]) => [k, Math.round(x * (m.escala || 1))]));
function encerrarMissao(ok) {
    const v = estadoVida(), m = v.missao; if (!m) return;
    v.missao = null; v.proxMissao = G.t + MISSAO_INTERVALO;
    if (ok) { const p = premioDe(m); darPremio(p); v.feitas = (v.feitas || 0) + 1; v.festaMissao = G.t + 4; v.ultimoPremio = premioTxt(p); som('conquista'); noticia(`✅ Missão cumprida! ${premioTxt(p)}`); }
    else noticia('⌛ A missão passou. Vem outra em instantes.');
}
function passoMissoes() {
    const v = estadoVida(), m = v.missao;
    if (!m) { if (G.t >= (v.proxMissao === undefined ? MISSAO_PRIMEIRA : v.proxMissao)) novaMissao(); return; }
    const M = MISSOES[m.tipo];
    if (M.noFim) { if (M.falhou(m)) encerrarMissao(false); else if (G.t >= m.ate) encerrarMissao(true); }
    else if (M.feita(m)) encerrarMissao(true);
    else if (G.t >= m.ate || (m.alvo && !G.prov[m.alvo])) encerrarMissao(false);
}
// o que conta para as missões
const _mis_recrutarEm = recrutarEm;
recrutarEm = function (provId, dono, tipo) { const r = _mis_recrutarEm(provId, dono, tipo); if (r && dono === 'jogador' && G) estadoVida().recrutados = (estadoVida().recrutados || 0) + 1; return r; };
const _mis_construir = construir;
construir = function (provId, obra, dono = 'jogador') { const r = _mis_construir(provId, obra, dono); if (r && dono === 'jogador') estadoVida().obras = (estadoVida().obras || 0) + 1; return r; };
const _mis_fortificar = fortificar;
fortificar = function (id, dono = 'jogador') { const r = _mis_fortificar(id, dono); if (r && dono === 'jogador') estadoVida().obras = (estadoVida().obras || 0) + 1; return r; };
const _mis_concluir = concluirBatalha;
concluirBatalha = function (b) {
    const venci = (b.atqDono === 'jogador' && b.vencedor === 'atq') || (b.defDono === 'jogador' && b.vencedor === 'def');
    if (venci && G) estadoVida().vitorias = (estadoVida().vitorias || 0) + 1;
    return _mis_concluir(b);
};

/* ---------- Acontecimentos: de tempos em tempos, uma escolha com ganho e risco. O mapa não para; quem não responde, ignora. ---------- */
const EVENTO_PRIMEIRO = 75, EVENTO_MIN = 65, EVENTO_VAR = 25, EVENTO_DURA = 30;
const sorte = (p) => Math.random() < p;
const provMoralBaixa = () => minhas().filter(p => !p.capital).sort((a, b) => a.moral - b.moral)[0];
const EVENTOS = {
    comboio: { icone: '🚚', titulo: 'Comboio na estrada', texto: () => 'Um comboio de suprimentos passa perto da fronteira.', opcoes: [
        { nome: 'Escoltar o nosso', dica: '+30🍞 +40🔫, garantido', custo: { moedas: 20 }, fazer: () => { darPremio({ comida: 30, mun: 40 }); return 'O comboio chegou inteiro.'; } },
        { nome: 'Emboscar o deles', dica: '60%: +40🪙 +8⚙ · 40%: gasta 25🔫 à toa', custo: null, fazer: () => { if (sorte(0.6)) { darPremio({ moedas: 40, aco: 8 }); return 'Emboscada perfeita: +40🪙 +8⚙.'; } pagar({ mun: 25 }); return 'Era uma isca. Gastamos munição à toa.'; } }] },
    desertor: { icone: '🕵', titulo: 'Desertor inimigo', texto: () => 'Um desertor pede para falar com o comando.', opcoes: [
        { nome: 'Comprar o mapa dele', dica: 'revela um inimigo por 60 s', custo: { moedas: 25 }, fazer: () => { const bots = G.fase.bots.filter(b => !G.eliminados[b]); const b = bots[Math.floor(Math.random() * bots.length)]; if (!b) return 'O mapa não servia para nada.'; G.espiado[b] = G.t + 60; return `Agora vemos os planos de ${FACCOES[b].nome} por 60 s.`; } },
        { nome: 'Alistar na tropa', dica: '+2 soldados · 25% de sabotagem (−30🔫)', custo: null, fazer: () => { const e = exParadosEm(G.capitalJogador, 'jogador')[0] || criarExercito('jogador', G.capitalJogador, 0); const cabem = Math.min(2, maoDeObraLivre('jogador')); for (let i = 0; i < cabem; i++) e.s.push(soldado('Recruta')); if (sorte(0.25)) { pagar({ mun: 30 }); return `Entraram ${cabem}, mas um deles sabotou o paiol.`; } return cabem ? `${cabem} soldado(s) entraram na tropa da capital.` : 'Não havia vaga de mão de obra.'; } }] },
    mercado: { icone: '⚖', titulo: 'Mercado negro', texto: () => 'Um negociante aparece com carga sem nota.', opcoes: [
        { nome: 'Comprar aço', dica: '+16⚙', custo: { moedas: 30 }, fazer: () => { darPremio({ aco: 16 }); return 'Aço no depósito.'; } },
        { nome: 'Vender munição', dica: '+32🪙', custo: { mun: 45 }, fazer: () => { darPremio({ moedas: 32 }); return 'Dinheiro no caixa.'; } }] },
    voluntarios: { icone: '🙋', titulo: 'Voluntários na praça', texto: () => 'Moradores querem se alistar.', opcoes: [
        { nome: 'Aceitar', dica: '+3 soldados (se houver vaga)', custo: { comida: 20 }, fazer: () => { const e = exParadosEm(G.capitalJogador, 'jogador')[0] || criarExercito('jogador', G.capitalJogador, 0); const cabem = Math.min(3, maoDeObraLivre('jogador')); for (let i = 0; i < cabem; i++) e.s.push(soldado('Recruta')); if (!cabem) { darPremio({ comida: 20 }); return 'Sem vaga de mão de obra: ficaram para depois.'; } return `${cabem} voluntários na capital.`; } },
        { nome: 'Pedir doações', dica: '+22🍞', custo: null, fazer: () => { darPremio({ comida: 22 }); return 'A população dividiu a comida.'; } }] },
    descontentes: { icone: '🔥', titulo: 'Povo descontente', quando: () => !!provMoralBaixa(), preparar: () => ({ prov: provMoralBaixa().id }), texto: (ev) => `A moral está caindo em ${G.prov[ev.prov].nome}.`, opcoes: [
        { nome: 'Distribuir pão', dica: 'moral +35', custo: { comida: 25 }, fazer: (ev) => { const p = G.prov[ev.prov]; p.moral = Math.min(100, p.moral + 35); return `${p.nome} se acalmou.`; } },
        { nome: 'Impor a ordem', dica: 'trincheira +20 · moral −12', custo: null, fazer: (ev) => { const p = G.prov[ev.prov]; p.trinch = Math.min(100, p.trinch + 20); p.moral = Math.max(5, p.moral - 12); return `${p.nome} está sob controle, por enquanto.`; } }] },
    engenheiros: { icone: '🛠', titulo: 'Engenheiros de passagem', texto: () => 'Uma equipe de engenheiros oferece serviço.', opcoes: [
        { nome: 'Reforçar a capital', dica: 'trincheira +30', custo: { moedas: 20 }, fazer: () => { const p = G.prov[G.capitalJogador]; p.trinch = Math.min(100, p.trinch + 30); return 'A capital ficou mais difícil de tomar.'; } },
        { nome: 'Buscar combustível', dica: '+14⛽ +6⚙', custo: { moedas: 18 }, fazer: () => { darPremio({ comb: 14, aco: 6 }); return 'Depósito abastecido.'; } }] }
};
function novoEvento(id) {
    const v = estadoVida(), ids = id ? [id] : Object.keys(EVENTOS).filter(k => k !== v.ultimoEvento && (!EVENTOS[k].quando || EVENTOS[k].quando()));
    const escolhido = ids[Math.floor(Math.random() * ids.length)]; if (!escolhido) return null;
    v.evento = { id: escolhido, ate: G.t + EVENTO_DURA, ...(EVENTOS[escolhido].preparar ? EVENTOS[escolhido].preparar() : {}) };
    v.ultimoEvento = escolhido; som('espiao');
    return v.evento;
}
function fimDoEvento() { const v = estadoVida(); v.evento = null; v.proxEvento = G.t + EVENTO_MIN + Math.random() * EVENTO_VAR; mostrarEvento(); }
function escolherEvento(i) {
    const v = estadoVida(), ev = v.evento; if (!ev || !campanhaViva()) return false;
    if (i < 0) { fimDoEvento(); return true; }
    const op = EVENTOS[ev.id].opcoes[i]; if (!op || !podePagar(op.custo)) return false;
    pagar(op.custo); const resultado = op.fazer(ev); noticia(`${EVENTOS[ev.id].icone} ${resultado}`); v.ultimoResultado = resultado; som('ordem');
    fimDoEvento(); renderPainel(); return true;
}
function passoEventos() {
    const v = estadoVida();
    if (v.evento) { if (G.t >= v.evento.ate || (v.evento.prov && G.prov[v.evento.prov].dono !== 'jogador')) fimDoEvento(); return; }
    if (G.t >= (v.proxEvento === undefined ? EVENTO_PRIMEIRO : v.proxEvento) && G.fase.tempo - G.t > 45) novoEvento();
}
// cartão sobre o mapa; some com tutorial, configurações ou tela cheia
function mostrarEvento() {
    const caixa = document.getElementById('mapaBox'); if (!caixa) return;
    let el = document.getElementById('evento');
    const ev = G && G.vida && G.vida.evento;
    const escondido = !ev || !campanhaViva() || (window.GuiaT && GuiaT.ativo()) || document.getElementById('tela').style.display === 'flex';
    if (escondido) { if (el) { el.style.display = 'none'; el._html = ''; } return; }
    if (!el) { el = document.createElement('div'); el.id = 'evento'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Acontecimento'); caixa.appendChild(el); }
    const E = EVENTOS[ev.id];
    const custoTexto = (c) => c ? 'custa ' + Object.entries(c).map(([k, x]) => `${x}${{ moedas: '🪙', comida: '🍞', mun: '🔫', aco: '⚙', comb: '⛽' }[k]}`).join(' ') + ' · ' : '';
    const html = `<div class="ev-t"><b>${E.icone} ${E.titulo}</b><span>${Math.max(0, Math.ceil(ev.ate - G.t))}s</span></div><div class="ev-x">${E.texto(ev)}</div>
        <div class="ev-o">${E.opcoes.map((o, i) => `<button onclick="escolherEvento(${i})" ${podePagar(o.custo) ? '' : 'disabled'}><b>${o.nome}</b><small>${custoTexto(o.custo)}${o.dica}</small></button>`).join('')}</div>
        <button class="ev-i" onclick="escolherEvento(-1)">Ignorar</button>`;
    el.style.display = 'block';
    if (el._html !== html) { el.innerHTML = html; el._html = html; }
}

/* ---------- Faixa de objetivo (entre o topo e o mapa): missão, recado de rádio e contagens importantes ---------- */
function textoDaFaixa() {
    const v = estadoVida();
    if (v.radio && G.t < v.radio.ate) return { classe: 'radio', html: `📻 <b>${v.radio.quem}:</b> ${v.radio.txt}` };
    if (v.festaMissao && G.t < v.festaMissao) return { classe: 'ok', html: `✅ Missão cumprida! <b>${v.ultimoPremio}</b>` };
    const aviso = typeof avisoDeGuerra === 'function' ? avisoDeGuerra() : null; if (aviso) return aviso;
    const m = v.missao;
    if (m) return { classe: '', alvo: m.alvo, html: `🎯 <b>${MISSOES[m.tipo].texto(m)}</b> <span>${Math.max(0, Math.ceil(m.ate - G.t))}s · ${premioTxt(premioDe(m))}</span>` };
    return { classe: 'vazia', html: '🎯 Próxima missão em instantes…' };
}
function atualizarFaixa() {
    const el = document.getElementById('faixaMissao'); if (!el) return;
    if (!G || G.online || G.cliente) { el.style.display = 'none'; return; }
    const f = textoDaFaixa();
    el.style.display = 'flex';
    if (el._html !== f.html) { el.innerHTML = `<span class="tx">${f.html}</span>`; el._html = f.html; }
    el.className = f.classe; el.dataset.alvo = f.alvo || '';
}
function tocarFaixa() { const id = document.getElementById('faixaMissao').dataset.alvo; if (!id || !G.prov[id]) return; centralizar(G.prov[id].x, G.prov[id].y); irParaProvincia(id); }

GANCHOS_PASSO.push(() => { if (campanhaViva()) { passoMissoes(); passoEventos(); } });
const _mis_topo = atualizarTopo;
atualizarTopo = function () { _mis_topo(); atualizarFaixa(); mostrarEvento(); };
