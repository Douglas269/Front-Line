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
    function mostrar(html) { $app.innerHTML = html; window.scrollTo(0, 0); }
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
        mostrar(`<div class="topoLinha"><h1>⚔️ TRINCHEIRAS ONLINE</h1><a class="voltar" href="${linkDoJogo()}">← modos</a></div>
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
        mostrar(`<div class="topoLinha"><h1>⚔️ TRINCHEIRAS ONLINE</h1><a class="voltar" href="${linkDoJogo()}">← modos</a></div>
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
    function desenharPlano() {
        const est = minhaInfo(), r = plano.rodada;
        const okPlano = M.sanitizar(plano, est, r);
        const dout = okPlano.doutrina, cmdUsado = M.custoDefesa(okPlano), orc = M.orcamento(r, dout), gastoAtq = M.custoAtaque(okPlano.ataque, dout);
        const infoDele = lado() === 'A' ? jogo.B : jogo.A;
        const ultimo = jogo.rodadas[jogo.rodadas.length - 1];
        let intel = '';
        if (ultimo) {
            const ele = lado() === 'A' ? ultimo.planoB : ultimo.planoA;
            const vig = ele.escala.filter(f => f === 'vigia').length;
            intel = `<div class="intel">${infoDele.doutrina ? `${M.D.DOUTRINAS[infoDele.doutrina].icone} ${esc(nomeAdv())} usa a doutrina <b>${M.D.DOUTRINAS[infoDele.doutrina].nome}</b>. ` : ''}🔎 Na rodada passada, ${esc(nomeAdv())} atacou com <b>${ele.ataque.infantaria} infantaria, ${ele.ataque.artilharia} artilharia e ${ele.ataque.blindado} blindado</b>, e defendeu com ${vig} vigias, postura ${({ atacar: 'Atacar', equilibrado: 'Equilíbrio', abrigar: 'Abrigar' })[ele.postura]}${ele.contra ? ' e contra-bateria' : ''}.</div>`;
        }
        const sold = est.soldados.map((s, i) => `<button class="sold" data-s="${i}" ${s.cond <= 0 ? 'disabled' : ''}>
            <span class="ponto" style="background:${corCond(s.cond)}"></span>
            <span><div class="nm">${esc(s.nome)}</div><div class="fn">${s.cond <= 0 ? '✝ fora' : ({ vigia: '🔭 Vigília', obras: '🔨 Obras', descanso: '💤 Descanso' })[plano.escala[i]]}</div></span></button>`).join('');
        const post = (p, t, d) => `<button class="opc ${plano.postura === p ? 'on' : ''}" data-p="${p}">${t}<small>${d}</small></button>`;
        const melh = Object.entries(M.D.MELHORIAS).map(([id, m]) => {
            const tem = est.melh[id], aqui = plano.compras.filter(x => x === id).length, cheio = tem + aqui >= m.max;
            return `<div class="item"><div class="txt">${m.nome} ${tem + aqui ? `<b>${tem + aqui}/${m.max}</b>` : ''}<small>${m.desc}</small></div>
                ${aqui ? `<button class="comprar on" data-desfaz="${id}">✔ ${m.custo}★ (desfazer)</button>` : `<button class="comprar" data-compra="${id}" ${cheio || est.cmd - cmdUsado < m.custo ? 'disabled' : ''}>${cheio ? 'máximo' : m.custo + '★'}</button>`}</div>`;
        }).join('');
        const atq = Object.entries(M.D.ATAQUE).map(([id, a]) => `<div class="item"><div class="txt">${a.nome} · ${M.custoDe(id, dout)} pts<small>${a.desc}</small></div>
            <button class="passo" data-menos="${id}">−</button><span class="qtd">${okPlano.ataque[id]}</span><button class="passo" data-mais="${id}" ${gastoAtq + M.custoDe(id, dout) > orc || okPlano.ataque[id] >= M.maxDe(id, dout) ? 'disabled' : ''}>+</button></div>`).join('');
        const doutrinas = r === 1 ? `<h2>🎖 SUA DOUTRINA <span class="sub">· vale o duelo inteiro</span></h2><div class="linhaBtns">${Object.entries(M.D.DOUTRINAS).map(([id, d]) => `<button class="opc ${dout === id ? 'on' : ''}" data-dout="${id}">${d.icone} ${d.nome}</button>`).join('')}</div>
            <div class="sub" style="font-size:11px;margin-top:4px">${M.D.DOUTRINAS[dout].desc}. Assalto vence Artilharia, Artilharia vence Fortaleza, Fortaleza vence Assalto.</div>`
            : (dout ? `<div class="sub" style="margin-top:6px">${M.D.DOUTRINAS[dout].icone} Sua doutrina: <b>${M.D.DOUTRINAS[dout].nome}</b> · ${M.D.DOUTRINAS[dout].desc}</div>` : '');
        mostrar(`<div class="placar"><span>${esc(meuNome)}</span><span><span class="num">${jogo.placar[lado()]}</span>×<span class="num">${jogo.placar[outro()]}</span></span><span>${esc(nomeAdv())}</span></div>
            <div class="topoLinha" style="margin-top:6px"><b>RODADA ${r}/${M.D.RODADAS} · PREPARAR</b><b id="seg">${PRAZO}s</b></div>
            <div class="tempo"><div id="barraTempo" style="width:100%"></div></div>
            <div class="recs"><div class="rec">Munição<b>${Math.round(est.mun)}</b></div><div class="rec">Comando<b>★${est.cmd - cmdUsado}</b></div><div class="rec">Trincheira<b>${Math.round(est.trinch)}%</b></div></div>
            ${intel}${doutrinas}
            <h2>🛡️ SUA DEFESA</h2>
            <div class="esq">${sold}</div>
            <div class="sub" style="font-size:11px;margin-top:4px">Toque para trocar. 🔭 atira e cansa · 🔨 conserta a trincheira · 💤 recupera, protegido.</div>
            <div class="linhaBtns" style="margin-top:8px">${post('atacar', 'ATACAR', '+dano, +perigo')}${post('equilibrado', 'EQUILÍBRIO', 'padrão')}${post('abrigar', 'ABRIGAR', 'resiste, atira pouco')}</div>
            <div class="caixa" style="padding:4px 12px">${melh}
                <div class="item"><div class="txt">Contra-bateria<small>cancela a 1ª artilharia dele nesta rodada</small></div>
                <button class="comprar ${okPlano.contra ? 'on' : ''}" id="bContra" ${!plano.contra && est.cmd - cmdUsado < M.D.CONTRA_CUSTO ? 'disabled' : ''}>${okPlano.contra ? '✔ ' : ''}${M.D.CONTRA_CUSTO}★</button></div></div>
            <h2>⚔️ SEU ATAQUE <span class="sub">· ${orc - gastoAtq} de ${orc} pontos sobrando</span></h2>
            <div class="caixa" style="padding:4px 12px">${atq}</div>
            <button class="grande" id="bOk">✔ OK, PRONTO</button>
            <div class="sub" style="text-align:center;margin-top:6px">Se o tempo acabar, o plano vai do jeito que estiver.</div>`);
        $app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const i = +b.dataset.s; plano.escala[i] = M.FUNCOES[(M.FUNCOES.indexOf(plano.escala[i]) + 1) % 3]; desenharPlano(); });
        $app.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { plano.postura = b.dataset.p; desenharPlano(); });
        $app.querySelectorAll('[data-compra]').forEach(b => b.onclick = () => { plano.compras.push(b.dataset.compra); desenharPlano(); });
        $app.querySelectorAll('[data-desfaz]').forEach(b => b.onclick = () => { const i = plano.compras.lastIndexOf(b.dataset.desfaz); if (i >= 0) plano.compras.splice(i, 1); desenharPlano(); });
        $app.querySelectorAll('[data-mais]').forEach(b => b.onclick = () => { plano.ataque[b.dataset.mais] = (okPlano.ataque[b.dataset.mais] || 0) + 1; desenharPlano(); });
        $app.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => { plano.ataque[b.dataset.menos] = Math.max(0, (okPlano.ataque[b.dataset.menos] || 0) - 1); desenharPlano(); });
        document.getElementById('bContra').onclick = () => { plano.contra = !okPlano.contra; desenharPlano(); };
        $app.querySelectorAll('[data-dout]').forEach(b => b.onclick = () => { plano.doutrina = b.dataset.dout; const m = mem(duelo.id); m.doutrina = plano.doutrina; gravarMem(duelo.id, m); desenharPlano(); });
        document.getElementById('bOk').onclick = () => enviarPlano(false);
        // mantém o relógio certo logo após redesenhar
        const resta = PRAZO - (Date.now() - mem(duelo.id).prazo.inicio) / 1000;
        document.getElementById('barraTempo').style.width = Math.max(0, 100 * resta / PRAZO) + '%';
        document.getElementById('seg').textContent = Math.max(0, Math.ceil(resta)) + 's';
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

    // ---------- Resultado da rodada: replay dos dois campos ----------
    function telaReplay(indice) {
        pararPoll();
        tela = 'replay';
        const r = jogo.rodadas[indice];
        const meu = lado(), dele = outro();
        mostrar(`<div class="placar"><span>${esc(meuNome)}</span><span>RODADA ${r.rodada}</span><span>${esc(nomeAdv())}</span></div>
            <div class="rotCampo"><span>🛡️ SUA TRINCHEIRA</span><span id="infoMeu"></span></div><canvas id="cvMeu" width="800" height="340"></canvas>
            <div class="rotCampo"><span>⚔️ TRINCHEIRA DE ${esc(nomeAdv()).toUpperCase()}</span><span id="infoDele"></span></div><canvas id="cvDele" width="800" height="340"></canvas>
            <div id="fimReplay"></div>
            <button class="secundario" id="bPular">Pular ⏭</button>`);
        const prep = M.prepararRodada(r.antesA, r.antesB, r.planoA, r.planoB, r.rodada, duelo.semente);
        const campoMeu = meu === 'A' ? prep.campoA : prep.campoB, campoDele = meu === 'A' ? prep.campoB : prep.campoA;
        const cvM = document.getElementById('cvMeu').getContext('2d'), cvD = document.getElementById('cvDele').getContext('2d');
        let ultimo = performance.now(), acc = 0, terminou = false;
        const VEL = 4; // replay 4× mais rápido
        const concluir = () => {
            if (terminou) return; terminou = true;
            while (!campoMeu.terminou || !campoDele.terminou) { campoMeu.passo(); campoDele.passo(); }
            desenharCampo(cvM, campoMeu); desenharCampo(cvD, campoDele);
            const sofri = meu === 'A' ? r.danoA : r.danoB, causei = meu === 'A' ? r.danoB : r.danoA;
            const ganhei = r.vencedor === meu, perdi = r.vencedor === dele;
            const placar = { meu: 0, dele: 0 };
            jogo.rodadas.slice(0, indice + 1).forEach(x => { if (x.vencedor === meu) placar.meu++; else if (x.vencedor === dele) placar.dele++; });
            document.getElementById('bPular').remove();
            document.getElementById('fimReplay').innerHTML = `<div class="caixa">
                <div class="resultado ${ganhei ? 'bom' : perdi ? 'ruim' : ''}">${ganhei ? '✔ RODADA SUA' : perdi ? '✖ RODADA DE ' + esc(nomeAdv()).toUpperCase() : 'EMPATE NA RODADA'}</div>
                <div class="item"><div class="txt">Dano que você causou</div><b>${Math.round(causei)}</b></div>
                <div class="item"><div class="txt">Dano que você sofreu</div><b>${Math.round(sofri)}</b></div>
                <div class="placar" style="margin-top:6px"><span>${esc(meuNome)}</span><span><span class="num">${placar.meu}</span>×<span class="num">${placar.dele}</span></span><span>${esc(nomeAdv())}</span></div></div>
                <button class="grande" id="bProx">${indice + 1 >= jogo.rodadas.length && jogo.vencedor ? 'VER O RESULTADO FINAL ▶' : 'PRÓXIMA RODADA ▶'}</button>`;
            document.getElementById('bProx').onclick = () => { const m = mem(duelo.id); m.vistas = indice + 1; gravarMem(duelo.id, m); tela = ''; decidirTela(); retomarPoll(); };
        };
        document.getElementById('bPular').onclick = concluir;
        const quadro = (agora) => {
            if (terminou) return;
            acc += Math.min(0.25, (agora - ultimo) / 1000) * VEL; ultimo = agora;
            while (acc >= M.D.DT && !(campoMeu.terminou && campoDele.terminou)) { campoMeu.passo(); campoDele.passo(); acc -= M.D.DT; }
            desenharCampo(cvM, campoMeu); desenharCampo(cvD, campoDele);
            document.getElementById('infoMeu').textContent = `trincheira ${Math.round(campoMeu.est.trinch)}%`;
            document.getElementById('infoDele').textContent = `trincheira ${Math.round(campoDele.est.trinch)}%`;
            if (campoMeu.terminou && campoDele.terminou) return concluir();
            animacao = requestAnimationFrame(quadro);
        };
        animacao = requestAnimationFrame(quadro);
    }
    function pararPoll() { clearInterval(timerPoll); timerPoll = null; clearInterval(timerPrazo); }
    function retomarPoll() { if (!timerPoll && duelo && duelo.id) timerPoll = setInterval(sincronizar, POLL); }

    // ---------- Desenho de um campo de batalha ----------
    const IMGS = {};
    ['mira', 'trabalho', 'come'].forEach(k => { const im = new Image(); im.src = 'assets/soldados/' + k + '.png'; IMGS[k] = im; });
    const SPR = { mira: { ax: 62, ay: 208 }, trabalho: { ax: 80, ay: 193 }, come: { ax: 80, ay: 190 } };
    const corCond = (c) => (c <= 0 ? '#555' : c < 35 ? '#e0533f' : c < 65 ? '#e3b04b' : '#7bc96f');
    function desenharCampo(ctx, campo) {
        const W = 400, H = 170;
        ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
        const ceu = ctx.createLinearGradient(0, 0, 0, 110); ceu.addColorStop(0, '#46544a'); ceu.addColorStop(1, '#343a30');
        ctx.fillStyle = ceu; ctx.fillRect(0, 0, W, 112);
        ctx.strokeStyle = 'rgba(211,154,69,.35)'; ctx.setLineDash([5, 4]); const yAlc = yDe(M.D.ALCANCE); ctx.beginPath(); ctx.moveTo(0, yAlc); ctx.lineTo(W, yAlc); ctx.stroke(); ctx.setLineDash([]);
        campo.inimigos.forEach(e => {
            const y = yDe(e.dist), s = 0.7 + (1 - e.dist / 300) * 0.5;
            if (e.tipo === 'blindado') { ctx.fillStyle = '#2a0f10'; ctx.strokeStyle = '#c0392b'; ctx.fillRect(e.x - 12 * s, y - 8 * s, 24 * s, 8 * s); ctx.strokeRect(e.x - 12 * s, y - 8 * s, 24 * s, 8 * s); ctx.fillRect(e.x - 5 * s, y - 12 * s, 10 * s, 4 * s); }
            else { ctx.fillStyle = '#2a0f10'; ctx.strokeStyle = '#c0392b'; ctx.beginPath(); ctx.arc(e.x, y - 11 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(e.x - 2.5 * s, y - 8.5 * s, 5 * s, 8.5 * s); }
            if (campo.t - (e.alvejado || -9) < 0.15) { ctx.strokeStyle = 'rgba(255,224,138,.7)'; ctx.beginPath(); ctx.moveTo(e.x, y - 6); ctx.lineTo(W / 2, 118); ctx.stroke(); }
        });
        // trincheira e abrigo
        ctx.fillStyle = '#5b4a33'; ctx.fillRect(0, 112, W, 8);
        ctx.fillStyle = '#6f5c40'; for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.ellipse(x + 8, 112, 8, 4, 0, Math.PI, 0); ctx.fill(); }
        ctx.fillStyle = '#2b2219'; ctx.fillRect(0, 120, W, 26); ctx.fillStyle = '#1b1510'; ctx.fillRect(0, 146, W, 24);
        // barra da trincheira
        ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(6, 6, 100, 6); ctx.fillStyle = campo.est.trinch < 35 ? '#c0392b' : campo.est.trinch < 65 ? '#b37d2e' : '#5a7356'; ctx.fillRect(6, 6, campo.est.trinch, 6);
        // soldados
        const grupos = { vigia: [], obras: [], descanso: [] };
        campo.est.soldados.forEach(s => { if (s.cond > 0 && grupos[s.funcao]) grupos[s.funcao].push(s); });
        const desenhaS = (s, x, y, spr, F) => {
            const im = IMGS[spr], a = SPR[spr];
            if (im.complete && im.naturalWidth) ctx.drawImage(im, x - a.ax * F, y - a.ay * F, im.naturalWidth * F, im.naturalHeight * F);
            ctx.fillStyle = corCond(s.cond); ctx.beginPath(); ctx.arc(x, y - a.ay * F - 3, 2.2, 0, Math.PI * 2); ctx.fill();
        };
        grupos.vigia.forEach((s, i) => desenhaS(s, 50 + i * 62, 142, 'mira', 0.12));
        grupos.obras.forEach((s, i) => desenhaS(s, 370 - i * 30, 142, 'trabalho', 0.12));
        grupos.descanso.forEach((s, i) => desenhaS(s, 30 + i * 34, 169, 'come', 0.1));
        // efeitos recentes
        campo.eventos.filter(ev => campo.t - ev.t < 0.6).forEach(ev => {
            const a = 1 - (campo.t - ev.t) / 0.6;
            if (ev.tipo === 'artilharia' || ev.tipo === 'invasao') { ctx.fillStyle = `rgba(255,150,50,${a})`; ctx.beginPath(); ctx.arc(ev.x || (60 + (ev.soldado || 0) * 50), 125, 14 * (1.3 - a), 0, Math.PI * 2); ctx.fill(); }
            else if (ev.tipo === 'contra') { ctx.fillStyle = `rgba(160,220,150,${a})`; ctx.font = 'bold 12px monospace'; ctx.fillText('CONTRA-BATERIA!', 140, 60); }
            else if (ev.tipo === 'abate') { ctx.fillStyle = `rgba(255,90,70,${a})`; ctx.font = 'bold 10px monospace'; ctx.fillText('✖', (ev.x || 200) - 3, 70); }
        });
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '9px monospace'; ctx.fillText(`${Math.round(campo.t)}s`, W - 26, 12);
    }
    const yDe = (dist) => 10 + (1 - Math.max(0, Math.min(300, dist)) / 300) * 100;

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
            <button class="secundario" id="bLobby">Voltar ao lobby</button>
            <a class="voltar" href="${linkDoJogo()}" style="display:block;text-align:center;margin-top:14px">← modos de jogo</a>`);
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
        if (!r) { mostrar(`<div class="topoLinha"><h1>🎬 REPLAY</h1><a class="voltar" href="${linkDoJogo()}">← modos</a></div><div class="espera"><div class="icone">🔎</div><div class="sub">Replay não encontrado. O duelo pode ainda não ter terminado.</div></div>`); return; }
        const lista = [];
        for (let k = 1; k <= M.D.RODADAS; k++) { const a = r.planos.find(p => p.rodada === k && p.lado === 'A'), b = r.planos.find(p => p.rodada === k && p.lado === 'B'); if (!a || !b) break; lista.push({ A: a.plano, B: b.plano }); }
        const est = M.estadoDoDuelo(r.semente, lista);
        const nome = { A: r.nome_a || 'Comandante A', B: r.nome_b || 'Comandante B' };
        const mostrarRodada = (i) => {
            if (i >= est.rodadas.length) {
                const v = r.vencedor || est.vencedor;
                mostrar(`<div class="topoLinha"><h1>🎬 REPLAY</h1><a class="voltar" href="${linkDoJogo()}">← modos</a></div>
                    <div class="espera"><div class="icone">🏆</div><h2 style="text-align:center">${esc(nome[v] || '')} venceu</h2><div class="sub">${r.wo ? 'Por W.O.' : `Placar: ${esc(nome.A)} ${est.placar.A} × ${est.placar.B} ${esc(nome.B)}`}</div></div>
                    <button class="grande" id="bDeNovo">▶ VER DE NOVO</button><a class="grande" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box" href="${location.pathname}">⚔️ JOGAR TRINCHEIRAS ONLINE</a>`);
                document.getElementById('bDeNovo').onclick = () => mostrarRodada(0);
                return;
            }
            const x = est.rodadas[i];
            const dA = M.D.DOUTRINAS[est.A.doutrina], dB = M.D.DOUTRINAS[est.B.doutrina];
            mostrar(`<div class="placar"><span>${esc(nome.A)}${dA ? ' ' + dA.icone : ''}</span><span>RODADA ${x.rodada}</span><span>${dB ? dB.icone + ' ' : ''}${esc(nome.B)}</span></div>
                <div class="rotCampo"><span>🛡️ TRINCHEIRA DE ${esc(nome.A).toUpperCase()}</span><span id="iA"></span></div><canvas id="cvA" width="800" height="340"></canvas>
                <div class="rotCampo"><span>🛡️ TRINCHEIRA DE ${esc(nome.B).toUpperCase()}</span><span id="iB"></span></div><canvas id="cvB" width="800" height="340"></canvas>
                <div id="fimR"></div><button class="secundario" id="bPularR">Pular ⏭</button>`);
            const prep = M.prepararRodada(x.antesA, x.antesB, x.planoA, x.planoB, x.rodada, r.semente);
            const ca = document.getElementById('cvA').getContext('2d'), cb = document.getElementById('cvB').getContext('2d');
            let ult = performance.now(), acc = 0, acabou = false;
            const fim = () => {
                if (acabou) return; acabou = true;
                while (!prep.campoA.terminou || !prep.campoB.terminou) { prep.campoA.passo(); prep.campoB.passo(); }
                desenharCampo(ca, prep.campoA); desenharCampo(cb, prep.campoB);
                const pl = { A: 0, B: 0 }; est.rodadas.slice(0, i + 1).forEach(y => { if (y.vencedor) pl[y.vencedor]++; });
                document.getElementById('bPularR').remove();
                document.getElementById('fimR').innerHTML = `<div class="caixa"><div class="resultado">${x.vencedor ? 'Rodada de ' + esc(nome[x.vencedor]) : 'Empate na rodada'}</div>
                    <div class="placar" style="margin-top:6px"><span>${esc(nome.A)}</span><span><span class="num">${pl.A}</span>×<span class="num">${pl.B}</span></span><span>${esc(nome.B)}</span></div></div>
                    <button class="grande" id="bProxR">${i + 1 < est.rodadas.length ? 'PRÓXIMA RODADA ▶' : 'RESULTADO ▶'}</button>`;
                document.getElementById('bProxR').onclick = () => mostrarRodada(i + 1);
            };
            document.getElementById('bPularR').onclick = fim;
            const q = (agora) => {
                if (acabou) return;
                acc += Math.min(0.25, (agora - ult) / 1000) * 4; ult = agora;
                while (acc >= M.D.DT && !(prep.campoA.terminou && prep.campoB.terminou)) { prep.campoA.passo(); prep.campoB.passo(); acc -= M.D.DT; }
                desenharCampo(ca, prep.campoA); desenharCampo(cb, prep.campoB);
                document.getElementById('iA').textContent = `trincheira ${Math.round(prep.campoA.est.trinch)}%`;
                document.getElementById('iB').textContent = `trincheira ${Math.round(prep.campoB.est.trinch)}%`;
                if (prep.campoA.terminou && prep.campoB.terminou) return fim();
                animacao = requestAnimationFrame(q);
            };
            animacao = requestAnimationFrame(q);
        };
        mostrarRodada(0);
    }

    // exposto para os testes
    window.__duelo = { estado: () => ({ tela, duelo, jogo, plano }), sincronizar };
    iniciar();
})();
