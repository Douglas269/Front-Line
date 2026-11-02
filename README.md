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
- Rações e água: só quem está na função **Cozinha** come e bebe. A cada 10 s na cozinha, o soldado alivia até 10 de fome e 12 de sede, gastando 0,33 de ração e 0,3 L de água por ciclo completo (proporcional ao que realmente consome; saciado, não gasta). Com todos comendo o necessário, o esquadrão gasta ~7 rações e ~7 L por dia. A entrega diária cai nos níveis altos.
- Fadiga: vigília +0,9 a cada 10 s; outras funções +0,5; descanso −3,5.
- Moral: cai 0,5 a cada 10 s com fadiga ≥ 85; recupera 0,2 a cada 10 s com fadiga < 70 e fome/sede < 50.
- Dano de invasão: 20 por soldado (`GAME_CONFIG.INVASION_DAMAGE`).
- Eventos durante o turno (a partir do dia 2): infantaria (ondas), patrulha (rápida e fraca), drone (rápido, dano baixo, pode ser abatido) e artilharia (aviso de 20 s; depois 3 impactos de 13 de dano, reduzidos com Abrigo Reforçado).
- Médico do esquadrão cura 0,6 de HP a cada 10 s no soldado mais ferido.
- Ordens táticas: Fogo Supressão (ataque +60%, inimigos 70% mais lentos, gasta munição), Abrigo Reforçado (dano recebido −75%, ataque −60%), Economizar Munição (gasto −65%, ataque −30%) e Vigília Total (mapa visível sem vigias, +0,4 de fadiga a cada 10 s para todos).
- Carga Emergencial: chega 2d5 × 15 s depois do pedido (30 a 150 s); o prazo dobra com a linha de suprimento cortada. Só uma carga a caminho por vez.
- Fome e sede sobem com o tempo para todos (+1,5 e +2 a cada 10 s, ou ~36 e ~48 por turno) e só caem na Cozinha. É preciso revezar os soldados na cozinha. A partir de 75%, fome ou sede tiram vida e moral.
- Áudio: trilha de guerra no turno e trilha de combate quando há inimigos (`prototipo/assets/music/`, CC0). Vento ambiente gerado no navegador, em volume bem menor que a música. Tudo começa ao ligar o alto-falante no cabeçalho.
- Turnos: o dia só muda pelo botão **Finalizar turno**. O relógio percorre os 4 períodos (manhã, tarde, noite, madrugada) e congela no fim, esperando a finalização.

### Níveis de dificuldade
- 25 níveis. Cada vitória sobe um nível; derrota mantém o nível. O nível fica salvo no navegador, mesmo com "Nova partida".
- Cada nível define uma dificuldade que aumenta a frequência de eventos, a vida e o dano dos inimigos e o tamanho das ondas, e diminui a entrega diária de suprimentos e o prestígio ganho; os apoios da Central ficam mais caros.
- Calibrado para quem joga bem: ~10% de vitória do nível 1 ao 12, caindo cerca de 0,5 ponto por nível até ~3% no nível 25. Ficar parado não vence em nenhum nível.
- Vitórias medidas com `node tests/niveis.js` (100 partidas por nível medido; margem de cerca de 3 a 6 pontos):

| Nível | Sem ação | Jogador atento (automático) |
|---|---|---|
| 1 a 12 | 0% (~4 dias) | ~10% |
| 25 | 0% | ~2% |

Entre o 12 e o 25 a dificuldade sobe em linha reta, então a chance cai aos poucos entre esses valores. Diferenças de 0,5 ponto por nível são pequenas demais para medir partida a partida.

O "jogador atento" é um robô simples: manda à cozinha quem passa de 40 de fome ou sede, reveza descanso, usa abrigo antes da artilharia, supressão com inimigos à vista, e pede apoios quando pode pagar.

## Testes

Requer o pacote `playwright` e o Chromium do ambiente:

```bash
node tests/simulacao.js
```

Faz verificações funcionais e 60 partidas simuladas sem ação do jogador, e mostra as estatísticas. Sai com código 1 se alguma verificação falhar ou houver erro de JavaScript.
