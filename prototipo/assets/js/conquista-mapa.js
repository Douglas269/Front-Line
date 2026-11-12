// FrontLine · Conquista: gerador de mapas
// Cada fase tem uma semente fixa: o mesmo mapa sempre. As províncias são células irregulares
// (diagrama de Voronoi com bordas serrilhadas), com mar em volta, e o terreno é pintado uma vez
// numa imagem fora da tela (relevo, florestas, morros, plantações e cidades).

function rngSemente(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const NOMES_PROV = ['Vila Nova', 'Serra Alta', 'Rio Claro', 'Pedra Branca', 'Campo Belo', 'Monte Verde', 'Porto Velho', 'Santa Luzia', 'Boa Vista',
    'Três Rios', 'Lagoa Seca', 'Vale Escuro', 'Ponte Alta', 'Bom Retiro', 'Pinhal', 'Cerro Azul', 'Barreiro', 'Areal', 'Mirante', 'Capão',
    'Ribeira', 'Salto', 'Tapera', 'Estrela', 'Coxilha', 'Queimada', 'Taquara', 'Vau', 'Juncal', 'Arraial', 'Penedo', 'Aldeia', 'Cascalho',
    'Palmeiras', 'Rocha Negra', 'Varginha', 'Olaria', 'Porteira', 'Sapé', 'Guará', 'Itaúna', 'Jatobá', 'Ipê', 'Cambará',
    'Ouro Fino', 'Bela Cruz', 'Pirapora', 'Lajeado', 'Formosa', 'Canudos', 'Taboca', 'Buriti', 'Garça', 'Sobrado', 'Remanso', 'Pau Brasil',
    'Cachoeira', 'Paraíso', 'Seringal', 'Carvalhal', 'Rio Fundo', 'Campina', 'Gameleira', 'Baixio', 'Cumbuco', 'Mangue Seco', 'Serrinha', 'Angico'];

// Corta um polígono pelo semiplano n·p <= c. Cada vértice guarda o rótulo da aresta que sai dele
// (o vizinho que a criou, ou -1 para a borda do mundo).
function cortarPoligono(v, L, nx, ny, c, j) {
    const out = [], outL = [], n = v.length;
    const dentro = (P) => nx * P.x + ny * P.y <= c + 1e-9;
    const inter = (P, Q) => { const dp = nx * P.x + ny * P.y - c, dq = nx * Q.x + ny * Q.y - c, t = dp / (dp - dq); return { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t }; };
    for (let k = 0; k < n; k++) {
        const P = v[k], Q = v[(k + 1) % n], a = dentro(P), b = dentro(Q);
        if (a && b) { out.push(P); outL.push(L[k]); }
        else if (a && !b) { out.push(P); outL.push(L[k]); out.push(inter(P, Q)); outL.push(j); }
        else if (!a && b) { out.push(inter(P, Q)); outL.push(L[k]); }
    }
    // tira vértices repetidos
    const v2 = [], L2 = [];
    for (let k = 0; k < out.length; k++) {
        const P = out[k], Q = out[(k + 1) % out.length];
        if (Math.hypot(P.x - Q.x, P.y - Q.y) > 1e-6) { v2.push(P); L2.push(outL[k]); }
    }
    return { v: v2, L: L2 };
}
function celulaVoronoi(pts, i, W, H) {
    let v = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }], L = [-1, -1, -1, -1];
    const p = pts[i];
    for (let j = 0; j < pts.length && v.length; j++) {
        if (j === i) continue;
        const q = pts[j], nx = q.x - p.x, ny = q.y - p.y;
        const r = cortarPoligono(v, L, nx, ny, nx * (p.x + q.x) / 2 + ny * (p.y + q.y) / 2, j);
        v = r.v; L = r.L;
    }
    return { v, L };
}
function centroide(v) {
    let a = 0, cx = 0, cy = 0;
    for (let k = 0; k < v.length; k++) { const P = v[k], Q = v[(k + 1) % v.length], f = P.x * Q.y - Q.x * P.y; a += f; cx += (P.x + Q.x) * f; cy += (P.y + Q.y) * f; }
    a /= 2; return Math.abs(a) < 1e-9 ? { x: v[0].x, y: v[0].y } : { x: cx / (6 * a), y: cy / (6 * a) };
}
// Linha serrilhada de A até B, sempre igual para a mesma aresta (as duas províncias desenham a mesma fronteira)
function serrilhar(A, B, amp) {
    const r2 = (n) => Math.round(n * 10);
    const frente = r2(A.x) < r2(B.x) || (r2(A.x) === r2(B.x) && r2(A.y) <= r2(B.y));
    const P0 = frente ? A : B, P1 = frente ? B : A;
    const r = rngSemente((r2(P0.x) * 73856093) ^ (r2(P0.y) * 19349663) ^ (r2(P1.x) * 83492791) ^ (r2(P1.y) * 2654435761));
    let linha = [P0, P1];
    for (let nivel = 0; nivel < 3; nivel++) {
        const nova = [linha[0]];
        for (let k = 0; k < linha.length - 1; k++) {
            const P = linha[k], Q = linha[k + 1], dx = Q.x - P.x, dy = Q.y - P.y, len = Math.hypot(dx, dy) || 1;
            const d = (r() - 0.5) * amp * len;
            nova.push({ x: (P.x + Q.x) / 2 - dy / len * d, y: (P.y + Q.y) / 2 + dx / len * d }, Q);
        }
        linha = nova;
    }
    return frente ? linha : linha.reverse();
}

// Gera o mapa de uma fase: { W, H, prov: [{ id, nome, x, y, viz, poli, path, area }], mar: [...] }
function gerarMapa(cfg) {
    const r = rngSemente(cfg.semente), W = cfg.W, H = cfg.H, M = 20;
    const pts = [];
    for (let i = 0; i < cfg.celulas; i++) { // pontos bem espalhados: o melhor de vários candidatos
        let melhor = null, md = -1;
        for (let k = 0; k < 30; k++) {
            const p = { x: M + r() * (W - 2 * M), y: M + r() * (H - 2 * M) };
            let d = Infinity; pts.forEach(q => { d = Math.min(d, (q.x - p.x) ** 2 + (q.y - p.y) ** 2); });
            if (d > md) { md = d; melhor = p; }
        }
        pts.push(melhor);
    }
    let cel;
    for (let it = 0; it < 3; it++) { // relaxa duas vezes (células de tamanho parecido)
        cel = pts.map((p, i) => celulaVoronoi(pts, i, W, H));
        if (it < 2) cel.forEach((c, i) => { pts[i] = centroide(c.v); });
    }
    // vizinhança
    const n = pts.length, viz = Array.from({ length: n }, () => new Set());
    cel.forEach((c, i) => c.L.forEach((j, k) => { if (j >= 0) { const P = c.v[k], Q = c.v[(k + 1) % c.v.length]; if (Math.hypot(P.x - Q.x, P.y - Q.y) > 6) { viz[i].add(j); viz[j].add(i); } } }));
    // mar: algumas células da borda viram água (litoral irregular), sem partir a terra em pedaços
    const terra = new Array(n).fill(true);
    const naBorda = (i) => cel[i].L.includes(-1);
    const conexo = () => { const ini = terra.indexOf(true), vis = new Set([ini]), fila = [ini]; while (fila.length) { const a = fila.pop(); viz[a].forEach(b => { if (terra[b] && !vis.has(b)) { vis.add(b); fila.push(b); } }); } return vis.size === terra.filter(Boolean).length; };
    // toda célula que encosta na borda do mundo vira mar (a costa fica serrilhada e dentro da tela)
    for (let i = 0; i < n; i++) if (naBorda(i)) terra[i] = false;
    // e mais algumas na beira da água, para o litoral ficar irregular (sem partir a terra)
    const ordem = pts.map((_, i) => i).sort(() => r() - 0.5);
    let tirar = Math.round(n * cfg.mar);
    for (const i of ordem) {
        if (!tirar) break;
        if (!terra[i] || ![...viz[i]].some(j => !terra[j])) continue;
        terra[i] = false;
        if (!conexo()) terra[i] = true; else tirar--;
    }
    // províncias (só a terra), com contornos serrilhados
    const idx = {}, prov = [];
    pts.forEach((p, i) => { if (terra[i]) { idx[i] = prov.length; prov.push({ i }); } });
    const nomes = NOMES_PROV.slice().sort(() => r() - 0.5);
    prov.forEach((pv, k) => {
        const c = cel[pv.i];
        const poli = [];
        c.v.forEach((P, e) => {
            const Q = c.v[(e + 1) % c.v.length], j = c.L[e];
            const costa = j < 0 || !terra[j];
            const linha = serrilhar(P, Q, costa ? 0.5 : 0.22);
            linha.slice(0, -1).forEach(pt => poli.push(pt));
        });
        const ct = centroide(c.v);
        Object.assign(pv, { id: 'p' + k, nome: nomes[k % nomes.length], x: ct.x, y: ct.y, poli, viz: [...viz[pv.i]].filter(j => terra[j]).map(j => 'p' + idx[j]), costa: c.L.some(j => j < 0 || !terra[j]) });
        let a = 0; c.v.forEach((P, e) => { const Q = c.v[(e + 1) % c.v.length]; a += P.x * Q.y - Q.x * P.y; }); pv.area = Math.abs(a / 2);
    });
    return { W, H, prov };
}

// Caminho de um polígono (coordenadas do mundo)
function caminhoDe(poli) { const p = new Path2D(); poli.forEach((pt, k) => k ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)); p.closePath(); return p; }

// Pinta o terreno uma vez (imagem fora da tela). ESC = pixels por unidade do mundo.
const CORES_TERRENO = { campo: '#5d6a42', floresta: '#3d5233', morro: '#6e644a', cidade: '#5f5c48', capital: '#5f5c48' };
function pintarTerreno(mapa, provs, semente, ESC) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(mapa.W * ESC); cv.height = Math.round(mapa.H * ESC);
    const cx = cv.getContext('2d'), r = rngSemente(semente + 99);
    cx.scale(ESC, ESC);
    // mar com ondinhas
    const mar = cx.createLinearGradient(0, 0, mapa.W, mapa.H); mar.addColorStop(0, '#1d3340'); mar.addColorStop(1, '#16262f');
    cx.fillStyle = mar; cx.fillRect(0, 0, mapa.W, mapa.H);
    cx.strokeStyle = 'rgba(160,200,220,.07)'; cx.lineWidth = 1;
    for (let k = 0; k < 220; k++) { const x = r() * mapa.W, y = r() * mapa.H; cx.beginPath(); cx.moveTo(x, y); cx.quadraticCurveTo(x + 5, y - 3, x + 10, y); cx.stroke(); }
    // água rasa em volta da terra
    cx.save(); cx.strokeStyle = 'rgba(120,170,190,.18)'; cx.lineJoin = 'round';
    provs.forEach(p => { cx.lineWidth = 16; cx.stroke(p.path); });
    cx.strokeStyle = 'rgba(120,170,190,.12)'; provs.forEach(p => { cx.lineWidth = 30; cx.stroke(p.path); });
    cx.restore();
    // terra
    provs.forEach(p => {
        cx.save(); cx.clip(p.path);
        cx.fillStyle = CORES_TERRENO[p.tipo] || '#5d6a42'; cx.fill(p.path);
        // manchas de relevo
        const b = limites(p.poli);
        for (let k = 0; k < 70; k++) { cx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,240,200,.05)'; cx.beginPath(); cx.arc(b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 6 + r() * 22, 0, Math.PI * 2); cx.fill(); }
        if (p.tipo === 'floresta') for (let k = 0; k < 90; k++) { // árvores
            const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0);
            cx.fillStyle = 'rgba(20,35,18,.55)'; cx.beginPath(); cx.arc(x + 1, y + 1, 3.4, 0, Math.PI * 2); cx.fill();
            cx.fillStyle = r() < 0.5 ? '#2f4a2a' : '#365530'; cx.beginPath(); cx.arc(x, y, 3.2, 0, Math.PI * 2); cx.fill();
        }
        if (p.tipo === 'morro') for (let k = 0; k < 22; k++) { // morros
            const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), s = 6 + r() * 7;
            cx.fillStyle = 'rgba(40,32,22,.35)'; cx.beginPath(); cx.moveTo(x - s, y + s * 0.5); cx.lineTo(x, y - s * 0.6); cx.lineTo(x + s, y + s * 0.5); cx.fill();
            cx.strokeStyle = 'rgba(230,215,180,.35)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x - s * 0.5, y); cx.lineTo(x, y - s * 0.6); cx.stroke();
        }
        if (p.tipo === 'campo') for (let k = 0; k < 7; k++) { // plantações
            const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), w = 14 + r() * 16, ang = r() * Math.PI;
            cx.save(); cx.translate(x, y); cx.rotate(ang); cx.fillStyle = r() < 0.5 ? 'rgba(170,160,80,.25)' : 'rgba(110,130,60,.3)'; cx.fillRect(-w / 2, -w / 3, w, w / 1.5);
            cx.strokeStyle = 'rgba(60,50,20,.25)'; cx.lineWidth = 0.6; for (let l = -w / 3; l < w / 3; l += 3) { cx.beginPath(); cx.moveTo(-w / 2, l); cx.lineTo(w / 2, l); cx.stroke(); } cx.restore();
        }
        if (p.tipo === 'cidade' || p.tipo === 'capital') { // casinhas e ruas
            const n = p.tipo === 'capital' ? 16 : 9;
            cx.strokeStyle = 'rgba(200,190,160,.35)'; cx.lineWidth = 1.4;
            for (let k = 0; k < 3; k++) { const a = r() * Math.PI; cx.beginPath(); cx.moveTo(p.x - Math.cos(a) * 30, p.y - Math.sin(a) * 30); cx.lineTo(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30); cx.stroke(); }
            for (let k = 0; k < n; k++) { const x = p.x + (r() - 0.5) * 34, y = p.y + 10 + (r() - 0.5) * 22; cx.fillStyle = 'rgba(30,25,20,.5)'; cx.fillRect(x + 1, y + 1, 5, 4); cx.fillStyle = r() < 0.5 ? '#a8957a' : '#8f7d66'; cx.fillRect(x, y, 5, 4); }
        }
        cx.restore();
    });
    // estradas entre as províncias vizinhas
    cx.save(); cx.setLineDash([3, 3]); cx.strokeStyle = 'rgba(215,195,150,.28)'; cx.lineWidth = 1.2;
    const feitas = new Set();
    provs.forEach(p => p.viz.forEach(v => { const k = [p.id, v].sort().join('|'); if (feitas.has(k)) return; feitas.add(k); const q = provs.find(x => x.id === v); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); }));
    cx.restore();
    // fronteiras das províncias e o litoral
    cx.lineJoin = 'round';
    provs.forEach(p => { cx.strokeStyle = 'rgba(20,18,12,.55)'; cx.lineWidth = 1.2; cx.stroke(p.path); });
    // moldura de mapa antigo (quadrícula leve)
    cx.strokeStyle = 'rgba(255,240,200,.04)'; cx.lineWidth = 1;
    for (let x = 0; x < mapa.W; x += 50) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, mapa.H); cx.stroke(); }
    for (let y = 0; y < mapa.H; y += 50) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(mapa.W, y); cx.stroke(); }
    return cv;
}
function limites(poli) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; poli.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }); return { x0, y0, x1, y1 }; }
