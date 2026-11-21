// FrontLine · Conquista: tutorial jogando, previsão de ataque, alerta de ataque, reunir tropas e mini mapa
// Carregado depois de conquista-config.js. Tudo se encaixa por cima das funções do jogo (renderPainel, atualizarTopo, desenharMapa, comecarFase).
// - Tutorial guiado: só na fase 1 da campanha (usa guia-tutorial.js): a pessoa é obrigada a tocar no que pisca; dá para pular.
// - Previsão de ataque: ao preparar uma ordem contra uma província visível, compara sua força com a defesa estimada.
// - Alerta de ataque, "Reunir tropas aqui" e mini mapa: só nas fases 4 em diante (mapas maiores), na campanha.

(function () {
    const GUIA_KEY = 'frontline-conq-guia';
    const faseAlta = () => !!G && !G.online && !G.cliente && G.fase && G.fase.n >= 4;
    const estilo = document.createElement('style');
    estilo.textContent = `
        #alertaAtaque { display: none; position: absolute; left: 8px; right: 116px; top: 38px; z-index: 5; padding: 6px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; background: rgba(90,24,24,.95); border: 1px solid #c0392b; color: #ffe0d8; text-align: left; }
        #miniMapa { display: none; position: absolute; right: 8px; top: 38px; z-index: 4; border: 1px solid #3a4a3e; border-radius: 6px; background: #12202a; opacity: .92; }
        .prev { margin: 4px 0; padding: 6px 8px; border-radius: 8px; border: 1px solid #3a4a3e; background: #0f1411; font-size: 11px; line-height: 1.5; }`;
    document.head.appendChild(estilo);
    const caixa = document.getElementById('mapaBox');

    // ---------- Previsão do ataque ----------
    function previsaoAtaque() {
        const o = G.pendente; if (!o) return '';
        const e = G.ex.find(x => x.id === o.exId), p = G.prov[o.destId]; if (!e || !p) return '';
        if (p.dono === 'jogador' || (p.dono !== 'neutro' && !emGuerra('jogador', p.dono))) return '';
        const vao = vivos(e.s).sort((a, b) => eficacia(b) - eficacia(a)).slice(0, e.rota.length ? e.s.length : o.qtd);
        const ataque = vao.reduce((t, s) => t + eficacia(s) * Math.sqrt(TROPAS[s.tipo || 'inf'].atq), 0);
        if (!provVisivel(p.id) && !espiado(p.dono)) return `<div class="prev">🔭 <b>Defesa desconhecida</b>: a província está na névoa. Mande um espião para estimar antes de atacar. Sua força: <b>${ataque.toFixed(1)}</b>.</div>`;
        const defesa = defesaEm(p), r = defesa > 0 ? ataque / defesa : 9;
        const [txt, cor] = r >= 1.5 ? ['vitória provável', '#7bc96f'] : r >= 1.2 ? ['favorável, mas arriscado', '#c9d66a'] : r >= 0.95 ? ['equilibrado: pode perder', '#e3b04b'] : ['muito arriscado: provavelmente perde', '#e0705f'];
        return `<div class="prev">⚖ Sua força <b>${ataque.toFixed(1)}</b> × defesa estimada <b>${(defesa * 0.88).toFixed(0)}–${(defesa * 1.12).toFixed(0)}</b> (trincheira ${Math.round(p.trinch)}%${p.capital ? ', capital' : ''}${p.obras && p.obras.forte ? ', forte' : ''}) → <b style="color:${cor}">${txt}</b></div>`;
    }

    // ---------- Reunir tropas (fases altas) ----------
    window.reunirAqui = function (provId) {
        let n = 0;
        G.ex.filter(e => e.dono === 'jogador' && e.prov !== provId && !e.emBatalha && !e.rota.length && e.s.length).forEach(e => { if (ordem(e.id, provId, e.s.length, 'mover')) n++; });
        noticia(n ? `🧲 ${n} exército${n > 1 ? 's' : ''} a caminho de ${G.prov[provId].nome} para se reunir.` : 'Nenhum exército parado fora daqui para reunir.');
        renderPainel();
    };
    const paradosFora = (provId) => G.ex.filter(e => e.dono === 'jogador' && e.prov !== provId && !e.emBatalha && !e.rota.length && e.s.length).length;

    // ---------- Alerta de ataque (fases altas) ----------
    function etaAte(e, provId) {
        const i = e.rota.indexOf(provId); if (i < 0) return null;
        let d = 0, x = e.x, y = e.y;
        for (let k = 0; k <= i; k++) { const q = G.prov[e.rota[k]]; d += Math.hypot(q.x - x, q.y - y); x = q.x; y = q.y; }
        return d / velEx(e);
    }
    function ameacasSobreMim() {
        const r = [];
        G.ex.forEach(e => {
            if (e.dono === 'jogador' || e.dono === 'neutro' || !e.rota.length || !emGuerra(e.dono, 'jogador')) return;
            if (!(exVisivel(e) || G.espiado[e.dono] > G.t)) return;
            const alvo = e.rota.find(id => G.prov[id].dono === 'jogador'); if (!alvo) return;
            const eta = etaAte(e, alvo); if (eta != null) r.push({ e, alvo, eta });
        });
        return r.sort((a, b) => a.eta - b.eta);
    }
    const alerta = document.createElement('button'); alerta.id = 'alertaAtaque'; caixa.appendChild(alerta);
    alerta.onclick = () => { const a = alerta.dataset.alvo; if (!a || !G.prov[a]) return; centralizar(G.prov[a].x, G.prov[a].y); G.sel = { tipo: 'prov', id: a }; G.pendente = null; G.modo = null; renderPainel(); };
    function atualizarAlerta() {
        if (!faseAlta() || G.fim) { alerta.style.display = 'none'; return; }
        const l = ameacasSobreMim();
        if (!l.length) { alerta.style.display = 'none'; return; }
        const a = l[0], txt = `⚠ ${FACCOES[a.e.dono].nome} → ${G.prov[a.alvo].nome} em ~${Math.max(1, Math.ceil(a.eta))}s (${a.e.s.length} soldados)${l.length > 1 ? ` · +${l.length - 1}` : ''} · toque para ir`;
        if (alerta.textContent !== txt) alerta.textContent = txt;
        alerta.dataset.alvo = a.alvo; alerta.style.display = 'block';
    }

    // ---------- Mini mapa (fases altas) ----------
    const mini = document.createElement('canvas'); mini.id = 'miniMapa'; caixa.appendChild(mini);
    let miniT = 0;
    function desenharMini(agora) {
        if (!faseAlta() || !MAPA) { mini.style.display = 'none'; return; }
        if (agora - miniT < 200) return; miniT = agora;
        const L = 92, A = Math.round(L * MAPA.H / MAPA.W), d = 2;
        if (mini.width !== L * d) { mini.width = L * d; mini.height = A * d; mini.style.width = L + 'px'; mini.style.height = A + 'px'; }
        mini.style.display = 'block';
        const c = mini.getContext('2d'), k = (L * d) / MAPA.W;
        c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#12202a'; c.fillRect(0, 0, mini.width, mini.height);
        c.setTransform(k, 0, 0, k, 0, 0);
        Object.values(G.prov).forEach(p => {
            c.globalAlpha = provVisivel(p.id) ? 1 : 0.5; c.fillStyle = p.dono === 'neutro' ? '#6d6d5c' : FACCOES[p.dono].cor; c.fill(p.path);
            c.globalAlpha = 1; c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1 / k; c.stroke(p.path);
        });
        Object.values(G.prov).filter(p => p.capital).forEach(p => { c.fillStyle = '#fff'; c.fillRect(p.x - 4 / k, p.y - 4 / k, 8 / k, 8 / k); });
        G.ex.filter(e => e.dono === 'jogador' || exVisivel(e)).forEach(e => { c.fillStyle = e.dono === 'neutro' ? '#aaa' : FACCOES[e.dono].cor; c.strokeStyle = '#000'; c.lineWidth = 1 / k; c.beginPath(); c.arc(e.x, e.y, 3.5 / k, 0, 6.3); c.fill(); c.stroke(); });
        const r = cvM.getBoundingClientRect(), vw = r.width / cam.z, vh = r.height / cam.z;
        c.strokeStyle = '#fff'; c.lineWidth = 2 / k; c.strokeRect(cam.x - vw / 2, cam.y - vh / 2, vw, vh);
    }
    mini.addEventListener('pointerdown', ev => {
        ev.stopPropagation(); ev.preventDefault();
        const r = mini.getBoundingClientRect(); centralizar((ev.clientX - r.left) / r.width * MAPA.W, (ev.clientY - r.top) / r.height * MAPA.H);
    });

    // ---------- Tutorial guiado (fase 1 da campanha) ----------
    const jaViu = () => { try { return localStorage.getItem(GUIA_KEY) === 'feito'; } catch (e) { return false; } };
    const marcarFeito = () => { try { localStorage.setItem(GUIA_KEY, 'feito'); } catch (e) {} };
    const botaoPainel = (txt) => [...document.querySelectorAll('#painel button')].find(b => b.textContent.includes(txt) && !b.disabled);
    const ptMapa = (x, y, r) => { const s = paraTela(x, y), rc = cvM.getBoundingClientRect(); return { x: rc.left + s.x, y: rc.top + s.y, r }; };
    function passosGuia() {
        const meu = G.ex.filter(e => e.dono === 'jogador' && !e.rota.length).sort((a, b) => b.s.length - a.s.length)[0];
        const viz = meu ? G.prov[meu.prov].viz.map(v => G.prov[v]) : [];
        const alvo = viz.find(v => v.dono === 'neutro') || viz.find(v => v.dono !== 'jogador');
        const cap = G.prov[G.capitalJogador];
        return [
            { txt: 'Você é o <b style="color:#6fd06a">verde</b>. Vamos aprender <b>jogando</b>: toque sempre no que estiver <b>piscando</b>. O jogo fica pausado enquanto você aprende.', botao: 'Vamos lá' },
            { txt: 'Este é o seu <b>exército</b> (os bonecos verdes). Toque nele para selecioná-lo.', alvo: () => meu && ptMapa(meu.x, meu.y + 4, 36), ok: () => G.sel && G.sel.tipo === 'ex' },
            { txt: 'Toque em <b>Mover / Atacar</b>.', alvo: () => botaoPainel('Mover'), ok: () => !!(G.modo || G.pendente) },
            { txt: `Agora toque na província de destino: <b>${alvo ? alvo.nome : 'a vizinha'}</b> (as cinzas são <b>milícia</b>, mais fraca: uma boa primeira conquista).`, alvo: () => alvo && ptMapa(alvo.x, alvo.y, 40), ok: () => !!G.pendente },
            { txt: 'O painel mostra a <b>previsão da batalha</b>: sua força contra a defesa estimada do inimigo. Se der risco, toque em <b>todos</b> para mandar a tropa inteira.', alvo: () => document.querySelector('#painel .prev'), botao: 'Entendi' },
            { txt: 'Toque em <b>Confirmar</b> para mandar a tropa.', alvo: () => botaoPainel('Confirmar'), ok: () => G.ex.some(e => e.dono === 'jogador' && e.rota.length) },
            { txt: 'A tropa marcha e luta sozinha. Agora toque na sua <b>capital ★</b> (no ponto piscando, acima dos soldados) para ver o que dá para fazer nela.', alvo: () => cap && (({ x, y }) => ({ x, y: y - 34, r: 28 }))(ptMapa(cap.x, cap.y, 0)), ok: () => G.sel && G.sel.tipo === 'prov' && G.prov[G.sel.id] && G.prov[G.sel.id].dono === 'jogador' },
            { txt: 'Toque em <b>Recrutar…</b> para escolher que tropa criar. Cada tropa custa <b>dinheiro 🪙</b> (as pesadas também <b>aço ⚙</b>), ocupa <b>1 vaga de mão de obra 👥</b> e paga <b>manutenção</b> a cada ciclo.', alvo: () => botaoPainel('Recrutar…'), ok: () => G.sel && G.sel.tipo === 'recrutar' },
            { txt: 'Cada tropa tem pontos fortes e fracos. Toque no <b>ℹ</b> da Infantaria para ver a ficha dela.', alvo: () => document.querySelector('#painel .info-i'), ok: () => !!G.fichaTipo },
            { txt: 'Leia o custo, as vantagens e desvantagens e o quadro <b>Contra cada tropa</b>. Depois toque em <b>← Voltar</b>.', alvo: () => botaoPainel('Voltar'), ok: () => G.sel && G.sel.tipo === 'prov', pularApos: 40 },
            { txt: 'Pronto! <b>Tome as capitais ★ inimigas</b> para vencer e proteja a sua. Toque no <b>⏸</b> para pausar quando quiser pensar, e em qualquer recurso do topo (🍞 🪙 ⚙ 👥) para ver a <b>economia</b>: o que entra, o que sai e a manutenção da tropa. Boa sorte!', botao: 'Concluir' }
        ];
    }
    function terminarGuia() { marcarFeito(); try { pausar(false); } catch (e) {} }
    window.guiaReiniciar = function () { try { localStorage.removeItem(GUIA_KEY); } catch (e) {} };
    window.guiaSeVale = function () { // chamado ao começar a fase 1 da campanha (o online não tem tutorial)
        const forcar = /[?&]guia=1/.test(location.search);
        if (G && !G.online && G.fase.n === 1 && !jaViu() && (forcar || !navigator.webdriver)) {
            try { pausar(true); } catch (e) {}
            GuiaT.iniciar(passosGuia(), { aoFim: terminarGuia });
        }
    };

    // ---------- encaixes ----------
    const _g_comecarFase = comecarFase;
    comecarFase = function (n) { const r = _g_comecarFase(n); guiaSeVale(); return r; };
    const _g_renderPainel = renderPainel;
    renderPainel = function () {
        const r = _g_renderPainel.apply(this, arguments);
        const pn = document.getElementById('painel'); if (!pn || !G) return r;
        const acoes = pn.querySelectorAll('.acoes'), ult = acoes[acoes.length - 1];
        if (G.pendente && ult && !pn.querySelector('.prev')) { const h = previsaoAtaque(); if (h) ult.insertAdjacentHTML('beforebegin', h); }
        if (faseAlta() && !G.modo && !G.pendente && G.sel && G.sel.tipo === 'prov' && G.prov[G.sel.id] && G.prov[G.sel.id].dono === 'jogador' && ult && !pn.textContent.includes('Reunir tropas aqui')) {
            const n = paradosFora(G.sel.id);
            if (n) ult.insertAdjacentHTML('beforeend', botao('🧲 Reunir tropas aqui', `traz os ${n} exército${n > 1 ? 's' : ''} parado${n > 1 ? 's' : ''}`, `reunirAqui('${G.sel.id}')`));
        }
        return r;
    };
    const _g_atualizarTopo = atualizarTopo;
    atualizarTopo = function () { _g_atualizarTopo(); atualizarAlerta(); };
    const _g_desenharMapa = desenharMapa;
    desenharMapa = function () { _g_desenharMapa(); desenharMini(performance.now()); };
})();
