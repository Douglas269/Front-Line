// FrontLine · Trincheira em corte: desenho, soldados e toque
// Os arquivos de assets/js são carregados em ordem pela página e compartilham as mesmas variáveis globais.
        /* ==========================================================================
           TRINCHEIRA EM CORTE LATERAL (visual novo)
           A cena é desenhada ao vivo num canvas: céu e terra de ninguém com os inimigos,
           e embaixo os cômodos da trincheira com cada soldado no cômodo da sua função.
           Trocar a função: arrastar o soldado para outro cômodo, ou tocar no soldado e
           depois no cômodo.
           ========================================================================== */
        const CORTE = {
            W: 400, H: 474, SOLO: 118, ESC: 1.3, // ESC: tamanho dos soldados
            comodos: {
                posto:    { x: 6,   y: 138, w: 146, h: 120, nome: 'POSTO DE VIGÍLIA',     duty: 'WATCH' },
                ninhos:   { x: 156, y: 138, w: 76,  h: 120, nome: 'NINHOS',               duty: 'WATCH' },
                cozinha:  { x: 236, y: 138, w: 78,  h: 120, nome: 'COZINHA',              duty: 'RATIONING' },
                deposito: { x: 318, y: 138, w: 76,  h: 120, nome: 'DEPÓSITO',             duty: null },
                abrigo:   { x: 6,   y: 284, w: 214, h: 120, nome: 'ABRIGO (DESCANSO)',    duty: 'REST' },
                oficina:  { x: 224, y: 284, w: 170, h: 120, nome: 'OFICINA (MANUTENÇÃO)', duty: 'MAINTENANCE' }
            }
        };
        const corteCanvas = document.getElementById('corteCanvas');
        let cctx = corteCanvas.getContext('2d'); // 'let': durante o desenho do fundo em cache aponta para a camada de fundo
        CORTE.escCss = 1;                         // pixels de tela por unidade da cena (atualizado a cada quadro)
        let soldadoSelecionado = 1;
        let arrasto = null;            // { id, x, y, moveu } enquanto arrasta um soldado
        let posicoesCena = {};         // id do soldado -> { x, y } (atualizado a cada quadro)
        const animPos = {};            // posição animada de cada soldado (para caminhar entre cômodos)
        const cenaEfeitos = [];        // explosões, fogo, abates e flashes na cena

        // Em qual cômodo o soldado está (pela função e por operar um ninho)
        function comodoDoSoldado(s) {
            if (!s || s.hp <= 0 || s.deserted) return null;
            if (s.duty === 'WATCH') return arsenalDe().posicoes.some(p => p.obra >= 100 && p.arma && p.operador === s.id) ? 'ninhos' : 'posto';
            return { REST: 'abrigo', RATIONING: 'cozinha', MAINTENANCE: 'oficina' }[s.duty] || 'posto';
        }
        // Mover o soldado para um cômodo = trocar a função (ninhos: vira operador de uma arma livre)
        function moverParaComodo(id, comodo) {
            const s = gameState.squad.find(m => m.id === id);
            const cm = CORTE.comodos[comodo];
            if (!s || s.hp <= 0 || !cm) return false;
            if (!cm.duty) { logFeed('No depósito ninguém fica: é onde estão a ração, a água e a munição.', 'text-mil-textMuted'); return false; }
            if (mentalDe(s) === 'panico') { setSoldierDuty(id, cm.duty); return false; } // avisa que não obedece
            const ars = arsenalDe();
            if (comodo === 'ninhos') {
                const livre = ars.posicoes.findIndex(p => p.obra >= 100 && p.arma && (!p.operador || p.operador === id || !gameState.squad.some(m => m.id === p.operador && m.hp > 0)));
                if (livre < 0) { logFeed('Nenhuma arma pesada esperando operador. Construa um ninho e monte uma arma na aba Defesas.', 'text-mil-amberMuted'); return false; }
                ars.posicoes.forEach(p => { if (p.operador === id) p.operador = null; });
                ars.posicoes[livre].operador = id;
                lastDefSignature = '';
            } else if (comodo === 'posto') {
                ars.posicoes.forEach(p => { if (p.operador === id) p.operador = null; }); // larga a arma pesada e volta ao fuzil
                lastDefSignature = '';
            }
            setSoldierDuty(id, cm.duty);
            soldadoSelecionado = id;
            lastSquadSignature = '';
            updateUI();
            return true;
        }
        function selecionarSoldado(id) {
            soldadoSelecionado = id;
            lastSquadSignature = '';
            updateUI();
            playTacticalBeep(900, 0.02);
        }

        // Efeitos na cena: o alvo é resolvido na hora do desenho (soldado, cômodo, inimigo)
        function cenaEfeito(tipo, alvo, vidaPersonalizada) {
            if (cenaEfeitos.length >= 60) cenaEfeitos.shift();
            const vida = vidaPersonalizada || { explosao: 50, fogo: 240, abate: 30, morte: 40, tiro: 5, dia: 150, numero: 55 }[tipo] || 40;
            let fixo = null;
            if (alvo && alvo.inimigo) fixo = posInimigoCena(alvo.inimigo); // o inimigo some da lista: guarda a posição agora
            else if (alvo && alvo.pos) fixo = alvo.pos;                      // ponto da cena (x, y) já resolvido
            cenaEfeitos.push({ tipo, alvo, fixo, idade: 0, vida, sx: Math.random() });
        }
        // Número flutuante sobre um soldado ou um ponto da cena (liga e desliga nas Configurações)
        function numeroNaCena(alvo, txt, cor, tam) {
            if (typeof CONFIG !== 'undefined' && CONFIG.numeros === false) return;
            cenaEfeito('numero', Object.assign({}, alvo, { txt, cor, tam }));
        }
        // posInimigoCena: definida em 05b-cena-pixel.js (campo visto de lado)
        function posAlvoCena(a) {
            if (!a) return { x: 200, y: 200 };
            if (a.soldado && posicoesCena[a.soldado]) return posicoesCena[a.soldado];
            const c = CORTE.comodos[a.comodo || 'posto'];
            return { x: c.x + c.w / 2, y: c.y + c.h * 0.6 };
        }

        // ---------- desenho ----------
        // ---------- Quadro: tamanho, qualidade adaptativa e camada de fundo em cache ----------
        // O que não muda (céu, terra, paredes, móveis) é pintado uma vez numa imagem guardada e só
        // repintado quando algo que ela mostra muda; por quadro só se desenha o que se mexe.
        const FONTE_CENA = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", "Courier Prime", sans-serif';
        let corteQualidade = Math.min(2, window.devicePixelRatio || 1); // pixels por pixel de tela; cai sozinho se o aparelho engasgar
        let corteLentos = 0, ultimoQuadroCorte = 0;
        const camadaFundo = document.createElement('canvas');
        const ctxFundo = camadaFundo.getContext('2d');
        let assinaturaFundo = '';
        function corteRedimensionar() {
            const css = corteCanvas.parentElement.clientWidth || 380;
            const h = Math.round(css * CORTE.H / CORTE.W);
            const larg = Math.round(css * corteQualidade);
            if (corteCanvas.width !== larg) {
                corteCanvas.width = larg;
                corteCanvas.height = Math.round(h * corteQualidade);
                corteCanvas.style.height = h + 'px';
                camadaFundo.width = corteCanvas.width; camadaFundo.height = corteCanvas.height;
                assinaturaFundo = '';
            }
            CORTE.escCss = css / CORTE.W;
            return corteCanvas.width / CORTE.W;
        }
        // Texto da cena: fonte condensada e nunca menor que minPx na tela (letra pequena demais não se lê no celular)
        function txtC(x, y, t, cor, tam = 8.5, peso = 700, anc = 'left', minPx = 9.5) {
            const tt = Math.max(tam, minPx / CORTE.escCss);
            cctx.font = `${peso >= 600 ? 700 : 500} ${tt}px ${FONTE_CENA}`;
            cctx.textAlign = anc; cctx.fillStyle = cor; cctx.fillText(t, x, y); cctx.textAlign = 'left';
        }
        if (document.fonts && document.fonts.load) {
            // Quando a fonte condensada chegar, o fundo em cache é repintado com ela
            ['500', '700'].forEach(w => document.fonts.load(`${w} 12px "Barlow Condensed"`).then(() => { assinaturaFundo = ''; }).catch(() => {}));
        }
        function periodoDoDia() { return Math.min(3, Math.floor(gameState.timeSeconds / 60)); } // 0 manhã, 1 tarde, 2 noite, 3 madrugada

        // O que o fundo em cache mostra: se isso mudar, ele é repintado
        function assinaturaDoFundo() {
            const ars = arsenalDe(), r = gameState.resources, obra = ars.posicoes.find(p => p.construindo);
            return [periodoDoDia(), corteCanvas.width, Math.ceil(ars.arame), Math.floor(r.rations), Math.floor(r.water), Math.round(gameState.trench),
                ars.posicoes.map(p => [Math.floor(p.obra / 4), p.arma, !!operadorAtivo(p)].join(':')).join('|'), obra ? obra.nome + Math.floor(obra.obra) : ''].join(',');
        }

        // Cômodo: parte viva (destaque ao arrastar e contagem de soldados)
        function desenharComodoViva(chave, ocupantes) {
            const c = CORTE.comodos[chave];
            if (arrasto && arrasto.moveu && c.duty && comodoEm(arrasto.x, arrasto.y) === chave) {
                cctx.strokeStyle = '#8fad88'; cctx.lineWidth = 3; cctx.strokeRect(c.x, c.y, c.w, c.h);
                cctx.fillStyle = 'rgba(143,173,136,0.14)'; cctx.fillRect(c.x, c.y, c.w, c.h);
            }
            if (c.duty) txtC(c.x + c.w - 5, c.y + 11, String(ocupantes), '#b3c4ae', 8, 500, 'right', 10);
        }

        // Móveis fixos (vão para o fundo em cache; dependem do estoque e das armas)
        function desenharMoveisFundo() {
            const C = CORTE.comodos;
            cctx.fillStyle = '#2a2018'; cctx.fillRect(C.posto.x + 4, C.posto.y + 96, C.posto.w - 8, 20);
            const ars = arsenalDe();
            cctx.fillStyle = '#7d7056'; cctx.fillRect(C.ninhos.x + 6, C.ninhos.y + 86, C.ninhos.w - 12, 14);
            const prontos = ars.posicoes.filter(p => p.obra >= 100 && p.arma);
            prontos.forEach((p, k) => {
                const x = C.ninhos.x + 14 + k * 24, y = C.ninhos.y + 80;
                cctx.fillStyle = '#222'; cctx.fillRect(x - 2, y - 4, 20, 4);
                txtC(x + 8, y - 8, EQUIP[p.arma].sigla, operadorAtivo(p) ? '#8fad88' : '#d9a35a', 6.5, 700, 'center', 9);
            });
            if (!prontos.length) txtC(C.ninhos.x + C.ninhos.w / 2, C.ninhos.y + 68, 'sem armas', '#8a8a7a', 7, 500, 'center', 9);
            const cz = C.cozinha;
            cctx.fillStyle = '#3b3b33'; cctx.fillRect(cz.x + 46, cz.y + 86, 26, 14);
            cctx.fillStyle = '#555'; cctx.fillRect(cz.x + 50, cz.y + 77, 16, 9);
            // depósito: caixas de ração e barris de água conforme o estoque
            const dp = C.deposito, r = gameState.resources;
            const caixas = Math.min(6, Math.ceil(r.rations / 8)), barris = Math.min(3, Math.ceil(r.water / 12));
            for (let k = 0; k < caixas; k++) {
                const x = dp.x + 6 + (k % 3) * 18, y = dp.y + 98 - Math.floor(k / 3) * 16;
                cctx.fillStyle = '#6b5333'; cctx.fillRect(x, y, 16, 15); cctx.strokeStyle = '#3e2f1f'; cctx.lineWidth = 1; cctx.strokeRect(x, y, 16, 15);
                cctx.beginPath(); cctx.moveTo(x, y); cctx.lineTo(x + 16, y + 15); cctx.moveTo(x + 16, y); cctx.lineTo(x, y + 15); cctx.stroke();
            }
            for (let k = 0; k < barris; k++) { cctx.fillStyle = '#3d5a6a'; cctx.fillRect(dp.x + 60, dp.y + 100 - k * 15, 11, 14); }
            txtC(dp.x + dp.w / 2, dp.y + 26, `ração ${Math.floor(r.rations)}`, r.rations < 10 ? '#ff6b5b' : '#b3c4ae', 7, 700, 'center', 9.5);
            txtC(dp.x + dp.w / 2, dp.y + 39, `água ${Math.floor(r.water)} L`, r.water < 10 ? '#ff6b5b' : '#b3c4ae', 7, 700, 'center', 9.5);
            const ab = C.abrigo;
            for (let k = 0; k < 3; k++) {
                const x = ab.x + 12 + k * 66, y = ab.y + 68;
                cctx.fillStyle = '#6b4f33'; cctx.fillRect(x, y, 54, 5); cctx.fillRect(x, y + 28, 54, 5);
                cctx.fillStyle = '#4e3924'; cctx.fillRect(x, y - 8, 4, 46); cctx.fillRect(x + 50, y - 8, 4, 46);
            }
            txtC(ab.x + ab.w - 6, ab.y + ab.h - 8, 'leva 30% da artilharia', '#8fad88', 6.5, 500, 'right', 9);
            const of = C.oficina;
            cctx.fillStyle = '#6b4f33'; cctx.fillRect(of.x + 70, of.y + 84, 90, 7);
            cctx.fillStyle = '#4e3924'; cctx.fillRect(of.x + 74, of.y + 91, 4, 22); cctx.fillRect(of.x + 152, of.y + 91, 4, 22);
            cctx.fillStyle = '#777'; cctx.fillRect(of.x + 90, of.y + 74, 10, 10);
            const obra = ars.posicoes.find(p => p.construindo);
            txtC(of.x + 6, of.y + 25, obra ? `obra: ${obra.nome.toLowerCase()} ${Math.floor(obra.obra)}%` : `reparando trincheira ${Math.round(gameState.trench)}%`, '#d9a35a', 7, 700, 'left', 9.5);
            // cordas das lamparinas (o brilho e a chama ficam na parte viva)
            ['posto', 'cozinha', 'abrigo', 'oficina', 'ninhos'].forEach(k => {
                const c = C[k], lx = c.x + c.w * (k === 'abrigo' ? 0.86 : 0.72), ly = c.y + 20;
                cctx.strokeStyle = '#2a2018'; cctx.lineWidth = 0.7; cctx.beginPath(); cctx.moveTo(lx, c.y + 2); cctx.lineTo(lx, ly - 3); cctx.stroke();
                cctx.fillStyle = '#3a3a30'; cctx.fillRect(lx - 2, ly - 3, 4, 2);
            });
            cctx.strokeStyle = '#2a2a24'; cctx.lineWidth = 2; cctx.beginPath(); cctx.moveTo(C.posto.x + 128, C.posto.y + 96); cctx.lineTo(C.posto.x + 128, C.posto.y - 14); cctx.lineTo(C.posto.x + 133, C.posto.y - 14); cctx.stroke();
            [[C.posto.x + 6, C.posto.y + 86], [C.posto.x + 6, C.posto.y + 77]].forEach(([x, y]) => { cctx.fillStyle = '#4e5a38'; cctx.fillRect(x, y, 12, 8); cctx.fillStyle = '#d9c27a'; cctx.fillRect(x + 4, y + 3, 4, 2); });
            cctx.fillStyle = '#4e3924'; cctx.fillRect(cz.x + 6, cz.y + 26, 30, 2);
            for (let k = 0; k < 4; k++) { cctx.fillStyle = ['#7a7a70', '#8a5a3a', '#7a7a70', '#5a6a4a'][k]; cctx.fillRect(cz.x + 8 + k * 7, cz.y + 20, 5, 6); }
            [[ab.x + 16, ab.y + 16], [ab.x + 82, ab.y + 18]].forEach(([x, y]) => { cctx.fillStyle = '#d8ccb0'; cctx.fillRect(x, y, 8, 10); cctx.fillStyle = '#6a5a48'; cctx.fillRect(x + 1.5, y + 1.5, 5, 6); });
            cctx.fillStyle = '#3e4a33'; cctx.beginPath(); cctx.ellipse(ab.x + 150, ab.y + 24, 6, 4, 0, Math.PI, 0); cctx.fill(); cctx.fillRect(ab.x + 143, ab.y + 24, 14, 1.5);
            cctx.strokeStyle = '#6a6a60'; cctx.lineWidth = 1.5;
            cctx.beginPath(); cctx.moveTo(of.x + 18, of.y + 34); cctx.lineTo(of.x + 18, of.y + 66); cctx.stroke(); cctx.fillStyle = '#6a6a60'; cctx.fillRect(of.x + 15, of.y + 64, 6, 8);
            cctx.fillStyle = '#8a8a80'; cctx.fillRect(of.x + 28, of.y + 38, 14, 4); cctx.fillStyle = '#5a4128'; cctx.fillRect(of.x + 40, of.y + 37, 5, 6);
            cctx.fillStyle = '#7a5a38'; cctx.save(); cctx.translate(of.x + 52, of.y + 116); cctx.rotate(-0.18); cctx.fillRect(0, -44, 5, 44); cctx.fillRect(7, -40, 5, 40); cctx.restore();
            [[140, 258, 284], [300, 258, 284]].forEach(([x, y1, y2]) => {
                cctx.strokeStyle = '#6b4f33'; cctx.lineWidth = 2;
                cctx.beginPath(); cctx.moveTo(x, y1); cctx.lineTo(x, y2); cctx.moveTo(x + 10, y1); cctx.lineTo(x + 10, y2);
                for (let y = y1 + 6; y < y2; y += 8) { cctx.moveTo(x, y); cctx.lineTo(x + 10, y); }
                cctx.stroke();
            });
        }

        // Brilho das lamparinas: pintado uma vez numa imagem pequena e só ampliado a cada quadro
        const brilhoLamparina = (() => {
            const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
            const gr = g.createRadialGradient(48, 48, 2, 48, 48, 48);
            gr.addColorStop(0, 'rgba(255,200,110,1)'); gr.addColorStop(0.35, 'rgba(255,180,90,0.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
            g.fillStyle = gr; g.fillRect(0, 0, 96, 96); return c;
        })();
        // Móveis vivos: lamparinas que piscam, brasa do fogareiro e vapor da cozinha
        function desenharMoveisViva(t) {
            const C = CORTE.comodos, noite = periodoDoDia() >= 2, cz = C.cozinha;
            cctx.fillStyle = ['#e0882b', '#f0a040', '#d06a20'][Math.floor(t / 120) % 3]; cctx.beginPath(); cctx.arc(cz.x + 59, cz.y + 104, 3, 0, Math.PI * 2); cctx.fill();
            if (atlasPronto) for (let k = 0; k < 2; k++) { const kk = ((t / 1400) + k * 0.5) % 1; quadroAnimado('vapor', kk, cz.x + 57 + Math.sin(t / 600 + k) * 3, cz.y + 72 - kk * 22, 14 + kk * 10, 0.5 * (1 - kk)); }
            ['posto', 'cozinha', 'abrigo', 'oficina', 'ninhos'].forEach((k, i) => {
                const c = C[k], lx = c.x + c.w * (k === 'abrigo' ? 0.86 : 0.72), ly = c.y + 20;
                const pisca = 0.9 + 0.1 * Math.sin(t / 170 + i * 2) + (Math.random() < 0.02 ? -0.25 : 0);
                const raio = c.w * 0.75;
                cctx.save(); cctx.beginPath(); cctx.rect(c.x, c.y, c.w, c.h); cctx.clip();
                cctx.globalAlpha = (noite ? 0.34 : 0.16) * pisca;
                cctx.drawImage(brilhoLamparina, lx - raio, ly + 10 - raio, raio * 2, raio * 2);
                cctx.restore();
                cctx.fillStyle = `rgba(255,214,130,${pisca})`; cctx.beginPath(); cctx.arc(lx, ly + 1, 2.2, 0, Math.PI * 2); cctx.fill();
            });
        }

        /* ===== Bonecos articulados e efeitos animados da cena =====
           Partes do soldado: "WW2 soldier spritesheet" (OpenGameArt, CC0).
           Explosão, fumaça, clarão e vapor: "Smoke Particle Assets" de Kenney (CC0).
           Tudo junto em assets/cena/atlas.png; o mapa das peças fica em ATLAS_CENA. */
        const ATLAS_CENA = {"explosao0":[0,0,64,59],"explosao1":[66,0,64,59],"explosao2":[132,0,64,54],"explosao3":[198,0,58,64],"explosao4":[258,0,62,64],"explosao5":[322,0,64,61],"explosao6":[388,0,63,64],"explosao7":[453,0,64,53],"explosao8":[519,0,64,63],"fumaca0":[0,66,64,59],"fumaca1":[66,66,61,64],"fumaca2":[129,66,58,64],"fumaca3":[189,66,60,64],"fumaca4":[251,66,64,62],"fumaca5":[317,66,64,63],"fumaca6":[383,66,64,60],"fumaca7":[449,66,63,64],"fumaca8":[514,66,64,60],"clarao0":[0,132,64,58],"clarao1":[66,132,61,64],"clarao2":[129,132,64,60],"clarao3":[195,132,60,64],"clarao4":[257,132,62,64],"clarao5":[321,132,63,64],"clarao6":[386,132,54,64],"clarao7":[442,132,64,61],"clarao8":[508,132,61,64],"vapor0":[0,198,64,58],"vapor1":[66,198,59,64],"vapor2":[127,198,64,61],"vapor3":[193,198,58,64],"vapor4":[253,198,58,64],"vapor5":[313,198,64,61],"vapor6":[379,198,63,64],"vapor7":[444,198,63,64],"vapor8":[509,198,64,63]};
        const atlasImg = new Image();
        let atlasPronto = false;
        atlasImg.onload = () => { atlasPronto = true; };
        atlasImg.src = musicBase + 'assets/cena/atlas.png';
        const disparosCena = {};               // id do soldado -> instante do último tiro (recuo da arma)

        // Quadro de uma sequência animada (explosão, fumaça, clarão, vapor): k de 0 a 1
        function quadroAnimado(seq, k, px, py, tamanho, alfa = 1) {
            const i = Math.min(8, Math.max(0, Math.floor(k * 9)));
            const q = ATLAS_CENA[seq + i];
            if (!q || !atlasPronto) return;
            const [x, y, w, h] = q, f = tamanho / Math.max(w, h);
            cctx.globalAlpha = alfa;
            cctx.drawImage(atlasImg, x, y, w, h, px - w * f / 2, py - h * f / 2, w * f, h * f);
            cctx.globalAlpha = 1;
        }
        function desenharSoldadoCena(s, x, y, pose, t, rotY = 0) {
            const flash = (feridosRecentes.get(s.id) || 0) > 0 && Math.floor(t / 80) % 2 === 0;
            const corpo = flash ? '#a83232' : (s.class === 'Médico' ? '#5f6b4c' : '#5d6b48');
            const pele = { 1: '#c99a74', 2: '#7a4f33', 3: '#e2b996', 4: '#a8714c', 5: '#d9a988', 6: '#b98159' }[s.id] || '#c99a74';
            const POSE_SILHUETA = { mira: 'mira', ninho: 'ninho', come: 'come', trabalho: 'trabalho', deitado: 'deitado', encolhido: 'panico', panico: 'panico', 'em pé': 'arrastado' };
            const usouBoneco = !!desenharSilhueta(s, x, y, POSE_SILHUETA[pose] || 'mira', t);
            if (usouBoneco && pose === 'deitado' && mentalDe(s) !== 'panico') txtC(x - 16 + Math.sin(t / 500) * 2, y - 16 - (t / 60) % 10, 'z', '#b3c4ae', 9, 700);
            if (!usouBoneco) {
            const balanco = Math.sin(t / 400 + s.id) * 0.8;
            if (pose === 'deitado') {
                cctx.fillStyle = corpo; cctx.fillRect(x - 16, y - 6, 30, 7);
                cctx.fillStyle = pele; cctx.beginPath(); cctx.arc(x + 15, y - 4, 5, 0, Math.PI * 2); cctx.fill();
                cctx.fillStyle = '#3e4a33'; cctx.beginPath(); cctx.arc(x + 15, y - 6, 5, Math.PI, 0); cctx.fill();
                if (mentalDe(s) !== 'panico') txtC(x + 22 + Math.sin(t / 500) * 2, y - 12 - (t / 60) % 8, 'z', '#b3c4ae', 8, 700);
            } else {
                const yb = y + (pose === 'trabalho' ? Math.abs(Math.sin(t / 150)) * -1.5 : balanco * 0.4);
                cctx.fillStyle = corpo; cctx.fillRect(x - 5, yb - 22, 10, 18);
                cctx.fillStyle = '#3a3a2c'; cctx.fillRect(x - 4, y - 4, 3, 10); cctx.fillRect(x + 1, y - 4, 3, 10);
                const dx = pose === 'mira' ? 3 : 0;
                cctx.fillStyle = pele; cctx.beginPath(); cctx.arc(x + dx, yb - 27, 5, 0, Math.PI * 2); cctx.fill();
                cctx.fillStyle = s.class === 'Médico' ? '#5b6447' : '#3e4a33'; cctx.beginPath(); cctx.arc(x + dx, yb - 29, 6, Math.PI, 0); cctx.fill();
                if (s.class === 'Médico') { cctx.fillStyle = '#e8e3d6'; cctx.fillRect(x - 2 + dx, yb - 35, 4, 4); cctx.fillStyle = '#b4252a'; cctx.fillRect(x - 1 + dx, yb - 35, 2, 4); }
                cctx.strokeStyle = '#222'; cctx.lineWidth = 2.5;
                if (pose === 'mira') { cctx.beginPath(); cctx.moveTo(x + 2, yb - 18); cctx.lineTo(x + 22, yb - 26); cctx.stroke(); }
                if (pose === 'trabalho') { cctx.strokeStyle = '#888'; const a = Math.sin(t / 150) * 0.6; cctx.beginPath(); cctx.moveTo(x + 4, yb - 16); cctx.lineTo(x + 4 + 12 * Math.cos(a), yb - 16 + 12 * Math.sin(a)); cctx.stroke(); }
                if (pose === 'come') { cctx.fillStyle = '#9a9a8a'; cctx.fillRect(x + 4, yb - 16, 6, 4); }
                if (pose === 'encolhido') { cctx.fillStyle = 'rgba(0,0,0,0.35)'; cctx.fillRect(x - 6, yb - 34, 12, 30); }
            }
            }
            // nome e barrinha de vida
            const sel = s.id === soldadoSelecionado;
            txtC(x, y + 16 + rotY, s.name, sel ? '#ffe08a' : '#cfe0c4', 7.5, 700, 'center');
            cctx.fillStyle = '#222b25'; cctx.fillRect(x - 10, y + 19 + rotY, 20, 2.5);
            cctx.fillStyle = s.hp > 50 ? '#5a7356' : '#c0392b'; cctx.fillRect(x - 10, y + 19 + rotY, 20 * Math.max(0, s.hp) / 100, 2.5);
            const deitado = pose === 'deitado';
            if (sel) { cctx.strokeStyle = 'rgba(255,224,138,0.8)'; cctx.lineWidth = 1.2; cctx.setLineDash([3, 2]); if (deitado) cctx.strokeRect(x - 26, y - 16, 54, 40); else cctx.strokeRect(x - 16, y - 40 * CORTE.ESC, 32, 40 * CORTE.ESC + 24 + rotY); cctx.setLineDash([]); }
            // avisos em cima da cabeça: só aparece o que está ruim (amarelo = atenção, vermelho = crítico)
            // Na cabeça só vida, fome, sede e cansaço; a moral fica no cartão e no resumo (o vermelho confundia com vida baixa)
            const avisos = avisosDoSoldado(s).filter(a => a.nome !== 'moral baixa');
            if (avisos.length) {
                const deit = pose === 'deitado';
                avisos.forEach((a, i) => {
                    // deitado: em fila acima; em pé: em coluna ao lado da cabeça (não cobre o nome do cômodo)
                    const ax = deit ? x - 18 + i * 11 : x - 16;
                    const topo = deit ? y - 24 : y - 44 * CORTE.ESC + i * 10.5;
                    const pul = a.critico ? 1 + 0.12 * Math.sin(t / 150) : 1;
                    cctx.fillStyle = a.critico ? 'rgba(170,30,30,0.92)' : 'rgba(170,130,30,0.9)';
                    cctx.beginPath(); cctx.arc(ax, topo, 5.2 * pul, 0, Math.PI * 2); cctx.fill();
                    cctx.font = '7px sans-serif'; cctx.textAlign = 'center'; cctx.fillStyle = '#fff'; cctx.fillText(a.icone, ax, topo + 2.5); cctx.textAlign = 'left';
                });
            }
            // estado mental e medalhas
            const m = mentalDe(s);
            if (m) {
                const rot = { panico: '😱 PÂNICO', apatia: '😶 APÁTICO', heroismo: '🔥 HEROICO' }[m];
                const cor = m === 'heroismo' ? 'rgba(60,90,50,0.92)' : 'rgba(160,30,30,0.9)';
                cctx.font = '700 7.5px "Courier Prime", monospace';
                const wl = cctx.measureText(rot).width + 8;
                const ty = deitado ? y - 30 : y - 52 * CORTE.ESC;
                cctx.fillStyle = cor; cctx.fillRect(x - wl / 2, ty, wl, 11);
                txtC(x, ty + 8, rot, '#ffeedd', 7.5, 700, 'center');
            }
            // alvo da artilharia
            if (soldadoMarcado(s)) {
                const pis = 0.5 + 0.45 * Math.sin(t / 110);
                cctx.strokeStyle = `rgba(255,74,60,${pis})`; cctx.lineWidth = 2;
                const cy = pose === 'deitado' ? y - 5 : y - 18 * CORTE.ESC;
                cctx.beginPath(); cctx.arc(x, cy, 15, 0, Math.PI * 2); cctx.stroke();
                cctx.beginPath(); cctx.moveTo(x - 21, cy); cctx.lineTo(x - 10, cy); cctx.moveTo(x + 10, cy); cctx.lineTo(x + 21, cy); cctx.moveTo(x, cy - 21); cctx.lineTo(x, cy - 10); cctx.moveTo(x, cy + 10); cctx.lineTo(x, cy + 21); cctx.stroke();
            }
        }

        // Onde cada soldado fica dentro do seu cômodo
        function layoutSoldados() {
            const porComodo = {};
            gameState.squad.forEach(s => { const c = comodoDoSoldado(s); if (c) (porComodo[c] = porComodo[c] || []).push(s); });
            const pos = {};
            Object.entries(porComodo).forEach(([chave, lista]) => {
                const c = CORTE.comodos[chave];
                lista.forEach((s, k) => {
                    if (chave === 'abrigo') {
                        const leito = k % 3, andar = Math.floor(k / 3) % 2;
                        pos[s.id] = mentalDe(s) === 'panico'
                            ? { x: c.x + 30 + leito * 66, y: c.y + 106, pose: 'panico', comodo: chave } // encolhido no chão, tremendo
                            : { x: c.x + 36 + leito * 66, y: c.y + (andar ? 90 : 64), pose: 'deitado', comodo: chave };
                    } else {
                        const passo = c.w / (lista.length + 1);
                        const baseY = { posto: c.y + 97, ninhos: c.y + 102, cozinha: c.y + 112, oficina: c.y + 113 }[chave];
                        const pose = { posto: 'mira', ninhos: 'ninho', cozinha: 'come', oficina: 'trabalho' }[chave];
                        // Nomes de soldados muito próximos alternam a altura para não se sobrepor
                        pos[s.id] = { x: chave === 'cozinha' && lista.length > 1 ? c.x + 22 + (c.w - 46) * k / (lista.length - 1) : c.x + passo * (k + 1) - (chave === 'cozinha' ? 8 : 0), y: baseY, pose, comodo: chave, rotY: passo < 40 && k % 2 ? 9 : 0 };
                    }
                });
            });
            return { pos, porComodo };
        }

        function desenharEfeitosCena() {
            for (let i = cenaEfeitos.length - 1; i >= 0; i--) {
                const ef = cenaEfeitos[i];
                ef.idade++;
                if (ef.idade > ef.vida) { cenaEfeitos.splice(i, 1); continue; }
                const k = ef.idade / ef.vida;
                const p = ef.fixo || posAlvoCena(ef.alvo);
                if (ef.tipo === 'explosao') {
                    // clarão que ilumina o que está em volta (soma luz) e onda de choque
                    const luz = Math.max(0, 1 - k * 2.2);
                    if (luz > 0) {
                        cctx.save(); cctx.globalCompositeOperation = 'lighter'; cctx.globalAlpha = 0.55 * luz;
                        cctx.drawImage(brilhoLamparina, p.x - 70, p.y - 14 - 70, 140, 140); cctx.restore();
                    }
                    if (k < 0.5) { cctx.strokeStyle = `rgba(255,220,170,${0.5 * (1 - k * 2)})`; cctx.lineWidth = 1.6; cctx.beginPath(); cctx.arc(p.x, p.y - 12, 10 + k * 70, 0, Math.PI * 2); cctx.stroke(); }
                    // estilhaços
                    cctx.fillStyle = `rgba(255,200,120,${1 - k})`;
                    for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2 + ef.sx * 6, d = 4 + k * 34 * (0.6 + (q % 3) * 0.25); cctx.fillRect(p.x + Math.cos(a) * d, p.y - 12 + Math.sin(a) * d * 0.8 + k * k * 14, 1.6, 1.6); }
                }
                if (ef.tipo === 'explosao' && atlasPronto) {
                    quadroAnimado('explosao', Math.min(1, k * 1.6), p.x, p.y - 14, 46, 1);
                    if (k > 0.35) quadroAnimado('fumaca', (k - 0.35) / 0.65, p.x + 4, p.y - 26 - 18 * k, 40, 0.8 * (1 - k));
                } else if (ef.tipo === 'explosao') {
                    const r = 8 + 26 * k;
                    cctx.globalAlpha = 1 - k;
                    cctx.fillStyle = '#e0882b'; cctx.beginPath(); cctx.arc(p.x, p.y - 10, r * 0.7, 0, Math.PI * 2); cctx.fill();
                    cctx.fillStyle = '#ffd08a'; cctx.beginPath(); cctx.arc(p.x, p.y - 10, r * 0.35, 0, Math.PI * 2); cctx.fill();
                    cctx.fillStyle = 'rgba(80,80,70,0.7)'; cctx.beginPath(); cctx.arc(p.x + 6, p.y - 20 - 20 * k, r * 0.6, 0, Math.PI * 2); cctx.fill();
                    cctx.globalAlpha = 1;
                } else if (ef.tipo === 'fogo') {
                    if (atlasPronto) for (let f = 0; f < 2; f++) { const kk = ((ef.idade / 70) + f * 0.5) % 1; quadroAnimado('fumaca', kk, p.x - 8 + f * 16, p.y - 12 - kk * 34, 22 + kk * 18, 0.7 * (1 - k)); }
                    for (let f = 0; f < 4; f++) {
                        const fx = p.x - 20 + f * 12 + Math.sin(ef.idade / 5 + f) * 2, alt = 10 + 8 * Math.abs(Math.sin(ef.idade / 7 + f * 2));
                        cctx.globalAlpha = 0.85 * (1 - k);
                        cctx.fillStyle = f % 2 ? '#f0a040' : '#e05a20';
                        cctx.beginPath(); cctx.moveTo(fx - 5, p.y + 6); cctx.quadraticCurveTo(fx, p.y + 6 - alt * 2, fx + 5, p.y + 6); cctx.fill();
                    }
                    cctx.globalAlpha = 1;
                } else if (ef.tipo === 'abate' && atlasPronto) {
                    quadroAnimado('vapor', k, p.x, p.y, 18 + 10 * k, 1 - k);
                } else if (ef.tipo === 'abate') {
                    cctx.globalAlpha = 1 - k; cctx.fillStyle = '#b3c4ae';
                    cctx.beginPath(); cctx.arc(p.x, p.y, 4 + 10 * k, 0, Math.PI * 2); cctx.fill(); cctx.globalAlpha = 1;
                } else if (ef.tipo === 'numero') {
                    // número que sobe e some (dano, prestígio); desvia um pouco para os lados
                    const sobe = 22 * (1 - Math.pow(1 - k, 2));
                    cctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
                    txtC(p.x + (ef.sx - 0.5) * 16, p.y - 30 - sobe, ef.alvo.txt, ef.alvo.cor, ef.alvo.tam || 10, 700, 'center', 11);
                    cctx.globalAlpha = 1;
                } else if (ef.tipo === 'dia') {
                    // faixa grande que aparece e some devagar
                    const a = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
                    cctx.globalAlpha = 0.9 * a;
                    cctx.fillStyle = 'rgba(0,0,0,0.5)'; cctx.fillRect(0, 62 - 14, CORTE.W, 58);
                    cctx.globalAlpha = a;
                    txtC(200, 62 + 18, `DIA ${ef.alvo.dia}`, '#d9a35a', 26, 700, 'center', 28);
                    txtC(200, 62 + 33, ef.alvo.sub, '#b3c4ae', 9, 500, 'center', 10);
                    cctx.globalAlpha = 1;
                } else if (ef.tipo === 'morte') {
                    cctx.globalAlpha = 0.35 * (1 - k); cctx.fillStyle = '#8b0000'; cctx.fillRect(0, 0, CORTE.W, CORTE.H); cctx.globalAlpha = 1;
                } else if (typeof desenharEfeitoExtra === 'function') desenharEfeitoExtra(ef, k, p); // efeitos de 08-campo-ameacas.js
            }
        }


        function desenharClimaCena(t) {
            const w = gameState.weather;
            if (w === 'Chuva Forte') {
                cctx.strokeStyle = 'rgba(150,170,190,0.35)'; cctx.lineWidth = 1;
                cctx.beginPath();
                for (let i = 0; i < 70; i++) { const x = (i * 57 + t / 4) % 410 - 5, y = (i * 31 + t / 2.2) % CORTE.SOLO; cctx.moveTo(x, y); cctx.lineTo(x - 3, y + 9); }
                cctx.stroke();
            } else if (w === 'Neve') {
                cctx.fillStyle = 'rgba(230,235,240,0.75)';
                for (let i = 0; i < 60; i++) { const x = ((i * 67) + Math.sin(t / 700 + i) * 12) % 400, y = (i * 29 + t / 18) % CORTE.SOLO; cctx.fillRect(x, y, 2, 2); }
            } else if (w === 'Névoa Espessa') {
                cctx.fillStyle = 'rgba(170,180,170,0.22)'; cctx.fillRect(0, 0, CORTE.W, CORTE.SOLO);
            }
        }

        function desenharRodapeCena() {
            const y0 = 410;
            cctx.fillStyle = '#0f1411'; cctx.fillRect(0, y0, CORTE.W, CORTE.H - y0);
            const barra = (x, y, w, v, cor) => { cctx.fillStyle = '#222b25'; cctx.fillRect(x, y, w, 4); cctx.fillStyle = cor; cctx.fillRect(x, y, w * Math.max(0, Math.min(1, v)), 4); };
            const tr = gameState.trench;
            txtC(10, y0 + 16, `TRINCHEIRA ${Math.round(tr)}%${trincheiraRompida() ? ' · ROMPIDA' : ''}`, trincheiraRompida() ? '#ff5c5c' : '#8fad88', 8.5);
            barra(10, y0 + 20, 120, tr / 100, tr > 50 ? '#5a7356' : tr > 20 ? '#d9a35a' : '#c0392b');
            const cb = gameState.combate || { tiros: 0, abates: 0 };
            const noite = periodoDoDia() >= 2;
            txtC(150, y0 + 16, noite && !gameState.tacticalOrders.FULL_VIGILANCE ? `NOITE · −${Math.round(100 * (1 - miraDeNoite()))}% DE MIRA` : `TIROS ${cb.tiros} · ABATES ${cb.abates}`, '#d9a35a', 8.5);
            // avisos recentes (somem sozinhos); sem avisos, a dica de como jogar
            const agora = performance.now();
            while (avisosCena.length && agora - avisosCena[0].t0 > 7000) avisosCena.shift();
            if (avisosCena.length) {
                avisosCena.slice(-2).forEach((a, i, l) => {
                    const idade = agora - a.t0, alfa = idade < 5500 ? 1 : 1 - (idade - 5500) / 1500;
                    cctx.globalAlpha = Math.max(0, alfa); txtC(10, y0 + 40 + i * 13, a.txt, a.cor, 8, 600, 'left', 10); cctx.globalAlpha = 1;
                });
            } else {
                txtC(10, y0 + 40, 'Arraste um soldado para outro cômodo para trocar a função.', '#8fa088', 7.5, 500, 'left', 9.5);
                txtC(10, y0 + 53, 'Toque nele para ver o estado e as ações.', '#8fa088', 7.5, 500, 'left', 9.5);
            }
        }

        // Resumo da ameaça para a faixa: quem vem e em quanto tempo entra no alcance de tiro
        function resumoAmeaca() {
            const en = gameState.enemies.filter(e => !(typeof inimigoOculto === 'function' && inimigoOculto(e))), cont = { infantaria: 0, patrulha: 0, drone: 0, blindado: 0 };
            en.forEach(e => { cont[e.type] = (cont[e.type] || 0) + 1; });
            let eta = Infinity;
            en.forEach(e => { if (e.type === 'drone') return; const v = ENEMY_TYPES[e.type].speed * (gameState.tacticalOrders.SUPPRESSION && gameState.resources.ammoHeavy > 3 ? 0.3 : 1); eta = Math.min(eta, Math.max(0, (e.distance - 140) / v)); });
            const partes = [];
            if (cont.infantaria) partes.push(cont.infantaria + ' inf.'); if (cont.patrulha) partes.push(cont.patrulha + ' patr.');
            if (cont.drone) partes.push(cont.drone + ' drone'); if (cont.blindado) partes.push(cont.blindado + ' blind.');
            if (cont.infiltrado) partes.push(cont.infiltrado + ' infiltr.'); if (cont.sapador) partes.push(cont.sapador + ' lança-chamas');
            if (!partes.length) return '⚠ movimento suspeito no escuro…';
            const alvo = isFinite(eta) ? (eta <= 0 ? 'NO ALCANCE' : `alcance em ${Math.max(1, Math.ceil(eta / GAME_CONFIG.TICKS_PER_SECOND))}s`) : '';
            return `⚠ ${partes.join(' · ')}${alvo ? ' · ' + alvo : ''}`;
        }

        function renderCorte(forcar) {
            const t = performance.now();
            // No máximo ~40 quadros por segundo (economiza bateria); no celular lento, reduz a resolução sozinho
            if (!forcar && t - ultimoQuadroCorte < 22) return;
            if (ultimoQuadroCorte && !forcar) {
                const dt = t - ultimoQuadroCorte;
                if (dt > 55 && dt < 400) { if (++corteLentos > 25 && corteQualidade > 1) { corteQualidade = Math.max(1, corteQualidade - 0.25); corteLentos = 0; } }
                else if (dt < 42) corteLentos = Math.max(0, corteLentos - 1);
            }
            ultimoQuadroCorte = t;
            const esc = corteRedimensionar();
            // Fundo em cache: só repinta quando algo que ele mostra mudou
            const sig = assinaturaDoFundo();
            if (sig !== assinaturaFundo) {
                assinaturaFundo = sig;
                const real = cctx; cctx = ctxFundo;
                cctx.setTransform(esc, 0, 0, esc, 0, 0); cctx.clearRect(0, 0, CORTE.W, CORTE.H);
                desenharFundoCompleto();
                cctx = real;
            }
            cctx.setTransform(1, 0, 0, 1, 0, 0);
            cctx.clearRect(0, 0, corteCanvas.width, corteCanvas.height);
            cctx.drawImage(camadaFundo, 0, 0);
            cctx.setTransform(esc, 0, 0, esc, 0, 0);
            desenharNuvens(t);
            desenharInimigosCena(t);
            const { pos, porComodo } = layoutSoldados();
            Object.keys(CORTE.comodos).forEach(k => desenharComodoViva(k, (porComodo[k] || []).length));
            desenharMoveisViva(t);
            desenharTirosCena(pos, t);
            posicoesCena = {};
            gameState.squad.forEach(s => {
                const p = pos[s.id];
                if (!p) { delete animPos[s.id]; return; }
                let { x, y } = p;
                let pose = p.pose;
                if (arrasto && arrasto.moveu && arrasto.id === s.id) { x = arrasto.x; y = arrasto.y + 18 * CORTE.ESC; pose = 'em pé'; animPos[s.id] = { x, y }; }
                else {
                    // Caminha até a nova posição em vez de aparecer lá de repente
                    const a = animPos[s.id] || (animPos[s.id] = { x, y });
                    a.x += (x - a.x) * 0.09; a.y += (y - a.y) * 0.09;
                    if (Math.hypot(x - a.x, y - a.y) > 2.5) { pose = 'em pé'; x = a.x; y = a.y; } else { a.x = x; a.y = y; }
                }
                posicoesCena[s.id] = { x, y };
                desenharSoldadoCena(s, x, y, pose, t, pose === p.pose ? (p.rotY || 0) : 0);
            });
            { const nn = CORTE.comodos.ninhos; cctx.fillStyle = '#7d7056'; cctx.fillRect(nn.x + 4, nn.y + 94, nn.w - 8, 12); cctx.strokeStyle = '#5d533f'; cctx.lineWidth = 1; for (let xx = nn.x + 4; xx < nn.x + nn.w - 8; xx += 14) cctx.strokeRect(xx, nn.y + 94, 14, 12); }
            desenharClimaCena(t);
            desenharEfeitosCena();
            desenharRodapeCena();
            // faixa de aviso e selo de pausa da cena
            const bCorte = document.getElementById('corte-banner');
            const bar = gameState.barrage, haInimigo = gameState.enemies.length > 0, ofTxt = avisoOfensiva();
            bCorte.classList.toggle('hidden', !(bar || haInimigo || ofTxt));
            let txt = '';
            if (bar) txt = `💥 ARTILHARIA EM ${seg(bar.ticks)}s · ${(bar.alvos || []).length || 3} ALVOS${droneObservando() ? ' · GUIADA POR DRONE' : ''}`;
            else if (haInimigo) txt = resumoAmeaca();
            else if (ofTxt) txt = ofTxt;
            if (bCorte.textContent !== txt) bCorte.textContent = txt;

            document.getElementById('corte-pausa').classList.toggle('hidden', !jogoPausado);
            if (cartaoAberto && Math.floor(t / 100) !== Math.floor((t - 17) / 100)) renderCartao();
        }

        // ---------- toque e arrasto ----------
        function pontoNaCena(clientX, clientY) {
            const r = corteCanvas.getBoundingClientRect();
            return { x: (clientX - r.left) * CORTE.W / r.width, y: (clientY - r.top) * CORTE.H / r.height };
        }
        function comodoEm(x, y) {
            return Object.keys(CORTE.comodos).find(k => { const c = CORTE.comodos[k]; return x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h; }) || null;
        }
        function soldadoEm(x, y) {
            let melhor = null, dist = 26 * CORTE.ESC;
            Object.entries(posicoesCena).forEach(([id, p]) => {
                const d = Math.hypot(p.x - x, (p.y - 12 * CORTE.ESC) - y);
                if (d < dist) { dist = d; melhor = Number(id); }
            });
            return melhor;
        }
        function inicioToque(cx, cy) {
            const p = pontoNaCena(cx, cy);
            const id = soldadoEm(p.x, p.y);
            if (id) { arrasto = { id, x: p.x, y: p.y, x0: p.x, y0: p.y, moveu: false }; return true; }
            return false;
        }
        function moveToque(cx, cy) {
            if (!arrasto) return;
            document.getElementById('corte-dica').classList.add('hidden');
            const p = pontoNaCena(cx, cy);
            arrasto.x = p.x; arrasto.y = p.y;
            if (Math.hypot(p.x - arrasto.x0, p.y - arrasto.y0) > 8) arrasto.moveu = true;
        }
        function fimToque(cx, cy) {
            const p = cx === undefined ? { x: arrasto ? arrasto.x : 0, y: arrasto ? arrasto.y : 0 } : pontoNaCena(cx, cy);
            if (arrasto) {
                const a = arrasto; arrasto = null;
                if (a.moveu) {
                    const destino = comodoEm(p.x, p.y);
                    if (destino && destino !== comodoDoSoldado(gameState.squad.find(m => m.id === a.id))) moverParaComodo(a.id, destino);
                } else {
                    selecionarSoldado(a.id);
                    abrirCartao(a.id);
                }
                return;
            }
            // Toque num cômodo com um soldado selecionado: manda ele para lá
            const destino = comodoEm(p.x, p.y);
            const sel = gameState.squad.find(m => m.id === soldadoSelecionado && m.hp > 0);
            if (destino && sel && destino !== comodoDoSoldado(sel)) { moverParaComodo(sel.id, destino); assinaturaCartao = ''; return; }
            fecharCartao(); // toque num lugar vazio fecha o cartão
        }
        corteCanvas.addEventListener('mousedown', e => { inicioToque(e.clientX, e.clientY); });
        window.addEventListener('mousemove', e => { if (arrasto) moveToque(e.clientX, e.clientY); });
        window.addEventListener('mouseup', e => { if (arrasto || e.target === corteCanvas) fimToque(e.clientX, e.clientY); });
        corteCanvas.addEventListener('touchstart', e => { const t0 = e.touches[0]; if (inicioToque(t0.clientX, t0.clientY)) e.preventDefault(); }, { passive: false });
        corteCanvas.addEventListener('touchmove', e => { if (arrasto) { const t0 = e.touches[0]; moveToque(t0.clientX, t0.clientY); e.preventDefault(); } }, { passive: false });
        corteCanvas.addEventListener('touchend', e => { const t0 = e.changedTouches[0]; fimToque(t0.clientX, t0.clientY); if (e.cancelable) e.preventDefault(); }, { passive: false });


        // O que está ruim no soldado (para os avisos na cabeça, o cartão e o resumo)
        function avisosDoSoldado(s) {
            const av = [];
            const add = (cond, crit, icone, nome) => { if (crit) av.push({ icone, nome, critico: true }); else if (cond) av.push({ icone, nome, critico: false }); };
            add(s.hp < 50, s.hp < 25, '❤', 'ferido');
            add(s.hunger >= 50, s.hunger >= 75, '🍞', 'fome');
            add(s.thirst >= 50, s.thirst >= 75, '💧', 'sede');
            add(s.fatigue >= 60, s.fatigue >= 85, '😴', 'cansaço');
            add(s.moral < 40, s.moral < 20, '😟', 'moral baixa');
            return av;
        }

        // ---------- cartão rápido (toque no soldado) ----------
        let cartaoAberto = false, assinaturaCartao = '';
        function abrirCartao(id) {
            soldadoSelecionado = id;
            cartaoAberto = true; assinaturaCartao = '';
            renderCartao(true);
        }
        function fecharCartao() {
            cartaoAberto = false;
            document.getElementById('corte-cartao').classList.add('hidden');
        }
        function cartaoFuncao(duty) {
            const s = gameState.squad.find(m => m.id === soldadoSelecionado);
            if (!s) return;
            if (duty === 'WATCH' && comodoDoSoldado(s) === 'ninhos') return;
            setSoldierDuty(s.id, duty);
            lastSquadSignature = ''; assinaturaCartao = '';
            updateUI();
        }
        function barraCartao(rot, v, ruimAlto) {
            const val = Math.max(0, Math.min(100, Math.round(v)));
            const ruim = ruimAlto ? val : 100 - val;
            const cor = ruim >= 75 ? '#c0392b' : ruim >= 50 ? '#d9a35a' : '#5a7356';
            return `<div class="flex items-center gap-1"><span class="w-9 text-mil-textMuted">${rot}</span><div class="flex-1 h-1 bg-black/60 rounded"><div class="h-1 rounded" style="width:${val}%;background:${cor}"></div></div><span class="w-5 text-right font-bold" style="color:${cor}">${val}</span></div>`;
        }
        function renderCartao(posicionar) {
            const el = document.getElementById('corte-cartao');
            const s = gameState.squad.find(m => m.id === soldadoSelecionado);
            if (!cartaoAberto || !s || s.hp <= 0 || s.deserted) { el.classList.add('hidden'); cartaoAberto = cartaoAberto && !!s && s.hp > 0; return; }
            const m = mentalDe(s), comodo = comodoDoSoldado(s);
            const sig = JSON.stringify([s.id, Math.round(s.hp), Math.round(s.fatigue), Math.round(s.hunger), Math.round(s.thirst), Math.round(s.moral), s.duty, m, comodo, soldadoMarcado(s)]);
            if (sig !== assinaturaCartao) {
                assinaturaCartao = sig;
                const p = PERFIS[s.id] || {};
                const btn = (duty, rot) => `<button onclick="cartaoFuncao('${duty}')" class="py-0.5 rounded font-bold ${s.duty === duty ? 'bg-mil-olive text-white border border-mil-greenMuted' : 'bg-black/50 text-mil-textMuted border border-mil-border'}">${rot}</button>`;
                const av = avisosDoSoldado(s);
                el.innerHTML = `
                    <div class="flex justify-between items-start gap-2">
                        <div class="min-w-0">
                            <div class="font-bold text-[#ffe08a] truncate text-[11px]">${s.rank} ${s.name}${p.traco ? ' <span class="font-normal text-mil-amberMuted">· ' + p.traco.nome + '</span>' : ''}</div>
                            <div class="text-mil-textGlow truncate">${((CORTE.comodos[comodo] || {}).nome || '').split(' (')[0].toLowerCase()}${m ? ` · <span class="${m === 'heroismo' ? 'text-mil-greenMuted' : 'text-red-400'} font-bold">${ROTULO_MENTAL[m]}</span>` : ''}${soldadoMarcado(s) ? ' · <span class="text-red-400 font-bold">🎯 ALVO</span>' : ''}</div>
                        </div>
                        <button onclick="fecharCartao()" class="px-1.5 text-mil-textMuted text-sm leading-none" aria-label="Fechar">✕</button>
                    </div>
                    <div class="space-y-px mt-0.5">
                        ${barraCartao('Vida', s.hp, false)}${barraCartao('Fadiga', s.fatigue, true)}${barraCartao('Fome', s.hunger, true)}${barraCartao('Sede', s.thirst, true)}${barraCartao('Moral', s.moral, false)}
                    </div>
                    ${av.length ? `<div class="mt-0.5 ${av.some(a => a.critico) ? 'text-red-400' : 'text-mil-amberMuted'}">${av.map(a => a.icone + ' ' + a.nome).join(' · ')}</div>` : ''}
                    <div class="grid grid-cols-4 gap-0.5 mt-1 text-[9px]">${btn('WATCH', 'Vigília')}${btn('REST', 'Desc.')}${btn('MAINTENANCE', 'Manut.')}${btn('RATIONING', 'Coz.')}</div>
                    <button onclick="fecharCartao(); abrirPerfil(${s.id})" class="w-full mt-1 py-0.5 btn-tactical rounded font-bold"><i class="fa-solid fa-id-card"></i> Ficha completa</button>`;
            }
            el.classList.remove('hidden');
            // Posiciona perto do soldado, sem sair da cena (acima se couber, senão abaixo)
            const pos = posicoesCena[s.id];
            if (pos && (posicionar || true)) {
                const r = corteCanvas.getBoundingClientRect(), esc = r.width / CORTE.W;
                const cx = pos.x * esc, cy = pos.y * esc;
                const w = el.offsetWidth || 240, h = el.offsetHeight || 190;
                // Abre sempre no andar de baixo, do lado oposto ao soldado: o posto, os ninhos, a cozinha
                // e o depósito ficam livres; o cômodo coberto (abrigo ou oficina) tem botão no próprio cartão
                const left = cx < r.width / 2 ? r.width - w - 6 : 6;
                const top = Math.max(4, Math.min(r.height - h - 4, CORTE.comodos.abrigo.y * esc + 2));
                el.style.left = left + 'px'; el.style.top = top + 'px';
            }
        }

        // ---------- resumo ao passar o mouse (computador) ----------
        const temMouse = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        function mostrarDica(cx, cy) {
            const dica = document.getElementById('corte-dica');
            if (!temMouse || arrasto) { dica.classList.add('hidden'); return; }
            const p = pontoNaCena(cx, cy), id = soldadoEm(p.x, p.y);
            const s = id && gameState.squad.find(m => m.id === id);
            if (!s || (cartaoAberto && id === soldadoSelecionado)) { dica.classList.add('hidden'); corteCanvas.style.cursor = ''; return; }
            corteCanvas.style.cursor = 'grab';
            const av = avisosDoSoldado(s), m = mentalDe(s);
            dica.innerHTML = `<b class="text-[#ffe08a]">${s.rank} ${s.name}</b> · ${(CORTE.comodos[comodoDoSoldado(s)] || {}).nome || ''}<br>` +
                `Vida ${Math.round(s.hp)} · Fadiga ${Math.round(s.fatigue)} · Fome ${Math.round(s.hunger)} · Sede ${Math.round(s.thirst)} · Moral ${Math.round(s.moral)}` +
                (m ? `<br>${ROTULO_MENTAL[m]}` : '') + (av.length ? `<br><span class="${av.some(a => a.critico) ? 'text-red-400' : 'text-mil-amberMuted'}">${av.map(a => a.icone + ' ' + a.nome).join(' · ')}</span>` : '') +
                `<br><span class="text-mil-textMuted">clique: ações · arraste: trocar de cômodo</span>`;
            dica.classList.remove('hidden');
            const r = corteCanvas.getBoundingClientRect();
            const w = dica.offsetWidth, h = dica.offsetHeight;
            let left = cx - r.left + 14, top = cy - r.top + 14;
            if (left + w > r.width - 4) left = cx - r.left - w - 14;
            if (top + h > r.height - 4) top = cy - r.top - h - 14;
            dica.style.left = Math.max(4, left) + 'px'; dica.style.top = Math.max(4, top) + 'px';
        }
        corteCanvas.addEventListener('mousemove', e => mostrarDica(e.clientX, e.clientY));
        corteCanvas.addEventListener('mouseleave', () => { document.getElementById('corte-dica').classList.add('hidden'); corteCanvas.style.cursor = ''; });
        // Toque fora do cartão e da cena fecha o cartão
        document.addEventListener('click', e => { if (cartaoAberto && !e.target.closest('#corte-cartao') && e.target !== corteCanvas) fecharCartao(); });


        // ---------- Contra-bateria rápida: botão grande embaixo do aviso de artilharia ----------
        function contraBateriaRapida() {
            if (gameState.tacticalOrders.SIGNAL_JAM) {
                // O rádio está ocupado: desliga o bloqueio e já pede, num toque só
                toggleTacticalOrder('SIGNAL_JAM');
                logFeed('📡 Bloqueio de Sinal desligado para pedir a contra-bateria.', 'text-mil-amberMuted');
            }
            requestSupport('COUNTER');
            renderBotaoContraBateria();
        }
        function renderBotaoContraBateria() {
            const b = gameState.barrage;
            ['btn-cb-corte'].forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                if (!b || gameEnded) { el.classList.add('hidden'); return; }
                el.classList.remove('hidden');
                const c = custo(50);
                let txt, cls, pode = false;
                const compacto = id === 'btn-cb-corte';
                if (gameState.counterBattery) {
                    const aTempo = gameState.counterBattery.ticks < b.ticks;
                    txt = compacto ? `CONTRA-BAT. ${seg(gameState.counterBattery.ticks)}s${aTempo ? '' : '!'}` : `💥 CONTRA-BATERIA A CAMINHO · ${seg(gameState.counterBattery.ticks)}s${aTempo ? '' : ' (pode chegar tarde)'}`;
                    cls = 'bg-black/85 border-mil-amberMuted text-mil-amberMuted';
                } else if (gameState.recargaContra > 0) {
                    txt = compacto ? `CB · recarga ${seg(gameState.recargaContra)}s` : `💥 CONTRA-BATERIA RECARREGANDO · ${seg(gameState.recargaContra)}s`;
                    cls = 'bg-black/85 border-mil-border text-mil-textMuted opacity-80';
                } else if (gameState.prestige < c) {
                    txt = compacto ? `CB · faltam ${c - Math.floor(gameState.prestige)}` : `💥 CONTRA-BATERIA · faltam ${c - Math.floor(gameState.prestige)} pts`;
                    cls = 'bg-black/85 border-mil-border text-mil-textMuted opacity-80';
                } else {
                    txt = compacto ? `💥 CONTRA-BAT. ${c}` : `💥 PEDIR CONTRA-BATERIA · ${c} PTS${gameState.tacticalOrders.SIGNAL_JAM ? ' (desliga o bloqueio)' : ''}`;
                    cls = 'bg-red-800 border-red-300 text-white animate-pulse';
                    pode = true;
                }
                if (el.textContent !== txt) el.textContent = txt;
                const classe = (id === 'btn-cb-corte' ? 'absolute right-1.5 top-1.5 z-30 px-2 h-7 rounded border-2 font-bold text-[11px] whitespace-nowrap shadow-2xl ' : 'absolute left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded border-2 font-bold text-xs whitespace-nowrap shadow-2xl ') + cls;
                if (el.className !== classe) el.className = classe;
                el.disabled = !pode;
            });
        }

        // ---------- troca de visual ----------
        function aplicarVisual() {
            document.body.classList.add('modo-corte');
            document.getElementById('barra-recursos').classList.remove('hidden');
            document.getElementById('corte-fichas').classList.remove('hidden');
            const abas = document.getElementById('barra-abas');
            const container = abas.closest('.max-w-md') || document.body;
            if (abas.parentElement !== container) container.appendChild(abas); // abas presas embaixo
            const tab = document.getElementById('tab-squad');
            if (tab) tab.textContent = 'TRINCHEIRA';
            const viva = gameState.squad.find(m => m.id === soldadoSelecionado && m.hp > 0) || gameState.squad.find(m => m.hp > 0);
            if (viva) soldadoSelecionado = viva.id;
            lastSquadSignature = '';
            updateUI();
        }

        // Fichas do modo corte: botões para escolher o soldado (a ficha completa vem logo abaixo)
        function renderFichasCorte() {
            const el = document.getElementById('corte-fichas');
            el.innerHTML = `<div class="text-mil-textMuted">Toque num soldado (aqui ou na cena) para ver a ficha. Arraste na cena para trocar de cômodo.</div>
                <div class="grid grid-cols-3 gap-1">${gameState.squad.map(s => {
                    const vivo = s.hp > 0 && !s.deserted;
                    const sel = s.id === soldadoSelecionado;
                    const m = mentalDe(s);
                    return `<button onclick="selecionarSoldado(${s.id})" ${vivo ? '' : 'disabled'} class="py-1 px-1 rounded border text-left ${sel ? 'border-[#ffe08a] bg-mil-oliveDark' : 'border-mil-border bg-black/40'} ${vivo ? '' : 'opacity-40'}">
                        <div class="font-bold ${sel ? 'text-[#ffe08a]' : 'text-mil-textGlow'} truncate">${s.name}${m ? ' ' + ROTULO_MENTAL[m].split(' ')[0] : ''}${soldadoMarcado(s) ? ' 🎯' : ''}</div>
                        <div class="text-mil-textMuted truncate">${vivo ? (CORTE.comodos[comodoDoSoldado(s)] || {}).nome.split(' ')[0].toLowerCase() + ' · ' + Math.round(s.hp) + '%' : (s.deserted ? 'desertou' : 'morto')}</div>
                    </button>`;
                }).join('')}</div>`;
        }

        function renderBarraRecursos() {
            const el = document.getElementById('barra-recursos');
            const r = gameState.resources;
            const cel = (rot, v, baixo) => `<div class="rec-corte ${baixo ? 'baixo' : ''}">${rot}<b>${v}</b></div>`;
            const html = cel('Ração', Math.floor(r.rations), r.rations < 10) + cel('Água', Math.floor(r.water) + 'L', r.water < 10) +
                cel('Munição', Math.floor(r.ammoRifle), r.ammoRifle < 150) + cel('Pesada', Math.floor(r.ammoHeavy), r.ammoHeavy < 20) +
                cel('Prestígio', Math.floor(gameState.prestige), false) + cel('Trinch.', Math.round(gameState.trench) + '%', gameState.trench <= 30);
            if (el.innerHTML !== html) el.innerHTML = html;
        }

        function setSoldierDuty(id, duty) {
            const soldier = gameState.squad.find(s => s.id === id);
            if (soldier && mentalDe(soldier) === 'panico') {
                logFeed(`😱 ${soldier.rank} ${soldier.name} está em pânico e não obedece por enquanto.`, 'text-mil-amberMuted');
                return;
            }
            if (soldier && soldier.hp > 0) {
                soldier.duty = duty;
                soldier.dutyBase = duty; soldier.autoMotivo = null; // escolha do jogador: a escala automática respeita
                updateUI();
                playTacticalBeep(750, 0.02);
            }
        }

        // Avisos importantes também aparecem na cena (rodapé) por alguns segundos
        const avisosCena = [];
        function avisoNaCena(msg, style) {
            const grave = /text-red-(400|500) font-bold/.test(style);
            const atencao = /text-mil-amberMuted font-bold/.test(style) && /pânico|apátic|heroic|fúria|ficou|recebeu|medalha|BLOQUEADOS|emboscad/i.test(msg);
            if (!grave && !atencao) return;
            if (/Nenhuma artilharia|insuficiente|Já há|Já existe/.test(msg)) return;
            const limpo = msg.replace(/\s+/g, ' ').slice(0, 78);
            if (avisosCena.length && avisosCena[avisosCena.length - 1].txt === limpo) return;
            avisosCena.push({ txt: limpo, cor: grave ? '#ff8a7a' : '#e8c070', t0: performance.now() });
            while (avisosCena.length > 3) avisosCena.shift();
        }
        function logFeed(msg, style = 'text-mil-textGlow', semCena = false) {
            if (!semCena) { try { avisoNaCena(msg, style); } catch (e) {} }
            const feed = document.getElementById('feed-log');
            const times = ['08:00', '13:00', '20:00', '03:00'];
            const cycleIndex = Math.min(3, Math.floor(gameState.timeSeconds / 60));

            const entry = document.createElement('div');
            entry.className = style;
            entry.textContent = `[D${gameState.day} ${times[cycleIndex]}] ${msg}`;
            feed.appendChild(entry);
            while (feed.childElementCount > 150) feed.removeChild(feed.firstElementChild);
            feed.scrollTop = feed.scrollHeight;
        }

        function addDiaryEntry(text) {
            const container = document.getElementById('diary-entries');
            const item = document.createElement('div');
            item.className = 'bg-mil-bg border-l-2 border-mil-amberMuted p-2 rounded';
            item.innerHTML = `<span class="text-mil-amberMuted font-bold">[DIA ${gameState.day}]</span><p class="mt-1 font-typewriter">${text}</p>`;
            container.prepend(item);
        }

