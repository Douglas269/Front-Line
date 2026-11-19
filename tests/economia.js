// Nova economia da Conquista: dinheiro (custo + manutenção), aço, mão de obra (usado/máximo), comida e munição.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const erros = [], falhas = [];
  const URL = 'file://' + __dirname.replace(/tests$/, '') + 'prototipo/conquista.html';
  const p = await b.newPage({ viewport: { width: 400, height: 800 } }); p.on('pageerror', e => erros.push(e.message));
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.goto(URL); await p.waitForTimeout(300);
  const R = await p.evaluate(() => {
    const r = {};
    const novo = () => { comecarFase(1); G.pausado = true; Object.keys(G.pensar).forEach(x => { G.pensar[x] = 1e9; }); };
    const libera = (t) => { G.pesq.jogador.feitas[t] = true; };
    // 1) custo de recrutar: dinheiro, aço e uma vaga de mão de obra
    novo(); { const cap = G.prov[G.capitalJogador], f = G.fac.jogador; f.moedas = 500; f.aco = 100; libera('metr'); libera('art'); libera('blind');
        const m0 = f.moedas, a0 = f.aco, u0 = maoDeObraUsada('jogador');
        recrutarEm(cap.id, 'jogador', 'inf'); r.inf = { moedas: m0 - f.moedas, aco: a0 - f.aco, mo: maoDeObraUsada('jogador') - u0 };
        const m1 = f.moedas, a1 = f.aco; recrutarEm(cap.id, 'jogador', 'metr'); r.metr = { moedas: m1 - f.moedas, aco: a1 - f.aco };
        const m2 = f.moedas, a2 = f.aco; recrutarEm(cap.id, 'jogador', 'art'); r.art = { moedas: m2 - f.moedas, aco: a2 - f.aco };
        const m3 = f.moedas, a3 = f.aco; recrutarEm(cap.id, 'jogador', 'blind'); r.blind = { moedas: m3 - f.moedas, aco: a3 - f.aco }; }
    // 2) motivos de não recrutar
    novo(); { const f = G.fac.jogador; libera('art'); f.moedas = 500; f.aco = 5; r.motivoAco = motivoSemRecrutar('jogador', 'art'); f.aco = 100; f.moedas = 5; r.motivoMoedas = motivoSemRecrutar('jogador', 'inf'); f.moedas = 500; r.motivoPesq = motivoSemRecrutar('jogador', 'blind'); }
    // 3) mão de obra: máximo pelas províncias; para de recrutar no limite; dispensar devolve a vaga
    novo(); { const f = G.fac.jogador, cap = G.prov[G.capitalJogador]; f.moedas = 1e6; f.aco = 1e6; const max = maoDeObraMax('jogador');
        r.maxConfere = max === provDe('jogador').reduce((t, q) => t + C.MO[q.tipo], 0);
        let n = 0; for (let i = 0; i < 200; i++) if (recrutarEm(cap.id, 'jogador', 'inf')) n++;
        r.noLimite = { usada: maoDeObraUsada('jogador'), max, livre: maoDeObraLivre('jogador'), motivo: motivoSemRecrutar('jogador', 'inf') };
        const e = exParadosEm(cap.id, 'jogador')[0]; const antes = maoDeObraUsada('jogador'); const dis = dispensar(e.id, 3); r.dispensar = { saiu: dis, voltou: antes - maoDeObraUsada('jogador'), livre: maoDeObraLivre('jogador') };
        r.recrutaDepois = recrutarEm(cap.id, 'jogador', 'inf'); }
    // 4) manutenção: o ciclo desconta o custo da tropa (renda - manutenção)
    novo(); { const f = G.fac.jogador; f.moedas = 300; const m0 = f.moedas, renda = rendaDe('jogador', 'moedas'), manut = manutencaoDe('jogador'); cicloEconomia(); r.manut = { delta: f.moedas - m0, esperado: renda - manut, manut }; }
    // 5) déficit: sem dinheiro o soldo atrasa; eficácia cai; moral cai; no extremo, deserção; pagando, o atraso some
    novo(); { const f = G.fac.jogador, cap = G.prov[G.capitalJogador]; G.fac.jogador.moedas = 0;
        const e = exParadosEm(cap.id, 'jogador')[0]; for (let i = 0; i < 150; i++) e.s.push(soldado('Extra')); // manutenção muito acima da renda
        const efic0 = eficacia(e.s[0]); const soldados0 = tropaDe('jogador');
        f.moedas = 0; cicloEconomia(); r.atraso1 = f.atraso;
        for (let i = 0; i < 8; i++) { f.moedas = 0; cicloEconomia(); }
        r.atrasoAlto = f.atraso; r.soldoCopiado = e.s.every(s => s.soldo === f.atraso); r.eficReduzida = eficacia(e.s[0]) < efic0 - 0.05;
        const filha = provDe('jogador').find(q => !q.capital); filha.moral = 100; for (let i = 0; i < 40; i++) atualizarMoral(); r.moralCaiu = filha.moral < 85; // (a capital nunca cai abaixo de 90: a prova é uma província comum)
        for (let i = 0; i < 40; i++) { f.moedas = 0; cicloEconomia(); } r.desertou = tropaDe('jogador') < soldados0;
        f.moedas = 5000; for (let i = 0; i < 12; i++) cicloEconomia(); r.recuperou = f.atraso === 0; }
    // 6) obras e fortificar gastam aço
    novo(); { const f = G.fac.jogador, cap = G.prov[G.capitalJogador]; f.moedas = 500; f.aco = 5; const semAco = construir(cap.id, 'forte'); f.aco = 50; const m0 = f.moedas, a0 = f.aco; const ok = construir(cap.id, 'forte');
        r.obra = { semAco, ok, moedas: m0 - f.moedas, aco: a0 - f.aco, custoAco: custoObraAco('jogador', 'forte') };
        cap.trinch = 50; f.aco = 1; r.fortSemAco = fortificar(cap.id); f.aco = 10; f.moedas = 100; const mm = f.moedas, aa = f.aco; r.fort = { ok: fortificar(cap.id), moedas: mm - f.moedas, aco: aa - f.aco }; }
    // 7) produção: aço por tipo de província e fábrica
    novo(); { const q = G.prov[G.capitalJogador]; q.moral = 100; const base = producaoDe(q).aco; q.obras.fabrica = true; r.fabricaAco = producaoDe(q).aco - base; q.obras.fabrica = false; }
    // 8) painel Economia e chips do topo
    novo(); { abrirEconomia(); const t = document.getElementById('painel').textContent; r.painelEco = /Economia/.test(t) && /Mão de obra/.test(t) && /Aço/.test(t) && /Dinheiro/.test(t) && /Soldo em dia/.test(t);
        atualizarTopo(); r.chips = ['rCom', 'rMun', 'rMoe', 'rAco', 'rMO', 'rProv'].every(id => !!document.getElementById(id)); r.chipMO = /^\d+\/\d+$/.test(document.getElementById('rMO').querySelector('b').textContent);
        G.sel = { tipo: 'prov', id: G.capitalJogador }; renderPainel(); r.provMostraMO = /sustenta \d+👥/.test(document.getElementById('painel').textContent) && /Recrutar 1/.test(document.getElementById('painel').textContent);
        G.sel = { tipo: 'recrutar', id: G.capitalJogador }; renderPainel(); const pr = document.getElementById('painel').textContent; r.recrutarMostraCusto = /⚙️/.test(pr) && /👥/.test(pr) && /\/ciclo/.test(pr);
        const ex = G.ex.find(e => e.dono === 'jogador'); G.sel = { tipo: 'dispensar', id: ex.id }; renderPainel(); r.painelDispensar = /Dispensar/.test(document.getElementById('painel').textContent) && /manutenção/.test(document.getElementById('painel').textContent); }
    // 9) save antigo (sem aço e sem soldo) é migrado
    novo(); { G.pausado = false; salvarPartida(); const d = JSON.parse(localStorage.getItem(SAVE_CONQ)); Object.values(d.fac).forEach(f => { delete f.aco; delete f.atraso; }); localStorage.setItem(SAVE_CONQ, JSON.stringify(d)); carregarPartida(); r.saveAntigo = G.fac.jogador.aco === C.ACO_INICIAL && G.fac.jogador.atraso === 0; }
    // 10) bots: com a economia nova nenhum bot atrasa o soldo nos primeiros 5 minutos (eles não gastam mais do que sustentam)
    novo(); { G.pausado = false; Object.keys(G.pensar).forEach(x => { G.pensar[x] = 5; }); let maxAtraso = 0, neg = false; for (let i = 0; i < 600; i++) { passoMapa(0.5); G.fase.bots.forEach(bt => { maxAtraso = Math.max(maxAtraso, G.fac[bt].atraso || 0); if (G.fac[bt].moedas < 0 || (G.fac[bt].aco || 0) < 0) neg = true; }); }
        r.bots = { maxAtraso, neg, tropas: G.fase.bots.map(bt => tropaDe(bt)) }; }
    return r;
  });
  const ck = (ok, msg) => { if (!ok) falhas.push(msg); };
  ck(R.inf.moedas === 15 && R.inf.aco === 0 && R.inf.mo === 1, 'infantaria: custo e vaga ' + JSON.stringify(R.inf));
  ck(R.metr.moedas === 25 && R.metr.aco === 2, 'metralhadora: 25🪙 + 2⚙️ ' + JSON.stringify(R.metr));
  ck(R.art.moedas === 35 && R.art.aco === 6, 'artilharia: 35🪙 + 6⚙️ ' + JSON.stringify(R.art));
  ck(R.blind.moedas === 50 && R.blind.aco === 12, 'blindado: 50🪙 + 12⚙️ ' + JSON.stringify(R.blind));
  ck(/aço/.test(R.motivoAco || ''), 'motivo: falta aço ' + R.motivoAco);
  ck(/moedas/.test(R.motivoMoedas || ''), 'motivo: faltam moedas ' + R.motivoMoedas);
  ck(/pesquisada/.test(R.motivoPesq || ''), 'motivo: tropa ainda não pesquisada ' + R.motivoPesq);
  ck(R.maxConfere, 'mão de obra máxima = soma das províncias');
  ck(R.noLimite.usada <= R.noLimite.max && R.noLimite.livre === 0 && /mão de obra/.test(R.noLimite.motivo || ''), 'para de recrutar no limite da mão de obra ' + JSON.stringify(R.noLimite));
  ck(R.dispensar.saiu === 3 && R.dispensar.voltou === 3 && R.dispensar.livre === 3 && R.recrutaDepois, 'dispensar devolve a mão de obra ' + JSON.stringify(R.dispensar));
  ck(Math.abs(R.manut.delta - R.manut.esperado) < 0.01 && R.manut.manut > 0, 'manutenção por ciclo = renda - manutenção ' + JSON.stringify(R.manut));
  ck(R.atraso1 > 0 && R.atrasoAlto >= 80 && R.soldoCopiado && R.eficReduzida, 'déficit: soldo atrasa e a eficácia cai ' + JSON.stringify([R.atraso1, R.atrasoAlto, R.soldoCopiado, R.eficReduzida]));
  ck(R.moralCaiu, 'déficit derruba a moral da capital');
  ck(R.desertou, 'déficit extremo: soldados desertam');
  ck(R.recuperou, 'pagando em dia, o atraso some');
  ck(!R.obra.semAco && R.obra.ok && R.obra.moedas === 40 && R.obra.aco === R.obra.custoAco && R.obra.aco === 6, 'obra gasta dinheiro e aço ' + JSON.stringify(R.obra));
  ck(!R.fortSemAco && R.fort.ok && R.fort.moedas === 15 && R.fort.aco === 2, 'fortificar gasta 15🪙 e 2⚙️ ' + JSON.stringify([R.fortSemAco, R.fort]));
  ck(Math.abs(R.fabricaAco - 1) < 0.01, 'fábrica produz +1 aço');
  ck(R.painelEco && R.chips && R.chipMO && R.provMostraMO && R.recrutarMostraCusto && R.painelDispensar, 'telas da economia: ' + JSON.stringify([R.painelEco, R.chips, R.chipMO, R.provMostraMO, R.recrutarMostraCusto, R.painelDispensar]));
  ck(R.saveAntigo, 'save antigo sem aço é migrado');
  ck(R.bots.maxAtraso === 0 && !R.bots.neg, 'bots não atrasam o soldo nem ficam negativos ' + JSON.stringify(R.bots));
  console.log(JSON.stringify({ erros: [...new Set(erros)], falhas }, null, 1));
  console.log(falhas.length || erros.length ? 'FALHAS: ' + JSON.stringify(falhas) : 'Economia: todas as verificações passaram, sem erros de JavaScript.');
  await b.close(); process.exit(falhas.length || erros.length ? 1 : 0);
})();
