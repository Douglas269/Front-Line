// FrontLine · Conquista online (até 4 jogadores, carregado depois de conquista.js)
// Quem cria a sala é o ANFITRIÃO: o celular dele roda o jogo (mesmo motor da campanha) e os bots preenchem as vagas.
// Os outros mandam as ordens pelo canal em tempo real do Supabase e recebem o estado do mapa a cada segundo.
// Cada um vê a si mesmo como "Você": o estado chega com os rótulos trocados, então a mesma tela serve para todos.
// No online as batalhas se resolvem sozinhas (o mapa não para), sem diplomacia e sem generais.
// window.CONQ_REDE permite testar com uma rede falsa (sem tocar no Supabase).

const ONLINE_URL = 'https://shoxvekaeuynlutkowqb.supabase.co', ONLINE_KEY = 'sb_publishable_Tjf0FceJGTPHs81jG0R-fg_ZxF9urW5';
const ONLINE_FASE = 3;                               // Região central: 36 províncias, 4 países
const ONLINE_VAGAS = ['jogador', 'bravo', 'charlie', 'delta'];
const ONLINE_ESTADO_MS = window.CONQ_ESTADO_MS || 1000;
const ON = { rede: null, canal: null, papel: null, codigo: null, eu: null, minha: 'jogador', jogadores: [], humanos: {}, eventos: [], seq: 0, vistos: 0, timer: null, alertados: {}, nomesOriginais: null, hostId: null };
const TIPOS_PROV = ['capital', 'cidade', 'campo', 'floresta', 'morro'], TIPOS_S = ['inf', 'metr', 'art', 'cav', 'blind'], OBRAS_IDX = ['forte', 'ferrovia', 'fabrica', 'hospital'];
const idAleatorio = () => Math.random().toString(36).slice(2, 10);
const meuApelido = () => { try { return (JSON.parse(localStorage.getItem('frontline-config')) || {}).apelido || ''; } catch (e) { return ''; } };
const escO = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Rede: canal do Supabase (broadcast + presence) ---------- */
function redeSupabase() {
    if (!window.supabase || !window.supabase.createClient) throw new Error('Sem conexão com o servidor.');
    const sb = window.supabase.createClient(ONLINE_URL, ONLINE_KEY, { auth: { persistSession: false } });
    return {
        conectar(nome, meta, ao) {
            const ch = sb.channel(nome, { config: { broadcast: { self: false }, presence: { key: meta.id } } });
            ch.on('broadcast', { event: 'msg' }, ({ payload }) => ao.mensagem(payload));
            ch.on('presence', { event: 'sync' }, () => ao.presenca(Object.values(ch.presenceState()).map(l => l[0])));
            ch.subscribe(async (st) => { if (st === 'SUBSCRIBED') { await ch.track(meta); ao.conectado && ao.conectado(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') ao.erro && ao.erro('Sem conexão com a sala.'); });
            return { enviar: (payload) => ch.send({ type: 'broadcast', event: 'msg', payload }), sair: () => { try { ch.untrack(); sb.removeChannel(ch); } catch (e) {} } };
        }
    };
}
function conectarSala(codigo, papel) {
    ON.rede = ON.rede || window.CONQ_REDE || redeSupabase();
    ON.codigo = codigo; ON.papel = papel;
    ON.eu = ON.eu || { id: idAleatorio(), nome: (document.getElementById('onNome') && document.getElementById('onNome').value.trim()) || meuApelido() || 'Comandante' };
    ON.eu.nome = ON.eu.nome.slice(0, 18);
    if (papel === 'host') ON.hostId = ON.eu.id;
    ON.canal = ON.rede.conectar('conquista-' + codigo, { id: ON.eu.id, nome: ON.eu.nome, host: papel === 'host', em: Date.now() }, {
        mensagem: receberMensagem,
        presenca: (lista) => { ON.jogadores = lista.sort((a, b) => (b.host - a.host) || (a.em - b.em)); aoMudarPresenca(); },
        erro: (m) => mostrarSalaOnline(m)
    });
}
const enviarRede = (payload) => { try { ON.canal && ON.canal.enviar(payload); } catch (e) {} };

/* ---------- Telas: entrar, sala de espera ---------- */
function telaOnline(msg) {
    const sala = new URLSearchParams(location.search).get('sala') || '';
    mostrarTela(`<h2>🌐 CONQUISTA ONLINE</h2>
        <div class="sub">Até 4 comandantes no mesmo mapa (36 províncias, 18 minutos). Quem cria a sala hospeda o jogo no celular dele; as vagas que sobrarem ficam com bots. Batalhas se resolvem sozinhas, sem diplomacia e sem generais. Vence quem tomar todas as capitais, ou quem tiver mais províncias no fim.</div>
        <input id="onNome" class="campoOn" maxlength="18" placeholder="Seu apelido" value="${escO(meuApelido())}">
        <div class="erroOn">${escO(msg || '')}</div>
        <button class="grande" onclick="criarSalaOnline()">🏳️ CRIAR UMA SALA</button>
        <div class="sub" style="margin-top:12px">Recebeu um código?</div>
        <input id="onCodigo" class="campoOn" maxlength="5" placeholder="CÓDIGO" style="text-transform:uppercase;letter-spacing:4px" value="${escO(sala)}">
        <button class="grande secundaria" onclick="entrarSalaOnline()">ENTRAR NA SALA</button>
        <button class="grande secundaria" onclick="mostrarInicio()">← VOLTAR</button>`);
}
function criarSalaOnline() {
    const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = ''; for (let i = 0; i < 5; i++) c += letras[Math.floor(Math.random() * letras.length)];
    try { conectarSala(c, 'host'); } catch (e) { return telaOnline(e.message); }
    mostrarSalaOnline();
}
function entrarSalaOnline() {
    const c = (document.getElementById('onCodigo').value || '').trim().toUpperCase();
    if (c.length !== 5) return telaOnline('Digite o código de 5 letras.');
    try { conectarSala(c, 'cliente'); } catch (e) { return telaOnline(e.message); }
    mostrarSalaOnline();
}
function mostrarSalaOnline(msg) {
    if (G && G.online && !G.fim) return;
    const lista = ON.jogadores.slice(0, 4).map((j, i) => `<div class="linha-tropa"><div class="txt"><b style="color:${FACCOES[ONLINE_VAGAS[i]].cor}">${i === 0 ? '👑 ' : ''}${escO(j.nome)}</b><small>${j.host ? 'anfitrião' : 'pronto'}${j.id === (ON.eu && ON.eu.id) ? ' · você' : ''}</small></div></div>`).join('');
    const souHost = ON.papel === 'host', cheia = ON.jogadores.length > 4, paises = 1 + FASES[ONLINE_FASE - 1].bots.length, bots = paises - Math.min(4, ON.jogadores.length);
    mostrarTela(`<h2>🌐 SALA ${escO(ON.codigo)}</h2>
        <div class="sub">Mande o código ou o link para os amigos. ${souHost ? 'Quando todos estiverem aqui, toque em Começar.' : 'Esperando o anfitrião começar…'}</div>
        <div class="codigoOn">${escO(ON.codigo)}</div>
        <button class="grande secundaria" onclick="compartilharSala()">📤 COMPARTILHAR O LINK</button><div class="sub" id="onCopiado" style="text-align:center"></div>
        <div class="lista-tropas">${lista || '<div class="sub">Conectando…</div>'}${[...Array(Math.max(0, bots))].map((_, i) => `<div class="linha-tropa trancada"><div class="txt">🤖 ${i < 4 - Math.min(4, ON.jogadores.length) ? 'vaga livre (fica com um bot)' : 'bot'}</div></div>`).join('')}</div>
        ${cheia ? '<div class="erroOn">A sala já tem 4 comandantes: quem entrou por último vai assistir.</div>' : ''}
        <div class="erroOn">${escO(msg || '')}</div>
        ${souHost ? `<button class="grande" onclick="comecarOnline()" ${ON.jogadores.length < 2 ? 'disabled' : ''}>⚔️ COMEÇAR (${Math.min(4, ON.jogadores.length)} comandantes + ${bots} bot${bots === 1 ? '' : 's'})</button>` : '<div class="sub pisca" style="text-align:center;margin-top:10px">📡 aguardando…</div>'}
        <button class="grande secundaria" onclick="sairDaSala()">SAIR DA SALA</button>`);
}
async function compartilharSala() {
    const base = location.protocol.startsWith('http') ? location.origin + '/conquista.html' : location.href.split('?')[0];
    const url = `${base}?sala=${ON.codigo}`, texto = `Conquista online no FrontLine! Sala ${ON.codigo}: ${url}`;
    try { if (navigator.share) { await navigator.share({ title: 'Conquista online', text: texto, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(texto); document.getElementById('onCopiado').textContent = 'Link copiado!'; } catch (e) { document.getElementById('onCopiado').textContent = url; }
}
function sairDaSala() {
    clearInterval(ON.timer); ON.timer = null;
    if (ON.canal) ON.canal.sair();
    ON.canal = null; ON.papel = null; ON.jogadores = [];
    if (G && G.online) { restaurarFaccoes(); novoJogo(lerFase()); G.semSalvar = true; }
    document.body.classList.remove('online'); ON.atrasado = false;
    mostrarInicio();
}
function aoMudarPresenca() {
    if (!G || !G.online) { if (document.getElementById('tela').style.display === 'flex' && ON.codigo) mostrarSalaOnline(); return; }
    const ids = ON.jogadores.map(j => j.id);
    if (G.cliente && ON.hostId && !ids.includes(ON.hostId) && !G.fim) { // o anfitrião saiu: acabou
        G.fim = 'online'; G.vencedor = null; G.motivoFim = 'O anfitrião saiu da sala e o jogo acabou.'; mostrarFimOnline();
    }
    if (ON.papel === 'host') Object.entries(ON.humanos).forEach(([fac, h]) => { // quem saiu vira bot
        if (!h.saiu && !ids.includes(h.id)) {
            h.saiu = true; G.pensar[fac] = 2; FACCOES[fac].nome = `${h.nome} (bot)`;
            noticia(`📡 ${h.nome} saiu da sala: um bot assumiu o país dele.`, true);
        }
    });
}

/* ---------- Começo ---------- */
function comecarOnline() {
    if (ON.papel !== 'host' || ON.jogadores.length < 2) return;
    const humanos = {};
    ON.jogadores.slice(1, 4).forEach((j, i) => { humanos[ONLINE_VAGAS[i + 1]] = { id: j.id, nome: j.nome }; });
    ON.humanos = humanos;
    enviarRede({ tipo: 'inicio', humanos, host: { id: ON.eu.id, nome: ON.eu.nome }, fase: ONLINE_FASE });
    iniciarJogoOnline('host', humanos, { id: ON.eu.id, nome: ON.eu.nome });
}
function guardarFaccoes() { if (!ON.nomesOriginais) ON.nomesOriginais = Object.fromEntries(Object.entries(FACCOES).map(([k, v]) => [k, { nome: v.nome, cor: v.cor }])); }
function restaurarFaccoes() { if (ON.nomesOriginais) Object.entries(ON.nomesOriginais).forEach(([k, v]) => Object.assign(FACCOES[k], v)); }
function iniciarJogoOnline(papel, humanos, host) {
    guardarFaccoes(); restaurarFaccoes();
    ON.humanos = humanos; ON.hostId = host.id; ON.eventos = []; ON.seq = 0; ON.vistos = 0; ON.alertados = {};
    novoJogo(ONLINE_FASE);
    G.semSalvar = true; G.online = { papel, host };
    G.ex.forEach(e => { if (e.dono === 'jogador') e.general = null; }); // sem generais no online
    if (papel === 'host') {
        Object.entries(humanos).forEach(([fac, h]) => { delete G.pensar[fac]; FACCOES[fac].nome = h.nome; });
        G.intel = Object.fromEntries(Object.keys(humanos).map(f => [f, { espiado: {}, revelado: {}, espioes: [] }]));
        FACCOES.jogador.nome = 'Você';
        noticia(`🌐 Conquista online: ${[host.nome, ...Object.values(humanos).map(h => h.nome)].join(', ')}${Object.keys(humanos).length < 3 ? ' e bots' : ''}. Boa sorte!`);
        clearInterval(ON.timer); ON.timer = setInterval(transmitirEstado, ONLINE_ESTADO_MS);
    } else {
        G.cliente = true;
        // rótulos locais: eu sou "jogador"; o anfitrião aparece na minha vaga real
        FACCOES[ON.minha].nome = host.nome;
        Object.entries(humanos).forEach(([fac, h]) => { if (fac !== ON.minha) FACCOES[fac].nome = h.nome; });
        FACCOES.jogador.nome = 'Você';
        G.capitalJogador = null;
        noticia('🌐 Conectado. O anfitrião está rodando o jogo: suas ordens vão pela rede.');
    }
    esconderTela(); renderPainel();
    document.body.classList.add('online');
}

/* ---------- Anfitrião: aplica as ordens que chegam e transmite o estado ---------- */
function receberMensagem(m) {
    if (!m || !m.tipo) return;
    if (m.tipo === 'inicio' && ON.papel === 'cliente' && !(G && G.online)) {
        const minha = Object.entries(m.humanos).find(([, h]) => h.id === ON.eu.id);
        if (!minha) { ON.espectador = true; mostrarTela('<h2>🌐 SALA CHEIA</h2><div class="sub">O jogo começou com 4 comandantes. Você ficou de fora desta vez.</div><button class="grande" onclick="sairDaSala()">VOLTAR</button>'); return; }
        ON.minha = minha[0];
        iniciarJogoOnline('cliente', m.humanos, m.host);
    } else if (m.tipo === 'estado' && G && G.cliente) aplicarEstado(m);
    else if (m.tipo === 'estado' && ON.papel === 'cliente' && !(G && G.online) && !ON.atrasado) { // entrou depois do começo
        ON.atrasado = true;
        mostrarTela('<h2>🌐 O JOGO JÁ COMEÇOU</h2><div class="sub">Esta sala já está em partida. Peça ao anfitrião para criar uma sala nova quando acabar.</div><button class="grande" onclick="sairDaSala()">VOLTAR</button>');
    }
    else if (m.tipo === 'acao' && ON.papel === 'host' && G && G.online) aplicarAcao(m);
}
const faccaoDoId = (id) => (Object.entries(ON.humanos).find(([, h]) => h.id === id && !h.saiu) || [])[0];
function aplicarAcao(m) {
    const dono = faccaoDoId(m.de); if (!dono || G.eliminados[dono] || G.fim) return;
    const a = m.acao || {};
    if (a.tipo === 'ordem') { const e = G.ex.find(x => x.id === a.exId); if (e && e.dono === dono) ordemOriginal(a.exId, a.destId, a.qtd, a.missao); }
    else if (a.tipo === 'recrutar') { for (let i = 0; i < Math.min(5, a.n || 1); i++) if (!recrutarEm(a.prov, dono, a.tropa || 'inf')) break; }
    else if (a.tipo === 'construir') construirOriginal(a.prov, a.obra, dono);
    else if (a.tipo === 'pesquisar') pesquisarOriginal(a.id, dono);
    else if (a.tipo === 'fortificar') fortificarOriginal(a.prov, dono);
    else if (a.tipo === 'espionar') espionarPor(dono, a.prov);
    else if (a.tipo === 'parar') { const e = G.ex.find(x => x.id === a.exId); if (e && e.dono === dono && e.rota.length) { e.rota = e.rota.slice(0, 1); e.missao = 'mover'; } }
}
// espião dos outros comandantes (o do anfitrião é o da campanha)
function espionarPor(dono, id) {
    const p = G.prov[id], f = G.fac[dono], I = G.intel[dono];
    if (!p || !I || p.dono === dono || f.moedas < C.ESPIAO || I.espioes.length >= C.ESPIAO_MAX) return;
    const base = provDe(dono).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!base) return;
    f.moedas -= C.ESPIAO; I.espioes.push({ para: id, x: base.x, y: base.y });
}
function transmitirEstado() {
    if (!G || !G.online || ON.papel !== 'host') return;
    const ids = MAPA.prov.map(p => p.id);
    const snap = {
        tipo: 'estado', t: Math.round(G.t * 10) / 10, fim: G.fim, vencedor: G.vencedor || null, motivoFim: G.motivoFim || '', eliminados: G.eliminados,
        prov: ids.map(id => { const p = G.prov[id]; return [p.dono, TIPOS_PROV.indexOf(p.tipo), Math.round(p.trinch), Math.round(p.moral), OBRAS_IDX.reduce((m, o, i) => m | (p.obras[o] ? 1 << i : 0), 0), p.obra ? [OBRAS_IDX.indexOf(p.obra.id), Math.ceil(p.obra.resta)] : 0, p.capital ? 1 : 0]; }),
        ex: G.ex.map(e => [e.id, e.dono, e.prov, Math.round(e.x), Math.round(e.y), e.rota, e.missao, e.semSuprimento ? 1 : 0, e.general ? 1 : 0, e.s.flatMap(s => [TIPOS_S.indexOf(s.tipo || 'inf'), Math.round(s.vida), Math.round(s.fome), Math.round(s.cansaco)])]),
        fac: Object.fromEntries(Object.entries(G.fac).map(([d, f]) => [d, [Math.floor(f.comida), Math.floor(f.mun), Math.floor(f.moedas)]])),
        pesq: Object.fromEntries(Object.entries(G.pesq).map(([d, st]) => [d, [Object.keys(st.feitas), st.atual ? st.atual.id : null, st.atual ? Math.ceil(st.atual.resta) : 0]])),
        intel: Object.fromEntries(Object.entries(G.intel || {}).map(([d, I]) => [d, { e: I.espiado, r: I.revelado, s: I.espioes.map(s => [s.para, Math.round(s.x), Math.round(s.y)]) }])),
        hostIntel: { e: G.espiado, r: G.revelado }, // para quem quiser ver o que o anfitrião espionou (não usado nos clientes)
        eventos: ON.eventos.slice(-40)
    };
    delete snap.hostIntel;
    enviarRede(snap);
}
// Registra os acontecimentos para cada um montar as próprias notícias
function evento(ev) { ON.eventos.push({ n: ++ON.seq, t: Math.round(G.t), ...ev }); if (ON.eventos.length > 80) ON.eventos.shift(); }

/* ---------- Cliente: recebe o estado e mostra com "Você" no lugar certo ---------- */
function aplicarEstado(m) {
    const minha = ON.minha;
    const L = (d) => (d === minha ? 'jogador' : d === 'jogador' ? minha : d);
    const ids = MAPA.prov.map(p => p.id);
    G.t = m.t;
    m.prov.forEach((v, i) => {
        const p = G.prov[ids[i]];
        p.dono = L(v[0]); p.tipo = TIPOS_PROV[v[1]]; p.trinch = v[2]; p.moral = v[3];
        p.obras = Object.fromEntries(OBRAS_IDX.map((o, k) => [o, !!(v[4] & (1 << k))]));
        p.obra = v[5] ? { id: OBRAS_IDX[v[5][0]], resta: v[5][1] } : null; p.capital = !!v[6];
    });
    const selAntes = G.sel && G.sel.tipo === 'ex' ? G.sel.id : null;
    G.ex = m.ex.map(v => {
        const s = []; for (let k = 0; k < v[9].length; k += 4) s.push({ nome: 'Soldado', tipo: TIPOS_S[v[9][k]], vida: v[9][k + 1], fome: v[9][k + 2], cansaco: v[9][k + 3] });
        return { id: v[0], dono: L(v[1]), prov: v[2], de: v[2], x: v[3], y: v[4], rota: v[5], missao: v[6], semSuprimento: !!v[7], general: v[8] ? 'bot' : null, s, origem: v[2] };
    });
    if (selAntes && !G.ex.some(e => e.id === selAntes)) G.sel = { tipo: 'prov', id: G.capitalJogador };
    G.fac = Object.fromEntries(Object.entries(m.fac).map(([d, f]) => [L(d), { comida: f[0], mun: f[1], moedas: f[2] }]));
    G.pesq = Object.fromEntries(Object.entries(m.pesq).map(([d, st]) => [L(d), { feitas: Object.fromEntries(st[0].map(x => [x, true])), atual: st[1] ? { id: st[1], resta: st[2] } : null }]));
    G.eliminados = Object.fromEntries(Object.entries(m.eliminados || {}).map(([d, v]) => [L(d), v]));
    const I = (m.intel || {})[minha] || { e: {}, r: {}, s: [] };
    G.espiado = Object.fromEntries(Object.entries(I.e).map(([d, v]) => [L(d), v])); G.revelado = I.r;
    G.espioes = I.s.map(x => ({ para: x[0], x: x[1], y: x[2] }));
    if (!G.capitalJogador) { const c = Object.values(G.prov).find(p => p.capital && p.dono === 'jogador'); if (c) { G.capitalJogador = c.id; G.sel = { tipo: 'prov', id: c.id }; centralizar(c.x, c.y); } }
    // notícias novas que me interessam
    (m.eventos || []).filter(ev => ev.n > ON.vistos).forEach(ev => {
        ON.vistos = ev.n;
        const a = L(ev.a), b = ev.b ? L(ev.b) : null, prov = G.prov[ev.p], nome = (d) => (d === 'jogador' ? 'Você' : FACCOES[d] ? FACCOES[d].nome : d);
        const meu = a === 'jogador' || b === 'jogador', ver = meu || (prov && provVisivel(prov.id));
        if (!ver) return;
        if (ev.k === 'conquista') noticia(`🏴 ${nome(a)} ${a === 'jogador' ? 'conquistou' : 'conquistou'} ${prov.nome}${b && b !== 'neutro' ? ' de ' + nome(b) : ''}.`, b === 'jogador');
        else if (ev.k === 'segurou') noticia(`🛡️ ${nome(b)} segurou ${prov.nome} contra ${nome(a)}.`, a === 'jogador');
        else if (ev.k === 'saque') noticia(`💰 ${nome(a)} saqueou ${prov.nome}: ${ev.v} moedas.`, b === 'jogador');
        else if (ev.k === 'eliminado') noticia(`☠ ${nome(a)} perdeu a capital e saiu do jogo.`, a === 'jogador');
        if (ev.k === 'conquista' && a === 'jogador') som('conquista'); else if (ev.k === 'conquista' && b === 'jogador') som('perda');
    });
    // alerta: alguém marchando sobre mim
    G.ex.forEach(e => {
        if (e.dono === 'jogador' || e.dono === 'neutro' || !e.rota.length || ON.alertados[e.id]) return;
        const alvo = G.prov[e.rota[e.rota.length - 1]];
        if (alvo && alvo.dono === 'jogador' && exVisivel(e)) { ON.alertados[e.id] = true; noticia(`🚨 ${FACCOES[e.dono].nome} marcha com ${e.s.length} soldados sobre ${alvo.nome}!`, true); }
    });
    if (m.fim && !G.fim) { G.fim = 'online'; G.vencedor = m.vencedor ? L(m.vencedor) : null; G.motivoFim = m.motivoFim; mostrarFimOnline(); }
}
// entre um estado e outro, os exércitos andam na tela (o anfitrião manda a posição certa no próximo)
function passoCliente(dt) {
    G.t += dt;
    G.ex.forEach(e => {
        if (!e.rota.length) return;
        const alvo = G.prov[e.rota[0]]; if (!alvo) return;
        const dx = alvo.x - e.x, dy = alvo.y - e.y, d = Math.hypot(dx, dy), passo = Math.min(d, velEx(e) * dt);
        if (d > 0.5) { e.x += dx / d * passo; e.y += dy / d * passo; }
    });
    G.espioes.forEach(s => { const p = G.prov[s.para]; if (!p) return; const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), passo = Math.min(d, C.ESPIAO_VEL * dt); if (d > 0.5) { s.x += dx / d * passo; s.y += dy / d * passo; } });
}

/* ---------- Ordens do cliente vão pela rede; o anfitrião usa as funções originais ---------- */
const enviarAcao = (acao) => enviarRede({ tipo: 'acao', de: ON.eu.id, acao });
const ordemOriginal = ordem, construirOriginal = construir, pesquisarOriginal = pesquisar, fortificarOriginal = fortificar, espionarOriginal = espionar, recrutarOriginal = recrutar, pararOriginal = cancelarMarcha;
ordem = function (exId, destId, qtd, missao) {
    if (G && G.cliente) { const e = G.ex.find(x => x.id === exId); if (!e || e.dono !== 'jogador') return false; enviarAcao({ tipo: 'ordem', exId, destId, qtd, missao }); noticia(`📡 Ordem enviada: ${G.prov[destId].nome}.`); som('ordem'); return e; }
    return ordemOriginal(exId, destId, qtd, missao);
};
recrutar = function (id, n = 1, tipo = 'inf') {
    if (G && G.cliente) { enviarAcao({ tipo: 'recrutar', prov: id, n, tropa: tipo }); noticia(`📡 Pedido de recrutamento enviado (${n} ${TROPAS[tipo].nome.toLowerCase()}).`); som('recrutar'); return n; }
    return recrutarOriginal(id, n, tipo);
};
construir = function (provId, obra, dono = 'jogador') {
    if (G && G.cliente) { enviarAcao({ tipo: 'construir', prov: provId, obra }); noticia(`📡 Obra pedida: ${OBRAS[obra].nome}.`); return true; }
    return construirOriginal(provId, obra, dono);
};
pesquisar = function (id, dono = 'jogador') {
    if (G && G.cliente) { enviarAcao({ tipo: 'pesquisar', id }); noticia(`📡 Pesquisa pedida: ${PESQUISAS[id].nome}.`); return true; }
    return pesquisarOriginal(id, dono);
};
fortificar = function (id, dono = 'jogador') {
    if (G && G.cliente) { enviarAcao({ tipo: 'fortificar', prov: id }); return true; }
    return fortificarOriginal(id, dono);
};
espionar = function (id) {
    if (G && G.cliente) { enviarAcao({ tipo: 'espionar', prov: id }); noticia('📡 Espião a caminho.'); som('espiao'); return true; }
    return espionarOriginal(id);
};
cancelarMarcha = function (exId) {
    if (G && G.cliente) { enviarAcao({ tipo: 'parar', exId }); noticia('✋ Ordem de parar enviada.'); return; }
    return pararOriginal(exId);
};
const designarGeneralOriginal = designarGeneral, proporOriginal = propor, pausarOriginal = pausar, painelDiplomaciaOriginal = painelDiplomacia, painelGeneraisOriginal = painelGenerais, painelEscolherGeneralOriginal = painelEscolherGeneral;
designarGeneral = function (...a) { if (G && G.online) return noticia('🎖 No online não há generais.'); return designarGeneralOriginal(...a); };
propor = function (...a) { if (G && G.online) return false; return proporOriginal(...a); };
pausar = function (v) { if (G && G.online) return noticia('⏸ No online o tempo não para.'); return pausarOriginal(v); };
const avisoOnline = (titulo, txt) => `<div class="titulo"><span>${titulo}</span></div><div class="info">${txt}</div><div class="acoes">${botao('✖ Fechar', '', `G.sel={tipo:'prov',id:G.capitalJogador};renderPainel()`)}</div>`;
painelDiplomacia = function () { return G && G.online ? avisoOnline('🤝 Diplomacia', 'No online todos estão em guerra com todos.') : painelDiplomaciaOriginal(); };
painelGenerais = function () { return G && G.online ? avisoOnline('🎖 Generais', 'No online não há generais: só a sua estratégia.') : painelGeneraisOriginal(); };
painelEscolherGeneral = function (id) { return G && G.online ? avisoOnline('🎖 Generais', 'No online não há generais.') : painelEscolherGeneralOriginal(id); };

/* ---------- Anfitrião: espiões dos outros, notícias de todos e fim de jogo ---------- */
const passoMapaOriginal = passoMapa;
passoMapa = function (dt) {
    passoMapaOriginal(dt);
    if (!G || !G.online || ON.papel !== 'host' || G.fim) return;
    Object.entries(G.intel || {}).forEach(([dono, I]) => {
        I.espioes = I.espioes.filter(s => {
            const p = G.prov[s.para], dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), passo = C.ESPIAO_VEL * dt;
            if (d > passo) { s.x += dx / d * passo; s.y += dy / d * passo; return true; }
            const ate = G.t + C.ESPIAO_DURA; I.revelado[p.id] = ate; p.viz.forEach(v => { I.revelado[v] = Math.max(I.revelado[v] || 0, ate); });
            if (p.dono !== 'neutro') I.espiado[p.dono] = ate;
            return false;
        });
    });
};
const conquistarOriginal = conquistar;
conquistar = function (p, dono, e) { const antes = p.dono; const r = conquistarOriginal(p, dono, e); if (G && G.online) evento({ k: 'conquista', a: dono, b: antes, p: p.id }); return r; };
const concluirBatalhaOriginal = concluirBatalha;
concluirBatalha = function (b) { const r = concluirBatalhaOriginal(b); if (G && G.online && b.vencedor !== 'atq') evento({ k: 'segurou', a: b.atqDono, b: b.defDono, p: b.alvo.id }); return r; };
const saquearOriginal = saquear;
saquear = function (e, p) { const f = G.fac[p.dono], antes = f ? f.moedas : 0, dono = p.dono; const r = saquearOriginal(e, p); if (G && G.online) evento({ k: 'saque', a: e.dono, b: dono, p: p.id, v: Math.floor(antes - (f ? f.moedas : 0)) }); return r; };
const eliminarOriginal = eliminar;
eliminar = function (bot, por) {
    if (G && G.online) evento({ k: 'eliminado', a: bot, b: por, p: (Object.values(G.prov).find(q => q.capital && q.dono === por) || {}).id });
    const r = eliminarOriginal(bot, por);
    if (G && G.online && bot === 'jogador') noticia('☠ Sua capital caiu. Você continua assistindo (o jogo segue no seu celular para os outros: não feche a página).', true);
    return r;
};
function faccoesNoJogo() { return ['jogador', ...G.fase.bots].filter(d => !G.eliminados[d]); }
function verificarFimOnline() {
    const vivas = faccoesNoJogo();
    if (vivas.length <= 1) { G.fim = 'online'; G.vencedor = vivas[0] || null; G.motivoFim = 'Todas as outras capitais caíram.'; transmitirEstado(); mostrarFimOnline(); }
}
function fimPorTempoOnline() {
    const pl = placar(), vivas = faccoesNoJogo();
    G.fim = 'online'; G.vencedor = vivas.sort((a, b) => (pl[b] || 0) - (pl[a] || 0))[0] || null; G.motivoFim = 'O tempo acabou: vence quem tem mais províncias.';
    transmitirEstado(); mostrarFimOnline();
}
const mostrarFimOriginal = mostrarFim;
mostrarFim = function () { if (G && G.online) return mostrarFimOnline(); return mostrarFimOriginal(); };
function mostrarFimOnline() {
    const venci = G.vencedor === 'jogador', pl = placar();
    const nomeV = G.vencedor ? (G.vencedor === 'jogador' ? 'Você' : FACCOES[G.vencedor].nome) : '';
    som(venci ? 'vitoria' : 'derrota');
    if (ON.papel === 'host') setTimeout(() => { clearInterval(ON.timer); ON.timer = null; }, 3000); // ainda manda o estado final
    const ranking = ['jogador', ...G.fase.bots].map(d => ({ d, n: pl[d] || 0 })).sort((a, b) => b.n - a.n)
        .map((x, i) => `<div class="linha-tropa"><div class="txt"><b style="color:${FACCOES[x.d].cor}">${i + 1}º ${escO(x.d === 'jogador' ? 'Você' : FACCOES[x.d].nome)}</b><small>${G.eliminados[x.d] ? '☠ capital tomada' : x.n + ' províncias'}</small></div></div>`).join('');
    mostrarTela(`<h2>${venci ? '🏆 VOCÊ VENCEU!' : G.vencedor ? '🎖 ' + escO(nomeV).toUpperCase() + ' VENCEU' : '🌐 FIM DE JOGO'}</h2>
        <div class="sub">${escO(G.motivoFim || '')}</div><div class="lista-tropas">${ranking}</div>
        <button class="grande" onclick="sairDaSala()">VOLTAR AO INÍCIO</button>`);
}

/* ---------- Botão na tela de início e link de convite ---------- */
const mostrarInicioOriginal = mostrarInicio;
mostrarInicio = function () {
    mostrarInicioOriginal();
    const caixa = document.getElementById('telaCaixa');
    if (caixa && !document.getElementById('bOnline')) {
        const b = document.createElement('button'); b.id = 'bOnline'; b.className = 'grande'; b.innerHTML = '🌐 CONQUISTA ONLINE <small style="display:block;font-size:11px;font-weight:400">até 4 comandantes no mesmo mapa</small>';
        b.onclick = () => telaOnline();
        const h2 = caixa.querySelector('h2'); h2.parentElement.insertBefore(b, h2.nextSibling);
    }
};
if (new URLSearchParams(location.search).get('sala')) telaOnline(); else if (document.getElementById('tela').style.display === 'flex' && !document.getElementById('bOnline')) mostrarInicio();
window.__online = { ON, estado: () => ({ papel: ON.papel, minha: ON.minha, online: !!(G && G.online), cliente: !!(G && G.cliente), fim: G && G.fim, vencedor: G && G.vencedor }) };
