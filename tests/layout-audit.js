// Auditoria de layout para celular: roda dentro da página e devolve problemas.
// Procura (1) controle coberto por outro controle (ex.: botão flutuante sobre a barra de menu), (2) controle que estoura a largura da tela,
// (3) alvo de toque minúsculo (< 28 px nos dois lados), (4) texto com menos de 10 px de tela dentro de controles.
module.exports = function auditoria() {
    const problemas = [], W = document.documentElement.clientWidth;
    const desc = (e) => { const t = (e.textContent || e.placeholder || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 28); return `<${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''}> "${t}"`; };
    const visivel = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    const todos = [...document.querySelectorAll('button, a[href], input, select, textarea, [onclick]')].filter(visivel);
    const interativo = (e) => e && e.closest && e.closest('button, a[href], input, select, textarea, [onclick]');
    todos.forEach(e => {
        const r = e.getBoundingClientRect();
        if (r.right > W + 1 || r.left < -1) problemas.push(['estoura a largura', desc(e), Math.round(r.left) + '..' + Math.round(r.right)]);
        if (r.width < 28 && r.height < 28 && !/^(input)$/i.test(e.tagName)) problemas.push(['alvo de toque pequeno', desc(e), Math.round(r.width) + '×' + Math.round(r.height)]);
        const fs = parseFloat(getComputedStyle(e).fontSize);
        if (fs && fs < 10 && (e.textContent || '').trim().length > 1) problemas.push(['texto menor que 10 px', desc(e), fs + 'px']);
    });
    // dois controles que se sobrepõem de verdade: a área comum tem de estar, no topo, num dos dois (se um painel por cima cobre os dois, não é erro)
    const visiveisNaTela = todos.filter(e => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    for (let i = 0; i < visiveisNaTela.length; i++) for (let k = i + 1; k < visiveisNaTela.length; k++) {
        const a = visiveisNaTela[i], b = visiveisNaTela[k]; if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const l = Math.max(ra.left, rb.left), r = Math.min(ra.right, rb.right), tp = Math.max(ra.top, rb.top), bt = Math.min(ra.bottom, rb.bottom);
        if (r - l < 4 || bt - tp < 4) continue;
        const inter = (r - l) * (bt - tp), menor = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (inter < 0.1 * menor) continue;
        const centro = (e) => { const q = e.getBoundingClientRect(); const x = interativo(document.elementFromPoint(Math.min(W - 1, Math.max(0, q.left + q.width / 2)), Math.min(innerHeight - 1, Math.max(0, q.top + q.height / 2)))); return x === e; };
        if (!centro(a) || !centro(b)) continue; // um deles está por baixo de outro painel (ou rolando por baixo de uma barra fixa): não é erro de layout
        const fixo = (e) => { for (let n = e; n && n !== document.body; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
        if (fixo(a) !== fixo(b) && !(fixo(a) ? a : b).parentElement.matches('body')) continue; // barra fixa do app com conteúdo que passa por baixo ao rolar: normal
        const topo = document.elementFromPoint((l + r) / 2, (tp + bt) / 2), t2 = interativo(topo);
        if (t2 === a || t2 === b) problemas.push(['controles sobrepostos', desc(a), 'e ' + desc(b) + ' (' + Math.round(100 * inter / menor) + '% do menor)']);
    }
    // visível, mas fora da largura: scroll horizontal da página
    if (document.documentElement.scrollWidth > W + 2) problemas.push(['a página rola na horizontal', 'documento', document.documentElement.scrollWidth + ' > ' + W]);
    return problemas;
};
