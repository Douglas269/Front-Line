// FrontLine · Áudio, estado do jogo e configuração geral
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           AUDIO SYNTHESIZER (WEB AUDIO API)
           ========================================================================== */
        let audioCtx = null;
        let isAudioMuted = true;

        /* Mixagem: cada controle de volume é um canal próprio (efeitos, ambiente, música).
           Todo som passa pelo seu canal; mexer num controle muda só aquele canal,
           na hora, inclusive nos sons que já estão tocando. */
        const canais = { efeitos: null, ambiente: null, musica: null };
        let musicaNoMixer = false;
        function initAudio() {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                ['efeitos', 'ambiente', 'musica'].forEach(k => { canais[k] = audioCtx.createGain(); canais[k].connect(audioCtx.destination); });
                // A música (arquivos mp3) entra no mixer também: assim o controle funciona igual em todo aparelho (no iPhone o volume do <audio> é ignorado)
                try {
                    [bgmWar, bgmBattle].forEach(el => { audioCtx.createMediaElementSource(el).connect(canais.musica); el.volume = 1; });
                    musicaNoMixer = true;
                } catch (e) { musicaNoMixer = false; }
                aplicarVolumes();
            }
        }
        const saidaEfeitos = () => canais.efeitos || audioCtx.destination;
        function aplicarVolumes() {
            const vm = Math.max(0, Math.min(1, (CONFIG.volMusica ?? 45) / 100));
            if (musicaNoMixer && canais.musica) { canais.musica.gain.value = vm; bgmWar.volume = 1; bgmBattle.volume = 1; }
            else { bgmWar.volume = vm; bgmBattle.volume = vm; }
            if (canais.efeitos) canais.efeitos.gain.value = volumeEfeitos();
            if (canais.ambiente) canais.ambiente.gain.value = volumeAmbiente();
        }

        /* Música: trilha de guerra no turno; trilha de combate quando há inimigos.
           Ambiente: vento gerado no navegador, bem mais baixo que a música. */
        const bgmWar = document.getElementById('bgm-war');
        const bgmBattle = document.getElementById('bgm-battle');
        // Caminho das trilhas: a raiz do site (Vercel) mostra este arquivo sem mudar o endereço
        const musicBase = location.pathname.endsWith('.html') ? '' : 'prototipo/';
        bgmWar.src = musicBase + 'assets/music/war_theme.mp3';
        bgmBattle.src = musicBase + 'assets/music/to_battle.mp3';
        bgmWar.volume = 0.45;
        bgmBattle.volume = 0.45; // ajustado pelas Configurações (aplicarConfig)
        let ambientNodes = null;

        function startAmbient() {
            if (!audioCtx || ambientNodes) return;
            // Ruído marrom (vento) filtrado, com rajadas lentas
            const len = audioCtx.sampleRate * 2;
            const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
            const d = buf.getChannelData(0);
            let last = 0;
            for (let i = 0; i < len; i++) {
                last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
                d[i] = last * 3;
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const lp = audioCtx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 500;
            const gain = audioCtx.createGain();
            gain.gain.value = 0.10; // o volume escolhido fica no canal do ambiente (0% = silêncio de verdade)
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 0.07;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 0.04;
            lfo.connect(lfoGain);
            lfoGain.connect(gain.gain);
            src.connect(lp);
            lp.connect(gain);
            gain.connect(canais.ambiente || audioCtx.destination);
            src.start();
            lfo.start();
            ambientNodes = { src, lfo, gain };
        }

        function stopAmbient() {
            if (!ambientNodes) return;
            try { ambientNodes.src.stop(); ambientNodes.lfo.stop(); } catch (e) {}
            ambientNodes = null;
        }

        function syncMusic() {
            if (isAudioMuted) return;
            const want = gameState.enemies.length > 0 ? bgmBattle : bgmWar;
            const other = want === bgmBattle ? bgmWar : bgmBattle;
            if (!other.paused) other.pause();
            if (want.paused) want.play().catch(() => {});
        }

        // Celular: ao sair do app o som para; ao voltar (ou no primeiro toque), retoma.
        // iPhone e alguns Androids suspendem o áudio do navegador em segundo plano e só o
        // liberam de novo com um toque; sem isso o jogo ficava mudo depois de voltar.
        function pausarSomAoSair() {
            if (!audioCtx) return;
            bgmWar.pause(); bgmBattle.pause();
            if (audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
        }
        function retomarSom() {
            if (isAudioMuted || !audioCtx || document.hidden) return;
            if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
            syncMusic();
        }
        document.addEventListener('visibilitychange', () => { if (document.hidden) pausarSomAoSair(); else retomarSom(); });
        document.addEventListener('pointerdown', () => { if (audioCtx && !isAudioMuted && audioCtx.state !== 'running') retomarSom(); }, { capture: true, passive: true });

        function stopAllAudio() {
            bgmWar.pause();
            bgmBattle.pause();
            stopAmbient();
        }

        function toggleAudio() {
            initAudio();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            isAudioMuted = !isAudioMuted;
            const ico = document.getElementById('ico-audio');
            if (isAudioMuted) {
                ico.className = 'fa-solid fa-volume-xmark text-red-400';
                stopAllAudio();
            } else {
                ico.className = 'fa-solid fa-volume-high text-mil-greenMuted';
                startAmbient();
                syncMusic();
                playTacticalBeep(800, 0.05);
            }
        }

        function playTacticalBeep(freq = 600, duration = 0.04) {
            if (isAudioMuted || !audioCtx) return;
            try {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
                osc.connect(gain);
                gain.connect(saidaEfeitos());
                osc.start();
                osc.stop(audioCtx.currentTime + duration);
            } catch (e) {}
        }

        function playGunshotSound() {
            if (isAudioMuted || !audioCtx) return;
            if (typeof zzfxGerar === 'function' && typeof tocarSom === 'function') { tocarSom('tiro', 0.6); return; }
            try {
                const bufferSize = audioCtx.sampleRate * 0.1;
                const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
                const output = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                const whiteNoise = audioCtx.createBufferSource();
                whiteNoise.buffer = buffer;
                const filter = audioCtx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
                filter.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.1);

                const gain = audioCtx.createGain();
                gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

                whiteNoise.connect(filter);
                filter.connect(gain);
                gain.connect(saidaEfeitos());
                whiteNoise.start();
            } catch (e) {}
        }

        /* ==========================================================================
           GAME STATE CONFIGURATION
           ========================================================================== */
        const GAME_CONFIG = {
            TOTAL_DAYS: 30,
            DAY_DURATION_SEC: 240, // segundos de jogo por dia (40 s reais)
            TICKS_PER_SECOND: 6,       // 6 segundos de jogo por segundo real: o dia (240) dura 40 s (mais tempo para pensar)
            UPDATE_INTERVAL_MS: 167,
            // Fome e sede só caem para quem está na Cozinha. A cada 10 s na cozinha,
            // o soldado come e bebe até estes limites, gastando estoque proporcional:
            // ~36 de fome por dia ÷ 10 = 3,6 ciclos × 0,33 ≈ 1,2 ração por soldado/dia (≈ 7,2 no esquadrão)
            KITCHEN_HUNGER_RELIEF: 10,
            KITCHEN_THIRST_RELIEF: 12,
            KITCHEN_RATION: 0.33,     // ração gasta por ciclo de 10 s comendo
            KITCHEN_WATER: 0.3,       // água gasta por ciclo de 10 s bebendo
            // Dano sofrido por cada soldado quando um inimigo invade a trincheira
            INVASION_DAMAGE: 20
        };

        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
        // Converte segundos de jogo em segundos reais (para os textos e contagens)
        const seg = (ticks) => Math.max(0, Math.ceil(ticks / GAME_CONFIG.TICKS_PER_SECOND));
        // Carga emergencial: 150 s reais no nível 1, +10 s por nível (nível 25: 390 s)
        const esperaCarga = () => (150 + 10 * (Math.max(1, gameState.level || 1) - 1)) * 8; // em segundos de jogo: 5 dias no nível 1, +1/3 de dia por nível
        // Relógio: um só mecanismo. jogoPausado = pausa do jogador; gameEnded = partida acabou (para de vez).
        let jogoPausado = false;
        let atualizacaoPendente = false; // versão nova no site: o jogo trava até atualizar
        let gameEnded = false;

        let gameState = {
            day: 1,
            timeSeconds: 0,
            prestige: 150,
            weather: 'Nublado',
            tacticalOrders: {
                SUPPRESSION: false,
                SHELTER: false,
                CONSERVE: false,
                FULL_VIGILANCE: false,
                SIGNAL_JAM: false
            },
            supplyLineEff: 85,
            resources: {
                rations: 36,
                water: 48,
                ammoRifle: 900,
                ammoHeavy: 350,
                medkits: 3
            },
            squad: [
                { id: 1, rank: 'Sgt.', name: 'Silva', class: 'Fuzileiro Regular', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, duty: 'WATCH' },
                { id: 2, rank: 'Cbo.', name: 'Santos', class: 'Metralhador', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 80, duty: 'WATCH' },
                { id: 3, rank: 'Sd.', name: 'Ferreira', class: 'Fuzileiro Regular', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 75, duty: 'REST' },
                { id: 4, rank: 'Sd.', name: 'Costa', class: 'Médico', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 90, duty: 'MAINTENANCE' },
                { id: 5, rank: 'Sd.', name: 'Oliveira', class: 'Engenheiro', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 85, duty: 'RATIONING' },
                { id: 6, rank: 'Sd.', name: 'Mendes', class: 'Atirador de Elite', hp: 100, fatigue: 0, hunger: 0, thirst: 0, moral: 88, duty: 'WATCH' }
            ],
            enemies: [],
            barrage: null, // artilharia inimiga prevista: { ticks } ou null
            cargas: {}, // carga emergencial a caminho, por item: { rations: ticks, water: ticks, ... }
            combate: { tiros: 0, acertos: 0, abates: 0 }, // tiros do dia
            arsenal: null, // pontos defensivos, armas pesadas e inventário (criado no início do jogo, em 06-conta.js)
            level: 1, // nível de dificuldade (sobe a cada vitória)
            trench: 100, // conservação da trincheira em % (cai com artilharia e invasões)
            lastIntelDay: 0, // dia em que o último relatório foi enviado
            activeCrisis: null, // crise aberta: { id, ctx } ou null (o relógio para)
            crisisCooldown: 240, // segundos até a próxima crise poder aparecer
            convoyAmbush: false, // próximo comboio vai pela estrada vigiada
            weakenNextWave: false, // interceptação revelou a próxima onda
            counterBattery: null, // contra-bateria a caminho: { ticks } ou null
            recargaContra: 0, // segundos de jogo até a Central poder fazer outra contra-bateria
            ofensiva: null, // ofensiva anunciada pelo general: { dia, hora, anunciada, ativa }
            nextWaveBoost: 0, // soldados extras na próxima onda (patrulha marcou a posição)
            general: null // general inimigo (criado por newGeneral)
        };

        // Desenha a trincheira em corte a cada quadro
        function renderMap() {
            try { renderCorte(); } catch (e) { console.error(e); }
            requestAnimationFrame(renderMap);
        }

        /* ==========================================================================
           SIMULATION TICK & COMBAT ENGINE
           ========================================================================== */
        // 8 segundos de jogo por segundo real; updateGameTick decide se o relógio anda (pausa, fim, crise...)

        function updateGameTick() {
            // Pausado, com crise, tutorial, login ou a tela de modos aberta: o relógio para
            if (gameEnded || jogoPausado || atualizacaoPendente || gameState.activeCrisis || tutorialAberto || loginAberto || perfilAberto || configAberto || menuAberto) return;
            gameState.timeSeconds++;

            normalizeOrders();
            processSquadNeeds();
            randomEventCheck();
            processPendingSupply();
            processEnemiesAndCombat();
            syncMusic();
            randomCrisisCheck();
            checkWinLoss();
            // Fim da madrugada: o dia vira sozinho
            if (gameState.timeSeconds >= GAME_CONFIG.DAY_DURATION_SEC) endTurn();
            updateClockAndUI();
            updateUI();
            if (!gameEnded && gameState.timeSeconds % 40 === 0) saveGame(); // a cada ~5 s reais
        }

