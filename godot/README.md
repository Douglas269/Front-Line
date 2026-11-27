# FrontLine · Conquista em Godot

Versão em Godot 4.7.2 do modo Conquista. O jogo web fica em `../prototipo` e não depende desta pasta; a Vercel não publica `godot/` (ver `../.vercelignore`).

Para abrir: no Godot 4.7.2, importe o arquivo `godot/project.godot`.

- `nucleo/`: regras sem tela (jogo, batalha, bots, missões, campanha, operação, modos avulsos, gerador de mapas, recordes).
- `tela/`: mapa, painéis, batalha animada, menus, desenho das tropas (SVG gerado em `arte.gd`).
- `testes/`:
  - sem janela: `regras.gd` (`-- robo N` e `-- avulsas N` medem o equilíbrio) e `modos.gd` (mapas gerados, modos, táticas, eventos, recordes);
  - com janela (`--resolution 432x936`, passar a pasta das fotos): `telas.gd`, `telas2.gd`, `resistencia.gd`, `animacao.gd`, `fps.gd`;
  - `folha.gd`: folha com todos os quadros das tropas;
  - `telas3.gd` (tutorial, dicas, veteranos, chefes, gráficos) e `cenarios.gd` (fotos dos cenários de batalha), com janela;
  - sem janela: `sons.gd` (mede os sons feitos em código) e `equilibrio.gd rapida|operacao <partidas>` (dificuldade medida com o robô de `robo.gd`).
- `nucleo/pintor.gd` pinta o chão dos mapas; para repintar os da campanha: `godot --headless --path . -s res://ferramentas/pintar_mapas.gd`. Isso substitui o chão exportado do jogo web.

Os testes de tela guardam e devolvem o progresso salvo em `user://`.
