// FrontLine · Motor do tutorial guiado (usado pelo Trincheiras e pela campanha da Conquista; os modos online não têm tutorial)
// A pessoa aprende fazendo: o que ela precisa tocar fica piscando, o resto da tela escurece e NÃO responde ao toque.
// Cada passo: { txt, alvo?, ok?, botao?, tempo?, pularApos?, aoEntrar? }
//   alvo:  () => Element | {x,y,r} (círculo, em pixels da tela) | {x,y,w,h} (retângulo) | [vários] | null
//   ok:    () => true quando a pessoa fez o que o passo pedia (avança sozinho)
//   botao: passo só de leitura: avança no botão do cartão (ex.: "Entendi"); o alvo vira só destaque
//   tempo: o jogo pode deixar o relógio andar neste passo (o modo decide o que fazer em aoPasso)
//   pularApos: segundos até aparecer "Pular este passo" (padrão 20), para a pessoa nunca ficar presa
// Sempre dá para "Pular tutorial".
(function () {
    const estilo = document.createElement('style');
    estilo.textContent = `
        #guiaT { position: fixed; left: 50%; transform: translateX(-50%); width: calc(100% - 16px); max-width: 460px; z-index: 10000; display: none;
            padding: 8px 10px; border-radius: 10px; background: rgba(18,30,22,.97); border: 1px solid #6fd06a; color: #e6f0e0; font-size: 12px; line-height: 1.45;
            font-family: inherit; font-weight: 400; box-shadow: 0 2px 14px rgba(0,0,0,.6); }
        #guiaT.topo { top: calc(8px + env(safe-area-inset-top)); }
        #guiaT.base { bottom: calc(8px + env(safe-area-inset-bottom)); }
        #guiaT .gh { display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: #9fd08f; margin-bottom: 3px; }
        #guiaT .gh small { font-weight: 400; color: #8fa088; }
        #guiaT b { color: #ffd28a; }
        #guiaT .gb { display: flex; gap: 6px; margin-top: 6px; justify-content: space-between; align-items: center; }
        #guiaT button { border: 1px solid #3c5a40; background: #1c2a1f; color: #d6e3d1; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-family: inherit; }
        #guiaT button.forte { background: #2e5a34; border-color: #6fd06a; font-weight: 700; }
        #guiaT button.fraco { border: none; background: none; color: #8fa088; text-decoration: underline; padding: 6px 2px; }
        #guiaT.erro { border-color: #e0533f; animation: guiaTreme .3s; }
        @keyframes guiaTreme { 25% { transform: translateX(calc(-50% - 5px)); } 75% { transform: translateX(calc(-50% + 5px)); } }
        .guiaAnel { position: fixed; z-index: 9998; pointer-events: none; border: 3px solid #ffd28a; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(0,0,0,.58), 0 0 14px #ffd28a; animation: guiaPisca .9s ease-in-out infinite; display: none; }
        .guiaAnel.sem { box-shadow: 0 0 14px #ffd28a; }
        .guiaAnel.circ { border-radius: 50%; }
        @keyframes guiaPisca { 50% { border-color: rgba(255,210,138,.2); } }
        #guiaBloqueio { position: fixed; inset: 0; z-index: 9997; display: none; background: rgba(0,0,0,.58); pointer-events: none; }`;
    document.head.appendChild(estilo);

    const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; document.body.appendChild(e); return e; };
    const card = mk('div', 'guiaT'), anelA = mk('div', null, 'guiaAnel'), anelB = mk('div', null, 'guiaAnel'), fundo = mk('div', 'guiaBloqueio');
    card.setAttribute('role', 'dialog');

    let passos = [], i = -1, opts = {}, tPasso = 0, avancando = false, ultRolagem = 0, semAlvo = 0;

    const lista = (a) => !a ? [] : Array.isArray(a) ? a.filter(Boolean) : [a];
    const alvosDoPasso = () => { const P = passos[i]; if (!P || !P.alvo) return []; let a; try { a = P.alvo(); } catch (e) { a = null; } return lista(a); };
    const retDe = (a) => {
        if (a instanceof Element) { const r = a.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, circ: false }; }
        if (a.r) return { x: a.x - a.r, y: a.y - a.r, w: 2 * a.r, h: 2 * a.r, circ: true };
        return { x: a.x, y: a.y, w: a.w, h: a.h, circ: false };
    };
    const emModal = (t) => { // um aviso do próprio jogo (crise, fim de partida, atualização) sempre responde
        const m = t && t.closest && t.closest('[id^="modal-"], #tela, #configConq');
        return !!m && getComputedStyle(m).display !== 'none' && !m.classList.contains('hidden');
    };
    const ponto = (ev) => { const t = (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev; return { x: t.clientX, y: t.clientY }; };
    const dentro = (a, p, t) => {
        if (a instanceof Element) { if (a.contains(t)) return true; const r = a.getBoundingClientRect(); return p.x >= r.left - 6 && p.x <= r.right + 6 && p.y >= r.top - 6 && p.y <= r.bottom + 6; }
        if (a.r) return Math.hypot(p.x - a.x, p.y - a.y) <= a.r + 6;
        return p.x >= a.x - 6 && p.x <= a.x + a.w + 6 && p.y >= a.y - 6 && p.y <= a.y + a.h + 6;
    };
    const permitido = (ev) => {
        const t = ev.target;
        if (card.contains(t) || emModal(t)) return true;
        const P = passos[i]; if (!P || P.botao) return false;      // passo de leitura: só o botão do cartão
        const p = ponto(ev);
        return alvosDoPasso().some(a => dentro(a, p, t));
    };
    function avisar() {
        card.classList.remove('erro'); void card.offsetWidth; card.classList.add('erro');
        const m = card.querySelector('.ga'); if (m) m.style.display = 'block';
    }
    const bloquear = (ev) => { if (i < 0) return; if (!permitido(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); avisar(); } };
    ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(tp => window.addEventListener(tp, bloquear, { capture: true, passive: false }));

    function pintar() {
        const P = passos[i];
        const ultimo = i === passos.length - 1;
        card.innerHTML = `<div class="gh"><span>📘 Tutorial</span><small>${i + 1}/${passos.length}</small></div><div>${P.txt}</div>
            <div class="ga" style="display:none;color:#ffb3a8;margin-top:4px">👆 Toque só no que está piscando.</div>
            <div class="gb"><span><button class="fraco" data-g="pular">Pular tutorial</button><button class="fraco" data-g="passo" style="display:none">Pular este passo</button></span>${P.botao ? `<button class="forte" data-g="ok">${P.botao}</button>` : (ultimo ? '' : '<span></span>')}</div>`;
        card.querySelector('[data-g="pular"]').onclick = () => fim(true);
        card.querySelector('[data-g="passo"]').onclick = () => proximo();
        const ok = card.querySelector('[data-g="ok"]'); if (ok) ok.onclick = () => proximo();
        card.style.display = 'block';
    }
    function mostrar() {
        avancando = false; tPasso = performance.now(); semAlvo = 0; ultRolagem = 0;
        const P = passos[i];
        if (P.rolar) { try { const e = P.rolar(); if (e) e.scrollIntoView({ block: 'center' }); } catch (x) {} }
        if (opts.aoPasso) opts.aoPasso(P, i);
        pintar();
    }
    function proximo() { if (i < 0) return; i++; if (i >= passos.length) return fim(false); mostrar(); }
    function fim(pulou) {
        if (i < 0) return;
        i = -1; card.style.display = 'none'; anelA.style.display = anelB.style.display = 'none'; fundo.style.display = 'none';
        if (opts.aoFim) opts.aoFim(!!pulou);
    }
    function pos(anel, a, sombra) {
        const r = retDe(a), pad = 4;
        Object.assign(anel.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + 2 * pad + 'px', height: r.h + 2 * pad + 'px', display: 'block' });
        anel.classList.toggle('circ', !!r.circ); anel.classList.toggle('sem', !sombra);
    }
    // Uma janela do próprio jogo aberta (crise, confirmação, atualização): sai a camada escura para ela ficar legível e tocável
    const janelaAberta = () => [...document.querySelectorAll('[id^="modal-"]')].some(m => !m.classList.contains('hidden') && getComputedStyle(m).display !== 'none');
    function quadro() {
        if (i >= 0 && janelaAberta()) { anelA.style.display = anelB.style.display = 'none'; fundo.style.display = 'none'; requestAnimationFrame(quadro); return; }
        if (i >= 0) {
            const P = passos[i], alvos = alvosDoPasso(), agora = performance.now();
            if (!alvos.length) { anelA.style.display = anelB.style.display = 'none'; fundo.style.display = 'block'; }
            else { fundo.style.display = 'none'; pos(anelA, alvos[0], alvos.length === 1); if (alvos[1]) pos(anelB, alvos[1], false); else anelB.style.display = 'none'; }
            // o cartão sai da frente do alvo: alvo em cima → cartão embaixo, e vice-versa
            const r0 = alvos.length ? retDe(alvos[0]) : null;
            card.classList.toggle('base', !!r0 && r0.y + r0.h / 2 < innerHeight * 0.45); card.classList.toggle('topo', !(r0 && r0.y + r0.h / 2 < innerHeight * 0.45));
            // alvo fora da tela: rola até ele
            const el = alvos.find(a => a instanceof Element);
            if (el && agora - ultRolagem > 500) { const r = el.getBoundingClientRect(); if (r.height && (r.top < 0 || r.bottom > innerHeight)) { el.scrollIntoView({ block: 'center' }); ultRolagem = agora; } }
            // passo de ação sem alvo achado: segue em frente (nunca prende a pessoa)
            if (!P.botao && !alvos.length) { if (++semAlvo > 90) proximo(); } else semAlvo = 0;
            // botão de segurança
            const ps = card.querySelector('[data-g="passo"]'); if (ps && !P.botao && agora - tPasso > (P.pularApos || 20) * 1000) ps.style.display = '';
            // a pessoa fez o que o passo pedia
            if (P.ok && !avancando) { let feito = false; try { feito = !!P.ok(); } catch (e) {} if (feito) { avancando = true; setTimeout(() => { if (i >= 0 && passos[i] === P) proximo(); }, P.atraso || 350); } }
        }
        requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);

    window.GuiaT = {
        iniciar(lst, o) { passos = lst; opts = o || {}; i = 0; mostrar(); },
        ativo: () => i >= 0,
        passoAtual: () => i,
        parar() { fim(true); }
    };
})();
