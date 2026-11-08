// FrontLine · Defesas, armas pesadas e crises
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           DEFESAS: pontos defensivos, armas pesadas e inventário
           - 3 pontos na trincheira. Cada um precisa ser construído (quem está na
             Manutenção trabalha na obra; o Engenheiro é 3× mais rápido).
           - Num ponto pronto monta-se uma arma do paiol e escolhe-se um operador.
             O operador precisa estar de Vigília; enquanto opera, não usa o fuzil.
           - Metralhadora .50: gasta munição pesada. Morteiro: fogo indireto em grupos.
             Anticarro: só contra blindados. Granadas: automáticas a menos de 25 m.
             Arame farpado: segura o avanço a 50 m até se desgastar.
           - O comboio traz extras conforme a disponibilidade do QG; dá para
             requisitar com prestígio (chega no próximo comboio).
           ========================================================================== */
        const EQUIP = {
            metralhadora: { nome: 'Metralhadora .50', sigla: 'MG', icone: 'machine-gun', desc: 'Gasta munição pesada (~2 por segundo)' },
            morteiro:     { nome: 'Morteiro 60 mm', sigla: 'MRT', icone: 'mortar', desc: 'Fogo indireto de 60 a 300 m, atinge grupos' },
            lancaAT:      { nome: 'Lança-rojão anticarro', sigla: 'AT', icone: 'rocket', desc: 'Dispara só em blindados até 200 m' }
        };
        const MUNICOES = {
            granadaMorteiro: { nome: 'Granadas de morteiro', icone: 'artillery-shell' },
            foguetesAT:      { nome: 'Foguetes anticarro', icone: 'rocket-flight' },
            granadas:        { nome: 'Granadas de mão', icone: 'grenade' },
            arame:           { nome: 'Rolos de arame farpado', icone: 'barbed-wire' }
        };
        const DEF = {
            OBRA_SOLDADO: 4, OBRA_ENGENHEIRO: 12,            // pontos de obra por ciclo de 10 s (100 = pronto)
            MG: { cadencia: 0.5, precisao: 0.25, dano: 60 }, // por segundo de jogo (4 balas por segundo real)
            MORTEIRO: { recarga: 40, dano: 110, raio: 25, acerto: 0.7, minimo: 60 },
            AT: { recarga: 48, dano: 900, acerto: 0.75, alcance: 200 },
            GRANADA: { recarga: 16, dano: 140, raio: 25, alvos: 3 },
            ARAME: { zona: 50, lentidao: 0.5, desgaste: 0.15, desgasteBlindado: 2 },
            BLINDAGEM: { fuzil: 0.15, mg: 0.35, granada: 0.3, morteiro: 0.5, at: 1 },
            BLINDADO_TRINCHEIRA: 15, BLINDADO_DANO: 35, BLINDADO_ALVOS: 2
        };
        const REQUISICOES = {
            granadas:        { qtd: 6, custo: 40,  rotulo: '6 granadas de mão' },
            granadaMorteiro: { qtd: 8, custo: 60,  rotulo: '8 granadas de morteiro' },
            foguetesAT:      { qtd: 2, custo: 80,  rotulo: '2 foguetes anticarro' },
            arame:           { qtd: 1, custo: 40,  rotulo: '1 rolo de arame' },
            metralhadora:    { qtd: 1, custo: 150, rotulo: 'Metralhadora .50' },
            morteiro:        { qtd: 1, custo: 150, rotulo: 'Morteiro 60 mm' },
            lancaAT:         { qtd: 1, custo: 120, rotulo: 'Lança-rojão AT' }
        };
        // Extras do comboio: [item, quantidade, chance]. Granadas de morteiro e foguetes anticarro vêm sempre;
        // granadas de mão e arame dependem da disponibilidade do QG
        const EXTRAS_DO_COMBOIO = [['granadas', 4, 0.6], ['granadaMorteiro', 10, 1], ['foguetesAT', 4, 1], ['arame', 1, 0.25]];

        function novoArsenal() {
            const ponto = (id, nome, x) => ({ id, nome, x, obra: 0, construindo: false, arma: null, operador: null, recarga: 0, acc: 0 });
            return {
                itens: { metralhadora: 1, morteiro: 1, lancaAT: 1, granadaMorteiro: 12, foguetesAT: 3, granadas: 10, arame: 2 },
                posicoes: [ponto('esq', 'Flanco esquerdo', 0.22), ponto('centro', 'Centro', 0.5), ponto('dir', 'Flanco direito', 0.78)],
                arame: 0, granadasLiberadas: true, recargaGranada: 0, pedidos: []
            };
        }
        const arsenalDe = (estado = gameState) => (estado.arsenal = estado.arsenal || novoArsenal());
        const blindagem = (alvo, arma) => (alvo.type === 'blindado' ? DEF.BLINDAGEM[arma] : 1);

        // Operador em condição de usar a arma do ponto (vivo e de Vigília)
        function operadorAtivo(p, estado = gameState) {
            if (p.obra < 100 || !p.arma || !p.operador) return null;
            const s = estado.squad.find(x => x.id === p.operador);
            return s && s.hp > 0 && s.duty === 'WATCH' ? s : null;
        }
        // Soldado ocupado numa arma pesada neste segundo (não usa o fuzil)
        function ocupadoNaArma(s, estado = gameState) {
            const ars = arsenalDe(estado);
            return ars.posicoes.some(p => {
                if (operadorAtivo(p, estado) !== s) return false;
                if (p.arma === 'metralhadora') return estado.resources.ammoHeavy >= PRESSURE.MG_AMMO_PER_SHOT;
                if (p.arma === 'morteiro') return ars.itens.granadaMorteiro >= 1;
                return ars.itens.foguetesAT >= 1 && estado.enemies.some(e => e.type === 'blindado' && e.distance <= DEF.AT.alcance);
            });
        }
        function temAntiTanque(estado = gameState) {
            const ars = arsenalDe(estado);
            return ars.itens.foguetesAT > 0 && ars.posicoes.some(p => p.arma === 'lancaAT' && operadorAtivo(p, estado));
        }

        function creditar(alvo, s) { if (alvo.hp <= 0 && !alvo.abatidoPor) alvo.abatidoPor = s.id; }

        function dispararDefesas(estado, alive) {
            const ars = arsenalDe(estado);
            const inimigos = () => estado.enemies.filter(e => e.hp > 0);
            if (!inimigos().length) return;
            const o = estado.tacticalOrders;
            ars.posicoes.forEach(p => {
                if (p.recarga > 0) p.recarga--;
                const op = operadorAtivo(p, estado);
                if (!op) return;
                const st = statsDe(op);
                if (p.arma === 'metralhadora') {
                    const noAlcance = inimigos().filter(e => e.distance <= TIRO.ALCANCE);
                    const semBlindagem = noAlcance.filter(e => e.type !== 'blindado');
                    const alvos = semBlindagem.length ? semBlindagem : noAlcance; // .50 prefere alvos sem blindagem
                    if (!alvos.length) return;
                    p.acc = (p.acc || 0) + DEF.MG.cadencia * (o.SHELTER ? TIRO.ABRIGO.cad : 1);
                    while (p.acc >= 1) {
                        p.acc -= 1;
                        const vivos = alvos.filter(e => e.hp > 0);
                        if (!vivos.length || estado.resources.ammoHeavy < PRESSURE.MG_AMMO_PER_SHOT) { p.acc = 0; break; }
                        const prox = vivos.reduce((a, e) => (e.distance < a.distance ? e : a), vivos[0]);
                        const alvo = Math.random() < 0.5 ? prox : vivos[Math.floor(Math.random() * vivos.length)];
                        estado.resources.ammoHeavy -= PRESSURE.MG_AMMO_PER_SHOT;
                        st.tiros++; estado.combate.tiros++;
                        if (Math.random() < 0.15) somMetralhadora();
                        if (Math.random() < chanceDeAcerto(op, DEF.MG, alvo, estado)) {
                            st.acertos++; estado.combate.acertos++;
                            alvo.hp -= DEF.MG.dano * blindagem(alvo, 'mg');
                            creditar(alvo, op);
                        }
                    }
                } else if (p.arma === 'morteiro') {
                    if (p.recarga > 0 || ars.itens.granadaMorteiro < 1) return;
                    const alvos = inimigos().filter(e => e.type !== 'drone' && e.distance >= DEF.MORTEIRO.minimo && e.distance <= TIRO.ALCANCE);
                    if (!alvos.length) return;
                    const perto = (a, e) => Math.abs(a.distance - e.distance) <= DEF.MORTEIRO.raio && Math.abs((a.offsetX || 0) - (e.offsetX || 0)) <= DEF.MORTEIRO.raio * 1.6;
                    const grupo = (a) => alvos.filter(e => perto(a, e));
                    const centro = alvos.reduce((m, a) => (grupo(a).length > grupo(m).length ? a : m), alvos[0]);
                    ars.itens.granadaMorteiro--;
                    p.recarga = DEF.MORTEIRO.recarga;
                    const acerto = chanceDeAcerto(op, { precisao: DEF.MORTEIRO.acerto }, centro, estado);
                    let atingidos = 0;
                    grupo(centro).forEach(e => {
                        if (Math.random() < acerto) { e.hp -= DEF.MORTEIRO.dano * blindagem(e, 'morteiro'); atingidos++; creditar(e, op); }
                    });
                    impacto('morteiro');
                    if (atingidos >= 2) logFeed(`💥 Morteiro atingiu ${atingidos} inimigos de uma vez!`, 'text-mil-greenMuted');
                } else if (p.arma === 'lancaAT') {
                    if (p.recarga > 0 || ars.itens.foguetesAT < 1) return;
                    const alvo = inimigos().find(e => e.type === 'blindado' && e.distance <= DEF.AT.alcance);
                    if (!alvo) return;
                    ars.itens.foguetesAT--;
                    p.recarga = DEF.AT.recarga;
                    impacto('anticarro');
                    if (Math.random() < chanceDeAcerto(op, { precisao: DEF.AT.acerto }, alvo, estado)) {
                        alvo.hp -= DEF.AT.dano * blindagem(alvo, 'at');
                        creditar(alvo, op);
                        logFeed(`🚀 ${op.rank} ${op.name} acertou o blindado com o anticarro!`, 'text-mil-greenMuted font-bold');
                    } else {
                        logFeed(`🚀 Foguete anticarro errou o blindado. Restam ${ars.itens.foguetesAT}.`, 'text-mil-amberMuted');
                    }
                }
            });

            // Granadas de mão: quem está de vigília lança nos inimigos a menos de 25 m
            if (ars.recargaGranada > 0) { ars.recargaGranada--; return; }
            if (!ars.granadasLiberadas || ars.itens.granadas < 1) return;
            const perto = inimigos().filter(e => e.type !== 'drone' && e.distance <= DEF.GRANADA.raio).sort((a, b) => a.distance - b.distance);
            const lancador = alive.find(s => s.hp > 0 && s.duty === 'WATCH' && !ocupadoNaArma(s, estado));
            if (!perto.length || !lancador) return;
            ars.itens.granadas--;
            ars.recargaGranada = DEF.GRANADA.recarga;
            perto.slice(0, DEF.GRANADA.alvos).forEach(e => { e.hp -= DEF.GRANADA.dano * blindagem(e, 'granada'); creditar(e, lancador); });
            impacto('granada');
        }

        // Arame farpado a 50 m: segura o avanço e se desgasta (blindado rasga rápido)
        function efeitoDoArame(estado, enemy) {
            const ars = arsenalDe(estado);
            if (ars.arame <= 0 || enemy.type === 'drone' || enemy.distance > DEF.ARAME.zona || enemy.distance <= 0) return 1;
            ars.arame = Math.max(0, ars.arame - (enemy.type === 'blindado' ? DEF.ARAME.desgasteBlindado : DEF.ARAME.desgaste));
            if (ars.arame <= 0) logFeed('🪢 O arame farpado foi destruído.', 'text-mil-amberMuted');
            return enemy.type === 'blindado' ? 1 : DEF.ARAME.lentidao;
        }

        // Blindado chega à trincheira: esmaga parte da obra e fere quem estiver no caminho
        function blindadoNaTrincheira(estado, enemy, alive) {
            trenchDamage(DEF.BLINDADO_TRINCHEIRA, 'o blindado');
            logFeed('🚜 O BLINDADO PASSOU POR CIMA DA TRINCHEIRA!', 'text-red-500 font-bold');
            impacto('blindado');
            cenaEfeito('explosao', { comodo: 'posto' }); cenaEfeito('explosao', { comodo: 'ninhos' });
            const dano = DEF.BLINDADO_DANO * diff().enemyDmgMult * PRESSURE.ENEMY_DAMAGE;
            embaralhar(alive.filter(s => s.hp > 0)).slice(0, DEF.BLINDADO_ALVOS).forEach(s => {
                s.hp = Math.max(0, s.hp - dano);
                if (s.hp <= 0) logFeed(`❌ BAIXA NA TRINCHEIRA: ${s.rank} ${s.name} foi morto pelo blindado!`, 'text-red-500 font-bold');
            });
        }

        // Obra: soldado na Manutenção trabalha no ponto em construção. Devolve true se trabalhou.
        function trabalharNaObra(soldier) {
            const ars = arsenalDe();
            const p = ars.posicoes.find(x => x.construindo && x.obra < 100);
            if (!p) return false;
            p.obra = Math.min(100, p.obra + (soldier.class === 'Engenheiro' ? DEF.OBRA_ENGENHEIRO : DEF.OBRA_SOLDADO) * (mentalDe(soldier) === 'apatia' ? MENTAL.APATIA_RITMO : 1));
            if (p.obra >= 100) {
                p.construindo = false;
                logFeed(`🏗️ Ponto defensivo pronto: ${p.nome}. Monte uma arma na aba Defesas.`, 'text-mil-greenMuted font-bold');
                lastDefSignature = '';
            }
            return true;
        }

        function entregarArsenal(recebida) {
            const ars = arsenalDe();
            const chegou = [];
            ars.pedidos.forEach(id => { const r = REQUISICOES[id]; ars.itens[id] += r.qtd; chegou.push(r.rotulo); });
            ars.pedidos = [];
            EXTRAS_DO_COMBOIO.forEach(([id, qtd, chance]) => {
                if (Math.random() < chance) {
                    const q = Math.floor(qtd * recebida);
                    if (q > 0) { ars.itens[id] += q; chegou.push(`${q} ${MUNICOES[id].nome.toLowerCase()}`); }
                }
            });
            if (chegou.length) logFeed(`🧰 Paiol reforçado pelo comboio: ${chegou.join(', ')}.`, 'text-mil-greenMuted');
        }

        // ----- Ações da aba Defesas -----
        function construirPonto(i) {
            const ars = arsenalDe();
            const p = ars.posicoes[i];
            if (!p || p.obra >= 100 || p.construindo) return;
            if (ars.posicoes.some(x => x.construindo)) return logFeed('Já há um ponto defensivo em obra. Termine aquele primeiro.', 'text-mil-amberMuted');
            p.construindo = true;
            const naManut = gameState.squad.some(s => s.hp > 0 && s.duty === 'MAINTENANCE');
            logFeed(`🏗️ Obra iniciada: ${p.nome}. ${naManut ? 'A Manutenção vai trabalhar nela.' : 'Coloque alguém na Manutenção para a obra andar.'}`, 'text-mil-amberMuted');
            updateUI(); playTacticalBeep(700, 0.03);
        }
        function montarArma(i, arma) {
            const ars = arsenalDe();
            const p = ars.posicoes[i];
            if (!p || p.obra < 100 || p.arma || ars.itens[arma] < 1) return;
            ars.itens[arma]--;
            p.arma = arma; p.recarga = 0; p.acc = 0;
            // Sugere o operador natural: o Metralhador na .50, senão ninguém (o jogador escolhe)
            const ocupados = ars.posicoes.map(x => x.operador);
            const sugerido = arma === 'metralhadora' ? gameState.squad.find(s => s.hp > 0 && s.class === 'Metralhador' && !ocupados.includes(s.id)) : null;
            p.operador = sugerido ? sugerido.id : null;
            logFeed(`🔧 ${EQUIP[arma].nome} montada: ${p.nome}.`, 'text-mil-greenMuted');
            updateUI(); playTacticalBeep(750, 0.03);
        }
        function desmontarArma(i) {
            const ars = arsenalDe();
            const p = ars.posicoes[i];
            if (!p || !p.arma) return;
            ars.itens[p.arma]++;
            p.arma = null; p.operador = null;
            updateUI(); playTacticalBeep(650, 0.03);
        }
        function definirOperador(i, id) {
            const ars = arsenalDe();
            const p = ars.posicoes[i];
            if (!p || !p.arma) return;
            const n = Number(id) || null;
            if (n) ars.posicoes.forEach(x => { if (x !== p && x.operador === n) x.operador = null; });
            p.operador = n;
            updateUI(); playTacticalBeep(750, 0.02);
        }
        function alternarGranadas() {
            const ars = arsenalDe();
            ars.granadasLiberadas = !ars.granadasLiberadas;
            updateUI(); playTacticalBeep(750, 0.02);
        }
        function estenderArame() {
            const ars = arsenalDe();
            if (ars.itens.arame < 1) return;
            ars.itens.arame--;
            ars.arame = 100;
            logFeed('🪢 Arame farpado estendido a 50 m da trincheira.', 'text-mil-greenMuted');
            updateUI(); playTacticalBeep(700, 0.03);
        }
        function requisitar(id) {
            const r = REQUISICOES[id];
            if (!r) return;
            if (gameState.tacticalOrders.SIGNAL_JAM) return logFeed('Rádio ocupado pelo Bloqueio de Sinal: sem requisições.', 'text-mil-amberMuted');
            if (gameState.prestige < custo(r.custo)) return logFeed('Prestígio insuficiente!', 'text-red-400');
            gameState.prestige -= custo(r.custo);
            arsenalDe().pedidos.push(id);
            logFeed(`📦 Requisição aceita pelo QG: ${r.rotulo}. Chega no comboio do dia ${proximoComboio()}.`, 'text-mil-amberMuted');
            updateUI(); playTacticalBeep(800, 0.03);
        }

        // ----- Aba Defesas (só redesenha quando algo visível muda, para não perder o toque) -----
        let lastDefSignature = '';
        function renderDefesas() {
            const ars = arsenalDe();
            const vivos = gameState.squad.filter(s => s.hp > 0);
            const assinatura = JSON.stringify([ars.itens, ars.posicoes.map(p => [Math.floor(p.obra), p.construindo, p.arma, p.operador]), Math.ceil(ars.arame), ars.granadasLiberadas, ars.pedidos,
                vivos.map(s => [s.id, s.duty]), Math.floor(gameState.prestige / 10), Math.floor(gameState.resources.ammoHeavy), gameState.tacticalOrders.SIGNAL_JAM, gameState.day]);
            if (assinatura === lastDefSignature) return;
            lastDefSignature = assinatura;
            const naManut = vivos.filter(s => s.duty === 'MAINTENANCE').length;

            document.getElementById('def-posicoes').innerHTML = ars.posicoes.map((p, i) => {
                let corpo = '';
                if (p.arma && p.obra < 100) {
                    corpo = `<div class="text-red-400 font-bold">⚠️ Ninho danificado (${Math.floor(p.obra)}%): ${EQUIP[p.arma].nome} parada</div>` + (p.construindo
                        ? `<div class="text-mil-amberMuted">Em reparo · ${naManut ? `${naManut} na Manutenção trabalhando` : 'parado: ninguém na Manutenção'}</div><div class="h-1.5 bg-black/60 rounded mt-1"><div class="h-1.5 bg-mil-amberMuted rounded" style="width:${p.obra}%"></div></div>`
                        : `<button onclick="construirPonto(${i})" class="mt-1 w-full py-1.5 btn-tactical rounded font-bold"><span class="text-mil-amberMuted">${icone('wrench')}</span> Reparar ninho</button>`);
                } else if (p.obra < 100 && !p.construindo) {
                    corpo = `<div class="text-mil-textMuted">Terreno livre na trincheira.</div>
                        <button onclick="construirPonto(${i})" class="mt-1 w-full py-1.5 btn-tactical rounded font-bold"><span class="text-mil-amberMuted">${icone('trench-spade')}</span> Construir ninho</button>`;
                } else if (p.obra < 100) {
                    corpo = `<div class="text-mil-amberMuted">Em obra: ${Math.floor(p.obra)}% · ${naManut ? `${naManut} na Manutenção trabalhando` : 'parada: ninguém na Manutenção'}</div>
                        <div class="h-1.5 bg-black/60 rounded mt-1"><div class="h-1.5 bg-mil-amberMuted rounded" style="width:${p.obra}%"></div></div>`;
                } else if (!p.arma) {
                    const botoes = Object.keys(EQUIP).map(k => `<button onclick="montarArma(${i}, '${k}')" ${ars.itens[k] < 1 ? 'disabled' : ''} class="py-1.5 btn-tactical rounded font-bold ${ars.itens[k] < 1 ? 'opacity-40' : ''}">${EQUIP[k].sigla} (${ars.itens[k]})</button>`).join('');
                    corpo = `<div class="text-mil-greenMuted">Ninho pronto. Monte uma arma do paiol:</div><div class="grid grid-cols-3 gap-1 mt-1">${botoes}</div>`;
                } else {
                    const eq = EQUIP[p.arma];
                    const op = gameState.squad.find(s => s.id === p.operador);
                    let estado = 'Pronta para atirar', cor = 'text-mil-greenMuted';
                    if (!op || op.hp <= 0) { estado = 'Sem operador: arma parada'; cor = 'text-red-400'; }
                    else if (op.duty !== 'WATCH') { estado = 'Operador fora da Vigília: arma parada'; cor = 'text-red-400'; }
                    else if (p.arma === 'metralhadora' && gameState.resources.ammoHeavy < 1) { estado = 'Sem munição pesada'; cor = 'text-red-400'; }
                    else if (p.arma === 'morteiro' && ars.itens.granadaMorteiro < 1) { estado = 'Sem granadas de morteiro'; cor = 'text-red-400'; }
                    else if (p.arma === 'lancaAT' && ars.itens.foguetesAT < 1) { estado = 'Sem foguetes anticarro'; cor = 'text-red-400'; }
                    const opcoes = `<option value="">— sem operador —</option>` + vivos.map(s => `<option value="${s.id}" ${s.id === p.operador ? 'selected' : ''}>${s.rank} ${s.name} (${s.class})</option>`).join('');
                    corpo = `<div class="flex justify-between items-center"><span class="text-mil-textGlow font-bold"><span class="text-mil-amberMuted">${icone(eq.icone)}</span> ${eq.nome}</span>
                            <button onclick="desmontarArma(${i})" class="underline text-mil-textMuted">Desmontar</button></div>
                        <div class="text-mil-textMuted">${eq.desc}</div>
                        <div class="${cor} font-bold">${estado}</div>
                        <label class="flex items-center gap-2 mt-1"><span class="text-mil-textMuted">Operador:</span>
                            <select onchange="definirOperador(${i}, this.value)" class="flex-1 bg-black/60 border border-mil-border rounded px-1 py-1 text-mil-textGlow">${opcoes}</select></label>`;
                }
                return `<div class="bg-mil-bg border border-mil-border p-2 rounded space-y-0.5"><div class="text-mil-amberMuted font-bold uppercase">${p.nome}</div>${corpo}</div>`;
            }).join('');

            const celula = (ic, nome, valor) => `<div class="bg-mil-bg border border-mil-border p-2 rounded flex justify-between items-center gap-1"><span class="text-mil-textMuted"><span class="text-mil-greenMuted">${icone(ic)}</span> ${nome}</span><span class="font-bold text-mil-textGlow">${valor}</span></div>`;
            document.getElementById('def-inventario').innerHTML =
                Object.keys(EQUIP).map(k => celula(EQUIP[k].icone, EQUIP[k].nome, ars.itens[k])).join('') +
                celula('heavy-bullets', 'Munição pesada', Math.floor(gameState.resources.ammoHeavy)) +
                Object.keys(MUNICOES).map(k => celula(MUNICOES[k].icone, MUNICOES[k].nome, ars.itens[k])).join('');

            document.getElementById('def-extras').innerHTML = `
                <div class="bg-mil-bg border border-mil-border p-2 rounded flex justify-between items-center gap-2">
                    <div><div class="text-mil-textGlow font-bold">Granadas de mão</div><div class="text-mil-textMuted">Lançadas sozinhas em inimigos a menos de 25 m</div></div>
                    <button onclick="alternarGranadas()" class="px-3 py-1.5 btn-tactical rounded font-bold ${ars.granadasLiberadas ? 'btn-active-order' : ''}">${ars.granadasLiberadas ? 'Liberadas' : 'Guardadas'}</button>
                </div>
                <div class="bg-mil-bg border border-mil-border p-2 rounded flex justify-between items-center gap-2">
                    <div><div class="text-mil-textGlow font-bold">Arame farpado a 50 m: ${ars.arame > 0 ? Math.ceil(ars.arame) + '%' : 'nenhum'}</div><div class="text-mil-textMuted">Segura a infantaria pela metade; blindado rasga rápido</div></div>
                    <button onclick="estenderArame()" ${ars.itens.arame < 1 ? 'disabled' : ''} class="px-3 py-1.5 btn-tactical rounded font-bold ${ars.itens.arame < 1 ? 'opacity-40' : ''}">Estender (1 rolo)</button>
                </div>`;

            const jam = gameState.tacticalOrders.SIGNAL_JAM;
            document.getElementById('def-requisicoes').innerHTML = Object.keys(REQUISICOES).map(k => {
                const r = REQUISICOES[k], c = custo(r.custo), pode = !jam && gameState.prestige >= c;
                return `<button onclick="requisitar('${k}')" ${pode ? '' : 'disabled'} class="p-2 btn-tactical rounded text-left ${pode ? '' : 'opacity-50'}"><div class="font-bold text-mil-textGlow">${r.rotulo}</div><div class="text-mil-amberMuted">${c} PTS</div></button>`;
            }).join('');
            document.getElementById('def-pedidos').textContent = ars.pedidos.length
                ? `A caminho no comboio do dia ${proximoComboio()}: ${ars.pedidos.map(id => REQUISICOES[id].rotulo).join(', ')}.`
                : (jam ? 'Rádio ocupado pelo Bloqueio de Sinal.' : 'Nenhuma requisição pendente.');
        }

        function processEnemiesAndCombat(estado = gameState) {
            processCounterBattery();
            processBarrage();

            const emCombate = estado.enemies.length > 0; // o status vale para o início do segundo
            if (emCombate) {
                const alive = estado.squad.filter(s => s.hp > 0);
                const observando = droneObservando(estado);
                // Tiro de verdade: cada soldado dispara balas; cada bala tem chance de acertar
                dispararEsquadrao(alive, estado);
                // Armas pesadas montadas nos pontos defensivos, granadas de mão
                dispararDefesas(estado, alive);
                // De trás para a frente: inimigos podem sair da lista no meio do laço
                for (let i = estado.enemies.length - 1; i >= 0; i--) {
                    if (processarInimigo(estado, estado.enemies[i], alive, observando)) estado.enemies.splice(i, 1);
                }
            }
            atualizarStatusDeCombate(estado, emCombate);
        }

        // Um inimigo neste segundo: anda, age, atira e pode morrer ou chegar à trincheira.
        // Devolve true se ele deve sair do setor.
        function processarInimigo(estado, enemy, alive, observando) {
            moverInimigo(estado, enemy);
            if (acaoEspecialDoInimigo(estado, enemy)) return true;
            inimigoAtira(estado, enemy, alive, observando);
            if (enemy.hp <= 0) { abaterInimigo(estado, enemy); return true; }
            if (enemy.distance <= 0) { resolverChegadaNaTrincheira(estado, enemy, alive); return true; }
            return false;
        }

        // Movimento: Fogo Supressão com munição pesada segura o avanço (70% mais lento)
        function moverInimigo(estado, enemy) {
            let speed = ENEMY_TYPES[enemy.type].speed;
            if (estado.tacticalOrders.SUPPRESSION && estado.resources.ammoHeavy > 3) {
                speed *= 0.3;
                estado.resources.ammoHeavy = Math.max(0, estado.resources.ammoHeavy - 0.4 * PRESSURE.AMMO_SPEND);
                playGunshotSound();
            }
            speed *= efeitoDoArame(estado, enemy);
            enemy.distance -= speed;
        }

        // Drone derrubado pelo bloqueio de sinal, ou patrulha que marca a posição e recua.
        // Devolve true se o inimigo saiu do setor.
        function acaoEspecialDoInimigo(estado, enemy) {
            if (enemy.type === 'drone' && estado.tacticalOrders.SIGNAL_JAM && Math.random() < JAM_DRONE_CRASH) {
                estado.prestige += ganho(10);
                logFeed('📡 Bloqueio de sinal: drone inimigo perdeu o controle e caiu.', 'text-mil-greenMuted font-bold');
                return true;
            }
            if (enemy.type === 'patrulha' && enemy.distance < 140) {
                enemy.spotTicks = (enemy.spotTicks || 0) + 1;
                if (enemy.spotTicks >= PATROL_MARK_TICKS) {
                    estado.nextWaveBoost = Math.min(4, (estado.nextWaveBoost || 0) + PATROL_MARK_BOOST);
                    logFeed('👣 A patrulha marcou a posição de vocês e recuou! A próxima onda virá maior.', 'text-red-500 font-bold');
                    if (estado.general) lembrar('abatePatrulha', 0, 0.3);
                    return true;
                }
            }
            return false;
        }

        // Inimigo vivo no alcance (140 m) atira num soldado sorteado
        function inimigoAtira(estado, enemy, alive, observando) {
            const tipo = ENEMY_TYPES[enemy.type];
            if (!(enemy.hp > 0 && enemy.distance < 140 && alive.length > 0 && Math.random() < tipo.attackChance)) return;
            // Drone pode largar a carga no depósito de mantimentos em vez de num soldado
            if (enemy.type === 'drone' && Math.random() < DEPOSITO.DRONE_CHANCE) {
                atingirDeposito('Um drone inimigo', DEPOSITO.DRONE_PERDA);
                return;
            }
            let dmg = tipo.dmg(enemy) * diff().enemyDmgMult * PRESSURE.ENEMY_DAMAGE * (observando ? DRONE_SPOT_FIRE : 1);
            if (estado.tacticalOrders.SHELTER) dmg *= shelterMult();
            const target = alive[Math.floor(Math.random() * alive.length)];
            if (target.hp <= 0) return;
            target.hp = Math.max(0, target.hp - dmg);
            perdaMoral(target, 1.2);
            marcarFerido(target);
            numeroNaCena({ soldado: target.id }, '-' + Math.max(1, Math.round(dmg)), '#ff6b5b', 10);
            if (target.hp <= 0) { logFeed(`❌ BAIXA EM COMBATE: ${target.rank} ${target.name} foi morto!`, 'text-red-500 font-bold'); impacto('morte'); }
        }

        // Inimigo abatido: crédito para quem atirou, prestígio e memória do general
        function abaterInimigo(estado, enemy) {
            const tipo = ENEMY_TYPES[enemy.type];
            cenaEfeito('abate', { inimigo: enemy });
            const atirador = enemy.abatidoPor ? estado.squad.find(m => m.id === enemy.abatidoPor) : null;
            if (atirador) { statsDe(atirador).abates++; estado.combate.abates++; }
            if (enemy.hp <= 0) somarCarreira({ abates: 1 });
            logFeed(`✅ ${tipo.label} NEUTRALIZADO NO SETOR${atirador ? ` por ${atirador.rank} ${atirador.name}` : ''}!`, 'text-mil-greenMuted font-bold');
            if (enemy.type === 'patrulha' && estado.general) lembrar('abatePatrulha', 1, 0.3);
            { const gp = ganho(enemy.type === 'drone' ? 20 : enemy.type === 'blindado' ? 80 : 30); estado.prestige += gp; numeroNaCena({ inimigo: enemy }, '+' + gp, '#8fe08a', 9); }
        }

        // Chegou à trincheira: drone só sobrevoa; patrulha e infantaria invadem
        function resolverChegadaNaTrincheira(estado, enemy, alive) {
            if (enemy.type === 'drone') {
                logFeed('🛸 Drone escapou após sobrevoar a trincheira.', 'text-mil-amberMuted');
                return;
            }
            if (enemy.type === 'blindado') { blindadoNaTrincheira(estado, enemy, alive); return; }
            resolverInvasao(estado, enemy, alive);
        }

        // Invasão: estraga a trincheira e fere 2 soldados. Com a trincheira já rompida,
        // a infantaria mata todos que estão na linha.
        function resolverInvasao(estado, enemy, alive) {
            const infantaria = enemy.type === 'infantaria';
            const massacre = trincheiraRompida() && infantaria; // avaliado antes do dano desta invasão
            const dano = massacre ? 0
                : (infantaria ? GAME_CONFIG.INVASION_DAMAGE : GAME_CONFIG.INVASION_DAMAGE / 2) * diff().enemyDmgMult * PRESSURE.ENEMY_DAMAGE * trenchInvasionMult();
            trenchDamage(infantaria ? TRENCH.DAMAGE_INVASION : TRENCH.DAMAGE_INVASION / 2, 'a invasão');
            tremer(5, 350); vibrar(120);
            cenaEfeito('explosao', { comodo: 'posto' });
            if (trincheiraRompida() && infantaria) {
                logFeed('☠️ A INFANTARIA ENTROU PELA TRINCHEIRA ROMPIDA! MASSACRE NA LINHA!', 'text-red-500 font-bold');
            } else {
                logFeed(`🚨 ${infantaria ? 'INVASÃO DE TRINCHEIRA!' : 'PATRULHA NA TRINCHEIRA!'} COMBATE A CURTA DISTÂNCIA!`, 'text-red-500 font-bold');
            }
            const naLinha = alive.filter(s => s.hp > 0);
            const atingidos = massacre ? naLinha : embaralhar(naLinha).slice(0, INVASION_TARGETS);
            atingidos.forEach(s => {
                if (s.hp <= 0) return;
                s.hp = massacre ? 0 : Math.max(0, s.hp - dano); // massacre: morte certa
                marcarFerido(s);
                if (s.hp <= 0) { logFeed(`❌ BAIXA NA TRINCHEIRA: ${s.rank} ${s.name} foi morto!`, 'text-red-500 font-bold'); impacto('morte'); }
            });
        }

        // Status no topo da cena (artilharia prevista ou combate)
        function atualizarStatusDeCombate(estado, emCombate) {
            const statusEl = document.getElementById('lbl-tactical-status');
            if (estado.barrage) {
                statusEl.textContent = '💥 BOMBARDEIO PREVISTO';
                statusEl.className = 'text-red-400 font-bold animate-pulse';
            } else if (emCombate) {
                statusEl.textContent = '⚠️ ENGAJAMENTO DE COMBATE';
                statusEl.className = 'text-red-400 font-bold animate-pulse';
            } else {
                statusEl.textContent = 'SETORES LIMPOS';
                statusEl.className = 'text-mil-greenMuted font-bold';
            }
        }

        /* ==========================================================================
           CRISES: decisões raras com custo real
           No máximo uma por dia (intervalo mínimo de 240 s de jogo) e, em média, uma a cada
           ~3 dias no nível 1. Só aparecem fora de combate, e o relógio para enquanto
           a crise está aberta. Cada uma tem uma opção que custa agora e outra que custa
           mais depois. Gravidade e frequência sobem até 30% no nível máximo.
           ========================================================================== */
        const CRISIS_CHANCE = 0.0018;   // por segundo de jogo, fora de combate
        const CRISIS_COOLDOWN = 240;    // segundos mínimos entre duas crises

        const vivosAgora = () => gameState.squad.filter(s => s.hp > 0);
        const sorteia = (lista) => lista[Math.floor(Math.random() * lista.length)];
        const soldadoPorId = (id) => gameState.squad.find(s => s.id === id);
        const gravidade = () => diff().crisisSeverity;
        const atiradorDeElite = () => vivosAgora().find(m => m.class === 'Atirador de Elite');
        const chanceDuelo = (m) => Math.round(Math.max(20, Math.min(90, 40 + m.moral * 0.3 + m.hp * 0.2 - m.fatigue * 0.2)));

        function feridoNaCrise(m, dano, causa) {
            m.hp = Math.max(0, m.hp - dano);
            if (m.hp <= 0) logFeed(`❌ ${m.rank} ${m.name} morreu (${causa}).`, 'text-red-500 font-bold');
        }

        const CRISES = {
            congelamento: {
                titulo: 'CONGELAMENTO',
                pode: (s) => s.weather === 'Neve' && s.resources.water > 5,
                texto: () => 'A neve congelou os reservatórios. Sem aquecer, boa parte da água vira gelo inútil.',
                opcoes: [
                    { texto: () => 'Queimar munição pesada para aquecer (−15 Mun. Pesada)', pode: (s) => s.resources.ammoHeavy >= 15,
                      efeito: (s) => { s.resources.ammoHeavy -= 15; logFeed('🔥 Reservatórios aquecidos. A água foi salva.', 'text-mil-greenMuted'); } },
                    { texto: () => `Deixar congelar (perde ${Math.round(40 * gravidade())}% da água e 10 de moral)`,
                      efeito: (s) => {
                          const perda = Math.round(s.resources.water * Math.min(0.8, 0.4 * gravidade()));
                          s.resources.water -= perda;
                          vivosAgora().forEach(m => { m.moral = Math.max(0, m.moral - 10); });
                          logFeed(`🧊 ${perda} L de água congelaram.`, 'text-red-400');
                      } }
                ]
            },
            infeccao: {
                titulo: 'INFECÇÃO DE TRINCHEIRA',
                pode: (s) => ['Chuva Forte', 'Névoa Espessa'].includes(s.weather) && vivosAgora().some(m => m.duty === 'WATCH'),
                preparar: () => ({ alvo: sorteia(vivosAgora().filter(m => m.duty === 'WATCH')).id }),
                texto: (ctx) => { const a = soldadoPorId(ctx.alvo); return `A umidade nas botas inflamou os pés de ${a.rank} ${a.name}. Sem tratamento, a infecção se espalha.`; },
                opcoes: [
                    { texto: () => 'Usar 1 kit médico', pode: (s) => s.resources.medkits > 0,
                      efeito: (s, ctx) => { s.resources.medkits--; const a = soldadoPorId(ctx.alvo); logFeed(`💊 ${a.rank} ${a.name} tratado com kit médico.`, 'text-mil-greenMuted'); } },
                    { texto: () => `Seguir sem tratar (o soldado perde ${Math.round(35 * gravidade())} de vida e 15 de moral)`,
                      efeito: (s, ctx) => {
                          const a = soldadoPorId(ctx.alvo);
                          a.moral = Math.max(0, a.moral - 15);
                          logFeed(`🦠 A infecção piorou: ${a.rank} ${a.name} enfraquecido.`, 'text-red-400');
                          feridoNaCrise(a, 35 * gravidade(), 'infecção');
                      } }
                ]
            },
            desabamento: {
                titulo: 'DESABAMENTO',
                pode: (s) => s.weather === 'Chuva Forte' && s.trench > 20,
                texto: () => 'A chuva encharcou a terra e uma parede da trincheira começou a ceder.',
                opcoes: [
                    { texto: () => 'Todos escoram a parede agora (+25 de fadiga em todos)',
                      efeito: () => {
                          vivosAgora().forEach(m => { m.fatigue = Math.min(100, m.fatigue + 25); });
                          trenchDamage(5, 'o desabamento');
                          logFeed('🧱 Parede escorada a tempo.', 'text-mil-greenMuted');
                      } },
                    { texto: () => `Deixar para depois (trincheira −${Math.round(25 * gravidade())}%)`,
                      efeito: () => { trenchDamage(25 * gravidade(), 'o desabamento'); logFeed('🧱 Parte da trincheira desabou.', 'text-red-400'); } }
                ]
            },
            racao_estragada: {
                titulo: 'RAÇÃO ESTRAGADA',
                pode: (s) => s.resources.rations >= 8,
                texto: () => 'A umidade estragou parte da ração. Comer assim pode derrubar homens.',
                opcoes: [
                    { texto: () => 'Descartar a parte estragada (−30% das rações)',
                      efeito: (s) => { const perda = Math.round(s.resources.rations * 0.3); s.resources.rations -= perda; logFeed(`🗑️ ${perda} rações descartadas.`, 'text-mil-amberMuted'); } },
                    { texto: () => `Servir assim mesmo (2 soldados adoecem: −${Math.round(20 * gravidade())} de vida cada)`,
                      efeito: () => {
                          const doentes = embaralhar(vivosAgora()).slice(0, 2);
                          logFeed(`🤢 ${doentes.map(m => m.name).join(' e ')} passaram mal com a comida.`, 'text-red-400');
                          doentes.forEach(m => feridoNaCrise(m, 20 * gravidade(), 'comida estragada'));
                      } }
                ]
            },
            desercao: {
                titulo: 'AMEAÇA DE DESERÇÃO',
                pode: () => vivosAgora().length > 1 && vivosAgora().some(m => m.moral < 30),
                preparar: () => ({ alvo: vivosAgora().filter(m => m.moral < 30).sort((a, b) => a.moral - b.moral)[0].id }),
                texto: (ctx) => { const a = soldadoPorId(ctx.alvo); return `${a.rank} ${a.name} está à beira de abandonar o posto. Os outros estão de olho na sua decisão.`; },
                opcoes: [
                    { texto: () => `Conceder licença pelo rádio (−${custo(60)} de prestígio; ele recupera 40 de moral)`, pode: (s) => s.prestige >= custo(60),
                      efeito: (s, ctx) => {
                          s.prestige -= custo(60);
                          const a = soldadoPorId(ctx.alvo);
                          a.moral = Math.min(100, a.moral + 40);
                          a.duty = 'REST';
                          logFeed(`📻 ${a.rank} ${a.name} ganhou licença e se acalmou.`, 'text-mil-greenMuted');
                      } },
                    { texto: () => 'Repreender na frente da tropa (todos perdem 10 de moral)',
                      efeito: (s, ctx) => {
                          vivosAgora().forEach(m => { m.moral = Math.max(0, m.moral - 10); });
                          const a = soldadoPorId(ctx.alvo);
                          a.moral = Math.min(100, a.moral + 15);
                          logFeed(`📢 ${a.rank} ${a.name} foi repreendido. O clima pesou na trincheira.`, 'text-mil-amberMuted');
                      } },
                    { texto: () => 'Ignorar (50% de chance de ele desertar)',
                      efeito: (s, ctx) => {
                          const a = soldadoPorId(ctx.alvo);
                          if (Math.random() < 0.5) {
                              a.hp = 0;
                              a.deserted = true;
                              logFeed(`🏃 ${a.rank} ${a.name} desertou durante a noite.`, 'text-red-500 font-bold');
                          } else {
                              logFeed(`${a.rank} ${a.name} decidiu ficar, por enquanto.`, 'text-mil-amberMuted');
                          }
                      } }
                ]
            },
            emboscada_comboio: {
                titulo: 'EMBOSCADA NA ESTRADA',
                pode: (s) => !s.convoyAmbush,
                texto: () => 'Batedores avisam: o inimigo está vigiando a estrada do próximo comboio de suprimentos.',
                opcoes: [
                    { texto: () => `Pedir rota alternativa à Central (−${custo(40)} de prestígio)`, pode: (s) => s.prestige >= custo(40),
                      efeito: (s) => { s.prestige -= custo(40); logFeed('🛣️ A Central desviou o comboio por outra rota.', 'text-mil-greenMuted'); } },
                    { texto: () => 'Arriscar a rota normal (50% de chance de perder a próxima entrega)',
                      efeito: (s) => { s.convoyAmbush = true; logFeed('⚠️ O próximo comboio vai pela estrada vigiada.', 'text-mil-amberMuted'); } }
                ]
            },
            interceptacao: {
                titulo: 'TRANSMISSÃO INIMIGA',
                pode: () => true,
                texto: () => 'O rádio captou uma transmissão inimiga. Interceptar pode render informação, mas também pode denunciar a posição de vocês.',
                opcoes: [
                    { texto: () => 'Tentar interceptar (rola 1d10)',
                      efeito: (s) => {
                          // Regra de guerra eletrônica: 10 crítico, 7-9 grave, 2-4 inimigo alerta, 1 triangulado
                          const d10 = 1 + Math.floor(Math.random() * 10);
                          if (d10 === 10) {
                              s.weakenNextWave = true;
                              logFeed('📡 1d10 = 10: posição inimiga descoberta! A próxima onda chega enfraquecida.', 'text-mil-greenMuted font-bold');
                          } else if (d10 >= 7) {
                              s.prestige += ganho(60);
                              logFeed(`📡 1d10 = ${d10}: informação valiosa enviada ao Comando (+${ganho(60)} de prestígio).`, 'text-mil-greenMuted');
                          } else if (d10 >= 5) {
                              logFeed(`📡 1d10 = ${d10}: a transmissão era só ruído.`, 'text-mil-textGlow');
                          } else if (d10 >= 2) {
                              spawnEnemy('patrulha', 250);
                              logFeed(`📡 1d10 = ${d10}: o inimigo percebeu a escuta e mandou uma patrulha.`, 'text-red-400 font-bold');
                          } else {
                              s.barrage = { ticks: Math.min(40, s.barrage ? s.barrage.ticks : 40) };
                              logFeed('📡 1d10 = 1: o inimigo triangulou vocês! Artilharia em 5s.', 'text-red-500 font-bold');
                          }
                      } },
                    { texto: () => 'Ficar em silêncio de rádio (sem relatório de patrulha hoje)',
                      efeito: (s) => { s.lastIntelDay = s.day; logFeed('🔇 Silêncio de rádio até amanhã.', 'text-mil-amberMuted'); } }
                ]
            },
            franco_atirador: {
                titulo: 'FRANCO-ATIRADOR',
                pode: (s) => s.day >= 3,
                texto: () => 'Um franco-atirador inimigo prende a trincheira. Quem levanta a cabeça vira alvo.',
                opcoes: [
                    { texto: () => { const m = atiradorDeElite(); return m ? `Mandar ${m.rank} ${m.name} responder (duelo: ~${chanceDuelo(m)}% de vencer; se perder, −${Math.round(30 * gravidade())} de vida)` : 'Mandar o Atirador de Elite responder (indisponível: sem atirador vivo)'; },
                      pode: () => !!atiradorDeElite(),
                      efeito: () => {
                          const m = atiradorDeElite();
                          if (Math.random() * 100 < chanceDuelo(m)) {
                              vivosAgora().forEach(x => { x.moral = Math.min(100, x.moral + 5); });
                              logFeed(`🎯 ${m.rank} ${m.name} abateu o franco-atirador!`, 'text-mil-greenMuted font-bold');
                          } else {
                              logFeed(`🎯 ${m.rank} ${m.name} perdeu o duelo e foi ferido.`, 'text-red-400');
                              feridoNaCrise(m, 30 * gravidade(), 'duelo com o franco-atirador');
                          }
                      } },
                    { texto: () => 'Ficar abaixados até ele ir embora (todos perdem 15 de moral)',
                      efeito: () => { vivosAgora().forEach(x => { x.moral = Math.max(0, x.moral - 15); }); logFeed('🪖 O esquadrão ficou abaixado. O atirador foi embora, e a moral também.', 'text-mil-amberMuted'); } }
                ]
            }
        };

        function randomCrisisCheck() {
            if (gameState.activeCrisis) return;
            if (gameState.crisisCooldown > 0) { gameState.crisisCooldown--; return; }
            if (gameState.enemies.length > 0 || gameState.barrage) return;
            if (Math.random() >= CRISIS_CHANCE * diff().crisisMult) return;
            const possiveis = Object.keys(CRISES).filter(id => CRISES[id].pode(gameState));
            if (possiveis.length === 0) return;
            const id = sorteia(possiveis);
            openCrisis(id, CRISES[id].preparar ? CRISES[id].preparar() : {});
        }

        // Abre a janela da crise; o relógio fica parado até uma opção ser escolhida
        function openCrisis(id, ctx) {
            const crise = CRISES[id];
            gameState.activeCrisis = { id, ctx };
            document.getElementById('crisis-title').textContent = crise.titulo;
            document.getElementById('crisis-description').textContent = crise.texto(ctx);
            const box = document.getElementById('crisis-options');
            box.innerHTML = '';
            crise.opcoes.forEach((op, i) => {
                const disponivel = !op.pode || op.pode(gameState);
                const btn = document.createElement('button');
                btn.className = `w-full py-2 px-2 bg-mil-bg border border-mil-border rounded text-left text-xs text-mil-textGlow transition ${disponivel ? 'hover:border-mil-textGlow' : 'opacity-40'}`;
                btn.textContent = `${i + 1}. ${op.texto(ctx)}`;
                btn.disabled = !disponivel;
                btn.onclick = () => resolveCrisis(i);
                box.appendChild(btn);
            });
            document.getElementById('modal-crisis').classList.remove('hidden');
            playTacticalBeep(500, 0.15);
            if (!gameEnded) saveGame();
        }

        function resolveCrisis(i) {
            const aberta = gameState.activeCrisis;
            if (!aberta) return;
            const op = CRISES[aberta.id].opcoes[i];
            if (!op || (op.pode && !op.pode(gameState))) return;
            op.efeito(gameState, aberta.ctx);
            gameState.activeCrisis = null;
            gameState.crisisCooldown = CRISIS_COOLDOWN;
            document.getElementById('modal-crisis').classList.add('hidden');
            updateUI();
            checkWinLoss();
        }

