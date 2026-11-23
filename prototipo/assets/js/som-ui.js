/* Sons de interface e movimento de tela, iguais nos três modos.
   Sintetizados na hora (sem arquivos). Respeitam o controle de som de cada modo:
   Trincheiras (isAudioMuted), Conquista (SOM.ligado) e Duelo (chave própria + botão). */
(function () {
  // Cache do jogo: as três páginas registram o mesmo service worker (/sw.js) para abrir mais rápido
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }

    const FLSom = window.FLSom = { ctx: null, saida: null };
    const CHAVE_DUELO = 'frontline-duelo-som';
    let ultimo = 0;

    function ligado() {
        try {
            if (typeof isAudioMuted !== 'undefined') return !isAudioMuted;      // Trincheiras
            if (typeof SOM !== 'undefined' && 'ligado' in SOM) return !!SOM.ligado; // Conquista
            return localStorage.getItem(CHAVE_DUELO) !== '0';                      // Duelo
        } catch (e) { return true; }
    }
    FLSom.ligado = ligado;

    function contexto() {
        if (FLSom.ctx) { if (FLSom.ctx.state === 'suspended') FLSom.ctx.resume().catch(() => {}); return FLSom.ctx; }
        try {
            const c = FLSom.ctx = new (window.AudioContext || window.webkitAudioContext)();
            FLSom.saida = c.createGain(); FLSom.saida.gain.value = 0.5; FLSom.saida.connect(c.destination);
        } catch (e) { FLSom.ctx = null; }
        return FLSom.ctx;
    }

    function nota(freq, ini, dur, vol, forma, fim) {
        const c = FLSom.ctx, t = c.currentTime + ini;
        const o = c.createOscillator(), g = c.createGain();
        o.type = forma || 'square'; o.frequency.setValueAtTime(freq, t);
        if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(FLSom.saida); o.start(t); o.stop(t + dur + 0.03);
    }

    const SONS = {
        clique:   () => nota(520, 0, 0.045, 0.07, 'square', 380),
        abrir:    () => { nota(330, 0, 0.07, 0.07, 'triangle'); nota(494, 0.06, 0.09, 0.07, 'triangle'); },
        confirma: () => { nota(523, 0, 0.08, 0.08, 'square'); nota(784, 0.07, 0.14, 0.08, 'square'); },
        erro:     () => { nota(200, 0, 0.12, 0.09, 'sawtooth', 120); nota(150, 0.1, 0.16, 0.09, 'sawtooth', 90); },
        vitoria:  () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, i * 0.14, 0.34, 0.1, 'triangle')),
        derrota:  () => [392, 349, 294, 220].forEach((f, i) => nota(f, i * 0.3, 0.6, 0.1, 'sawtooth', f * 0.9))
    };

    FLSom.tocar = function (nome) {
        if (!ligado() || document.hidden || !SONS[nome]) return;
        const agora = performance.now();
        if (nome === 'clique' && agora - ultimo < 60) return;
        ultimo = agora;
        if (!contexto()) return;
        try { SONS[nome](); } catch (e) {}
    };

    // Treme um elemento (tela inteira de jogo) por um instante; respeita "reduzir movimento"
    FLSom.tremer = function (el, forca) {
        if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        try { if ((JSON.parse(localStorage.getItem('frontline-config')) || {}).tremor === false) return; } catch (e) {} // "Tremor da tela" desligado nas configurações (vale nos três modos)
        el.style.setProperty('--fl-tremor', (forca || 3) + 'px');
        el.classList.remove('fl-tremendo'); void el.offsetWidth; el.classList.add('fl-tremendo');
        setTimeout(() => el.classList.remove('fl-tremendo'), 360);
    };

    // Clique em qualquer botão ou cartão: som curto (o áudio só nasce depois de um toque, como os navegadores exigem)
    document.addEventListener('pointerdown', (e) => {
        const b = e.target.closest && e.target.closest('button, a.modo-card, [role="button"]');
        if (!b) return;
        if (b.disabled || b.classList.contains('opacity-60') || b.getAttribute('aria-disabled') === 'true') { FLSom.tocar('erro'); return; }
        FLSom.tocar(/jogar|confirm|ok|iniciar|começar|continuar/i.test(b.id + ' ' + b.className) ? 'confirma' : 'clique');
    }, true);

    // Duelo não tem controle de som próprio: o botão fica na barra do topo (ao lado de "Menu principal"), nunca flutuando sobre o conteúdo
    FLSom.botaoHTML = function () {
        const on = ligado();
        return `<button type="button" class="fl-som-btn" aria-label="${on ? 'Desligar o som' : 'Ligar o som'}" title="${on ? 'Desligar o som' : 'Ligar o som'}">${on ? '🔊' : '🔇'}</button>`;
    };
    document.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.fl-som-btn'); if (!b) return;
        try { localStorage.setItem(CHAVE_DUELO, ligado() ? '0' : '1'); } catch (er) {}
        const on = ligado();
        document.querySelectorAll('.fl-som-btn').forEach(x => { x.textContent = on ? '🔊' : '🔇'; x.title = x.ariaLabel = on ? 'Desligar o som' : 'Ligar o som'; });
        if (on) FLSom.tocar('confirma');
    });
})();
