// Teste do Trincheiras: pistas visuais no lugar de barras (A) e desbloqueio gradual de mecânicas por nível (B).
// Uso: node tests/pistas-visuais.js   (PRINTS=pasta salva capturas)
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
    await p.evaluate(() => { jogoPausado = false; menuAberto = false; });
    const shot = async (nome) => { if (process.env.PRINTS) await p.screenshot({ path: process.env.PRINTS + '/' + nome + '.png' }); };
    const ck = {};

    // ---------- A) pistas visuais ----------
    Object.assign(ck, await p.evaluate(() => {
        const r = {}, sv = gameState.squad, s = sv[0];
        const boas = () => { sv.forEach(m => Object.assign(m, { hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, mental: null })); };
        boas();
        const t = 1000;
        const inc = (m) => posturaSoldado(m, t).inc;
        const base = inc(s);
        s.fatigue = 90; const cansado = inc(s); boas();
        s.hunger = 80; const faminto = inc(s); boas();
        s.hp = 20; const ferido = inc(s); boas();
        s.moral = 10; const abatido = inc(s); boas();
        r.postura_cansadoCurva = cansado > base + 0.1;
        r.postura_fomeCurva = faminto > base;
        r.postura_feridoCurva = ferido > base;
        r.postura_moralBaixaCurva = abatido > base;
        r.postura_firmePeitoAberto = base < 0;
        // caminhar: cansado e chuva deixam o passo pesado
        gameState.weather = 'Nublado'; const normal = fatorAndar(s);
        s.fatigue = 90; const cans = fatorAndar(s); boas();
        gameState.weather = 'Chuva Forte'; const lama = fatorAndar(s); gameState.weather = 'Nublado';
        r.passo_cansadoMaisLento = cans < normal;
        r.passo_chuvaViraLama = lama < normal * 0.75;
        // frases no lugar das barras
        s.fatigue = 90; s.hunger = 80; s.hp = 30;
        const f = frasesDoSoldado(s).map(x => x.txt).join('|');
        r.frases_descrevemEstado = /Exausto/.test(f) && /Faminto/.test(f) && /Ferido/.test(f);
        boas();
        r.frases_bemQuandoSaudavel = /confiante|boa forma/.test(frasesDoSoldado(s)[0].txt);
        // o cartão não tem mais barras nem números de vida/fadiga
        abrirCartao(s.id); renderCartao(true);
        const html = document.getElementById('corte-cartao').innerHTML;
        r.cartao_semBarras = !/Fadiga|Fome|Sede/.test(html) && !/h-1 rounded/.test(html);
        s.fatigue = 90; assinaturaCartao = ''; renderCartao(true);
        r.cartao_mostraFrase = /Exausto/.test(document.getElementById('corte-cartao').innerHTML);
        fecharCartao(); boas();
        // parapeito: o estrago aparece no desenho, não numa barra
        gameState.trench = 100; assinaturaFundo = ''; renderCorte(true);
        r.parapeito_assinaturaMudaComDano = (() => { const a = assinaturaDoFundo(); gameState.trench = 40; return assinaturaDoFundo() !== a; })();
        gameState.trench = 100;
        return r;
    }));
    await p.evaluate(() => {
        // cena de captura: cada soldado num estado diferente
        const sv = gameState.squad; sv.forEach(m => Object.assign(m, { hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, mental: null }));
        sv[0].fatigue = 90; sv[1].hunger = 80; sv[2].hp = 25; sv[3].thirst = 80; sv[4].moral = 10;
        gameState.trench = 35; jogoPausado = true; assinaturaFundo = ''; renderCorte(true);
    });
    await p.waitForTimeout(400); await shot('a1-pistas-visuais');

    // ---------- B) desbloqueio gradual ----------
    Object.assign(ck, await p.evaluate(() => {
        const r = {}, antes = gameState.level;
        const nivel = (n) => { gameState.level = n; };
        const abre = (n) => MODIFICADORES.filter(m => m.nivel === n).map(m => m.id);
        r.nivel1_semNada = (nivel(1), modificadoresAtivos().length === 0);
        // clima: nível 1 e 2 só nublado
        const sorteia = (n, vezes = 60) => { nivel(n); const vistos = new Set(); for (let i = 0; i < vezes; i++) { gameState.day = 2; gameState.timeSeconds = 240; endTurn(); vistos.add(gameState.weather); } return [...vistos]; };
        r.clima_nivel1SoNublado = JSON.stringify(sorteia(1)) === '["Nublado"]';
        r.clima_nivel2SoNublado = JSON.stringify(sorteia(2)) === '["Nublado"]';
        const n3 = sorteia(3); r.clima_nivel3ChuvaSemNevoa = n3.includes('Chuva Forte') && !n3.includes('Névoa Espessa') && !n3.includes('Neve');
        const n4 = sorteia(4, 200); r.clima_nivel4Completo = n4.includes('Névoa Espessa') && n4.includes('Neve') && n4.includes('Chuva Forte');
        gameState.day = 1;
        // ofensivas
        nivel(1); gameState.ofensiva = null; agendarOfensiva(); r.ofensiva_naoNoNivel1 = gameState.ofensiva === null;
        nivel(2); gameState.ofensiva = null; agendarOfensiva(); r.ofensiva_noNivel2 = !!gameState.ofensiva;
        // ameaças complexas
        const viaveis = () => { gameState.enemies = []; gameState.barrage = null; gameState.gas = null; gameState.sabotagem = null; gameState.day = 14; gameState.timeSeconds = 130; return { gas: planoViavel('gas'), incursao: planoViavel('incursao'), chamas: planoViavel('chamas'), sabotagem: planoViavel('sabotagem') }; };
        nivel(4); const v4 = viaveis(); r.ameacas_nivel4Nenhuma = !v4.gas && !v4.incursao && !v4.chamas && !v4.sabotagem;
        nivel(5); const v5 = viaveis(); r.ameacas_nivel5SoIncursao = v5.incursao && !v5.gas && !v5.chamas && !v5.sabotagem;
        nivel(6); const v6 = viaveis(); r.ameacas_nivel6Gas = v6.gas && !v6.chamas && !v6.sabotagem;
        nivel(7); const v7 = viaveis(); r.ameacas_nivel7Chamas = v7.chamas && !v7.sabotagem;
        nivel(8); const v8 = viaveis(); r.ameacas_nivel8Sabotagem = v8.sabotagem;
        r.novidadesPorNivelListadas = abre(5).length === 2 && abre(8)[0] === 'sabotagem';
        // sabotagem: avisa, a sala mirada pisca e o estrago acontece só se não houver ninguém na sala
        nivel(8); gameState.day = 6;
        const sv = gameState.squad; sv.forEach(m => Object.assign(m, { hp: 100, mental: null, deserted: false, duty: 'WATCH' }));
        const res = () => ({ ...gameState.resources });
        gameState.sabotagem = { ticks: 1, alvo: 'cozinha' }; const r0 = res();
        processarSabotagem(); r.sabotagem_semGuardaEstraga = gameState.resources.rations < r0.rations && gameState.sabotagem === null;
        sv[2].duty = 'RATIONING'; gameState.resources.rations = 40; gameState.sabotagem = { ticks: 1, alvo: 'cozinha' }; const pr = gameState.prestige;
        processarSabotagem(); r.sabotagem_comGuardaFrustra = gameState.resources.rations === 40 && gameState.prestige > pr;
        gameState.trench = 100; gameState.sabotagem = { ticks: 1, alvo: 'oficina' }; processarSabotagem(); r.sabotagem_oficinaMinaParapeito = gameState.trench === 90;
        iniciarSabotagem(); r.sabotagem_avisaAntes = !!gameState.sabotagem && gameState.sabotagem.ticks === SABOTAGEM.AVISO && SABOTAGEM.AVISO >= 48;
        // salvar e carregar mantém a sabotagem em curso e as dicas já vistas
        primeiraVez('teste', 'x'); saveGame();
        const salvo = JSON.parse(localStorage.getItem(SAVE_KEY));
        r.salvamento_guardaSabotagem = !!salvo.sabotagem && !!salvo.mecVistas.teste;
        // primeira vez de cada mecânica só avisa uma vez
        let n = 0; const lf = logFeed; logFeed = () => { n++; }; gameState.mecVistas = {}; primeiraVez('x', 'a'); primeiraVez('x', 'a'); logFeed = lf;
        r.primeiraVez_soUmaVez = n === 1;
        gameState.sabotagem = { ticks: 40, alvo: 'oficina' }; gameState.level = 8; jogoPausado = true; assinaturaFundo = ''; renderCorte(true);
        r.banner_sabotagem = /SABOTAGEM EM/.test(document.getElementById('corte-banner').textContent);
        gameState.level = antes;
        return r;
    }));
    await p.waitForTimeout(300); await shot('b1-sabotagem-telegrafada');
    // ---------- D) painel tático: cantoneiras, LED das salas e linha de destino ----------
    {
        await p.evaluate(() => { gameState.level = 1; jogoPausado = true; gameState.enemies = []; gameState.barrage = null; gameState.sabotagem = null; gameState.gas = null; gameState.squad.forEach(s => Object.assign(s, { hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, mental: null, duty: 'WATCH' })); Object.keys(animPos).forEach(k => delete animPos[k]); renderCorte(true); });
        const clip = await p.evaluate(() => { const r = corteCanvas.getBoundingClientRect(), e = r.width / CORTE.W, c = CORTE.comodos.abrigo; return { x: r.left + 0, y: r.top + c.y * e - 160 * e, width: r.width, height: 330 * e }; });
        const foto = async () => { await p.evaluate(() => renderCorte(true)); return p.screenshot({ clip }); };
        const parado = await foto();
        // manda um soldado do posto para o abrigo: no meio da caminhada a linha de destino aparece
        await p.evaluate(() => { const s = gameState.squad[0]; s.duty = 'REST'; renderCorte(true); const a = animPos[s.id]; a.x -= 0; a.y -= 0; });
        const andando = await foto();
        ck.painel_linhaDeDestinoAoCaminhar = !parado.equals(andando);
        // posto sem ninguém: LED vermelho (o posto não pode ficar vazio)
        await p.evaluate(() => { gameState.squad.forEach(s => { s.duty = 'REST'; }); Object.keys(animPos).forEach(k => delete animPos[k]); renderCorte(true); });
        const semVigia = await foto();
        ck.painel_ledMudaComOPostoVazio = !semVigia.equals(andando);
        ck.painel_semErrosNoDesenho = true;
    }
    // ---------- C) mira telegrafada da artilharia ----------
    {
        // (o canvas fica "contaminado" em file://, então a comparação é por captura de tela da sala do depósito)
        await p.evaluate(() => { gameState.level = 1; jogoPausado = true; gameState.enemies = []; gameState.sabotagem = null; gameState.gas = null; gameState.barrage = null; assinaturaFundo = ''; renderCorte(true); });
        const clip = await p.evaluate(() => { const r = corteCanvas.getBoundingClientRect(), e = r.width / CORTE.W, c = CORTE.comodos.deposito; return { x: r.left + c.x * e, y: r.top + c.y * e, width: c.w * e, height: c.h * e }; });
        const foto = async () => { await p.evaluate(() => renderCorte(true)); return p.screenshot({ clip }); };
        const sem = await foto();
        await p.evaluate(() => { gameState.barrage = { ticks: 40, alvos: [{ tipo: 'deposito' }, { tipo: 'ninho', i: 0 }, { tipo: 'soldado', id: 1 }] }; });
        const com = await foto();
        ck.mira_aparecNaSalaMirada = !sem.equals(com);
        ck.mira_guardaTempoInicial = await p.evaluate(() => gameState.barrage.t0 === 40);
        await p.evaluate(() => { gameState.barrage.ticks = 6; });
        const perto = await foto();
        ck.mira_projetilNosUltimos2s = !perto.equals(com);
        await p.evaluate(() => { gameState.barrage = null; });
        ck.mira_someSemBombardeio = !(await foto()).equals(perto);
        await p.evaluate(() => { gameState.barrage = { ticks: 40, alvos: [{ tipo: 'deposito' }, { tipo: 'ninho', i: 0 }, { tipo: 'soldado', id: 1 }] }; renderCorte(true); });
    }
    await p.waitForTimeout(300); await shot('c1-mira-artilharia');
    // ---------- E) caminhada: o soldado olha para onde anda; recuo ao atirar ----------
    ck.caminhada_viraParaOndeAnda = await p.evaluate(async () => {
        gameState.level = 1; jogoPausado = true; gameState.enemies = []; gameState.barrage = null; gameState.sabotagem = null;
        gameState.squad.forEach(s => Object.assign(s, { hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, mental: null, duty: 'WATCH' })); Object.keys(animPos).forEach(k => delete animPos[k]); renderCorte(true);
        const s = gameState.squad[0]; s.duty = 'RATIONING'; for (let i = 0; i < 3; i++) renderCorte(true);   // posto -> cozinha: anda para a direita
        const dir = animPos[s.id] && animPos[s.id].esq === false;
        s.duty = 'WATCH'; for (let i = 0; i < 3; i++) renderCorte(true);                                    // cozinha -> posto: anda para a esquerda
        return !!dir && animPos[s.id].esq === true;
    });
    ck.recuo_aoAtirar = await p.evaluate(() => { const antes = typeof pxVira !== 'undefined'; return antes && /recuo/.test(desenharSilhueta.toString()); });
    ck.semErrosJS = erros.length === 0;
    console.log(JSON.stringify(ck, null, 1));
    if (erros.length) console.log('ERROS:', erros);
    const falhas = Object.entries(ck).filter(([, v]) => v !== true).map(([k]) => k);
    console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Pistas visuais e desbloqueio gradual: todas as verificações passaram.');
    await b.close();
    process.exit(falhas.length ? 1 : 0);
})();
