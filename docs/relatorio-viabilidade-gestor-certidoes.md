# Relatório de viabilidade do Gestor de Certidões

**Projeto:** Portal Controller  
**Data da verificação:** 3 de setembro de 2026  
**Autor:** Manus AI

## 1. Conclusão executiva

O **Gestor de Certidões é viável**, mas a solução não deve ser desenhada como uma automação cega e integral para todas as fontes. Os cinco portais têm comportamentos diferentes: alguns permitem consulta pública e emissão direta; outros exigem CAPTCHA, autenticação Gov.br ou bloqueiam acessos originados de infraestrutura de datacenter. A arquitetura correta é **híbrida e orientada por conectores**, com um lote único por CNPJ e um item independente para cada fonte.

Em uma execução, o usuário selecionará uma empresa já cadastrada no Portal Controller e iniciará as cinco pesquisas. Os conectores compatíveis prosseguirão automaticamente; os que exigirem ação humana ficarão no estado **“Aguardando intervenção”**. Quando houver PDF, o documento será armazenado e disponibilizado para download. Quando o portal retornar apenas uma tela ou mensagem, o sistema registrará o texto, a classificação do resultado, a data, o endereço consultado e uma captura de evidência.

> **Decisão recomendada:** construir primeiro o orquestrador, o histórico e dois conectores-piloto — SEFAZ-SP e Receita Federal — antes de ampliar para PGE-SP, CAIXA e TST.

## 2. Resultado da verificação dos portais

| Fonte | O que foi identificado | PDF/resultado | Nível preliminar | Medida necessária |
| --- | --- | --- | --- | --- |
| Receita Federal | Aplicação pública dinâmica com **hCaptcha** carregado no fluxo. O código público da aplicação prevê emissão bem-sucedida, PDF codificado, download automático e link manual; também prevê mensagens quando não houver certidão.[1] [2] | PDF ou mensagem HTML | **Automação assistida** | Preencher o CNPJ automaticamente, apresentar o hCaptcha ao operador e retomar o fluxo após a resolução humana. Capturar download ou mensagem final. |
| SEFAZ-SP — débitos não inscritos | Tela pública com seleção CNPJ/CPF, campo de documento e botão de emissão. Não foi observado CAPTCHA na tela inicial. O portal informa funcionamento em dias úteis, das 06h às 21h, no horário de Brasília.[3] | Emissão a confirmar em teste funcional | **Boa candidata à automação** | Criar prova de conceito com CNPJ autorizado, confirmar o formato de resposta e respeitar a janela de disponibilidade e eventuais limites de frequência. |
| PGE-SP — dívida ativa | O link informado exige autenticação por **Gov.br**. Em paralelo, foi localizada API oficial da Prodesp/PGE-SP com `GET /certidoes` por CPF/CNPJ/código do canal e consulta de situação fiscal por CNPJ.[4] [5] | API ou fluxo autenticado | **API prioritária; navegador como contingência** | Solicitar acesso formal à API. Se não houver elegibilidade ou aprovação, usar sessão Gov.br iniciada pelo operador, sem armazenar senha no portal. |
| CAIXA — CRF/FGTS | O portal devolveu **HTTP 403 Forbidden** para o ambiente automatizado, antes da exibição do formulário.[6] | Não validado no ambiente atual | **Dependente do ambiente de execução** | Testar em navegador executado no ambiente do cliente ou em infraestrutura brasileira permitida. Avaliar canal oficial de integração. Não assumir viabilidade integral antes do protótipo. |
| TST — CNDT | Tela pública de emissão. O formulário solicita CNPJ/CPF e **CAPTCHA visual**, com alternativa de áudio. O botão declara download do PDF e existe opção de envio por e-mail.[7] | PDF direto ou envio por e-mail | **Automação assistida** | Preencher o CNPJ, pausar para resolução humana do CAPTCHA e capturar o download. Não implementar contorno automático do desafio. |

## 3. Medidas técnicas necessárias

### 3.1 Orquestração por lote

Cada solicitação deve gerar um **lote de consulta** associado ao CNPJ e cinco itens filhos, um por fonte. Os itens poderão iniciar em paralelo, mas deverão evoluir individualmente entre estados como `na_fila`, `em_execucao`, `aguardando_usuario`, `concluido_com_pdf`, `concluido_com_mensagem`, `indisponivel` e `erro`. Essa separação evita que um CAPTCHA ou uma indisponibilidade interrompa todas as demais consultas.

| Registro | Conteúdo mínimo |
| --- | --- |
| Lote | Empresa, CNPJ, usuário solicitante, início, término e resumo consolidado. |
| Item da consulta | Fonte, URL, estado, tentativas, início, término, mensagem técnica e resultado classificado. |
| Documento | Chave do arquivo, nome, tipo MIME, origem, data de emissão, validade quando disponível e hash de integridade. |
| Evidência de tela | Texto extraído, captura, URL final, data/hora e código de resposta observado. |

Os PDFs e as capturas devem ficar no armazenamento de arquivos do projeto; o banco deve guardar somente metadados e referências. A plataforma já possui autenticação, papéis de usuário, cadastro empresarial e armazenamento compatível com esse modelo.

### 3.2 Executor de navegador

Os conectores baseados em tela precisam de um navegador programável capaz de preencher campos, aguardar redirecionamentos, observar downloads e produzir capturas. Ferramentas modernas de automação oferecem eventos próprios para downloads e captura de tela, o que permite guardar tanto o PDF quanto a evidência visual.[8] [9]

O executor não deve residir necessariamente no mesmo processo do portal. A CAIXA bloqueou o IP do ambiente atual, e cinco sessões simultâneas podem consumir mais recursos que uma aplicação web comum. A solução mais resiliente é manter o **Portal Controller como camada de gestão** e usar um **serviço executor separado**, conectado por fila e protegido por credenciais de serviço.

### 3.3 Intervenção humana segura

CAPTCHAs e autenticação Gov.br devem gerar uma tarefa visível no painel. O usuário recebe o aviso, abre uma sessão protegida, conclui a etapa e devolve o controle ao robô. O sistema não deve armazenar senha do Gov.br nem contratar mecanismos de quebra de CAPTCHA. Além de reduzir risco operacional, isso preserva a rastreabilidade sobre quem autorizou cada consulta.

### 3.4 APIs oficiais antes de automação de tela

A API da PGE-SP deve ser priorizada porque elimina dependência de seletores visuais, sessão de navegador e mudanças de layout. O trabalho inicial é confirmar se a empresa pode contratar ou receber credenciais para o produto publicado pela Prodesp. A mesma regra deverá ser aplicada futuramente a cada prefeitura: **API oficial quando disponível; conector de navegador somente quando necessário e permitido**.

## 4. Opções de implantação

| Abordagem | Como funciona | Vantagens e limitações | Custo relativo | Complexidade inicial |
| --- | --- | --- | --- | --- |
| **Portal + executor dedicado** | O Portal Controller cria os lotes; um serviço separado executa navegadores e devolve PDFs, mensagens e evidências. | Melhor isolamento, controle de concorrência e possibilidade de escolher infraestrutura aceita pelos portais. Requer operação de um segundo componente. | Médio, com infraestrutura recorrente | Média/alta |
| **Execução assistida no computador do operador** | Um agente ou navegador local realiza as consultas; o usuário resolve CAPTCHA e Gov.br no próprio ambiente. | Reduz problemas de IP e mantém autenticação com o usuário. Exige computador ligado e instalação controlada. | Baixo/médio | Média |
| **Somente APIs e consultas manuais remanescentes** | Integra-se apenas às APIs aprovadas; demais fontes ficam com links e registro manual no painel. | Menor risco e implantação rápida, porém não entrega a automação completa desejada. | Baixo | Baixa |

Para o objetivo informado, a primeira abordagem é a mais escalável, enquanto a segunda é uma alternativa prática para CAIXA, CAPTCHA e Gov.br durante a fase piloto. A escolha final depende do volume diário, da quantidade de operadores e da possibilidade de obter acesso oficial à API da PGE-SP.

## 5. Plano recomendado de implementação

| Etapa | Entrega | Critério de aceite |
| --- | --- | --- |
| 1. Núcleo | Tabelas de lotes, itens, documentos e evidências; painel de andamento; permissões. | Um CNPJ gera cinco itens rastreáveis, mesmo sem conectores reais. |
| 2. Piloto SEFAZ-SP | Preenchimento, submissão, captura de retorno e tratamento de indisponibilidade. | Consulta concluída ou erro compreensível, sem travar o lote. |
| 3. Piloto Receita | Fluxo assistido para hCaptcha, captura do PDF ou da mensagem. | Usuário resolve o desafio e o processo continua do ponto interrompido. |
| 4. PGE-SP | Solicitação de acesso à API e, se necessário, protótipo com sessão Gov.br. | Decisão documentada entre API e fluxo assistido. |
| 5. TST e CAIXA | CAPTCHA assistido no TST e prova de conceito da CAIXA em ambiente permitido. | PDF do TST armazenado; CAIXA classificada como viável ou inviável no ambiente escolhido. |
| 6. Operação | Retentativas controladas, alertas, auditoria, limites por fonte e monitoramento de mudanças. | Execuções repetíveis, histórico consultável e falhas isoladas por conector. |

## 6. Informações ainda necessárias

Para fechar o desenho de produção, será necessário definir o **volume estimado de CNPJs por dia**, quantos usuários poderão executar lotes simultaneamente, se as consultas serão apenas manuais ou também periódicas, e se a organização possui elegibilidade para solicitar a API da Prodesp. Também será necessário disponibilizar CNPJs autorizados para os testes funcionais, evitando consultas aleatórias ou gravação indevida de dados.

Os portais municipais devem permanecer fora da primeira entrega. O modelo de conectores permitirá adicioná-los depois, um município por vez, com campos adicionais — como inscrição municipal — já disponíveis no cadastro empresarial compartilhado.

## Referências

[1]: https://servicos.receitafederal.gov.br/servico/certidoes/#/home/cnpj "Receita Federal — Certidão de regularidade fiscal de pessoa jurídica"
[2]: https://servicos.receitafederal.gov.br/servico/certidoes/main-PDLHEFWG.js "Receita Federal — pacote público da aplicação de certidões analisado em 03/09/2026"
[3]: https://www10.fazenda.sp.gov.br/CertidaoNegativaDeb/Pages/EmissaoCertidaoNegativa.aspx "SEFAZ-SP — Emissão de certidão negativa de débitos tributários não inscritos"
[4]: https://www.dividaativa.pge.sp.gov.br/sc/loginIdpGovBr.jsf "PGE-SP — acesso ao Site do Contribuinte via Gov.br"
[5]: https://api.prodesp.sp.gov.br/portaldeapis/product/pgesp-procuradoria-geral-do-estado-de-s%C3%A3o-paulo/01tKj00000RGnYLIA1 "Prodesp — API oficial da PGE-SP"
[6]: https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf "CAIXA — Consulta de Regularidade do Empregador"
[7]: https://cndt-certidao.tst.jus.br/inicio.faces "TST — Emissão de Certidão Negativa de Débitos Trabalhistas"
[8]: https://playwright.dev/docs/downloads "Playwright — Downloads"
[9]: https://playwright.dev/docs/screenshots "Playwright — Screenshots"
