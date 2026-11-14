// FrontLine · Interface, sons, medalhas e configurações
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           INTERFACE UPDATES & CONTROLS
           ========================================================================== */

        const ORDER_INFO = {
            SUPPRESSION: { nome: 'Fogo Supressão', desc: 'ataque +60% e inimigos 70% mais lentos; gasta munição pesada e o dobro de munição leve.' },
            SHELTER: { nome: 'Abrigo Reforçado', desc: 'dano recebido −75% (tiros, drones e artilharia); ataque −60%. Não protege contra invasão.' },
            CONSERVE: { nome: 'Economizar Munição', desc: 'gasto de munição leve −65%; ataque −30%.' },
            FULL_VIGILANCE: { nome: 'Vigília Total', desc: 'mapa visível e tiro com mira mesmo sem vigias; todo o esquadrão cansa mais rápido.' },
            SIGNAL_JAM: { nome: 'Bloqueio de Sinal', desc: 'drones não guiam mais a artilharia nem os tiros inimigos, e cada um tem 40% de chance por segundo de cair; o rádio fica ocupado (sem relatório e sem apoios da Central).' }
        };

        const ORDER_BUTTONS = {
            SUPPRESSION: 'btn-ord-suppress',
            SHELTER: 'btn-ord-cover',
            CONSERVE: 'btn-ord-conserve',
            FULL_VIGILANCE: 'btn-ord-vigilance',
            SIGNAL_JAM: 'btn-ord-jam'
        };

        // Acende os botões conforme as ordens ligadas (também ao restaurar a partida)
        function syncOrderButtons() {
            Object.entries(ORDER_BUTTONS).forEach(([order, id]) => {
                document.getElementById(id).classList.toggle('btn-active-order', !!gameState.tacticalOrders[order]);
            });
        }

        // Ordens que se contradizem: ligar uma desliga a outra
        const ORDER_CONFLICTS = {
            SUPPRESSION: 'CONSERVE',       // gastar munição x poupar munição
            CONSERVE: 'SUPPRESSION',
            SHELTER: 'FULL_VIGILANCE',     // abaixar na trincheira x todos de olho no campo
            FULL_VIGILANCE: 'SHELTER'
        };

        // Garante que pares contraditórios nunca fiquem ligados juntos (ex.: salvamento antigo)
        function normalizeOrders() {
            const o = gameState.tacticalOrders;
            if (o.SUPPRESSION && o.CONSERVE) o.CONSERVE = false;
            if (o.SHELTER && o.FULL_VIGILANCE) o.FULL_VIGILANCE = false;
        }

        function toggleTacticalOrder(order) {
            gameState.tacticalOrders[order] = !gameState.tacticalOrders[order];
            const info = ORDER_INFO[order];
            const ligada = gameState.tacticalOrders[order];
            const rival = ORDER_CONFLICTS[order];
            if (ligada && rival && gameState.tacticalOrders[rival]) {
                gameState.tacticalOrders[rival] = false;
                logFeed(`Ordem DESATIVADA: ${ORDER_INFO[rival].nome} (não combina com ${info.nome}).`, 'text-mil-amberMuted');
            }
            logFeed(`Ordem ${ligada ? 'ATIVADA' : 'DESATIVADA'}: ${info.nome}${ligada ? ' (' + info.desc + ')' : ''}`, 'text-mil-amberMuted');
            syncOrderButtons();
            playTacticalBeep(650, 0.03);
        }

        function switchTab(tabName) {
            ['squad', 'logistics', 'radio', 'diary', 'defense'].forEach(t => {
                document.getElementById(`panel-${t}`).classList.add('hidden');
                document.getElementById(`tab-${t}`).className = 'py-2 border-b-2 border-transparent text-mil-textMuted hover:text-mil-textGlow';
            });

            document.getElementById(`panel-${tabName}`).classList.remove('hidden');
            document.getElementById('conteudo-abas').scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById(`tab-${tabName}`).className = 'py-2 border-b-2 border-mil-greenMuted text-mil-textGlow bg-mil-panel font-bold';
            playTacticalBeep(800, 0.03);
        }

        function updateClockAndUI() {
            document.getElementById('lbl-day').textContent = gameState.day;
            const cycleNames = ['MANHÃ (08:00)', 'TARDE (13:00)', 'NOITE (20:00)', 'MADRUGADA (03:00)'];
            const cycleIndex = Math.min(3, Math.floor(gameState.timeSeconds / 60));
            document.getElementById('lbl-time-cycle').textContent = cycleNames[cycleIndex];

            document.getElementById('lbl-weather').textContent = gameState.weather;
            const ico = document.getElementById('ico-weather');
            if (gameState.weather === 'Nublado') ico.className = 'fa-solid fa-cloud-sun text-mil-amberMuted';
            if (gameState.weather === 'Névoa Espessa') ico.className = 'fa-solid fa-smog text-mil-textMuted';
            if (gameState.weather === 'Chuva Forte') ico.className = 'fa-solid fa-cloud-showers-heavy text-mil-komonaBlue';
            if (gameState.weather === 'Neve') ico.className = 'fa-solid fa-snowflake text-cyan-200';
        }

        let lastSquadSignature = '';

        function updateUI() {
            preencherIcones();
            renderBarraRecursos();
            if (typeof renderBotaoContraBateria === 'function') renderBotaoContraBateria();
            if (typeof renderCartao === 'function' && cartaoAberto) renderCartao();
            renderDefesas();
            document.getElementById('val-rations').textContent = `${Math.round(gameState.resources.rations)} un`;
            document.getElementById('val-water').textContent = `${Math.round(gameState.resources.water)} L`;
            document.getElementById('val-ammo-rifle').textContent = `${Math.round(gameState.resources.ammoRifle)} / ${PRESSURE.AMMO_CAP_RIFLE}`;
            { const b = balasPorInimigo(); document.getElementById('txt-balas-inimigo').textContent = b ? `≈ ${b} balas por inimigo hoje` : 'Uso em Fuzis / Snipers'; }
            document.getElementById('val-ammo-heavy').textContent = `${Math.round(gameState.resources.ammoHeavy)} / ${PRESSURE.AMMO_CAP_HEAVY}`;
            document.getElementById('val-medkits').textContent = `${gameState.resources.medkits} kits`;

            document.getElementById('lbl-supply-eff').textContent = `${gameState.supplyLineEff}%`;
            document.getElementById('bar-supply-eff').style.width = `${gameState.supplyLineEff}%`;
            document.getElementById('lbl-prestige').textContent = `${gameState.prestige} PTS`;

            // Trincheira e recebimento de suprimentos
            const tr = Math.round(gameState.trench);
            const trEl = document.getElementById('lbl-trench');
            trEl.textContent = trincheiraRompida() ? `${tr}% · ROMPIDA` : `${tr}%`;
            trEl.className = `font-bold ${tr >= 70 ? 'text-mil-greenMuted' : tr >= 40 ? 'text-mil-amberMuted' : 'text-red-400'}`;
            const trBar = document.getElementById('bar-trench');
            trBar.style.width = `${tr}%`;
            trBar.className = `h-full transition-all duration-300 ${tr >= 70 ? 'bg-mil-greenMuted' : tr >= 40 ? 'bg-mil-amberMuted' : 'bg-red-700'}`;
            const livres = supplyReceivers();
            const recEl = document.getElementById('lbl-receivers');
            recEl.textContent = livres > 0
                ? `Para descarregar: ${livres} soldado(s) fora da vigília.`
                : 'Ninguém fora da vigília: metade do próximo comboio vai se perder!';
            recEl.className = `text-xs mt-1 ${livres > 0 ? 'text-mil-textMuted' : 'text-red-400 font-bold'}`;

            // Carga emergencial: mostra a contagem enquanto está a caminho
            document.getElementById('txt-supply-eta').textContent = `Chega em ${seg(esperaCarga())} s (nível ${gameState.level || 1}; dobra com a linha cortada)`;
            renderCargas();
            document.getElementById('lbl-cost-artillery').textContent = `${custo(100)} PTS`;
            document.getElementById('lbl-cost-medevac').textContent = `${custo(150)} PTS`;
            const counterBtn = document.getElementById('btn-counter');
            const counterOk = !!gameState.barrage && !gameState.counterBattery && !(gameState.recargaContra > 0);
            counterBtn.disabled = !counterOk;
            counterBtn.classList.toggle('opacity-40', !counterOk);
            document.getElementById('lbl-counter-btn').textContent = gameState.counterBattery
                ? `A CAMINHO ${seg(gameState.counterBattery.ticks)}s` : gameState.recargaContra > 0 ? `RECARGA ${seg(gameState.recargaContra)}s` : gameState.barrage ? `${custo(50)} PTS` : 'SEM ALVO';

            // Relatório de patrulha: um envio por dia
            const intelSent = gameState.lastIntelDay === gameState.day;
            const intelBtn = document.getElementById('btn-intel');
            intelBtn.classList.toggle('opacity-40', intelSent);
            intelBtn.disabled = intelSent;
            document.getElementById('lbl-intel').textContent = intelSent ? 'Enviado hoje' : `Enviar Relatório (+${ganho(50)})`;

            syncOrderButtons();
            // General inimigo: postura e o que ele já percebeu do jogador
            if (gameState.general) {
                document.getElementById('lbl-general-posture').textContent = gameState.general.postura;
                const leituras = leiturasDoGeneral().map(t => `<li>${t}</li>`).join('');
                const lista = document.getElementById('lst-general-reads');
                if (lista.innerHTML !== leituras) lista.innerHTML = leituras;
            }
            const vivos = gameState.squad.filter(s => s.hp > 0).length;
            document.getElementById('lbl-squad-count').textContent = `RELAÇÃO DO ESQUADRÃO (${vivos} EFETIVOS)`;
            const eff = gameState.supplyLineEff;
            document.getElementById('lbl-supply-status').textContent = (eff > 70
                ? 'Estradas desimpedidas na retaguarda.'
                : eff > 30 ? 'Mau tempo na retaguarda: entregas reduzidas.'
                : 'Linha de suprimento cortada: o comboio não passa.') + ` Próximo comboio: dia ${proximoComboio()}.`;

            // Lista do esquadrão: só redesenha quando algo visível muda. Redesenhar a cada
            // segundo trocava os botões no meio do toque e o celular perdia o clique.
            const assinatura = ('C' + soldadoSelecionado) + JSON.stringify(gameState.squad.map(s => [Math.round(s.hp), Math.round(s.fatigue), Math.round(s.hunger), Math.round(s.thirst), Math.round(s.moral), s.duty, !!s.deserted, s.mental && s.mental.tipo, s.mental && s.mental.ciclos, soldadoMarcado(s), (s.medalhas || []).join()]));
            if (assinatura === lastSquadSignature) return;
            lastSquadSignature = assinatura;
            const squadContainer = document.getElementById('squad-list');
            squadContainer.innerHTML = '';

            renderFichasCorte();
            gameState.squad.forEach(soldier => {
                // No visual em corte só aparece a ficha do soldado selecionado na cena
                if (soldier.id !== soldadoSelecionado) return;
                const hp = Math.max(0, Math.round(soldier.hp));
                const card = document.createElement('div');
                card.className = `p-2 rounded border flex flex-col gap-1 ${hp <= 0 ? 'bg-mil-redDark/30 border-red-900 opacity-60' : 'bg-mil-bg border-mil-border'}`;

                card.innerHTML = `
                    <div class="flex justify-between items-center text-[13px]">
                        <div onclick="abrirPerfil(${soldier.id})" class="cursor-pointer flex items-center gap-2" title="Ver perfil">
                            <div class="w-8 h-9 shrink-0 rounded-sm overflow-hidden border border-mil-borderDark bg-black ${hp <= 0 ? 'grayscale' : ''}">${retrato(soldier.id)}</div>
                            <div>
                            <span class="font-bold ${hp <= 0 ? 'line-through text-red-500' : 'text-mil-textGlow'}">${soldier.rank} ${soldier.name}</span> <i class="fa-solid fa-id-card text-[10px] text-mil-textMuted"></i>${(soldier.medalhas || []).map(id => ' ' + imgMedalha(id, 16)).join('')}
                            <span class="text-xs text-mil-textMuted block uppercase">${soldier.class} · <span class="normal-case text-mil-amberMuted">${(PERFIS[soldier.id] && PERFIS[soldier.id].traco) ? PERFIS[soldier.id].traco.nome : ''}</span></span>
                            ${hp > 0 && mentalDe(soldier) ? `<span class="text-xs font-bold ${mentalDe(soldier) === 'heroismo' ? 'text-mil-greenMuted' : 'text-red-400'}">${ROTULO_MENTAL[mentalDe(soldier)]} ${seg(soldier.mental.ciclos * 10)}s</span>` : ''}
                            ${hp > 0 && soldadoMarcado(soldier) ? `<span class="text-xs font-bold text-red-400 animate-pulse block">🎯 ALVO DA ARTILHARIA${soldier.duty === 'REST' ? ' · no abrigo' : ' · ponha em Descanso'}</span>` : ''}
                            </div>
                        </div>
                        <span class="text-xs font-bold px-1.5 py-0.5 rounded ${hp > 50 ? 'bg-mil-oliveDark text-mil-greenMuted border border-mil-border' : 'bg-red-950 text-red-400 border border-red-900'}">
                            HP: ${hp}%
                        </span>
                    </div>

                    <div class="grid grid-cols-4 gap-1 text-xs text-mil-textMuted">
                        <div>Fadiga: <strong class="${soldier.fatigue > 70 ? 'text-red-400' : 'text-mil-textGlow'}">${Math.round(soldier.fatigue)}%</strong></div>
                        <div>Fome: <strong class="${soldier.hunger > 70 ? 'text-red-400' : 'text-mil-textGlow'}">${Math.round(soldier.hunger)}%</strong></div>
                        <div>Sede: <strong class="${soldier.thirst > 70 ? 'text-red-400' : 'text-mil-textGlow'}">${Math.round(soldier.thirst)}%</strong></div>
                        <div>Moral: <strong class="${soldier.moral < 40 ? 'text-red-400' : 'text-mil-greenMuted'}">${Math.round(soldier.moral)}%</strong></div>
                    </div>

                    ${hp > 0 ? `
                        <div class="grid grid-cols-4 gap-1 text-xs pt-1 border-t border-mil-borderDark">
                            <button onclick="setSoldierDuty(${soldier.id}, 'WATCH')" class="py-1 rounded text-center font-bold ${soldier.duty === 'WATCH' ? 'bg-mil-olive text-white border border-mil-greenMuted' : 'bg-black/50 text-mil-textMuted'}">
                                Vigília
                            </button>
                            <button onclick="setSoldierDuty(${soldier.id}, 'REST')" class="py-1 rounded text-center font-bold ${soldier.duty === 'REST' ? 'bg-mil-komonaBlue text-white border border-blue-400' : 'bg-black/50 text-mil-textMuted'}">
                                Descanso
                            </button>
                            <button onclick="setSoldierDuty(${soldier.id}, 'MAINTENANCE')" class="py-1 rounded text-center font-bold ${soldier.duty === 'MAINTENANCE' ? 'bg-mil-amberMuted text-black' : 'bg-black/50 text-mil-textMuted'}">
                                Manut.
                            </button>
                            <button onclick="setSoldierDuty(${soldier.id}, 'RATIONING')" class="py-1 rounded text-center font-bold ${soldier.duty === 'RATIONING' ? 'bg-mil-greenMuted text-black' : 'bg-black/50 text-mil-textMuted'}">
                                Cozinha
                            </button>
                        </div>
                    ` : `<div class="text-xs text-red-500 font-bold italic">${soldier.deserted ? 'DESERTOU' : 'INATIVO (MORTO EM AÇÃO)'}</div>`}
                `;
                squadContainer.appendChild(card);
            });
        }


        /* ===== Traços e colapso mental =====
           Cada soldado tem um traço (ver PERFIS). Com a moral abaixo de 20, a cada ciclo de 10 s
           há chance de uma crise: pânico (larga o posto e vai para o abrigo), apatia (atira e
           trabalha pela metade) ou, às vezes, fúria heroica (atira mais e acerta muito mais). */
        const MENTAL = {
            LIMIAR: 20, CHANCE: 0.15,
            PANICO: { chance: 0.5, ciclos: 6 }, APATIA: { chance: 0.3, ciclos: 9 }, HEROISMO: { ciclos: 6 },
            VETERANO_HEROISMO: 0.08,      // o Veterano não entra em pânico; às vezes vira herói
            APATIA_RITMO: 0.5, HEROISMO_PRECISAO: 1.5, HEROISMO_CADENCIA: 1.2, HEROISMO_MORAL: 25,
            PAPO: 0.3                     // moral por ciclo para quem está na mesma função do Bom de papo
        };
        const temTraco = (s, id) => !!(s && PERFIS[s.id] && PERFIS[s.id].traco && PERFIS[s.id].traco.id === id);
        const mentalDe = (s) => (s && s.mental && s.mental.ciclos > 0 ? s.mental.tipo : null);
        function perdaMoral(s, base) {
            const mult = temTraco(s, 'veterano') ? 0.5 : temTraco(s, 'novato') ? 2 : 1;
            s.moral = Math.max(0, s.moral - base * mult);
        }
        function processarMental() {
            gameState.squad.forEach(s => {
                if (s.hp <= 0) { s.mental = null; return; }
                if (s.mental) {
                    s.mental.ciclos--;
                    if (s.mental.tipo === 'panico') s.duty = 'REST';
                    if (s.mental.ciclos <= 0) {
                        if (s.mental.tipo === 'panico') s.duty = s.mental.dutyAntes || 'WATCH';
                        logFeed(`🧠 ${s.rank} ${s.name} se recompôs.`, 'text-mil-greenMuted');
                        s.mental = null;
                    }
                    return;
                }
                if (s.deserted || s.moral >= MENTAL.LIMIAR || Math.random() >= MENTAL.CHANCE) return;
                const r = Math.random();
                if (temTraco(s, 'veterano')) {
                    if (r < MENTAL.VETERANO_HEROISMO / MENTAL.CHANCE) entrarEmCrise(s, 'heroismo');
                    return;
                }
                entrarEmCrise(s, r < MENTAL.PANICO.chance ? 'panico' : r < MENTAL.PANICO.chance + MENTAL.APATIA.chance ? 'apatia' : 'heroismo');
            });
            // Bom de papo: anima quem divide a função com ele
            const papo = gameState.squad.find(s => s.hp > 0 && temTraco(s, 'papo') && mentalDe(s) !== 'panico');
            if (papo) gameState.squad.forEach(s => { if (s !== papo && s.hp > 0 && s.duty === papo.duty) s.moral = Math.min(100, s.moral + MENTAL.PAPO); });
        }
        function entrarEmCrise(s, tipo) {
            const ciclos = tipo === 'panico' ? MENTAL.PANICO.ciclos : tipo === 'apatia' ? MENTAL.APATIA.ciclos : MENTAL.HEROISMO.ciclos;
            s.mental = { tipo, ciclos, dutyAntes: s.duty };
            if (tipo === 'panico') {
                s.duty = 'REST';
                logFeed(`😱 ${s.rank} ${s.name} entrou em pânico e largou o posto!`, 'text-red-400 font-bold');
            } else if (tipo === 'apatia') {
                logFeed(`😶 ${s.rank} ${s.name} ficou apático: atira e trabalha pela metade.`, 'text-mil-amberMuted font-bold');
            } else {
                s.moral = Math.min(100, s.moral + MENTAL.HEROISMO_MORAL);
                concederMedalha(s, 'bravura');
                logFeed(`🔥 ${s.rank} ${s.name} entrou em fúria heroica: atira mais e acerta muito mais por alguns segundos!`, 'text-mil-greenMuted font-bold');
            }
            playTacticalBeep(tipo === 'heroismo' ? 1100 : 250, 0.2);
        }
        const ROTULO_MENTAL = { panico: '😱 PÂNICO', apatia: '😶 APÁTICO', heroismo: '🔥 HEROICO' };

        /* ===== Sensação de impacto: tremor, vibração, sons por arma, rastros e flashes ===== */
        const feridosRecentes = new Map(); // id do soldado -> quadros piscando em vermelho
        function marcarFerido(s) { feridosRecentes.set(s.id, 14); }
        let tremorAte = 0, tremorForca = 0;
        function tremer(forca, ms) {
            if (!CONFIG.tremor) return;
            tremorForca = Math.max(forca, performance.now() < tremorAte ? tremorForca : 0);
            tremorAte = Math.max(tremorAte, performance.now() + ms);
            const el = corteCanvas;
            if (!el || el.__tremendo) return;
            el.__tremendo = true;
            const passo = () => {
                const resta = tremorAte - performance.now();
                if (resta <= 0) { el.style.transform = ''; el.__tremendo = false; tremorForca = 0; return; }
                const f = Math.min(2.5, tremorForca) * Math.min(1, resta / 200);
                el.style.transform = `translate(${(Math.random() * 2 - 1) * f}px, ${(Math.random() * 2 - 1) * f}px)`;
                requestAnimationFrame(passo);
            };
            requestAnimationFrame(passo);
        }
        function vibrar(padrao) { try { if (CONFIG.vibracao && !document.hidden && navigator.vibrate) navigator.vibrate(padrao); } catch (e) {} }
        function impacto(tipo) {
            if (tipo === 'artilharia') { tremer(7, 450); vibrar(90); somExplosao(1); }
            else if (tipo === 'ofensiva') { tremer(4, 400); vibrar([120, 60, 120, 60, 120]); tocarSom('alarme', 0.9); }
            else if (tipo === 'deposito') { tremer(5, 350); vibrar([60, 40, 60]); somExplosao(0.8); }
            else if (tipo === 'morte') { tremer(4, 300); vibrar([200, 80, 200]); cenaEfeito('morte', {}); tocarSom('queda', 0.8); }
            else if (tipo === 'blindado') { tremer(8, 600); vibrar([150, 60, 150]); somExplosao(1.2); }
            else if (tipo === 'morteiro') { tremer(2, 200); somMorteiro(); }
            else if (tipo === 'anticarro') { tremer(4, 300); somAnticarro(); }
            else if (tipo === 'granada') { tremer(3, 250); somExplosao(0.5); }
        }
        function tom(tipo, f0, f1, dur, vol, atraso = 0) {
            if (isAudioMuted || !audioCtx) return;
            try {
                const t0 = audioCtx.currentTime + atraso;
                const o = audioCtx.createOscillator(); o.type = tipo;
                o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
                const g = audioCtx.createGain(); g.gain.setValueAtTime(vol + 0.0001, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
                o.connect(g); g.connect(saidaEfeitos()); o.start(t0); o.stop(t0 + dur);
            } catch (e) {}
        }
        function somExplosao(forca) { tocarSom('explosao', forca); }
        function somMetralhadora() { tocarSom('rajada', 0.8); }
        function somMorteiro() { tocarSom('assobio', 0.7); tocarSom('explosao', 0.6, 0.45); }
        function somAnticarro() { tocarSom('foguete', 0.8); tocarSom('explosao', 0.9, 0.3); }
        /* ===== Sons com ZzFX (licença MIT): gerados uma vez e tocados pelo áudio do jogo ===== */
        // Parâmetros: volume, aleatório, frequência, ataque, sustentação, liberação, forma, curva, deslize,
        //             delta, salto, tempo do salto, repetição, ruído, modulação, bitcrush, atraso, volume sust., decaimento, tremolo
        const SONS = {
            tiro:        [.7, .05, 180, 0, .01, .12, 4, 2.5, -5, 0, 0, 0, 0, 1.5, 0, .4, 0, .5, .05],
            rajada:      [.9, .05, 120, 0, .25, .08, 4, 2, -3, 0, 0, 0, .08, 1, 0, .3, 0, .7, .02, .6],
            explosao:    [1.4, .1, 60, .01, .15, 1.1, 4, 1.6, 0, 0, 0, 0, 0, 1, 0, .6, 0, .45, .15],
            assobio:     [.35, 0, 1400, .05, .35, .1, 0, 1, -25],
            foguete:     [.6, .1, 500, .05, .25, .2, 4, 1, -8, 0, 0, 0, 0, 2.5, 0, 0, 0, .6],
            alarme:      [.4, 0, 600, .02, .25, .1, 1, 1, 0, 0, 200, .12],
            queda:       [.9, 0, 80, 0, .1, .5, 0, 1, -2, 0, 0, 0, 0, 0, 0, 0, 0, .3]
        };
        const cacheSons = {};
        function tocarSom(nome, volume = 1, atraso = 0) {
            if (isAudioMuted || !audioCtx || typeof zzfxGerar !== 'function' || !SONS[nome]) return;
            try {
                let lista = cacheSons[nome];
                if (!lista) lista = cacheSons[nome] = [];
                if (lista.length < 3) { // até 3 variações de cada som (o ZzFX sorteia um pouco a cada geração)
                    const amostras = zzfxGerar(...SONS[nome]);
                    const buf = audioCtx.createBuffer(1, amostras.length, 44100);
                    buf.getChannelData(0).set(amostras);
                    lista.push(buf);
                }
                const src = audioCtx.createBufferSource();
                src.buffer = lista[Math.floor(Math.random() * lista.length)];
                const g = audioCtx.createGain(); g.gain.value = volume;
                src.connect(g); g.connect(saidaEfeitos());
                src.start(audioCtx.currentTime + atraso);
            } catch (e) {}
        }

        // Ícones do game-icons nos elementos marcados com data-icone
        function preencherIcones() {
            if (typeof icone !== 'function') return;
            document.querySelectorAll('[data-icone]').forEach(el => { if (!el.innerHTML) el.innerHTML = icone(el.dataset.icone); });
        }

        /* ===== Medalhas (Kenney, CC0) ===== */
        const MEDALHAS = {
            combate:    { nome: 'Cruz de Combate',              img: 'shaded_medal6.png', desc: '15 inimigos abatidos' },
            ferido:     { nome: 'Medalha de Ferido em Combate', img: 'shaded_medal3.png', desc: 'sobreviveu depois de ficar com menos de 25% de vida' },
            trincheira: { nome: 'Medalha da Trincheira',        img: 'shaded_medal4.png', desc: 'chegou vivo ao dia 15' },
            bravura:    { nome: 'Estrela de Bravura',           img: 'shaded_medal8.png', desc: 'entrou em fúria heroica' }
        };
        function medalhaDaVitoria(nivel) {
            return nivel >= 25 ? 'shaded_medal1.png' : nivel >= 17 ? 'shaded_medal8.png' : nivel >= 9 ? 'shaded_medal7.png' : 'shaded_medal2.png';
        }
        function concederMedalha(s, id) {
            if (!s || s.hp <= 0 || !MEDALHAS[id]) return;
            s.medalhas = s.medalhas || [];
            if (s.medalhas.includes(id)) return;
            s.medalhas.push(id);
            const m = MEDALHAS[id];
            logFeed(`🎖️ ${s.rank} ${s.name} recebeu a ${m.nome} (${m.desc}).`, 'text-mil-amberMuted font-bold');
            addDiaryEntry(`${s.rank} ${s.name} foi condecorado com a ${m.nome}: ${m.desc}.`);
            playTacticalBeep(1200, 0.15);
        }
        function verificarMedalhas() {
            gameState.squad.forEach(s => {
                if (s.hp <= 0) return;
                if (s.stats && s.stats.abates >= 15) concederMedalha(s, 'combate');
                if (s.quaseMorreu) concederMedalha(s, 'ferido');
                if (gameState.day >= 15) concederMedalha(s, 'trincheira');
            });
        }
        const imgMedalha = (id, altura = 28) => `<img src="${musicBase}assets/medals/${MEDALHAS[id].img}" alt="${MEDALHAS[id].nome}" title="${MEDALHAS[id].nome}: ${MEDALHAS[id].desc}" style="height:${altura}px;display:inline-block;image-rendering:pixelated">`;

        function abrirCreditos() { document.getElementById('modal-creditos').classList.remove('hidden'); perfilAberto = true; }
        function fecharCreditos() { document.getElementById('modal-creditos').classList.add('hidden'); perfilAberto = false; }


        /* ===== Configurações: conta, som, jogo e dados =====
           As preferências ficam no aparelho e, com conta, também na conta (vão junto para outro aparelho). */
        const CONFIG_KEY = 'frontline-config';
        const CARREIRA_KEY = 'frontline-carreira';
        const CONFIG_PADRAO = { volMusica: 45, volEfeitos: 80, volAmbiente: 50, tremor: true, vibracao: true, rastros: true, particulas: true, pixel: false, textoGrande: false, apelido: '', escalaAuto: true, pausaArtilharia: false, dificuldade: 'soldado', numeros: true };
        // Quem pediu "reduzir movimento" no aparelho começa sem tremor da tela e sem vibração (dá para ligar nas Configurações)
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { CONFIG_PADRAO.tremor = false; CONFIG_PADRAO.vibracao = false; }
        let CONFIG = Object.assign({}, CONFIG_PADRAO, (() => { try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; } catch (e) { return {}; } })());
        let configAberto = false, abaConfigAtual = 'conta';
        const volumeEfeitos = () => Math.max(0, Math.min(1.5, (CONFIG.volEfeitos ?? 80) / 80));
        const volumeAmbiente = () => Math.max(0, Math.min(2, (CONFIG.volAmbiente ?? 50) / 50));

        function aplicarConfig() {
            aplicarVolumes();
            document.documentElement.style.fontSize = CONFIG.textoGrande ? '112%' : '';
            atualizarConta();
            if (typeof aplicarVisual === 'function') aplicarVisual();
        }
        let envioConfigTimer = null;
        function salvarConfig() {
            try { localStorage.setItem(CONFIG_KEY, JSON.stringify(CONFIG)); } catch (e) {}
            aplicarConfig();
            // Com conta: guarda também na conta (com um pequeno atraso para não mandar a cada movimento do controle)
            if (sb && usuario) {
                clearTimeout(envioConfigTimer);
                envioConfigTimer = setTimeout(() => { sb.auth.updateUser({ data: { config: CONFIG, carreira: lerCarreira() } }).catch(() => {}); }, 1200);
            }
        }
        // Troféus do Duelo online (3 por duelo vencido), lidos da conta
        let trofeusDuelo = null, trofeusLidoEm = 0;
        async function buscarTrofeus() {
            if (!sb || !usuario || Date.now() - trofeusLidoEm < 30000) return;
            trofeusLidoEm = Date.now();
            try {
                const { data, error } = await sb.rpc('meus_trofeus');
                if (error || !data || !data[0]) return;
                if (trofeusDuelo !== data[0].trofeus) { trofeusDuelo = data[0].trofeus; if (configAberto) renderConfig(); }
            } catch (e) {}
        }
        function lerCarreira() {
            try { return Object.assign({ partidas: 0, vitorias: 0, derrotas: 0, abates: 0, melhorDia: 0 }, JSON.parse(localStorage.getItem(CARREIRA_KEY)) || {}); }
            catch (e) { return { partidas: 0, vitorias: 0, derrotas: 0, abates: 0, melhorDia: 0 }; }
        }
        function somarCarreira(d, enviar) {
            const c = lerCarreira();
            ['partidas', 'vitorias', 'derrotas', 'abates'].forEach(k => { if (d[k]) c[k] += d[k]; });
            if (d.melhorDia) c.melhorDia = Math.max(c.melhorDia, d.melhorDia);
            try { localStorage.setItem(CARREIRA_KEY, JSON.stringify(c)); } catch (e) {}
            if (enviar && sb && usuario) sb.auth.updateUser({ data: { config: CONFIG, carreira: c } }).catch(() => {});
        }
        // Ao entrar na conta: traz o nome de comandante, as preferências e a carreira guardados nela
        function carregarDaConta() {
            const meta = (usuario && usuario.user_metadata) || {};
            if (meta.config) CONFIG = Object.assign({}, CONFIG_PADRAO, CONFIG, meta.config);
            if (meta.carreira) {
                const loc = lerCarreira(), nu = meta.carreira;
                const junta = {};
                Object.keys(loc).forEach(k => { junta[k] = Math.max(loc[k] || 0, nu[k] || 0); });
                try { localStorage.setItem(CARREIRA_KEY, JSON.stringify(junta)); } catch (e) {}
            }
            try { localStorage.setItem(CONFIG_KEY, JSON.stringify(CONFIG)); } catch (e) {}
            aplicarConfig();
        }

        function abrirConfig(aba) {
            configAberto = true;
            if (aba) abaConfigAtual = aba;
            document.getElementById('modal-config').classList.remove('hidden');
            renderConfig();
        }
        function fecharConfig() {
            configAberto = false;
            document.getElementById('modal-config').classList.add('hidden');
        }
        function abaConfig(aba) { abaConfigAtual = aba; renderConfig(); playTacticalBeep(800, 0.02); }
        function alternarConfig(chave) { CONFIG[chave] = !CONFIG[chave]; salvarConfig(); renderConfig(); playTacticalBeep(750, 0.02); }
        function mudarVolume(chave, valor) {
            CONFIG[chave] = Number(valor);
            salvarConfig();
            const rot = document.getElementById('val-' + chave);
            if (rot) rot.textContent = valor + '%';
        }
        function testarSom(qual) {
            if (isAudioMuted) { toggleAudio(); renderConfig(); }
            if (qual === 'volMusica') { syncMusic(); }
            else if (qual === 'volEfeitos') { tocarSom('tiro', 0.8); tocarSom('explosao', 0.8, 0.25); }
            else if (qual === 'volAmbiente') { startAmbient(); aplicarConfig(); }
        }
        async function salvarApelido() {
            const v = document.getElementById('cfg-apelido').value.trim().slice(0, 24);
            CONFIG.apelido = v;
            salvarConfig();
            const msg = document.getElementById('cfg-conta-msg');
            msg.textContent = usuario ? 'Nome salvo na sua conta.' : 'Nome salvo neste aparelho.';
            if (sb && usuario) { try { await sb.auth.updateUser({ data: { config: CONFIG } }); } catch (e) { msg.textContent = 'Salvo no aparelho; a conta atualiza quando houver internet.'; } }
            renderConfig();
        }
        async function trocarSenha() {
            const a = document.getElementById('cfg-senha1').value, b = document.getElementById('cfg-senha2').value;
            const msg = document.getElementById('cfg-conta-msg');
            if (a.length < 6) { msg.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
            if (a !== b) { msg.textContent = 'As duas senhas não são iguais.'; return; }
            try {
                const r = await sb.auth.updateUser({ password: a });
                msg.textContent = r.error ? traduzirErro(r.error.message) : 'Senha trocada.';
            } catch (e) { msg.textContent = 'Sem conexão: tente de novo com internet.'; }
        }
        async function apagarProgresso() {
            const texto = usuario
                ? 'Apagar a partida em andamento e voltar ao nível 1, neste aparelho e na sua conta? Isso não pode ser desfeito.'
                : 'Apagar a partida em andamento e voltar ao nível 1 neste aparelho? Isso não pode ser desfeito.';
            if (!await confirmarJogo({ icone: '🗑️', titulo: 'Apagar progresso', texto, ok: 'Apagar', perigo: true })) return;
            skipPageHideSave = true;
            [SAVE_KEY, LEVEL_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
            try { localStorage.setItem(NOVA_KEY, String(Date.now())); } catch (e) {}
            // Com conta: apaga também a cópia da nuvem (partida vazia e nível 1); senão ela voltava ao entrar
            try { await Promise.race([enviarNuvem(true), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
            location.reload();
        }
        function restaurarPadroes() {
            const apelido = CONFIG.apelido;
            CONFIG = Object.assign({}, CONFIG_PADRAO, { apelido });
            salvarConfig(); renderConfig();
        }

        function renderConfig() {
            document.querySelectorAll('#cfg-abas button').forEach(b => {
                const on = b.dataset.aba === abaConfigAtual;
                b.className = 'py-2 ' + (on ? 'text-mil-textGlow bg-mil-panel border-b-2 border-mil-greenMuted' : 'text-mil-textMuted');
            });
            ['conta', 'som', 'jogo', 'dados'].forEach(a => document.getElementById('cfg-' + a).classList.toggle('hidden', a !== abaConfigAtual));

            // Conta
            const nome = CONFIG.apelido || (usuario ? (usuario.email || '').split('@')[0] : 'Comandante');
            document.getElementById('cfg-avatar').textContent = (nome[0] || '?').toUpperCase();
            document.getElementById('cfg-nome').textContent = nome;
            document.getElementById('cfg-email').textContent = usuario ? usuario.email : 'Sem conta: progresso salvo só neste aparelho';
            const desde = usuario && usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('pt-BR') : null;
            document.getElementById('cfg-tipo').textContent = usuario ? `Conta FrontLine · nível ${gameState.level}${desde ? ' · desde ' + desde : ''}` : `Convidado · nível ${gameState.level}`;
            const ap = document.getElementById('cfg-apelido');
            if (document.activeElement !== ap) ap.value = CONFIG.apelido || '';
            const c = lerCarreira();
            const caixa = (rot, v) => `<div class="bg-mil-bg border border-mil-border rounded p-2 text-center"><div class="text-mil-textMuted">${rot}</div><div class="text-mil-textGlow font-bold text-sm">${v}</div></div>`;
            document.getElementById('cfg-carreira').innerHTML = caixa('Partidas', c.partidas) + caixa('Vitórias', c.vitorias) + caixa('Derrotas', c.derrotas) + caixa('Abates', c.abates) + caixa('Melhor dia', c.melhorDia) + caixa('Nível', gameState.level) +
                (usuario ? caixa('🏆 Troféus', trofeusDuelo === null ? '…' : trofeusDuelo) + caixa('Duelos', trofeusDuelo === null ? '…' : `<a href="duelo.html" class="underline">jogar</a>`) : '');
            buscarTrofeus();
            document.getElementById('cfg-conta-acoes').innerHTML = usuario ? `
                <div class="bg-mil-bg border border-mil-border rounded p-2 space-y-1">
                    <div class="text-mil-textGlow font-bold">Trocar senha</div>
                    <input id="cfg-senha1" type="password" placeholder="Nova senha" class="w-full bg-black/60 border border-mil-border rounded px-2 py-1.5 text-mil-textGlow">
                    <input id="cfg-senha2" type="password" placeholder="Repita a nova senha" class="w-full bg-black/60 border border-mil-border rounded px-2 py-1.5 text-mil-textGlow">
                    <button onclick="trocarSenha()" class="w-full py-1.5 btn-tactical rounded font-bold">Trocar senha</button>
                </div>
                <button onclick="sairDaConta()" class="w-full py-2 btn-tactical rounded font-bold text-red-400"><i class="fa-solid fa-right-from-bracket"></i> Sair da conta</button>`
                : `<button onclick="fecharConfig(); abrirLogin();" class="w-full py-2 btn-tactical rounded font-bold"><i class="fa-solid fa-user"></i> Entrar ou criar conta</button>
                   <p class="text-mil-textMuted">Com conta, o progresso, o nome e as configurações vão junto para qualquer aparelho.</p>`;

            // Som
            document.getElementById('cfg-som-geral').textContent = isAudioMuted ? '🔇 Desligado · ligar' : '🔊 Ligado · desligar';
            const vol = (chave, rot, desc) => `
                <div>
                    <div class="flex justify-between items-center"><span class="text-mil-textGlow font-bold">${rot}</span><span id="val-${chave}" class="text-mil-amberMuted font-bold">${CONFIG[chave]}%</span></div>
                    <div class="text-mil-textMuted mb-1">${desc}</div>
                    <div class="flex items-center gap-2">
                        <input type="range" min="0" max="100" step="5" value="${CONFIG[chave]}" oninput="mudarVolume('${chave}', this.value)" class="flex-1 accent-[#5a7356]">
                        <button onclick="testarSom('${chave}')" class="px-2 py-1 btn-tactical rounded font-bold">Testar</button>
                    </div>
                </div>`;
            document.getElementById('cfg-volumes').innerHTML =
                vol('volMusica', 'Música', 'Trilha de guerra e trilha de combate') +
                vol('volEfeitos', 'Efeitos', 'Tiros, rajadas, explosões, alarmes e rádio') +
                vol('volAmbiente', 'Som ambiente', 'Vento e ruído de fundo do campo de batalha');

            // Jogo
            const chave = (k, rot, desc) => `
                <div class="flex justify-between items-center gap-2 bg-mil-bg border border-mil-border rounded p-2">
                    <div><div class="text-mil-textGlow font-bold">${rot}</div><div class="text-mil-textMuted">${desc}</div></div>
                    <button onclick="alternarConfig('${k}')" class="px-3 py-1.5 btn-tactical rounded font-bold whitespace-nowrap ${CONFIG[k] ? 'btn-active-order' : ''}">${CONFIG[k] ? 'Ligado' : 'Desligado'}</button>
                </div>`;
            const opDif = (v) => `<button onclick="CONFIG.dificuldade='${v}'; salvarConfig(); renderConfig();" class="flex-1 py-1.5 btn-tactical rounded font-bold ${CONFIG.dificuldade === v ? 'btn-active-order' : ''}">${MODOS_DIFICULDADE[v].nome}</button>`;
            const mods = modificadoresAtivos(), prox = proximoModificador();
            const blocoMods = `<div class="bg-mil-bg border border-mil-border rounded p-2 space-y-1">
                    <div class="text-mil-textGlow font-bold">Regras do nível ${gameState.level}</div>
                    ${mods.length ? mods.map(m => `<div><span class="text-mil-amberMuted font-bold">${m.nome}</span> <span class="text-mil-textMuted">· ${m.desc}</span></div>`).join('') : '<div class="text-mil-textMuted">Nenhuma regra extra ainda.</div>'}
                    ${prox ? `<div class="text-mil-textMuted">No nível ${prox.nivel}: ${prox.nome}.</div>` : ''}
                </div>`;
            document.getElementById('cfg-jogo').innerHTML = blocoMods +
                `<div class="bg-mil-bg border border-mil-border rounded p-2 space-y-1">
                    <div class="text-mil-textGlow font-bold">Dificuldade</div>
                    <div class="text-mil-textMuted">${(MODOS_DIFICULDADE[CONFIG.dificuldade] || MODOS_DIFICULDADE.soldado).desc}. Vale já para a partida em andamento; o nível (1 a 25) continua subindo a cada vitória.</div>
                    <div class="flex gap-2 pt-1">${opDif('recruta')}${opDif('soldado')}${opDif('veterano')}</div>
                </div>
` +
                chave('escalaAuto', 'Escala automática', 'Soldados com fome ou sede vão comer e os exaustos vão descansar sozinhos, e depois voltam ao posto que você escolheu. Em combate só saem em estado crítico') +
                chave('numeros', 'Números flutuantes', 'Mostra na cena o dano que os soldados levam e o prestígio ganho ao abater inimigos') +
                chave('pausaArtilharia', 'Pausar no aviso de artilharia', 'O jogo pausa sozinho quando a artilharia é anunciada, para decidir quem vai para o abrigo e pedir a contra-bateria') +
                chave('tremor', 'Tremor da tela', 'O mapa treme com explosões e impactos') +
                chave('vibracao', 'Vibração do celular', 'Vibra nos impactos fortes (só em aparelhos compatíveis)') +
                chave('rastros', 'Rastros dos tiros', 'Linhas dos tiros do esquadrão no mapa') +
                chave('pixel', 'Visual pixel art (teste)', 'Troca o Trincheiras para um visual em pixel art: campo visto de lado e soldados em sprites. Pode voltar ao clássico quando quiser') +
                chave('particulas', 'Partículas e fumaça', 'Terra, brasas, faíscas, clarões e fumaça nas explosões e nos tiros (desligue se o celular engasgar)') +
                chave('textoGrande', 'Texto maior', 'Aumenta as letras para ler melhor') +
                `<button onclick="fecharConfig(); abrirTutorial();" class="w-full py-2 btn-tactical rounded font-bold"><i class="fa-solid fa-book-open"></i> Rever o tutorial</button>
                 <button onclick="restaurarPadroes()" class="w-full py-2 btn-tactical rounded font-bold">Restaurar configurações padrão</button>`;

            // Dados
            document.getElementById('cfg-dados').innerHTML = `
                <div class="bg-mil-bg border border-mil-border rounded p-2"><div class="text-mil-textMuted">Versão do jogo</div><div class="text-mil-textGlow font-bold">${VERSAO_JOGO}</div></div>
                <div class="bg-mil-bg border border-mil-border rounded p-2"><div class="text-mil-textMuted">Salvamento</div><div class="text-mil-textGlow font-bold">${usuario ? 'Neste aparelho e na nuvem (conta)' : 'Só neste aparelho'}</div></div>
                <button onclick="fecharConfig(); abrirCreditos();" class="w-full py-2 btn-tactical rounded font-bold">Créditos</button>
                <button onclick="apagarProgresso()" class="w-full py-2 btn-tactical rounded font-bold text-red-400"><i class="fa-solid fa-trash"></i> ${usuario ? 'Apagar progresso (aparelho e conta)' : 'Apagar progresso deste aparelho'}</button>`;
        }


