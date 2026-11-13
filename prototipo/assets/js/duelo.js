// FrontLine · Trincheiras online (duelo 1×1, melhor de 5)
// Cada rodada: 1 minuto para montar a defesa e o ataque em segredo → OK dos dois → os dois celulares
// calculam o mesmo resultado (duelo-motor.js) e mostram o replay. Quem vencer o duelo ganha 3 troféus.
// O servidor (Supabase) guarda só o duelo e os planos; window.DUELO_API permite testar com um servidor falso.
(function () {
    'use strict';
    const M = window.DueloMotor;
    const PRAZO = window.DUELO_PRAZO || 60;          // segundos para preparar cada rodada
    const POLL = window.DUELO_POLL || 2000;          // de quanto em quanto tempo pergunta ao servidor (ms)
    const WO_ESPERA = 3 * 60 * 1000;                 // adversário sumido: W.O. depois de 3 minutos
    const SUPABASE_URL = 'https://shoxvekaeuynlutkowqb.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_Tjf0FceJGTPHs81jG0R-fg_ZxF9urW5'; // chave pública (as tabelas têm RLS)
    const $app = document.getElementById('app');
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const linkDoJogo = () => (location.protocol.startsWith('http') ? '/' : 'ponto-alpha.html');

    // ---------- Servidor ----------
    function traduzir(m) {
        m = String(m || '');
        if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
        if (/already registered/i.test(m)) return 'Este e-mail já tem conta: use Entrar.';
        if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
        if (/fetch|network/i.test(m)) return 'Sem conexão. Tente de novo.';
        return m;
    }
    function criarApiSupabase() {
        if (!window.supabase || !window.supabase.createClient) throw new Error('Sem conexão com o servidor.');
        const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
        const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw new Error(traduzir(error.message)); return data; };
        return {
            async usuario() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
            async entrar(email, senha) { const { data, error } = await sb.auth.signInWithPassword({ email, password: senha }); if (error) throw new Error(traduzir(error.message)); return data.user; },
            async criarConta(email, senha) {
                const { data, error } = await sb.auth.signUp({ email, password: senha });
                if (error) throw new Error(traduzir(error.message));
                if (!data.session) throw new Error('Conta criada: confirme pelo link no seu e-mail e depois entre.');
                return data.user;
            },
            async sair() { await sb.auth.signOut(); },
            criar: (nome) => rpc('criar_duelo', { p_nome: nome }),
            entrarCodigo: (codigo, nome) => rpc('entrar_duelo', { p_codigo: codigo, p_nome: nome }),
            async buscar(id) {
                const d = await sb.from('duelos').select('*').eq('id', id).single();
                if (d.error) throw new Error(traduzir(d.error.message));
                const p = await sb.from('duelo_planos').select('rodada, jogador, plano, criado_em').eq('duelo_id', id);
                if (p.error) throw new Error(traduzir(p.error.message));
                return { duelo: d.data, planos: p.data || [] };
            },
            enviar: (id, rodada, plano) => rpc('enviar_plano', { p_duelo: id, p_rodada: rodada, p_plano: plano }),
            async status(id, rodada) { const r = await rpc('status_rodada', { p_duelo: id, p_rodada: rodada }); return (r && r[0]) || { eu: false, adversario: false }; },
            informar: (id, vencedor) => rpc('informar_resultado', { p_duelo: id, p_vencedor: vencedor }),
            wo: (id) => rpc('reivindicar_wo', { p_duelo: id }),
            cancelar: (id) => rpc('cancelar_duelo', { p_duelo: id }),
            async trofeus() { const r = await rpc('meus_trofeus'); return (r && r[0]) || { trofeus: 0, vitorias: 0, derrotas: 0 }; },
            procurar: (nome) => rpc('procurar_partida', { p_nome: nome }),
            async temporada() { const r = await rpc('minha_temporada'); return (r && r[0]) || { pontos: 0, vitorias: 0, derrotas: 0, posicao: null, jogadores: 0 }; },
            ranking: () => rpc('ranking_temporada'),
            temporadas: () => rpc('minhas_temporadas'),
            replay: (id) => rpc('replay_publico', { p_duelo: id }),
            async meusDuelos() {
                const { data, error } = await sb.from('duelos').select('*').in('estado', ['aguardando', 'jogando']).order('atualizado_em', { ascending: false }).limit(6);
                if (error) throw new Error(traduzir(error.message));
                return (data || []).filter(d => !(d.publico && d.estado === 'aguardando')); // a fila não aparece como duelo
            }
        };
    }
    let API, API_REAL;
    try { API = API_REAL = window.DUELO_API || criarApiSupabase(); } catch (e) { $app.innerHTML = `<div class="espera"><div class="icone">📡</div><div class="sub">${esc(e.message)}</div></div>`; return; }
    const FILA_BOT = window.DUELO_FILA_BOT || 40;   // segundos na fila até cair no bot de treino
    // Ligas pela pontuação da temporada (mês): +3 por vitória, -1 por derrota
    const LIGAS = [{ nome: 'Bronze', min: 0, icone: '🥉' }, { nome: 'Prata', min: 15, icone: '🥈' }, { nome: 'Ouro', min: 40, icone: '🥇' }, { nome: 'Platina', min: 90, icone: '💠' }, { nome: 'Diamante', min: 160, icone: '💎' }];
    const ligaDe = (pts) => LIGAS.filter(l => pts >= l.min).pop();
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

    // ---------- Bot de treino: um "servidor" só no aparelho, sem troféus ----------
    function apiDoBot() {
        const sem = Math.floor(Math.random() * 2000000000), nomes = ['Sgt. Ferro', 'Cabo Prado', 'Ten. Duarte', 'Cap. Viana', 'Sgt. Moura'];
        const d = { id: 'bot-' + Date.now(), codigo: 'TREINO', semente: sem, jogador_a: eu.id, nome_a: meuNome, jogador_b: 'bot', nome_b: '🤖 ' + nomes[sem % nomes.length], rodada: 1, estado: 'jogando', vencedor: null, wo: false, bot: true };
        const planos = [];
        const completas = () => { const l = []; for (let r = 1; ; r++) { const a = planos.find(p => p.rodada === r && p.jogador === eu.id), b = planos.find(p => p.rodada === r && p.jogador === 'bot'); if (!a || !b) break; l.push({ A: a.plano, B: b.plano }); } return l; };
        return Object.assign(Object.create(API_REAL), {
            bot: true,
            async buscar() { return { duelo: { ...d }, planos: planos.map(p => ({ ...p })) }; },
            async enviar(id, rodada, plano) {
                if (planos.some(p => p.rodada === rodada && p.jogador === eu.id)) return;
                const antes = M.estadoDoDuelo(sem, completas()), ultA = antes.rodadas.length ? antes.rodadas[antes.rodadas.length - 1].planoA : null;
                planos.push({ rodada, jogador: 'bot', plano: M.planoDoBot(antes.B, rodada, ultA, sem) }); // o bot decide sem ver o seu plano
                planos.push({ rodada, jogador: eu.id, plano }); d.rodada = rodada + 1;
            },
            async status() { return { eu: true, adversario: true }; },
            async informar(id, venc) { d.estado = 'fim'; d.vencedor = venc; return { ...d }; },
            async wo() { return { ...d }; },
            async cancelar() { d.estado = 'cancelado'; }
        });
    }

    // ---------- Estado da página ----------
    let eu = null;            // usuário logado
    let meuNome = 'Comandante';
    let duelo = null;         // linha do duelo
    let planosServ = [];      // planos visíveis
    let jogo = null;          // estado calculado pelo motor
    let tela = '';
    let timerPoll = null, timerPrazo = null, animacao = null;
    let plano = null;         // plano em montagem
    let enviando = false;
    const mem = (id) => { try { return JSON.parse(localStorage.getItem('frontline-duelo-' + id)) || { vistas: 0 }; } catch (e) { return { vistas: 0 }; } };
    const gravarMem = (id, m) => { try { localStorage.setItem('frontline-duelo-' + id, JSON.stringify(m)); } catch (e) {} };
    const souA = () => duelo && eu && duelo.jogador_a === eu.id;
    const lado = () => (souA() ? 'A' : 'B');
    const outro = () => (souA() ? 'B' : 'A');
    const nomeAdv = () => (duelo ? (souA() ? duelo.nome_b : duelo.nome_a) || 'Adversário' : 'Adversário');
    function pararTudo() { clearInterval(timerPoll); clearInterval(timerPrazo); if (animacao) cancelAnimationFrame(animacao); timerPoll = timerPrazo = animacao = null; }
    // um único caminho para o menu: o rodapé (o replay em tela cheia não tem, e volta sozinho para cá)
    function mostrar(html, semMenu) { document.body.classList.remove('emReplay'); $app.innerHTML = html + (semMenu ? '' : `<a class="voltar menuRodape" href="${linkDoJogo()}" onclick="return confirmarSaida()">🏠 Menu principal</a>`); window.scrollTo(0, 0); }
    // sair no meio de um duelo: o duelo continua no servidor (dá para voltar pelo lobby)
    window.confirmarSaida = () => !(duelo && duelo.id && !String(duelo.id).startsWith('bot-') && duelo.estado === 'jogando' && tela !== 'fim') || confirm('Sair para o menu? O duelo continua: volte pelo lobby antes do tempo acabar.');
    function nomeDoUsuario(u) {
        let apelido = '';
        try { apelido = (JSON.parse(localStorage.getItem('frontline-config')) || {}).apelido || ''; } catch (e) {}
        const meta = (u && u.user_metadata && u.user_metadata.config) || {};
        return (apelido || meta.apelido || (u && u.email ? u.email.split('@')[0] : '') || 'Comandante').slice(0, 24);
    }

    // ---------- Início ----------
    async function iniciar() {
        const replay = new URLSearchParams(location.search).get('replay');
        if (replay) return telaReplayPublico(replay);
        try { eu = await API.usuario(); } catch (e) { eu = null; }
        if (!eu) return telaLogin();
        meuNome = nomeDoUsuario(eu);
        const codigo = new URLSearchParams(location.search).get('c');
        if (codigo) return entrarComCodigo(codigo);
        telaLobby();
    }

    // ---------- Login ----------
    function telaLogin(msg) {
        pararTudo(); tela = 'login';
        mostrar(`<h1>⚔️ TRINCHEIRAS ONLINE</h1>
            <div class="sub">Para duelar com um amigo, entre na sua conta do FrontLine (a mesma do jogo).</div>
            <div class="caixa">
                <input id="email" class="campo" type="email" placeholder="E-mail" autocomplete="email">
                <input id="senha" class="campo" type="password" placeholder="Senha (mínimo 6)" autocomplete="current-password">
                <div class="erro" id="erro">${esc(msg || '')}</div>
                <button class="grande" id="bEntrar">ENTRAR</button>
                <button class="secundario" id="bCriar">Criar conta</button>
            </div>`);
        const ler = () => [document.getElementById('email').value.trim(), document.getElementById('senha').value];
        const tentar = async (fn) => {
            const [e, s] = ler();
            if (!e || s.length < 6) { document.getElementById('erro').textContent = 'Preencha o e-mail e uma senha de 6+ caracteres.'; return; }
            try { eu = await fn(e, s); meuNome = nomeDoUsuario(eu); const c = new URLSearchParams(location.search).get('c'); c ? entrarComCodigo(c) : telaLobby(); }
            catch (err) { document.getElementById('erro').textContent = err.message; }
        };
        document.getElementById('bEntrar').onclick = () => tentar(API.entrar);
        document.getElementById('bCriar').onclick = () => tentar(API.criarConta);
    }

    // ---------- Lobby ----------
    async function telaLobby(msg) {
        pararTudo(); tela = 'lobby'; duelo = null; API = API_REAL;
        let t = { trofeus: 0, vitorias: 0, derrotas: 0 }, ativos = [], temp = { pontos: 0, vitorias: 0, derrotas: 0, posicao: null, jogadores: 0 }, passadas = [];
        try { [t, ativos] = await Promise.all([API.trofeus(), API.meusDuelos()]); } catch (e) { msg = msg || e.message; }
        try { [temp, passadas] = await Promise.all([API.temporada ? API.temporada() : temp, API.temporadas ? API.temporadas() : []]); } catch (e) {}
        const liga = ligaDe(temp.pontos || 0), prox = LIGAS[LIGAS.indexOf(liga) + 1];
        const agora = new Date(), fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1), dias = Math.max(1, Math.ceil((fimMes - agora) / 86400000));
        const medalhas = (passadas || []).filter(x => x.pontos > 0).map(x => { const l = ligaDe(x.pontos), m = new Date(x.mes + 'T12:00:00'); return `<span class="medalha" title="${l.nome}">${l.icone} ${MESES[m.getMonth()].slice(0, 3)}</span>`; }).join('');
        const lista = ativos.map(d => {
            const adv = d.jogador_a === eu.id ? (d.nome_b || 'esperando amigo') : d.nome_a;
            return `<button class="secundario" data-id="${esc(d.id)}">${d.estado === 'aguardando' ? '⏳' : '⚔️'} ${esc(d.codigo)} · contra ${esc(adv)} · rodada ${d.rodada}</button>`;
        }).join('');
        mostrar(`<h1>⚔️ TRINCHEIRAS ONLINE</h1>
            <div class="sub">Duelo 1×1, melhor de 5: contra alguém da fila, um amigo ou o bot. A cada rodada, 1 minuto para montar a defesa e o ataque em segredo; quando os dois dão OK, a batalha acontece. Vitória: <b>3 troféus</b> e +3 pontos na temporada.</div>
            <div class="caixa topoLinha"><div><div class="sub">Comandante</div><b>${esc(meuNome)}</b></div><div style="text-align:right"><div class="trofeus">🏆 ${t.trofeus}</div><div class="sub">${t.vitorias} vitória${t.vitorias === 1 ? '' : 's'} · ${t.derrotas} derrota${t.derrotas === 1 ? '' : 's'}</div></div></div>
            <div class="caixa liga"><div class="topoLinha"><div><div class="sub">Temporada de ${MESES[agora.getMonth()]} · acaba em ${dias} dia${dias > 1 ? 's' : ''}</div><b class="nomeLiga">${liga.icone} Liga ${liga.nome}</b></div>
                <div style="text-align:right"><div class="trofeus">${temp.pontos || 0}</div><div class="sub">pontos${temp.posicao ? ` · ${temp.posicao}º de ${temp.jogadores}` : ''}</div></div></div>
                <div class="tempo"><div style="width:${prox ? Math.min(100, 100 * ((temp.pontos || 0) - liga.min) / (prox.min - liga.min)) : 100}%"></div></div>
                <div class="sub" style="font-size:11px;margin-top:4px">${prox ? `Faltam ${prox.min - (temp.pontos || 0)} pontos para ${prox.icone} ${prox.nome}.` : 'Liga máxima!'} Vitória +3, derrota −1. No fim do mês você ganha a medalha da liga em que ficou.</div>
                ${medalhas ? `<div class="medalhas">${medalhas}</div>` : ''}
                <button class="secundario" id="bRanking">🏆 Ranking da temporada</button></div>
            <div class="erro">${esc(msg || '')}</div>
            <button class="grande" id="bFila">⚔️ JOGAR AGORA<small style="display:block;font-size:11px;font-weight:400;margin-top:2px">contra um adversário de qualquer lugar</small></button>
            <button class="secundario" id="bNovo">👥 Desafiar um amigo (código)</button>
            <button class="secundario" id="bTreino">🤖 Treinar contra o bot (não vale pontos)</button>
            <div class="caixa"><div class="sub">Recebeu um código?</div>
                <input id="cod" class="campo" maxlength="5" placeholder="Código (ex.: K7Q2X)" style="text-transform:uppercase;letter-spacing:4px">
                <button class="secundario" id="bEntrarCod">Entrar no duelo</button></div>
            ${lista ? `<h2>DUELOS EM ANDAMENTO</h2>${lista}` : ''}
            <button class="secundario" id="bSair" style="margin-top:18px;opacity:.7">Sair da conta</button>`);
        document.getElementById('bNovo').onclick = async (ev) => {
            ev.target.disabled = true;
            try { duelo = await API.criar(meuNome); telaSala(); } catch (e) { telaLobby(e.message); }
        };
        document.getElementById('bEntrarCod').onclick = () => { const c = document.getElementById('cod').value.trim(); if (c) entrarComCodigo(c); };
        document.getElementById('bFila').onclick = () => telaFila();
        document.getElementById('bTreino').onclick = () => iniciarBot();
        document.getElementById('bRanking').onclick = () => telaRanking();
        document.getElementById('bSair').onclick = async () => { await API.sair(); eu = null; telaLogin(); };
        $app.querySelectorAll('button[data-id]').forEach(b => b.onclick = async () => { try { await abrirDuelo(b.dataset.id); } catch (e) { telaLobby(e.message); } });
    }
    // ---------- Fila: adversário de qualquer lugar; ninguém apareceu → bot de treino ----------
    async function telaFila() {
        pararTudo(); tela = 'fila';
        mostrar(`<h1>📡 PROCURANDO ADVERSÁRIO…</h1><div class="espera"><div class="icone pisca">⚔️</div><div class="sub">Assim que alguém entrar na fila, o duelo começa.</div><div class="trofeus" id="filaSeg">0s</div>
            <div class="sub" id="filaBot" style="margin-top:6px">Se ninguém aparecer em ${FILA_BOT}s, você treina contra o bot.</div></div>
            <button class="secundario" id="bBotJa">🤖 Jogar contra o bot agora</button><button class="secundario" id="bSairFila">Sair da fila</button>`);
        let d;
        try { d = await API.procurar(meuNome); } catch (e) { return telaLobby(e.message); }
        duelo = d;
        if (d.estado === 'jogando') return abrirDuelo(d.id);
        const ini = Date.now();
        const sair = async (paraBot) => { clearInterval(timerPoll); timerPoll = null; try { await API.cancelar(d.id); } catch (e) {} paraBot ? iniciarBot() : telaLobby(); };
        document.getElementById('bSairFila').onclick = () => sair(false);
        document.getElementById('bBotJa').onclick = () => sair(true);
        timerPoll = setInterval(async () => {
            if (tela !== 'fila') return;
            const seg = Math.floor((Date.now() - ini) / 1000), el = document.getElementById('filaSeg');
            if (el) el.textContent = seg + 's';
            try { const r = await API.buscar(d.id); if (r.duelo.estado === 'jogando') { clearInterval(timerPoll); timerPoll = null; duelo = r.duelo; return abrirDuelo(d.id); } } catch (e) {}
            if (seg >= FILA_BOT) sair(true);
        }, Math.min(POLL, 1000));
    }
    async function iniciarBot() {
        pararTudo();
        API = apiDoBot();
        const r = await API.buscar(); duelo = r.duelo;
        await abrirDuelo(duelo.id);
    }
    async function telaRanking() {
        pararTudo(); tela = 'ranking';
        let lista = [];
        try { lista = await API.ranking(); } catch (e) {}
        const linhas = (lista || []).map(x => `<div class="item${x.eu ? ' euRank' : ''}"><div class="txt"><b>${x.posicao}º</b> ${esc(x.nome)}<small>${ligaDe(x.pontos).icone} ${ligaDe(x.pontos).nome}</small></div><b>${x.pontos}</b></div>`).join('');
        mostrar(`<div class="topoLinha"><h1>🏆 RANKING</h1><a class="voltar" href="#" id="bVoltarR">← voltar</a></div>
            <div class="sub">Os 20 melhores da temporada deste mês (vitória +3, derrota −1).</div>
            <div class="caixa">${linhas || '<div class="sub">Ninguém pontuou ainda neste mês. Seja o primeiro!</div>'}</div>`);
        document.getElementById('bVoltarR').onclick = (ev) => { ev.preventDefault(); telaLobby(); };
    }
    async function entrarComCodigo(codigo) {
        try {
            duelo = await API.entrarCodigo(codigo.toUpperCase(), meuNome);
            if (history.replaceState) history.replaceState(null, '', location.pathname); // tira o ?c= do endereço
            await abrirDuelo(duelo.id);
        } catch (e) { telaLobby(e.message); }
    }
    async function abrirDuelo(id) { duelo = { id }; await sincronizar(); if (!timerPoll) timerPoll = setInterval(sincronizar, POLL); }

    // ---------- Sala de espera (quem criou espera o amigo entrar) ----------
    function linkConvite() {
        const base = location.protocol.startsWith('http') ? location.origin + '/duelo.html' : location.href.split('?')[0];
        return `${base}?c=${duelo.codigo}`;
    }
    function telaSala() {
        if (tela !== 'sala') {
            tela = 'sala';
            mostrar(`<h1>⏳ ESPERANDO SEU AMIGO</h1>
                <div class="sub">Mande este código ou o link. Quando ele entrar, a primeira rodada começa.</div>
                <div class="caixa"><div class="codigo">${esc(duelo.codigo)}</div>
                    <button class="grande" id="bComp">📤 COMPARTILHAR O LINK</button>
                    <div class="sub" id="copiado" style="text-align:center;margin-top:6px"></div></div>
                <div class="espera"><div class="icone pisca">📡</div><div class="sub">Aguardando…</div></div>
                <button class="secundario" id="bCanc">Cancelar duelo</button>`);
            document.getElementById('bComp').onclick = async () => {
                const url = linkConvite(), texto = `Duelo no FrontLine! Código ${duelo.codigo}: ${url}`;
                try { if (navigator.share) { await navigator.share({ title: 'Duelo no FrontLine', text: texto, url }); return; } } catch (e) { return; }
                try { await navigator.clipboard.writeText(texto); document.getElementById('copiado').textContent = 'Link copiado!'; } catch (e) { document.getElementById('copiado').textContent = url; }
            };
            document.getElementById('bCanc').onclick = async () => { try { await API.cancelar(duelo.id); } catch (e) {} telaLobby(); };
        }
        if (!timerPoll) timerPoll = setInterval(sincronizar, POLL);
    }

    // ---------- Sincronização: o servidor diz em que ponto o duelo está ----------
    let sincronizando = false;
    async function sincronizar() {
        if (!duelo || !duelo.id || sincronizando || tela === 'replay') return;
        sincronizando = true;
        try {
            const r = await API.buscar(duelo.id);
            duelo = r.duelo; planosServ = r.planos;
            decidirTela();
        } catch (e) { /* sem rede: tenta de novo no próximo ciclo */ }
        sincronizando = false;
    }
    function rodadasCompletas() {
        const lista = [];
        for (let r = 1; r <= M.D.RODADAS; r++) {
            const pa = planosServ.find(p => p.rodada === r && p.jogador === duelo.jogador_a);
            const pb = planosServ.find(p => p.rodada === r && p.jogador === duelo.jogador_b);
            if (!pa || !pb) break;
            lista.push({ A: pa.plano, B: pb.plano });
        }
        return lista;
    }
    function decidirTela() {
        if (duelo.estado === 'cancelado') { pararTudo(); return telaLobby('Este duelo foi cancelado.'); }
        if (duelo.estado === 'aguardando') return souA() && !duelo.publico ? telaSala() : null;
        jogo = M.estadoDoDuelo(duelo.semente, rodadasCompletas());
        const m = mem(duelo.id);
        if (m.vistas < jogo.rodadas.length) return telaReplay(m.vistas);         // tem resultado novo para ver
        if (duelo.estado === 'fim' && duelo.wo) return telaFim();
        if (jogo.vencedor) return telaFim();
        const rodada = jogo.proximaRodada;
        const enviei = planosServ.some(p => p.rodada === rodada && p.jogador === eu.id);
        if (!enviei) { if (tela !== 'plano' || plano.rodada !== rodada) telaPlano(rodada); }
        else telaEspera(rodada);
    }

    // ---------- Preparação: 1 minuto ----------
    const minhaInfo = () => (lado() === 'A' ? jogo.A : jogo.B);
    function telaPlano(rodada) {
        tela = 'plano'; enviando = false;
        const ultimo = jogo.rodadas[jogo.rodadas.length - 1];
        const base = ultimo ? (lado() === 'A' ? ultimo.planoA : ultimo.planoB) : M.planoPadrao();
        plano = { rodada, escala: base.escala.slice(), postura: base.postura, compras: [], contra: false, ataque: { ...(ultimo ? base.ataque : M.planoPadrao().ataque) }, doutrina: rodada === 1 ? (mem(duelo.id).doutrina || 'assalto') : undefined };
        // o relógio de 1 minuto conta a partir da primeira vez que esta rodada apareceu (sobrevive a recarregar a página)
        const m = mem(duelo.id);
        if (!m.prazo || m.prazo.rodada !== rodada) { m.prazo = { rodada, inicio: Date.now() }; gravarMem(duelo.id, m); }
        desenharPlano();
        clearInterval(timerPrazo);
        timerPrazo = setInterval(() => {
            const resta = PRAZO - (Date.now() - mem(duelo.id).prazo.inicio) / 1000;
            const barra = document.getElementById('barraTempo'), seg = document.getElementById('seg');
            if (barra) { barra.style.width = Math.max(0, 100 * resta / PRAZO) + '%'; barra.parentElement.classList.toggle('urgente', resta < 10); }
            if (seg) seg.textContent = Math.max(0, Math.ceil(resta)) + 's';
            if (resta <= 0) enviarPlano(true);
        }, 250);
    }
    const ICO = { infantaria: '🪖', artilharia: '💥', blindado: '🚛' };
    const FUNC = { vigia: { ic: '🔭', nome: 'Vigia' }, obras: { ic: '🔨', nome: 'Obras' }, descanso: { ic: '💤', nome: 'Descanso' }, fora: { ic: '✝', nome: 'Fora' } };
    const POST = { atacar: { ic: '🔥', nome: 'Atacar', d: '+dano, +perigo' }, equilibrado: { ic: '⚖️', nome: 'Equilíbrio', d: 'padrão' }, abrigar: { ic: '🧱', nome: 'Abrigar', d: 'resiste, atira menos' } };
    const VENCE = { assalto: 'artilharia', artilharia: 'fortaleza', fortaleza: 'assalto' };
    let reforcosAbertos = false;
    function desenharPlano() {
        const est = minhaInfo(), r = plano.rodada;
        const okPlano = M.sanitizar(plano, est, r);
        const dout = okPlano.doutrina, cmdUsado = M.custoDefesa(okPlano), orc = M.orcamento(r, dout), gastoAtq = M.custoAtaque(okPlano.ataque, dout), cmdLivre = est.cmd - cmdUsado;
        const infoDele = lado() === 'A' ? jogo.B : jogo.A;
        const ultimo = jogo.rodadas[jogo.rodadas.length - 1];
        // o que se sabe do adversário (rodada passada), numa linha
        let intel = '';
        if (ultimo) {
            const ele = lado() === 'A' ? ultimo.planoB : ultimo.planoA, vig = ele.escala.filter(f => f === 'vigia').length, dd = infoDele.doutrina && M.D.DOUTRINAS[infoDele.doutrina];
            intel = `<div class="intel"><b>🔎 ${esc(nomeAdv())}${dd ? ` · ${dd.icone} ${dd.nome}` : ''}</b><div class="intelLinha"><span>atacou ${ICO.infantaria}${ele.ataque.infantaria} ${ICO.artilharia}${ele.ataque.artilharia} ${ICO.blindado}${ele.ataque.blindado}</span><span>defendeu 🔭${vig} ${POST[ele.postura].ic}${ele.contra ? ' 📡' : ''}</span></div></div>`;
        }
        // doutrina: só na rodada 1, em três cartões
        const doutrinas = r === 1 ? `<div class="secTit">🎖 DOUTRINA <small>vale o duelo inteiro</small></div>
            <div class="cartoes c3">${Object.entries(M.D.DOUTRINAS).map(([id, d]) => `<button class="cartao ${dout === id ? 'on' : ''}" data-dout="${id}"><span class="icG">${d.icone}</span><b>${d.nome}</b><small>vence ${M.D.DOUTRINAS[VENCE[id]].icone}</small></button>`).join('')}</div>
            <div class="dica">${M.D.DOUTRINAS[dout].desc}</div>` : '';
        const contagem = { vigia: 0, obras: 0, descanso: 0 };
        const sold = est.soldados.map((s, i) => {
            const f = s.cond <= 0 ? 'fora' : plano.escala[i]; if (contagem[f] !== undefined) contagem[f]++;
            return `<button class="sold f-${f}" data-s="${i}" ${s.cond <= 0 ? 'disabled' : ''}><span class="ic">${FUNC[f].ic}</span><span class="nm">${esc(s.nome)}<small>${FUNC[f].nome}</small></span><span class="vida"><i style="width:${Math.max(0, s.cond)}%;background:${corCond(s.cond)}"></i></span></button>`;
        }).join('');
        const posturas = Object.entries(POST).map(([id, p]) => `<button class="opc ${plano.postura === id ? 'on' : ''}" data-p="${id}">${p.ic} ${p.nome}<small>${p.d}</small></button>`).join('');
        // reforços (melhorias + contra-bateria), recolhidos para a tela ficar curta
        const escolhidos = plano.compras.map(id => M.D.MELHORIAS[id].nome.split(' ')[0]).concat(okPlano.contra ? ['Contra-bateria'] : []);
        const cartaoMelh = ([id, m]) => {
            const tem = est.melh[id], aqui = plano.compras.filter(x => x === id).length, cheio = tem + aqui >= m.max;
            const ic = { ninho: '🔫', arame: '〰️', bunker: '🏚' }[id];
            return aqui ? `<button class="cartao on" data-desfaz="${id}"><span class="icG">${ic}</span><b>${m.nome}</b><small>✔ ${m.custo}★ · desfazer</small></button>`
                : `<button class="cartao" data-compra="${id}" ${cheio || cmdLivre < m.custo ? 'disabled' : ''}><span class="icG">${ic}</span><b>${m.nome}${tem ? ` ${tem}/${m.max}` : ''}</b><small>${cheio ? 'máximo' : m.custo + '★ · ' + m.desc}</small></button>`;
        };
        const reforcos = reforcosAbertos ? `<div class="cartoes c2">${Object.entries(M.D.MELHORIAS).map(cartaoMelh).join('')}
            <button class="cartao ${okPlano.contra ? 'on' : ''}" id="bContra" ${!plano.contra && cmdLivre < M.D.CONTRA_CUSTO ? 'disabled' : ''}><span class="icG">📡</span><b>Contra-bateria</b><small>${okPlano.contra ? '✔ ' : ''}${M.D.CONTRA_CUSTO}★ · cancela a 1ª artilharia dele</small></button></div>` : '';
        const atq = Object.entries(M.D.ATAQUE).map(([id, a]) => `<div class="cartao atq ${okPlano.ataque[id] ? 'on' : ''}"><span class="icG">${ICO[id]}</span><b>${a.nome.replace('Grupo de i', 'I')}</b><small>${M.custoDe(id, dout)} pts · ${a.desc}</small>
            <div class="passos"><button class="passo" data-menos="${id}" ${okPlano.ataque[id] ? '' : 'disabled'}>−</button><span class="qtd">${okPlano.ataque[id]}</span><button class="passo" data-mais="${id}" ${gastoAtq + M.custoDe(id, dout) > orc || okPlano.ataque[id] >= M.maxDe(id, dout) ? 'disabled' : ''}>+</button></div></div>`).join('');
        mostrar(`<div class="placar"><span>${esc(meuNome)}${dout ? ' ' + M.D.DOUTRINAS[dout].icone : ''}</span><span><span class="num">${jogo.placar[lado()]}</span>×<span class="num">${jogo.placar[outro()]}</span></span><span>${esc(nomeAdv())}</span></div>
            <div class="barraPrep"><b>RODADA ${r}/${M.D.RODADAS}</b><span>🎯 ${Math.round(est.mun)}</span><span>★ ${cmdLivre}</span><span>🧱 ${Math.round(est.trinch)}%</span></div>
            <div class="prevBox"><canvas id="cvPrev"></canvas><div class="prevRot">🛡 SUA TRINCHEIRA</div></div>
            ${intel}${doutrinas}
            <div class="secTit">🛡 DEFESA <small>toque no soldado para trocar · 🔭${contagem.vigia} 🔨${contagem.obras} 💤${contagem.descanso}</small></div>
            <div class="esq">${sold}</div>
            <div class="dica">🔭 atira e cansa · 🔨 conserta a trincheira · 💤 recupera, protegido</div>
            <div class="linhaBtns" style="margin-top:8px">${posturas}</div>
            <button class="reforcos ${reforcosAbertos ? 'aberto' : ''}" id="bReforcos"><span>🔧 Reforços <small>${escolhidos.length ? escolhidos.join(', ') : `★${cmdLivre} para gastar`}</small></span><span>${reforcosAbertos ? '▲' : '▼'}</span></button>
            ${reforcos}
            <div class="secTit">⚔️ ATAQUE <small><b class="pts">${orc - gastoAtq}</b> de ${orc} pontos sobrando</small></div>
            <div class="cartoes c3">${atq}</div>
            <div class="barraOk"><div class="relogio"><b id="seg">${PRAZO}s</b><div class="tempo"><div id="barraTempo" style="width:100%"></div></div></div><button class="grande" id="bOk">✔ PRONTO</button></div>`);
        $app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const i = +b.dataset.s; plano.escala[i] = M.FUNCOES[(M.FUNCOES.indexOf(plano.escala[i]) + 1) % 3]; desenharPlano(); });
        $app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { plano.postura = b.dataset.p; desenharPlano(); });
        $app.querySelectorAll('[data-compra]').forEach(b => b.onclick = () => { plano.compras.push(b.dataset.compra); desenharPlano(); });
        $app.querySelectorAll('[data-desfaz]').forEach(b => b.onclick = () => { const i = plano.compras.lastIndexOf(b.dataset.desfaz); if (i >= 0) plano.compras.splice(i, 1); desenharPlano(); });
        $app.querySelectorAll('[data-mais]').forEach(b => b.onclick = () => { plano.ataque[b.dataset.mais] = (okPlano.ataque[b.dataset.mais] || 0) + 1; desenharPlano(); });
        $app.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => { plano.ataque[b.dataset.menos] = Math.max(0, (okPlano.ataque[b.dataset.menos] || 0) - 1); desenharPlano(); });
        const bc = document.getElementById('bContra'); if (bc) bc.onclick = () => { plano.contra = !okPlano.contra; desenharPlano(); };
        document.getElementById('bReforcos').onclick = () => { reforcosAbertos = !reforcosAbertos; desenharPlano(); };
        $app.querySelectorAll('[data-dout]').forEach(b => b.onclick = () => { plano.doutrina = b.dataset.dout; const m = mem(duelo.id); m.doutrina = plano.doutrina; gravarMem(duelo.id, m); desenharPlano(); });
        document.getElementById('bOk').onclick = () => enviarPlano(false);
        desenharPrevia();
        // mantém o relógio certo logo após redesenhar
        const resta = PRAZO - (Date.now() - mem(duelo.id).prazo.inicio) / 1000;
        document.getElementById('barraTempo').style.width = Math.max(0, 100 * resta / PRAZO) + '%';
        document.getElementById('seg').textContent = Math.max(0, Math.ceil(resta)) + 's';
    }
    // a sua trincheira como vai ficar: soldados nos postos escolhidos e os reforços comprados
    function desenharPrevia() {
        const cv = document.getElementById('cvPrev'); if (!cv || !plano) return;
        const est = M.clonar(minhaInfo());
        plano.compras.forEach(id => est.melh[id]++);
        est.soldados.forEach((s, i) => { s.funcao = s.cond > 0 ? plano.escala[i] : 'fora'; });
        ajustarCanvas(cv);
        desenharCampo(cv.getContext('2d'), { t: 0, est, inimigos: [], eventos: [] }, { defEu: true, previa: true, semente: duelo.semente + plano.rodada });
    }
    async function enviarPlano(automatico) {
        if (enviando || tela !== 'plano') return;
        enviando = true; clearInterval(timerPrazo);
        const final = M.sanitizar(plano, minhaInfo(), plano.rodada);
        try {
            await API.enviar(duelo.id, plano.rodada, final);
            const m = mem(duelo.id); m.enviadoEm = Date.now(); gravarMem(duelo.id, m);
            telaEspera(plano.rodada, automatico);
            sincronizar();
        } catch (e) {
            enviando = false;
            if (/Rodada errada|não está em andamento/.test(e.message)) return sincronizar();
            alert('Não deu para enviar: ' + e.message + '. Tente de novo.');
            if (automatico) setTimeout(() => enviarPlano(true), 3000);
        }
    }

    // ---------- Esperando o adversário ----------
    function telaEspera(rodada, automatico) {
        if (tela !== 'espera') {
            tela = 'espera';
            mostrar(`<div class="placar"><span>${esc(meuNome)}</span><span><span class="num">${jogo.placar[lado()]}</span>×<span class="num">${jogo.placar[outro()]}</span></span><span>${esc(nomeAdv())}</span></div>
                <div class="espera"><div class="icone pisca">📡</div>
                <h2>${automatico ? '⏱ O tempo acabou: seu plano foi enviado' : '✔ Plano enviado'}</h2>
                <div class="sub">Rodada ${rodada}: esperando ${esc(nomeAdv())} dar OK…</div>
                <div class="sub" id="woInfo" style="margin-top:14px"></div></div>`);
        }
        const m = mem(duelo.id), desde = m.enviadoEm || Date.now();
        const info = document.getElementById('woInfo');
        if (info && Date.now() - desde > WO_ESPERA && !document.getElementById('bWo')) {
            info.innerHTML = `${esc(nomeAdv())} sumiu? <button class="secundario" id="bWo">Reivindicar vitória (W.O.)</button>`;
            document.getElementById('bWo').onclick = async () => { try { duelo = await API.wo(duelo.id); telaFim(); } catch (e) { alert(e.message); } };
        }
    }

    // ---------- Resultado da rodada: replay em tela cheia, uma trincheira de cada vez ----------
    function telaReplay(indice) {
        pararPoll();
        tela = 'replay';
        const r = jogo.rodadas[indice], meu = lado(), dele = outro();
        const placar = { meu: 0, dele: 0 };
        jogo.rodadas.slice(0, indice + 1).forEach(x => { if (x.vencedor === meu) placar.meu++; else if (x.vencedor === dele) placar.dele++; });
        const ultima = indice + 1 >= jogo.rodadas.length && jogo.vencedor;
        montarReplay({
            r, semente: duelo.semente, meu, eu: true, nomes: { meu: meuNome, dele: nomeAdv() }, placar,
            botoes: `<button class="grande" id="bProx">${ultima ? 'VER O RESULTADO FINAL ▶' : 'PRÓXIMA RODADA ▶'}</button>`,
            aoFim: () => { document.getElementById('bProx').onclick = () => { const m = mem(duelo.id); m.vistas = indice + 1; gravarMem(duelo.id, m); tela = ''; decidirTela(); retomarPoll(); }; }
        });
    }
    function pararPoll() { clearInterval(timerPoll); timerPoll = null; clearInterval(timerPrazo); }
    function retomarPoll() { if (!timerPoll && duelo && duelo.id) timerPoll = setInterval(sincronizar, POLL); }

    // Monta o replay de uma rodada. o: { r, semente, meu ('A'|'B': quem fica como "primeira trincheira"), eu (é o seu duelo?),
    // nomes: { meu, dele }, placar: { meu, dele } depois da rodada, botoes (html do fim), aoFim() }
    let velReplay = 4;
    function montarReplay(o) {
        const { r, meu } = o, dele = meu === 'A' ? 'B' : 'A';
        const nm = o.nomes, eu = o.eu;
        const abaDef = eu ? '🛡 SUA DEFESA' : '🛡 ' + esc(nm.meu).toUpperCase(), abaAtq = eu ? '⚔️ SEU ATAQUE' : '🛡 ' + esc(nm.dele).toUpperCase();
        mostrar(`<div class="replayTela">
            <div class="placar"><span>${esc(nm.meu)}</span><span class="sub">RODADA ${r.rodada}</span><span>${esc(nm.dele)}</span></div>
            <div class="abas"><button data-aba="0" class="on">${abaDef}<small>dano <b id="dano0">0</b></small></button><button data-aba="1">${abaAtq}<small>dano <b id="dano1">0</b></small></button></div>
            <div class="rpCampo"><canvas id="cvReplay"></canvas>
                <div class="hud"><span id="hTrinch">🧱 100%</span><span id="hAbates">✖ 0</span><span id="hTempo">0s</span></div>
                <div class="legenda" id="legenda"></div>
                </div><div id="ticker"></div>
            <div class="rpControles" id="rpControles"><button class="mini" id="bPlay">⏸</button><button class="mini" id="bVel">${velReplay}×</button><button class="mini largo" id="bPular">⏭ Pular para o resultado</button></div>
            <div id="fimReplay"></div></div>`, true);
        document.body.classList.add('emReplay');
        const cv = document.getElementById('cvReplay'), ctx = cv.getContext('2d');
        let prep, campos, ativo = 0, pausado = false, terminou = false, acc = 0, ultimo = performance.now(), troca = 0, lidos, msgs;
        // quem defende e quem ataca em cada aba (0 = trincheira de "meu", 1 = trincheira de "dele")
        const ctxDe = (k) => k === 0 ? { defEu: eu, atqEu: false, def: nm.meu, atq: nm.dele } : { defEu: false, atqEu: eu, def: nm.dele, atq: nm.meu };
        const iniciar = () => {
            prep = M.prepararRodada(r.antesA, r.antesB, r.planoA, r.planoB, r.rodada, o.semente);
            campos = meu === 'A' ? [prep.campoA, prep.campoB] : [prep.campoB, prep.campoA];
            ativo = 0; terminou = false; acc = 0; troca = 0; lidos = [0, 0]; msgs = [];
            mudarAba(0);
            document.getElementById('fimReplay').innerHTML = '';
            document.getElementById('rpControles').style.display = '';
            document.querySelector('.replayTela').classList.remove('acabou');
        };
        const mudarAba = (k) => {
            ativo = k; msgs = [];
            document.querySelectorAll('.abas [data-aba]').forEach(b => b.classList.toggle('on', +b.dataset.aba === k));
            const c = ctxDe(k);
            document.getElementById('legenda').innerHTML = `<span class="lg def ${c.defEu ? 'eu' : ''}">● ${esc(c.defEu ? 'seus soldados' : c.def)}</span><span class="lg atq ${c.atqEu ? 'eu' : ''}">● ${esc(c.atqEu ? 'seu ataque' : 'ataque de ' + c.atq)}</span>`;
        };
        const textoEvento = (ev, c, est) => {
            const n = ev.soldado >= 0 && est.soldados[ev.soldado] ? est.soldados[ev.soldado].nome : '';
            switch (ev.tipo) {
                case 'onda': return c.atqEu ? '🪖 Seus 4 soldados avançam' : `🪖 4 soldados de ${c.atq} avançam`;
                case 'blindado': return c.atqEu ? '🚛 Seu blindado avança' : `🚛 Blindado de ${c.atq} avança`;
                case 'artilharia': return ev.soldado < 0 ? (c.atqEu ? '💥 Sua artilharia acertou a trincheira' : `💥 Artilharia de ${c.atq} acertou a trincheira`) : (c.atqEu ? `💥 Sua artilharia acertou ${n}` : `💥 Artilharia de ${c.atq} acertou ${n}`);
                case 'contra': return c.defEu ? `📡 Sua contra-bateria cancelou a artilharia de ${c.atq}` : c.atqEu ? `📡 ${c.def} cancelou sua artilharia` : `📡 ${c.def} cancelou a artilharia de ${c.atq}`;
                case 'invasao': return c.defEu ? '⚠ Um inimigo entrou na sua trincheira!' : c.atqEu ? '✔ Seu soldado chegou à trincheira!' : `⚠ ${c.atq} chegou à trincheira de ${c.def}!`;
                case 'baixa': return c.defEu ? `✝ ${ev.nome} caiu` : `✝ ${ev.nome}, de ${c.def}, caiu`;
            }
            return null;
        };
        const lerEventos = () => {
            const c = campos[ativo], l = c.eventos;
            for (; lidos[ativo] < l.length; lidos[ativo]++) {
                const ev = l[lidos[ativo]], txt = textoEvento(ev, ctxDe(ativo), c.est);
                if (txt) msgs.push({ txt, t: performance.now(), ruim: ['invasao', 'baixa', 'artilharia'].includes(ev.tipo) === ctxDe(ativo).defEu && eu });
            }
            msgs = msgs.slice(-3);
        };
        const hud = () => {
            const c = campos[ativo];
            document.getElementById('hTrinch').textContent = `🧱 ${Math.round(c.est.trinch)}%`;
            document.getElementById('hAbates').textContent = `✖ ${c.eventos.filter(e => e.tipo === 'abate').length} abatidos`;
            document.getElementById('hTempo').textContent = `${Math.round(c.t)}s / ${M.D.DURACAO}s`;
            campos.forEach((x, k) => { document.getElementById('dano' + k).textContent = Math.round(x.danoSofrido()); });
            const agora = performance.now();
            document.getElementById('ticker').innerHTML = msgs.map(m => `<div class="${m.ruim ? 'ruim' : ''}" style="opacity:${Math.max(0.25, 1 - (agora - m.t) / 4000)}">${esc(m.txt)}</div>`).join('');
        };
        const desenhar = () => { ajustarCanvas(cv); desenharCampo(ctx, campos[ativo], Object.assign(ctxDe(ativo), { semente: o.semente + r.rodada * 7 + ativo })); hud(); };
        const concluir = () => {
            if (terminou) return; terminou = true;
            campos.forEach(c => { while (!c.terminou) c.passo(); });
            lidos = campos.map(c => c.eventos.length); msgs = [];
            document.getElementById('rpControles').style.display = 'none';
            document.querySelector('.replayTela').classList.add('acabou');
            const venc = r.vencedor === meu ? 'meu' : r.vencedor === dele ? 'dele' : null;
            const titulo = eu ? (venc === 'meu' ? '✔ RODADA SUA' : venc === 'dele' ? '✖ RODADA DE ' + esc(nm.dele).toUpperCase() : 'EMPATE NA RODADA') : (venc ? 'RODADA DE ' + esc(nm[venc]).toUpperCase() : 'EMPATE NA RODADA');
            const d0 = campos[0].danoSofrido(), d1 = campos[1].danoSofrido(), maxD = Math.max(1, d0, d1);
            const barra = (rot, v, cls) => `<div class="barraDano"><span>${rot}</span><div><i class="${cls}" style="width:${100 * v / maxD}%"></i></div><b>${Math.round(v)}</b></div>`;
            document.getElementById('fimReplay').innerHTML = `<div class="rpFim">
                <div class="resultado ${eu && venc === 'meu' ? 'bom' : eu && venc === 'dele' ? 'ruim' : ''}">${titulo}</div>
                <div class="sub" style="text-align:center;font-size:11px">dano sofrido · quem sofre menos vence a rodada</div>
                ${barra(eu ? 'Você' : esc(nm.meu), d0, 'meu')}${barra(esc(nm.dele), d1, 'dele')}
                <div class="secTit" style="margin-top:8px">📋 O QUE DECIDIU</div>
                <ul class="decidiu">${resumoRodada(r, meu, campos, nm, eu).map(t => `<li>${t}</li>`).join('')}</ul>
                <div class="placar" style="margin-top:6px"><span>${esc(nm.meu)}</span><span><span class="num">${o.placar.meu}</span>×<span class="num">${o.placar.dele}</span></span><span>${esc(nm.dele)}</span></div>
                <div class="linhaBtns"><button class="secundario" id="bRever">↺ Rever</button><button class="secundario" id="bOutra">${ativo === 0 ? abaAtq : abaDef}</button></div>
                ${o.botoes}</div>`;
            document.getElementById('bRever').onclick = () => { iniciar(); animacao = requestAnimationFrame(quadro); };
            document.getElementById('bOutra').onclick = () => { mudarAba(1 - ativo); desenhar(); document.getElementById('bOutra').innerHTML = ativo === 0 ? abaAtq : abaDef; };
            desenhar(); // depois do layout novo (campo menor + resumo)
            o.aoFim && o.aoFim();
        };
        const quadro = (agora) => {
            if (terminou || !document.getElementById('cvReplay')) return;
            const dt = Math.min(0.25, (agora - ultimo) / 1000); ultimo = agora;
            const c = campos[ativo];
            if (!pausado) {
                if (c.terminou) { // terminou esta trincheira: um respiro e passa para a outra
                    troca += dt;
                    if (troca > 1.2) { const outra = campos[1 - ativo]; if (outra.terminou) return concluir(); troca = 0; mudarAba(1 - ativo); }
                } else {
                    acc += dt * velReplay;
                    while (acc >= M.D.DT && !c.terminou) { c.passo(); acc -= M.D.DT; }
                }
            }
            lerEventos(); desenhar();
            animacao = requestAnimationFrame(quadro);
        };
        document.querySelectorAll('.abas [data-aba]').forEach(b => b.onclick = () => { mudarAba(+b.dataset.aba); troca = 0; if (terminou) desenhar(); });
        document.getElementById('bPlay').onclick = (ev) => { pausado = !pausado; ev.currentTarget.textContent = pausado ? '▶' : '⏸'; };
        document.getElementById('bVel').onclick = (ev) => { velReplay = velReplay === 2 ? 4 : velReplay === 4 ? 8 : 2; ev.currentTarget.textContent = velReplay + '×'; };
        document.getElementById('bPular').onclick = concluir;
        iniciar();
        animacao = requestAnimationFrame(quadro);
    }
    // Causa e efeito em poucas linhas: de onde veio o dano de cada lado e o que dá para mudar
    function resumoRodada(r, meu, campos, nm, eu) {
        const st = (c) => {
            const ev = c.eventos, n = (t) => ev.filter(e => e.tipo === t).length;
            return { art: ev.filter(e => e.tipo === 'artilharia' && e.soldado >= 0).length, contra: n('contra'), inv: n('invasao'), abates: n('abate'), total: n('onda') * 4 + n('blindado'), baixas: ev.filter(e => e.tipo === 'baixa').map(e => e.nome), caiu: c.est.trinch <= 0 || !M.vivos(c.est).length };
        };
        const a = st(campos[0]), b = st(campos[1]), l = [];
        const voce = eu ? 'Você' : esc(nm.meu), ele = esc(nm.dele);
        const sua = eu ? 'sua trincheira' : 'a trincheira de ' + esc(nm.meu);
        if (a.caiu || b.caiu) l.push(`🏳 ${a.caiu && b.caiu ? 'As duas trincheiras caíram' : a.caiu ? (eu ? 'Sua trincheira caiu' : `A trincheira de ${voce} caiu`) : `A trincheira de ${ele} caiu`}: isso decide o duelo na hora.`);
        // defesa do primeiro lado
        if (a.inv >= 2) l.push(`⚠ ${a.inv} atacantes de ${ele} chegaram ${eu ? 'à sua trincheira' : 'à trincheira de ' + voce}${eu ? ' — mais 🔭 vigias, ninho ou arame seguram melhor' : ''}.`);
        else if (a.art >= 2) l.push(`💥 A artilharia de ${ele} acertou ${a.art}× ${eu ? 'seus soldados expostos — 🧱 Abrigar, bunker ou 📡 contra-bateria ajudam' : 'os soldados de ' + voce}.`);
        else if (a.total) l.push(`🛡 ${eu ? 'Sua defesa' : 'A defesa de ' + voce} abateu ${a.abates} de ${a.total} atacantes.`);
        if (a.contra) l.push(`📡 ${eu ? 'Sua' : 'A'} contra-bateria${eu ? '' : ' de ' + voce} cancelou uma artilharia de ${ele}.`);
        // ataque do primeiro lado (= defesa do outro)
        if (!b.total && !r['plano' + meu].ataque.artilharia) l.push(`😴 ${voce} não ${eu ? 'mandou' : 'mandou'} ataque nesta rodada.`);
        else if (b.inv >= 2) l.push(`⚔️ ${b.inv} atacantes ${eu ? 'seus' : 'de ' + voce} chegaram à trincheira de ${ele}.`);
        else if (b.total && b.abates >= 0.8 * b.total) l.push(`✖ A defesa de ${ele} abateu ${b.abates} de ${b.total} atacantes${eu ? ' seus — tente 💥 artilharia ou 🚛 blindado' : ''}.`);
        else if (b.art) l.push(`💥 ${eu ? 'Sua artilharia' : 'A artilharia de ' + voce} acertou ${b.art}× os soldados de ${ele}.`);
        if (b.contra) l.push(`📡 ${ele} usou contra-bateria e cancelou ${eu ? 'sua' : 'uma'} artilharia.`);
        if (a.baixas.length) l.push(`✝ ${eu ? 'Você perdeu' : voce + ' perdeu'} ${a.baixas.join(', ')}.`);
        if (r.rodada === 1) {
            const dm = r['plano' + meu].doutrina, dd = r['plano' + (meu === 'A' ? 'B' : 'A')].doutrina, D = M.D.DOUTRINAS;
            if (dm && dd && VENCE[dm] === dd) l.push(`${D[dm].icone} A doutrina ${D[dm].nome} ${eu ? 'sua ' : ''}tem vantagem sobre ${D[dd].icone} ${D[dd].nome}.`);
            else if (dm && dd && VENCE[dd] === dm) l.push(`${D[dd].icone} A doutrina ${D[dd].nome} de ${ele} tem vantagem sobre ${D[dm].icone} ${D[dm].nome}.`);
        }
        return l.slice(0, 4);
    }

    // ---------- Desenho de um campo de batalha (mesmo estilo da batalha da Conquista) ----------
    const IMGS = {};
    ['mira', 'trabalho', 'come', 'andando'].forEach(k => { const im = new Image(); im.onload = () => { if (tela === 'plano') desenharPrevia(); }; im.src = 'assets/soldados/' + k + '.png'; IMGS[k] = im; });
    const SPR = { mira: { ax: 62, ay: 208 }, trabalho: { ax: 80, ay: 193 }, come: { ax: 80, ay: 190 }, andando: { ax: 87, ay: 193 } };
    const corCond = (c) => (c <= 0 ? '#555' : c < 35 ? '#e0533f' : c < 65 ? '#e3b04b' : '#7bc96f');
    const COR_EU = '#9fd08f', COR_ELE = '#e0533f';
    function ajustarCanvas(cv) {
        const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
        if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    }
    function sorteio(semente) { let x = (semente >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }
    // o: { defEu, atqEu, semente, previa }
    function desenharCampo(ctx, campo, o) {
        const W = 400, cw = ctx.canvas.width, ch = ctx.canvas.height; if (!cw || !ch) return;
        const H = W * ch / cw, e = cw / W;
        ctx.setTransform(e, 0, 0, e, 0, 0);
        const k = o.previa ? 1 : 1.4, est = campo.est, yT = H - 82 * k; // linha dos sacos de areia (no replay, trincheira maior)
        const yBeira = yT - 16, yTopo = Math.max(12, Math.min(22, yT - 40));
        const yDoInimigo = (dist) => yBeira + (yTopo - yBeira) * Math.max(0, Math.min(330, dist)) / 330;
        {
        // chão e terra de ninguém
        const chao = ctx.createLinearGradient(0, 0, 0, H); chao.addColorStop(0, '#3b4535'); chao.addColorStop(0.6, '#454734'); chao.addColorStop(1, '#353a2c');
        ctx.fillStyle = chao; ctx.fillRect(0, 0, W, H);
        const rnd = sorteio(o.semente || 7);
        for (let i = 0; i < 12; i++) {
            const x = rnd() * W, y = yTopo + rnd() * (yBeira - 26 - yTopo), rr = 6 + rnd() * 14;
            if (y < 4) continue;
            ctx.fillStyle = 'rgba(20,18,12,.45)'; ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(150,130,95,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
        // alcance dos fuzis
        if (!o.previa) { const ya = yDoInimigo(M.D.ALCANCE); ctx.strokeStyle = 'rgba(211,154,69,.28)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, ya); ctx.lineTo(W, ya); ctx.stroke(); ctx.setLineDash([]); }
        // arame farpado (mais fileiras com a melhoria)
        const fileiras = 1 + (est.melh.arame || 0);
        for (let f = 0; f < fileiras; f++) {
            const ya = yBeira - 12 - f * 10; ctx.strokeStyle = f ? 'rgba(200,190,160,.7)' : 'rgba(170,165,150,.45)'; ctx.lineWidth = 1;
            for (let x = (f * 7) % 14; x < W; x += 14) { ctx.beginPath(); ctx.arc(x + 7, ya, 5, 0, Math.PI * 2); ctx.stroke(); }
            for (let x = 0; x < W; x += 42) { ctx.beginPath(); ctx.moveTo(x, ya - 8); ctx.lineTo(x, ya + 6); ctx.stroke(); }
        }
        // vala, abrigo (bunker) e sacos de areia: os sacos somem conforme a trincheira apanha
        ctx.fillStyle = '#2b2219'; ctx.fillRect(0, yT, W, 34 * k);
        ctx.fillStyle = '#4a3b28'; ctx.fillRect(0, yT + 30 * k, W, 8);
        const yAbr = yT + 40 * k;
        ctx.fillStyle = '#1b1510'; ctx.fillRect(14, yAbr, W - 28, H - yAbr - 4);
        ctx.fillStyle = '#5b4a33'; for (let x = 14; x < W - 14; x += 46) ctx.fillRect(x, yAbr, 5, H - yAbr - 4); // escoras
        ctx.fillStyle = est.melh.bunker ? '#6d6e68' : '#5b4a33'; ctx.fillRect(10, yAbr - 3, W - 20, est.melh.bunker ? 6 : 4); // teto (concreto no bunker reforçado)
        const r2 = sorteio(99);
        for (let x = 0, i = 0; x < W; x += 15, i++) {
            const firme = r2() * 100 < est.trinch + 8;
            ctx.fillStyle = firme ? '#7a6646' : 'rgba(60,48,32,.6)';
            ctx.beginPath(); ctx.ellipse(x + 7.5, yT - 2, 8, firme ? 4.5 : 2.5, 0, 0, Math.PI * 2); ctx.fill();
            if (firme) { ctx.strokeStyle = 'rgba(40,30,18,.6)'; ctx.lineWidth = 0.8; ctx.stroke(); }
            if (firme && i % 2) { ctx.fillStyle = '#6f5c40'; ctx.beginPath(); ctx.ellipse(x + 15, yT - 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        // ninhos de metralhadora nas pontas
        for (let k = 0; k < (est.melh.ninho || 0); k++) {
            const x = k ? W - 34 : 34; ctx.fillStyle = '#7a6646'; ctx.beginPath(); ctx.ellipse(x, yT - 6, 22, 9, 0, Math.PI, 0); ctx.fill();
            ctx.strokeStyle = '#1b1510'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, yT - 10); ctx.lineTo(x + (k ? -10 : 10), yT - 22); ctx.stroke();
        }
        }
        // defensores nos postos
        const pos = posicoes(est, W, yT, H, k);
        const corDef = o.defEu ? COR_EU : COR_ELE;
        est.soldados.forEach((s, i) => {
            const p = pos[i]; if (!p) return;
            if (s.funcao === 'fora' || s.cond <= 0) { ctx.fillStyle = '#4a4a44'; ctx.fillRect(p.x - 9, p.y - 4, 18, 4); ctx.fillStyle = '#7a7a70'; ctx.font = '8px monospace'; ctx.fillText('✝', p.x - 3, p.y - 6); return; }
            const spr = s.funcao === 'vigia' ? 'mira' : s.funcao === 'obras' ? 'trabalho' : 'come', F = (s.funcao === 'descanso' ? 0.11 : 0.15) * k;
            if (o.defEu) { const im = IMGS[spr], a = SPR[spr]; if (im.complete && im.naturalWidth) ctx.drawImage(im, p.x - a.ax * F, p.y - a.ay * F, im.naturalWidth * F, im.naturalHeight * F); }
            else boneco(ctx, p.x, p.y, corDef, s.funcao === 'descanso' ? 0.7 : 1, false, campo.t);
            ctx.fillStyle = corCond(s.cond); ctx.beginPath(); ctx.arc(p.x, p.y - (s.funcao === 'descanso' ? 26 : 36) * k, 2.4, 0, Math.PI * 2); ctx.fill();
            if (o.previa) { ctx.fillStyle = 'rgba(214,227,209,.8)'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText(s.nome, p.x, Math.min(H - 3, p.y + 9)); ctx.textAlign = 'left'; }
        });
        // corpos de quem foi abatido ficam no chão
        campo._mortos = campo._mortos || []; campo._vistos = campo._vistos || [];
        campo._vistos.forEach(x => { if (!campo.inimigos.includes(x) && x.vida <= 0) campo._mortos.push({ x: x.x, y: x._y, tipo: x.tipo }); });
        campo._vistos = campo.inimigos.slice();
        const corAtq = o.atqEu ? COR_EU : COR_ELE;
        campo._mortos.filter(m => m.y !== undefined).forEach(m => { ctx.fillStyle = m.tipo === 'blindado' ? 'rgba(30,25,20,.85)' : 'rgba(40,20,18,.7)'; if (m.tipo === 'blindado') ctx.fillRect(m.x - 12, m.y - 6, 24, 8); else ctx.fillRect(m.x - 7, m.y - 3, 14, 3); });
        // atacantes avançando (param na beira dos sacos de areia)
        const vig = est.soldados.map((s, i) => (s.funcao === 'vigia' && s.cond > 0 ? pos[i] : null)).filter(Boolean);
        campo.inimigos.slice().sort((a, b) => b.dist - a.dist).forEach((x, k) => {
            const y = yDoInimigo(x.dist); x._y = y;
            if (x.tipo === 'blindado') tanque(ctx, x.x, y, corAtq, o.atqEu);
            else if (o.atqEu) { const im = IMGS.andando, a = SPR.andando, F = 0.13; if (im.complete && im.naturalWidth) ctx.drawImage(im, x.x - a.ax * F, y - a.ay * F + Math.sin(campo.t * 9 + k) * 0.8, im.naturalWidth * F, im.naturalHeight * F); }
            else boneco(ctx, x.x, y, corAtq, 0.85, true, campo.t + k);
            if (campo.t - (x.alvejado || -9) < 0.15 && vig.length) { const v = vig[k % vig.length]; ctx.strokeStyle = 'rgba(255,224,138,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(v.x + 8 * k, v.y - 26 * k); ctx.lineTo(x.x, y - 10); ctx.stroke(); }
        });
        // efeitos recentes
        campo.eventos.filter(ev => campo.t - ev.t < 0.7).forEach(ev => {
            const a = 1 - (campo.t - ev.t) / 0.7;
            if (ev.tipo === 'artilharia' || ev.tipo === 'invasao') {
                const p = ev.soldado >= 0 && pos[ev.soldado] ? pos[ev.soldado] : { x: ev.x || W / 2, y: yT };
                ctx.fillStyle = `rgba(255,160,60,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y - 14, 20 * (1.3 - a), 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(90,80,60,${a * 0.6})`; ctx.beginPath(); ctx.arc(p.x + 6, p.y - 26, 14 * (1.4 - a), 0, Math.PI * 2); ctx.fill();
            } else if (ev.tipo === 'contra') { ctx.fillStyle = `rgba(160,220,150,${a})`; ctx.font = 'bold 15px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillText('📡 CONTRA-BATERIA!', W / 2, yTopo + 40); ctx.textAlign = 'left'; }
        });
        if (campo.terminou && !o.previa) {
            const caiu = est.trinch <= 0 || !M.vivos(est).length, txt = caiu ? '🏳 TRINCHEIRA CAIU' : '🛡 TRINCHEIRA MANTIDA', yt = (yTopo + yBeira) / 2;
            ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(40, yt - 20, W - 80, 32);
            ctx.font = 'bold 18px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = caiu ? '#ff8a7a' : '#a9d39f'; ctx.fillText(txt, W / 2, yt + 2); ctx.textAlign = 'left';
        }
    }
    // onde cada soldado fica: vigias nos sacos de areia, obras na vala, descanso no abrigo
    function posicoes(est, W, yT, H, k) {
        const grupos = { vigia: [], obras: [], descanso: [], fora: [] };
        est.soldados.forEach((s, i) => (grupos[s.cond <= 0 ? 'fora' : s.funcao] || grupos.fora).push(i));
        const pos = [];
        const espalha = (l, x0, x1, y) => l.forEach((i, k) => { pos[i] = { x: l.length === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * k / (l.length - 1), y }; });
        espalha(grupos.vigia, 70, W - 70, yT + 14 * k);
        espalha(grupos.obras, 145, W - 75, yT + 30 * k); // entre os vigias, sem cobrir ninguém
        espalha(grupos.descanso, 60, W - 60, Math.min(H - 8, yT + 72 * k));
        espalha(grupos.fora, 30, 90, yT + 28 * k);
        return pos;
    }
    function boneco(ctx, x, y, cor, s, andando, t) {
        const b = andando ? Math.sin(t * 9) * 1.2 : 0;
        ctx.fillStyle = '#2a0f10'; ctx.strokeStyle = cor; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(x, y - 22 * s + b, 4.5 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 5 * s, y - 17 * s + b); ctx.lineTo(x + 5 * s, y - 17 * s + b); ctx.lineTo(x + 4 * s, y); ctx.lineTo(x - 4 * s, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3 * s, y - 13 * s + b); ctx.lineTo(x + 9 * s, y - 22 * s + b); ctx.stroke();
    }
    function tanque(ctx, x, y, cor, amigo) {
        ctx.save(); ctx.translate(x, y); ctx.lineWidth = 1.4; ctx.strokeStyle = cor; ctx.fillStyle = amigo ? '#25331f' : '#2a0f10';
        ctx.fillRect(-14, -12, 28, 11); ctx.strokeRect(-14, -12, 28, 11);
        ctx.fillRect(-7, -19, 14, 7); ctx.strokeRect(-7, -19, 14, 7);
        ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 6); ctx.stroke(); ctx.lineWidth = 1.4;
        [-10, -4, 2, 8].forEach(k => { ctx.beginPath(); ctx.arc(k + 1, -1, 2.6, 0, Math.PI * 2); ctx.stroke(); });
        ctx.restore();
    }

    // ---------- Fim do duelo ----------
    async function telaFim() {
        if (tela === 'fim') return;
        pararTudo(); tela = 'fim';
        let vencedorUid = duelo.vencedor;
        if (!duelo.wo && jogo && jogo.vencedor) {
            vencedorUid = jogo.vencedor === 'A' ? duelo.jogador_a : duelo.jogador_b;
            const m = mem(duelo.id);
            if (!m.informado && duelo.estado !== 'fim') { try { duelo = await API.informar(duelo.id, vencedorUid); m.informado = true; gravarMem(duelo.id, m); } catch (e) {} }
        }
        const venci = vencedorUid === eu.id, treino = !!API.bot;
        let t = null; if (!treino) try { t = await API.trofeus(); } catch (e) {}
        const pl = jogo ? jogo.placar : { A: 0, B: 0 };
        mostrar(`<div class="espera"><div class="icone">${venci ? '🏆' : '🎖️'}</div>
            <h1 style="text-align:center">${venci ? 'VOCÊ VENCEU O DUELO!' : esc(nomeAdv()).toUpperCase() + ' VENCEU'}</h1>
            <div class="sub">${duelo.wo ? 'Vitória por W.O.: o adversário não deu OK a tempo.' : `Placar final: ${pl[lado()]} × ${pl[outro()]}`}</div>
            ${treino ? '<div class="sub" style="margin-top:10px">🤖 Treino contra o bot: não vale troféus nem pontos.</div>' : venci ? '<div class="trofeus" style="margin-top:10px">+3 troféus · +3 pontos na temporada</div>' : '<div class="sub" style="margin-top:10px">−1 ponto na temporada</div>'}
            <div class="sub" id="totalTrofeus" style="margin-top:6px">${t && duelo.estado === 'fim' ? `Você tem 🏆 ${t.trofeus} troféus (${t.vitorias} vitórias)` : ''}</div>
            <div class="sub pisca" id="confirmando" style="margin-top:6px">${duelo.estado !== 'fim' ? 'Confirmando o resultado com o outro celular…' : ''}</div></div>
            <button class="grande" id="bRevanche">${treino ? '🤖 TREINAR DE NOVO' : '⚔️ REVANCHE'}</button>
            ${treino ? '' : '<button class="secundario" id="bShare">📤 Compartilhar o replay</button><div class="sub" id="shareInfo" style="text-align:center"></div>'}
            <button class="secundario" id="bLobby">Voltar ao lobby</button>`);
        document.getElementById('bRevanche').onclick = async () => { if (treino) return iniciarBot(); try { duelo = await API.criar(meuNome); tela = ''; telaSala(); } catch (e) { telaLobby(e.message); } };
        const bShare = document.getElementById('bShare');
        if (bShare) bShare.onclick = async () => {
            const base = location.protocol.startsWith('http') ? location.origin + '/duelo.html' : location.href.split('?')[0];
            const url = `${base}?replay=${duelo.id}`, texto = `Veja o meu duelo no FrontLine: ${duelo.nome_a} × ${duelo.nome_b}`;
            try { if (navigator.share) { await navigator.share({ title: 'Replay do duelo', text: texto, url }); return; } } catch (e) { return; }
            try { await navigator.clipboard.writeText(url); document.getElementById('shareInfo').textContent = 'Link do replay copiado!'; } catch (e) { document.getElementById('shareInfo').textContent = url; }
        };
        document.getElementById('bLobby').onclick = () => telaLobby();
        // espera o outro celular confirmar e então mostra o total de troféus já atualizado
        if (duelo.estado !== 'fim' && !treino) {
            const id = duelo.id;
            timerPoll = setInterval(async () => {
                if (tela !== 'fim' || !duelo || duelo.id !== id) return clearInterval(timerPoll);
                try {
                    const r = await API.buscar(id);
                    if (r.duelo.estado !== 'fim') return;
                    duelo = r.duelo; clearInterval(timerPoll); timerPoll = null;
                    const t2 = await API.trofeus();
                    const c = document.getElementById('confirmando'), tt = document.getElementById('totalTrofeus');
                    if (c) c.textContent = '';
                    if (tt) tt.textContent = `Você tem 🏆 ${t2.trofeus} troféus (${t2.vitorias} vitórias)`;
                } catch (e) {}
            }, POLL);
        }
    }

    // ---------- Replay público: qualquer um com o link assiste ao duelo, rodada por rodada ----------
    async function telaReplayPublico(id) {
        pararTudo(); tela = 'replayPublico';
        let r = null;
        try { r = await API.replay(id); } catch (e) {}
        if (!r) { mostrar(`<h1>🎬 REPLAY</h1><div class="espera"><div class="icone">🔎</div><div class="sub">Replay não encontrado. O duelo pode ainda não ter terminado.</div></div>`); return; }
        const lista = [];
        for (let k = 1; k <= M.D.RODADAS; k++) { const a = r.planos.find(p => p.rodada === k && p.lado === 'A'), b = r.planos.find(p => p.rodada === k && p.lado === 'B'); if (!a || !b) break; lista.push({ A: a.plano, B: b.plano }); }
        const est = M.estadoDoDuelo(r.semente, lista);
        const nome = { A: r.nome_a || 'Comandante A', B: r.nome_b || 'Comandante B' };
        const mostrarRodada = (i) => {
            if (i >= est.rodadas.length) {
                const v = r.vencedor || est.vencedor;
                mostrar(`<h1>🎬 REPLAY</h1>
                    <div class="espera"><div class="icone">🏆</div><h2 style="text-align:center">${esc(nome[v] || '')} venceu</h2><div class="sub">${r.wo ? 'Por W.O.' : `Placar: ${esc(nome.A)} ${est.placar.A} × ${est.placar.B} ${esc(nome.B)}`}</div></div>
                    <button class="grande" id="bDeNovo">▶ VER DE NOVO</button><a class="grande" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box" href="${location.pathname}">⚔️ JOGAR TRINCHEIRAS ONLINE</a>`);
                document.getElementById('bDeNovo').onclick = () => mostrarRodada(0);
                return;
            }
            const x = est.rodadas[i], pl = { meu: 0, dele: 0 };
            est.rodadas.slice(0, i + 1).forEach(y => { if (y.vencedor === 'A') pl.meu++; else if (y.vencedor === 'B') pl.dele++; });
            montarReplay({
                r: x, semente: r.semente, meu: 'A', eu: false, nomes: { meu: nome.A, dele: nome.B }, placar: pl,
                botoes: `<button class="grande" id="bProx">${i + 1 < est.rodadas.length ? 'PRÓXIMA RODADA ▶' : 'RESULTADO ▶'}</button>`,
                aoFim: () => { document.getElementById('bProx').onclick = () => mostrarRodada(i + 1); }
            });
        };
        mostrarRodada(0);
    }

    // exposto para os testes
    window.__duelo = { estado: () => ({ tela, duelo, jogo, plano }), sincronizar };
    iniciar();
})();
