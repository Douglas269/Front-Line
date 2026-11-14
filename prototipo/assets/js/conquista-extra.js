// FrontLine · Conquista: regras estratégicas (carregado antes de conquista.js)
// Tipos de tropa, pesquisa, obras nas províncias, moral e revolta, suprimento, diplomacia com os bots,
// generais (que sobem de nível entre as fases) e a campanha em capítulos com estrelas.

/* ---------- Tipos de tropa (pedra, papel e tesoura) ----------
   atq/def: força do tiro no ataque e na defesa · corpo: corpo a corpo · vel: velocidade no mapa
   Infantaria < Metralhadora (na defesa) < Artilharia < Cavalaria < Metralhadora; o blindado só cai para a artilharia. */
const TROPAS = {
    inf:   { nome: 'Infantaria', icone: '🪖', custo: 20, vel: 1,   vida: 100, atq: 1,   def: 1,   corpo: 1,   pesquisa: null,    txt: 'equilibrada' },
    metr:  { nome: 'Metralhadora', icone: '🔫', custo: 30, vel: 0.8, vida: 100, atq: 0.6, def: 2.0, corpo: 0.7, pesquisa: 'metr',  txt: 'segura a trincheira; ataca pouco; mata cavalaria' },
    art:   { nome: 'Artilharia', icone: '💣', custo: 40, vel: 0.7, vida: 90,  atq: 1.6, def: 0.8, corpo: 0.3, pesquisa: 'art',   txt: 'atira de longe e fura trincheira; fraca de perto', longe: true },
    cav:   { nome: 'Cavalaria', icone: '🐎', custo: 30, vel: 1.6, vida: 110, atq: 0.9, def: 0.7, corpo: 1.6, pesquisa: 'cav',   txt: 'rápida e forte no corpo a corpo; morre para metralhadora' },
    blind: { nome: 'Blindado', icone: '🚜', custo: 65, vel: 1.1, vida: 240, atq: 0.9, def: 1.0, corpo: 1.1, pesquisa: 'blind', txt: 'aguenta tiro de fuzil; só a artilharia fura', blindado: true }
};
const vidaMax = (s) => (TROPAS[s.tipo || 'inf'] || TROPAS.inf).vida;
// multiplicador de dano de quem atira (tipo a) em quem leva (tipo b)
function danoContra(a, b) {
    let k = 1;
    if (TROPAS[b] && TROPAS[b].blindado) k *= a === 'art' ? 1.5 : C.BLINDADO_RECEBE; // fuzil quase não fere blindado; artilharia fura
    if (a === 'metr' && b === 'cav') k *= 1.7;
    if (a === 'cav' && b === 'art') k *= 1.6;
    return k;
}

/* ---------- Pesquisa (uma de cada vez, custa moedas e tempo de mapa) ---------- */
const PESQUISAS = {
    metr:       { nome: 'Metralhadoras', custo: 40, tempo: 30, txt: 'libera a Metralhadora' },
    cav:        { nome: 'Cavalaria', custo: 35, tempo: 25, txt: 'libera a Cavalaria' },
    art:        { nome: 'Artilharia pesada', custo: 60, tempo: 45, txt: 'libera a Artilharia' },
    blind:      { nome: 'Carro blindado', custo: 110, tempo: 60, req: ['metr', 'art'], txt: 'libera o Blindado' },
    racoes:     { nome: 'Rações enlatadas', custo: 45, tempo: 35, txt: 'a tropa come 30% menos' },
    estradas:   { nome: 'Estradas militares', custo: 50, tempo: 35, txt: 'exércitos 20% mais rápidos' },
    concreto:   { nome: 'Concreto armado', custo: 55, tempo: 40, txt: 'fortes defendem +15% e obras saem 30% mais rápido' },
    radio:      { nome: 'Rádio de campo', custo: 40, tempo: 30, txt: 'espião custa 10 e dura 50% mais' },
    propaganda: { nome: 'Propaganda', custo: 55, tempo: 40, txt: '+15 de moral em todas as províncias' },
    medicina:   { nome: 'Medicina de campanha', custo: 45, tempo: 35, txt: 'feridos se recuperam 2× mais rápido' }
};
const temPesq = (dono, id) => !!(G.pesq[dono] && G.pesq[dono].feitas[id]);
const tropaLiberada = (dono, tipo) => !TROPAS[tipo].pesquisa || temPesq(dono, TROPAS[tipo].pesquisa);
function pesquisaDisponivel(dono, id) {
    const P = PESQUISAS[id], st = G.pesq[dono];
    return !st.feitas[id] && (!P.req || P.req.every(r => st.feitas[r]));
}
function pesquisar(id, dono = 'jogador') {
    const st = G.pesq[dono], P = PESQUISAS[id], f = G.fac[dono];
    if (!st || st.atual || !pesquisaDisponivel(dono, id) || f.moedas < P.custo) return false;
    f.moedas -= P.custo; st.atual = { id, resta: P.tempo };
    if (dono === 'jogador') { noticia(`🔬 Pesquisa começou: ${P.nome} (${P.tempo}s).`); som('ordem'); }
    return true;
}
function avancarPesquisas(dt) {
    Object.entries(G.pesq).forEach(([dono, st]) => {
        if (!st.atual) return;
        st.atual.resta -= dt;
        if (st.atual.resta <= 0) {
            st.feitas[st.atual.id] = true;
            if (dono === 'jogador') { noticia(`🔬 Pesquisa pronta: ${PESQUISAS[st.atual.id].nome}. ${PESQUISAS[st.atual.id].txt}.`); som('conquista'); }
            else if (espiado(dono)) noticia(`👁 Espião: ${FACCOES[dono].nome} terminou a pesquisa ${PESQUISAS[st.atual.id].nome}.`);
            st.atual = null;
        }
    });
}

/* ---------- Obras nas províncias (uma de cada vez por província) ---------- */
const OBRAS = {
    forte:    { nome: 'Forte', icone: '🏰', custo: 40, tempo: 30, txt: '+25% de defesa e +10 de moral' },
    ferrovia: { nome: 'Ferrovia', icone: '🚂', custo: 35, tempo: 25, txt: 'tropa chega aqui 2× mais rápido' },
    fabrica:  { nome: 'Fábrica', icone: '🏭', custo: 45, tempo: 40, txt: '+3 moedas e +3 munição por ciclo' },
    hospital: { nome: 'Hospital', icone: '🏥', custo: 30, tempo: 25, txt: 'soldados parados aqui se curam rápido' }
};
function construir(provId, obra, dono = 'jogador') {
    const p = G.prov[provId], O = OBRAS[obra], f = G.fac[dono];
    const custo = custoObra(dono, obra);
    if (!p || p.dono !== dono || p.obra || p.obras[obra] || f.moedas < custo) return false;
    f.moedas -= custo; p.obra = { id: obra, resta: O.tempo * (temPesq(dono, 'concreto') ? 0.7 : 1) };
    if (dono === 'jogador') { noticia(`🏗 Obra começou em ${p.nome}: ${O.nome}.`); som('ordem'); }
    return true;
}
const custoObra = (dono, obra) => Math.round(OBRAS[obra].custo * (G.fase.regra === 'industria' && dono === 'jogador' ? 0.5 : 1));
function avancarObras(dt) {
    Object.values(G.prov).forEach(p => {
        if (!p.obra) return;
        if (p.dono === 'neutro') { p.obra = null; return; }
        p.obra.resta -= dt;
        if (p.obra.resta <= 0) {
            p.obras[p.obra.id] = true;
            if (p.obra.id === 'forte') p.trinch = Math.max(p.trinch, 80);
            if (p.dono === 'jogador') noticia(`🏗 ${OBRAS[p.obra.id].nome} pronto em ${p.nome}.`);
            p.obra = null;
        }
    });
}

/* ---------- Moral e revolta ----------
   Moral baixa produz menos e pode se revoltar. Cai com a distância até a capital, com inimigo por perto
   e logo depois de conquistada; sobe com forte, propaganda e comida em dia. */
function passosAteCapital(p) {
    const cap = Object.values(G.prov).find(q => q.capital && q.dono === p.dono);
    if (!cap) return 6;
    const vis = new Set([cap.id]); let fila = [cap.id], d = 0;
    while (fila.length && d < 8) {
        if (fila.includes(p.id)) return d;
        const prox = []; fila.forEach(id => G.prov[id].viz.forEach(v => { if (!vis.has(v)) { vis.add(v); prox.push(v); } }));
        fila = prox; d++;
    }
    return 8;
}
function emGuerra(a, b) {
    if (a === b || a === 'neutro' || b === 'neutro') return a !== b;
    const bot = a === 'jogador' ? b : b === 'jogador' ? a : null;
    if (!bot) return true; // bots sempre em guerra entre si
    return !G.rel[bot] || G.rel[bot].estado === 'guerra';
}
function atualizarMoral() {
    Object.values(G.prov).forEach(p => {
        if (p.dono === 'neutro') { p.moral = 60; return; }
        let alvo = 100 - 9 * passosAteCapital(p);
        if (G.ex.some(e => e.dono !== p.dono && e.dono !== 'neutro' && emGuerra(e.dono, p.dono) && (e.prov === p.id || p.viz.includes(e.prov)))) alvo -= 20;
        if (G.t - (p.conquistadaEm || -999) < 90) alvo -= 30;
        if (p.obras.forte) alvo += 10;
        if (temPesq(p.dono, 'propaganda')) alvo += 15;
        if (G.fac[p.dono].comida <= 0) alvo -= 15;
        if (p.capital) alvo = Math.max(alvo, 90);
        alvo = Math.max(5, Math.min(100, alvo));
        p.moral += (alvo - p.moral) * 0.2;
        // revolta: moral muito baixa, sem tropa do dono para segurar
        if (!p.capital && p.moral < 28 && Math.random() < 0.06) {
            const guarda = exParadosEm(p.id, p.dono).reduce((t, e) => t + e.s.length, 0);
            if (guarda >= 3) return;
            const antigo = p.dono;
            G.ex = G.ex.filter(e => !(e.prov === p.id && e.dono === antigo && parado(e)));
            p.dono = 'neutro'; p.obra = null; p.moral = 60; p.trinch = C.TRINCH_BASE;
            criarExercito('neutro', p.id, 3, Array.from({ length: 3 }, () => soldado('Rebelde')));
            if (antigo === 'jogador') { G.stats.revoltas = (G.stats.revoltas || 0) + 1; noticia(`🔥 ${p.nome} se revoltou (moral baixa) e virou terra de milícia!`, true); som('perda'); }
            else if (provVisivel(p.id) || espiado(antigo)) noticia(`🔥 ${p.nome} se revoltou contra ${FACCOES[antigo].nome}.`);
            verificarFim();
        }
    });
}
const fatorMoral = (p) => 0.3 + 0.7 * (p.moral / 100);

/* ---------- Suprimento ----------
   Exército dentro do seu território ou na província vizinha a ele (ou de um aliado) recebe comida.
   Mais longe que isso, fica sem suprimento: não come e enfraquece. */
function abastecido(e) {
    const p = G.prov[e.prov];
    if (!p || e.dono === 'neutro') return true;
    const amigo = (q) => q.dono === e.dono || (e.dono === 'jogador' && G.rel[q.dono] && G.rel[q.dono].estado === 'alianca') || (q.dono === 'jogador' && G.rel[e.dono] && G.rel[e.dono].estado === 'alianca');
    return amigo(p) || p.viz.some(v => amigo(G.prov[v]));
}

/* ---------- Diplomacia (você com cada bot; os bots brigam sempre entre si) ---------- */
const DIPLO_TXT = { guerra: '⚔️ Guerra', paz: '🕊 Paz', alianca: '🤝 Aliança' };
function novaRelacao() { return { estado: 'guerra', ate: 0, recusaAte: 0, atacadoEm: -999 }; }
function chanceAceitar(bot, tipo) {
    const FX = FACCOES[bot], pl = placar(), meu = pl.jogador || 0, dele = pl[bot] || 0, r = G.rel[bot];
    let ch = { agressivo: 0.2, 'ladrão': 0.45, defensivo: 0.65, oportunista: 0.35 }[FX.perso] || 0.4;
    if (tipo === 'alianca') ch -= 0.15;
    if (meu > dele) ch += 0.2;                    // você está mais forte: ele prefere não brigar
    if (G.t - r.atacadoEm < 60) ch -= 0.4;        // você acabou de atacar
    const maiorOutro = Math.max(0, ...G.fase.bots.filter(b => b !== bot && !G.eliminados[b]).map(b => pl[b] || 0));
    if (tipo === 'alianca' && maiorOutro > dele) ch += 0.25; // inimigo em comum mais forte
    return Math.max(0.05, Math.min(0.9, ch));
}
const custoPaz = (bot) => 20 + 4 * (placar()[bot] || 0);
function propor(bot, tipo) {
    const r = G.rel[bot], f = G.fac.jogador;
    if (!r || G.eliminados[bot] || G.t < r.recusaAte) return false;
    if (tipo === 'alianca' && r.estado !== 'paz') return false;
    if (tipo === 'paz' && r.estado !== 'guerra') return false;
    const custo = tipo === 'paz' ? custoPaz(bot) : 0;
    if (f.moedas < custo) return false;
    f.moedas -= custo;
    const ch = chanceAceitar(bot, tipo) + (FACCOES[bot].perso === 'ladrão' ? 0.1 : 0);
    if (Math.random() < ch) {
        r.estado = tipo; r.ate = tipo === 'paz' ? G.t + 240 : 0;
        G.fac[bot].moedas += custo;
        noticia(tipo === 'paz' ? `🕊 ${FACCOES[bot].nome} aceitou a paz por 4 minutos.` : `🤝 ${FACCOES[bot].nome} aceitou a aliança: vocês veem o território um do outro.`);
        som('conquista');
    } else {
        r.recusaAte = G.t + 45; f.moedas += Math.floor(custo / 2); // metade do tributo volta
        noticia(`✖ ${FACCOES[bot].nome} recusou a ${tipo === 'paz' ? 'paz' : 'aliança'}. Tente de novo em 45s.`);
    }
    return true;
}
function declararGuerra(bot, porQuem) {
    const r = G.rel[bot]; if (!r || r.estado === 'guerra') return;
    r.estado = 'guerra'; r.ate = 0;
    if (porQuem === 'bot') noticia(`🗡 ${FACCOES[bot].nome} rompeu o acordo e declarou guerra!`, true);
    else noticia(`⚔️ Você declarou guerra a ${FACCOES[bot].nome}.`);
    resolverOcupacoes();
}
// depois de uma guerra declarada: exército parado em terra do inimigo ataca ali mesmo
function resolverOcupacoes() {
    G.ex.slice().forEach(e => {
        if (!parado(e) || e.dono === 'neutro') return;
        const p = G.prov[e.prov];
        if (p.dono !== e.dono && emGuerra(e.dono, p.dono)) { e.rota = []; chegarAqui(e, p); }
    });
}
function pensarDiplomacia(bot) {
    const r = G.rel[bot]; if (!r) return;
    if (r.estado === 'paz' && G.t >= r.ate) { r.estado = 'guerra'; noticia(`⌛ A paz com ${FACCOES[bot].nome} acabou: vocês estão em guerra de novo.`, true); resolverOcupacoes(); return; }
    // traição: agressivo e oportunista rompem quando você está fraco perto deles
    if (r.estado !== 'guerra' && ['agressivo', 'oportunista'].includes(FACCOES[bot].perso)) {
        const fronteira = minhas().filter(p => p.viz.some(v => G.prov[v].dono === bot));
        const fraca = fronteira.some(p => defesaEm(p) < 2);
        if (fraca && Math.random() < 0.05) declararGuerra(bot, 'bot');
    }
}

/* ---------- Generais (seus; sobem de nível e ficam salvos entre as fases) ---------- */
const GENERAIS = [
    { id: 'rocha',  nome: 'Cel. Rocha',  hab: 'atq', txt: 'Ataque: +20% de tiro ao atacar', estrelas: 0 },
    { id: 'lima',   nome: 'Maj. Lima',   hab: 'def', txt: 'Defesa: +25% de tiro ao defender', estrelas: 2 },
    { id: 'nunes',  nome: 'Cap. Nunes',  hab: 'vel', txt: 'Marcha: tropa 35% mais rápida', estrelas: 4 },
    { id: 'costa',  nome: 'Gen. Costa',  hab: 'log', txt: 'Logística: a tropa come pela metade e aguenta sem suprimento', estrelas: 7 },
    { id: 'barros', nome: 'Ten. Barros', hab: 'art', txt: 'Artilheiro: toda batalha começa com uma barragem de graça', estrelas: 10 }
];
const META_CONQ = 'frontline-conquista-meta';
function lerMeta() {
    let m = null; try { m = JSON.parse(localStorage.getItem(META_CONQ) || 'null'); } catch (e) {}
    if (!m) {
        m = { estrelas: {}, generais: {} };
        // quem já jogava a versão anterior não perde o que liberou
        let antigo = 1; try { antigo = +(localStorage.getItem('frontline-conquista-fase') || 1); } catch (e) {}
        if (antigo >= 2) m.estrelas[1] = 1;
        if (antigo >= 3) { m.estrelas[2] = 1; m.estrelas[3] = 1; }
    }
    return m;
}
function gravarMeta(m) { try { localStorage.setItem(META_CONQ, JSON.stringify(m)); } catch (e) {} }
const totalEstrelas = (m) => Object.values(m.estrelas).reduce((t, v) => t + v, 0);
const nivelGeneral = (xp) => Math.min(5, 1 + Math.floor((xp || 0) / 3));
function generaisLiberados() { const m = lerMeta(), tot = totalEstrelas(m); return GENERAIS.filter(g => tot >= g.estrelas).map(g => ({ ...g, xp: (m.generais[g.id] || {}).xp || 0 })); }
function bonusGeneral(e, hab) {
    if (!e || !e.general) return 1;
    if (e.dono !== 'jogador') return hab === 'atq' || hab === 'def' ? 1.12 : 1; // general dos bots: +12% fixo
    const g = GENERAIS.find(x => x.id === e.general); if (!g || g.hab !== hab) return 1;
    const nv = nivelGeneral(((lerMeta().generais[g.id] || {}).xp || 0) + ((G.genXp || {})[g.id] || 0));
    const base = { atq: 0.2, def: 0.25, vel: 0.35, log: 0.5, art: 1 }[hab];
    return 1 + base * (1 + 0.15 * (nv - 1));
}
function designarGeneral(exId, genId) {
    const e = G.ex.find(x => x.id === exId); if (!e || e.dono !== 'jogador') return;
    G.ex.forEach(x => { if (x.general === genId) x.general = null; });
    if ((G.genFerido[genId] || 0) > G.t) return;
    e.general = genId || null;
    if (genId) { noticia(`🎖 ${GENERAIS.find(g => g.id === genId).nome} assumiu o exército.`); som('ordem'); }
}
function generalVenceu(e) {
    if (!e || e.dono !== 'jogador' || !e.general) return;
    G.genXp = G.genXp || {}; G.genXp[e.general] = (G.genXp[e.general] || 0) + 1;
}
function generalCaiu(e) {
    if (!e || e.dono !== 'jogador' || !e.general) return;
    G.genFerido[e.general] = G.t + 60;
    noticia(`🎖 ${GENERAIS.find(g => g.id === e.general).nome} foi ferido e volta em 60s.`, true);
    e.general = null;
}
// fim da fase: guarda o que os generais aprenderam e as estrelas
function guardarProgresso(estrelas) {
    const m = lerMeta();
    Object.entries(G.genXp || {}).forEach(([id, xp]) => { m.generais[id] = { xp: ((m.generais[id] || {}).xp || 0) + xp }; });
    m.estrelas[G.fase.n] = Math.max(m.estrelas[G.fase.n] || 0, estrelas);
    gravarMeta(m);
}

/* ---------- Campanha: capítulos e estrelas ----------
   ★ vencer · ★★ vencer usando até 70% do tempo · ★★★ objetivo da fase */
const OBJETIVOS = {
    semPerder: { txt: 'não perder nenhuma província para o inimigo', ok: () => (G.stats.perdidas || 0) === 0 },
    capitais:  { txt: 'tomar todas as capitais (vitória total)', ok: () => G.fim === 'vitoria' },
    baixas:    { txt: 'perder menos de 20 soldados', ok: () => (G.stats.baixas || 0) < 20 },
    rebeldes:  { txt: 'nenhuma província sua se revoltar', ok: () => (G.stats.revoltas || 0) === 0 },
    pesquisa:  { txt: 'terminar 4 pesquisas', ok: () => Object.keys(G.pesq.jogador.feitas).length >= 4 }
};
function calcularEstrelas() {
    if (G.fim !== 'vitoria' && G.fim !== 'pontos') return 0;
    let e = 1;
    if (G.t <= G.fase.tempo * 0.7 && G.fim === 'vitoria') e++;
    if (OBJETIVOS[G.fase.objetivo].ok()) e++;
    return e;
}
const faseLiberada = (n) => n === 1 || (lerMeta().estrelas[n - 1] || 0) >= 1;

/* ---------- Painéis novos ---------- */
// Ficha de cada tropa: barras de vida, ataque, defesa, corpo a corpo e velocidade, o alcance e contra quem é forte ou fraca
const UNID_INFO = {
    inf:   { papel: 'Tropa básica: serve para tudo e não precisa de pesquisa.', vant: ['Barata e rápida de recrutar', 'Equilibrada em ataque e defesa'], desv: ['Fura pouco o blindado (só 35% do dano)', 'Perde no corpo a corpo para cavalaria e blindado'] },
    metr:  { papel: 'Tropa de defesa: segura a trincheira e é a pior inimiga da cavalaria.', vant: ['Defesa dobrada (2.0): ótima para guardar província', 'Causa +70% de dano na cavalaria'], desv: ['Ataca pouco (0.6) e é fraca no corpo a corpo', 'Lenta (0.8) e precisa de pesquisa'] },
    art:   { papel: 'Tropa de apoio: bate de longe e fura trincheira e blindado.', vant: ['Atira de longe: começa a causar dano antes', 'Maior ataque (1.6)', 'Fura blindado (+50% de dano)'], desv: ['Quase não luta de perto (corpo a corpo 0.3)', 'Defesa baixa (0.8) e lenta (0.7)', 'Cavalaria causa +60% de dano nela'] },
    cav:   { papel: 'Tropa de ataque rápido: chega primeiro e vence no corpo a corpo.', vant: ['A mais rápida (1.6)', 'Melhor corpo a corpo (1.6)', 'Causa +60% de dano na artilharia'], desv: ['Defesa baixa (0.7)', 'Metralhadora causa +70% de dano nela', 'Fura pouco o blindado'] },
    blind: { papel: 'Tropa pesada: aguenta o que vier, mas só a artilharia a fura.', vant: ['Vida 240: aguenta mais que o dobro', 'Recebe só 35% do dano de tiro'], desv: ['Cara (65 moedas) e precisa de pesquisa', 'Artilharia causa +50% de dano nela', 'Ataque médio (0.9)'] }
};
const UNID_STATS = [['❤', 'Vida', (T) => T.vida, 240], ['⚔', 'Ataque', (T) => T.atq, 1.6], ['🛡', 'Defesa', (T) => T.def, 2], ['🥊', 'Corpo a corpo', (T) => T.corpo, 1.6], ['👟', 'Velocidade', (T) => T.vel, 1.6]];
// Ficha de cada tropa: o que ela é, vantagens e desvantagens, e o confronto contra cada outra tropa (dano que causa × dano que recebe)
function fichaTropa(t) {
    const T = TROPAS[t], I = UNID_INFO[t], ids = Object.keys(TROPAS).filter(x => x !== t);
    const linhas = ids.map(b => {
        const B = TROPAS[b], causa = danoContra(t, b), recebe = danoContra(b, t), nota = (causa / recebe) * Math.pow(T.corpo / B.corpo, 0.25);
        const v = nota > 1.25 ? ['forte', 'FORTE', '#7bc96f'] : nota < 0.8 ? ['fraca', 'FRACA', '#e0705f'] : ['par', 'PAREJO', '#c9b46a'];
        return `<div class="fm"><span>${B.icone} ${B.nome}</span><span>causa ×${causa.toFixed(2).replace(/\.?0+$/, '')} · recebe ×${recebe.toFixed(2).replace(/\.?0+$/, '')}</span><b style="color:${v[2]}">${v[1]}</b></div>`;
    }).join('');
    return `<div class="ficha"><div class="fp">${I.papel}</div>${UNID_STATS.map(([i, n, f, max]) => `<div class="fl"><span>${i} ${n}</span><span class="fb"><i style="width:${Math.min(100, Math.round(100 * f(T) / max))}%"></i></span><b>${f(T)}</b></div>`).join('')}
        <div class="fx">🎯 Alcance: <b>${T.longe ? 'longo (atira de longe)' : 'curto'}</b> · custo <b>${T.custo}🪙</b></div>
        <div class="fv"><b style="color:#7bc96f">+ Vantagens</b>${I.vant.map(x => `<div>• ${x}</div>`).join('')}</div>
        <div class="fv"><b style="color:#e0705f">− Desvantagens</b>${I.desv.map(x => `<div>• ${x}</div>`).join('')}</div>
        <div class="fv"><b>⚔ Contra cada tropa</b>${linhas}<small>×1 = dano normal. Pesa também o corpo a corpo.</small></div></div>`;
}
// Painel de vida do exército: por tipo (média, mais ferido) e uma barrinha para cada soldado
function painelVidaTropas(e) {
    const grupos = {}; e.s.forEach(x => { const t = x.tipo || 'inf'; (grupos[t] = grupos[t] || []).push(x); });
    const pct = (x) => Math.max(0, Math.min(100, Math.round(100 * x.vida / vidaMax(x)))), cor = (v) => v > 66 ? '#7bc96f' : v > 33 ? '#e3b04b' : '#e0533f';
    let h = '<div class="pv"><div class="pvt">❤ Vida da tropa</div>';
    Object.entries(grupos).forEach(([t, l]) => {
        const ps = l.map(pct), med = Math.round(ps.reduce((a, b) => a + b, 0) / ps.length), pior = Math.min(...ps), fer = ps.filter(v => v < 50).length;
        h += `<div class="pvl"><span>${TROPAS[t].icone} ${TROPAS[t].nome} ×${l.length} <button class="info-i" onclick="G.fichaTipo=G.fichaTipo==='${t}'?null:'${t}';renderPainel()" title="Ficha da tropa">ℹ</button></span><span class="fb"><i style="width:${med}%;background:${cor(med)}"></i></span><b style="color:${cor(med)}">${med}%</b></div>
            <div class="pvs">${fer ? `${fer} ferido${fer > 1 ? 's' : ''} · ` : ''}pior: ${pior}%</div>`;
        if (G.fichaTipo === t) h += fichaTropa(t);
        h += `<div class="pvg">${l.map(x => { const v = pct(x); return `<span class="pvb" title="${x.nome}: ${v}% de vida"><i style="height:${v}%;background:${cor(v)}"></i></span>`; }).join('')}</div>`;
    });
    return h + '</div>';
}
function painelRecrutar(provId) {
    const p = G.prov[provId], f = G.fac.jogador;
    let h = `<div class="titulo"><span>🪖 Recrutar em ${p.nome}</span><span class="dono">${tropaDe('jogador')} na tropa</span></div><div class="lista-tropas">`;
    Object.entries(TROPAS).forEach(([t, T]) => {
        const lib = tropaLiberada('jogador', t), c1 = custoRecrutarTipo('jogador', t), c5 = custoVariosTipo('jogador', t, 5);
        h += `<div class="linha-tropa${lib ? '' : ' trancada'}"><div class="txt"><b>${T.icone} ${T.nome} <button class="info-i" onclick="G.fichaTipo=G.fichaTipo==='${t}'?null:'${t}';renderPainel()" title="Ficha da tropa">ℹ</button></b><small>${lib ? T.txt : '🔒 pesquise ' + PESQUISAS[T.pesquisa].nome}</small></div>
            ${lib ? `<button class="mini" onclick="recrutar('${p.id}',1,'${t}');renderPainel()" ${f.moedas < c1 ? 'disabled' : ''}>+1<small>${c1}🪙</small></button><button class="mini" onclick="recrutar('${p.id}',5,'${t}');renderPainel()" ${f.moedas < c5 ? 'disabled' : ''}>+5<small>${c5}🪙</small></button>` : ''}</div>${G.fichaTipo === t ? fichaTropa(t) : ''}`;
    });
    return h + `</div><div class="acoes">${botao('← Voltar', '', `G.sel={tipo:'prov',id:'${p.id}'};renderPainel()`)}</div>`;
}
function painelObras(provId) {
    const p = G.prov[provId], f = G.fac.jogador;
    let h = `<div class="titulo"><span>🏗 Obras em ${p.nome}</span><span class="dono">${p.obra ? `${OBRAS[p.obra.id].icone} faltam ${Math.ceil(p.obra.resta)}s` : 'nenhuma em andamento'}</span></div><div class="lista-tropas">`;
    Object.entries(OBRAS).forEach(([id, O]) => {
        const feito = p.obras[id], c = custoObra('jogador', id);
        h += `<div class="linha-tropa${feito ? ' trancada' : ''}"><div class="txt"><b>${O.icone} ${O.nome}</b><small>${feito ? '✔ pronto' : O.txt + ` · ${Math.round(O.tempo * (temPesq('jogador', 'concreto') ? 0.7 : 1))}s`}</small></div>
            ${feito ? '' : `<button class="mini" onclick="construir('${p.id}','${id}');renderPainel()" ${p.obra || f.moedas < c ? 'disabled' : ''}>Construir<small>${c}🪙</small></button>`}</div>`;
    });
    return h + `</div><div class="acoes">${botao('← Voltar', '', `G.sel={tipo:'prov',id:'${p.id}'};renderPainel()`)}</div>`;
}
function painelPesquisa() {
    const st = G.pesq.jogador, f = G.fac.jogador;
    let h = `<div class="titulo"><span>🔬 Pesquisa</span><span class="dono">${st.atual ? `${PESQUISAS[st.atual.id].nome}: ${Math.ceil(st.atual.resta)}s` : 'nenhuma em andamento'}</span></div><div class="lista-tropas">`;
    Object.entries(PESQUISAS).forEach(([id, P]) => {
        const feita = st.feitas[id], disp = pesquisaDisponivel('jogador', id);
        h += `<div class="linha-tropa${feita || !disp ? ' trancada' : ''}"><div class="txt"><b>${feita ? '✔ ' : ''}${P.nome}</b><small>${P.txt}${P.req && !feita ? ' · precisa de ' + P.req.map(r => PESQUISAS[r].nome).join(' e ') : ''}</small></div>
            ${feita || !disp ? '' : `<button class="mini" onclick="pesquisar('${id}');renderPainel()" ${st.atual || f.moedas < P.custo ? 'disabled' : ''}>${P.tempo}s<small>${P.custo}🪙</small></button>`}</div>`;
    });
    return h + `</div><div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`;
}
function painelDiplomacia() {
    let h = `<div class="titulo"><span>🤝 Diplomacia</span><span class="dono">bots brigam entre si</span></div><div class="lista-tropas">`;
    G.fase.bots.forEach(bot => {
        const r = G.rel[bot], FX = FACCOES[bot], pl = placar()[bot] || 0, f = G.fac.jogador;
        if (G.eliminados[bot]) { h += `<div class="linha-tropa trancada"><div class="txt"><b style="color:${FX.cor}">${FX.nome}</b><small>☠ rendido</small></div></div>`; return; }
        const espera = G.t < r.recusaAte ? ` · espera ${Math.ceil(r.recusaAte - G.t)}s` : '';
        h += `<div class="linha-tropa"><div class="txt"><b style="color:${FX.cor}">${FX.nome}</b> ${DIPLO_TXT[r.estado]}${r.estado === 'paz' ? ` (${Math.ceil(r.ate - G.t)}s)` : ''}<small>${pl} províncias · ${FX.perso}${espera}</small></div>`;
        if (r.estado === 'guerra') h += `<button class="mini" onclick="propor('${bot}','paz');renderPainel()" ${G.t < r.recusaAte || f.moedas < custoPaz(bot) ? 'disabled' : ''}>Paz<small>${custoPaz(bot)}🪙</small></button>`;
        if (r.estado === 'paz') h += `<button class="mini" onclick="propor('${bot}','alianca');renderPainel()" ${G.t < r.recusaAte ? 'disabled' : ''}>Aliança<small>grátis</small></button>`;
        if (r.estado !== 'guerra') h += `<button class="mini" onclick="declararGuerra('${bot}');renderPainel()">Guerra<small>romper</small></button>`;
        h += '</div>';
    });
    return h + `</div><div class="info">Paz: ninguém ataca ninguém por 4 minutos e as tropas podem passar pelo território. Aliança: igual, sem prazo, e vocês veem o território um do outro. Agressivos e oportunistas às vezes traem.</div>
        <div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`;
}
function painelGenerais() {
    const lib = generaisLiberados(), m = lerMeta(), tot = totalEstrelas(m);
    let h = `<div class="titulo"><span>🎖 Generais</span><span class="dono">${tot} ★ na campanha</span></div><div class="lista-tropas">`;
    GENERAIS.forEach(g => {
        const L = lib.find(x => x.id === g.id), xp = (L ? L.xp : 0) + ((G.genXp || {})[g.id] || 0), nv = nivelGeneral(xp);
        const comQuem = G.ex.find(e => e.general === g.id), ferido = (G.genFerido[g.id] || 0) > G.t;
        h += `<div class="linha-tropa${L ? '' : ' trancada'}"><div class="txt"><b>${g.nome}${L ? ` · nível ${nv}` : ''}</b><small>${L ? g.txt + (ferido ? ` · 🩹 ferido (${Math.ceil(G.genFerido[g.id] - G.t)}s)` : comQuem ? ` · com ${comQuem.s.length} soldados em ${G.prov[comQuem.prov].nome}` : ' · sem exército') : `🔒 junte ${g.estrelas} ★ na campanha`}</small></div></div>`;
    });
    return h + `</div><div class="info">Para usar: toque num exército seu e em 🎖 General. Cada batalha vencida dá experiência; a cada 3 o general sobe de nível (até 5).</div>
        <div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`;
}
function painelEscolherGeneral(exId) {
    const lib = generaisLiberados();
    let h = `<div class="titulo"><span>🎖 Escolher general</span></div><div class="lista-tropas">`;
    lib.forEach(g => {
        const ferido = (G.genFerido[g.id] || 0) > G.t, comQuem = G.ex.find(e => e.general === g.id && e.id !== exId);
        h += `<div class="linha-tropa${ferido ? ' trancada' : ''}"><div class="txt"><b>${g.nome} · nível ${nivelGeneral(g.xp + ((G.genXp || {})[g.id] || 0))}</b><small>${g.txt}${ferido ? ' · 🩹 ferido' : comQuem ? ' · sai de outro exército' : ''}</small></div>
            ${ferido ? '' : `<button class="mini" onclick="designarGeneral('${exId}','${g.id}');G.sel={tipo:'ex',id:'${exId}'};renderPainel()">Escolher</button>`}</div>`;
    });
    return h + `</div><div class="acoes">${botao('Sem general', '', `designarGeneral('${exId}',null);G.sel={tipo:'ex',id:'${exId}'};renderPainel()`)}${botao('← Voltar', '', `G.sel={tipo:'ex',id:'${exId}'};renderPainel()`)}</div>`;
}
const composicao = (s) => Object.entries(s.reduce((t, x) => (t[x.tipo || 'inf'] = (t[x.tipo || 'inf'] || 0) + 1, t), {})).map(([t, n]) => `${TROPAS[t].icone}${n}`).join(' ');
