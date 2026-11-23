// Desempenho: mede o tempo de quadro (média e pior 5%) das telas principais e o custo das partículas, sem tela de verdade.
// Em computador o resultado é bem melhor que num celular: serve para pegar regressão grande, não para provar que o celular aguenta.
// Para medir num celular real: no console da página use FLMedir(10000) e jogue (ver README). Uso: node tests/desempenho.js
const path = require('path'); const { chromium } = require('playwright');
const RAIZ = path.resolve(__dirname, '..', 'prototipo');
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const LIM_MEDIA = 8, LIM_P95 = 33; // ms (computador de teste; 60 fps = 16,7 ms)
const quadros = (pg, ms) => pg.evaluate((ms) => new Promise(res => { const t = []; let u = performance.now(), ini = u; (function f(n) { t.push(n - u); u = n; if (n - ini < ms) requestAnimationFrame(f); else res(t.slice(2)); })(performance.now()); requestAnimationFrame(() => {}); }), ms);
(async () => {
  const b = await chromium.launch(); const f = []; let erros = 0; const linhas = [];
  const rel = (nome, t) => { const m = t.reduce((a, x) => a + x, 0) / t.length, p = pct(t, 0.95); linhas.push(`${nome}: média ${m.toFixed(1)} ms · pior 5% ${p.toFixed(1)} ms (${t.length} quadros)`); if (m > LIM_MEDIA && m > 17) f.push(nome + ' média alta ' + m.toFixed(1)); if (p > LIM_P95) f.push(nome + ' pior 5% alto ' + p.toFixed(1)); };
  let p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'ponto-alpha.html')); await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} }); await p.reload();
  await p.evaluate(() => { try { entrarComoConvidado(); } catch (e) {} try { fecharTutorial(); } catch (e) {} }); await p.waitForTimeout(600);
  await p.evaluate(() => { jogoPausado = false; menuAberto = false; });
  rel('Trincheiras parada', await quadros(p, 3000));
  // estresse: explosões em sequência (partículas no máximo)
  await p.evaluate(() => { window.__estresse = setInterval(() => { for (let i = 0; i < 4; i++) emiteExplosao(60 + Math.random() * 280, 150 + Math.random() * 60, 1.4, true); }, 250); });
  rel('Trincheiras com explosões', await quadros(p, 4000));
  const part = await p.evaluate(() => { clearInterval(window.__estresse); for (let i = 0; i < 12; i++) emiteExplosao(100 + i * 20, 180, 1.4, true); const n = PARTICULAS.length; const t0 = performance.now(); for (let k = 0; k < 200; k++) desenharParticulas(); return { n, ms: (performance.now() - t0) / 200 }; });
  linhas.push(`Partículas: ${part.n} ativas, ${part.ms.toFixed(2)} ms por quadro (limite 500)`); if (part.ms > 4) f.push('partículas lentas: ' + part.ms.toFixed(2) + ' ms por quadro');
  if (part.n > 500) f.push('mais de 500 partículas: ' + part.n);
  await p.close();
  p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => { console.log('ERRO JS', e.message); erros++; });
  await p.goto('file://' + path.join(RAIZ, 'conquista.html')); await p.waitForTimeout(400);
  await p.evaluate(() => { comecarFase(3); pausar(false); }); await p.waitForTimeout(500);
  rel('Conquista rodando', await quadros(p, 4000));
  console.log(linhas.join('\n')); console.log(f.length || erros ? 'FALHOU:\n' + f.join('\n') : 'OK: tempos de quadro dentro do limite'); await b.close(); process.exit(f.length || erros ? 1 : 0);
})();
