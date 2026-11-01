# Front-Line — Regras do Jogo

Conjunto de regras reutilizável, independente de cenário. A campanha atual usa estas regras em `docs/campanha/`.

## I. Ciclo de Comando (Mecânica de Ação)

### Fase de Organização (1d5)
Toda ordem exige preparação.

| Resultado | Efeito |
|-----------|--------|
| 3–5 | Sucesso: execução normal ou acelerada |
| 0–2 | Falha: atraso, fadiga ou dobro do tempo |
| 1 ou menos | **Falha Crítica**: unidade fica *Desorganizada* |

### Fase de Execução
- Combate: **1d20**
- Drones: **1d10**

Resolvida somente após a Fase de Organização.

### Estado de Prontidão
- Prontidão abaixo de **40%** → unidade fica **Desorganizada** automaticamente (**-4** no 1d20).

### Ação Apressada
- Pular o 1d5 para agir sob surpresa → **-4** direto no 1d20.

## II. Hierarquia e Modificadores

Teto de modificadores: **-4 a +4**.

| Nível | Tipo | Modificador no 1d20 |
|-------|------|---------------------|
| 1 | Recruta | -1 |
| 2 | Especialista | 0 (base) |
| 3 | Veterano | +1 (somente se todo o grupo for veterano) |

### Terreno e Clima
- **Lama**: -1 para blindados
- **Neve**: -1 em visão e fadiga
- **Pontos de Defesa**: +1 de defesa

## III. Combate Blindado

### Destruição (1d5)
Modificado por munição (SABOT: +1) e blindagem (Nível 5: -1).

| Resultado | Efeito |
|-----------|--------|
| 5 | Destruído |
| 3–4 | Módulo avariado |
| 1–2 | Ricochete (35% de chance natural) |

### ERA (Reativa)
Anula o primeiro impacto de HEAT/RPG em um setor.

## IV. Guerra Eletrônica (EW) e Drones

### Alcance de comunicação
| Tipo | Alcance |
|------|---------|
| Curta | 500 m |
| Média | 10 km |
| Longa | 100 km |

Rádios de longo alcance são mais fáceis de interceptar.

### Interceptação (1d10)
| Resultado | Efeito |
|-----------|--------|
| 10 | Crítico: localização revelada |
| 7–9 | Grave: informação comprometida |
| 2–4 | Inimigo em alerta |
| 1 | Reverso: interceptação triangulada |

## V. Logística, Tempo e IA Inimiga

- **Realismo de tempo**: movimentação e reforços levam horas ou dias. Inimigos não aparecem do nada.
- **IA estratégica**: o inimigo analisa terreno e clima e responde com contra-bateria, cercos e ataques de elite.
- **Apoio da Central (2d5)**: define o tempo de resposta externo (HIMARS, resgate).
