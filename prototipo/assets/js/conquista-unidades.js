// FrontLine · Conquista: estruturas de dados do novo sistema de unidades (etapa 1: ainda não usado pelo jogo)
// Unidade = 1 regimento. Formação = grupo de unidades no mesmo ponto (nomenclatura automática pela quantidade).
// GerenciadorRecursos = contas de cada país: dinheiro, aço, combustível, comida, mão de obra.
// Combustível fica previsto (consumo zero por enquanto) porque a lista o pede para o blindado; entra de verdade numa fase futura.

(function (global) {
    'use strict';

    // ---------- Tipos de unidade (valores iniciais, a ajustar por simulação) ----------
    const TIPOS_UNIDADE = {
        infantaria: {
            nome: 'Infantaria',
            custo: { dinheiro: 15, mao: 1, aco: 0 },
            manutencao: { dinheiro: 0.15, comida: 0.5, combustivel: 0 },        // dinheiro + comida
            combate: { danoLeve: 1.0, danoPesado: 0.4, defesaAerea: 0.1, alcance: 1, velocidade: 1.0, hpMax: 100 },
            terreno: { defesa: { cidade: 1.3, floresta: 1.25, morro: 1.15 }, ataque: { planicie: 1.0 } }
        },
        blindado: {
            nome: 'Blindado',
            custo: { dinheiro: 50, mao: 1, aco: 12 },
            manutencao: { dinheiro: 0.6, comida: 0, combustivel: 1.0 },        // dinheiro + combustível (só ao mover)
            combate: { danoLeve: 0.6, danoPesado: 1.2, defesaAerea: 0.0, alcance: 1, velocidade: 1.1, hpMax: 240 },
            terreno: { defesa: {}, ataque: { planicie: 1.25 } }
        },
        artilharia: {
            nome: 'Artilharia',
            custo: { dinheiro: 35, mao: 1, aco: 6 },
            manutencao: { dinheiro: 0.35, comida: 0.5, combustivel: 0 },       // dinheiro + comida
            combate: { danoLeve: 1.6, danoPesado: 1.6, defesaAerea: 0.0, alcance: 2, velocidade: 0.7, hpMax: 90 },
            terreno: { defesa: {}, ataque: {} }
        }
    };

    // ---------- Nomenclatura dinâmica da formação ----------
    // 1 unidade: Regimento (III) · 2-3: Brigada (X) · 4-7: Divisão (XX) · 8-14: Corpo de Exército (XXX) · 15+: Exército (XXXX)
    const NIVEIS_FORMACAO = [
        { min: 15, nome: 'Exército', simbolo: 'XXXX' },
        { min: 8, nome: 'Corpo de Exército', simbolo: 'XXX' },
        { min: 4, nome: 'Divisão', simbolo: 'XX' },
        { min: 2, nome: 'Brigada', simbolo: 'X' },
        { min: 1, nome: 'Regimento', simbolo: 'III' }
    ];
    function nivelFormacao(qtd) { return NIVEIS_FORMACAO.find(n => qtd >= n.min) || null; }

    // Penalidade de eficiência por excesso de tropas (stacking): até 14 sem perda; a partir de 15, cai 3% por unidade extra, com piso de 60%
    const LIMITE_STACK = 14, PENALIDADE_STACK = 0.03, PISO_STACK = 0.6;
    function eficienciaStack(qtd) {
        if (qtd <= LIMITE_STACK) return 1;
        return Math.max(PISO_STACK, 1 - PENALIDADE_STACK * (qtd - LIMITE_STACK));
    }

    // ---------- Unidade (1 regimento) ----------
    let proxUnidade = 1;
    class Unidade {
        constructor(tipo, dono, opcoes = {}) {
            if (!TIPOS_UNIDADE[tipo]) throw new Error('tipo de unidade desconhecido: ' + tipo);
            const T = TIPOS_UNIDADE[tipo];
            this.id = opcoes.id || ('u' + (proxUnidade++));
            this.tipo = tipo;
            this.dono = dono;
            this.nome = opcoes.nome || (T.nome + ' ' + this.id);
            this.hp = T.combate.hpMax;
            this.hpMax = T.combate.hpMax;
            this.moral = 100;
            this.estado = 'parado';                  // parado | marchando | atacando | entrincheirado | sem_suprimentos
            this.formacaoId = null;                  // em qual formação está agora
            this.provId = opcoes.provId || null;     // onde está no mapa
            this.mao = T.custo.mao;                  // vaga de mão de obra que ocupa
        }
        get tipoInfo() { return TIPOS_UNIDADE[this.tipo]; }
        get vivo() { return this.hp > 0; }
    }

    // ---------- Formação (grupo de unidades no mesmo ponto) ----------
    let proxFormacao = 1;
    class Formacao {
        constructor(dono, provId, unidades = [], opcoes = {}) {
            this.id = opcoes.id || ('f' + (proxFormacao++));
            this.dono = dono;
            this.provId = provId;
            this.nomePersonalizado = opcoes.nome || null;   // o jogador pode editar o nome
            this.unidades = [];
            this.estado = 'parado';
            unidades.forEach(u => this.adicionar(u));
        }
        get quantidade() { return this.unidades.filter(u => u.vivo).length; }
        get nivel() { return nivelFormacao(this.quantidade); }
        // nome automático pela quantidade, ou o nome dado pelo jogador
        get nome() { return this.nomePersonalizado || (this.nivel ? this.nivel.nome : 'Vazio'); }
        get simbolo() { return this.nivel ? this.nivel.simbolo : ''; }
        get eficiencia() { return eficienciaStack(this.quantidade); }
        get maoAlocada() { return this.unidades.reduce((t, u) => t + u.mao, 0); }
        get hpTotal() { return this.unidades.reduce((t, u) => t + Math.max(0, u.hp), 0); }
        get hpMaxTotal() { return this.unidades.reduce((t, u) => t + u.hpMax, 0); }
        get moralMedia() { return this.unidades.length ? this.unidades.reduce((t, u) => t + u.moral, 0) / this.unidades.length : 0; }
        adicionar(u) { if (this.unidades.includes(u)) return; u.formacaoId = this.id; u.provId = this.provId; this.unidades.push(u); }
        // desmembrar: tira unidades específicas e devolve como novas formações (uma por unidade ou um grupo)
        desmembrar(ids) {
            const saem = this.unidades.filter(u => ids.includes(u.id));
            this.unidades = this.unidades.filter(u => !saem.includes(u));
            saem.forEach(u => { u.formacaoId = null; });
            return saem.length ? new Formacao(this.dono, this.provId, saem) : null;
        }
    }

    // ---------- Gerenciador de recursos (contas de cada país) ----------
    class GerenciadorRecursos {
        constructor() { this.contas = {}; }
        conta(dono) {
            if (!this.contas[dono]) this.contas[dono] = { dinheiro: 0, aco: 0, combustivel: 0, comida: 0, maoMax: 0, maoUsada: 0, deficit: { dinheiro: 0, comida: 0, combustivel: 0 } };
            return this.contas[dono];
        }
        // pode criar esta unidade agora? devolve null se sim, ou o motivo
        motivoCriar(dono, tipo) {
            const c = this.conta(dono), T = TIPOS_UNIDADE[tipo];
            if (!T) return 'tipo desconhecido';
            if (c.maoMax - c.maoUsada < T.custo.mao) return 'sem mão de obra livre';
            if (c.dinheiro < T.custo.dinheiro) return 'faltam moedas';
            if (c.aco < T.custo.aco) return 'falta aço';
            return null;
        }
        // cria: desconta dinheiro, aço e mão de obra; devolve a Unidade ou null
        criar(dono, tipo, opcoes) {
            if (this.motivoCriar(dono, tipo)) return null;
            const c = this.conta(dono), T = TIPOS_UNIDADE[tipo];
            c.dinheiro -= T.custo.dinheiro; c.aco -= T.custo.aco; c.maoUsada += T.custo.mao;
            return new Unidade(tipo, dono, opcoes);
        }
        // a unidade morreu ou foi dispensada: a mão de obra volta à reserva
        liberar(unidade) {
            const c = this.conta(unidade.dono);
            c.maoUsada = Math.max(0, c.maoUsada - unidade.mao);
        }
        // consumo de uma formação por tick: dinheiro e comida sempre; combustível só enquanto se move ou ataca
        consumoFormacao(formacao, emMovimento = false) {
            const t = { dinheiro: 0, comida: 0, combustivel: 0 };
            formacao.unidades.filter(u => u.vivo).forEach(u => {
                const m = u.tipoInfo.manutencao;
                t.dinheiro += m.dinheiro;
                t.comida += m.comida;
                if (emMovimento) t.combustivel += m.combustivel;
            });
            return t;
        }
        // aplica um tick de um país: paga o que dá; o que falta vira déficit (a regra da comida e do dinheiro)
        aplicarTick(dono, formacoes, emMovimento = new Set()) {
            const c = this.conta(dono);
            const total = { dinheiro: 0, comida: 0, combustivel: 0 };
            formacoes.forEach(f => {
                const k = this.consumoFormacao(f, emMovimento.has(f.id));
                Object.keys(total).forEach(x => { total[x] += k[x]; });
            });
            const pagar = (chave) => {
                const falta = Math.max(0, total[chave] - c[chave]);
                c[chave] = Math.max(0, c[chave] - total[chave]);
                c.deficit[chave] = falta;
                return falta;
            };
            return { dinheiro: pagar('dinheiro'), comida: pagar('comida'), combustivel: pagar('combustivel') };
        }
    }

    const API = { TIPOS_UNIDADE, NIVEIS_FORMACAO, nivelFormacao, eficienciaStack, LIMITE_STACK, Unidade, Formacao, GerenciadorRecursos };
    global.FrontLineUnidades = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
