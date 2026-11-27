class_name Dados
## Números e textos do modo Conquista (os mesmos do jogo web).

const CICLO := 5.0
const PROD := {
	"capital": {"comida": 3.0, "mun": 5.0, "moedas": 6.0, "aco": 0.5, "comb": 0.3},
	"cidade": {"comida": 1.0, "mun": 2.0, "moedas": 4.0, "aco": 0.25, "comb": 0.0},
	"campo": {"comida": 3.0, "mun": 0.0, "moedas": 1.0, "aco": 0.0, "comb": 0.0},
	"floresta": {"comida": 1.0, "mun": 3.0, "moedas": 0.0, "aco": 0.0, "comb": 0.0},
	"morro": {"comida": 0.0, "mun": 5.0, "moedas": 1.0, "aco": 1.0, "comb": 0.4}
}
const MO := {"capital": 14, "cidade": 8, "campo": 6, "floresta": 4, "morro": 4}
const ATRASO_SOBE := 14.0
const ATRASO_DESCE := 14.0
const ATRASO_EFIC := 30.0
const ATRASO_DESERTA := 80.0
const FOME_CICLO := 10.0
const COME_SE := 30.0
const COME_ALIVIA := 30.0
const RECRUTAR := 15
const FORTIFICAR := 15
const FORTIFICAR_ACO := 2
const FORT_GANHO := 15.0
const TRINCH_BASE := 40.0
const TRINCH_CAPITAL := 70.0
const ESPIAO := 15
const ESPIAO_DURA := 60.0
const ESPIAO_VEL := 45.0
const ESPIAO_MAX := 2
const ARTILHARIA_MUN := 40
const SAQUE_PARTE := 0.3
const ACO_INICIAL := 20.0
const COMB_INICIAL := 20.0
const COMB_DEFICIT_VEL := 0.25
const FALTA_ACO_DANO := 0.75
const LOTACAO_PISO := 0.7
const STACK_LIMITE := 14
const STACK_PEN := 0.03
const STACK_PISO := 0.6
const VEL := 12.0
const BAT_RITMO := 2.5
const BAT_DURACAO := 120.0
const DIST := 300.0
const VELBAT := {"avancar": 14.0, "cobertura": 6.0, "recuar": -12.0}
const TIRO_DEF := 0.18
const TIRO_ATQ := 0.16
const DANO_TIRO := 30.0
const TRINCH_PROTEGE := 0.5
const TRINCH_PROTEGE_CORPO := 0.2
const CORPO_A_CORPO := 0.45
const BLINDADO_RECEBE := 0.35
const CAPITAL_DEFESA := 1.25
const BOT_PENSA := 8.0
const BOT_PENSA_VAR := 6.0
const BOT_PAUSA_ATAQUE := 40.0
const BOT_MARGEM := 1.35
const ART_AVISO := 5.0
const ART_DANO := 28.0
const ART_ABRIGADO := 0.3
const ART_TRINCH := 0.25
const ASSALTO_NO_ABRIGO := 1.35
const FUMACA_MUN := 15
const FUMACA_DURA := 8.0       # em segundos de batalha
const FUMACA_PROTEGE := 0.5    # quanto sobra da chance de acertar quem está encoberto
const CARGA_DURA := 6.0
const CARGA_VEL := 1.8
const CARGA_CORPO := 1.35
const CARGA_RECEBE := 1.2
const REFORCO_MAX := 4

const CAPITULOS := ["Capítulo 1 · A Fronteira", "Capítulo 2 · O Coração do País"]
const FASES := [
	{"n": 1, "cap": 0, "nome": "Fronteira", "bots": ["bravo", "charlie", "delta"], "tempo": 600.0, "extra": 1, "milicia": 0, "graca": 60.0, "objetivo": "semPerder"},
	{"n": 2, "cap": 0, "nome": "O Rio", "bots": ["bravo", "charlie"], "tempo": 720.0, "bot_facil": 0.65, "objetivo": "pesquisa", "regra": "industria", "regra_txt": "região industrial: obras custam metade"},
	{"n": 3, "cap": 0, "nome": "Região central", "bots": ["bravo", "charlie", "delta", "echo"], "tempo": 720.0, "bot_facil": 0.95, "objetivo": "capitais"},
	{"n": 4, "cap": 1, "nome": "Inverno", "bots": ["bravo", "delta", "echo"], "tempo": 780.0, "bot_facil": 1.08, "objetivo": "baixas", "regra": "inverno", "regra_txt": "inverno: campos produzem 40% menos comida"},
	{"n": 5, "cap": 1, "nome": "Aliança frágil", "bots": ["bravo", "charlie", "delta", "echo"], "tempo": 900.0, "bot_facil": 0.75, "objetivo": "rebeldes", "regra": "paz", "regra_txt": "começa em paz com Charlie"},
	{"n": 6, "cap": 1, "nome": "A capital", "bots": ["bravo", "charlie", "delta", "echo"], "tempo": 840.0, "objetivo": "capitais"}
]
const NOMES_JOG := ["Silva", "Santos", "Ferreira", "Costa", "Oliveira", "Mendes", "Rocha", "Lima", "Souza", "Alves", "Pereira", "Nunes", "Barros", "Dias"]
const APELIDOS_RECRUTA := ["Almeida", "Barbosa", "Cardoso", "Dantas", "Esteves", "Farias", "Gomes", "Leal", "Moura", "Pacheco", "Queiroz", "Ramos", "Sales", "Teles", "Vieira"]

const FACCOES := {
	"jogador": {"nome": "Você", "cor": "6fd06a", "perso": ""},
	"bravo": {"nome": "Bravo", "cor": "e0533f", "perso": "agressivo", "esquece": 0.25, "coragem": 0.9, "vontade": 0.5, "reserva": 5.0},
	"charlie": {"nome": "Charlie", "cor": "e3a23b", "perso": "ladrão", "esquece": 0.12, "coragem": 1.1, "vontade": 0.45, "reserva": 10.0},
	"delta": {"nome": "Delta", "cor": "a77bd9", "perso": "defensivo", "esquece": 0.05, "coragem": 1.6, "vontade": 0.3, "reserva": 20.0},
	"echo": {"nome": "Echo", "cor": "4f9fd9", "perso": "oportunista", "esquece": 0.15, "coragem": 1.0, "vontade": 0.45, "reserva": 10.0},
	"neutro": {"nome": "Milícia", "cor": "9a9a86", "perso": "neutra"}
}
const PERSO_TXT := {
	"agressivo": "agressivo: ataca mais que os outros e às vezes deixa a casa vazia",
	"ladrão": "ladrão: prefere saquear moedas a conquistar",
	"defensivo": "defensivo: fortifica e junta tropa; ataca pouco, mas com força",
	"oportunista": "oportunista: ataca quem acabou de sair para brigar",
	"neutra": "milícia local: não ataca ninguém, só se defende."
}
const TIPO_TXT := {"capital": "★ Capital", "cidade": "Cidade", "campo": "Campo", "floresta": "Floresta", "morro": "Morro"}

const TROPAS := {
	"inf": {"nome": "Infantaria", "letra": "I", "cor": "e8e4d0", "custo": 15, "aco": 0, "manut": 0.15, "manut_aco": 0.0, "comb": 0.0, "vel": 1.0, "vida": 100.0, "atq": 1.0, "def": 1.0, "corpo": 1.0, "pesquisa": "", "txt": "equilibrada"},
	"metr": {"nome": "Metralhadora", "letra": "M", "cor": "f4d03f", "custo": 25, "aco": 2, "manut": 0.22, "manut_aco": 0.0, "comb": 0.0, "vel": 0.8, "vida": 100.0, "atq": 0.6, "def": 2.0, "corpo": 0.7, "pesquisa": "metr", "txt": "segura a trincheira; ataca pouco; mata cavalaria"},
	"art": {"nome": "Artilharia", "letra": "A", "cor": "ff7f50", "custo": 35, "aco": 6, "manut": 0.35, "manut_aco": 0.1, "comb": 0.2, "vel": 0.7, "vida": 90.0, "atq": 1.6, "def": 0.8, "corpo": 0.3, "pesquisa": "art", "txt": "atira de longe e fura trincheira; fraca de perto", "longe": true},
	"cav": {"nome": "Cavalaria", "letra": "C", "cor": "5dade2", "custo": 28, "aco": 0, "manut": 0.30, "manut_aco": 0.0, "comb": 0.0, "vel": 1.6, "vida": 110.0, "atq": 0.9, "def": 0.7, "corpo": 1.6, "pesquisa": "cav", "txt": "rápida e forte no corpo a corpo; morre para metralhadora"},
	"blind": {"nome": "Blindado", "letra": "B", "cor": "c39bd3", "custo": 50, "aco": 12, "manut": 0.60, "manut_aco": 0.2, "comb": 1.0, "vel": 1.1, "vida": 240.0, "atq": 0.9, "def": 1.0, "corpo": 1.1, "pesquisa": "blind", "txt": "aguenta tiro de fuzil; só a artilharia fura", "blindado": true}
}
const PESQUISAS := {
	"metr": {"nome": "Metralhadoras", "custo": 40, "tempo": 30.0, "txt": "libera a Metralhadora"},
	"cav": {"nome": "Cavalaria", "custo": 35, "tempo": 25.0, "txt": "libera a Cavalaria"},
	"art": {"nome": "Artilharia pesada", "custo": 60, "tempo": 45.0, "txt": "libera a Artilharia"},
	"blind": {"nome": "Carro blindado", "custo": 110, "tempo": 60.0, "req": ["metr", "art"], "txt": "libera o Blindado"},
	"racoes": {"nome": "Rações enlatadas", "custo": 45, "tempo": 35.0, "txt": "a tropa come 30% menos"},
	"estradas": {"nome": "Estradas militares", "custo": 50, "tempo": 35.0, "txt": "exércitos 20% mais rápidos"},
	"concreto": {"nome": "Concreto armado", "custo": 55, "tempo": 40.0, "txt": "fortes defendem +15% e obras saem 30% mais rápido"},
	"radio": {"nome": "Rádio de campo", "custo": 40, "tempo": 30.0, "txt": "espião custa 10"},
	"propaganda": {"nome": "Propaganda", "custo": 55, "tempo": 40.0, "txt": "+15 de moral em todas as províncias"},
	"medicina": {"nome": "Medicina de campanha", "custo": 45, "tempo": 35.0, "txt": "feridos se recuperam 2x mais rápido"}
}
const OBRAS := {
	"forte": {"nome": "Forte", "custo": 40, "aco": 6, "tempo": 30.0, "txt": "+25% de defesa e +10 de moral"},
	"ferrovia": {"nome": "Ferrovia", "custo": 35, "aco": 5, "tempo": 25.0, "txt": "tropa chega aqui 2x mais rápido"},
	"fabrica": {"nome": "Fábrica", "custo": 45, "aco": 8, "tempo": 40.0, "txt": "+1 aço e +2 munição por ciclo"},
	"hospital": {"nome": "Hospital", "custo": 30, "aco": 4, "tempo": 25.0, "txt": "soldados parados aqui se curam rápido"}
}
const GENERAIS := [
	{"id": "rocha", "nome": "Cel. Rocha", "hab": "atq", "txt": "+20% de tiro ao atacar", "estrelas": 0},
	{"id": "lima", "nome": "Maj. Lima", "hab": "def", "txt": "+25% de tiro ao defender", "estrelas": 2},
	{"id": "nunes", "nome": "Cap. Nunes", "hab": "vel", "txt": "tropa 35% mais rápida", "estrelas": 4},
	{"id": "costa", "nome": "Gen. Costa", "hab": "log", "txt": "a tropa come pela metade e aguenta sem suprimento", "estrelas": 7},
	{"id": "barros", "nome": "Ten. Barros", "hab": "art", "txt": "toda batalha começa com uma barragem de graça", "estrelas": 10}
]
const OBJETIVOS := {
	"semPerder": "não perder nenhuma província para o inimigo",
	"capitais": "vencer com 2 capitais inimigas nas suas mãos",
	"baixas": "perder menos de 20 soldados",
	"rebeldes": "nenhuma província sua se revoltar",
	"pesquisa": "terminar 4 pesquisas"
}
## "1 soldado", "3 soldados": o número com a palavra certa
static func qtd(n: int, um: String, varios: String) -> String:
	return "%d %s" % [n, um if n == 1 else varios]

## "renda": moedas e munição a mais para o inimigo ("prod" só mexe na comida)
const CAPITAIS_DA_ESTRELA := 2
const DIFICULDADES := {
	"recruta": {"vontade": 0.75, "margem": 1.15, "prod": 0.9, "renda": 1.0, "esperteza": 0.3},
	"soldado": {"vontade": 1.0, "margem": 1.0, "prod": 1.0, "renda": 1.0, "esperteza": 0.6},
	"veterano": {"vontade": 1.2, "margem": 0.9, "prod": 1.1, "renda": 1.25, "esperteza": 0.85}
}
## os generais inimigos que fecham a Operação
const CHEFES := {
	"ferro": {"nome": "Marechal Ferro", "titulo": "A Muralha", "txt": "as províncias dele começam muito entrincheiradas, a capital tem forte e ele defende 20% melhor",
		"falas": {"contato": "Ninguém passa pela minha linha.", "perdeu": "Uma pedra caiu. A muralha continua.", "tomou": "A muralha anda para a frente.", "ofensiva": "Marchem sobre {alvo}. Sem pressa.", "repelida": "Voltem para a muralha.", "caiu": "Impossível… a muralha caiu."}},
	"trovao": {"nome": "Coronel Trovão", "titulo": "Dono dos Canhões", "txt": "a artilharia dele sai de graça e dispara duas vezes por batalha: fique atento à Cobertura",
		"falas": {"contato": "Ouviu esse barulho? São os meus canhões.", "perdeu": "Recarreguem. Isso não fica assim.", "tomou": "Primeiro o trovão, depois a bandeira.", "ofensiva": "Canhões apontados para {alvo}.", "repelida": "Economizem pólvora. Eu volto.", "caiu": "Os canhões… se calaram."}},
	"lobo": {"nome": "General Lobo", "titulo": "O Relâmpago", "txt": "a tropa dele marcha 35% mais rápido e as ofensivas vêm com muito mais frequência",
		"falas": {"contato": "Quando me vir, já cheguei.", "perdeu": "Aproveite. Não dura um minuto.", "tomou": "Rápido demais para você?", "ofensiva": "{alvo}. Agora. Correndo.", "repelida": "Foi só o primeiro bote.", "caiu": "Alguém foi mais rápido que eu."}}
}
const CHEFE_PREMIO := {"moedas": 60, "aco": 15}
const CHEFE_GUARDA := 4        # soldados de elite a mais na capital do chefe
const FERRO_DEFESA := 1.2
const LOBO_VEL := 1.35
const LOBO_OFENSIVA := 0.55    # intervalo entre ofensivas
const TROVAO_VEZES := 2

const REFORCOS := {
	"calejados": {"nome": "Tropa calejada", "mais": "seus soldados começam como veteranos", "menos": "começa com 2 soldados a menos"},
	"artilheiros": {"nome": "Escola de artilharia", "mais": "a barragem custa 30 de munição", "menos": "começa com 40 de munição a menos", "art_barata": 10},
	"engenharia": {"nome": "Corpo de engenharia", "mais": "obras 35% mais rápidas", "menos": "começa com 15 moedas a menos"},
	"siderurgia": {"nome": "Siderurgia", "mais": "+30% de aço por ciclo e +10 no começo", "menos": "campos rendem 10% menos comida", "prod": {"aco": 1.3, "comida": 0.9}},
	"intendencia": {"nome": "Intendência", "mais": "+40 moedas e +25 de comida no começo", "menos": "começa com 8 de aço a menos"},
	"motorizada": {"nome": "Coluna motorizada", "mais": "exércitos 12% mais rápidos", "menos": "começa com 10 de combustível e 10 de comida a menos", "vel": 1.12},
	"voluntarios": {"nome": "Voluntários", "mais": "+3 soldados na capital", "menos": "começa com 25 de comida a menos"},
	"bastiao": {"nome": "Bastião", "mais": "a capital começa com trincheira cheia e um forte", "menos": "começa com 20 moedas a menos"},
	"celeiro": {"nome": "Celeiro cheio", "mais": "+15% de comida por ciclo", "menos": "15% menos munição por ciclo", "prod": {"comida": 1.15, "mun": 0.85}}
}
