// FrontLine · motor do Duelo online (1×1, melhor de 5)
// Puro e determinístico: com a mesma semente e os mesmos planos, os dois celulares calculam
// exatamente o mesmo resultado. Só as decisões viajam pela internet.
// Funciona no navegador (window.DueloMotor) e no Node (require), para os testes.
(function (raiz) {
    'use strict';

    // ---------- Números do equilíbrio ----------
    const D = {
        RODADAS: 5, VITORIAS_PARA_GANHAR: 3, DURACAO: 40, DT: 0.1,
        CMD_INICIAL: 4, CMD_POR_RODADA: 3, MUN_INICIAL: 800, MUN_POR_RODADA: 250,
        ORCAMENTO: (rodada) => 12 + 2 * (rodada - 1),                // pontos de ataque por rodada: 12, 14, 16, 18, 20
        ATAQUE: {
            infantaria: { custo: 2, max: 8, nome: 'Grupo de infantaria', desc: '4 soldados avançando' },
            artilharia: { custo: 3, max: 3, nome: 'Artilharia', desc: 'atinge 2 soldados expostos e a trincheira' },
            blindado:   { custo: 5, max: 2, nome: 'Blindado', desc: 'lento e resistente; fura a trincheira' }
        },
        MELHORIAS: {
            ninho:  { custo: 4, max: 2, nome: 'Ninho de metralhadora', desc: '+30% de dano do seu esquadrão' },
            arame:  { custo: 3, max: 2, nome: 'Arame farpado', desc: 'inimigos 20% mais lentos' },
            bunker: { custo: 3, max: 1, nome: 'Bunker reforçado', desc: 'artilharia causa 40% menos dano' }
        },
        CONTRA_CUSTO: 2,
        POSTURA: {
            atacar:      { dano: 1.5, gasto: 1.6, recebido: 1.3 },
            equilibrado: { dano: 1.0, gasto: 1.0, recebido: 1.0 },
            abrigar:     { dano: 0.35, gasto: 0.4, recebido: 0.35 }
        },
        DPS: 9, ALCANCE: 260, PERTO: 150,
        INF_VIDA: (rodada) => 60 + 10 * rodada, INF_VEL: 13, INF_FOGO: 1.1, INF_INVASAO: 12, INF_TRINCH: 4,
        BLI_VIDA: 400, BLI_VEL: 7, BLI_BLINDAGEM: 0.3, BLI_TRINCH: 15, BLI_DANO: 15,
        ART_DANO: 26, ART_TRINCH: 8,
        REPARO: 0.6, REPARO_ENG: 1.2, GASTO_MUN: 2.2,
        NOITE: { descanso: 20, vigia: -10, obras: -5, medica: 5 },
        // Doutrina: escolhida na 1ª rodada, vale o duelo inteiro (planos sem doutrina jogam sem bônus)
        // calibrado em pedra-papel-tesoura: Assalto vence Artilharia, Artilharia vence Fortaleza, Fortaleza vence Assalto
        DOUT: { assaltoPts: 2, assaltoVida: 1.08, artForca: 1.05, artCusto: 2, artMax: 3, fortRepara: 2.2, fortTrinch: 0.55, fortCmd: 2 },
        DOUTRINAS: {
            assalto:    { nome: 'Assalto', icone: '🗡', desc: '+2 pontos de ataque por rodada e infantaria mais resistente · forte contra Artilharia' },
            artilharia: { nome: 'Artilharia', icone: '💥', desc: 'artilharia custa 2 pontos (até 3) e bate mais forte · forte contra Fortaleza' },
            fortaleza:  { nome: 'Fortaleza', icone: '🏰', desc: 'trincheira conserta 2× mais rápido, sofre bem menos e +2 Comando por rodada · forte contra Assalto' }
        }
    };
    const orcamento = (rodada, dout) => D.ORCAMENTO(rodada) + (dout === 'assalto' ? D.DOUT.assaltoPts : 0);
    const custoDe = (id, dout) => (id === 'artilharia' && dout === 'artilharia' ? D.DOUT.artCusto : D.ATAQUE[id].custo);
    const maxDe = (id, dout) => (id === 'artilharia' && dout === 'artilharia' ? D.DOUT.artMax : D.ATAQUE[id].max);

    const SOLDADOS = [
        { nome: 'Silva', classe: 'Fuzileiro', dano: 1.0 },
        { nome: 'Santos', classe: 'Metralhador', dano: 1.6 },
        { nome: 'Ferreira', classe: 'Fuzileiro', dano: 1.0 },
        { nome: 'Costa', classe: 'Médica', dano: 0.7, medica: true },
        { nome: 'Oliveira', classe: 'Engenheiro', dano: 0.8, engenheiro: true },
        { nome: 'Mendes', classe: 'Atirador', dano: 1.4 }
    ];
    const FUNCOES = ['vigia', 'obras', 'descanso'];
    const ESCALA_PADRAO = ['vigia', 'vigia', 'descanso', 'descanso', 'obras', 'vigia'];

    // ---------- Sorteio determinístico (mulberry32) ----------
    function rng(semente) {
        let a = semente >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    const misturar = (semente, rodada, lado) => (Math.imul(semente | 0, 2654435761) ^ Math.imul(rodada + 1, 40503) ^ Math.imul(lado + 7, 97)) >>> 0;

    // ---------- Estado de cada comandante ----------
    function estadoInicial() {
        return {
            soldados: SOLDADOS.map(s => ({ ...s, cond: 100 })),
            trinch: 100, mun: D.MUN_INICIAL, cmd: D.CMD_INICIAL,
            melh: { ninho: 0, arame: 0, bunker: 0 }
        };
    }
    const clonar = (e) => JSON.parse(JSON.stringify(e));
    const vivos = (e) => e.soldados.filter(s => s.cond > 0);

    // ---------- Plano: o que cada um decide na rodada ----------
    function planoPadrao() {
        return { escala: ESCALA_PADRAO.slice(), postura: 'equilibrado', compras: [], contra: false, ataque: { infantaria: 2, artilharia: 1, blindado: 0 } };
    }
    // Valida e corrige o plano recebido (um plano trapaceado não ganha nada além do permitido)
    function sanitizar(plano, estado, rodada) {
        const p = planoPadrao(), q = plano && typeof plano === 'object' ? plano : {};
        // a doutrina só se escolhe na 1ª rodada; depois vale a do estado
        p.doutrina = rodada === 1 ? (D.DOUTRINAS[q.doutrina] ? q.doutrina : null) : (estado.doutrina || null);
        const dout = p.doutrina;
        if (Array.isArray(q.escala)) p.escala = SOLDADOS.map((_, i) => (FUNCOES.includes(q.escala[i]) ? q.escala[i] : ESCALA_PADRAO[i]));
        if (D.POSTURA[q.postura]) p.postura = q.postura;
        // compras na ordem pedida, enquanto houver Comando e não passar do máximo
        let cmd = estado.cmd;
        const melh = { ...estado.melh };
        p.compras = [];
        (Array.isArray(q.compras) ? q.compras : []).slice(0, 6).forEach(id => {
            const m = D.MELHORIAS[id];
            if (m && cmd >= m.custo && melh[id] < m.max) { cmd -= m.custo; melh[id]++; p.compras.push(id); }
        });
        p.contra = !!q.contra && cmd >= D.CONTRA_CUSTO;
        // ataque dentro do orçamento da rodada
        let orc = orcamento(rodada, dout);
        const a = q.ataque && typeof q.ataque === 'object' ? q.ataque : {};
        p.ataque = { infantaria: 0, artilharia: 0, blindado: 0 };
        ['blindado', 'artilharia', 'infantaria'].forEach(id => {
            const custo = custoDe(id, dout);
            let n = Math.max(0, Math.min(maxDe(id, dout), Math.floor(Number(a[id]) || 0)));
            while (n > 0 && n * custo > orc) n--;
            p.ataque[id] = n; orc -= n * custo;
        });
        return p;
    }
    const custoAtaque = (ataque, dout) => Object.keys(D.ATAQUE).reduce((s, id) => s + (ataque[id] || 0) * custoDe(id, dout), 0);
    const custoDefesa = (plano) => plano.compras.reduce((s, id) => s + D.MELHORIAS[id].custo, 0) + (plano.contra ? D.CONTRA_CUSTO : 0);

    // ---------- Um campo de batalha: o ataque de um contra a defesa do outro ----------
    // Retorna um objeto com passo() para dar para animar (replay) ou rodar até o fim.
    function criarCampo(ataque, defesaEstado, defesaPlano, rodada, semente, lado, doutAtq) {
        const r = rng(misturar(semente, rodada, lado));
        const est = defesaEstado; // já é uma cópia (resolverRodada clona)
        const fortaleza = est.doutrina === 'fortaleza';
        const vidaInf = D.INF_VIDA(rodada) * (doutAtq === 'assalto' ? D.DOUT.assaltoVida : 1), forcaArt = doutAtq === 'artilharia' ? D.DOUT.artForca : 1;
        const trinchDano = (v) => (fortaleza ? v * D.DOUT.fortTrinch : v);
        est.soldados.forEach((s, i) => { s.funcao = s.cond > 0 ? defesaPlano.escala[i] : 'fora'; });
        const P = D.POSTURA[defesaPlano.postura];
        const lentidao = 1 - 0.2 * est.melh.arame;
        const agenda = [];
        for (let i = 0; i < ataque.infantaria; i++) agenda.push({ t: 2 + i * (20 / Math.max(1, ataque.infantaria)) + r() * 2, tipo: 'infantaria' });
        for (let i = 0; i < ataque.blindado; i++) agenda.push({ t: 5 + i * 11 + r() * 2, tipo: 'blindado' });
        for (let i = 0; i < ataque.artilharia; i++) agenda.push({ t: 8 + i * 9 + r() * 2, tipo: 'artilharia' });
        agenda.sort((x, y) => x.t - y.t);
        const c = {
            t: 0, est, inimigos: [], eventos: [], contraDisponivel: defesaPlano.contra,
            trinchInicio: est.trinch, condInicio: est.soldados.reduce((s, x) => s + Math.max(0, x.cond), 0),
            terminou: false
        };
        const expostos = () => est.soldados.filter(s => s.cond > 0 && s.funcao !== 'descanso');
        const sorteia = (l) => l[Math.floor(r() * l.length)];
        const evento = (tipo, extra) => c.eventos.push({ t: c.t, tipo, ...extra });

        c.passo = function () {
            if (c.terminou) return;
            const dt = D.DT;
            c.t = Math.round((c.t + dt) * 10) / 10;
            // chegadas agendadas
            while (agenda.length && agenda[0].t <= c.t) {
                const a = agenda.shift();
                if (a.tipo === 'infantaria') {
                    for (let k = 0; k < 4; k++) c.inimigos.push({ tipo: 'infantaria', x: 30 + r() * 340, dist: 300 + r() * 30, vida: vidaInf, vel: D.INF_VEL * (0.9 + 0.2 * r()) });
                    evento('onda');
                } else if (a.tipo === 'blindado') {
                    c.inimigos.push({ tipo: 'blindado', x: 80 + r() * 240, dist: 310, vida: D.BLI_VIDA, vel: D.BLI_VEL });
                    evento('blindado');
                } else if (a.tipo === 'artilharia') {
                    if (c.contraDisponivel) { c.contraDisponivel = false; evento('contra'); }
                    else {
                        const ex = expostos();
                        for (let k = 0; k < 2 && ex.length; k++) { const s = sorteia(ex); s.cond -= D.ART_DANO * forcaArt * P.recebido * (est.melh.bunker ? 0.6 : 1); evento('artilharia', { soldado: est.soldados.indexOf(s) }); }
                        est.trinch = Math.max(0, est.trinch - trinchDano(D.ART_TRINCH * forcaArt));
                        if (!ex.length) evento('artilharia', { soldado: -1 });
                    }
                }
            }
            // a defesa atira no mais perto; fuzil quase não fere blindado
            const vig = est.soldados.filter(s => s.cond > 0 && s.funcao === 'vigia');
            const noAlcance = c.inimigos.filter(e => e.dist < D.ALCANCE);
            if (noAlcance.length && vig.length) {
                const semBlind = noAlcance.filter(e => e.tipo !== 'blindado');
                const lista = (semBlind.length ? semBlind : noAlcance).slice().sort((x, y) => x.dist - y.dist);
                const alvo = lista[0];
                const temMun = est.mun > 0;
                let dano = 0;
                vig.forEach(s => { dano += D.DPS * s.dano * P.dano * (1 + 0.3 * est.melh.ninho) * (0.55 + s.cond / 220) * (temMun ? 1 : 0.3) * dt; });
                alvo.vida -= alvo.tipo === 'blindado' ? dano * (D.BLI_BLINDAGEM + 0.2 * est.melh.ninho) : dano;
                alvo.alvejado = c.t;
                if (temMun) est.mun = Math.max(0, est.mun - vig.length * D.GASTO_MUN * P.gasto * dt);
            }
            // inimigos avançam e atiram de perto
            c.inimigos.forEach(e => {
                e.dist -= e.vel * lentidao * dt;
                if (e.tipo === 'infantaria' && e.dist < D.PERTO) {
                    const ex = expostos();
                    if (ex.length) sorteia(ex).cond -= D.INF_FOGO * P.recebido * dt;
                }
            });
            // abates e quem chegou na trincheira
            c.inimigos = c.inimigos.filter(e => {
                if (e.vida <= 0) { evento('abate', { x: e.x, alvo: e.tipo }); return false; }
                if (e.dist <= 0) {
                    const ex = expostos();
                    if (e.tipo === 'blindado') {
                        est.trinch = Math.max(0, est.trinch - trinchDano(D.BLI_TRINCH));
                        for (let k = 0; k < 2 && ex.length; k++) sorteia(ex).cond -= D.BLI_DANO * P.recebido;
                    } else {
                        est.trinch = Math.max(0, est.trinch - trinchDano(D.INF_TRINCH));
                        if (ex.length) sorteia(ex).cond -= D.INF_INVASAO * P.recebido;
                    }
                    evento('invasao', { x: e.x, alvo: e.tipo });
                    return false;
                }
                return true;
            });
            // obras consertam
            est.soldados.forEach(s => { if (s.cond > 0 && s.funcao === 'obras') est.trinch = Math.min(100, est.trinch + (s.engenheiro ? D.REPARO_ENG : D.REPARO) * (fortaleza ? D.DOUT.fortRepara : 1) * dt); });
            est.soldados.forEach(s => { if (s.cond <= 0 && s.funcao !== 'fora') { s.cond = 0; s.funcao = 'fora'; evento('baixa', { nome: s.nome }); } });
            if (c.t >= D.DURACAO || est.trinch <= 0 || !vivos(est).length) c.terminou = true;
        };
        c.danoSofrido = function () {
            const cond = est.soldados.reduce((s, x) => s + Math.max(0, x.cond), 0);
            return Math.round(((c.trinchInicio - est.trinch) + 0.5 * (c.condInicio - cond)) * 10) / 10;
        };
        return c;
    }

    // ---------- Rodada: os dois campos acontecem ao mesmo tempo ----------
    // Prepara os dois campos da rodada (o replay usa isto para animar exatamente o que foi calculado)
    function prepararRodada(estA, estB, planoA, planoB, rodada, semente) {
        const a = clonar(estA), b = clonar(estB);
        if (rodada === 1) { a.doutrina = planoA.doutrina || null; b.doutrina = planoB.doutrina || null; }
        // compras e contra-bateria saem do Comando de cada um
        [[a, planoA], [b, planoB]].forEach(([e, p]) => { p.compras.forEach(id => e.melh[id]++); e.cmd -= custoDefesa(p); });
        const campoA = criarCampo(planoB.ataque, a, planoA, rodada, semente, 0, b.doutrina); // defesa de A
        const campoB = criarCampo(planoA.ataque, b, planoB, rodada, semente, 1, a.doutrina); // defesa de B
        return { a, b, campoA, campoB };
    }
    function resolverRodada(estA, estB, planoA, planoB, rodada, semente) {
        const { a, b, campoA, campoB } = prepararRodada(estA, estB, planoA, planoB, rodada, semente);
        while (!campoA.terminou || !campoB.terminou) { campoA.passo(); campoB.passo(); }
        const danoA = campoA.danoSofrido(), danoB = campoB.danoSofrido();
        const caiuA = a.trinch <= 0 || !vivos(a).length, caiuB = b.trinch <= 0 || !vivos(b).length;
        let vencedor = null;
        if (caiuA !== caiuB) vencedor = caiuA ? 'B' : 'A';
        else if (Math.abs(danoA - danoB) >= 1) vencedor = danoA < danoB ? 'A' : 'B';
        // noite: descanso, cansaço e reforços para a próxima rodada
        [[a, planoA], [b, planoB]].forEach(([e, p]) => {
            const medica = e.soldados.some(s => s.medica && s.cond > 0);
            e.soldados.forEach((s, i) => {
                delete s.funcao;
                if (s.cond <= 0) { s.cond = 0; return; }
                s.cond += D.NOITE[p.escala[i]] + (medica ? D.NOITE.medica : 0);
                s.cond = Math.max(1, Math.min(100, Math.round(s.cond)));
            });
            e.trinch = Math.round(e.trinch * 10) / 10;
            e.mun = Math.round(e.mun) + D.MUN_POR_RODADA;
            e.cmd += D.CMD_POR_RODADA + (e.doutrina === 'fortaleza' ? D.DOUT.fortCmd : 0);
        });
        return { novoA: a, novoB: b, danoA, danoB, vencedor, caiuA, caiuB, eventosA: campoA.eventos, eventosB: campoB.eventos };
    }

    // ---------- O duelo inteiro a partir dos planos (os dois celulares chegam ao mesmo lugar) ----------
    // planos: [{ A, B }, ...] por rodada completa, na ordem
    function estadoDoDuelo(semente, planos) {
        let A = estadoInicial(), B = estadoInicial();
        const rodadas = [];
        let vitA = 0, vitB = 0, totalA = 0, totalB = 0, fim = null;
        for (let i = 0; i < planos.length && !fim; i++) {
            const rodada = i + 1;
            const pA = sanitizar(planos[i].A, A, rodada), pB = sanitizar(planos[i].B, B, rodada);
            const res = resolverRodada(A, B, pA, pB, rodada, semente);
            rodadas.push({ rodada, planoA: pA, planoB: pB, antesA: A, antesB: B, ...res });
            A = res.novoA; B = res.novoB;
            totalA += res.danoA; totalB += res.danoB;
            if (res.vencedor === 'A') vitA++; else if (res.vencedor === 'B') vitB++;
            if (res.caiuA || res.caiuB) fim = res.caiuA && res.caiuB ? desempate(totalA, totalB, semente) : (res.caiuA ? 'B' : 'A');
            else if (vitA >= D.VITORIAS_PARA_GANHAR) fim = 'A';
            else if (vitB >= D.VITORIAS_PARA_GANHAR) fim = 'B';
            else if (rodada >= D.RODADAS) fim = vitA !== vitB ? (vitA > vitB ? 'A' : 'B') : desempate(totalA, totalB, semente);
        }
        return { A, B, rodadas, placar: { A: vitA, B: vitB }, dano: { A: totalA, B: totalB }, proximaRodada: fim ? null : planos.length + 1, vencedor: fim };
    }
    // Empate: quem sofreu menos dano no total; se ainda empatar, a semente decide (cara ou coroa)
    function desempate(totalA, totalB, semente) {
        if (Math.abs(totalA - totalB) >= 1) return totalA < totalB ? 'A' : 'B';
        return (semente & 1) ? 'A' : 'B';
    }

    // ---------- Bot (treino quando ninguém aparece na fila) ----------
    // Decide um plano razoável, com um pouco de sorte, a partir do que ele sabe (o próprio estado e a rodada passada)
    function planoDoBot(estado, rodada, ultimoDoAdversario, semente) {
        const r = rng(misturar(semente, rodada, 99));
        const dout = rodada === 1 ? ['assalto', 'artilharia', 'fortaleza'][Math.floor(r() * 3)] : estado.doutrina;
        const distraido = r() < 0.4; // o bot de treino erra de propósito em parte das rodadas
        const escala = estado.soldados.map((s, i) => (distraido ? FUNCOES[Math.floor(r() * 3)] : s.cond < 35 ? 'descanso' : estado.trinch < 60 && s.engenheiro ? 'obras' : ESCALA_PADRAO[i]));
        const artDele = ultimoDoAdversario ? ultimoDoAdversario.ataque.artilharia : 1;
        const postura = distraido ? ['atacar', 'equilibrado', 'abrigar'][Math.floor(r() * 3)] : artDele >= 2 && r() < 0.5 ? 'abrigar' : 'equilibrado';
        const compras = [];
        let cmd = estado.cmd;
        ['ninho', 'arame', 'bunker'].forEach(id => { const m = D.MELHORIAS[id]; if (cmd >= m.custo && estado.melh[id] < m.max && r() < 0.6) { compras.push(id); cmd -= m.custo; } });
        const contra = !distraido && artDele >= 2 && cmd >= D.CONTRA_CUSTO;
        let orc = Math.floor(orcamento(rodada, dout) * (distraido ? 0.6 : 0.85));
        const ataque = { infantaria: 0, artilharia: 0, blindado: 0 };
        if (rodada >= 2 && r() < 0.5 && orc >= 5) { ataque.blindado = 1; orc -= 5; }
        const nArt = Math.min(maxDe('artilharia', dout), Math.floor((orc * (dout === 'artilharia' ? 0.6 : 0.35)) / custoDe('artilharia', dout)));
        ataque.artilharia = nArt; orc -= nArt * custoDe('artilharia', dout);
        ataque.infantaria = Math.min(D.ATAQUE.infantaria.max, Math.floor(orc / 2));
        return { escala, postura, compras, contra, ataque, doutrina: dout };
    }

    const api = { D, SOLDADOS, FUNCOES, orcamento, custoDe, maxDe, planoDoBot, estadoInicial, planoPadrao, sanitizar, custoAtaque, custoDefesa, criarCampo, prepararRodada, resolverRodada, estadoDoDuelo, rng, clonar, vivos };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else raiz.DueloMotor = api;
})(typeof window !== 'undefined' ? window : globalThis);
