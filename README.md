# Front-Line

Jogo de estratégia tático com foco em realismo de comando, combate blindado e guerra eletrônica.

## Estrutura

- `docs/regras.md` — regras do jogo (reutilizáveis entre campanhas)
- `docs/campanha/cronica.md` — crônica da campanha atual
- `data/estado_batalhao.json` — estado do batalhão no ponto de pausa atual

## Campanha atual

**O Guardião de Voznesensk**, capítulo 2. A sessão começa na crise do Esquadrão Charlie no topo da torre do silo.

## Protótipo: Ponto Alpha

`prototipo/ponto-alpha.html` é um protótipo jogável em um único arquivo. Abra no navegador (precisa de internet para o Tailwind e os ícones carregarem).

### Balanceamento atual (resumo)
- Rações e água: consumo de 0,05 por soldado a cada 10 s (~7 por dia), entrega de 9 rações e 13 L por dia em tempo bom.
- Fadiga: vigília +0,9 a cada 10 s; outras funções +0,5; descanso −3,5.
- Moral: cai 0,5 a cada 10 s com fadiga ≥ 85; recupera 0,2 a cada 10 s com fadiga < 70 e fome/sede < 50.
- Dano de invasão: 20 por soldado (`GAME_CONFIG.INVASION_DAMAGE`).
- Eventos durante o turno (a partir do dia 2): infantaria (ondas), patrulha (rápida e fraca), drone (rápido, dano baixo, pode ser abatido) e artilharia (aviso de 20 s; depois 3 impactos de 13 de dano, reduzidos com Abrigo Reforçado).
- Médico do esquadrão cura 0,6 de HP a cada 10 s no soldado mais ferido.
- Ordens táticas: Fogo Supressão (ataque +60%, inimigos 70% mais lentos, gasta munição), Abrigo Reforçado (dano recebido −75%, ataque −60%), Economizar Munição (gasto −65%, ataque −30%) e Vigília Total (mapa visível sem vigias, +0,4 de fadiga a cada 10 s para todos).
- Carga Emergencial: chega 2d5 × 15 s depois do pedido (30 a 150 s); o prazo dobra com a linha de suprimento cortada. Só uma carga a caminho por vez.
- Sem ação do jogador, no nível 1, o esquadrão vence cerca de 28% a 36% das partidas simuladas. Comer e beber reduzem fome e sede em 8 por ciclo de 10 s.
- Áudio: trilha de guerra no turno e trilha de combate quando há inimigos (`prototipo/assets/music/`, CC0). Vento ambiente gerado no navegador, em volume bem menor que a música. Tudo começa ao ligar o alto-falante no cabeçalho.
- Turnos: o dia só muda pelo botão **Finalizar turno**. O relógio percorre os 4 períodos (manhã, tarde, noite, madrugada) e congela no fim, esperando a finalização.

### Níveis de dificuldade
- 25 níveis. Cada vitória sobe um nível; derrota mantém o nível. O nível fica salvo no navegador, mesmo com "Nova partida".
- A cada nível, sobem a frequência de eventos, a vida e o dano dos inimigos e o tamanho das ondas; caem a entrega diária de suprimentos e o prestígio ganho; os apoios da Central ficam mais caros. A subida é lenta (0,3 por nível) e o nível 25 é o teto.
- Vitórias medidas em 20 partidas por nível (`node tests/niveis.js`); "dias" é a média de dias sobrevividos:

| Nível | Sem ação | Jogador atento (automático) |
|---|---|---|
| 1 | ~30% | 100% |
| 2 | 0% (26 dias) | 100% |
| 7 | 0% (20 dias) | 100% |
| 10 | 0% (15 dias) | 100% |
| 15 | 0% (12 dias) | 100% |
| 20 | 0% (10 dias) | 95% |
| 23 | 0% (9 dias) | 15% |
| 25 | 0% (8 dias) | 0% (25 dias) |

O "jogador atento" é um robô simples: reveza descanso, usa abrigo antes da artilharia, supressão com inimigos à vista, e pede apoios quando pode pagar.

## Testes

Requer o pacote `playwright` e o Chromium do ambiente:

```bash
node tests/simulacao.js
```

Faz verificações funcionais e 60 partidas simuladas sem ação do jogador, e mostra as estatísticas. Sai com código 1 se alguma verificação falhar ou houver erro de JavaScript.
