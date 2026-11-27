class_name FalasC
extends RefCounted
## O que os soldados gritam na batalha. {nome} é o companheiro que caiu.

const TEXTOS := {
	"inicio": ["Em posição!", "Lá vamos nós.", "Fiquem juntos!", "Olho na trincheira.", "Pela nossa terra!"],
	"avancar": ["Avante!", "Em frente!", "Anda, anda!", "Vamos subir!"],
	"deitar": ["Deita!", "Cabeça baixa!", "Todo mundo no chão!", "Se abriga!"],
	"recuar": ["Recuar!", "Volta, volta!", "Sai daí!", "Cubram a retirada!"],
	"granada": ["Vem bomba!", "Artilharia! Abaixa!", "Ouviu o assobio?", "Protejam-se!"],
	"nosso_canhao": ["Lá vai a nossa!", "Agora eles vão ver.", "Isso, artilharia!"],
	"carga": ["CARGA!", "Pra cima deles!", "Agora ou nunca!"],
	"carga_inimiga": ["Eles vêm vindo!", "Segurem a linha!", "Estão correndo pra cá!"],
	"fumaca": ["Fumaça! Aproveitem!", "Não vão ver a gente.", "Anda na fumaça!"],
	"caiu": ["Perdemos {nome}!", "{nome}! Não!", "Médico! {nome} caiu!", "Segura firme, {nome}!"],
	"abate": ["Peguei um!", "Menos um.", "Acertei!"],
	"perdendo": ["São muitos!", "Não vamos aguentar!", "Precisamos de reforço!"],
	"ganhando": ["Eles estão fraquejando!", "Tá dando certo!", "Falta pouco!"],
	"solto": ["Munição!", "Tô recarregando.", "Cuidado à direita!", "Que barulho...", "Alguém viu meu capacete?", "Mantenham o fogo!"],
	"vitoria": ["Conseguimos!", "A trincheira é nossa!", "Vencemos!", "Ainda estou vivo!"],
	"derrota": ["Acabou... recuem!", "Não deu.", "Salve-se quem puder!"],
	"foge": ["Corre!", "Perdemos a posição!", "Pra trás!"]
}

static func sortear(tipo: String, nome := "") -> String:
	var l: Array = TEXTOS[tipo]
	return str(l[randi() % l.size()]).replace("{nome}", nome)
