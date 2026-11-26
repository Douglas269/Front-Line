// FrontLine · Conquista: os inimigos com voz e iniciativa, e um final de partida (só na campanha; carregado depois de conquista-missoes.js)
// Rádio com a personalidade de cada comandante, ofensivas anunciadas, ofensiva final e vitória por domínio do mapa.

/* ---------- Rádio: cada país tem um comandante que reage ao que acontece ---------- */
const COMANDANTES = {
    bravo:   { nome: 'Cel. Brandão (Bravo)', contato: 'Encostou na minha fronteira? Vai se arrepender.', perdeu: 'Essa terra é minha. Vou buscar de volta!', tomou: 'Mais uma bandeira minha. Quem é o próximo?', ofensiva: 'Preparem-se. Vou passar por cima de {alvo}.', repelida: 'Sorte. Na próxima não sobra ninguém.', caiu: 'Não… a capital não!' },
    charlie: { nome: 'Maj. Vilela (Charlie)', contato: 'Calma, amigo. Tudo tem um preço.', perdeu: 'Vai me pagar caro, e com juros.', tomou: 'Obrigado pelo cofre. Estava muito cheio.', ofensiva: 'Soube que {alvo} anda rica. Vou conferir.', repelida: 'Foi só uma visita. Eu volto.', caiu: 'Podemos negociar… tarde demais?' },
    delta:   { nome: 'Gen. Duarte (Delta)', contato: 'Registrei a sua chegada. Não avance.', perdeu: 'Recuo tático. Anote: tático.', tomou: 'Posição assegurada. Daqui não saio.', ofensiva: 'Concentração concluída. Alvo: {alvo}.', repelida: 'Bem defendido. Vou me lembrar.', caiu: 'A linha rompeu. Foi uma boa guerra.' },
    echo:    { nome: 'Cap. Esteves (Echo)', contato: 'Eu observo antes de morder.', perdeu: 'Você olhou para o lado errado agora há pouco.', tomou: 'Saiu para brigar e deixou a porta aberta.', ofensiva: '{alvo} está distraída. Hora perfeita.', repelida: 'Você estava mais atento do que parecia.', caiu: 'Não vi essa chegando.' }
};
const RADIO_DURA = 6, RADIO_INTERVALO = 14;
function falar(bot, qual, dados = {}, urgente) {
    const C0 = COMANDANTES[bot]; if (!C0 || !campanhaViva()) return false;
    const v = estadoVida();
    if (!urgente && v.radio && G.t < v.radio.ate - RADIO_DURA + RADIO_INTERVALO) return false; // não vira falatório
    const txt = C0[qual].replace(/\{(\w+)\}/g, (_, k) => dados[k] || '');
    v.radio = { quem: C0.nome, txt, ate: G.t + RADIO_DURA };
    noticia(`📻 ${C0.nome}: ${txt}`);
    return true;
}
const _gue_conquistar = conquistar;
conquistar = function (p, dono, e) {
    const antigo = p.dono, r = _gue_conquistar(p, dono, e);
    if (G && campanhaViva() && antigo !== dono) {
        if (antigo !== 'jogador' && antigo !== 'neutro' && dono === 'jogador') falar(antigo, p.capital && p.capitalDe === antigo ? 'caiu' : 'perdeu', {}, p.capital);
        else if (antigo === 'jogador' && dono !== 'neutro') falar(dono, 'tomou');
    }
    return r;
};
const _gue_abrir = abrirBatalha;
abrirBatalha = function (e, p, defensores) {
    const bot = e.dono === 'jogador' ? p.dono : p.dono === 'jogador' ? e.dono : null;
    if (bot && bot !== 'neutro' && campanhaViva()) { const v = estadoVida(); v.contato = v.contato || {}; if (!v.contato[bot] && falar(bot, 'contato')) v.contato[bot] = 1; }
    return _gue_abrir(e, p, defensores);
};

/* ---------- Ofensivas anunciadas: um inimigo avisa onde vai bater; dá tempo de preparar e há prêmio por segurar ---------- */
const OFENSIVA_CQ = { PRIMEIRA: 210, MIN: 150, VAR: 50, AVISO: 35, JULGA: 60, PREMIO: { moedas: 45, aco: 12 } };
const botsAtivos = () => G.fase.bots.filter(b => !G.eliminados[b] && !(G.semCapital && G.semCapital[b]) && G.pensar[b] !== undefined && G.pensar[b] < 1e6 && emGuerra(b, 'jogador') && provDe(b).length);
// cada ofensiva vem mais forte que a anterior: ficar parado deixa de ser seguro
const reforcosDaOfensiva = () => Math.max(2, 3 + Math.round(G.fase.n / 2) + 3 * ((G.vida && G.vida.lancadas) || 0) + (({ recruta: -2, veterano: 2 })[typeof CONFIG_CONQ !== 'undefined' ? CONFIG_CONQ.dificuldade : ''] || 0));
function planejarOfensiva() {
    const opcoes = [];
    botsAtivos().forEach(b => provDe(b).forEach(base => base.viz.map(id => G.prov[id]).filter(q => q.dono === 'jogador').forEach(alvo => opcoes.push({ bot: b, base: base.id, alvo: alvo.id, peso: (FACCOES[b].perso === 'agressivo' ? 2 : 1) * (alvo.capital ? 0.35 : 1) / (1 + defesaEm(alvo) / 8) }))));
    if (!opcoes.length) return null;
    let sorteio = Math.random() * opcoes.reduce((t, o) => t + o.peso, 0);
    return opcoes.find(o => (sorteio -= o.peso) <= 0) || opcoes[opcoes.length - 1];
}
function anunciarOfensiva(plano) {
    const v = estadoVida(), o = plano || planejarOfensiva(); if (!o) return null;
    v.ofensiva = { bot: o.bot, base: o.base, alvo: o.alvo, em: G.t + OFENSIVA_CQ.AVISO, lancada: false };
    falar(o.bot, 'ofensiva', { alvo: G.prov[o.alvo].nome }, true);
    noticia(`⚠ OFENSIVA: ${FACCOES[o.bot].nome} vai atacar ${G.prov[o.alvo].nome} em ${OFENSIVA_CQ.AVISO}s. Reforce!`, true);
    return v.ofensiva;
}
function lancarOfensiva() {
    const v = estadoVida(), o = v.ofensiva, base = G.prov[o.base], alvo = G.prov[o.alvo];
    if (!base || base.dono !== o.bot || !alvo || alvo.dono !== 'jogador' || !emGuerra(o.bot, 'jogador')) { // o jogador desarmou antes: tomou a base ou fez paz
        v.ofensiva = null; v.proxOfensiva = G.t + OFENSIVA_CQ.MIN;
        if (base && base.dono === 'jogador') { darPremio(OFENSIVA_CQ.PREMIO); noticia(`🏅 Você tomou a base da ofensiva antes dela sair! ${premioTxt(OFENSIVA_CQ.PREMIO)}`); }
        return false;
    }
    const e = exParadosEm(base.id, o.bot)[0] || criarExercito(o.bot, base.id, 0);
    for (let i = 0; i < reforcosDaOfensiva(); i++) e.s.push(soldado('Inimigo'));
    v.lancadas = (v.lancadas || 0) + 1;
    const manda = ordem(e.id, alvo.id, e.s.length, 'ataque');
    o.lancada = true; o.ex = manda ? manda.id : null; o.julga = G.t + OFENSIVA_CQ.JULGA;
    return !!manda;
}
function julgarOfensiva() {
    const v = estadoVida(), o = v.ofensiva, alvo = G.prov[o.alvo];
    const aindaVem = G.ex.some(e => e.id === o.ex && (e.rota.length || e.emBatalha));
    if (alvo.dono !== 'jogador') { v.ofensiva = null; v.proxOfensiva = G.t + OFENSIVA_CQ.MIN + Math.random() * OFENSIVA_CQ.VAR; return false; }
    if (aindaVem && G.t < o.julga + 30) return null;
    v.ofensiva = null; v.proxOfensiva = G.t + OFENSIVA_CQ.MIN + Math.random() * OFENSIVA_CQ.VAR; v.repelidas = (v.repelidas || 0) + 1;
    darPremio(OFENSIVA_CQ.PREMIO); falar(o.bot, 'repelida', {}, true); noticia(`🛡 Ofensiva repelida em ${alvo.nome}! ${premioTxt(OFENSIVA_CQ.PREMIO)}`);
    return true;
}
function passoOfensiva() {
    const v = estadoVida(), o = v.ofensiva;
    if (o) { if (!o.lancada && G.t >= o.em) lancarOfensiva(); else if (o.lancada && (G.t >= o.julga || G.prov[o.alvo].dono !== 'jogador' || !G.ex.some(e => e.id === o.ex))) julgarOfensiva(); return; }
    if (G.t >= (v.proxOfensiva === undefined ? OFENSIVA_CQ.PRIMEIRA : v.proxOfensiva) && G.fase.tempo - G.t > OFENSIVA_CQ.AVISO + 30) { if (!anunciarOfensiva()) v.proxOfensiva = G.t + 20; }
}

/* ---------- Final: ofensiva final nos últimos 3 minutos e vitória (ou derrota) por domínio do mapa ---------- */
const FINAL = { COMECA: 180, DOMINIO: 0.6, SEGURA: 60 };
const emOfensivaFinal = () => !!(G && G.vida && G.vida.final);
const provinciasParaDominar = () => Math.ceil(Object.keys(G.prov).length * FINAL.DOMINIO);
function passoFinal() {
    const v = estadoVida();
    if (!v.final && G.fase.tempo - G.t <= FINAL.COMECA && botsAtivos().length) {
        v.final = true; botsAtivos().forEach(b => { G.pensar[b] = Math.min(G.pensar[b], 2); G.ultimoAtaque[b] = 0; });
        noticia('🔥 OFENSIVA FINAL: faltam 3 minutos e os inimigos vão com tudo!', true);
    }
    const pl = placar(), meta = provinciasParaDominar();
    const dono = ['jogador', ...G.fase.bots].find(d => !G.eliminados[d] && (pl[d] || 0) >= meta) || null;
    if (!dono) { v.dominio = null; return; }
    if (!v.dominio || v.dominio.dono !== dono) { v.dominio = { dono, desde: G.t }; noticia(dono === 'jogador' ? `👑 Você domina o mapa! Segure ${meta} províncias por ${FINAL.SEGURA}s para vencer.` : `⚠ ${FACCOES[dono].nome} domina o mapa! Tome terra em ${FINAL.SEGURA}s ou a guerra acaba.`, dono !== 'jogador'); }
    else if (G.t - v.dominio.desde >= FINAL.SEGURA) { G.fim = dono === 'jogador' ? 'dominio' : 'dominado'; G.vencedorDominio = dono; mostrarFim(); }
}
// o que a faixa de objetivo mostra quando há algo urgente
function avisoDeGuerra() {
    const v = estadoVida(), o = v.ofensiva, d = v.dominio;
    if (d) { const resta = Math.max(0, Math.ceil(FINAL.SEGURA - (G.t - d.desde))); return d.dono === 'jogador' ? { classe: 'ok', html: `👑 <b>Domínio do mapa:</b> segure por ${resta}s` } : { classe: 'perigo', html: `⚠ <b>${FACCOES[d.dono].nome} domina:</b> tome terra em ${resta}s` }; }
    if (o && !o.lancada) return { classe: 'perigo', alvo: o.alvo, html: `⚠ <b>Ofensiva de ${FACCOES[o.bot].nome} em ${G.prov[o.alvo].nome}</b> <span>${Math.max(0, Math.ceil(o.em - G.t))}s · toque</span>` };
    if (o) return { classe: 'perigo', alvo: o.alvo, html: `⚔ <b>Segure ${G.prov[o.alvo].nome}!</b> <span>prêmio ${premioTxt(OFENSIVA_CQ.PREMIO)}</span>` };
    if (v.final && !v.missao) return { classe: 'perigo', html: '🔥 <b>Ofensiva final</b>: ataque ou segure o que é seu' };
    return null;
}

GANCHOS_PASSO.push(() => { if (campanhaViva()) { passoOfensiva(); if (!G.fim) passoFinal(); } });
