# Relatório executivo — APIs de certidões e análise do SIEG

**Projeto:** Portal Controller  
**Data:** 3 de setembro de 2026  
**Autor:** Manus AI

## 1. Conclusão executiva

É possível manter o operador **integralmente dentro do Portal Controller** para a maior parte das certidões prioritárias. O caminho adequado não é operar os portais públicos diretamente nem depender da extensão Chrome como solução principal, mas integrar uma ou mais **APIs B2B que absorvem CAPTCHA, mudanças de layout, filas e indisponibilidades**.

A descoberta mais relevante é a **Consulta CND do Serpro**: trata-se de uma API oficial que acessa as bases federais sem intervenção humana, procura primeiro uma certidão válida e, quando necessário, tenta emitir uma nova. Esse serviço resolve especificamente a CND conjunta RFB/PGFN com maior segurança documental que uma automação própria.[1] [2]

Para o restante do catálogo, **Netrin e InfoSimples** são os agregadores com aderência mais clara às cinco fontes inicialmente informadas. A Netrin oferece uma única API REST, catálogo amplo e comprovantes, mas exige proposta comercial para preço e SLA. A InfoSimples publica preços, possui ampla cobertura e permite começar com teste, porém parte das consultas é mantida por automação proprietária dos portais públicos; portanto, a robustez deve ser homologada fonte por fonte.[3] [4] [5]

> **Recomendação:** usar o Serpro para a CND Federal e executar uma prova de conceito comparativa entre Netrin e InfoSimples para CND estadual, PGE-SP, CNDT e FGTS. A extensão Chrome deve permanecer apenas como contingência temporária, não como arquitetura principal.

## 2. O que foi identificado no SIEG

O SIEG confirma, em suas páginas oficiais, o monitoramento em segundo plano de certidões federais, estaduais e trabalhistas dentro do módulo **Controle de Pendências**. O produto também gerencia procurações, certificados, retentativas e alertas. Isso caracteriza uma plataforma própria de orquestração, e não apenas uma API instantânea.[6]

A API aberta publicamente descrita pelo SIEG está concentrada em documentos fiscais e integrações de XML. Até o encerramento desta pesquisa, **não foi localizada documentação pública de endpoint, webhook ou exportação B2B das CNDs e de seus PDFs**. Uma sugestão pública de “Integração API CND”, ainda aberta em 2024, reforça a necessidade de confirmação comercial antes de considerar o SIEG uma fonte para o Portal Controller.[7] [8]

| Característica do SIEG | Avaliação para o Portal Controller |
| --- | --- |
| Monitoramento periódico e alertas | Deve ser reproduzido no Portal Controller como agendamento, histórico e alerta de vencimento. |
| Certificados, procurações e credenciais | Devem ser adotados somente quando a fonte oficial realmente exigir e com custódia segura. |
| Retentativas por indisponibilidade | Deve ser incorporado ao orquestrador por fonte, sem bloquear as demais consultas. |
| Interface e módulos internos | Não devem ser integrados por automação de tela; isso manteria a morosidade e criaria duas interfaces. |
| API pública de CND | Não confirmada. É necessário solicitar ao SIEG uma demonstração técnica e contrato OpenAPI antes de qualquer decisão. |

O SIEG é, portanto, uma **boa referência funcional**, mas não é atualmente a melhor fonte técnica confirmada para alimentar outro sistema. Seu modelo explica a complexidade relatada: múltiplas credenciais, fontes municipais, reprocessamentos e frequências diferentes ficam expostos ao usuário. O Portal Controller deve ocultar essa complexidade em uma fila única, com estados simples e histórico imutável.

## 3. Catálogo recomendado de certidões

O termo “todas as CNDs” não corresponde a um catálogo nacional fechado. Há milhares de órgãos e variações municipais. Para implantação, o conjunto deve ser organizado em famílias, separando **documentos fiscais essenciais** de consultas ampliadas de compliance.

| Prioridade | Família | Exemplos | API confirmada | Entrega esperada |
| --- | --- | --- | --- | --- |
| P0 | Regularidade federal | CND conjunta RFB/PGFN | Serpro, Netrin, InfoSimples, FonteData | PDF/certidão, tipo, validade e código de controle. |
| P0 | Regularidade estadual | CND tributária por UF; SP não inscritos | Netrin, InfoSimples, FiscalAPI | PDF ou comprovante, validade e resultado. |
| P0 | Dívida ativa estadual | PGE-SP e procuradorias estaduais | API oficial PGE-SP; Netrin e InfoSimples para dados | Certidão ou situação fiscal; distinguir documento de simples pesquisa de débitos. |
| P0 | Trabalhista | CNDT/TST | Netrin, InfoSimples, FonteData, BigDataCorp | PDF, protocolo, validade, situação e processos quando aplicável. |
| P0 | FGTS | CRF/CAIXA | Netrin, InfoSimples, FonteData | Certificado/comprovante, número, situação, validade e histórico. |
| P1 | Municipal | CND mobiliária, tributos municipais, CCM/CADIN | InfoSimples e Netrin, por município | PDF/comprovante e validade; cobertura é municipal, não nacional. |
| P1 | Ambiental | IBAMA débitos, embargos e regularidade | Netrin, InfoSimples, FonteData | Certidão/comprovante e validade. |
| P1 | Integridade pública | TCU, CEIS, CNEP, CEPIM e certidão correcional | Netrin, InfoSimples, FonteData, Direct Data | Certidão ou resultado estruturado com código de verificação. |
| P2 | Judicial | TJs, TRFs, falência e recuperação judicial | InfoSimples, Direct Data e BigDataCorp, por tribunal | PDF quando disponível; cobertura e finalidade variam por tribunal. |
| P2 | Protestos | CENPROT/IEPTB e centrais regionais | Netrin, Direct Data e outros homologados | Pesquisa/certidão paga; não confundir com CND fiscal. |
| P2 | Ministério Público e setoriais | MPF, MPT, ANTT, ANP, conselhos profissionais | Direct Data, Netrin, InfoSimples e FonteData | Documento ou consulta estruturada conforme a fonte. |

## 4. Comparação dos fornecedores

| Fornecedor | Força principal | Cobertura confirmada | Documento verificável | Preço público | Risco principal |
| --- | --- | --- | --- | --- | --- |
| **Serpro** | Fonte oficial da CND Federal | CND conjunta RFB/PGFN | Sim, diretamente das bases federais | Sob contratação/faixa; tabela não ficou pública na página dinâmica | Um único tipo de certidão; exige e-CNPJ para contratação e chaves próprias. |
| **Netrin** | Agregador amplo em uma API REST | Federal, estadual, CNDT, FGTS, PGE-SP, IBAMA, integridade e outras | Catálogo retorna `urlComprovante` nas fontes validadas | Somente proposta | Confirmar SLA, preço, retenção do PDF e cobertura real por UF/município. |
| **InfoSimples** | Amplitude, autosserviço e preço publicado | Federal, SEFAZ 27 UFs, SP não inscritos, PGE-SP, FGTS, municipais e judiciais | Algumas APIs retornam PDF/Base64; outras somente JSON | Base de R$ 0,20 a R$ 0,05 + adicionais; mínimo mensal R$ 100 | Automação proprietária de telas públicas e diferenças de retorno entre fontes. |
| **FiscalAPI** | Especialista de baixo custo em CND estadual | CND estadual e consulta conjunta de UFs, além de serviços fiscais | PDF Base64 quando disponível | R$ 50/mês por 500 consultas; outros planos publicados | Não cobre sozinho o catálogo completo. Confirmar consumo da operação de 27 UFs. |
| **FonteData** | Preço unitário transparente e catálogo extenso | Federal, CNDT, FGTS, IBAMA, CADIN, compliance e processos | Deve ser homologado por endpoint; páginas mostram dados e preços | Federal PJ R$ 0,87; CNDT R$ 0,54; sem mensalidade | Custo unitário maior e comprovação do PDF ainda pendente em algumas fontes. |
| **BigDataCorp** | CNDT barata e bem documentada | CNDT e outras fontes on-demand | CNDT inclui texto integral e link do PDF | CNDT R$ 0,10 até 10 mil consultas | Solução especializada; não substitui agregador para o conjunto. |
| **Direct Data** | Marketplace amplo, pré-pago e pós-pago | MPF, TCU, TJs/TRFs, sanções, protestos, PGFN e outras | Comprovante opcional em diversas APIs | Exemplos por consulta; MPF R$ 0,36 | Homologar cada endpoint; não há pacote único confirmado para as cinco P0. |
| **SIEG** | Gestão interna, monitoramento e obrigações | Federal, estadual e trabalhista no próprio módulo | O sistema armazena/acompanha, mas API externa de PDF não foi confirmada | Planos comerciais | Integração B2B de CND não documentada; risco de manter uma segunda interface. |

### 4.1 SLA, franquia e cobrança confirmados publicamente

| Fornecedor | SLA público | Franquia e cobrança | Falhas e retentativas | Conclusão para contratação |
| --- | --- | --- | --- | --- |
| **Serpro** | Não foi localizado compromisso público de disponibilidade da Consulta CND. | Preço por faixa não apareceu publicamente na página dinâmica. A documentação informa que respostas HTTP 200 e 201 são bilhetadas; 202, 400, 404 e erros internos não são bilhetados.[21] | Processamentos acima de cinco segundos retornam chave para polling; o intervalo mínimo é 500 ms. Status de inconsistência e indisponibilidade não são bilhetados.[21] | Exigir proposta com tabela atual, franquia, limite de chamadas, suporte e SLA de produção. A regra de bilhetagem já é suficientemente clara para o desenho técnico. |
| **Netrin** | Não foi localizado SLA público de disponibilidade nem de sucesso por fonte. | Preço, consumo mínimo e franquia não são públicos. | A documentação padroniza erros de CAPTCHA, portal lento, manutenção e bloqueio e indica cobrança por código; a regra comercial completa depende de proposta.[3] | Solicitar matriz contratual por fonte com cobrança de falha, retentativa, timeout, validade da URL e SLA do comprovante. |
| **InfoSimples** | SLA publicado de até **95% da disponibilidade dos web services**, não da efetiva conclusão no órgão. Falhas e mudanças nos sites públicos são excluídas do cálculo. O suporte pago tem prazo máximo de resposta inicial de cinco dias úteis.[22] [23] | Pré-pago, saldo expira em 12 meses e há franquia mínima de R$ 100/mês. Os preços são progressivos e podem receber adicional por fonte.[4] [22] | Se a consulta ultrapassar o tempo máximo informado pelo cliente, retorna erro e não é cobrada. A documentação de cada web service indica outros códigos cobrados e não cobrados.[23] | Comercialmente transparente, mas o SLA de 95% não garante que cada portal público esteja operacional. Homologar taxa de sucesso por fonte. |
| **FiscalAPI** | Não foi localizado SLA público de disponibilidade. | Planos por créditos; o plano público de 500 consultas custa R$ 50/mês. Consultas atendidas por cache também consomem crédito.[11] | Política completa de cobrança de falhas deve ser confirmada na contratação. | Boa candidata especializada para CND estadual, desde que seja confirmado como a operação de 27 UFs consome créditos. |
| **BigDataCorp** | Não foi localizado SLA público específico da CNDT. | R$ 0,10 por consulta até dez mil consultas mensais.[15] | O contrato público deve ser validado quanto a cobrança de timeout e indisponibilidade. | Forte candidata especializada em CNDT por preço e retorno documental claramente documentado. |

> A ausência de SLA ou preço público não significa ausência contratual; significa que **não é possível fechar custo e risco sem proposta formal**. Serpro e Netrin devem fornecer esses itens antes do desenvolvimento do adaptador de produção.

### 4.2 Matriz do documento retornado

| Certidão | Serpro | Netrin | InfoSimples | Alternativa validada |
| --- | --- | --- | --- | --- |
| **CND Federal RFB/PGFN** | **PDF oficial em Base64**, código de controle, emissão, validade e tipo; retorno diferencia certidão encontrada e nova emissão.[21] | `urlComprovante`, dados de RFB/PGFN, código, tipo e validade; URL temporária deve ser baixada para o S3.[3] | JSON com situação, código, emissão, validade e débitos. A página pública não permite afirmar que o arquivo seja sempre o PDF original da RFB. | FonteData publica consulta, mas o arquivo original ainda exige homologação. |
| **SEFAZ-SP — não inscritos** | Não cobre. | CND estadual com validade e `urlComprovante` quando disponível.[3] | JSON com código, mensagem, emissão, validade e indicador de sucesso; **PDF não confirmado** na página pública.[10] | FiscalAPI documenta **PDF Base64 quando disponível** e URL de verificação.[11] |
| **PGE-SP — inscritos/dívida ativa** | Não cobre. | As páginas validadas de PGE-SP descrevem dados de CDAs e `site resumo`; **certidão em PDF não ficou comprovada**.[13] | Retorna dados completos de CDAs e URL de resumo; **não é equivalente à CND em PDF**.[14] | A API oficial PGE-SP publica `GET /certidoes` e objeto de arquivo/link; deve ser o primeiro caminho a homologar.[12] |
| **CNDT/TST** | Não cobre. | Situação, emissão, validade, processos e `urlComprovante`.[3] | Endpoint existe, mas o formato documental não foi confirmado na página pública consultada. | BigDataCorp confirma `RawResultFile` do tipo **PDF**, texto integral, protocolo e validade.[15] |
| **CRF/FGTS** | Não cobre. | Número, situação, validade, histórico e `urlComprovante`.[3] | A página pública confirma JSON com dados do CRF, situação e validade; **PDF não confirmado**.[16] | FonteData possui a consulta, mas o comprovante precisa de homologação. |
| **Municipais** | Não cobre. | Cobertura e comprovante variam por município. | Cobertura e tipo de retorno variam por endpoint municipal. | Deve ser homologado município a município, começando por São Paulo, Sorocaba e Barueri. |

Para o Portal Controller, **PDF oficial**, **comprovante gerado pelo fornecedor**, **URL de evidência** e **JSON/status** serão tipos distintos. O sistema não deve apresentar dados estruturados de dívida como se fossem uma certidão negativa emitida pelo órgão.

## 5. Análise das cinco fontes iniciais

### 5.1 CND Federal

A **Consulta CND do Serpro** é a opção preferencial. A API oficial funciona sem intervenção humana, consulta certidão válida antes de solicitar nova emissão e usa autenticação por `Consumer Key` e `Consumer Secret`. A contratação pode ser realizada por pessoa jurídica com e-CNPJ.[1] [2]

Netrin, InfoSimples e FonteData servem como alternativas. A Netrin retorna código, débitos RFB/PGFN, validade e comprovante. A InfoSimples documenta retorno assíncrono e recibos em PDF Base64. A FonteData cobra R$ 0,87 por CNPJ.[3] [4] [9]

### 5.2 SEFAZ-SP — débitos não inscritos

A InfoSimples possui endpoint específico que emite a certidão paulista e retorna código, mensagem, emissão e validade. Netrin e FiscalAPI também cobrem CND estadual; a FiscalAPI documenta PDF Base64 quando disponível e consulta por múltiplas UFs.[10] [11]

### 5.3 PGE-SP — dívida ativa

O Estado de São Paulo publica API oficial com `GET /certidoes`, `GET /empresas/{cnpj}/situacao-fiscal` e consulta de débitos. Essa é a primeira opção, sujeita à aprovação de acesso pelo Integrador SP.[12]

Netrin e InfoSimples possuem API de pesquisa de débitos da PGE-SP, mas as páginas validadas descrevem principalmente **dados de CDAs**, não garantem por si só a emissão da certidão negativa em PDF. Para o Portal Controller, pesquisa de dívida e documento de certidão devem ser tratados como objetos distintos.[13] [14]

### 5.4 CNDT/TST

Netrin, InfoSimples, FonteData e BigDataCorp oferecem integração. A BigDataCorp apresenta o menor preço público encontrado, R$ 0,10, e documenta texto integral, validade e link do PDF. A Netrin retorna comprovante e processos localizados quando houver; a FonteData cobra R$ 0,54.[3] [9] [15]

### 5.5 CRF/FGTS

Netrin e InfoSimples confirmam serviço por CNPJ. A Netrin retorna número do CRF, situação, validade, histórico e comprovante. Na InfoSimples, o preço base recebe adicional de R$ 0,06 para essa fonte.[3] [16]

## 6. Cenários de custo para 442 CNPJs

Os valores abaixo são **referências matemáticas**, não propostas comerciais. Não incluem impostos, franquias não publicadas, consultas de retentativa nem fontes adicionais.

| Cenário mensal | Cálculo | Valor indicativo |
| --- | --- | --- |
| FonteData — somente Federal + CNDT | 442 × (R$ 0,87 + R$ 0,54) | **R$ 623,22** |
| BigDataCorp — somente CNDT | 442 × R$ 0,10 | **R$ 44,20** |
| FiscalAPI — até 500 consultas estaduais | Plano Starter | **R$ 50,00** |
| InfoSimples — cinco consultas por empresa | 2.210 chamadas × R$ 0,14, mais adicional conhecido do FGTS | **a partir de R$ 335,92** |
| Serpro e Netrin | Proposta/faixa contratual | **A cotar** |

O cálculo da InfoSimples usa a faixa pública de 2.001 a 5.000 chamadas e apenas o adicional do FGTS confirmado. Outros adicionais podem existir. A política exata de aplicação das faixas e os preços de cada endpoint devem constar da proposta de homologação.[4]

## 7. Arquitetura recomendada

O Portal Controller deve manter seu modelo atual de **lote, item por fonte, versões imutáveis, operador, data/hora e arquivo no S3**. A camada nova será um conjunto de adaptadores de fornecedores.

| Camada | Responsabilidade |
| --- | --- |
| Orquestrador | Recebe um CNPJ e cria itens independentes para cada certidão habilitada. |
| Adaptadores | Traduzem o contrato de Serpro, Netrin, InfoSimples ou outro provedor para um modelo interno único. |
| Fila e polling | Trata respostas assíncronas, retentativas e indisponibilidades sem bloquear o lote. |
| Normalização | Converte resultados em negativa, positiva, positiva com efeitos de negativa, não localizada, indisponível ou erro. |
| Evidência | Preserva PDF original, URL de verificação, código de controle, hash e payload técnico. |
| Monitoramento | Agenda nova consulta antes do vencimento e alerta somente quando necessário. |

Esse desenho impede dependência irreversível de um fornecedor. Uma CND Federal pode vir do Serpro e as demais da Netrin; se o contrato mudar, apenas o adaptador é substituído.

## 8. Recomendação de piloto

### Caminho recomendado

O piloto deve começar com duas contratações de teste:

1. **Serpro Consulta CND**, para validar o documento federal oficial sem CAPTCHA.
2. **Netrin e InfoSimples em paralelo**, usando uma amostra de CNPJs autorizados, para comparar SEFAZ-SP, PGE-SP, CNDT e FGTS.

O vencedor do agregador deve ser decidido por evidência: percentual de sucesso, tempo mediano e máximo, PDF verificável, validade, qualidade da mensagem negativa, custo efetivo, política de retentativa e suporte. Se a Netrin oferecer bom preço e PDFs para as quatro fontes, ela reduz muito a complexidade. Se o custo ou SLA não forem competitivos, a InfoSimples permite uma composição mais transparente.

### Alternativa de menor custo, porém mais fragmentada

Uma combinação de **Serpro + FiscalAPI + BigDataCorp + InfoSimples** tende a reduzir custo público nas fontes conhecidas, mas cria quatro integrações e quatro contratos. É adequada somente se a economia justificar a maior manutenção.

### Papel da extensão Chrome

A extensão desenvolvida deve ser mantida apenas como contingência de homologação. O teste confirmou que a Receita usa hCaptcha invisível inclusive na consulta anterior e que seu componente de CNPJ possui validação sensível ao modo de preenchimento. Esses fatores comprovam que operar o portal diretamente é mais frágil que consumir a API oficial.[17]

## 9. Perguntas obrigatórias aos fornecedores

Antes de contratar Netrin, InfoSimples ou outro agregador, a proposta deve responder, por escrito:

| Tema | Pergunta de aceite |
| --- | --- |
| Documento | O retorno contém o PDF original do órgão, um comprovante do fornecedor ou apenas JSON? |
| Autenticidade | São retornados código de controle, URL pública de validação e hash do arquivo? |
| Cobertura | Quais UFs e municípios estão ativos hoje, por endpoint? |
| CAPTCHA | A indisponibilidade do robô é absorvida pelo fornecedor ou retorna erro ao cliente? |
| SLA | Qual disponibilidade, tempo máximo, política de créditos e suporte? |
| Retentativas | Consultas com falha técnica são cobradas? Há callback/webhook e idempotência? |
| Segurança | O provedor exige certificado, procuração ou Gov.br? Como guarda e elimina credenciais? |
| Retenção | Por quanto tempo PDFs e dados ficam nos servidores do fornecedor? |
| Preço | Qual custo efetivo para 442 empresas × cinco fontes, incluindo reconsultas e adicionais? |

## 10. Decisão sugerida

Não recomendo continuar investindo na extensão como fluxo principal. Recomendo solicitar imediatamente **credenciais de homologação e proposta do Serpro, Netrin e InfoSimples**, sem ainda integrar produção. Com respostas e uma amostra real, o Portal Controller pode escolher o arranjo que entregue a maior automação possível sem retirar o operador de sua tela.

Nenhum serviço foi contratado, nenhum formulário comercial foi enviado e nenhuma credencial foi solicitada durante esta pesquisa.

## Referências

[1]: https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito "ConectaGov — Consulta CND"
[2]: https://www.gov.br/pt-br/servicos/obter-solucao-de-consulta-de-dados-de-certidao-negativa-de-debito-cnd "Gov.br — contratar solução Consulta CND"
[3]: https://docs.netrin.com.br/docs/consulta-composta/Fontes%20de%20Consultas%20Ativas "Netrin — fontes de consultas ativas"
[4]: https://infosimples.com/consultas/precos/ "InfoSimples — preços das APIs"
[5]: https://infosimples.com/consultas/receita-federal-pgfn/ "InfoSimples — Receita Federal/PGFN"
[6]: https://www.sieg.com/controle-pendencias "SIEG — Controle de Pendências"
[7]: https://www.sieg.com/integracoes "SIEG — Integrações"
[8]: https://sieg.sleekplan.app/feedback/187347 "SIEG — sugestão Integração API CND"
[9]: https://fontedata.com/docs/certidoes "FonteData — certidões e preços"
[10]: https://infosimples.com/consultas/sefaz-sp-certidao-debitos/ "InfoSimples — SEFAZ-SP CND"
[11]: https://docs.fiscalapi.com.br/docs/cnd-estadual/overview "FiscalAPI — CND Estadual"
[12]: https://integrador.sp.gov.br/wps/portal/integrador/catalogoApis/API/pge-divida-ativa "Integrador SP — API PGE Dívida Ativa"
[13]: https://netrin.com.br/api/procuradoria-geral-do-estado-sp-divida-ativa/ "Netrin — PGE-SP Dívida Ativa"
[14]: https://infosimples.com/consultas/pge-sp-divida-ativa/ "InfoSimples — PGE-SP Dívida Ativa"
[15]: https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-debitos-trabalhistas-negativa "BigDataCorp — CNDT on-demand"
[16]: https://infosimples.com/consultas/caixa-regularidade/ "InfoSimples — CRF/FGTS"
[17]: https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj "Receita Federal — Portal de Certidões"
[18]: https://netrin.com.br/api-de-dados/ "Netrin — API de Dados"
[19]: https://www.directd.com.br/precos "Direct Data — modelos comerciais"
[20]: https://www.directd.com.br/central-de-ajuda/apis/catalogo/MPFCertidaoNegativa "Direct Data — certidão negativa do MPF"
[21]: https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnd/pt/tipos_retornados/ "Serpro — Consulta CND: códigos, bilhetagem e PDF"
[22]: https://storage.googleapis.com/infosimples-termos/2026-08-21/termos-gerais-da-infosimples.pdf "InfoSimples — termos gerais, suporte, franquia e saldo"
[23]: https://storage.googleapis.com/infosimples-termos/2026-08-21/termos-especificos-do-servico-de-automacao-de-consultas.pdf "InfoSimples — SLA e cobrança da automação de consultas"
