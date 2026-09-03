# Pesquisa técnica — SIEG e acompanhamento de certidões

**Data da pesquisa:** 3 de setembro de 2026  
**Status:** em validação

## Achados confirmados em fontes oficiais

A página institucional do SIEG apresenta **“Monitoramento de certidões e obrigações”** como capacidade da plataforma e relaciona essa função ao módulo **Controle de Pendências**. A mesma página afirma que a infraestrutura SIEG possui **API aberta**, mas não especifica publicamente nessa página quais operações de certidões estão expostas pela API.[1]

O material oficial do SIEG HüB descreve o **AutodocS** como automação para captura de documentos fiscais em portais estaduais e municipais e informa mais de 2.000 prefeituras integradas. O material também diz que as APIs do HüB permitem envio e recebimento de **documentos fiscais**. Esses textos confirmam uma arquitetura de conectores e automações, porém não comprovam que a API pública do HüB emita ou recupere CNDs.[2]

O changelog oficial evidencia características operacionais relevantes: status da última consulta por empresa; estados de erro, sucesso, alerta e aguardando; reprocessamento manual das automações municipais; uso de certificado A1 para web services; uso de aplicativo local para certificado A3; e consultas periódicas em segundo plano. Esses elementos explicam parte da complexidade percebida: múltiplas fontes, certificados, robôs municipais, reprocessamentos e frequências diferentes.[3]

### Controle de Pendências

A página específica do módulo confirma que o SIEG acessa o e-CAC automaticamente e monitora **certidões federais, estaduais e trabalhistas em segundo plano**. Ela também menciona gestão de procurações, usuários e certificados digitais, cadastro automático de empresas, retentativa quando o portal governamental volta ao ar e alertas por e-mail ou WhatsApp. Isso indica que o produto opera como uma camada própria de orquestração, com credenciais/certificados dos clientes e filas de reprocessamento, e não como simples chamada instantânea a uma API pública.[5]

### API e integração externa

A página oficial de integrações lista conexões com sistemas contábeis e ERPs, mas descreve os fluxos publicados principalmente como envio de **XMLs**. A página de preços marca “Integrações via API” nos planos e afirma que a API aberta atende integrações personalizadas de documentos fiscais, sem apresentar endpoint, webhook ou contrato público para exportar certidões e seus PDFs.[6] [7]

Assim, até esta etapa da pesquisa, está confirmado que o SIEG **monitora certidões internamente**, mas não está confirmado que o Portal Controller possa consumir esse resultado por uma API contratável. Essa distinção será decisiva: se o módulo de certidões não possuir API ou webhook, integrar o SIEG apenas acrescentaria uma segunda interface sem eliminar a morosidade relatada.

## Indício sobre API de CND

Uma solicitação pública no portal de ideias do SIEG, publicada em 29 de novembro de 2024, aparece nos resultados de pesquisa como **“Integração API CND”**, com status **“Aberto”**, solicitando download automático de certidões. A página dinâmica não revelou os detalhes completos por extração textual. Esse indício sugere que a integração de CND pela API poderia ser uma demanda ainda não entregue naquela data, mas a conclusão precisa ser confirmada no Swagger e com o fornecedor antes de ser tratada como fato.[4]

## Hipótese técnica a validar

Até o momento, a API pública do SIEG está claramente documentada para notas e documentos fiscais, enquanto o acompanhamento de certidões parece pertencer ao módulo interno de Controle de Pendências. É necessário validar se existe endpoint contratual não público, exportação, webhook ou integração B2B para certidões. Também será necessário distinguir **monitoramento de situação/debitos do e-CAC** de **emissão e armazenamento de PDF juridicamente verificável**.

## Referências

[1]: https://www.sieg.com/ "SIEG — página institucional"
[2]: https://www.sieg.com/hub/ "SIEG HüB — automação, documentos fiscais e APIs"
[3]: https://sieg.sleekplan.app/changelog?type=feature "SIEG — changelog de funcionalidades"
[4]: https://sieg.sleekplan.app/feedback/187347 "SIEG — sugestão pública Integração API CND"
[5]: https://www.sieg.com/controle-pendencias "SIEG — Controle de Pendências"
[6]: https://www.sieg.com/integracoes "SIEG — Integrações"
[7]: https://www.sieg.com/precos "SIEG — Planos e recursos"
