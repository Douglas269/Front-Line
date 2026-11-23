# Créditos e licenças

Lista de tudo que não foi escrito do zero neste projeto: arte, som, fontes, ícones e bibliotecas.
Cada pasta de arte também tem o seu `LICENSE`/`LICENCA` com o texto original. O teste `node tests/creditos.js` falha se aparecer
um arquivo de imagem, som ou fonte que não esteja coberto aqui.

## Arte e imagens

| Onde | O que é | Origem e licença |
|---|---|---|
| `prototipo/assets/pixel/soldados.png` | soldados em pixel art (Trincheiras e Conquista) | "Tiny Soldiers of The Old World Wars", OpenGameArt.org, **CC0** |
| `prototipo/assets/pixel/blindado.png` | blindado em pixel art | ⚠ **origem a confirmar pelo Douglas** (o README só cita a arte dos soldados) |
| `prototipo/assets/pixel/quadros.json` | posições dos quadros do atlas de soldados | dados do projeto |
| `prototipo/assets/pixel/titulo-fundo.png` | fundo da tela de título | ⚠ **origem a confirmar pelo Douglas** |
| `prototipo/assets/pixel/modo-trincheiras-real.png`, `modo-online-real.png`, `modo-conquista-real.png` | ilustrações dos cartões de modo do menu | feitas a partir da arte do próprio jogo (issue #42) |
| `prototipo/assets/soldados/` (`andando`, `come`, `mira`, `ninho`, `panico`, `trabalho`, `mapa.json`) | silhuetas dos soldados da cena | geradas por IA, recortadas e com contorno reforçado pelo projeto (ver `prototipo/assets/cena/LICENSE.md`) |
| `prototipo/assets/cena/` | explosão, fumaça, clarão e vapor da cena | "Smoke Particle Assets", Kenney, **CC0** |
| `prototipo/assets/medals/` | medalhas | "Medals", Kenney, **CC0** |
| `prototipo/icons/` | ícone do app, escudo, favicons | criados para o FrontLine (SVG e PNGs gerados a partir dele) |
| `prototipo/vendor/game-icons.js` | ícones de armas, recursos etc. | game-icons.net (Lorc, Delapouite e colaboradores), **CC BY 3.0** — pede crédito (na tela "Créditos" do jogo) |

## Som

| Onde | O que é | Origem e licença |
|---|---|---|
| `prototipo/assets/music/lament_of_the_war.mp3`, `evil_approach.mp3` | trilhas do dia / mapa (em rodízio) | "Laments of the War" e "Evil Approach", OpenGameArt.org, **CC0** |
| `prototipo/assets/music/battle_theme_a.mp3`, `determined_pursuit.mp3` | trilhas de combate (em rodízio) | "Battle Theme A" e "Determined Pursuit", OpenGameArt.org, **CC0** |
| `prototipo/vendor/zzfx.js` | gerador dos efeitos sonoros | ZzFX 1.4.0, Frank Force, **MIT** (`prototipo/vendor/LICENSE-zzfx.txt`) |
| (no código) | sons de interface, vento, tiros da Conquista | sintetizados no navegador pelo próprio jogo |

## Fontes

| Arquivo (`prototipo/vendor/fontes/`) | Licença |
|---|---|
| `ChakraPetch-*.ttf` | Chakra Petch, **SIL OFL 1.1** |
| `BarlowCondensed-*.ttf` | Barlow Condensed, **SIL OFL 1.1** |
| `BlackOpsOne-400.ttf` | Black Ops One, **SIL OFL 1.1** |
| `NotoEmoji-sub.woff2` | subconjunto do Noto Emoji, **SIL OFL 1.1** |
| `OFL.txt` | texto da licença |

## Bibliotecas de fora (carregadas de CDN)

- **Supabase JS** (MIT): conta, Duelo e Conquista online.
- **Font Awesome 6.4.0 Free** (ícones CC BY 4.0, fontes SIL OFL, código MIT).
- **Tailwind CSS**: só gera o `assets/css/tailwind.css` (rodando `tools/gerar-css.sh`); o resultado não carrega a biblioteca.

## Como manter

Arquivo novo de imagem, som ou fonte precisa de uma linha aqui (com origem e licença) no mesmo PR. Se a origem for desconhecida,
escreva "origem a confirmar" em vez de inventar.
