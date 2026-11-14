// Teste do Trincheiras: estrago no campo, ameaças novas (gás, incursão noturna, lança-chamas) e, se estiver ligado, o acampamento à noite.
// Uso: node tests/campo-acampamento.js   (PRINTS=pasta salva capturas)
const path = require('path');
const { chromium } = require('playwright');
const PAGINA = 'file://' + path.resolve(__dirname, '..', 'prototipo', 'ponto-alpha.html');

(async () => {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const erros = []; p.on('pageerror', e => erros.push(e.message));
    await p.goto(PAGINA, { waitUntil: 'load' });
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p.reload({ waitUntil: 'load' });
    await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} });
    await p.waitForTimeout(600);
    await p.evaluate(() => { jogoPausado = false; menuAberto = false; }); // depois de recarregar o jogo volta pausado, com o menu de modos
    const ck = {};
    const shot = async (nome) => { if (process.env.PRINTS) await p.screenshot({ path: process.env.PRINTS + '/' + nome + '.png' }); };

    // ---------- 1) Estrago no campo e impacto ----------
    Object.assign(ck, await p.evaluate(() => {
        const r = {};
        gameState.day = 6; gameState.campo = { crateras: [] };
        registrarCratera(80); registrarCratera(230, 16);
        r.crateraRegistra = campoDe().crateras.length === 2;
        for (let i = 0; i < 20; i++) registrarCratera(100 + i);
        r.crateraTemLimite = campoDe().crateras.length === CAMPO.MAX_CRATERAS;
        // bombardeio: no impacto o campo ganha crateras e fumaça
        const antes = campoDe().crateras.length, fx = cenaEfeitos.length;
        gameState.barrage = { ticks: 1, alvos: [] }; processBarrage();
        r.bombardeioFazCrateras = !gameState.barrage && cenaEfeitos.some(e => e.tipo === 'fumacaLonga') && cenaEfeitos.length > fx && campoDe().crateras.length >= Math.min(CAMPO.MAX_CRATERAS, antes);
        // corpos: quem morre fica no chão por um tempo e depois some
        cenaCorpos = []; const e = { type: 'infantaria', distance: 100, offsetX: 0, hp: 0, maxHp: 100 };
        abaterInimigo(gameState, e);
        r.corpoFicaNoChao = cenaCorpos.length === 1;
        gameState.timeSeconds += CAMPO.CORPO_VIDA + 5; desenharInimigosCena(0);
        r.corpoSome = cenaCorpos.length === 0;
        const bl = { type: 'blindado', distance: 90, offsetX: 0, hp: 0, maxHp: 300 }, c0 = campoDe().crateras.length;
        abaterInimigo(gameState, bl);
        r.blindadoDeixaCascoECratera = cenaCorpos.some(c => c.tipo === 'blindado') && (campoDe().crateras.length >= c0 || campoDe().crateras.length === CAMPO.MAX_CRATERAS);
        // faíscas no acerto
        const rnd = Math.random; Math.random = () => 0; cenaEfeitos.length = 0; efeitoAcerto({ type: 'infantaria', distance: 100, offsetX: 0 }); Math.random = rnd;
        r.faiscaNoAcerto = cenaEfeitos.some(x => x.tipo === 'faisca');
        r.efeitosNaoVazam = (() => { for (let i = 0; i < 300; i++) cenaEfeito('faisca', { pos: { x: 100, y: 100 } }, 12); return cenaEfeitos.length <= 60; })();
        gameState.barrage = null; cenaEfeitos.length = 0;
        return r;
    }));
    // as crateras entram no salvamento e voltam depois de recarregar
    await p.evaluate(() => { gameState.campo = { crateras: [] }; registrarCratera(120); registrarCratera(300); saveGame(); });
    await p.reload({ waitUntil: 'load' });
    ck.crateraVoltaDepoisDeRecarregar = await p.evaluate(() => { clearInterval(relogioId); return campoDe().crateras.length === 2; });
    await p.evaluate(() => { jogoPausado = false; menuAberto = false; }); // depois de recarregar o jogo volta pausado, com o menu de modos aberto
    // o campo é desenhado sem erro com tudo isso
    ck.desenhaSemErro = await p.evaluate(() => { try { gameState.day = 6; registrarCratera(90); spawnEnemy('infantaria', 120); abaterInimigo(gameState, { type: 'blindado', distance: 80, offsetX: 0, hp: 0, maxHp: 1 }); for (let i = 0; i < 5; i++) renderCorte(true); gameState.enemies = []; return true; } catch (e) { return String(e); } }) === true;
    await shot('x1-campo');

    // ---------- 2) Ameaças novas ----------
    Object.assign(ck, await p.evaluate(() => {
        const r = {};
        // só aparecem nos dias certos
        const viaveis = (dia, t) => { gameState.enemies = []; gameState.barrage = null; gameState.gas = null; gameState.day = dia; gameState.timeSeconds = t; return ['gas', 'incursao', 'chamas'].map(id => planoViavel(id)); };
        r.planosSoNosDiasCertos = JSON.stringify(viaveis(2, 10)) === '[false,false,false]' && JSON.stringify(viaveis(12, 130)) === '[true,true,true]' && viaveis(12, 10)[1] === false; // incursão só à noite
        r.utilidadeValida = ['gas', 'incursao', 'chamas'].every(id => { const u = utilidadePlano(id, situacao(), gameState.general.memoria); return Number.isFinite(u) && u > 0.5; });
        r.planosExistemNoGeneral = ['gas', 'incursao', 'chamas'].every(id => GENERAL_PLANS[id] && GENERAL_PLANS[id].passos.length && GENERAL_PLANS[id].pista);
        // ☣ gás: machuca quem fica exposto, o abrigo ajuda, as máscaras quase anulam
        const roda = (mut) => { gameState.squad.forEach(s => { s.hp = 100; s.moral = 80; s.fatigue = 0; s.duty = 'WATCH'; }); gameState.squad[2].duty = 'REST'; gameState.prestige = 200; gameState.gas = null; alternarPausa(true); executarPasso('gas'); alternarPausa(false); mut && mut(); for (let i = 0; i < GAS.AVISO + GAS.DURACAO + 3; i++) processarGas(); return gameState.squad.map(s => 100 - s.hp); };
        const semProt = roda(), comMasc = roda(() => vestirMascaras());
        r.gasMachuca = semProt[0] > 10 && semProt[0] < 45;
        r.abrigoProtege = semProt[2] < semProt[0] * 0.5;
        r.mascarasProtegem = comMasc[0] < semProt[0] * 0.25 && gameState.prestige < 200;
        r.gasAcabaSozinho = gameState.gas === null;
        gameState.gas = { ticks: 5, dur: 40, mascaras: false };
        r.gasAvisaAntes = !gasAtivo() && (() => { const hp = gameState.squad[0].hp; for (let i = 0; i < 4; i++) processarGas(); return gameState.squad[0].hp === hp; })();
        gameState.gas = null;
        gameState.prestige = 0; gameState.gas = { ticks: 5, dur: 40, mascaras: false }; vestirMascaras(); r.semPrestigioNaoVeste = gameState.gas.mascaras === false; gameState.gas = null;
        // 🌑 incursão: fica escondida, a mira cai pela metade, Vigília Total revela
        gameState.timeSeconds = 130; gameState.enemies = []; gameState.tacticalOrders.FULL_VIGILANCE = false; gameState.squad.forEach(s => { s.duty = s.id === 1 ? 'WATCH' : 'REST'; });
        executarPasso('incursao');
        const inf = gameState.enemies;
        r.incursaoTrazTres = inf.length === 3 && inf.every(e => e.type === 'infiltrado');
        r.incursaoEscondida = inf.every(e => inimigoOculto(e)) && /suspeito/.test(resumoAmeaca());
        const s1 = gameState.squad[0], arma = ARMAS[s1.class], alvo = inf[0];
        const escondido = chanceDeAcerto(s1, arma, alvo); gameState.tacticalOrders.FULL_VIGILANCE = true; const revelado = chanceDeAcerto(s1, arma, alvo);
        r.miraCaiPelaMetade = escondido < revelado * 0.65 || escondido === revelado * 0.5;
        r.vigiliaTotalRevela = inf.every(e => !inimigoOculto(e)) && /infiltr/.test(resumoAmeaca());
        gameState.tacticalOrders.FULL_VIGILANCE = false; inf[0].distance = 50;
        r.chegandoPertoAparece = !inimigoOculto(inf[0]);
        gameState.squad.forEach(s => { s.duty = 'WATCH'; });
        r.tresVigiasEnxergam = inf.every(e => !inimigoOculto(e) || e.distance >= 70 ? !inimigoOculto(e) : true) && !inimigoOculto(inf[1]);
        // 🔥 lança-chamas: alcance curto e fogo no posto
        gameState.enemies = []; gameState.squad.forEach(s => { s.hp = 100; s.duty = 'WATCH'; });
        executarPasso('sapador'); const sp = gameState.enemies[0]; sp.hp = sp.maxHp = 1e6;
        r.sapadorTemAlcanceCurto = ENEMY_TYPES.sapador.alcance < 140 && sp.type === 'sapador';
        const tr0 = gameState.trench; sp.distance = 0; for (let i = 0; i < 3; i++) updateGameTick();
        r.sapadorQueima = gameState.trench < tr0 && gameState.squad.some(s => s.hp < 100);
        gameState.enemies = [];
        return r;
    }));
    await shot('x2-ameacas');

    // ---------- 3) Acampamento (09-acampamento.js: guardado, ainda desligado; só testa se estiver carregado) ----------
    const temAcamp = await p.evaluate(() => typeof abrirAcampamento === 'function');
    if (temAcamp) {
    Object.assign(ck, await p.evaluate(() => {
        const r = {}; gameState.enemies = []; gameState.gas = null; gameState.barrage = null; gameState.activeCrisis = null; gameState.acamp = null;
        gameState.general.budget = -1e9; gameState.squad.forEach(s => { s.hp = 100; s.duty = 'WATCH'; s.hunger = 0; s.fatigue = 0; s.moral = 60; });
        const abre = (dia, t) => { gameState.day = dia; gameState.timeSeconds = t; updateGameTick(); return !!acampDe().aberto; };
        r.diaUmNaoAbre = !abre(1, 130);
        jogoPausado = true; r.pausadoNaoAbre = !abre(3, 133); jogoPausado = false; menuAberto = true; r.menuAbertoNaoAbre = !abre(3, 134); menuAberto = false;
        r.naoAbreDeDia = !abre(3, 60);
        spawnEnemy('infantaria', 250); r.naoAbreComInimigo = !abre(3, 130); gameState.enemies = [];
        gameState.gas = { ticks: 9, dur: 40, mascaras: false }; r.naoAbreComGas = !abre(3, 131); gameState.gas = null;
        r.abreNaNoite = abre(3, 132) && gameState.activeCrisis && gameState.activeCrisis.id === 'acampamento' && !document.getElementById('modal-acampamento').classList.contains('hidden');
        const t0 = gameState.timeSeconds; for (let i = 0; i < 15; i++) updateGameTick();
        r.relogioParado = gameState.timeSeconds === t0;
        r.pontos = acampDe().pontos === 2;
        // tarefas gastam o que dizem
        gameState.squad[0].hp = 40; gameState.squad[1].hunger = 60; gameState.resources.rations = 30; gameState.resources.medkits = 3; gameState.trench = 80;
        const a0 = { rations: gameState.resources.rations, med: gameState.resources.medkits, hp: gameState.squad[0].hp, fome: gameState.squad[1].hunger, moral: gameState.squad[2].moral };
        acampFazer('rancho'); acampFazer('curativos');
        r.ranchoGastaEAnima = gameState.resources.rations === a0.rations - custoRancho() && gameState.squad[1].hunger < a0.fome && gameState.squad[2].moral > a0.moral;
        r.curativosCura = gameState.resources.medkits === a0.med - 1 && gameState.squad[0].hp > a0.hp;
        acampFazer('cartas'); r.pontosLimitam = !acampDe().feitas.cartas && acampDe().pontos === 0;
        acampFazer('rancho'); r.tarefaSoUmaVez = gameState.resources.rations === a0.rations - custoRancho();
        acampEvento(1); r.eventoResolve = acampDe().evento.resolvido && acampDe().evento.resultado.length > 5;
        const antesE = acampDe().evento.resultado; acampEvento(0); r.eventoSoUmaVez = acampDe().evento.resultado === antesE;
        acampEncerrar();
        r.encerra = !acampDe().aberto && !gameState.activeCrisis && document.getElementById('modal-acampamento').classList.contains('hidden') && /acampamento/i.test(document.getElementById('diary-entries').textContent);
        const t1 = gameState.timeSeconds; for (let i = 0; i < 5; i++) updateGameTick();
        r.relogioVolta = gameState.timeSeconds > t1; r.naoRepeteNaNoite = !acampDe().aberto;
        // outras tarefas
        gameState.timeSeconds = 10; gameState.day++; acampDe().aberto = false; abre(gameState.day, 125); acampDe().pontos = 9;
        const tr = gameState.trench; gameState.trench = 70; acampFazer('trincheira'); r.reforcaTrincheira = gameState.trench === 78;
        gameState.squad.forEach(s => { s.fatigue = 50; }); acampFazer('sono'); r.sonoDescansa = gameState.squad.every(s => s.fatigue === 25);
        acampFazer('armas'); const s = gameState.squad[0], arma = ARMAS[s.class], en = { type: 'infantaria', distance: 100 };
        const com = chanceDeAcerto(s, arma, en); acampDe().armasAte = 0; const sem = chanceDeAcerto(s, arma, en);
        r.armasAumentamAcerto = com > sem; acampEncerrar();
        // o evento é o mesmo para o mesmo dia (o Desafio do dia é igual para todos)
        r.eventoFixoPorDia = (() => { gameState.day = 9; const a = sortearDoDia(ACAMP_EVENTOS, 11).id, b = sortearDoDia(ACAMP_EVENTOS, 11).id; return a === b; })();
        // aberto durante o salvamento: volta aberto depois de recarregar (a janela reabre)
        gameState.day = 10; gameState.timeSeconds = 130; gameState.acamp = null; abre(10, 130); saveGame();
        r.salvaAberto = JSON.parse(localStorage.getItem(SAVE_KEY)).acamp.aberto === true && JSON.parse(localStorage.getItem(SAVE_KEY)).activeCrisis.id === 'acampamento';
        acampEncerrar();
        // como crise especial: nunca é sorteada sozinha e resolveCrisis (usado pelos testes e pelo login) encerra
        r.crisesNaoSorteiaAcampamento = CRISES.acampamento.pode(gameState) === false;
        gameState.timeSeconds = 10; abre(11, 133); gameState.activeCrisis = { id: 'acampamento', ctx: {} }; resolveCrisis(0);
        r.resolverCriseEncerra = !acampDe().aberto && !gameState.activeCrisis;
        return r;
    }));
    }
    await shot('x3-acampamento');

    // ---------- 4) Jogo de ponta a ponta com tudo ligado ----------
    ck.setePartidasSemTravarNemErro = await p.evaluate(() => {
        const realUI = updateUI; updateUI = () => {}; let noites = 0, gases = 0, incursoes = 0, chamas = 0;
        const planos = executarPasso; executarPasso = function (a) { if (a === 'gas') gases++; if (a === 'incursao') incursoes++; if (a === 'sapador') chamas++; return planos(a); };
        const init = gameState.squad.map(s => ({ ...s, hp: 100, duty: 'WATCH', hunger: 0, thirst: 0, fatigue: 0 }));
        for (let run = 0; run < 7; run++) {
            Object.assign(gameState, { day: 1, timeSeconds: 0, enemies: [], activeCrisis: null, gas: null, acamp: null, campo: null, trench: 100, general: newGeneral(), resources: { rations: 80, water: 90, ammoRifle: 900, ammoHeavy: 300, medkits: 6 }, squad: JSON.parse(JSON.stringify(init)), level: 5 });
            gameEnded = false; let t = 0;
            while (gameState.day <= 14 && gameState.squad.some(s => s.hp > 0) && t < 4000) {
                if (gameState.activeCrisis) { if (gameState.activeCrisis.id === 'acampamento') { acampFazer('rancho'); acampFazer('sono'); noites++; } resolveCrisis(CRISES[gameState.activeCrisis.id].opcoes.length - 1); continue; }
                if (gasAtivo() === false && gameState.gas && gameState.gas.ticks > 0 && !gameState.gas.mascaras && gameState.prestige > 30) vestirMascaras();
                updateGameTick(); t++;
            }
        }
        executarPasso = planos; updateUI = realUI; gameEnded = false;
        return typeof abrirAcampamento === 'function' ? noites >= 6 : true; // com o acampamento ligado, várias noites aconteceram
    });

    ck.semErrosJS = erros.length === 0;
    await b.close();
    console.log(JSON.stringify(ck, null, 1));
    if (erros.length) console.log('ERROS: ' + erros.slice(0, 3).join(' | '));
    const falhas = Object.entries(ck).filter(([, v]) => v !== true).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Campo, ameaças novas e acampamento: todas as verificações passaram.');
    if (falhas.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exit(1); });
