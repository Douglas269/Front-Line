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
- Publicado em https://frontline-zeta.vercel.app. No Android (Chrome), aparece o botão **Instalar no celular** abaixo do botão "Pausar", ou pelo menu do navegador → Instalar app. No iPhone (Safari): Compartilhar → Adicionar à Tela de Início.
- Arquivos: `prototipo/manifest.webmanifest`, `prototipo/sw.js` e `prototipo/icons/` (ícone vetorial `icon.svg` e PNGs de 16, 32, 180, 192 e 512 px gerados a partir dele). O `vercel.json` publica esses arquivos também na raiz do site.
- O service worker busca sempre a versão mais nova na rede; a cópia salva só é usada sem conexão.
- **Atualização obrigatória:** o jogo tem um número de versão (`VERSAO_JOGO`) e o site publica a versão mais nova em `versao.json` (sem cache). Ao abrir, ao voltar para o app e a cada minuto o jogo compara as duas; se o site tiver outra versão, aparece a tela "Nova versão do FrontLine", o jogo trava e só continua tocando em **Atualizar agora** (salva a partida, apaga as cópias guardadas e recarrega). Se o navegador ainda entregar a versão antiga logo depois, não trava de novo em loop. A cada atualização publicada, rodar `tools/nova-versao.sh` antes do commit (o teste `versaoSincronizada` confere). Sem internet, o jogo abre, mas o visual depende do Tailwind e das fontes, que vêm de fora.

### Conta e salvamento na nuvem (Supabase)
- Projeto Supabase **FrontLine** (`shoxvekaeuynlutkowqb`, São Paulo). Tabela `public.saves`: um salvamento por jogador (`nivel`, `partida` em JSON, `tutorial_visto`, `updated_at`), com RLS — cada jogador só lê e altera o próprio salvamento.
- Ao abrir o jogo: se há sessão, entra direto; senão aparece a tela de login (e-mail e senha), com **Criar conta** e **Jogar sem conta** (salva só no aparelho). O botão de conta no cabeçalho entra ou sai.
- O jogo continua salvando no aparelho e espelha na nuvem a cada 30 s de jogo e na hora ao virar o dia, pausar, subir de nível, terminar a partida ou fechar o tutorial. Ao entrar, fica com o salvamento mais recente entre aparelho e nuvem; o progresso de convidado passa para a conta no primeiro login. Sem internet, segue como convidado.
- O navegador usa só a chave pública (publishable) do Supabase; a proteção dos dados vem das políticas RLS.

### Tutorial
- Na primeira vez que o jogo é aberto, aparece um guia de 8 passos (objetivo, funções, fome/sede/trincheira, mapa, ordens, rádio e general, defesas, como começar). O relógio fica parado enquanto ele está aberto. Dá para pular, voltar e rever pelo link **Como jogar**, ao lado de "Nova partida".

### Perfis dos soldados
- Toque no retrato ou no nome de um soldado (aba Esquadrão) para abrir a ficha: retrato em estilo de foto de ficha militar (desenhado em SVG no próprio código), nome completo, idade, cidade, tempo de serviço, uma pequena história e uma frase. A ficha mostra o estado atual (função, HP, moral) ou "Morto em ação"/"Desertor". O relógio para enquanto a ficha está aberta. Os perfis ficam em `PERFIS` e não mudam as regras.

### Defesas (aba Defesas)
- **Pontos defensivos:** 3 na trincheira (flanco esquerdo, centro, flanco direito). Cada um começa como terreno livre e precisa de obra: quem está na Manutenção trabalha nela em vez de reparar a trincheira (soldado 4 pontos por ciclo, Engenheiro 12; 100 = pronto; o Engenheiro sozinho leva ~10 s reais). Uma obra por vez.
- **Armas pesadas** (montadas num ponto pronto, com um operador escolhido; o operador precisa estar de Vigília e, enquanto opera, não usa o fuzil):
  - Metralhadora .50: ~4 balas/s real, 25% de acerto, 60 de dano; gasta munição pesada. Prefere alvos sem blindagem.
  - Morteiro 60 mm: um disparo a cada 5 s reais, de 60 a 300 m, no maior grupo; até 110 de dano em cada inimigo do grupo (70% de acerto base); gasta granadas de morteiro.
  - Lança-rojão anticarro: só dispara em blindados até 200 m; 900 de dano (75% de acerto base); recarga 6 s reais; gasta foguetes.
- **Granadas de mão:** lançadas sozinhas (se liberadas) por quem está de vigília em inimigos a menos de 25 m: até 3 inimigos, 140 de dano.
- **Arame farpado:** estendido a 50 m com 1 rolo; infantaria e patrulha andam pela metade enquanto atravessam; desgasta com o uso, o blindado rasga rápido.
- **Blindado inimigo** (plano "Ataque blindado" do general, a partir do dia 8, um por vez): lento, resistente, atira pouco. Fuzil faz 15% do dano, .50 35%, granada 30%, morteiro 50%, anticarro e artilharia de apoio 100%. Os fuzileiros só atiram nele quando não há outro alvo. Se chega à trincheira: −15% de conservação e fere 2 soldados. O general prefere o blindado quando o jogador não tem anticarro pronto.
- **Inventário inicial:** 1 metralhadora .50, 1 morteiro, 1 lança-rojão, 12 granadas de morteiro, 3 foguetes, 10 granadas de mão, 2 rolos de arame.
- **Disponibilidade:** cada comboio pode trazer extras do QG (granadas 60%, granadas de morteiro 40%, foguete 30%, arame 25%). Requisições pagas com prestígio chegam no próximo comboio: 6 granadas (40), 8 granadas de morteiro (60), 2 foguetes (80), 1 rolo de arame (40), metralhadora .50 (150), morteiro (150), lança-rojão (120), mais o custo da dificuldade. O Bloqueio de Sinal impede requisições.
- No mapa: os ninhos aparecem logo abaixo da trincheira (sigla da arma; verde com operador ativo, laranja parado, tracejado em obra) e o arame como uma linha a 50 m.
- Medição com o jogador automático (15 partidas por nível): sem usar as defesas, ~16 / 15 / 14 / 12 dias (níveis 1 / 6 / 12 / 25); usando as defesas, ~22 / 18 / 16 / 14 dias. Antes desta mecânica eram ~21 / 18 / 16 / 13.

### Balanceamento atual (resumo)
- Rações e água: só quem está na função **Cozinha** come e bebe. A cada 10 s na cozinha, o soldado alivia até 10 de fome e 12 de sede, gastando 0,33 de ração e 0,3 L de água por ciclo completo (proporcional ao que realmente consome; saciado, não gasta). Com todos comendo o necessário, o esquadrão gasta ~7 rações e ~7 L por dia. A entrega diária cai nos níveis altos.
- Fome, sede e fadiga (bloco `NECESSIDADES`, por ciclo de 10 s de jogo; 24 ciclos = 1 dia): sem comer, com tempo nublado, a sede chega ao crítico (75) em ~2 dias e a fome em ~3 dias. Chuva forte: fome ×1,15 e sede ×0,8; neve: fome ×1,35 e sede ×0,9. Fadiga: vigília +1,75 (crítica, 85, em ~2 dias sem descanso), manutenção +1,1, cozinha +0,6, descanso −3,5.
- Escolhas que cobram do corpo: de vigília em combate +0,6 de fadiga e +0,5 de sede; Fogo Supressão em combate mais +0,5 e +0,4; Vigília Total +0,4 de fadiga para todos; obra de ponto defensivo +0,5 de fadiga e +0,3 de sede; operar arma pesada em combate +0,3 de fadiga. Abrigo Reforçado alivia −0,3 de fadiga.
- Depósito de mantimentos: cada impacto de artilharia tem 20% de chance de cair no depósito (40% com drone guiando) e destrói 15 a 25% das rações e da água; cada ataque de drone tem 35% de chance de atingir o depósito e destrói 6 a 12%.
- Moral: cai 0,5 a cada 10 s com fadiga ≥ 85; recupera 0,2 a cada 10 s com fadiga < 70 e fome/sede < 50.
- Dano de invasão: 20 por soldado (`GAME_CONFIG.INVASION_DAMAGE`).
- Eventos durante o dia (a partir do dia 2): infantaria (ondas), patrulha (rápida e fraca), drone (rápido, dano baixo, pode ser abatido) e artilharia (aviso de 8 s reais; depois 3 impactos de 13 de dano, reduzidos com Abrigo Reforçado).
- Médico do esquadrão cura 0,6 de HP a cada 10 s no soldado mais ferido.
- Trincheira: conservação de 0 a 100%. Desgasta sozinha 0,3% a cada 10 s (~7% por dia; +0,4% com chuva forte); cada impacto de artilharia tira 7%; cada soldado de infantaria que invade tira 10% (patrulha, 5%). Estragada, as invasões ferem até 80% mais e o Abrigo Reforçado deixa passar até 60% do dano (25% com ela inteira). Em 20% ou menos ela ROMPE: o abrigo não protege e uma invasão de infantaria mata todo o esquadrão. Quem está na Manutenção repara 0,8% a cada 10 s; o Engenheiro, 3%.
- Recebimento: ao chegar suprimento (entrega diária ou carga emergencial), alguém fora da vigília precisa descarregar. Com todos de vigília, metade da carga se perde.
- Ordens táticas: Fogo Supressão (ataque +60%, inimigos 70% mais lentos, gasta munição), Abrigo Reforçado (dano recebido −75%, ataque −60%), Economizar Munição (gasto −65%, ataque −30%) e Vigília Total (mapa visível sem vigias, +0,4 de fadiga a cada 10 s para todos). Pares que se contradizem não ficam ligados juntos: Fogo Supressão × Economizar Munição e Abrigo Reforçado × Vigília Total (ligar uma desliga a outra).
- Carga Emergencial: pedida por item, cada um com o seu preço e a sua entrega: Rações (+20, 45 pts), Água (+30 L, 45 pts), Munição leve (+250, 50 pts) e Munição pesada (+60, 50 pts), mais o custo da dificuldade. Dá para ter os quatro a caminho ao mesmo tempo, mas cada item um pedido por vez. Chega 150 s reais depois do pedido no nível 1 e +10 s a cada nível (nível 25: 390 s); o prazo dobra com a linha de suprimento cortada. Sem ninguém fora da vigília, metade do item se perde.
- Fome e sede sobem com o tempo para todos (ritmo no bloco `NECESSIDADES`, acima) e só caem na Cozinha. É preciso revezar os soldados na cozinha. A partir de 75%, fome ou sede tiram vida e moral.
- Pressão (bloco `PRESSURE` no código, fácil de ajustar): ondas de infantaria começam com 6 soldados e ganham +1 a cada 5 dias (máximo 12, mais extras de nível e de patrulha); vida dos inimigos = (100 + 5 por dia) × dificuldade (antes era +8 por dia e mais 35%; agora têm 28% menos vida no dia 1 e 46% menos no dia 30); dano de cada inimigo ×0,4 (ondas grandes somam muito dano no total); general ataca no dobro do ritmo do antigo sorteio; comboio de suprimentos a cada 2 dias (dias pares). Carga base do comboio (antes da dificuldade e da eficiência da linha): 20 rações, 15 L de água, 700 de munição leve e 80 de munição pesada; no nível 1, com linha boa, chegam ~10 rações, ~360 de munição leve e ~40 de pesada. Rebalanceado depois do tiro bala a bala: antes chegavam só ~60 balas por comboio e a munição acabava no dia 7. A aba Logística mostra o dia do próximo comboio.
- Combate (tiro bala a bala, bloco `ARMAS`/`TIRO` no código): cada soldado dispara com a sua arma e cada bala sai do paiol. Cada bala tem chance de acertar; cada acerto tira vida do inimigo. Metade dos tiros vai no inimigo mais próximo, o resto é espalhado.
  - Armas (por segundo real): Fuzileiro ~2,5 balas, 42% de acerto, 48 de dano; Metralhador ~7 balas, 30%, 40; Atiradora de Elite ~0,6 bala, 90%, 160; Médica e Engenheiro ~2 balas, 30%, 40. Sem munição leve: pistola e baioneta (pouco dano, não gasta paiol).
  - Pontaria: cai com a distância (alcance de 300 m; perto acerta mais), com vida, moral e cansaço baixos, à noite e de madrugada (−15%, a Vigília Total compensa), com névoa (−20%) e chuva forte (−10%); sem vigia, atira às cegas (metade). Drones são alvos mais difíceis (−20%).
  - Ordens: Fogo Supressão 2,5× mais balas com pontaria 0,7× (mata rápido, esvazia o paiol); Economizar Munição 0,4× das balas com pontaria 1,5× (rende mais por bala); Abrigo Reforçado 0,4× das balas com pontaria 0,8×. Quem está fora da vigília atira a 75%.
  - Na tela: contador de tiros, acertos e abates do dia no mapa; resumo do combate no fim do dia (log e Diário); "≈ N balas por inimigo hoje" na aba Logística; tiros, acertos e abates de cada soldado na ficha dele; o log diz quem abateu cada inimigo.
  - O dano de cada inimigo cai com os ferimentos e cresce com os dias. Cada invasor fere 2 soldados. A artilharia de apoio causa 200 de dano em cada inimigo.
- General inimigo (bot): os ataques não são mais sorteados. O general acumula um orçamento de ofensiva e, a cada 10 s, avalia a situação (noite, névoa, vigias, trincheira, cansaço, munição) e escolhe um plano: patrulha, drone, bombardeio, onda de infantaria, reconhecimento e bombardeio (drone + artilharia guiada), marcar e atacar (patrulha + onda) ou bombardeio e assalto (artilharia + infantaria avançando atrás da barragem). Se o plano preferido é caro, ele junta forças. Ele aprende o jeito de jogar: se o jogador se abriga sempre, usa bombardeio e assalto; se usa muita contra-bateria, o aviso de artilharia cai de 8 até 4 s reais; se bloqueia drones, troca por patrulhas; se abate patrulhas, troca por drones. O rádio dá pistas dos planos (mais vigias, mais chance) e a aba Rádio mostra a postura do general e o que ele já percebeu. A memória dele entra no salvamento.
- Ameaças e defesas:
  - Drone observador: enquanto houver drone no setor (e o sinal dele não estiver bloqueado), a artilharia inimiga causa +50% de dano, os tiros inimigos +20% e a artilharia fica mais provável.
  - Bloqueio de Sinal (ordem tática): drones param de guiar o inimigo e cada um tem ~40% de chance por segundo real de cair; o rádio fica ocupado (sem relatório e sem apoios da Central).
  - Contra-bateria (rádio): só durante aviso de artilharia; chega em 1 a 5 s reais (2d5) e, se chegar antes do impacto, cancela o bombardeio.
  - Patrulha batedora: 10 s reais dentro do alcance sem ser abatida marca a posição e recua; a próxima onda vem com 1 soldado a mais.
  - Sem ninguém de vigília (e sem Vigília Total), o esquadrão atira às cegas: metade do dano.
- Crises: raras (no máximo uma por dia; na prática ~1 a cada 5 ou 6 dias), só fora de combate, e o relógio para enquanto a crise está aberta. Oito tipos: congelamento (neve), infecção (chuva ou névoa), desabamento (chuva forte), ração estragada, deserção (moral < 30), emboscada no comboio, interceptação de rádio (1d10: 10 enfraquece a próxima onda, 7–9 dá prestígio, 2–4 atrai patrulha, 1 atrai artilharia) e franco-atirador (duelo do Atirador de Elite). Cada uma tem uma opção que custa agora e outra que custa mais depois; frequência e gravidade sobem até 30% no nível 25. A crise aberta entra no salvamento.
- Áudio: trilha de guerra durante o dia e trilha de combate quando há inimigos (`prototipo/assets/music/`, CC0). Vento ambiente gerado no navegador, em volume bem menor que a música. Tudo começa ao ligar o alto-falante no cabeçalho.
- Tempo: cada dia dura **30 segundos reais** e vira sozinho no fim da madrugada (manhã, tarde, noite, madrugada; 240 s de jogo, 8 por segundo real). O botão **Pausar** congela tudo para decidir com calma (mapa mostra "PAUSADO"); **Continuar** retoma. O jogo pausa sozinho ao sair do app e ao restaurar uma partida salva. Crises, tutorial e login também param o relógio.
- Os valores "a cada 10 s" acima contam segundos de jogo (10 s de jogo ≈ 1,25 s real).

### Níveis de dificuldade
- 25 níveis. Cada vitória sobe um nível; derrota mantém o nível. O nível fica salvo no navegador, mesmo com "Nova partida".
- Cada nível define uma dificuldade que aumenta a frequência de eventos, a vida e o dano dos inimigos e o tamanho das ondas, e diminui a entrega diária de suprimentos e o prestígio ganho; os apoios da Central ficam mais caros.
- Além disso, cada nível acima do 1 aperta de forma visível (bloco `PRESSURE`): −1,5% de ração e água no comboio (nível 25: −36%), +1 soldado por onda a cada 6 níveis (níveis 7, 13, 19 e 25; nível 25: +4) e ataques do general 2% mais rápidos (nível 25: +48%).
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
