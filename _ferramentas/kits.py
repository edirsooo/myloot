# Gera os pacotes de materiais em exemplos/ (kit-negocio.json e kit-lancamento.json).
# Textos próprios do MyLoot, escritos a partir dos temas dos modelos da agência, sem dado de cliente.
# Para mudar um material: edite aqui e rode  python _ferramentas/kits.py
# Atenção: pacote com o mesmo "id" não entra de novo em quem já tem; ao revisar, suba o id (ex.: kit-negocio-v2).
import json, os
AQUI = os.path.dirname(os.path.abspath(__file__))
EX = os.path.join(os.path.dirname(AQUI), 'exemplos')

def item(tipo, titulo, descricao, conteudo, etiquetas, checklist=None, modelo=False, favorito=False):
    d = {'tipo': tipo, 'titulo': titulo, 'descricao': descricao, 'conteudo': conteudo.strip('\n'), 'etiquetas': etiquetas}
    if checklist: d['checklist'] = checklist
    if modelo: d['modelo'] = True
    if favorito: d['favorito'] = True
    return d

CONTATO = """DADOS DO CLIENTE
Nome:
Empresa / marca:
WhatsApp:
E-mail:
Instagram / site:
"""
TOM = """Como a marca deve soar? (marque até 3)
( ) Moderna   ( ) Séria   ( ) Divertida   ( ) Elegante
( ) Acolhedora   ( ) Ousada   ( ) Técnica   ( ) Jovem / descolada
"""
FECHO = """PRAZOS E APROVAÇÃO
Para quando você precisa?
Quem aprova o material (nome e WhatsApp)?

Quer acrescentar mais alguma coisa?

(As informações deste briefing são usadas só para este trabalho.)
"""

negocio = [
    item('nota', 'Briefing — Social Media', 'Perguntas para começar a gestão das redes de um cliente novo.', CONTATO + """
SOBRE O NEGÓCIO
1. O que a empresa vende e para quem?
2. Há quanto tempo está no mercado?
3. O que faz vocês serem escolhidos no lugar dos concorrentes? (o diferencial)
4. Cite 3 concorrentes (diretos ou indiretos) e 3 perfis que você admira.
5. Os produtos/serviços são: ( ) físicos  ( ) online  ( ) presenciais
Atende: ( ) só a cidade  ( ) o estado  ( ) o Brasil todo

PÚBLICO
6. Quem é o cliente ideal? (idade, cidade, profissão, o que ele busca)
7. Quais as 3 maiores dúvidas ou objeções que ele tem antes de comprar?

REDES HOJE
8. Em quais redes vocês estão? ( ) Instagram ( ) TikTok ( ) Facebook ( ) YouTube ( ) LinkedIn ( ) Outra:
9. O perfil do Instagram é comercial? Já comprou seguidores ou usou automação?
10. Tem fotos e vídeos em boa qualidade? Alguém da equipe topa aparecer nos vídeos?

OBJETIVO
11. O principal objetivo agora é: ( ) vender mais ( ) ser mais conhecido ( ) engajar quem já segue ( ) lançar algo novo
12. Como vamos saber que deu certo daqui a 3 meses? (ex.: X mensagens por semana no WhatsApp)
13. Frequência desejada: ___ posts e ___ stories por semana
14. Pretende investir em anúncios? ( ) já invisto ( ) quero começar ( ) não por agora
Verba mensal para anúncios:

IDENTIDADE
15. Já tem logo e identidade visual? Cores e fontes:
16. Alguma cor, assunto ou palavra que NÃO pode aparecer?
""" + TOM + FECHO, ['briefing', 'social-media', 'clientes'], modelo=True, favorito=True),

    item('nota', 'Briefing — Design de Posts', 'Para pacotes de artes avulsas ou mensais.', CONTATO + """
1. O que a empresa faz e qual é o público?
2. Quais produtos/serviços vão aparecer nas artes?
3. Qual mensagem principal o cliente precisa entender ao ver um post?
4. Formatos: ( ) Quadrado 1:1  ( ) Retrato 4:5  ( ) Stories/Reels 9:16  ( ) Horizontal 16:9  ( ) Carrossel
5. Quantas artes e com qual frequência?
6. Vai imprimir alguma arte? (se sim, tamanho e gráfica)
7. Identidade visual: cores, fontes, logo (mande os arquivos)
8. Marcas ou perfis que servem de referência visual:
9. O texto das artes vem pronto ou eu escrevo?
""" + TOM + FECHO, ['briefing', 'design', 'clientes'], modelo=True),

    item('nota', 'Briefing — Identidade Visual', 'Para criar logo e identidade de uma marca.', CONTATO + """
1. O que a empresa faz, há quanto tempo e para quem?
2. Qual é a história da marca? Por que ela existe?
3. Cite 3 concorrentes e o que você acha do visual deles.
4. Marcas (de qualquer área) que você admira visualmente:
5. Que sensação a marca deve passar em 3 palavras?
6. Preferência de cores? Alguma cor proibida?
7. Tem slogan? Vai precisar de um?
8. Onde a marca vai aparecer mais? ( ) redes sociais ( ) fachada ( ) embalagem ( ) uniforme ( ) site ( ) veículo
9. Precisa de manual da marca (guia de uso das cores, fontes e versões do logo)? ( ) Sim ( ) Não
10. Itens de papelaria: ( ) cartão de visita ( ) papel timbrado ( ) assinatura de e-mail ( ) envelope ( ) pasta ( ) crachá ( ) outro:
""" + TOM + FECHO, ['briefing', 'identidade-visual', 'clientes'], modelo=True),

    item('nota', 'Briefing — Criação de Site', 'Para sites institucionais, landing pages e lojas.', CONTATO + """
1. O que a empresa faz e para quem?
2. Qual o objetivo do site? ( ) mostrar a empresa ( ) gerar contatos no WhatsApp ( ) vender online ( ) captar inscrições
3. Já tem site e domínio (endereço .com.br)? Qual? Quem tem o acesso?
4. Páginas desejadas: ( ) Início ( ) Sobre ( ) Serviços ( ) Portfólio ( ) Depoimentos ( ) Blog ( ) Contato ( ) Loja ( ) outra:
5. Já tem textos, fotos e logo? Quem vai mandar?
6. Sites que você gosta (e o que gosta em cada um):
7. Precisa de: ( ) formulário ( ) botão de WhatsApp ( ) agenda online ( ) pagamento ( ) área de membros ( ) outro idioma
8. Quem vai atualizar o site depois?
9. Cores preferidas e cores proibidas:
""" + TOM + FECHO, ['briefing', 'site', 'clientes'], modelo=True),

    item('instrucao', 'Contrato — Gestão de redes sociais (mensal)', 'Modelo para serviço recorrente. Troque tudo o que está entre colchetes.', """
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE GESTÃO DE REDES SOCIAIS

CONTRATANTE: [NOME OU RAZÃO SOCIAL], CPF/CNPJ [NÚMERO], endereço [ENDEREÇO], e-mail [E-MAIL].
CONTRATADO(A): [SEU NOME OU EMPRESA], CPF/CNPJ [NÚMERO], endereço [ENDEREÇO], e-mail [E-MAIL].

1. OBJETO
1.1. Gestão das redes [@PERFIL] no [Instagram / Facebook / TikTok], incluindo:
a) planejamento mensal de conteúdo, enviado para aprovação até o dia [DIA] do mês anterior;
b) criação de [Nº] posts e [Nº] stories por semana, com legenda;
c) agendamento e publicação nos dias combinados;
d) relatório mensal simples com os principais números e próximos passos.
1.2. Não estão incluídos (e podem ser orçados à parte): verba de anúncios, gestão de tráfego pago, fotos e vídeos externos, atendimento de mensagens (direct/WhatsApp), impressos e sites.

2. PRAZO
2.1. Vigência de [3/6/12] meses a partir da assinatura, renovando automaticamente por igual período se nenhuma parte avisar o contrário com 30 dias de antecedência.

3. VALOR E PAGAMENTO
3.1. Valor mensal de R$ [VALOR], pago até o dia [DIA] de cada mês por [PIX / boleto / transferência].
3.2. Atraso: multa de 2% sobre a parcela, juros de 1% ao mês e correção pelo [IPCA]. Com mais de [15] dias de atraso, o serviço pode ser pausado até a regularização.
3.3. O valor é reajustado a cada 12 meses pelo [IPCA], ou em comum acordo.

4. APROVAÇÕES E AJUSTES
4.1. O CONTRATANTE aprova o planejamento e as artes em até [2] dias úteis. Sem resposta nesse prazo, o material é considerado aprovado.
4.2. Cada material inclui até [2] rodadas de ajuste. Mudanças de tema depois da aprovação contam como peça nova.
4.3. O CONTRATANTE envia informações, fotos e acessos necessários a tempo; atrasos dele mudam os prazos na mesma medida.

5. RESPONSABILIDADES
5.1. Do CONTRATADO: entregar o combinado com qualidade e no prazo, cuidar da imagem do CONTRATANTE e manter sigilo do que souber do negócio.
5.2. Do CONTRATANTE: pagar em dia, responder às aprovações e responder pelas informações, preços, promoções e materiais que fornecer.
5.3. Resultados como seguidores, alcance e vendas dependem de fatores externos (algoritmo, mercado, produto, preço, atendimento) e não são garantidos.

6. ACESSOS E SEGURANÇA
6.1. O acesso às contas será dado como colaborador/parceiro sempre que a plataforma permitir. Senhas, quando necessárias, são trocadas pelo CONTRATANTE ao fim do contrato.

7. DIREITOS E PORTFÓLIO
7.1. Após o pagamento, as artes produzidas podem ser usadas pelo CONTRATANTE nas suas redes e materiais.
7.2. O CONTRATADO pode mostrar os trabalhos no seu portfólio, salvo pedido contrário por escrito.

8. DADOS PESSOAIS (LGPD)
8.1. As partes tratam os dados pessoais trocados só para cumprir este contrato e os protegem de acesso indevido.

9. RESCISÃO
9.1. Qualquer parte pode encerrar com aviso de 30 dias, pagando os serviços já prestados no período.
9.2. Descumprimento grave permite encerrar na hora, por escrito.

10. FORO
10.1. Fica eleito o foro de [CIDADE/UF].

[CIDADE], [DATA].

_____________________________  _____________________________
CONTRATANTE                     CONTRATADO(A)

Atenção: modelo de referência. Para valores altos ou casos específicos, revise com um advogado.
""", ['contrato', 'social-media', 'clientes'], ['Preencher os colchetes', 'Conferir entregáveis com o que foi vendido', 'Enviar para assinatura (ex.: gov.br, Clicksign, ZapSign)', 'Guardar o PDF assinado na pasta do cliente'], modelo=True),

    item('instrucao', 'Contrato — Projeto (posts, identidade visual ou site)', 'Modelo para trabalhos com começo e fim. Troque tudo o que está entre colchetes.', """
CONTRATO DE PRESTAÇÃO DE SERVIÇOS — PROJETO

CONTRATANTE: [NOME OU RAZÃO SOCIAL], CPF/CNPJ [NÚMERO], endereço [ENDEREÇO], e-mail [E-MAIL].
CONTRATADO(A): [SEU NOME OU EMPRESA], CPF/CNPJ [NÚMERO], endereço [ENDEREÇO], e-mail [E-MAIL].

1. OBJETO
1.1. Criação de [descreva: pacote de Nº artes / identidade visual / site com Nº páginas], conforme o briefing aprovado, com as entregas:
- [entrega 1, ex.: logo nas versões principal, horizontal e ícone]
- [entrega 2, ex.: manual da marca em PDF]
- [entrega 3, ex.: arquivos em PNG, PDF e editável]
1.2. Para site: domínio, hospedagem e licenças de plugins/temas são pagos pelo CONTRATANTE, salvo se escrito aqui: [ ].

2. ETAPAS E PRAZO
2.1. Briefing → proposta/rascunho em até [Nº] dias úteis → ajustes → entrega final em até [Nº] dias úteis após a aprovação.
2.2. Os prazos contam a partir do pagamento da entrada e do envio de todo o material pelo CONTRATANTE.

3. VALOR E PAGAMENTO
3.1. Valor total de R$ [VALOR]: [50%] na assinatura e [50%] na entrega final, por [PIX / boleto / transferência].
3.2. Os arquivos finais são entregues após a quitação.
3.3. Atraso: multa de 2%, juros de 1% ao mês e correção pelo [IPCA].

4. AJUSTES
4.1. Estão incluídas [2] rodadas de ajuste. Ajustes extras ou mudança de direção depois da aprovação são orçados à parte.
4.2. Sem resposta do CONTRATANTE por [15] dias, o projeto é pausado; a retomada entra na fila de trabalhos.

5. DIREITOS
5.1. Após a quitação, o CONTRATANTE recebe os direitos de uso do material final para a finalidade contratada.
5.2. Rascunhos e opções não escolhidas continuam do CONTRATADO.
5.3. O CONTRATADO pode mostrar o trabalho no portfólio, salvo pedido contrário por escrito.

6. RESPONSABILIDADES
6.1. O CONTRATANTE responde pelos textos, imagens e informações que enviar.
6.2. O CONTRATADO usa fontes, imagens e recursos com licença adequada.

7. DADOS PESSOAIS (LGPD)
7.1. Dados trocados são usados só para este projeto e protegidos.

8. CANCELAMENTO
8.1. Se o CONTRATANTE cancelar, a entrada não é devolvida e as etapas já feitas são cobradas proporcionalmente.

9. FORO
9.1. Fica eleito o foro de [CIDADE/UF].

[CIDADE], [DATA].

_____________________________  _____________________________
CONTRATANTE                     CONTRATADO(A)

Atenção: modelo de referência. Para valores altos ou casos específicos, revise com um advogado.
""", ['contrato', 'projeto', 'clientes'], ['Preencher os colchetes', 'Listar as entregas exatas', 'Receber a entrada antes de começar', 'Guardar o PDF assinado na pasta do cliente'], modelo=True),

    item('nota', 'Proposta comercial', 'Estrutura de proposta curta, que mostra valor antes do preço.', """
PROPOSTA PARA [NOME DO CLIENTE] — [SERVIÇO]
Válida até [DATA]

1. O QUE ENTENDI DO SEU MOMENTO
[2 ou 3 frases com o problema e o objetivo que o cliente contou na conversa. Use as palavras dele.]

2. O QUE VOU FAZER
- [Entrega 1 e o benefício dela]
- [Entrega 2 e o benefício dela]
- [Entrega 3 e o benefício dela]

3. COMO FUNCIONA
Semana 1: [ ]   Semana 2: [ ]   Entrega: [ ]

4. RESULTADOS DE QUEM JÁ TRABALHOU COMIGO
[1 ou 2 casos curtos, com número e antes/depois, ou depoimento]

5. INVESTIMENTO
Opção 1 — [nome]: [o que inclui] — R$ [ ]
Opção 2 — [nome, a recomendada]: [o que inclui] — R$ [ ]
Opção 3 — [nome, a completa]: [o que inclui] — R$ [ ]
Pagamento: [PIX / cartão em até Nx / entrada + parcelas]

6. PRÓXIMO PASSO
Responda "vamos" e eu envio o contrato. Começamos em até [Nº] dias.
""", ['proposta', 'vendas', 'clientes'], ['Personalizar o item 1 com as palavras do cliente', 'Mandar 3 opções de preço', 'Combinar a data do retorno', 'Lembrar no dia combinado'], modelo=True),

    item('instrucao', 'Roteiro de call de vendas', 'Passo a passo para conversar com um cliente e fechar sem empurrar.', """
ANTES DA CALL
- Olhe as redes e o site do cliente. Anote 2 elogios sinceros e 2 oportunidades.
- Não mande preço antes da conversa: "Para te passar um valor justo, preciso entender o seu projeto. Leva 20 minutos."

1. QUEBRAR O GELO (2 min)
Agradeça o tempo. Pergunte algo leve e real (o negócio, a cidade, uma postagem recente).

2. CONTEXTO (1 min)
"A ideia hoje é eu entender o seu momento e, se fizer sentido, te mostrar como posso ajudar. Combinado?"

3. QUEM VOCÊ É (1 min)
Tempo de mercado, quantos clientes, 1 resultado concreto. Curto: a estrela é o cliente.

4. DIAGNÓSTICO (10 min) — fale pouco, escute muito
- Como está hoje? O que já tentou?
- O que mais te incomoda nisso?
- Se nada mudar em 6 meses, o que acontece?
- Como seria o cenário ideal?
Nunca interrompa. Anote as palavras exatas que a pessoa usa.

5. CAMINHO (5 min)
Mostre o plano em 3 passos, usando as palavras dela. Deixe claro o que muda.

6. TRÊS PERGUNTAS DE CONFIRMAÇÃO
- Faz sentido tudo o que conversamos?
- Você acredita que esse caminho resolve?
- Está disposto(a) a investir tempo e dinheiro nisso agora?

7. OFERTA E PREÇO
Apresente a opção recomendada primeiro. Diga o preço e fique em silêncio.
Desconto nunca sem troca: aumente a entrega, mude o prazo ou peça pagamento à vista.

8. FECHAMENTO
"Posso te mandar o contrato ainda hoje?"
Se a pessoa for pensar: combine dia e hora para o retorno e registre no MyLoot (tarefa com lembrete).

DEPOIS
Mande o resumo da conversa e a proposta por WhatsApp no mesmo dia.
""", ['vendas', 'call', 'clientes'], ['Pesquisar o cliente antes', 'Anotar as palavras dele', 'Enviar resumo + proposta no mesmo dia', 'Criar tarefa de retorno com lembrete'], favorito=True),

    item('nota', 'Mensagens prontas de WhatsApp', 'Prospecção, retorno, fechamento, cobrança gentil, renovação e depoimento.', """
PRIMEIRO CONTATO (quem pediu informação)
Oi, [NOME]! Tudo bem? Aqui é [SEU NOME], da [SUA MARCA]. Vi seu interesse em [SERVIÇO]. Para te passar algo do tamanho certo, posso te fazer 3 perguntas rápidas? 🙂

MARCAR A CONVERSA
Para eu te mandar um valor justo, preciso entender seu projeto. Que tal 20 minutinhos amanhã às [HORA] ou [HORA]?

DEPOIS DA CALL
[NOME], obrigado pela conversa! Resumindo o que combinamos: [RESUMO]. A proposta está aqui: [LINK/ARQUIVO]. Alguma dúvida?

RETORNO (2 dias depois)
Oi, [NOME]! Conseguiu ver a proposta? Se quiser, ajusto alguma coisa para caber no seu momento.

FECHAMENTO
Vamos fechar? Se topar, já te mando o contrato e reservo sua data na agenda.

ÚLTIMO RETORNO (sem resposta)
[NOME], vou encerrar sua proposta por aqui para não ficar te cobrando. Quando for a hora, é só me chamar. Sucesso! 🙌

LEMBRETE DE PAGAMENTO (no dia)
Oi, [NOME]! Passando para lembrar que hoje vence a parcela de [MÊS] (R$ [VALOR]). PIX: [CHAVE]. Obrigado! 🙏

PAGAMENTO EM ATRASO (gentil)
Oi, [NOME], tudo bem? Não encontrei o pagamento de [MÊS] (R$ [VALOR], vencido em [DATA]). Aconteceu alguma coisa? Se precisar, combinamos uma nova data.

RENOVAÇÃO
[NOME], nosso contrato completa [Nº] meses em [DATA]. Separei um resumo dos resultados: [LINK]. Para o próximo ciclo, sugiro [IDEIA]. Seguimos juntos?

PEDIR DEPOIMENTO
[NOME], posso te pedir um favor? Um depoimento curtinho (áudio, vídeo ou texto) sobre como foi trabalhar comigo me ajuda muito. Pode ser em 3 frases: como estava antes, o que fizemos e como está agora. 🙏
""", ['whatsapp', 'vendas', 'clientes'], favorito=True),

    item('nota', 'Onboarding de cliente novo', 'Tudo o que fazer depois que o cliente fecha.', """
Cliente: [NOME]
Data de início: [DATA]
Serviço: [ ]

Use o checklist abaixo. Ao terminar, ligue este item ao cliente (campo Cliente) e marque como Concluído.
""", ['onboarding', 'clientes'], ['Contrato assinado e guardado', 'Primeiro pagamento recebido (lance no Financeiro)', 'Cadastrar o cliente em Clientes', 'Criar a pasta do cliente (use a instrução "Criar pastas padrão para clientes")', 'Receber o briefing preenchido', 'Receber logo, fontes, fotos e acessos (como colaborador)', 'Criar o grupo de WhatsApp ou canal de aprovação', 'Combinar o dia fixo de aprovação', 'Criar as tarefas recorrentes do cliente', 'Mandar mensagem de boas-vindas com o cronograma'], modelo=True),

    item('nota', 'Debriefing de projeto', 'Fechamento do projeto: o que deu certo, o que melhorar e próximos passos.', """
Cliente: [NOME]   Projeto: [ ]   Período: [DE] a [ATÉ]

1. OBJETIVO COMBINADO
[O que tínhamos que entregar e alcançar]

2. O QUE FOI ENTREGUE
- [ ]

3. RESULTADOS (com números)
Antes: [ ]   Depois: [ ]

4. O QUE FUNCIONOU MELHOR
- [ ]

5. O QUE PODE MELHORAR (dos dois lados)
- [ ]

6. APRENDIZADOS PARA OS PRÓXIMOS PROJETOS
- [ ]

7. PRÓXIMOS PASSOS SUGERIDOS
- [ ] (aqui mora a renovação ou o próximo projeto)
""", ['debriefing', 'relatorio', 'clientes'], ['Preencher com números reais', 'Apresentar ao cliente em call curta', 'Pedir depoimento', 'Oferecer o próximo passo'], modelo=True),

    item('nota', 'Relatório mensal para o cliente', 'Uma página: números, destaques e plano do próximo mês.', """
RELATÓRIO DE [MÊS/ANO] — [CLIENTE]

NÚMEROS DO MÊS (e a variação sobre o mês anterior)
Seguidores: [ ] ([+/-]%)
Alcance: [ ] ([+/-]%)
Interações: [ ] ([+/-]%)
Cliques no link / mensagens: [ ] ([+/-]%)
Vendas ou pedidos atribuídos (se houver): [ ]
Anúncios: investido R$ [ ] · resultado [ ] · custo por resultado R$ [ ]

DESTAQUES
1. Post que mais funcionou: [ ] — por quê: [ ]
2. Post que menos funcionou: [ ] — o que aprendemos: [ ]

PLANO PARA O PRÓXIMO MÊS
- [Teste 1]
- [Teste 2]
- [O que precisamos do cliente: fotos, depoimentos, promoções…]
""", ['relatorio', 'social-media', 'clientes'], modelo=True),

    item('nota', 'Planejamento de conteúdo do mês', 'Calendário do mês com equilíbrio entre os 4 tipos de post.', """
MÊS: [ ]   CLIENTE: [ ]   VERBA DE ANÚNCIOS: R$ [ ]

EQUILÍBRIO SUGERIDO
40% Conteúdo (ensina, ajuda, tira dúvida)
25% Marca (bastidores, história, valores, equipe)
20% Proximidade (enquete, pergunta, depoimento, humor)
15% Promocional (oferta, produto, chamada para comprar)

DATAS IMPORTANTES DO MÊS
- [ ]

SEMANA 1
Seg: [tipo] — [tema] — [formato: carrossel/vídeo/imagem]
Qua: [ ]
Sex: [ ]

SEMANA 2
Seg: [ ]
Qua: [ ]
Sex: [ ]

SEMANA 3
Seg: [ ]
Qua: [ ]
Sex: [ ]

SEMANA 4
Seg: [ ]
Qua: [ ]
Sex: [ ]

STATUS: na fila → em produção → aprovado → agendado → postado
""", ['conteudo', 'planejamento', 'social-media'], modelo=True),

    item('instrucao', 'Raio-X do negócio', 'Questionário de diagnóstico para entender um negócio antes de propor algo.', """
O NEGÓCIO
1. Há quanto tempo existe? Como e por que nasceu?
2. Em 3 adjetivos, como quer ser visto no mercado?
3. Como chegam os clientes hoje? (indicação, Instagram, Google, anúncios, loja física…)
4. Como é a venda? 100% online, parte online e parte presencial, só presencial?
5. Faturamento médio por mês e margem de lucro aproximada:
6. Quantos clientes a mais dá para atender sem contratar ninguém?
7. Além do faturamento, que números acompanha? (ticket médio, recompra, cancelamentos…)

CONCORRENTES
8. Quem são os 5 principais? Como cada um é visto?
9. Quanto cobram? Que bônus e garantias oferecem?
10. Por que um cliente escolhe o concorrente em vez de você?

CLIENTES
11. Quem é o melhor cliente que você já teve? Por que ele é o melhor?
12. Quais as 3 perguntas que todo cliente faz antes de comprar?
13. Por que os clientes vão embora?

PRÓXIMOS 12 MESES
14. Qual a meta principal? Qual o maior obstáculo?
15. Quanto pode investir por mês em marketing?
""", ['diagnostico', 'clientes', 'estrategia'], modelo=True),

    item('instrucao', 'Como cobrar: valor da sua hora', 'Use a calculadora no Financeiro e evite cobrar menos do que custa.', """
1. Abra Financeiro → 🧮 Calcular preço.
2. Coloque quanto você quer tirar por mês (pró-labore), quanto gasta para trabalhar (ferramentas, internet, impostos, equipamentos) e quantas horas trabalha por semana.
3. O MyLoot calcula o valor da sua hora, já com reserva para férias e imprevistos.
4. Para orçar um projeto: estime as horas de cada etapa (reunião, criação, ajustes, entrega) e multiplique.

Dicas
- Some 20% de margem para ajustes e conversas que ninguém conta.
- Preço mensal fechado (pacote) costuma ser melhor que cobrar por hora: venda o resultado, não o tempo.
- Reajuste uma vez por ano e avise com 30 dias.
""", ['preco', 'financeiro', 'vendas']),
]

lancamento = [
    item('nota', 'Avatar: para quem é o produto', 'Nicho, público, dores, desejos e o grande resultado prometido.', """
NICHO: [ex.: emagrecimento]
SUBNICHO: [ex.: mães depois dos 35 que não têm tempo de academia]

QUEM É (resumo em até 4 linhas)
[ ]

DADOS
Idade: [ ]  Gênero: [ ]  Renda: [ ]  Profissão: [ ]  Onde mora: [ ]
Onde passa o tempo na internet: [ ]

10 DORES (o que incomoda hoje)
1.
2.
3.

10 DESEJOS (o que quer conquistar)
1.
2.
3.

10 MEDOS (o que teme que aconteça)
1.
2.

10 CRENÇAS QUE TRAVAM ("isso não é pra mim porque…")
1.
2.

GRANDE RESULTADO (o destino que o produto promete, em uma frase)
[ ]

PESQUISA: mande um formulário para quem já é cliente ou seguidor com 5 perguntas abertas:
1. Qual sua maior dificuldade com [tema]?
2. O que você já tentou e não deu certo?
3. Se tivesse uma varinha mágica, o que resolveria?
4. O que te impediria de comprar um curso/serviço sobre isso?
5. Quanto você acha justo pagar por uma solução completa?
""", ['lancamento', 'avatar', 'estrategia'], modelo=True),

    item('instrucao', 'Árvore de objeções', 'Como transformar cada "não" do cliente em argumento.', """
PASSO A PASSO (faça para cada objeção)
1. Escreva a objeção com as palavras do cliente.
2. Mostre que entende: "Faz sentido pensar assim, eu também já pensei…"
3. Dê um argumento lógico (número, comparação, exemplo).
4. Mostre uma prova: alguém que pensava igual e conseguiu.

OBJEÇÕES MAIS COMUNS
- Preço: "Está caro." → compare com o custo de continuar com o problema.
- Tempo: "Não tenho tempo." → mostre quanto tempo leva por dia/semana.
- Confiança: "Será que funciona?" → depoimentos, garantia, resultados.
- Capacidade: "Não vou conseguir." → casos de pessoas parecidas que conseguiram.
- Momento: "Agora não é a hora." → o que se perde esperando.

TABELA
Objeção | Empatia | Argumento | Prova
[ ] | [ ] | [ ] | [ ]
[ ] | [ ] | [ ] | [ ]

Use as respostas nas aulas, na página de vendas, nos stories e no WhatsApp.
""", ['lancamento', 'objecoes', 'vendas'], modelo=True),

    item('nota', 'Oferta e garantia', 'Monte uma oferta difícil de recusar.', """
PRODUTO: [nome]
GRANDE RESULTADO: [o que a pessoa conquista]
PARA QUEM É / PARA QUEM NÃO É: [ ] / [ ]

O QUE ESTÁ INCLUSO (com o valor percebido de cada parte)
- Entrega principal: [ ] — R$ [ ]
- Bônus 1 (resolve uma objeção): [ ] — R$ [ ]
- Bônus 2 (acelera o resultado): [ ] — R$ [ ]
- Bônus de ação rápida (só para os primeiros): [ ]

ÂNCORA: comparar com [o que a pessoa gastaria de outro jeito] — R$ [ ]
PREÇO: R$ [ ] à vista ou [N]x de R$ [ ]
FORMAS DE PAGAMENTO: [ ]

GARANTIA
- Incondicional de [7] dias (obrigatória por lei em compras online).
- Opcional, condicional de [N] dias: se a pessoa [cumprir as tarefas X, Y] e não [alcançar o resultado Z], você [devolve o dinheiro / dá uma consultoria extra].
Escreva as condições de forma clara, simples e possível de comprovar.

DEPOIS DA COMPRA (upsell): [oferta complementar]
""", ['lancamento', 'oferta', 'vendas'], modelo=True),

    item('nota', 'Seu método em 3 passos', 'Dê nome e estrutura ao que você ensina ou entrega.', """
DE ONDE VEM SEU MÉTODO (escolha o que mais combina)
( ) Descobri algo pouco conhecido
( ) Olhei algo comum de outro jeito
( ) Superei uma situação muito difícil
( ) Resolvi um problema que ninguém resolvia bem
( ) Tenho resultados muito acima da média

HISTÓRIA EM 5 LINHAS
[ ]

NOME DO MÉTODO: [ex.: Método 3C]
DIFERENCIAL: [o que ele tem que os outros não têm]

ESTRUTURA
Passo 1 — [nome]: [o que a pessoa faz e consegue]
Passo 2 — [nome]: [ ]
Passo 3 — [nome]: [ ]
""", ['lancamento', 'metodo', 'estrategia'], modelo=True),

    item('instrucao', 'Cronograma de lançamento', 'Do aquecimento ao fim das vendas, com metas.', """
NOME DO EVENTO: [ ]
METAS: investimento R$ [ ] · leads [ ] · vendas [ ] · faturamento R$ [ ]

DATAS
Aquecimento (conteúdo do tema): de [ ] a [ ]
Captação de inscritos: de [ ] a [ ]
Aula 1: [ ]   Aula 2: [ ]   Aula 3: [ ]
Abertura do carrinho: [ ] às [ ]
Lembretes de última hora: [ ]
Fechamento do carrinho: [ ] às [ ]
Depois: pesquisa com quem não comprou e debriefing em [ ]

Dica: coloque cada data como tarefa no MyLoot, com lembrete no horário.
""", ['lancamento', 'planejamento'], ['Avatar e oferta prontos', 'Página de captura no ar', 'Grupo/canal de WhatsApp criado', 'Anúncios aprovados', 'Aulas gravadas ou roteirizadas', 'Página de vendas no ar', 'Checkout testado (compra de teste)', 'Mensagens de pós-compra prontas', 'Debriefing marcado'], modelo=True),

    item('instrucao', 'Roteiro das aulas (aula 1, 2 e 3)', 'Estrutura das três aulas gratuitas antes da abertura de vendas.', """
AULA 1 — A OPORTUNIDADE (mostrar que é possível)
- Gancho: o grande resultado em uma frase + prova rápida
- Sua história curta (por que você pode ensinar isso)
- O que a pessoa vai aprender nas 3 aulas
- Conteúdo: o erro comum e a nova forma de ver o problema
- Casos de pessoas que conseguiram
- Tarefa para a próxima aula + chamada para a aula 2

AULA 2 — O CAMINHO (mostrar como)
- Recapitulação da aula 1
- Os 3 passos do seu método (sem ensinar todos os detalhes)
- Quebra das 3 maiores objeções
- Mais provas
- Chamada para a aula 3 ("amanhã eu mostro como fazer isso com acompanhamento")

AULA 3 — A EXPERIÊNCIA DE COMO É (preparar a oferta)
- Um passo prático aplicado ao vivo (a pessoa sente o resultado)
- Perguntas e respostas
- Visão do futuro: como fica a vida depois
- Anúncio: data e hora da abertura das vendas + o que vem na oferta

VÍDEO DE VENDAS (abertura do carrinho)
Gancho → problema → solução (método) → provas → o que está incluso → bônus → preço e âncora → garantia → urgência real (prazo/vagas) → chamada para comprar → perguntas frequentes
""", ['lancamento', 'roteiro', 'video'], modelo=True),

    item('nota', 'Textos das páginas do lançamento', 'Captura, obrigado e vendas: o que escrever em cada uma.', """
PÁGINA DE CAPTURA
Título: [o grande resultado sem a maior dor]
Subtítulo: Aulas gratuitas de [data] a [data] para [avatar]
3 tópicos do que vai aprender
Botão: Quero participar de graça
Rodapé: sua foto + 1 linha de autoridade

PÁGINA DE OBRIGADO
"Inscrição confirmada! Falta 1 passo:" → botão para entrar no grupo do WhatsApp
Pedido: responder a pesquisa de 5 perguntas (link)
Datas e horários das aulas

PÁGINA DE VENDAS (de cima para baixo)
1. Título + vídeo de vendas
2. Para quem é
3. O que você vai conquistar
4. O que está incluso (com os bônus)
5. Depoimentos
6. Quem é você
7. Preço, âncora e formas de pagamento
8. Garantia
9. Perguntas frequentes
10. Botão de compra repetido a cada 2 seções

MENSAGENS DEPOIS DA COMPRA
Pagamento aprovado: boas-vindas + como acessar + próximos passos + oferta complementar (se houver)
Boleto/PIX gerado: link do pagamento + prazo + "qualquer dúvida, me chama aqui"
""", ['lancamento', 'copy', 'paginas'], modelo=True),

    item('instrucao', 'Links com UTM e etiquetas de leads', 'Saiba de onde veio cada inscrito e cada venda.', """
O QUE É UTM
Pedacinhos no fim do link que contam ao Google Analytics/plataforma de onde a pessoa veio.
Formato: https://seusite.com/?utm_source=ORIGEM&utm_medium=TIPO&utm_campaign=CAMPANHA&utm_content=DETALHE

PADRÃO SUGERIDO (minúsculas, sem acento, com hífen)
Bio do Instagram: utm_source=instagram&utm_medium=organico&utm_content=bio
Stories: utm_source=instagram&utm_medium=organico&utm_content=stories
Direct: utm_source=instagram&utm_medium=organico&utm_content=direct
TikTok bio: utm_source=tiktok&utm_medium=organico&utm_content=bio
Grupo de WhatsApp: utm_source=whatsapp&utm_medium=organico&utm_content=grupo
E-mail: utm_source=email&utm_medium=organico&utm_content=lista
Anúncio Meta (público frio): utm_source=meta&utm_medium=pago&utm_content=frio
Anúncio Meta (público quente): utm_source=meta&utm_medium=pago&utm_content=quente
YouTube Ads: utm_source=youtube&utm_medium=pago
Google pesquisa: utm_source=google&utm_medium=pago&utm_content=search
utm_campaign: nome curto do lançamento + mês/ano, ex.: lanc-nov26

ETIQUETAS (TAGS) DE LEADS
Mesmo padrão: [SIGLA]_[MÊS]_[ANO]_[ORGANICO ou PAGO]_[REDE]_[DETALHE]
Ex.: L3C_11_26_PG_META_FRIO · L3C_11_26_ORG_IG_BIO
Compradores: CHECKOUT_[SIGLA]_[MÊS]_[ANO]_[ORIGEM]

Dica: guarde cada link pronto como item Link no MyLoot, com a etiqueta do lançamento.
""", ['lancamento', 'trafego', 'utm']),
]

PACOTES = {
    'kit-negocio.json': {'id': 'kit-negocio-v1', 'pasta': 'kit', 'categoria': {'id': 'c-negocio', 'name': 'Kit do negócio', 'icon': '💼', 'color': '#ff7e00'}, 'itens': negocio},
    'kit-lancamento.json': {'id': 'kit-lancamento-v1', 'pasta': 'kit', 'categoria': {'id': 'c-lancamento', 'name': 'Kit de lançamento', 'icon': '🚀', 'color': '#3ad7ff'}, 'itens': lancamento},
}
# materiais em que a pessoa escreve as respostas (ganham linhas no PDF) e o de mensagens (balões)
FORMULARIOS = {'Briefing — Social Media', 'Briefing — Design de Posts', 'Briefing — Identidade Visual', 'Briefing — Criação de Site', 'Raio-X do negócio',
               'Debriefing de projeto', 'Avatar: para quem é o produto', 'Seu método em 3 passos', 'Oferta e garantia'}
MENSAGENS = {'Mensagens prontas de WhatsApp'}
def tipo_pdf(titulo): return 'form' if titulo in FORMULARIOS else 'msgs' if titulo in MENSAGENS else 'doc'
def nome_pdf(titulo):
    import re
    return re.sub(r'\s+', ' ', re.sub(r'[\\/:*?"<>|]', '', titulo.replace('—', '-'))).strip() + '.pdf'

def gravar():
    for nome, p in PACOTES.items():
        for it in p['itens']:   # o PDF com a identidade (gerado por pdfs.py) entra como anexo do item
            arq = nome_pdf(it['titulo'])
            if os.path.exists(os.path.join(EX, 'kit', arq)): it['arquivos'] = [arq]
        json.dump(p, open(os.path.join(EX, nome), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(nome, len(p['itens']), 'itens,', sum(1 for i in p['itens'] if i.get('arquivos')), 'com PDF')

if __name__ == '__main__':
    gravar()
