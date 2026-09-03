# Caminhos para automatizar inscrições estaduais e municipais

**Projeto:** Portal Controller  
**Data:** 3 de setembro de 2026  
**Autor:** Manus AI

## Diagnóstico da base atual

A base empresarial contém **442 clientes ativos**. A consulta agregada, sem exposição de registros individuais, mostrou que **441 cadastros já foram enriquecidos com dados da Receita**, mas nenhum possui inscrição estadual ou municipal preenchida. A completude média calculada pelo novo painel é de **66%**; 438 cadastros estão em complementação e quatro foram classificados como críticos.

A verificação de duplicidades não encontrou CNPJs repetidos. Foram identificados **18 grupos com razão social exatamente igual**, somando 48 ocorrências além da primeira. Esses casos não devem ser unificados automaticamente, pois podem representar filiais ou estabelecimentos distintos; o CNPJ permanece como chave de identidade e a razão social repetida deve apenas gerar revisão informativa.

Geograficamente, 340 empresas estão em São Paulo, 26 no Rio de Janeiro, 16 no Distrito Federal e dez em Minas Gerais. No nível municipal, as maiores concentrações são São Paulo, com 201 empresas; Sorocaba, com 52; Barueri, com 43; Rio de Janeiro, com 22; e Brasília, com 16. Essa distribuição permite priorizar conectores pelo impacto real.

## Inscrição estadual

| Caminho | Cobertura | Vantagens | Limitações | Recomendação |
| --- | --- | --- | --- | --- |
| **CADESP — dados públicos de São Paulo** | Empresas com IE em SP | A Secretaria da Fazenda informa que qualquer pessoa pode usar a consulta pública e oferece uma relação completa de IEs para download.[1] | A página de download não respondeu no ambiente de desenvolvimento; formato e rotina de atualização ainda precisam de validação operacional. | **Primeiro piloto**, pois SP representa 340 dos 442 clientes. Cruzar CNPJ e IE em lote e confirmar atualização da fonte. |
| **SINTEGRA e consultas estaduais** | Uma consulta diferente por UF | Fonte pública e oficial por estado.[2] | Portais heterogêneos, eventuais CAPTCHAs, indisponibilidades e manutenção de múltiplos conectores. | Usar como validação e contingência, não como única camada nacional. |
| **Consulta Cadastro da NF-e** | UFs que publicam o serviço | O Portal Nacional da NF-e lista serviços `CadConsultaCadastro4` de várias administrações tributárias, com retorno cadastral estruturado.[3] | Cobertura e requisitos variam por UF; integração SOAP e certificado digital podem ser necessários. | Boa opção para operação fiscal que já possua certificado e infraestrutura de NF-e. |
| **API agregadora comercial** | Nacional, conforme o fornecedor | Uma integração única e resposta padronizada. SintegrAPI declara cobertura das 27 UFs; CNPJ.ws informa retorno de inscrições estaduais.[4] [5] | Custo mensal, limites de consulta e dependência contratual. Os dados e o SLA precisam ser homologados. | **Caminho mais rápido para produção nacional**, após teste comparativo com uma amostra autorizada. |
| **XML de NF-e recebido ou emitido** | Empresas que aparecem em documentos fiscais da organização | O XML fiscal já contém a IE do emitente/destinatário quando informada; evita pesquisa por tela. | Não cobre empresas sem relacionamento fiscal ou contribuintes isentos; depende de acesso legítimo aos XMLs. | Usar como fonte adicional de alta confiança, com data e documento de origem. |

## Inscrição municipal

Não foi identificada uma API pública nacional que devolva a inscrição municipal de qualquer empresa. A Redesim centraliza serviços e consultas do CNPJ, mas a inscrição municipal continua dependente da integração e dos cadastros de cada município.[6] Por isso, o caminho deve ser **municipal e progressivo**.

| Caminho | Cobertura | Vantagens | Limitações | Recomendação |
| --- | --- | --- | --- | --- |
| **Prefeitura de São Paulo — FDC/CCM** | 201 clientes da carteira | A Prefeitura permite emitir a Ficha de Dados Cadastrais informando CPF ou CNPJ.[7] | A tela apresenta CAPTCHA, exigindo sessão assistida ou fornecedor homologado.[8] | **Primeiro conector municipal**; preencher CNPJ, pedir resolução humana do CAPTCHA e extrair o CCM da FDC. |
| **API comercial do CCM de São Paulo** | Município de São Paulo | A InfoSimples documenta consulta por CNPJ/CPF e retorno do campo `ccm` em JSON.[9] | Serviço pago e dependente de terceiros; exige avaliação contratual, LGPD, precisão e SLA. | Alternativa mais rápida ao fluxo assistido, após teste com CNPJs autorizados. |
| **Conectores por prefeitura** | Sorocaba, Barueri e demais municípios | Permite consultar diretamente a fonte municipal. Há exemplos de municípios com consulta pública por CNPJ, como São José do Rio Preto.[10] | Cada portal tem campos, autenticação, CAPTCHA e formatos próprios. | Priorizar por quantidade da carteira: São Paulo, Sorocaba, Barueri, Rio de Janeiro e Brasília. |
| **NFS-e, alvarás e documentos do cliente** | Empresas que fornecem documentos válidos | A IM frequentemente aparece em NFS-e, FDC/CCM e alvarás. Pode ser extraída por parser ou leitura documental e submetida à confirmação. | Depende do documento e pode conter inscrição antiga ou de estabelecimento diferente. | Usar como fonte complementar, guardando evidência e evitando substituição automática sem conferência. |

## Arquitetura recomendada

O cadastro deve continuar sendo **uma única tabela de empresas**, acessada pelos dois gestores. Cada valor enriquecido deverá futuramente guardar também `fonte`, `consultadoEm`, `status`, `evidencia` e `confirmadoPor`. Uma busca automática não deve substituir silenciosamente um valor confirmado pelo usuário; divergências devem ir para uma fila de revisão.

O fluxo recomendado é: tentar primeiro fontes estruturadas; em seguida consultar conectores oficiais por UF ou município; usar automação assistida quando houver CAPTCHA; por fim, oferecer preenchimento manual ou extração de documento. Os estados sugeridos são `pendente`, `localizado`, `aguardando_confirmacao`, `confirmado`, `isento`, `nao_aplicavel`, `nao_localizado` e `erro`.

## Próxima decisão

Para a inscrição estadual, recomenda-se comparar **CADESP, SintegrAPI e CNPJ.ws** em uma amostra autorizada antes de contratar. Para a inscrição municipal, recomenda-se decidir entre **fluxo assistido da FDC de São Paulo** e **API comercial do CCM**, pois a capital concentra quase metade da carteira. Nenhum fornecedor externo foi habilitado nesta etapa e nenhuma credencial foi solicitada.

## Referências

[1]: https://portal.fazenda.sp.gov.br/servicos/cadesp "SEFAZ-SP — Sobre a Inscrição Estadual e Consulta Pública do CADESP"
[2]: http://www.sintegra.gov.br/ "SINTEGRA — Cadastros estaduais"
[3]: https://www.nfe.fazenda.gov.br/portal/webservices.aspx "Portal Nacional da NF-e — Relação de Web Services"
[4]: https://sintegrapi.com.br/ "SintegrAPI — consulta estruturada de inscrição estadual"
[5]: https://www.cnpj.ws/ "CNPJ.ws — API de consulta de CNPJ e inscrições estaduais"
[6]: https://www.gov.br/empresas-e-negocios/pt-br/redesim "Gov.br — Redesim"
[7]: https://prefeitura.sp.gov.br/web/fazenda/w/servicos/ccm/2373 "Prefeitura de São Paulo — Ficha de Dados Cadastrais do CCM"
[8]: https://prefeitura.sp.gov.br/fdc "Prefeitura de São Paulo — Acesso à FDC"
[9]: https://infosimples.com/consultas/pref-sp-sao-paulo-ccm/ "InfoSimples — API de Prefeitura de São Paulo/CCM"
[10]: https://cidadao.riopreto.sp.gov.br/empro_cidadao/sjriopreto/semfaz/empro_comprovante_iss.php "São José do Rio Preto — Comprovante de inscrição e situação cadastral"
