// FrontLine · modo CONQUISTA (fase 1)
// Página própria (conquista.html). O modo Trincheiras e o Trincheiras online não mudam.
/* ==========================================================================
   FrontLine · CONQUISTA (protótipo da fase 1)
   Mapa com províncias. Cada uma tem soldados que precisam comer. Os bots seguem as mesmas
   regras, atacam de vez em quando (você e uns aos outros) e erram: esquecem de alimentar a tropa,
   deixam a casa vazia, atacam alvos fortes demais. Espião mostra quem está atacando quem.
   Batalha: até 2 minutos, na trincheira; o mapa para enquanto você luta.
   ========================================================================== */
// Silhuetas dos soldados: as mesmas do modo Trincheiras (assets/soldados)
const SPRITES = { mira: { w: 170, h: 211, ax: 62, ay: 208 }, andando: { w: 142, h: 197, ax: 87, ay: 193 } };
const IMG = {};
Object.keys(SPRITES).forEach(k => { const im = new Image(); im.src = 'assets/soldados/' + k + '.png'; IMG[k] = im; });

// ---------- Equilíbrio ----------
const C = {
    CICLO: 5,                 // segundos de mapa por ciclo de economia
    PROD: { comida: 3, mun: 6, moedas: 4 },  // por província por ciclo
    FOME_CICLO: 5, COME_SE: 30, COME_ALIVIA: 35,
    RECRUTAR: 25, RECRUTAR_EXTRA: 6, TROPA_BASE: 8, MAX_GUARNICAO: 12, // cada soldado acima de 8 encarece o próximo em 6 moedas (freia a bola de neve)
    ESPIAO: 15, ESPIAO_DURA: 45, ARTILHARIA: 30, SAQUE_TROPA: 2,
    MARCHA: 8,                // segundos de mapa até a tropa chegar
    BAT_DURACAO: 120,         // batalha de até 2 minutos
    DIST: 300, VEL: { avancar: 14, cobertura: 6, recuar: -12 },
    // Tiros acertam ou erram: cada soldado tem chance por segundo de acertar (cai com fome e cansaço)
    TIRO_DEF: 0.18, TIRO_ATQ: 0.16, DANO_TIRO: 30, TRINCH_PROTEGE: 0.35, CORPO_A_CORPO: 0.45,
    BOT_PENSA: 10, BOT_PENSA_VAR: 8, // bots decidem a cada 10 a 18 segundos (recrutar e defender: sempre)
    BOT_PAUSA_ATAQUE: 45,     // depois de atacar ou saquear, o bot espera pelo menos 45 s para mandar tropa de novo
    BOT_MARGEM: 1.35,         // só ataca quando acha que tem 35% a mais de força (com erro de conta)
    MILICIA: 5,               // soldados de cada província livre (Eco e Foxtrot)
    QG_PROD: 2,               // Alfa, o seu QG, produz em dobro (você começa com 1 província contra 3)
    QG_DEFESA: 1.35,          // Alfa, o seu QG, defende 35% melhor
    FASE_LIMITE: 900          // 15 minutos (mapa de 6 províncias): depois disso chega o reforço inimigo e a fase termina
};
const NOMES_JOG = ['Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Mendes', 'Rocha', 'Lima', 'Souza', 'Alves', 'Pereira', 'Nunes', 'Barros', 'Dias'];
const FACCOES = {
    jogador: { nome: 'Você', cor: '#7bc96f' },
    bravo:   { nome: 'Bravo', cor: '#e0533f', perso: 'agressivo', esquece: 0.25, coragem: 0.9, vontade: 0.5 }, // vontade: chance de pensar em atacar quando pode
    charlie: { nome: 'Charlie', cor: '#e3a23b', perso: 'ladrão',   esquece: 0.12, coragem: 1.2, vontade: 0.4 },
    delta:   { nome: 'Delta', cor: '#a77bd9', perso: 'defensivo', esquece: 0.05, coragem: 1.8, vontade: 0.3 },
    neutro:  { nome: 'Milícia', cor: '#9a9a86', perso: 'neutra', esquece: 0, coragem: 99 } // províncias livres: não atacam, só se defendem
};
const PERSO_TXT = { agressivo: 'agressivo: ataca mais que os outros e às vezes deixa a casa vazia', 'ladrão': 'ladrão: vive saqueando', defensivo: 'defensivo: se fecha e engorda o tesouro', neutra: 'milícia local: não ataca ninguém, só se defende. Quem chegar primeiro leva.' };

let G;
function soldado(nome) { return { nome, vida: 100, fome: 10, cansaco: 0 }; }
function novoJogo() {
    G = {
        t: 0, fim: null, selecionada: 'alfa', marchas: [], noticias: [], espiado: {}, ultimoAtaque: {}, batalha: null, autoBatalhas: [], ultimoAviso: '',
        fac: {
            jogador: { comida: 30, mun: 150, moedas: 40 },
            bravo:   { comida: 25, mun: 140, moedas: 30 },
            charlie: { comida: 25, mun: 140, moedas: 40 },
            delta:   { comida: 40, mun: 180, moedas: 60 },
            neutro:  { comida: 0, mun: 120, moedas: 40 }
        },
        prov: {
            alfa:    { id: 'alfa',    nome: 'Alfa',    dono: 'jogador', x: 200, y: 330, viz: ['bravo', 'charlie', 'eco', 'foxtrot'], qg: true },
            bravo:   { id: 'bravo',   nome: 'Bravo',   dono: 'bravo',   x: 90,  y: 200, viz: ['alfa', 'charlie', 'delta', 'eco'] },
            charlie: { id: 'charlie', nome: 'Charlie', dono: 'charlie', x: 310, y: 200, viz: ['alfa', 'bravo', 'delta', 'foxtrot'] },
            delta:   { id: 'delta',   nome: 'Delta',   dono: 'delta',   x: 200, y: 70,  viz: ['bravo', 'charlie'], capital: true },
            eco:     { id: 'eco',     nome: 'Eco',     dono: 'neutro',  x: 62,  y: 345, viz: ['alfa', 'bravo'] },
            foxtrot: { id: 'foxtrot', nome: 'Foxtrot', dono: 'neutro',  x: 338, y: 345, viz: ['alfa', 'charlie'] }
        },
        pensar: { bravo: 70, charlie: 85, delta: 110 }, ciclo: 0   // os bots começam a agir depois de ~1 minuto e pouco
    };
    let n = 0;
    Object.values(G.prov).forEach(p => {
        p.trinch = 100;
        const qtd = p.capital ? 10 : p.dono === 'neutro' ? C.MILICIA : 8;
        p.soldados = Array.from({ length: qtd }, () => soldado(p.dono === 'jogador' ? NOMES_JOG[n++ % NOMES_JOG.length] : 'Inimigo'));
    });
    noticia('Defenda Alfa e conquiste o mapa. Eco e Foxtrot são livres: quem chegar primeiro leva.');
}
const vivosDe = (p) => p.soldados.filter(s => s.vida > 0);
const tropaDe = (dono) => Object.values(G.prov).filter(p => p.dono === dono).reduce((t, p) => t + vivosDe(p).length, 0) + G.marchas.filter(m => m.dono === dono).reduce((t, m) => t + m.tropa.length, 0);
const custoRecrutar = (dono) => C.RECRUTAR + C.RECRUTAR_EXTRA * Math.max(0, tropaDe(dono) - C.TROPA_BASE);
const minhas = () => Object.values(G.prov).filter(p => p.dono === 'jogador');
const eficacia = (s) => (s.vida / 100) * (1 - 0.55 * Math.max(0, s.fome - 40) / 60) * (1 - 0.3 * s.cansaco / 100);
const forca = (lista) => lista.reduce((t, s) => t + eficacia(s), 0);
const corFome = (s) => s.vida <= 0 ? '#444' : s.fome >= 75 ? '#e0533f' : s.fome >= 50 ? '#e3b04b' : '#7bc96f';
function noticia(txt, alerta) { G.noticias.unshift({ txt, alerta, t: G.t }); G.noticias = G.noticias.slice(0, 20); }

/* ---------- Economia: produção e comida (a cada ciclo) ---------- */
function cicloEconomia() {
    G.ciclo++;
    Object.values(G.prov).filter(p => p.dono !== 'neutro').forEach(p => { const f = G.fac[p.dono], k = p.id === 'alfa' && p.dono === 'jogador' ? C.QG_PROD : 1; f.comida += C.PROD.comida * k; f.mun += C.PROD.mun * k; f.moedas += C.PROD.moedas * k; });
    Object.keys(G.fac).filter(d => d !== 'neutro').forEach(dono => {
        const f = G.fac[dono], FX = FACCOES[dono];
        const esquece = dono !== 'jogador' && Math.random() < FX.esquece; // bot erra: esquece de alimentar a tropa
        Object.values(G.prov).filter(p => p.dono === dono).forEach(p => vivosDe(p).forEach(s => {
            s.fome = Math.min(100, s.fome + C.FOME_CICLO);
            if (!esquece && s.fome >= C.COME_SE && f.comida >= 1) { f.comida -= 1; s.fome = Math.max(0, s.fome - C.COME_ALIVIA); }
            if (s.fome >= 90) s.vida -= 4;                 // passando fome de verdade
            else if (s.fome < 50) s.vida = Math.min(100, s.vida + 3);
            s.cansaco = Math.max(0, s.cansaco - 6);
        }));
        if (esquece && Object.values(G.prov).some(p => p.dono === dono) && G.espiado[dono]) noticia(`👁 Espião: ${FACCOES[dono].nome} esqueceu de alimentar a tropa.`);
    });
    Object.values(G.prov).forEach(p => { p.soldados = p.soldados.filter(s => s.vida > 0); p.trinch = Math.min(100, p.trinch + 2); });
}

/* ---------- Ações do jogador ---------- */
function recrutar(id) {
    const p = G.prov[id], f = G.fac.jogador, custo = custoRecrutar('jogador');
    if (p.dono !== 'jogador' || f.moedas < custo || vivosDe(p).length >= C.MAX_GUARNICAO) return;
    f.moedas -= custo;
    p.soldados.push(soldado(NOMES_JOG[Math.floor(Math.random() * NOMES_JOG.length)]));
    noticia(`🪖 Novo soldado em ${p.nome}.`);
}
function espionar(id) {
    const p = G.prov[id], f = G.fac.jogador;
    if (p.dono === 'jogador' || f.moedas < C.ESPIAO) return;
    f.moedas -= C.ESPIAO;
    G.espiado[p.dono] = G.t + C.ESPIAO_DURA;
    noticia(`👁 Espião infiltrado em ${FACCOES[p.dono].nome} por ${C.ESPIAO_DURA}s: você vê a tropa, a fome, o tesouro e os ataques dele.`);
}
// Envia tropa: ataque (conquistar) ou saque (roubar moedas)
function enviar(deId, paraId, qtd, tipo) {
    const de = G.prov[deId], para = G.prov[paraId];
    const disponiveis = vivosDe(de).sort((a, b) => eficacia(b) - eficacia(a));
    qtd = Math.min(qtd, disponiveis.length - (de.dono === 'jogador' ? 1 : 0)); // sempre fica pelo menos 1 em casa (o jogador)
    if (qtd < 1) return false;
    const tropa = disponiveis.slice(0, qtd);
    de.soldados = de.soldados.filter(s => !tropa.includes(s));
    G.marchas.push({ de: deId, para: paraId, dono: de.dono, tropa, tipo, chega: G.t + C.MARCHA, inicio: G.t });
    if (de.dono === 'jogador') noticia(`${tipo === 'saque' ? '💰 Saque' : '⚔️ Ataque'} a caminho de ${para.nome} com ${qtd} soldados.`);
    else if (para.dono === 'jogador') noticia(`🚨 ${FACCOES[de.dono].nome} está marchando sobre ${para.nome}! Chega em ${C.MARCHA}s.`, true);
    return true;
}

/* ---------- Bots: pensam, erram, defendem sempre e atacam de vez em quando ---------- */
function pensarBot(dono) {
    const FX = FACCOES[dono], f = G.fac[dono];
    const minhasProv = Object.values(G.prov).filter(p => p.dono === dono);
    if (!minhasProv.length) return;
    // recruta se dá
    { const p = minhasProv.sort((a, b) => vivosDe(a).length - vivosDe(b).length)[0], custo = custoRecrutar(dono); // um recruta por vez, onde está mais vazio
      if (f.moedas >= custo && vivosDe(p).length < (p.capital ? 10 : 8) && Math.random() < 0.7) { f.moedas -= custo; p.soldados.push(soldado('Inimigo')); } }
    // atacar: só depois da pausa do último ataque e nem sempre (a defesa não depende disto)
    if (G.t < (G.ultimoAtaque[dono] || 0) + C.BOT_PAUSA_ATAQUE || Math.random() > FX.vontade) return;
    // escolhe um alvo vizinho (de outra facção), com erro de avaliação
    const casa = minhasProv.sort((a, b) => vivosDe(b).length - vivosDe(a).length)[0];
    const alvos = casa.viz.map(id => G.prov[id]).filter(p => p.dono !== dono && !G.marchas.some(m => m.de === casa.id));
    if (!alvos.length) return;
    const alvo = alvos.sort((a, b) => forca(vivosDe(a)) - forca(vivosDe(b)))[Math.random() < 0.7 ? 0 : alvos.length - 1];
    const minhaForca = forca(vivosDe(casa)), dele = forca(vivosDe(alvo)) * (1 + (Math.random() - 0.5) * 0.6); // erra a conta
    const deixar = FX.perso === 'agressivo' ? (Math.random() < 0.3 ? 1 : 3) : 4;                            // agressivo às vezes deixa a casa quase vazia (erro)
    const mandar = Math.max(1, vivosDe(casa).length - deixar);
    if (FX.perso === 'ladrão' && mandar >= 2 && Math.random() < 0.5) { if (enviar(casa.id, alvo.id, Math.min(3, mandar), 'saque')) G.ultimoAtaque[dono] = G.t; return; }
    if (minhaForca * (mandar / Math.max(1, vivosDe(casa).length)) > dele * FX.coragem * C.BOT_MARGEM || (FX.perso === 'agressivo' && Math.random() < 0.08)) { if (enviar(casa.id, alvo.id, mandar, 'ataque')) G.ultimoAtaque[dono] = G.t; }
}

/* ---------- Batalha: até 2 minutos na trincheira ---------- */
function criarBatalha(m) {
    const alvo = G.prov[m.para];
    const saque = m.tipo === 'saque';
    const defensores = saque ? vivosDe(alvo).slice(0, C.SAQUE_TROPA + 1) : vivosDe(alvo); // saque pega só a guarda da periferia
    const b = {
        marcha: m, alvo, saque, t: 0, terminou: false, vencedor: null,
        atq: m.tropa.map(s => ({ s, dist: C.DIST, x: 60 + Math.random() * 280 })),
        def: defensores.map((s, i) => ({ s, x: 50 + i * (300 / Math.max(1, defensores.length - 1 || 1)) })),
        postAtq: 'avancar', postDef: 'equilibrio', efeitos: [], rapido: false
    };
    b.passo = (dt) => passoBatalha(b, dt);
    return b;
}
function passoBatalha(b, dt) {
    if (b.terminou) return;
    b.t += dt;
    const fa = G.fac[b.marcha.dono], fd = G.fac[b.alvo.dono];
    const atqVivos = b.atq.filter(a => a.s.vida > 0), defVivos = b.def.filter(d => d.s.vida > 0);
    const vel = C.VEL[b.postAtq];
    atqVivos.forEach(a => { a.dist = Math.min(C.DIST, a.dist - vel * dt); });
    const pd = b.postDef === 'abrigar' ? { dano: 0.5, rec: 0.5 } : b.postDef === 'atacar' ? { dano: 1.4, rec: 1.3 } : { dano: 1, rec: 1 };
    const exposicao = b.postAtq === 'cobertura' ? 0.5 : 1;
    const dano = () => C.DANO_TIRO * (0.7 + 0.6 * Math.random());
    // defesa atira em quem está no campo
    const noCampo = atqVivos.filter(a => a.dist > 0 && a.dist < 260);
    if (noCampo.length && defVivos.length) {
        const munD = fd.mun > 0 ? 1 : 0.3;
        const qg = b.alvo.qg ? C.QG_DEFESA : 1;
        defVivos.forEach(d => { if (Math.random() < C.TIRO_DEF * eficacia(d.s) * pd.dano * exposicao * munD * qg * dt) noCampo[Math.floor(Math.random() * noCampo.length)].s.vida -= dano(); });
        fd.mun = Math.max(0, fd.mun - defVivos.length * 0.8 * dt);
    }
    // ataque atira avançando (a trincheira protege a defesa); quem chegou luta corpo a corpo
    if (defVivos.length) {
        const munA = fa.mun > 0 ? 1 : 0.3;
        atqVivos.filter(a => a.dist < 220).forEach(a => {
            const corpo = a.dist <= 0;
            const chance = corpo ? C.CORPO_A_CORPO * eficacia(a.s) * pd.rec
                : C.TIRO_ATQ * (b.postAtq === 'cobertura' ? 0.6 : 1) * eficacia(a.s) * munA * (1 - C.TRINCH_PROTEGE * b.alvo.trinch / 100) * pd.rec;
            if (Math.random() < chance * dt) defVivos[Math.floor(Math.random() * defVivos.length)].s.vida -= dano();
        });
        fa.mun = Math.max(0, fa.mun - atqVivos.length * 0.6 * dt);
    }
    // quem chega na trincheira também apanha corpo a corpo
    const naTrincheira = atqVivos.filter(a => a.dist <= 0);
    if (naTrincheira.length && defVivos.length) defVivos.forEach(d => { if (Math.random() < C.CORPO_A_CORPO * eficacia(d.s) * dt) naTrincheira[Math.floor(Math.random() * naTrincheira.length)].s.vida -= dano(); });
    b.atq.forEach(a => { if (a.s.vida <= 0 && !a.morto) { a.morto = true; b.efeitos.push({ x: a.x, y: a.dist, vida: 0.6, tipo: 'abate' }); } });
    b.def.forEach(d => { if (d.s.vida <= 0 && !d.morto) { d.morto = true; b.efeitos.push({ x: d.x, y: -1, vida: 0.6, tipo: 'abate' }); } });
    const sobraA = b.atq.filter(a => a.s.vida > 0), sobraD = b.def.filter(d => d.s.vida > 0);
    if (!sobraD.length && sobraA.length) { b.terminou = true; b.vencedor = 'atq'; }
    else if (!sobraA.length) { b.terminou = true; b.vencedor = 'def'; }
    else if (b.postAtq === 'recuar' && sobraA.every(a => a.dist >= C.DIST)) { b.terminou = true; b.vencedor = 'def'; b.recuou = true; }
    else if (b.t >= C.BAT_DURACAO) { b.terminou = true; b.vencedor = 'def'; b.tempo = true; }
}
function artilhariaNaBatalha(b, lado) {
    const f = G.fac.jogador;
    if (f.moedas < C.ARTILHARIA || b.usouArt) return;
    f.moedas -= C.ARTILHARIA; b.usouArt = true;
    const alvos = lado === 'atq' ? b.def : b.atq;
    alvos.filter(x => x.s.vida > 0).forEach(x => { x.s.vida -= 35; b.efeitos.push({ x: x.x, y: lado === 'atq' ? -1 : x.dist, vida: 0.8, tipo: 'explosao' }); });
}
// Fecha a batalha: conquista, saque, volta para casa e cansaço
function concluirBatalha(b) {
    const m = b.marcha, alvo = b.alvo, fa = G.fac[m.dono], fd = G.fac[alvo.dono];
    const sobreviventes = b.atq.filter(a => a.s.vida > 0).map(a => a.s);
    sobreviventes.forEach(s => { s.cansaco = Math.min(100, s.cansaco + 30); });
    vivosDe(alvo).forEach(s => { s.cansaco = Math.min(100, s.cansaco + 20); });
    alvo.soldados = alvo.soldados.filter(s => s.vida > 0);
    const nomeA = FACCOES[m.dono].nome, nomeD = FACCOES[alvo.dono].nome;
    const envolveJog = m.dono === 'jogador' || alvo.dono === 'jogador';
    const visivel = envolveJog || G.espiado[m.dono] > G.t || G.espiado[alvo.dono] > G.t;
    if (b.vencedor === 'atq' && b.saque) {
        const roubo = Math.floor(fd.moedas * 0.4);
        fd.moedas -= roubo; fa.moedas += roubo;
        G.prov[m.de].soldados.push(...sobreviventes);
        if (visivel) noticia(`💰 ${nomeA} saqueou ${alvo.nome}: ${roubo} moedas roubadas.`, alvo.dono === 'jogador');
    } else if (b.vencedor === 'atq') {
        // conquista: a província muda de dono; o tesouro e a comida dela vão junto
        const donoAntigo = alvo.dono;
        const levar = { comida: Math.floor(fd.comida * 0.5), mun: Math.floor(fd.mun * 0.5), moedas: Math.floor(fd.moedas * 0.5) };
        if (!Object.values(G.prov).some(p => p !== alvo && p.dono === donoAntigo)) { levar.comida = fd.comida; levar.mun = fd.mun; levar.moedas = fd.moedas; }
        Object.keys(levar).forEach(k => { fd[k] -= levar[k]; fa[k] += levar[k]; });
        alvo.dono = m.dono;
        alvo.soldados = sobreviventes.concat(Array.from({ length: 2 }, () => soldado(m.dono === 'jogador' ? 'Recruta' : 'Inimigo'))); // 2 moradores se juntam
        alvo.trinch = 60;
        if (visivel) noticia(`🏴 ${nomeA} CONQUISTOU ${alvo.nome}! Levou ${levar.moedas} moedas e ${levar.comida} de comida.`, donoAntigo === 'jogador' || m.dono === 'jogador');
    } else {
        G.prov[m.de].soldados.push(...sobreviventes);
        if (visivel) noticia(`🛡️ ${nomeD} segurou o ${b.saque ? 'saque' : 'ataque'} de ${nomeA}${b.recuou ? ' (recuaram)' : b.tempo ? ' (o tempo acabou)' : ''}.`, m.dono === 'jogador');
    }
    verificarFim();
}

/* ---------- Mapa: o tempo anda (parado durante a sua batalha) ---------- */
function passoMapa(dt) {
    if (G.fim || G.batalha) return;
    G.t += dt;
    if (G.t >= C.FASE_LIMITE) { G.fim = 'tempo'; noticia('⏰ O reforço inimigo chegou: a fase terminou.', true); return mostrarFim(); }
    if (Math.floor(G.t / C.CICLO) > G.ciclo) cicloEconomia();
    Object.keys(G.pensar).forEach(dono => { G.pensar[dono] -= dt; if (G.pensar[dono] <= 0) { G.pensar[dono] = C.BOT_PENSA + Math.random() * C.BOT_PENSA_VAR; pensarBot(dono); } });
    // marchas que chegaram
    const chegaram = G.marchas.filter(m => G.t >= m.chega);
    G.marchas = G.marchas.filter(m => G.t < m.chega);
    chegaram.forEach(m => {
        const alvo = G.prov[m.para];
        if (alvo.dono === m.dono) { alvo.soldados.push(...m.tropa); return; } // o alvo já é seu (alguém conquistou antes): só reforça
        if (!vivosDe(alvo).length) { // casa vazia: entra sem luta
            if (m.tipo === 'saque') { const f = G.fac[alvo.dono], r = Math.floor(f.moedas * 0.4); f.moedas -= r; G.fac[m.dono].moedas += r; G.prov[m.de].soldados.push(...m.tropa); return; }
            const b = criarBatalha(m); b.terminou = true; b.vencedor = 'atq'; concluirBatalha(b); return;
        }
        const b = criarBatalha(m);
        if (m.dono === 'jogador' || alvo.dono === 'jogador') {
            if (G.batalha) { while (!b.terminou) b.passo(0.25); concluirBatalha(b); noticia('⚙️ Batalha resolvida sozinha (você estava em outra).'); }
            else abrirBatalha(b);
        } else { while (!b.terminou) b.passo(0.25); concluirBatalha(b); }
    });
}
function verificarFim() {
    const temCasa = G.prov.alfa.dono === 'jogador';
    if (!temCasa) { G.fim = 'derrota'; return mostrarFim(); }
    if (Object.values(G.prov).every(p => p.dono === 'jogador')) { G.fim = 'vitoria'; return mostrarFim(); }
}

/* ---------- Desenho do mapa ---------- */
const cvM = document.getElementById('mapa'), cxM = cvM.getContext('2d');
function ajustar(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); }
window.addEventListener('resize', () => { ajustar(cvM); ajustar(cvB); });
const W = 400, H = 400;
function transformMapa() { const e = Math.min(cvM.width / W, cvM.height / H); return { e, ox: (cvM.width - W * e) / 2, oy: (cvM.height - H * e) / 2 }; }
function desenharMapa() {
    const { e, ox, oy } = transformMapa();
    cxM.setTransform(1, 0, 0, 1, 0, 0); cxM.fillStyle = '#10140f'; cxM.fillRect(0, 0, cvM.width, cvM.height);
    cxM.setTransform(e, 0, 0, e, ox, oy);
    // terreno
    cxM.fillStyle = '#1a2018'; cxM.beginPath(); cxM.roundRect ? cxM.roundRect(8, 8, W - 16, H - 16, 18) : cxM.rect(8, 8, W - 16, H - 16); cxM.fill();
    // estradas
    const feitas = new Set();
    Object.values(G.prov).forEach(p => p.viz.forEach(v => { const k = [p.id, v].sort().join('-'); if (feitas.has(k)) return; feitas.add(k); const q = G.prov[v]; cxM.strokeStyle = '#3a3324'; cxM.lineWidth = 5; cxM.setLineDash([]); cxM.beginPath(); cxM.moveTo(p.x, p.y); cxM.lineTo(q.x, q.y); cxM.stroke(); }));
    // marchas (só vê as suas, as que vêm na sua direção e as dos espionados)
    G.marchas.forEach(m => {
        const vis = m.dono === 'jogador' || G.prov[m.para].dono === 'jogador' || G.espiado[m.dono] > G.t;
        if (!vis) return;
        const a = G.prov[m.de], b = G.prov[m.para], k = Math.min(1, (G.t - m.inicio) / C.MARCHA);
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        cxM.strokeStyle = FACCOES[m.dono].cor; cxM.lineWidth = 2; cxM.setLineDash([4, 4]); cxM.beginPath(); cxM.moveTo(a.x, a.y); cxM.lineTo(b.x, b.y); cxM.stroke(); cxM.setLineDash([]);
        cxM.fillStyle = FACCOES[m.dono].cor; cxM.beginPath(); cxM.arc(x, y, 7, 0, Math.PI * 2); cxM.fill();
        cxM.fillStyle = '#000'; cxM.font = 'bold 9px monospace'; cxM.textAlign = 'center'; cxM.fillText(m.tipo === 'saque' ? '$' : m.tropa.length, x, y + 3);
    });
    // províncias
    Object.values(G.prov).forEach(p => {
        const cor = FACCOES[p.dono].cor, sel = G.selecionada === p.id, r = p.capital ? 40 : 34;
        cxM.fillStyle = cor + '33'; cxM.strokeStyle = sel ? '#ffd28a' : cor; cxM.lineWidth = sel ? 4 : 2.5;
        cxM.beginPath(); cxM.arc(p.x, p.y, r, 0, Math.PI * 2); cxM.fill(); cxM.stroke();
        cxM.fillStyle = '#e8e2d0'; cxM.font = 'bold 13px monospace'; cxM.textAlign = 'center';
        cxM.fillText(p.nome.toUpperCase() + (p.capital ? ' ★' : ''), p.x, p.y - 4);
        cxM.font = '10px monospace'; cxM.fillStyle = cor;
        cxM.fillText(p.dono === 'jogador' || G.espiado[p.dono] > G.t ? `${vivosDe(p).length} sold.` : forcaVaga(p), p.x, p.y + 12);
        if (G.espiado[p.dono] > G.t && p.dono !== 'jogador') { cxM.fillStyle = '#9fd3ff'; cxM.fillText('👁', p.x + r - 6, p.y - r + 10); }
    });
    cxM.textAlign = 'left';
}
function forcaVaga(p) { const n = vivosDe(p).length; return n >= 9 ? 'forte' : n >= 5 ? 'média' : 'fraca'; }
cvM.addEventListener('click', ev => {
    const r = cvM.getBoundingClientRect(), d = cvM.width / r.width, { e, ox, oy } = transformMapa();
    const x = ((ev.clientX - r.left) * d - ox) / e, y = ((ev.clientY - r.top) * d - oy) / e;
    const p = Object.values(G.prov).find(q => Math.hypot(q.x - x, q.y - y) < 44);
    if (p) { G.selecionada = p.id; G.qtd = null; renderPainel(); }
});

/* ---------- Painel da província selecionada ---------- */
function renderPainel() {
    const p = G.prov[G.selecionada], el = document.getElementById('painel'), f = G.fac.jogador;
    const vis = p.dono === 'jogador' || G.espiado[p.dono] > G.t;
    const cor = FACCOES[p.dono].cor;
    let html = `<div class="titulo"><span>${p.nome}${p.capital ? ' ★' : ''}</span><span class="dono" style="color:${cor}">${p.dono === 'jogador' ? 'SUA' : FACCOES[p.dono].nome.toUpperCase() + ' · ' + FACCOES[p.dono].perso}</span></div>`;
    if (vis) {
        html += `<div class="soldados">${vivosDe(p).map(s => `<span class="sd" title="${s.nome}" style="background:${corFome(s)}"></span>`).join('')}</div>`;
        const fome = vivosDe(p).filter(s => s.fome >= 50).length, cans = vivosDe(p).filter(s => s.cansaco >= 40).length;
        html += `<div class="info">${vivosDe(p).length} soldados · ${fome ? `<b style="color:#e3b04b">${fome} com fome</b>` : 'tropa alimentada'}${cans ? ` · ${cans} cansados` : ''} · trincheira ${Math.round(p.trinch)}%`;
        if (p.dono !== 'jogador') {
            const fe = G.fac[p.dono], indo = G.marchas.filter(m => m.dono === p.dono);
            html += `<br>Tesouro: ${Math.floor(fe.moedas)} 🪙 · comida ${Math.floor(fe.comida)}${indo.length ? `<br><b style="color:#ff8a7a">Atacando ${indo.map(m => G.prov[m.para].nome).join(', ')} com ${indo.reduce((t, m) => t + m.tropa.length, 0)} soldados!</b>` : ''}<br>👁 espião por mais ${Math.ceil(G.espiado[p.dono] - G.t)}s`;
        }
        html += '</div>';
    } else html += `<div class="info">Força: <b>${forcaVaga(p)}</b>. Sem espião você não sabe se estão com fome, quanto dinheiro têm nem quem estão atacando.<br>${PERSO_TXT[FACCOES[p.dono].perso]}</div>`;
    if (p.dono === 'jogador') {
        html += `<div class="acoes">
            <button class="acao" onclick="recrutar('${p.id}');renderPainel()" ${f.moedas < custoRecrutar('jogador') || vivosDe(p).length >= C.MAX_GUARNICAO ? 'disabled' : ''}>🪖 Recrutar<small>${custoRecrutar('jogador')} 🪙 · máx ${C.MAX_GUARNICAO} (encarece com a tropa)</small></button>
            <button class="acao" disabled>🍞 Comida automática<small>come quem passa de ${C.COME_SE}</small></button></div>`;
    } else {
        const origem = minhas().filter(q => q.viz.includes(p.id)).sort((a, b) => vivosDe(b).length - vivosDe(a).length)[0];
        if (!origem) html += `<div class="info">Ainda não faz fronteira com você. Conquiste um vizinho dela.</div>`;
        else {
            const max = Math.max(0, vivosDe(origem).length - 1);
            if (G.qtd == null || G.qtd > max) G.qtd = Math.max(1, Math.min(max, vivosDe(origem).length - (origem.qg ? 4 : 2))); // por padrão guarda a casa (4 no QG)
            html += `<div class="seletor">Tropa de ${origem.nome}: <button class="passo" onclick="G.qtd=Math.max(1,G.qtd-1);renderPainel()">−</button><b>${G.qtd}</b><button class="passo" onclick="G.qtd=Math.min(${max},G.qtd+1);renderPainel()">+</button><span class="info">fica ${vivosDe(origem).length - G.qtd}</span></div>
                <div class="acoes">
                <button class="acao forte" onclick="if(enviar('${origem.id}','${p.id}',G.qtd,'ataque'))renderPainel()" ${max < 1 ? 'disabled' : ''}>⚔️ Atacar<small>conquistar a província</small></button>
                <button class="acao" onclick="if(enviar('${origem.id}','${p.id}',${C.SAQUE_TROPA},'saque'))renderPainel()" ${max < C.SAQUE_TROPA ? 'disabled' : ''}>💰 Saquear<small>${C.SAQUE_TROPA} soldados roubam 40% do tesouro</small></button>
                <button class="acao" onclick="espionar('${p.id}');renderPainel()" ${f.moedas < C.ESPIAO || G.espiado[p.dono] > G.t ? 'disabled' : ''}>👁 Espião<small>${C.ESPIAO} 🪙 · ${C.ESPIAO_DURA}s</small></button></div>`;
        }
    }
    el.innerHTML = html;
}

/* ---------- Tela de batalha ---------- */
const cvB = document.getElementById('cvBat'), cxB = cvB.getContext('2d');
function abrirBatalha(b) {
    G.batalha = b;
    const souAtq = b.marcha.dono === 'jogador';
    b.souAtq = souAtq;
    document.getElementById('batalha').style.display = 'flex';
    ajustar(cvB);
    document.getElementById('batTitulo').textContent = souAtq ? `${b.saque ? '💰 SAQUE EM' : '⚔️ ATAQUE A'} ${b.alvo.nome.toUpperCase()}` : `🛡️ DEFESA DE ${b.alvo.nome.toUpperCase()}`;
    const post = souAtq ? [['avancar', 'AVANÇAR', 'rápido, exposto'], ['cobertura', 'COBERTURA', 'lento, protegido'], ['recuar', 'RECUAR', 'volta para casa']]
                        : [['atacar', 'ATACAR', '+dano, +risco'], ['equilibrio', 'EQUILÍBRIO', 'padrão'], ['abrigar', 'ABRIGAR', '−dano recebido']];
    document.getElementById('batPost').innerHTML = post.map(([id, t, d]) => `<button class="opc" data-p="${id}">${t}<small>${d}</small></button>`).join('');
    document.querySelectorAll('#batPost .opc').forEach(bt => bt.onclick = () => { if (souAtq) b.postAtq = bt.dataset.p; else b.postDef = bt.dataset.p; atualizarBatalhaUI(); });
    document.getElementById('bArt').onclick = () => { artilhariaNaBatalha(b, souAtq ? 'atq' : 'def'); atualizarBatalhaUI(); };
    document.getElementById('bVel').onclick = () => { b.rapido = !b.rapido; atualizarBatalhaUI(); };
    atualizarBatalhaUI();
}
function atualizarBatalhaUI() {
    const b = G.batalha; if (!b) return;
    const nos = b.souAtq ? b.atq : b.def, eles = b.souAtq ? b.def : b.atq;
    document.getElementById('batNos').innerHTML = `<span style="color:#7bc96f">Você: ${nos.filter(x => x.s.vida > 0).length}</span>`;
    document.getElementById('batEles').innerHTML = `<span style="color:${FACCOES[b.souAtq ? b.alvo.dono : b.marcha.dono].cor}">${FACCOES[b.souAtq ? b.alvo.dono : b.marcha.dono].nome}: ${eles.filter(x => x.s.vida > 0).length}</span>`;
    const resta = Math.max(0, C.BAT_DURACAO - b.t);
    document.getElementById('batTempo').textContent = `${Math.floor(resta / 60)}:${String(Math.floor(resta % 60)).padStart(2, '0')}`;
    document.querySelector('#tempoBat div').style.width = (100 * resta / C.BAT_DURACAO) + '%';
    const atual = b.souAtq ? b.postAtq : b.postDef;
    document.querySelectorAll('#batPost .opc').forEach(bt => bt.classList.toggle('on', bt.dataset.p === atual));
    document.getElementById('bArt').disabled = b.usouArt || G.fac.jogador.moedas < C.ARTILHARIA;
    document.getElementById('bVel').classList.toggle('on', b.rapido);
}
function fecharBatalha() {
    const b = G.batalha;
    document.getElementById('batalha').style.display = 'none';
    G.batalha = null;
    concluirBatalha(b);
    renderPainel();
}
function desenharBatalha() {
    const b = G.batalha; if (!b) return;
    const BW = 400, BH = 360, e = Math.min(cvB.width / BW, cvB.height / BH), ox = (cvB.width - BW * e) / 2, oy = (cvB.height - BH * e) / 2;
    cxB.setTransform(1, 0, 0, 1, 0, 0); cxB.fillStyle = '#10140f'; cxB.fillRect(0, 0, cvB.width, cvB.height);
    cxB.setTransform(e, 0, 0, e, ox, oy);
    // a trincheira defendida fica sempre no lado de quem defende: você embaixo, o inimigo em cima
    const defEmbaixo = !b.souAtq;
    const yTrinch = defEmbaixo ? 300 : 60, yInicio = defEmbaixo ? 20 : 340;
    const ceu = cxB.createLinearGradient(0, 0, 0, BH); ceu.addColorStop(0, '#3e4a40'); ceu.addColorStop(1, '#2c3128');
    cxB.fillStyle = ceu; cxB.fillRect(0, 0, BW, BH);
    // trincheira defendida
    cxB.fillStyle = '#5b4a33'; cxB.fillRect(0, yTrinch - 6, BW, 12);
    cxB.fillStyle = '#6f5c40'; for (let x = 0; x < BW; x += 16) { cxB.beginPath(); cxB.ellipse(x + 8, yTrinch - 6, 8, 4, 0, Math.PI, 0); cxB.fill(); }
    const corDef = FACCOES[b.alvo.dono].cor, corAtq = FACCOES[b.marcha.dono].cor;
    // defensores na trincheira
    b.def.forEach(d => {
        if (d.s.vida <= 0) return;
        const amigo = b.alvo.dono === 'jogador';
        desenharGente(d.x, yTrinch + (defEmbaixo ? 18 : -2), amigo, !defEmbaixo, d.s, corDef, false);
    });
    // atacantes no campo
    b.atq.forEach(a => {
        if (a.s.vida <= 0) return;
        const k = a.dist / C.DIST; // 1 = saiu agora, 0 = chegou
        const y = yTrinch + (yInicio - yTrinch) * k;
        desenharGente(a.x, y, b.marcha.dono === 'jogador', !defEmbaixo, a.s, corAtq, true);
        if (a.dist < 220 && Math.random() < 0.05) { cxB.strokeStyle = 'rgba(255,224,138,.6)'; cxB.beginPath(); cxB.moveTo(a.x, y - 8); cxB.lineTo(a.x + (Math.random() - 0.5) * 60, yTrinch); cxB.stroke(); }
    });
    b.efeitos.forEach(f => {
        const y = f.y < 0 ? yTrinch : yTrinch + (yInicio - yTrinch) * (f.y / C.DIST);
        if (f.tipo === 'explosao') { cxB.fillStyle = `rgba(255,160,60,${f.vida})`; cxB.beginPath(); cxB.arc(f.x, y, 18 * (1.3 - f.vida), 0, Math.PI * 2); cxB.fill(); }
        else { cxB.fillStyle = `rgba(255,90,70,${f.vida})`; cxB.font = 'bold 12px monospace'; cxB.fillText('✖', f.x - 4, y - 14); }
    });
}
// Seus soldados usam as silhuetas do jogo; os inimigos, silhueta vermelha
function desenharGente(x, y, amigo, olhandoCima, s, cor, andando) {
    if (amigo) {
        const spr = andando ? 'andando' : 'mira', d = SPRITES[spr], im = IMG[spr], F = 0.16;
        cxB.save(); cxB.translate(x, y);
        if (olhandoCima) cxB.scale(1, 1);
        if (im.complete) cxB.drawImage(im, -d.ax * F, -d.ay * F, d.w * F, d.h * F);
        cxB.restore();
    } else {
        cxB.fillStyle = '#2a0f10'; cxB.strokeStyle = cor; cxB.lineWidth = 1.2;
        cxB.beginPath(); cxB.arc(x, y - 22, 4.5, 0, Math.PI * 2); cxB.fill(); cxB.stroke();
        cxB.beginPath(); cxB.moveTo(x - 5, y - 17); cxB.lineTo(x + 5, y - 17); cxB.lineTo(x + 4, y); cxB.lineTo(x - 4, y); cxB.closePath(); cxB.fill(); cxB.stroke();
    }
    cxB.fillStyle = corFome(s); cxB.beginPath(); cxB.arc(x, y - 33, 2.5, 0, Math.PI * 2); cxB.fill();
}

/* ---------- Topo, aviso e telas ---------- */
function atualizarTopo() {
    const f = G.fac.jogador, tropa = minhas().reduce((t, p) => t + vivosDe(p).length, 0);
    const rec = (id, v, baixo) => { const el = document.getElementById(id); el.querySelector('b').textContent = Math.floor(v); el.classList.toggle('baixo', baixo); };
    rec('rCom', f.comida, f.comida < tropa); rec('rMun', f.mun, f.mun < 60); rec('rMoe', f.moedas, false);
    const resta = Math.max(0, C.FASE_LIMITE - G.t), mm = Math.floor(resta / 60), ss = Math.floor(resta % 60);
    document.getElementById('relogio').textContent = `⏰ ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    const av = document.getElementById('aviso'), n = G.noticias[0];
    if (n && G.t - n.t < 8) { av.textContent = n.txt; av.className = n.alerta ? 'alerta' : ''; }
    else { av.textContent = `${minhas().length} de ${Object.keys(G.prov).length} províncias · toque numa província`; av.className = ''; }
}
// Volta para a tela inicial do FrontLine (escolha de modo)
const linkMenu = () => (location.protocol.startsWith('http') ? '/' : 'ponto-alpha.html');
const botaoMenu = () => `<a class="voltarMenu" href="${linkMenu()}">← Modos de jogo</a>`;
function voltarAoMenu() { if (G.fim || confirm('Sair da Conquista? A fase em andamento se perde.')) location.href = linkMenu(); }
function mostrarTela(html) { document.getElementById('telaCaixa').innerHTML = html; document.getElementById('tela').style.display = 'flex'; }
function esconderTela() { document.getElementById('tela').style.display = 'none'; }
function mostrarInicio() {
    mostrarTela(`<h2>⚔️ CONQUISTA · FASE 1</h2>
        <div class="sub">Você comanda <b>Alfa</b>, com 8 soldados. Em volta: <b style="color:#e0533f">Bravo</b> (agressivo), <b style="color:#e3a23b">Charlie</b> (ladrão) e <b style="color:#a77bd9">Delta ★</b> (defensivo, mais forte). Eles também atacam uns aos outros. <b style="color:#9a9a86">Eco</b> e <b style="color:#9a9a86">Foxtrot</b> são livres, com 5 milicianos: quem chegar primeiro leva.</div>
        <div class="lista">🍞 Soldado com fome luta pior. A comida sai sozinha do estoque, mas o estoque acaba.<br>
        ⚔️ Quem ataca deixa a casa mais vazia. Ataque quem acabou de brigar.<br>
        👁 Sem espião você não vê quem está atacando quem.<br>
        💰 Saque rouba 40% do tesouro sem conquistar.<br>
        🏴 Conquistar traz o tesouro e a produção da província.<br>
        ⏱ Cada batalha dura até 2 minutos; o mapa para enquanto você luta. A fase tem 15 minutos.</div>
        <div class="sub" style="margin-top:8px">Alfa é o seu QG: produz em dobro e defende melhor. Vitória: ter as 6 províncias. Derrota: perder Alfa.</div>
        <button class="grande" onclick="esconderTela()">COMEÇAR ▶</button>${botaoMenu()}`);
}
function mostrarFim() {
    const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
    const titulo = G.fim === 'vitoria' ? '🏆 FASE 1 CONQUISTADA!' : G.fim === 'tempo' ? '⏰ O TEMPO ACABOU' : '✝ ALFA CAIU';
    const texto = G.fim === 'vitoria' ? `A região é sua em ${mm}:${String(ss).padStart(2, '0')}. (Na campanha, aqui abriria a fase 2: região central, com espiões e sabotagem.)`
        : G.fim === 'tempo' ? `O reforço inimigo chegou e você segurou ${minhas().length} de 6 províncias. Para vencer a fase é preciso conquistar as 6 em 15 minutos.`
        : `Você resistiu ${mm}:${String(ss).padStart(2, '0')} com ${minhas().length} província(s).`;
    mostrarTela(`<h2>${titulo}</h2>
        <div class="sub">${texto}</div>
        <button class="grande" onclick="novoJogo();esconderTela();renderPainel()">JOGAR DE NOVO</button>${botaoMenu()}`);
}

/* ---------- Laço ---------- */
let ultimo = performance.now();
function laco(agora) {
    const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    const telaAberta = document.getElementById('tela').style.display === 'flex';
    if (!telaAberta && !G.fim) {
        if (G.batalha) {
            const b = G.batalha;
            b.passo(dt * (b.rapido ? 2 : 1));
            b.efeitos.forEach(f => f.vida -= dt); b.efeitos = b.efeitos.filter(f => f.vida > 0);
            desenharBatalha(); atualizarBatalhaUI();
            if (b.terminou && !b.fechando) { b.fechando = true; setTimeout(fecharBatalha, 1200); }
        } else passoMapa(dt);
    }
    desenharMapa(); atualizarTopo();
    if (!G.batalha && Math.floor(agora / 500) !== Math.floor((agora - dt * 1000) / 500)) renderPainel();
    requestAnimationFrame(laco);
}
ajustar(cvM);
novoJogo();
renderPainel();
mostrarInicio();
requestAnimationFrame(laco);
