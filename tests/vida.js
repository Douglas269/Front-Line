// Conquista: missões curtas, acontecimentos com escolha, rádio, ofensivas anunciadas, ofensiva final e domínio.
// Uso: node tests/vida.js
const path = require('path');
const { chromium } = require('playwright');
const CONQ = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'conquista.html');
(async () => {
    const b = await chromium.launch(); const falhas = [], erros = [];
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => erros.push(e.message));
    await p.goto(CONQ); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('frontline-conq-guia', 'feito'); }); await p.goto(CONQ); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
        esconderTela(); laco = () => {};
        const o = {};
        const novo = (f = 1) => { novoJogo(f); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); };
        const anda = (seg) => { for (let i = 0; i < seg * 4 && !G.fim; i++) passoMapa(0.25); };
        // 1) missões: a primeira vem logo no começo, paga na hora e vem a próxima
        novo(); anda(8); const m1 = G.vida.missao; o.primeiraCedo = !!m1 && ['tomar', 'recrutar'].includes(m1.tipo);
        o.faixa = /🎯/.test(textoDaFaixa().html);
        G.vida.missao = { tipo: 'recrutar', base: G.vida.recrutados || 0, ate: G.t + 50, escala: 1 }; G.fac.jogador.moedas = 500; const c0 = G.fac.jogador.comida;
        recrutar(G.capitalJogador, 3); passoMissoes(); o.recrutaPaga = !G.vida.missao && G.fac.jogador.comida === c0 + 35 && G.vida.feitas === 1;
        anda(25); o.proximaVem = !!G.vida.missao;
        G.vida.missao = { tipo: 'obra', base: G.vida.obras || 0, ate: G.t + 50, escala: 1 }; G.fac.jogador.aco = 50; fortificar(G.prov[G.capitalJogador].viz.length ? G.capitalJogador : null); G.prov[G.capitalJogador].trinch = 70; construir(G.capitalJogador, 'hospital'); passoMissoes(); o.obraConta = !G.vida.missao;
        const antes = { ...G.fac.jogador }; G.vida.missao = { tipo: 'tomar', alvo: Object.values(G.prov).find(q => q.dono === 'neutro').id, ate: G.t - 1, escala: 1 }; passoMissoes(); o.perderNaoCastiga = !G.vida.missao && G.fac.jogador.moedas === antes.moedas;
        G.vida.proxMissao = 0; o.tiposCriam = Object.keys(MISSOES).every(t => { G.t = 200; const d = MISSOES[t].criar(); return d === null || typeof MISSOES[t].texto({ tipo: t, ...d }) === 'string'; });
        // 2) acontecimentos: aparecem, expiram, cobram o custo e dão o prêmio; sem recurso o botão trava; ignorar é de graça
        novo(); anda(EVENTO_PRIMEIRO + 1); o.eventoAparece = !!G.vida.evento;
        anda(EVENTO_DURA + 2); o.eventoExpira = !G.vida.evento && G.vida.proxEvento > G.t;
        novoEvento('mercado'); G.fac.jogador.moedas = 10; G.fac.jogador.mun = 0; mostrarEvento();
        const botoes = [...document.querySelectorAll('#evento .ev-o button')]; o.travaSemRecurso = botoes.length === 2 && botoes.every(x => x.disabled) && escolherEvento(0) === false && !!G.vida.evento;
        G.fac.jogador.moedas = 100; const a0 = G.fac.jogador.aco; o.compra = escolherEvento(0) && G.fac.jogador.moedas === 70 && G.fac.jogador.aco === a0 + 16 && !G.vida.evento;
        novoEvento('mercado'); const m0 = G.fac.jogador.moedas; o.ignora = escolherEvento(-1) && G.fac.jogador.moedas === m0 && !G.vida.evento;
        o.todosFuncionam = Object.keys(EVENTOS).every(id => { novo(); G.t = 100; Object.assign(G.fac.jogador, { moedas: 200, comida: 200, mun: 200 }); const q = minhas().find(x => !x.capital); q.moral = 30; novoEvento(id); if (!G.vida.evento) return false; const ok = EVENTOS[id].opcoes.every((_, i) => { novoEvento(id); return escolherEvento(i) && typeof G.vida.ultimoResultado === 'string'; }); return ok && Object.values(G.fac.jogador).every(v => typeof v !== 'number' || v >= 0); });
        // 3) rádio: o comandante fala quando você toma a terra dele, sem virar falatório
        novo(); G.t = 30; const bot = G.fase.bots[0], deles = provDe(bot).find(q => !q.capital); G.ex = G.ex.filter(e => e.prov !== deles.id); conquistar(deles, 'jogador', null);
        o.radio = !!G.vida.radio && /Bravo/.test(G.vida.radio.quem) && /📻/.test(G.noticias.map(n => n.txt).join(' ')) && textoDaFaixa().classe === 'radio';
        o.semFalatorio = falar(bot, 'tomou') === false;
        // 4) ofensiva: avisa, dá prazo, chega com reforço; segurar rende prêmio; bots parados de teste não atacam
        novo(); G.t = 300; o.botParadoNaoAtaca = planejarOfensiva() === null;
        novo(); G.t = 240; const b0 = G.fase.bots[0]; G.pensar[b0] = 500; const base = provDe(b0).find(q => !q.capital) || provDe(b0)[0];
        const alvo = base.viz.map(id => G.prov[id]).find(q => !q.capital); G.ex = G.ex.filter(e => e.prov !== alvo.id); alvo.dono = 'jogador';
        anunciarOfensiva({ bot: b0, base: base.id, alvo: alvo.id });
        o.avisa = !!G.vida.ofensiva && /Ofensiva/.test(textoDaFaixa().html + (G.vida.radio ? 'Ofensiva' : '')) && G.noticias.some(n => /OFENSIVA/.test(n.txt) && n.alerta);
        const t0 = tropaDe(b0), vem = reforcosDaOfensiva(); G.t = G.vida.ofensiva.em; passoOfensiva(); o.chegaComReforco = tropaDe(b0) === t0 + vem && reforcosDaOfensiva() === vem + 3 && G.vida.ofensiva.lancada && G.ex.some(e => e.id === G.vida.ofensiva.ex && e.rota.includes(alvo.id));
        G.ex = G.ex.filter(e => e.id !== G.vida.ofensiva.ex); const moedas = G.fac.jogador.moedas; passoOfensiva(); o.repelidaPaga = !G.vida.ofensiva && G.fac.jogador.moedas === moedas + OFENSIVA_CQ.PREMIO.moedas && G.vida.repelidas === 1;
        anunciarOfensiva({ bot: b0, base: base.id, alvo: alvo.id }); base.dono = 'jogador'; const m2 = G.fac.jogador.moedas; G.t = G.vida.ofensiva.em; passoOfensiva(); o.tomarBaseDesarma = !G.vida.ofensiva && G.fac.jogador.moedas > m2;
        // 5) ofensiva final e domínio: vence quem segura 60% do mapa por 1 minuto; vale para o inimigo também
        novo(); G.pensar[G.fase.bots[0]] = 500; G.t = G.fase.tempo - FINAL.COMECA; passoFinal(); o.final = emOfensivaFinal() && G.noticias.some(n => /OFENSIVA FINAL/.test(n.txt));
        const domina = (dono) => { novo(); G.t = 100; Object.values(G.prov).filter(q => !q.capital).slice(0, provinciasParaDominar()).forEach(q => { q.dono = dono; }); passoFinal(); const comecou = !!G.vida.dominio && G.vida.dominio.dono === dono && !G.fim; G.t += FINAL.SEGURA - 1; passoFinal(); const aindaNao = !G.fim; G.t += 2; passoFinal(); return comecou && aindaNao && G.fim === (dono === 'jogador' ? 'dominio' : 'dominado'); };
        o.dominioVence = domina('jogador'); o.estrelas = calcularEstrelas() >= 2; o.telaVitoria = /DOMINOU O MAPA|DOMÍNIO/i.test(document.getElementById('telaCaixa').textContent);
        o.dominioDoBot = domina(G.fase.bots[0]); o.semEstrela = calcularEstrelas() === 0;
        esconderTela(); localStorage.removeItem('frontline-conquista-meta');
        // 6) salvamento: missão, evento e ofensiva continuam depois de recarregar; no online nada disso roda
        novo(); G.semSalvar = false; anda(8); novoEvento('comboio'); const foto = JSON.stringify([G.vida.missao, G.vida.evento]); salvarPartida(); carregarPartida(); o.salva = JSON.stringify([G.vida.missao, G.vida.evento]) === foto; apagarSalvamento();
        novo(); G.online = { papel: 'host' }; for (let i = 0; i < 40; i++) GANCHOS_PASSO.forEach(f => f(1)); o.onlineSemExtras = !G.vida || !G.vida.missao; atualizarFaixa(); o.onlineSemFaixa = document.getElementById('faixaMissao').style.display === 'none'; G.online = null;
        return o;
    });
    Object.entries(r).forEach(([k, v]) => { if (!v) falhas.push('falhou: ' + k); });
    // 7) na tela: a faixa e o cartão aparecem sem estourar a largura, e o toque na escolha funciona
    await p.evaluate(() => { esconderTela(); novoJogo(1); Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); G.pausado = true; Object.assign(G.fac.jogador, { moedas: 100, comida: 100, mun: 100 }); novaMissao(); novoEvento('comboio'); atualizarTopo(); });
    await p.waitForTimeout(300);
    const t = await p.evaluate(() => { const q = (id) => document.getElementById(id).getBoundingClientRect(); const bs = [...document.querySelectorAll('#evento button')].map(x => x.getBoundingClientRect()); return { faixa: q('faixaMissao').height, evento: q('evento').width, dentro: bs.every(x => x.left >= 0 && x.right <= innerWidth && x.height >= 28), rolagem: document.documentElement.scrollWidth <= innerWidth }; });
    if (!(t.faixa >= 28 && t.evento > 200 && t.dentro && t.rolagem)) falhas.push('tela: ' + JSON.stringify(t));
    if (process.env.PRINTS) await p.screenshot({ path: path.join(process.env.PRINTS, 'vida.png') });
    await p.click('#evento .ev-o button >> nth=0');
    if (!(await p.evaluate(() => !G.vida.evento && G.fac.jogador.moedas === 80))) falhas.push('tocar na escolha deveria aplicar e fechar');
    if (erros.length) falhas.push('erros de JavaScript: ' + erros.slice(0, 2).join(' | '));
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Missões, acontecimentos, rádio, ofensivas, final e domínio funcionam.');
    await b.close(); process.exit(falhas.length ? 1 : 0);
})();
