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

### App instalável (PWA)
- O app instalado se chama **FrontLine** (manifesto, título da aba e nome no iPhone). "Ponto Alpha" continua sendo o nome da trincheira dentro da missão.
- Publicado em https://frontline-zeta.vercel.app. No Android (Chrome), aparece o botão **Instalar no celular** abaixo de "Finalizar turno", ou pelo menu do navegador → Instalar app. No iPhone (Safari): Compartilhar → Adicionar à Tela de Início.
- Arquivos: `prototipo/manifest.webmanifest`, `prototipo/sw.js` e `prototipo/icons/` (ícone vetorial `icon.svg` e PNGs de 16, 32, 180, 192 e 512 px gerados a partir dele). O `vercel.json` publica esses arquivos também na raiz do site.
- O service worker busca sempre a versão mais nova na rede; a cópia salva só é usada sem conexão. Sem internet, o jogo abre, mas o visual depende do Tailwind e das fontes, que vêm de fora.

### Balanceamento atual (resumo)
- Rações e água: só quem está na função **Cozinha** come e bebe. A cada 10 s na cozinha, o soldado alivia até 10 de fome e 12 de sede, gastando 0,33 de ração e 0,3 L de água por ciclo completo (proporcional ao que realmente consome; saciado, não gasta). Com todos comendo o necessário, o esquadrão gasta ~7 rações e ~7 L por dia. A entrega diária cai nos níveis altos.
- Fadiga: vigília +0,9 a cada 10 s; outras funções +0,5; descanso −3,5.
- Moral: cai 0,5 a cada 10 s com fadiga ≥ 85; recupera 0,2 a cada 10 s com fadiga < 70 e fome/sede < 50.
- Dano de invasão: 20 por soldado (`GAME_CONFIG.INVASION_DAMAGE`).
- Eventos durante o turno (a partir do dia 2): infantaria (ondas), patrulha (rápida e fraca), drone (rápido, dano baixo, pode ser abatido) e artilharia (aviso de 20 s; depois 3 impactos de 13 de dano, reduzidos com Abrigo Reforçado).
- Médico do esquadrão cura 0,6 de HP a cada 10 s no soldado mais ferido.
- Trincheira: conservação de 0 a 100%. Desgasta sozinha 0,3% a cada 10 s (~7% por dia; +0,4% com chuva forte); cada impacto de artilharia tira 7%; cada soldado de infantaria que invade tira 10% (patrulha, 5%). Estragada, as invasões ferem até 80% mais e o Abrigo Reforçado deixa passar até 60% do dano (25% com ela inteira). Em 20% ou menos ela ROMPE: o abrigo não protege e uma invasão de infantaria mata todo o esquadrão. Quem está na Manutenção repara 0,8% a cada 10 s; o Engenheiro, 3%.
- Recebimento: ao chegar suprimento (entrega diária ou carga emergencial), alguém fora da vigília precisa descarregar. Com todos de vigília, metade da carga se perde.
- Ordens táticas: Fogo Supressão (ataque +60%, inimigos 70% mais lentos, gasta munição), Abrigo Reforçado (dano recebido −75%, ataque −60%), Economizar Munição (gasto −65%, ataque −30%) e Vigília Total (mapa visível sem vigias, +0,4 de fadiga a cada 10 s para todos). Pares que se contradizem não ficam ligados juntos: Fogo Supressão × Economizar Munição e Abrigo Reforçado × Vigília Total (ligar uma desliga a outra).
- Carga Emergencial: chega 2d5 × 15 s depois do pedido (30 a 150 s); o prazo dobra com a linha de suprimento cortada. Só uma carga a caminho por vez.
- Fome e sede sobem com o tempo para todos (+1,5 e +2 a cada 10 s, ou ~36 e ~48 por turno) e só caem na Cozinha. É preciso revezar os soldados na cozinha. A partir de 75%, fome ou sede tiram vida e moral.
- Pressão (bloco `PRESSURE` no código, fácil de ajustar): ondas de infantaria começam com 7 soldados e ganham +1 a cada 5 dias (máximo 12, mais extras de nível e de patrulha); inimigos com +35% de vida; dano de cada inimigo ×0,4 (ondas grandes somam muito dano no total); general ataca no dobro do ritmo do antigo sorteio; comboio de suprimentos a cada 2 dias (dias pares). A aba Logística mostra o dia do próximo comboio.
- Combate: o fogo do esquadrão é dividido entre os alvos (metade no inimigo mais próximo, metade espalhada) e gasta munição uma vez por segundo, não por inimigo. O dano de cada inimigo cai com os ferimentos e cresce com os dias. Cada invasor fere 2 soldados. A artilharia de apoio causa 200 de dano em cada inimigo (não apaga a onda inteira).
- General inimigo (bot): os ataques não são mais sorteados. O general acumula um orçamento de ofensiva e, a cada 10 s, avalia a situação (noite, névoa, vigias, trincheira, cansaço, munição) e escolhe um plano: patrulha, drone, bombardeio, onda de infantaria, reconhecimento e bombardeio (drone + artilharia guiada), marcar e atacar (patrulha + onda) ou bombardeio e assalto (artilharia + infantaria avançando atrás da barragem). Se o plano preferido é caro, ele junta forças. Ele aprende o jeito de jogar: se o jogador se abriga sempre, usa bombardeio e assalto; se usa muita contra-bateria, o aviso de artilharia cai de 20 até 8 s; se bloqueia drones, troca por patrulhas; se abate patrulhas, troca por drones. O rádio dá pistas dos planos (mais vigias, mais chance) e a aba Rádio mostra a postura do general e o que ele já percebeu. A memória dele entra no salvamento.
- Ameaças e defesas:
  - Drone observador: enquanto houver drone no setor (e o sinal dele não estiver bloqueado), a artilharia inimiga causa +50% de dano, os tiros inimigos +20% e a artilharia fica mais provável.
  - Bloqueio de Sinal (ordem tática): drones param de guiar o inimigo e cada um tem 40% de chance por segundo de cair; o rádio fica ocupado (sem relatório e sem apoios da Central).
  - Contra-bateria (rádio): só durante aviso de artilharia; chega em 2d5 s e, se chegar antes do impacto, cancela o bombardeio.
  - Patrulha batedora: 20 s dentro do alcance sem ser abatida marca a posição e recua; a próxima onda vem com 1 soldado a mais.
  - Sem ninguém de vigília (e sem Vigília Total), o esquadrão atira às cegas: metade do dano.
- Crises: raras (no máximo uma por turno; na prática ~1 a cada 5 ou 6 turnos), só fora de combate, e o relógio para enquanto a crise está aberta. Oito tipos: congelamento (neve), infecção (chuva ou névoa), desabamento (chuva forte), ração estragada, deserção (moral < 30), emboscada no comboio, interceptação de rádio (1d10: 10 enfraquece a próxima onda, 7–9 dá prestígio, 2–4 atrai patrulha, 1 atrai artilharia) e franco-atirador (duelo do Atirador de Elite). Cada uma tem uma opção que custa agora e outra que custa mais depois; frequência e gravidade sobem até 30% no nível 25. A crise aberta entra no salvamento.
- Áudio: trilha de guerra no turno e trilha de combate quando há inimigos (`prototipo/assets/music/`, CC0). Vento ambiente gerado no navegador, em volume bem menor que a música. Tudo começa ao ligar o alto-falante no cabeçalho.
- Turnos: o dia só muda pelo botão **Finalizar turno**. O relógio percorre os 4 períodos (manhã, tarde, noite, madrugada) e congela no fim, esperando a finalização.

### Níveis de dificuldade
- 25 níveis. Cada vitória sobe um nível; derrota mantém o nível. O nível fica salvo no navegador, mesmo com "Nova partida".
- Cada nível define uma dificuldade que aumenta a frequência de eventos, a vida e o dano dos inimigos e o tamanho das ondas, e diminui a entrega diária de suprimentos e o prestígio ganho; os apoios da Central ficam mais caros.
- Além disso, cada nível acima do 1 aperta de forma visível (bloco `PRESSURE`): −1,5% de ração e água no comboio (nível 25: −36%), +1 soldado por onda a cada 5 níveis (nível 21+: +4) e ataques do general 2% mais rápidos (nível 25: +48%).
- A calibração por nível (~10% de vitória para o jogador automático no nível 1) é anterior às hordas maiores. Hoje o jogador automático não vence no nível 1 e aguenta ~12 dias; a dificuldade real depende de quem joga. Ficar parado não vence em nenhum nível.
- Vitórias medidas com `node tests/niveis.js` (100 partidas por nível medido; margem de cerca de 3 a 6 pontos):

| Nível | Sem ação | Jogador atento (automático) |
|---|---|---|
| 1 a 12 | 0% (~3 dias) | ~0% (aguenta ~12 dias) |
| 25 | 0% | ~4% |

Entre o 12 e o 25 a dificuldade sobe em linha reta, então a chance cai aos poucos entre esses valores. Diferenças de 0,5 ponto por nível são pequenas demais para medir partida a partida.

O "jogador atento" é um robô simples: manda à cozinha quem passa de 40 de fome ou sede, reveza descanso, põe o Engenheiro para reparar a trincheira abaixo de 70%, mantém alguém fora da vigília para descarregar, usa abrigo antes da artilharia, supressão com inimigos à vista, bloqueio de sinal com drone no setor, contra-bateria quando ainda dá tempo, e pede apoios quando pode pagar. Na dificuldade 5,0, ele vence 82% usando o bloqueio e a contra-bateria, contra 75% sem eles.

## Testes

Requer o pacote `playwright` e o Chromium do ambiente:

```bash
node tests/simulacao.js
```

Faz verificações funcionais e 60 partidas simuladas sem ação do jogador, e mostra as estatísticas. Sai com código 1 se alguma verificação falhar ou houver erro de JavaScript.
