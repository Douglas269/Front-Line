// FrontLine · Conquista: Configurações (⚙️ no topo), as mesmas preferências do modo Trincheiras
// Som (ligado, música, efeitos, vibração), Jogo (dificuldade dos bots, texto maior), Conta (apelido e progresso) e Dados.
// Tudo fica em 'frontline-config', o mesmo lugar do Trincheiras: mudar aqui muda lá também.

let configConqAberta = false, configConqAba = 'som', pausaAntesConfig = false;
function lerConfigConq() { try { return Object.assign({ volMusica: 45, volEfeitos: 80, vibracao: true, textoGrande: false, apelido: '', dificuldade: 'soldado' }, JSON.parse(localStorage.getItem('frontline-config')) || {}); } catch (e) { return { volMusica: 45, volEfeitos: 80, vibracao: true, textoGrande: false, apelido: '', dificuldade: 'soldado' }; } }
function gravarConfigConq(mudancas) {
    const c = Object.assign(lerConfigConq(), mudancas);
    try { localStorage.setItem('frontline-config', JSON.stringify(c)); } catch (e) {}
    CONFIG_CONQ = c; aplicarConfigConq();
}
let CONFIG_CONQ = lerConfigConq();
function aplicarConfigConq() {
    const c = CONFIG_CONQ;
    if (SOM.ctx && SOM.musica) SOM.musica.gain.value = 0.35 * Math.max(0, c.volMusica) / 45;
    if (SOM.ctx && SOM.efeitos) SOM.efeitos.gain.value = 0.55 * Math.max(0, c.volEfeitos) / 80;
    if (!SOM.ctx) { SOM.mapa.volume = SOM.batalha.volume = Math.min(1, 0.35 * c.volMusica / 45); }
    document.body.classList.toggle('textoGrande', !!c.textoGrande);
}
// o som só nasce no primeiro toque: aplica o volume escolhido assim que nascer
const iniciarSomOriginal = iniciarSom;
iniciarSom = function () { iniciarSomOriginal(); aplicarConfigConq(); };
// vibração nos alertas (se o aparelho deixar)
const noticiaOriginal = noticia;
noticia = function (txt, alerta) { noticiaOriginal(txt, alerta); if (alerta && CONFIG_CONQ.vibracao && navigator.vibrate) { try { navigator.vibrate(120); } catch (e) {} } };

const DIF_TXT = {
    recruta:  { nome: 'Recruta', desc: 'bots atacam menos, pedem mais vantagem e produzem 10% menos' },
    soldado:  { nome: 'Soldado', desc: 'o equilíbrio padrão' },
    veterano: { nome: 'Veterano', desc: 'bots atacam mais, arriscam mais e produzem 10% mais' }
};
function emailDaConta() {
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sb-.*-auth-token$/.test(k)) { const d = JSON.parse(localStorage.getItem(k)); const u = d && (d.user || (d.currentSession && d.currentSession.user)); if (u && u.email) return u.email; } } } catch (e) {}
    return null;
}
function abrirConfigConq(aba) {
    configConqAberta = true; configConqAba = aba || configConqAba;
    if (G && !G.online && !G.fim) { pausaAntesConfig = !!G.pausado; G.pausado = true; }
    let m = document.getElementById('configConq');
    if (!m) { m = document.createElement('div'); m.id = 'configConq'; document.body.appendChild(m); }
    m.style.display = 'flex';
    renderConfigConq();
}
function fecharConfigConq() {
    configConqAberta = false;
    const m = document.getElementById('configConq'); if (m) m.style.display = 'none';
    if (G && !G.online && !G.fim) G.pausado = pausaAntesConfig;
}
function renderConfigConq() {
    const m = document.getElementById('configConq'); if (!m) return;
    const c = CONFIG_CONQ, a = configConqAba, meta = lerMeta();
    const linhaTog = (rot, sub, on, acao) => `<div class="cfgLinha"><div><b>${rot}</b><small>${sub}</small></div><button class="mini" onclick="${acao}">${on ? 'Ligado' : 'Desligado'}</button></div>`;
    const barra = (rot, chave, v) => `<div class="cfgLinha col"><div class="cfgTopo"><b>${rot}</b><span>${v}%</span></div><input type="range" min="0" max="100" step="5" value="${v}" oninput="gravarConfigConq({ ${chave}: +this.value }); this.previousElementSibling.lastChild.textContent = this.value + '%'"></div>`;
    let corpo = '';
    if (a === 'som') {
        corpo = linhaTog('Som', 'música e efeitos', SOM.ligado, 'alternarSom();renderConfigConq()') + barra('Música', 'volMusica', c.volMusica) + barra('Efeitos', 'volEfeitos', c.volEfeitos)
            + linhaTog('Vibração', 'o celular vibra nos alertas de ataque', c.vibracao, `gravarConfigConq({ vibracao: ${!c.vibracao} });renderConfigConq()`)
            + '<div class="sub">Os volumes valem também no modo Trincheiras.</div>';
    } else if (a === 'jogo') {
        corpo = `<div class="sub" style="margin-bottom:6px">Dificuldade dos bots (vale na campanha; no online, a do anfitrião):</div>` +
            Object.entries(DIF_TXT).map(([id, d]) => `<button class="cfgOpcao${c.dificuldade === id ? ' on' : ''}" onclick="gravarConfigConq({ dificuldade: '${id}' });renderConfigConq()"><b>${d.nome}</b><small>${d.desc}</small></button>`).join('')
            + linhaTog('Texto maior', 'letras maiores no painel e nas telas', c.textoGrande, `gravarConfigConq({ textoGrande: ${!c.textoGrande} });renderConfigConq()`);
    } else if (a === 'conta') {
        const email = emailDaConta(), vencidas = Object.values(meta.estrelas).filter(v => v > 0).length;
        corpo = `<div class="cfgLinha col"><b>Apelido</b><small>aparece para os outros no online e no ranking</small>
                <input class="campoOn" maxlength="18" value="${(c.apelido || '').replace(/"/g, '&quot;')}" onchange="gravarConfigConq({ apelido: this.value.trim() })" placeholder="Seu apelido"></div>
            <div class="cfgLinha"><div><b>${email ? 'Conta FrontLine' : 'Sem conta'}</b><small>${email ? email : 'progresso salvo só neste aparelho'}</small></div><a class="mini" style="text-decoration:none;text-align:center;padding:8px" href="${linkMenu()}">${email ? 'Conta' : 'Entrar'}</a></div>
            <div class="cfgGrade"><div><small>Estrelas</small><b>${totalEstrelas(meta)}</b></div><div><small>Fases vencidas</small><b>${vencidas}/${FASES.length}</b></div><div><small>Generais</small><b>${generaisLiberados().length}/${GENERAIS.length}</b></div></div>
            <div class="sub">Para entrar ou criar conta, use o botão acima (abre o menu do jogo, entre pelo modo Trincheiras).</div>`;
    } else if (a === 'dados') {
        corpo = `<div class="cfgLinha"><div><b>Apagar a partida salva</b><small>a fase em andamento some; o progresso da campanha fica</small></div><button class="mini" onclick="if(confirm('Apagar a partida salva da Conquista?')){apagarSalvamento();renderConfigConq();}">Apagar</button></div>
            <div class="cfgLinha"><div><b>Recomeçar a campanha</b><small>apaga estrelas, fases liberadas e a experiência dos generais</small></div><button class="mini perigo" onclick="if(confirm('Apagar TODO o progresso da campanha da Conquista? Não tem volta.')){try{localStorage.removeItem('frontline-conquista-meta');localStorage.removeItem('frontline-conquista-fase');}catch(e){} apagarSalvamento(); renderConfigConq();}">Apagar</button></div>`;
    }
    const abas = [['som', '🔊 Som'], ['jogo', '🎮 Jogo'], ['conta', '👤 Conta'], ['dados', '🗂 Dados']];
    m.innerHTML = `<div class="cfgCaixa"><div class="cfgTitulo"><b>⚙️ CONFIGURAÇÕES</b><button class="mini" onclick="fecharConfigConq()">✖</button></div>
        <div class="cfgAbas">${abas.map(([id, t]) => `<button class="${a === id ? 'on' : ''}" onclick="configConqAba='${id}';renderConfigConq()">${t}</button>`).join('')}</div>
        <div class="cfgCorpo">${corpo}</div>
        <a class="voltarMenu" href="${linkMenu()}" onclick="salvarPartida()">🏠 Menu principal</a></div>`;
}
// dificuldade dos bots: a campanha e o anfitrião leem daqui
function DIFC() { return ({ recruta: { vontade: 0.75, margem: 1.15, prod: 0.9 }, veterano: { vontade: 1.2, margem: 0.9, prod: 1.1 } })[CONFIG_CONQ.dificuldade] || { vontade: 1, margem: 1, prod: 1 }; }
aplicarConfigConq();
