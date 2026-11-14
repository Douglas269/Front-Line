// FrontLine · Rádio, fim de jogo, conta, tutorial, atualização e início do jogo
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           RADIO SUPPORT ACTIONS
           ========================================================================== */
        function radioOcupado() {
            if (!gameState.tacticalOrders.SIGNAL_JAM) return false;
            logFeed('📡 Rádio ocupado com o Bloqueio de Sinal. Desligue o bloqueio para falar com a Central.', 'text-mil-amberMuted');
            return true;
        }

        function sendIntelReport() {
            if (radioOcupado()) return;
            if (gameState.lastIntelDay === gameState.day) {
                logFeed('Relatório de hoje já foi transmitido. Próximo envio disponível amanhã.', 'text-mil-amberMuted');
                return;
            }
            gameState.lastIntelDay = gameState.day;
            gameState.prestige += ganho(50);
            logFeed(`Relatório de patrulha transmitido ao Comando Geral (+${ganho(50)} Prestígio).`, 'text-mil-greenMuted');
            updateUI();
            playTacticalBeep(900, 0.05);
        }

        function requestSupport(type, item) {
            if (radioOcupado()) return;
            if (type === 'COUNTER') {
                if (!gameState.barrage) return logFeed('Nenhuma artilharia inimiga detectada para contra-bateria.', 'text-mil-amberMuted');
                if (gameState.counterBattery) return logFeed('A contra-bateria já está a caminho.', 'text-mil-amberMuted');
                if (gameState.recargaContra > 0) return logFeed(`A artilharia da Central está recarregando: contra-bateria disponível em ${seg(gameState.recargaContra)}s.`, 'text-mil-amberMuted');
                if (gameState.prestige < custo(50)) return logFeed('Prestígio insuficiente para contra-bateria!', 'text-red-400');
                gameState.prestige -= custo(50);
                // Apoio da Central (2d5): tempo de resposta
                const rolagem = (1 + Math.floor(Math.random() * 5)) + (1 + Math.floor(Math.random() * 5));
                // 2d5 × 4 ticks = 1 a 5 s reais
                gameState.counterBattery = { ticks: rolagem * 4 };
                const aTempo = gameState.counterBattery.ticks < gameState.barrage.ticks;
                logFeed(`💥 Contra-bateria pedida (2d5 = ${rolagem}: chega em ${seg(gameState.counterBattery.ticks)}s; impacto inimigo em ${seg(gameState.barrage.ticks)}s)${aTempo ? '.' : ': pode chegar tarde!'}`, 'text-mil-amberMuted font-bold');
            }

            if (type === 'ARTILLERY') {
                if (gameState.prestige < custo(100)) return logFeed('Prestígio insuficiente para Artilharia!', 'text-red-400');
                if (gameState.enemies.length === 0) return logFeed('Nenhum alvo identificado no setor.', 'text-mil-amberMuted');
                gameState.prestige -= custo(100);
                // Dano pesado em todos os inimigos (não apaga ondas inteiras de uma vez)
                const antes = gameState.enemies.length;
                gameState.enemies.forEach(en => { en.hp -= ARTILLERY_SUPPORT_DAMAGE; });
                gameState.enemies = gameState.enemies.filter(en => en.hp > 0);
                const abatidos = antes - gameState.enemies.length;
                logFeed(`💣 FOGO DE ARTILHARIA EXECUTADO! ${abatidos} de ${antes} inimigos abatidos${gameState.enemies.length ? `; ${gameState.enemies.length} ainda avançam feridos` : '. Setor limpo'}.`, 'text-mil-greenMuted font-bold');
            }

            if (type === 'MEDEVAC') {
                if (gameState.prestige < custo(150)) return logFeed('Prestígio insuficiente para MedEvac!', 'text-red-400');
                if (gameState.supplyLineEff < 30) return logFeed('Linha de suprimento bloqueada para evacuação.', 'text-red-400');
                const wounded = gameState.squad.filter(s => s.hp > 0 && s.hp < 100).sort((a, b) => a.hp - b.hp)[0];
                if (!wounded) return logFeed('Nenhum ferido para evacuar.', 'text-mil-amberMuted');
                gameState.prestige -= custo(150);
                wounded.hp = 100;
                wounded.fatigue = 0;
                logFeed(`🚑 EVACUAÇÃO MÉDICA: ${wounded.rank} ${wounded.name} recuperado.`, 'text-blue-400 font-bold');
            }

            if (type === 'SUPPLY') {
                // Um item por pedido (rations, water, ammoRifle, ammoHeavy)
                pedirCarga(item);
            }

            updateUI();
            playTacticalBeep(850, 0.05);
        }

        /* ==========================================================================
           WIN / LOSS CHECK
           ========================================================================== */
        function endGame(icon, title, titleClass, body) {
            gameEnded = true;
            const venceu = gameState.day > GAME_CONFIG.TOTAL_DAYS;
            somarCarreira({ partidas: 1, vitorias: venceu ? 1 : 0, derrotas: venceu ? 0 : 1, melhorDia: Math.min(gameState.day, GAME_CONFIG.TOTAL_DAYS) }, true);
            stopAllAudio();
            clearSave();
            document.getElementById('end-icon').innerHTML = icon;
            document.getElementById('end-title').textContent = title;
            document.getElementById('end-title').className = `text-xl font-bold tracking-wider mb-2 ${titleClass}`;
            document.getElementById('end-body').textContent = body;
            try { document.getElementById('end-relatorio').innerHTML = relatorioFinal(); } catch (e) { document.getElementById('end-relatorio').innerHTML = ''; }
            document.getElementById('modal-end').classList.remove('hidden');
        }
        // Relatório da operação: números do que aconteceu e o destaque do esquadrão
        function relatorioFinal() {
            const sv = gameState.squad;
            const tot = sv.reduce((a, m) => { const st = m.stats || { tiros: 0, acertos: 0, abates: 0 }; a.tiros += st.tiros; a.acertos += st.acertos; a.abates += st.abates; return a; }, { tiros: 0, acertos: 0, abates: 0 });
            const vivos = sv.filter(m => m.hp > 0).length;
            const destaque = sv.slice().sort((a, b) => ((b.stats && b.stats.abates) || 0) - ((a.stats && a.stats.abates) || 0))[0];
            const medalhas = sv.reduce((a, m) => a + (m.medalhas || []).length, 0);
            const linha = (rot, v) => `<div class="flex justify-between border-b border-mil-borderDark py-0.5"><span class="text-mil-textMuted">${rot}</span><span class="text-mil-textGlow font-bold">${v}</span></div>`;
            return `<div class="bg-mil-panel border border-mil-border rounded p-2">
                <div class="text-mil-amberMuted font-bold mb-1">RELATÓRIO DA OPERAÇÃO</div>
                ${linha('Dias de resistência', Math.min(gameState.day, GAME_CONFIG.TOTAL_DAYS) + ' de ' + GAME_CONFIG.TOTAL_DAYS)}
                ${linha('Soldados vivos', vivos + ' de ' + sv.length)}
                ${linha('Inimigos abatidos', tot.abates)}
                ${linha('Tiros / acertos', tot.tiros + ' / ' + tot.acertos + (tot.tiros ? ' (' + Math.round(100 * tot.acertos / tot.tiros) + '%)' : ''))}
                ${linha('Condecorações', medalhas)}
                ${destaque && destaque.stats && destaque.stats.abates ? linha('Destaque', destaque.rank + ' ' + destaque.name + ' · ' + destaque.stats.abates + ' abates') : ''}
                ${linha('Dificuldade', (MODOS_DIFICULDADE[CONFIG.dificuldade] || MODOS_DIFICULDADE.soldado).nome + ' · nível ' + gameState.level)}
            </div>`;
        }

        function checkWinLoss() {
            if (gameEnded) return;
            const alive = gameState.squad.filter(s => s.hp > 0).length;

            if (alive === 0) {
                gameEnded = true;
                endGame('💀', 'POSIÇÃO PERDIDA', 'text-red-600',
                    `Todo o esquadrão pereceu no Dia ${gameState.day}. O Ponto Alpha foi tomado pelas tropas da Federação Norte. Nível ${gameState.level}: tente de novo.`);
                return;
            }

            if (gameState.day > GAME_CONFIG.TOTAL_DAYS) {
                gameEnded = true;
                const nivel = gameState.level;
                const proximo = Math.min(MAX_LEVEL, nivel + 1);
                saveLevel(proximo);
                endGame(`<img src="${musicBase}assets/medals/${medalhaDaVitoria(nivel)}" alt="Medalha" class="mx-auto" style="height:96px;image-rendering:pixelated">`, 'VITÓRIA DA REPÚBLICA', 'text-mil-greenMuted',
                    `Você manteve a trincheira Alpha por 30 dias no nível ${nivel}! ` +
                    (nivel < MAX_LEVEL ? `Próxima operação: nível ${proximo}, mais difícil.` : 'Você venceu o nível máximo.') +
                    (() => { const m = MODIFICADORES.find(x => x.nivel === proximo); return m && nivel < MAX_LEVEL ? ` Novidade no nível ${proximo}: ${m.nome}. ${m.desc}` : ''; })());
            }
        }

        /* ==========================================================================
           CONTA E NUVEM (Supabase): login por e-mail e senha, ou convidado
           O salvamento continua no aparelho e é espelhado na tabela "saves".
           ========================================================================== */
        const SUPABASE_URL = 'https://shoxvekaeuynlutkowqb.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_Tjf0FceJGTPHs81jG0R-fg_ZxF9urW5'; // chave pública (segura no navegador; a tabela tem RLS)
        const MODE_KEY = 'frontline-modo'; // 'conta' ou 'convidado'
        let sb = null;
        let usuario = null;
        let loginAberto = false;
        let ultimoEnvio = 0;

        function lerLocal(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
        function gravarLocal(chave, valor) { try { localStorage.setItem(chave, valor); } catch (e) {} }

        // Tela inicial com os modos: Trincheiras (este jogo), Trincheiras online e Conquista (páginas próprias)
        let menuAberto = !document.getElementById('tela-modos').classList.contains('hidden');
        function abrirMenuModos() {
            menuAberto = true;
            document.getElementById('tela-modos').classList.remove('hidden');
        }
        function fecharMenuModos() {
            menuAberto = false;
            document.getElementById('tela-modos').classList.add('hidden');
        }
        function escolherModo(modo) {
            if (modo === 'online') { location.href = 'duelo.html'; return; }
            if (modo === 'conquista') { location.href = 'conquista.html'; return; }
            fecharMenuModos(); // Trincheiras: segue para o login (se precisar) e o jogo
        }

        function abrirLogin() {
            loginAberto = true;
            document.getElementById('tela-login').classList.remove('hidden');
            document.getElementById('login-msg').textContent = sb ? '' : 'Sem conexão com o servidor: dá para jogar sem conta.';
        }

        function fecharLogin() {
            loginAberto = false;
            document.getElementById('tela-login').classList.add('hidden');
        }

        function mostrarTutorialSePrimeiraVez() {
            if (lerLocal(TUTORIAL_KEY) !== '1') abrirTutorial();
        }

        function atualizarConta() {
            document.getElementById('lbl-conta').textContent = usuario ? (CONFIG.apelido || 'Conta') : 'Entrar';
        }

        function botaoConta() {
            if (usuario) abrirConfig('conta');
            else abrirLogin();
        }

        function traduzirErro(msg) {
            const m = (msg || '').toLowerCase();
            if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
            if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".';
            if (m.includes('not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
            if (m.includes('password') && m.includes('6')) return 'A senha precisa ter pelo menos 6 caracteres.';
            if (m.includes('rate') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
            if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.';
            return 'Não deu certo: ' + msg;
        }

        // Começo do jogo: sessão salva, convidado ou tela de login
        async function iniciarConta() {
            if (window.supabase && window.supabase.createClient) {
                sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
                try {
                    const { data } = await sb.auth.getSession();
                    if (data && data.session) {
                        usuario = data.session.user;
                        carregarDaConta();
                        atualizarConta();
                        await baixarNuvem();
                        mostrarTutorialSePrimeiraVez();
                        return;
                    }
                } catch (e) { /* sem rede: segue como convidado ou login */ }
            }
            atualizarConta();
            if (lerLocal(MODE_KEY) === 'convidado') { mostrarTutorialSePrimeiraVez(); return; }
            abrirLogin();
        }

        async function entrarNaConta(criar) {
            const msg = document.getElementById('login-msg');
            if (!sb) { msg.textContent = 'Sem conexão com o servidor agora. Use "Jogar sem conta".'; msg.className = 'text-xs text-red-400 font-normal'; return; }
            const email = document.getElementById('login-email').value.trim();
            const senha = document.getElementById('login-senha').value;
            if (!email || senha.length < 6) {
                msg.textContent = 'Preencha o e-mail e uma senha de pelo menos 6 caracteres.';
                msg.className = 'text-xs text-red-400 font-normal';
                return;
            }
            const botoes = [document.getElementById('btn-entrar'), document.getElementById('btn-criar')];
            botoes.forEach(b => { b.disabled = true; b.classList.add('opacity-60'); });
            msg.textContent = criar ? 'Criando conta...' : 'Entrando...';
            msg.className = 'text-xs text-mil-textMuted font-normal';
            try {
                const r = criar
                    ? await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin } })
                    : await sb.auth.signInWithPassword({ email, password: senha });
                if (r.error) {
                    msg.textContent = traduzirErro(r.error.message);
                    msg.className = 'text-xs text-red-400 font-normal';
                } else if (criar && !r.data.session) {
                    msg.textContent = 'Conta criada! Abra o link que enviamos para o seu e-mail e depois toque em "Entrar".';
                    msg.className = 'text-xs text-mil-greenMuted font-normal';
                } else {
                    usuario = r.data.user;
                    carregarDaConta();
                    gravarLocal(MODE_KEY, 'conta');
                    fecharLogin();
                    atualizarConta();
                    await baixarNuvem();
                    logFeed(`☁️ Conectado como ${email}. O progresso é salvo na sua conta.`, 'text-mil-greenMuted');
                    mostrarTutorialSePrimeiraVez();
                }
            } catch (e) {
                msg.textContent = 'Sem conexão com o servidor. Tente de novo ou jogue sem conta.';
                msg.className = 'text-xs text-red-400 font-normal';
            }
            botoes.forEach(b => { b.disabled = false; b.classList.remove('opacity-60'); });
        }

        function entrarComoConvidado() {
            fecharMenuModos();
            gravarLocal(MODE_KEY, 'convidado');
            fecharLogin();
            atualizarConta();
            mostrarTutorialSePrimeiraVez();
        }

        async function sairDaConta() {
            if (!await confirmarJogo({ icone: '🚪', titulo: 'Sair da conta', texto: 'Sair da conta? O progresso já está salvo nela e volta quando você entrar de novo.', ok: 'Sair' })) return;
            skipPageHideSave = true;
            await enviarNuvem(true);
            try { await sb.auth.signOut(); } catch (e) {}
            // Limpa o aparelho para o próximo jogador não herdar este progresso
            [SAVE_KEY, LEVEL_KEY, TUTORIAL_KEY, MODE_KEY, CARREIRA_KEY].forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
            location.reload();
        }

        // Sobe o salvamento local para a nuvem (no máximo a cada 30 s, a não ser que seja forçado)
        async function enviarNuvem(forcar) {
            if (!sb || !usuario) return;
            const agora = Date.now();
            if (!forcar && agora - ultimoEnvio < 30000) return;
            ultimoEnvio = agora;
            let partida = null;
            try { partida = JSON.parse(lerLocal(SAVE_KEY) || 'null'); } catch (e) {}
            try {
                const { error } = await sb.from('saves').upsert({
                    user_id: usuario.id,
                    nivel: loadLevel(),
                    partida,
                    tutorial_visto: lerLocal(TUTORIAL_KEY) === '1'
                });
                if (error) console.warn('Falha ao salvar na nuvem:', error.message);
                // A nuvem já tem o estado atual: a marca de "partida nova" não é mais necessária
                // (assim um relógio errado no celular não faz o jogo ignorar salvamentos de outro aparelho)
                else { try { localStorage.removeItem(NOVA_KEY); } catch (e) {} }
            } catch (e) { /* sem rede: tenta de novo no próximo salvamento */ }
        }

        // Baixa o salvamento da conta; fica com o mais recente entre aparelho e nuvem
        async function baixarNuvem() {
            if (!sb || !usuario) return;
            let resposta;
            try {
                resposta = await sb.from('saves').select('nivel, partida, tutorial_visto, updated_at').eq('user_id', usuario.id).maybeSingle();
            } catch (e) { resposta = { error: e }; }
            if (resposta.error) {
                logFeed('☁️ Não foi possível baixar o progresso da conta agora. Seguindo com o salvamento do aparelho.', 'text-mil-amberMuted');
                return;
            }
            const nuvem = resposta.data;
            if (nuvem) {
                let local = null;
                try { local = JSON.parse(lerLocal(SAVE_KEY) || 'null'); } catch (e) {}
                let nova = 0; try { nova = +(lerLocal(NOVA_KEY) || 0); } catch (e) {}
                const nuvemMaisNova = nuvem.partida && new Date(nuvem.updated_at).getTime() > nova && (!local || !local.savedAt || new Date(nuvem.updated_at).getTime() > local.savedAt);
                if (nuvemMaisNova) gravarLocal(SAVE_KEY, JSON.stringify(nuvem.partida));
                gravarLocal(LEVEL_KEY, String(Math.max(loadLevel(), nuvem.nivel || 1)));
                if (nuvem.tutorial_visto) gravarLocal(TUTORIAL_KEY, '1');
                // Aplica no jogo o que veio (nível e partida)
                gameState.level = loadLevel();
                document.getElementById('lbl-level').textContent = `NÍVEL ${gameState.level}`;
                if (nuvemMaisNova && loadGame()) {
                    normalizeOrders();
                    if (gameState.activeCrisis) openCrisis(gameState.activeCrisis.id, gameState.activeCrisis.ctx);
                    logFeed('☁️ Progresso da conta carregado.', 'text-mil-greenMuted');
                }
                updateClockAndUI();
                updateUI();
            }
            // Garante que a nuvem fica com a versão final (inclusive progresso de convidado)
            await enviarNuvem(true);
        }

        /* ==========================================================================
           TUTORIAL: passos curtos para quem joga pela primeira vez
           ========================================================================== */
        const TUTORIAL_KEY = 'frontline-tutorial-v1';
        const TUTORIAL = [
            { t: '🎯 Objetivo', x: 'Segure a trincheira por 30 dias. Cada dia dura 40 segundos e vira sozinho. Use o botão "Pausar" sempre que precisar pensar: pausado, nada acontece e você pode reorganizar tudo. Se o esquadrão inteiro cair, a posição está perdida. Vencer sobe o nível, e cada nível é mais difícil.' },
            { t: '🪖 Funções do esquadrão', x: 'Na aba Esquadrão, cada soldado tem uma função: Vigília (vê o inimigo e acerta melhor), Descanso (recupera fadiga e vida), Manutenção (conserta a trincheira; o Engenheiro conserta bem mais rápido) e Cozinha (o único lugar onde se come e bebe). O segredo é revezar.' },
            { t: '🍞 Fome, sede e trincheira', x: 'Fome e sede sobem o tempo todo: passe cada soldado pela Cozinha antes de chegar a 75%. A trincheira se desgasta com o tempo, a chuva e os ataques. Abaixo de 20% ela rompe, e uma invasão mata todo mundo. Veja tudo na aba Logística.' },
            { t: '🗺️ Lendo o mapa', x: 'O inimigo vem do norte (topo do mapa). Losango = infantaria, quadrado = patrulha, círculo = drone. A linha amarela é o alcance de tiro deles. O aviso vermelho em cima avisa contato ou artilharia chegando, com a contagem. A artilharia anuncia os alvos (mira vermelha no mapa): soldado marcado em Descanso fica no abrigo e leva só 30% do dano. Cada soldado tem um traço; com a moral muito baixa ele pode entrar em pânico, ficar apático ou virar herói.' },
            { t: '⚔️ Ordens táticas', x: 'Fogo Supressão: mais dano e freia o inimigo, gasta munição. Abrigo Reforçado: protege do dano (use na artilharia). Economizar: poupa munição. Vigília Total: vê tudo, cansa todos. Bloqueio de Sinal: derruba drones, mas corta o rádio. Algumas ordens se anulam.' },
            { t: '📻 Rádio e o general inimigo', x: 'Envie o relatório uma vez por dia para ganhar prestígio. Prestígio paga artilharia, evacuação, carga emergencial e contra-bateria. O general inimigo aprende o seu jeito de jogar e muda de tática: o painel dele no Rádio mostra o que ele já percebeu.' },
            { t: '🪖 A trincheira por dentro', x: 'A cena mostra a trincheira em corte: posto de vigília, ninhos, cozinha, depósito, abrigo e oficina. Cada soldado está no cômodo da sua função. Arraste o soldado para outro cômodo (ou toque nele e depois no cômodo) para trocar a função. Prefere o mapa antigo? Configurações → Jogo → Visual clássico.' },
            { t: '👀 Lendo a cena de relance', x: 'A faixa vermelha no topo diz quem está chegando e em quantos segundos entra no alcance. Os ícones acima da cabeça mostram quem está ferido, com fome, sede ou cansaço (amarelo = atenção, vermelho = crítico). Avisos importantes, como pânico e baixas, aparecem no rodapé da cena. Para mais tempo de pensar, use Pausar, ou ligue a pausa automática na artilharia em Configurações. Se estiver difícil, escolha Recruta em Configurações → Jogo → Dificuldade.' },
            { t: '🛡️ Defesas', x: 'Na aba Defesas, construa ninhos na trincheira (quem está na Manutenção trabalha na obra; o Engenheiro é mais rápido). Monte neles a metralhadora .50, o morteiro ou o anticarro e escolha um operador de vigília. A partir do dia 8 podem vir blindados: fuzil quase não fere, use o anticarro. Granadas e arame farpado também ajudam.' },
            { t: '⏩ Escala, ofensivas e pressa', x: 'A escala automática manda comer quem está com fome e descansar quem está exausto, e depois devolve cada um ao posto que você escolheu (dá para desligar em Configurações → Jogo). Quando está calmo, o botão ⏩ ao lado do Pausar acelera o tempo; no primeiro contato ele volta ao normal. Fique de olho no rádio: na véspera de uma OFENSIVA ele avisa, e no dia o inimigo vem com tudo à tarde.' },
            { t: '✅ Para começar', x: 'Um bom começo: 2 soldados de vigília, 1 na cozinha, o Engenheiro na manutenção e o resto descansando. Reveze quando a fadiga, a fome ou a sede subirem. Você pode rever este guia em "Como jogar". Boa sorte, comandante.' }
        ];

        // ===== Perfis dos soldados (só imersão: não mudam regras) =====
        const PERFIS = {
            1: { nome: 'Rafael Silva', traco: { id: 'veterano', nome: 'Veterano', desc: 'Não entra em pânico nem fica apático; perde metade da moral sob fogo.' }, idade: 38, origem: 'Curitiba (PR)', servico: '17 anos de serviço',
                 historia: 'Entrou no Exército aos 21 para fugir do balcão da padaria do pai. Lutou em duas missões de paz antes de Komona e já enterrou mais amigos do que gosta de contar. É quem acorda primeiro e dorme por último. Carrega no bolso do colete uma foto das duas filhas, dobrada tantas vezes que já quase não dá para ver o rosto delas.',
                 frase: '"Ninguém fica para trás. Nem o corpo."',
                 visual: { pele: '#c99a74', cabelo: '#3a2c22', barba: 'rala', cicatriz: true, oculos: false, cobertura: 'capacete', rugas: true } },
            2: { nome: 'Diego Santos', traco: { id: 'papo', nome: 'Bom de papo', desc: 'Quem está na mesma função que ele ganha moral.' }, idade: 29, origem: 'Salvador (BA)', servico: '8 anos de serviço',
                 historia: 'Ex-estivador do porto, aguenta a metralhadora no braço como se fosse uma saca de café. Fala alto, ri mais alto ainda e canta samba de roda nas noites de guarda até alguém mandar calar. Prometeu à mãe que voltaria para o aniversário de 60 anos dela. Faltam quatro meses.',
                 frase: '"Enquanto tiver fita, eles não passam."',
                 visual: { pele: '#7a4f33', cabelo: '#141010', barba: 'bigode', cicatriz: false, oculos: false, cobertura: 'capacete', rugas: false } },
            3: { nome: 'Lucas Ferreira', traco: { id: 'novato', nome: 'Novato', desc: 'Perde o dobro de moral sob fogo.' }, idade: 20, origem: 'Uberlândia (MG)', servico: '1 ano de serviço',
                 historia: 'O mais novo do esquadrão. Alistou-se depois que a fazenda da família foi vendida para pagar dívidas. Ainda se assusta com a artilharia e nunca conta isso a ninguém. Escreve cartas para a namorada todos os dias, mesmo sem saber se alguma delas chegou.',
                 frase: '"Sargento, é normal a mão tremer assim?"',
                 visual: { pele: '#e2b996', cabelo: '#8a5a2b', barba: 'nenhuma', cicatriz: false, oculos: false, cobertura: 'capacete', rugas: false } },
            4: { nome: 'Ana Costa', traco: { id: 'maos', nome: 'Mãos firmes', desc: 'Cura os feridos 50% mais rápido.' }, idade: 33, origem: 'Recife (PE)', servico: '6 anos de serviço',
                 historia: 'Enfermeira de pronto-socorro antes de vestir a farda. Diz que a trincheira é mais calma que plantão de sábado à noite, e ninguém sabe se ela está brincando. Conhece o tipo sanguíneo de cada um de cor. Guarda um caderno com o nome de todos que não conseguiu salvar.',
                 frase: '"Respira. Olha pra mim. Você vai ver sua família."',
                 visual: { pele: '#a8714c', cabelo: '#1e1410', barba: 'nenhuma', cicatriz: false, oculos: false, cobertura: 'boina-medica', rugas: false, coque: true } },
            5: { nome: 'Marcos Oliveira', traco: { id: 'incansavel', nome: 'Incansável', desc: 'Cansa 20% mais devagar.' }, idade: 41, origem: 'Porto Alegre (RS)', servico: '12 anos de serviço',
                 historia: 'Era mestre de obras e construiu metade de um bairro antes de ser convocado. Olha para a trincheira como quem olha para uma casa mal feita: sempre tem uma viga para escorar. Conserta rádio, fogareiro e bota furada com o mesmo canivete e uma paciência que irrita o resto do esquadrão.',
                 frase: '"Trincheira boa é a que ainda está de pé amanhã."',
                 visual: { pele: '#d9a988', cabelo: '#6b6b66', barba: 'cheia', cicatriz: false, oculos: true, cobertura: 'capacete', rugas: true } },
            6: { nome: 'Júlia Mendes', traco: { id: 'paciente', nome: 'Paciente', desc: 'Com Economizar Munição, acerta 20% mais.' }, idade: 27, origem: 'Manaus (AM)', servico: '5 anos de serviço',
                 historia: 'Aprendeu a atirar caçando com o avô no interior do Amazonas, onde errar o tiro significava não jantar. Fala pouco e observa muito. Fica horas imóvel na lama esperando o alvo certo. Anota cada disparo num caderninho com capa de couro e nunca deixou ninguém ler.',
                 frase: '"Um tiro. Só preciso de um."',
                 visual: { pele: '#b98159', cabelo: '#0f0c0a', barba: 'nenhuma', cicatriz: false, oculos: false, cobertura: 'bandana', rugas: false, pintura: true } }
        };

        // Retrato em estilo de foto de ficha militar, desenhado em SVG
        function retrato(id) {
            const v = (PERFIS[id] || PERFIS[1]).visual;
            const sombra = 'rgba(0,0,0,0.28)';
            let cob = '';
            if (v.cobertura === 'capacete') {
                cob = `<path d="M24 58 Q24 22 60 20 Q96 22 96 58 L100 62 L20 62 Z" fill="#3e4a33"/><path d="M28 50 Q60 40 92 50" stroke="#2c3524" stroke-width="3" fill="none"/><path d="M20 62 L100 62" stroke="#2a3221" stroke-width="4"/>`;
            } else if (v.cobertura === 'boina-medica') {
                cob = `<path d="M30 46 Q32 24 64 24 Q92 26 92 46 Q60 40 30 46Z" fill="#5b6447"/><rect x="54" y="29" width="12" height="12" fill="#e8e3d6"/><rect x="58" y="31" width="4" height="8" fill="#b4252a"/><rect x="56" y="33" width="8" height="4" fill="#b4252a"/>`;
            } else if (v.cobertura === 'bandana') {
                cob = `<path d="M31 44 Q34 24 60 23 Q88 24 90 44 Q60 36 31 44Z" fill="#4c5a3a"/><path d="M33 38 L45 36 M55 33 L68 34 M75 36 L87 39" stroke="#2f3a25" stroke-width="3"/>`;
            }
            const cabelo = v.coque
                ? `<path d="M33 52 Q32 30 60 29 Q88 30 87 52 Q84 40 60 38 Q36 40 33 52Z" fill="${v.cabelo}"/><circle cx="60" cy="27" r="9" fill="${v.cabelo}"/>`
                : `<path d="M34 52 Q34 32 60 31 Q86 32 86 52 Q82 42 60 41 Q38 42 34 52Z" fill="${v.cabelo}"/>`;
            let barba = '';
            if (v.barba === 'bigode') barba = `<path d="M49 83 Q60 78 71 83 Q60 81 49 83Z" fill="${v.cabelo}" stroke="${v.cabelo}" stroke-width="3"/>`;
            if (v.barba === 'rala') barba = `<path d="M38 74 Q42 98 60 101 Q78 98 82 74 Q78 92 60 94 Q42 92 38 74Z" fill="${v.cabelo}" opacity="0.45"/>`;
            if (v.barba === 'cheia') barba = `<path d="M37 70 Q40 102 60 105 Q80 102 83 70 Q80 88 70 90 Q60 84 50 90 Q40 88 37 70Z" fill="${v.cabelo}"/><path d="M49 83 Q60 79 71 83" stroke="${v.cabelo}" stroke-width="4" fill="none"/>`;
            const rugas = v.rugas ? `<path d="M44 60 Q50 58 54 60 M66 60 Q70 58 76 60" stroke="${sombra}" stroke-width="1"/><path d="M41 69 L43 72 M79 69 L77 72" stroke="${sombra}" stroke-width="1"/>` : '';
            const cicatriz = v.cicatriz ? `<path d="M73 60 L80 76" stroke="#8c4e3d" stroke-width="2" stroke-linecap="round"/>` : '';
            const oculos = v.oculos ? `<g fill="none" stroke="#1a1a18" stroke-width="2"><rect x="41" y="62" width="15" height="10" rx="2"/><rect x="64" y="62" width="15" height="10" rx="2"/><path d="M56 66 L64 66"/></g>` : '';
            const pintura = v.pintura ? `<path d="M37 70 L56 66 L56 71 L38 76Z M64 66 L83 70 L82 76 L64 71Z" fill="#3c4a2c" opacity="0.75"/>` : '';
            return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" class="w-full h-full block" preserveAspectRatio="xMidYMid slice">
                <rect width="120" height="140" fill="#1d231b"/>
                <g stroke="#2b3328" stroke-width="1">${[20,40,60,80,100,120].map(y => `<path d="M0 ${y} H120"/>`).join('')}</g>
                <path d="M14 140 Q16 112 44 106 L76 106 Q104 112 106 140Z" fill="#46553a"/>
                <path d="M44 106 L60 122 L76 106" fill="#384530"/>
                <rect x="50" y="94" width="20" height="16" fill="${v.pele}"/>
                <rect x="50" y="102" width="20" height="5" fill="${sombra}"/>
                <ellipse cx="60" cy="68" rx="25" ry="31" fill="${v.pele}"/>
                <ellipse cx="35" cy="70" rx="4" ry="7" fill="${v.pele}"/><ellipse cx="85" cy="70" rx="4" ry="7" fill="${v.pele}"/>
                ${cabelo}${pintura}
                <path d="M44 60 L55 59 M65 59 L76 60" stroke="#241a14" stroke-width="2.5" stroke-linecap="round"/>
                <ellipse cx="50" cy="67" rx="3" ry="2.2" fill="#1a1410"/><ellipse cx="70" cy="67" rx="3" ry="2.2" fill="#1a1410"/>
                <path d="M60 67 L57 79 L62 80" stroke="${sombra}" stroke-width="1.6" fill="none"/>
                <path d="M52 88 Q60 90 68 88" stroke="#5a3428" stroke-width="2" fill="none" stroke-linecap="round"/>
                ${rugas}${cicatriz}${barba}${oculos}${cob}
                <rect width="120" height="140" fill="#7a8a5a" opacity="0.12"/>
                <rect x="0" y="126" width="120" height="14" fill="rgba(0,0,0,0.55)"/>
                <text x="6" y="136" font-family="monospace" font-size="8" fill="#b9c4a0">FA-${String(1000 + id * 137).slice(-4)}-KMN</text>
            </svg>`;
        }

        let perfilAberto = false;
        function abrirPerfil(id) {
            const s = gameState.squad.find(x => x.id === id);
            const p = PERFIS[id];
            if (!s || !p) return;
            perfilAberto = true;
            const morto = s.hp <= 0;
            const funcoes = { WATCH: 'Vigília', REST: 'Descanso', MAINTENANCE: 'Manutenção', RATIONING: 'Cozinha' };
            const foto = document.getElementById('perfil-foto');
            foto.style.aspectRatio = '120 / 140';
            foto.style.filter = morto ? 'grayscale(1) brightness(0.7)' : '';
            foto.innerHTML = retrato(id) + (morto ? `<div class="absolute inset-0 flex items-center justify-center"><span class="text-red-500 border-2 border-red-500 font-bold text-[11px] px-1 rotate-[-18deg] bg-black/60">${s.deserted ? 'DESERTOR' : 'KIA'}</span></div>` : '');
            document.getElementById('perfil-nome').textContent = `${s.rank} ${p.nome}`;
            document.getElementById('perfil-classe').textContent = s.class;
            document.getElementById('perfil-dados').innerHTML = `${p.idade} anos · ${p.origem}<br>${p.servico}`;
            const est = document.getElementById('perfil-estado');
            if (morto) { est.className = 'text-xs font-bold text-red-500'; est.textContent = s.deserted ? 'Abandonou a posição' : 'Morto em ação'; }
            else { est.className = 'text-xs font-bold text-mil-greenMuted'; est.textContent = `Na linha · ${funcoes[s.duty] || s.duty} · HP ${Math.round(s.hp)}% · Moral ${Math.round(s.moral)}%`; }
            const st = statsDe(s);
            document.getElementById('perfil-dados').innerHTML += `<br>Em combate: ${st.tiros} tiros · ${st.acertos} acertos${st.tiros ? ` (${Math.round(100 * st.acertos / st.tiros)}%)` : ''} · ${st.abates} abates`;
            document.getElementById('perfil-dados').innerHTML += `<br><span class="text-mil-amberMuted">Traço: ${p.traco.nome}</span> — ${p.traco.desc}`;
            document.getElementById('perfil-dados').innerHTML += (s.medalhas || []).length ? `<div class="mt-1 flex gap-1 items-end">${s.medalhas.map(id => imgMedalha(id, 30)).join('')}</div>` : '';
            document.getElementById('perfil-historia').textContent = p.historia;
            document.getElementById('perfil-frase').textContent = p.frase;
            document.getElementById('modal-perfil').classList.remove('hidden');
            playTacticalBeep(700, 0.02);
        }
        function fecharPerfil() {
            perfilAberto = false;
            document.getElementById('modal-perfil').classList.add('hidden');
        }

        let tutorialAberto = false;
        let tutorialPasso = 0;

        function abrirTutorial() {
            tutorialAberto = true;
            tutorialPasso = 0;
            mostrarPassoTutorial();
            document.getElementById('modal-tutorial').classList.remove('hidden');
        }

        function mostrarPassoTutorial() {
            const passo = TUTORIAL[tutorialPasso];
            document.getElementById('tut-title').textContent = passo.t;
            document.getElementById('tut-text').textContent = passo.x;
            document.getElementById('tut-step').textContent = `${tutorialPasso + 1}/${TUTORIAL.length}`;
            const voltar = document.getElementById('tut-back');
            voltar.disabled = tutorialPasso === 0;
            voltar.classList.toggle('opacity-40', tutorialPasso === 0);
            document.getElementById('tut-next').textContent = tutorialPasso === TUTORIAL.length - 1 ? 'Começar' : 'Próximo';
        }

        function passoTutorial(delta) {
            const novo = tutorialPasso + delta;
            if (novo >= TUTORIAL.length) return fecharTutorial();
            if (novo < 0) return;
            tutorialPasso = novo;
            mostrarPassoTutorial();
        }

        function fecharTutorial() {
            tutorialAberto = false;
            document.getElementById('modal-tutorial').classList.add('hidden');
            try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) {}
            enviarNuvem(true);
        }

        // Nível atual (fica salvo mesmo entre partidas)
        if (!gameState.arsenal) gameState.arsenal = novoArsenal(); // criado aqui porque novoArsenal fica em 03-defesas-crises.js
        gameState.level = loadLevel();
        gameState.general = newGeneral();
        document.getElementById('lbl-level').textContent = `NÍVEL ${gameState.level}`;

        // Restaura a partida salva, se houver, e salva ao sair da página
        // Partida nova: avisa as regras extras do nível (modificadores)
        if (!localStorage.getItem(SAVE_KEY)) {
            const mods = modificadoresAtivos();
            if (mods.length) logFeed(`⚙️ Nível ${gameState.level}: ${mods.map(m => m.nome).join(', ')}. Detalhes em Configurações → Jogo.`, 'text-mil-amberMuted font-bold');
        }
        if (loadGame()) {
            normalizeOrders();
            alternarPausa(true);
            logFeed('Partida restaurada do último salvamento (pausada: toque em Continuar).', 'text-mil-greenMuted');
            // Crise que estava aberta volta a aparecer
            if (gameState.activeCrisis) openCrisis(gameState.activeCrisis.id, gameState.activeCrisis.ctx);
        }
        window.addEventListener('pagehide', () => { if (!gameEnded && !skipPageHideSave) saveGame(); });
        // Saiu do app ou trocou de aba: pausa sozinho
        document.addEventListener('visibilitychange', () => { if (document.hidden && !gameEnded) alternarPausa(true); });

        /* ==========================================================================
           APP INSTALÁVEL: service worker e botão de instalar
           ========================================================================== */

        /* ===== Atualização obrigatória =====
           VERSAO_JOGO é a versão deste arquivo; o site publica a mais nova em versao.json.
           Ao abrir, ao voltar para o app e a cada minuto o jogo compara as duas. Se o site
           tiver uma versão diferente, o jogo trava numa tela que só sai atualizando.
           (tools/nova-versao.sh troca as duas juntas a cada atualização publicada.) */
        const VERSAO_JOGO = '20261114.1306';
        const ATUALIZOU_KEY = 'frontline-atualizou-para';
        async function verificarVersao() {
            if (!location.protocol.startsWith('http') || atualizacaoPendente) return;
            let nova;
            try {
                const r = await fetch('versao.json?t=' + Date.now(), { cache: 'no-store' });
                if (!r.ok) return;
                nova = (await r.json()).versao;
            } catch (e) { return; } // sem internet: segue jogando a versão que tem
            tratarVersaoDoSite(nova);
        }
        // Decide se trava o jogo na tela de atualização (separado da busca para dar para testar)
        function tratarVersaoDoSite(nova) {
            if (atualizacaoPendente) return;
            if (!nova || nova === VERSAO_JOGO) { try { sessionStorage.removeItem(ATUALIZOU_KEY); } catch (e) {} return; }
            // Já recarregou para essa versão e o navegador ainda entregou a antiga: não trava de novo em loop
            let jaTentou = null;
            try { jaTentou = sessionStorage.getItem(ATUALIZOU_KEY); } catch (e) {}
            if (jaTentou === nova) return;
            atualizacaoPendente = true;
            if (!gameEnded) saveGame();
            document.getElementById('lbl-versao-nova').textContent = `Versão ${VERSAO_JOGO} → ${nova}`;
            document.getElementById('modal-atualizacao').classList.remove('hidden');
            window.__versaoNova = nova;
        }
        async function atualizarAgora() {
            const btn = document.getElementById('btn-atualizar');
            btn.disabled = true; btn.textContent = 'Atualizando...';
            try { sessionStorage.setItem(ATUALIZOU_KEY, window.__versaoNova || ''); } catch (e) {}
            if (!gameEnded) saveGame();
            skipPageHideSave = true;
            // Apaga as cópias guardadas pelo app instalado e pede a versão nova ao site
            try { if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) {}
            try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); } catch (e) {}
            const url = new URL(location.href);
            url.searchParams.set('v', window.__versaoNova || Date.now());
            location.replace(url.toString());
        }
        aplicarConfig(); // volumes, texto maior e nome de comandante salvos
        verificarVersao();
        setInterval(verificarVersao, 60000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarVersao(); });

        if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
            window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
        }

        let installPrompt = null;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            installPrompt = e;
            document.getElementById('btn-install').classList.remove('hidden');
        });

        function instalarApp() {
            if (!installPrompt) return;
            installPrompt.prompt();
            installPrompt.userChoice.finally(() => {
                installPrompt = null;
                document.getElementById('btn-install').classList.add('hidden');
            });
        }

        window.addEventListener('appinstalled', () => {
            document.getElementById('btn-install').classList.add('hidden');
            logFeed('📲 FrontLine instalado no aparelho.', 'text-mil-greenMuted');
        });

        // iPhone não oferece o botão de instalar: mostra o caminho manual
        const rodandoInstalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !rodandoInstalado) {
            document.getElementById('hint-ios').classList.remove('hidden');
        }
        // Começo: conta (login, convidado ou sessão salva) e, depois, o tutorial na primeira vez
        iniciarConta();
        updateClockAndUI();
        updateUI();

        // Liga o relógio do jogo e o desenho da cena só depois de todos os arquivos carregados
        requestAnimationFrame(renderMap);
        const relogioId = setInterval(passoDoRelogio, GAME_CONFIG.UPDATE_INTERVAL_MS);
