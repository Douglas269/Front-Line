// Estruturas do novo sistema de unidades (conquista-unidades.js): testa isoladamente, sem o navegador.
const path = require('path');
const U = require(path.join(__dirname, '..', 'prototipo', 'assets', 'js', 'conquista-unidades.js'));
const falhas = [];
const ck = (ok, msg) => { if (!ok) falhas.push(msg); };
const { Unidade, Formacao, GerenciadorRecursos, nivelFormacao, eficienciaStack } = U;

// 1) nomenclatura por quantidade
const nomes = [1, 2, 3, 4, 7, 8, 14, 15, 30].map(n => nivelFormacao(n));
ck(nomes[0].nome === 'Regimento' && nomes[0].simbolo === 'III', '1 unidade = Regimento (III)');
ck(nomes[1].nome === 'Brigada' && nomes[2].nome === 'Brigada' && nomes[1].simbolo === 'X', '2 e 3 = Brigada (X)');
ck(nomes[3].nome === 'Divisão' && nomes[4].nome === 'Divisão' && nomes[3].simbolo === 'XX', '4 e 7 = Divisão (XX)');
ck(nomes[5].nome === 'Corpo de Exército' && nomes[6].nome === 'Corpo de Exército' && nomes[5].simbolo === 'XXX', '8 e 14 = Corpo de Exército (XXX)');
ck(nomes[7].nome === 'Exército' && nomes[8].nome === 'Exército' && nomes[7].simbolo === 'XXXX', '15+ = Exército (XXXX)');

// 2) penalidade de excesso (stacking)
ck(eficienciaStack(14) === 1 && eficienciaStack(1) === 1, 'até 14 unidades não há penalidade');
ck(Math.abs(eficienciaStack(15) - 0.97) < 1e-9 && Math.abs(eficienciaStack(20) - 0.82) < 1e-9, 'a partir de 15 cai 3% por unidade extra');
ck(eficienciaStack(100) === 0.6, 'piso de 60% de eficiência');

// 3) formação: nome automático, nome editado, desmembrar
const g = new GerenciadorRecursos(); g.conta('jogador').dinheiro = 1000; g.conta('jogador').aco = 100; g.conta('jogador').maoMax = 20;
const us = []; for (let i = 0; i < 4; i++) us.push(g.criar('jogador', 'infantaria', { provId: 'p1' }));
const f = new Formacao('jogador', 'p1', us);
ck(f.quantidade === 4 && f.nome === 'Divisão' && f.simbolo === 'XX', 'formação de 4 é Divisão (XX)');
f.nomePersonalizado = 'Primeira Divisão de Ferro'; ck(f.nome === 'Primeira Divisão de Ferro', 'o jogador pode renomear a formação');
const sai = f.desmembrar([us[0].id, us[1].id]);
ck(f.quantidade === 2 && sai.quantidade === 2 && sai.nome === 'Brigada', 'desmembrar separa duas unidades numa nova Brigada');
ck(f.maoAlocada === 2 && us[0].formacaoId === sai.id && us[2].formacaoId === f.id, 'mão de obra alocada acompanha a formação');

// 4) criar unidade: desconta dinheiro, aço e mão de obra; motivos de bloqueio
const c = g.conta('jogador');
const d0 = c.dinheiro, a0 = c.aco, m0 = c.maoUsada;
const tk = g.criar('jogador', 'blindado', { provId: 'p1' });
ck(tk && d0 - c.dinheiro === 50 && a0 - c.aco === 12 && c.maoUsada - m0 === 1, 'blindado: 50 de dinheiro, 12 de aço e 1 de mão de obra');
g.conta('jogador').aco = 3; ck(g.motivoCriar('jogador', 'blindado') === 'falta aço', 'sem aço, não cria blindado');
g.conta('jogador').aco = 100; g.conta('jogador').dinheiro = 5; ck(g.motivoCriar('jogador', 'infantaria') === 'faltam moedas', 'sem dinheiro, não cria');
g.conta('jogador').dinheiro = 1000; g.conta('jogador').maoMax = g.conta('jogador').maoUsada; ck(g.motivoCriar('jogador', 'infantaria') === 'sem mão de obra livre', 'sem vaga de mão de obra, não cria');

// 5) liberar mão de obra quando a unidade morre ou é dispensada
const antes = g.conta('jogador').maoUsada; g.liberar(us[3]); ck(g.conta('jogador').maoUsada === antes - 1, 'unidade morta devolve a vaga');

// 6) consumo: dinheiro e comida sempre; combustível só em movimento
const cf = g.consumoFormacao(new Formacao('jogador', 'p2', [new Unidade('blindado', 'jogador'), new Unidade('infantaria', 'jogador')]), false);
const cm = g.consumoFormacao(new Formacao('jogador', 'p2', [new Unidade('blindado', 'jogador'), new Unidade('infantaria', 'jogador')]), true);
ck(Math.abs(cf.dinheiro - 0.75) < 1e-9 && cf.combustivel === 0, 'parado: blindado + infantaria gastam dinheiro e nada de combustível');
ck(cm.combustivel === 1 && Math.abs(cm.comida - 0.5) < 1e-9, 'em movimento o blindado gasta combustível; a comida da infantaria continua');

// 7) tick com déficit: o que falta vira déficit (regra da comida e do dinheiro)
const g2 = new GerenciadorRecursos(); const c2 = g2.conta('bravo'); c2.dinheiro = 0.1; c2.comida = 0.3;
const frm = new Formacao('bravo', 'p3', [new Unidade('infantaria', 'bravo'), new Unidade('artilharia', 'bravo')]);
const r = g2.aplicarTick('bravo', [frm]);
ck(r.dinheiro > 0 && c2.dinheiro === 0, 'sem dinheiro, o déficit aparece e o saldo zera');
ck(r.comida > 0 && c2.comida === 0, 'sem comida, o déficit aparece e o saldo zera');

console.log(falhas.length ? 'FALHAS: ' + JSON.stringify(falhas, null, 1) : 'Unidades: estruturas e regras de nomenclatura, penalidade, custo, consumo e déficit: todas as verificações passaram.');
process.exit(falhas.length ? 1 : 0);
