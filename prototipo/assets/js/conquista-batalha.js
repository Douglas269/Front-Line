// FrontLine · Conquista: a batalha como duelo (carregado depois de conquista.js e antes de conquista-online.js)
// Artilharia com aviso (dá para se abrigar), cada postura com a sua hora e bots que reagem como um jogador.
/* Quem vence quem:
   abrigar / cobertura  segura a artilharia;
   avançar              pega o defensor que está abrigado;
   atacar (fogo)        pune quem avança em campo aberto;
   cobertura            protege de quem está atirando forte. */
const BAT_ART = {
    AVISO: 5,        // segundos de batalha entre o disparo e a queda (2 s na tela com a batalha a 2,5×)
    DANO: 28,        // dano em cada soldado do outro lado, a céu aberto
    ABRIGADO: 0.3,   // parte do dano que passa em quem está abrigado (defesa) ou em cobertura (ataque)
    TRINCH: 0.25     // a trincheira cheia tira esta parte do dano em quem defende
};
const ASSALTO_NO_ABRIGO = 1.35; // quem avança sobre um defensor abrigado causa mais dano

const donoDoLado = (b, lado) => (lado === 'atq' ? b.atqDono : b.defDono);
const outroLado = (lado) => (lado === 'atq' ? 'def' : 'atq');
const estaAbrigado = (b, lado) => (lado === 'atq' ? b.postAtq === 'cobertura' : b.postDef === 'abrigar');
const artDe = (b, lado) => { b.art = b.art || {}; return (b.art[lado] = b.art[lado] || { usada: false, cai: null }); };
const artACaminho = (b, contra) => { const a = b.art && b.art[outroLado(contra)]; return !!a && a.cai !== null; };
const custoArtilharia = (dono) => C.ARTILHARIA_MUN - (typeof bonusReforco === 'function' ? bonusReforco(dono, 'artBarata') : 0);

// Dispara: gasta a munição agora e o projétil cai depois do aviso.
function artilhariaNaBatalha(b, lado) {
    const dono = donoDoLado(b, lado), f = G.fac[dono], a = artDe(b, lado), custo = custoArtilharia(dono);
    if (!f || b.terminou || a.usada || f.mun < custo) return false;
    f.mun -= custo; a.usada = true; a.cai = b.t + BAT_ART.AVISO;
    if (dono === 'jogador') { b.usouArt = true; som('ordem'); }
    else if (donoDoLado(b, outroLado(lado)) === 'jogador') {
        noticia(`💥 Artilharia de ${FACCOES[dono].nome} a caminho em ${b.alvo.nome}! ${lado === 'atq' ? 'Toque em 🛡 Abrigar.' : 'Toque em 🛡 Cobertura.'}`, true);
    }
    return true;
}
// o que o online precisa saber da artilharia de cada lado: já usada e a caminho
function estadoArtilharia(b) { const a = (b.art && b.art.atq) || {}, d = (b.art && b.art.def) || {}; return { ua: a.usada ? 1 : 0, ud: d.usada ? 1 : 0, ca: a.cai !== null && a.cai !== undefined ? 1 : 0, cd: d.cai !== null && d.cai !== undefined ? 1 : 0 }; }
function quedaDaArtilharia(b) {
    ['atq', 'def'].forEach(lado => {
        const a = b.art && b.art[lado]; if (!a || a.cai === null || b.t < a.cai) return;
        a.cai = null;
        const alvoLado = outroLado(lado), alvos = (alvoLado === 'atq' ? b.atq : b.def).filter(x => x.s.vida > 0);
        const abrigo = estaAbrigado(b, alvoLado) ? BAT_ART.ABRIGADO : 1;
        const trinch = alvoLado === 'def' ? 1 - BAT_ART.TRINCH * (b.alvo.trinch || 0) / 100 : 1;
        if (b.audivel) som('explosao');
        alvos.forEach(x => { x.s.vida -= BAT_ART.DANO * abrigo * trinch; b.efeitos.push({ x: x.x, y: alvoLado === 'def' ? -1 : x.dist, vida: 0.8, tipo: 'explosao' }); });
        if (abrigo < 1 && donoDoLado(b, alvoLado) === 'jogador') noticia(`🛡 Abrigo a tempo em ${b.alvo.nome}: a artilharia fez pouco estrago.`);
    });
}

/* ---------- Tática dos bots dentro da batalha (os mesmos botões do jogador) ---------- */
const ehBot = (dono) => !!G && !G.cliente && G.pensar[dono] !== undefined;
const espertezaBot = () => ({ recruta: 0.3, veterano: 0.85 })[typeof CONFIG_CONQ !== 'undefined' ? CONFIG_CONQ.dificuldade : ''] || 0.6;
function taticaDosBots(b) {
    ['atq', 'def'].forEach(lado => {
        const dono = donoDoLado(b, lado); if (!ehBot(dono)) return;
        b.ia = b.ia || {};
        const m = (b.ia[lado] = b.ia[lado] || { prox: 2 + Math.random() * 2, avisado: false, abrigou: false });
        // reação à artilharia: decide uma vez por disparo, um pouco depois do aviso
        const vem = artACaminho(b, lado);
        if (vem && !m.avisado) { const a = b.art[outroLado(lado)]; if (b.t >= a.cai - BAT_ART.AVISO * 0.5) { m.avisado = true; if (Math.random() < espertezaBot()) { m.abrigou = true; if (lado === 'atq') b.postAtq = 'cobertura'; else b.postDef = 'abrigar'; } } return; }
        if (vem) return;
        if (m.abrigou) { m.abrigou = false; m.prox = b.t; }
        if (b.t < m.prox) return;
        m.prox = b.t + 3 + Math.random() * 2;
        const meus = (lado === 'atq' ? b.atq : b.def).filter(x => x.s.vida > 0).length, deles = (lado === 'atq' ? b.def : b.atq).filter(x => x.s.vida > 0).length;
        if (!artDe(b, lado).usada && deles >= 4 && b.t >= 4 && Math.random() < 0.25 * espertezaBot()) artilhariaNaBatalha(b, lado);
        if (Math.random() > 0.4 + espertezaBot() * 0.6) return; // às vezes o bot demora a perceber
        if (lado === 'atq') {
            const inicio = b.atq.length;
            if (meus < inicio * 0.35 && deles > meus * 1.5 && Math.random() < 0.5) b.postAtq = 'recuar';
            else if (b.postAtq !== 'recuar') b.postAtq = b.postDef === 'atacar' ? 'cobertura' : 'avancar';
        } else {
            b.postDef = b.atq.some(a => a.s.vida > 0 && a.dist <= 40) || b.postAtq === 'avancar' ? 'atacar' : 'equilibrio';
        }
    });
}

/* ---------- Emoção no resultado: barra da luta, conquista animada, resumo da batalha e veteranos ---------- */
// quem está ganhando: poder que sobrou de cada lado (vida e tipo), do ponto de vista do jogador
function barraDaBatalha(b, souAtq) {
    const poder = (l) => l.reduce((t, x) => t + (x.s.vida > 0 ? (x.s.vida / (x.s.nome === undefined || !TROPAS[x.s.tipo || 'inf'] ? 100 : vidaMax(x.s))) : 0), 0);
    const a = poder(b.atq), d = poder(b.def) * (1 + (b.alvo.trinch || 0) / 250), meu = souAtq ? a : d, dele = souAtq ? d : a;
    const parte = Math.round(100 * meu / Math.max(0.01, meu + dele));
    const [txt, cor] = parte >= 60 ? ['▲ você está ganhando', '#7bc96f'] : parte <= 40 ? ['▼ você está perdendo', '#e0705f'] : ['■ luta parelha', '#e3b04b'];
    return `<div class="luta" role="img" aria-label="${txt}"><div class="luta-b"><i style="width:${parte}%;background:${cor}"></i></div><span style="color:${cor}">${txt}</span></div>`;
}

/* Veteranos: quem sobrevive a batalhas fica melhor. Os nomes passam a importar. */
const PATENTES = [{ min: 5, nome: 'Elite', marca: '★★', bonus: 0.2 }, { min: 2, nome: 'Veterano', marca: '★', bonus: 0.1 }];
const patenteDe = (s) => PATENTES.find(p => (s.lutas || 0) >= p.min) || null;
const APELIDOS_RECRUTA = ['Almeida', 'Barbosa', 'Cardoso', 'Dantas', 'Esteves', 'Farias', 'Gomes', 'Leal', 'Moura', 'Pacheco', 'Queiroz', 'Ramos', 'Sales', 'Teles', 'Vieira'];
function textoVeteranos(lista) {
    const v = lista.filter(patenteDe).sort((a, b) => (b.lutas || 0) - (a.lutas || 0) || (b.abates || 0) - (a.abates || 0));
    if (!v.length) return '<div class="info">★ Nenhum veterano ainda: quem sobrevive a 2 batalhas vira veterano (+10%), e a 5 vira elite (+20%).</div>';
    return `<div class="info"><b>★ Veteranos</b><br>${v.slice(0, 8).map(s => `${patenteDe(s).marca} ${s.nome} (${TROPAS[s.tipo || 'inf'].nome.toLowerCase()}) · ${s.lutas} batalhas · ${s.abates || 0} abates`).join('<br>')}${v.length > 8 ? `<br>e mais ${v.length - 8}` : ''}</div>`;
}
// no fim de cada luta: sobreviventes ganham experiência; promoções e perdas de veteranos viram notícia
function experienciaDaBatalha(b) {
    const r = { meu: null, promovidos: [], perdidos: [] };
    ['atq', 'def'].forEach(lado => {
        const dono = donoDoLado(b, lado);
        (lado === 'atq' ? b.atq : b.def).forEach(x => {
            const s = x.s;
            if (s.vida <= 0) { if (dono === 'jogador' && patenteDe(s)) r.perdidos.push(s); return; }
            const antes = patenteDe(s); s.lutas = (s.lutas || 0) + 1;
            if (dono === 'jogador') {
                if (patenteDe(s) !== antes) { if (s.nome === 'Recruta') s.nome = APELIDOS_RECRUTA[Math.floor(Math.random() * APELIDOS_RECRUTA.length)]; r.promovidos.push(s); }
                if ((x.abatesLuta || 0) > 0 && (!r.meu || x.abatesLuta > r.meu.n)) r.meu = { s, n: x.abatesLuta };
            }
        });
    });
    return r;
}

// Cartão de resultado: aparece sobre o mapa, não trava o jogo e some sozinho
function mostrarResumoDaBatalha(b, exp, premio) {
    const souAtq = b.atqDono === 'jogador', venci = souAtq ? b.vencedor === 'atq' : b.vencedor === 'def';
    const perdas = (l) => l.filter(x => x.s.vida <= 0).length;
    const dados = { venci, titulo: venci ? (souAtq ? `🏴 ${b.alvo.nome} é sua!` : `🛡 ${b.alvo.nome} resistiu!`) : (souAtq ? `✖ Ataque a ${b.alvo.nome} falhou` : `✖ ${b.alvo.nome} caiu`),
        meus: perdas(souAtq ? b.atq : b.def), deles: perdas(souAtq ? b.def : b.atq), destaque: exp.meu ? `${exp.meu.s.nome}: ${exp.meu.n} abate${exp.meu.n > 1 ? 's' : ''}` : '', promovidos: exp.promovidos.map(s => `${patenteDe(s).marca} ${s.nome}`), perdidos: exp.perdidos.map(s => s.nome), premio: premio || '' };
    G.ultimoResumo = dados;
    const caixa = document.getElementById('mapaBox'); if (!caixa) return;
    let el = document.getElementById('resumoBatalha');
    if (!el) { el = document.createElement('div'); el.id = 'resumoBatalha'; el.setAttribute('role', 'status'); caixa.appendChild(el); }
    el.className = venci ? 'bom' : 'ruim';
    el.innerHTML = `<button class="fechar" aria-label="Fechar">✖</button><b>${dados.titulo}</b>
        <div>Perdas: você <b>${dados.meus}</b> · inimigo <b>${dados.deles}</b></div>
        ${dados.premio ? `<div>🎁 ${dados.premio}</div>` : ''}${dados.destaque ? `<div>🏅 Destaque: ${dados.destaque}</div>` : ''}
        ${dados.promovidos.length ? `<div>⬆ Promovido${dados.promovidos.length > 1 ? 's' : ''}: ${dados.promovidos.slice(0, 4).join(', ')}</div>` : ''}
        ${dados.perdidos.length ? `<div>🕯 Veterano${dados.perdidos.length > 1 ? 's perdidos' : ' perdido'}: ${dados.perdidos.slice(0, 4).join(', ')}</div>` : ''}`;
    el.style.display = 'block'; el.querySelector('.fechar').onclick = () => { el.style.display = 'none'; };
    clearTimeout(el._some); el._some = setTimeout(() => { el.style.display = 'none'; }, 7000);
}
const esconderResumo = () => { const el = document.getElementById('resumoBatalha'); if (el) el.style.display = 'none'; };

const _bat_concluir = concluirBatalha;
concluirBatalha = function (b) {
    const minha = b.atqDono === 'jogador' || b.defDono === 'jogador';
    const exp = experienciaDaBatalha(b);
    const antes = minha ? Object.assign({}, G.fac.jogador) : null;
    const r = _bat_concluir(b);
    if (minha && !G.fim) {
        const f = G.fac.jogador, ganho = [['🪙', 'moedas'], ['🍞', 'comida'], ['⚙', 'aco']].map(([i, k]) => { const d = Math.floor((f[k] || 0) - (antes[k] || 0)); return d > 0 ? `+${d}${i}` : ''; }).filter(Boolean).join(' ');
        if (exp.perdidos.length) noticia(`🕯 ${exp.perdidos.map(s => s.nome).slice(0, 3).join(', ')} ${exp.perdidos.length > 1 ? 'caíram: eram veteranos' : 'caiu: era veterano'}.`);
        mostrarResumoDaBatalha(b, exp, ganho);
    }
    return r;
};

// Conquista animada no mapa: a província pisca na cor de quem tomou e a bandeira sobe
const FESTA_MS = 2200;
const _bat_conquistar = conquistar;
conquistar = function (p, dono, e) {
    const antigo = p.dono, r = _bat_conquistar(p, dono, e);
    if (G && p.dono === dono && antigo !== dono && (dono === 'jogador' || antigo === 'jogador' || provVisivel(p.id))) (G.festas = G.festas || []).push({ prov: p.id, cor: FACCOES[dono].cor, ini: performance.now(), minha: dono === 'jogador' });
    return r;
};
const _bat_desenhar = desenharMapa;
desenharMapa = function () {
    _bat_desenhar();
    if (!G || !G.festas || !G.festas.length) return;
    const agora = performance.now(), d = DPR();
    G.festas = G.festas.filter(f => agora - f.ini < FESTA_MS);
    G.festas.forEach(f => {
        const p = G.prov[f.prov]; if (!p) return;
        const k = (agora - f.ini) / FESTA_MS, s = paraTela(p.x, p.y), r = cvM.getBoundingClientRect();
        cxM.save();
        cxM.setTransform(cam.z * d, 0, 0, cam.z * d, (r.width / 2 - cam.x * cam.z) * d, (r.height / 2 - cam.y * cam.z) * d);
        cxM.globalAlpha = 0.55 * (1 - k) * (0.6 + 0.4 * Math.abs(Math.sin(k * 14))); cxM.fillStyle = f.cor; cxM.fill(p.path);
        cxM.setTransform(d, 0, 0, d, 0, 0); cxM.globalAlpha = 1;
        const sobe = Math.min(1, k * 2.2), y = s.y + 8 - 46 * sobe;
        cxM.fillStyle = '#e8e4d0'; cxM.fillRect(Math.round(s.x - 1), Math.round(y), 2, Math.round(s.y + 8 - y));
        cxM.fillStyle = f.cor; cxM.fillRect(Math.round(s.x + 1), Math.round(y), 18, 11); cxM.strokeStyle = 'rgba(0,0,0,.7)'; cxM.strokeRect(Math.round(s.x + 1), Math.round(y), 18, 11);
        cxM.strokeStyle = f.cor; cxM.lineWidth = 3; cxM.globalAlpha = 1 - k; cxM.beginPath(); cxM.arc(s.x, s.y, 14 + 46 * k, 0, Math.PI * 2); cxM.stroke();
        cxM.restore();
    });
};
