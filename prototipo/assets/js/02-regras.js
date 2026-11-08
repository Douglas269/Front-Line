// FrontLine · Salvamento, necessidades, inimigos, general e combate
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           SALVAMENTO NO NAVEGADOR (progresso fica no próprio aparelho)
           ========================================================================== */
        const SAVE_KEY = 'frontline-ponto-alpha-v1';
        const NOVA_KEY = 'frontline-nova-partida'; // quando o jogador começou a última partida nova (a nuvem mais velha que isso é ignorada)
        let skipPageHideSave = false; // depois de "Nova partida"/apagar progresso, nada regrava a partida antiga

        function saveGame() {
            if (skipPageHideSave) return;
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify({
                    v: 1,
                    savedAt: Date.now(),
                    day: gameState.day,
                    timeSeconds: gameState.timeSeconds,
                    prestige: gameState.prestige,
                    weather: gameState.weather,
                    tacticalOrders: gameState.tacticalOrders,
                    supplyLineEff: gameState.supplyLineEff,
                    resources: gameState.resources,
                    squad: gameState.squad,
                    enemies: gameState.enemies,
                    lastIntelDay: gameState.lastIntelDay,
                    cargas: gameState.cargas,
                    combate: gameState.combate,
                    arsenal: gameState.arsenal,
                    trench: gameState.trench,
                    barrage: gameState.barrage,
                    activeCrisis: gameState.activeCrisis,
                    crisisCooldown: gameState.crisisCooldown,
                    convoyAmbush: gameState.convoyAmbush,
                    weakenNextWave: gameState.weakenNextWave,
                    counterBattery: gameState.counterBattery,
                    nextWaveBoost: gameState.nextWaveBoost,
                    general: gameState.general,
                    feed: document.getElementById('feed-log').innerHTML,
                    diary: document.getElementById('diary-entries').innerHTML
                }));
            } catch (e) { /* armazenamento indisponível: o jogo continua sem salvar */ }
            enviarNuvem(false);
        }

        function clearSave() {
            try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
            enviarNuvem(true);
        }

        function loadGame() {
            let data = null;
            try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return false; }
            if (!data || data.v !== 1) return false;
            // Partidas já encerradas não são restauradas
            if (!data.squad.some(s => s.hp > 0) || data.day > GAME_CONFIG.TOTAL_DAYS) return false;
            Object.assign(gameState, {
                day: data.day,
                timeSeconds: data.timeSeconds,
                prestige: data.prestige,
                weather: data.weather,
                tacticalOrders: Object.assign({ SIGNAL_JAM: false }, data.tacticalOrders),
                supplyLineEff: data.supplyLineEff,
                resources: data.resources,
                squad: data.squad,
                enemies: data.enemies,
                lastIntelDay: data.lastIntelDay,
                // Salvamento antigo tinha uma carga única: vira ração, água e munição a caminho
                cargas: data.cargas || (data.pendingSupply ? { rations: data.pendingSupply.ticks, water: data.pendingSupply.ticks, ammoRifle: data.pendingSupply.ticks } : {}),
                combate: data.combate || { tiros: 0, acertos: 0, abates: 0 },
                arsenal: data.arsenal || novoArsenal(),
                trench: typeof data.trench === 'number' ? data.trench : 100,
                barrage: data.barrage || null,
                activeCrisis: data.activeCrisis && CRISES[data.activeCrisis.id] ? data.activeCrisis : null,
                crisisCooldown: typeof data.crisisCooldown === 'number' ? data.crisisCooldown : 240,
                convoyAmbush: !!data.convoyAmbush,
                weakenNextWave: !!data.weakenNextWave,
                counterBattery: data.counterBattery || null,
                nextWaveBoost: data.nextWaveBoost || 0,
                general: data.general || newGeneral()
            });
            document.getElementById('feed-log').innerHTML = data.feed;
            document.getElementById('diary-entries').innerHTML = data.diary;
            return true;
        }

        // Pergunta de confirmação no estilo do jogo: devolve true se o jogador confirmar
        let respostaConfirmacao = null;
        function confirmarJogo({ icone = '⚠️', titulo, texto, ok = 'Confirmar', perigo = false }) {
            return new Promise(resolve => {
                if (respostaConfirmacao) respostaConfirmacao(false);
                respostaConfirmacao = resolve;
                document.getElementById('conf-icone').textContent = icone;
                document.getElementById('conf-titulo').textContent = titulo;
                document.getElementById('conf-texto').textContent = texto;
                const b = document.getElementById('conf-ok');
                b.textContent = ok;
                b.className = 'flex-1 py-2.5 btn-tactical rounded font-bold text-sm ' + (perigo ? 'text-red-400' : '');
                document.getElementById('modal-confirmar').classList.remove('hidden');
            });
        }
        function responderConfirmacao(v) {
            document.getElementById('modal-confirmar').classList.add('hidden');
            const r = respostaConfirmacao; respostaConfirmacao = null;
            if (r) r(v);
        }

        async function novaPartida() {
            if (!await confirmarJogo({ icone: '🪖', titulo: 'Nova partida', texto: 'Começar uma nova partida? A partida atual será apagada e você volta ao dia 1, com o esquadrão descansado e alimentado.', ok: 'Começar de novo', perigo: true })) return;
            skipPageHideSave = true; // trava qualquer salvamento (a pausa ao sair da página regravava a partida antiga)
            try { localStorage.removeItem(SAVE_KEY); localStorage.setItem(NOVA_KEY, String(Date.now())); } catch (e) {}
            // Apaga também a cópia da conta e espera terminar (até 3 s); senão ela voltava ao reabrir
            try { await Promise.race([enviarNuvem(true), new Promise(r => setTimeout(r, 3000))]); } catch (e) {}
            location.reload();
        }

        // Pausa: nada acontece; dá para trocar funções, ordens e pedir apoios com calma
        function alternarPausa(forcar) {
            jogoPausado = typeof forcar === 'boolean' ? forcar : !jogoPausado;
            document.getElementById('lbl-pause').textContent = jogoPausado ? 'Continuar' : 'Pausar';
            document.getElementById('ico-pause').className = `fa-solid ${jogoPausado ? 'fa-play' : 'fa-pause'} text-mil-amberMuted`;
            document.getElementById('btn-pause').classList.toggle('btn-active-order', jogoPausado);
            document.getElementById('corte-pausa').classList.toggle('hidden', !jogoPausado);
            if (jogoPausado && !gameEnded) saveGame();
        }

        // Vira o dia (chamado sozinho no fim da madrugada)
        function endTurn() {
            if (gameEnded) return;
            gameState.day++;
            gameState.timeSeconds = 0;
            onNewDay();
            updateClockAndUI();
            updateUI();
            checkWinLoss();
            if (!gameEnded) { saveGame(); enviarNuvem(true); }
        }

        // Próximo dia com comboio de suprimentos
        function proximoComboio() {
            const n = PRESSURE.CONVOY_EVERY_DAYS;
            return gameState.day + (n - (gameState.day % n));
        }

        function onNewDay() {
            verificarMedalhas();
            try { cenaEfeito('dia', { dia: gameState.day, sub: gameState.day % PRESSURE.CONVOY_EVERY_DAYS === 0 ? 'chega o comboio de suprimentos' : 'sem comboio hoje' }); } catch (e) {}
            somarCarreira({ melhorDia: gameState.day });
            const cb = gameState.combate || { tiros: 0, acertos: 0, abates: 0 };
            if (cb.tiros > 0) {
                const resumo = `Dia ${gameState.day - 1} em combate: ${cb.tiros} tiros, ${cb.acertos} acertos (${Math.round(100 * cb.acertos / cb.tiros)}%), ${cb.abates} inimigos abatidos.`;
                logFeed(`🎯 ${resumo}`, 'text-mil-textMuted');
                addDiaryEntry(resumo);
            }
            gameState.combate = { tiros: 0, acertos: 0, abates: 0 };
            logFeed(`=== DIA ${gameState.day} INICIADO ===`, 'text-mil-amberMuted font-bold');
            playTacticalBeep(1000, 0.08);

            // Weather Transition
            const roll = Math.random();
            if (roll < 0.35) gameState.weather = 'Nublado';
            else if (roll < 0.60) gameState.weather = 'Névoa Espessa';
            else if (roll < 0.85) gameState.weather = 'Chuva Forte';
            else gameState.weather = 'Neve';

            // Supply line impact
            let baseEff = 90;
            if (gameState.weather === 'Chuva Forte') baseEff -= 20;
            if (gameState.weather === 'Neve') baseEff -= 35;
            if (gameState.weather === 'Névoa Espessa') baseEff -= 10;
            gameState.supplyLineEff = clamp(baseEff, 10, 100);

            // Diário do dia, já com o clima sorteado
            const vivosHoje = gameState.squad.filter(s => s.hp > 0).length;
            const climaTexto = { 'Nublado': 'Céu fechado sobre Komona.', 'Névoa Espessa': 'A névoa cobre os campos de Komona.', 'Chuva Forte': 'Chuva forte alaga o fundo da trincheira.', 'Neve': 'A neve cai sobre as posições.' };
            addDiaryEntry(`Dia ${gameState.day}: ${climaTexto[gameState.weather] || ''} Restam ${vivosHoje} homens na linha. Trincheira em ${Math.round(gameState.trench)}%.`);

            // Comboio só nos dias pares (a cada PRESSURE.CONVOY_EVERY_DAYS dias)
            if (gameState.day % PRESSURE.CONVOY_EVERY_DAYS !== 0) {
                logFeed(`Sem comboio hoje. Próximo comboio: dia ${proximoComboio()}.`, 'text-mil-textMuted');
                return;
            }

            // Emboscada (crise): o comboio pela estrada vigiada tem 50% de chance de se perder
            let emboscado = false;
            if (gameState.convoyAmbush) {
                gameState.convoyAmbush = false;
                emboscado = gameState.supplyLineEff > 30 && Math.random() < 0.5;
                if (emboscado) {
                    logFeed('💥 Comboio emboscado na estrada vigiada! A entrega de hoje se perdeu.', 'text-red-500 font-bold');
                } else if (gameState.supplyLineEff > 30) {
                    logFeed('🛣️ O comboio passou pela estrada vigiada sem ser atacado.', 'text-mil-greenMuted');
                }
            }

            if (emboscado) {
                // sem entrega hoje
            } else if (gameState.supplyLineEff > 30) {
                const sm = diff().supplyMult;
                const delRations = Math.floor(20 * sm * comidaDoNivel() * (gameState.supplyLineEff / 100));
                const delWater = Math.floor(22 * sm * comidaDoNivel() * (gameState.supplyLineEff / 100));
                const delAmmo = Math.floor(PRESSURE.CONVOY_AMMO * sm * (gameState.supplyLineEff / 100));
                const delHeavy = Math.floor(PRESSURE.CONVOY_HEAVY * sm * (gameState.supplyLineEff / 100)); // munição pesada

                // Sem ninguém fora da vigília para descarregar, metade da carga se perde
                const recebida = supplyReceivers() > 0 ? 1 : 0.5;
                const r1 = Math.floor(delRations * recebida), w1 = Math.floor(delWater * recebida), a1 = Math.floor(delAmmo * recebida), h1 = Math.floor(delHeavy * recebida);
                gameState.resources.rations += r1;
                gameState.resources.water += w1;
                const a1Real = addAmmoRifle(a1);
                const h1Real = addAmmoHeavy(h1);
                const pesada = ` +${h1Real} Mun. Pesada${h1Real < h1 ? ' (paiol cheio)' : ''}`;
                if (recebida < 1) {
                    logFeed(`📦 Comboio chegou sem ninguém para descarregar (todos de vigília): metade da carga se perdeu. Recebido: +${r1} Rações, +${w1}L Água, +${a1Real} Mun.${a1Real < a1 ? ' (paiol cheio)' : ''},${pesada}`, 'text-red-400 font-bold');
                } else {
                    logFeed(`Suprimentos entregues: +${r1} Rações, +${w1}L Água, +${a1Real} Mun.${a1Real < a1 ? ' (paiol cheio)' : ''},${pesada}`, 'text-mil-greenMuted');
                }
                entregarArsenal(recebida);
            } else {
                logFeed(`SUPRIMENTOS BLOQUEADOS: Linha de retaguarda inativa.`, 'text-red-400 font-bold');
            }
        }

        /* Trincheira: conservação de 0 a 100%. Inteira, tudo funciona como sempre;
           estragada, as invasões ferem mais e o Abrigo Reforçado protege menos. */
        const TRENCH = {
            DAMAGE_BARRAGE: 7,       // por impacto de artilharia inimiga
            DAMAGE_INVASION: 10,     // por soldado de infantaria que invade (patrulha: metade)
            WEAR: 0.3,               // desgaste natural a cada 10 s (~7% por dia)
            WEAR_RAIN: 0.4,          // desgaste extra a cada 10 s com chuva forte
            BREACH_AT: 20,           // em 20% ou menos a trincheira está rompida
            REPAIR_SOLDIER: 0.8,     // por ciclo de 10 s na Manutenção
            REPAIR_ENGINEER: 3       // por ciclo de 10 s, Engenheiro na Manutenção
        };

        const trincheiraRompida = () => gameState.trench <= TRENCH.BREACH_AT;

        function trenchDamage(qtd, motivo) {
            const antes = gameState.trench;
            gameState.trench = Math.max(0, gameState.trench - qtd);
            if (antes >= 50 && gameState.trench < 50) {
                logFeed(`🧱 Trincheira muito danificada (${Math.round(gameState.trench)}%) após ${motivo}. Coloque o Engenheiro na Manutenção.`, 'text-red-400 font-bold');
            }
            if (antes >= 35 && gameState.trench < 35) {
                logFeed(`🧱 TRINCHEIRA PRESTES A ROMPER (${Math.round(gameState.trench)}%)! Em 20% ou menos, uma invasão vira massacre.`, 'text-red-500 font-bold');
            }
            if (antes > TRENCH.BREACH_AT && trincheiraRompida()) {
                logFeed('🧱 TRINCHEIRA ROMPIDA! O abrigo não protege mais e a próxima invasão pode matar todo o esquadrão.', 'text-red-500 font-bold');
            }
        }

        // Invasões ferem até 80% a mais com a trincheira destruída
        // Invasões ferem até 80% a mais com a trincheira estragada
        // (rompida, a invasão de infantaria é um massacre: ver processEnemiesAndCombat)
        function trenchInvasionMult() {
            return 1 + 0.8 * (1 - gameState.trench / 100);
        }

        // Abrigo Reforçado: deixa passar 25% do dano com a trincheira inteira, até 60% estragada;
        // com a trincheira rompida não há onde se abrigar
        function shelterMult() {
            if (trincheiraRompida()) return 1;
            return 0.25 + 0.35 * (1 - gameState.trench / 100);
        }

        /* Recebimento de suprimentos: alguém fora da vigília precisa descarregar.
           Sem ninguém disponível, metade da carga se perde. */
        function supplyReceivers() {
            return gameState.squad.filter(s => s.hp > 0 && s.duty !== 'WATCH').length;
        }

        // Soldado na Cozinha come e bebe: alivia até o limite por ciclo e gasta o
        // estoque proporcional ao que realmente consumiu (não desperdiça se já está saciado).
        /* ===== Fome, sede e fadiga =====
           Valores por ciclo de 10 s de jogo (24 ciclos = 1 dia). Crítico: fome e sede em 75,
           fadiga em 85. Com tempo nublado e sem comer: sede crítica em ~2,3 dias, fome em ~3,4;
           de vigília sem descansar, fadiga crítica em ~2,3 dias. Algumas escolhas cobram do corpo. */
        const NECESSIDADES = {
            FOME: 0.92,           // ~3,4 dias até o crítico (nublado)
            SEDE: 1.35,           // ~2,3 dias até o crítico (nublado)
            CLIMA: {              // multiplicadores de fome e sede
                'Nublado':       { fome: 1,    sede: 1 },
                'Névoa Espessa': { fome: 1,    sede: 1 },
                'Chuva Forte':   { fome: 1.15, sede: 0.8 },  // molhado e frio gasta energia; dá para beber da chuva
                'Neve':          { fome: 1.35, sede: 0.9 }   // frio intenso queima energia
            },
            FADIGA: { WATCH: 1.55, MAINTENANCE: 0.97, RATIONING: 0.53, REST: -3.5 },
            // Escolhas que cobram do corpo (somadas por ciclo):
            COMBATE:     { fadiga: 0.6, sede: 0.5 },   // de vigília com inimigo no setor
            SUPRESSAO:   { fadiga: 0.5, sede: 0.4 },   // Fogo Supressão em combate: atirando sem parar
            VIGILIA_TOTAL: { fadiga: 0.4 },            // todo o esquadrão em alerta
            OBRA:        { fadiga: 0.5, sede: 0.3 },   // construindo ponto defensivo
            ARMA_PESADA: { fadiga: 0.3 },              // operando arma pesada em combate
            ABRIGO:      { fadiga: -0.3 }              // Abrigo Reforçado: cabeça baixa, cansa menos
        };
        function ritmoNecessidades(s) {
            const N = NECESSIDADES, o = gameState.tacticalOrders;
            const clima = N.CLIMA[gameState.weather] || N.CLIMA['Nublado'];
            let fome = N.FOME * clima.fome, sede = N.SEDE * clima.sede;
            let fadiga = N.FADIGA[s.duty] !== undefined ? N.FADIGA[s.duty] : N.FADIGA.MAINTENANCE;
            const emCombate = gameState.enemies.length > 0 && s.duty === 'WATCH';
            const soma = (e) => { fadiga += e.fadiga || 0; sede += e.sede || 0; };
            if (emCombate) soma(N.COMBATE);
            if (emCombate && o.SUPPRESSION) soma(N.SUPRESSAO);
            if (o.FULL_VIGILANCE) soma(N.VIGILIA_TOTAL);
            if (o.SHELTER && s.duty !== 'REST') soma(N.ABRIGO);
            if (s.duty === 'MAINTENANCE' && arsenalDe().posicoes.some(p => p.construindo)) soma(N.OBRA);
            if (emCombate && ocupadoNaArma(s)) soma(N.ARMA_PESADA);
            if (fadiga > 0 && temTraco(s, 'incansavel')) fadiga *= 0.8;
            return { fome, sede, fadiga };
        }

        function eatInKitchen(soldier) {
            const r = gameState.resources;
            const cfg = GAME_CONFIG;
            const querFome = Math.min(soldier.hunger, cfg.KITCHEN_HUNGER_RELIEF);
            if (querFome > 0 && r.rations > 0) {
                const custo = cfg.KITCHEN_RATION * (querFome / cfg.KITCHEN_HUNGER_RELIEF);
                const frac = Math.min(1, r.rations / custo);
                r.rations = Math.max(0, r.rations - custo * frac);
                soldier.hunger = Math.max(0, soldier.hunger - querFome * frac);
            }
            const querSede = Math.min(soldier.thirst, cfg.KITCHEN_THIRST_RELIEF);
            if (querSede > 0 && r.water > 0) {
                const custo = cfg.KITCHEN_WATER * (querSede / cfg.KITCHEN_THIRST_RELIEF);
                const frac = Math.min(1, r.water / custo);
                r.water = Math.max(0, r.water - custo * frac);
                soldier.thirst = Math.max(0, soldier.thirst - querSede * frac);
            }
        }

        function processSquadNeeds() {
            if (gameState.timeSeconds % 10 !== 0) return;
            processarMental();
            gameState.squad.forEach(s => { if (s.hp > 0 && s.hp < 25) s.quaseMorreu = true; });

            // Desgaste natural da trincheira (mais rápido com chuva forte)
            trenchDamage(TRENCH.WEAR + (gameState.weather === 'Chuva Forte' ? TRENCH.WEAR_RAIN : 0), 'o desgaste');

            // Médico vivo cura 0,6 de HP por ciclo no soldado mais ferido
            const medico = gameState.squad.find(s => s.class === 'Médico' && s.hp > 0);
            if (medico) {
                const ferido = gameState.squad.filter(s => s.hp > 0 && s.hp < 100).sort((a, b) => a.hp - b.hp)[0];
                if (ferido) ferido.hp = Math.min(100, ferido.hp + 0.6 * (temTraco(medico, 'maos') ? 1.5 : 1));
            }

            gameState.squad.forEach(soldier => {
                if (soldier.hp <= 0) return;

                // Fome, sede e fadiga: ritmo pelo clima, pela função e pelas escolhas táticas
                const r = ritmoNecessidades(soldier);
                soldier.hunger = Math.min(100, soldier.hunger + r.fome);
                soldier.thirst = Math.min(100, soldier.thirst + r.sede);
                if (soldier.duty === 'RATIONING') eatInKitchen(soldier);
                soldier.fatigue = Math.max(0, Math.min(100, soldier.fatigue + r.fadiga));
                if (soldier.duty === 'REST') soldier.hp = Math.min(100, soldier.hp + 0.4);

                if (soldier.duty === 'MAINTENANCE') {
                    soldier.moral = Math.min(100, soldier.moral + 0.4);
                    // Com um ponto defensivo em obra, a Manutenção trabalha nele em vez de reparar
                    if (!trabalharNaObra(soldier)) {
                        const reparo = (soldier.class === 'Engenheiro' ? TRENCH.REPAIR_ENGINEER : TRENCH.REPAIR_SOLDIER) * (mentalDe(soldier) === 'apatia' ? MENTAL.APATIA_RITMO : 1);
                        gameState.trench = Math.min(100, gameState.trench + reparo);
                    }
                }

                // Penalidades de fome, sede e estresse
                if (soldier.hunger >= 75) {
                    soldier.hp = Math.max(0, soldier.hp - 1);
                    soldier.moral = Math.max(0, soldier.moral - 1.5);
                }
                if (soldier.thirst >= 75) {
                    soldier.hp = Math.max(0, soldier.hp - 1);
                    soldier.moral = Math.max(0, soldier.moral - 1.5);
                }
                if (soldier.fatigue >= 85) {
                    soldier.moral = Math.max(0, soldier.moral - 0.5);
                } else if (soldier.fatigue < 70 && soldier.hunger < 50 && soldier.thirst < 50) {
                    // Soldado descansado e alimentado recupera moral aos poucos
                    soldier.moral = Math.min(100, soldier.moral + 0.2);
                }
            });
        }

        /* ==========================================================================
           INIMIGOS E EVENTOS
           ========================================================================== */
        /* Dificuldade por nível: sobe uma etapa a cada vitória, até o nível máximo.
           diff() traduz o nível num valor d e daí nos multiplicadores abaixo. */
        const MAX_LEVEL = 25;
        const LEVEL_KEY = 'frontline-ponto-alpha-nivel';

        // Dificuldade à escolha do jogador (Configurações → Jogo). Os níveis 1 a 25 continuam subindo em cima disso.
        const MODOS_DIFICULDADE = {
            recruta:  { nome: 'Recruta',  desc: 'Inimigos mais fracos e mais suprimentos: bom para aprender e passar de nível',  dano: 0.92,  vida: 0.96, eventos: 0.95, suprimento: 1.1,  premio: 1.08, custo: 0.92 },
            soldado:  { nome: 'Soldado',  desc: 'O equilíbrio padrão do jogo',                                                   dano: 1,    vida: 1,    eventos: 1,    suprimento: 1,    premio: 1,    custo: 1 },
            veterano: { nome: 'Veterano', desc: 'Inimigos mais duros e suprimentos mais curtos: para quem quer sofrer',          dano: 1.06, vida: 1.04, eventos: 1.04, suprimento: 0.95, premio: 0.95, custo: 1.05 }
        };
        function diff() {
            // Rebalanceado com o jogador automático usando as defesas (tests/balanco.js), com o comboio maior:
            // Soldado vence ~90% no nível 1, ~90% no 13 e ~73% no 25; Veterano ~78%, ~73% e ~10%;
            // Recruta vence sempre. A subida por nível vem do bloco PRESSURE e das crises.
            const lv = Math.max(1, Math.min(MAX_LEVEL, gameState.level));
            const d = lv <= 12 ? 5.94 : 5.94 + (6.05 - 5.94) * (lv - 12) / 13;
            // Modo de dificuldade escolhido nas Configurações (Soldado = o equilíbrio padrão)
            const m = MODOS_DIFICULDADE[(typeof CONFIG !== 'undefined' && CONFIG.dificuldade) || 'soldado'] || MODOS_DIFICULDADE.soldado;
            return {
                eventMult: (1 + 0.30 * d) * m.eventos,                  // frequência de eventos
                enemyHpMult: (1 + 0.15 * d) * m.vida,                   // vida dos inimigos
                enemyDmgMult: (1 + 0.20 * d) * m.dano,                  // dano de tiros, artilharia e invasão
                waveExtra: Math.floor(d / 2),             // soldados extras por onda
                supplyMult: Math.max(0.5, 1 - 0.06 * d) * m.suprimento, // entrega diária de suprimentos
                rewardMult: Math.max(0.4, 1 - 0.07 * d) * m.premio,     // prestígio ganho (relatório e abates)
                costMult: (1 + 0.12 * d) * m.custo,                     // custo dos apoios da Central
                // Crises: até 30% mais frequentes e mais duras no nível máximo
                crisisMult: 1 + 0.3 * (lv - 1) / (MAX_LEVEL - 1),
                crisisSeverity: 1 + 0.3 * (lv - 1) / (MAX_LEVEL - 1)
            };
        }

        const custo = (base) => Math.round(base * diff().costMult);
        const ganho = (base) => Math.round(base * diff().rewardMult);

        function loadLevel() {
            try {
                const n = parseInt(localStorage.getItem(LEVEL_KEY) || '1', 10);
                return Math.max(1, Math.min(MAX_LEVEL, isNaN(n) ? 1 : n));
            } catch (e) { return 1; }
        }

        function saveLevel(n) {
            try { localStorage.setItem(LEVEL_KEY, String(n)); } catch (e) {}
            enviarNuvem(true);
        }

        /* Pressão do inimigo e ritmo de suprimentos, num lugar só para ajustar fácil.
           Valores pensados para o nível 1 já ser pesado; os níveis somam por cima. */
        const PRESSURE = {
            WAVE_BASE: 6,          // soldados na primeira onda de infantaria (era 7)
            WAVE_EVERY_DAYS: 5,    // +1 soldado por onda a cada 5 dias
            WAVE_CAP: 12,          // máximo por onda (fora extras de nível e de patrulha)
            ENEMY_HP: 1.0,         // multiplicador geral da vida dos inimigos
            ENEMY_HP_PER_DAY: 5,   // vida base cresce +5 por dia (compensa a munição pesada que agora dura mais)
            ENEMY_DAMAGE: 0.4,     // dano de cada inimigo (ondas maiores e resistentes já somam muito dano no total)
            ENEMY_DMG_PER_DAY: 0.07, // o dano dos inimigos cresce 7% (do valor base) a cada dia
            GENERAL_INCOME: 1.75,  // ritmo de ataques do general (1 = ritmo do antigo sorteio; era 2,0)
            CONVOY_EVERY_DAYS: 2,  // comboio de suprimentos a cada 2 dias
            CONVOY_AMMO: 850,      // munição leve por comboio, antes da eficiência da linha e da dificuldade (era 700)
            CONVOY_HEAVY: 160,     // munição pesada por comboio (era 80)
            // A cada nível acima do 1:
            FOOD_LOSS_PER_LEVEL: 0.004,   // −0,4% de ração e água no comboio (nível 25: −10%)
            WAVE_PLUS_EVERY_LEVELS: 99,   // soldados extras por onda por nível: desligado (o +1 no nível 25 derrubava a vitória de 55% para 15% de uma vez)
            ENEMY_HP_PER_LEVEL: 0.001,    // no lugar disso, inimigos 0,1% mais resistentes por nível (nível 25: +2,4%), uma subida suave
            ATTACK_RATE_PER_LEVEL: 0.003, // general ataca 0,3% mais rápido por nível (nível 25: +7%)
            AMMO_SPEND: 2,              // gasto de munição pesada na supressão ×2 (era ×3)
            MG_AMMO_PER_SHOT: 0.5,      // munição pesada por disparo da metralhadora .50 (era 1: ela esvaziava o paiol por volta do dia 15)
            AMMO_CAP_RIFLE: 2000,       // capacidade do paiol: munição leve
            AMMO_CAP_HEAVY: 600,        // capacidade do paiol: munição pesada
        };

        // Entrada de munição leve respeitando a capacidade do paiol; devolve o que coube
        function addAmmoHeavy(qtd) {
            const antes = gameState.resources.ammoHeavy;
            gameState.resources.ammoHeavy = Math.min(PRESSURE.AMMO_CAP_HEAVY, antes + qtd);
            return Math.max(0, Math.round(gameState.resources.ammoHeavy - antes));
        }
        function addAmmoRifle(qtd) {
            const antes = gameState.resources.ammoRifle;
            gameState.resources.ammoRifle = Math.min(PRESSURE.AMMO_CAP_RIFLE, antes + qtd);
            return Math.max(0, Math.round(gameState.resources.ammoRifle - antes));
        }
        const nivelAcima = () => Math.max(0, Math.min(MAX_LEVEL, gameState.level) - 1);
        const comidaDoNivel = () => Math.max(0.3, 1 - PRESSURE.FOOD_LOSS_PER_LEVEL * nivelAcima());
        const ondaDoNivel = () => Math.floor(nivelAcima() / PRESSURE.WAVE_PLUS_EVERY_LEVELS);
        const ritmoDoNivel = () => 1 + PRESSURE.ATTACK_RATE_PER_LEVEL * nivelAcima();

        // Tipos de inimigo: velocidade, vida relativa, chance de atacar e dano por ataque
        const ENEMY_TYPES = {
            // Dano: cai com os ferimentos (vida atual / vida máxima) e cresce com os dias,
            // mas não acompanha os bônus de vida (senão vida extra viraria dano em dobro)
            infantaria: { label: 'INFANTARIA', speed: 0.85, hpMult: 1.0, attackChance: 0.35, dmg: (e) => 1.6 * (e.hp / (e.maxHp || e.hp)) * (1 + PRESSURE.ENEMY_DMG_PER_DAY * gameState.day) },
            patrulha:   { label: 'PATRULHA',   speed: 1.15, hpMult: 0.6, attackChance: 0.30, dmg: (e) => 1.2 * (e.hp / (e.maxHp || e.hp)) * (1 + PRESSURE.ENEMY_DMG_PER_DAY * gameState.day) },
            drone:      { label: 'DRONE',      speed: 1.5,  hpMult: 0.35, attackChance: 0.15, dmg: () => 2 },
            // Blindado: lento e resistente; fuzil quase não fere (só anticarro, morteiro e artilharia rendem)
            blindado:   { label: 'BLINDADO',   speed: 0.55, hpMult: 3.0,  attackChance: 0.12, dmg: (e) => 2.2 * (e.hp / (e.maxHp || e.hp)) * (1 + PRESSURE.ENEMY_DMG_PER_DAY * gameState.day) }
        };
        const BARRAGE_WARNING_TICKS = 64;  // aviso antes da artilharia cair (8 s reais)
        const ARTILLERY_SUPPORT_DAMAGE = 200; // dano da artilharia de apoio em cada inimigo
                const INVASION_TARGETS = 2;           // soldados atingidos por cada invasor (todos, se a trincheira romper)
        const DRONE_SPOT_ARTILLERY = 1.5;  // drone observando: artilharia inimiga +50% de dano
        const DRONE_SPOT_FIRE = 1.2;       // drone observando: tiros inimigos +20% de dano
        const JAM_DRONE_CRASH = 0.06;      // bloqueio de sinal: chance por tick de cada drone cair (~40% por segundo real)
        const BLIND_FIRE = 0.5;            // sem vigia: o esquadrão atira às cegas
        const PATROL_MARK_TICKS = 80;      // patrulha no alcance por 10 s reais marca a posição
        const PATROL_MARK_BOOST = 1;       // soldado extra na próxima onda

        // Drone só guia a artilharia e os tiros se o sinal dele não estiver bloqueado
        const droneObservando = (estado = gameState) => !estado.tacticalOrders.SIGNAL_JAM && estado.enemies.some(e => e.type === 'drone');
        const temVisao = (estado = gameState) => estado.tacticalOrders.FULL_VIGILANCE || estado.squad.some(s => s.hp > 0 && s.duty === 'WATCH');
        const BARRAGE_SHOTS = 3;
        const BARRAGE_DAMAGE = 13;


        // ===== Tiro de verdade =====
        // Cada arma: balas por segundo de jogo (8 por segundo real), chance base de acerto e dano por acerto
        const ARMAS = {
            'Fuzileiro Regular': { cadencia: 0.3125, precisao: 0.42, dano: 48 },  // ~2,5 balas/s real
            'Metralhador':       { cadencia: 0.875,  precisao: 0.30, dano: 40 },  // ~7 balas/s real
            'Atirador de Elite': { cadencia: 0.075,  precisao: 0.90, dano: 160 }, // ~0,6 bala/s real
            'Médico':            { cadencia: 0.25,   precisao: 0.30, dano: 40 },
            'Engenheiro':        { cadencia: 0.25,   precisao: 0.30, dano: 40 }
        };
        const PISTOLA = { cadencia: 0.15, precisao: 0.20, dano: 20 }; // sem munição leve: pistola e baioneta
        const TIRO = {
            FORA_DA_VIGILIA: 0.75,  // quem está na cozinha, descanso ou manutenção atira menos
            SUPRESSAO: { cad: 2.5, prec: 0.7 },
            ECONOMIA:  { cad: 0.4, prec: 1.5 },
            ABRIGO:    { cad: 0.4, prec: 0.8 },
            NOITE: 0.85, NEVOA: 0.8, CHUVA: 0.9, DRONE_ALVO: 0.8, ALCANCE: 300 // alcance máximo do fuzil (300 m)
        };
        const statsDe = (s) => (s.stats = s.stats || { tiros: 0, acertos: 0, abates: 0 });
        const ehNoite = (estado = gameState) => estado.timeSeconds >= 120;

        // Precisão de um soldado contra um alvo, já com todos os modificadores
        function chanceDeAcerto(s, arma, enemy, estado = gameState) {
            const o = estado.tacticalOrders;
            let p = arma.precisao;
            p *= 0.6 + 0.4 * Math.max(0, s.hp) / 100;
            p *= 0.7 + 0.3 * Math.max(0, s.moral) / 100;
            if (s.fatigue > 70) p *= 0.85;
            if (o.SUPPRESSION) p *= TIRO.SUPRESSAO.prec;
            if (o.CONSERVE) p *= TIRO.ECONOMIA.prec * (temTraco(s, 'paciente') ? 1.2 : 1);
            if (mentalDe(s) === 'heroismo') p *= MENTAL.HEROISMO_PRECISAO;
            if (o.SHELTER) p *= TIRO.ABRIGO.prec;
            if (!temVisao(estado)) p *= BLIND_FIRE;
            if (ehNoite(estado) && !o.FULL_VIGILANCE) p *= TIRO.NOITE;
            if (estado.weather === 'Névoa Espessa') p *= TIRO.NEVOA;
            if (estado.weather === 'Chuva Forte') p *= TIRO.CHUVA;
            if (enemy) {
                if (enemy.type === 'drone') p *= TIRO.DRONE_ALVO;
                const d = Math.max(0, Math.min(TIRO.ALCANCE, enemy.distance));
                p *= 1.3 - 0.6 * d / TIRO.ALCANCE; // perto: mais fácil; no limite (300 m): bem mais difícil
            }
            return Math.min(0.95, p);
        }
        function cadenciaDe(s, arma, estado = gameState) {
            const o = estado.tacticalOrders;
            let c = arma.cadencia;
            if (s.duty !== 'WATCH') c *= TIRO.FORA_DA_VIGILIA;
            if (o.SUPPRESSION) c *= TIRO.SUPRESSAO.cad;
            if (o.CONSERVE) c *= TIRO.ECONOMIA.cad;
            if (o.SHELTER) c *= TIRO.ABRIGO.cad;
            if (mentalDe(s) === 'apatia') c *= MENTAL.APATIA_RITMO;
            if (mentalDe(s) === 'heroismo') c *= MENTAL.HEROISMO_CADENCIA;
            return c;
        }

        function dispararEsquadrao(alive, estado = gameState) {
            const noAlcance = estado.enemies.filter(e => e.distance <= TIRO.ALCANCE);
            if (!noAlcance.length) return; // ninguém ao alcance: o esquadrão segura o fogo
            // Fuzil quase não fere blindado: só atiram nele se não houver outro alvo
            const semBlindagem = noAlcance.filter(e => e.type !== 'blindado');
            const inimigos = semBlindagem.length ? semBlindagem : noAlcance;
            const maisProximo = inimigos.reduce((a, e) => (e.distance < a.distance ? e : a), inimigos[0]);
            const escolherAlvo = () => {
                const vivos = inimigos.filter(e => e.hp > 0);
                if (!vivos.length) return null;
                if (maisProximo.hp > 0 && (vivos.length === 1 || Math.random() < 0.5)) return maisProximo;
                return vivos[Math.floor(Math.random() * vivos.length)];
            };
            let disparou = false;
            alive.forEach(s => {
                if (ocupadoNaArma(s, estado)) return; // está operando uma arma pesada
                if (mentalDe(s) === 'panico') return; // em pânico: encolhido no abrigo
                const temBala = estado.resources.ammoRifle >= 1;
                const arma = temBala ? (ARMAS[s.class] || ARMAS['Fuzileiro Regular']) : PISTOLA;
                s.cadAcc = (s.cadAcc || 0) + cadenciaDe(s, arma, estado);
                const st = statsDe(s);
                while (s.cadAcc >= 1) {
                    s.cadAcc -= 1;
                    const alvo = escolherAlvo();
                    if (!alvo) { s.cadAcc = 0; break; }
                    if (arma !== PISTOLA) {
                        if (estado.resources.ammoRifle < 1) break;
                        estado.resources.ammoRifle -= 1;
                    }
                    st.tiros++; estado.combate.tiros++; disparou = true;
                    if (Math.random() < chanceDeAcerto(s, arma, alvo, estado)) {
                        st.acertos++; estado.combate.acertos++;
                        alvo.hp -= arma.dano * blindagem(alvo, 'fuzil');
                        if (alvo.hp <= 0 && !alvo.abatidoPor) alvo.abatidoPor = s.id;
                    }
                }
            });
            if (disparou && Math.random() < 0.25) playGunshotSound();
        }

        // Estimativa de balas para derrubar um soldado de infantaria hoje (aba Logística)
        function balasPorInimigo() {
            const vivos = gameState.squad.filter(s => s.hp > 0);
            if (!vivos.length) return 0;
            const alvo = { type: 'infantaria', distance: 150 };
            let dano = 0, balas = 0;
            vivos.forEach(s => {
                const a = ARMAS[s.class] || ARMAS['Fuzileiro Regular'];
                const c = cadenciaDe(s, a);
                balas += c; dano += c * chanceDeAcerto(s, a, alvo) * a.dano;
            });
            if (dano <= 0) return 0;
            const vida = (100 + gameState.day * PRESSURE.ENEMY_HP_PER_DAY) * diff().enemyHpMult * PRESSURE.ENEMY_HP * (1 + PRESSURE.ENEMY_HP_PER_LEVEL * nivelAcima());
            return Math.ceil(vida / (dano / balas));
        }

        function spawnEnemyAssault(startDist = 270) {
            const extra = diff().waveExtra;
            const marcada = gameState.nextWaveBoost || 0;
            gameState.nextWaveBoost = 0;
            const base = Math.min(PRESSURE.WAVE_CAP, PRESSURE.WAVE_BASE + Math.floor((gameState.day - 1) / PRESSURE.WAVE_EVERY_DAYS));
            const count = base + Math.max(0, extra - 2) + ondaDoNivel() + marcada;
            if (marcada) logFeed(`🎯 A patrulha marcou a posição: esta onda vem com ${marcada} soldados a mais.`, 'text-red-400 font-bold');
            for (let i = 0; i < count; i++) spawnEnemy('infantaria', startDist);
            logFeed(`🚨 ALERTA: Tropa inimiga avança sobre o setor!`, 'text-red-400 font-bold');
            if (gameState.weakenNextWave) {
                // Interceptação revelou a posição: a onda chega 30% mais fraca
                gameState.weakenNextWave = false;
                gameState.enemies.slice(-count).forEach(e => { e.hp *= 0.7; });
                logFeed('📡 Graças à interceptação, esta onda chega enfraquecida.', 'text-mil-greenMuted');
            }
            playTacticalBeep(400, 0.2);
        }

        function spawnEnemy(type, startDist) {
            const t = ENEMY_TYPES[type];
            const vida = (100 + gameState.day * PRESSURE.ENEMY_HP_PER_DAY) * t.hpMult * diff().enemyHpMult * PRESSURE.ENEMY_HP * (1 + PRESSURE.ENEMY_HP_PER_LEVEL * nivelAcima());
            gameState.enemies.push({
                id: Date.now() + Math.random(),
                type,
                distance: startDist + Math.random() * 20,
                hp: vida,
                maxHp: vida,
                offsetX: (Math.random() - 0.5) * 160
            });
        }

        /* ==========================================================================
           GENERAL INIMIGO: um "bot" que planeja os ataques em vez de sortear
           - Acumula um orçamento de ofensiva no mesmo ritmo médio do antigo sorteio.
           - A cada 10 s avalia a situação (noite, névoa, vigias, trincheira, cansaço,
             munição) e escolhe o plano mais vantajoso; se o melhor plano ainda for
             caro, espera e junta forças.
           - Aprende o jeito de jogar (abrigo, contra-bateria, bloqueio, patrulhas)
             e muda de tática para explorar o que o jogador repete.
           ========================================================================== */
        const GENERAL_THINK_EVERY = 10;   // segundos entre decisões
        const GENERAL_PLANS = {
            patrulha:     { nome: 'Patrulha de reconhecimento', custo: 2, passos: [{ a: 'patrulha', d: 0 }],
                            pista: '📻 Rádio: batedores inimigos rondando o setor.' },
            drone:        { nome: 'Drone de observação', custo: 2, passos: [{ a: 'drone', d: 0 }],
                            pista: '📻 Rádio: zumbido de drones ao longe.' },
            artilharia:   { nome: 'Bombardeio', custo: 3, passos: [{ a: 'artilharia', d: 0 }],
                            pista: '📻 Rádio: baterias inimigas se posicionando.' },
            onda:         { nome: 'Assalto de infantaria', custo: 4, passos: [{ a: 'infantaria', d: 0 }],
                            pista: '📻 Rádio: movimento de tropas ao norte. Preparem a defesa.' },
            reconBomb:    { nome: 'Reconhecimento e bombardeio', custo: 5, passos: [{ a: 'drone', d: 0 }, { a: 'artilharia', d: 8 }],
                            pista: '📻 Rádio: drones e baterias se coordenando. Bombardeio guiado a caminho.' },
            marcarOnda:   { nome: 'Marcar e atacar', custo: 6, passos: [{ a: 'patrulha', d: 0 }, { a: 'infantaria', d: 25 }],
                            pista: '📻 Rádio: batedores à frente de uma coluna de infantaria.' },
            bombAssalto:  { nome: 'Bombardeio e assalto', custo: 7, passos: [{ a: 'artilharia', d: 0 }, { a: 'infantariaPerto', d: 4 }],
                            pista: '📻 Rádio: infantaria avançando atrás de uma barragem de artilharia!' },
            blindado:     { nome: 'Ataque blindado', custo: 8, passos: [{ a: 'blindado', d: 0 }],
                            pista: '📻 Rádio: ronco de motores e lagartas ao norte. Blindado a caminho!' }
        };

        function newGeneral() {
            return {
                budget: 0,
                think: GENERAL_THINK_EVERY,
                plan: null,          // { id, passos: [...] }
                postura: 'Observando',
                // Memória do jeito de jogar (0 a 1), começa neutra
                memoria: { abrigo: 0.3, contraBateria: 0.2, bloqueio: 0.3, abatePatrulha: 0.5, vigias: 2 }
            };
        }

        function lembrar(chave, valor, peso) {
            const m = gameState.general.memoria;
            m[chave] = m[chave] + (valor - m[chave]) * peso;
        }

        // Aviso de artilharia encurta se o jogador usa muita contra-bateria (baterias mudam de lugar)
        function barrageWarning() {
            return Math.round(BARRAGE_WARNING_TICKS - 32 * Math.min(1, gameState.general ? gameState.general.memoria.contraBateria : 0)); // 8 s até 4 s
        }

        // Orçamento por segundo: o ritmo do antigo sorteio de eventos multiplicado por
        // PRESSURE.GENERAL_INCOME (o general gasta em planos maiores e mais caros)
        function generalIncome() {
            if (gameState.day < 2) return 0;
            const p = Math.min(0.05, Math.min(0.02, 0.0025 + gameState.day * 0.0005) * diff().eventMult);
            return p * 2.75 * PRESSURE.GENERAL_INCOME * ritmoDoNivel();
        }

        function situacao() {
            const vivos = gameState.squad.filter(s => s.hp > 0);
            const media = (k) => vivos.reduce((t, s) => t + s[k], 0) / Math.max(1, vivos.length);
            const vigias = vivos.filter(s => s.duty === 'WATCH').length;
            return {
                noite: gameState.timeSeconds >= 120,
                nevoa: gameState.weather === 'Névoa Espessa',
                vigiasFracos: vigias <= 1 && !gameState.tacticalOrders.FULL_VIGILANCE,
                trincheiraFraca: gameState.trench < 60,
                cansado: media('fatigue') > 60 || media('hunger') > 60 || media('thirst') > 60,
                municaoBaixa: gameState.resources.ammoRifle < 150,
                semAntiTanque: !temAntiTanque(),
                vigias
            };
        }

        // Quanto o general "gosta" de cada plano agora (maior = melhor)
        function utilidadePlano(id, sit, m) {
            const b = (x) => (x ? 1 : 0);
            switch (id) {
                case 'onda':        return 1.0 + 0.5 * b(sit.noite) + 0.4 * b(sit.nevoa) + 0.6 * b(sit.vigiasFracos) + 0.5 * b(sit.trincheiraFraca) + 0.4 * b(sit.cansado) + 0.4 * b(sit.municaoBaixa);
                case 'patrulha':    return 0.6 + 0.6 * (1 - m.abatePatrulha);
                case 'drone':       return 0.5 + 0.6 * (1 - m.bloqueio);
                case 'artilharia':  return 0.7 + 0.5 * (1 - m.abrigo) + 0.4 * b(sit.trincheiraFraca) - 0.2 * m.contraBateria;
                case 'reconBomb':   return 0.9 + 0.6 * (1 - m.bloqueio) + 0.3 * (1 - m.abrigo) - 0.2 * m.contraBateria;
                case 'marcarOnda':  return 0.9 + 0.7 * (1 - m.abatePatrulha) + 0.3 * b(sit.noite);
                case 'bombAssalto': return 0.8 + 1.0 * m.abrigo + 0.3 * b(sit.trincheiraFraca) - 0.1 * m.contraBateria;
                case 'blindado':    return 0.7 + 0.5 * b(sit.trincheiraFraca) + 0.6 * b(sit.semAntiTanque);
            }
            return 0;
        }

        // Pode executar o plano agora? (não empilha bombardeios nem lota o mapa)
        function planoViavel(id) {
            const plano = GENERAL_PLANS[id];
            if (plano.passos.some(p => p.a === 'artilharia') && gameState.barrage) return false;
            // Uma onda de infantaria por vez: não manda outra enquanto a anterior avança
            if (plano.passos.some(p => p.a.startsWith('infantaria')) && gameState.enemies.some(e => e.type === 'infantaria')) return false;
            if (gameState.enemies.length >= 4) return false;
            if (id === 'drone' && gameState.day < 3) return false;
            if (id === 'blindado' && (gameState.day < 10 || gameState.enemies.some(e => e.type === 'blindado'))) return false;
            return true;
        }

        function generalThink() {
            const g = gameState.general;
            const sit = situacao();
            const m = g.memoria;
            // Avalia todos os planos, com um pouco de imprevisibilidade
            const notas = Object.keys(GENERAL_PLANS)
                .filter(planoViavel)
                .map(id => ({ id, nota: utilidadePlano(id, sit, m) + Math.random() * 0.25 }))
                .sort((x, y) => y.nota - x.nota);
            if (notas.length === 0) { g.postura = 'Reagrupando'; return; }
            const melhor = notas[0];
            const acessivel = notas.find(n => GENERAL_PLANS[n.id].custo <= g.budget);
            // Se o plano preferido ainda é caro e vale bem mais, junta forças
            if (!acessivel || (GENERAL_PLANS[melhor.id].custo > g.budget && melhor.nota > acessivel.nota + 0.3)) {
                g.postura = `Acumulando forças para: ${GENERAL_PLANS[melhor.id].nome}`;
                return;
            }
            const plano = GENERAL_PLANS[acessivel.id];
            g.budget -= plano.custo;
            g.plan = { id: acessivel.id, passos: plano.passos.map(p => ({ ...p })) };
            g.postura = `Executando: ${plano.nome}`;
            // Pista no rádio: mais vigias, mais chance de perceber o movimento
            if (Math.random() < Math.min(0.8, 0.3 + 0.1 * sit.vigias)) logFeed(plano.pista, 'text-mil-amberMuted font-bold');
        }

        function executarPasso(acao) {
            if (acao === 'infantaria') {
                spawnEnemyAssault();
            } else if (acao === 'infantariaPerto') {
                // Avança atrás da barragem: chega ao alcance logo depois do bombardeio
                spawnEnemyAssault(170);
            } else if (acao === 'patrulha') {
                const qtd = 1 + (Math.random() < 0.5 ? 1 : 0);
                for (let i = 0; i < qtd; i++) spawnEnemy('patrulha', 250);
                logFeed('👣 PATRULHA INIMIGA detectada ao norte, avançando sobre o setor.', 'text-red-400 font-bold');
                playTacticalBeep(500, 0.1);
            } else if (acao === 'blindado') {
                spawnEnemy('blindado', 280);
                logFeed('🚜 BLINDADO INIMIGO avançando! Fuzil quase não fere: use o anticarro, o morteiro ou a artilharia.', 'text-red-400 font-bold');
                playTacticalBeep(300, 0.25);
            } else if (acao === 'drone') {
                spawnEnemy('drone', 260);
                logFeed('🛸 DRONE INIMIGO sobrevoando o setor! Bloqueio de Sinal cega o drone.', 'text-red-400 font-bold');
                playTacticalBeep(900, 0.1);
            } else if (acao === 'artilharia' && !gameState.barrage) {
                const aviso = barrageWarning();
                const alvos = escolherAlvosArtilharia();
                gameState.barrage = { ticks: aviso, alvos };
                tocarSom('alarme', 0.8);
                if (typeof CONFIG !== 'undefined' && CONFIG.pausaArtilharia && !jogoPausado) {
                    alternarPausa(true);
                    logFeed('⏸ Jogo pausado no aviso de artilharia: decida com calma e toque em Continuar.', 'text-mil-amberMuted font-bold');
                }
                logFeed(`💥 ARTILHARIA INIMIGA: impacto em ${seg(aviso)}s! Alvos: ${alvos.map(nomeDoAlvo).join(', ')}. Soldado marcado em Descanso fica no abrigo e leva só 30% do dano.`, 'text-red-500 font-bold');
                playTacticalBeep(300, 0.3);
            }
        }

        // Um segundo do general: junta orçamento, avança o plano em curso ou pensa no próximo
        function randomEventCheck() {
            if (!gameState.general) gameState.general = newGeneral();
            const g = gameState.general;
            if (gameState.day < 2) { g.postura = 'Observando'; return; }
            g.budget = Math.min(12, g.budget + generalIncome());
            lembrar('vigias', gameState.squad.filter(s => s.hp > 0 && s.duty === 'WATCH').length, 0.01);
            if (gameState.enemies.some(e => e.type === 'drone')) lembrar('bloqueio', gameState.tacticalOrders.SIGNAL_JAM ? 1 : 0, 0.02);

            if (g.plan) {
                const passo = g.plan.passos[0];
                if (passo.d > 0) { passo.d--; return; }
                executarPasso(passo.a);
                g.plan.passos.shift();
                if (g.plan.passos.length === 0) { g.plan = null; g.think = GENERAL_THINK_EVERY; }
                return;
            }
            if (--g.think > 0) return;
            g.think = GENERAL_THINK_EVERY;
            generalThink();
        }

        // O que o general já percebeu do jogador (aparece na aba Rádio)
        function leiturasDoGeneral() {
            const m = gameState.general ? gameState.general.memoria : null;
            if (!m) return [];
            const l = [];
            if (m.abrigo > 0.6) l.push('Percebeu que vocês se abrigam na artilharia: espere infantaria junto com os bombardeios.');
            if (m.contraBateria > 0.4) l.push(`Está mudando as baterias de lugar por causa da contra-bateria: aviso de artilharia em ${seg(barrageWarning())}s.`);
            if (m.bloqueio > 0.6) l.push('Os drones dele estão sendo bloqueados: está trocando drones por patrulhas.');
            if (m.abatePatrulha > 0.7) l.push('As patrulhas dele estão sendo abatidas: espere mais drones.');
            if (m.abatePatrulha < 0.3) l.push('As patrulhas dele estão marcando a posição de vocês: espere ondas maiores.');
            if (m.vigias < 1.2) l.push('Sabe que a vigilância está fraca: espere ataques à noite e com névoa.');
            if (l.length === 0) l.push('Ainda estudando o jeito de vocês defenderem.');
            return l.slice(0, 3);
        }

        // Carga emergencial: cada item é pedido e entregue separado
        const CARGAS = {
            rations:   { nome: 'Rações',         qtd: 20,  custo: 45, unidade: 'rações',    icone: 'opened-food-can' },
            water:     { nome: 'Água',           qtd: 30,  custo: 45, unidade: 'L de água', icone: 'water-flask' },
            ammoRifle: { nome: 'Munição leve',   qtd: 250, custo: 50, unidade: 'cartuchos', icone: 'bullets' },
            ammoHeavy: { nome: 'Munição pesada', qtd: 60,  custo: 50, unidade: 'cartuchos pesados', icone: 'heavy-bullets' }
        };
        const cargasACaminho = () => (gameState.cargas = gameState.cargas || {});

        function pedirCarga(item) {
            const c = CARGAS[item];
            if (!c) return false;
            const cargas = cargasACaminho();
            if (cargas[item]) { logFeed(`Já há ${c.nome.toLowerCase()} a caminho.`, 'text-mil-amberMuted'); return false; }
            if (gameState.prestige < custo(c.custo)) { logFeed('Prestígio insuficiente!', 'text-red-400'); return false; }
            gameState.prestige -= custo(c.custo);
            // Tempo de resposta fixo pelo nível: 150 s reais no nível 1, +10 s a cada nível
            const linhaCortada = gameState.supplyLineEff <= 30;
            const espera = esperaCarga() * (linhaCortada ? 2 : 1);
            cargas[item] = espera;
            logFeed(`📦 Carga de ${c.nome.toLowerCase()} solicitada à Central. Chegada em ${seg(espera)}s${linhaCortada ? ' (linha cortada: atraso dobrado)' : ''}.`, 'text-mil-amberMuted font-bold');
            return true;
        }

        // Lista de pedidos na aba Rádio. Os botões são criados uma vez e só têm o texto
        // atualizado: recriar a cada segundo fazia o celular perder o toque.
        function renderCargas() {
            const lista = document.getElementById('lista-cargas');
            if (!lista.children.length) {
                lista.innerHTML = Object.keys(CARGAS).map(k => `
                    <div class="flex justify-between items-center gap-2">
                        <span class="text-mil-textGlow"><span class="text-mil-greenMuted">${icone(CARGAS[k].icone)}</span> ${CARGAS[k].nome} <span class="text-mil-textMuted">+${CARGAS[k].qtd}</span></span>
                        <button id="btn-carga-${k}" onclick="requestSupport('SUPPLY', '${k}')" class="px-2 py-1 btn-tactical rounded font-bold text-xs whitespace-nowrap"></button>
                    </div>`).join('');
            }
            const cargas = cargasACaminho();
            Object.keys(CARGAS).forEach(k => {
                const btn = document.getElementById('btn-carga-' + k);
                const aCaminho = !!cargas[k];
                const texto = aCaminho ? `A CAMINHO ${seg(cargas[k])}s` : `${custo(CARGAS[k].custo)} PTS`;
                if (btn.textContent !== texto) btn.textContent = texto;
                btn.disabled = aCaminho;
                btn.classList.toggle('opacity-60', aCaminho);
            });
        }

        // Entrega cada item quando a contagem dele chega a zero
        function processPendingSupply() {
            const cargas = cargasACaminho();
            Object.keys(cargas).forEach(item => {
                cargas[item]--;
                if (cargas[item] > 0) return;
                delete cargas[item];
                const c = CARGAS[item];
                const recebida = supplyReceivers() > 0 ? 1 : 0.5;
                const qtd = Math.floor(c.qtd * recebida);
                let real = qtd;
                if (item === 'ammoRifle') real = addAmmoRifle(qtd);
                else if (item === 'ammoHeavy') real = addAmmoHeavy(qtd);
                else gameState.resources[item] += qtd;
                if (recebida < 1) {
                    logFeed(`📦 Carga de ${c.nome.toLowerCase()} chegou sem ninguém para descarregar: metade se perdeu (+${real} ${c.unidade}).`, 'text-red-400 font-bold');
                } else {
                    logFeed(`📦 CARGA EMERGENCIAL ENTREGUE: +${real} ${c.unidade}${real < qtd ? ' (paiol cheio)' : ''}.`, 'text-mil-amberMuted font-bold');
                }
            });
        }

        // Contra-bateria a caminho: se chegar antes do impacto, cancela o bombardeio
        function processCounterBattery() {
            if (!gameState.counterBattery) return;
            gameState.counterBattery.ticks--;
            if (gameState.counterBattery.ticks > 0) return;
            gameState.counterBattery = null;
            if (gameState.barrage) {
                gameState.barrage = null;
                logFeed('💥 CONTRA-BATERIA: a artilharia inimiga foi silenciada antes de disparar!', 'text-mil-greenMuted font-bold');
                if (gameState.general) lembrar('contraBateria', 1, 0.3);
            } else {
                logFeed('💥 A contra-bateria chegou tarde: o bombardeio já tinha caído.', 'text-mil-amberMuted');
            }
        }

        // Contagem regressiva e impactos da artilharia inimiga
        // Depósito de mantimentos: artilharia e drones podem destruir parte das rações e da água
        const DEPOSITO = {
            ARTILHARIA_CHANCE: 0.2,          // chance de cada projétil mirar o depósito
            DRONE_GUIANDO: 2,                // com drone observando, o dobro de chance
            ARTILHARIA_PERDA: [0.08, 0.14],  // fração perdida por projétil que acerta (mínimo, máximo)
            NINHO_CHANCE: 0.15,              // chance de cada projétil mirar um ninho de defesa pronto
            NINHO_DANO: 35,                  // pontos de obra que o ninho perde
            DRONE_CHANCE: 0.35,              // por ataque de drone
            DRONE_PERDA: [0.06, 0.12]
        };
        const ABRIGO_SUBTERRANEO = 0.3; // soldado marcado que está em Descanso leva só 30% do dano

        // Escolhe no aviso o alvo de cada projétil: um soldado, o depósito ou um ninho pronto
        function escolherAlvosArtilharia() {
            const guiada = droneObservando();
            const vivos = gameState.squad.filter(s => s.hp > 0);
            const ninhos = arsenalDe().posicoes.map((p, i) => ({ p, i })).filter(x => x.p.obra >= 100);
            const alvos = [];
            for (let k = 0; k < BARRAGE_SHOTS; k++) {
                const r = Math.random();
                const chDep = DEPOSITO.ARTILHARIA_CHANCE * (guiada ? DEPOSITO.DRONE_GUIANDO : 1);
                if (r < chDep || !vivos.length) alvos.push({ tipo: 'deposito' });
                else if (ninhos.length && r < chDep + DEPOSITO.NINHO_CHANCE) alvos.push({ tipo: 'ninho', i: ninhos[Math.floor(Math.random() * ninhos.length)].i });
                else alvos.push({ tipo: 'soldado', id: vivos[Math.floor(Math.random() * vivos.length)].id });
            }
            return alvos;
        }
        function nomeDoAlvo(a) {
            if (a.tipo === 'deposito') return 'depósito de mantimentos';
            if (a.tipo === 'ninho') return `ninho (${arsenalDe().posicoes[a.i].nome.toLowerCase()})`;
            const s = gameState.squad.find(m => m.id === a.id);
            return s ? `${s.rank} ${s.name}` : 'trincheira';
        }
        const soldadoMarcado = (s) => !!(gameState.barrage && (gameState.barrage.alvos || []).some(a => a.tipo === 'soldado' && a.id === s.id));

        function atingirDeposito(fonte, [min, max]) {
            const r = gameState.resources;
            const f = min + Math.random() * (max - min);
            const perdaR = Math.round(r.rations * f * 10) / 10, perdaA = Math.round(r.water * f * 10) / 10;
            r.rations = Math.max(0, r.rations - perdaR);
            r.water = Math.max(0, r.water - perdaA);
            impacto('deposito');
            cenaEfeito('explosao', { comodo: 'deposito' }); cenaEfeito('fogo', { comodo: 'deposito' });
            logFeed(`🔥 ${fonte} atingiu o depósito de mantimentos! Perdidos ${perdaR.toFixed(1)} rações e ${perdaA.toFixed(1)} L de água.`, 'text-red-400 font-bold');
        }

        function processBarrage() {
            if (!gameState.barrage) return;
            gameState.barrage.ticks--;
            if (gameState.barrage.ticks > 0) return;
            gameState.barrage_alvos = gameState.barrage.alvos || [];
            gameState.barrage = null;

            if (gameState.general) {
                lembrar('abrigo', gameState.tacticalOrders.SHELTER ? 1 : 0, 0.3);
                lembrar('contraBateria', 0, 0.3);
            }
            const observada = droneObservando();
            if (observada) logFeed('🛸 O drone inimigo guiou o bombardeio: impactos mais precisos!', 'text-red-500 font-bold');
            // Alvos anunciados no aviso (salvamento antigo sem alvos: sorteia agora)
            const alvos = (gameState.barrage_alvos || []).length ? gameState.barrage_alvos : escolherAlvosArtilharia();
            delete gameState.barrage_alvos;
            alvos.slice(0, BARRAGE_SHOTS).forEach(a => {
                trenchDamage(TRENCH.DAMAGE_BARRAGE, 'o bombardeio');
                impacto('artilharia');
                if (a.tipo === 'deposito') { atingirDeposito('Um projétil de artilharia', DEPOSITO.ARTILHARIA_PERDA); return; }
                if (a.tipo === 'ninho') {
                    cenaEfeito('explosao', { comodo: 'ninhos' });
                    const pn = arsenalDe().posicoes[a.i];
                    if (pn.obra > 0) {
                        const tinha = pn.obra >= 100;
                        pn.obra = Math.max(0, pn.obra - DEPOSITO.NINHO_DANO);
                        lastDefSignature = '';
                        logFeed(`💥 Artilharia atingiu o ninho (${pn.nome})${tinha ? ': arma parada até reparar na aba Defesas' : ''}.`, 'text-red-400 font-bold');
                    }
                    return;
                }
                const alvo = gameState.squad.find(m => m.id === a.id);
                cenaEfeito('explosao', alvo && alvo.hp > 0 ? { soldado: a.id } : { comodo: 'posto' });
                if (!alvo || alvo.hp <= 0) return; // já caído: o projétil só revolve a trincheira
                let dano = BARRAGE_DAMAGE * diff().enemyDmgMult * PRESSURE.ENEMY_DAMAGE * (observada ? DRONE_SPOT_ARTILLERY : 1);
                if (gameState.tacticalOrders.SHELTER) dano *= shelterMult();
                const noAbrigo = alvo.duty === 'REST';
                if (noAbrigo) dano *= ABRIGO_SUBTERRANEO;
                alvo.hp = Math.max(0, alvo.hp - dano);
                perdaMoral(alvo, 2);
                marcarFerido(alvo);
                numeroNaCena({ soldado: alvo.id }, '-' + Math.max(1, Math.round(dano)), '#ffb347', 12);
                if (alvo.hp <= 0) {
                    logFeed(`❌ BAIXA NO BOMBARDEIO: ${alvo.rank} ${alvo.name} foi morto!`, 'text-red-500 font-bold');
                    impacto('morte');
                } else if (noAbrigo) {
                    logFeed(`🛡️ ${alvo.rank} ${alvo.name} estava no abrigo: ferimento leve.`, 'text-mil-greenMuted');
                }
            });
            logFeed('💥 Bombardeio inimigo concluído.', 'text-red-400');
        }

        // Embaralha uma cópia da lista com chance igual para cada ordem (Fisher-Yates).
        // Substitui o antigo sort(() => Math.random() - 0.5), que não era uniforme e dependia do navegador.
        function embaralhar(lista) {
            const a = lista.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        /* ===== Combate: um passo de 1 segundo de jogo =====
           As funções abaixo recebem o estado da partida (`estado`, que é o gameState)
           em vez de mexer no global direto; assim dá para testar cada parte isolada. */

