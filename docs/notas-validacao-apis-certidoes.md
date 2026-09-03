# Notas de validação — APIs de certidões

**Data:** 3 de setembro de 2026  
**Status:** pesquisa em andamento

## Serpro — Consulta CND

A documentação oficial confirma uma API capaz de manter toda a operação dentro do Portal Controller. Quando já existe uma certidão federal válida, o **status 1** retorna a certidão encontrada. Quando não existe, o **status 2** emite uma nova certidão. Nos dois casos, o objeto pode incluir tipo, código de controle, datas de emissão e validade e o PDF em Base64. A validade informada é de 180 dias.[1]

O serviço não depende de CAPTCHA, porque a integração é A2A. Quando o processamento ultrapassa cinco segundos, retorna status 7 e uma chave para polling, com intervalo mínimo de 500 ms. Indisponibilidade de base retorna status 6 e não conclui a emissão. A documentação também informa que apenas respostas HTTP 200 e 201 são bilhetadas.[1]

O serviço oficial Gov.br informa que a solução pode ser contratada por **pessoa jurídica** e exige e-CNPJ da contratante no processo de adesão. Após a contratação, o Serpro disponibiliza `Consumer Key` e `Consumer Secret`; o custo depende da faixa mensal de consumo publicada na Loja Serpro. O prazo administrativo indicado é, em média, dez minutos após a assinatura do contrato.[8]

O endpoint de produção documentado é `POST https://apigateway.conectagov.estaleiro.serpro.gov.br/api-cnd/v1/ConsultaCnd/certidao`, com autenticação própria e ambiente de homologação. O catálogo afirma explicitamente que a API opera sem intervenção humana, procura primeiro uma certidão válida e, quando não encontra, tenta emitir nova certidão. Se houver mais de uma válida, retorna a mais recente e de maior validade.[9] [10]

> **Conclusão preliminar:** a API Consulta CND do Serpro resolve exatamente o problema da CND Federal, incluindo reaproveitamento de certidão válida, nova emissão e PDF, sem extensão e sem intervenção fora do Portal Controller.

## Netrin — Consulta Composta

A documentação confirma uma API REST autenticada por bearer token que permite escolher várias fontes em uma única consulta por CNPJ e associar `tags` e uma `reference` do ERP. Ela padroniza erros de CAPTCHA, portal lento, site fora do ar, manutenção e bloqueios, indicando também quando há cobrança.[2]

Os comprovantes são disponibilizados, quando possível, como PDF ou HTML por `urlComprovante`. A URL expira em três meses, e a própria documentação exige que o cliente faça download e armazenamento próprios. Isso é compatível com o histórico e o S3 já implementados no Portal Controller.[2]

A lista pública confirma fontes cadastrais como Receita Federal, SINTEGRA e SEFAZ/CCC, úteis também para completar inscrição estadual. A cobertura exata de cada CND ainda precisa ser validada na parte restante do catálogo e em proposta comercial.[3]

A validação do catálogo completo confirmou os serviços `receita-federal-cnd`, `sefaz-cnd`, `cnd-trabalhista` e `caixa-regularidade-fgts`. A CND Federal retorna código, tipo, pendências PGFN/RFB, validade e comprovante. A CND estadual retorna emissão, mensagem, validade e comprovante, mas exige parâmetros adicionais em algumas UFs. A CNDT retorna situação, emissão, validade, processos encontrados quando aplicável e comprovante. O FGTS retorna número do CRF, situação, validade, histórico e comprovante.[3]

O catálogo também expõe CND do MTE, mas exige credenciais Gov.br ou certificado digital, o que aumenta o risco operacional e de segurança. Esse serviço não deve integrar a primeira etapa sem avaliação contratual específica sobre custódia de credenciais e procuração.[3]

## InfoSimples

A documentação da CND Federal confirma integração JSON por CNPJ e o parâmetro `preferencia_emissao=2via`. O próprio fornecedor recomenda consultar primeiro uma segunda via válida, inclusive para recuperar certidão positiva com efeitos de negativa quando o portal da PGFN não permite nova emissão. O retorno documentado inclui certidão, código, situação, datas de emissão e validade, mensagem, débitos RFB/PGFN e indicador de sucesso.[4]

Para CND estadual, a InfoSimples declara cobertura das 27 SEFAZ e aceita CNPJ, CPF ou inscrição estadual. A documentação também mostra que algumas UFs podem exigir certificado PKCS#12, senha, credenciais ou parâmetros adicionais; portanto, “uma API” não elimina a heterogeneidade das fontes, mas transfere sua manutenção ao fornecedor.[5]

O preço público parte de **R$ 0,20 por consulta** até 500 consultas mensais e cai por volume até R$ 0,05. Há franquia mínima mensal de R$ 100,00 e adicionais por determinadas fontes; o CRF/FGTS acrescenta R$ 0,06. A conta de teste recebe crédito promocional, mas a homologação deve confirmar quais CNDs retornam comprovante e quais retornam apenas JSON.[11]

## FiscalAPI

A documentação confirma endpoint REST para CND estadual por UF e CNPJ, autenticado por `X-API-Key`. O retorno normaliza negativa, positiva, positiva com efeitos de negativa e não contribuinte, inclui emissão, validade, protocolo e, quando disponível, PDF em Base64 e URL de verificação. A API declara também uma operação para consultar os 27 estados simultaneamente.[6]

Os planos públicos variam de R$ 19,99 por 30 consultas a R$ 250,00 por dez mil consultas mensais. O plano de 500 consultas custa R$ 50,00; chamadas em cache também consomem crédito. Isso torna a FiscalAPI economicamente atraente para CND estadual, mas ela não substitui um agregador amplo.[12]

## BigDataCorp

A documentação de CNDT confirma consulta por CNPJ via API on-demand, com preço público de **R$ 0,10 por consulta** até dez mil consultas mensais. O retorno de exemplo inclui protocolo, situação, validade, texto integral da certidão, link do PDF, data da consulta e tempo de execução. Isso permite manter o operador no Portal Controller e preservar tanto o documento quanto o texto auditável.[7]

## FonteData

A documentação pública concentra três certidões sob a mesma chave: CND conjunta federal de pessoa jurídica por R$ 0,87, CNDT por R$ 0,54 e CND de pessoa física por R$ 0,43, sem mensalidade. O catálogo também inclui FGTS, IBAMA, CADIN, CEIS/CNEP, protestos e processos, mas a emissão de PDF original precisa ser confirmada por endpoint antes da contratação.[13]

## Direct Data

O catálogo técnico confirma APIs síncronas e assíncronas, comprovante opcional e retorno estruturado. Como exemplo, a certidão negativa do MPF custa R$ 0,36 e pode gerar PDF, retornando validade, código de validação e URL do comprovante. O fornecedor possui catálogo amplo de sanções, TRF, TJs, protestos e PGFN, porém a cobertura de cada certidão prioritária deve ser homologada individualmente.[14]

| Critério | Serpro Consulta CND | Netrin Consulta Composta |
| --- | --- | --- |
| CND Federal | Confirmada | A confirmar no catálogo específico |
| Nova emissão automática | Confirmada | Depende da fonte contratada |
| PDF | Base64 no retorno | URL temporária quando disponível |
| CAPTCHA | Não utiliza | Abstraído pelo fornecedor; erro 601 quando lento |
| Múltiplas fontes | Não | Sim |
| Operação dentro do Portal | Sim | Sim |
| Armazenamento próprio | Recomendado | Obrigatório antes de três meses |

## Referências

[1]: https://apicenter.estaleiro.serpro.gov.br/documentacao/consulta-cnd/pt/tipos_retornados/ "Serpro — API Consulta CND: códigos e objeto de retorno"
[2]: https://docs.netrin.com.br/docs/consulta-composta/Defini%C3%A7%C3%A3o "Netrin — definição da Consulta Composta"
[3]: https://docs.netrin.com.br/docs/consulta-composta/Fontes%20de%20Consultas%20Ativas "Netrin — fontes de consultas ativas"
[4]: https://infosimples.com/consultas/receita-federal-pgfn/ "InfoSimples — CND Federal RFB/PGFN"
[5]: https://infosimples.com/consultas/sefaz-certidao-debitos/ "InfoSimples — CND estadual nas 27 SEFAZ"
[6]: https://docs.fiscalapi.com.br/docs/cnd/consultar-cnd "FiscalAPI — consulta de CND estadual por UF"
[7]: https://docs.bigdatacorp.com.br/plataforma/reference/ondemand-debitos-trabalhistas-negativa "BigDataCorp — CNDT on-demand"
[8]: https://www.gov.br/pt-br/servicos/obter-solucao-de-consulta-de-dados-de-certidao-negativa-de-debito-cnd "Gov.br — contratação da solução Consulta CND"
[9]: https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito "ConectaGov — catálogo da API Consulta CND"
[10]: https://www.gov.br/conecta/catalogo/apis/consultar-certidao-negativa-de-debito/swagger.json/swagger_view "ConectaGov — OpenAPI da Consulta CND"
[11]: https://infosimples.com/consultas/precos/ "InfoSimples — preços e adicionais das APIs"
[12]: https://docs.fiscalapi.com.br/docs/referencia/plans-and-limits "FiscalAPI — planos e limites"
[13]: https://fontedata.com/docs/certidoes "FonteData — catálogo e preços de certidões"
[14]: https://www.directd.com.br/central-de-ajuda/apis/catalogo/MPFCertidaoNegativa "Direct Data — API de certidão negativa do MPF"
