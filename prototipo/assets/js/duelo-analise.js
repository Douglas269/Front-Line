// FrontLine · Duelo: leitura do adversário (na preparação) e "por que perdi/ganhei" (no fim).
// Puro (sem tela): funciona no navegador (window.DueloAnalise) e no Node (testes). Só usa o que os dois jogadores já podem ver:
// o estado dele é calculado pelo mesmo motor determinístico e os planos dele aparecem depois de cada rodada.
(function (raiz) {
    'use strict';
    const M = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('./duelo-motor.js') : raiz.DueloMotor;
    const D = M.D, VENCE = { assalto: 'artilharia', artilharia: 'fortaleza', fortaleza: 'assalto' };
    const outro = (l) => (l === 'A' ? 'B' : 'A');
    const pct = (a, b) => (b ? Math.round(100 * a / b) : 0);

    // Quanto de dano médio cada tipo de ocorrência costuma causar (do motor): pesa as causas da derrota
    const PESO = { artilharia: D.ART_DANO * 0.5 + D.ART_TRINCH, invasaoInfantaria: D.INF_INVASAO * 0.5 + D.INF_TRINCH, invasaoBlindado: D.BLI_DANO * 2 * 0.5 + D.BLI_TRINCH };

    // Resumo de um campo (eventos da defesa de alguém): o que o atacante conseguiu
    function resumoCampo(eventos) {
        const n = (f) => eventos.filter(f).length;
        const onda = n(e => e.tipo === 'onda'), bli = n(e => e.tipo === 'blindado');
        return {
            art: n(e => e.tipo === 'artilharia' && e.soldado >= 0), contra: n(e => e.tipo === 'contra'),
            invInf: n(e => e.tipo === 'invasao' && e.alvo === 'infantaria'), invBli: n(e => e.tipo === 'invasao' && e.alvo === 'blindado'),
            abatesInf: n(e => e.tipo === 'abate' && e.alvo === 'infantaria'), enviados: onda * 4 + bli, baixas: n(e => e.tipo === 'baixa')
        };
    }

    // ---------- Leitura do adversário: antes de decidir a rodada ----------
    function leituraDoAdversario(jogo, lado) {
        const eu = lado === 'A' ? jogo.A : jogo.B, ele = lado === 'A' ? jogo.B : jogo.A;
        const ultimo = jogo.rodadas[jogo.rodadas.length - 1];
        const planoDele = ultimo ? (lado === 'A' ? ultimo.planoB : ultimo.planoA) : null;
        const vivosDele = ele.soldados.filter(s => s.cond > 0), vivosMeus = eu.soldados.filter(s => s.cond > 0);
        const estado = {
            trinch: Math.round(ele.trinch), soldados: vivosDele.length, cond: vivosDele.length ? Math.round(vivosDele.reduce((t, s) => t + s.cond, 0) / vivosDele.length) : 0,
            mun: Math.round(ele.mun), cmd: ele.cmd, doutrina: ele.doutrina || null, melh: ele.melh, refs: ele.refs || []
        };
        const estilo = [];
        const sug = [];
        if (planoDele) {
            const a = planoDele.ataque, ptsArt = a.artilharia * D.ATAQUE.artilharia.custo, ptsTot = Math.max(1, a.infantaria * 2 + ptsArt + a.blindado * 5);
            if (a.artilharia >= 2 || ptsArt / ptsTot >= 0.45) { estilo.push('artilheiro'); sug.push('Ele aposta em artilharia: compre o 🏚 Bunker (−40% de dano), ligue a 📡 contra-bateria (cancela uma artilharia) e deixe de 💤 descanso quem não precisa vigiar.'); }
            if (a.blindado >= 1) { estilo.push('blindados'); sug.push('Ele manda 🚛 blindado: o 🔫 ninho de metralhadora e o 〰 arame ajudam (inimigos mais lentos e mais dano nele), e o Engenheiro em 🔨 obras cobre o buraco na trincheira.'); }
            if (a.infantaria >= 4) { estilo.push('enxame'); sug.push('Muita infantaria: mais 🔭 vigias, 🔫 ninho e a postura 🔥 Atacar derrubam as ondas antes de chegarem (cuidado com a munição).'); }
            if (planoDele.postura === 'abrigar') estilo.push('defensivo'); else if (planoDele.postura === 'atacar') estilo.push('agressivo');
        }
        if (estado.trinch < 45) sug.push(`A trincheira dele está em ${estado.trinch}%: 💥 artilharia e 🚛 blindado furam a trincheira e podem derrubá-lo na hora.`);
        if (estado.mun < 250) sug.push(`A munição dele está baixa (${estado.mun}): os vigias dele atiram menos; mande infantaria em ondas.`);
        if (estado.soldados <= 3) sug.push(`Só ${estado.soldados} soldados dele estão de pé: qualquer invasão pesa muito.`);
        if (Math.round(eu.trinch) < 50) sug.push(`Sua trincheira está em ${Math.round(eu.trinch)}%: coloque o Engenheiro em 🔨 obras e use 🧱 Abrigar na defesa.`);
        if (vivosMeus.length <= 3) sug.push(`Você só tem ${vivosMeus.length} soldados de pé: faça revezamento no 💤 descanso e evite a postura 🔥 Atacar.`);
        // doutrinas: vantagem, desvantagem ou nada (só depois que a dele aparece, a partir da 2ª rodada)
        let doutrinas = null;
        if (eu.doutrina && ele.doutrina) doutrinas = VENCE[eu.doutrina] === ele.doutrina ? 'vantagem' : VENCE[ele.doutrina] === eu.doutrina ? 'desvantagem' : 'empate';
        if (doutrinas === 'desvantagem') sug.unshift(`Sua doutrina perde para a dele (${D.DOUTRINAS[ele.doutrina].nome}): compense com a defesa que ela fura menos (${ele.doutrina === 'artilharia' ? 'bunker e contra-bateria' : ele.doutrina === 'assalto' ? 'ninho e vigias' : 'artilharia, que atravessa o escudo dele'}).`);
        return { estado, estilo, planoDele, sugestoes: sug.slice(0, 3), doutrinas, placar: jogo.placar[lado], placarDele: jogo.placar[outro(lado)] };
    }

    // ---------- Por que perdi / ganhei: o duelo inteiro ----------
    function analiseDoDuelo(jogo, lado) {
        const venceu = jogo.vencedor === lado;
        const meu = { art: 0, invInf: 0, invBli: 0, baixas: 0, semMun: 0 }, dele = { enviados: 0, abates: 0, invasoes: 0 };
        const rodadas = jogo.rodadas.map(r => {
            const euA = lado === 'A';
            const defEu = resumoCampo(euA ? r.eventosA : r.eventosB), defEle = resumoCampo(euA ? r.eventosB : r.eventosA);
            const meuDano = euA ? r.danoA : r.danoB, delDano = euA ? r.danoB : r.danoA;
            const novo = euA ? r.novoA : r.novoB, munFim = Math.round(novo.mun) - D.MUN_POR_RODADA;
            meu.art += defEu.art; meu.invInf += defEu.invInf; meu.invBli += defEu.invBli; meu.baixas += defEu.baixas; if (munFim <= 20) meu.semMun++;
            dele.enviados += defEle.enviados; dele.abates += defEle.abatesInf; dele.invasoes += defEle.invInf + defEle.invBli;
            return { rodada: r.rodada, venci: r.vencedor === lado, empate: !r.vencedor, meuDano, delDano, defEu, defEle, semMun: munFim <= 20 };
        });
        // causas do dano que você sofreu (pesos do motor), da maior para a menor
        const causas = [
            { id: 'artilharia', n: meu.art, v: meu.art * PESO.artilharia, nome: 'a artilharia dele' },
            { id: 'invasaoInfantaria', n: meu.invInf, v: meu.invInf * PESO.invasaoInfantaria, nome: 'infantaria que chegou à sua trincheira' },
            { id: 'invasaoBlindado', n: meu.invBli, v: meu.invBli * PESO.invasaoBlindado, nome: 'blindados que chegaram' }
        ].filter(c => c.v > 0).sort((a, b) => b.v - a.v);
        const totalCausas = causas.reduce((t, c) => t + c.v, 0);
        const principal = causas[0] ? { ...causas[0], parte: pct(causas[0].v, totalCausas) } : null;
        const dicas = [];
        if (!venceu && principal) {
            if (principal.id === 'artilharia') dicas.push(`A artilharia dele causou cerca de ${principal.parte}% do dano que você sofreu: 🏚 Bunker (−40%), 📡 contra-bateria e 🧱 Abrigar seguram melhor.`);
            else if (principal.id === 'invasaoBlindado') dicas.push('Os blindados dele furaram sua trincheira: 🔫 ninho, 〰 arame e o Engenheiro em 🔨 obras ajudam.');
            else dicas.push('A infantaria dele chegou demais: mais 🔭 vigias, 🔫 ninho e 〰 arame abatem as ondas antes da trincheira.');
        }
        if (meu.semMun >= 1) dicas.push(`Sua munição acabou em ${meu.semMun} rodada${meu.semMun > 1 ? 's' : ''}: use 🧱 Abrigar ou menos vigias de vez em quando e compre menos postura 🔥 Atacar.`);
        if (dele.enviados && pct(dele.abates, dele.enviados) >= 70) dicas.push(`A defesa dele abateu ${pct(dele.abates, dele.enviados)}% das suas ondas: varie com 💥 artilharia e 🚛 blindado, que furam a trincheira.`);
        const d1 = jogo.rodadas[0];
        if (d1) {
            const dm = (lado === 'A' ? d1.planoA : d1.planoB).doutrina, dd = (lado === 'A' ? d1.planoB : d1.planoA).doutrina;
            if (dm && dd && VENCE[dd] === dm && !venceu) dicas.push(`Sua doutrina (${D.DOUTRINAS[dm].nome}) perde para ${D.DOUTRINAS[dd].nome}: na 1ª rodada, tente adivinhar a dele (pedra-papel-tesoura).`);
        }
        if (venceu && !dicas.length) dicas.push('Boa leitura do adversário: o estilo dele foi respondido a tempo.');
        return { venceu, rodadas, principal, meu, dele, dicas: dicas.slice(0, 3), placar: jogo.placar[lado] + ' × ' + jogo.placar[outro(lado)] };
    }

    const api = { leituraDoAdversario, analiseDoDuelo, resumoCampo };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.DueloAnalise = api;
})(typeof window !== 'undefined' ? window : globalThis);
